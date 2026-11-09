import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/incident_screening";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { DirectoryPicker } from "../DirectoryPicker";
import { ErrorBox, Field } from "../components";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import {
  formatHospitalTime,
  hospitalTimeInput,
  hospitalTimeToUtc,
  hospitalTimeZoneError,
} from "../hospital-time";
const kindName = (k: api.ScreeningItemOut["kind"]) =>
  ({
    ReturnToTheatre: t("Return to theatre", "دوبارہ تھیٹر"),
    Readmission: t("Readmission", "دوبارہ داخلہ"),
    Death: t("Death", "وفات"),
  })[k];
export function IncidentScreening({
  user,
  revision,
  connected,
  readOnly,
  timeZone,
  onOpenHelp,
}: {
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
}) {
  const [rows, setRows] = useState<api.ScreeningItemOut[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState(""),
    [item, setItem] = useState<api.ScreeningItemOut>(),
    [mode, setMode] = useState<"report" | "dismiss">(),
    [reviewed, setReviewed] = useState(false),
    [saved, setSaved] = useState<
      api.IncidentDetailOut | api.DismissedItemOut
    >(),
    [types, setTypes] = useState<api.IncidentTypeOut[]>([]),
    [formError, setFormError] = useState<unknown>(),
    [typeCode, setTypeCode] = useState("");
  const generation = useRef(0),
    form = useRef<HTMLFormElement>(null),
    [draftZone, setDraftZone] = useState(timeZone);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    setReviewed(false);
    try {
      const data = await api.screeningList();
      if (n === generation.current) setRows(data);
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, revision]);
  const [typesError, setTypesError] = useState<unknown>();
  const loadTypes = useCallback(async () => {
    setTypesError(undefined);
    try {
      setTypes(await api.listTypes({ active_only: true }));
    } catch (e) {
      setTypesError(e);
    }
  }, []);
  useEffect(() => {
    if (mode === "report") void loadTypes();
  }, [mode, loadTypes]);
  const write = useClinicalWrite(user, "incident_screening", async (result) => {
    setSaved(result);
    setMode(undefined);
    setItem(undefined);
    setReviewed(false);
    await load();
  });
  useEffect(() => {
    if (write.error && !write.blocked) void load();
  }, [write.error, write.blocked, load]);
  const current =
      item && rows.find((r) => r.screening_key === item.screening_key),
    zoneError =
      hospitalTimeZoneError(timeZone) ||
      (mode === "report" && draftZone !== timeZone
        ? new Error(
            t(
              "The hospital timezone changed. Cancel and reopen the report.",
              "ہسپتال کا وقت بدل گیا۔ رپورٹ منسوخ کر کے دوبارہ کھولیں۔",
            ),
          )
        : undefined),
    blocked = write.blocked;
  const editable =
    connected && !readOnly && !loading && !error && !blocked && !!current;
  const visible = rows.filter(
    (r) =>
      (!kind || r.kind === kind) &&
      [r.patient_name, r.mrn, r.detail, r.suggested_type_name]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  function open(row: api.ScreeningItemOut, next: "report" | "dismiss") {
    if (
      mode &&
      !window.confirm(
        t(
          "Discard this unsent screening draft?",
          "یہ غیر ارسال شدہ مسودہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    setSaved(undefined);
    setFormError(undefined);
    setTypeCode(row.suggested_type_code);
    setItem(row);
    setMode(next);
    setReviewed(false);
    setDraftZone(timeZone);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable || !item || !reviewed) return;
    setFormError(undefined);
    const d = new FormData(e.currentTarget),
      s = (k: string) => String(d.get(k) ?? "").trim();
    try {
      if (mode === "dismiss") {
        write.start({
          method: "POST",
          path: "/incident-screening/dismiss",
          body: {
            screening_key: item.screening_key,
            reason: s("reason"),
          } satisfies api.DismissIn,
          permission: "incident.manage",
          protection: "reconcile",
          reconcilePath: "/incident-screening",
          label: t(
            "Dismiss this screening item",
            "چھان بین کا یہ معاملہ خارج کریں",
          ),
        });
      } else {
        if (zoneError) throw zoneError;
        const body: api.IncidentIn = {
          screening_key: item.screening_key,
          type_code: s("type_code"),
          affected: "Patient",
          patient_id: item.patient_id,
          admission_id: item.admission_id,
          booking_id: item.booking_id,
          death_id: item.death_id,
          occurred_at: hospitalTimeToUtc(s("occurred_at"), timeZone!),
          kind: s("kind") as api.IncidentIn["kind"],
          harm: s("harm") as api.IncidentIn["harm"],
          description: s("description"),
          immediate_action: s("immediate_action"),
          reporter_confidential: d.has("reporter_confidential"),
          location: s("location") || null,
          department_id: s("department_id") ? Number(s("department_id")) : null,
          ward_id: s("ward_id") ? Number(s("ward_id")) : null,
          ot_phase: (s("ot_phase") as api.IncidentIn["ot_phase"]) || null,
          medication_stage:
            (s("medication_stage") as api.IncidentIn["medication_stage"]) ||
            null,
          drug_id: s("drug_id") ? Number(s("drug_id")) : null,
        };
        write.start({
          method: "POST",
          path: "/incidents",
          body,
          permission: "incident.report",
          protection: "idempotent",
          reconcilePath: "/incident-screening",
          label: t(
            "Report this screening item",
            "چھان بین سے واقعہ رپورٹ کریں",
          ),
        });
      }
    } catch (e) {
      setFormError(e);
    }
  }
  return (
    <section
      data-screen="incident_screening"
      data-unsaved={!!mode}
      data-write-pending={blocked}
    >
      <div className="section-heading">
        <div>
          <h1>
            {t(
              "Possible sentinel events (screening)",
              "ممکنہ سنگین واقعات کی چھان بین",
            )}
          </h1>
          <p>
            {t(
              "Review what the records found. Report the facts or explain why it is not an incident.",
              "ریکارڈ سے ملے معاملات دیکھیں۔ حقائق رپورٹ کریں یا واقعہ نہ ہونے کی وجہ لکھیں۔",
            )}
          </p>
        </div>
        <div className="actions">
          <button
            data-help="isc.refresh"
            aria-disabled={blocked || loading}
            onClick={() => {
              if (!blocked && !loading) void load();
            }}
          >
            {t("Refresh screening", "چھان بین تازہ کریں")}
          </button>
          <button data-help="isc.help" onClick={onOpenHelp}>
            {t("Help · F1", "مدد · F1")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="status">
          {t(
            "Reconnecting. Decisions are unavailable until the live connection returns.",
            "رابطہ بحال ہو رہا ہے۔ تب تک فیصلہ دستیاب نہیں۔",
          )}
        </p>
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setReviewed(false);
          void load();
        }}
      />
      {write.attempt?.body.protection === "reconcile" && (
        <p className="notice">
          {t(
            "A missing item only means it is no longer pending: another person may have reported or dismissed it, or its screening window ended. It does not confirm your dismissal. Compare the original source with Quality before releasing the hold. Never repeat automatically.",
            "غائب معاملہ صرف اب زیر انتظار نہیں: کسی اور نے رپورٹ یا خارج کیا یا مدت ختم ہوئی۔ اس سے آپ کا اخراج ثابت نہیں۔ کوالٹی کے ساتھ اصل ماخذ ملائیں؛ خودکار دوبارہ نہ بھیجیں۔",
          )}
        </p>
      )}
      {saved && (
        <section role="status" className="notice">
          <h2>
            {"incident_number" in saved
              ? saved.incident_number
              : t("Dismissal confirmed", "اخراج کی تصدیق")}
          </h2>
          <p>
            {"dismissed_reason" in saved
              ? saved.dismissed_reason
              : saved.next_step}
          </p>
          {"patient_name" in saved && (
            <p>
              {saved.patient_name} · {saved.mrn}
            </p>
          )}
        </section>
      )}
      <ErrorBox error={error} />
      {loading && (
        <p role="status">{t("Loading screening…", "چھان بین کھل رہی ہے…")}</p>
      )}
      <div className="form-grid">
        <Field label={t("Find in screening", "چھان بین میں تلاش")}>
          <input
            data-help="isc.filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Field label={t("Source kind", "ماخذ کی قسم")}>
          <select
            data-help="isc.filter"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">{t("All kinds", "تمام اقسام")}</option>
            {(["ReturnToTheatre", "Readmission", "Death"] as const).map((k) => (
              <option key={k} value={k}>
                {kindName(k)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!loading && !error && visible.length === 0 && (
        <p role="status">
          {rows.length
            ? t(
                "No matching screening items. Clear the name or kind filter.",
                "متعلقہ معاملہ نہیں۔ نام یا قسم کا فلٹر ہٹائیں۔",
              )
            : t(
                "No pending items in the server screening window. Deaths appear after certification, readmissions after the previous discharge, and returns to theatre after both operation times are recorded. New items also arrive in Incident notifications.",
                "سرور کی مدت میں کوئی زیر انتظار معاملہ نہیں۔ وفات تصدیق کے بعد، دوبارہ داخلہ پچھلی رخصتی کے بعد، اور تھیٹر واپسی دونوں وقت درج ہونے پر دکھتی ہے۔ نئے معاملات واقعہ اطلاع میں بھی آتے ہیں۔",
              )}
        </p>
      )}
      {!loading &&
        !error &&
        visible.map((row) => (
          <article className="card" key={row.screening_key}>
            <h2>
              {kindName(row.kind)} · {row.patient_name}
            </h2>
            <p>
              {row.mrn} ·{" "}
              {timeZone
                ? formatHospitalTime(row.found_at, timeZone)
                : row.found_at}
            </p>
            <p>{row.detail}</p>
            <p>
              {t("Suggested type", "تجویز کردہ قسم")}: {row.suggested_type_name}
            </p>
            <div className="actions">
              {user.permissions.includes("incident.report") && (
                <button
                  data-help="isc.report"
                  disabled={blocked || readOnly || !connected}
                  onClick={() => open(row, "report")}
                >
                  {t("Report this item", "یہ معاملہ رپورٹ کریں")}
                </button>
              )}
              {user.permissions.includes("incident.manage") && (
                <button
                  data-help="isc.dismiss"
                  disabled={blocked || readOnly || !connected}
                  onClick={() => open(row, "dismiss")}
                >
                  {t("Dismiss with reason", "وجہ کے ساتھ خارج کریں")}
                </button>
              )}
            </div>
          </article>
        ))}
      {mode && item && (
        <form
          ref={form}
          key={item.screening_key + mode}
          className="card"
          onSubmit={submit}
          onChangeCapture={() => setReviewed(false)}
        >
          <h2>
            {mode === "report"
              ? t("Report from screening", "چھان بین سے رپورٹ")
              : t("Explain this dismissal", "اخراج کی وضاحت")}
          </h2>
          <p>
            {item.patient_name} · {item.mrn} · {kindName(item.kind)}
          </p>
          <p>{item.detail}</p>
          {!current && !loading && !error && (
            <p role="alert">
              {t(
                "This item is no longer pending. Keep the unsent draft for comparison, then cancel it and review the source with Quality.",
                "یہ معاملہ اب زیر انتظار نہیں۔ موازنے کو مسودہ رکھیں، پھر منسوخ اور کوالٹی سے ماخذ چیک کریں۔",
              )}
            </p>
          )}
          <ErrorBox error={formError} />
          {mode === "report" && (
            <>
              <ErrorBox error={typesError} />
              <ErrorBox error={zoneError} />
              {typesError && (
                <button
                  type="button"
                  data-help="isc.refresh"
                  onClick={() => void loadTypes()}
                >
                  {t("Reload incident types", "واقعات کی اقسام دوبارہ لائیں")}
                </button>
              )}
            </>
          )}
          <fieldset disabled={!editable}>
            <legend>
              {t("Review before deciding", "فیصلے سے پہلے جائزہ")}
            </legend>
            {mode === "dismiss" ? (
              <Field
                label={t("Why this is not an incident", "یہ واقعہ کیوں نہیں")}
              >
                <textarea
                  data-help="isc.reason"
                  name="reason"
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={4}
                />
              </Field>
            ) : (
              <>
                <p>
                  {t(
                    "Affected: Patient. The patient and linked stay, operation or death come from the selected source row. Confirm the facts and occurrence time; no identity is typed again.",
                    "متاثر: مریض۔ مریض، قیام، آپریشن یا وفات منتخب ماخذ سے ہیں۔ حقائق اور وقوع کا وقت چیک کریں؛ شناخت دوبارہ نہیں لکھنی۔",
                  )}
                </p>
                <div className="form-grid">
                  <Field label={t("Incident type", "واقعے کی قسم")}>
                    <select
                      data-help="isc.classify"
                      name="type_code"
                      required
                      value={typeCode}
                      onChange={(e) => setTypeCode(e.target.value)}
                    >
                      <option value="">{t("Choose a type", "قسم چنیں")}</option>
                      {types.map((v) => (
                        <option key={v.type_code} value={v.type_code}>
                          {v.name}
                          {v.sentinel === "Always"
                            ? " · " + t("Sentinel", "سنگین")
                            : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t("Incident or near miss", "واقعہ یا بال بال بچاؤ")}
                  >
                    <select
                      data-help="isc.classify"
                      name="kind"
                      defaultValue="Incident"
                    >
                      <option value="Incident">{t("Incident", "واقعہ")}</option>
                      <option value="NearMiss">
                        {t("Near miss", "بال بال بچاؤ")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("Harm", "نقصان")}>
                    <select
                      data-help="isc.classify"
                      name="harm"
                      required
                      defaultValue=""
                    >
                      <option value="">
                        {t("Choose after review", "جائزے کے بعد چنیں")}
                      </option>
                      {(
                        [
                          "NoHarm",
                          "Mild",
                          "Moderate",
                          "Severe",
                          "Death",
                        ] as const
                      ).map((k) => (
                        <option key={k} value={k}>
                          {
                            {
                              NoHarm: t("No harm", "کوئی نقصان نہیں"),
                              Mild: t("Mild", "معمولی"),
                              Moderate: t("Moderate", "درمیانہ"),
                              Severe: t("Severe", "شدید"),
                              Death: t("Death", "وفات"),
                            }[k]
                          }
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t("When it happened", "وقوع کا وقت")}
                    hint={timeZone}
                  >
                    <input
                      data-help="isc.whenwhere"
                      name="occurred_at"
                      type="datetime-local"
                      required
                      defaultValue={
                        !zoneError
                          ? hospitalTimeInput(item.found_at, timeZone!)
                          : ""
                      }
                    />
                  </Field>
                  <Field label={t("Department", "شعبہ")}>
                    <DirectoryPicker
                      data-help="isc.directory"
                      path="/admin/departments"
                      idField="department_id"
                      name="department_id"
                    />
                  </Field>
                  <Field label={t("Ward", "وارڈ")}>
                    <DirectoryPicker
                      data-help="isc.directory"
                      path="/beds/matrix?include_beds=false"
                      list="wards"
                      idField="ward_id"
                      name="ward_id"
                    />
                  </Field>
                  <Field label={t("Location", "جگہ")}>
                    <input
                      data-help="isc.whenwhere"
                      name="location"
                      maxLength={300}
                    />
                  </Field>
                </div>
                {item.booking_id != null && (
                  <Field label={t("Phase of operation", "آپریشن کا مرحلہ")}>
                    <select
                      data-help="isc.phase"
                      name="ot_phase"
                      required
                      defaultValue=""
                    >
                      <option value="">
                        {t("Choose the actual phase", "اصل مرحلہ چنیں")}
                      </option>
                      {[
                        "BeforeInduction",
                        "Induction",
                        "Maintenance",
                        "Emergence",
                        "Recovery",
                        "AfterRecovery",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <details>
                  <summary data-help="isc.directory">
                    {t("Medicine details, if relevant", "متعلقہ دوا کی تفصیل")}
                  </summary>
                  <Field label={t("Medicine", "دوا")}>
                    <DirectoryPicker
                      data-help="isc.directory"
                      path="/drugs/search"
                      idField="drug_id"
                      name="drug_id"
                      search
                    />
                  </Field>
                  <Field label={t("Medication stage", "دوا کا مرحلہ")}>
                    <select
                      data-help="isc.classify"
                      name="medication_stage"
                      defaultValue=""
                    >
                      <option value="">
                        {t("Not applicable", "لاگو نہیں")}
                      </option>
                      {[
                        "Prescribing",
                        "Transcribing",
                        "Dispensing",
                        "Administration",
                        "Monitoring",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                </details>
                <Field label={t("What happened", "کیا ہوا")}>
                  <textarea
                    data-help="isc.narrative"
                    name="description"
                    required
                    minLength={10}
                    maxLength={8000}
                    rows={4}
                  />
                </Field>
                <Field label={t("What was done at once", "فوراً کیا کیا گیا")}>
                  <textarea
                    data-help="isc.narrative"
                    name="immediate_action"
                    required
                    minLength={3}
                    maxLength={4000}
                    rows={3}
                  />
                </Field>
                <label>
                  <input
                    data-help="isc.narrative"
                    name="reporter_confidential"
                    type="checkbox"
                  />
                  {t(
                    "Keep my name confidential (visible to incident managers)",
                    "میرا نام خفیہ رکھیں (واقعہ منتظمین دیکھ سکتے ہیں)",
                  )}
                </label>
              </>
            )}
            <label className="check">
              <input
                data-help="isc.review"
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
              {t(
                "I checked this source and the proposed decision.",
                "میں نے ماخذ اور مجوزہ فیصلہ چیک کیا۔",
              )}
            </label>
            <button
              data-help="isc.submit"
              className="primary"
              disabled={
                !reviewed ||
                !!(
                  mode === "report" &&
                  (zoneError || typesError || !types.length)
                )
              }
            >
              {mode === "report"
                ? t("Submit screening report", "چھان بین رپورٹ بھیجیں")
                : t("Confirm dismissal", "اخراج کی تصدیق")}
            </button>
          </fieldset>
          <button
            type="button"
            data-help="isc.cancel"
            disabled={blocked}
            onClick={() => {
              setMode(undefined);
              setItem(undefined);
              setReviewed(false);
            }}
          >
            {t("Cancel unsent draft", "غیر ارسال مسودہ منسوخ")}
          </button>
        </form>
      )}
    </section>
  );
}
