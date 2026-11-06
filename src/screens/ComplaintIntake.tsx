import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as complaints from "../generated/complaint_intake";
import { getPatient } from "../generated/patient_search";
import { DirectoryPicker, canReadDirectory } from "../DirectoryPicker";
import { ErrorBox, Field, useLoad } from "../components";
import { call, ApiError } from "../bridge";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import enums from "../complaint-intake-values.json";
export type ComplaintDesk =
  | "record_complaint_reception"
  | "record_complaint_admissions"
  | "record_complaint_er"
  | "record_complaint_ward"
  | "complaints_register";
type Letter = "Notice" | "Acknowledgement" | "Outcome" | "AppealOutcome";
const label = (v: string) =>
  t(
    v.replace(/([a-z])([A-Z])/g, "$1 $2"),
    (
      {
        InPerson: "بالمشافہ",
        Telephone: "ٹیلی فون",
        Letter: "خط",
        Email: "ای میل",
        SuggestionBox: "تجویز کا ڈبہ",
        HealthCommission: "ہیلتھ کمیشن",
        Acknowledgement: "وصولی کا خط",
        Outcome: "نتیجے کا خط",
        AppealOutcome: "اپیل فیصلے کا خط",
        SocialMedia: "سوشل میڈیا",
        Other: "دیگر",
        Patient: "مریض",
        Relative: "رشتہ دار",
        Attendant: "تیماردار",
        Visitor: "ملاقاتی",
        Staff: "عملہ",
        Anonymous: "گمنام",
        SMS: "ایس ایم ایس",
        ClinicalCare: "طبی نگہداشت",
        NursingCare: "نرسنگ نگہداشت",
        StaffAttitude: "عملے کا رویہ",
        Communication: "رابطہ",
        WaitingTime: "انتظار",
        Billing: "بل",
        Cleanliness: "صفائی",
        Food: "کھانا",
        Facilities: "سہولیات",
        Privacy: "رازداری",
        Safety: "حفاظت",
        Medication: "دوا",
        Diagnostics: "تشخیص",
        Received: "موصول",
        Acknowledged: "وصولی کا جواب",
        Resolved: "جواب پہنچایا",
        Appealed: "اپیل",
        Closed: "بند",
        Withdrawn: "واپس لی",
        NotMaintainable: "ناقابل کارروائی",
      } as Record<string, string>
    )[v] ?? v,
  );
export function ComplaintIntake({
  screenId,
  user,
  revision,
  connected,
  readOnly,
  noNewWork,
  timeZone,
  onOpenHelp,
  intakeOnly=false,
  onRecorded,
  onPendingChange,
  onCancel,
}: {
  screenId: ComplaintDesk;
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
  intakeOnly?: boolean;
  onRecorded?: (record:complaints.ComplaintDetailOut)=>void;
  onPendingChange?: (pending:boolean)=>void;
  onCancel?: ()=>void;
}) {
  const [rows, setRows] = useState<complaints.ComplaintOut[]>([]),
    [detail, setDetail] = useState<complaints.ComplaintDetailOut>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [mode, setMode] = useState<"new" | "appeal"|undefined>(intakeOnly?"new":undefined),
    [dirty, setDirty] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [find, setFind] = useState(""),
    [ids, setIds] = useState<Record<string, string>>({}),
    [relation, setRelation] = useState("Visitor"),
    [channel, setChannel] = useState("InPerson"),
    [appealText, setAppealText] = useState(""),
    [means, setMeans] = useState("InPerson"),
    [formError, setFormError] = useState<unknown>(),
    [printBusy, setPrintBusy] = useState(false),
    [printError, setPrintError] = useState<unknown>(),
    [printNotice, setPrintNotice] = useState("");
  const selected = useRef<number | undefined>(undefined),
    generation = useRef(0),
    form = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const list = intakeOnly ? [] : await complaints.listComplaints({ mine: true, limit: 1000 });
      const d = selected.current
        ? await complaints.getComplaint(selected.current)
        : undefined;
      if (n === generation.current) {
        setRows(list);
        setDetail(d);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [intakeOnly]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, revision]);
  const write = useClinicalWrite(user, screenId, async (value) => {
    selected.current = value.complaint_id;
    setDetail(value);
    setMode(undefined);
    setDirty(false);
    setReviewed(false);
    setIds({});
    setAppealText("");
    await load();
    onRecorded?.(value);
  });
  useEffect(()=>{onPendingChange?.(write.blocked)},[write.blocked,onPendingChange]);
  useEffect(() => {
    setReviewed(false);
  }, [detail]);
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      ["COMPLAINT_APPEAL_LATE", "COMPLAINT_STATE_INVALID"].includes(
        write.error.response.error?.code ?? "",
      )
    )
      void load();
  }, [write.error, load]);
  const patient = useLoad(
    () =>
      ids.patient_id && user.permissions.includes("patient.view")
        ? getPatient(Number(ids.patient_id))
        : Promise.resolve(undefined),
    [ids.patient_id, revision],
  );
  const patientReady = !ids.patient_id || !user.permissions.includes('patient.view') || (!!patient.data && patient.data.patient_id === Number(ids.patient_id) && !patient.data.merged_into_id && !patient.loading && !patient.error);
  const allowed = (path: string) => canReadDirectory(path, user.permissions);
  const writable =
    connected &&
    !readOnly &&
    !loading &&
    !error &&
    !write.blocked &&
    !printBusy;
  const choose = async (id: number) => {
    if (
      write.blocked ||
      printBusy ||
      ((mode || dirty) &&
        !window.confirm(
          t(
            "Discard the unsent complaint draft?",
            "غیر ارسال شکایت مسودہ چھوڑ دیں؟",
          ),
        ))
    )
      return;
    selected.current = id;
    setMode(undefined);
    setDirty(false);
    setReviewed(false);
    await load();
  };
  const startNew = () => {
    if (
      write.blocked ||
      printBusy ||
      ((mode || dirty) &&
        !window.confirm(
          t(
            "Discard the unsent complaint draft?",
            "غیر ارسال شکایت مسودہ چھوڑ دیں؟",
          ),
        ))
    )
      return;
    selected.current = undefined;
    setDetail(undefined);
    setPrintNotice("");
    setMode("new");
    setDirty(false);
    setReviewed(false);
    setIds({});
    setRelation("Visitor");
    setChannel("InPerson");
  };
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!writable || !reviewed || !patientReady) return;
    setFormError(undefined);
    const f = new FormData(e.currentTarget);
    if (mode === "appeal" && detail?.can_appeal) {
      void write.start({
        method: "POST",
        path: `/complaints/${detail.complaint_id}/appeal`,
        body: { appeal_text: appealText.trim(), means },
        permission: {
          recordPath: `/complaints/${detail.complaint_id}`,
          capability: "can_appeal",
        },
        protection: "idempotent",
        reconcilePath: `/complaints/${detail.complaint_id}`,
        label: t("Record appeal", "اپیل درج کریں"),
      });
      return;
    }
    if (
      mode !== "new" ||
      noNewWork ||
      !user.permissions.includes("complaint.register")
    )
      return;
    const body: complaints.ComplaintIn = {
      channel: channel as complaints.ComplaintIn["channel"],
      complainant_relation:
        relation as complaints.ComplaintIn["complainant_relation"],
      complainant_name:
        relation === "Anonymous"
          ? "Anonymous"
          : String(f.get("complainant_name") ?? "").trim(),
      complainant_phone:
        String(f.get("complainant_phone") ?? "").trim() || null,
      complainant_contact:
        String(f.get("complainant_contact") ?? "").trim() || null,
      preferred_means: String(
        f.get("preferred_means"),
      ) as complaints.ComplaintIn["preferred_means"],
      category: String(f.get("category")) as complaints.ComplaintIn["category"],
      description: String(f.get("description") ?? "").trim(),
      desired_outcome: String(f.get("desired_outcome") ?? "").trim() || null,
    };
    if (
      !["Anonymous"].includes(relation) &&
      channel !== "SuggestionBox" &&
      !body.complainant_phone &&
      !body.complainant_contact
    ) {
      setFormError(
        Error(
          t(
            "Give a telephone number or an address to keep the complainant informed.",
            "رابطے کے لیے فون یا پتہ دیں۔",
          ),
        ),
      );
      return;
    }
    for (const [key, id] of Object.entries(ids))
      if (id && (key !== "patient_id" || !ids.admission_id)) {
        const path =
          key === "department_id"
            ? "/admin/departments"
            : key === "ward_id"
              ? "/beds/matrix"
              : key === "admission_id"
                ? "/admissions"
                : "/patients/search";
        if (allowed(path)) Object.assign(body, { [key]: Number(id) });
      }
    void write.start({
      method: "POST",
      path: "/complaints",
      body,
      permission: "complaint.register",
      protection: "idempotent",
      reconcilePath: "/complaints?mine=true&limit=1000",
      label: t("Record complaint", "شکایت درج کریں"),
    });
  }
  async function print(kind: Letter, pdf = false) {
    if (
      !connected ||
      write.blocked ||
      printBusy ||
      (!detail && kind !== "Notice")
    )
      return;
    setPrintBusy(true);
    setPrintError(undefined);
    setPrintNotice("");
    try {
      const result = await call("print-complaint", {
        kind,
        pdf,
        ...(kind === "Notice"
          ? {}
          : {
              complaintId: detail!.complaint_id,
              expectedVersion: detail!.row_version,
            }),
      });
      setPrintNotice(
        result.saved === false
          ? t(
              "Save cancelled. The complaint is unchanged.",
              "محفوظ منسوخ؛ شکایت برقرار ہے۔",
            )
          : result.saved
            ? t(
                "PDF saved. No complaint was recorded again.",
                "پی ڈی ایف محفوظ؛ شکایت دوبارہ درج نہیں ہوئی۔",
              )
            : t(
                "Sent to the document printer. Check the paper.",
                "دستاویز پرنٹر کو بھیجا؛ کاغذ چیک کریں۔",
              ),
      );
    } catch (e) {
      setPrintError(e);
    } finally {
      setPrintBusy(false);
    }
  }
  const pick = (
    key: string,
    path: string,
    idField: string,
    options: { search?: boolean; list?: string } = {},
  ) => (
    <DirectoryPicker
      data-help={
        key === "department_id"
          ? "ci.department_id"
          : key === "ward_id"
            ? "ci.ward_id"
            : key === "admission_id"
              ? "ci.admission_id"
              : "ci.patient_id"
      }
      path={path}
      idField={idField}
      {...options}
      disabled={!writable}
      value={ids[key] ?? ""}
      onRecord={
        key === "admission_id"
          ? (row) =>
              setIds((v) => ({
                ...v,
                patient_id: row?.patient_id ? String(row.patient_id) : "",
              }))
          : undefined
      }
      onChange={(e) => {
        setIds((v) => ({ ...v, [key]: e.target.value }));
        setDirty(true);
        setReviewed(false);
      }}
    />
  );
  const stamp = (s: string) => (timeZone ? formatHospitalTime(s, timeZone) : s);
  const shown = rows.filter(
    (r) =>
      !find.trim() ||
      [r.complaint_number, r.complainant_name, r.patient_name, r.mrn].some(
        (v) => v?.toLowerCase().includes(find.trim().toLowerCase()),
      ),
  );
  return (
    <section
      data-screen={screenId}
      data-unsaved={dirty || !!mode}
      data-write-pending={write.blocked}
    >
      {!intakeOnly && <div className="section-heading">
        <div>
          <h1>{t("Record a complaint", "شکایت درج کریں")}</h1>
          <p>
            {t(
              "Listen, record their words and give the tracking number. The complaints officer acknowledges and arranges a response.",
              "سنیں، ان کے الفاظ درج کریں اور شکایت نمبر دیں۔ شکایات افسر وصولی کا جواب اور کارروائی کرتا ہے۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="ci.refresh"
            disabled={write.busy || printBusy}
            onClick={() => void load()}
          >
            {t("Refresh complaints", "شکایات تازہ پڑھیں")}
          </button>
          <button data-help="ci.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
        </div>
      </div>}
      <div className="toolbar">
        {!intakeOnly && user.permissions.includes("complaint.register") && (
          <button
            data-help="ci.new"
            disabled={!writable || noNewWork}
            onClick={startNew}
          >
            {t("New complaint", "نئی شکایت")}
          </button>
        )}
        <button
          data-help="ci.notice"
          disabled={!connected || write.blocked || printBusy}
          onClick={() => void print("Notice")}
        >
          {t("Print right-to-complain notice", "شکایت کے حق کا نوٹس پرنٹ کریں")}
        </button>
        <button
          data-help="ci.notice"
          disabled={!connected || write.blocked || printBusy}
          onClick={() => void print("Notice", true)}
        >
          {t("Save notice PDF", "نوٹس پی ڈی ایف محفوظ کریں")}
        </button>
      </div>
      {loading && (
        <p role="status">{t("Loading complaints…", "شکایات کھل رہی ہیں…")}</p>
      )}
      <ErrorBox error={error} />
      <ErrorBox error={formError} />
      <ClinicalWriteFeedback write={write} onReviewed={() => void load()} />
      <ErrorBox error={printError} />
      {printError != null && (
        <p>
          {t(
            "Retry printing the same document. Never record the complaint or appeal again because printing failed.",
            "اسی کاغذ کا پرنٹ دوبارہ کریں۔ پرنٹ ناکامی پر شکایت یا اپیل دوبارہ درج نہ کریں۔",
          )}
        </p>
      )}
      {printNotice && <p role="status">{printNotice}</p>}
      {mode === "new" && (
        <form
          ref={form}
          onSubmit={submit}
          onChange={(e) => {
            setDirty(true);
            setFormError(undefined);
            if (!(
              e.target instanceof HTMLInputElement &&
              e.target.type === "checkbox"
            ))
              setReviewed(false);
          }}
          className="card"
        >
          <h2>{t("The complaint in their words", "شکایت ان کے الفاظ میں")}</h2>
          <fieldset disabled={!writable}>
            <div className="form-grid">
              <Field label={t("How it came", "کیسے موصول ہوئی")}>
                <select
                  data-help="ci.channel"
                  name="channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {enums.channel.enum.map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Relationship", "رشتہ")}>
                <select
                  data-help="ci.relation"
                  name="complainant_relation"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                >
                  {enums.complainant_relation.enum.map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </Field>
              {relation !== "Anonymous" && (
                <Field label={t("Complainant name", "شکایت کنندہ کا نام")}>
                  <input
                    data-help="ci.name"
                    name="complainant_name"
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </Field>
              )}
              <Field
                label={t("Telephone (or give an address)", "فون، یا پتہ دیں")}
              >
                <input
                  data-help="ci.contact"
                  name="complainant_phone"
                  type="tel"
                  maxLength={30}
                />
              </Field>
              <Field label={t("Address or email", "پتہ یا ای میل")}>
                <input
                  data-help="ci.contact"
                  name="complainant_contact"
                  maxLength={500}
                />
              </Field>
              <Field
                label={t(
                  "Preferred way to keep informed",
                  "باخبر رکھنے کا پسندیدہ ذریعہ",
                )}
              >
                <select
                  data-help="ci.preferred"
                  name="preferred_means"
                  defaultValue="InPerson"
                >
                  {["Telephone", "SMS", "Letter", "Email", "InPerson"].map(
                    (v) => (
                      <option key={v} value={v}>
                        {label(v)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label={t("Category", "زمرہ")}>
                <select
                  data-help="ci.category"
                  name="category"
                  defaultValue="Other"
                >
                  {enums.category.enum.map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Department (optional)", "شعبہ، اختیاری")}>
                {pick("department_id", "/admin/departments", "department_id")}
              </Field>
              {allowed("/beds/matrix") && (
                <Field label={t("Ward (optional)", "وارڈ، اختیاری")}>
                  {pick(
                    "ward_id",
                    "/beds/matrix?include_beds=false",
                    "ward_id",
                    { list: "wards" },
                  )}
                </Field>
              )}
              {["record_complaint_admissions","record_complaint_er","record_complaint_ward"].includes(screenId) &&
                allowed("/admissions") && (
                  <Field
                    label={t(
                      "Current admitted stay (optional)",
                      "موجودہ داخلہ، اختیاری",
                    )}
                  >
                    {pick(
                      "admission_id",
                      "/admissions?status=Admitted",
                      "admission_id",
                    )}
                  </Field>
                )}
              {!ids.admission_id && allowed("/patients/search") && (
                <Field
                  label={t(
                    "Patient (optional; find by name or MRN)",
                    "مریض، اختیاری؛ نام یا ایم آر این سے تلاش",
                  )}
                >
                  {pick("patient_id", "/patients/search", "patient_id", {
                    search: true,
                  })}
                </Field>
              )}
            </div>
            {patient.loading && (
              <p>
                {t(
                  "Checking patient identity…",
                  "مریض کی شناخت پڑھی جا رہی ہے…",
                )}
              </p>
            )}
            <ErrorBox error={patient.error} />
            {patient.data && (
              <div className="patient-banner">
                <strong>
                  {patient.data.full_name} · <bdi>{patient.data.mrn}</bdi>
                </strong>
                <p>
                  {t("Age / date of birth", "عمر / تاریخ پیدائش")}:{" "}
                  {patient.data.dob ??
                    patient.data.age_years ??
                    t("Not recorded", "درج نہیں")}{" "}
                  · {patient.data.gender}
                </p>
                <p>
                  {t("Allergies", "الرجی")}:{" "}
                  {patient.data.allergies || t("Not recorded", "درج نہیں")}
                </p>
                <p>{t('Blood group','خون کا گروپ')}: {patient.data.blood_group || t('Not recorded','درج نہیں')}</p>
                {patient.data.patient_id !== Number(ids.patient_id) && <p className="notice">{t('The patient was merged. Review the returned master identity before recording the complaint.','مریض ضم ہوا ہے۔ شکایت درج کرنے سے پہلے واپس آیا اصل ریکارڈ چیک کریں۔')}<button type="button" data-help="ci.patient_id" onClick={()=>{setIds(v=>({...v,patient_id:String(patient.data!.patient_id)}));setReviewed(false)}}>{t('Select returned master patient','واپس آیا اصل مریض چنیں')}</button></p>}
                {patient.data.is_deceased && (
                  <p>{t("Deceased", "وفات پا چکے")}</p>
                )}
                {patient.data.temp_identifier && (
                  <p>
                    {t("Temporary identity", "عارضی شناخت")}:{" "}
                    {patient.data.temp_identifier}
                  </p>
                )}
                {!!patient.data.mlc_numbers?.length && (
                  <p>{patient.data.mlc_numbers.join(" · ")}</p>
                )}
                {patient.data.outstanding?.banner_text && (
                  <p>{patient.data.outstanding.banner_text}</p>
                )}
              </div>
            )}
            <Field
              label={t("Complaint in their words", "شکایت ان کے الفاظ میں")}
            >
              <textarea
                data-help="ci.description"
                name="description"
                required
                minLength={10}
                maxLength={8000}
              />
            </Field>
            <Field
              label={t(
                "What they ask for (optional)",
                "ان کی درخواست، اختیاری",
              )}
            >
              <textarea
                data-help="ci.desired"
                name="desired_outcome"
                maxLength={2000}
              />
            </Field>
          </fieldset>
          <label>
            <input
              data-help="ci.confirm"
              type="checkbox"
              checked={reviewed}
              disabled={!writable || !patientReady}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t(
              "I checked the words, contact and selected records with the complainant.",
              "میں نے شکایت کنندہ کے ساتھ الفاظ، رابطہ اور منتخب ریکارڈ چیک کیے۔",
            )}
          </label>
          <div className="toolbar">
            <button
              data-help="ci.submit"
              type="submit"
              disabled={
                !writable || !reviewed || !patientReady
              }
            >
              {t("Record complaint", "شکایت درج کریں")}
            </button>
            <button
              data-help="ci.cancel"
              type="button"
              disabled={write.blocked}
              onClick={() => {
                setMode(undefined);
                setDirty(false);
                setIds({});
                onCancel?.();
              }}
            >
              {t("Cancel unsent draft", "غیر ارسال مسودہ منسوخ")}
            </button>
          </div>
        </form>
      )}
      {!intakeOnly && !loading && !error && (
        <>
          <Field
            label={t(
              "Find in my complaints by tracking number or name",
              "میری شکایات میں نمبر یا نام سے تلاش",
            )}
          >
            <input
              data-help="ci.find"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </Field>
          <p>
            {t(
              "Only complaints this account may read are listed. If another desk received it, ask the complaints officer to open the authorised record.",
              "صرف اس اکاؤنٹ کے مجاز ریکارڈ ہیں۔ دوسرے میز نے درج کی تو شکایات افسر سے مجاز ریکارڈ کھلوائیں۔",
            )}
          </p>
          {!shown.length ? (
            <p role="status">
              {t(
                "No matching complaints. Record a new complaint, or check its tracking number with the complaints officer.",
                "متعلقہ شکایت نہیں۔ نئی درج کریں یا شکایات افسر سے نمبر چیک کریں۔",
              )}
            </p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Tracking number", "شکایت نمبر"),
                      t("Complainant", "شکایت کنندہ"),
                      t("Status", "حالت"),
                      t("Received", "موصول"),
                      t("Open", "کھولیں"),
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.complaint_id}>
                      <td>
                        <bdi>{r.complaint_number}</bdi>
                      </td>
                      <td>{r.complainant_name}</td>
                      <td>{label(r.status)}</td>
                      <td>{stamp(r.received_at)}</td>
                      <td>
                        <button
                          data-help="ci.open"
                          disabled={write.blocked || printBusy}
                          onClick={() => void choose(r.complaint_id)}
                        >
                          {t("Open complaint", "شکایت کھولیں")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length === 1000 && (
            <p>
              {t(
                "Up to1000 records are shown. Ask the complaints officer if an older record is missing.",
                "زیادہ سے زیادہ1000ریکارڈ ہیں۔ پرانا غائب ہو تو شکایات افسر سے پوچھیں۔",
              )}
            </p>
          )}
          {detail && (
            <article className="card">
              <h2>
                <bdi>{detail.complaint_number}</bdi> · {label(detail.status)}
              </h2>
              <p role="status">
                {t(
                  "Give this tracking number to the complainant. Keep the original complaint; do not record it again.",
                  "یہ نمبر شکایت کنندہ کو دیں۔ اصل شکایت رکھیں؛ دوبارہ درج نہ کریں۔",
                )}
              </p>
              <dl className="details">
                {[
                  [t("Complainant", "شکایت کنندہ"), detail.complainant_name],
                  [
                    t("Contact", "رابطہ"),
                    [detail.complainant_phone, detail.complainant_contact]
                      .filter(Boolean)
                      .join(" · ") || null,
                  ],
                  [
                    t("Patient", "مریض"),
                    [detail.patient_name, detail.mrn]
                      .filter(Boolean)
                      .join(" · ") || null,
                  ],
                  [
                    t("Stay / ward / department", "داخلہ / وارڈ / شعبہ"),
                    [
                      detail.admission_number,
                      detail.ward_name,
                      detail.department_name,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null,
                  ],
                  [
                    t("Contact person", "رابطے کا ذمہ دار"),
                    detail.contact_name,
                  ],
                  [t("Answer due", "جواب کی تاریخ"), detail.answer_due],
                  [t("Next step", "اگلا قدم"), detail.next_step],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v ?? t("Not recorded", "درج نہیں")}</dd>
                  </div>
                ))}
              </dl>
              <p>{detail.description}</p>
              {detail.desired_outcome && <p>{detail.desired_outcome}</p>}
              {!detail.acknowledged_at && (
                <p>
                  {t(
                    "The complaints officer acknowledges within the day and names the contact person.",
                    "شکایات افسر اسی دن وصولی کا جواب اور رابطے کا ذمہ دار بتاتا ہے۔",
                  )}
                </p>
              )}
              {detail.outcome && (
                <section>
                  <h3>{t("Conveyed outcome", "پہنچایا گیا جواب")}</h3>
                  <p>{detail.outcome}</p>
                  <p>{detail.outcome_stamp?.text}</p>
                  <p>
                    {t("Appeal until", "اپیل کی آخری تاریخ")}:{" "}
                    {detail.appeal_until ?? t("Not recorded", "درج نہیں")}
                  </p>
                </section>
              )}
              {detail.appeal_text && (
                <section>
                  <h3>{t("Recorded appeal", "درج اپیل")}</h3>
                  <p>{detail.appeal_text}</p>
                  <p>{detail.appeal_decision}</p>
                  <p>{detail.appeal_stamp?.text}</p>
                </section>
              )}
              <div className="toolbar">
                {detail.can_appeal && (
                  <button
                    data-help="ci.appeal"
                    disabled={!writable || !!mode}
                    onClick={() => {
                      setMode("appeal");
                      setAppealText("");
                      setReviewed(false);
                    }}
                  >
                    {t("Record appeal", "اپیل درج کریں")}
                  </button>
                )}
                {(
                  [
                    ...(detail.acknowledged_at ? ["Acknowledgement"] : []),
                    ...(detail.outcome_at ? ["Outcome"] : []),
                    ...(detail.appeal_decided_at ? ["AppealOutcome"] : []),
                  ] as Letter[]
                ).map((k) => (
                  <span key={k}>
                    <button
                      data-help="ci.letter"
                      disabled={!connected || write.blocked || printBusy}
                      onClick={() => void print(k)}
                    >
                      {t("Print", "پرنٹ")} {label(k)}
                    </button>
                    <button
                      data-help="ci.letter"
                      disabled={!connected || write.blocked || printBusy}
                      onClick={() => void print(k, true)}
                    >
                      {t("Save PDF", "پی ڈی ایف محفوظ")} {label(k)}
                    </button>
                  </span>
                ))}
              </div>
              {mode === "appeal" && (
                <form onSubmit={submit}>
                  <fieldset disabled={!writable || !detail.can_appeal}>
                    <Field label={t("Why they disagree", "اختلاف کی وجہ")}>
                      <textarea
                        data-help="ci.appeal_text"
                        name="appeal_text"
                        required
                        minLength={10}
                        maxLength={8000}
                        value={appealText}
                        onChange={(e) => {
                          setAppealText(e.target.value);
                          setDirty(true);
                          setReviewed(false);
                        }}
                      />
                    </Field>
                    <Field label={t("How the appeal came", "اپیل کیسے آئی")}>
                      <select
                        data-help="ci.means"
                        value={means}
                        onChange={(e) => {
                          setMeans(e.target.value);
                          setReviewed(false);
                        }}
                      >
                        {[
                          "Telephone",
                          "SMS",
                          "Letter",
                          "Email",
                          "InPerson",
                        ].map((v) => (
                          <option key={v} value={v}>
                            {label(v)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <label>
                      <input
                        data-help="ci.confirm"
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                      {t(
                        "I checked the complaint, outcome, appeal window and their words.",
                        "میں نے شکایت، جواب، مدت اور الفاظ چیک کیے۔",
                      )}
                    </label>
                    <button
                      data-help="ci.submit"
                      disabled={!reviewed || !detail.can_appeal}
                    >
                      {t("Save appeal", "اپیل محفوظ کریں")}
                    </button>
                  </fieldset>
                  <button
                    data-help="ci.cancel"
                    type="button"
                    disabled={write.blocked}
                    onClick={() => {
                      setMode(undefined);
                      setDirty(false);
                      setAppealText("");
                    }}
                  >
                    {t("Cancel unsent draft", "غیر ارسال مسودہ منسوخ")}
                  </button>
                </form>
              )}
            </article>
          )}
        </>
      )}
    </section>
  );
}

export const complaintChoiceLabel=label;
