import { useState } from "react";
import { api, ApiError, call } from "../bridge";
import { bilingual as t, tr } from "../i18n";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import {
  ClinicalVisit,
  type ClinicalUser,
  type VisitContext,
} from "../clinical-context";
import {
  ClinicalWriteFeedback,
  useClinicalWrite,
  type ClinicalCommand,
} from "../clinical-write";
import { ICDPicker } from "./ICDPicker";
import { StaffPicker } from "../StaffPicker";
import { hasUnsavedChanges } from "../unsaved";
import { hospitalTimeInput, hospitalTimeToUtc } from "../hospital-time";
import * as emr from "../generated/consultation";
import { listConsents } from "../generated/clinical_consents";
type Props = {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  readOnly: boolean;
  connected: boolean;
  active: string[];
  timeZone?: string;
  availableScreens: string[];
  onRoute: (screen: string, ticket: number) => void;
};
const fields = [
  ["chief_complaint", "Chief complaint", "بنیادی شکایت", 2000],
  ["history", "History", "سابقہ معلومات", 10000],
  ["examination", "Examination findings", "معائنے کے نتائج", 10000],
  ["diagnosis", "Diagnosis", "تشخیص", 4000],
  ["clinical_note", "Clinical note", "طبی نوٹ", 20000],
  ["plan", "Plan / treatment / referral", "منصوبہ / علاج / حوالہ", 10000],
] as const;
const procedureFields = [
  ["procedure_name", "Procedure name", "طریقہ کار کا نام", 300],
  ["site", "Site and side", "جگہ اور سمت", 300],
  ["indication", "Indication", "وجہ", 2000],
  ["technique", "Technique / devices / sizes", "طریقہ / آلات / سائز", 4000],
  ["findings", "Procedure findings", "طریقہ کار کے نتائج", 4000],
  [
    "specimens",
    "Specimens (enter None if nothing removed)",
    "نمونے (کچھ نہ نکالا ہو تو None لکھیں)",
    1000,
  ],
  ["complications", "Complications", "پیچیدگیاں", 2000],
  ["condition_at_end", "Condition at end", "اختتام پر حالت", 1000],
] as const;
const empty = () => ({
  chief_complaint: "",
  history: "",
  examination: "",
  diagnosis: "",
  clinical_note: "",
  plan: "",
});
export function Consultation(props: Props) {
  return (
    <section>
      <h1>{t("Consultation (EMR)", "معائنہ (طبی ریکارڈ)")}</h1>
      <ClinicalVisit
        user={props.user}
        revision={props.revision}
        initialTicket={props.initialTicket}
      >
        {(ctx) => <ConsultationEditor {...props} ctx={ctx} />}
      </ClinicalVisit>
    </section>
  );
}
function ConsultationEditor({
  ctx,
  user,
  revision,
  readOnly,
  connected,
  active,
  timeZone,
  availableScreens,
  onRoute,
}: Props & { ctx: VisitContext }) {
  const can = (permission: string) => user.permissions.includes(permission),
    scope = `${ctx.ticket.ticket_id}:${ctx.patient.patient_id}`;
  const notes = useLoad(
    () =>
      can("clinical.encounter.view")
        ? emr.forTicket(ctx.ticket.ticket_id)
        : Promise.resolve([]),
    [ctx.ticket.ticket_id, revision],
  );
  const history = useLoad(
    () =>
      can("clinical.encounter.view")
        ? emr.forPatientPatientsClinicalEncounters(ctx.patient.patient_id)
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision],
  );
  const summary = useLoad(
    () =>
      can("patient.emr.view")
        ? emr.masterSummary(ctx.patient.patient_id)
        : Promise.resolve(undefined),
    [ctx.patient.patient_id, revision],
  );
  const docs = useLoad(
    () =>
      can("patient.document.view")
        ? emr.listDocumentsPatients(ctx.patient.patient_id)
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision],
  );
  const consents = useLoad(
    () =>
      can("consent.view")
        ? listConsents({
            patient_id: ctx.patient.patient_id,
            status: "Given",
            limit: 200,
          })
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision],
  );
  const [base, setBase] = useState<emr.EncounterDetailOut>(),
    [form, setForm] = useState(empty),
    [consent, setConsent] =
      useState<emr.EncounterIn["examination_consent"]>(null),
    [kind, setKind] =
      useState<NonNullable<emr.EncounterIn["encounter_type"]>>("OPD"),
    [admission, setAdmission] = useState<number>(),
    [codes, setCodes] = useState<emr.IcdTermOut[]>([]),
    [procedure, setProcedure] = useState<Partial<emr.ProcedureIn>>({}),
    [procedureDirty, setProcedureDirty] = useState(false),
    [vitals, setVitals] = useState<Record<string, unknown>>({}),
    [dirty, setDirty] = useState(false);
  const [showIcd, setShowIcd] = useState(false),
    [loadingNote, setLoadingNote] = useState(false),
    [readError, setReadError] = useState<unknown>(),
    [printError, setPrintError] = useState<unknown>(),
    [printNotice, setPrintNotice] = useState(""),
    [printing, setPrinting] = useState(false),
    [image, setImage] = useState<string>();
  const [admissionResult, setAdmissionResult] = useState<emr.AdmissionDetailOut>(),
    [waiverResult, setWaiverResult] = useState<emr.WaiverRequestOut>();
  const [action, setAction] = useState<
      "correction" | "admit" | "waiver" | "complete"
    >(),
    [reason, setReason] = useState(""),
    [correctionText, setCorrectionText] = useState(""),
    [correctionField, setCorrectionField] =
      useState<NonNullable<emr.EncounterCorrectionIn["field"]>>("general"),
    [admitDiagnosis, setAdmitDiagnosis] = useState(""),
    [carePlan, setCarePlan] = useState(""),
    [admitNotes, setAdmitNotes] = useState(""),
    [admissionType, setAdmissionType] =
      useState<NonNullable<emr.AdmissionIn["admission_type"]>>("Standard"),
    [interval, setInterval] = useState(""),
    [actionDirty, setActionDirty] = useState(false);
  function accept(value: emr.EncounterDetailOut) {
    setBase(value);
    setKind(value.encounter_type);
    setAdmission(value.admission_id || undefined);
    setForm({
      chief_complaint: value.chief_complaint || "",
      history: value.history || "",
      examination: value.examination || "",
      diagnosis: value.diagnosis || "",
      clinical_note: value.clinical_note || "",
      plan: value.plan || "",
    });
    setConsent(value.examination_consent);
    setCodes(value.icd_terms);
    setProcedure(value.procedure ? { ...value.procedure } : {});
    setVitals(value.vitals_jsonb || {});
    setProcedureDirty(false);
    setDirty(false);
  }
  const write = useClinicalWrite(user, scope, async (value, command) => {
    if (command.path === "/admissions")
      setAdmissionResult(value as emr.AdmissionDetailOut);
    if (command.path.endsWith("/vip-waiver-post-consult"))
      setWaiverResult(value as emr.WaiverRequestOut);
    if (command.path.startsWith("/clinical-encounters"))
      accept(value as emr.EncounterDetailOut);
    setAction(undefined);
    setActionDirty(false);
    setReason("");
    setCorrectionText("");
    await Promise.all([
      notes.reload(),
      history.reload(),
      summary.reload(),
      ctx.reload(),
    ]);
  });
  const locked =
    readOnly ||
    !connected ||
    !ctx.ready ||
    ctx.ticket.is_clinical_locked ||
    ctx.ticket.approval_lock !== "None" ||
    write.blocked ||
    loadingNote;
  const sameVisit =
    !base ||
    base.ticket_id === ctx.ticket.ticket_id ||
    (!!base.admission_id && base.admission_id === admission);
  const editable =
    sameVisit &&
    !locked &&
    can("clinical.encounter.create") &&
    (!base || (base.status === "Draft" && base.doctor_id === user.employee_id));
  const procedureGate =
    kind !== "Procedure" ||
    !!admission ||
    active.includes("outpatient_procedures") ||
    (!!base && !procedureDirty);
  const rawError =
    write.error instanceof ApiError ? write.error.response.error : undefined;
  const missing = Array.isArray(rawError?.details?.missing)
    ? (rawError!.details!.missing as string[])
    : [];
  async function inspectNote(id: number) {
    if (write.blocked) return;
    if (
      dirty &&
      !window.confirm(
        t(
          "Discard edits and load this note?",
          "تبدیلیاں چھوڑ کر یہ نوٹ کھولیں؟",
        ),
      )
    )
      return;
    setLoadingNote(true);
    setReadError(undefined);
    try {
      accept(await emr.getClinicalEncounters(id));
    } catch (e) {
      setReadError(e);
    } finally {
      setLoadingNote(false);
    }
  }
  function newNote() {
    if (write.blocked) return;
    if (
      dirty &&
      !window.confirm(
        t(
          "Discard the unsaved clinical draft?",
          "غیر محفوظ طبی مسودہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    setBase(undefined);
    setForm(empty());
    setConsent(null);
    setKind("OPD");
    setCodes([]);
    setProcedure({});
    setProcedureDirty(false);
    setVitals({});
    setAdmission(undefined);
    setDirty(false);
    setReadError(undefined);
  }
  async function preflight() {
    const fresh = await api<emr.OpdTicketDetailOut>(
      "GET",
      `/opd-tickets/${ctx.ticket.ticket_id}`,
    );
    if (
      fresh.patient_id !== ctx.ticket.patient_id ||
      fresh.is_clinical_locked ||
      fresh.approval_lock !== "None"
    )
      throw new Error(
        fresh.clinical_lock_reason ||
          t(
            "The visit identity or approval state changed. Refresh and reconcile your draft.",
            "پرچی کی شناخت یا منظوری بدل گئی۔ تازہ کرکے مسودہ چیک کریں۔",
          ),
      );
    const patient = await api<{ patient_id: number }>(
      "GET",
      `/patients/${ctx.patient.patient_id}`,
    );
    if (patient.patient_id !== ctx.patient.patient_id)
      throw new Error(
        t(
          "Patient identity changed; reconcile the draft.",
          "مریض کی شناخت بدل گئی؛ مسودہ چیک کریں۔",
        ),
      );
    if (base) {
      const current = await emr.getClinicalEncounters(base.encounter_id);
      if (
        current.row_version !== base.row_version ||
        current.status !== base.status
      )
        throw new Error(
          t(
            "This note changed on another terminal. Reload and compare before saving; your draft was retained.",
            "یہ نوٹ دوسرے ٹرمینل پر بدلا۔ محفوظ کرنے سے پہلے تازہ نوٹ سے موازنہ کریں؛ مسودہ برقرار ہے۔",
          ),
        );
    }
  }
  function noteBody(): emr.EncounterIn {
    if ((kind === "IPD" || kind === "CodeRed") && !admission)
      throw new Error(
        t(
          "Choose an actual admission for this note type.",
          "اس نوٹ کی قسم کے لیے اصل داخلہ چنیں۔",
        ),
      );
    if (!procedureGate)
      throw new Error(
        t(
          "Outpatient procedures are not active; this procedure cannot start.",
          "بیرونی مریضوں کے طریقہ کار فعال نہیں؛ یہ نیا عمل شروع نہیں ہو سکتا۔",
        ),
      );
    const p: emr.ProcedureIn | undefined =
      kind === "Procedure"
        ? {
            procedure_name: procedure.procedure_name || "",
            site: procedure.site || null,
            indication: procedure.indication || null,
            anaesthesia: procedure.anaesthesia || "None",
            consent_id: procedure.consent_id || null,
            assistant_employee_id: procedure.assistant_employee_id || null,
            started_at: procedure.started_at || null,
            ended_at: procedure.ended_at || null,
            technique: procedure.technique || null,
            findings: procedure.findings || null,
            specimens: procedure.specimens || null,
            complications: procedure.complications || null,
            condition_at_end: procedure.condition_at_end || null,
          }
        : undefined;
    if (p && p.procedure_name.trim().length < 2)
      throw new Error(
        t("Enter the procedure name.", "طریقہ کار کا نام لکھیں۔"),
      );
    return {
      patient_id: ctx.patient.patient_id,
      ...(admission
        ? { admission_id: admission }
        : { ticket_id: ctx.ticket.ticket_id }),
      encounter_type: kind,
      ...form,
      examination: consent === "VerbalObtained" ? form.examination : null,
      examination_consent: consent,
      icd_codes: codes.map((c) => c.code),
      vitals,
      ...(p ? { procedure: p } : {}),
    };
  }
  function save(finalize = false) {
    if (!editable || !procedureGate) return;
    try {
      const body = noteBody();
      if (base) {
        const patch: emr.EncounterPatch = {
          expected_version: base.row_version,
          chief_complaint: body.chief_complaint,
          history: body.history,
          examination: body.examination,
          diagnosis: body.diagnosis,
          clinical_note: body.clinical_note,
          plan: body.plan,
          icd_codes: body.icd_codes,
          examination_consent: body.examination_consent,
          vitals: body.vitals,
          ...(body.procedure && procedureDirty
            ? { procedure: body.procedure }
            : {}),
        };
        write.start(
          {
            method: "PATCH",
            path: `/clinical-encounters/${base.encounter_id}`,
            body: patch,
            permission: "clinical.encounter.create",
            protection: "reconcile",
            reconcilePath: `/clinical-encounters/${base.encounter_id}`,
            label: t("Save draft changes", "مسودے کی تبدیلیاں محفوظ کریں"),
          },
          preflight,
        );
      } else
        write.start(
          {
            method: "POST",
            path: "/clinical-encounters",
            body: { ...body, finalize },
            permission: "clinical.encounter.create",
            protection: "idempotent",
            reconcilePath: `/opd-tickets/${ctx.ticket.ticket_id}/clinical-encounters`,
            label: t("Create clinical note", "طبی نوٹ بنائیں"),
          },
          preflight,
        );
    } catch (e) {
      setReadError(e);
    }
  }
  function finalize() {
    if (
      !base ||
      dirty ||
      locked ||
      base.status !== "Draft" ||
      !can("clinical.encounter.create")
    )
      return;
    write.start(
      {
        method: "POST",
        path: `/clinical-encounters/${base.encounter_id}/finalize`,
        permission: "clinical.encounter.create",
        protection: "reconcile",
        reconcilePath: `/clinical-encounters/${base.encounter_id}`,
        label: t("Finalize saved note", "محفوظ نوٹ حتمی کریں"),
      },
      preflight,
    );
  }
  function startAction(next: typeof action) {
    if (write.blocked) return;
    setReadError(undefined);
    setAction(next);
    setReason(next === "admit" ? form.chief_complaint : "");
    setAdmitDiagnosis(
      form.diagnosis ||
        codes
          .map((c) => c.title)
          .filter(Boolean)
          .join("; "),
    );
    setCarePlan(form.plan);
    setAdmitNotes("");
    setInterval("");
    setCorrectionText("");
    setCorrectionField("general");
    setActionDirty(false);
  }
  function closeAction() {
    if (write.blocked) return;
    if (
      actionDirty &&
      !window.confirm(
        t("Discard this unsent action?", "یہ غیر ارسال عمل چھوڑ دیں؟"),
      )
    )
      return;
    setAction(undefined);
    setActionDirty(false);
  }
  function submitAction() {
    if (!action || locked) return;
    setReadError(undefined);
    const command = {
      method: "POST" as const,
      protection: "idempotent" as const,
      label: action,
      permission: "",
      path: "",
      body: {} as unknown,
      reconcilePath: `/opd-tickets/${ctx.ticket.ticket_id}`,
    };
    if (action === "correction") {
      if (
        !base ||
        base.status !== "Final" ||
        !correctionText.trim() ||
        reason.trim().length < 3
      ) {
        setReadError(
          new Error(
            t(
              "Enter correction text and a reason of at least3characters.",
              "تصحیح اور کم از کم3حروف کی وجہ لکھیں۔",
            ),
          ),
        );
        return;
      }
      Object.assign(command, {
        path: `/clinical-encounters/${base.encounter_id}/correction`,
        permission: "clinical.encounter.correct",
        body: {
          field: correctionField,
          correction_text: correctionText.trim(),
          correction_reason: reason.trim(),
        } satisfies emr.EncounterCorrectionIn,
        reconcilePath: `/clinical-encounters/${base.encounter_id}`,
      });
    }
    if (action === "admit") {
      if (
        !active.includes("inpatient") ||
        ctx.patient.is_deceased ||
        reason.trim().length < 3 ||
        admitDiagnosis.trim().length < 2
      ) {
        setReadError(
          new Error(
            t(
              "An active inpatient service, admission reason and provisional diagnosis are required.",
              "فعال داخلہ خدمت، داخلے کی وجہ اور ابتدائی تشخیص لازم ہیں۔",
            ),
          ),
        );
        return;
      }
      const body: emr.AdmissionIn = {
        patient_id: ctx.patient.patient_id,
        ticket_id: ctx.ticket.ticket_id,
        admission_type: admissionType,
        admission_reason: reason.trim(),
        provisional_diagnosis: admitDiagnosis.trim(),
        initial_care_plan: carePlan || null,
        notes: admitNotes || null,
      };
      if (interval) {
        const n = Number(interval);
        if (!Number.isInteger(n) || n < 15 || n > 1440) {
          setReadError(
            new Error(
              t(
                "Vitals interval must be15–1440whole minutes.",
                "اہم علامات کا وقفہ15تا1440پورے منٹ ہو۔",
              ),
            ),
          );
          return;
        }
        body.vitals_interval_minutes = n;
      }
      Object.assign(command, {
        path: "/admissions",
        permission: "ipd.admission.request",
        body,
        reconcilePath: `/patients/${ctx.patient.patient_id}/master-summary`,
      });
    }
    if (action === "waiver") {
      if (reason.trim().length < 3 || !base || base.status !== "Final") {
        setReadError(
          new Error(
            t(
              "A finalized note and waiver reason are required.",
              "حتمی نوٹ اور رعایت کی وجہ لازم ہیں۔",
            ),
          ),
        );
        return;
      }
      Object.assign(command, {
        path: `/opd-tickets/${ctx.ticket.ticket_id}/vip-waiver-post-consult`,
        permission: "opd.waiver.request_post_consult",
        body: {
          reason: reason.trim(),
          encounter_id: base.encounter_id,
        } satisfies emr.PostConsultWaiverIn,
      });
    }
    if (action === "complete") {
      if (!can("opd.ticket.complete") && !can("opd.queue.view")) return;
      Object.assign(command, {
        path: `/opd-tickets/${ctx.ticket.ticket_id}/complete`,
        permission: can("opd.ticket.complete") ? "opd.ticket.complete" : "opd.queue.view",
        body: undefined,
      });
    }
    write.start(command, preflight);
  }
  async function print(mode: "print" | "local" | "server") {
    if (!base || base.status !== "Final" || printing) return;
    setPrinting(true);
    setPrintError(undefined);
    setPrintNotice("");
    try {
      const terminal=await api<{registered:boolean}>("GET","/terminals/whoami");
      if(!terminal.registered)setPrintNotice(t("Unregistered terminal: the default document printer dialog will be used.","غیر رجسٹرڈ ٹرمینل: دستاویز کا عام پرنٹ مکالمہ استعمال ہوگا۔"));
      const result =
        mode === "server"
          ? await call("clinical-pdf", {
              path: `/clinical-encounters/${base.encounter_id}/pdf`,
            })
          : await call("print-clinical-note", {
              encounterId: base.encounter_id,
              pdf: mode === "local",
            });
      setPrintNotice(
        result.saved === false
          ? t(
              "Save cancelled; the note remains saved.",
              "محفوظ کرنا منسوخ؛ نوٹ محفوظ ہے۔",
            )
          : result.saved
            ? t("PDF saved.", "پی ڈی ایف محفوظ ہو گئی۔")
            : t("Print job submitted.", "پرنٹ کی درخواست دی گئی۔"),
      );
    } catch (e) {
      setPrintError(e);
    } finally {
      setPrinting(false);
    }
  }
  async function openDocument(id: number) {
    try {
      const doc = await call<{ type: string; base64?: string }>(
        "patient-file",
        { documentId: id, save: true },
      );
      if (doc.base64) setImage(`data:${doc.type};base64,${doc.base64}`);
    } catch (e) {
      setPrintError(e);
    }
  }
  const actionMark = () => setActionDirty(true);
  function changeProcedure(patch: Partial<emr.ProcedureIn>) {
    setProcedure((old) => ({ ...old, ...patch }));
    setProcedureDirty(true);
    setDirty(true);
  }
  return (
    <div data-write-pending={write.blocked} data-unsaved={dirty || actionDirty}>
      <div className="actions">
        {[
          ["doctor_queue", "Re-route / queue", "منتقلی / قطار"],
          ["eprescription", "Prescribe", "نسخہ لکھیں"],
          ["lab_orders_results", "Order lab / imaging", "لیب / عکس کا آرڈر"],
          ["external_referral", "External referral", "بیرونی حوالہ"],
          ["patient_education", "Patient education", "مریض کی تعلیم"],
          ["patient_programmes", "Patient programmes", "مریض کے پروگرام"],
        ].map(([screen, en, ur]) => (
          <button
            key={screen}
            data-help="consultation.handover"
            disabled={write.blocked || !availableScreens.includes(screen)}
            onClick={() => onRoute(screen, ctx.ticket.ticket_id)}
          >
            {t(en, ur)}
          </button>
        ))}
        {can("ipd.admission.request") && (
          <button
            data-help="consultation.admit"
            disabled={
              locked || !active.includes("inpatient") || ctx.patient.is_deceased
            }
            onClick={() => startAction("admit")}
          >
            {t("Admit", "داخلہ درخواست")}
          </button>
        )}
        {can("opd.waiver.request_post_consult") && (
          <button
            data-help="consultation.waiver"
            disabled={locked || base?.status !== "Final"}
            onClick={() => startAction("waiver")}
          >
            {t("Convert to VIP waiver", "وی آئی پی رعایت کی درخواست")}
          </button>
        )}
        {(can("opd.ticket.complete") || can("opd.queue.view")) && (
          <button
            data-help="consultation.complete"
            disabled={
              locked ||
              base?.status !== "Final" ||
              ctx.ticket.status === "Completed"
            }
            onClick={() => startAction("complete")}
          >
            {t("Complete visit", "ملاقات مکمل کریں")}
          </button>
        )}
      </div>
      <ErrorBox error={readError} />
      {rawError?.code === "CLINICAL_LOCKOUT" && (
        <p className="error" role="alert">
          {rawError.message}
        </p>
      )}
      {!action && <ClinicalWriteFeedback write={write} />}
      {admissionResult && (
        <section className="notice" role="status">
          <h2>{t("Admission request recorded", "داخلے کی درخواست درج ہوگئی")}</h2>
          <p><bdi>{admissionResult.admission_number}</bdi> · {tr(admissionResult.status)}</p>
          <p>{t("The admissions desk must review and allocate a bed. This request alone does not admit the patient to a bed.", "داخلہ ڈیسک درخواست چیک کرکے بیڈ مختص کرے گا۔ صرف اس درخواست سے مریض کو بیڈ پر داخل نہیں کیا گیا۔")}</p>
          <p>{admissionResult.admission_reason} · {admissionResult.provisional_diagnosis}</p>
          {admissionResult.details_stamp && <p dir="auto">{admissionResult.details_stamp.text}</p>}
        </section>
      )}
      {waiverResult && (
        <section className="notice" role="status">
          <h2>{t("Waiver request recorded", "رعایت کی درخواست درج ہوگئی")}</h2>
          <p>{t("Approval request", "منظوری کی درخواست")} <bdi>#{waiverResult.approval.request_id}</bdi> · {tr(ctx.ticket.approval_lock)}</p>
          <p>{waiverResult.approval.summary}</p>
          <p>{t("The eligible approver decides this request. Approval and any cash handover are separate actions; do not issue another request after a read or print failure.", "مجاز منظوری دینے والا فیصلہ کرے گا۔ منظوری اور نقد کی حوالگی الگ عمل ہیں؛ پڑھنے یا پرنٹ کی خرابی پر نئی درخواست نہ دیں۔")}</p>
        </section>
      )}
      <section className="card">
        <h2>{t("Visit notes", "ملاقات کے نوٹ")}</h2>
        <button
          data-help="consultation.history"
          disabled={write.blocked}
          onClick={() => void notes.reload()}
        >
          {t("Refresh notes", "نوٹ تازہ کریں")}
        </button>
        <LoadState {...notes} retry={notes.reload} />
        {!notes.loading &&
          !notes.error &&
          (notes.data || []).map((n) => (
            <p key={n.encounter_id}>
              <button
                data-help="consultation.history"
                disabled={write.blocked}
                onClick={() => void inspectNote(n.encounter_id)}
              >
                #{n.encounter_id} · {n.encounter_type} · {tr(n.status)} ·{" "}
                {n.doctor_name} · {n.created_at}
              </button>
            </p>
          ))}
        {!notes.loading && !notes.error && !notes.data?.length && (
          <Empty>
            {t("No note for this visit yet.", "اس ملاقات کا کوئی نوٹ نہیں۔")}
          </Empty>
        )}
      </section>
      <section className="card">
        <div className="section-heading">
          <h2>
            {base
              ? `${t("Note", "نوٹ")} #${base.encounter_id} · ${tr(base.status)}`
              : t("New clinical note", "نیا طبی نوٹ")}
          </h2>
          <button
            data-help="consultation.note"
            disabled={write.blocked}
            onClick={newNote}
          >
            {t("New note", "نیا نوٹ")}
          </button>
        </div>
        {base && (
          <>
            <p>
              {base.doctor_name} · {base.created_at} · {t("Version", "نسخہ")}:{" "}
              {base.row_version}
            </p>
            {base.is_post_death && (
              <p>{t("Post-death documentation", "وفات کے بعد دستاویز")}</p>
            )}
            {base.is_post_discharge && (
              <p>{t("Post-discharge documentation", "رخصت کے بعد دستاویز")}</p>
            )}
            <button
              data-help="consultation.conflict"
              disabled={write.blocked || loadingNote}
              onClick={() => void inspectNote(base.encounter_id)}
            >
              {t(
                "Reload note and discard unsaved edits",
                "نوٹ تازہ کریں اور غیر محفوظ ترمیم چھوڑیں",
              )}
            </button>
          </>
        )}
        <fieldset disabled={!editable}>
          <Field label={t("Note type", "نوٹ کی قسم")}>
            <select
              data-help="consultation.note"
              disabled={!editable || !!base}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                setDirty(true);
              }}
            >
              {[
                "OPD",
                "FollowUp",
                "ER",
                "IPD",
                "CodeRed",
                ...(active.includes("outpatient_procedures") || admission
                  ? ["Procedure"]
                  : []),
              ].map((k) => (
                <option key={k} value={k}>{tr(k)}</option>
              ))}
            </select>
          </Field>
          {(kind === "IPD" || kind === "CodeRed" || !!admission) && (
            <Field label={t("Admission", "داخلہ")}>
              <select
                data-help="consultation.note"
                value={admission || ""}
                disabled={!!base}
                onChange={(e) => {
                  setAdmission(Number(e.target.value) || undefined);
                  setDirty(true);
                }}
              >
                <option value="">
                  {t("Choose patient's admission", "مریض کا داخلہ چنیں")}
                </option>
                {summary.data?.admissions
                  .filter((a) => a.patient_id === ctx.patient.patient_id)
                  .map((a) => (
                    <option key={a.admission_id} value={a.admission_id}>
                      {a.admission_number} · {a.status} · {a.ward_name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {fields.map(([key, en, ur, max]) => (
            <div key={key}>
              {key === "examination" && (
                <section>
                  <h3>
                    {t("Permission before examination", "معائنے سے پہلے اجازت")}
                  </h3>
                  <div className="actions">
                    {(
                      [
                        [
                          "VerbalObtained",
                          "Verbal consent obtained (VCO)",
                          "زبانی رضامندی مل گئی (VCO)",
                        ],
                        ["Declined", "Patient declined", "مریض نے انکار کیا"],
                        ["NotExamined", "Not examined", "معائنہ نہیں کیا"],
                      ] as const
                    ).map(([value, en, ur]) => (
                      <button
                        key={value}
                        data-help="consultation.consent"
                        type="button"
                        aria-pressed={consent === value}
                        onClick={() => {
                          if (
                            value !== "VerbalObtained" &&
                            form.examination &&
                            !window.confirm(
                              t(
                                "Clear the examination findings for this consent choice?",
                                "اس انتخاب کے لیے معائنے کے نتائج صاف کریں؟",
                              ),
                            )
                          )
                            return;
                          setConsent(value);
                          if (value !== "VerbalObtained")
                            setForm((f) => ({ ...f, examination: "" }));
                          setDirty(true);
                        }}
                      >
                        {t(en, ur)}
                      </button>
                    ))}
                  </div>
                  {!consent && (
                    <p>
                      {t(
                        "No consent choice recorded. Ask deliberately; do not assume consent.",
                        "رضامندی کا انتخاب درج نہیں۔ واضح طور پر پوچھیں؛ رضامندی فرض نہ کریں۔",
                      )}
                    </p>
                  )}
                </section>
              )}
              <Field label={t(en, ur)}>
                <textarea
                  data-help="consultation.note"
                  maxLength={max}
                  disabled={
                    key === "examination" && consent !== "VerbalObtained"
                  }
                  aria-invalid={missing.some((m) => m.includes(key))}
                  value={form[key]}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, [key]: e.target.value }));
                    setDirty(true);
                  }}
                />
              </Field>
            </div>
          ))}
          <h3>{t("Coded diagnoses", "کوڈ والی تشخیص")}</h3>
          {codes.map((c) => (
            <p key={c.code}>
              <bdi>{c.code}</bdi> ·{" "}
              {c.title || t("Title not recorded", "عنوان درج نہیں")} ·{" "}
              <span dir="ltr">{c.uri}</span>{" "}
              <button
                data-help="consultation.icd"
                onClick={() => {
                  setCodes((old) => old.filter((x) => x.code !== c.code));
                  setDirty(true);
                }}
              >
                {t("Remove code", "کوڈ ہٹائیں")}
              </button>
            </p>
          ))}
          <button
            data-help="consultation.icd"
            disabled={codes.length >= 20}
            onClick={() => setShowIcd(true)}
          >
            {t("Add diagnosis code", "تشخیصی کوڈ شامل کریں")}
          </button>
          <h3>{t("Vital signs", "اہم علامات")}</h3>
          <div className="form-grid">
            {[
              ["bp", "Blood pressure", "بلڈ پریشر"],
              ["hr", "Heart rate", "دل کی رفتار"],
              ["temp_c", "Temperature (°C)", "درجہ حرارت (°C)"],
              ["spo2", "SpO₂ (%)", "آکسیجن (%)"],
            ].map(([k, en, ur]) => (
              <Field key={k} label={t(en, ur)}>
                <input
                  data-help="consultation.note"
                  type={k === "bp" ? "text" : "number"}
                  step="any"
                  value={String(vitals[k] ?? "")}
                  onChange={(e) => {
                    const value = e.target.value;
                    setVitals((v) => {
                      const next = { ...v };
                      if (!value) delete next[k];
                      else next[k] = k === "bp" ? value : Number(value);
                      return next;
                    });
                    setDirty(true);
                  }}
                />
              </Field>
            ))}
          </div>
          {kind === "Procedure" && (
            <fieldset
              disabled={!admission && !active.includes("outpatient_procedures")}
            >
              <h3>{t("Structured procedure note", "طریقہ کار کا مفصل نوٹ")}</h3>
              {!procedureGate && (
                <p role="alert">
                  {t(
                    "Outpatient procedures are not active.",
                    "بیرونی طریقہ کار فعال نہیں۔",
                  )}
                </p>
              )}
              {procedureFields.map(([key, en, ur, max]) => (
                <Field key={key} label={t(en, ur)} hint={["findings", "specimens", "condition_at_end"].includes(key) ? t("Required to finalize this procedure note.", "یہ طریقہ کار نوٹ حتمی کرنے کے لیے لازم ہے۔") : undefined}>
                  <textarea
                    data-help="consultation.procedure"
                    required={["findings", "specimens", "condition_at_end"].includes(key)}
                    aria-required={["findings", "specimens", "condition_at_end"].includes(key)}
                    value={String(procedure[key] || "")}
                    maxLength={max}
                    aria-invalid={missing.includes(key)}
                    onChange={(e) => {
                      changeProcedure({ [key]: e.target.value });
                    }}
                  />
                </Field>
              ))}
              <Field label={t("Anaesthesia", "بے ہوشی")}>
                <select
                  data-help="consultation.procedure"
                  value={procedure.anaesthesia || "None"}
                  onChange={(e) => {
                    changeProcedure({
                      anaesthesia: e.target
                        .value as emr.ProcedureIn["anaesthesia"],
                    });
                  }}
                >
                  {["None", "Local", "Sedation", "Regional", "General"].map(
                    (v) => (
                      <option key={v} value={v}>{tr(v)}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field
                label={t(
                  "Given consent from register (optional link)",
                  "رجسٹر کی دی گئی رضامندی (اختیاری ربط)",
                )}
              >
                <select
                  data-help="consultation.procedure"
                  value={procedure.consent_id || ""}
                  disabled={
                    consents.loading || !!consents.error || !can("consent.view")
                  }
                  onChange={(e) => {
                    changeProcedure({
                      consent_id: Number(e.target.value) || null,
                    });
                  }}
                >
                  <option value="">
                    {t("No consent linked", "رضامندی کا ربط نہیں")}
                  </option>
                  {consents.data?.map((c) => (
                    <option key={c.consent_id} value={c.consent_id}>
                      {c.consent_number} · {c.form_title} · {c.procedure_name}
                    </option>
                  ))}
                </select>
              </Field>
              <LoadState {...consents} retry={consents.reload} />
              <StaffPicker
                label={t("Procedure assistant", "طریقہ کار کا معاون")}
                value={procedure.assistant_employee_id}
                onSelect={(id) => {
                  changeProcedure({ assistant_employee_id: id });
                }}
              />
              {(
                [
                  ["started_at", "Procedure start", "طریقہ کار شروع"],
                  ["ended_at", "Procedure end", "طریقہ کار ختم"],
                ] as const
              ).map(([key, en, ur]) => (
                <Field key={key} label={t(en, ur)} hint={timeZone}>
                  <input
                    data-help="consultation.procedure"
                    type="datetime-local"
                    value={
                      procedure[key] && timeZone
                        ? hospitalTimeInput(procedure[key]!, timeZone)
                        : ""
                    }
                    onChange={(e) => {
                      try {
                        const value = e.target.value
                          ? hospitalTimeToUtc(e.target.value, timeZone || "")
                          : null;
                        changeProcedure({ [key]: value });
                      } catch (e) {
                        setReadError(e);
                      }
                    }}
                  />
                </Field>
              ))}
            </fieldset>
          )}
        </fieldset>
        {editable && (
          <div className="actions">
            <button
              data-help="consultation.save"
              disabled={!dirty || !procedureGate}
              onClick={() => save(false)}
            >
              {base
                ? t("Save draft changes", "مسودے کی تبدیلیاں محفوظ کریں")
                : t("Save draft note", "مسودہ نوٹ محفوظ کریں")}
            </button>
            {!base && (
              <button
                data-help="consultation.finalize"
                disabled={!dirty || !procedureGate}
                onClick={() => save(true)}
              >
                {t("Submit consultation", "معائنہ جمع کریں")}
              </button>
            )}
            {base?.status === "Draft" && (
              <button
                data-help="consultation.finalize"
                disabled={dirty}
                onClick={finalize}
              >
                {t("Finalize saved note", "محفوظ نوٹ حتمی کریں")}
              </button>
            )}
          </div>
        )}
        {!editable && (
          <p>
            {t(
              "This note is read-only, unavailable for your permissions, or waiting for current context. Final notes are corrected by append-only entries.",
              "یہ نوٹ صرف پڑھنے، اجازت یا موجودہ معلومات کے انتظار میں ہے۔ حتمی نوٹ کی تبدیلی الگ تصحیح ہے۔",
            )}
          </p>
        )}
        {base?.author_stamp && (
          <p className="notice" dir="auto">
            {base.author_stamp.text}
          </p>
        )}
        {base?.corrections.map((c) => (
          <section key={c.correction_id}>
            <h3>{t("Correction", "تصحیح")}</h3>
            <p>{c.correction_text}</p>
            <p>
              {t("Reason", "وجہ")}: {c.correction_reason}
            </p>
            <p dir="auto">{c.author_stamp.text}</p>
          </section>
        ))}
        {base?.status === "Final" && (
          <div className="actions">
            {can("clinical.encounter.correct") && (
              <button
                data-help="consultation.correction"
                disabled={locked}
                onClick={() => startAction("correction")}
              >
                {t("Append correction", "تصحیح شامل کریں")}
              </button>
            )}
            {can("clinical.encounter.view") && (
              <>
                <button
                  data-help="consultation.print"
                  disabled={printing}
                  onClick={() => void print("print")}
                >
                  {t("Print note", "نوٹ پرنٹ کریں")}
                </button>
                <button
                  data-help="consultation.print"
                  disabled={printing}
                  onClick={() => void print("local")}
                >
                  {t("Save note PDF", "نوٹ پی ڈی ایف محفوظ کریں")}
                </button>
                <button
                  data-help="consultation.print"
                  disabled={printing}
                  onClick={() => void print("server")}
                >
                  {t("Download server PDF", "سرور پی ڈی ایف لیں")}
                </button>
              </>
            )}
          </div>
        )}
        <ErrorBox error={printError} />
        {printNotice && <p role="status">{printNotice}</p>}
      </section>
      <details>
        <summary data-help="consultation.history">
          {t(
            "Consolidated patient history and results",
            "مریض کی مجموعی تاریخ اور نتائج",
          )}
        </summary>
        <LoadState {...history} retry={history.reload} />
        {!history.loading &&
          !history.error &&
          history.data?.map((n) => (
            <p key={n.encounter_id}>
              <button
                data-help="consultation.history"
                disabled={write.blocked}
                onClick={() => void inspectNote(n.encounter_id)}
              >
                #{n.encounter_id} · {n.created_at} · {n.doctor_name} ·{" "}
                {n.diagnosis}
              </button>
            </p>
          ))}
        <LoadState {...summary} retry={summary.reload} />
        {!summary.loading && !summary.error && summary.data && (
          <Details value={summary.data} />
        )}
      </details>
      <details>
        <summary data-help="consultation.documents">
          {t(
            "Patient documents / outside reports",
            "مریض کی دستاویزات / بیرونی رپورٹ",
          )}
        </summary>
        <LoadState {...docs} retry={docs.reload} />
        {!docs.loading &&
          !docs.error &&
          docs.data?.map((d) => (
            <p key={d.document_id}>
              <button
                data-help="consultation.documents"
                onClick={() => void openDocument(d.document_id)}
              >
                {d.title || d.doc_type}
              </button>{" "}
              ·{" "}
              {d.is_outside
                ? t(
                    "Outside document — not a hospital result",
                    "بیرونی دستاویز — اس ہسپتال کا نتیجہ نہیں",
                  )
                : t("Hospital document", "ہسپتال کی دستاویز")}{" "}
              · {d.source_facility} · {d.document_date}
            </p>
          ))}
      </details>
      {showIcd && (
        <Modal
          title={t("Choose diagnosis code", "تشخیصی کوڈ چنیں")}
          onClose={() => setShowIcd(false)}
        >
          <ICDPicker
            disabled={!editable}
            onPick={(code, term) => {
              setCodes((old) =>
                old.some((c) => c.code === code)
                  ? old
                  : [
                      ...old,
                      {
                        code,
                        system: term.code_system,
                        title: term.title,
                        uri: term.uri,
                      },
                    ],
              );
              setShowIcd(false);
              setDirty(true);
            }}
          />
        </Modal>
      )}
      {image && (
        <Modal
          title={t("Patient document", "مریض کی دستاویز")}
          onClose={() => setImage(undefined)}
        >
          <img
            src={image}
            alt={t("Patient document", "مریض کی دستاویز")}
            style={{ maxWidth: "100%" }}
          />
        </Modal>
      )}
      {action && (
        <Modal
          title={t("Confirm clinical action", "طبی عمل کی تصدیق")}
          onClose={closeAction}
          closable={!write.blocked}
        >
          <p>
            {ctx.patient.full_name} ·{" "}
            <bdi>
              {ctx.patient.mrn} · {ctx.ticket.ticket_number}
            </bdi>
          </p>
          <fieldset disabled={write.blocked}>
            {action === "correction" && (
              <>
                <Field label={t("Correction field", "تصحیح کا خانہ")}>
                  <select
                    data-help="consultation.correction"
                    value={correctionField}
                    onChange={(e) => {
                      setCorrectionField(
                        e.target.value as typeof correctionField,
                      );
                      actionMark();
                    }}
                  >
                    {["general", ...fields.map((f) => f[0]), "procedure"].map(
                      (k) => (
                        <option key={k}>{k}</option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label={t("Correction text", "تصحیح کا متن")}>
                  <textarea
                    data-help="consultation.correction"
                    value={correctionText}
                    maxLength={10000}
                    onChange={(e) => {
                      setCorrectionText(e.target.value);
                      actionMark();
                    }}
                  />
                </Field>
              </>
            )}
            {action !== "complete" && (
              <Field
                label={t(
                  action === "admit" ? "Admission reason" : "Reason",
                  action === "admit" ? "داخلے کی وجہ" : "وجہ",
                )}
              >
                <textarea
                  data-help="consultation.action"
                  value={reason}
                  maxLength={action === "admit" ? 4000 : 1000}
                  onChange={(e) => {
                    setReason(e.target.value);
                    actionMark();
                  }}
                />
              </Field>
            )}
            {action === "admit" && (
              <>
                <Field label={t("Provisional diagnosis", "ابتدائی تشخیص")}>
                  <textarea
                    data-help="consultation.admit"
                    value={admitDiagnosis}
                    maxLength={1000}
                    onChange={(e) => {
                      setAdmitDiagnosis(e.target.value);
                      actionMark();
                    }}
                  />
                </Field>
                <Field
                  label={t("Initial care plan", "ابتدائی نگہداشت کا منصوبہ")}
                >
                  <textarea
                    data-help="consultation.admit"
                    value={carePlan}
                    maxLength={4000}
                    onChange={(e) => {
                      setCarePlan(e.target.value);
                      actionMark();
                    }}
                  />
                </Field>
                <Field label={t("Admissions desk notes", "داخلہ ڈیسک کے نوٹ")}>
                  <textarea
                    data-help="consultation.admit"
                    value={admitNotes}
                    maxLength={2000}
                    onChange={(e) => {
                      setAdmitNotes(e.target.value);
                      actionMark();
                    }}
                  />
                </Field>
                <Field label={t("Admission type", "داخلے کی قسم")}>
                  <select
                    data-help="consultation.admit"
                    value={admissionType}
                    onChange={(e) => {
                      setAdmissionType(e.target.value as typeof admissionType);
                      actionMark();
                    }}
                  >
                    {["Standard", "Emergency", "Planned"].map((v) => (
                      <option key={v} value={v}>{tr(v)}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={t(
                    "Vitals interval (minutes, optional)",
                    "اہم علامات کا وقفہ (منٹ، اختیاری)",
                  )}
                >
                  <input
                    data-help="consultation.admit"
                    type="number"
                    min={15}
                    max={1440}
                    step={1}
                    value={interval}
                    onChange={(e) => {
                      setInterval(e.target.value);
                      actionMark();
                    }}
                  />
                </Field>
              </>
            )}
            {action === "complete" && (
              <p>
                {t(
                  "Complete this outpatient visit after checking notes and handovers. This does not repeat payment, print or prescribe.",
                  "نوٹ اور منتقلی چیک کرکے اس بیرونی ملاقات کو مکمل کریں۔ اس سے ادائیگی، پرنٹ یا نسخہ دوبارہ نہیں ہوتا۔",
                )}
              </p>
            )}
            <ErrorBox error={readError} />
          </fieldset>
          <ClinicalWriteFeedback write={write} />
          <div className="actions">
            <button
              data-help="consultation.action"
              disabled={write.blocked}
              onClick={closeAction}
            >
              {t("Cancel", "منسوخ")}
            </button>
            <button
              data-help="consultation.action"
              onClick={submitAction}
              disabled={locked}
            >
              {t("Confirm clinical action", "طبی عمل کی تصدیق")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
