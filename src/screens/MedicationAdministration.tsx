import { useEffect, useState } from "react";
import { api, ApiError, call } from "../bridge";
import {
  Details,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import {
  ClinicalWriteFeedback,
  useClinicalWrite,
  type ClinicalCommand,
} from "../clinical-write";
import {
  WardAdmission,
  type WardContext,
  type WardProps,
} from "../ward-admission";
import { bilingual as t } from "../i18n";
import { formatHospitalTime, hospitalTimeToUtc } from "../hospital-time";
import * as a from "../generated/mar";
import { masterSummary } from "../generated/consultation";
import type {
  PrescriptionDetailOut,
  PrescriptionItemOut,
} from "../generated/verbal_orders_ward";
import { dischargeStatus } from "../generated/dispense";
import {
  marCanWrite,
  marSnapshot,
  marStopCodes,
  marRereadCodes,
} from "../mar-policy";
type OrderChoice = { prescription_id: number; item: PrescriptionItemOut };
type Draft = {
  order?: OrderChoice;
  kind: "chart" | "prn" | "prepare" | "correct" | "generate" | "clear";
  row?: a.MarEntryOut;
  status: string;
  dose: string;
  route: string;
  reason: string;
  correction: string;
  preparation: string;
  identity: string;
  band: string;
  identityNote: string;
  barcode: string;
  visual: boolean;
  self: boolean;
  variance: string;
  time: string;
  entered: boolean;
  batch: string;
  qty: string;
  ack: boolean;
};
type Review = {
  method: "POST";
  path: string;
  body: unknown;
  permission: string;
  protection: "idempotent" | "reconcile";
  high: boolean;
  snapshot?: string;
};
export function MedicationAdministration(props: WardProps) {
  return (
    <section>
      <h1>{t("Medication administration record", "دوا دینے کا ریکارڈ")}</h1>
      <p>
        {t(
          "At the bedside, check the patient and the ordered medicine before recording what was actually given or why it was not given. Preparing a label and charting a dose are separate actions.",
          "مریض کے پاس اصل شناخت اور دوا کا حکم چیک کریں، پھر دی گئی دوا یا نہ دینے کی وجہ درج کریں۔ لیبل اور دوا کا اندراج الگ کام ہیں۔",
        )}
      </p>
      <WardAdmission {...props} screenId="mar">
        {(ctx) => <MarForm {...props} ctx={ctx} />}
      </WardAdmission>
    </section>
  );
}
function MarForm({
  ctx,
  user,
  connected,
  stream,
  timeZone,
}: WardProps & { ctx: WardContext }) {
  const id = ctx.admission.admission_id,
    [tick, setTick] = useState(0),
    [draft, setDraft] = useState<Draft>(),
    [review, setReview] = useState<Review>(),
    [error, setError] = useState<unknown>(),
    [stale, setStale] = useState(false),
    [checker, setChecker] = useState(""),
    [password, setPassword] = useState(""),
    [independent, setIndependent] = useState(false),
    [printBusy, setPrintBusy] = useState(false),
    [printMessage, setPrintMessage] = useState(""),
    [labels, setLabels] = useState<a.PrintOut_DoseLabelFieldsOut_[]>([]);
  const can = (p: string) => user.permissions.includes(p),
    live = connected && stream === "Live";
  const [prescription, setPrescription] = useState<number>();
  const summaries = useLoad(
    () =>
      can("patient.emr.view")
        ? masterSummary(ctx.patient.patient_id)
        : Promise.resolve(undefined),
    [id, tick, ctx.revision],
  );
  const order = useLoad(async () => {
    if (
      !prescription ||
      !summaries.data?.prescriptions.some(
        (r) => r.prescription_id === prescription,
      ) ||
      !can("prescription.view")
    )
      return undefined;
    const r = await api<PrescriptionDetailOut>(
      "GET",
      `/prescriptions/${prescription}`,
    );
    if (r.admission_id !== id || r.patient_id !== ctx.patient.patient_id)
      throw Error(
        "This prescription is not for the selected patient and stay. Choose another returned order.",
      );
    return r;
  }, [prescription, summaries.data, id, tick]);
  const rows = useLoad(
    () => (can("ipd.mar.view") ? a.mar(id) : Promise.resolve([])),
    [id, tick, ctx.revision],
  );
  const stock = useLoad(
    () =>
      ctx.admission.ward_id && can("ward.inventory.view")
        ? a.wardInventory(ctx.admission.ward_id)
        : Promise.resolve([]),
    [id, tick, ctx.revision, ctx.admission.ward_id],
  );
  const discharge = useLoad(
    () =>
      can("ipd.discharge.clear_nursing")
        ? dischargeStatus(id)
        : Promise.resolve(undefined),
    [id, tick, ctx.revision],
  );
  const stamp = (v: string | null | undefined) =>
    v
      ? timeZone
        ? formatHospitalTime(v, timeZone)
        : v
      : t("Not recorded", "درج نہیں");
  const writable = (correction = false) =>
    ctx.ready &&
    live &&
    !rows.loading &&
    !rows.error &&
    marCanWrite(ctx.view, ctx.admission.status, user.permissions, correction);
  const write = useClinicalWrite(user, "mar:" + id, async (result, command) => {
    if (command.path.endsWith("/prepare")) {
      if (
        result.fields?.mrn !== ctx.patient.mrn ||
        result.fields?.mar_id !== draft?.row?.mar_id
      )
        throw Error("Dose label identity differs. Read before printing.");
      setLabels((list) => [
        ...list.filter((l) => l.fields.mar_id !== result.fields.mar_id),
        result,
      ]);
      setPrintMessage(
        t(
          "Preparation recorded. Print its label before preparing another dose. A print failure does not undo preparation.",
          "تیاری درج۔ اگلی دوا سے پہلے اس کا لیبل چھاپیں۔ پرنٹ کی خرابی تیاری واپس نہیں کرتی۔",
        ),
      );
    } else if (
      "patient_id" in result &&
      result.patient_id !== ctx.patient.patient_id
    )
      throw Error("MAR response patient differs; read current records.");
    setDraft(undefined);
    setReview(undefined);
    setStale(false);
    setTick((n) => n + 1);
  });
  useEffect(() => {
    const stop = window.terminal.subscribe((v) => {
      if (
        (v.type === "event" &&
          ((v.event_type === "medication.due" &&
            v.payload?.admission_id === id) ||
            [
              "medication.order.updated",
              "pharmacy.stock.updated",
              "admission.discharge.stage_changed",
            ].includes(v.event_type))) ||
        (v.type === "stream" && v.status === "Live" && v.resync)
      ) {
        setStale(true);
        setReview(undefined);
        setPassword("");
        setChecker("");
        setTick((n) => n + 1);
      }
    });
    return stop;
  }, [id]);
  useEffect(() => {
    if (!write.error) return;
    setReview(undefined);
    setPassword("");
    setChecker("");
    setIndependent(false);
    if (
      write.error instanceof ApiError &&
      marRereadCodes.includes(write.error.response.error?.code || "")
    ) {
      setStale(true);
      setTick((n) => n + 1);
      void ctx.reload();
    }
  }, [write.error]);
  useEffect(() => {
    if (!draft) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [draft]);
  function begin(
    kind: Draft["kind"],
    row?: a.MarEntryOut,
    order?: OrderChoice,
  ) {
    if (
      write.blocked ||
      printBusy ||
      (draft &&
        !window.confirm(
          t("Discard this unsent MAR draft?", "یہ غیر ارسال مسودہ چھوڑ دیں؟"),
        ))
    )
      return;
    setDraft({
      kind,
      row,
      order,
      status: "",
      dose: (row || order?.item)?.dose_text || "",
      route: (row || order?.item)?.route || "",
      reason: "",
      correction: "",
      preparation: "",
      identity: "",
      band: "",
      identityNote: "",
      barcode: "",
      visual: false,
      self: false,
      variance: "",
      time: "",
      entered: false,
      batch: "",
      qty: "",
      ack: false,
    });
    setReview(undefined);
    setError(undefined);
    write.clearError();
    setStale(false);
    setPassword("");
    setChecker("");
    setIndependent(false);
  }
  function change(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setReview(undefined);
    setPassword("");
    setChecker("");
    setIndependent(false);
  }
  function prepare() {
    if (!draft || !draft.ack || stale) return;
    setError(undefined);
    try {
      const d = draft,
        root = `/admissions/${id}`,
        row = d.row || d.order?.item;
      let path = "",
        body: any = {},
        permission = "ipd.mar.administer",
        protection: Review["protection"] = "idempotent",
        high = false;
      if (d.kind === "generate") {
        path = root + "/mar/generate";
        body = undefined;
        protection = "reconcile";
        permission = can("ipd.mar.administer")
          ? "ipd.mar.administer"
          : "prescription.create";
      } else if (d.kind === "clear") {
        path = root + "/discharge/NursingMARVerification/clear";
        body = { note: d.reason.trim() || null };
        permission = "ipd.discharge.clear_nursing";
        protection = "reconcile";
      } else {
        if (!row)
          throw Error(
            t(
              "Select an actual returned order line.",
              "واپس آئی اصل حکم سطر چنیں۔",
            ),
          );
        if (d.kind === "prepare") {
          path = `/mar/${d.row!.mar_id}/prepare`;
          body = { preparation: d.preparation.trim() || null };
        } else {
          if (!d.status && d.kind !== "prn")
            throw Error(t("Choose what actually happened.", "اصل نتیجہ چنیں۔"));
          const administered_at = d.entered
            ? hospitalTimeToUtc(d.time, timeZone || "")
            : null;
          body = {
            administered_at,
            dose_given_text: d.dose.trim() || null,
            route_given: d.route.trim() || null,
            status_reason: d.reason.trim() || null,
          };
          if (d.kind === "correct") {
            if (d.correction.trim().length < 3)
              throw Error(
                t(
                  "A correction needs a reason of3–500characters.",
                  "تصحیح کی وجہ3تا500حروف ہو۔",
                ),
              );
            path = `/mar/${d.row!.mar_id}/correction`;
            body = {
              ...body,
              status: d.status,
              correction_reason: d.correction.trim(),
            };
          } else {
            const administered =
              d.kind === "prn" || d.status === "Administered";
            if (!administered && !d.reason.trim())
              throw Error(
                t(
                  "Give the reason this dose was not administered.",
                  "دوا نہ دینے کی وجہ لکھیں۔",
                ),
              );
            if (administered) {
              if (!d.identity)
                throw Error(
                  t("Identify the patient first.", "پہلے مریض کی شناخت کریں۔"),
                );
              if (d.identity === "WristbandScan" && !d.band.trim())
                throw Error(
                  t("Scan the actual wristband.", "اصل شناختی پٹی اسکین کریں۔"),
                );
              if (
                d.identity === "EmergencyOverride" &&
                (!["Emergency", "CodeRed"].includes(
                  ctx.admission.admission_type,
                ) ||
                  !d.identityNote.trim())
              )
                throw Error(
                  t(
                    "Emergency override needs an emergency admission and its reason.",
                    "ہنگامی شناخت کے لیے ہنگامی داخلہ اور وجہ لازم ہے۔",
                  ),
                );
              if (!d.barcode.trim() && !d.visual)
                throw Error(
                  t(
                    "Scan the medicine or confirm its label was checked.",
                    "دوا اسکین کریں یا اصل لیبل چیک کی تصدیق کریں۔",
                  ),
                );
              if (row.self_administration && !d.self)
                throw Error(
                  t(
                    "This is a self-administration order: confirm that the patient took it.",
                    "یہ خود دوا لینے کا حکم ہے؛ مریض کے خود لینے کی تصدیق کریں۔",
                  ),
                );
              if (d.self && !row.self_administration)
                throw Error(
                  t(
                    "The doctor has not allowed self-administration on this line.",
                    "اس سطر پر خود دوا لینے کی اجازت نہیں۔",
                  ),
                );
              body = {
                ...body,
                wristband_code:
                  d.identity === "WristbandScan" ? d.band.trim() : null,
                identity_check: d.identity,
                identity_note: d.identityNote.trim() || null,
                drug_barcode: d.barcode.trim() || null,
                self_administered: d.self,
                variance_reason: d.variance.trim() || null,
              };
              high = !!row.high_alert_category;
              if (d.batch) {
                const b = stock.data?.find(
                  (b) => String(b.batch_id) === d.batch,
                );
                if (
                  !b ||
                  b.is_expired ||
                  b.is_recalled ||
                  !Number.isFinite(Number(d.qty)) ||
                  Number(d.qty) <= 0
                )
                  throw Error(
                    t(
                      "Choose current usable ward stock and a positive quantity.",
                      "درست موجودہ وارڈ بیچ اور مثبت مقدار چنیں۔",
                    ),
                  );
                body = {
                  ...body,
                  ward_stock_batch_id: b.batch_id,
                  ward_stock_qty: Number(d.qty),
                };
              }
            }
            if (d.kind === "prn") {
              path = root + "/mar/prn";
              body = {
                ...body,
                prescription_item_id: row.prescription_item_id,
              };
              delete body.ward_stock_batch_id;
              delete body.ward_stock_qty;
              if (!d.reason.trim())
                throw Error(
                  t(
                    "Record the actual PRN indication.",
                    "ضرورت کی اصل وجہ درج کریں۔",
                  ),
                );
              protection = high ? "reconcile" : "idempotent";
            } else {
              path = `/mar/${d.row!.mar_id}/chart`;
              body = { ...body, status: d.status };
              protection = "reconcile";
            }
          }
        }
      }
      setReview({
        method: "POST",
        path,
        body,
        permission,
        protection,
        high,
        snapshot: d.row ? marSnapshot(d.row) : undefined,
      });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!draft || !review || write.blocked || stale) return;
    if (review.high && (!independent || !checker.trim() || !password)) return;
    const d = draft,
      r = review;
    const transient = r.high
      ? {
          second_checker_username: checker.trim(),
          second_checker_password: password,
        }
      : undefined;
    setPassword("");
    setChecker("");
    setIndependent(false);
    write.start(
      {
        ...r,
        reconcilePath:
          d.kind === "clear"
            ? `/admissions/${id}/discharge-status`
            : `/admissions/${id}/mar`,
        label: t("Record this MAR action", "دوا کا یہ عمل درج کریں"),
      },
      async () => {
        await ctx.preflight(r.permission, d.kind === "correct");
        const fresh = await a.mar(id);
        rows.setData(fresh);
        if (d.row) {
          const row = fresh.find((x) => x.mar_id === d.row!.mar_id);
          if (!row || marSnapshot(row) !== r.snapshot) {
            setStale(true);
            throw Error(
              t(
                "The dose or safety information changed. Input kept; read latest and review.",
                "دوا یا حفاظتی معلومات بدلیں۔ مسودہ رکھ کر تازہ پڑھیں اور جائزہ لیں۔",
              ),
            );
          }
        }
        if (d.order) {
          const p = await api<PrescriptionDetailOut>(
              "GET",
              `/prescriptions/${d.order.prescription_id}`,
            ),
            item = p.items.find(
              (i) =>
                i.prescription_item_id === d.order!.item.prescription_item_id,
            );
          if (
            p.admission_id !== id ||
            p.patient_id !== ctx.patient.patient_id ||
            ["Cancelled", "Replaced"].includes(p.status) ||
            !item ||
            !["Active", "FullyDispensed"].includes(item.item_status) ||
            JSON.stringify(item) !== JSON.stringify(d.order.item)
          ) {
            setStale(true);
            throw Error(
              "The source medication order changed. Read and select the current line before reviewing.",
            );
          }
        }
        if (d.kind === "clear") {
          const status = await dischargeStatus(id);
          discharge.setData(status);
          const stage = status.stages.find(
            (s) => s.stage === "NursingMARVerification",
          );
          if (
            !status.started ||
            stage?.status === "Cleared" ||
            status.blocked_on !== "NursingMARVerification"
          )
            throw Error(
              t(
                "Read the current discharge stage, officer and time. This clearance is not currently due.",
                "موجودہ ڈسچارج مرحلہ، افسر و وقت پڑھیں۔ اس کلیئرنس کا ابھی مرحلہ نہیں۔",
              ),
            );
        }
      },
      transient,
    );
  }
  async function printLabel(label: a.PrintOut_DoseLabelFieldsOut_ | number) {
    setPrintBusy(true);
    setPrintMessage("");
    try {
      const r = await call("print-dose-label", { marId: typeof label === 'number' ? label : label.fields.mar_id });
      setPrintMessage(
        r.printed
          ? t(
              "Label printed. Check it on the prepared dose.",
              "لیبل چھپ گیا۔ تیار دوا پر چیک کریں۔",
            )
          : t(
              "Printing cancelled. Preparation is still recorded; reprint this label only.",
              "پرنٹ منسوخ؛ تیاری درج ہے، صرف یہی لیبل دوبارہ چھاپیں۔",
            ),
      );
    } catch (e) {
      setError(e);
      setPrintMessage(
        t(
          "Label printing failed. Do not prepare or chart another dose to print again.",
          "لیبل پرنٹ ناکام۔ دوبارہ پرنٹ کے لیے تیاری یا دوا اندراج نہ دہرائیں۔",
        ),
      );
    } finally {
      setPrintBusy(false);
    }
  }
  const stage = discharge.data?.stages.find(
      (s) => s.stage === "NursingMARVerification",
    ),
    corrected = new Set(
      rows.data?.map((r) => r.corrects_mar_id).filter(Boolean),
    ),
    code =
      write.error instanceof ApiError ? write.error.response.error?.code : "";
  const allowedDraft =
    draft?.kind === "clear"
      ? ctx.ready &&
        live &&
        can("ipd.discharge.clear_nursing") &&
        ["full", "open_work"].includes(ctx.view)
      : draft?.kind === "generate"
        ? ctx.ready &&
          live &&
          ["full", "open_work"].includes(ctx.view) &&
          (can("ipd.mar.administer") || can("prescription.create"))
        : writable(draft?.kind === "correct");
  return (
    <section
      data-write-pending={write.blocked || printBusy}
      data-unsaved={!!draft}
      className="mar-record"
    >
      <ErrorBox error={error} />
      <ClinicalWriteFeedback
        key={review ? "review" : "input"}
        write={write}
        onReviewed={() => {
          setStale(true);
          setTick((n) => n + 1);
        }}
      />
      {marStopCodes.includes(code || "") && (
        <p role="alert" className="error">
          {t(
            "STOP: patient or medicine does not match. Check the patient and order again. Do not give this dose.",
            "رکیں: مریض یا دوا مختلف ہے۔ شناخت اور حکم پھر چیک کریں، یہ خوراک نہ دیں۔",
          )}
        </p>
      )}
      {code === "DISCHARGE_STAGE_IMMUTABLE" && (
        <p role="status">
          {t(
            "Already cleared. The current stage below shows who cleared it and when.",
            "پہلے ہی کلیئر ہے۔ نیچے اصل مرحلے میں افسر اور وقت دیکھیں۔",
          )}
        </p>
      )}
      <button
        data-help="mar.read"
        disabled={write.blocked || printBusy}
        onClick={() => {
          setTick((n) => n + 1);
          if (draft) {
            setStale(true);
            setReview(undefined);
          }
        }}
      >
        {t("Refresh medication record", "دوا ریکارڈ تازہ کریں")}
      </button>
      {!can("ipd.mar.view") && (
        <p>
          {t(
            "You do not have permission to read the MAR.",
            "دوا ریکارڈ پڑھنے کی اجازت نہیں۔",
          )}
        </p>
      )}
      <LoadState {...rows} retry={rows.reload} />
      <div className="actions">
        <button
          data-help="mar.generate"
          disabled={
            write.blocked ||
            !ctx.ready ||
            !live ||
            !["full", "open_work"].includes(ctx.view) ||
            !["ipd.mar.administer", "prescription.create"].some(can)
          }
          onClick={() => begin("generate")}
        >
          {t("Generate missing scheduled doses", "غائب مقرر خوراکیں بنائیں")}
        </button>
      </div>
      {!rows.loading && !rows.error && !rows.data?.length && (
        <p>
          {t(
            "No doses returned. If active inpatient orders exist, generate their missing schedule; never invent an order line.",
            "کوئی خوراک نہیں آئی۔ جاری احکام ہوں تو ان کا غائب شیڈول بنائیں، حکم خود نہ گھڑیں۔",
          )}
        </p>
      )}
      {rows.data?.map((r) => (
        <article className="card" key={r.mar_id}>
          <h2>
            {r.drug_name} · #{r.mar_id}
          </h2>
          <p>
            {r.status} · {t("Due", "مقرر")}: {stamp(r.scheduled_at)}{" "}
            {r.is_overdue && (
              <strong className="error">{t("Overdue", "تاخیر")}</strong>
            )}
          </p>
          <p>
            {r.dose_text} · {r.route} · {r.frequency_code}{" "}
            {r.self_administration &&
              t("Patient takes this medicine", "مریض خود دوا لیتا ہے")}
          </p>
          {r.high_alert_category && (
            <p className="error">
              {t(
                "HIGH ALERT — independent second check",
                "زیادہ خطرہ — الگ دوسری جانچ",
              )}
              : {r.high_alert_category}
            </p>
          )}
          {!!r.lasa_with?.length && (
            <p>
              {t("Looks or sounds like", "ملتا جلتا نام")}:{" "}
              {r.lasa_with.join(", ")}
            </p>
          )}
          {corrected.has(r.mar_id) ? (
            <del>
              {r.dose_given_text} {r.route_given} {r.status_reason}
            </del>
          ) : (
            <p>
              {r.dose_given_text} {r.route_given} {r.status_reason}
            </p>
          )}
          <p>
            {r.administered_by_name} · {stamp(r.administered_at)} ·{" "}
            {r.identity_check} · {r.drug_check}
            {r.second_checked_by_name && ` · ${r.second_checked_by_name}`}{" "}
            {r.self_administered && t("Self administered", "خود لی")}
          </p>
          {r.variance_reason && (
            <p>
              {t("Variance reason", "فرق کی وجہ")}: {r.variance_reason}
            </p>
          )}
          {r.is_correction && (
            <p>
              {t("Correction of", "تصحیح")} #{r.corrects_mar_id}:{" "}
              {r.correction_reason}
            </p>
          )}
          {r.prepared_at && (
            <p>
              {t("Prepared", "تیار")}: {r.preparation} · {r.prepared_by_name} ·{" "}
              {stamp(r.prepared_at)}
            </p>
          )}
          <div className="actions">
            {r.prepared_at && <button data-help="mar.print" disabled={write.blocked || printBusy} onClick={()=>void printLabel(r.mar_id)}>{t('Reprint recorded preparation','درج تیاری کا لیبل پھر چھاپیں')} #{r.mar_id}</button>}
            {r.status === "Scheduled" && !r.is_correction ? (
              <>
                <button
                  data-help="mar.chart"
                  disabled={write.blocked || !writable()}
                  onClick={() => begin("chart", r)}
                >
                  {t("Chart scheduled dose", "مقرر خوراک درج کریں")} #{r.mar_id}
                </button>
                <button
                  data-help="mar.prepare"
                  disabled={write.blocked || !writable() || !!r.prepared_at}
                  onClick={() => begin("prepare", r)}
                >
                  {t("Prepare and label", "تیار اور لیبل")} #{r.mar_id}
                </button>
              </>
            ) : (
              <button
                data-help="mar.correct"
                disabled={write.blocked || !writable(true)}
                onClick={() => begin("correct", r)}
              >
                {t("Correct dose record", "خوراک ریکارڈ کی تصحیح")} #{r.mar_id}
              </button>
            )}
            <button
              data-help="mar.prn"
              disabled={write.blocked || !writable()}
              onClick={() => begin("prn", r)}
            >
              {t(
                "Record ad-hoc dose from this order",
                "اسی حکم کی اضافی خوراک درج کریں",
              )}{" "}
              #{r.mar_id}
            </button>
          </div>
        </article>
      ))}
      <section className="card">
        <h2>
          {t("PRN and ad-hoc ordered medicines", "حسب ضرورت دوا کے اصل احکام")}
        </h2>
        <LoadState {...summaries} retry={summaries.reload} />
        {!can("patient.emr.view") && (
          <p>
            {t(
              "Reading order history needs patient EMR permission. Ask the responsible prescriber; never type a line identifier.",
              "اصل حکم پڑھنے کی اجازت درکار۔ ذمہ دار ڈاکٹر سے کہیں، سطر نمبر نہ لکھیں۔",
            )}
          </p>
        )}
        {summaries.data?.prescriptions.map((p) => (
          <button
            data-help="mar.orders"
            key={p.prescription_id}
            disabled={write.blocked}
            onClick={() => setPrescription(p.prescription_id)}
          >
            {p.prescription_number} · {p.source} · {p.status}
          </button>
        ))}
        <LoadState {...order} retry={order.reload} />
        {order.data?.items
          .filter(
            (i) =>
              ["Active", "FullyDispensed"].includes(i.item_status) &&
              !["Cancelled", "Replaced"].includes(order.data!.status),
          )
          .map((item) => (
            <div key={item.prescription_item_id}>
              <p>
                {item.drug_name} · {item.dose_text} · {item.route} ·{" "}
                {item.frequency_code} · {item.instructions}
              </p>
              {item.high_alert_category && (
                <p className="error">HIGH ALERT: {item.high_alert_category}</p>
              )}
              {!!item.lasa_with.length && (
                <p>
                  {t("Looks or sounds like", "ملتا جلتا نام")}:{" "}
                  {item.lasa_with.join(", ")}
                </p>
              )}
              <button
                data-help="mar.prn"
                disabled={write.blocked || !writable()}
                onClick={() =>
                  begin("prn", undefined, {
                    prescription_id: order.data!.prescription_id,
                    item,
                  })
                }
              >
                {item.is_prn
                  ? t("Record ordered PRN dose", "حکم کی حسب ضرورت خوراک درج")
                  : t(
                      "Record ordered ad-hoc dose",
                      "حکم کی اضافی خوراک درج",
                    )}{" "}
                · {item.drug_name}
              </button>
            </div>
          ))}
      </section>
      <section className="card">
        <h2>{t("Ward stock", "وارڈ اسٹاک")}</h2>
        <LoadState {...stock} retry={stock.reload} />
        {!stock.data?.length && !stock.loading && !stock.error && (
          <p>{t("No ward stock returned.", "وارڈ اسٹاک نہیں آیا۔")}</p>
        )}
        {stock.data?.map((b) => (
          <p key={b.batch_id}>
            {b.drug_name} · {b.batch_no} · {b.qty} · {b.expiry_date}{" "}
            {b.is_expired &&
              t("Expired — do not use", "میعاد ختم — استعمال نہیں")}{" "}
            {b.is_recalled &&
              t("Recalled — do not use", "واپس طلب — استعمال نہیں")}
          </p>
        ))}
      </section>
      {!!labels.length && (
        <section className="card">
          <h2>{t("Prepared dose labels", "تیار دوا کے لیبل")}</h2>
          {labels.map((label) => (
            <div key={label.fields.mar_id}>
              <Details value={label.fields} />
              <button
                data-help="mar.print"
                disabled={printBusy || write.blocked}
                onClick={() => void printLabel(label)}
              >
                {t("Print / reprint saved label", "محفوظ لیبل چھاپیں")} #
                {label.fields.mar_id}
              </button>
            </div>
          ))}
        </section>
      )}
      {printMessage && <p role="status">{printMessage}</p>}
      {can("ipd.discharge.clear_nursing") && (
        <section className="card">
          <h2>{t("Nursing discharge verification", "نرسنگ ڈسچارج تصدیق")}</h2>
          <LoadState {...discharge} retry={discharge.reload} />
          {discharge.data && (
            <>
              <p>
                {discharge.data.started
                  ? t("Discharge started", "ڈسچارج شروع")
                  : t("Discharge has not started", "ڈسچارج شروع نہیں")}{" "}
                · {t("Waiting on", "منتظر")}: {discharge.data.blocked_on || "—"}
              </p>
              {stage && (
                <p>
                  {stage.status} · {stage.cleared_by_name} ·{" "}
                  {stamp(stage.cleared_at)} · {stage.note}
                </p>
              )}
              <button
                data-help="mar.clear"
                disabled={
                  write.blocked ||
                  !ctx.ready ||
                  !live ||
                  !["full", "open_work"].includes(ctx.view) ||
                  stage?.status === "Cleared" ||
                  discharge.data.blocked_on !== "NursingMARVerification" ||
                  !!rows.data?.some(
                    (r) => r.status === "Scheduled" && r.is_overdue,
                  )
                }
                onClick={() => begin("clear")}
              >
                {t(
                  "Verify Nursing MAR discharge stage",
                  "نرسنگ دوا ڈسچارج مرحلہ کلیئر",
                )}
              </button>
            </>
          )}
        </section>
      )}
      {draft && (
        <fieldset className="card" disabled={write.blocked || !ctx.ready}>
          <legend>
            {t("MAR draft", "دوا ریکارڈ مسودہ")} · {draft.kind} ·{" "}
            {(draft.row || draft.order?.item)?.drug_name}
          </legend>
          {stale && (
            <p role="alert">
              {t(
                "Data changed. Keep input, read latest and review again.",
                "معلومات بدلیں۔ مسودہ رکھ کر تازہ پڑھیں اور پھر جائزہ لیں۔",
              )}
            </p>
          )}
          {draft.kind === "prepare" ? (
            <Field
              label={t(
                "Preparation / diluent / rate",
                "تیاری، محلول اور رفتار",
              )}
            >
              <textarea
                data-help="mar.prepare"
                data-field="preparation"
                maxLength={300}
                value={draft.preparation}
                onChange={(e) => change({ preparation: e.target.value })}
              />
            </Field>
          ) : (
            !["generate", "clear"].includes(draft.kind) && (
              <>
                {draft.kind !== "prn" && (
                  <Field label={t("Actual dose outcome", "خوراک کا اصل نتیجہ")}>
                    <select
                      data-help="mar.chart"
                      data-field="status"
                      value={draft.status}
                      onChange={(e) => change({ status: e.target.value })}
                    >
                      <option value="">
                        {t("Choose outcome", "نتیجہ چنیں")}
                      </option>
                      {[
                        "Administered",
                        "Held",
                        "Refused",
                        "Missed",
                        "Cancelled",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label={t("Actual dose text", "اصل خوراک")}>
                  <input
                    data-help="mar.chart"
                    data-field="dose_given_text"
                    value={draft.dose}
                    onChange={(e) => change({ dose: e.target.value })}
                  />
                </Field>
                <Field label={t("Actual route", "اصل راستہ")}>
                  <input
                    data-help="mar.chart"
                    data-field="route_given"
                    value={draft.route}
                    onChange={(e) => change({ route: e.target.value })}
                  />
                </Field>
                <label>
                  <input
                    data-help="mar.time"
                    type="checkbox"
                    checked={draft.entered}
                    onChange={(e) => change({ entered: e.target.checked })}
                  />
                  {t(
                    "Enter actual hospital administration time (otherwise server time)",
                    "دوا دینے کا اصل ہسپتال وقت درج کریں، ورنہ سرور وقت",
                  )}
                </label>
                {draft.entered && (
                  <Field
                    label={t(
                      "Administered at (hospital time)",
                      "دوا دینے کا وقت (ہسپتال)",
                    )}
                  >
                    <input
                      data-help="mar.time"
                      data-field="administered_at"
                      type="datetime-local"
                      value={draft.time}
                      onChange={(e) => change({ time: e.target.value })}
                    />
                  </Field>
                )}
                {draft.kind === "correct" ? (
                  <Field label={t("Correction reason", "تصحیح کی وجہ")}>
                    <textarea
                      data-help="mar.correct"
                      data-field="correction_reason"
                      minLength={3}
                      maxLength={500}
                      value={draft.correction}
                      onChange={(e) => change({ correction: e.target.value })}
                    />
                  </Field>
                ) : (
                  <>
                    <Field
                      label={t(
                        "Patient identity method",
                        "مریض شناخت کا طریقہ",
                      )}
                    >
                      <select
                        data-help="mar.identity"
                        data-field="identity_check"
                        value={draft.identity}
                        onChange={(e) => change({ identity: e.target.value })}
                      >
                        <option value="">
                          {t("Choose after checking", "چیک کے بعد چنیں")}
                        </option>
                        <option value="WristbandScan">
                          {t("Scan wristband", "شناختی پٹی اسکین")}
                        </option>
                        <option value="TwoIdentifiers">
                          {t(
                            "Asked name and DOB or MRN",
                            "نام اور پیدائش یا ایم آر این پوچھے",
                          )}
                        </option>
                        {["Emergency", "CodeRed"].includes(
                          ctx.admission.admission_type,
                        ) && (
                          <option value="EmergencyOverride">
                            {t(
                              "Unidentified emergency — explain",
                              "نامعلوم ہنگامی مریض — وجہ",
                            )}
                          </option>
                        )}
                      </select>
                    </Field>
                    {draft.identity === "WristbandScan" && (
                      <Field
                        label={t("Scan patient wristband", "مریض پٹی اسکین")}
                      >
                        <input
                          data-help="mar.identity"
                          data-field="wristband_code"
                          maxLength={80}
                          value={draft.band}
                          onChange={(e) => change({ band: e.target.value })}
                        />
                      </Field>
                    )}
                    <Field label={t("Identity explanation", "شناخت کی وضاحت")}>
                      <input
                        data-help="mar.identity"
                        data-field="identity_note"
                        maxLength={300}
                        value={draft.identityNote}
                        onChange={(e) =>
                          change({ identityNote: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={t(
                        "Scan medicine pack (optional if label checked)",
                        "دوا پیک اسکین (لیبل چیک پر اختیاری)",
                      )}
                    >
                      <input
                        data-help="mar.medicine"
                        data-field="drug_barcode"
                        maxLength={80}
                        value={draft.barcode}
                        onChange={(e) => change({ barcode: e.target.value })}
                      />
                    </Field>
                    <label>
                      <input
                        data-help="mar.medicine"
                        type="checkbox"
                        checked={draft.visual}
                        onChange={(e) => change({ visual: e.target.checked })}
                      />
                      {t(
                        "I checked the actual medicine label",
                        "میں نے دوا کا اصل لیبل چیک کیا",
                      )}
                    </label>
                    <label>
                      <input
                        data-help="mar.self"
                        type="checkbox"
                        disabled={
                          !(draft.row || draft.order?.item)?.self_administration
                        }
                        checked={draft.self}
                        onChange={(e) => change({ self: e.target.checked })}
                      />
                      {t(
                        "The patient took this medicine themselves as ordered",
                        "مریض نے حکم کے مطابق خود دوا لی",
                      )}
                    </label>
                    <Field
                      label={t(
                        "Dose / route / time variance reason",
                        "خوراک، راستہ یا وقت میں فرق کی وجہ",
                      )}
                    >
                      <textarea
                        data-help="mar.variance"
                        data-field="variance_reason"
                        maxLength={500}
                        value={draft.variance}
                        onChange={(e) => change({ variance: e.target.value })}
                      />
                    </Field>
                    {draft.kind === "chart" && (
                      <>
                        <Field
                          label={t(
                            "Ward stock batch (optional)",
                            "وارڈ بیچ (اختیاری)",
                          )}
                        >
                          <select
                            data-help="mar.stock"
                            data-field="ward_stock_batch_id"
                            value={draft.batch}
                            onChange={(e) => change({ batch: e.target.value })}
                          >
                            <option value="">
                              {t(
                                "Not taken from ward stock",
                                "وارڈ اسٹاک سے نہیں",
                              )}
                            </option>
                            {stock.data?.map((b) => (
                              <option
                                key={b.batch_id}
                                value={b.batch_id}
                                disabled={
                                  b.is_expired || b.is_recalled || b.qty <= 0
                                }
                              >
                                {b.drug_name} · {b.batch_no} · {b.qty} ·{" "}
                                {b.expiry_date}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {draft.batch && (
                          <Field
                            label={t("Ward stock quantity", "وارڈ اسٹاک مقدار")}
                          >
                            <input
                              data-help="mar.stock"
                              data-field="ward_stock_qty"
                              type="number"
                              min="0"
                              step="any"
                              value={draft.qty}
                              onChange={(e) => change({ qty: e.target.value })}
                            />
                          </Field>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )
          )}
          {draft.kind !== "generate" && draft.kind !== "prepare" && (
            <Field
              label={t(
                "Outcome reason / PRN indication / clearance note",
                "نتیجے کی وجہ، ضرورت یا کلیئرنس نوٹ",
              )}
            >
              <textarea
                data-help="mar.reason"
                data-field={draft.kind === "clear" ? "note" : "status_reason"}
                maxLength={draft.kind === "clear" ? 1000 : undefined}
                value={draft.reason}
                onChange={(e) => change({ reason: e.target.value })}
              />
            </Field>
          )}
          <label>
            <input
              data-help="mar.review"
              type="checkbox"
              checked={draft.ack}
              onChange={(e) => change({ ack: e.target.checked })}
            />
            {t(
              "I verified this patient, order and actual outcome",
              "میں نے مریض، حکم اور اصل نتیجہ چیک کیا",
            )}
          </label>
          <div className="actions">
            <button
              data-help="mar.review"
              disabled={!draft.ack || stale || !allowedDraft}
              onClick={prepare}
            >
              {t("Review MAR action", "دوا عمل کا جائزہ")}
            </button>
            <button
              data-help="mar.recovery"
              onClick={async () => {
                try {
                  const fresh = await a.mar(id);
                  rows.setData(fresh);
                  if (draft.row) {
                    const row = fresh.find(
                      (r) => r.mar_id === draft.row!.mar_id,
                    );
                    if (row) change({ row, ack: false });
                  } else change({ ack: false });
                  setStale(false);
                  setTick((n) => n + 1);
                  await ctx.reload();
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t(
                "Read latest MAR and keep input",
                "تازہ دوا ریکارڈ پڑھیں اور مسودہ رکھیں",
              )}
            </button>
            <button
              data-help="mar.review"
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      "Discard this unsent MAR draft?",
                      "غیر ارسال مسودہ چھوڑیں؟",
                    ),
                  )
                ) {
                  setDraft(undefined);
                  setReview(undefined);
                  setPassword("");
                  setChecker("");
                }
              }}
            >
              {t("Close MAR draft", "دوا مسودہ بند کریں")}
            </button>
          </div>
        </fieldset>
      )}
      {review && draft && (
        <Modal
          title={t("Review MAR action", "دوا عمل کا جائزہ")}
          closable={!write.blocked}
          onClose={() => {
            setReview(undefined);
            setPassword("");
            setChecker("");
          }}
        >
          <p>
            {ctx.patient.full_name} · <bdi>{ctx.patient.mrn}</bdi> ·{" "}
            {ctx.admission.admission_number} · {draft.row?.drug_name}
          </p>
          <Details value={review.body || { action: draft.kind }} />
          {review.high && (
            <fieldset disabled={write.blocked}>
              <legend>
                {t(
                  "Independent bedside co-signature",
                  "مریض کے پاس الگ دوسری تصدیق",
                )}
              </legend>
              <label>
                <input
                  data-help="mar.checker"
                  type="checkbox"
                  checked={independent}
                  onChange={(e) => setIndependent(e.target.checked)}
                />
                {t(
                  "The second nurse or doctor independently checked this dose",
                  "دوسری نرس یا ڈاکٹر نے یہ خوراک الگ چیک کی",
                )}
              </label>
              <Field
                label={t(
                  "Second checker username",
                  "دوسرے جانچنے والے کا صارف نام",
                )}
              >
                <input
                  data-help="mar.checker"
                  autoComplete="off"
                  value={checker}
                  onChange={(e) => setChecker(e.target.value)}
                />
              </Field>
              <Field
                label={t(
                  "Second checker password",
                  "دوسرے جانچنے والے کا پاس ورڈ",
                )}
              >
                <input
                  data-help="mar.checker"
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            </fieldset>
          )}
          <div className="actions">
            <button
              data-help="mar.review"
              disabled={
                write.blocked ||
                stale ||
                !allowedDraft ||
                (review.high && (!independent || !checker.trim() || !password))
              }
              onClick={confirm}
            >
              {t("Confirm MAR action once", "دوا عمل ایک بار تصدیق")}
            </button>
            <button
              data-help="mar.review"
              disabled={write.blocked}
              onClick={() => {
                setReview(undefined);
                setPassword("");
                setChecker("");
              }}
            >
              {t("Back to MAR input", "دوا معلومات پر واپس")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
