import { useEffect, useRef, useState } from "react";
import { api, getWithClock } from "../bridge";
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
import * as repeats from "../generated/imaging_repeats";
import * as imaging from "../generated/radiology_worklist";
import * as patients from "../generated/patient_search";
import { resolvePatientMaster } from "../patient-profile";
import { formatHospitalTime } from "../hospital-time";
import { imagingModalities } from "../radiology-policy";
import {
  repeatAccess,
  repeatReasons,
  repeatStageAllowed,
  repeatBody,
  repeatPeriod,
  repeatRecoveryPeriod,
  repeatOrderSnapshot,
} from "../imaging-repeats-policy";
const reasonLabel = (r: string) =>
  (
    ({
      Positioning: t("Positioning", "جگہ بندی"),
      PatientMotion: t("Patient motion", "مریض کی حرکت"),
      ExposureFactors: t("Exposure factors", "ایکسپوژر کے عوامل"),
      Artefact: t("Artefact", "غیر مطلوب نشان"),
      EquipmentFault: t("Equipment fault", "آلے کی خرابی"),
      ProcessingError: t("Processing error", "پراسیسنگ کی خرابی"),
      WrongPatientOrSite: t("Wrong patient or site", "غلط مریض یا جگہ"),
      Other: t("Other", "دیگر"),
    }) as Record<string, string>
  )[r] || r;
type Draft = {
  order: imaging.ImagingOrderDetailOut;
  patient: patients.PatientDetailOut;
  reason: string;
  exposures: string;
  note: string;
  checked: boolean;
  auditDay: string;
};
export function ImagingRepeats({
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
      (x) => x.screen_id === "imaging_repeats",
    )?.view,
    access = repeatAccess(view, user.permissions),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [id, setId] = useState(0),
    [lookup, setLookup] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [modality, setModality] = useState(""),
    [find, setFind] = useState("");
  const [filters, setFilters] = useState<{
      date_from: string;
      date_to: string;
      modality?: "CT";
    }>(),
    [error, setError] = useState<unknown>(),
    [draft, setDraft] = useState<Draft>(),
    [review, setReview] = useState<repeats.RepeatIn>(),
    [saved, setSaved] = useState<repeats.RepeatOut>(),
    [recoveryRows, setRecoveryRows] = useState<repeats.RepeatOut[]>(),
    [recoveryError, setRecoveryError] = useState<unknown>(),
    [recovering, setRecovering] = useState(false);
  const clock = useLoad(
    () => getWithClock<ClinicalUser>("/auth/me"),
    [user.user_id],
  );
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !clock.data?.now || !timeZone) return;
    try {
      const p = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(clock.data.now));
      const m = Object.fromEntries(p.map((x) => [x.type, x.value]));
      const day = `${m.year}-${m.month}-${m.day}`;
      setFrom(day);
      setTo(day);
      setFilters(repeatPeriod(day, day));
      initialized.current = true;
    } catch (e) {
      setError(e);
    }
  }, [clock.data?.now, timeZone]);
  const list = useLoad(
    () =>
      access.register && filters
        ? repeats.listRepeats(filters)
        : Promise.resolve([]),
    [access.register, filters, revision],
  );
  const work = useLoad(
    () => (access.work ? imaging.worklistImaging() : Promise.resolve([])),
    [access.work, revision],
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
  const patient = !profile.loading && !profile.error ? profile.data : undefined,
    matches =
      !!order &&
      !!patient &&
      patient.patient_id === order.patient_id &&
      patient.mrn === order.mrn &&
      !patient.merged_into_id;
  const write = useClinicalWrite(
    user,
    `imaging-repeats:${id}`,
    async (value) => {
      const row = value as repeats.RepeatOut;
      if (
        row.imaging_order_id !== id ||
        !Number.isSafeInteger(row.repeat_id) ||
        row.repeat_id < 1
      )
        throw Error(
          t(
            "The server confirmed the write but returned a different record. Read the actual register; do not repeat the action.",
            "سرور نے عمل کی تصدیق کی مگر مختلف ریکارڈ لوٹا۔ اصل رجسٹر پڑھیں؛ عمل نہ دہرائیں۔",
          ),
        );
      setSaved(row);
      setDraft(undefined);
      setReview(undefined);
      setRevision((n) => n + 1);
      setRecoveryRows(undefined);
      setRecoveryError(undefined);
    },
  );
  const blocked = write.blocked || recovering;
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
    if (!draft && !write.blocked) return;
    const stop = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [!!draft, write.blocked]);
  function open(next: number) {
    if (blocked || draft) return;
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
    setSaved(undefined);
    setError(undefined);
    setRevision((n) => n + 1);
  }
  function begin() {
    if (!clock.data?.now) {
      setError(
        Error(
          t(
            "Refresh the server clock before recording.",
            "درج کرنے سے پہلے سرور گھڑی تازہ کریں۔",
          ),
        ),
      );
      return;
    }
    if (
      !order ||
      !patient ||
      !matches ||
      !repeatStageAllowed(order.status) ||
      !access.work ||
      !live ||
      blocked
    )
      return;
    setDraft({
      order: structuredClone(order),
      patient: structuredClone(patient),
      reason: "Positioning",
      exposures: "1",
      note: "",
      checked: false,
      auditDay: clock.data.now.slice(0, 10),
    });
    setReview(undefined);
    setError(undefined);
    setSaved(undefined);
    setRecoveryRows(undefined);
    setRecoveryError(undefined);
  }
  function field(
    key: "reason" | "exposures" | "note" | "checked",
    value: string | boolean,
  ) {
    if (blocked || review) return;
    setDraft((d) =>
      d
        ? {
            ...d,
            [key]: value,
            ...(key !== "checked" ? { checked: false } : {}),
          }
        : d,
    );
  }
  function prepare() {
    if (!draft || blocked) return;
    setError(undefined);
    try {
      setReview(
        repeatBody(draft.reason, draft.exposures, draft.note, draft.checked),
      );
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!draft || !review || blocked || !live) return;
    const d = draft,
      body = review;
    write.start(
      {
        method: "POST",
        path: `/imaging/orders/${d.order.imaging_order_id}/repeats`,
        body,
        permission: "imaging.order.update",
        protection: "idempotent",
        reconcilePath: `/imaging/orders/${d.order.imaging_order_id}`,
        label: t(
          "Record an exposure that already happened",
          "ہو چکا ایکسپوژر درج کریں",
        ),
      },
      async () => {
        const [me, est, fresh, p] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          imaging.getOrder(d.order.imaging_order_id),
          resolvePatientMaster(d.order.patient_id, patients.getPatient),
        ]);
        if (
          me.user_id !== user.user_id ||
          !repeatAccess(
            est.views.screens.find((x) => x.screen_id === "imaging_repeats")
              ?.view,
            me.permissions,
          ).work ||
          !live ||
          !repeatStageAllowed(fresh.status) ||
          repeatOrderSnapshot(fresh) !== repeatOrderSnapshot(d.order) ||
          !p ||
          p.patient_id !== d.patient.patient_id ||
          p.row_version !== d.patient.row_version ||
          p.mrn !== fresh.mrn
        )
          throw Error(
            t(
              "The patient, order, permission or service changed. Close and review the current record again.",
              "مریض، آرڈر، اجازت یا خدمت بدلی۔ بند کرکے تازہ ریکارڈ کا پھر جائزہ لیں۔",
            ),
          );
        repeatBody(d.reason, d.exposures, d.note, d.checked);
      },
    );
  }
  async function inspectRegister() {
    if (!write.attempt || !draft || recovering) return;
    setRecovering(true);
    setRecoveryError(undefined);
    try {
      const a = await getWithClock<ClinicalUser>("/auth/me");
      if (a.data.user_id !== user.user_id || !timeZone)
        throw Error(
          t(
            "Restore the original user and hospital timezone before reconciliation.",
            "نتیجہ چیک کرنے سے پہلے اصل صارف اور ہسپتال وقت بحال کریں۔",
          ),
        );
      const p = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(a.now));
      const m = Object.fromEntries(p.map((x) => [x.type, x.value])),
        today = `${m.year}-${m.month}-${m.day}`;
      const rows = await repeats.listRepeats(
        repeatRecoveryPeriod(draft.auditDay, a.now, today),
      );
      setRecoveryRows(
        rows.filter((x) => x.imaging_order_id === draft.order.imaging_order_id),
      );
    } catch (e) {
      setRecoveryError(e);
    } finally {
      setRecovering(false);
    }
  }
  if (!access.visible)
    return (
      <Empty>
        {t(
          "The repeat register is unavailable in this service view.",
          "اس خدمت منظر میں دوبارہ عکس کا رجسٹر دستیاب نہیں۔",
        )}
      </Empty>
    );
  const rows =
    !list.loading && !list.error
      ? (list.data || []).filter((x) =>
          `${x.repeat_id} ${x.order_number} ${x.patient_name} ${x.mrn} ${reasonLabel(x.reason)} ${x.note || ""}`
            .toLowerCase()
            .includes(find.trim().toLowerCase()),
        )
      : [];
  return (
    <section
      className="workspace-screen"
      data-help-screen="imaging_repeats"
      data-write-pending={blocked}
      data-unsaved={!!draft}
    >
      <header className="section-heading">
        <div>
          <h1>{t("Repeated images register", "دوبارہ عکس کا رجسٹر")}</h1>
          <p>
            {t(
              "Record why an exposure was repeated, how many were repeated and who recorded it. This does not order another exposure.",
              "ایکسپوژر دوبارہ ہونے کی وجہ، تعداد اور درج کرنے والا محفوظ کریں۔ اس سے نیا ایکسپوژر طلب نہیں ہوتا۔",
            )}
          </p>
        </div>
        <button
          data-help="repeats.refresh"
          disabled={blocked || !!draft}
          onClick={() => setRevision((n) => n + 1)}
        >
          {t("Refresh repeat register", "دوبارہ عکس رجسٹر تازہ کریں")}
        </button>
      </header>
      <p role="status">
        {connected ? stream : t("Offline", "آف لائن")} ·{" "}
        {t("Radiology", "ریڈیالوجی")}{" "}
        {view === "open_work"
          ? t(
              " · No new imaging work; review existing records",
              " · نیا عکس کام نہیں؛ سابق ریکارڈ دیکھیں",
            )
          : view === "records"
            ? t(
                " · Records only — no new repeat entry",
                " · صرف ریکارڈ — نیا دوبارہ عکس اندراج نہیں",
              )
            : ""}
      </p>
      {!live && (
        <p className="notice">
          {t(
            "Reconnect before recording. No exposure record is queued offline.",
            "درج سے پہلے رابطہ بحال کریں۔ آف لائن ایکسپوژر اندراج قطار میں نہیں رکھا جاتا۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      {saved && (
        <section className="notice" role="status" data-testid="repeat-saved">
          <strong>
            {t("Repeat recorded on the server", "دوبارہ عکس سرور پر درج")} #
            {saved.repeat_id}
          </strong>
          <RepeatFacts row={saved} time={time} />
          <p>
            {t(
              "Append-only audit entry. No order, exposure, payment or clinical report was repeated.",
              "ناقابل ترمیم آڈٹ اندراج۔ آرڈر، ایکسپوژر، ادائیگی یا طبی رپورٹ نہیں دہرائی گئی۔",
            )}
          </p>
        </section>
      )}
      <fieldset disabled={blocked || !!draft} className="critical-bench-layout">
        <section className="card critical-log">
          <h2>
            {t("Register by period and modality", "مدت اور قسم سے رجسٹر")}
          </h2>
          <LoadState {...clock} retry={clock.reload} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                setFilters({
                  ...repeatPeriod(from, to),
                  modality: (modality || undefined) as "CT" | undefined,
                });
                setSaved(undefined);
                setError(undefined);
              } catch (e) {
                setError(e);
              }
            }}
          >
            <div className="form-grid">
              <Field label={t("From date", "ابتدائی تاریخ")}>
                <input
                  data-help="repeats.period"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label={t("To date", "آخری تاریخ")}>
                <input
                  data-help="repeats.period"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field label={t("Modality", "عکس کی قسم")}>
                <select
                  data-help="repeats.period"
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
            </div>
            <button data-help="repeats.period">
              {t("Apply register filters", "رجسٹر کی چھانٹی لگائیں")}
            </button>
          </form>
          <Field
            label={t(
              "Find in returned repeat records",
              "موصولہ دوبارہ عکس اندراج میں تلاش",
            )}
          >
            <input
              data-help="repeats.find"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </Field>
          {!access.register ? (
            <p>
              {t(
                "Register viewing requires imaging update or diagnostic quality permission.",
                "رجسٹر پڑھنے کو عکس اپ ڈیٹ یا تشخیصی معیار اجازت لازم۔",
              )}
            </p>
          ) : !filters ? (
            <p>
              {t(
                "Choose and apply a valid period. Initial dates use the authenticated server clock and hospital timezone.",
                "درست مدت چن کر لگائیں۔ ابتدا کی تاریخ سرور گھڑی اور ہسپتال وقت سے۔",
              )}
            </p>
          ) : (
            <>
              <p>
                {t("Applied period", "لاگو مدت")}:{" "}
                <bdi>
                  {filters.date_from} — {filters.date_to}
                </bdi>{" "}
                ·{" "}
                {filters.modality
                  ? tr(filters.modality)
                  : t("All modalities", "تمام اقسام")}
              </p>
              <LoadState {...list} retry={list.reload} />
              {!list.loading && !list.error && !rows.length && (
                <Empty>
                  {t(
                    "No repeat entries match this period and search. Clear local search or adjust the applied period/modality; never create a replacement merely because a row is absent.",
                    "اس مدت و تلاش میں اندراج نہیں۔ تلاش صاف یا مدت/قسم بدلیں؛ سطر نہ ہونے سے متبادل اندراج نہ بنائیں۔",
                  )}
                </Empty>
              )}
              {rows.map((x) => (
                <article
                  className="card"
                  key={x.repeat_id}
                  data-testid="repeat-row"
                >
                  <RepeatFacts row={x} time={time} />
                  {access.read && (
                    <button
                      data-help="repeats.open"
                      onClick={() => open(x.imaging_order_id)}
                    >
                      {t("Open source examination", "اصل معائنہ کھولیں")}{" "}
                      <bdi>{x.order_number}</bdi>
                    </button>
                  )}
                </article>
              ))}
            </>
          )}
          <p>
            {t(
              "For repeat rates and formal quality reports, contact the diagnostic-quality team.",
              "دوبارہ عکس کی شرح اور باقاعدہ معیار کی رپورٹس کے لیے تشخیصی معیار کی ٹیم سے رابطہ کریں۔",
            )}
          </p>
        </section>
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
                data-help="repeats.open"
                inputMode="numeric"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
              />
            </Field>
            <button data-help="repeats.open" disabled={!access.read}>
              {t("Read source examination", "اصل معائنہ پڑھیں")}
            </button>
          </form>
          {id > 0 && <LoadState {...detail} retry={detail.reload} />}
          {!access.read && (
            <p>
              {t(
                "Source order details require imaging viewing permission; permitted register rows remain available.",
                "اصل آرڈر تفصیل کو عکس دیکھنے کی اجازت؛ مجاز رجسٹر سطریں دستیاب رہیں۔",
              )}
            </p>
          )}
          {order && (
            <>
              <div className="notice" data-testid="repeat-source">
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
                  {tr(order.status)} · {tr(order.modality)} · {order.body_part}{" "}
                  · {tr(order.laterality || "Not recorded")}
                </p>
                <p>{order.clinical_indication}</p>
                <p>
                  {t("Responsible doctor", "ذمہ دار معالج")}:{" "}
                  {order.doctor_name}
                </p>
                <LoadState {...profile} retry={profile.reload} />
                {patient && (
                  <>
                    <p>
                      {tr(patient.gender || "Not recorded")} ·{" "}
                      {t("Age / date of birth", "عمر / پیدائش")}:{" "}
                      <bdi>
                        {patient.age_years ?? t("Not recorded", "درج نہیں")} ·{" "}
                        {patient.dob || t("Not recorded", "درج نہیں")}
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
                          "Deceased — record only a factual historical repeat, never a new examination. Follow clinician review.",
                          "وفات — صرف اصل سابق دوبارہ عکس کا ریکارڈ، نیا معائنہ نہیں۔ معالج کا جائزہ لیں۔",
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
              </div>
              {access.work && matches && repeatStageAllowed(order.status) ? (
                <button
                  className="primary"
                  data-help="repeats.record"
                  disabled={!live}
                  onClick={begin}
                >
                  {t(
                    "Record an already repeated exposure",
                    "ہو چکا دوبارہ ایکسپوژر درج",
                  )}
                </button>
              ) : (
                <p>
                  {t(
                    "Recording requires an In progress, Completed or Reported examination, a permitted work view, current patient context and imaging-update permission.",
                    "اندراج کو جاری، مکمل یا رپورٹ شدہ معائنہ، مجاز کام منظر، تازہ مریض اور عکس اپ ڈیٹ اجازت لازم۔",
                  )}
                </p>
              )}
            </>
          )}
          {access.work && (
            <section>
              <h3>
                {t("In-progress or completed work", "جاری یا مکمل معائنے")}
              </h3>
              <LoadState {...work} retry={work.reload} />
              {!work.loading &&
                !work.error &&
                !work.data?.some((x) => repeatStageAllowed(x.status)) && (
                  <p>
                    {t(
                      "No eligible open examinations returned. Use the actual known order ID for a reported examination.",
                      "کوئی مجاز کھلا معائنہ نہیں لوٹا۔ رپورٹ شدہ کے لیے اصل معلوم آرڈر نمبر دیں۔",
                    )}
                  </p>
                )}
              {!work.loading &&
                !work.error &&
                work.data
                  ?.filter((x) => repeatStageAllowed(x.status))
                  .map((x) => (
                    <button
                      key={x.imaging_order_id}
                      data-help="repeats.open"
                      onClick={() => open(x.imaging_order_id)}
                    >
                      <bdi>
                        {x.accession_number} · {x.patient_name} · {x.mrn}
                      </bdi>{" "}
                      · {tr(x.status)}
                    </button>
                  ))}
            </section>
          )}
        </section>
      </fieldset>
      {draft && (
        <Modal
          title={t("Record repeated exposure", "دوبارہ ایکسپوژر درج")}
          closable={!blocked}
          onClose={() => {
            if (!blocked) {
              setDraft(undefined);
              setReview(undefined);
              setError(undefined);
            }
          }}
        >
          <p>
            <bdi>
              {draft.order.patient_name} · {draft.order.mrn} ·{" "}
              {draft.order.order_number} · {draft.order.accession_number}
            </bdi>
          </p>
          <ErrorBox error={error} />
          {!review ? (
            <fieldset disabled={blocked}>
              <Field label={t("Reason for repeat", "دوبارہ عکس کی وجہ")}>
                <select
                  data-help="repeats.reason"
                  value={draft.reason}
                  onChange={(e) => field("reason", e.target.value)}
                >
                  {repeatReasons.map((x) => (
                    <option key={x} value={x}>
                      {reasonLabel(x)}
                    </option>
                  ))}
                </select>
              </Field>
              {draft.reason === "WrongPatientOrSite" && (
                <p className="bench-critical">
                  {t(
                    "Follow the hospital patient-safety and incident-reporting procedure now. This audit entry does not report an incident or correct a patient record.",
                    "ابھی ہسپتال مریض حفاظت و واقعہ رپورٹ طریقہ اپنائیں۔ یہ آڈٹ اندراج واقعہ رپورٹ یا مریض کی تصحیح نہیں کرتا۔",
                  )}
                </p>
              )}
              <Field
                label={t(
                  "Repeated exposures (1–20)",
                  "دوبارہ ایکسپوژر کی تعداد (1–20)",
                )}
              >
                <input
                  data-help="repeats.count"
                  inputMode="numeric"
                  value={draft.exposures}
                  onChange={(e) => field("exposures", e.target.value)}
                />
              </Field>
              <Field
                label={
                  draft.reason === "Other"
                    ? t(
                        "Repeat note (required for Other)",
                        "دوبارہ عکس نوٹ (دیگر میں لازم)",
                      )
                    : t("Repeat note (optional)", "دوبارہ عکس نوٹ (اختیاری)")
                }
              >
                <textarea
                  data-help="repeats.note"
                  maxLength={500}
                  value={draft.note}
                  onChange={(e) => field("note", e.target.value)}
                />
              </Field>
              <label>
                <input
                  data-help="repeats.check"
                  type="checkbox"
                  checked={draft.checked}
                  onChange={(e) => field("checked", e.target.checked)}
                />
                {t(
                  "I matched this patient and source order; these repeated exposures already occurred.",
                  "میں نے یہ مریض اور اصل آرڈر ملایا؛ یہ دوبارہ ایکسپوژر پہلے ہو چکے ہیں۔",
                )}
              </label>
              <button
                className="primary"
                data-help="repeats.review"
                onClick={prepare}
              >
                {t("Review repeat record", "دوبارہ عکس اندراج کا جائزہ")}
              </button>
            </fieldset>
          ) : (
            <section className="notice" data-testid="repeat-review">
              <h3>{t("Review before confirming", "تصدیق سے پہلے جائزہ")}</h3>
              <p>
                {t("Reason", "وجہ")}: {reasonLabel(review.reason)}
              </p>
              <p>
                {t("Repeated exposures", "دوبارہ ایکسپوژر")}: {review.exposures}
              </p>
              <p dir="auto">
                {review.note || t("No note recorded", "نوٹ درج نہیں")}
              </p>
              <p>
                {t(
                  "This creates one append-only audit record. It never performs another exposure or edits the report.",
                  "یہ ایک ناقابل ترمیم آڈٹ اندراج بناتا ہے۔ نیا ایکسپوژر یا رپورٹ ترمیم نہیں کرتا۔",
                )}
              </p>
              <button
                data-help="repeats.review"
                disabled={blocked}
                onClick={() => setReview(undefined)}
              >
                {t("Back to draft", "مسودے پر واپس")}
              </button>
              <button
                className="primary"
                data-help="repeats.confirm"
                disabled={blocked || !live}
                onClick={confirm}
              >
                {t("Confirm repeat record", "دوبارہ عکس اندراج کی تصدیق")}
              </button>
            </section>
          )}
          <ClinicalWriteFeedback
            write={{ ...write, notice: "" }}
            onReviewed={() => {
              setDraft(undefined);
              setReview(undefined);
              setRevision((n) => n + 1);
              setRecoveryRows(undefined);
            }}
          />
          {write.attempt && (
            <section className="notice">
              <p>
                {t(
                  "The source order alone does not prove that a repeat entry was saved. Prefer the original-key retry. Read the actual register too; a missing row or matching reason/count alone is not proof either way. Outside retention ask IT before any new record.",
                  "اصل آرڈر اکیلا دوبارہ عکس اندراج محفوظ ہونے کا ثبوت نہیں۔ اصل کلید کی کوشش بہتر ہے۔ اصل رجسٹر بھی پڑھیں؛ غائب سطر یا صرف یکساں وجہ/تعداد کوئی ثبوت نہیں۔ مدت بعد نئے اندراج سے پہلے آئی ٹی۔",
                )}
              </p>
              <button
                data-help="repeats.recovery"
                disabled={recovering || write.busy}
                onClick={() => void inspectRegister()}
              >
                {t(
                  "Read original order repeat history",
                  "اصل آرڈر کے دوبارہ عکس کی تاریخ پڑھیں",
                )}
              </button>
              <ErrorBox error={recoveryError} />
              {recoveryRows && (
                <>
                  <p>
                    {t(
                      "Actual register rows for the original order — review IDs and authors, do not assume this request succeeded.",
                      "اصل آرڈر کی حقیقی رجسٹر سطریں — نمبر و مصنف دیکھیں، اس درخواست کی کامیابی فرض نہ کریں۔",
                    )}
                  </p>
                  {recoveryRows.map((x) => (
                    <RepeatFacts key={x.repeat_id} row={x} time={time} />
                  ))}
                </>
              )}
            </section>
          )}
        </Modal>
      )}
    </section>
  );
}
function RepeatFacts({
  row: r,
  time,
}: {
  row: repeats.RepeatOut;
  time: (v: string) => string;
}) {
  return (
    <section>
      <strong>
        #{r.repeat_id} ·{" "}
        <bdi>
          {r.order_number} · {r.patient_name} · {r.mrn}
        </bdi>
      </strong>
      <p>
        {tr(r.modality)} · {r.body_part} · {reasonLabel(r.reason)} ·{" "}
        {t("Repeated exposures", "دوبارہ ایکسپوژر")}: {r.exposures}
      </p>
      <p dir="auto">{r.note || t("No note recorded", "نوٹ درج نہیں")}</p>
      <p>
        {t("Recorded by / at", "درج کرنے والا / وقت")}:{" "}
        <bdi>
          {r.recorded_by_name} · {time(r.recorded_at)}
        </bdi>
      </p>
    </section>
  );
}
