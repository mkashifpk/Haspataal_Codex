import { TreatingDoctor } from "./TreatingDoctor";
import { useEffect, useRef, useState } from "react";
import { api, call, ApiError } from "../bridge";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as a from "../generated/doctor_inpatients";
import { getPatient } from "../generated/patient_search";
import { bilingual as t, tr } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import {
  inpatientActionAllowed,
  inpatientSnapshot,
  inpatientEventMatches,
  type InpatientAction,
} from "../inpatient-policy";
type Editor = {
  action: InpatientAction;
  source: a.AdmissionDetailOut;
  details: a.AdmissionDetailsIn;
  note: string;
  ack: boolean;
};
export function DoctorInpatients({
  user,
  establishment,
  connected,
  stream,
  timeZone,
  availableScreens,
  onRoute,
  initialAdmissionId,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
  availableScreens: string[];
  onRoute: (screen: string, admissionId: number) => void;
  initialAdmissionId?: number;
}) {
  const can = (p: string) => user.permissions.includes(p),
    view = establishment.views.screens.find(
      (s) => s.screen_id === "doctor_inpatients",
    )?.view;
  const readable =
      can("ipd.admission.view") &&
      ["full", "open_work", "records"].includes(view || ""),
    live = connected && stream === "Live";
  const [listTick, setListTick] = useState(0),
    [handoverBusy, setHandoverBusy] = useState(false),
    [round, setRound] = useState<"mine" | "waiting">("mine"),
    [due, setDue] = useState<Record<number, number>>({});
  const scopeRows = useRef<Array<Pick<a.AdmissionOut, "admission_id" | "primary_doctor_id">>>([]);
  const selected = useRef<a.AdmissionDetailOut | undefined>(undefined);
  const [revision, setRevision] = useState(0),
    [id, setId] = useState<number | undefined>(initialAdmissionId),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [known, setKnown] = useState("");
  const [editor, setEditor] = useState<Editor>(),
    [review, setReview] = useState<a.AdmissionDetailsIn | a.DischargeIn>(),
    [stale, setStale] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [image, setImage] = useState<{ src: string; label: string }>(),
    [photo, setPhoto] = useState<string>(),
    [fileBusy, setFileBusy] = useState(false);
  const generation = useRef(0),
    fileFlight = useRef(false),
    root = useRef<HTMLElement>(null);
  const rows = useLoad(
    () =>
      readable
        ? a.listAdmissions({ status: status || undefined })
        : Promise.resolve([]),
    [readable, status, revision, listTick],
  );
  const waitingRows=useLoad(()=>readable?a.listTreatingDoctors({waiting:true}):Promise.resolve([]),[readable,revision,listTick]);
  scopeRows.current = [...(rows.data || []).filter(
    (r) =>
      r.primary_doctor_id === user.employee_id || r.primary_doctor_id === null,
  ), ...(waitingRows.data || [])];
  const activeRows=round==='waiting'?waitingRows:rows;
  const scoped = round==='waiting' ? (waitingRows.data||[]) : (rows.data||[]).filter(r=>!!user.employee_id&&r.primary_doctor_id===user.employee_id);
  const row = useLoad(
    () => (readable && id ? a.getAdmission(id) : Promise.resolve(undefined)),
    [readable, id, revision],
  );
  const record = row.data?.admission_id === id ? row.data : undefined;
  selected.current = record;
  const profile = useLoad(
    () =>
      record && can("patient.view")
        ? getPatient(record.patient_id)
        : Promise.resolve(undefined),
    [record?.patient_id, revision],
  );
  const person =
      profile.data?.patient_id === record?.patient_id
        ? profile.data
        : undefined,
    identity =
      !!record &&
      !!person &&
      record.patient_id === person.patient_id &&
      !row.loading &&
      !row.error &&
      !profile.loading &&
      !profile.error &&
      !person.merged_into_id;
  const flow = useLoad(
    () =>
      record && can("ipd.flowsheet.view")
        ? a.flowsheet(record.admission_id)
        : Promise.resolve(undefined),
    [record?.admission_id, revision],
  );
  const mar = useLoad(
    () =>
      record && can("ipd.mar.view")
        ? a.mar(record.admission_id)
        : Promise.resolve([]),
    [record?.admission_id, revision],
  );
  const stages = useLoad(
    () =>
      record
        ? a.dischargeStatus(record.admission_id)
        : Promise.resolve(undefined),
    [record?.admission_id, revision],
  );
  const docs = useLoad(
    () =>
      record && can("patient.document.view")
        ? a.listDocumentsPatients(record.patient_id)
        : Promise.resolve([]),
    [record?.patient_id, revision],
  );
  const write = useClinicalWrite(user, "doctor_inpatients", async (value) => {
    if (value?.admission_id !== id || value?.patient_id !== record?.patient_id)
      throw Error(
        "Returned admission identity differs. Read before another action.",
      );
    setEditor(undefined);
    setReview(undefined);
    setStale(false);
    setRevision((n) => n + 1);
  });
  const locked = write.blocked || fileBusy || handoverBusy,
    stamp = (s: string | null | undefined) =>
      s
        ? timeZone
          ? formatHospitalTime(s, timeZone)
          : s
        : t("Not recorded", "درج نہیں");
  const refresh = () => {
    setRevision((n) => n + 1);
    if (editor) {
      setStale(true);
      setReview(undefined);
    }
  };
  const leave = () =>
    !locked &&
    (!editor ||
      window.confirm(
        t(
          "Discard this unsent inpatient draft?",
          "یہ غیر ارسال داخلہ مسودہ چھوڑ دیں؟",
        ),
      ));
  const choose = (next: number) => {
    if (leave()) {
      generation.current++;
      setImage(undefined);
      setPhoto(undefined);
      row.setData(undefined);
      profile.setData(undefined);
      flow.setData(undefined);
      mar.setData(undefined);
      stages.setData(undefined);
      docs.setData(undefined);
      setEditor(undefined);
      setReview(undefined);
      setStale(false);
      setError(undefined);
      setNotice("");
      write.clearError();
      setId(next);
      setRevision((n) => n + 1);
    }
  };
  useEffect(() => {
    if (initialAdmissionId) choose(initialAdmissionId);
  }, [initialAdmissionId]);
  useEffect(() => {
    generation.current++;
    setImage(undefined);
    setPhoto(undefined);
  }, [id, user.user_id]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = window.terminal.subscribe((v) => {
      if (v.type === "event" && v.event_type === "vitals.due") {
        const admissionId = v.payload?.admission_id;
        if (!scopeRows.current.some((r) => r.admission_id === admissionId) &&
            !(selected.current && selected.current.admission_id === admissionId &&
              (selected.current.primary_doctor_id === user.employee_id || selected.current.primary_doctor_id === null)))
          return;
        const minutes = v.payload?.overdue_minutes;
        if (typeof minutes==='number' && Number.isFinite(minutes) && minutes>=0)
          setDue((d) => ({ ...d, [admissionId]: minutes }));
      }
      const clinical =
        v.type === "event" &&
        [
          "admission.doctor_changed",
          "admission.discharge.stage_changed",
          "admission.overflow_assigned",
          "vitals.due",
          "patient.merged",
          "death.recorded",
        ].includes(v.event_type || "");
      if (
        clinical &&
        v.type === "event" &&
        !inpatientEventMatches(selected.current, v.payload || {})
      ) {
        setListTick((n) => n + 1);
        return;
      }
      if (
        clinical ||
        (v.type === "stream" && v.status === "Live" && v.resync)
      ) {
        setStale(true);
        setReview(undefined);
        clearTimeout(timer);
        timer = setTimeout(() => setRevision((n) => n + 1), 150);
      }
    });
    return () => {
      stop();
      clearTimeout(timer);
      generation.current++;
    };
  }, []);
  const previousLive = useRef(live);
  useEffect(() => {
    if (live && !previousLive.current) refresh();
    previousLive.current = live;
  }, [live]);
  useEffect(() => {
    if (write.error) {
      setReview(undefined);
      if (write.error instanceof ApiError) {
        const code = write.error.response.error?.code;
        if (
          [
            "ADMISSION_DETAILS_RECORDED",
            "ADMISSION_STATE_INVALID",
            "DISCHARGE_NOT_ALLOWED",
            "DISCHARGE_SUMMARY_REQUIRED",
            "CONSENT_REQUIRED",
            "ADMISSION_DETAILS_REQUIRED",
          ].includes(code || "")
        ) {
          setStale(true);
          setRevision((n) => n + 1);
        }
      }
    }
  }, [write.error]);
  useEffect(() => {
    const target = root.current;
    if (!target) return;
    const marker = editor || write.blocked ? "true" : "false";
    target.setAttribute("data-unsaved", marker);
  }, [editor, write.blocked]);
  useEffect(() => {
    if (!locked && !editor) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [locked, editor]);
  useEffect(() => {
    if (!record?.photo_document_id || !can("patient.document.view")) return;
    let cancelled = false;
    const n = generation.current;
    void call<{ type: string; base64?: string }>("patient-file", {
      documentId: record.photo_document_id,
    })
      .then((v) => {
        if (
          !cancelled &&
          n === generation.current &&
          v.base64 &&
          ["image/jpeg", "image/png"].includes(v.type)
        )
          setPhoto(`data:${v.type};base64,${v.base64}`);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [record?.photo_document_id, revision]);
  async function openDocument(d: a.PatientDocumentOut) {
    if (locked || fileFlight.current || d.patient_id !== record?.patient_id)
      return;
    fileFlight.current = true;
    setFileBusy(true);
    setError(undefined);
    const n = generation.current;
    try {
      const result = await call<{
        type: string;
        base64?: string;
        saved?: boolean;
        cancelled?: boolean;
      }>("patient-file", { documentId: d.document_id, save: true });
      if (n === generation.current && result.base64)
        setImage({
          src: `data:${result.type};base64,${result.base64}`,
          label: d.title || d.doc_type,
        });
      if (result.saved)
        setNotice(
          t(
            "Document saved. No clinical record changed.",
            "دستاویز محفوظ۔ طبی ریکارڈ نہیں بدلا۔",
          ),
        );
    } catch (e) {
      setError(e);
    } finally {
      fileFlight.current = false;
      setFileBusy(false);
    }
  }
  function begin(action: InpatientAction) {
    if (
      !record ||
      !identity ||
      !live ||
      locked ||
      !inpatientActionAllowed(action, record, view, user.permissions) ||
      !leave()
    )
      return;
    write.clearError();
    setError(undefined);
    setNotice("");
    setStale(false);
    setReview(undefined);
    setEditor({
      action,
      source: record,
      details: {
        admission_reason: "",
        provisional_diagnosis: "",
        initial_care_plan: "",
      },
      note: "",
      ack: false,
    });
  }
  async function reviewDraft() {
    if (!editor || locked) return;
    setError(undefined);
    try {
      if (!identity || !editor.ack || stale)
        throw Error(
          t(
            "Verify patient identity and read current data before review.",
            "جائزے سے پہلے مریض و تازہ معلومات چیک کریں۔",
          ),
        );
      if (editor.action === "details") {
        const b = {
          admission_reason: editor.details.admission_reason.trim(),
          provisional_diagnosis: editor.details.provisional_diagnosis.trim(),
          initial_care_plan: editor.details.initial_care_plan?.trim() || null,
        };
        if (b.admission_reason.length < 3 || b.provisional_diagnosis.length < 2)
          throw Error(
            t(
              "Reason needs at least 3 characters and diagnosis at least 2.",
              "وجہ کم از کم3 اور تشخیص2حروف۔",
            ),
          );
        setReview(b);
      } else setReview({ note: editor.note.trim() || null });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!editor || !review || !record || !identity || !live || locked || stale)
      return;
    const d = editor,
      source = d.source;
    write.start(
      {
        method: "POST",
        path: `/admissions/${source.admission_id}/${d.action === "details" ? "admission-details" : "discharge"}`,
        body: review,
        permission:
          d.action === "discharge"
            ? "ipd.discharge.initiate"
            : can("ipd.admission.request")
              ? "ipd.admission.request"
              : "ipd.discharge.initiate",
        protection: "reconcile",
        reconcilePath: `/admissions/${source.admission_id}`,
        label:
          d.action === "details"
            ? t("Record reason and diagnosis", "وجہ و تشخیص درج")
            : t("Initiate clinical discharge", "طبی ڈسچارج شروع"),
      },
      async () => {
        const [fresh, actor, est, patient] = await Promise.all([
          a.getAdmission(source.admission_id),
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          getPatient(source.patient_id),
        ]);
        const currentView = est.views.screens.find(
          (s) => s.screen_id === "doctor_inpatients",
        )?.view;
        if (
          actor.user_id !== user.user_id ||
          patient.patient_id !== source.patient_id ||
          patient.merged_into_id ||
          inpatientSnapshot(fresh) !== inpatientSnapshot(source) ||
          !inpatientActionAllowed(
            d.action,
            fresh,
            currentView,
            actor.permissions,
          )
        ) {
          setStale(true);
          setReview(undefined);
          setRevision((n) => n + 1);
          throw Error(
            t(
              "The admission or permission changed. Input is kept; read its current state.",
              "داخلہ یا اجازت بدلی۔ معلومات محفوظ؛ موجودہ حالت پڑھیں۔",
            ),
          );
        }
      },
    );
  }
  const mutate = (patch: Partial<Editor>) => {
    setReview(undefined);
    setEditor((e) => (e ? { ...e, ...patch } : e));
  };
  const route = (screen: string) => {
    if (record && leave()) onRoute(screen, record.admission_id);
  };
  const errorCode =
    write.error instanceof ApiError
      ? write.error.response.error?.code
      : undefined;
  if (!readable)
    return (
      <Empty>
        {t(
          "Inpatient records are unavailable to this account or service view.",
          "اس صارف یا خدمت میں داخلہ ریکارڈ دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      className="inpatient-rounds"
      ref={root}
      data-inpatient-screen="doctor_inpatients"
      data-unsaved={!!editor}
      data-write-pending={write.blocked}
    >
      <h1>
        {t("Inpatient rounds & discharge", "داخل مریضوں کا معائنہ و ڈسچارج")}
      </h1>
      <p>
        {t(
          "My patients are assigned to my employee ID. Patients without a doctor wait for any doctor to take over. Due vitals come from the server; the nurse records them.",
          "میرے مریض میرے ملازم نمبر سے منسلک ہیں۔ بغیر ڈاکٹر مریض کسی ڈاکٹر کی ذمہ داری لینے کے منتظر ہیں۔ پیمائش کی اطلاع سرور دیتا ہے؛ نرس درج کرتی ہے۔",
        )}
      </p>
      {view !== "full" && (
        <p className="notice">
          {view === "open_work"
            ? t(
                "No new inpatient admissions from now on. Complete existing work.",
                "اب نئے داخلے نہیں۔ موجودہ کام مکمل کریں۔",
              )
            : t(
                "Records only. Clinical actions are unavailable.",
                "صرف ریکارڈ۔ طبی عمل دستیاب نہیں۔",
              )}
        </p>
      )}
      <div className="actions">
        <Field label={t("Rounds", "معائنہ فہرست")}>
          <select
            data-help="inpatients.read"
            value={round}
            disabled={locked}
            onChange={(e) => setRound(e.target.value as "mine" | "waiting")}
          >
            <option value="mine">{t("My patients", "میرے مریض")}</option>
            <option value="waiting">
              {t("Waiting for a doctor", "ڈاکٹر کے منتظر")}
            </option>
          </select>
        </Field>
        <button data-help="inpatients.read" disabled={locked} onClick={refresh}>
          {t("Refresh inpatient records", "داخلہ ریکارڈ تازہ")}
        </button>
        <Field
          label={t(
            "Find inpatient by name, MRN or doctor",
            "نام، ایم آر این یا معالج سے تلاش",
          )}
        >
          <input
            data-help="inpatients.read"
            disabled={locked}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Field label={t("Admission status filter", "داخلے کی حالت فلٹر")}>
          <select
            data-help="inpatients.read"
            value={status}
            disabled={locked||round==='waiting'}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">
              {t("All live admissions", "تمام جاری داخلے")}
            </option>
            {[
              "AdmissionPending",
              "Waitlisted",
              "BedReserved",
              "CodeRedActive",
              "Admitted",
              "DischargeInProgress",
              "Discharged",
              "Cancelled",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorBox error={error} />
      {/* Rebind field guidance after the frozen review closes. */}
      <ClinicalWriteFeedback
        key={review ? "review-feedback" : "editor-feedback"}
        write={write}
        onReviewed={() => {
          setReview(undefined);
          setStale(true);
          setRevision((n) => n + 1);
        }}
      />
      {notice && <p role="status">{notice}</p>}
      <div className="split">
        <aside className="card">
          <LoadState {...activeRows} retry={activeRows.reload} />
          {!activeRows.loading &&
            !activeRows.error &&
            scoped.filter((r) =>
              [
                r.patient_name,
                r.mrn,
                r.admission_number,
                r.primary_doctor_name,
                r.ward_name,
              ]
                .join(" ")
                .toLowerCase()
                .includes(query.toLowerCase()),
            ).length === 0 && (
              <p>
                {t(
                  "No admissions match this filter. Check the status or search.",
                  "اس فلٹر پر کوئی داخلہ نہیں۔ حالت یا تلاش دیکھیں۔",
                )}
              </p>
            )}
          {!activeRows.loading &&
            !activeRows.error &&
            scoped
              .filter((r) =>
                [
                  r.patient_name,
                  r.mrn,
                  r.admission_number,
                  r.primary_doctor_name,
                  r.ward_name,
                ]
                  .join(" ")
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((r) => (
                <button
                  data-help="inpatients.read"
                  className="list-row"
                  key={r.admission_id}
                  disabled={locked}
                  onClick={() => choose(r.admission_id)}
                >
                  <strong>
                    {r.patient_name} · <bdi>{r.mrn}</bdi>
                  </strong>
                  <span>
                    {r.admission_number} · {r.status} · {r.ward_name}{" "}
                    {r.bed_label} ·{" "}
                    {r.primary_doctor_id === null
                      ? t("Doctor: waiting", "ڈاکٹر: منتظر")
                      : r.primary_doctor_name}{" "}
                    {due[r.admission_id] !== undefined && (
                      <b>
                        {due[r.admission_id] > 0
                          ? t("Vitals overdue", "پیمائش میں تاخیر")
                          : t("Vitals due", "پیمائش واجب")}{" "}
                        · {due[r.admission_id]} {t("minutes", "منٹ")}
                      </b>
                    )}
                  </span>
                </button>
              ))}
          <Field label={t("Known admission reference", "معلوم داخلہ حوالہ")}>
            <input
              data-help="inpatients.read"
              disabled={locked}
              inputMode="numeric"
              value={known}
              onChange={(e) => setKnown(e.target.value)}
            />
          </Field>
          <button
            data-help="inpatients.read"
            disabled={
              locked ||
              !/^\d+$/.test(known) ||
              !Number.isSafeInteger(Number(known)) ||
              Number(known) < 1
            }
            onClick={() => choose(Number(known))}
          >
            {t("Read this admission", "یہ داخلہ پڑھیں")}
          </button>
        </aside>
        <article className="card">
          <LoadState {...row} retry={row.reload} />
          <LoadState {...profile} retry={profile.reload} />
          {record && !row.loading && !row.error && (
            <>
              <header>
                <h2>
                  {record.patient_name} · <bdi>{record.mrn}</bdi>
                </h2>
                <p>
                  {record.admission_number} · {record.status} ·{" "}
                  {record.age_years ?? t("Age not recorded", "عمر درج نہیں")} ·{" "}
                  {tr(record.gender || "unknown")}
                </p>
                <p>
                  {record.ward_name} · {record.bed_label} ·{" "}
                  {record.primary_doctor_id === null
                    ? t("Doctor: waiting", "ڈاکٹر: منتظر")
                    : record.primary_doctor_name}
                </p>
                {record.photo_document_id ? (
                  photo && (
                    <img
                      src={photo}
                      alt={t("Patient photo", "مریض کی تصویر")}
                      style={{ maxWidth: 130, maxHeight: 150 }}
                    />
                  )
                ) : (
                  <p>
                    {t(
                      "No patient photo. A photo is optional.",
                      "مریض کی تصویر نہیں۔ تصویر اختیاری ہے۔",
                    )}
                  </p>
                )}
                {person && (
                  <>
                    <p>
                      {t(
                        "Date of birth / blood group",
                        "تاریخ پیدائش / خون کا گروپ",
                      )}
                      : {person.dob || t("Not recorded", "درج نہیں")} ·{" "}
                      {person.blood_group || t("Not recorded", "درج نہیں")}
                    </p>
                    <p>
                      {t("Allergies", "الرجی")}:{" "}
                      {person.allergies || t("Not recorded", "درج نہیں")}
                    </p>
                    {person.mlc_numbers.length > 0 && (
                      <p>MEDICO-LEGAL: {person.mlc_numbers.join(", ")}</p>
                    )}
                    {person.temp_identifier && (
                      <p>
                        {t("Temporary identity", "عارضی شناخت")}:{" "}
                        {person.temp_identifier}
                      </p>
                    )}
                    {!identity && (
                      <p className="error">
                        {t(
                          "Identity changed or is being read. Read the current admission before an action.",
                          "شناخت بدلی یا پڑھی جا رہی ہے۔ عمل سے پہلے تازہ داخلہ پڑھیں۔",
                        )}
                      </p>
                    )}
                    {person.is_deceased && (
                      <p className="error">
                        {t(
                          "Deceased patient. No new orders; subsequent clinical entries need review.",
                          "وفات یافتہ مریض۔ نئے احکامات نہیں؛ بعد کے طبی اندراج کا جائزہ لازم۔",
                        )}
                      </p>
                    )}
                    <details>
                      <summary data-help="inpatients.context">
                        {t(
                          "Outstanding dues and linked identity",
                          "بقایا و متعلقہ شناخت",
                        )}
                      </summary>
                      <Details value={person.outstanding} />
                      {person.merged_profiles.map((p) => (
                        <p key={p.patient_id}>{p.mrn}</p>
                      ))}
                    </details>
                  </>
                )}
                <h3>
                  {t(
                    "Reason for admission and provisional diagnosis",
                    "داخلے کی وجہ و ابتدائی تشخیص",
                  )}
                </h3>
                {record.admission_reason === null ? (
                  <p className="error">
                    {t("Record reason and diagnosis", "وجہ و تشخیص درج کریں")}
                  </p>
                ) : (
                  <>
                    <p>{record.admission_reason}</p>
                    <p>{record.provisional_diagnosis}</p>
                    <p>{record.initial_care_plan}</p>
                    <p>
                      {record.details_stamp?.text ||
                        t("Author stamp not recorded", "مصنف مہر درج نہیں")}
                    </p>
                  </>
                )}
              </header>
              <div className="actions">
                {inpatientActionAllowed(
                  "details",
                  record,
                  view,
                  user.permissions,
                ) && (
                  <button
                    data-help="inpatients.details"
                    disabled={locked || !live || !identity}
                    onClick={() => begin("details")}
                  >
                    {t("Record reason and diagnosis", "وجہ و تشخیص درج کریں")}
                  </button>
                )}
                {inpatientActionAllowed(
                  "discharge",
                  record,
                  view,
                  user.permissions,
                ) && (
                  <button
                    data-help="inpatients.discharge"
                    disabled={locked || !live || !identity}
                    onClick={() => begin("discharge")}
                  >
                    {t("Initiate clinical discharge", "طبی ڈسچارج شروع کریں")}
                  </button>
                )}
                {availableScreens.includes("explain_estimate") && (
                  <button
                    data-help="inpatients.handover"
                    disabled={locked || !identity}
                    onClick={() => route("explain_estimate")}
                  >
                    {t(
                      "Explain this admission estimate",
                      "اس داخلے کا تخمینہ سمجھائیں",
                    )}
                  </button>
                )}
              </div>
              {person?.is_deceased && (
                <p>
                  {availableScreens.includes("death_record") ? (
                    <button
                      data-help="inpatients.handover"
                      disabled={locked}
                      onClick={() => route("death_record")}
                    >
                      {t("Record death", "وفات درج کریں")}
                    </button>
                  ) : (
                    t(
                      "Record death: hand over to the authorised doctor. That screen is not delivered in this build yet.",
                      "وفات درج کرنا مجاز ڈاکٹر کو دیں۔ اس نسخے میں وہ سکرین ابھی نہیں بنی۔",
                    )
                  )}
                </p>
              )}
              <TreatingDoctor
                key={record.admission_id}
                record={record}
                user={user}
                view={view}
                live={live}
                locked={write.blocked || fileBusy || !!editor}
                revision={revision}
                onChanged={refresh}
                onBusy={setHandoverBusy}
              />
              <h3>{t("Discharge clearance progress", "ڈسچارج کلیئرنس")}</h3>
              <LoadState {...stages} retry={stages.reload} />
              {!stages.loading && !stages.error && stages.data && (
                <>
                  <p>
                    {stages.data.started
                      ? t(
                          "Discharge started; the bed stays locked until all clearances finish.",
                          "ڈسچارج شروع؛ تمام کلیئرنس تک بستر مقفل ہے۔",
                        )
                      : t(
                          "Discharge has not started.",
                          "ڈسچارج شروع نہیں ہوا۔",
                        )}{" "}
                    · {t("Blocked on", "منتظر مرحلہ")}:{" "}
                    {stages.data.blocked_on || t("None", "کوئی نہیں")}
                  </p>
                  {stages.data.stages.map((s) => (
                    <p key={s.clearance_id}>
                      {s.sequence_no}. {s.stage}: {s.status} ·{" "}
                      {s.cleared_by_name || ""} · {stamp(s.cleared_at)} ·{" "}
                      {s.note}
                    </p>
                  ))}
                </>
              )}
              {errorCode === "DISCHARGE_SUMMARY_REQUIRED" && (
                <p className="notice">
                  {availableScreens.includes("discharge_summary") ? (
                    <button
                      data-help="inpatients.handover"
                      disabled={locked}
                      onClick={() => route("discharge_summary")}
                    >
                      {t("Open discharge summary", "ڈسچارج خلاصہ کھولیں")}
                    </button>
                  ) : (
                    t(
                      "A signed discharge summary is required. Ask the authorised doctor to complete it; the summary editor is not delivered yet. Your note is kept.",
                      "دستخط شدہ خلاصہ لازم۔ مجاز ڈاکٹر سے مکمل کرائیں؛ خلاصہ ایڈیٹر ابھی نہیں بنا۔ نوٹ محفوظ ہے۔",
                    )
                  )}
                </p>
              )}
              {errorCode === "CONSENT_REQUIRED" && (
                <p className="notice">
                  {availableScreens.includes("consents_doctor") ? (
                    <button
                      data-help="inpatients.handover"
                      disabled={locked}
                      onClick={() => route("consents_doctor")}
                    >
                      {t("Open admission consent", "داخلے کی رضامندی کھولیں")}
                    </button>
                  ) : (
                    t(
                      "The admission needs its general consent decision. Hand over to Admissions for the real consent; your note is kept.",
                      "داخلے کی عمومی رضامندی کا فیصلہ لازم۔ اصل رضامندی کے لیے داخلہ ڈیسک کو دیں؛ نوٹ محفوظ ہے۔",
                    )
                  )}
                </p>
              )}
              <h3>
                {t(
                  "Vitals and nursing observations",
                  "حیاتیاتی پیمائش و نرسنگ مشاہدات",
                )}
              </h3>
              {can("ipd.flowsheet.view") ? (
                <>
                  <LoadState {...flow} retry={flow.reload} />
                  {!flow.loading && !flow.error && flow.data && (
                    <>
                      <p>
                        {t("Next vitals due", "اگلی پیمائش")}:{" "}
                        {stamp(flow.data.next_vitals_due_at)} ·{" "}
                        {flow.data.is_overdue
                          ? t("Overdue", "تاخیر")
                          : t("Not overdue", "تاخیر نہیں")}
                      </p>
                      {flow.data.vitals.length === 0 && (
                        <p>{t("No vitals recorded.", "پیمائش درج نہیں۔")}</p>
                      )}
                      <div style={{ overflowX: "auto" }}>
                        <table>
                          <thead>
                            <tr>
                              {[
                                ["Observed", "مشاہدے کا وقت"],
                                ["BP", "بلڈ پریشر"],
                                ["Pulse", "نبض"],
                                ["Temperature °C", "درجہ حرارت °C"],
                                ["SpO₂", "آکسیجن فیصد"],
                                ["Respiration", "سانس"],
                                ["Pain", "درد"],
                                ["Glucose", "گلوکوز"],
                                ["Notes / correction", "نوٹ / تصحیح"],
                                ["Recorded by", "درج کرنے والا"],
                              ].map(([en, ur]) => (
                                <th key={en}>{t(en, ur)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {flow.data.vitals.map((v) => (
                              <tr key={v.entry_id}>
                                <td>{stamp(v.observed_at)}</td>
                                <td>
                                  {v.bp_systolic ?? "—"}/{v.bp_diastolic ?? "—"}
                                </td>
                                <td>{v.heart_rate ?? "—"}</td>
                                <td>{v.temp_c ?? "—"}</td>
                                <td>{v.spo2 ?? "—"}</td>
                                <td>{v.respiratory_rate ?? "—"}</td>
                                <td>{v.pain_score ?? "—"}</td>
                                <td>{v.blood_glucose ?? "—"}</td>
                                <td>
                                  {v.notes}{" "}
                                  {v.is_correction
                                    ? `${t("Correction", "تصحیح")} #${v.corrects_entry_id}: ${v.correction_reason}`
                                    : ""}
                                </td>
                                <td>
                                  {v.recorded_by_name} · {stamp(v.recorded_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {flow.data.nursing_notes.length === 0 && (
                        <p>
                          {t(
                            "No nursing notes recorded.",
                            "نرسنگ نوٹ درج نہیں۔",
                          )}
                        </p>
                      )}
                      {flow.data.nursing_notes.map((n) => (
                        <section key={n.note_id}>
                          <p>
                            {stamp(n.observed_at)} · {n.note_text}
                          </p>
                          {n.is_correction && (
                            <p>
                              {t("Correction", "تصحیح")} #{n.corrects_note_id}:{" "}
                              {n.correction_reason}
                            </p>
                          )}
                          <p>{n.author_stamp.text}</p>
                        </section>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <p>
                  {t(
                    "Flowsheet permission required.",
                    "مشاہدات دیکھنے کی اجازت لازم۔",
                  )}
                </p>
              )}
              <h3>
                {t(
                  "Medication administration record — read only",
                  "دوا دینے کا ریکارڈ — صرف مطالعہ",
                )}
              </h3>
              {can("ipd.mar.view") ? (
                <>
                  <LoadState {...mar} retry={mar.reload} />
                  {!mar.loading && !mar.error && mar.data?.length === 0 && (
                    <p>
                      {t(
                        "No scheduled or recorded doses.",
                        "کوئی مقرر یا درج خوراک نہیں۔",
                      )}
                    </p>
                  )}
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          {[
                            [
                              "Medicine / prescribed dose",
                              "دوا / تجویز کردہ خوراک",
                            ],
                            ["Due", "مقرر وقت"],
                            ["Status", "حالت"],
                            ["Given / by", "دی گئی / دینے والا"],
                            ["Checks / correction", "جانچ / تصحیح"],
                          ].map(([en, ur]) => (
                            <th key={en}>{t(en, ur)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {!mar.loading &&
                          !mar.error &&
                          mar.data?.map((m) => (
                            <tr key={m.mar_id}>
                              <td>
                                {m.drug_name} · {m.dose_text} · {m.route} ·{" "}
                                {m.frequency_code} {m.is_prn ? "PRN" : ""}{" "}
                                {m.is_stat ? "STAT" : ""}
                              </td>
                              <td>
                                {stamp(m.scheduled_at)}{" "}
                                {m.is_overdue ? t("Overdue", "تاخیر") : ""}
                              </td>
                              <td>
                                {m.status} {m.status_reason}
                              </td>
                              <td>
                                {m.dose_given_text} {m.route_given} ·{" "}
                                {stamp(m.administered_at)} ·{" "}
                                {m.administered_by_name}
                              </td>
                              <td>
                                {m.high_alert_category}{" "}
                                {m.lasa_with?.join(", ")} · {m.identity_check} ·{" "}
                                {m.second_checked_by_name} ·{" "}
                                {m.self_administered
                                  ? t("Self-administered", "خود لی")
                                  : ""}{" "}
                                · {m.variance_reason}{" "}
                                {m.is_correction
                                  ? `${t("Correction", "تصحیح")} #${m.corrects_mar_id}: ${m.correction_reason}`
                                  : ""}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p>
                  {t(
                    "MAR viewing permission required.",
                    "دوا ریکارڈ دیکھنے کی اجازت لازم۔",
                  )}
                </p>
              )}
              <h3>
                {t(
                  "Reports brought by the patient",
                  "مریض کے لائے ہوئے رپورٹس",
                )}
              </h3>
              {can("patient.document.view") ? (
                <>
                  <LoadState {...docs} retry={docs.reload} />
                  {!docs.loading &&
                    !docs.error &&
                    !docs.data?.some((d) => d.is_outside) && (
                      <p>
                        {t(
                          "No outside documents recorded.",
                          "باہر کی دستاویز درج نہیں۔",
                        )}
                      </p>
                    )}
                  {!docs.loading &&
                    !docs.error &&
                    docs.data
                      ?.filter((d) => d.is_outside)
                      .map((d) => (
                        <p key={d.document_id}>
                          <button
                            data-help="inpatients.documents"
                            disabled={locked}
                            onClick={() => void openDocument(d)}
                          >
                            {d.title || d.doc_type}
                          </button>{" "}
                          · {t("Outside", "باہر کی")}:{" "}
                          {d.source_facility || t("Not recorded", "درج نہیں")} ·{" "}
                          {d.document_date ||
                            t("Date not recorded", "تاریخ درج نہیں")}
                        </p>
                      ))}
                  <details>
                    <summary data-help="inpatients.documents">
                      {t(
                        "Hospital documents — separate from outside reports",
                        "ہسپتال کی دستاویز — باہر کی رپورٹس سے الگ",
                      )}
                    </summary>
                    {docs.data
                      ?.filter((d) => !d.is_outside && d.doc_type !== "Photo")
                      .map((d) => (
                        <p key={d.document_id}>
                          <button
                            data-help="inpatients.documents"
                            disabled={locked}
                            onClick={() => void openDocument(d)}
                          >
                            {d.title || d.doc_type}
                          </button>{" "}
                          · {t("Hospital document", "ہسپتال کی دستاویز")}
                        </p>
                      ))}
                  </details>
                </>
              ) : (
                <p>
                  {t(
                    "Document viewing permission required.",
                    "دستاویز دیکھنے کی اجازت لازم۔",
                  )}
                </p>
              )}
            </>
          )}
        </article>
      </div>
      {editor && (
        <section className="card" data-unsaved="true">
          <h2>
            {editor.action === "details"
              ? t("Record reason and diagnosis", "وجہ و تشخیص درج کریں")
              : t("Initiate clinical discharge", "طبی ڈسچارج شروع کریں")}
          </h2>
          <p>
            {editor.source.patient_name} · <bdi>{editor.source.mrn}</bdi> ·{" "}
            {editor.source.admission_number}
          </p>
          <p>
            {t("Current admission state", "داخلے کی موجودہ حالت")}:{" "}
            {record?.status}
          </p>
          {stale && (
            <p className="notice">
              {t(
                "Data changed. Read latest and keep input before another review.",
                "معلومات بدلیں۔ نئے جائزے سے پہلے تازہ پڑھیں و معلومات رکھیں۔",
              )}
            </p>
          )}
          {person?.is_deceased && (
            <p className="error">
              {t(
                "An entry after death is flagged for clinical review.",
                "وفات کے بعد اندراج طبی جائزے کے لیے نشان زد ہوتا ہے۔",
              )}
            </p>
          )}
          <fieldset disabled={locked}>
            {editor.action === "details" ? (
              <>
                {[
                  [
                    "admission_reason",
                    "Admission reason",
                    "داخلے کی وجہ",
                    4000,
                  ],
                  [
                    "provisional_diagnosis",
                    "Provisional diagnosis",
                    "ابتدائی تشخیص",
                    1000,
                  ],
                  [
                    "initial_care_plan",
                    "Initial care plan",
                    "ابتدائی نگہداشت کا منصوبہ",
                    4000,
                  ],
                ].map(([key, en, ur, max]) => (
                  <Field key={key} label={t(String(en), String(ur))}>
                    <textarea
                      data-help="inpatients.details"
                      data-field={key}
                      maxLength={Number(max)}
                      value={
                        editor.details[key as keyof a.AdmissionDetailsIn] || ""
                      }
                      onChange={(ev) =>
                        mutate({
                          details: {
                            ...editor.details,
                            [key]: ev.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </>
            ) : (
              <>
                <p>
                  {t(
                    "This begins Clinical Discharge only. It never frees the bed; Pharmacy, Nursing MAR, Billing and Operations must complete their stages. Signed summary and general consent decision must exist.",
                    "صرف طبی ڈسچارج شروع ہوگا۔ بستر خالی نہیں ہوتا؛ فارمیسی، نرسنگ، بلنگ و صفائی کے مراحل لازم۔ دستخط شدہ خلاصہ اور رضامندی فیصلہ موجود ہو۔",
                  )}
                </p>
                <Field label={t("Clinical discharge note", "طبی ڈسچارج نوٹ")}>
                  <textarea
                    data-help="inpatients.discharge"
                    data-field="note"
                    maxLength={1000}
                    value={editor.note}
                    onChange={(ev) => mutate({ note: ev.target.value })}
                  />
                </Field>
              </>
            )}
            <label>
              <input
                data-help="inpatients.review"
                type="checkbox"
                checked={editor.ack}
                onChange={(ev) => mutate({ ack: ev.target.checked })}
              />
              {t(
                "I checked this patient, admission and clinical action",
                "میں نے مریض، داخلہ و طبی عمل چیک کیا",
              )}
            </label>
            <div className="actions">
              <button
                data-help="inpatients.review"
                disabled={
                  !live ||
                  stale ||
                  !record ||
                  !inpatientActionAllowed(
                    editor.action,
                    record,
                    view,
                    user.permissions,
                  )
                }
                onClick={() => void reviewDraft()}
              >
                {t("Review inpatient action", "داخلے کے عمل کا جائزہ")}
              </button>
              <button
                data-help="inpatients.recovery"
                onClick={async () => {
                  try {
                    const fresh = await a.getAdmission(
                      editor.source.admission_id,
                    );
                    mutate({ source: fresh, ack: false });
                    setRevision((n) => n + 1);
                    setStale(false);
                    setReview(undefined);
                    setError(undefined);
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                {t("Read latest and keep input", "تازہ پڑھیں و معلومات رکھیں")}
              </button>
              <button
                data-help="inpatients.review"
                onClick={() => {
                  if (leave()) {
                    setEditor(undefined);
                    setReview(undefined);
                  }
                }}
              >
                {t("Close inpatient draft", "داخلہ مسودہ بند کریں")}
              </button>
            </div>
          </fieldset>
        </section>
      )}
      {review && editor && (
        <Modal
          title={t("Review inpatient action", "داخلے کے عمل کا جائزہ")}
          onClose={() => !locked && setReview(undefined)}
        >
          <p>
            {editor.source.patient_name} · <bdi>{editor.source.mrn}</bdi> ·{" "}
            {editor.source.admission_number} · {editor.action}
          </p>
          <Details value={review} />
          <button
            data-help="inpatients.confirm"
            disabled={locked || !live || stale}
            onClick={confirm}
          >
            {t("Confirm this inpatient action", "اس داخلہ عمل کی تصدیق")}
          </button>
          <button
            data-help="inpatients.review"
            disabled={locked}
            onClick={() => setReview(undefined)}
          >
            {t("Back to inpatient input", "داخلے کی معلومات پر واپس")}
          </button>
        </Modal>
      )}
      {image && (
        <Modal title={image.label} onClose={() => setImage(undefined)}>
          <img src={image.src} alt={image.label} style={{ maxWidth: "100%" }} />
        </Modal>
      )}
    </section>
  );
}
