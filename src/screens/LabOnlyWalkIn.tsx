import { useEffect, useState } from "react";
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
import * as lab from "../generated/lab_only_walkin";
import * as patients from "../generated/patient_search";
import { resolvePatientMaster } from "../patient-profile";
import { formatHospitalTime } from "../hospital-time";
import {
  makeLabWalkin,
  walkinTestAllowed,
  labWalkinWritable,
  labInvoiceCollectible,
  makeLabCollection,
  labInvoiceSnapshot,
} from "../lab-walkin-policy";
type Review =
  | { kind: "new"; body: lab.LabOnlyWalkIn; tests: lab.LabTestListItemOut[] }
  | { kind: "pay"; invoice: lab.InvoiceDetailOut; body: lab.CollectIn };
export function LabOnlyWalkIn({
  user,
  connected,
  stream,
  establishment,
  timeZone,
  currency,
  onCashShift,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
  currency?: string;
  onCashShift?: () => void;
}) {
  const can = (p: string) => user.permissions.includes(p),
    view =
      establishment.views.screens.find((s) => s.screen_id === "lab_only_walkin")
        ?.view || "hidden",
    visible = ["full", "open_work", "records"].includes(view),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [name, setName] = useState(""),
    [mobile, setMobile] = useState(""),
    [notes, setNotes] = useState(""),
    [referrer, setReferrer] = useState(""),
    [priority, setPriority] =
      useState<lab.LabOnlyWalkIn["priority"]>("Routine"),
    [ids, setIds] = useState<number[]>([]),
    [testQuery, setTestQuery] = useState(""),
    [appliedQuery, setAppliedQuery] = useState("");
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [patientId, setPatientId] = useState(0),
    [limit, setLimit] = useState("50"),
    [appliedLimit, setAppliedLimit] = useState(50),
    [reqId, setReqId] = useState(0),
    [reqLookup, setReqLookup] = useState(""),
    [review, setReview] = useState<Review>(),
    [reviewTried, setReviewTried] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [printing, setPrinting] = useState(false),
    [method, setMethod] = useState<"Cash" | "Card" | "BankTransfer">("Cash"),
    [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [saved, setSaved] = useState<lab.LabOnlyWalkInOut>(),
    [payment, setPayment] = useState<lab.InvoicePaymentOut>();
  const catalogue = useLoad(
    () =>
      visible &&
      [
        "lab.requisition.create",
        "lab.test.manage",
        "lab.requisition.view",
      ].some(can)
        ? lab.listTests()
        : Promise.resolve([]),
    [visible, revision],
  );
  const available =
      catalogue.loading || catalogue.error ? [] : catalogue.data || [],
    choices = available.filter((x) =>
      `${x.code} ${x.name} ${x.section}`
        .toLowerCase()
        .includes(appliedQuery.toLowerCase()),
    );
  const hits = useLoad(
    () =>
      visible && can("patient.search") && search
        ? patients.searchPatients({ q: search, limit: 30 })
        : Promise.resolve([]),
    [visible, search, revision],
  );
  const requisition = useLoad(
    () =>
      visible && reqId && ["lab.requisition.view", "lab.result.view"].some(can)
        ? api<lab.LabRequisitionDetailOut>("GET", `/lab/requisitions/${reqId}`)
        : Promise.resolve(undefined),
    [visible, reqId, revision],
  );
  const req =
    !requisition.loading &&
    !requisition.error &&
    requisition.data?.requisition_id === reqId
      ? requisition.data
      : undefined;
  useEffect(() => {
    if (req) setPatientId(req.patient_id);
  }, [req?.requisition_id, req?.patient_id]);
  const profile = useLoad(
    () =>
      visible && patientId && can("patient.view")
        ? resolvePatientMaster(patientId, patients.getPatient)
        : Promise.resolve(undefined),
    [visible, patientId, revision],
  );
  const patient = !profile.loading && !profile.error ? profile.data : undefined;
  const patientMatches =
    !!patient &&
    !!req &&
    (patient.patient_id === req.patient_id ||
      patient.merged_profiles.some((p) => p.patient_id === req.patient_id));
  const history = useLoad(
    () =>
      visible &&
      patient &&
      ["lab.requisition.view", "lab.result.view"].some(can)
        ? lab.listRequisitionsLab({
            patient_id: patient.patient_id,
            limit: appliedLimit,
          })
        : Promise.resolve([]),
    [visible, patient?.patient_id, appliedLimit, revision],
  );
  const invoice = useLoad(
    () =>
      visible && req?.invoice && can("finance.invoice.view")
        ? api<lab.InvoiceDetailOut>(
            "GET",
            `/finance/invoices/${req.invoice.invoice_id}`,
          )
        : Promise.resolve(undefined),
    [visible, req?.invoice?.invoice_id, revision],
  );
  const bill =
    !invoice.loading &&
    !invoice.error &&
    invoice.data?.invoice_id === req?.invoice?.invoice_id
      ? invoice.data
      : undefined;
  const report = useLoad(
    () =>
      visible && req
        ? lab.reportPrintLabRequisitionsPayload(req.requisition_id)
        : Promise.resolve(undefined),
    [visible, req?.requisition_id, revision],
  );
  const signed =
    !report.loading &&
    !report.error &&
    report.data?.document_type === "lab_report" &&
    report.data.fields.requisition_number === req?.requisition_number &&
    report.data.fields.mrn === req?.mrn &&
    report.data.fields.results.length > 0 &&
    report.data.fields.results.every((r) => !!r.verified_stamp);
  const create = useClinicalWrite(user, "lab-walkin:new", (value) => {
    const r = value as lab.LabOnlyWalkInOut;
    setSaved(r);
    setPatientId(r.patient.patient_id);
    setReqId(r.requisition?.requisition_id || 0);
    setReqLookup(r.requisition ? String(r.requisition.requisition_id) : "");
    setName("");
    setMobile("");
    setIds([]);
    setNotes("");
    setReferrer("");
    setReview(undefined);
    setPayment(undefined);
    setRevision((n) => n + 1);
  });
  const collect = useClinicalWrite(user, `lab-walkin:${reqId}`, (value) => {
    setPayment(value);
    setReview(undefined);
    setAmount("");
    setReference("");
    setRevision((n) => n + 1);
  });
  const blocked = create.blocked || collect.blocked || printing,
    canCreate = live && labWalkinWritable(user.permissions, view),
    canPay =
      live &&
      ["full", "open_work"].includes(view) &&
      can("finance.payment.collect") &&
      patientMatches &&
      !!req &&
      labInvoiceCollectible(bill, req.invoice?.invoice_id || 0, req.patient_id);
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (
          e.type === "event" &&
          [
            "lab.result.published",
            "patient.merged",
            "death.recorded",
            "patient.death.recorded",
            "opd.ticket.status_changed",
          ].includes(e.event_type)
        )
          setRevision((n) => n + 1);
        if (e.type === "stream" && e.status === "Live" && e.resync)
          setRevision((n) => n + 1);
      }),
    [],
  );
  useEffect(() => {
    if (!create.blocked && !collect.blocked) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [create.blocked, collect.blocked]);
  const time = (v: string) => (timeZone ? formatHospitalTime(v, timeZone) : v);
  const refresh = () => {
    if (blocked) return;
    setError(undefined);
    setRevision((n) => n + 1);
  };
  function openReq(id: number) {
    if (blocked) return;
    setReqId(id);
    setReqLookup(String(id));
    setPayment(undefined);
    setAmount("");
    setReference("");
    setRevision((n) => n + 1);
  }
  function prepareNew() {
    setError(undefined);
    if (
      !canCreate ||
      blocked ||
      (ids.length > 0 && (catalogue.loading || catalogue.error))
    )
      return;
    try {
      const body = makeLabWalkin(
        name,
        mobile,
        ids,
        available,
        establishment.active,
        priority,
        notes,
        referrer,
      );
      setReviewTried(false);
      setReview({
        kind: "new",
        body,
        tests: available.filter((x) => ids.includes(x.test_id)),
      });
    } catch (e) {
      setError(e);
    }
  }
  function preparePay() {
    setError(undefined);
    if (!canPay || !bill || blocked) return;
    try {
      setReviewTried(false);
      setReview({
        kind: "pay",
        invoice: bill,
        body: makeLabCollection(bill, amount, method, reference),
      });
    } catch (e) {
      setError(e);
    }
  }
  async function fresh() {
    const [me, est] = await Promise.all([
      api<ClinicalUser>("GET", "/auth/me"),
      api<EstablishmentOut>("GET", "/establishment"),
    ]);
    if (me.user_id !== user.user_id || !live)
      throw Error(
        t(
          "The session or connection changed. Refresh before continuing.",
          "صارف یا رابطہ بدل گیا۔ آگے سے پہلے تازہ کریں۔",
        ),
      );
    return { me, est };
  }
  function confirm() {
    if (!review || blocked) return;
    setError(undefined);
    setReviewTried(true);
    if (review.kind === "new") {
      const r = review;
      create.start(
        {
          method: "POST",
          path: "/patients/lab-only-walk-in",
          body: r.body,
          permission: "patient.create",
          protection: "idempotent",
          label: t(
            "Register NEW Lab-only patient",
            "نیا صرف لیب مریض درج کریں",
          ),
        },
        async () => {
          const { me, est } = await fresh();
          if (
            !labWalkinWritable(
              me.permissions,
              est.views.screens.find((s) => s.screen_id === "lab_only_walkin")
                ?.view || "hidden",
            )
          )
            throw Error(
              t(
                "New lab registration is unavailable.",
                "نئی لیب رجسٹریشن دستیاب نہیں۔",
              ),
            );
          const actual = r.body.test_ids?.length ? await lab.listTests() : [];
          makeLabWalkin(
            r.body.full_name,
            r.body.mobile,
            r.body.test_ids || [],
            actual,
            est.active,
            r.body.priority,
            r.body.clinical_notes || "",
            r.body.referring_doctor_name || "",
          );
          if (
            r.tests.some(
              (old) =>
                JSON.stringify(old) !==
                JSON.stringify(actual.find((x) => x.test_id === old.test_id)),
            )
          )
            throw Error(
              t(
                "The test catalogue changed. Close and review again.",
                "ٹیسٹ فہرست بدل گئی۔ بند کرکے پھر جائزہ لیں۔",
              ),
            );
        },
      );
    } else {
      const r = review;
      if (!req) return;
      collect.start(
        {
          method: "POST",
          path: `/finance/invoices/${r.invoice.invoice_id}/payments`,
          body: r.body,
          permission: "finance.payment.collect",
          protection: "idempotent",
          reconcilePath: `/finance/invoices/${r.invoice.invoice_id}`,
          label: t(
            "Collect the reviewed lab bill",
            "جائزہ شدہ لیب بل وصول کریں",
          ),
        },
        async () => {
          const { me, est } = await fresh();
          const i = await api<lab.InvoiceDetailOut>(
            "GET",
            `/finance/invoices/${r.invoice.invoice_id}`,
          );
          if (
            !me.permissions.includes("finance.payment.collect") ||
            !["full", "open_work"].includes(
              est.views.screens.find((s) => s.screen_id === "lab_only_walkin")
                ?.view || "",
            ) ||
            !labInvoiceCollectible(i, r.invoice.invoice_id, req.patient_id) ||
            labInvoiceSnapshot(i) !== labInvoiceSnapshot(r.invoice)
          )
            throw Error(
              t(
                "The invoice changed or is locked. Close and review again.",
                "بل بدل گیا یا مقفل ہے۔ بند کرکے پھر جائزہ لیں۔",
              ),
            );
          if (r.body.method === "Cash") {
            const [shift, terminal] = await Promise.all([
              api<{ user_id: number; status: string; node: string } | null>(
                "GET",
                "/finance/cash-shifts/mine",
              ),
              api<{ cash_node: string | null }>("GET", "/terminals/whoami"),
            ]);
            if (
              !shift ||
              shift.user_id !== user.user_id ||
              shift.status !== "Open" ||
              !terminal.cash_node ||
              shift.node !== terminal.cash_node
            )
              throw Error(
                t(
                  "Open your own mapped cash shift before collecting cash.",
                  "نقد سے پہلے اپنی مقررہ کیش شفٹ کھولیں۔",
                ),
              );
          }
        },
      );
    }
  }
  async function print(pdf: boolean, server = false) {
    if (blocked || !req || !signed || !patientMatches) return;
    setPrinting(true);
    setError(undefined);
    setNotice("");
    try {
      const result = server
        ? await call("clinical-pdf", {
            path: `/lab/requisitions/${req.requisition_id}/report/pdf`,
          })
        : await call("print-diagnostic", {
            kind: "lab",
            id: req.requisition_id,
            pdf,
          });
      setNotice(
        result.saved
          ? t("PDF saved.", "پی ڈی ایف محفوظ۔")
          : result.printed
            ? t("Print sent.", "پرنٹ بھیج دیا۔")
            : t(
                "Save cancelled; no registration or payment repeated.",
                "محفوظ کرنا منسوخ؛ رجسٹریشن یا رقم نہیں دہرائی۔",
              ),
      );
    } catch (e) {
      setError(e);
    } finally {
      setPrinting(false);
    }
  }
  if (!visible)
    return (
      <Empty>
        {t(
          "Lab-only walk-in is unavailable for this service view.",
          "اس خدمت میں صرف لیب رجسٹریشن دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      data-help-screen="lab_only_walkin"
      data-write-pending={create.blocked || collect.blocked || printing}
      data-unsaved={
        !!(
          name ||
          mobile ||
          notes ||
          referrer ||
          ids.length ||
          amount ||
          reference
        )
      }
    >
      <div className="section-heading">
        <div>
          <h1>{t("Lab-only walk-in", "صرف لیب کے لیے آمد")}</h1>
          <p>
            {t(
              "Register a new lab patient, collect the separate bill, and hand over signed reports. No doctor queue is created.",
              "نیا لیب مریض درج، الگ بل وصول اور دستخط شدہ رپورٹ دیں۔ معالج کی قطار نہیں بنتی۔",
            )}
          </p>
        </div>
        <button data-help="walkin.refresh" onClick={refresh} disabled={blocked}>
          {t("Refresh lab walk-in", "لیب آمد تازہ کریں")}
        </button>
      </div>
      <p role="status">
        {tr(connected ? stream : "Offline")} ·{" "}
        {view === "open_work"
          ? t(
              "No new lab walk-ins; existing work continues.",
              "نئی لیب آمد نہیں؛ موجودہ کام جاری۔",
            )
          : view === "records"
            ? t("Records only", "صرف ریکارڈ")
            : t(
                "Reception / cashier collection",
                "استقبالیہ / کیشیئر وصولی",
              )}{" "}
        {currency && <bdi> · {currency}</bdi>}
      </p>
      <ErrorBox error={error} />
      {notice && <p role="status">{notice}</p>}
      {!review && (
        <>
          <ClinicalWriteFeedback write={create} />
          <ClinicalWriteFeedback
            write={collect}
            onReviewed={() => {
              setReview(undefined);
              setRevision((n) => n + 1);
            }}
          />
        </>
      )}
      {saved && (
        <p className="notice">
          {t("Last confirmed NEW registration", "آخری تصدیق شدہ نئی رجسٹریشن")}:{" "}
          <bdi>
            {saved.patient.full_name} · {saved.patient.mrn}
          </bdi>{" "}
          ·{" "}
          {saved.requisition?.requisition_number ||
            t(
              "No tests ordered; no lab bill created.",
              "ٹیسٹ نہیں مانگے؛ لیب بل نہیں بنا۔",
            )}{" "}
          {t(
            "Payment and printing failures must never repeat this registration.",
            "رقم یا پرنٹ خرابی پر یہ رجسٹریشن نہ دہرائیں۔",
          )}
        </p>
      )}
      <fieldset disabled={blocked}>
        <section className="card">
          <h2>
            {t(
              "Find an existing patient / collect a report",
              "موجودہ مریض تلاش / رپورٹ دیں",
            )}
          </h2>
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query.trim());
            }}
          >
            <Field
              label={t(
                "Name, mobile, MRN or CNIC",
                "نام، موبائل، ایم آر این یا شناختی کارڈ",
              )}
            >
              <input
                data-help="walkin.find"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!can("patient.search")}
              />
            </Field>
            <button
              data-help="walkin.find"
              disabled={!can("patient.search") || !query.trim()}
            >
              {t("Find lab patient", "لیب مریض تلاش کریں")}
            </button>
          </form>
          <LoadState {...hits} retry={hits.reload} />
          {search && !hits.loading && !hits.error && !hits.data?.length && (
            <Empty>
              {t(
                "No match. Check the identifiers before creating a NEW patient.",
                "کوئی مماثلت نہیں۔ نیا مریض بنانے سے پہلے شناخت چیک کریں۔",
              )}
            </Empty>
          )}
          {!hits.loading &&
            !hits.error &&
            hits.data?.map((h) => (
              <button
                data-help="walkin.patient"
                key={h.patient_id}
                onClick={() => {
                  setPatientId(h.patient_id);
                  setReqId(0);
                  setReqLookup("");
                  setPayment(undefined);
                  setRevision((n) => n + 1);
                }}
              >
                <bdi>
                  {h.full_name} · {h.mrn} · {h.mobile}
                </bdi>
              </button>
            ))}
          <p>
            {t(
              "For an existing patient, review their records here; do not create a duplicate to repair a payment or print failure.",
              "موجودہ مریض کا ریکارڈ یہاں دیکھیں؛ رقم یا پرنٹ خطا کے لیے نقل مریض نہ بنائیں۔",
            )}
          </p>
        </section>
      </fieldset>
      {view === "full" &&
        ["patient.create", "lab.requisition.create"].every(can) && (
          <fieldset disabled={blocked || !canCreate}>
            <section className="card">
              <h2>
                {t(
                  "Register NEW Lab-only patient",
                  "نیا صرف لیب مریض درج کریں",
                )}
              </h2>
              <div className="form-grid">
                <Field label={t("Full name", "پورا نام")}>
                  <input
                    data-help="walkin.new"
                    value={name}
                    maxLength={200}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label={t("Mobile", "موبائل")}>
                  <input
                    data-help="walkin.new"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    maxLength={21}
                    inputMode="tel"
                  />
                </Field>
                <Field label={t("Priority", "ترجیح")}>
                  <select
                    data-help="walkin.new"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as typeof priority)
                    }
                  >
                    {["Routine", "Urgent", "STAT"].map((x) => (
                      <option key={x}>{tr(x)}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={t(
                    "Outside referring doctor (optional)",
                    "بیرونی حوالہ دینے والا معالج (اختیاری)",
                  )}
                >
                  <input
                    data-help="walkin.new"
                    maxLength={200}
                    value={referrer}
                    onChange={(e) => setReferrer(e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label={t("Clinical notes (optional)", "طبی نوٹس (اختیاری)")}
              >
                <textarea
                  data-help="walkin.new"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                />
              </Field>
              <h3>{t("Optional tests", "اختیاری ٹیسٹ")}</h3>
              <form
                className="actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedQuery(testQuery.trim());
                }}
              >
                <Field
                  label={t("Find catalogue tests", "فہرست میں ٹیسٹ تلاش کریں")}
                >
                  <input
                    data-help="walkin.tests"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                  />
                </Field>
                <button data-help="walkin.tests">
                  {t("Filter tests", "ٹیسٹ چھانٹیں")}
                </button>
              </form>
              <LoadState {...catalogue} retry={catalogue.reload} />
              {!catalogue.loading && !catalogue.error && !choices.length && (
                <Empty>
                  {t(
                    "No tests match; clear the filter. Tests are optional.",
                    "کوئی ٹیسٹ نہیں ملا؛ چھانٹی صاف کریں۔ ٹیسٹ اختیاری ہیں۔",
                  )}
                </Empty>
              )}
              {choices.map((x) => (
                <label className="card" key={x.test_id}>
                  <input
                    data-help="walkin.tests"
                    type="checkbox"
                    checked={ids.includes(x.test_id)}
                    disabled={!walkinTestAllowed(x, establishment.active)}
                    onChange={(e) =>
                      setIds((old) =>
                        e.target.checked
                          ? [...old, x.test_id]
                          : old.filter((i) => i !== x.test_id),
                      )
                    }
                  />
                  <bdi>
                    {x.code} · {x.name} · {x.sample_type}
                  </bdi>{" "}
                  · {tr(x.availability)} ·{" "}
                  {x.price ?? t("Price not returned", "قیمت نہیں ملی")}
                  {x.availability === "SendOut" && (
                    <p>
                      {t(
                        "Tell the patient: sent to partner laboratory",
                        "مریض کو بتائیں: شریک لیب کو بھیجا جائے گا",
                      )}{" "}
                      <bdi>
                        {x.send_out_partner_name ||
                          t(
                            "Ask the laboratory to confirm the partner",
                            "لیب سے شریک کی تصدیق کرائیں",
                          )}
                      </bdi>
                    </p>
                  )}
                  {!walkinTestAllowed(x, establishment.active) && (
                    <p>
                      {t(
                        "Unavailable while its service is not Active.",
                        "متعلقہ خدمت فعال نہ ہونے پر دستیاب نہیں۔",
                      )}
                    </p>
                  )}
                </label>
              ))}
              <button
                data-help="walkin.review"
                disabled={
                  ids.length > 0 && (catalogue.loading || !!catalogue.error)
                }
                onClick={prepareNew}
              >
                {t("Review NEW lab registration", "نئی لیب رجسٹریشن کا جائزہ")}
              </button>
            </section>
          </fieldset>
        )}
      <fieldset disabled={blocked}>
        <section className="card">
          <h2>{t("Patient requisitions", "مریض کی لیب درخواستیں")}</h2>
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !/^[1-9]\d*$/.test(reqLookup) ||
                !Number.isSafeInteger(Number(reqLookup))
              ) {
                setError(
                  Error(
                    t(
                      "Enter an existing positive requisition ID.",
                      "اصل مثبت درخواست نمبر دیں۔",
                    ),
                  ),
                );
                return;
              }
              openReq(Number(reqLookup));
            }}
          >
            <Field
              label={t("Known lab requisition ID", "اصل لیب درخواست نمبر")}
            >
              <input
                data-help="walkin.requisition"
                inputMode="numeric"
                value={reqLookup}
                onChange={(e) => setReqLookup(e.target.value)}
              />
            </Field>
            <button data-help="walkin.requisition">
              {t("Open lab requisition", "لیب درخواست کھولیں")}
            </button>
          </form>
          <LoadState {...profile} retry={profile.reload} />
          {patient && (
            <article className="card">
              <h3>
                <bdi>
                  {patient.full_name} · {patient.mrn}
                </bdi>
              </h3>
              <p>
                {tr(patient.gender || "Not recorded")} ·{" "}
                {(patient.dob || patient.age_years) ??
                  t(
                    "Age / date of birth not recorded",
                    "عمر / تاریخ پیدائش درج نہیں",
                  )}
              </p>
              <p>
                {t("Allergies", "الرجی")}:{" "}
                <bdi>{patient.allergies || t("Not recorded", "درج نہیں")}</bdi>
              </p>
              {patient.is_deceased && (
                <p className="notice">{tr("Deceased")}</p>
              )}
              {patient.mlc_numbers.length > 0 && (
                <p className="notice">
                  <bdi>MEDICO-LEGAL · {patient.mlc_numbers.join(", ")}</bdi>
                </p>
              )}
              {patient.temp_identifier && (
                <p>
                  <bdi>{patient.temp_identifier}</bdi>
                </p>
              )}
              {patient.outstanding.banner_text && (
                <p className="notice">
                  <bdi>{patient.outstanding.banner_text}</bdi>
                </p>
              )}
              <p>
                {tr("Blood group")}:{" "}
                <bdi>{patient.blood_group || tr("Not recorded")}</bdi>
              </p>
            </article>
          )}
          <Field label={t("History limit (1–200)", "تاریخ کی حد (1–200)")}>
            <input
              data-help="walkin.requisition"
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </Field>
          <button
            data-help="walkin.requisition"
            onClick={() => {
              const n = Number(limit);
              if (!Number.isInteger(n) || n < 1 || n > 200) {
                setError(
                  Error(t("Use a limit from 1 to 200.", "حد1تا200رکھیں۔")),
                );
                return;
              }
              setAppliedLimit(n);
            }}
          >
            {t("Apply history limit", "تاریخ کی حد لاگو کریں")}
          </button>
          <LoadState {...history} retry={history.reload} />
          {patient &&
            !history.loading &&
            !history.error &&
            !history.data?.length && (
              <Empty>
                {t(
                  "No requisitions for this patient. A name-only registration may have no tests.",
                  "اس مریض کی درخواست نہیں۔ صرف نام رجسٹریشن میں ٹیسٹ نہ ہوں۔",
                )}
              </Empty>
            )}
          {!history.loading &&
            !history.error &&
            history.data?.map((x) => (
              <button
                data-help="walkin.requisition"
                key={x.requisition_id}
                onClick={() => openReq(x.requisition_id)}
              >
                <bdi>{x.requisition_number}</bdi> · {tr(x.status)} ·{" "}
                {x.published}/{x.tests} · {time(x.ordered_at)}
              </button>
            ))}
          {history.data?.length === appliedLimit && (
            <p>
              {t(
                "Limit reached; older requisitions may be omitted. Increase the limit if needed.",
                "حد پوری؛ پرانی درخواست چھوٹ سکتی۔ ضرورت پر حد بڑھائیں۔",
              )}
            </p>
          )}
        </section>
      </fieldset>
      <LoadState {...requisition} retry={requisition.reload} />
      {req && patientMatches && (
        <>
          <section className="card">
            <h2>
              <bdi>
                {req.requisition_number} · {req.patient_name} · {req.mrn}
              </bdi>
            </h2>
            <p>
              {tr(req.status)} · {tr(req.priority)} · {time(req.ordered_at)}
            </p>
            {req.items.map((i) => (
              <p key={i.lab_requisition_item_id}>
                <bdi>
                  {i.code} · {i.test_name}
                </bdi>{" "}
                · {tr(i.status)}{" "}
                {i.is_send_out && <bdi> · {i.partner_name}</bdi>}
              </p>
            ))}
            <p>
              {t(
                "Samples wait for the paid bill. Lab staff never collect cash.",
                "نمونہ ادا شدہ بل کا منتظر۔ لیب عملہ نقد وصول نہیں کرتا۔",
              )}
            </p>
          </section>
          <section className="card">
            <h2>{t("Separate lab bill collection", "لیب بل کی الگ وصولی")}</h2>
            <LoadState {...invoice} retry={invoice.reload} />
            {bill && (
              <>
                <p>
                  <bdi>{bill.invoice_no}</bdi> · {tr(bill.status)} ·{" "}
                  {t("Server balance due", "سرور کا بقایا")}: {bill.balance_due}
                </p>
                {bill.is_locked && (
                  <p className="notice">
                    <bdi>{bill.locked_reason}</bdi>
                  </p>
                )}
                {canPay && (
                  <fieldset disabled={blocked}>
                    <Field
                      label={t(
                        "Amount (blank = full server balance)",
                        "رقم (خالی = سرور کا مکمل بقایا)",
                      )}
                    >
                      <input
                        data-help="walkin.pay"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </Field>
                    <Field label={t("Collection method", "وصولی کا طریقہ")}>
                      <select
                        data-help="walkin.pay"
                        value={method}
                        onChange={(e) =>
                          setMethod(e.target.value as typeof method)
                        }
                      >
                        {["Cash", "Card", "BankTransfer"].map((x) => (
                          <option key={x}>{tr(x)}</option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={t(
                        "Payment reference (optional)",
                        "ادائیگی حوالہ (اختیاری)",
                      )}
                    >
                      <input
                        data-help="walkin.pay"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </Field>
                    <button data-help="walkin.pay" onClick={preparePay}>
                      {t("Review lab payment", "لیب ادائیگی کا جائزہ")}
                    </button>
                  </fieldset>
                )}
              </>
            )}
            {!can("finance.invoice.view") && (
              <p>
                {t(
                  "Ask the authorised cashier to read and collect the invoice; no bill balance is guessed here.",
                  "مجاز کیشیئر سے بل پڑھ کر وصول کرائیں؛ یہاں بقایا فرض نہیں کیا جاتا۔",
                )}
              </p>
            )}
            {onCashShift && (
              <button
                data-help="walkin.pay"
                disabled={blocked}
                onClick={onCashShift}
              >
                {t("Open My cash shift", "میری کیش شفٹ کھولیں")}
              </button>
            )}
            {payment && payment.invoice.invoice_id === bill?.invoice_id && (
              <p role="status">
                {t("Confirmed payment receipt", "تصدیق شدہ ادائیگی رسید")}:{" "}
                <bdi>{payment.payment.receipt_no}</bdi> ·{" "}
                {payment.payment.amount} · {tr(payment.payment.method)} ·{" "}
                {t("Server balance due", "سرور کا بقایا")}:{" "}
                {payment.invoice.balance_due}
              </p>
            )}
          </section>
          <section className="card">
            <h2>{t("Signed lab report", "دستخط شدہ لیب رپورٹ")}</h2>
            <LoadState {...report} retry={report.reload} />
            {signed && report.data && (
              <>
                <p>
                  {report.data.fields.complete
                    ? t(
                        "All reported tests complete.",
                        "رپورٹ کے تمام ٹیسٹ مکمل۔",
                      )
                    : t(
                        "Partial report: some tests are still running.",
                        "جزوی رپورٹ: کچھ ٹیسٹ ابھی جاری ہیں۔",
                      )}
                </p>
                {report.data.fields.results.map((r) => (
                  <article key={r.result_id}>
                    <h3>
                      <bdi>
                        {r.code} · {r.test_name}
                      </bdi>
                    </h3>
                    {r.rows.map((row) => (
                      <p key={row.key}>
                        <bdi>
                          {row.label} · {String(row.value ?? "—")} {row.unit} ·{" "}
                          {row.reference} · {row.flag}
                        </bdi>
                      </p>
                    ))}
                    <p>
                      <bdi>
                        {r.interpretation} · {r.performed_by_partner}
                      </bdi>
                    </p>
                    {r.is_correction && (
                      <p>
                        <bdi>{r.correction_reason}</bdi>
                      </p>
                    )}
                    <p>
                      <bdi>{r.performed_stamp.text}</bdi>
                    </p>
                    <p>
                      <bdi>{r.verified_stamp?.text}</bdi>
                    </p>
                  </article>
                ))}
                <div className="actions">
                  <button
                    data-help="walkin.print"
                    disabled={blocked}
                    onClick={() => void print(false)}
                  >
                    {t(
                      "Print signed report (A4)",
                      "دستخط شدہ رپورٹ پرنٹ (اے فور)",
                    )}
                  </button>
                  <button
                    data-help="walkin.print"
                    disabled={blocked}
                    onClick={() => void print(true)}
                  >
                    {t("Save report PDF", "رپورٹ پی ڈی ایف محفوظ کریں")}
                  </button>
                  <button
                    data-help="walkin.print"
                    disabled={blocked}
                    onClick={() => void print(true, true)}
                  >
                    {t(
                      "Download server report PDF",
                      "سرور رپورٹ پی ڈی ایف لیں",
                    )}
                  </button>
                </div>
              </>
            )}
            {report.data && !report.loading && !report.error && !signed && (
              <p className="notice">
                {t(
                  "No signed report is ready. Ask the laboratory; never release an unsigned result.",
                  "دستخط شدہ رپورٹ تیار نہیں۔ لیب سے کہیں؛ غیر دستخط نتیجہ نہ دیں۔",
                )}
              </p>
            )}
            <p>
              {t(
                "A print or download failure never repeats registration or payment.",
                "پرنٹ یا ڈاؤن لوڈ خرابی پر رجسٹریشن یا ادائیگی نہیں دہراتے۔",
              )}
            </p>
          </section>
        </>
      )}
      {review && (
        <Modal
          title={
            review.kind === "new"
              ? t("Confirm NEW lab registration", "نئی لیب رجسٹریشن کی تصدیق")
              : t("Confirm separate lab payment", "الگ لیب ادائیگی کی تصدیق")
          }
          closable={!blocked}
          onClose={() => {
            if (!blocked) setReview(undefined);
          }}
        >
          {review.kind === "new" ? (
            <>
              <p>
                <bdi>
                  {review.body.full_name} · {review.body.mobile}
                </bdi>
              </p>
              <p>
                {tr(review.body.priority || "Routine")} ·{" "}
                <bdi>{review.body.referring_doctor_name}</bdi>
              </p>
              {review.tests.map((x) => (
                <p key={x.test_id}>
                  <bdi>
                    {x.name} · {x.price} · {x.send_out_partner_name}
                  </bdi>
                </p>
              ))}
              <p>
                {t(
                  "Creates a NEW LabOnly patient and optional requisition/bill. No OPD slip, doctor queue or payment.",
                  "نیا صرف لیب مریض اور اختیاری درخواست/بل۔ او پی ڈی، معالج قطار یا رقم نہیں۔",
                )}
              </p>
            </>
          ) : (
            <>
              <p>
                <bdi>
                  {patient?.full_name} · {patient?.mrn} ·{" "}
                  {review.invoice.invoice_no}
                </bdi>
              </p>
              <p>
                {review.body.amount} · {tr(review.body.method || "Cash")} ·{" "}
                <bdi>{review.body.reference_no}</bdi>
              </p>
              <p>
                {t(
                  "This is a separate money collection. Confirm the patient, invoice and amount once.",
                  "یہ الگ رقم وصولی ہے۔ مریض، بل اور رقم ایک بار چیک کرکے تصدیق کریں۔",
                )}
              </p>
            </>
          )}
          {reviewTried && (
            <ClinicalWriteFeedback
              write={review.kind === "new" ? create : collect}
            />
          )}
          <button
            data-help="walkin.confirm"
            disabled={blocked}
            onClick={confirm}
          >
            {t("Confirm reviewed lab action", "جائزہ شدہ لیب عمل کی تصدیق")}
          </button>
        </Modal>
      )}
    </section>
  );
}
