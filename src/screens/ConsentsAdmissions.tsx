import { useEffect, useRef, useState } from "react";
import { api, call, ApiError } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t, tr } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as c from "../generated/consents_admissions";
import * as patients from "../generated/patient_search";
import * as admissions from "../generated/pending_admissions";
import { getAdmission } from "../generated/admission_detail";
import type { PatientDocumentOut } from "../generated/registration";
import { resolvePatientMaster } from "../patient-profile";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import { PMDCStaffPicker } from "../PMDCStaffPicker";
import { ConsentScanUpload } from "./ConsentScanUpload";
import { formatHospitalTime } from "../hospital-time";
import {
  consentAccess,
  consentActionAllowed,
  consentSnapshot,
  explanation,
  explanationBody,
  emptyDecision,
  decisionBody,
  consentDecisionMakers,
  type Explanation,
  type Decision,
  type ConsentAction,
} from "../consent-policy";
type Draft = {
  action: ConsentAction;
  record?: c.ConsentOut;
  admission?: admissions.AdmissionDetailOut;
  person: patients.PatientDetailOut;
  explanation: Explanation;
  decision: Decision;
  form?: c.ConsentFormOut;
  reason: string;
  document?: PatientDocumentOut;
  ack: boolean;
};
type Review = {
  draft: Draft;
  body: unknown;
  method: "POST" | "PATCH";
  path: string;
  protection: "idempotent" | "reconcile";
  read: string;
};
const actionTitle = (a: ConsentAction) =>
  ({
    create: t("Prepare general consent", "عمومی رضامندی تیار کریں"),
    edit: t("Edit prepared consent", "تیار رضامندی میں ترمیم"),
    sign: t("Record consent given", "رضامندی دینے کا اندراج"),
    refuse: t("Record informed refusal", "باخبر انکار کا اندراج"),
    withdraw: t("Withdraw given consent", "دی ہوئی رضامندی واپس"),
    cancel: t("Cancel prepared consent", "تیار رضامندی منسوخ"),
    scan: t("Attach the signed scan", "دستخط شدہ اسکین کا ربط"),
  })[a];
export function ConsentsAdmissions({
  user,
  establishment,
  connected,
  stream,
  timeZone,
  screenId = "consents_admissions",
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
  screenId?: "consents_admissions" | "consents_ward";
}) {
  const isWard = screenId === "consents_ward",
    can = (p: string) => user.permissions.includes(p),
    view = establishment.views.screens.find(
      (s) => s.screen_id === (screenId || "consents_admissions"),
    )?.view,
    access = consentAccess(view, user.permissions),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [mine, setMine] = useState(false),
    [category, setCategory] = useState<string>(""),
    [find, setFind] = useState(""),
    [status, setStatus] = useState(""),
    [known, setKnown] = useState(""),
    [barcode, setBarcode] = useState(""),
    [record, setRecord] = useState<c.ConsentOut>(),
    [person, setPerson] = useState<patients.PatientDetailOut>(),
    [selected, setSelected] = useState<number>(),
    [draft, setDraft] = useState<Draft>(),
    [review, setReview] = useState<Review>(),
    [busy, setBusy] = useState(false),
    [uploadPending, setUploadPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState<c.PrintOut_ConsentPrintFieldsOut_>(),
    [docId, setDocId] = useState(""),
    [stale, setStale] = useState(false),
    [syncing, setSyncing] = useState(false);
  const root = useRef<HTMLElement>(null),
    flight = useRef(false),
    generation = useRef(0),
    lastId = useRef<number | undefined>(undefined),
    current = useRef({ record, draft });
  current.current = { record, draft };
  const work = useLoad(
    () =>
      access.read ? c.worklistConsent({ mine, days: 7 }) : Promise.resolve([]),
    [revision, mine, access.read],
  );
  const list = useLoad(
    () =>
      access.read
        ? c.listConsents({
            category: isWard
              ? (category ? (category as c.ConsentBriefOut["category"]) : undefined)
              : "General",
            limit: 1000,
            status: status
              ? (status as c.ConsentBriefOut["status"])
              : undefined,
          })
        : Promise.resolve([]),
    [revision, status, category, isWard, access.read],
  );
  const forms = useLoad(
    () => (access.read ? c.listForms() : Promise.resolve([])),
    [revision, access.read],
  );
  const stays = useLoad(
    () =>
      access.read && can("ipd.admission.view")
        ? admissions.listAdmissions()
        : Promise.resolve([]),
    [revision, access.read],
  );
  const docs = useLoad(
    () =>
      record && can("patient.document.view")
        ? api<PatientDocumentOut[]>(
            "GET",
            `/patients/${record.patient_id}/documents`,
          )
        : Promise.resolve([]),
    [record?.patient_id, revision],
  );
  const time = (s: string) => (timeZone ? formatHospitalTime(s, timeZone) : s);
  async function read(id: number, keepDraft = true) {
    const n = ++generation.current;
    lastId.current = id;
    setSyncing(true);
    setPreview(undefined);
    try {
      const r = await c.getConsent(id),
        p = await resolvePatientMaster(
          r.patient_id,
          patients.getPatient,
          () => n === generation.current,
        );
      if (n !== generation.current || !p) return;
      setRecord(r);
      setPerson(p);
      setSelected(r.consent_id);
      setStale(
        !!current.current.draft?.record &&
          consentSnapshot(current.current.draft.record) !== consentSnapshot(r),
      );
      if (!keepDraft) {
        setDraft(undefined);
        setReview(undefined);
      }
      setError(undefined);
    } catch (e) {
      if (n === generation.current) {
        setError(e);
        setRecord(undefined);
        setPerson(undefined);
        setStale(!!current.current.draft);
      }
    } finally {
      if (n === generation.current) setSyncing(false);
    }
  }
  const refreshRef = useRef(() => {});
  refreshRef.current = () => {
    setRevision((n) => n + 1);
    if (lastId.current) void read(lastId.current);
  };
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = window.terminal.subscribe((e) => {
      if (e.type === "event" && e.event_type === "consent.updated") {
        setRevision((n) => n + 1);
        if (lastId.current === e.payload?.consent_id) {
          setStale(!!current.current.draft);
          setSyncing(true);
          setPreview(undefined);
          clearTimeout(timer);
          timer = setTimeout(() => void read(e.payload.consent_id), 120);
        }
      }
      if (
        e.type === "event" &&
        ["patient.merged", "death.recorded"].includes(e.event_type)
      ) {
        setStale(!!current.current.draft);
        refreshRef.current();
      }
      if (e.type === "stream" && e.status === "Live" && e.resync) {
        setStale(!!current.current.draft);
        refreshRef.current();
      }
    });
    return () => {
      stop();
      clearTimeout(timer);
      generation.current++;
    };
  }, []);
  const write = useClinicalWrite(
    user,
    "consents-admissions",
    async (value, command) => {
      const r = value as c.ConsentOut;
      if (
        !r?.consent_id ||
        (command.path !== "/consents" &&
          command.path.split("/")[2] !== String(r.consent_id))
      )
        throw Error(
          t(
            "Returned consent identity differs. Ask IT to reconcile.",
            "واپس رضامندی مختلف۔ آئی ٹی سے چیک کرائیں۔",
          ),
        );
      setDraft(undefined);
      setReview(undefined);
      setStale(false);
      setNotice(
        t(
          "Saved on the server. Printing, upload and scan attachment remain separate.",
          "سرور پر محفوظ۔ پرنٹ، اپ لوڈ و اسکین ربط الگ اعمال ہیں۔",
        ),
      );
      setRecord(r);
      lastId.current = r.consent_id;
      setSelected(r.consent_id);
      setRevision((n) => n + 1);
      await read(r.consent_id, false);
    },
  );
  const locked = write.blocked || busy || uploadPending;
  const isMissing = (key: string) =>
    record?.missing.includes(key) ||
    !!(
      write.error instanceof ApiError &&
      Array.isArray(write.error.response.error?.details?.missing) &&
      write.error.response.error.details.missing.includes(key)
    );
  useEffect(() => {
    if (write.attempt && !write.busy) setReview(undefined);
  }, [write.attempt, write.busy]);
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      ["CONSENT_STATE_INVALID", "VERSION_CONFLICT"].includes(
        write.error.response.error?.code || "",
      )
    ) {
      setStale(true);
      if (lastId.current) void read(lastId.current);
    }
  }, [write.error]);
  useEffect(() => {
    if (!locked) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [locked]);
  function leaveDraft() {
    if (locked) return false;
    return (
      !draft ||
      window.confirm(
        t(
          "Discard the unsaved consent draft?",
          "رضامندی کا غیر محفوظ مسودہ چھوڑ دیں؟",
        ),
      )
    );
  }
  async function open(id: number) {
    setNotice("");
    if (!leaveDraft()) return;
    setDraft(undefined);
    setReview(undefined);
    setDocId("");
    setRecord(undefined);
    setPerson(undefined);
    setSelected(id);
    await read(id, false);
  }
  async function openBarcode() {
    if (locked || flight.current || !leaveDraft()) return;
    const code = barcode.trim();
    if (code.length < 3 || code.length > 80) {
      setError(
        Error(
          t(
            "Scan the consent number printed on this form.",
            "فارم پر چھپا رضامندی نمبر اسکین کریں۔",
          ),
        ),
      );
      return;
    }
    flight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const rows = await c.listConsents({ category: "General", limit: 1000 }),
        match = rows.find((r) => r.consent_number === code);
      if (!match)
        throw Error(
          t(
            "This code was not in the returned General register (latest 1000). Use the known record reference; do not infer an ID from the barcode.",
            "یہ کوڈ واپس عمومی رجسٹر کے تازہ1000ریکارڈ میں نہیں۔ معلوم ریکارڈ حوالہ پڑھیں؛ بارکوڈ سے آئی ڈی کا اندازہ نہیں۔",
          ),
        );
      setDraft(undefined);
      setReview(undefined);
      setDocId("");
      setNotice("");
      await read(match.consent_id, false);
    } catch (e) {
      setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function prepare(admissionId: number) {
    setNotice("");
    if (
      !access.write ||
      !can("ipd.admission.view") ||
      !live ||
      locked ||
      flight.current ||
      !leaveDraft()
    )
      return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const a = await getAdmission(admissionId),
        p = await resolvePatientMaster(a.patient_id, patients.getPatient),
        form = forms.data?.find((f) => f.category === "General" && f.is_active);
      if (!p || !form)
        throw Error(
          t(
            "The hospital has no active general consent form. Ask the policy owner.",
            "ہسپتال کا فعال عمومی فارم نہیں۔ پالیسی نگران سے کہیں۔",
          ),
        );
      if (p.patient_id !== a.patient_id || p.is_deceased)
        throw Error(
          t(
            "Patient identity or status changed. Reconcile the admission first.",
            "مریض کی شناخت یا حالت بدلی؛ پہلے داخلہ درست کریں۔",
          ),
        );
      setRecord(undefined);
      setPerson(p);
      setSelected(undefined);
      lastId.current = undefined;
      setStale(false);
      setDraft({
        action: "create",
        admission: a,
        person: p,
        form,
        explanation: {
          ...explanation(),
          language: form.texts[0]?.language || "English",
          admission_need: a.admission_reason || "",
        },
        decision: emptyDecision(),
        reason: "",
        ack: false,
      });
      setReview(undefined);
    } catch (e) {
      setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function start(action: ConsentAction) {
    setNotice("");
    if (
      !record ||
      !person ||
      locked ||
      syncing ||
      !live ||
      person.is_deceased ||
      person.patient_id !== record.patient_id ||
      !consentActionAllowed(record, action) ||
      !(action === "withdraw" || action === "cancel" || action === "scan"
        ? access.correct
        : access.write)
    )
      return;
    setDraft({
      action,
      record: structuredClone(record),
      person: structuredClone(person),
      form: forms.data?.find((f) => f.form_id === record.form_id),
      explanation: explanation(record),
      decision: emptyDecision(),
      reason: "",
      document: docs.data?.find((d) => d.document_id === Number(docId)),
      ack: false,
    });
    setReview(undefined);
    setStale(false);
    setError(undefined);
    write.clearError();
  }
  function change(p: Partial<Draft>) {
    if (!draft || locked) return;
    setDraft({ ...draft, ...p });
    setReview(undefined);
  }
  function field(k: keyof Explanation, v: string) {
    if (draft) change({ explanation: { ...draft.explanation, [k]: v } });
  }
  function decision(k: keyof Decision, v: unknown) {
    if (draft) change({ decision: { ...draft.decision, [k]: v } });
  }
  function makeReview() {
    if (!draft || locked || stale || syncing) return;
    const d = structuredClone(draft),
      r = d.record;
    try {
      let body: unknown,
        path = "/consents",
        method: "POST" | "PATCH" = "POST",
        protection: "idempotent" | "reconcile" = "idempotent",
        readPath = r
          ? "/consents/" + r.consent_id
          : "/consents?admission_id=" + d.admission!.admission_id;
      if (!d.ack)
        throw Error(
          t(
            "Check the patient, language and intended action before review.",
            "جائزے سے پہلے مریض، زبان و عمل چیک کریں۔",
          ),
        );
      if (d.action === "create" || d.action === "edit") {
        if (!d.form)
          throw Error(
            t(
              "Read the current hospital form first.",
              "پہلے ہسپتال کا تازہ فارم پڑھیں۔",
            ),
          );
        body = explanationBody(d.explanation, d.form, r?.row_version);
        if (d.action === "create")
          body = {
            ...(body as c.ConsentUpdateIn),
            form_code: d.form.code,
            admission_id: d.admission!.admission_id,
          };
        else {
          path = "/consents/" + r!.consent_id;
          method = "PATCH";
          protection = "reconcile";
        }
      } else {
        if (!r || !consentActionAllowed(r, d.action))
          throw Error(
            t(
              "This state does not allow that action. Read the current consent.",
              "اس حالت میں یہ عمل نہیں۔ تازہ رضامندی پڑھیں۔",
            ),
          );
        path = "/consents/" + r.consent_id + "/" + d.action;
        if (["sign", "refuse"].includes(d.action)) {
          body = decisionBody(
            r,
            d.decision,
            d.action as "sign" | "refuse",
            user.employee_id,
          );
          protection = "reconcile";
        } else if (d.action === "scan") {
          if (
            !d.document ||
            d.document.patient_id !== r.patient_id ||
            d.document.doc_type !== "Consent"
          )
            throw Error(
              t(
                "Select this patient’s actual Consent document.",
                "اسی مریض کی اصل رضامندی دستاویز منتخب کریں۔",
              ),
            );
          body = { document_id: d.document.document_id };
          protection = "reconcile";
        } else {
          if (d.reason.trim().length < 3 || d.reason.length > 1000)
            throw Error(
              t(
                "Enter a factual reason (3–1000 characters).",
                "اصل وجہ3تا1000حروف دیں۔",
              ),
            );
          body = { reason: d.reason.trim() };
        }
      }
      setReview({ draft: d, body, path, method, protection, read: readPath });
      setError(undefined);
    } catch (e) {
      setError(e);
    }
  }
  function submit() {
    const v = review;
    if (!v || locked || stale || syncing || !live) return;
    write.start(
      {
        method: v.method,
        path: v.path,
        body: v.body,
        permission: "consent.record",
        protection: v.protection,
        reconcilePath: v.read,
        label:
          actionTitle(v.draft.action) +
          " · " +
          v.draft.person.full_name +
          " · " +
          v.draft.person.mrn,
      },
      async () => {
        const [me, est, p] = await Promise.all([
            api<ClinicalUser>("GET", "/auth/me"),
            api<EstablishmentOut>("GET", "/establishment"),
            resolvePatientMaster(
              v.draft.person.patient_id,
              patients.getPatient,
            ),
          ]),
          a = consentAccess(
            est.views.screens.find((s) => s.screen_id === "consents_admissions")
              ?.view,
            me.permissions,
          );
        if (
          me.user_id !== user.user_id ||
          !p ||
          p.patient_id !== v.draft.person.patient_id ||
          p.row_version !== v.draft.person.row_version ||
          p.is_deceased ||
          !(["withdraw", "cancel", "scan"].includes(v.draft.action)
            ? a.correct
            : a.write)
        )
          throw Error(
            t(
              "Patient, actor, permission or service changed. Read again; draft kept.",
              "مریض، صارف، اجازت یا خدمت بدلی۔ مسودہ رکھ کر دوبارہ پڑھیں۔",
            ),
          );
        if (v.draft.record) {
          const fresh = await c.getConsent(v.draft.record.consent_id);
          if (consentSnapshot(fresh) !== consentSnapshot(v.draft.record)) {
            setRecord(fresh);
            setStale(true);
            setReview(undefined);
            throw Error(
              t(
                "The consent changed. Keep input, read the new state and review again.",
                "رضامندی بدلی۔ معلومات رکھ کر تازہ حالت اور نیا جائزہ لیں۔",
              ),
            );
          }
        } else {
          const fresh = await getAdmission(v.draft.admission!.admission_id);
          if (
            fresh.patient_id !== v.draft.person.patient_id ||
            fresh.row_version !== v.draft.admission!.row_version
          )
            throw Error(
              t(
                "The admission changed. Read it before preparing a consent.",
                "داخلہ بدلا۔ رضامندی سے پہلے دوبارہ پڑھیں۔",
              ),
            );
        }
      },
    );
  }
  async function rebase() {
    if (!draft?.record || locked || flight.current) return;
    flight.current = true;
    setBusy(true);
    try {
      const r = await c.getConsent(draft.record.consent_id),
        p = await resolvePatientMaster(r.patient_id, patients.getPatient);
      if (!p || p.patient_id !== draft.person.patient_id)
        throw Error(
          t(
            "Patient changed. Ask reception to reconcile this draft.",
            "مریض بدلا۔ استقبالیہ سے مسودہ چیک کرائیں۔",
          ),
        );
      setRecord(r);
      setPerson(p);
      setDraft({
        ...draft,
        record: r,
        person: p,
        ack: false,
        decision: { ...draft.decision, ack: false },
      });
      setStale(false);
      setReview(undefined);
      write.clearError();
    } catch (e) {
      setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function print(pdf: boolean, server = false) {
    setNotice("");
    if (!record || locked || flight.current || !live || syncing) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (server) {
        const r = await call("clinical-pdf", {
          path: "/consents/" + record.consent_id + "/pdf",
        });
        setNotice(
          r.saved
            ? t(
                "Consent PDF saved. No decision was recorded.",
                "رضامندی پی ڈی ایف محفوظ؛ کوئی فیصلہ درج نہیں ہوا۔",
              )
            : t(
                "Save cancelled; consent unchanged.",
                "محفوظ منسوخ؛ رضامندی برقرار۔",
              ),
        );
      } else {
        const r = await call("print-consent", {
          consentId: record.consent_id,
          expectedVersion: record.row_version,
          pdf,
        });
        setNotice(
          r.saved
            ? t(
                "Consent PDF saved. No decision was recorded.",
                "رضامندی پی ڈی ایف محفوظ؛ کوئی فیصلہ درج نہیں ہوا۔",
              )
            : r.printed
              ? t(
                  "Form sent to the document printer. Explain it and check the paper.",
                  "فارم دستاویز پرنٹر کو بھیجا۔ سمجھائیں اور کاغذ چیک کریں۔",
                )
              : t(
                  "Save cancelled; consent unchanged.",
                  "محفوظ منسوخ؛ رضامندی برقرار۔",
                ),
        );
      }
    } catch (e) {
      setError(e);
      setNotice(
        t(
          "Print/download failure does not repeat preparation or the decision. Read and print the same consent.",
          "پرنٹ یا ڈاؤن لوڈ ناکامی پر تیاری یا فیصلہ نہ دہرائیں؛ یہی رضامندی پڑھ کر پرنٹ کریں۔",
        ),
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function previewForm() {
    setNotice("");
    if (!record || locked || flight.current) return;
    flight.current = true;
    setBusy(true);
    try {
      const p = await c.printConsent(record.consent_id);
      if (p.fields.consent.consent_id !== record.consent_id)
        throw Error("Print identity changed");
      setPreview(p);
    } catch (e) {
      setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const filtered = (list.data || []).filter((r) =>
    (
      r.patient_name +
      " " +
      r.mrn +
      " " +
      r.consent_number +
      " " +
      r.admission_number
    )
      .toLowerCase()
      .includes(find.trim().toLowerCase()),
  );
  if (!access.read)
    return (
      <Empty>
        {t(
          "Consent records are unavailable for this permission or service view.",
          "اجازت یا خدمت میں رضامندی کے ریکارڈ دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      ref={root}
      data-unsaved={!!draft}
      data-write-pending={locked ? "true" : "false"}
    >
      <div className="bed-board-heading">
        <div>
          <h1>
            {isWard
              ? t("Consents of my patients", "میرے مریضوں کی رضامندی")
              : t("General consent at admission", "داخلے پر عمومی رضامندی")}
          </h1>
          <p>
            {isWard
              ? t(
                  "The general consent still missing on the ward, and the signed forms to scan.",
                  "وارڈ میں ابھی تک غیر موجود عمومی رضامندی اور دستخط شدہ فارموں کو اسکین کرنا۔",
                )
              : t(
                  "Prepare in the patient’s language, explain, record the decision, then scan the signed paper.",
                  "مریض کی زبان میں تیار، سمجھائیں، فیصلہ درج، پھر دستخط شدہ کاغذ اسکین۔",
                )}
          </p>
        </div>
        <button
          data-help="consents.refresh"
          disabled={locked}
          onClick={() => refreshRef.current()}
        >
          {t("Refresh consents", "رضامندیاں تازہ کریں")}
        </button>
      </div>
      <ErrorBox error={error} />
      {notice && <p role="status">{tr(notice)}</p>}
      <ClinicalWriteFeedback
        write={{ ...write, notice: "" }}
        onReviewed={() => {
          setReview(undefined);
          refreshRef.current();
        }}
      />
      {!live && (
        <p className="notice">
          {t(
            "Connection is not live. Writes and printing are paused.",
            "رابطہ تازہ نہیں۔ ارسال و پرنٹ رکے ہیں۔",
          )}
        </p>
      )}
      {view === "records" && (
        <p className="notice">
          {t(
            "Records only: no preparation, edits or new decisions. Permitted corrections remain.",
            "صرف ریکارڈ: تیاری، ترمیم یا نیا فیصلہ نہیں؛ مجاز تصحیح باقی۔",
          )}
        </p>
      )}
      {view === "open_work" && (
        <p className="notice">
          {isWard
            ? t(
                "No new consents from now on. Existing consents and scanning continue.",
                "اب نئی رضامندی نہیں؛ موجودہ دستاویزات اور اسکین جاری۔",
              )
            : t(
                "No new inpatient admissions from now on. Consent for existing stays continues.",
                "اب نئے داخلے نہیں؛ موجودہ داخلوں کی رضامندی جاری۔",
              )}
        </p>
      )}
      <div className="consent-layout">
        <aside className="card">
          <h2>{t("Consent work waiting", "رضامندی کے منتظر کام")}</h2>
          <label>
            <input
              data-help="consents.worklist"
              type="checkbox"
              checked={mine}
              disabled={locked}
              onChange={(e) => setMine(e.target.checked)}
            />
            {t("My patients and forms", "میرے مریض اور فارم")}
          </label>
          <LoadState {...work} retry={work.reload} />
          {!work.loading && !work.error && !work.data?.length && (
            <p>
              {t(
                "No consent work returned for these filters.",
                "ان شرطوں پر رضامندی کا کام نہیں ملا۔",
              )}
            </p>
          )}
          {!work.error &&
            work.data?.map((r, i) => (
              <div
                className={r.overdue ? "error" : "notice"}
                key={r.kind + ":" + r.patient_id + ":" + i}
              >
                <strong>
                  {r.patient_name} · <bdi>{r.mrn}</bdi>
                </strong>
                <p>
                  {
                    {
                      GeneralConsent: t(
                        "General consent due",
                        "عمومی رضامندی باقی",
                      ),
                      OperationConsent: t(
                        "Operation consent due",
                        "آپریشن رضامندی باقی",
                      ),
                      AnaesthesiaConsent: t(
                        "Anaesthesia consent due",
                        "بے ہوشی رضامندی باقی",
                      ),
                      Scan: t(
                        "Signed paper to scan",
                        "دستخط شدہ کاغذ اسکین کرنا",
                      ),
                    }[r.kind]
                  }{" "}
                  · {r.admission_number || r.booking_number} · {time(r.due_at)}
                  {r.overdue && " · " + t("Overdue", "تاخیر")}
                </p>
                {r.consent_id ? (
                  <button
                    data-help="consents.worklist"
                    disabled={locked}
                    onClick={() => void open(r.consent_id!)}
                  >
                    {t("Open prepared consent", "تیار رضامندی کھولیں")}
                  </button>
                ) : r.kind === "GeneralConsent" && r.admission_id ? (
                  <button
                    data-help="consents.prepare"
                    disabled={
                      locked ||
                      !access.write ||
                      !live ||
                      forms.loading ||
                      !!forms.error
                    }
                    onClick={() => void prepare(r.admission_id!)}
                  >
                    {t(
                      "Prepare for this admission",
                      "اس داخلے کی رضامندی تیار",
                    )}
                  </button>
                ) : (
                  <p>
                    {t(
                      "Specific informed consent belongs to the treating clinical team.",
                      "مخصوص باخبر رضامندی متعلقہ طبی ٹیم کا کام ہے۔",
                    )}
                  </p>
                )}
              </div>
            ))}
          <h3>{t("Prepare from an admission", "داخلے سے تیار کریں")}</h3>
          <Field label={t("Admission to prepare for", "رضامندی کا داخلہ")}>
            <select
              data-help="consents.prepare"
              value=""
              disabled={
                locked ||
                !access.write ||
                !live ||
                forms.loading ||
                !!forms.error
              }
              onChange={(e) => {
                if (e.target.value) void prepare(Number(e.target.value));
              }}
            >
              <option value="">
                {t("Choose an actual admission", "اصل داخلہ چنیں")}
              </option>
              {!stays.error &&
                stays.data?.map((a) => (
                  <option key={a.admission_id} value={a.admission_id}>
                    {a.patient_name} · {a.mrn} · {a.admission_number}
                  </option>
                ))}
            </select>
          </Field>
          <LoadState {...stays} retry={stays.reload} />
          <h3>
            {isWard
              ? t("Consent register", "رضامندی رجسٹر")
              : t("General consent register", "عمومی رضامندی رجسٹر")}
          </h3>
          {isWard && (
            <Field label={t("Consent category", "رضامندی کی قسم")}>
              <select
                data-field="category"
                data-help="consents.filters"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={locked}
              >
                <option value="">{t("All categories", "تمام اقسام")}</option>
                {[
                  "General",
                  "Procedure",
                  "Anaesthesia",
                  "Transfusion",
                  "HighRiskTreatment",
                  "AgainstMedicalAdvice",
                  "Other",
                ].map((cat) => (
                  <option key={cat} value={cat}>
                    {tr(cat)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t("Find a consent or patient", "رضامندی یا مریض تلاش")}>
            <input
              data-help="consents.filters"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              disabled={locked}
            />
          </Field>
          <Field label={t("Consent status to show", "دکھائی جانے والی حالت")}>
            <select data-field="status"
              data-help="consents.filters"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={locked}
            >
              <option value="">
                {t("All decisions and drafts", "سب فیصلے و مسودے")}
              </option>
              {["Draft", "Given", "Refused", "Withdrawn", "Cancelled"].map(
                (v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d+$/.test(known) && Number(known) > 0)
                void open(Number(known));
              else
                setError(
                  Error(
                    t(
                      "Enter a known consent reference from its record.",
                      "ریکارڈ سے معلوم رضامندی حوالہ دیں۔",
                    ),
                  ),
                );
            }}
          >
            <Field label={t("Known consent reference", "معلوم رضامندی حوالہ")}>
              <input
                data-help="consents.open"
                value={known}
                onChange={(e) => setKnown(e.target.value)}
                disabled={locked}
              />
            </Field>
            <button data-help="consents.open" disabled={locked}>
              {t("Read this consent", "یہ رضامندی پڑھیں")}
            </button>
          </form>
          <LoadState {...list} retry={list.reload} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void openBarcode();
            }}
          >
            <Field
              label={t(
                "Scan consent form barcode",
                "رضامندی فارم کا بارکوڈ اسکین",
              )}
            >
              <input data-field="barcode"
                data-help="consents.open"
                dir="ltr"
                value={barcode}
                maxLength={80}
                disabled={locked}
                onChange={(e) => setBarcode(e.target.value)}
              />
            </Field>
            <button data-help="consents.open" disabled={locked}>
              {t("Open scanned consent", "اسکین شدہ رضامندی کھولیں")}
            </button>
          </form>
          {!list.loading && !list.error && !filtered.length && (
            <Empty>
              {t(
                "No matching general consents. Prepare only after selecting the actual admission.",
                "عمومی رضامندی نہیں ملی؛ اصل داخلہ چن کر تیار کریں۔",
              )}
            </Empty>
          )}
          <div className="consent-register">
            {!list.error &&
              filtered.map((r) => (
                <button
                  data-help="consents.open"
                  key={r.consent_id}
                  disabled={locked}
                  aria-pressed={selected === r.consent_id}
                  onClick={() => void open(r.consent_id)}
                >
                  <strong>{r.patient_name}</strong>
                  <bdi>
                    {r.mrn} · {r.consent_number}
                  </bdi>
                  <small>
                    {tr(r.status)} · {r.language}
                    {!r.document_id && r.status === "Given"
                      ? " · " + t("Scan pending", "اسکین باقی")
                      : ""}
                  </small>
                </button>
              ))}
          </div>
        </aside>
        <article className="card">
          <LoadState {...forms} retry={forms.reload} />
          {(busy || syncing) && (
            <p role="status">
              {t(
                "Reading or sending… keep this context selected.",
                "پڑھنا یا ارسال جاری؛ یہی مریض منتخب رکھیں۔",
              )}
            </p>
          )}
          {person && (
            <section className="patient-banner">
              <h2>
                {person.full_name} · <bdi>{person.mrn}</bdi>
              </h2>
              <p>
                {person.dob ||
                  (person.age_years ??
                    t("Age not recorded", "عمر درج نہیں"))}{" "}
                · {tr(person.gender || "Not recorded")}
              </p>
              <p className={person.allergies ? "error" : "notice"}>
                {t("Allergies", "حساسیت")}:{" "}
                {person.allergies || t("Not recorded", "درج نہیں")}
              </p>
              {person.is_deceased && (
                <p className="error">
                  {t(
                    "Deceased patient: no new consent actions.",
                    "مریض وفات پا چکا؛ نئے رضامندی اعمال نہیں۔",
                  )}
                </p>
              )}
              {person.temp_identifier && (
                <p>
                  {t("Temporary identity", "عارضی شناخت")}:{" "}
                  {person.temp_identifier}
                </p>
              )}
              {person.mlc_numbers.length > 0 && (
                <p className="error">
                  {t("MEDICO-LEGAL", "میڈیکو لیگل")}:{" "}
                  {person.mlc_numbers.join(", ")}
                </p>
              )}
              {person.outstanding.banner_text && (
                <p className="notice">{person.outstanding.banner_text}</p>
              )}
              {record && record.patient_id !== person.patient_id && (
                <p className="error">
                  {t(
                    "Merged identity: reconcile this consent with the master patient before writing.",
                    "ضم شدہ شناخت: ارسال سے پہلے اصل مریض سے ریکارڈ درست کرائیں۔",
                  )}
                </p>
              )}
            </section>
          )}
          {record && (
            <>
              <h2>
                {record.consent_number} · {tr(record.status)}
              </h2>
              <p>
                {record.admission_number} · {record.form_title} ·{" "}
                {record.language} · {record.taken_by}
              </p>
              <details>
                <summary data-help="consents.print">
                  {t(
                    "Read the prepared declaration",
                    "تیار شدہ اقرار کا متن پڑھیں",
                  )}
                </summary>
                <div dir={record.direction} className="consent-words">
                  {record.form_body.split("\n").map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </div>
              </details>
              <p>
                {t("Need for admission", "داخلے کی ضرورت")}:{" "}
                {record.admission_need || tr("Not recorded")}
              </p>
              <p>
                {t("Estimated stay / cost", "متوقع قیام و خرچ")}:{" "}
                {record.estimated_days ?? tr("Not recorded")} ·{" "}
                {record.estimated_cost ?? tr("Not recorded")}
              </p>
              {record.missing.length > 0 && (
                <p className="error">
                  {t("Complete before decision", "فیصلے سے پہلے مکمل")}:{" "}
                  {record.missing.join(", ")}
                </p>
              )}
              {record.obtained_stamp && <p>{record.obtained_stamp.text}</p>}
              {record.withdrawal_stamp && <p>{record.withdrawal_stamp.text}</p>}
              {record.decided_at && (
                <p>
                  {record.signer_name} · {record.signer_relationship} ·{" "}
                  {record.signer_mark} · {time(record.decided_at)} ·{" "}
                  {record.mode}
                </p>
              )}
              {record.refusal_reason && <p>{record.refusal_reason}</p>}
              {record.withdrawal_reason && <p>{record.withdrawal_reason}</p>}
              {record.cancel_reason && <p>{record.cancel_reason}</p>}
              {record.document_id && (
                <p>
                  {t("Signed scan attached", "دستخط شدہ اسکین منسلک")}: #
                  {record.document_id} ·{" "}
                  {record.scanned_at && time(record.scanned_at)}
                </p>
              )}
              <div className="toolbar">
                {(
                  [
                    "edit",
                    "sign",
                    "refuse",
                    "withdraw",
                    "cancel",
                  ] as ConsentAction[]
                )
                  .filter(
                    (a) =>
                      consentActionAllowed(record, a) &&
                      (["withdraw", "cancel"].includes(a)
                        ? access.correct
                        : access.write),
                  )
                  .map((a) => (
                    <button
                      data-help="consents.action"
                      key={a}
                      disabled={
                        locked ||
                        syncing ||
                        !live ||
                        !!draft ||
                        !!person?.is_deceased ||
                        person?.patient_id !== record.patient_id
                      }
                      onClick={() => start(a)}
                    >
                      {actionTitle(a)}
                    </button>
                  ))}
              </div>
              <div className="toolbar">
                <button
                  data-help="consents.print"
                  disabled={locked || syncing}
                  onClick={() => void previewForm()}
                >
                  {t("Preview consent form", "رضامندی فارم کا جائزہ")}
                </button>
                <button
                  data-help="consents.print"
                  disabled={locked || syncing || !live}
                  onClick={() => void print(false)}
                >
                  {t("Print this consent form", "یہ رضامندی فارم پرنٹ")}
                </button>
                <button
                  data-help="consents.print"
                  disabled={locked || syncing || !live}
                  onClick={() => void print(true)}
                >
                  {t("Save terminal consent PDF", "ٹرمینل رضامندی پی ڈی ایف")}
                </button>
                {record.direction === "ltr" && (
                  <button
                    data-help="consents.print"
                    disabled={locked || syncing || !live}
                    onClick={() => void print(true, true)}
                  >
                    {t(
                      "Download server consent PDF",
                      "سرور رضامندی پی ڈی ایف ڈاؤن لوڈ",
                    )}
                  </button>
                )}
              </div>
              {record.direction === "rtl" && (
                <p className="notice">
                  {t(
                    "This language is laid out on this terminal. The server PDF is unavailable; save the terminal PDF.",
                    "یہ زبان ٹرمینل ترتیب دیتا ہے۔ سرور پی ڈی ایف نہیں؛ ٹرمینل پی ڈی ایف محفوظ کریں۔",
                  )}
                </p>
              )}
              {consentActionAllowed(record, "scan") &&
                record.mode !== "EmergencyNote" && (
                  <section>
                    <h3>
                      {t("Signed paper on file", "دستخط شدہ کاغذ کا ریکارڈ")}
                    </h3>
                    {can("patient.document.upload") && (
                      <ConsentScanUpload
                        key={record.patient_id + ":" + record.consent_id}
                        patientId={record.patient_id}
                        consentNumber={record.consent_number}
                        disabled={busy || write.blocked || !!draft || !live}
                        onPending={setUploadPending}
                        onUploaded={(d) => {
                          setDocId(String(d.document_id));
                          setRevision((n) => n + 1);
                        }}
                      />
                    )}
                    <LoadState {...docs} retry={docs.reload} />
                    <Field
                      label={t(
                        "Select this patient’s consent scan",
                        "اسی مریض کی رضامندی اسکین چنیں",
                      )}
                    >
                      <select
                        data-help="consents.scan"
                        value={docId}
                        onChange={(e) => setDocId(e.target.value)}
                        disabled={
                          locked || !!docs.error || docs.loading || !!draft
                        }
                      >
                        <option value="">
                          {t(
                            "Choose an uploaded Consent document",
                            "اپ لوڈ شدہ رضامندی چنیں",
                          )}
                        </option>
                        {docs.data
                          ?.filter((d) => d.doc_type === "Consent")
                          .map((d) => (
                            <option key={d.document_id} value={d.document_id}>
                              {d.title} · #{d.document_id} ·{" "}
                              {time(d.uploaded_at)}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <button
                      data-help="consents.scan"
                      disabled={
                        locked ||
                        !docId ||
                        syncing ||
                        !!draft ||
                        !access.correct ||
                        !live
                      }
                      onClick={() => start("scan")}
                    >
                      {t("Review scan attachment", "اسکین کے ربط کا جائزہ")}
                    </button>
                    {record.document_id && can("patient.document.view") && (
                      <button
                        data-help="consents.scan"
                        disabled={locked}
                        onClick={() =>
                          void call("patient-file", {
                            documentId: record.document_id,
                            save: true,
                            saveImage: true,
                          }).catch(setError)
                        }
                      >
                        {t(
                          "Save attached signed paper",
                          "منسلک دستخط شدہ کاغذ محفوظ",
                        )}
                      </button>
                    )}
                  </section>
                )}
            </>
          )}
          {!record && !draft && !syncing && (
            <Empty>
              {t(
                "Choose a work item or consent. Preparing a form never records consent given.",
                "کام یا رضامندی چنیں۔ فارم کی تیاری رضامندی دینا نہیں۔",
              )}
            </Empty>
          )}
          {draft && (
            <section className="consent-editor" data-unsaved="true">
              <h2>{actionTitle(draft.action)}</h2>
              {stale && (
                <div className="error">
                  <p>
                    {t(
                      "This consent changed or could not be reread. Your input is kept; compare the current state before another review.",
                      "رضامندی بدلی یا تازہ نہ پڑھی۔ معلومات محفوظ؛ نئے جائزے سے پہلے حالت ملائیں۔",
                    )}
                  </p>
                  <button
                    data-help="consents.rebase"
                    disabled={locked}
                    onClick={() => void rebase()}
                  >
                    {t(
                      "Read latest consent and keep input",
                      "تازہ رضامندی پڑھیں و معلومات رکھیں",
                    )}
                  </button>
                </div>
              )}
              {["create", "edit"].includes(draft.action) && (
                <>
                  <p>
                    {draft.admission?.admission_number ||
                      draft.record?.admission_number}
                  </p>
                  {draft.action === "create" && (
                    <Field
                      label={t(
                        "Hospital general consent form",
                        "ہسپتال کا عمومی رضامندی فارم",
                      )}
                    >
                      <select
                        data-help="consents.explanation"
                        disabled={locked}
                        value={draft.form?.form_id || ""}
                        onChange={(e) => {
                          const form = forms.data?.find(
                            (f) => f.form_id === Number(e.target.value),
                          );
                          if (form)
                            change({
                              form,
                              explanation: {
                                ...draft.explanation,
                                language: form.texts[0]?.language || "English",
                              },
                            });
                        }}
                      >
                        {forms.data
                          ?.filter(
                            (f) => f.category === "General" && f.is_active,
                          )
                          .map((f) => (
                            <option key={f.form_id} value={f.form_id}>
                              {f.title}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}
                  <p>{draft.form?.situations}</p>
                  <Field
                    label={t(
                      "Language the patient understands",
                      "مریض کی سمجھی زبان",
                    )}
                  >
                    <select
                      data-field="language"
                      data-help="consents.explanation"
                      disabled={locked}
                      value={draft.explanation.language}
                      onChange={(e) => field("language", e.target.value)}
                    >
                      {draft.form?.texts.map((v) => (
                        <option value={v.language} key={v.language}>
                          {v.language}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("Need for admission", "داخلے کی ضرورت")}>
                    <textarea
                      data-field="admission_need"
                      data-help="consents.explanation"
                      disabled={locked}
                      maxLength={2000}
                      value={draft.explanation.admission_need}
                      aria-invalid={isMissing("admission_need")}
                      onChange={(e) => field("admission_need", e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t("Estimated stay in days", "متوقع قیام دنوں میں")}
                  >
                    <input
                      data-field="estimated_days"
                      data-help="consents.explanation"
                      disabled={locked}
                      inputMode="numeric"
                      value={draft.explanation.estimated_days}
                      aria-invalid={isMissing("estimated_days")}
                      onChange={(e) => field("estimated_days", e.target.value)}
                    />
                  </Field>
                  <Field label={t("Estimated cost", "متوقع خرچ")}>
                    <input
                      data-field="estimated_cost"
                      data-help="consents.explanation"
                      disabled={locked}
                      inputMode="decimal"
                      value={draft.explanation.estimated_cost}
                      aria-invalid={isMissing("estimated_cost")}
                      onChange={(e) => field("estimated_cost", e.target.value)}
                    />
                  </Field>
                </>
              )}
              {["sign", "refuse"].includes(draft.action) && (
                <>
                  <Field label={t("Decision mode", "فیصلے کا طریقہ")}>
                    <select
                      data-field="mode"
                      data-help="consents.decision"
                      disabled={locked}
                      value={draft.decision.mode}
                      onChange={(e) =>
                        change({
                          decision: {
                            ...emptyDecision(),
                            mode: e.target.value as Decision["mode"],
                          },
                        })
                      }
                    >
                      <option value="Signed">
                        {t("Signed paper", "دستخط شدہ کاغذ")}
                      </option>
                      <option
                        value={
                          draft.action === "sign"
                            ? "EmergencyNote"
                            : "VerbalRefusal"
                        }
                      >
                        {draft.action === "sign"
                          ? t("Doctor’s emergency note", "ڈاکٹر کا ہنگامی نوٹ")
                          : t(
                              "Witnessed verbal refusal",
                              "گواہ کے ساتھ زبانی انکار",
                            )}
                      </option>
                    </select>
                  </Field>
                  {draft.decision.mode !== "EmergencyNote" && (
                    <>
                      <Field
                        label={t("Who made the decision", "فیصلہ کس نے کیا")}
                      >
                        <select
                          data-field="signer"
                          data-help="consents.decision"
                          disabled={locked}
                          value={draft.decision.signer}
                          onChange={(e) => decision("signer", e.target.value)}
                        >
                          <option value="">
                            {t("Choose deliberately", "خود انتخاب کریں")}
                          </option>
                          {draft.record?.who_decides.patient_may_sign && (
                            <option value="Patient">
                              {t("Patient", "مریض")}
                            </option>
                          )}
                          <option value="DecisionMaker">
                            {t(
                              "Decision maker for an incapable patient",
                              "فیصلہ نہ کر سکنے والے مریض کا نمائندہ",
                            )}
                          </option>
                        </select>
                      </Field>
                      <Field
                        label={t("Signer’s name", "فیصلہ کرنے والے کا نام")}
                      >
                        <input
                          data-field="signer_name"
                          data-help="consents.decision"
                          disabled={locked}
                          maxLength={200}
                          value={draft.decision.signer_name}
                          onChange={(e) =>
                            decision("signer_name", e.target.value)
                          }
                        />
                      </Field>
                      {draft.decision.signer === "DecisionMaker" && (
                        <>
                          <Field
                            label={t(
                              "Relationship from hospital policy",
                              "ہسپتال پالیسی کے مطابق رشتہ",
                            )}
                          >
                            <select
                              data-field="signer_relationship"
                              data-help="consents.policy"
                              disabled={locked}
                              value={draft.decision.signer_relationship}
                              onChange={(e) =>
                                decision("signer_relationship", e.target.value)
                              }
                            >
                              <option value="">
                                {t(
                                  "Choose the actual relationship",
                                  "اصل رشتہ منتخب کریں",
                                )}
                              </option>
                              {consentDecisionMakers(draft.record!).map((r) => (
                                <option
                                  key={r.relationship}
                                  value={r.relationship}
                                >
                                  {r.description}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </>
                      )}
                      <Field
                        label={t(
                          "Signer CNIC (optional)",
                          "فیصلہ کنندہ شناختی کارڈ، اختیاری",
                        )}
                      >
                        <input
                          data-field="signer_cnic"
                          data-help="consents.decision"
                          disabled={locked}
                          value={draft.decision.signer_cnic}
                          onChange={(e) =>
                            decision("signer_cnic", e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label={t(
                          "Signer phone (optional)",
                          "فیصلہ کنندہ فون، اختیاری",
                        )}
                      >
                        <input
                          data-field="signer_phone"
                          data-help="consents.decision"
                          disabled={locked}
                          maxLength={30}
                          value={draft.decision.signer_phone}
                          onChange={(e) =>
                            decision("signer_phone", e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label={t(
                          "Signature or thumb impression",
                          "دستخط یا انگوٹھا",
                        )}
                      >
                        <select
                          data-field="signer_mark"
                          data-help="consents.decision"
                          disabled={locked}
                          value={draft.decision.signer_mark}
                          onChange={(e) =>
                            decision("signer_mark", e.target.value)
                          }
                        >
                          <option value="Signature">
                            {t("Signature", "دستخط")}
                          </option>
                          <option value="ThumbImpression">
                            {t("Thumb impression", "انگوٹھا")}
                          </option>
                        </select>
                      </Field>
                    </>
                  )}
                  {(draft.decision.signer === "DecisionMaker" ||
                    draft.decision.mode === "EmergencyNote") && (
                    <Field
                      label={t(
                        "Why the patient cannot decide",
                        "مریض فیصلہ کیوں نہیں کر سکتا",
                      )}
                    >
                      <select
                        data-field="incapacity_reason"
                        data-help="consents.decision"
                        disabled={locked}
                        value={draft.decision.incapacity_reason}
                        onChange={(e) =>
                          decision("incapacity_reason", e.target.value)
                        }
                      >
                        <option value="">
                          {t("Choose the actual reason", "اصل وجہ منتخب کریں")}
                        </option>
                        {[
                          "Minor",
                          "Unconscious",
                          "Confused",
                          "MentalIllness",
                          "Sedated",
                          "Other",
                        ].map((v) => (
                          <option value={v} key={v}>
                            {tr(v)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {draft.decision.mode === "EmergencyNote" ? (
                    <>
                      <p className="notice">
                        {t(
                          "Only a registered doctor can record this emergency decision. Choose the different PMDC doctor who concurs; the hospital’s second-doctor rule is enforced on the server.",
                          "یہ ہنگامی فیصلہ صرف رجسٹرڈ ڈاکٹر درج کر سکتا ہے۔ اتفاق کرنے والا الگ پی ایم ڈی سی ڈاکٹر چنیں؛ ہسپتال کی شرط سرور نافذ کرتا ہے۔",
                        )}
                      </p>
                      <Field
                        label={t(
                          "Why treatment could not wait and nobody could consent",
                          "علاج کیوں نہیں رک سکتا تھا اور کوئی رضامندی دینے والا کیوں نہ تھا",
                        )}
                      >
                        <textarea
                          data-field="emergency_note"
                          data-help="consents.decision"
                          disabled={locked}
                          maxLength={4000}
                          value={draft.decision.emergency_note}
                          onChange={(e) =>
                            decision("emergency_note", e.target.value)
                          }
                        />
                      </Field>
                      {draft.record?.who_decides.emergency_second_doctor && (
                        <PMDCStaffPicker
                          disabled={locked}
                          value={draft.decision.doctor}
                          onSelect={(r) => decision("doctor", r)}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <Field label={t("Witness name", "گواہ کا نام")}>
                        <input
                          data-field="witness_name"
                          data-help="consents.decision"
                          disabled={locked}
                          maxLength={200}
                          value={draft.decision.witness_name}
                          onChange={(e) =>
                            decision("witness_name", e.target.value)
                          }
                        />
                      </Field>
                      <Field label={t("Witness role", "گواہ کا کردار")}>
                        <input
                          data-field="witness_role"
                          data-help="consents.decision"
                          disabled={locked}
                          maxLength={200}
                          value={draft.decision.witness_role}
                          onChange={(e) =>
                            decision("witness_role", e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label={t(
                          "Interpreter name (if used)",
                          "مترجم کا نام، اگر استعمال ہوا",
                        )}
                      >
                        <input
                          data-field="interpreter_name"
                          data-help="consents.decision"
                          disabled={locked}
                          maxLength={200}
                          value={draft.decision.interpreter_name}
                          onChange={(e) =>
                            decision("interpreter_name", e.target.value)
                          }
                        />
                      </Field>
                      <label>
                        <input data-field="read_to_patient"
                          data-help="consents.decision"
                          type="checkbox"
                          disabled={locked}
                          checked={draft.decision.read_to_patient}
                          onChange={(e) =>
                            decision("read_to_patient", e.target.checked)
                          }
                        />
                        {t(
                          "The form was read aloud to the patient",
                          "فارم مریض کو پڑھ کر سنایا گیا",
                        )}
                      </label>
                      <Field
                        label={t(
                          "Questions asked and answers given",
                          "پوچھے گئے سوالات اور دیے گئے جوابات",
                        )}
                      >
                        <textarea
                          data-field="questions_answers"
                          data-help="consents.decision"
                          disabled={locked}
                          maxLength={4000}
                          value={draft.decision.questions_answers}
                          onChange={(e) =>
                            decision("questions_answers", e.target.value)
                          }
                        />
                      </Field>
                      <label>
                        <input data-field="understanding_confirmed"
                          data-help="consents.decision"
                          type="checkbox"
                          disabled={locked}
                          checked={draft.decision.understanding_confirmed}
                          onChange={(e) =>
                            decision(
                              "understanding_confirmed",
                              e.target.checked,
                            )
                          }
                        />
                        {t(
                          "The patient or decision maker explained it back in their own words",
                          "مریض یا نمائندے نے اپنی زبان میں واپس سمجھایا",
                        )}
                      </label>
                    </>
                  )}
                  {draft.action === "refuse" && (
                    <Field
                      label={t(
                        "Reason in the patient’s words",
                        "مریض کے الفاظ میں انکار کی وجہ",
                      )}
                    >
                      <textarea
                        data-field="refusal_reason"
                        data-help="consents.decision"
                        disabled={locked}
                        maxLength={2000}
                        value={draft.decision.refusal_reason}
                        onChange={(e) =>
                          decision("refusal_reason", e.target.value)
                        }
                      />
                    </Field>
                  )}
                  <label>
                    <input
                      data-help="consents.decision"
                      type="checkbox"
                      disabled={locked}
                      checked={draft.decision.ack}
                      onChange={(e) => decision("ack", e.target.checked)}
                    />
                    {t(
                      "I checked the actual decision, explanation and signed paper or witnessed note",
                      "میں نے اصل فیصلہ، وضاحت اور دستخط شدہ کاغذ یا گواہی کا نوٹ چیک کیا",
                    )}
                  </label>
                </>
              )}
              {["withdraw", "cancel"].includes(draft.action) && (
                <Field label={t("Reason for this change", "اس تبدیلی کی وجہ")}>
                  <textarea data-field="reason"
                    data-help="consents.reason"
                    disabled={locked}
                    maxLength={1000}
                    value={draft.reason}
                    onChange={(e) => change({ reason: e.target.value })}
                  />
                </Field>
              )}
              {draft.action === "scan" && (
                <p>
                  {t(
                    "Attach this already uploaded patient document",
                    "اسی مریض کی اپ لوڈ شدہ دستاویز کا ربط",
                  )}
                  : #{draft.document?.document_id} · {draft.document?.title}
                </p>
              )}
              <label>
                <input
                  data-help="consents.review"
                  type="checkbox"
                  checked={draft.ack}
                  disabled={locked}
                  onChange={(e) => change({ ack: e.target.checked })}
                />
                {t(
                  "I checked this patient, language and intended consent action",
                  "میں نے یہی مریض، زبان اور رضامندی کا مطلوبہ عمل چیک کیا",
                )}
              </label>
              <div className="toolbar">
                <button
                  data-help="consents.review"
                  disabled={locked || stale || syncing || !live}
                  onClick={makeReview}
                >
                  {t("Review consent action", "رضامندی کے عمل کا جائزہ")}
                </button>
                <button
                  data-help="consents.close"
                  disabled={locked}
                  onClick={() => {
                    if (leaveDraft()) {
                      setDraft(undefined);
                      setReview(undefined);
                    }
                  }}
                >
                  {t("Close consent draft", "رضامندی کا مسودہ بند")}
                </button>
              </div>
            </section>
          )}
          {preview && (
            <section className="notice" dir={preview.fields.consent.direction}>
              <h2>{preview.fields.consent.form_title}</h2>
              <p>
                {preview.fields.hospital.name} ·{" "}
                {preview.fields.hospital.phc_number}
              </p>
              {preview.fields.consent.form_body.split("\n").map((v, i) => (
                <p key={i}>{v}</p>
              ))}
              {preview.fields.explained.map((v, i) => (
                <p key={i}>
                  {v.label}: {v.value}
                </p>
              ))}
              <button
                data-help="consents.print"
                onClick={() => setPreview(undefined)}
              >
                {t("Close form preview", "فارم جائزہ بند")}
              </button>
            </section>
          )}
        </article>
      </div>
      {review && (
        <Modal
          title={t("Confirm consent action", "رضامندی کے عمل کی تصدیق")}
          closable={!write.blocked}
          onClose={() => setReview(undefined)}
        >
          <h3>{actionTitle(review.draft.action)}</h3>
          <p>
            {review.draft.person.full_name} ·{" "}
            <bdi>{review.draft.person.mrn}</bdi> ·{" "}
            {review.draft.record?.consent_number ||
              review.draft.admission?.admission_number}
          </p>
          <p>
            {review.draft.explanation.language} ·{" "}
            {review.draft.explanation.admission_need}
          </p>
          {review.draft.reason && <p>{review.draft.reason}</p>}
          {["create", "edit"].includes(review.draft.action) && (
            <p>
              {t("Estimated days / cost", "متوقع دن و خرچ")}:{" "}
              {review.draft.explanation.estimated_days || "—"} /{" "}
              {review.draft.explanation.estimated_cost || "—"}
            </p>
          )}
          {["sign", "refuse"].includes(review.draft.action) && (
            <section>
              <p>
                {t("Decision mode / signer", "فیصلے کا طریقہ و فیصلہ کنندہ")}:{" "}
                {tr(review.draft.decision.mode)} ·{" "}
                {tr(review.draft.decision.signer)} ·{" "}
                {review.draft.decision.signer_name ||
                  review.draft.person.full_name}{" "}
                · {review.draft.decision.signer_relationship}
              </p>
              <p>
                {t("Mark / witness", "نشان و گواہ")}:{" "}
                {tr(review.draft.decision.signer_mark)} ·{" "}
                {review.draft.decision.witness_name} ·{" "}
                {review.draft.decision.witness_role}
              </p>
              <p>{review.draft.decision.questions_answers}</p>
              <p>
                {review.draft.decision.refusal_reason ||
                  review.draft.decision.emergency_note}
              </p>
              {review.draft.decision.doctor && (
                <p>
                  {review.draft.decision.doctor.full_name} ·{" "}
                  {review.draft.decision.doctor.registration}
                </p>
              )}
            </section>
          )}
          {review.draft.action === "scan" && (
            <p>
              #{review.draft.document?.document_id} ·{" "}
              {review.draft.document?.title}
            </p>
          )}
          <p>
            {t(
              "This records only the reviewed action. Printing, upload and scan attachment never repeat it.",
              "صرف یہی جائزہ شدہ عمل درج ہوگا؛ پرنٹ، اپ لوڈ و ربط اسے نہیں دہراتے۔",
            )}
          </p>
          <button
            data-help="consents.confirm"
            disabled={locked || stale || syncing || !live}
            onClick={submit}
          >
            {t("Confirm this consent action", "رضامندی کا یہی عمل تصدیق")}
          </button>
          <button
            data-help="consents.review"
            disabled={locked}
            onClick={() => setReview(undefined)}
          >
            {t("Back to consent input", "رضامندی کی معلومات پر واپس")}
          </button>
          <ErrorBox error={write.error} />
        </Modal>
      )}
    </section>
  );
}
