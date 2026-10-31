import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../bridge";
import {validationFields} from '../validation-fields';
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
import * as a from "../generated/pending_admissions";
import * as detailApi from "../generated/admission_detail";
import * as bedsApi from "../generated/admission_beds";
import * as panelApi from "../generated/admission_panels";
import * as patients from "../generated/patient_search";
import { resolvePatientMaster } from "../patient-profile";
import { formatHospitalTime } from "../hospital-time";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { RegistrationDocuments } from "./RegistrationDocuments";
import {
  admissionAccess,
  admissionActionAllowed,
  admissionPermission,
  admissionSnapshot,
  admissionPatientSnapshot,
  admissionBody,
  emptyAdmissionDraft,
  type AdmissionAction,
  type AdmissionDraft,
} from "../admissions-policy";
type Editor = {
  action: AdmissionAction;
  record: a.AdmissionDetailOut;
  person: patients.PatientDetailOut;
  form: AdmissionDraft;
};
const actionLabel = (v: AdmissionAction) =>
  ({
    allocate: t("Reserve a bed", "بستر محفوظ کریں"),
    overflow: t("Arrange overflow bed", "اضافی دوسرے وارڈ کا بستر"),
    waitlist: t("Add to ward waitlist", "وارڈ انتظار میں شامل کریں"),
    admit: t("Patient arrived at the bed", "مریض بستر پر پہنچ گیا"),
    cancel: t("Cancel this pending admission", "یہ منتظر داخلہ منسوخ کریں"),
    "confirm-billing": t(
      "Confirm billing arrangements",
      "بل کی ادائیگی کا انتظام تصدیق",
    ),
    "final-bill": t("Finalize this bill", "یہ بل حتمی کریں"),
    clear: t("Clear Billing Settlement", "بل کی کلیئرنس مکمل کریں"),
  })[v];
export function PendingAdmissions({
  user,
  establishment,
  connected,
  stream,
  timeZone,
  currency,
  initialAdmissionId=0,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
  currency?: string;
  initialAdmissionId?: number;
}) {
  const can = (p: string) => user.permissions.includes(p);
  const view = establishment.views.screens.find(
    (s) => s.screen_id === "pending_admissions",
  )?.view;
  const access = admissionAccess(view, user.permissions),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [ward, setWard] = useState(""),
    [tab, setTab] = useState("waiting"),
    [find, setFind] = useState(""),
    [lookup, setLookup] = useState(initialAdmissionId ? String(initialAdmissionId) : ""),
    [id, setId] = useState(initialAdmissionId);
  const [docContext, setDocContext] = useState<{
    admissionId: number;
    person: patients.PatientDetailOut;
  }>();
  const [editor, setEditor] = useState<Editor>(),
    [review, setReview] = useState<{ body: unknown }>(),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [docsPending, setDocsPending] = useState(false),
    [bill, setBill] = useState<a.InvoiceDetailOut>();
  const root = useRef<HTMLElement>(null),
    rebaseFlight = useRef(false),
    [rebasing, setRebasing] = useState(false),
    selected = useRef(id);
  selected.current = id;
  const list = useLoad(
    () =>
      access.read
        ? a.listAdmissions({ ward_id: ward ? Number(ward) : undefined })
        : Promise.resolve([]),
    [access.read, ward, revision],
  );
  const detail = useLoad(
    () =>
      access.read && id
        ? detailApi.getAdmission(id)
        : Promise.resolve(undefined),
    [access.read, id, revision],
  );
  const record =
    !detail.loading && !detail.error && detail.data?.admission_id === id
      ? detail.data
      : undefined;
  const profile = useLoad(
    () =>
      record && can("patient.view")
        ? resolvePatientMaster(record.patient_id, patients.getPatient)
        : Promise.resolve(undefined),
    [record?.patient_id, revision, can("patient.view")],
  );
  const person = !profile.loading && !profile.error ? profile.data : undefined;
  const identity =
    !!record &&
    !!person &&
    !profile.loading &&
    !profile.error;
  useEffect(() => {
    if (record && person && identity)
      setDocContext({ admissionId: record.admission_id, person });
  }, [record, person, identity]);
  const matrix = useLoad(
    () =>
      access.visible && can("ipd.bed.view")
        ? bedsApi.bedMatrix({ include_beds: true })
        : Promise.resolve(undefined),
    [access.visible, can("ipd.bed.view"), revision],
  );
  const panels = useLoad(
    () => (access.visible ? panelApi.panels() : Promise.resolve([])),
    [access.visible, revision],
  );
  const waitlist = useLoad(
    () =>
      access.read && ward ? a.wardWaitlist(Number(ward)) : Promise.resolve([]),
    [access.read, ward, revision],
  );
  const currentBeds =
    !matrix.loading && !matrix.error ? matrix.data?.beds || [] : [];
  const wards =
    !matrix.loading && !matrix.error ? matrix.data?.wards || [] : [];
  const time = (s: string | null | undefined) =>
    s ? (timeZone ? formatHospitalTime(s, timeZone) : s) : tr("Not recorded");
  const amount = (v: number | null | undefined) =>
    v === null || v === undefined
      ? tr("Not recorded")
      : (currency ? currency + " " : "") + String(v);
  const write = useClinicalWrite(
    user,
    "admission:" + id,
    async (value, command) => {
      if (command.path.endsWith("/final-bill")) {
        const inv = value as a.InvoiceDetailOut;
        if (inv.admission_id !== id)
          throw Error(
            t(
              "The returned bill does not belong to this admission. Read the original record; do not repeat it.",
              "واپس بل اسی داخلے کا نہیں۔ اصل ریکارڈ پڑھیں؛ تکرار نہ کریں۔",
            ),
          );
        setBill(inv);
      }
      setEditor(undefined);
      setReview(undefined);
      setRevision((n) => n + 1);
      setNotice(
        t(
          "Confirmed on the server. Check the updated admission; optional files and payment are separate tasks.",
          "سرور پر تصدیق۔ تازہ داخلہ دیکھیں؛ اختیاری فائلیں اور ادائیگی الگ کام ہیں۔",
        ),
      );
    },
  );
  const blocked = write.blocked || rebasing;
  const navigationLocked = blocked || docsPending;
  const changed =
    !!editor &&
    !!record &&
    (admissionSnapshot(editor.record) !== admissionSnapshot(record) ||
      (!!person &&
        admissionPatientSnapshot(editor.person) !==
          admissionPatientSnapshot(person)));
  const hasPermission = (
    action: AdmissionAction,
    permissions = user.permissions,
  ) => admissionPermission(action).some((p) => permissions.includes(p));
  const permitted = (action: AdmissionAction) =>
    access.work &&
    hasPermission(action) &&
    !!record &&
    admissionActionAllowed(record, action);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setRevision((n) => n + 1), 200);
    };
    const stop = window.terminal.subscribe((e) => {
      if (e.type === "stream" && e.status === "Live" && e.resync) refresh();
      if (
        e.type === "event" &&
        [
          "admission.requested",
          "admission.cancelled",
          "admission.overflow_assigned",
          "admission.discharge.stage_changed",
          "bed.state_changed",
          "bed.reservation.expired",
          "bed.waitlist.notification",
          "patient.merged",
          "death.recorded",
          "patient.death.recorded",
        ].includes(e.event_type)
      )
        refresh();
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      [
        "ADMISSION_STATE_INVALID",
        "BED_NO_LONGER_AVAILABLE",
        "BILLING_NOT_DEFERRED",
        "DISCHARGE_STAGE_IMMUTABLE",
        "DISCHARGE_STAGE_OUT_OF_ORDER",
        "DISCHARGE_NOT_ALLOWED",
      ].includes(write.error.response.error?.code || "") ||
      (write.error instanceof ApiError && validationFields(write.error.response.error).some(f=>f.field==='ward_id'))
    )
      setRevision((n) => n + 1);
  }, [write.error]);
  useEffect(() => {
    if (!navigationLocked) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [navigationLocked]);
  function open(next: number) {
    if (navigationLocked || editor) return;
    if (
      root.current?.querySelector('[data-unsaved="true"]') &&
      !window.confirm(
        t(
          "Discard optional files that have not been uploaded?",
          "غیر اپ لوڈ اختیاری فائلیں چھوڑ دیں؟",
        ),
      )
    )
      return;
    setId(next);
    setLookup(String(next));
    setBill(undefined);
    setError(undefined);
    setNotice("");
    setRevision((n) => n + 1);
  }
  function begin(action: AdmissionAction) {
    if (
      !record ||
      !person ||
      !identity ||
      blocked ||
      !live ||
      !permitted(action)
    )
      return;
    if (
      person.is_deceased &&
      ["allocate", "overflow", "admit", "waitlist"].includes(action)
    )
      return;
    if (action === "confirm-billing" && person.temp_identifier) {
      setError(
        Error(
          t(
            "Ask Reception to resolve this temporary identity before confirming billing.",
            "بل تصدیق سے پہلے استقبالیہ سے عارضی شناخت حل کرائیں۔",
          ),
        ),
      );
      return;
    }
    setEditor({
      action,
      record: structuredClone(record),
      person: structuredClone(person),
      form: emptyAdmissionDraft(record),
    });
    setReview(undefined);
    setError(undefined);
    write.clearError();
  }
  function field<K extends keyof AdmissionDraft>(
    key: K,
    value: AdmissionDraft[K],
  ) {
    if (!editor || blocked || review) return;
    setEditor({
      ...editor,
      form: {
        ...editor.form,
        [key]: value,
        ...(key !== "ack" ? { ack: false } : {}),
      },
    });
  }
  function close() {
    if (blocked) return;
    if (
      editor &&
      JSON.stringify(editor.form) !==
        JSON.stringify(emptyAdmissionDraft(editor.record)) &&
      !window.confirm(
        t(
          "Discard this unsaved admission action?",
          "داخلے کا یہ غیر محفوظ مسودہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    setEditor(undefined);
    setReview(undefined);
    setError(undefined);
  }
  async function rebase() {
    if (!editor || rebaseFlight.current || write.blocked) return;
    rebaseFlight.current = true;
    setRebasing(true);
    setError(undefined);
    try {
      const fresh = await detailApi.getAdmission(editor.record.admission_id),
        p = await resolvePatientMaster(fresh.patient_id, patients.getPatient);
      if (!p)
        throw Error(
          t(
            "The patient identity changed. Keep the draft for reference and reopen the verified admission.",
            "مریض کی شناخت بدلی۔ حوالہ کے لیے مسودہ رکھیں اور تصدیق شدہ داخلہ دوبارہ کھولیں۔",
          ),
        );
      setEditor({
        ...editor,
        record: fresh,
        person: p,
        form: { ...editor.form, ack: false },
      });
      setReview(undefined);
      write.clearError();
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e);
    } finally {
      rebaseFlight.current = false;
      setRebasing(false);
    }
  }
  function prepare() {
    if (!editor || blocked || changed || !live) return;
    setError(undefined);
    try {
      if (editor.action === "confirm-billing" && editor.person.temp_identifier)
        throw Error(
          t(
            "Resolve the temporary identity first.",
            "پہلے عارضی شناخت حل کریں۔",
          ),
        );
      const body = admissionBody(
        editor.action,
        editor.record,
        editor.form,
        currentBeds,
        panels.error ? [] : panels.data || [],
      );
      if (
        editor.action === "waitlist" &&
        !wards.some((w) => String(w.ward_id) === editor.form.ward)
      )
        throw Error(
          t(
            "Choose a ward returned by the server.",
            "سرور کی اصل وارڈ فہرست سے چنیں۔",
          ),
        );
      setReview({ body });
    } catch (e) {
      setError(e);
    }
  }
  function submit() {
    const ed = editor,
      r = review;
    if (!ed || !r || blocked || changed || !live) return;
    const permission = admissionPermission(ed.action).find((p) => can(p));
    if (!permission) return;
    const suffix =
      ed.action === "clear"
        ? "discharge/BillingSettlement/clear"
        : ed.action === "allocate"
          ? "allocate-bed"
          : ed.action === "overflow"
            ? "overflow-override"
            : ed.action;
    write.start(
      {
        method: "POST",
        path: "/admissions/" + ed.record.admission_id + "/" + suffix,
        body: r.body,
        permission,
        protection: ed.action === "admit" ? "idempotent" : "reconcile",
        reconcilePath:
          "/admissions/" +
          ed.record.admission_id +
          (ed.action === "clear" ? "/discharge-status" : ""),
        label: actionLabel(ed.action) + " · " + ed.record.admission_number,
        independentUploadPatientId: ed.person.patient_id,
      },
      async () => {
        const [me, est, fresh, p] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          detailApi.getAdmission(ed.record.admission_id),
          resolvePatientMaster(ed.person.patient_id, patients.getPatient),
        ]);
        const accessNow = admissionAccess(
          est.views.screens.find((s) => s.screen_id === "pending_admissions")
            ?.view,
          me.permissions,
        );
        if (
          me.user_id !== user.user_id ||
          !accessNow.work ||
          !hasPermission(ed.action, me.permissions) ||
          admissionSnapshot(fresh) !== admissionSnapshot(ed.record) ||
          !p ||
          admissionPatientSnapshot(p) !== admissionPatientSnapshot(ed.person) ||
          !admissionActionAllowed(fresh, ed.action)
        ) {
          setRevision((n) => n + 1);
          throw Error(
            t(
              "The admission, patient or permission changed. Read the current admission and keep your draft.",
              "داخلہ، مریض یا اجازت بدلی۔ مسودہ رکھ کر تازہ داخلہ پڑھیں۔",
            ),
          );
        }
        if (
          ["allocate", "overflow", "admit", "waitlist"].includes(ed.action) &&
          p.is_deceased
        )
          throw Error(
            t(
              "This patient is recorded deceased. Ask the responsible clinical team.",
              "مریض فوت شدہ درج ہے۔ ذمہ دار طبی ٹیم سے کہیں۔",
            ),
          );
        if (ed.action === "allocate" || ed.action === "overflow") {
          const m = await bedsApi.bedMatrix({ include_beds: true }),
            bed = (m.beds || []).find(
              (b) => b.bed_id === (r.body as a.AllocateIn).bed_id,
            );
          if (!bed || bed.current_state !== "Available") {
            setRevision((n) => n + 1);
            throw Error(
              t(
                "The selected bed is no longer available. Refresh the beds and choose another.",
                "منتخب بستر اب دستیاب نہیں۔ بستر تازہ کرکے دوسرا چنیں۔",
              ),
            );
          }
        }
        if (
          ["allocate", "overflow", "confirm-billing"].includes(ed.action) &&
          ed.form.category === "Panel"
        ) {
          const ps = await panelApi.panels();
          if (
            !ps.some((p) => String(p.panel_id) === ed.form.panel && p.is_active)
          )
            throw Error(
              t(
                "The billing panel changed. Refresh and review again.",
                "بل کا پینل بدلا۔ تازہ کرکے دوبارہ جائزہ لیں۔",
              ),
            );
        }
      },
    );
  }
  if (!access.visible)
    return (
      <Empty>
        {t(
          "This screen is not available in the current service view.",
          "موجودہ خدمت میں یہ صفحہ دستیاب نہیں۔",
        )}
      </Empty>
    );
  if (!access.read) return <Empty>{tr("Permission required")}</Empty>;
  const rows =
    !list.loading && !list.error
      ? (list.data || []).filter((r) => {
          const inTab =
            tab === "waiting"
              ? ["AdmissionPending", "Waitlisted", "BedReserved"].includes(
                  r.status,
                )
              : tab === "billing"
                ? r.is_billing_deferred
                : tab === "discharge"
                  ? r.status === "DischargeInProgress"
                  : true;
          return (
            inTab &&
            (!find.trim() ||
              JSON.stringify([
                r.patient_name,
                r.mrn,
                r.admission_number,
                r.primary_doctor_name,
              ])
                .toLocaleLowerCase()
                .includes(find.trim().toLocaleLowerCase()))
          );
        })
      : [];
  const selectedWard = editor?.form.ward || "";
  const formBeds = currentBeds.filter(
    (b) => String(b.ward_id) === selectedWard,
  );
  const actionNames: AdmissionAction[] = [
    "allocate",
    "overflow",
    "waitlist",
    "admit",
    "cancel",
    "confirm-billing",
    "final-bill",
    "clear",
  ];
  return (
    <section
      className="pending-admissions"
      ref={root}
      data-write-pending={write.blocked || undefined}
      data-unsaved={!!editor || undefined}
    >
      <header className="page-heading">
        <div>
          <h1>
            {t(
              "Pending admissions & allocation",
              "منتظر داخلے اور بستر کی تعیناتی",
            )}
          </h1>
          <p>
            {t(
              "Match the person and admission before reserving a bed, confirming arrival or clearing billing.",
              "بستر، آمد یا بل کلیئر کرنے سے پہلے مریض اور داخلہ ملائیں۔",
            )}
          </p>
        </div>
        <button
          data-help="admission.refresh"
          disabled={blocked}
          onClick={() => setRevision((n) => n + 1)}
        >
          {t("Refresh admissions and beds", "داخلے اور بستر تازہ کریں")}
        </button>
      </header>
      <p role="status">
        {tr(connected ? stream : "Offline")} ·{" "}
        {view === "records"
          ? t(
              "Records only — no admission actions",
              "صرف ریکارڈ — داخلے کے اعمال نہیں",
            )
          : view === "open_work"
            ? t(
                "Finish existing inpatient work; no new admissions from now on.",
                "موجودہ داخلے کا کام مکمل کریں؛ اب نئے داخلے نہیں۔",
              )
            : t("Admissions desk", "داخلہ ڈیسک")}
      </p>
      <ErrorBox error={error} />
      {notice && <p role="status">{notice}</p>}
      {!editor && (
        <ClinicalWriteFeedback
          write={write}
          onReviewed={() => setRevision((n) => n + 1)}
        />
      )}
      <fieldset disabled={navigationLocked || !!editor}>
        <div className="filters">
          <Field label={t("Admission work to show", "دکھانے والا داخلہ کام")}>
            <select
              data-help="admission.filters"
              value={tab}
              onChange={(e) => setTab(e.target.value)}
            >
              <option value="waiting">
                {t("Waiting / reserved", "منتظر / محفوظ بستر")}
              </option>
              <option value="billing">
                {t("Billing to confirm", "بل کا انتظام تصدیق طلب")}
              </option>
              <option value="discharge">
                {t("Discharge billing", "ڈسچارج بل")}
              </option>
              <option value="live">
                {t("All live admissions", "تمام جاری داخلے")}
              </option>
            </select>
          </Field>
          <Field label={t("Filter ward", "وارڈ کی شرط")}>
            <select data-field="ward_id"
              data-help="admission.filters"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            >
              <option value="">
                {t("All permitted wards", "تمام مجاز وارڈ")}
              </option>
              {wards.map((w) => (
                <option key={w.ward_id} value={w.ward_id}>
                  {w.name} · {w.available}/{w.total_beds}{" "}
                  {t("available", "دستیاب")}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t("Find in returned admissions", "موصولہ داخلوں میں تلاش")}
          >
            <input
              data-help="admission.filters"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </Field>
        </div>
        <form
          className="card admission-lookup"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              /^[1-9]\d*$/.test(lookup) &&
              Number.isSafeInteger(Number(lookup))
            )
              open(Number(lookup));
          }}
        >
          <Field
            label={t("Known admission ID", "معلوم داخلہ نمبر")}
            hint={t(
              "Use an ID from the actual admission record, never guess.",
              "اصل داخلے کا نمبر استعمال کریں؛ اندازہ نہیں۔",
            )}
          >
            <input
              data-help="admission.lookup"
              inputMode="numeric"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
            />
          </Field>
          <button
            data-help="admission.lookup"
            disabled={!/^[1-9]\d*$/.test(lookup)}
          >
            {t("Read admission", "داخلہ پڑھیں")}
          </button>
        </form>
      </fieldset>
      <div className="admissions-layout">
        <section>
          <h2>{t("Admissions worklist", "داخلوں کی فہرست")}</h2>
          <LoadState {...list} retry={list.reload} />
          {!list.loading && !list.error && !rows.length && (
            <Empty>
              {t(
                "No matching admissions in this returned scope. Clear filters, refresh, or use a known admission ID for history.",
                "اس دائرے میں متعلقہ داخلہ نہیں۔ شرط صاف، تازہ، یا تاریخ کے لیے اصل معلوم نمبر دیں۔",
              )}
            </Empty>
          )}
          {rows.map((r) => (
            <article
              className="card"
              data-testid="admission-row"
              key={r.admission_id}
            >
              <h3>
                <bdi>
                  {r.patient_name} · {r.mrn}
                </bdi>
              </h3>
              <p>
                <bdi>{r.admission_number}</bdi> · {tr(r.status)}
              </p>
              <p>
                {r.requested_ward_name || tr("Not recorded")} ·{" "}
                {r.bed_label || t("No bed assigned", "بستر مقرر نہیں")}
              </p>
              <p>
                {r.primary_doctor_name || tr("Not recorded")} ·{" "}
                <bdi>{time(r.requested_at)}</bdi>
              </p>
              {r.is_billing_deferred && (
                <p className="notice">
                  {t(
                    "Billing to confirm — not free care",
                    "ادائیگی کا انتظام تصدیق طلب — علاج مفت نہیں",
                  )}
                </p>
              )}
              <button
                data-help="admission.select"
                disabled={navigationLocked || !!editor}
                onClick={() => open(r.admission_id)}
              >
                {t("Open admission", "داخلہ کھولیں")}
              </button>
            </article>
          ))}
          {ward && (
            <section className="card">
              <h2>{t("This ward's waitlist", "اس وارڈ کی انتظار فہرست")}</h2>
              <LoadState {...waitlist} retry={waitlist.reload} />
              {!waitlist.loading &&
                !waitlist.error &&
                !waitlist.data?.length && (
                  <Empty>
                    {t(
                      "No patients waiting for this ward.",
                      "اس وارڈ کے لیے کوئی منتظر مریض نہیں۔",
                    )}
                  </Empty>
                )}
              {!waitlist.loading &&
                !waitlist.error &&
                waitlist.data?.map((w) => (
                  <p key={w.waitlist_id}>
                    <button
                      data-help="admission.waitlist"
                      disabled={navigationLocked || !!editor}
                      onClick={() => open(w.admission_id)}
                    >
                      <bdi>
                        {w.patient_name} · {w.mrn}
                      </bdi>{" "}
                      · {t("Priority", "ترجیح")} {w.priority} ·{" "}
                      {time(w.requested_at)}
                    </button>
                  </p>
                ))}
            </section>
          )}
        </section>
        <section>
          {!!id && (
            <>
              <LoadState {...detail} retry={detail.reload} />
              <LoadState {...profile} retry={profile.reload} />
            </>
          )}
          {record && (
            <article className="card" data-testid="admission-detail">
              <h2>
                <bdi>
                  {record.patient_name} · {record.mrn}
                </bdi>
              </h2>
              <p>
                <bdi>{record.admission_number}</bdi> · {tr(record.status)} ·{" "}
                {tr(record.admission_type)}
              </p>
              <p>
                {tr(record.gender || "Not recorded")} ·{" "}
                {t("Age / date of birth", "عمر / تاریخ پیدائش")}:{" "}
                <bdi>
                  {person?.dob ?? record.age_years ?? tr("Not recorded")}
                </bdi>
              </p>
              <p>
                {t("Requested ward", "مطلوبہ وارڈ")}:{" "}
                {record.requested_ward_name || tr("Not recorded")} ·{" "}
                {t("Current bed", "موجودہ بستر")}:{" "}
                {record.ward_name || tr("Not recorded")} /{" "}
                {record.bed_label || tr("Not recorded")}
              </p>
              <p>
                {t("Primary doctor", "ذمہ دار ڈاکٹر")}:{" "}
                {record.primary_doctor_name || tr("Not recorded")}
              </p>
              <p>
                {t("Reason for admission", "داخلے کی وجہ")}:{" "}
                <span dir="auto">
                  {record.admission_reason || tr("Not recorded")}
                </span>
              </p>
              <p>
                {t("Provisional diagnosis", "ابتدائی تشخیص")}:{" "}
                <span dir="auto">
                  {record.provisional_diagnosis || tr("Not recorded")}
                </span>
              </p>
              {record.initial_care_plan && (
                <p dir="auto">{record.initial_care_plan}</p>
              )}
              {record.details_stamp && (
                <p dir="auto">{record.details_stamp.text}</p>
              )}
              {person && (
                <>
                  <p>
                    {tr("Allergies")}: {person.allergies || tr("Not recorded")}{" "}
                    · {tr("Blood group")}:{" "}
                    {person.blood_group || tr("Not recorded")}
                  </p>
                  {person.outstanding.banner_text && (
                    <p className="error">{person.outstanding.banner_text}</p>
                  )}
                  {person.is_deceased && (
                    <p className="error">{tr("DECEASED")}</p>
                  )}
                  {person.temp_identifier && (
                    <p className="notice">
                      <bdi>{person.temp_identifier}</bdi> ·{" "}
                      {t(
                        "Resolve identity before confirming deferred billing.",
                        "ملتوی بل تصدیق سے پہلے شناخت حل کریں۔",
                      )}
                    </p>
                  )}
                  {person.mlc_numbers.length > 0 && (
                    <p>
                      {tr("MEDICO-LEGAL")} ·{" "}
                      <bdi>{person.mlc_numbers.join(", ")}</bdi>
                    </p>
                  )}
                </>
              )}
              {!identity && (
                <p className="error">
                  {t(
                    "Current patient identity is unavailable or changed. Admission actions are unavailable; refresh or ask Reception.",
                    "تازہ مریض شناخت دستیاب نہیں یا بدلی۔ داخلے کے اعمال بند؛ تازہ یا استقبالیہ سے کہیں۔",
                  )}
                </p>
              )}
              <p>
                {t("Billing", "بل")}:{" "}
                {record.is_billing_deferred
                  ? t("Deferred — confirmation required", "ملتوی — تصدیق لازم")
                  : tr(record.billing_category)}{" "}
                ·{" "}
                {record.is_billing_confirmed
                  ? t("Confirmed", "تصدیق شدہ")
                  : t("Not confirmed", "تصدیق نہیں")}
              </p>
              {record.is_overflow && (
                <p className="notice">
                  {t(
                    "Overflow — primary doctor retains rounds",
                    "دوسرے وارڈ میں اضافی بستر — اصل ڈاکٹر کے راؤنڈ برقرار",
                  )}
                  : {record.overflow_reason}
                </p>
              )}
              {record.invoice && (
                <section>
                  <h3>{t("Current inpatient bill", "موجودہ داخلہ بل")}</h3>
                  <p>
                    <bdi>{record.invoice.invoice_no}</bdi> ·{" "}
                    {tr(record.invoice.status)}
                  </p>
                  <p>
                    {t("Gross", "کل")}: {amount(record.invoice.gross_total)} ·{" "}
                    {t("Net", "واجب")}: {amount(record.invoice.net_payable)} ·{" "}
                    {t("Paid", "ادا")}: {amount(record.invoice.amount_paid)}
                  </p>
                  <p>
                    {t(
                      "Payment is collected separately by the permitted cashier. A final bill is not payment.",
                      "ادائیگی مجاز کیشیئر الگ وصول کرتا ہے۔ حتمی بل ادائیگی نہیں۔",
                    )}
                  </p>
                </section>
              )}
              {record.discharge.started && (
                <section>
                  <h3>{t("Discharge stages", "ڈسچارج کے مراحل")}</h3>
                  {record.discharge.stages.map((s) => (
                    <p key={s.clearance_id}>
                      {tr(s.stage)} · {tr(s.status)}
                      {s.status === "Cleared" && (
                        <>
                          {" "}
                          · {t("Already cleared", "پہلے مکمل")} ·{" "}
                          <bdi>
                            {s.cleared_by_name || tr("Not recorded")} ·{" "}
                            {time(s.cleared_at)}
                          </bdi>
                        </>
                      )}
                    </p>
                  ))}
                  {record.discharge.blocked_on && (
                    <p>
                      {t("Waiting for", "منتظر")}:{" "}
                      {tr(record.discharge.blocked_on)}
                    </p>
                  )}
                </section>
              )}
              {access.work && (
                <div className="actions">
                  {actionNames.filter(permitted).map((action) => (
                    <button
                      data-help="admission.action"
                      key={action}
                      disabled={
                        blocked ||
                        !live ||
                        !identity ||
                        !!editor ||
                        (!!person?.is_deceased &&
                          [
                            "allocate",
                            "overflow",
                            "waitlist",
                            "admit",
                          ].includes(action)) ||
                        (["allocate", "overflow"].includes(action) &&
                          (!can("ipd.bed.view") ||
                            matrix.loading ||
                            !!matrix.error))
                      }
                      onClick={() => begin(action)}
                    >
                      {actionLabel(action)}
                    </button>
                  ))}
                </div>
              )}
              {can("ipd.bed.view") && (
                <LoadState {...matrix} retry={matrix.reload} />
              )}
            </article>
          )}
          {bill && bill.admission_id === id && (
            <section className="card">
              <h2>{t("Final bill confirmed", "حتمی بل کی تصدیق")}</h2>
              <p>
                <bdi>{bill.invoice_no}</bdi> · {tr(bill.status)} ·{" "}
                {t("Balance due", "باقی رقم")}: {amount(bill.balance_due)}
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Item", "مد")}</th>
                      <th>{t("Quantity", "مقدار")}</th>
                      <th>{t("Unit price", "فی نرخ")}</th>
                      <th>{t("Total", "کل")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.lines.map((l) => (
                      <tr key={l.invoice_item_id}>
                        <td dir="auto">{l.description}</td>
                        <td>{l.qty}</td>
                        <td>{amount(l.unit_price)}</td>
                        <td>{amount(l.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                {t(
                  "Give this actual invoice number to the cashier. Refresh the admission after payment before clearing Billing Settlement.",
                  "یہی اصل بل نمبر کیشیئر کو دیں۔ ادائیگی کے بعد بل کلیئر کرنے سے پہلے داخلہ تازہ کریں۔",
                )}
              </p>
            </section>
          )}
          {docContext?.admissionId === id && (
            <RegistrationDocuments
              key={id + ":" + docContext.person.patient_id}
              patientId={docContext.person.patient_id}
              photoId={docContext.person.photo_document_id}
              independentPatient
              permissions={
                access.work
                  ? user.permissions
                  : user.permissions.filter(
                      (p) => p !== "patient.document.upload",
                    )
              }
              onPending={setDocsPending}
              onChanged={() => setRevision((n) => n + 1)}
            />
          )}
        </section>
      </div>
      {editor && (
        <Modal
          title={actionLabel(editor.action)}
          onClose={close}
          closable={!blocked}
        >
          <p>
            <bdi>
              {editor.record.patient_name} · {editor.record.mrn} ·{" "}
              {editor.record.admission_number}
            </bdi>{" "}
            · {tr(editor.record.status)}
          </p>
          <p>
            {t(
              "Check the actual person; a bed or room number is not patient identity.",
              "اصل فرد کی شناخت کریں؛ بستر یا کمرہ مریض کی شناخت نہیں۔",
            )}
          </p>
          {changed && (
            <p className="notice">
              {t(
                "The server record changed. Your input is kept; read the current admission before another review.",
                "سرور ریکارڈ بدلا۔ معلومات رکھی ہیں؛ نئے جائزے سے پہلے تازہ داخلہ پڑھیں۔",
              )}
            </p>
          )}
          {!admissionActionAllowed(editor.record, editor.action) && (
            <p className="error">
              {t(
                "This action is no longer allowed in the current state. Keep your draft for reference.",
                "موجودہ حالت میں عمل مجاز نہیں۔ حوالہ کے لیے مسودہ رکھیں۔",
              )}
            </p>
          )}
          <ErrorBox error={error} />
          <fieldset disabled={blocked || !!review}>
            {(editor.action === "allocate" ||
              editor.action === "overflow" ||
              editor.action === "waitlist") && (
              <>
                <Field label={t("Ward for this action", "اس عمل کا وارڈ")}>
                  <select data-field="ward_id"
                    data-help="admission.beds"
                    value={editor.form.ward}
                    onChange={(e) => {
                      field("ward", e.target.value);
                      setEditor((ed) =>
                        ed
                          ? {
                              ...ed,
                              form: {
                                ...ed.form,
                                ward: e.target.value,
                                bed: "",
                                ack: false,
                              },
                            }
                          : ed,
                      );
                    }}
                  >
                    <option value="">{t("Choose a ward", "وارڈ چنیں")}</option>
                    {wards.map((w) => (
                      <option
                        key={w.ward_id}
                        value={w.ward_id}
                        disabled={
                          editor.action === "allocate" &&
                          !!editor.record.requested_ward_id &&
                          w.ward_id !== editor.record.requested_ward_id
                        }
                      >
                        {w.name} · {w.available} {t("available", "دستیاب")}
                      </option>
                    ))}
                  </select>
                </Field>
                {editor.action !== "waitlist" ? (
                  <>
                    <LoadState {...matrix} retry={matrix.reload} />
                    <Field label={t("Available bed", "دستیاب بستر")}>
                      <select data-field="bed_id"
                        data-help="admission.beds"
                        value={editor.form.bed}
                        onChange={(e) => field("bed", e.target.value)}
                      >
                        <option value="">
                          {t("Choose an available bed", "دستیاب بستر چنیں")}
                        </option>
                        {formBeds.map((b) => (
                          <option
                            key={b.bed_id}
                            value={b.bed_id}
                            disabled={b.current_state !== "Available"}
                          >
                            {b.label} · {tr(b.current_state)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <label>
                      <input
                        data-help="admission.allocate"
                        type="checkbox"
                        checked={editor.form.arrived}
                        onChange={(e) => field("arrived", e.target.checked)}
                      />
                      {t(
                        "The patient is already at this bedside — reserve and admit together",
                        "مریض اسی بستر پر موجود ہے — محفوظ اور داخل ایک ساتھ",
                      )}
                    </label>
                  </>
                ) : (
                  <Field label={t("Waitlist priority", "انتظار کی ترجیح")}>
                    <input data-field="priority"
                      data-help="admission.waitlist"
                      inputMode="numeric"
                      value={editor.form.priority}
                      onChange={(e) => field("priority", e.target.value)}
                    />
                  </Field>
                )}
              </>
            )}
            {["allocate", "overflow", "confirm-billing"].includes(
              editor.action,
            ) && (
              <>
                <Field
                  label={t(
                    "Confirmed billing category",
                    "تصدیق شدہ ادائیگی زمرہ",
                  )}
                >
                  <select data-field="billing_category"
                    data-help="admission.confirm-billing"
                    value={editor.form.category}
                    onChange={(e) =>
                      field("category", e.target.value as "Cash" | "Panel")
                    }
                  >
                    <option value="Cash">{tr("Cash")}</option>
                    <option value="Panel">{tr("Panel")}</option>
                  </select>
                </Field>
                {editor.form.category === "Panel" && (
                  <>
                    <LoadState {...panels} retry={panels.reload} />
                    <Field label={t("Active panel", "فعال پینل")}>
                      <select data-field="panel_id"
                        data-help="admission.confirm-billing"
                        value={editor.form.panel}
                        onChange={(e) => field("panel", e.target.value)}
                      >
                        <option value="">
                          {t("Choose a panel", "پینل چنیں")}
                        </option>
                        {!panels.loading &&
                          !panels.error &&
                          panels.data
                            ?.filter((p) => p.is_active)
                            .map((p) => (
                              <option key={p.panel_id} value={p.panel_id}>
                                {p.name}
                              </option>
                            ))}
                      </select>
                    </Field>
                  </>
                )}
              </>
            )}
            {(editor.action === "overflow" || editor.action === "cancel") && (
              <Field
                label={
                  editor.action === "overflow"
                    ? t("Overflow reason", "دوسرے وارڈ کی وجہ")
                    : t("Cancellation reason", "منسوخی کی وجہ")
                }
              >
                <textarea data-field="reason"
                  data-help="admission.reason"
                  maxLength={500}
                  value={editor.form.reason}
                  onChange={(e) => field("reason", e.target.value)}
                />
              </Field>
            )}
            {editor.action === "final-bill" && (
              <>
                <p className="notice">
                  {t(
                    "Finalize the server's running charges. A repeated finalization ignores a new discount; read the original bill before any further action. This does not collect payment.",
                    "سرور کے جاری اخراجات حتمی کریں۔ تکرار نیا ڈسکاؤنٹ نظر انداز کرتی؛ اگلے عمل سے پہلے اصل بل پڑھیں۔ اس سے ادائیگی وصول نہیں ہوتی۔",
                  )}
                </p>
                <Field label={t("Final bill discount", "حتمی بل کی رعایت")}>
                  <input data-field="discount"
                    data-help="admission.final-bill"
                    inputMode="decimal"
                    value={editor.form.discount}
                    onChange={(e) => field("discount", e.target.value)}
                  />
                </Field>
                <Field label={t("Discount reason", "رعایت کی وجہ")}>
                  <textarea data-field="discount_reason"
                    data-help="admission.final-bill"
                    value={editor.form.discountReason}
                    onChange={(e) => field("discountReason", e.target.value)}
                  />
                </Field>
              </>
            )}
            {editor.action === "clear" && (
              <>
                <p className="notice">
                  {t(
                    "Verify the finalized bill and actual payment/approved settlement first. Already cleared is shown with officer and time; never retry clearance automatically.",
                    "پہلے حتمی بل اور اصل ادائیگی یا منظور تصفیہ چیک کریں۔ پہلے مکمل مرحلہ افسر و وقت کے ساتھ ہے؛ خودکار کلیئرنس نہیں۔",
                  )}
                </p>
                <Field label={t("Billing clearance note", "بل کلیئرنس نوٹ")}>
                  <textarea data-field="note"
                    data-help="admission.clear"
                    maxLength={1000}
                    value={editor.form.note}
                    onChange={(e) => field("note", e.target.value)}
                  />
                </Field>
              </>
            )}
            {editor.action === "admit" && (
              <p>
                {t(
                  "Confirm actual arrival at the reserved bed; this marks it Occupied. A photo is optional.",
                  "محفوظ بستر پر اصل آمد تصدیق؛ بستر زیر استعمال ہوگا۔ تصویر اختیاری ہے۔",
                )}
              </p>
            )}
            <label>
              <input
                data-help="admission.review"
                type="checkbox"
                checked={editor.form.ack}
                onChange={(e) => field("ack", e.target.checked)}
              />
              {t(
                "I checked this patient, admission, location and the actual proposed action.",
                "میں نے یہی مریض، داخلہ، جگہ اور اصل تجویز کردہ عمل چیک کیا۔",
              )}
            </label>
          </fieldset>
          {review && (
            <section className="notice" data-testid="admission-review">
              <h3>{t("Review before confirming", "تصدیق سے پہلے جائزہ")}</h3>
              <p>
                {actionLabel(editor.action)} ·{" "}
                <bdi>{editor.record.admission_number}</bdi>
              </p>
              {editor.form.bed && (
                <p>
                  {
                    currentBeds.find(
                      (b) => String(b.bed_id) === editor.form.bed,
                    )?.label
                  }{" "}
                  ·{" "}
                  {
                    wards.find((w) => String(w.ward_id) === editor.form.ward)
                      ?.name
                  }{" "}
                  ·{" "}
                  {editor.form.arrived
                    ? t("Patient arrived", "مریض پہنچ گیا")
                    : t("Reserve only", "صرف محفوظ")}
                </p>
              )}
              {["allocate", "overflow", "confirm-billing"].includes(
                editor.action,
              ) && (
                <p>
                  {tr(editor.form.category)} ·{" "}
                  {editor.form.category === "Panel"
                    ? panels.data?.find(
                        (p) => String(p.panel_id) === editor.form.panel,
                      )?.name
                    : ""}
                </p>
              )}
              {editor.form.reason && <p dir="auto">{editor.form.reason}</p>}
              {editor.action === "waitlist" && (
                <p>
                  {wards.find((w) => String(w.ward_id) === editor.form.ward)
                    ?.name || editor.record.requested_ward_name}{" "}
                  · {t("Priority", "ترجیح")} {editor.form.priority}
                </p>
              )}
              {editor.action === "final-bill" && (
                <p>
                  {t("Discount", "رعایت")}: {editor.form.discount} ·{" "}
                  {editor.form.discountReason}
                </p>
              )}
              {editor.form.note && <p dir="auto">{editor.form.note}</p>}
            </section>
          )}
          <ClinicalWriteFeedback
            write={write}
            onReviewed={() => setRevision((n) => n + 1)}
          />
          <div className="actions">
            {!review ? (
              <button
                data-help="admission.review"
                disabled={
                  blocked ||
                  changed ||
                  !live ||
                  !admissionActionAllowed(editor.record, editor.action)
                }
                onClick={prepare}
              >
                {t("Review admission action", "داخلے کے عمل کا جائزہ")}
              </button>
            ) : (
              <>
                <button
                  data-help="admission.confirm"
                  disabled={blocked || changed || !live}
                  onClick={submit}
                >
                  {t("Confirm admission action", "داخلے کے عمل کی تصدیق")}
                </button>
                <button
                  data-help="admission.review"
                  disabled={blocked}
                  onClick={() => setReview(undefined)}
                >
                  {t("Back to draft", "مسودے پر واپس")}
                </button>
              </>
            )}
            <button
              data-help="admission.recovery"
              disabled={blocked}
              onClick={() => void rebase()}
            >
              {t(
                "Read current admission and keep draft",
                "مسودہ رکھ کر تازہ داخلہ پڑھیں",
              )}
            </button>
            <button
              data-help="admission.close"
              disabled={blocked}
              onClick={close}
            >
              {t("Close admission draft", "داخلے کا مسودہ بند کریں")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
