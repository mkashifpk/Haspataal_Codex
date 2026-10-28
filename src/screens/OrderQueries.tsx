import { useEffect, useState } from "react";
import { api } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t, tr } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as q from "../generated/order_queries";
import {
  makeOrderQuery,
  queryReasons,
  queryPrescriptionSnapshot,
  queryRowSnapshot,
  mayChangeQueries,
} from "../order-query-policy";
type Context = { prescriptionId: number; itemId?: number | null };
type Review =
  | {
      kind: "raise";
      prescriptionId: number;
      body: q.QueryIn;
      snapshot: string;
      patient: string;
      mrn: string;
      number: string;
    }
  | {
      kind: "withdraw";
      row: q.PrescriptionQueryOut;
      reason: string;
      snapshot: string;
    };
const reasons: Record<string, [string, string]> = {
  Unclear: ["Unclear order", "غیر واضح حکم"],
  DoseOrFrequency: ["Dose or frequency", "مقدار یا تکرار"],
  Allergy: ["Allergy", "الرجی"],
  Interaction: ["Interaction", "دواؤں کا باہمی اثر"],
  Duplicate: ["Duplicate medicine", "دوا کی تکرار"],
  ChildDose: ["Child's dose", "بچے کی مقدار"],
  Restricted: ["Restricted medicine", "محدود اجازت کی دوا"],
  WrongPatient: ["Wrong patient", "غلط مریض"],
  Other: ["Other", "دیگر"],
};
export function OrderQueries({
  user,
  connected,
  stream,
  establishment,
  timeZone,
  initial,
  onDispense,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
  initial?: Context;
  onDispense?: (id: number) => void;
}) {
  const can = (permission: string) => user.permissions.includes(permission),
    view =
      establishment.views.screens.find((v) => v.screen_id === "order_queries")
        ?.view || "hidden",
    visible = ["full", "open_work", "records"].includes(view);
  const [selected, setSelected] = useState(initial?.prescriptionId || 0),
    [lookup, setLookup] = useState(
      initial ? String(initial.prescriptionId) : "",
    ),
    [target, setTarget] = useState(
      initial?.itemId === null
        ? "whole"
        : initial?.itemId
          ? String(initial.itemId)
          : "",
    ),
    [reason, setReason] = useState(""),
    [question, setQuestion] = useState("");
  const [status, setStatus] = useState(""),
    [mine, setMine] = useState(false),
    [rxFilter, setRxFilter] = useState(""),
    [limit, setLimit] = useState("200"),
    [filter, setFilter] = useState<{
      status?: "Open" | "Answered" | "Withdrawn";
      mine: boolean;
      prescription_id?: number;
      limit: number;
    }>({ mine: false, limit: 200 }),
    [find, setFind] = useState("");
  const [listRevision, setListRevision] = useState(0),
    [detailRevision, setDetailRevision] = useState(0),
    [error, setError] = useState<unknown>(),
    [review, setReview] = useState<Review>(),
    [feedbackScope, setFeedbackScope] = useState("");
  const [saved, setSaved] = useState<q.PrescriptionQueryOut>();
  const allowed =
      visible && (can("prescription.view") || can("prescription.query.raise")),
    writable =
      connected &&
      stream === "Live" &&
      mayChangeQueries(user.permissions, view);
  const rows = useLoad(
    () => (allowed ? q.listQueries(filter) : Promise.resolve([])),
    [allowed, filter, listRevision],
  );
  const prescription = useLoad(
    () =>
      visible && can("prescription.view") && selected
        ? q.getPrescription(selected)
        : Promise.resolve(undefined),
    [selected, visible, can("prescription.view"), detailRevision],
  );
  const p =
    !prescription.loading &&
    !prescription.error &&
    prescription.data?.prescription_id === selected
      ? prescription.data
      : undefined;
  const scope = `order-queries:${selected}`;
  const write = useClinicalWrite(user, scope, async (value, command) => {
    setSaved(value as q.PrescriptionQueryOut);
    setReview(undefined);
    if (command.path.endsWith("/queries")) {
      setQuestion("");
      setReason("");
      setTarget("");
    }
    setListRevision((n) => n + 1);
    setDetailRevision((n) => n + 1);
  });
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (e.type === "event" && e.event_type === "medication.order.updated") {
          setListRevision((n) => n + 1);
          if (e.payload?.prescription_id === selected)
            setDetailRevision((n) => n + 1);
        }
        if (e.type === "stream" && e.status === "Live" && e.resync) {
          setListRevision((n) => n + 1);
          setDetailRevision((n) => n + 1);
        }
      }),
    [selected],
  );
  useEffect(() => {
    if (!write.blocked) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [write.blocked]);
  const time = (v: string) => (timeZone ? formatHospitalTime(v, timeZone) : v);
  const items =
    !rows.loading && !rows.error
      ? (rows.data || []).filter((r) =>
          `${r.query_id} ${r.prescription_number} ${r.patient_name} ${r.mrn} ${r.question} ${r.prescriber_name}`
            .toLowerCase()
            .includes(find.trim().toLowerCase()),
        )
      : [];
  const recovered = () => {
    setReview(undefined);
    setQuestion("");
    setReason("");
    setTarget("");
    setSaved(undefined);
    setFeedbackScope("");
    setListRevision((n) => n + 1);
    setDetailRevision((n) => n + 1);
  };
  function open(id: number, item?: number | null) {
    if (write.blocked) return;
    const changing = id !== selected || item !== undefined;
    if (
      changing &&
      (question.trim() || reason || target) &&
      !window.confirm(
        t(
          "Discard the unsent question and change prescription?",
          "غیر ارسال سوال چھوڑ کر نسخہ بدلیں؟",
        ),
      )
    )
      return;
    setSelected(id);
    setLookup(String(id));
    if (changing) {
      setQuestion("");
      setReason("");
      setTarget(item === null ? "whole" : item ? String(item) : "");
    }
    setError(undefined);
    setSaved(undefined);
    setFeedbackScope("");
    setDetailRevision((n) => n + 1);
  }
  function apply() {
    setError(undefined);
    if (
      (rxFilter && !/^[1-9]\d*$/.test(rxFilter)) ||
      !Number.isSafeInteger(Number(limit)) ||
      Number(limit) < 1 ||
      Number(limit) > 1000 ||
      (rxFilter && !Number.isSafeInteger(Number(rxFilter)))
    ) {
      setError(
        new Error(
          t(
            "Use a positive prescription ID and a limit from 1 to 1000.",
            "مثبت نسخہ شناختی نمبر اور1تا1000حد استعمال کریں۔",
          ),
        ),
      );
      return;
    }
    setFilter({
      status: (status || undefined) as typeof filter.status,
      mine,
      prescription_id: rxFilter ? Number(rxFilter) : undefined,
      limit: Number(limit),
    });
  }
  async function preflight() {
    const [me, est] = await Promise.all([
      api<ClinicalUser>("GET", "/auth/me"),
      api<EstablishmentOut>("GET", "/establishment"),
    ]);
    if (
      me.user_id !== user.user_id ||
      !connected ||
      stream !== "Live" ||
      !mayChangeQueries(
        me.permissions,
        est.views.screens.find((v) => v.screen_id === "order_queries")?.view ||
          "hidden",
      )
    )
      throw new Error(
        t(
          "Permission, connection or service changed. Refresh before continuing.",
          "اجازت، رابطہ یا خدمت بدل گئی۔ آگے بڑھنے سے پہلے تازہ کریں۔",
        ),
      );
  }
  function prepare() {
    setError(undefined);
    if (!p || !writable || write.blocked) return;
    try {
      const body = makeOrderQuery(p, target, reason, question);
      setReview({
        kind: "raise",
        prescriptionId: p.prescription_id,
        body,
        snapshot: queryPrescriptionSnapshot(p),
        patient: p.patient_name,
        mrn: p.mrn,
        number: p.prescription_number,
      });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!review || write.blocked) return;
    setFeedbackScope(scope);
    if (review.kind === "raise")
      write.start(
        {
          method: "POST",
          path: `/prescriptions/${review.prescriptionId}/queries`,
          body: review.body,
          permission: "prescription.query.raise",
          protection: "idempotent",
          reconcilePath: `/prescriptions/${review.prescriptionId}`,
          label: t("Raise order query", "حکم پر سوال اٹھائیں"),
        },
        async () => {
          await preflight();
          const fresh = await q.getPrescription(review.prescriptionId);
          if (queryPrescriptionSnapshot(fresh) !== review.snapshot)
            throw new Error(
              t(
                "The prescription changed. Close, refresh and review the question again.",
                "نسخہ بدل گیا۔ بند، تازہ اور سوال کا دوبارہ جائزہ لیں۔",
              ),
            );
          makeOrderQuery(
            fresh,
            review.body.prescription_item_id === null
              ? "whole"
              : String(review.body.prescription_item_id),
            review.body.reason,
            review.body.question,
          );
        },
      );
    else
      write.start(
        {
          method: "POST",
          path: `/prescription-queries/${review.row.query_id}/withdraw`,
          body: { reason: review.reason.trim() },
          permission: "prescription.query.raise",
          protection: "idempotent",
          reconcilePath: `/prescription-queries?prescription_id=${review.row.prescription_id}&limit=1000`,
          label: t("Withdraw order query", "حکم کا سوال واپس لیں"),
        },
        async () => {
          await preflight();
          const list = await q.listQueries({
            prescription_id: review.row.prescription_id,
            limit: 1000,
          });
          const current = list.find((r) => r.query_id === review.row.query_id);
          if (
            !current ||
            current.status !== "Open" ||
            queryRowSnapshot(current) !== review.snapshot
          )
            throw new Error(
              t(
                "The query changed or is no longer open. Close and refresh before deciding.",
                "سوال بدل گیا یا کھلا نہیں۔ فیصلہ سے پہلے بند اور تازہ کریں۔",
              ),
            );
        },
      );
  }
  if (!allowed)
    return (
      <Empty>
        {t(
          "Order queries are unavailable with your permissions and services.",
          "آپ کی اجازت اور خدمات میں حکم کے سوالات دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      data-help-screen="order_queries"
      data-write-pending={write.blocked}
      data-unsaved={!!(question.trim() || reason || target)}
    >
      <div className="section-heading">
        <div>
          <h1>{t("Order queries", "حکم کے سوالات")}</h1>
          <p>
            {t(
              "Ask the prescriber about an unclear or unsafe order; queried lines wait for the doctor's answer.",
              "غیر واضح یا غیر محفوظ حکم پر معالج سے پوچھیں؛ متعلقہ سطریں معالج کے جواب تک رکیں گی۔",
            )}
          </p>
        </div>
        <button
          data-help="queries.refresh"
          disabled={write.blocked}
          onClick={() => {
            setListRevision((n) => n + 1);
            setDetailRevision((n) => n + 1);
          }}
        >
          {t("Refresh order queries", "حکم کے سوالات تازہ کریں")}
        </button>
      </div>
      <p role="status">
        {tr(connected ? stream : "Offline")} ·{" "}
        {view === "records"
          ? t("Records only", "صرف ریکارڈ")
          : view === "open_work"
            ? t(
                "No new dispensing work; queries on existing orders continue.",
                "نیا فراہمی کام نہیں؛ موجودہ حکم کے سوال جاری ہیں۔",
              )
            : t("Open first, then oldest first.", "پہلے کھلے، پھر قدیم ترین۔")}
      </p>
      {(!connected || stream !== "Live") && (
        <p className="notice">
          {t(
            "Wait for live reconnection before raising or withdrawing a query.",
            "سوال اٹھانے یا واپس لینے سے پہلے فعال رابطہ بحالی کا انتظار کریں۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      {!review && feedbackScope === scope && (
        <>
          {saved && (
            <p role="status">
              {t("Confirmed query", "تصدیق شدہ سوال")} #{saved.query_id} ·{" "}
              <bdi>
                {saved.prescription_number} · {saved.patient_name} · {saved.mrn}
              </bdi>{" "}
              · {tr(saved.status)}
            </p>
          )}
          <ClinicalWriteFeedback write={write} onReviewed={recovered} />
        </>
      )}
      {can("prescription.view") ? (
        <>
          <fieldset disabled={write.blocked}>
            <section className="card">
              <h2>
                {t(
                  "Review an order and raise a query",
                  "حکم دیکھیں اور سوال اٹھائیں",
                )}
              </h2>
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
                  open(Number(lookup));
                }}
              >
                <Field label={t("Prescription ID", "نسخہ شناختی نمبر")}>
                  <input
                    data-help="queries.open"
                    value={lookup}
                    onChange={(e) => setLookup(e.target.value)}
                    inputMode="numeric"
                  />
                </Field>
                <button data-help="queries.open">
                  {t("Open prescription for query", "سوال کے لیے نسخہ کھولیں")}
                </button>
              </form>
              <LoadState {...prescription} retry={prescription.reload} />
              {p && (
                <div data-testid="order-query-prescription">
                  <h3>
                    <bdi>
                      {p.prescription_number} · {p.patient_name} · {p.mrn}
                    </bdi>
                  </h3>
                  <p>
                    {tr(p.status)} · {tr(p.destination)} ·{" "}
                    {t("Patient / ticket / admission", "مریض / پرچی / داخلہ")}:{" "}
                    {p.patient_id} / {p.ticket_id ?? "—"} /{" "}
                    {p.admission_id ?? "—"}
                  </p>
                  <p>
                    <bdi>{p.prescriber_stamp.text}</bdi>
                  </p>
                  {p.items.map((i) => (
                    <p key={i.prescription_item_id}>
                      #{i.prescription_item_id} ·{" "}
                      <bdi>
                        {i.drug_name || i.external_drug_name} · {i.dose_text} ·{" "}
                        {i.route} · {i.frequency_code} · {i.instructions}
                      </bdi>{" "}
                      · {tr(i.item_status)} · {t("Remaining", "باقی")}:{" "}
                      {i.qty_remaining}
                    </p>
                  ))}
                  {onDispense && (
                    <button
                      data-help="queries.handoff"
                      onClick={() => onDispense(p.prescription_id)}
                    >
                      {t("Return to dispensing", "فراہمی پر واپس")}
                    </button>
                  )}
                  {writable && (
                    <>
                      <Field label={t("Query target", "سوال کا ہدف")}>
                        <select
                          data-help="queries.compose"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        >
                          <option value="">
                            {t("Choose a target", "ہدف چنیں")}
                          </option>
                          <option value="whole">
                            {t("Whole prescription", "پورا نسخہ")}
                          </option>
                          {p.items.map((i) => (
                            <option
                              key={i.prescription_item_id}
                              value={i.prescription_item_id}
                            >
                              #{i.prescription_item_id} ·{" "}
                              {i.drug_name || i.external_drug_name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={t("Query reason", "سوال کی وجہ")}>
                        <select data-field="reason"
                          data-help="queries.compose"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        >
                          <option value="">
                            {t("Choose a reason", "وجہ چنیں")}
                          </option>
                          {queryReasons.map((r) => (
                            <option key={r} value={r}>
                              {t(...reasons[r])}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label={t(
                          "Question for the prescriber",
                          "معالج سے سوال",
                        )}
                      >
                        <textarea data-field="question"
                          data-help="queries.compose"
                          value={question}
                          maxLength={1000}
                          onChange={(e) => setQuestion(e.target.value)}
                        />
                      </Field>
                      <button data-help="queries.confirm" onClick={prepare}>
                        {t("Review order query", "حکم کے سوال کا جائزہ")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>
          </fieldset>
        </>
      ) : (
        <p className="notice">
          {t(
            "Your role can read query records, but prescription detail access is required before raising a new question from an order.",
            "آپ کا کردار سوال ریکارڈ پڑھ سکتا ہے، مگر حکم سے نیا سوال اٹھانے سے پہلے نسخے کی تفصیل کی اجازت لازم ہے۔",
          )}
        </p>
      )}
      <fieldset disabled={write.blocked}>
        <section className="card">
          <h2>{t("Query register", "سوالات کا رجسٹر")}</h2>
          <div className="form-grid">
            <Field label={t("Query status", "سوال کی حالت")}>
              <select data-field="status"
                data-help="queries.filters"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{t("All statuses", "تمام حالتیں")}</option>
                {["Open", "Answered", "Withdrawn"].map((s) => (
                  <option key={s} value={s}>
                    {tr(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={t("Filter prescription ID", "نسخہ شناختی نمبر کی چھانٹی")}
            >
              <input data-field="prescription_id"
                data-help="queries.filters"
                value={rxFilter}
                onChange={(e) => setRxFilter(e.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field
              label={t(
                "Maximum returned queries",
                "زیادہ سے زیادہ موصولہ سوال",
              )}
            >
              <input
                data-help="queries.filters"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                type="number"
                min="1"
                max="1000"
              />
            </Field>
          </div>
          <label>
            <input
              data-help="queries.filters"
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
            />
            {t(
              "Queries on my prescribed orders",
              "میرے تجویز کردہ احکامات کے سوال",
            )}
          </label>
          <button data-help="queries.filters" onClick={apply}>
            {t("Apply query filters", "سوالات کی چھانٹی لاگو کریں")}
          </button>
          <p>
            {t(
              "Mine means the caller's prescribed orders, not questions raised by this pharmacist. Results are bounded; no older-page cursor is available.",
              "میرے سے مراد اسی صارف کے تجویز کردہ حکم، فارماسسٹ کے اٹھائے سوال نہیں۔ نتائج محدود؛ پرانا صفحہ کرسر دستیاب نہیں۔",
            )}
          </p>
          <Field
            label={t("Find in returned queries", "موصولہ سوالات میں تلاش")}
          >
            <input
              data-help="queries.find"
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </Field>
          <LoadState {...rows} retry={rows.reload} />
          {!rows.loading && !rows.error && !items.length && (
            <Empty>
              {find.trim()
                ? t(
                    "No local matches. Clear the search or change the server filters.",
                    "مقامی تلاش نہیں ملی۔ تلاش صاف یا سرور چھانٹی بدلیں۔",
                  )
                : t(
                    "No queries returned for these filters. Review an existing prescription to raise a question.",
                    "ان چھانٹیوں میں کوئی سوال نہیں ملا۔ سوال کے لیے اصل نسخہ دیکھیں۔",
                  )}
            </Empty>
          )}
          {!rows.loading &&
            !rows.error &&
            rows.data?.length === filter.limit && (
              <p className="notice">
                {t(
                  "The result reached the limit. Narrow the status or prescription filter to avoid missing older results.",
                  "نتائج حد تک پہنچ گئے۔ پرانے نتائج چھوڑنے سے بچنے کو حالت یا نسخہ چھانٹی محدود کریں۔",
                )}
              </p>
            )}
          {items.map((row) => (
            <article
              className="card"
              key={row.query_id}
              data-testid="order-query-row"
            >
              <h3>
                #{row.query_id} ·{" "}
                <bdi>
                  {row.prescription_number} · {row.patient_name} · {row.mrn}
                </bdi>
              </h3>
              <p>
                {tr(row.status)} ·{" "}
                {t(
                  ...((reasons[row.reason] || [row.reason, row.reason]) as [
                    string,
                    string,
                  ]),
                )}{" "}
                ·{" "}
                {row.prescription_item_id === null
                  ? t("Whole prescription", "پورا نسخہ")
                  : t("Medicine line", "دوا کی سطر") +
                    ` #${row.prescription_item_id}`}
              </p>
              <p>
                <bdi>
                  {row.drug_name} · {row.dose_text} · {row.route} ·{" "}
                  {row.frequency_code}
                </bdi>
              </p>
              <p>
                <bdi>{row.question}</bdi>
              </p>
              <p>
                {t("Raised by / at", "سوال کرنے والا / وقت")}:{" "}
                <bdi>
                  {row.raised_by_name} · {time(row.raised_at)}
                </bdi>{" "}
                · {t("Prescriber", "معالج")}: <bdi>{row.prescriber_name}</bdi>
              </p>
              {row.status === "Open" && (
                <p className="notice">
                  {t(
                    "Waiting for the prescriber; affected lines cannot be dispensed.",
                    "معالج کا انتظار؛ متعلقہ سطریں فراہم نہیں ہو سکتیں۔",
                  )}
                </p>
              )}
              {row.answer && (
                <>
                  <p>
                    {t("Doctor's answer", "معالج کا جواب")}:{" "}
                    {row.outcome === "ConfirmedAsWritten"
                      ? t("Confirmed as written", "اصل حکم کی تصدیق")
                      : row.outcome === "Changed"
                        ? t("Order changed", "حکم تبدیل ہوا")
                        : "—"}{" "}
                    · <bdi>{row.answer}</bdi>
                  </p>
                  <p>
                    <bdi>{row.answer_stamp?.text}</bdi>
                  </p>
                  {row.outcome === "Changed" && (
                    <p className="notice">
                      {t(
                        "Changed: reread the stopped line and replacement order. Do not dispense the old line.",
                        "تبدیلی: بند سطر اور متبادل حکم دوبارہ پڑھیں۔ پرانی سطر فراہم نہ کریں۔",
                      )}
                    </p>
                  )}
                </>
              )}
              {row.status === "Withdrawn" && (
                <p>
                  {t("Withdrawal reason / time", "واپسی کی وجہ / وقت")}:{" "}
                  <bdi>
                    {row.withdraw_reason} ·{" "}
                    {row.withdrawn_at ? time(row.withdrawn_at) : "—"}
                  </bdi>
                </p>
              )}
              {can("prescription.view") && (
                <button
                  data-help="queries.open"
                  onClick={() =>
                    open(row.prescription_id, row.prescription_item_id)
                  }
                >
                  {t("Review queried prescription", "سوال والا نسخہ دیکھیں")}
                </button>
              )}
              {row.status === "Open" && writable && (
                <button
                  data-help="queries.withdraw"
                  onClick={() => {
                    setReview({
                      kind: "withdraw",
                      row,
                      reason: "",
                      snapshot: queryRowSnapshot(row),
                    });
                    setError(undefined);
                  }}
                >
                  {t("Withdraw query", "سوال واپس لیں")} #{row.query_id}
                </button>
              )}
            </article>
          ))}
        </section>
      </fieldset>
      {review && (
        <Modal
          title={t("Confirm order query action", "حکم کے سوال کے عمل کی تصدیق")}
          closable={!write.blocked}
          onClose={() => {
            if (write.blocked) return;
            if (
              review.kind === "withdraw" &&
              review.reason.trim() &&
              !window.confirm(
                t(
                  "Discard the unsent withdrawal reason?",
                  "غیر ارسال واپسی کی وجہ چھوڑ دیں؟",
                ),
              )
            )
              return;
            setReview(undefined);
          }}
        >
          <ClinicalWriteFeedback write={write} onReviewed={recovered} />
          {review.kind === "raise" ? (
            <>
              <p>
                <bdi>
                  {review.patient} · {review.mrn} · {review.number}
                </bdi>
              </p>
              <p>
                {review.body.prescription_item_id === null
                  ? t("Whole prescription", "پورا نسخہ")
                  : `#${review.body.prescription_item_id}`}{" "}
                · {t(...reasons[review.body.reason])}
              </p>
              <p>
                <bdi>{review.body.question}</bdi>
              </p>
              <p>
                {t(
                  "The prescriber is notified and affected lines wait for an answer. No medicine is dispensed.",
                  "معالج کو اطلاع اور متعلقہ سطریں جواب تک رکیں گی۔ دوا فراہم نہیں ہوتی۔",
                )}
              </p>
            </>
          ) : (
            <>
              <p>
                #{review.row.query_id} ·{" "}
                <bdi>
                  {review.row.patient_name} · {review.row.mrn} ·{" "}
                  {review.row.prescription_number}
                </bdi>
              </p>
              <p>
                <bdi>{review.row.question}</bdi>
              </p>
              <Field label={t("Withdrawal reason", "واپسی کی وجہ")}>
                <textarea data-field="reason"
                  data-help="queries.withdraw"
                  value={review.reason}
                  maxLength={500}
                  disabled={write.blocked}
                  onChange={(e) =>
                    setReview({ ...review, reason: e.target.value })
                  }
                />
              </Field>
            </>
          )}
          <button
            data-help="queries.confirm"
            disabled={
              write.blocked ||
              (review.kind === "withdraw" && review.reason.trim().length < 3)
            }
            onClick={confirm}
          >
            {t("Confirm order query action", "حکم کے سوال کے عمل کی تصدیق")}
          </button>
        </Modal>
      )}
    </section>
  );
}
