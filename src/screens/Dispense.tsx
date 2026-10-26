import { useEffect, useState } from "react";
import * as discharge from "../generated/discharge_status";
import * as cashDrawer from "../generated/pharmacy_cash_shift";
import {
  pharmacyCashShift,
  otherPharmacyCashCounter,
  pharmacyClearanceAllowed,
  pharmacyClearanceState,
} from "../pharmacy-workflow-policy";
import { api, call } from "../bridge";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t, tr } from "../i18n";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as rx from "../generated/rx_queue";
import * as d from "../generated/dispense";
import * as patients from "../generated/patient_search";
import {
  dispensingAllowed,
  dispenseSnapshot,
  openQuery,
  selectedDispenseLines,
} from "../dispense-policy";
import { approvedCharityHandoff, type CharityHandoff } from "../charity-policy";
import type { ApprovalOut } from "../generated/charity_override";
type Review =
  | { kind: "dispense"; body: d.DispenseIn; snapshot: string; high: boolean }
  | { kind: "stop"; item: number; reason: string; snapshot: string }
  | { kind: "clear"; admission: number; note: string };
type OwnMedicine = {
  own_medicine_id: number;
  medicine_name: string;
  status: "Received" | "Retained" | "Returned" | "Destroyed";
};
export function Dispense({
  user,
  connected,
  stream,
  establishment,
  initialId,
  initialAssistance,
  onQueue,
  onQuery,
  onCharity,
  onCashShift,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  initialId?: number;
  initialAssistance?: CharityHandoff;
  onQueue?: () => void;
  onQuery?: (id: number, itemId: number | null) => void;
  onCharity?: (id: number) => void;
  onCashShift?: () => void;
}) {
  const can = (p: string) => user.permissions.includes(p),
    [selected, setSelected] = useState<number>(initialId || 0),
    [lookup, setLookup] = useState(initialId ? String(initialId) : ""),
    [revision, setRevision] = useState(0);
  const [quantities, setQuantities] = useState<Record<number, string>>({}),
    [mode, setMode] = useState<
      "Cash" | "Card" | "CharityZakat" | "SocialWelfare"
    >(
      initialAssistance && initialAssistance.prescriptionId === initialId
        ? initialAssistance.fundType === "Zakat"
          ? "CharityZakat"
          : "SocialWelfare"
        : "Cash",
    ),
    [reference, setReference] = useState(""),
    [approval, setApproval] = useState(
      initialAssistance && initialAssistance.prescriptionId === initialId
        ? String(initialAssistance.approvalId)
        : "",
    );
  const [review, setReview] = useState<Review>(),
    [checker, setChecker] = useState(""),
    [password, setPassword] = useState(""),
    [ack, setAck] = useState(false),
    [reason, setReason] = useState(""),
    [unused, setUnused] = useState(false),
    [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState<d.DispensationResultOut>(),
    [receiptId, setReceiptId] = useState<number>(),
    [printBusy, setPrintBusy] = useState(false),
    [printNotice, setPrintNotice] = useState("");
  const [feedbackId, setFeedbackId] = useState(0);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const view =
      establishment.views.screens.find((v) => v.screen_id === "dispense")
        ?.view || "hidden",
    visible = ["full", "open_work", "records"].includes(view);
  const retiring = establishment.capabilities
    .filter((c) => c.state === "Retiring")
    .map((c) => c.capability);
  const writable =
    connected &&
    stream === "Live" &&
    dispensingAllowed(user.permissions, view, establishment.active, retiring);
  const prescription = useLoad(
    () =>
      visible && can("prescription.view") && selected
        ? rx.getPrescription(selected)
        : Promise.resolve(undefined),
    [selected, revision, visible, can("prescription.view")],
  );
  const p =
    !prescription.loading &&
    !prescription.error &&
    prescription.data?.prescription_id === selected
      ? prescription.data
      : undefined;
  const identity = useLoad(
    () => (p ? patients.getPatient(p.patient_id) : Promise.resolve(undefined)),
    [p?.patient_id, revision],
  );
  const patient =
    !identity.loading &&
    !identity.error &&
    identity.data?.patient_id === p?.patient_id
      ? identity.data
      : undefined;
  const admissionId = p?.admission_id;
  const clearance = useLoad(
    () =>
      admissionId && can("ipd.discharge.clear_pharmacy")
        ? discharge.dischargeStatus(admissionId)
        : Promise.resolve(undefined),
    [admissionId, revision, can("ipd.discharge.clear_pharmacy")],
  );
  const drawer = useLoad(
    () =>
      visible && can("finance.shift.operate")
        ? cashDrawer.myShift({ node: "PharmacyCounter" })
        : Promise.resolve(null),
    [visible, revision, can("finance.shift.operate")],
  );
  const cashReady =
    !drawer.loading &&
    !drawer.error &&
    pharmacyCashShift(drawer.data, user.user_id);
  const medicines = useLoad(
    () =>
      admissionId && can("ipd.discharge.clear_pharmacy")
        ? api<OwnMedicine[]>("GET", `/admissions/${admissionId}/own-medicines`)
        : Promise.resolve([]),
    [admissionId, revision, can("ipd.discharge.clear_pharmacy")],
  );
  const receipts = useLoad(
    () =>
      receiptId && can("pharmacy.dispense")
        ? Promise.all([d.receipt(receiptId), d.dispensingLabels(receiptId)])
        : Promise.resolve(undefined),
    [receiptId, revision, can("pharmacy.dispense")],
  );
  const write = useClinicalWrite(
    user,
    `dispense:${selected}`,
    async (value, command) => {
      setReview(undefined);
      setChecker("");
      setPassword("");
      setAck(false);
      setQuantities({});
      setUnused(false);
      if (command.path.endsWith("/dispense")) {
        setSaved(value as d.DispensationResultOut);
        setReceiptId(
          (value as d.DispensationResultOut).dispensation.dispensation_id,
        );
      }
      setRevision((n) => n + 1);
    },
  );
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (
          e.type === "event" &&
          [
            "pharmacy.stock.updated",
            "pharmacy.recall.updated",
            "medication.order.updated",
            "patient.merged",
            "patient.death.recorded",
            "death.recorded",
            "admission.discharge.stage_changed",
          ].includes(e.event_type)
        )
          setRevision((n) => n + 1);
        if (e.type === "stream" && e.status === "Live" && e.resync)
          setRevision((n) => n + 1);
      }),
    [],
  );
  useEffect(() => {
    if (!write.blocked) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [write.blocked]);
  const ready = !!p && !!patient && !patient.is_deceased && !write.blocked;
  const valid =
    p &&
    p.destination === "HospitalPharmacy" &&
    ["Active", "PartiallyDispensed"].includes(p.status);
  const closeReview = () => {
    if (write.blocked) return;
    if (
      review &&
      review.kind !== "dispense" &&
      (review.kind === "stop" ? review.reason : review.note) &&
      !window.confirm(
        t(
          "Discard the unsent reason or note?",
          "غیر ارسال وجہ یا نوٹ چھوڑ دیں؟",
        ),
      )
    )
      return;
    setReview(undefined);
    setPassword("");
    setChecker("");
    setAck(false);
  };
  function openRecord(id: number) {
    if (write.blocked || printBusy) return;
    if (
      Object.values(quantities).some(Boolean) &&
      !window.confirm(
        t(
          "Discard unsent dispensing quantities?",
          "غیر ارسال مقداریں چھوڑ دیں؟",
        ),
      )
    )
      return;
    setSelected(id);
    setFeedbackId(0);
    setQuantities({});
    setSaved(undefined);
    setReceiptId(undefined);
    setPrintNotice("");
    setError(undefined);
    setRevision((n) => n + 1);
  }
  async function preflight(permission: string, snapshot?: string) {
    const [me, est, fresh] = await Promise.all([
      api<ClinicalUser>("GET", "/auth/me"),
      api<EstablishmentOut>("GET", "/establishment"),
      rx.getPrescription(selected),
    ]);
    const identity = await patients.getPatient(fresh.patient_id);
    if (
      me.user_id !== user.user_id ||
      !me.permissions.includes(permission) ||
      identity.is_deceased ||
      identity.merged_into_id
    )
      throw new Error(
        t(
          "Identity or permission changed. Refresh before continuing.",
          "شناخت یا اجازت بدل گئی۔ آگے بڑھنے سے پہلے تازہ کریں۔",
        ),
      );
    if (snapshot && snapshot !== dispenseSnapshot(fresh, identity.row_version))
      throw new Error(
        t(
          "The prescription or patient changed. Close and review it again.",
          "نسخہ یا مریض بدل گیا۔ بند کرکے دوبارہ جائزہ لیں۔",
        ),
      );
    const currentView = est.views.screens.find(
      (v) => v.screen_id === "dispense",
    )?.view;
    if (
      !connected ||
      stream !== "Live" ||
      !["full", "open_work"].includes(currentView || "")
    )
      throw new Error(
        t(
          "Wait for a live, permitted service before continuing.",
          "فعال رابطہ اور مجاز خدمت کا انتظار کریں۔",
        ),
      );
    if (
      permission === "pharmacy.dispense" &&
      !dispensingAllowed(
        me.permissions,
        currentView || "",
        est.active,
        est.capabilities
          .filter((c) => c.state === "Retiring")
          .map((c) => c.capability),
      )
    )
      throw new Error(
        t(
          "Dispensing is not available for this service state.",
          "اس خدمت کی حالت میں دوا فراہم نہیں کی جا سکتی۔",
        ),
      );
    return fresh;
  }
  function prepare() {
    setError(undefined);
    if (!ready || !writable || !p || !patient || !valid) return;
    try {
      if (!p.admission_id && mode === "Cash" && !cashReady)
        throw new Error(
          t(
            "Cash needs your own open Pharmacy Counter shift. Card remains available.",
            "نقد کے لیے فارمیسی کاؤنٹر پر اپنی کھلی شفٹ لازم۔ کارڈ دستیاب ہے۔",
          ),
        );
      const items = selectedDispenseLines(p, quantities),
        high = items.some(
          (l) =>
            p.items.find(
              (i) => i.prescription_item_id === l.prescription_item_id,
            )?.high_alert_category,
        );
      if (!p.admission_id && mode === "Card" && !reference.trim())
        throw new Error(t("Enter the card reference.", "کارڈ حوالہ درج کریں۔"));
      if (
        !p.admission_id &&
        ["CharityZakat", "SocialWelfare"].includes(mode) &&
        (!/^[1-9]\d*$/.test(approval) ||
          !Number.isSafeInteger(Number(approval)))
      )
        throw new Error(
          t(
            "Enter an approved pharmacy charity request ID.",
            "منظور شدہ فارمیسی فلاحی درخواست کا نمبر درج کریں۔",
          ),
        );
      setReviewAttempted(false);
      setReview({
        kind: "dispense",
        snapshot: dispenseSnapshot(p, patient.row_version),
        high,
        body: {
          items,
          ...(!p.admission_id
            ? {
                payment_mode: mode,
                cash_method: mode === "Card" ? "Card" : "Cash",
                ...(reference.trim() ? { reference_no: reference.trim() } : {}),
                ...(["CharityZakat", "SocialWelfare"].includes(mode)
                  ? { charity_approval_id: Number(approval) }
                  : {}),
              }
            : {}),
        },
      });
      setAck(false);
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!review || write.blocked || !p) return;
    setError(undefined);
    setFeedbackId(selected);
    setReviewAttempted(true);
    if (review.kind === "dispense") {
      if (!ack || (review.high && (!checker.trim() || !password))) return;
      const body = {
        ...review.body,
        ...(review.high
          ? { checker_username: checker.trim(), checker_password: password }
          : {}),
      };
      setPassword("");
      setChecker("");
      write.start(
        {
          method: "POST",
          path: `/prescriptions/${selected}/dispense`,
          body,
          permission: "pharmacy.dispense",
          protection: "idempotent",
          reconcilePath: `/prescriptions/${selected}`,
          label: t(
            "Dispense confirmed quantities",
            "تصدیق شدہ مقدار فراہم کریں",
          ),
        },
        async () => {
          const fresh = await preflight("pharmacy.dispense", review.snapshot);
          if (
            !fresh.admission_id &&
            ["CharityZakat", "SocialWelfare"].includes(
              review.body.payment_mode || "",
            )
          ) {
            const auth = await api<ApprovalOut>(
                "GET",
                `/approvals/${review.body.charity_approval_id}`,
              ),
              h = approvedCharityHandoff(auth, fresh);
            if (
              (h.fundType === "Zakat" ? "CharityZakat" : "SocialWelfare") !==
              review.body.payment_mode
            )
              throw new Error(
                t(
                  "The approved fund does not match the selected payment mode.",
                  "منظور شدہ فنڈ منتخب ادائیگی طریقے سے نہیں ملتا۔",
                ),
              );
          }
          if (!fresh.admission_id && review.body.payment_mode === "Cash") {
            const shift = await cashDrawer.myShift({ node: "PharmacyCounter" });
            if (!pharmacyCashShift(shift, user.user_id))
              throw new Error(
                t(
                  "Open your own cash shift at this terminal before collecting cash.",
                  "نقد وصولی سے پہلے اسی ٹرمینل پر اپنی کیش شفٹ کھولیں۔",
                ),
              );
          }
        },
      );
    } else if (review.kind === "stop")
      write.start(
        {
          method: "POST",
          path: `/prescriptions/${selected}/items/${review.item}/stop`,
          body: { reason: review.reason },
          permission: "prescription.cancel",
          protection: "reconcile",
          reconcilePath: `/prescriptions/${selected}`,
          label: t("Stop medication line", "دوا کی سطر بند کریں"),
        },
        () => preflight("prescription.cancel", review.snapshot).then(() => {}),
      );
    else
      write.start(
        {
          method: "POST",
          path: `/admissions/${review.admission}/discharge/PharmacyClearance/clear`,
          body: { note: review.note || null },
          permission: "ipd.discharge.clear_pharmacy",
          protection: "reconcile",
          reconcilePath: `/admissions/${review.admission}/discharge-status`,
          label: t(
            "Clear Pharmacy discharge stage",
            "فارمیسی ڈسچارج مرحلہ مکمل کریں",
          ),
        },
        async () => {
          await preflight("ipd.discharge.clear_pharmacy");
          const [a, m] = await Promise.all([
            discharge.dischargeStatus(review.admission),
            api<OwnMedicine[]>(
              "GET",
              `/admissions/${review.admission}/own-medicines`,
            ),
          ]);
          if (
            !pharmacyClearanceAllowed(a, review.admission, p.patient_id) ||
            m.some((i) => ["Received", "Retained"].includes(i.status))
          )
            throw new Error(
              t(
                "Verify the current Pharmacy stage and return held medicines first.",
                "پہلے فارمیسی کا تازہ مرحلہ اور رکھی دوا کی واپسی چیک کریں۔",
              ),
            );
        },
      );
  }
  async function print(labels: boolean, pdf: boolean) {
    if (!receiptId || printBusy) return;
    setPrintBusy(true);
    setError(undefined);
    setPrintNotice("");
    try {
      const r = await call("print-pharmacy", {
        dispensationId: receiptId,
        labels,
        pdf,
      });
      setPrintNotice(
        pdf
          ? r.saved
            ? t("PDF saved.", "پی ڈی ایف محفوظ ہو گئی۔")
            : t("Save cancelled.", "محفوظ کرنا منسوخ۔")
          : t("Printing completed.", "پرنٹ مکمل ہو گیا۔"),
      );
    } catch (e) {
      setError(e);
    } finally {
      setPrintBusy(false);
    }
  }
  if (!visible)
    return (
      <Empty>
        {t(
          "Dispensing is unavailable for this service view.",
          "اس خدمت کے منظر میں دوا کی فراہمی دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      data-help-screen="dispense"
      data-write-pending={write.blocked}
      data-unsaved={Object.values(quantities).some(Boolean) || !!reason}
    >
      <div className="section-heading">
        <div>
          <h1>{t("Dispense", "دوا فراہم کریں")}</h1>
          <p>
            {t(
              "Verify the patient, medicines and payment. Batches are selected by the server, earliest expiry first.",
              "مریض، دوا اور ادائیگی چیک کریں۔ پہلے ختم ہونے والی میعاد کا بیچ سرور چنتا ہے۔",
            )}
          </p>
        </div>
        <button
          data-help="dispense.read"
          disabled={write.blocked}
          onClick={() => setRevision((n) => n + 1)}
        >
          {t("Refresh dispensing", "فراہمی تازہ کریں")}
        </button>
        {onQueue && (
          <button
            data-help="dispense.read"
            disabled={write.blocked}
            onClick={onQueue}
          >
            {t("Back to prescription queue", "نسخوں کی قطار پر واپس")}
          </button>
        )}
      </div>
      <p role="status">
        {tr(connected ? stream : "Offline")} ·{" "}
        {view === "records"
          ? t("Records only", "صرف ریکارڈ")
          : view === "open_work"
            ? t(
                "No new dispensing work; existing work continues.",
                "نیا فراہمی کام نہیں؛ موجودہ کام جاری۔",
              )
            : t("Hospital pharmacy", "ہسپتال کی فارمیسی")}
      </p>
      <fieldset disabled={write.blocked}>
        <form
          className="actions"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !/^[1-9]\d*$/.test(lookup) ||
              !Number.isSafeInteger(Number(lookup))
            ) {
              setError(
                new Error(
                  t(
                    "Enter an existing positive prescription ID.",
                    "اصل مثبت نسخہ شناختی نمبر درج کریں۔",
                  ),
                ),
              );
              return;
            }
            openRecord(Number(lookup));
          }}
        >
          <Field label={t("Prescription ID", "نسخہ شناختی نمبر")}>
            <input
              data-help="dispense.read"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <button data-help="dispense.read">
            {t("Open prescription", "نسخہ کھولیں")}
          </button>
        </form>
      </fieldset>
      <ErrorBox error={error} />
      {otherPharmacyCashCounter(write.error) && (
        <p className="notice">
          {t(
            "Your drawer is open at another counter:",
            "آپ کی دراز دوسرے کاؤنٹر پر کھلی ہے:",
          )}{" "}
          <bdi>{otherPharmacyCashCounter(write.error)}</bdi>.{" "}
          {t(
            "Pharmacy cash requires your own Pharmacy Counter shift.",
            "فارمیسی نقد کے لیے فارمیسی کاؤنٹر پر اپنی شفٹ لازم ہے۔",
          )}
        </p>
      )}
      {!review && feedbackId === selected && (
        <ClinicalWriteFeedback
          write={write}
          onReviewed={() => {
            setQuantities({});
            setPassword("");
            setChecker("");
            setRevision((n) => n + 1);
          }}
        />
      )}
      <LoadState {...prescription} retry={prescription.reload} />
      <LoadState {...identity} retry={identity.reload} />
      {!can("prescription.view") && (
        <Empty>
          {t(
            "Your role cannot read prescription details.",
            "آپ کا کردار نسخے کی تفصیل نہیں پڑھ سکتا۔",
          )}
        </Empty>
      )}
      {p && (
        <>
          <section className="card">
            <h2>
              <bdi>
                {p.prescription_number} · {p.patient_name} · {p.mrn}
              </bdi>
            </h2>
            <p>
              {tr(p.source)} · {tr(p.destination)} · {tr(p.status)} ·{" "}
              {t("Patient / ticket / admission", "مریض / پرچی / داخلہ")}:{" "}
              {p.patient_id} / {p.ticket_id ?? "—"} / {p.admission_id ?? "—"}
            </p>
            <p>
              <bdi>{p.prescriber_stamp.text}</bdi>
            </p>
            {patient && (
              <p>
                {t("Allergies", "الرجی")}:{" "}
                <bdi>{patient.allergies || t("Not recorded", "درج نہیں")}</bdi>{" "}
                {patient.is_deceased && tr("Deceased")}
              </p>
            )}
            {patient?.photo_document_id && (
              <p>
                {t(
                  "Optional patient photo on file",
                  "اختیاری مریض تصویر موجود ہے",
                )}
              </p>
            )}
          </section>
          <fieldset disabled={!ready || write.blocked}>
            <section className="card">
              {onCharity && (
                <button
                  data-help="dispense.charity"
                  onClick={() => onCharity(p.prescription_id)}
                >
                  {t(
                    "Request Zakat / charity assistance",
                    "زکوٰۃ / فلاحی امداد درخواست دیں",
                  )}
                </button>
              )}
              <h2>
                {t("Dispense Now quantities", "اب فراہم کی جانے والی مقدار")}
              </h2>
              <p>
                {t(
                  "Leave a line blank to omit it. Partial dispensing preserves the rest; no batch choice is offered.",
                  "سطر چھوڑنے کے لیے خالی رکھیں۔ جزوی فراہمی باقی محفوظ رکھتی ہے؛ بیچ کا انتخاب نہیں۔",
                )}
              </p>
              {onQuery && (
                <button
                  data-help="dispense.query"
                  onClick={() => onQuery(p.prescription_id, null)}
                >
                  {t("Query whole prescription", "پورے نسخے پر سوال")}
                </button>
              )}
              {p.items.map((i) => (
                <article className="card" key={i.prescription_item_id}>
                  <strong>
                    <bdi>
                      {i.drug_name || i.external_drug_name} ·{" "}
                      {i.strength || i.external_strength} ·{" "}
                      {i.form || i.external_form}
                    </bdi>
                  </strong>
                  <p>
                    <bdi>
                      {i.dose_text} · {i.route} · {i.frequency_code} ·{" "}
                      {i.instructions}
                    </bdi>
                  </p>
                  <p>
                    {t(
                      "Prescribed / dispensed / remaining / stock",
                      "تجویز / فراہم / باقی / اسٹاک",
                    )}
                    : {i.qty_prescribed} / {i.qty_dispensed} / {i.qty_remaining}{" "}
                    / {i.qty_available ?? "—"} · {tr(i.item_status)}
                  </p>
                  {i.high_alert_category && (
                    <p className="notice">
                      {t(
                        "High-alert: second-person check required",
                        "زیادہ خطرہ: دوسرے فرد کی جانچ لازم",
                      )}
                      : {i.high_alert_category}
                    </p>
                  )}
                  {!!i.lasa_with.length && (
                    <p className="notice">
                      {t("Looks like", "ملتی جلتی دوا")}:{" "}
                      <bdi>{i.lasa_with.join(", ")}</bdi>
                    </p>
                  )}
                  {openQuery(p, i.prescription_item_id) && (
                    <p className="notice">
                      {t(
                        "Query open: wait for the doctor's answer. This line cannot be dispensed.",
                        "سوال کھلا ہے: معالج کے جواب کا انتظار۔ یہ سطر فراہم نہیں ہو سکتی۔",
                      )}
                    </p>
                  )}
                  <Field
                    label={
                      t("Dispense Now", "اب فراہم کریں") +
                      ` #${i.prescription_item_id}`
                    }
                  >
                    <input
                      data-help="dispense.quantity"
                      type="number"
                      min="0.000001"
                      step="any"
                      max={i.qty_remaining}
                      value={quantities[i.prescription_item_id] || ""}
                      disabled={
                        !writable ||
                        !valid ||
                        i.item_status !== "Active" ||
                        i.qty_remaining <= 0 ||
                        openQuery(p, i.prescription_item_id) ||
                        i.is_external
                      }
                      onChange={(e) =>
                        setQuantities((q) => ({
                          ...q,
                          [i.prescription_item_id]: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  {onQuery && (
                    <button
                      data-help="dispense.query"
                      onClick={() =>
                        onQuery(p.prescription_id, i.prescription_item_id)
                      }
                    >
                      {t("Query line", "سطر پر سوال")} #{i.prescription_item_id}
                    </button>
                  )}
                  {can("prescription.cancel") &&
                    i.item_status === "Active" &&
                    view !== "records" && (
                      <button
                        data-help="dispense.stop"
                        onClick={() => {
                          setReason("");
                          setReview({
                            kind: "stop",
                            item: i.prescription_item_id,
                            reason: "",
                            snapshot: dispenseSnapshot(p, patient!.row_version),
                          });
                        }}
                      >
                        {t("Stop this line", "یہ سطر بند کریں")}
                      </button>
                    )}
                </article>
              ))}
              {!p.admission_id && (
                <>
                  <LoadState {...drawer} retry={drawer.reload} />
                  {!cashReady && (
                    <p className="notice">
                      {t(
                        "Cash needs your own open Pharmacy Counter shift. Card remains available.",
                        "نقد کے لیے فارمیسی کاؤنٹر پر اپنی کھلی شفٹ لازم۔ کارڈ دستیاب ہے۔",
                      )}
                    </p>
                  )}
                  {onCashShift && (
                    <button data-help="dispense.payment" onClick={onCashShift}>
                      {t("Open My cash shift", "میری کیش شفٹ کھولیں")}
                    </button>
                  )}
                </>
              )}
              {p.admission_id ? (
                <p>
                  {t(
                    "The server bills the admission; no counter payment mode is selected.",
                    "سرور داخلے کے بل میں شامل کرتا ہے؛ کاؤنٹر ادائیگی کا طریقہ منتخب نہیں۔",
                  )}
                </p>
              ) : (
                <>
                  <Field label={t("Payment mode", "ادائیگی کا طریقہ")}>
                    <select
                      data-help="dispense.payment"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as typeof mode)}
                    >
                      {["Cash", "Card", "CharityZakat", "SocialWelfare"].map(
                        (m) => (
                          <option
                            key={m}
                            value={m}
                            disabled={m === "Cash" && !cashReady}
                          >
                            {tr(m)}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  {mode === "Card" && (
                    <Field label={t("Card reference", "کارڈ حوالہ")}>
                      <input
                        data-help="dispense.payment"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        maxLength={100}
                      />
                    </Field>
                  )}
                  {["CharityZakat", "SocialWelfare"].includes(mode) && (
                    <Field
                      label={t(
                        "Approved charity request ID",
                        "منظور شدہ فلاحی درخواست نمبر",
                      )}
                    >
                      <input
                        data-help="dispense.payment"
                        value={approval}
                        onChange={(e) => setApproval(e.target.value)}
                        inputMode="numeric"
                      />
                    </Field>
                  )}
                  <p>
                    {t(
                      "OPD is cash-and-carry. Credit requires approved charity. The server returns the final invoice total.",
                      "او پی ڈی نقد فروخت ہے۔ ادھار کو منظور فلاحی درخواست چاہیے۔ حتمی بل کی رقم سرور دے گا۔",
                    )}
                  </p>
                </>
              )}
              <button
                data-help="dispense.review"
                disabled={
                  !ready ||
                  !writable ||
                  !valid ||
                  (!p.admission_id && mode === "Cash" && !cashReady)
                }
                onClick={prepare}
              >
                {t("Review dispensing", "فراہمی کا جائزہ")}
              </button>
            </section>
          </fieldset>
          <section className="card">
            <h2>
              {t(
                "Dispensation history and printing",
                "فراہمی کی تاریخ اور پرنٹ",
              )}
            </h2>
            {!p.dispensations.length && (
              <Empty>
                {t(
                  "No dispensations recorded for this prescription.",
                  "اس نسخے کی کوئی فراہمی درج نہیں۔",
                )}
              </Empty>
            )}
            {p.dispensations.map((r) => (
              <button
                key={r.dispensation_id}
                data-help="dispense.print"
                disabled={write.blocked || printBusy}
                onClick={() => {
                  setReceiptId(r.dispensation_id);
                  setPrintNotice("");
                }}
              >
                D-{r.dispensation_id} · {r.total_amount} · {tr(r.payment_mode)}
              </button>
            ))}
            {saved && (
              <p role="status">
                {t("Confirmed dispensation", "تصدیق شدہ فراہمی")} D-
                {saved.dispensation.dispensation_id} ·{" "}
                {saved.invoice.invoice_no} · {saved.dispensation.total_amount}
              </p>
            )}
            {receiptId && (
              <>
                <LoadState {...receipts} retry={receipts.reload} />
                {!receipts.loading && !receipts.error && receipts.data && (
                  <>
                    <pre>{receipts.data[0].text}</pre>
                    {receipts.data[1].map((label, i) => (
                      <pre key={i}>{label.text}</pre>
                    ))}
                    {[
                      [false, false, t("Print receipt", "رسید پرنٹ کریں")],
                      [
                        false,
                        true,
                        t("Save receipt PDF", "رسید پی ڈی ایف محفوظ کریں"),
                      ],
                      [
                        true,
                        false,
                        t("Print medicine labels", "دوا کے لیبل پرنٹ کریں"),
                      ],
                      [
                        true,
                        true,
                        t("Save label PDFs", "لیبل پی ڈی ایف محفوظ کریں"),
                      ],
                    ].map(([labels, pdf, label]) => (
                      <button
                        data-help="dispense.print"
                        key={String(label)}
                        disabled={printBusy || write.blocked}
                        onClick={() =>
                          void print(Boolean(labels), Boolean(pdf))
                        }
                      >
                        {String(label)}
                      </button>
                    ))}
                    <p>
                      {t(
                        "Printing is separate. If a label fails, some may already be printed; check them before reprinting. Never dispense or charge again to print.",
                        "پرنٹ الگ ہے۔ لیبل خرابی پر کچھ پہلے چھپ سکتے ہیں؛ دوبارہ سے پہلے چیک کریں۔ پرنٹ کے لیے دوا یا رقم نہ دہرائیں۔",
                      )}
                    </p>
                  </>
                )}
              </>
            )}
            {printNotice && <p role="status">{printNotice}</p>}
          </section>
          {admissionId && can("ipd.discharge.clear_pharmacy") && (
            <section className="card">
              <h2>
                {t("Pharmacy discharge clearance", "فارمیسی ڈسچارج کلیئرنس")}
              </h2>
              <LoadState {...clearance} retry={clearance.reload} />
              <LoadState {...medicines} retry={medicines.reload} />
              {!clearance.loading &&
                !clearance.error &&
                clearance.data?.admission_id === admissionId &&
                clearance.data.patient_id === p.patient_id && (
                  <>
                    <h3>
                      <bdi>
                        {clearance.data.patient_name} · {clearance.data.mrn} ·{" "}
                        {clearance.data.admission_number}
                      </bdi>
                    </h3>
                    <Details value={clearance.data} />
                    {pharmacyClearanceState(
                      clearance.data,
                      admissionId,
                      p.patient_id,
                    )?.status === "Cleared" && (
                      <p role="status">
                        {t(
                          "Pharmacy clearance recorded",
                          "فارمیسی کلیئرنس درج ہے",
                        )}{" "}
                        ·{" "}
                        <bdi>
                          {
                            pharmacyClearanceState(
                              clearance.data,
                              admissionId,
                              p.patient_id,
                            )?.cleared_by_name
                          }{" "}
                          ·{" "}
                          {
                            pharmacyClearanceState(
                              clearance.data,
                              admissionId,
                              p.patient_id,
                            )?.cleared_at
                          }
                        </bdi>
                      </p>
                    )}
                    <Details value={medicines.data} />
                    <label>
                      <input
                        data-help="dispense.clear"
                        type="checkbox"
                        checked={unused}
                        onChange={(e) => setUnused(e.target.checked)}
                        disabled={write.blocked}
                      />
                      {t(
                        "Unused medicines have been returned or their authorised destruction recorded.",
                        "غیر استعمال دوا واپس یا اس کی مجاز تلفی درج ہو چکی ہے۔",
                      )}
                    </label>
                    <button
                      data-help="dispense.clear"
                      disabled={
                        !unused ||
                        write.blocked ||
                        !writable ||
                        medicines.loading ||
                        !!medicines.error ||
                        medicines.data?.some((m) =>
                          ["Received", "Retained"].includes(m.status),
                        ) ||
                        !pharmacyClearanceAllowed(
                          clearance.data,
                          admissionId,
                          p.patient_id,
                        )
                      }
                      onClick={() =>
                        setReview({
                          kind: "clear",
                          admission: admissionId,
                          note: "",
                        })
                      }
                    >
                      {t(
                        "Review Pharmacy clearance",
                        "فارمیسی کلیئرنس کا جائزہ",
                      )}
                    </button>
                    <p>
                      {t(
                        "After an unknown result, read the current discharge status and check the Pharmacy stage, officer and time. Never retry clearance automatically.",
                        "نامعلوم نتیجے پر تازہ ڈسچارج حالت، فارمیسی مرحلہ، افسر اور وقت چیک کریں۔ کلیئرنس خودکار نہ دہرائیں۔",
                      )}
                    </p>
                  </>
                )}
            </section>
          )}
        </>
      )}
      {review && (
        <Modal
          title={t("Confirm pharmacy action", "فارمیسی عمل کی تصدیق")}
          onClose={closeReview}
          closable={!write.blocked}
        >
          <p>
            <bdi>
              {p?.patient_name} · {p?.mrn} · {p?.prescription_number}
            </bdi>
          </p>
          {(review.kind !== "dispense" || reviewAttempted) && (
            <ClinicalWriteFeedback
              write={write}
              onReviewed={() => {
                setReview(undefined);
                setQuantities({});
                setPassword("");
                setChecker("");
                setRevision((n) => n + 1);
              }}
            />
          )}
          {review.kind === "dispense" ? (
            <>
              <Details value={review.body} />
              <p>
                {t(
                  "Confirm these quantities and payment mode; the server allocates FEFO batches and returns the final amount.",
                  "یہ مقداریں اور ادائیگی کا طریقہ چیک کریں؛ سرور بیچ چن کر آخری رقم دے گا۔",
                )}
              </p>
              <label>
                <input
                  data-help="dispense.confirm"
                  type="checkbox"
                  checked={ack}
                  disabled={write.blocked}
                  onChange={(e) => setAck(e.target.checked)}
                />
                {t(
                  "I verified this patient, order, quantities and payment mode.",
                  "میں نے مریض، حکم، مقدار اور ادائیگی کا طریقہ چیک کیا۔",
                )}
              </label>
              {review.high && (
                <>
                  <p className="notice">
                    {t(
                      "A different authorised person must check the order and medicines and co-sign.",
                      "دوسرا مجاز فرد حکم و دوا چیک کرکے تصدیق کرے۔",
                    )}
                  </p>
                  <Field
                    label={t("Checker username", "جانچنے والے کا صارف نام")}
                  >
                    <input
                      data-help="dispense.checker"
                      autoComplete="off"
                      value={checker}
                      disabled={write.blocked}
                      onChange={(e) => setChecker(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t("Checker password", "جانچنے والے کا پاس ورڈ")}
                  >
                    <input
                      data-help="dispense.checker"
                      type="password"
                      autoComplete="off"
                      value={password}
                      disabled={write.blocked}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                </>
              )}
            </>
          ) : (
            <Field label={t("Reason / clearance note", "وجہ / کلیئرنس نوٹ")}>
              <textarea
                data-help="dispense.confirm"
                value={review.kind === "stop" ? review.reason : review.note}
                maxLength={review.kind === "stop" ? 500 : 1000}
                disabled={write.blocked}
                onChange={(e) =>
                  setReview(
                    review.kind === "stop"
                      ? { ...review, reason: e.target.value }
                      : { ...review, note: e.target.value },
                  )
                }
              />
            </Field>
          )}
          <button
            data-help="dispense.confirm"
            disabled={
              write.blocked ||
              (review.kind === "dispense"
                ? !ack || (review.high && (!checker.trim() || !password))
                : review.kind === "stop" && review.reason.trim().length < 3)
            }
            onClick={confirm}
          >
            {t("Confirm pharmacy action", "فارمیسی عمل کی تصدیق")}
          </button>
        </Modal>
      )}
    </section>
  );
}
