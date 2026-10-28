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
import * as imaging from "../generated/radiology_worklist";
import * as patients from "../generated/patient_search";
import { lookupStaff, type StaffLookupOut } from "../generated/radiology_worklist";
import { resolvePatientMaster } from "../patient-profile";
import { formatHospitalTime } from "../hospital-time";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import {
  radiologyAccess,
  imagingModalities,
  imagingActionAllowed,
  imagingSnapshot,
  radiologyBody,
  emptyRadiologyDraft,
  type RadiologyAction,
  type RadiologyDraft,
} from "../radiology-policy";
type Editor = {
  action: RadiologyAction;
  order: imaging.ImagingOrderDetailOut;
  patient: patients.PatientDetailOut;
  emergency: boolean;
  form: RadiologyDraft;
};
function ReviewFacts({
  body,
  doctor,
  findings,
}: {
  body: imaging.ImagingStatusIn | imaging.LinkIn | imaging.ReportIn;
  doctor?: StaffLookupOut;
  findings: imaging.CriticalFindingOut[];
}) {
  const rows: [string, string][] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) rows.push([label, value]);
  };
  if ("report_text" in body) {
    add(t("Final report text", "حتمی رپورٹ کا متن"), body.report_text);
    add(
      t("Critical imaging finding", "اہم عکس نتیجہ"),
      findings.find((f) => f.finding_id === body.critical_finding_id)?.name,
    );
    add(
      t("Critical finding note", "اہم نتیجے کا نوٹ"),
      body.critical_finding_note,
    );
  } else if ("status" in body) {
    add(t("Next examination stage", "اگلا معائنہ مرحلہ"), tr(body.status));
    add(
      t("Patient identity method", "مریض شناخت کا طریقہ"),
      body.identity_check ? tr(body.identity_check) : null,
    );
    add(
      t("Patient wristband barcode", "مریض کی پٹی بارکوڈ"),
      body.wristband_code,
    );
    add(
      t("Identity / emergency note", "شناخت / ہنگامی نوٹ"),
      body.identity_note,
    );
    if (body.site_confirmed)
      add(
        t("Site and side", "جگہ اور سمت"),
        t("Checked against this order", "اسی آرڈر سے جانچ شدہ"),
      );
    add(
      t("Pregnancy status", "حمل کی حالت"),
      body.pregnancy_status ? tr(body.pregnancy_status) : null,
    );
    add(t("Pregnancy decision", "حمل کا فیصلہ"), body.pregnancy_note);
    if (body.status === "Completed")
      add(
        t("Contrast outcome", "کانٹراسٹ کی صورت"),
        body.contrast || t("No contrast given", "کانٹراسٹ نہیں دیا"),
      );
    if (body.contrast)
      add(
        t("Doctor present", "موجود ڈاکٹر"),
        doctor
          ? `${doctor.full_name} · ${doctor.registration}`
          : t("Not recorded", "درج نہیں"),
      );
    add(t("Cancellation reason", "منسوخی کی وجہ"), body.reason);
  } else {
    add(
      t("Study lookup method", "مطالعہ تلاش کا طریقہ"),
      body.orthanc_study_id
        ? t("Use actual PACS identifiers", "اصل پیکس نمبر استعمال")
        : t("Find by this accession", "اسی ایکسیشن سے تلاش"),
    );
    add(t("Orthanc study ID", "آرتھینک مطالعہ نمبر"), body.orthanc_study_id);
  }
  return (
    <dl className="details">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd dir="auto" style={{ whiteSpace: "pre-wrap" }}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
const actionName = (a: RadiologyAction) =>
  ({
    Scheduled: t("Schedule examination", "معائنہ کا وقت مقرر کریں"),
    InProgress: t("Start examination", "معائنہ شروع کریں"),
    Completed: t("Complete examination", "معائنہ مکمل کریں"),
    Cancelled: t("Cancel order", "آرڈر منسوخ کریں"),
    link: t("Link PACS study", "پیکس مطالعہ جوڑیں"),
    report: t("Enter final report", "حتمی رپورٹ درج کریں"),
  })[a];
export function RadiologyWorklist({
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
  const can = (p: string) => user.permissions.includes(p),
    view = establishment.views.screens.find(
      (x) => x.screen_id === "radiology_worklist",
    )?.view;
  const access = radiologyAccess(view, user.permissions),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [listRevision, setListRevision] = useState(0),
    [status, setStatus] = useState(""),
    [modality, setModality] = useState(""),
    [find, setFind] = useState(""),
    [lookup, setLookup] = useState(""),
    [id, setId] = useState(0);
  const [editor, setEditor] = useState<Editor>(),
    [review, setReview] = useState<
      imaging.ImagingStatusIn | imaging.LinkIn | imaging.ReportIn
    >(),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [printing, setPrinting] = useState(false),
    [critical, setCritical] = useState<number>();
  const [doctorQuery, setDoctorQuery] = useState(""),
    [doctorRows, setDoctorRows] = useState<StaffLookupOut[]>([]),
    [doctorBusy, setDoctorBusy] = useState(false),
    [chosenDoctor, setChosenDoctor] = useState<StaffLookupOut>();
  const doctorEpoch = useRef(0);
  const [bandCheck, setBandCheck] = useState<imaging.IdentityVerifyOut>(),
    [bandKey, setBandKey] = useState(""),
    [bandBusy, setBandBusy] = useState(false);
  const printFlight = useRef(false),
    bandFlight = useRef(false),
    editorRef = useRef(editor);
  editorRef.current = editor;
  const list = useLoad(
    () =>
      access.list
        ? imaging.worklistImaging({
            status: (status || undefined) as "Ordered" | undefined,
            modality: (modality || undefined) as "CT" | undefined,
          })
        : Promise.resolve([]),
    [access.list, status, modality, listRevision, revision],
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
      order && can("patient.view")
        ? resolvePatientMaster(order.patient_id, patients.getPatient)
        : Promise.resolve(undefined),
    [order?.patient_id, revision, can("patient.view")],
  );
  const patient = !profile.loading && !profile.error ? profile.data : undefined;
  const patientMatches =
    !!order &&
    !!patient &&
    patient.patient_id === order.patient_id &&
    patient.mrn === order.mrn;
  const findings = useLoad(
    () =>
      access.visible && can("imaging.report.enter")
        ? imaging.listFindings({ active_only: true })
        : Promise.resolve([]),
    [access.visible, can("imaging.report.enter"), revision],
  );
  const report = useLoad(
    () =>
      order?.status === "Reported"
        ? imaging.reportPrintImagingOrdersPayload(order.imaging_order_id)
        : Promise.resolve(undefined),
    [order?.imaging_order_id, order?.row_version, revision],
  );
  const signed =
    !report.loading &&
    !report.error &&
    report.data?.document_type === "imaging_report" &&
    report.data.fields.order.imaging_order_id === id &&
    !!report.data.fields.order.reported_stamp;
  const time = (v: string | null | undefined) =>
    v
      ? timeZone
        ? formatHospitalTime(v, timeZone)
        : v
      : t("Not recorded", "درج نہیں");
  const write = useClinicalWrite(
    user,
    `radiology:${id}`,
    async (value, command) => {
      setEditor(undefined);
      setReview(undefined);
      setBandCheck(undefined);
      setBandKey("");
      setRevision((n) => n + 1);
      setNotice(
        t(
          "Confirmed on the server. Read the updated order; printing is separate.",
          "سرور پر تصدیق ہو گئی۔ تازہ آرڈر دیکھیں؛ پرنٹ الگ ہے۔",
        ),
      );
      if (
        command.path.endsWith("/report") &&
        ((command.body as imaging.ReportIn).critical_finding_id ||
          (command.body as imaging.ReportIn).critical_finding_note)
      ) {
        setCritical(0);
        const fresh = await imaging.getOrder(
          (value as imaging.ImagingOrderOut).imaging_order_id,
        );
        setCritical(fresh.critical_result_id ?? undefined);
      }
    },
  );
  const locked = write.blocked || printing,
    selected = useRef({ id, patientId: order?.patient_id });
  selected.current = { id, patientId: order?.patient_id };
  const noPacs = write.error instanceof ApiError && write.error.response.error?.code === "PACS_NOT_CONFIGURED";
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshList = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setListRevision((n) => n + 1), 250);
    };
    const unsub = window.terminal.subscribe((e) => {
      if (e.type === "stream" && e.status === "Live" && e.resync) {
        refreshList();
        setRevision((n) => n + 1);
        setBandCheck(undefined);
      }
      if (e.type !== "event") return;
      if (
        ["imaging.order.created", "critical_result.updated"].includes(
          e.event_type,
        )
      ) {
        refreshList();
        if (
          e.payload?.imaging_order_id === selected.current.id ||
          (e.event_type === "critical_result.updated" &&
            e.payload?.source === "Imaging" &&
            e.payload.patient_id === selected.current.patientId)
        )
          setRevision((n) => n + 1);
      }
      if (
        ["patient.merged", "death.recorded", "patient.death.recorded"].includes(
          e.event_type,
        ) &&
        e.payload?.patient_id === selected.current.patientId
      ) {
        setRevision((n) => n + 1);
        setBandCheck(undefined);
      }
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!locked) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [locked]);
  const changed =
    !!editor &&
    !!order &&
    imagingSnapshot(editor.order) !== imagingSnapshot(order);
  function open(id: number) {
    if (locked) return;
    setId(id);
    setLookup(String(id));
    setError(undefined);
    setNotice("");
    setCritical(undefined);
    setRevision((n) => n + 1);
  }
  function begin(action: RadiologyAction) {
    if (
      !order ||
      !patientMatches ||
      !patient ||
      locked ||
      !live ||
      !imagingActionAllowed(order, action)
    )
      return;
    if (action === "report" ? !access.report : !access.update) return;
    setEditor({
      action,
      order: structuredClone(order),
      patient: structuredClone(patient),
      emergency: !!list.data?.find((x) => x.imaging_order_id === id)
        ?.is_emergency,
      form: emptyRadiologyDraft(),
    });
    setReview(undefined);
    setError(undefined);
    setBandCheck(undefined);
    setBandKey("");
    setDoctorQuery("");
    setDoctorRows([]);
    setDoctorBusy(false);
    setChosenDoctor(undefined);
    doctorEpoch.current++;
  }
  function field<K extends keyof RadiologyDraft>(
    key: K,
    value: RadiologyDraft[K],
  ) {
    if (!editor || write.blocked || review) return;
    setEditor({ ...editor, form: { ...editor.form, [key]: value } });
    if (key === "band" || key === "identity") {
      setBandCheck(undefined);
      setBandKey("");
    }
  }
  function close() {
    if (locked) return;
    if (
      editor &&
      JSON.stringify(editor.form) !== JSON.stringify(emptyRadiologyDraft()) &&
      !window.confirm(
        t(
          "Discard this unsaved examination draft?",
          "معائنہ کا غیر محفوظ مسودہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    setEditor(undefined);
    setReview(undefined);
    setBandCheck(undefined);
    doctorEpoch.current++;
    setDoctorBusy(false);
  }
  async function verifyBand() {
    const ed = editor;
    if (!ed || bandFlight.current || write.blocked || !can("patient.view"))
      return;
    bandFlight.current = true;
    setBandBusy(true);
    setBandCheck(undefined);
    setError(undefined);
    try {
      const code = ed.form.band.trim();
      if (code.length < 3 || code.length > 80)
        throw Error(
          t(
            "Scan this patient’s wristband (3–80 characters).",
            "اسی مریض کی پٹی اسکین کریں (3تا80حروف)۔",
          ),
        );
      const result = await imaging.verifyWristband({
        code,
        patient_id: ed.patient.patient_id,
        ...(ed.order.admission_id
          ? { admission_id: ed.order.admission_id }
          : {}),
      });
      if (editorRef.current === ed) {
        setBandCheck(result);
        setBandKey(code);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBandBusy(false);
      bandFlight.current = false;
    }
  }
  function prepare() {
    if (!editor || locked || changed) return;
    setError(undefined);
    try {
      if (editor.action === "report" && (findings.loading || findings.error))
        throw Error(
          t(
            "Refresh the critical findings list before reviewing a report.",
            "رپورٹ جائزے سے پہلے اہم نتائج کی فہرست تازہ کریں۔",
          ),
        );
      const body = radiologyBody(
        editor.action,
        editor.order,
        editor.form,
        findings.data || [],
        !!bandCheck?.match &&
          bandCheck.expected_patient.patient_id === editor.patient.patient_id &&
          bandKey === editor.form.band.trim(),
        editor.emergency,
      );
      if (
        editor.action === "Completed" &&
        editor.form.contrastChoice === "Given" &&
        (!chosenDoctor ||
          String(chosenDoctor.employee_id) !== editor.form.doctorId)
      )
        throw Error(
          t(
            "Select the actual PMDC doctor physically present from the staff search.",
            "واقعی موجود پی ایم ڈی سی ڈاکٹر عملے کی تلاش سے چنیں۔",
          ),
        );
      setReview(body);
    } catch (e) {
      setError(e);
    }
  }
  function submit() {
    const ed = editor,
      body = review;
    if (!ed || !body || write.blocked || !live || changed) return;
    const path =
      ed.action === "link"
        ? "link-study"
        : ed.action === "report"
          ? "report"
          : "status";
    const permission =
      ed.action === "report" ? "imaging.report.enter" : "imaging.order.update";
    write.start(
      {
        method: "POST",
        path: `/imaging/orders/${ed.order.imaging_order_id}/${path}`,
        body,
        permission,
        protection: "idempotent",
        reconcilePath: `/imaging/orders/${ed.order.imaging_order_id}`,
        label: actionName(ed.action) + " · " + ed.order.order_number,
      },
      async () => {
        const [me, est, fresh, p] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          imaging.getOrder(ed.order.imaging_order_id),
          resolvePatientMaster(ed.order.patient_id, patients.getPatient),
        ]);
        const a = radiologyAccess(
          est.views.screens.find((x) => x.screen_id === "radiology_worklist")
            ?.view,
          me.permissions,
        );
        if (
          !live ||
          me.user_id !== user.user_id ||
          (ed.action === "report" ? !a.report : !a.update) ||
          imagingSnapshot(fresh) !== imagingSnapshot(ed.order) ||
          !p ||
          p.patient_id !== ed.patient.patient_id ||
          p.row_version !== ed.patient.row_version
        )
          throw Error(
            t(
              "The patient, order, permission or service changed. Close this draft and review the current order.",
              "مریض، آرڈر، اجازت یا خدمت بدلی۔ مسودہ بند کرکے تازہ آرڈر کا جائزہ لیں۔",
            ),
          );
        if (
          ed.action === "InProgress" &&
          ed.form.identity === "WristbandScan"
        ) {
          const band = await imaging.verifyWristband({
            code: ed.form.band.trim(),
            patient_id: p.patient_id,
            ...(fresh.admission_id ? { admission_id: fresh.admission_id } : {}),
          });
          if (!band.match || band.expected_patient.patient_id !== p.patient_id)
            throw Error(
              t(
                "STOP: the wristband does not match this patient.",
                "رکیں: پٹی اسی مریض کی نہیں۔",
              ),
            );
        }
        if (
          ed.action === "report" &&
          (body as imaging.ReportIn).critical_finding_id
        ) {
          const f = (await imaging.listFindings({ active_only: true })).find(
            (x) =>
              x.finding_id === (body as imaging.ReportIn).critical_finding_id,
          );
          if (!f || (f.modality && f.modality !== fresh.modality))
            throw Error(
              t(
                "The critical finding changed. Refresh and review again.",
                "اہم نتیجہ بدل گیا۔ تازہ کرکے پھر جائزہ لیں۔",
              ),
            );
        }
      },
    );
  }
  async function documentAction(
    kind: "print" | "save" | "original" | "preview" | "viewer",
  ) {
    if (!order || locked || printFlight.current) return;
    printFlight.current = true;
    setPrinting(true);
    setError(undefined);
    try {
      const r =
        kind === "viewer"
          ? await call("pacs-viewer", { orderId: id })
          : kind === "original" || kind === "preview"
            ? await call("clinical-pdf", {
                path: `/imaging/orders/${id}/report/pdf`,
                preview: kind === "preview",
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
            : r.opened
              ? t("Document opened.", "دستاویز کھل گئی۔")
              : t(
                  "Cancelled; the examination and report were not repeated.",
                  "منسوخ؛ معائنہ اور رپورٹ نہیں دہرائے۔",
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
          "Imaging work is unavailable in this service view.",
          "اس خدمت منظر میں عکس کا کام دستیاب نہیں۔",
        )}
      </Empty>
    );
  const rows =
    !list.loading && !list.error
      ? (list.data || []).filter((x) =>
          `${x.order_number} ${x.accession_number} ${x.patient_name} ${x.mrn} ${x.body_part || ""}`
            .toLowerCase()
            .includes(find.trim().toLowerCase()),
        )
      : [];
  return (
    <section
      data-help-screen="radiology_worklist"
      data-write-pending={locked}
      data-unsaved={!!editor}
      className="workspace-screen"
    >
      <header className="section-heading">
        <div>
          <h1>{t("Imaging worklist", "عکس نگاری کی فہرست")}</h1>
          <p>
            {t(
              "Identify the patient, check the site and side, perform the examination and hand the final report to the clinical team.",
              "مریض کی شناخت، جگہ و سمت چیک، معائنہ اور حتمی رپورٹ طبی ٹیم کو دیں۔",
            )}
          </p>
        </div>
        <button
          data-help="radiology.refresh"
          disabled={locked}
          onClick={() => {
            setRevision((n) => n + 1);
            setBandCheck(undefined);
          }}
        >
          {t("Refresh imaging", "عکس معلومات تازہ کریں")}
        </button>
      </header>
      <p role="status">
        {tr(connected ? stream : "Offline")} ·{" "}
        {view === "records"
          ? t(
              "Records only — open an existing order below.",
              "صرف ریکارڈ — موجودہ آرڈر نیچے کھولیں۔",
            )
          : view === "open_work"
            ? t(
                "No new imaging work; finish existing orders.",
                "نیا عکس کام نہیں؛ موجودہ آرڈر مکمل کریں۔",
              )
            : t(
                "Radiology — current examination orders",
                "ریڈیالوجی — موجودہ معائنہ آرڈر",
              )}
      </p>
      <ErrorBox error={error} />
      {notice && <p role="status">{notice}</p>}
      {critical !== undefined && (
        <aside className="notice error" role="alert">
          {t(
            "Critical finding: phone the responsible doctor NOW and record the actual communication in Critical results (Radiology). Saving this report did not make that call.",
            "اہم نتیجہ: ذمہ دار ڈاکٹر کو ابھی فون کریں اور اصل اطلاع ریڈیالوجی اہم نتائج میں درج کریں۔ رپورٹ محفوظ کرنے سے کال نہیں ہوئی۔",
          )}
          {critical > 0 && <> · #{critical}</>}
        </aside>
      )}
      {!editor && (
        <ClinicalWriteFeedback
          write={write}
          onReviewed={() => setRevision((n) => n + 1)}
        />
      )}
      <fieldset disabled={locked || !!editor}>
        <section className="card">
          <h2>
            {t("Find an existing imaging order", "موجودہ عکس آرڈر تلاش کریں")}
          </h2>
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                /^[1-9]\d*$/.test(lookup) &&
                Number.isSafeInteger(Number(lookup))
              )
                open(Number(lookup));
              else
                setError(
                  new Error(
                    t(
                      "Enter an actual positive imaging order ID.",
                      "اصل مثبت عکس آرڈر نمبر لکھیں۔",
                    ),
                  ),
                );
            }}
          >
            <Field label={t("Known imaging order ID", "اصل عکس آرڈر نمبر")}>
              <input
                data-help="radiology.lookup"
                inputMode="numeric"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
              />
            </Field>
            <button data-help="radiology.lookup">
              {t("Open imaging order", "عکس آرڈر کھولیں")}
            </button>
          </form>
        </section>
        {access.list && (
          <section className="card">
            <h2>{t("Examinations to perform", "کرنے کے معائنے")}</h2>
            <div className="form-grid">
              <Field label={t("Examination status", "معائنہ حالت")}>
                <select
                  data-help="radiology.filter"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">
                    {t("All open stages", "تمام کھلے مراحل")}
                  </option>
                  {["Ordered", "Scheduled", "InProgress", "Completed"].map(
                    (v) => (
                      <option key={v} value={v}>
                        {tr(v)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label={t("Modality", "عکس طریقہ")}>
                <select
                  data-help="radiology.filter"
                  value={modality}
                  onChange={(e) => setModality(e.target.value)}
                >
                  <option value="">{t("All modalities", "تمام طریقے")}</option>
                  {imagingModalities.map((v) => (
                    <option key={v} value={v}>
                      {tr(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Find in this worklist", "اس فہرست میں تلاش")}>
                <input
                  data-help="radiology.find"
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                />
              </Field>
            </div>
            <LoadState {...list} retry={list.reload} />
            {!list.loading && !list.error && !rows.length && (
              <Empty>
                {t(
                  "No matching open examinations. Clear the filters, refresh, or wait for a new doctor’s order. Use the known order lookup for history.",
                  "مطابق کھلا معائنہ نہیں۔ شرط صاف، تازہ یا نئے معالج آرڈر کا انتظار کریں۔ تاریخ کو اصل آرڈر نمبر کھولیں۔",
                )}
              </Empty>
            )}
            {!!rows.length && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        t("Patient / order", "مریض / آرڈر"),
                        t("Accession / examination", "ایکسیشن / معائنہ"),
                        t("Priority / safety", "ترجیح / حفاظت"),
                        t("Transport / due", "آمد / مقرر وقت"),
                        t("Action", "عمل"),
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr
                        key={x.imaging_order_id}
                        className={x.is_overdue ? "error" : ""}
                      >
                        <td>
                          {x.patient_name}
                          <br />
                          <bdi>{x.mrn}</bdi>
                          <br />
                          {x.order_number} · {tr(x.status)}
                        </td>
                        <td>
                          <strong>
                            <bdi>{x.accession_number}</bdi>
                          </strong>
                          <br />
                          {tr(x.modality)} ·{" "}
                          {x.body_part ||
                            t("Site not recorded", "جگہ درج نہیں")}{" "}
                          · {tr(x.laterality || "Not recorded")}
                          <br />
                          {x.has_study
                            ? t("Study linked", "مطالعہ منسلک")
                            : t("Study not linked", "مطالعہ منسلک نہیں")}
                        </td>
                        <td>
                          {x.is_emergency && (
                            <strong>{t("Emergency", "ہنگامی")} · </strong>
                          )}
                          {tr(x.priority)}
                          <br />
                          {x.pregnancy_check_needed && (
                            <strong>
                              {t(
                                "Pregnancy question required",
                                "حمل کا سوال لازم",
                              )}
                            </strong>
                          )}
                        </td>
                        <td>
                          {tr(x.transport || "Not recorded")} ·{" "}
                          {tr(x.escort || "Not recorded")}
                          <br />
                          <bdi>{time(x.due_at)}</bdi>
                          {x.is_overdue && (
                            <strong> · {t("OVERDUE", "تاخیر")}</strong>
                          )}
                        </td>
                        <td>
                          <button
                            data-help="radiology.select"
                            onClick={() => open(x.imaging_order_id)}
                          >
                            {t("Open examination", "معائنہ کھولیں")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {!!id && <LoadState {...detail} retry={detail.reload} />}
        {order && (
          <>
            <section className="card">
              <h2>
                {order.patient_name} · <bdi>{order.mrn}</bdi>
              </h2>
              <h3>
                {t("Accession number", "ایکسیشن نمبر")}:{" "}
                <bdi>{order.accession_number}</bdi>
              </h3>
              <p>
                {t(
                  "Use this exact accession at the modality console so the study can link.",
                  "مطالعہ جوڑنے کے لیے مشین کنسول پر یہی اصل ایکسیشن استعمال کریں۔",
                )}
              </p>
              <p>
                {order.order_number} · {tr(order.status)} · {tr(order.modality)}{" "}
                · {order.body_part || t("Site not recorded", "جگہ درج نہیں")} ·{" "}
                {tr(order.laterality || "Not recorded")}
              </p>
              <p>
                {t("Clinical indication", "طبی وجہ")}:{" "}
                {order.clinical_indication || t("Not recorded", "درج نہیں")}
              </p>
              <p>
                {t("Ordering doctor", "آرڈر کرنے والا ڈاکٹر")}:{" "}
                {order.doctor_name} · {tr(order.priority)} ·{" "}
                {t("Transport / escort", "آمد / ساتھ عملہ")}:{" "}
                {tr(order.transport || "Not recorded")} /{" "}
                {tr(order.escort || "Not recorded")}
              </p>
              <p>
                {t("Examination due", "معائنہ مقرر وقت")}:{" "}
                <bdi>{time(order.perform_due_at)}</bdi> ·{" "}
                {t("Report due", "رپورٹ مقرر وقت")}:{" "}
                <bdi>{time(order.report_due_at)}</bdi>
              </p>
              <LoadState {...profile} retry={profile.reload} />
              {patient && (
                <>
                  <p>
                    {patient.full_name} · <bdi>{patient.mrn}</bdi> ·{" "}
                    {tr(patient.gender || "unknown")} ·{" "}
                    {t("Age / date of birth", "عمر / تاریخ پیدائش")}:{" "}
                    <bdi>
                      {patient.dob ??
                        patient.age_years ??
                        t("Not recorded", "درج نہیں")}
                    </bdi>
                  </p>
                  <p>
                    {t("Allergies", "الرجی")}:{" "}
                    {patient.allergies || t("Not recorded", "درج نہیں")} ·{" "}
                    {t("Blood group", "خون کا گروپ")}:{" "}
                    <bdi>
                      {patient.blood_group || t("Not recorded", "درج نہیں")}
                    </bdi>
                  </p>
                  {patient.is_deceased && (
                    <p className="error">
                      {t(
                        "Deceased — no new examination. Existing documentation needs the responsible clinician’s review.",
                        "وفات — نیا معائنہ نہیں۔ سابق دستاویز پر ذمہ دار معالج کا جائزہ لازم۔",
                      )}
                    </p>
                  )}
                  {!!patient.mlc_numbers.length && (
                    <p className="notice warning">
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
                    <p className="notice warning">
                      {patient.outstanding.banner_text}
                    </p>
                  )}
                </>
              )}
              {!patientMatches && (
                <p className="notice warning">
                  {t(
                    "Patient context is unavailable or merged. Ask reception to reconcile the order with the master record; do not start this examination.",
                    "مریض کی شناخت دستیاب نہیں یا ضم ہے۔ استقبالیہ سے آرڈر و مرکزی ریکارڈ ملائیں؛ معائنہ شروع نہ کریں۔",
                  )}
                </p>
              )}
              <p>
                {t(
                  "Recorded pre-examination checks",
                  "درج معائنہ سے پہلے جانچ",
                )}
                : {tr(order.identity_check || "Not recorded")} ·{" "}
                {order.site_confirmed
                  ? t("Site / side confirmed", "جگہ / سمت تصدیق")
                  : t("Site / side not confirmed", "جگہ / سمت غیر تصدیق")}{" "}
                · {tr(order.pregnancy_status || "Not recorded")}
              </p>
              {order.identity_note && <p>{order.identity_note}</p>}
              {order.pregnancy_note && <p>{order.pregnancy_note}</p>}
              {order.contrast && (
                <p>
                  {t("Contrast / doctor present", "کانٹراسٹ / موجود ڈاکٹر")}:{" "}
                  {order.contrast} ·{" "}
                  {order.contrast_doctor_name || order.contrast_doctor_id}
                </p>
              )}
              {order.cancel_reason && (
                <p>
                  {t("Cancellation reason", "منسوخی کی وجہ")}:{" "}
                  {order.cancel_reason}
                </p>
              )}
              <div className="actions">
                {(
                  [
                    "Scheduled",
                    "InProgress",
                    "Completed",
                    "Cancelled",
                    "link",
                    "report",
                  ] as RadiologyAction[]
                )
                  .filter(
                    (a) =>
                      imagingActionAllowed(order, a) &&
                      (a === "report" ? access.report : access.update),
                  )
                  .map((a) =>
                    a === "report" ? (
                      <button
                        data-help="radiology.report"
                        key={a}
                        disabled={!live || !patientMatches}
                        onClick={() => begin(a)}
                      >
                        {actionName(a)}
                      </button>
                    ) : a === "link" ? (
                      <button
                        data-help="radiology.link"
                        key={a}
                        disabled={
                          !live || !patientMatches || patient?.is_deceased
                        }
                        onClick={() => begin(a)}
                      >
                        {actionName(a)}
                      </button>
                    ) : (
                      <button
                        data-help="radiology.status"
                        key={a}
                        disabled={
                          !live ||
                          !patientMatches ||
                          ((a === "InProgress" || a === "Completed") &&
                            patient?.is_deceased)
                        }
                        onClick={() => begin(a)}
                      >
                        {actionName(a)}
                      </button>
                    ),
                  )}
              </div>
              {order.viewer_url ? (
                <button
                  data-help="radiology.viewer"
                  onClick={() => void documentAction("viewer")}
                >
                  {t("Open PACS viewer", "پیکس ویور کھولیں")}
                </button>
              ) : (
                <p>
                  {t(
                    "No PACS viewer link is available. Check the study link with radiology; a missing link is not a missing report.",
                    "پیکس ویور ربط دستیاب نہیں۔ ریڈیالوجی سے مطالعہ ربط چیک؛ غائب ربط کا مطلب غائب رپورٹ نہیں۔",
                  )}
                </p>
              )}
            </section>
            {order.status === "Reported" && (
              <section className="card">
                <h2>{t("Final radiology report", "حتمی ریڈیالوجی رپورٹ")}</h2>
                <p dir="auto" style={{ whiteSpace: "pre-wrap" }}>
                  {order.report_text}
                </p>
                {order.reported_stamp && <p>{order.reported_stamp.text}</p>}
                {(order.critical_finding_name ||
                  order.critical_finding_note) && (
                  <p className="notice error">
                    {t("Critical finding", "اہم نتیجہ")}:{" "}
                    {order.critical_finding_name} {order.critical_finding_note}{" "}
                    ·{" "}
                    {t(
                      "Phone and record the clinical handover.",
                      "فون کرکے طبی حوالگی درج کریں۔",
                    )}
                  </p>
                )}
                <LoadState {...report} retry={report.reload} />
                <div className="actions">
                  <button
                    data-help="radiology.print"
                    disabled={!signed}
                    onClick={() => void documentAction("print")}
                  >
                    {t("Print final report", "حتمی رپورٹ پرنٹ کریں")}
                  </button>
                  <button
                    data-help="radiology.print"
                    disabled={!signed}
                    onClick={() => void documentAction("save")}
                  >
                    {t("Save report PDF", "رپورٹ پی ڈی ایف محفوظ کریں")}
                  </button>
                  <button
                    data-help="radiology.original"
                    disabled={!signed}
                    onClick={() => void documentAction("preview")}
                  >
                    {t("Preview server PDF", "سرور پی ڈی ایف دیکھیں")}
                  </button>
                  <button
                    data-help="radiology.original"
                    disabled={!signed}
                    onClick={() => void documentAction("original")}
                  >
                    {t("Save server PDF", "سرور پی ڈی ایف محفوظ کریں")}
                  </button>
                </div>
                <p>
                  {t(
                    "This report is final; it cannot be edited or deleted here. Printing never repeats the examination or report.",
                    "یہ رپورٹ حتمی ہے؛ یہاں ترمیم یا حذف نہیں۔ پرنٹ معائنہ یا رپورٹ دوبارہ نہیں کرتا۔",
                  )}
                </p>
              </section>
            )}
          </>
        )}
      </fieldset>
      {editor && (
        <Modal
          title={actionName(editor.action)}
          closable={!locked}
          onClose={close}
        >
          <p>
            <strong>
              {editor.order.patient_name} · <bdi>{editor.order.mrn}</bdi>
            </strong>
            <br />
            {editor.order.order_number} ·{" "}
            <bdi>{editor.order.accession_number}</bdi> ·{" "}
            {tr(editor.order.modality)} · {editor.order.body_part} ·{" "}
            {tr(editor.order.laterality || "Not recorded")}
          </p>
          {changed && (
            <p role="alert" className="error">
              {t(
                "This order changed while the draft was open. Close and reopen it; no action was repeated.",
                "مسودہ کھلا تھا تو آرڈر بدل گیا۔ بند کرکے پھر کھولیں؛ عمل نہیں دہرایا۔",
              )}
            </p>
          )}
          <fieldset disabled={locked || !!review}>
            {editor.action === "InProgress" && (
              <>
                <Field
                  label={t("Patient identity method", "مریض شناخت کا طریقہ")}
                >
                  <select
                    data-help="radiology.identity"
                    value={editor.form.identity}
                    onChange={(e) => field("identity", e.target.value)}
                  >
                    <option value="">
                      {t(
                        "Choose after identifying the patient",
                        "مریض شناخت کے بعد چنیں",
                      )}
                    </option>
                    <option value="WristbandScan">
                      {t("Scan wristband", "پٹی اسکین")}
                    </option>
                    <option value="TwoIdentifiers">
                      {t("Ask two identifiers", "دو شناخت پوچھیں")}
                    </option>
                    {editor.emergency && (
                      <option value="EmergencyOverride">
                        {t(
                          "Emergency identification exception",
                          "ہنگامی شناخت استثنا",
                        )}
                      </option>
                    )}
                  </select>
                </Field>
                {editor.form.identity === "WristbandScan" && (
                  <>
                    <Field
                      label={t(
                        "Patient wristband barcode",
                        "مریض کی پٹی بارکوڈ",
                      )}
                    >
                      <input
                        data-help="radiology.band"
                        autoFocus
                        maxLength={80}
                        value={editor.form.band}
                        onChange={(e) => field("band", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void verifyBand();
                          }
                        }}
                      />
                    </Field>
                    <button
                      data-help="radiology.band"
                      disabled={bandBusy || !can("patient.view")}
                      onClick={() => void verifyBand()}
                    >
                      {t(
                        "Verify this patient wristband",
                        "اسی مریض کی پٹی چیک کریں",
                      )}
                    </button>
                    {bandCheck && (
                      <p className={bandCheck.match ? "notice" : "error"}>
                        {bandCheck.match
                          ? t(
                              "Band matches this patient.",
                              "پٹی اسی مریض کی ہے۔",
                            )
                          : t(
                              "STOP: wrong patient wristband.",
                              "رکیں: غلط مریض کی پٹی۔",
                            )}{" "}
                        · <bdi>{bandCheck.scanned_mrn}</bdi>
                      </p>
                    )}
                  </>
                )}
                {editor.form.identity === "TwoIdentifiers" && (
                  <label>
                    <input
                      data-help="radiology.identity"
                      type="checkbox"
                      checked={editor.form.asked}
                      onChange={(e) => field("asked", e.target.checked)}
                    />
                    {t(
                      "I asked and matched name and MRN or date of birth.",
                      "میں نے نام اور ایم آر این یا تاریخ پیدائش پوچھ کر ملائی۔",
                    )}
                  </label>
                )}
                <Field
                  label={t("Identity / emergency note", "شناخت / ہنگامی نوٹ")}
                >
                  <textarea
                    data-help="radiology.identity"
                    maxLength={300}
                    value={editor.form.identityNote}
                    onChange={(e) => field("identityNote", e.target.value)}
                  />
                </Field>
                <label>
                  <input
                    data-help="radiology.site"
                    type="checkbox"
                    checked={editor.form.site}
                    onChange={(e) => field("site", e.target.checked)}
                  />
                  {t(
                    "I checked and confirmed the site and side against this order.",
                    "میں نے اس آرڈر کے مطابق جگہ و سمت چیک کرکے تصدیق کی۔",
                  )}
                </label>
                {editor.order.pregnancy_check_needed && (
                  <>
                    <Field label={t("Pregnancy status", "حمل کی حالت")}>
                      <select
                        data-help="radiology.pregnancy"
                        value={editor.form.pregnancy}
                        onChange={(e) => field("pregnancy", e.target.value)}
                      >
                        <option value="">
                          {t("Ask and choose", "پوچھ کر چنیں")}
                        </option>
                        {[
                          ["NotPregnant", t("Not pregnant", "حاملہ نہیں")],
                          ["Pregnant", t("Pregnant", "حاملہ")],
                          ["Unknown", t("Unknown", "نامعلوم")],
                          ["NotApplicable", t("Not applicable", "لاگو نہیں")],
                        ].map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={t(
                        "Pregnancy decision and responsible clinician",
                        "حمل کا فیصلہ اور ذمہ دار معالج",
                      )}
                    >
                      <textarea
                        data-help="radiology.pregnancy"
                        maxLength={500}
                        value={editor.form.pregnancyNote}
                        onChange={(e) => field("pregnancyNote", e.target.value)}
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            {editor.action === "Cancelled" && (
              <Field label={t("Cancellation reason", "منسوخی کی وجہ")}>
                <textarea
                  data-help="radiology.cancel"
                  autoFocus
                  maxLength={1000}
                  value={editor.form.reason}
                  onChange={(e) => field("reason", e.target.value)}
                />
              </Field>
            )}
            {editor.action === "Completed" && (
              <>
                <Field
                  label={t("Was contrast given?", "کیا کانٹراسٹ دیا گیا؟")}
                >
                  <select
                    data-help="radiology.contrast"
                    value={editor.form.contrastChoice}
                    onChange={(e) => field("contrastChoice", e.target.value)}
                  >
                    <option value="">
                      {t("Choose actual outcome", "اصل صورت چنیں")}
                    </option>
                    <option value="None">
                      {t("No contrast given", "کانٹراسٹ نہیں دیا")}
                    </option>
                    <option value="Given">
                      {t("Contrast given", "کانٹراسٹ دیا")}
                    </option>
                  </select>
                </Field>
                {editor.form.contrastChoice === "Given" && (
                  <>
                    <Field
                      label={t(
                        "Contrast agent, dose and route",
                        "کانٹراسٹ دوا، مقدار اور راستہ",
                      )}
                    >
                      <textarea
                        data-help="radiology.contrast"
                        maxLength={300}
                        value={editor.form.contrast}
                        onChange={(e) => field("contrast", e.target.value)}
                      />
                    </Field>
                    <Field
                      label={t(
                        "Find the doctor present",
                        "موجود ڈاکٹر تلاش کریں",
                      )}
                    >
                      <input
                        data-help="radiology.contrast"
                        value={doctorQuery}
                        onChange={(e) => {
                          setDoctorQuery(e.target.value);
                          setDoctorRows([]);
                          setDoctorBusy(false);
                          setChosenDoctor(undefined);
                          field("doctorId", "");
                          doctorEpoch.current++;
                        }}
                      />
                    </Field>
                    <button
                      data-help="radiology.contrast"
                      disabled={doctorBusy || doctorQuery.trim().length < 2}
                      onClick={() => {
                        const epoch = ++doctorEpoch.current;
                        setDoctorBusy(true);
                        setError(undefined);
                        setDoctorRows([]);
                        void lookupStaff({ q: doctorQuery.trim(), license_type: "PMDC", limit: 20 })
                          .then((rows) => {
                            if (epoch === doctorEpoch.current)
                              setDoctorRows(rows);
                          })
                          .catch(setError)
                          .finally(() => {
                            if (epoch === doctorEpoch.current)
                              setDoctorBusy(false);
                          });
                      }}
                    >
                      {t("Find doctor", "ڈاکٹر تلاش")}
                    </button>
                    {doctorRows.map((d) => (
                      <p key={d.employee_id}>
                        <button
                          data-help="radiology.contrast"
                          onClick={() => {
                            setChosenDoctor(d);
                            field("doctorId", String(d.employee_id));
                            setDoctorRows([]);
                          }}
                        >
                          {d.full_name} · {d.registration}
                        </button>
                      </p>
                    ))}
                    {chosenDoctor && (
                      <p>
                        {t("Doctor present", "موجود ڈاکٹر")}:{" "}
                        {chosenDoctor.full_name} · {chosenDoctor.registration}
                      </p>
                    )}
                    <p>
                      {t(
                        "Select the actual PMDC doctor physically present. The server checks clinical eligibility; a name or job title alone does not prove it.",
                        "واقعی موجود پی ایم ڈی سی ڈاکٹر چنیں۔ سرور طبی اہلیت چیک کرتا؛ نام یا عہدہ اکیلا ثبوت نہیں۔",
                      )}
                    </p>
                  </>
                )}
              </>
            )}
            {editor.action === "link" && (
              <>
                <p>
                  {t(
                    "Use the actual identifiers from the modality/PACS, or let the server find this accession. Linking never substitutes for patient/site/pregnancy checks.",
                    "مشین/پیکس کے اصل نمبر لیں یا سرور یہی ایکسیشن تلاش کرے۔ ربط مریض، جگہ، حمل جانچ کا بدل نہیں۔",
                  )}
                </p>
                {editor.order.status === "InProgress" && (
                  <p className="notice warning">
                    {t(
                      "Linking now completes the examination. If contrast was given, close this draft and Complete examination with its agent, dose, route and doctor FIRST.",
                      "اب ربط معائنہ مکمل کرتا ہے۔ کانٹراسٹ دیا ہو تو مسودہ بند کرکے پہلے معائنہ مکمل میں دوا، مقدار، راستہ اور ڈاکٹر درج کریں۔",
                    )}
                  </p>
                )}
                {editor.order.status === "InProgress" && (
                  <label>
                    <input
                      data-help="radiology.link"
                      type="checkbox"
                      checked={editor.form.linkCompletionChecked}
                      onChange={(e) =>
                        field("linkCompletionChecked", e.target.checked)
                      }
                    />
                    {t(
                      "No contrast was given; completing by study link is appropriate.",
                      "کانٹراسٹ نہیں دیا؛ مطالعہ جوڑ کر معائنہ مکمل کرنا مناسب ہے۔",
                    )}
                  </label>
                )}
                <Field label={t("Study lookup method", "مطالعہ تلاش کا طریقہ")}>
                  <select
                    data-help="radiology.link"
                    value={editor.form.linkMode}
                    onChange={(e) => field("linkMode", e.target.value)}
                  >
                    <option value="auto">
                      {t("Find by this accession", "اسی ایکسیشن سے تلاش")}
                    </option>
                    <option value="manual">
                      {t(
                        "Use actual PACS identifiers",
                        "اصل پیکس نمبر استعمال",
                      )}
                    </option>
                  </select>
                </Field>
                {editor.form.linkMode === "manual" && (
                  <>
                    <Field label={t("Orthanc study ID", "آرتھینک مطالعہ نمبر")}>
                      <input
                        data-help="radiology.link"
                        value={editor.form.orthanc}
                        onChange={(e) => field("orthanc", e.target.value)}
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            {editor.action === "report" && (
              <>
                <p className="notice warning">
                  {t(
                    "A report is final when confirmed. Your PMDC registration and RadiologyReporting privilege are checked by the server.",
                    "تصدیق پر رپورٹ حتمی ہے۔ سرور پی ایم ڈی سی رجسٹریشن اور رپورٹنگ استحقاق چیک کرتا ہے۔",
                  )}
                </p>
                <Field label={t("Final report text", "حتمی رپورٹ کا متن")}>
                  <textarea
                    data-help="radiology.report"
                    autoFocus
                    rows={8}
                    maxLength={20000}
                    value={editor.form.report}
                    onChange={(e) => field("report", e.target.value)}
                  />
                </Field>
                <LoadState {...findings} retry={findings.reload} />
                <Field
                  label={t(
                    "Critical imaging finding (optional)",
                    "اہم عکس نتیجہ (اختیاری)",
                  )}
                >
                  <select
                    data-help="radiology.finding"
                    value={editor.form.finding}
                    onChange={(e) => field("finding", e.target.value)}
                  >
                    <option value="">
                      {t("No finding selected", "کوئی نتیجہ منتخب نہیں")}
                    </option>
                    {(findings.data || [])
                      .filter(
                        (f) =>
                          f.is_active &&
                          (!f.modality || f.modality === editor.order.modality),
                      )
                      .map((f) => (
                        <option key={f.finding_id} value={f.finding_id}>
                          {f.name}
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
                    data-help="radiology.finding"
                    maxLength={1000}
                    value={editor.form.findingNote}
                    onChange={(e) => field("findingNote", e.target.value)}
                  />
                </Field>
                {(editor.form.finding || editor.form.findingNote.trim()) && (
                  <p className="error">
                    {t(
                      "Critical: phone the responsible doctor now and record the actual handover. A saved report does not make the call.",
                      "اہم: ذمہ دار ڈاکٹر کو ابھی فون اور اصل حوالگی درج کریں۔ محفوظ رپورٹ کال نہیں کرتی۔",
                    )}
                  </p>
                )}
              </>
            )}
          </fieldset>
          <ErrorBox error={error} />
          {review && (
            <section className="notice">
              <h3>{t("Review before confirming", "تصدیق سے پہلے جائزہ")}</h3>
              <p>
                {t(
                  "Check patient, accession, site, side and every proposed value. This action is separate from printing.",
                  "مریض، ایکسیشن، جگہ، سمت اور ہر قدر چیک کریں۔ یہ عمل پرنٹ سے الگ ہے۔",
                )}
              </p>
              <ReviewFacts
                body={review}
                doctor={chosenDoctor}
                findings={findings.data || []}
              />
            </section>
          )}
          <ClinicalWriteFeedback
            write={write}
            onReviewed={() => {
              setEditor(undefined);
              setReview(undefined);
              setRevision((n) => n + 1);
            }}
          />
          {noPacs && editor.action === "link" && !locked && imagingActionAllowed(editor.order, editor.order.status === "InProgress" ? "Completed" : "InProgress") && (
            <button data-help="radiology.link" onClick={async () => {
              try {
                const fresh = await imaging.getOrder(editor.order.imaging_order_id);
                setEditor({ ...editor, order: fresh, action: fresh.status === "InProgress" ? "Completed" : "InProgress" });
                setReview(undefined);
                setRevision(n => n + 1);
                write.clearError();
              } catch (cause) { setError(cause); }
            }}>
              {editor.order.status === "InProgress"
                ? t("Complete examination without images", "تصاویر کے بغیر معائنہ مکمل کریں")
                : t("Record examination checks, then complete without images", "معائنہ کی جانچ درج کریں، پھر تصاویر کے بغیر مکمل کریں")}
            </button>
          )}
          <div className="actions">
            {!review ? (
              <button
                data-help="radiology.review"
                disabled={locked || bandBusy || changed || !live}
                onClick={prepare}
              >
                {t("Review imaging action", "عکس عمل کا جائزہ")}
              </button>
            ) : (
              <>
                <button
                  data-help="radiology.confirm"
                  disabled={locked || changed || !live}
                  onClick={submit}
                >
                  {t("Confirm imaging action", "عکس عمل کی تصدیق")}
                </button>
                <button
                  data-help="radiology.review"
                  disabled={locked}
                  onClick={() => setReview(undefined)}
                >
                  {t("Back to draft", "مسودے پر واپس")}
                </button>
              </>
            )}
            <button
              data-help="radiology.discard"
              disabled={locked}
              onClick={close}
            >
              {t("Close examination draft", "معائنہ مسودہ بند کریں")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
