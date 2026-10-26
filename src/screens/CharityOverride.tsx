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
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as c from "../generated/charity_override";
import * as rx from "../generated/rx_queue";
import {
  charityWritable,
  makeCharityBody,
  charitySnapshot,
  approvedCharityHandoff,
  type CharityBody,
  type CharityHandoff,
} from "../charity-policy";
import { useCharityWrite } from "../charity-write";
type Review = {
  body: CharityBody;
  snapshot: string;
  name: string;
  mrn: string;
  number: string;
};
export function CharityOverride({
  user,
  connected,
  stream,
  establishment,
  timeZone,
  currency,
  initialId,
  onDispense,
  onApprovals,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
  currency?: string;
  initialId?: number;
  onDispense?: (h: CharityHandoff) => void;
  onApprovals?: () => void;
}) {
  const can = (p: string) => user.permissions.includes(p),
    view =
      establishment.views.screens.find(
        (s) => s.screen_id === "charity_override",
      )?.view || "hidden",
    visible = ["full", "open_work", "records"].includes(view),
    live = connected && stream === "Live";
  const [selected, setSelected] = useState(initialId || 0),
    [lookup, setLookup] = useState(initialId ? String(initialId) : ""),
    [revision, setRevision] = useState(0),
    [fund, setFund] = useState<"Zakat" | "SocialWelfare">("Zakat"),
    [reason, setReason] = useState(""),
    [counter, setCounter] = useState(false),
    [signer, setSigner] = useState(""),
    [password, setPassword] = useState(""),
    [retryPassword, setRetryPassword] = useState(""),
    [review, setReview] = useState<Review>(),
    [saved, setSaved] = useState<c.ApprovalOut>(),
    [error, setError] = useState<unknown>(),
    [handoffBusy, setHandoffBusy] = useState(false),
    [pendingHandoff, setPendingHandoff] = useState<CharityHandoff>(),
    [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [status, setStatus] = useState<
      "Pending" | "Approved" | "Rejected" | "Cancelled"
    >("Pending"),
    [mine, setMine] = useState(true),
    [limit, setLimit] = useState("100"),
    [filter, setFilter] = useState<{
      status: "Pending" | "Approved" | "Rejected" | "Cancelled";
      mine: boolean;
      limit: number;
    }>({ status: "Pending", mine: true, limit: 100 }),
    [find, setFind] = useState(""),
    [requestLookup, setRequestLookup] = useState(""),
    [requestId, setRequestId] = useState(0);
  const write = useCharityWrite(user, selected, (row) => {
    setSaved(row);
    setRequestId(row.request_id);
    setRequestLookup(String(row.request_id));
    setReview(undefined);
    setPassword("");
    setRetryPassword("");
    setSigner("");
    setReason("");
    setRevision((n) => n + 1);
  });
  const blocked = write.blocked || handoffBusy,
    writable = live && charityWritable(user.permissions, view);
  const prescription = useLoad(
    () =>
      visible && can("prescription.view") && selected
        ? rx.getPrescription(selected)
        : Promise.resolve(undefined),
    [visible, can("prescription.view"), selected, revision],
  );
  const p =
    !prescription.loading &&
    !prescription.error &&
    prescription.data?.prescription_id === selected
      ? prescription.data
      : undefined;
  const requests = useLoad(
    () => (visible ? c.listApprovals(filter) : Promise.resolve([])),
    [visible, filter, revision],
  );
  const detail = useLoad(async () => {
    if (!visible || !requestId) return undefined;
    const a = await api<c.ApprovalOut>("GET", `/approvals/${requestId}`);
    if (
      a.approval_type !== "PharmacyCharityOverride" ||
      a.subject_type !== "prescription"
    )
      throw new Error(
        t(
          "This is not a pharmacy assistance request. Check the request number.",
          "یہ فارمیسی امداد کی درخواست نہیں۔ نمبر چیک کریں۔",
        ),
      );
    return a;
  }, [visible, requestId, revision]);
  const a =
    !detail.loading && !detail.error && detail.data?.request_id === requestId
      ? detail.data
      : undefined;
  const rows =
    !requests.loading && !requests.error
      ? (requests.data || []).filter(
          (a) =>
            a.approval_type === "PharmacyCharityOverride" &&
            `${a.request_id} ${a.subject_id} ${a.patient_id} ${a.summary} ${a.requester_name} ${a.payload_jsonb.fund_type}`
              .toLowerCase()
              .includes(find.trim().toLowerCase()),
        )
      : [];
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (
          e.type === "event" &&
          ["approval.resolved", "approval.requested"].includes(e.event_type)
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
  useEffect(() => {
    if (pendingHandoff && !handoffBusy) {
      setPendingHandoff(undefined);
      onDispense?.(pendingHandoff);
    }
  }, [pendingHandoff, handoffBusy, onDispense]);
  const time = (v: string) => (timeZone ? formatHospitalTime(v, timeZone) : v);
  function open(id: number) {
    if (blocked) return;
    if (
      (reason.trim() || signer.trim()) &&
      !window.confirm(
        t(
          "Discard the unsent assistance request and change prescription?",
          "غیر ارسال امداد درخواست چھوڑ کر نسخہ بدلیں؟",
        ),
      )
    )
      return;
    setSelected(id);
    setLookup(String(id));
    setReason("");
    setSigner("");
    setPassword("");
    setError(undefined);
    setRevision((n) => n + 1);
  }
  function prepare() {
    setError(undefined);
    if (!p || !writable || blocked) return;
    try {
      if (counter && !signer.trim())
        throw new Error(
          t(
            "Enter the independent officer username for counter co-signing.",
            "کاؤنٹر شریک منظوری کے لیے آزاد مجاز افسر کا صارف نام دیں۔",
          ),
        );
      const body = makeCharityBody(
        p.prescription_id,
        fund,
        reason,
        counter ? signer : undefined,
      );
      setPassword("");
      setReviewSubmitted(false);
      setReview({
        body,
        snapshot: charitySnapshot(p),
        name: p.patient_name,
        mrn: p.mrn,
        number: p.prescription_number,
      });
    } catch (e) {
      setError(e);
    }
  }
  async function preflight() {
    if (!review) throw new Error("No reviewed request");
    const [me, est, fresh] = await Promise.all([
      api<ClinicalUser>("GET", "/auth/me"),
      api<EstablishmentOut>("GET", "/establishment"),
      rx.getPrescription(review.body.prescription_id),
    ]);
    if (
      me.user_id !== user.user_id ||
      !live ||
      !charityWritable(
        me.permissions,
        est.views.screens.find((s) => s.screen_id === "charity_override")
          ?.view || "hidden",
      )
    )
      throw new Error(
        t(
          "Permission, connection or service changed. Close and refresh before requesting.",
          "اجازت، رابطہ یا خدمت بدل گئی۔ درخواست سے پہلے بند کرکے تازہ کریں۔",
        ),
      );
    if (charitySnapshot(fresh) !== review.snapshot)
      throw new Error(
        t(
          "The prescription changed. Close and review it again before requesting.",
          "نسخہ بدل گیا۔ درخواست سے پہلے بند اور دوبارہ جائزہ لیں۔",
        ),
      );
  }
  function confirm() {
    if (!review || blocked || write.remaining) return;
    let secret = password;
    setPassword("");
    setSigner("");
    if (review.body.approver_username && !secret) {
      setError(
        new Error(
          t(
            "The independent officer must enter their password.",
            "آزاد مجاز افسر اپنا پاس ورڈ درج کرے۔",
          ),
        ),
      );
      return;
    }
    setReviewSubmitted(true);
    write.start(review.body, secret, preflight);
    secret = "";
  }
  async function handoff(row: c.ApprovalOut) {
    if (!p || !onDispense || blocked || !live) return;
    setHandoffBusy(true);
    setError(undefined);
    try {
      const [fresh, current] = await Promise.all([
        api<c.ApprovalOut>("GET", `/approvals/${row.request_id}`),
        rx.getPrescription(p.prescription_id),
      ]);
      setPendingHandoff(approvedCharityHandoff(fresh, current));
    } catch (e) {
      setError(e);
    } finally {
      setHandoffBusy(false);
    }
  }
  if (!visible)
    return (
      <Empty>
        {t(
          "Pharmacy assistance is unavailable for this service view.",
          "اس خدمت میں فارمیسی امداد دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      data-help-screen="charity_override"
      data-write-pending={blocked}
      data-unsaved={!!(reason.trim() || signer.trim() || password)}
    >
      <div className="section-heading">
        <div>
          <h1>{t("Zakat / charity override", "زکوٰۃ / فلاحی امداد")}</h1>
          <p>
            {t(
              "Request assistance for the actual prescription; wait for an authorised decision before a separate dispense.",
              "اصل نسخے کے لیے امداد مانگیں؛ الگ فراہمی سے پہلے مجاز فیصلے کا انتظار کریں۔",
            )}
          </p>
        </div>
        <button
          data-help="charity.refresh"
          disabled={blocked}
          onClick={() => {
            setError(undefined);
            setRevision((n) => n + 1);
          }}
        >
          {t("Refresh assistance requests", "امداد درخواستیں تازہ کریں")}
        </button>
      </div>
      <p role="status">
        {tr(connected ? stream : "Offline")} ·{" "}
        {view === "records"
          ? t(
              "Records only — no new requests.",
              "صرف ریکارڈ — نئی درخواست نہیں۔",
            )
          : view === "open_work"
            ? t(
                "No new dispensing work; assistance for existing prescriptions continues.",
                "نیا فراہمی کام نہیں؛ موجودہ نسخوں کی امداد جاری ہے۔",
              )
            : t("Hospital pharmacy", "ہسپتال کی فارمیسی")}
      </p>
      {currency && (
        <p>
          {t("Currency", "کرنسی")}: <bdi>{currency}</bdi>
        </p>
      )}
      {!live && (
        <p className="notice">
          {t(
            "Wait for Live before submitting. Requests are not queued offline.",
            "ارسال سے پہلے فعال رابطہ کا انتظار۔ درخواست آف لائن قطار نہیں ہوتی۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      {write.remaining > 0 && !review && (
        <p role="status">
          {t(
            "Account locked. Wait seconds:",
            "اکاؤنٹ مقفل۔ اتنے سیکنڈ انتظار:",
          )}{" "}
          {write.remaining}
        </p>
      )}
      {saved && (
        <p className="notice" role="status">
          {t("Last recorded request", "آخری درج درخواست")} #{saved.request_id} ·{" "}
          {tr(saved.status)} · <bdi>{saved.summary}</bdi>.{" "}
          {t(
            "This is not a medicine supply or cash movement. Read the current decision below.",
            "یہ دوا فراہمی یا نقد حرکت نہیں۔ نیچے تازہ فیصلہ پڑھیں۔",
          )}
        </p>
      )}
      {can("prescription.view") ? (
        <fieldset disabled={blocked}>
          <section className="card">
            <h2>
              {t(
                "Prescription and assistance request",
                "نسخہ اور امداد کی درخواست",
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
                  data-help="charity.prescription"
                  inputMode="numeric"
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                />
              </Field>
              <button data-help="charity.prescription">
                {t(
                  "Open prescription for assistance",
                  "امداد کے لیے نسخہ کھولیں",
                )}
              </button>
            </form>
            <LoadState {...prescription} retry={prescription.reload} />
            {p && (
              <div data-testid="charity-prescription">
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
                    <bdi>
                      {i.drug_name || i.external_drug_name} · {i.dose_text} ·{" "}
                      {i.route} · {i.frequency_code}
                    </bdi>{" "}
                    · {tr(i.item_status)} · {t("Remaining", "باقی")}:{" "}
                    {i.qty_remaining}
                  </p>
                ))}
                {writable && (
                  <>
                    <Field label={t("Assistance fund", "امداد کا فنڈ")}>
                      <select
                        data-help="charity.form"
                        value={fund}
                        onChange={(e) => setFund(e.target.value as typeof fund)}
                      >
                        <option value="Zakat">{tr("Zakat")}</option>
                        <option value="SocialWelfare">
                          {tr("SocialWelfare")}
                        </option>
                      </select>
                    </Field>
                    <Field label={t("Assistance reason", "امداد کی وجہ")}>
                      <textarea
                        data-help="charity.form"
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </Field>
                    <label>
                      <input
                        data-help="charity.mode"
                        type="checkbox"
                        checked={counter}
                        onChange={(e) => {
                          setCounter(e.target.checked);
                          setSigner("");
                          setPassword("");
                        }}
                      />
                      {t(
                        "Officer co-signs at this counter",
                        "افسر اسی کاؤنٹر پر شریک منظوری دے گا",
                      )}
                    </label>
                    <p>
                      {counter
                        ? t(
                            "The independent authorised officer enters their own password in confirmation. Credentials are cleared after each call.",
                            "آزاد مجاز افسر تصدیق میں اپنا پاس ورڈ دے۔ ہر کال کے بعد اسناد صاف ہوتی ہیں۔",
                          )
                        : t(
                            "Without counter co-signing, the request waits in the authorised officer’s approval queue.",
                            "کاؤنٹر شریک منظوری کے بغیر درخواست مجاز افسر کی قطار میں انتظار کرے گی۔",
                          )}
                    </p>
                    {counter && (
                      <Field
                        label={t(
                          "Co-signing officer username",
                          "شریک منظور کرنے والے افسر کا صارف نام",
                        )}
                      >
                        <input
                          data-help="charity.signer"
                          autoComplete="off"
                          value={signer}
                          onChange={(e) => setSigner(e.target.value)}
                        />
                      </Field>
                    )}
                    <button
                      data-help="charity.review"
                      onClick={prepare}
                      disabled={write.remaining > 0}
                    >
                      {t("Review assistance request", "امداد درخواست کا جائزہ")}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </fieldset>
      ) : (
        <p className="notice">
          {t(
            "Prescription detail permission is required before creating a request. Existing authorised requests remain readable.",
            "درخواست سے پہلے نسخہ تفصیل کی اجازت لازم۔ موجودہ مجاز درخواستیں پڑھی جا سکتی ہیں۔",
          )}
        </p>
      )}
      <fieldset disabled={blocked}>
        <section className="card">
          <h2>
            {t("Assistance request register", "امداد درخواستوں کا رجسٹر")}
          </h2>
          <div className="form-grid">
            <Field
              label={t("Assistance request status", "امداد درخواست کی حالت")}
            >
              <select
                data-help="charity.filters"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                {["Pending", "Approved", "Rejected", "Cancelled"].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={t(
                "Maximum returned requests",
                "زیادہ سے زیادہ موصولہ درخواستیں",
              )}
            >
              <input
                data-help="charity.filters"
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </Field>
          </div>
          <label>
            <input
              data-help="charity.filters"
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
            />
            {t("My assistance requests", "میری امداد درخواستیں")}
          </label>
          <button
            data-help="charity.filters"
            onClick={() => {
              const n = Number(limit);
              if (!Number.isInteger(n) || n < 1 || n > 500) {
                setError(
                  new Error(
                    t(
                      "Use a request limit from 1 to 500.",
                      "درخواست کی حد1تا500رکھیں۔",
                    ),
                  ),
                );
                return;
              }
              setFilter({ status, mine, limit: n });
              setError(undefined);
            }}
          >
            {t("Apply assistance filters", "امداد چھانٹی لاگو کریں")}
          </button>
          <p>
            {t(
              "Mine shows your own requests. Otherwise the server returns requests you may decide. Only pharmacy charity entries are displayed here; results are bounded, with no cursor paging.",
              "میری سے آپ کی درخواستیں؛ ورنہ سرور مجاز فیصلے والی درخواستیں دے۔ یہاں صرف فارمیسی امداد، نتائج محدود اور اگلا صفحہ کرسر نہیں۔",
            )}
          </p>
          <Field
            label={t(
              "Find in returned assistance requests",
              "موصولہ امداد درخواستوں میں تلاش",
            )}
          >
            <input
              data-help="charity.find"
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </Field>
          <LoadState {...requests} retry={requests.reload} />
          {!requests.loading && !requests.error && !rows.length && (
            <Empty>
              {t(
                "No matching pharmacy assistance requests for these filters. Change the filters or review a prescription.",
                "ان چھانٹیوں میں امداد درخواست نہیں۔ چھانٹی بدلیں یا نسخہ دیکھیں۔",
              )}
            </Empty>
          )}
          {!requests.loading &&
            !requests.error &&
            requests.data?.length === filter.limit && (
              <p className="notice">
                {t(
                  "Result limit reached. Narrow status/mine or increase the limit; older requests may be omitted.",
                  "نتائج حد تک۔ حالت/میری محدود یا حد بڑھائیں؛ پرانی درخواستیں چھوٹ سکتی ہیں۔",
                )}
              </p>
            )}
          {rows.map((r) => (
            <article
              className="card"
              key={r.request_id}
              data-testid="charity-request-row"
            >
              <h3>
                #{r.request_id} · {tr(r.status)} · <bdi>{r.summary}</bdi>
              </h3>
              <p>
                {t("Prescription / patient", "نسخہ / مریض")}: {r.subject_id} /{" "}
                {r.patient_id ?? "—"} ·{" "}
                {tr(String(r.payload_jsonb.fund_type || ""))}
              </p>
              <p>
                {t("Requested by / at", "درخواست گزار / وقت")}:{" "}
                <bdi>
                  {r.requester_name} · {time(r.requested_at)}
                </bdi>
              </p>
              <button
                data-help="charity.detail"
                onClick={() => {
                  setRequestId(r.request_id);
                  setRequestLookup(String(r.request_id));
                }}
              >
                {t("Read assistance decision", "امداد کا فیصلہ پڑھیں")} #
                {r.request_id}
              </button>
            </article>
          ))}
        </section>
      </fieldset>
      <fieldset disabled={blocked}>
        <section className="card">
          <h2>{t("Current decision and handover", "تازہ فیصلہ اور حوالگی")}</h2>
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              setError(undefined);
              if (
                !/^[1-9]\d*$/.test(requestLookup) ||
                !Number.isSafeInteger(Number(requestLookup))
              ) {
                setError(
                  new Error(
                    t(
                      "Enter an existing positive assistance request ID.",
                      "اصل مثبت امداد درخواست نمبر دیں۔",
                    ),
                  ),
                );
                return;
              }
              setRequestId(Number(requestLookup));
              setRevision((n) => n + 1);
            }}
          >
            <Field
              label={t("Assistance request ID", "امداد درخواست شناختی نمبر")}
            >
              <input
                data-help="charity.detail"
                value={requestLookup}
                onChange={(e) => setRequestLookup(e.target.value)}
                inputMode="numeric"
              />
            </Field>
            <button data-help="charity.detail">
              {t("Read request ID", "درخواست نمبر پڑھیں")}
            </button>
          </form>
          <LoadState {...detail} retry={detail.reload} />
          {a && (
            <div data-testid="charity-decision">
              <h3>
                #{a.request_id} · {tr(a.status)} · <bdi>{a.summary}</bdi>
              </h3>
              <p>
                {t("Prescription / patient", "نسخہ / مریض")}: {a.subject_id} /{" "}
                {a.patient_id ?? "—"} ·{" "}
                {tr(String(a.payload_jsonb.fund_type || ""))}
              </p>
              {a.status === "Pending" ? (
                <p className="notice">
                  {t(
                    "Awaiting the authorised officer. Pending does not authorise dispensing.",
                    "مجاز افسر کا انتظار۔ منتظر حالت دوا کی اجازت نہیں۔",
                  )}
                </p>
              ) : (
                <p>
                  {t("Decision by / at / note", "فیصلہ کنندہ / وقت / نوٹ")}:{" "}
                  <bdi>
                    {a.decided_by_name || "—"} ·{" "}
                    {a.decided_at ? time(a.decided_at) : "—"} ·{" "}
                    {a.decision_note || "—"}
                  </bdi>
                </p>
              )}
              {can("prescription.view") && (
                <button
                  data-help="charity.prescription"
                  onClick={() => open(a.subject_id)}
                >
                  {t("Review request prescription", "درخواست کا نسخہ دیکھیں")}
                </button>
              )}
              {a.status === "Approved" &&
                onDispense &&
                p?.prescription_id === a.subject_id &&
                p.patient_id === a.patient_id && (
                  <button
                    data-help="charity.handoff"
                    disabled={!live}
                    onClick={() => void handoff(a)}
                  >
                    {t(
                      "Use approved assistance in Dispense",
                      "منظور امداد فراہمی میں استعمال کریں",
                    )}
                  </button>
                )}
              <p>
                {t(
                  "Approval is not a supply or refund. Dispense rereads the exact authorisation and order; it chooses no quantity automatically. IPD billing is not changed into outpatient charity by this screen.",
                  "منظوری دوا یا رقم واپسی نہیں۔ فراہمی اصل اجازت و حکم پھر پڑھے، مقدار خود منتخب نہیں۔ یہ سکرین داخلہ بل کو او پی ڈی امداد نہیں بناتی۔",
                )}
              </p>
            </div>
          )}
          {onApprovals && (
            <button data-help="charity.approvals" onClick={onApprovals}>
              {t(
                "Open approvals for decisions or withdrawal",
                "فیصلے یا واپسی کے لیے منظوریوں کو کھولیں",
              )}
            </button>
          )}
        </section>
      </fieldset>
      {review && (
        <Modal
          title={t("Confirm assistance request", "امداد درخواست کی تصدیق")}
          closable={!write.blocked}
          onClose={() => {
            if (!write.blocked) {
              setReview(undefined);
              setPassword("");
              setRetryPassword("");
            }
          }}
        >
          <p>
            <bdi>
              {review.name} · {review.mrn} · {review.number}
            </bdi>{" "}
            · {tr(review.body.fund_type || "Zakat")}
          </p>
          <p>
            <bdi>{review.body.reason}</bdi>
          </p>
          {reviewSubmitted && <ErrorBox error={write.error} verbatim />}
          {write.remaining > 0 && (
            <p role="status">
              {t(
                "Account locked. Wait seconds:",
                "اکاؤنٹ مقفل۔ اتنے سیکنڈ انتظار:",
              )}{" "}
              {write.remaining}
            </p>
          )}
          {write.attempt ? (
            <section className="notice" role="alert">
              <p>
                {t(
                  "The result is unknown. Keep this original request; do not create a replacement.",
                  "نتیجہ نامعلوم ہے۔ اصل درخواست رکھیں؛ متبادل نہ بنائیں۔",
                )}
              </p>
              <code>{write.attempt.key}</code>
              {write.attempt.body.approver_username && (
                <>
                  <p>
                    {t("Original co-signing officer", "اصل شریک منظوری افسر")}:{" "}
                    <bdi>{write.attempt.body.approver_username}</bdi>
                  </p>
                  <Field
                    label={t(
                      "Original officer password again",
                      "اصل افسر کا پاس ورڈ دوبارہ",
                    )}
                  >
                    <input
                      data-help="charity.recovery"
                      type="password"
                      autoComplete="off"
                      value={retryPassword}
                      disabled={write.busy}
                      onChange={(e) => setRetryPassword(e.target.value)}
                    />
                  </Field>
                </>
              )}
              {write.canRetry ? (
                <button
                  data-help="charity.recovery"
                  disabled={
                    write.busy ||
                    write.remaining > 0 ||
                    (!!write.attempt.body.approver_username && !retryPassword)
                  }
                  onClick={() => {
                    let secret = retryPassword;
                    setRetryPassword("");
                    write.retry(secret);
                    secret = "";
                  }}
                >
                  {t(
                    "Retry original assistance request",
                    "اصل امداد درخواست کی دوبارہ کوشش",
                  )}
                </button>
              ) : (
                <p>
                  {t(
                    "The 24-hour replay period expired. Ask IT to reconcile the original key before any new action.",
                    "24گھنٹے کی مدت ختم۔ نئے عمل سے پہلے اصل کلید سے آئی ٹی سے نتیجہ چیک کرائیں۔",
                  )}
                </p>
              )}
              <p>
                {t(
                  "The original officer must re-enter the identical password to retry. Passwords clear after every call; the original request cannot change and no replacement is sent.",
                  "اصل افسر دوبارہ کوشش کے لیے عین پاس ورڈ دے۔ ہر کال بعد پاس ورڈ صاف؛ اصل درخواست بدل نہیں سکتی، متبادل ارسال نہیں۔",
                )}
              </p>
            </section>
          ) : (
            <>
              {review.body.approver_username && (
                <>
                  <p>
                    {t(
                      "Independent co-signing officer",
                      "آزاد شریک منظوری افسر",
                    )}
                    : <bdi>{review.body.approver_username}</bdi>
                  </p>
                  <Field
                    label={t(
                      "Officer co-sign password",
                      "افسر کا شریک منظوری پاس ورڈ",
                    )}
                  >
                    <input
                      data-help="charity.signer"
                      type="password"
                      autoComplete="off"
                      value={password}
                      disabled={write.busy || write.remaining > 0}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                </>
              )}
              <p>
                {t(
                  "Confirm once. A queued request waits; a counter co-sign may return Approved only after server checks. No medicine or money moves here.",
                  "ایک بار تصدیق۔ قطار درخواست انتظار؛ کاؤنٹر شریک منظوری صرف سرور جانچ پر منظور۔ یہاں دوا یا رقم حرکت نہیں۔",
                )}
              </p>
              <button
                data-help="charity.confirm"
                disabled={
                  write.busy ||
                  write.remaining > 0 ||
                  (!!review.body.approver_username && !password)
                }
                onClick={confirm}
              >
                {t("Confirm assistance request", "امداد درخواست کی تصدیق")}
              </button>
            </>
          )}
        </Modal>
      )}
    </section>
  );
}
