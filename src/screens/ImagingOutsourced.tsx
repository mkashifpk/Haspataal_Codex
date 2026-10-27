import { useEffect, useRef, useState } from "react";
import { api, call } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { bilingual as t, tr } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as outsourced from "../generated/imaging_outsourced";
import * as imaging from "../generated/radiology_worklist";
import * as patients from "../generated/patient_search";
import { resolvePatientMaster } from "../patient-profile";
import { formatHospitalTime, hospitalTimeToUtc } from "../hospital-time";
import { imagingModalities } from "../radiology-policy";
import {
  outsourcedAccess,
  imagingPartnerEligible,
  outsourceAllowed,
  partnerSnapshot,
  outsourceBody,
  externalReportBody,
  outsourcedSnapshot,
} from "../imaging-outsourced-policy";
type Editor = {
  kind: "send" | "report";
  order: imaging.ImagingOrderDetailOut;
  patient: patients.PatientDetailOut;
  partnerId: string;
  note: string;
  report: string;
  reporter: string;
  reportedAt: string;
  finding: string;
  criticalNote: string;
  checked: boolean;
};
type Review = {
  body: outsourced.OutsourceIn | outsourced.ExternalReportIn;
  partner?: outsourced.PartnerOut;
};
export function ImagingOutsourced({
  user,
  establishment,
  connected,
  stream,
  timeZone,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
}) {
  const view = establishment.views.screens.find(
    (x) => x.screen_id === "imaging_outsourced",
  )?.view;
  const access = outsourcedAccess(view, user.permissions),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [id, setId] = useState(0),
    [lookup, setLookup] = useState(""),
    [modality, setModality] = useState(""),
    [mode, setMode] = useState(""),
    [find, setFind] = useState("");
  const [editor, setEditor] = useState<Editor>(),
    [review, setReview] = useState<Review>(),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [printing, setPrinting] = useState(false);
  const printFlight = useRef(false);
  const list = useLoad(
    () =>
      access.list
        ? outsourced.worklistImaging({
            modality: (modality || undefined) as "CT" | undefined,
          })
        : Promise.resolve([]),
    [access.list, modality, revision],
  );
  const partners = useLoad(
    () =>
      access.visible && user.permissions.includes("imaging.order.update")
        ? outsourced.listPartners({ services: "Imaging", active_only: false })
        : Promise.resolve([]),
    [access.visible, revision],
  );
  const detail = useLoad(
    () =>
      access.read && id ? imaging.getOrder(id) : Promise.resolve(undefined),
    [access.read, id, revision],
  );
  const order =
    !detail.loading && !detail.error && detail.data?.imaging_order_id === id
      ? detail.data
      : undefined;
  const profile = useLoad(
    () =>
      order && user.permissions.includes("patient.view")
        ? resolvePatientMaster(order.patient_id, patients.getPatient)
        : Promise.resolve(undefined),
    [order?.patient_id, revision, user.permissions.includes("patient.view")],
  );
  const patient = !profile.loading && !profile.error ? profile.data : undefined;
  const matches =
    !!patient &&
    !!order &&
    patient.patient_id === order.patient_id &&
    patient.mrn === order.mrn &&
    !patient.merged_into_id;
  const findings = useLoad(
    () =>
      access.write
        ? imaging.listFindings({ active_only: true })
        : Promise.resolve([]),
    [access.write, revision],
  );
  const reportPayload = useLoad(
    () =>
      order?.status === "Reported"
        ? imaging.reportPrintImagingOrdersPayload(id)
        : Promise.resolve(undefined),
    [order?.imaging_order_id, order?.row_version, revision],
  );
  const signed =
    !reportPayload.loading &&
    !reportPayload.error &&
    reportPayload.data?.document_type === "imaging_report" &&
    reportPayload.data.fields.order.imaging_order_id === id &&
    !!reportPayload.data.fields.order.reported_stamp;
  const write = useClinicalWrite(
    user,
    `imaging-outsourced:${id}`,
    async (value, command) => {
      setEditor(undefined);
      setReview(undefined);
      setRevision((n) => n + 1);
      const o = value as outsourced.ImagingOrderOut;
      setNotice(
        command.path.endsWith("/external-report")
          ? o.critical_finding_id || o.critical_finding_note
            ? t(
                "Final partner report recorded. CRITICAL FINDING: tell the responsible doctor now, then record the completed communication in Critical results to tell.",
                "شریک کی حتمی رپورٹ درج۔ اہم نتیجہ: ذمہ دار معالج کو ابھی بتائیں، پھر اہم نتائج کے صفحے میں مکمل اطلاع درج کریں۔",
              )
            : t(
                "Final partner report recorded. The requesting doctor receives the report handover.",
                "شریک کی حتمی رپورٹ درج۔ مانگنے والے معالج کو رپورٹ کا واقعہ پہنچتا ہے۔",
              )
          : t(
              "Examination sent to the partner. Read the actual server deadline; this does not arrange transport or contact the centre.",
              "معائنہ شریک کے سپرد درج۔ اصل سرور مقرر وقت دیکھیں؛ اس سے آمدورفت یا مرکز سے رابطہ نہیں ہوتا۔",
            ),
      );
    },
  );
  const locked = write.blocked || printing;
  const time = (v: string | null | undefined) =>
    v
      ? timeZone
        ? formatHospitalTime(v, timeZone)
        : v
      : t("Not recorded", "درج نہیں");
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (e.type === "stream" && e.status === "Live" && e.resync)
          setRevision((n) => n + 1);
        if (
          e.type === "event" &&
          ["patient.merged", "death.recorded"].includes(e.event_type)
        )
          setRevision((n) => n + 1);
      }),
    [],
  );
  useEffect(() => {
    if (!editor && !write.blocked) return;
    const stop = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [!!editor, write.blocked]);
  function open(next: number) {
    if (locked || editor) return;
    if (!Number.isSafeInteger(next) || next < 1) {
      setError(
        Error(
          t(
            "Enter an actual positive imaging order ID.",
            "عکس آرڈر کا اصل مثبت نمبر دیں۔",
          ),
        ),
      );
      return;
    }
    setId(next);
    setLookup(String(next));
    setNotice("");
    setError(undefined);
    setRevision((n) => n + 1);
  }
  function begin(kind: Editor["kind"]) {
    if (!order || !patient || !matches || !access.write || !live || locked)
      return;
    if (
      kind === "send" &&
      (!outsourceAllowed(order.status) || patient.is_deceased)
    )
      return;
    if (kind === "report" && order.status !== "Outsourced") return;
    setEditor({
      kind,
      order: structuredClone(order),
      patient: structuredClone(patient),
      partnerId: "",
      note: "",
      report: "",
      reporter: "",
      reportedAt: "",
      finding: "",
      criticalNote: "",
      checked: false,
    });
    setReview(undefined);
    setError(undefined);
  }
  function field(key: keyof Editor, value: string | boolean) {
    if (locked || review) return;
    setEditor((e) =>
      e
        ? {
            ...e,
            [key]: value,
            ...(key !== "checked" ? { checked: false } : {}),
          }
        : e,
    );
  }
  function prepare() {
    if (!editor || locked) return;
    try {
      const partner = partners.data?.find(
        (x) => String(x.partner_id) === editor.partnerId,
      );
      const body =
        editor.kind === "send"
          ? outsourceBody(partner, editor.note, editor.checked)
          : externalReportBody(
              editor.report,
              editor.reporter,
              editor.reportedAt
                ? hospitalTimeToUtc(editor.reportedAt, timeZone || "")
                : "",
              editor.finding,
              editor.criticalNote,
              editor.checked,
            );
      if (
        "critical_finding_id" in body &&
        body.critical_finding_id &&
        !findings.data?.some(
          (x) =>
            x.finding_id === body.critical_finding_id &&
            (!x.modality || x.modality === editor.order.modality),
        )
      )
        throw Error(
          t(
            "Choose an active finding matching this modality.",
            "اس عکس قسم کا فعال اہم نتیجہ چنیں۔",
          ),
        );
      setReview({
        body,
        partner: partner ? structuredClone(partner) : undefined,
      });
      setError(undefined);
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!editor || !review || locked || !live) return;
    const e = editor,
      r = review;
    write.start(
      {
        method: "POST",
        path: `/imaging/orders/${e.order.imaging_order_id}/${e.kind === "send" ? "outsource" : "external-report"}`,
        body: r.body,
        permission: "imaging.order.update",
        protection: "idempotent",
        reconcilePath: `/imaging/orders/${e.order.imaging_order_id}`,
        label:
          e.kind === "send"
            ? t("Send examination to partner", "معائنہ شریک کو بھیجیں")
            : t("Record final partner report", "شریک کی حتمی رپورٹ درج"),
      },
      async () => {
        const [me, est, fresh, p] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          imaging.getOrder(e.order.imaging_order_id),
          resolvePatientMaster(e.order.patient_id, patients.getPatient),
        ]);
        if (
          me.user_id !== user.user_id ||
          !outsourcedAccess(
            est.views.screens.find((x) => x.screen_id === "imaging_outsourced")
              ?.view,
            me.permissions,
          ).write ||
          !live ||
          outsourcedSnapshot(fresh) !== outsourcedSnapshot(e.order) ||
          !p ||
          p.patient_id !== e.patient.patient_id ||
          p.row_version !== e.patient.row_version ||
          p.mrn !== fresh.mrn
        )
          throw Error(
            t(
              "The patient, order, permission or service changed. Close and review the current record again.",
              "مریض، آرڈر، اجازت یا خدمت بدلی۔ بند کرکے تازہ ریکارڈ کا پھر جائزہ لیں۔",
            ),
          );
        if (e.kind === "send") {
          if (!outsourceAllowed(fresh.status) || p.is_deceased)
            throw Error(
              t(
                "This order cannot be sent now. Refresh its stage and patient status.",
                "یہ آرڈر ابھی نہیں بھیج سکتے۔ حالت اور مریض تازہ کریں۔",
              ),
            );
          const partner = (
            await outsourced.listPartners({
              services: "Imaging",
              active_only: false,
            })
          ).find((x) => x.partner_id === r.partner?.partner_id);
          if (
            !partner ||
            !r.partner ||
            !imagingPartnerEligible(partner) ||
            partnerSnapshot(partner) !== partnerSnapshot(r.partner)
          )
            throw Error(
              t(
                "The partner or MOU changed. Refresh partners and review again.",
                "شریک یا معاہدہ بدلا۔ شریک تازہ کرکے پھر جائزہ لیں۔",
              ),
            );
          outsourceBody(partner, e.note, e.checked);
        } else {
          if (fresh.status !== "Outsourced")
            throw Error(
              t(
                "The partner report is no longer pending. Read the current order.",
                "شریک کی رپورٹ اب منتظر نہیں۔ موجودہ آرڈر پڑھیں۔",
              ),
            );
          externalReportBody(
            e.report,
            e.reporter,
            e.reportedAt ? hospitalTimeToUtc(e.reportedAt, timeZone || "") : "",
            e.finding,
            e.criticalNote,
            e.checked,
          );
          if (
            e.finding &&
            !(await imaging.listFindings({ active_only: true })).some(
              (x) =>
                x.finding_id === Number(e.finding) &&
                (!x.modality || x.modality === fresh.modality),
            )
          )
            throw Error(
              t(
                "The critical finding changed. Refresh and review again.",
                "اہم نتیجہ بدلا۔ تازہ کرکے پھر جائزہ لیں۔",
              ),
            );
        }
      },
    );
  }
  async function print(kind: "save" | "print" | "original") {
    if (!signed || !order || locked || printFlight.current) return;
    printFlight.current = true;
    setPrinting(true);
    setError(undefined);
    setNotice("");
    try {
      const r =
        kind === "original"
          ? await call("clinical-pdf", {
              path: `/imaging/orders/${id}/report/pdf`,
            })
          : await call("print-diagnostic", {
              kind: "imaging",
              id,
              pdf: kind === "save",
            });
      setNotice(
        r.saved
          ? t("Report PDF saved.", "رپورٹ پی ڈی ایف محفوظ۔")
          : r.printed
            ? t(
                "Report sent to the document printer.",
                "رپورٹ دستاویز پرنٹر کو بھیج دی۔",
              )
            : t(
                "Cancelled; the partner referral and report were not repeated.",
                "منسوخ؛ شریک کو حوالہ اور رپورٹ نہیں دہرائے۔",
              ),
      );
    } catch (e) {
      setError(e);
    } finally {
      printFlight.current = false;
      setPrinting(false);
    }
  }
  if (!access.visible)
    return (
      <Empty>
        {t(
          "Outsourced imaging is unavailable in this service view.",
          "اس خدمت منظر میں شریک کو عکس بھیجنا دستیاب نہیں۔",
        )}
      </Empty>
    );
  const rows =
    !list.loading && !list.error
      ? (list.data || []).filter(
          (x) =>
            (!mode ||
              (mode === "send"
                ? outsourceAllowed(x.status)
                : x.status === "Outsourced")) &&
            `${x.order_number} ${x.accession_number} ${x.patient_name} ${x.mrn} ${x.body_part || ""}`
              .toLowerCase()
              .includes(find.trim().toLowerCase()),
        )
      : [];
  const partner = partners.data?.find(
      (x) => x.partner_id === order?.partner_id,
    ),
    due = list.data?.find((x) => x.imaging_order_id === id);
  return (
    <section
      className="workspace-screen"
      data-help-screen="imaging_outsourced"
      data-write-pending={locked}
      data-unsaved={!!editor}
    >
      <header className="section-heading">
        <div>
          <h1>{t("Outsourced examinations", "بیرونی مرکز کے معائنے")}</h1>
          <p>
            {t(
              "Check the patient and partner agreement, send the examination, then record the partner radiologist’s final report.",
              "مریض اور شریک کا معاہدہ چیک، معائنہ سپرد، پھر شریک ریڈیالوجسٹ کی حتمی رپورٹ درج کریں۔",
            )}
          </p>
        </div>
        <button
          data-help="outsourced.refresh"
          disabled={locked || !!editor}
          onClick={() => setRevision((n) => n + 1)}
        >
          {t("Refresh examinations and partners", "معائنے اور شریک تازہ کریں")}
        </button>
      </header>
      <p role="status">
        {connected ? stream : t("Offline", "آف لائن")} ·{" "}
        {t("Radiology", "ریڈیالوجی")}{" "}
        {view === "open_work"
          ? t(
              " · No new imaging work; complete existing partner reports.",
              " · نیا عکس کام نہیں؛ سابق شریک رپورٹ مکمل کریں۔",
            )
          : view === "records"
            ? t(
                " · Records only — no new referral or report",
                " · صرف ریکارڈ — نیا حوالہ یا رپورٹ نہیں",
              )
            : ""}
      </p>
      {!live && (
        <p className="notice">
          {t(
            "Reconnect before recording. Contact the responsible clinician directly for urgent findings.",
            "درج سے پہلے رابطہ بحال کریں۔ اہم نتیجے پر ذمہ دار معالج سے براہ راست رابطہ کریں۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      {notice && (
        <p
          className={notice.includes("CRITICAL") ? "bench-critical" : "notice"}
          role="status"
        >
          {notice}
        </p>
      )}
      {!editor && (
        <ClinicalWriteFeedback
          write={{ ...write, notice: "" }}
          onReviewed={() => setRevision((n) => n + 1)}
        />
      )}
      <fieldset disabled={locked || !!editor} className="critical-bench-layout">
        {access.list && (
          <section className="card critical-log">
            <h2>
              {t(
                "Examinations and pending partner reports",
                "معائنے اور شریک کی منتظر رپورٹس",
              )}
            </h2>
            <div className="form-grid">
              <Field label={t("Modality", "عکس کی قسم")}>
                <select
                  data-help="outsourced.filters"
                  value={modality}
                  onChange={(e) => setModality(e.target.value)}
                >
                  <option value="">{t("All modalities", "تمام اقسام")}</option>
                  {imagingModalities.map((x) => (
                    <option key={x} value={x}>
                      {tr(x)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Show work", "کام دکھائیں")}>
                <select
                  data-help="outsourced.filters"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="">
                    {t("All returned work", "تمام موصولہ کام")}
                  </option>
                  <option value="send">
                    {t("Ready to send", "بھیجنے کو تیار")}
                  </option>
                  <option value="partner">
                    {t(
                      "At partner — report pending",
                      "شریک کے پاس — رپورٹ منتظر",
                    )}
                  </option>
                </select>
              </Field>
            </div>
            <Field
              label={t(
                "Find in returned examinations",
                "موصولہ معائنوں میں تلاش",
              )}
            >
              <input
                data-help="outsourced.filters"
                value={find}
                onChange={(e) => setFind(e.target.value)}
              />
            </Field>
            <LoadState {...list} retry={list.reload} />
            {!list.loading && !list.error && !rows.length && (
              <Empty>
                {t(
                  "No matching examinations. Clear filters or open an actual known order ID to read its history.",
                  "کوئی متعلقہ معائنہ نہیں۔ چھانٹی صاف یا اصل معلوم آرڈر سے تاریخ پڑھیں۔",
                )}
              </Empty>
            )}
            {rows.map((x) => (
              <article
                className={x.is_overdue ? "bench-critical" : "card"}
                key={x.imaging_order_id}
                data-testid="outsourced-row"
              >
                <strong>
                  <bdi>
                    {x.accession_number} · {x.order_number}
                  </bdi>
                </strong>
                <p>
                  <bdi>
                    {x.patient_name} · {x.mrn} ·{" "}
                    {x.age_years ?? t("Age not recorded", "عمر درج نہیں")}
                  </bdi>
                </p>
                <p>
                  {tr(x.modality)} · {x.body_part} · {tr(x.status)} ·{" "}
                  {tr(x.laterality || "Not recorded")}
                </p>
                <p>
                  {x.is_overdue && t("OVERDUE · ", "تاخیر · ")}
                  {t("Server due time", "سرور مقرر وقت")}:{" "}
                  <bdi>{time(x.due_at)}</bdi>
                </p>
                <button
                  data-help="outsourced.open"
                  onClick={() => open(x.imaging_order_id)}
                >
                  {t("Open examination", "معائنہ کھولیں")}{" "}
                  <bdi>{x.order_number}</bdi>
                </button>
              </article>
            ))}
          </section>
        )}
        <section className="card critical-current">
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              open(/^\d+$/.test(lookup) ? Number(lookup) : 0);
            }}
          >
            <Field
              label={t("Known imaging order ID", "عکس آرڈر کا معلوم نمبر")}
            >
              <input
                data-help="outsourced.open"
                inputMode="numeric"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
              />
            </Field>
            <button data-help="outsourced.open">
              {t("Read imaging order", "عکس آرڈر پڑھیں")}
            </button>
          </form>
          {id > 0 && <LoadState {...detail} retry={detail.reload} />}
          {!access.read && (
            <p>
              {t(
                "Reading order history requires imaging order viewing permission.",
                "آرڈر تاریخ پڑھنے کو عکس دیکھنے کی اجازت لازم۔",
              )}
            </p>
          )}
          {order && (
            <>
              <div className="notice" data-testid="outsourced-detail">
                <h2>
                  <bdi>
                    {order.order_number} · {order.accession_number}
                  </bdi>
                </h2>
                <strong>
                  <bdi>
                    {order.patient_name} · {order.mrn}
                  </bdi>
                </strong>
                <p>
                  {tr(order.modality)} · {order.body_part} · {tr(order.status)}{" "}
                  · {tr(order.laterality || "Not recorded")}
                </p>
                <p>{order.clinical_indication}</p>
                <p>
                  {t("Transport / escort", "آمد / ساتھ عملہ")}:{" "}
                  {tr(order.transport || "Not recorded")} ·{" "}
                  {tr(order.escort || "Not recorded")}
                </p>
                <LoadState {...profile} retry={profile.reload} />
                {patient && (
                  <>
                    <p>
                      {tr(patient.gender || "Not recorded")} ·{" "}
                      {t("Age / date of birth", "عمر / پیدائش")}:{" "}
                      <bdi>
                        {patient.age_years ?? time(null)} ·{" "}
                        {patient.dob || time(null)}
                      </bdi>
                    </p>
                    <p>
                      {t("Allergies", "الرجی")}:{" "}
                      {patient.allergies || t("Not recorded", "درج نہیں")} ·{" "}
                      {t("Blood group", "خون کا گروپ")}:{" "}
                      {patient.blood_group || t("Not recorded", "درج نہیں")}
                    </p>
                    {patient.is_deceased && (
                      <p className="error">
                        {t(
                          "Deceased — no new referral. Existing report documentation needs clinician review.",
                          "وفات — نیا حوالہ نہیں۔ سابق رپورٹ دستاویز پر معالج کا جائزہ لازم۔",
                        )}
                      </p>
                    )}
                    {!!patient.mlc_numbers.length && (
                      <p>
                        {t("MEDICO-LEGAL", "میڈیکو لیگل")}:{" "}
                        {patient.mlc_numbers.join(", ")}
                      </p>
                    )}
                    {patient.temp_identifier && (
                      <p>
                        {t("Temporary identity", "عارضی شناخت")}:{" "}
                        {patient.temp_identifier}
                      </p>
                    )}
                    {patient.outstanding.banner_text && (
                      <p>{patient.outstanding.banner_text}</p>
                    )}
                  </>
                )}
                {!matches && (
                  <p className="error">
                    {t(
                      "Patient context is unavailable or merged. Ask reception to reconcile the original order with the master patient before recording.",
                      "مریض دستیاب نہیں یا ضم ہے۔ اصل آرڈر کو مرکزی مریض سے ملانے کے لیے استقبالیہ سے کہیں۔",
                    )}
                  </p>
                )}
                {order.partner_id && (
                  <p>
                    {t("Partner / sent at", "شریک / بھیجنے کا وقت")}:{" "}
                    <bdi>
                      {partner?.name || `#${order.partner_id}`} ·{" "}
                      {time(order.outsourced_at)}
                    </bdi>
                  </p>
                )}
                {due && (
                  <p>
                    {due.is_overdue && t("OVERDUE · ", "تاخیر · ")}
                    {t("Server due time", "سرور مقرر وقت")}:{" "}
                    <bdi>{time(due.due_at)}</bdi>
                  </p>
                )}
                <LoadState {...partners} retry={partners.reload} />
                {partner && <PartnerFacts partner={partner} />}
                {order.status === "Reported" && (
                  <section data-testid="outsourced-report">
                    <h3>
                      {t(
                        "Final partner report — read only",
                        "شریک کی حتمی رپورٹ — صرف پڑھیں",
                      )}
                    </h3>
                    <p>
                      {t(
                        "Partner radiologist / registration",
                        "شریک ریڈیالوجسٹ / رجسٹریشن",
                      )}
                      : <bdi>{order.external_reporter}</bdi>
                    </p>
                    <p>
                      {t("Reported at", "رپورٹ کا وقت")}:{" "}
                      <bdi>{time(order.reported_at)}</bdi>
                    </p>
                    <p style={{ whiteSpace: "pre-wrap" }} dir="auto">
                      {order.report_text}
                    </p>
                    {(order.critical_finding_id ||
                      order.critical_finding_note) && (
                      <p className="bench-critical">
                        {t(
                          "CRITICAL FINDING: tell the responsible doctor now; record each completed communication in Critical results to tell. Saving a report is not communication.",
                          "اہم نتیجہ: ذمہ دار معالج کو ابھی بتائیں؛ اہم نتائج کے صفحے میں ہر مکمل اطلاع درج کریں۔ رپورٹ محفوظ کرنا اطلاع نہیں۔",
                        )}{" "}
                        <bdi>{order.critical_finding_note}</bdi>
                      </p>
                    )}
                    <LoadState
                      {...reportPayload}
                      retry={reportPayload.reload}
                    />
                    {signed && (
                      <p>
                        {t(
                          "Server-signed report is ready.",
                          "سرور کی دستخط شدہ رپورٹ تیار ہے۔",
                        )}
                      </p>
                    )}
                    <div className="actions">
                      <button
                        data-help="outsourced.print"
                        disabled={!signed}
                        onClick={() => void print("save")}
                      >
                        {t(
                          "Save partner report PDF",
                          "شریک رپورٹ پی ڈی ایف محفوظ",
                        )}
                      </button>
                      <button
                        data-help="outsourced.print"
                        disabled={!signed}
                        onClick={() => void print("original")}
                      >
                        {t(
                          "Save original report PDF",
                          "اصل رپورٹ پی ڈی ایف محفوظ",
                        )}
                      </button>
                      <button
                        data-help="outsourced.print"
                        disabled={!signed}
                        onClick={() => void print("print")}
                      >
                        {t("Print partner report", "شریک رپورٹ پرنٹ")}
                      </button>
                    </div>
                  </section>
                )}
              </div>
              {access.write && matches && live && (
                <div className="actions">
                  {outsourceAllowed(order.status) && !patient?.is_deceased && (
                    <button
                      className="primary"
                      data-help="outsourced.send"
                      onClick={() => begin("send")}
                    >
                      {t("Send to partner centre", "شریک مرکز کو بھیجیں")}
                    </button>
                  )}
                  {order.status === "Outsourced" && (
                    <button
                      className="primary"
                      data-help="outsourced.report"
                      onClick={() => begin("report")}
                    >
                      {t("Enter partner report", "شریک کی رپورٹ درج")}
                    </button>
                  )}
                </div>
              )}
              {!outsourceAllowed(order.status) &&
                order.status !== "Outsourced" &&
                order.status !== "Reported" && (
                  <p>
                    {t(
                      "This stage cannot be outsourced or reported here. Use the Imaging worklist for permitted examination actions.",
                      "اس مرحلے میں یہاں شریک کو حوالہ یا رپورٹ نہیں۔ مجاز معائنہ عمل کے لیے عکس فہرست استعمال کریں۔",
                    )}
                  </p>
                )}
              {view === "records" && (
                <p>
                  {t(
                    "History is read-only here. No new referral or report is offered.",
                    "یہاں تاریخ صرف پڑھیں۔ نیا حوالہ یا رپورٹ دستیاب نہیں۔",
                  )}
                </p>
              )}
            </>
          )}
        </section>
      </fieldset>
      {editor && (
        <Modal
          title={
            editor.kind === "send"
              ? t("Send examination to partner", "معائنہ شریک کو بھیجیں")
              : t("Record final partner report", "شریک کی حتمی رپورٹ درج")
          }
          closable={!locked}
          onClose={() => {
            if (!locked) {
              setEditor(undefined);
              setReview(undefined);
              setError(undefined);
            }
          }}
        >
          <p>
            <bdi>
              {editor.order.patient_name} · {editor.order.mrn} ·{" "}
              {editor.order.accession_number} · {editor.order.order_number}
            </bdi>
          </p>
          <ErrorBox error={error} />
          {!review ? (
            <fieldset disabled={locked}>
              {editor.kind === "send" ? (
                <>
                  <LoadState {...partners} retry={partners.reload} />
                  <Field label={t("Imaging partner centre", "شریک عکس مرکز")}>
                    <select
                      data-help="outsourced.partner"
                      value={editor.partnerId}
                      onChange={(e) => field("partnerId", e.target.value)}
                    >
                      <option value="">
                        {t("Choose a partner", "شریک چنیں")}
                      </option>
                      {(partners.data || []).map((p) => (
                        <option
                          key={p.partner_id}
                          value={p.partner_id}
                          disabled={!imagingPartnerEligible(p)}
                        >
                          {p.name}
                          {!imagingPartnerEligible(p)
                            ? t(
                                " — unavailable / MOU expired",
                                " — غیر دستیاب / معاہدہ ختم",
                              )
                            : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {partners.data?.find(
                    (p) => String(p.partner_id) === editor.partnerId,
                  ) && (
                    <PartnerFacts
                      partner={partners.data.find(
                        (p) => String(p.partner_id) === editor.partnerId,
                      )!}
                    />
                  )}
                  <Field
                    label={t(
                      "Outsourcing note (optional)",
                      "شریک کو بھیجنے کا نوٹ (اختیاری)",
                    )}
                  >
                    <textarea
                      data-help="outsourced.send"
                      maxLength={500}
                      value={editor.note}
                      onChange={(e) => field("note", e.target.value)}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    label={t(
                      "Partner radiologist name and registration",
                      "شریک ریڈیالوجسٹ کا نام اور رجسٹریشن",
                    )}
                  >
                    <input
                      data-help="outsourced.reporter"
                      maxLength={200}
                      value={editor.reporter}
                      onChange={(e) => field("reporter", e.target.value)}
                    />
                  </Field>
                  <Field label={t("Partner report text", "شریک رپورٹ کا متن")}>
                    <textarea
                      data-help="outsourced.report"
                      rows={8}
                      maxLength={20000}
                      value={editor.report}
                      onChange={(e) => field("report", e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t(
                      "Partner reported time (optional, hospital timezone)",
                      "شریک رپورٹ وقت (اختیاری، ہسپتال وقت)",
                    )}
                  >
                    <input
                      data-help="outsourced.time"
                      type="datetime-local"
                      value={editor.reportedAt}
                      onChange={(e) => field("reportedAt", e.target.value)}
                    />
                  </Field>
                  <p>
                    {timeZone ||
                      t(
                        "Hospital timezone unavailable; leave time empty or refresh.",
                        "ہسپتال وقت دستیاب نہیں؛ وقت خالی یا تازہ کریں۔",
                      )}{" "}
                    · {t("Empty uses the server time.", "خالی پر سرور وقت۔")}
                  </p>
                  <LoadState {...findings} retry={findings.reload} />
                  <Field
                    label={t(
                      "Critical imaging finding (optional)",
                      "اہم عکس نتیجہ (اختیاری)",
                    )}
                  >
                    <select
                      data-help="outsourced.critical"
                      value={editor.finding}
                      onChange={(e) => field("finding", e.target.value)}
                    >
                      <option value="">
                        {t(
                          "No catalogue finding selected",
                          "فہرست کا اہم نتیجہ نہیں چنا",
                        )}
                      </option>
                      {findings.data
                        ?.filter(
                          (x) =>
                            !x.modality || x.modality === editor.order.modality,
                        )
                        .map((x) => (
                          <option key={x.finding_id} value={x.finding_id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field
                    label={t(
                      "Critical finding note (optional)",
                      "اہم نتیجے کا نوٹ (اختیاری)",
                    )}
                  >
                    <textarea
                      data-help="outsourced.critical"
                      maxLength={1000}
                      value={editor.criticalNote}
                      onChange={(e) => field("criticalNote", e.target.value)}
                    />
                  </Field>
                  <p>
                    {t(
                      "A critical finding opens the critical log. Tell the responsible doctor now; enter the completed communication separately.",
                      "اہم نتیجہ رجسٹر کھولتا ہے۔ ذمہ دار معالج کو ابھی بتائیں؛ مکمل اطلاع الگ درج کریں۔",
                    )}
                  </p>
                </>
              )}
              <label>
                <input
                  data-help="outsourced.check"
                  type="checkbox"
                  checked={editor.checked}
                  onChange={(e) => field("checked", e.target.checked)}
                />
                {editor.kind === "send"
                  ? t(
                      "I checked this patient, order and partner agreement.",
                      "میں نے یہ مریض، آرڈر اور شریک معاہدہ چیک کیا۔",
                    )
                  : t(
                      "I matched the partner report to this patient and order and verified the reporter name and registration.",
                      "میں نے شریک رپورٹ کو اسی مریض و آرڈر سے ملا کر مصنف کا نام اور رجسٹریشن چیک کیا۔",
                    )}
              </label>
              <button
                className="primary"
                data-help="outsourced.review"
                onClick={prepare}
              >
                {t("Review partner action", "شریک عمل کا جائزہ")}
              </button>
            </fieldset>
          ) : (
            <section className="notice" data-testid="outsourced-review">
              <h3>{t("Review before confirming", "تصدیق سے پہلے جائزہ")}</h3>
              {review.partner && <PartnerFacts partner={review.partner} />}
              <dl className="details">
                {Object.entries(review.body).map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {
                        (
                          {
                            partner_id: t("Partner ID", "شریک نمبر"),
                            note: t("Outsourcing note", "حوالے کا نوٹ"),
                            report_text: t(
                              "Final partner report",
                              "شریک کی حتمی رپورٹ",
                            ),
                            external_reporter: t(
                              "Partner radiologist / registration",
                              "شریک ریڈیالوجسٹ / رجسٹریشن",
                            ),
                            reported_at: t("Reported time", "رپورٹ وقت"),
                            critical_finding_id: t(
                              "Critical finding ID",
                              "اہم نتیجہ نمبر",
                            ),
                            critical_finding_note: t(
                              "Critical finding note",
                              "اہم نتیجے کا نوٹ",
                            ),
                          } as Record<string, string>
                        )[key]
                      }
                    </dt>
                    <dd dir="auto" style={{ whiteSpace: "pre-wrap" }}>
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p>
                {editor.kind === "report"
                  ? t(
                      "This report is final. No edit or delete follows confirmation.",
                      "یہ رپورٹ حتمی ہے۔ تصدیق کے بعد ترمیم یا حذف نہیں۔",
                    )
                  : t(
                      "Confirm the actual centre and patient. Transport and external contact are separate.",
                      "اصل مرکز اور مریض کی تصدیق۔ آمدورفت اور بیرونی رابطہ الگ ہیں۔",
                    )}
              </p>
              <button
                data-help="outsourced.review"
                disabled={locked}
                onClick={() => setReview(undefined)}
              >
                {t("Back to draft", "مسودے پر واپس")}
              </button>
              <button
                className="primary"
                data-help="outsourced.confirm"
                disabled={locked || !live}
                onClick={confirm}
              >
                {t("Confirm partner action", "شریک عمل کی تصدیق")}
              </button>
            </section>
          )}
          <ClinicalWriteFeedback
            write={{ ...write, notice: "" }}
            onReviewed={() => {
              setEditor(undefined);
              setReview(undefined);
              setRevision((n) => n + 1);
            }}
          />
        </Modal>
      )}
    </section>
  );
}
function PartnerFacts({ partner: p }: { partner: outsourced.PartnerOut }) {
  return (
    <section className="card" data-testid="partner-facts">
      <strong>
        <bdi>{p.name}</bdi>
      </strong>
      <p>
        {t("PHC / PNRA / accreditation", "پی ایچ سی / پی این آر اے / منظوری")}:{" "}
        <bdi>
          {p.phc_registration || t("Not recorded", "درج نہیں")} ·{" "}
          {p.pnra_licence || t("Not recorded", "درج نہیں")} ·{" "}
          {p.accreditation || t("Not recorded", "درج نہیں")}
        </bdi>
      </p>
      <p>
        {t("MOU / period", "معاہدہ / مدت")}:{" "}
        <bdi>
          {p.mou_reference || t("Not recorded", "درج نہیں")} ·{" "}
          {p.mou_valid_from || t("Not recorded", "درج نہیں")} —{" "}
          {p.mou_valid_until || t("Not recorded", "درج نہیں")}
        </bdi>
      </p>
      <p>
        {t("Agreed turnaround (hours)", "معاہدے کے گھنٹے")}:{" "}
        {p.turnaround_hours ?? t("Not recorded", "درج نہیں")} ·{" "}
        {!p.is_active
          ? t("Inactive", "غیر فعال")
          : p.mou_expired
            ? t("MOU expired — do not send", "معاہدہ ختم — نہ بھیجیں")
            : t("Active · MOU not expired", "فعال · معاہدہ ختم نہیں")}
      </p>
      <p dir="auto">
        {p.contact} · {p.address} · {p.quality_note}
      </p>
    </section>
  );
}
