import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../bridge";
import {
  Details,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import {
  WardAdmission,
  type WardContext,
  type WardProps,
} from "../ward-admission";
import { bilingual as t } from "../i18n";
import { formatHospitalTime, hospitalTimeToUtc } from "../hospital-time";
import {
  lookupStaff,
  type StaffLookupOut,
} from "../generated/radiology_worklist";
import * as a from "../generated/verbal_orders_ward";
import {
  medicationFrequencies,
  medicationRoutes,
  validateVerbalLine,
} from "../verbal-order-policy";
type Line = {
  key: string;
  drug?: a.DrugStockOut;
  name: string;
  strength: string;
  form: string;
  qty: string;
  dose: string;
  route: string;
  frequency: string;
  interval: string;
  days: string;
  start: string;
  end: string;
  instructions: string;
  self: boolean;
};
const line = (drug?: a.DrugStockOut): Line => ({
  key: crypto.randomUUID(),
  drug,
  name: "",
  strength: "",
  form: "",
  qty: "",
  dose: "",
  route: "",
  frequency: "",
  interval: "",
  days: "",
  start: "",
  end: "",
  instructions: "",
  self: false,
});
const safety = (d: a.DrugStockOut) =>
  JSON.stringify([
    d.drug_id,
    d.high_alert_category,
    d.lasa_with,
    d.is_restricted,
    d.is_active,
    d.strength,
    d.form,
  ]);
export function VerbalOrders(props: WardProps) {
  return (
    <section>
      <h1>{t("Verbal and telephone orders", "زبانی اور ٹیلی فون احکام")}</h1>
      <p>
        {t(
          "When a doctor cannot write, or in an emergency, record the order exactly as heard, read it back to that doctor and follow the countersignature. This is not for routine outpatient orders or chemotherapy.",
          "ڈاکٹر لکھ نہ سکے یا ہنگامی حالت میں حکم جیسا سنا لکھیں، اسی ڈاکٹر کو دہرا کر تصدیق لیں اور دستخط کی پیروی کریں۔ یہ عام او پی ڈی یا کیموتھراپی کے لیے نہیں۔",
        )}
      </p>
      <WardAdmission {...props} screenId="verbal_orders_ward">
        {(ctx) => <VerbalForm {...props} ctx={ctx} />}
      </WardAdmission>
    </section>
  );
}
function VerbalForm({
  ctx,
  user,
  connected,
  stream,
  timeZone,
  establishment,
}: WardProps & { ctx: WardContext }) {
  const id = ctx.admission.admission_id,
    [tick, setTick] = useState(0),
    [pending, setPending] = useState(false),
    [limit, setLimit] = useState(200),
    [draft, setDraft] = useState(false),
    [lines, setLines] = useState<Line[]>([]),
    [doctorQuery, setDoctorQuery] = useState(""),
    [doctors, setDoctors] = useState<StaffLookupOut[]>([]),
    [doctor, setDoctor] = useState<StaffLookupOut>(),
    [doctorBusy, setDoctorBusy] = useState(false),
    [drugQuery, setDrugQuery] = useState(""),
    [drugs, setDrugs] = useState<a.DrugStockOut[]>([]),
    [drugBusy, setDrugBusy] = useState(false),
    [mode, setMode] = useState<"Verbal" | "Telephone">("Verbal"),
    [destination, setDestination] = useState<
      "HospitalPharmacy" | "ExternalMarket"
    >("HospitalPharmacy"),
    [notes, setNotes] = useState(""),
    [emergency, setEmergency] = useState(false),
    [readback, setReadback] = useState(false),
    [ack, setAck] = useState(false),
    [stale, setStale] = useState(false),
    [review, setReview] = useState<a.VerbalOrderIn>(),
    [error, setError] = useState<unknown>();
  const de = useRef(0),
    me = useRef(0),
    can = (p: string) => user.permissions.includes(p),
    live = connected && stream === "Live",
    pharmacy = establishment.active.includes("dispensing");
  const rows = useLoad(
    () =>
      can("prescription.verbal.record") || can("prescription.view")
        ? a.listVerbalOrders({ admission_id: id, pending, limit })
        : Promise.resolve([]),
    [id, tick, ctx.revision, pending, limit],
  );
  const writable =
    ctx.ready &&
    live &&
    ["full", "open_work"].includes(ctx.view) &&
    ["Admitted", "DischargeInProgress", "CodeRedActive"].includes(
      ctx.admission.status,
    ) &&
    can("prescription.verbal.record");
  const write = useClinicalWrite(user, "verbal:" + id, async (value) => {
    if (
      value.patient_id !== ctx.patient.patient_id ||
      value.admission_id !== id
    )
      throw Error(
        "The saved order identity differs; read before another order.",
      );
    setDraft(false);
    setReview(undefined);
    setLines([]);
    setDoctor(undefined);
    setDoctors([]);
    setDrugs([]);
    setNotes("");
    setReadback(false);
    setEmergency(false);
    setAck(false);
    setStale(false);
    setTick((n) => n + 1);
  });
  const stamp = (s: string | null) =>
    s
      ? timeZone
        ? formatHospitalTime(s, timeZone)
        : s
      : t("Not countersigned", "ابھی دستخط نہیں");
  const invalidate = () => {
    setReview(undefined);
    setReadback(false);
    setAck(false);
  };
  useEffect(() => {
    const stop = window.terminal.subscribe((v) => {
      if (
        (v.type === "event" &&
          ["medication.order.updated", "pharmacy.stock.updated"].includes(
            v.event_type,
          )) ||
        (v.type === "stream" && v.status === "Live" && v.resync)
      ) {
        setTick((n) => n + 1);
        setStale(true);
        setReview(undefined);
        setReadback(false);
        setAck(false);
        setDrugs([]);
        me.current++;
      }
    });
    return stop;
  }, [id]);
  useEffect(() => {
    if (write.error) {
      setReview(undefined);
      if (
        write.error instanceof ApiError &&
        [
          "VERBAL_ORDER_INVALID",
          "REFERENCE_NOT_FOUND",
          "CAPABILITY_INACTIVE",
          "PRESCRIBER_NOT_AUTHORIZED",
        ].includes(write.error.response.error?.code || "")
      ) {
        setStale(true);
        setTick((n) => n + 1);
        void ctx.reload();
      }
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
  function update(key: string, patch: Partial<Line>) {
    invalidate();
    setLines((list) =>
      list.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }
  async function findDoctors() {
    const q = doctorQuery.trim();
    if (q.length < 2) return;
    const epoch = ++de.current;
    setDoctorBusy(true);
    setError(undefined);
    try {
      const rows = await lookupStaff({ q, license_type: "PMDC", limit: 20 });
      if (epoch === de.current) setDoctors(rows);
    } catch (e) {
      setError(e);
    } finally {
      if (epoch === de.current) setDoctorBusy(false);
    }
  }
  async function findDrugs() {
    const q = drugQuery.trim(),
      epoch = ++me.current;
    setDrugBusy(true);
    setError(undefined);
    try {
      const rows = await a.searchDrugs({ q, limit: 30 });
      if (epoch === me.current) setDrugs(rows);
    } catch (e) {
      setError(e);
    } finally {
      if (epoch === me.current) setDrugBusy(false);
    }
  }
  function prepare() {
    setError(undefined);
    try {
      if (
        !doctor ||
        !emergency ||
        !readback ||
        !ack ||
        stale ||
        !writable ||
        !lines.length
      )
        throw Error(
          t(
            "Select the actual prescriber and lines, confirm the exceptional circumstances and read-back, then review.",
            "اصل ڈاکٹر و سطور چنیں، غیر معمولی حالت اور دہرا کر تصدیق کریں، پھر جائزہ لیں۔",
          ),
        );
      if (destination === "HospitalPharmacy" && !pharmacy)
        throw Error(
          t(
            "Hospital Pharmacy is not Active. Read facility status; only an external destination is available.",
            "ہسپتال فارمیسی فعال نہیں۔ خدمت کی حالت پڑھیں؛ صرف بیرونی منزل دستیاب ہے۔",
          ),
        );
      const items = lines.map((l) => {
        if (l.drug?.high_alert_category === "Chemotherapy")
          throw Error(
            t(
              "Chemotherapy cannot be a verbal order. Ask the doctor to write it.",
              "کیموتھراپی زبانی حکم نہیں۔ ڈاکٹر سے تحریر لیں۔",
            ),
          );
        if (!l.drug && (destination !== "ExternalMarket" || !l.name.trim()))
          throw Error(
            t(
              "Select a formulary medicine, or name an outside medicine only for External Market.",
              "فہرست سے دوا چنیں، صرف بیرونی منزل میں بیرونی دوا کا نام لکھیں۔",
            ),
          );
        if (
          l.self &&
          (l.drug?.high_alert_category || (destination === "ExternalMarket" && !l.drug) ||
            !["Oral", "SL", "Inhaled", "Topical", "Ophthalmic", "Otic", "Nasal"].includes(l.route))
        )
          throw Error(
            t(
              "Self-administration must be an allowed route without a high-alert medicine.",
              "خود دوا لینے کا مجاز راستہ اور کم خطرہ دوا لازم۔",
            ),
          );
        return validateVerbalLine({
          ...(l.drug
            ? { drug_id: l.drug.drug_id }
            : {
                external_drug_name: l.name.trim(),
                external_strength: l.strength.trim() || null,
                external_form: l.form.trim() || null,
              }),
          qty_prescribed: Number(l.qty),
          dose_text: l.dose.trim(),
          route: l.route as a.RxItemIn["route"],
          frequency_code: l.frequency as a.RxItemIn["frequency_code"],
          interval_hours: l.interval ? Number(l.interval) : null,
          duration_days: l.days ? Number(l.days) : null,
          start_at: hospitalTimeToUtc(l.start, timeZone || ""),
          end_at: l.end ? hospitalTimeToUtc(l.end, timeZone || "") : null,
          instructions: l.instructions.trim() || null,
          is_prn: l.frequency === "PRN",
          is_stat: l.frequency === "STAT",
          self_administration: l.self,
        });
      });
      setReview({
        admission_id: id,
        patient_id: ctx.patient.patient_id,
        prescriber_id: doctor.employee_id,
        order_mode: mode,
        read_back: true,
        destination,
        notes: notes.trim() || null,
        items,
      });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!review || !writable || stale || write.blocked) return;
    const body = review,
      chosen = doctor,
      oldLines = lines;
    write.start(
      {
        method: "POST",
        path: "/prescriptions/verbal",
        body,
        permission: "prescription.verbal.record",
        protection: "idempotent",
        reconcilePath: `/verbal-orders?admission_id=${id}`,
        label: t("Record verbal order", "زبانی حکم درج کریں"),
      },
      async () => {
        await ctx.preflight("prescription.verbal.record");
        const est = await api<WardProps["establishment"]>(
          "GET",
          "/establishment",
        );
        if (
          body.destination === "HospitalPharmacy" &&
          !est.active.includes("dispensing")
        )
          throw Error(
            t(
              "Pharmacy service changed. Keep the order and review its destination.",
              "فارمیسی خدمت بدلی۔ حکم رکھ کر منزل کا جائزہ لیں۔",
            ),
          );
        if (!chosen) throw Error("Select the doctor again");
        const staff = await lookupStaff({
          q: chosen.emp_number,
          license_type: "PMDC",
          limit: 20,
        });
        if (
          !staff.some(
            (d) =>
              d.employee_id === chosen.employee_id &&
              d.registration === chosen.registration,
          )
        )
          throw Error(
            t(
              "The prescriber registration changed. Input kept; select the doctor again.",
              "ڈاکٹر رجسٹریشن بدلی۔ معلومات رکھ کر ڈاکٹر پھر چنیں۔",
            ),
          );
        for (const l of oldLines.filter((l) => l.drug)) {
          const fresh = await a.searchDrugs({ q: l.drug!.name, limit: 100 }),
            d = fresh.find((d) => d.drug_id === l.drug!.drug_id);
          if (!d || safety(d) !== safety(l.drug!)) {
            setStale(true);
            throw Error(
              t(
                "Medicine safety information changed. Re-select it, read the order back and review again.",
                "دوا کی حفاظت معلومات بدلیں۔ پھر چنیں، حکم دہرا کر جائزہ لیں۔",
              ),
            );
          }
        }
      },
    );
  }
  return (
    <section data-write-pending={write.blocked} data-unsaved={draft}>
      <ErrorBox error={error} />
      <ClinicalWriteFeedback
        key={review ? "review" : "input"}
        write={write}
        onReviewed={() => {
          setStale(true);
          setTick((n) => n + 1);
        }}
      />
      <div className="actions">
        <button
          data-help="verbal.read"
          disabled={write.blocked}
          onClick={() => {
            setTick((n) => n + 1);
            if (draft) {
              setStale(true);
              invalidate();
            }
          }}
        >
          {t("Refresh verbal orders", "زبانی احکام تازہ کریں")}
        </button>
        <button
          data-help="verbal.new"
          disabled={!writable || write.blocked}
          onClick={() => {
            if (
              draft &&
              !window.confirm(
                t("Discard the unsent verbal order?", "غیر ارسال حکم چھوڑیں؟"),
              )
            )
              return;
            setDraft(true);
            setLines([]);
            setDoctor(undefined);
            setNotes("");
            setEmergency(false);
            setReadback(false);
            setAck(false);
            setReview(undefined);
            setStale(false);
            setError(undefined);
            write.clearError();
            setDestination(pharmacy ? "HospitalPharmacy" : "ExternalMarket");
          }}
        >
          {t(
            "Record a verbal or telephone order",
            "زبانی یا ٹیلی فون حکم درج کریں",
          )}
        </button>
      </div>
      <label>
        <input
          data-help="verbal.read"
          type="checkbox"
          checked={pending}
          disabled={write.blocked}
          onChange={(e) => setPending(e.target.checked)}
        />
        {t("Pending countersignature only", "صرف دستخط کے منتظر")}
      </label>
      <Field label={t("Orders to retrieve (limit)", "احکام کی حد")}>
        <select
          data-help="verbal.read"
          value={limit}
          disabled={write.blocked}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {[50, 200, 1000].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </Field>
      <LoadState {...rows} retry={rows.reload} />
      {!rows.loading && !rows.error && !rows.data?.length && (
        <p>
          {t(
            "No verbal orders returned for this stay and filter.",
            "اس داخلے اور فلٹر کا کوئی زبانی حکم نہیں آیا۔",
          )}
        </p>
      )}
      {rows.data?.length === limit && (
        <p>
          {t(
            "Result limit reached; increase the limit before assuming the history is complete.",
            "حد پوری؛ تاریخ مکمل سمجھنے سے پہلے حد بڑھائیں۔",
          )}
        </p>
      )}
      {rows.data?.map((r) => (
        <article className="card" key={r.prescription_id}>
          <h2>
            {r.prescription_number} · {r.order_mode} · {r.status}
          </h2>
          <p>
            {r.prescriber_name} · {t("Received by", "وصول کنندہ")}:{" "}
            {r.received_by_name} · {stamp(r.created_at)}
          </p>
          {r.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          <p className={r.is_overdue ? "error" : ""}>
            {r.is_overdue
              ? t(
                  "OVERDUE — contact the prescriber for countersignature",
                  "دستخط میں تاخیر — ڈاکٹر کو یاد دلائیں",
                )
              : t("Countersign due", "دستخط مقرر")}
            : {stamp(r.countersign_due_at)}
          </p>
          <p>
            {r.countersigned_by_name} · {stamp(r.countersigned_at)}{" "}
            {r.countersigned_late && t("Countersigned late", "دستخط تاخیر سے")}
          </p>
        </article>
      ))}
      {draft && (
        <fieldset className="card" disabled={write.blocked || !ctx.ready}>
          <legend>{t("Verbal order draft", "زبانی حکم مسودہ")}</legend>
          {stale && (
            <p role="alert">
              {t(
                "Data changed. Keep all lines, refresh safety information and read back again.",
                "معلومات بدلیں۔ سطور رکھ کر حفاظتی معلومات تازہ اور پھر دہرا کر تصدیق کریں۔",
              )}
            </p>
          )}
          <Field
            label={t("Find prescribing doctor", "حکم دینے والا ڈاکٹر تلاش")}
          >
            <input
              data-help="verbal.doctor"
              value={doctorQuery}
              maxLength={80}
              onChange={(e) => {
                de.current++;
                setDoctorQuery(e.target.value);
                setDoctor(undefined);
                setDoctors([]);
                invalidate();
              }}
            />
          </Field>
          <button
            data-help="verbal.doctor"
            disabled={doctorBusy || doctorQuery.trim().length < 2}
            onClick={() => void findDoctors()}
          >
            {doctorBusy
              ? t("Searching doctors…", "ڈاکٹر تلاش…")
              : t("Search registered doctors", "رجسٹرڈ ڈاکٹر تلاش")}
          </button>
          {doctors.map((d) => (
            <button
              data-help="verbal.doctor"
              key={d.employee_id}
              onClick={() => {
                setDoctor(d);
                invalidate();
              }}
            >
              {d.full_name} · {d.registration} · {d.emp_number}
            </button>
          ))}
          {doctor && (
            <p>
              {t("Prescriber", "ڈاکٹر")}: {doctor.full_name} ·{" "}
              {doctor.registration}
            </p>
          )}
          <Field label={t("Order mode", "حکم کا طریقہ")}>
            <select
              data-help="verbal.new"
              data-field="order_mode"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as typeof mode);
                invalidate();
              }}
            >
              <option>Verbal</option>
              <option>Telephone</option>
            </select>
          </Field>
          <label>
            <input
              data-help="verbal.new"
              type="checkbox"
              checked={emergency}
              onChange={(e) => {
                setEmergency(e.target.checked);
                invalidate();
              }}
            />
            {t(
              "Emergency or the doctor cannot write this order",
              "ہنگامی حالت ہے یا ڈاکٹر یہ حکم لکھ نہیں سکتا",
            )}
          </label>
          <Field label={t("Order destination", "حکم کی منزل")}>
            <select
              data-help="verbal.destination"
              data-field="destination"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value as typeof destination);
                invalidate();
              }}
            >
              <option value="HospitalPharmacy" disabled={!pharmacy}>
                {t("Hospital Pharmacy", "ہسپتال فارمیسی")}
              </option>
              <option value="ExternalMarket">
                {t("External / local market", "بیرونی یا مقامی مارکیٹ")}
              </option>
            </select>
          </Field>
          <Field label={t("Find medicine for the order", "حکم کی دوا تلاش")}>
            <input
              data-help="verbal.drug"
              maxLength={100}
              value={drugQuery}
              onChange={(e) => {
                me.current++;
                setDrugQuery(e.target.value);
                setDrugs([]);
              }}
            />
          </Field>
          <button
            data-help="verbal.drug"
            disabled={drugBusy || !can("pharmacy.formulary.view")}
            onClick={() => void findDrugs()}
          >
            {drugBusy
              ? t("Searching medicines…", "دوا تلاش…")
              : t("Search formulary", "دوا فہرست تلاش")}
          </button>
          {drugs.map((d) => (
            <section key={d.drug_id}>
              <p>
                {d.name} · {d.strength} · {d.form} · {d.stock_status} ·{" "}
                {d.qty_available}{" "}
                {d.is_restricted && t("Restricted prescribing", "محدود تجویز")}
              </p>
              {d.high_alert_category && (
                <p className="error">
                  {t("HIGH ALERT", "زیادہ خطرہ")}: {d.high_alert_category}
                </p>
              )}
              {!!d.lasa_with.length && (
                <p>
                  {t("Looks or sounds like", "ملتا جلتا نام")}:{" "}
                  {d.lasa_with.join(", ")}
                </p>
              )}
              <button
                data-help="verbal.drug"
                disabled={
                  lines.length >= 40 ||
                  !d.is_active ||
                  d.high_alert_category === "Chemotherapy" ||
                  (destination === "HospitalPharmacy" &&
                    d.stock_status === "OutOfStock")
                }
                onClick={() => {
                  setLines((list) => [...list, line(d)]);
                  invalidate();
                }}
              >
                {t("Add ordered medicine", "حکم کی دوا شامل کریں")} · {d.name}
              </button>
            </section>
          ))}
          {destination === "ExternalMarket" && (
            <button
              data-help="verbal.external"
              disabled={lines.length >= 40}
              onClick={() => {
                setLines((list) => [...list, line()]);
                invalidate();
              }}
            >
              {t(
                "Add medicine outside the formulary",
                "فہرست سے باہر کی دوا شامل",
              )}
            </button>
          )}
          {lines.map((l, i) => (
            <fieldset key={l.key}>
              <legend>
                {t("Order line", "حکم سطر")} {i + 1} ·{" "}
                {l.drug?.name || t("Outside medicine", "بیرونی دوا")}
              </legend>
              {l.drug?.high_alert_category && (
                <p className="error">
                  {t("HIGH ALERT", "زیادہ خطرہ")}: {l.drug.high_alert_category}
                </p>
              )}
              {!!l.drug?.lasa_with.length && (
                <p>
                  {t("Looks or sounds like", "ملتا جلتا نام")}:{" "}
                  {l.drug.lasa_with.join(", ")}
                </p>
              )}
              {!l.drug &&
                (["name", "strength", "form"] as const).map((key, j) => (
                  <Field
                    key={key}
                    label={t(
                      [
                        "Outside medicine name",
                        "Outside strength",
                        "Outside form",
                      ][j],
                      ["بیرونی دوا نام", "بیرونی طاقت", "بیرونی شکل"][j],
                    )}
                  >
                    <input
                      data-help="verbal.external"
                      data-field={"items." + i + ".external_drug_name"}
                      value={l[key]}
                      onChange={(e) => update(l.key, { [key]: e.target.value })}
                    />
                  </Field>
                ))}
              {(
                ["qty", "dose", "interval", "days", "instructions"] as const
              ).map((key, j) => (
                <Field
                  key={key}
                  label={t(
                    [
                      "Quantity in lowest units",
                      "Ordered dose text",
                      "Interval hours (optional)",
                      "Duration days (optional)",
                      "Line instructions (optional)",
                    ][j],
                    [
                      "کم ترین اکائی مقدار",
                      "حکم کی خوراک",
                      "وقفہ گھنٹے (اختیاری)",
                      "مدت دن (اختیاری)",
                      "سطر ہدایات (اختیاری)",
                    ][j],
                  )}
                >
                  <input
                    data-help="verbal.line"
                    data-field={
                      "items." +
                      i +
                      "." +
                      [
                        "qty_prescribed",
                        "dose_text",
                        "interval_hours",
                        "duration_days",
                        "instructions",
                      ][j]
                    }
                    maxLength={key === "instructions" ? 500 : undefined}
                    value={l[key]}
                    onChange={(e) => update(l.key, { [key]: e.target.value })}
                  />
                </Field>
              ))}
              <Field label={t("Ordered route", "حکم کا راستہ")}>
                <select
                  data-help="verbal.line"
                  data-field={"items." + i + ".route"}
                  value={l.route}
                  onChange={(e) =>
                    update(l.key, { route: e.target.value, self: false })
                  }
                >
                  <option value="">{t("Choose route", "راستہ چنیں")}</option>
                  {medicationRoutes.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("Ordered frequency", "حکم کی تکرار")}>
                <select
                  data-help="verbal.line"
                  data-field={"items." + i + ".frequency_code"}
                  value={l.frequency}
                  onChange={(e) => update(l.key, { frequency: e.target.value })}
                >
                  <option value="">
                    {t("Choose frequency", "تکرار چنیں")}
                  </option>
                  {medicationFrequencies.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field
                label={t(
                  "Order starts (hospital time)",
                  "حکم شروع (ہسپتال وقت)",
                )}
              >
                <input
                  data-help="verbal.time"
                  data-field={"items." + i + ".start_at"}
                  type="datetime-local"
                  value={l.start}
                  onChange={(e) => update(l.key, { start: e.target.value })}
                />
              </Field>
              <Field
                label={t(
                  "Order ends (optional hospital time)",
                  "حکم ختم (اختیاری ہسپتال وقت)",
                )}
              >
                <input
                  data-help="verbal.time"
                  data-field={"items." + i + ".end_at"}
                  type="datetime-local"
                  value={l.end}
                  onChange={(e) => update(l.key, { end: e.target.value })}
                />
              </Field>
              <label>
                <input
                  data-help="verbal.self"
                  type="checkbox"
                  disabled={
                    !!l.drug?.high_alert_category || (destination === "ExternalMarket" && !l.drug) ||
                    !["Oral", "SL", "Inhaled", "Topical", "Ophthalmic", "Otic", "Nasal"].includes(l.route)
                  }
                  checked={l.self}
                  onChange={(e) => update(l.key, { self: e.target.checked })}
                />
                {t(
                  "Doctor allowed the patient to take this themselves",
                  "ڈاکٹر نے مریض کو خود لینے کی اجازت دی",
                )}
              </label>
              <button
                data-help="verbal.line"
                onClick={() => {
                  setLines((list) => list.filter((x) => x.key !== l.key));
                  invalidate();
                }}
              >
                {t("Remove unsent line", "غیر ارسال سطر ہٹائیں")} {i + 1}
              </button>
            </fieldset>
          ))}
          <Field
            label={t(
              "Order notes / exceptional circumstances",
              "حکم نوٹ یا غیر معمولی حالت",
            )}
          >
            <textarea
              data-help="verbal.new"
              data-field="notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                invalidate();
              }}
            />
          </Field>
          <label>
            <input
              data-help="verbal.readback"
              data-field="read_back"
              type="checkbox"
              checked={readback}
              onChange={(e) => {
                setReadback(e.target.checked);
                setReview(undefined);
                setAck(false);
              }}
            />
            {t(
              "I read every line back to this prescriber and they confirmed it",
              "میں نے ہر سطر اسی ڈاکٹر کو دہرا کر ان کی تصدیق لی",
            )}
          </label>
          <label>
            <input
              data-help="verbal.review"
              type="checkbox"
              checked={ack}
              onChange={(e) => {
                setAck(e.target.checked);
                setReview(undefined);
              }}
            />
            {t(
              "I verified this patient and this exact order",
              "میں نے مریض اور یہی حکم چیک کیا",
            )}
          </label>
          <div className="actions">
            <button
              data-help="verbal.review"
              disabled={
                !writable ||
                !readback ||
                !emergency ||
                !ack ||
                !lines.length ||
                !doctor ||
                stale
              }
              onClick={prepare}
            >
              {t("Review verbal order", "زبانی حکم کا جائزہ")}
            </button>
            <button
              data-help="verbal.recovery"
              onClick={async () => {
                try {
                  const fresh = await a.listVerbalOrders({
                    admission_id: id,
                    pending,
                    limit,
                  });
                  rows.setData(fresh);
                  await findDrugs();
                  await ctx.reload();
                  setStale(false);
                  invalidate();
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t(
                "Read latest and keep order lines",
                "تازہ پڑھیں اور سطور رکھیں",
              )}
            </button>
            <button
              data-help="verbal.review"
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      "Discard the unsent verbal order?",
                      "غیر ارسال حکم چھوڑیں؟",
                    ),
                  )
                ) {
                  setDraft(false);
                  setLines([]);
                  setReview(undefined);
                }
              }}
            >
              {t("Close verbal order draft", "زبانی حکم مسودہ بند")}
            </button>
          </div>
        </fieldset>
      )}
      {review && (
        <Modal
          title={t("Review verbal order", "زبانی حکم کا جائزہ")}
          closable={!write.blocked}
          onClose={() => setReview(undefined)}
        >
          <p>
            {ctx.patient.full_name} · <bdi>{ctx.patient.mrn}</bdi> ·{" "}
            {ctx.admission.admission_number} · {doctor?.full_name} ·{" "}
            {doctor?.registration}
          </p>
          {lines.map((l) => (
            <p key={l.key}>
              {l.drug?.name || l.name} · {l.dose} · {l.route} · {l.frequency}
            </p>
          ))}
          <Details value={review} />
          <p>
            {t(
              "The prescriber must countersign; saving does not provide their countersignature.",
              "ڈاکٹر کے دستخط لازم؛ محفوظ کرنا ان کے دستخط نہیں۔",
            )}
          </p>
          <div className="actions">
            <button
              data-help="verbal.review"
              disabled={write.blocked || !writable || stale}
              onClick={confirm}
            >
              {t("Confirm verbal order once", "زبانی حکم ایک بار تصدیق")}
            </button>
            <button
              data-help="verbal.review"
              disabled={write.blocked}
              onClick={() => setReview(undefined)}
            >
              {t("Back to order lines", "حکم سطور پر واپس")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
