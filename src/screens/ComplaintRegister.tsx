import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/complaints_register";
import { ApiError, call } from "../bridge";
import { DirectoryPicker } from "../DirectoryPicker";
import { ErrorBox, Field, Modal } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import { MyComplaintInvestigations } from "./MyComplaintInvestigations";
import { ComplaintIntake, complaintChoiceLabel } from "./ComplaintIntake";
import values from "../complaint-management-values.json";
import intakeValues from "../complaint-intake-values.json";
type Mode = "acknowledge" | "outcome" | "close" | "withdraw";
type Letter = "Acknowledgement" | "Outcome" | "AppealOutcome";
const statusOptions = [
  "Received",
  "Acknowledged",
  "Resolved",
  "Appealed",
  "Closed",
  "Withdrawn",
  "NotMaintainable",
] as const;
const labels: Record<string, [string, string]> = {
  Received: ["Received", "موصول"],
  Acknowledged: ["Acknowledged", "وصولی کا جواب"],
  Resolved: ["Outcome conveyed", "جواب پہنچایا"],
  Appealed: ["Appealed", "اپیل شدہ"],
  Closed: ["Closed", "بند"],
  Withdrawn: ["Withdrawn", "واپس لی"],
  NotMaintainable: ["Not maintainable", "ناقابل کارروائی"],
  Urgent: ["Urgent: risk now", "فوری: ابھی خطرہ"],
  High: ["High", "زیادہ"],
  Normal: ["Normal", "عام"],
  Low: ["Low", "کم"],
  Upheld: ["Upheld", "درست"],
  PartlyUpheld: ["Partly upheld", "جزوی درست"],
  NotUpheld: ["Not upheld", "درست نہیں"],
  Satisfied: ["Satisfied", "مطمئن"],
  PartlySatisfied: ["Partly satisfied", "جزوی مطمئن"],
  NotSatisfied: ["Not satisfied", "غیر مطمئن"],
  NotKnown: ["Not known", "معلوم نہیں"],
  Telephone: ["Telephone", "ٹیلی فون"],
  SMS: ["SMS", "ایس ایم ایس"],
  Letter: ["Letter", "خط"],
  Email: ["Email", "ای میل"],
  InPerson: ["In person", "بالمشافہ"],
  Acknowledgement: ["Acknowledgement", "وصولی کا خط"],
  Outcome: ["Outcome", "نتیجہ"],
  AppealOutcome: ["Appeal outcome", "اپیل کا فیصلہ"],
};
const text = (s: string) => (labels[s] ? t(...labels[s]) : s);
export function ComplaintRegister({
  user,
  revision,
  connected,
  readOnly,
  timeZone,
  onOpenHelp,
}: {
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
}) {
  const [rows, setRows] = useState<api.ComplaintOut[]>([]),
    [detail, setDetail] = useState<api.ComplaintDetailOut>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [formError, setFormError] = useState<unknown>(),
    [mode, setMode] = useState<Mode>(),
    [reviewed, setReviewed] = useState(false),
    [maintainable, setMaintainable] = useState(true),
    [priority, setPriority] = useState(""),
    [people, setPeople] = useState<Record<string, string>>({}),
    [followupBusy, setFollowupBusy] = useState(false),
    [localRevision, setLocalRevision] = useState(0),
    [intakeOpen, setIntakeOpen] = useState(false),
    [intakeBusy, setIntakeBusy] = useState(false),
    [paperBusy, setPaperBusy] = useState(false),
    [paperError, setPaperError] = useState<unknown>(),
    [paperNotice, setPaperNotice] = useState(""),
    [query, setQuery] = useState<Parameters<typeof api.listComplaints>[0]>({
      limit: 1000,
    });
  const selected = useRef<number | undefined>(undefined),
    generation = useRef(0),
    followup = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    setReviewed(false);
    try {
      const [list, record] = await Promise.all([
        api.listComplaints(query),
        selected.current
          ? api.getComplaint(selected.current)
          : Promise.resolve(undefined),
      ]);
      if (n === generation.current) {
        setRows(
          list.sort((a, b) => {
            const rank = (s: string) =>
              s === "Received"
                ? 0
                : s === "Acknowledged"
                  ? 1
                  : s === "Appealed"
                    ? 2
                    : 3;
            return (
              rank(a.status) - rank(b.status) ||
              (a.status === "Acknowledged"
                ? (a.answer_due ?? "9999").localeCompare(b.answer_due ?? "9999")
                : a.received_at.localeCompare(b.received_at))
            );
          }),
        );
        setDetail(record);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, revision]);
  const changed = useCallback(() => {
    void load();
    setLocalRevision((v) => v + 1);
  }, [load]);
  const write = useClinicalWrite(user, "complaints_register", async () => {
    setMode(undefined);
    setReviewed(false);
    setPeople({});
    changed();
  });
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      [
        "COMPLAINT_STATE_INVALID",
        "COMPLAINT_FINDINGS_REQUIRED",
        "COMPLAINT_APPEAL_WINDOW_OPEN",
      ].includes(write.error.response.error?.code ?? "")
    )
      void load();
  }, [write.error, load]);
  useEffect(() => {
    setReviewed(false);
  }, [detail]);
  const blocked = write.blocked || followupBusy || intakeBusy || paperBusy;
  const editable = connected && !readOnly && !loading && !error && !blocked;
  const can = (m: Mode) =>
    !!detail &&
    editable &&
    detail[
      m === "acknowledge"
        ? "can_acknowledge"
        : m === "outcome"
          ? "can_convey_outcome"
          : m === "close"
            ? "can_close"
            : "can_withdraw"
    ];
  const choose = async (id: number) => {
    if (
      blocked ||
      (mode &&
        !window.confirm(
          t(
            "Discard this unsent complaint decision?",
            "غیر ارسال شکایت فیصلہ چھوڑ دیں؟",
          ),
        ))
    )
      return;
    selected.current = id;
    setMode(undefined);
    setPeople({});
    setPaperNotice("");
    setPaperError(undefined);
    setLocalRevision((v) => v + 1);
    await load();
  };
  const start = (m: Mode) => {
    if (!can(m)) return;
    setMode(m);
    setMaintainable(true);
    setPriority("");
    setPeople({});
    setReviewed(false);
    setFormError(undefined);
  };
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mode || !detail || !can(mode) || !reviewed) return;
    const f = new FormData(e.currentTarget),
      s = (k: string) => String(f.get(k) ?? "").trim();
    let body:
      | api.ComplaintAcknowledgeIn
      | api.OutcomeIn
      | api.ComplaintCloseIn
      | api.ComplaintWithdrawIn;
    if (mode === "acknowledge") {
      body = maintainable
        ? {
            maintainable: true,
            priority: priority as api.ComplaintAcknowledgeIn["priority"],
            contact_user_id: Number(people.contact),
            investigator_user_id: people.investigator
              ? Number(people.investigator)
              : Number(people.contact),
            course_of_action: s("course_of_action"),
            response_due: s("response_due") || null,
            means: s("means") as api.ComplaintAcknowledgeIn["means"],
            note: s("note") || null,
          }
        : {
            maintainable: false,
            not_maintainable_reason: s("not_maintainable_reason"),
            means: s("means") as api.ComplaintAcknowledgeIn["means"],
            note: s("note") || null,
          };
      if (maintainable && !people.contact) {
        setFormError(
          Error(
            t(
              "Choose the named contact person from the directory.",
              "فہرست سے رابطے کا ذمہ دار چنیں۔",
            ),
          ),
        );
        return;
      }
    } else if (mode === "outcome")
      body = {
        upheld: s("upheld") as api.OutcomeIn["upheld"],
        outcome: s("outcome"),
        means: s("means") as api.OutcomeIn["means"],
        satisfaction: (s("satisfaction") ||
          null) as api.OutcomeIn["satisfaction"],
      };
    else if (mode === "close")
      body = {
        note: s("note"),
        appeal_waived: f.get("appeal_waived") === "on",
        satisfaction: (s("satisfaction") ||
          null) as api.ComplaintCloseIn["satisfaction"],
      };
    else
      body = {
        reason: s("reason"),
        means: s("means") as api.ComplaintWithdrawIn["means"],
      };
    void write.start({
      method: "POST",
      path: `/complaints/${detail.complaint_id}/${mode}`,
      body,
      permission: {
        recordPath: `/complaints/${detail.complaint_id}`,
        capability:
          mode === "acknowledge"
            ? "can_acknowledge"
            : mode === "outcome"
              ? "can_convey_outcome"
              : mode === "close"
                ? "can_close"
                : "can_withdraw",
      },
      protection: "idempotent",
      reconcilePath: `/complaints/${detail.complaint_id}`,
      label:
        mode === "acknowledge"
          ? t("Record acknowledgement", "وصولی کا جواب درج کریں")
          : mode === "outcome"
            ? t("Record conveyed outcome", "پہنچایا جواب درج کریں")
            : mode === "close"
              ? t("Close complaint", "شکایت بند کریں")
              : t("Record withdrawal", "واپسی درج کریں"),
    });
  }
  async function paper(kind: Letter, action: "print" | "preview" | "save") {
    if (!detail || !connected || blocked) return;
    setPaperBusy(true);
    setPaperError(undefined);
    setPaperNotice("");
    try {
      const result =
        action === "print"
          ? await call("print-complaint", {
              kind,
              complaintId: detail.complaint_id,
              expectedVersion: detail.row_version,
            })
          : await call("clinical-pdf", {
              path: `/complaints/${detail.complaint_id}/letter/pdf?letter=${kind}`,
              preview: action === "preview",
            });
      setPaperNotice(
        action === "print"
          ? t(
              "Sent to the document printer. Check the paper.",
              "دستاویز پرنٹر کو بھیجا؛ کاغذ چیک کریں۔",
            )
          : action === "preview"
            ? t("Server PDF opened.", "سرور پی ڈی ایف کھلی۔")
            : result.saved
              ? t("Server PDF saved.", "سرور پی ڈی ایف محفوظ۔")
              : t(
                  "Save cancelled; complaint unchanged.",
                  "محفوظ منسوخ؛ شکایت برقرار۔",
                ),
      );
    } catch (e) {
      setPaperError(e);
    } finally {
      setPaperBusy(false);
    }
  }
  const means = (
    <Field
      label={t("How the complainant was told", "شکایت کنندہ کو کیسے بتایا")}
    >
      <select data-help="cqr.means" name="means" defaultValue="" required>
        <option value="">
          {t("Choose the actual means", "اصل ذریعہ چنیں")}
        </option>
        {values.means.map((v) => (
          <option key={v} value={v}>
            {text(v)}
          </option>
        ))}
      </select>
    </Field>
  );
  const satisfaction = (
    <Field label={t("Reported satisfaction", "بتایا گیا اطمینان")}>
      <select data-help="cqr.satisfaction" name="satisfaction" defaultValue="">
        <option value="">{t("Not recorded", "درج نہیں")}</option>
        {values.satisfaction.map((v) => (
          <option key={v} value={v}>
            {text(v)}
          </option>
        ))}
      </select>
    </Field>
  );
  const stamp = (v: string) => (timeZone ? formatHospitalTime(v, timeZone) : v);
  return (
    <section
      data-screen="complaints_register"
      data-unsaved={!!mode || followupBusy || intakeOpen}
      data-write-pending={write.blocked || intakeBusy}
    >
      <div className="section-heading">
        <div>
          <h1>{t("Complaints register", "شکایات کا رجسٹر")}</h1>
          <p>
            {t(
              "Acknowledge promptly, keep the complainant informed and convey the documented outcome with the right to appeal.",
              "فوراً وصولی کا جواب، شکایت کنندہ کو باخبر اور اپیل کے حق سمیت اصل نتیجہ پہنچائیں۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="cqr.refresh"
            disabled={write.busy || paperBusy || intakeBusy}
            onClick={() => {
              changed();
            }}
          >
            {t("Refresh register", "رجسٹر تازہ پڑھیں")}
          </button>
          <button data-help="cqr.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
          {user.permissions.includes("complaint.register") && (
            <button
              data-help="cqr.new"
              disabled={!editable || !!mode}
              onClick={() => setIntakeOpen(true)}
            >
              {t("Record a new complaint", "نئی شکایت درج کریں")}
            </button>
          )}
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Keep the draft; no writes are queued offline.",
            "رابطہ نہیں۔ مسودہ رکھیں؛ آف لائن اندراج جمع نہیں ہوتے۔",
          )}
        </p>
      )}
      {readOnly && (
        <p>
          {t(
            "Records only. Decisions are unavailable.",
            "صرف ریکارڈ۔ فیصلے دستیاب نہیں۔",
          )}
        </p>
      )}
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked || mode) return;
          const f = new FormData(e.currentTarget),
            from = String(f.get("date_from") ?? ""),
            to = String(f.get("date_to") ?? "");
          if (from && to && from > to) {
            setFormError(
              Error(
                t(
                  "The end date must not precede the start.",
                  "آخری تاریخ پہلی سے پہلے نہیں ہو سکتی۔",
                ),
              ),
            );
            return;
          }
          setFormError(undefined);
          selected.current = undefined;
          setDetail(undefined);
          setQuery({
            status: (String(f.get("status")) || undefined) as
              api.ComplaintOut["status"] | undefined,
            category: (String(f.get("category")) || undefined) as
              api.ComplaintOut["category"] | undefined,
            date_from: from || undefined,
            date_to: to || undefined,
            limit: 1000,
          });
        }}
      >
        <Field label={t("Status", "حالت")}>
          <select
            data-help="cqr.filters"
            name="status"
            disabled={blocked || !!mode}
          >
            <option value="">{t("All statuses", "سب حالتیں")}</option>
            {statusOptions.map((v) => (
              <option key={v} value={v}>
                {text(v)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Category", "زمرہ")}>
          <select
            data-help="cqr.filters"
            name="category"
            disabled={blocked || !!mode}
          >
            <option value="">{t("All categories", "سب زمرے")}</option>
            {intakeValues.category.enum.map((v) => (
              <option key={v} value={v}>
                {complaintChoiceLabel(v)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Received from", "موصول پہلی تاریخ")}>
          <input
            data-help="cqr.filters"
            name="date_from"
            type="date"
            disabled={blocked || !!mode}
          />
        </Field>
        <Field label={t("Received through", "موصول آخری تاریخ")}>
          <input
            data-help="cqr.filters"
            name="date_to"
            type="date"
            disabled={blocked || !!mode}
          />
        </Field>
        <button data-help="cqr.filters" disabled={blocked || !!mode}>
          {t("Apply filters", "فلٹر لگائیں")}
        </button>
      </form>
      <ErrorBox error={error} />
      <ErrorBox error={formError} />
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          changed();
        }}
      />
      <ErrorBox error={paperError} />
      {paperError != null && (
        <p>
          {t(
            "Retry only the same document. A printing or PDF failure never repeats a decision.",
            "صرف یہی کاغذ دوبارہ لیں۔ پرنٹ یا پی ڈی ایف ناکامی پر فیصلہ نہ دہرائیں۔",
          )}
        </p>
      )}
      {paperNotice && <p role="status">{paperNotice}</p>}
      {loading && (
        <p role="status">
          {t("Loading current complaints…", "تازہ شکایات کھل رہی ہیں…")}
        </p>
      )}
      {!loading && !error && (
        <>
          {!rows.length ? (
            <p role="status">
              {t(
                "No complaints match these filters. Check the period or record a new complaint.",
                "فلٹر میں شکایت نہیں۔ مدت چیک یا نئی درج کریں۔",
              )}
            </p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Complaint / category", "شکایت / زمرہ"),
                      t("Complainant / location", "شکایت کنندہ / جگہ"),
                      t("Status and deadline", "حالت اور تاریخ"),
                      t("Next step", "اگلا قدم"),
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.complaint_id}>
                      <td>
                        <bdi>{r.complaint_number}</bdi> ·{" "}
                        {complaintChoiceLabel(r.category)}
                        <p>{stamp(r.received_at)}</p>
                      </td>
                      <td>
                        {r.complainant_name}
                        <p>
                          {[
                            r.patient_name,
                            r.mrn,
                            r.department_name,
                            r.ward_name,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </td>
                      <td>
                        <strong>{text(r.status)}</strong>
                        {r.priority && <p>{text(r.priority)}</p>}
                        <p
                          className={
                            r.acknowledgement_overdue || r.answer_overdue
                              ? "error"
                              : ""
                          }
                        >
                          {r.acknowledgement_overdue
                            ? t(
                                "Acknowledgement overdue",
                                "وصولی کا جواب تاخیر",
                              )
                            : r.answer_overdue
                              ? t("Answer overdue", "جواب تاخیر")
                              : ""}{" "}
                          {r.answer_due ?? ""}
                        </p>
                      </td>
                      <td>
                        <button
                          data-help="cqr.open"
                          disabled={blocked}
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
            <p role="alert">
              {t(
                "List limit reached. Narrow the received period or category to reconcile all complaints.",
                "فہرست حد تک ہے۔ سب شکایات چیک کرنے کو مدت یا زمرہ محدود کریں۔",
              )}
            </p>
          )}
        </>
      )}
      {detail && (
        <article hidden={loading || !!error} className="card">
          <h2>
            <bdi>{detail.complaint_number}</bdi> · {text(detail.status)}
          </h2>
          <dl className="details">
            {[
              [t("Complainant", "شکایت کنندہ"), detail.complainant_name],
              [
                t("Contact", "رابطہ"),
                [
                  detail.complainant_phone,
                  detail.complainant_contact,
                  detail.preferred_means,
                ]
                  .filter(Boolean)
                  .join(" · "),
              ],
              [
                t("Patient", "مریض"),
                [detail.patient_name, detail.mrn].filter(Boolean).join(" · ") ||
                  null,
              ],
              [
                t("Location", "جگہ"),
                [
                  detail.department_name,
                  detail.ward_name,
                  detail.admission_number,
                ]
                  .filter(Boolean)
                  .join(" · ") || null,
              ],
              [t("Received by", "وصول کرنے والا"), detail.received_by_name],
              [t("Contact person", "رابطہ کار"), detail.contact_name],
              [t("Investigator", "تحقیق کار"), detail.investigator_name],
              [t("Answer due", "جواب کی تاریخ"), detail.answer_due],
              [t("Next step", "اگلا قدم"), detail.next_step],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v ?? t("Not recorded", "درج نہیں")}</dd>
              </div>
            ))}
          </dl>
          <h3>{t("Original words and request", "اصل الفاظ اور درخواست")}</h3>
          <p>{detail.description}</p>
          {detail.desired_outcome && <p>{detail.desired_outcome}</p>}
          {detail.not_maintainable_reason && (
            <p>{detail.not_maintainable_reason}</p>
          )}
          {detail.outcome && (
            <section>
              <h3>{t("Conveyed outcome", "پہنچایا جواب")}</h3>
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
              <h3>{t("Appeal", "اپیل")}</h3>
              <p>{detail.appeal_text}</p>
              <p>{detail.appeal_decision}</p>
              <p>{detail.appeal_stamp?.text}</p>
              <p>
                {t(
                  "An independent authorised officer decides this appeal in Complaint appeals.",
                  "آزاد مجاز افسر اپیل کے فیصلے کے صفحے پر فیصلہ کرتا ہے۔",
                )}
              </p>
            </section>
          )}
          {detail.closed_at && (
            <p>
              {t("Closed", "بند")}: {stamp(detail.closed_at)} ·{" "}
              {detail.close_note}
            </p>
          )}
          {detail.withdraw_reason && (
            <p>
              {t("Withdrawal reason", "واپسی کی وجہ")}: {detail.withdraw_reason}
            </p>
          )}
          <div className="toolbar">
            {detail.can_acknowledge && (
              <button
                data-help="cqr.acknowledge"
                disabled={!can("acknowledge") || !!mode}
                onClick={() => start("acknowledge")}
              >
                {t("Acknowledge complaint", "وصولی کا جواب دیں")}
              </button>
            )}
            {detail.can_convey_outcome && (
              <button
                data-help="cqr.outcome"
                disabled={!can("outcome") || !detail.findings || !!mode}
                onClick={() => start("outcome")}
              >
                {t("Convey outcome", "نتیجہ پہنچائیں")}
              </button>
            )}
            {detail.can_convey_outcome && !detail.findings && (
              <p>
                {t(
                  "Record the findings before conveying an outcome.",
                  "جواب سے پہلے تحقیق کے نتائج درج کریں۔",
                )}
              </p>
            )}
            {detail.can_close && (
              <button
                data-help="cqr.close"
                disabled={!can("close") || !!mode}
                onClick={() => start("close")}
              >
                {t("Close complaint", "شکایت بند کریں")}
              </button>
            )}
            {detail.can_withdraw && (
              <button
                data-help="cqr.withdraw"
                disabled={!can("withdraw") || !!mode}
                onClick={() => start("withdraw")}
              >
                {t("Record withdrawal", "واپسی درج کریں")}
              </button>
            )}
          </div>
          {mode && (
            <form
              key={mode}
              onSubmit={submit}
              onChange={(e) => {
                setFormError(undefined);
                if (!(
                  e.target instanceof HTMLInputElement &&
                  e.target.type === "checkbox" &&
                  e.target.dataset.help === "cqr.confirm"
                ))
                  setReviewed(false);
              }}
            >
              <h3>
                {mode === "acknowledge"
                  ? t(
                      "Acknowledgement and responsibility",
                      "وصولی کا جواب اور ذمہ داری",
                    )
                  : mode === "outcome"
                    ? t("Actual conveyed outcome", "اصل پہنچایا نتیجہ")
                    : mode === "close"
                      ? t("Final closure", "حتمی بندش")
                      : t("Actual withdrawal request", "واپسی کی اصل درخواست")}
              </h3>
              <fieldset disabled={!editable}>
                {mode === "acknowledge" && (
                  <>
                    <label>
                      <input
                        data-help="cqr.maintainable"
                        type="checkbox"
                        checked={maintainable}
                        onChange={(e) => setMaintainable(e.target.checked)}
                      />
                      {t(
                        "The hospital can investigate this complaint",
                        "ہسپتال اس شکایت کی تحقیق کر سکتا ہے",
                      )}
                    </label>
                    {maintainable ? (
                      <div className="form-grid">
                        <Field label={t("Priority", "ترجیح")}>
                          <select
                            data-help="cqr.priority"
                            value={priority}
                            required
                            onChange={(e) => setPriority(e.target.value)}
                          >
                            <option value="">
                              {t("Choose priority", "ترجیح چنیں")}
                            </option>
                            {values.priority.map((v) => (
                              <option key={v} value={v}>
                                {text(v)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label={t(
                            "Named contact person",
                            "رابطے کا مقرر ذمہ دار",
                          )}
                        >
                          <DirectoryPicker
                            data-help="cqr.contact"
                            path="/quality/record-review/people"
                            idField="user_id"
                            name="contact_user_id"
                            value={people.contact ?? ""}
                            required
                            onChange={(e) => {
                              setPeople((v) => ({
                                ...v,
                                contact: e.target.value,
                              }));
                              setReviewed(false);
                            }}
                            empty={t(
                              "No eligible login listed. Ask IT about logins and HR about staff.",
                              "مجاز لاگ ان نہیں۔ لاگ ان کو آئی ٹی اور عملے کو ایچ آر سے کہیں۔",
                            )}
                          />
                        </Field>
                        <Field
                          label={t(
                            "Investigator (defaults to contact)",
                            "تحقیق کار؛ خالی ہو تو رابطہ کار",
                          )}
                        >
                          <DirectoryPicker
                            data-help="cqr.investigator"
                            path="/quality/record-review/people"
                            idField="user_id"
                            name="investigator_user_id"
                            value={people.investigator ?? ""}
                            onChange={(e) => {
                              setPeople((v) => ({
                                ...v,
                                investigator: e.target.value,
                              }));
                              setReviewed(false);
                            }}
                          />
                        </Field>
                        <Field
                          label={t(
                            "Course of action explained",
                            "بتایا گیا طریقہ عمل",
                          )}
                        >
                          <textarea
                            data-help="cqr.course"
                            name="course_of_action"
                            required
                            maxLength={2000}
                          />
                        </Field>
                        <Field
                          label={t(
                            "Response due (blank uses server policy)",
                            "جواب کی تاریخ؛ خالی پر سرور پالیسی",
                          )}
                        >
                          <input
                            data-help="cqr.due"
                            name="response_due"
                            type="date"
                          />
                        </Field>
                      </div>
                    ) : (
                      <Field
                        label={t(
                          "Why it is not maintainable",
                          "کارروائی نہ ہونے کی وجہ",
                        )}
                      >
                        <textarea
                          data-help="cqr.reason"
                          name="not_maintainable_reason"
                          required
                          maxLength={2000}
                        />
                      </Field>
                    )}
                    {maintainable && priority === "Urgent" && (
                      <p role="alert">
                        {t(
                          "Urgent means a risk now. Arrange immediate clinical help first. After acknowledgement, report a separate safety incident in Investigation and follow-up and link its findings; a complaint does not dispatch clinical help.",
                          "فوری سے ابھی خطرہ مراد ہے۔ پہلے فوری طبی مدد دیں۔ وصولی کے جواب کے بعد تحقیق و اگلے کام میں الگ حفاظتی واقعہ درج اور نتائج سے ملائیں؛ شکایت طبی مدد نہیں بلاتی۔",
                        )}
                      </p>
                    )}
                    {means}
                    <Field
                      label={t(
                        "Other actual communication (optional)",
                        "اصل رابطے کی مزید بات، اختیاری",
                      )}
                    >
                      <textarea
                        data-help="cqr.note"
                        name="note"
                        maxLength={2000}
                      />
                    </Field>
                  </>
                )}
                {mode === "outcome" && (
                  <>
                    <p>
                      {t(
                        "Check the recorded findings. This decision is recorded once and starts the appeal window.",
                        "محفوظ نتائج چیک کریں۔ فیصلہ ایک بار درج اور اپیل کی مدت شروع کرتا ہے۔",
                      )}
                    </p>
                    <Field label={t("Finding upheld", "شکایت درست")}>
                      <select
                        data-help="cqr.upheld"
                        name="upheld"
                        defaultValue=""
                        required
                      >
                        <option value="">
                          {t(
                            "Choose the established finding",
                            "ثابت نتیجہ چنیں",
                          )}
                        </option>
                        {values.upheld.map((v) => (
                          <option key={v} value={v}>
                            {text(v)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={t(
                        "Decision as actually told",
                        "جو فیصلہ اصل میں بتایا",
                      )}
                    >
                      <textarea
                        data-help="cqr.outcome_text"
                        name="outcome"
                        required
                        minLength={10}
                        maxLength={8000}
                      />
                    </Field>
                    {means}
                    {satisfaction}
                  </>
                )}
                {mode === "close" && (
                  <>
                    <p>
                      {t(
                        "The server enforces the appeal window. An early closure needs the complainant’s actual waiver; never tick it simply to bypass a refusal.",
                        "اپیل کی مدت سرور نافذ کرتا ہے۔ پہلے بند کرنے کو شکایت کنندہ کی اصل دستبرداری لازم؛ انکار سے بچنے کو خانہ نہ چنیں۔",
                      )}
                    </p>
                    <label>
                      <input
                        data-help="cqr.waiver"
                        name="appeal_waived"
                        type="checkbox"
                      />
                      {t(
                        "The complainant actually said they will not appeal",
                        "شکایت کنندہ نے اصل میں اپیل نہ کرنے کو کہا",
                      )}
                    </label>
                    <Field label={t("Closure note", "بندش کا نوٹ")}>
                      <textarea
                        data-help="cqr.note"
                        name="note"
                        required
                        minLength={5}
                        maxLength={2000}
                      />
                    </Field>
                    {satisfaction}
                  </>
                )}
                {mode === "withdraw" && (
                  <>
                    <p>
                      {t(
                        "Record what the complainant actually requested. Withdrawal keeps the original history.",
                        "شکایت کنندہ کی اصل درخواست درج کریں۔ واپسی اصل تاریخ رکھتی ہے۔",
                      )}
                    </p>
                    <Field label={t("What they said", "انہوں نے کیا کہا")}>
                      <textarea
                        data-help="cqr.reason"
                        name="reason"
                        required
                        minLength={5}
                        maxLength={1000}
                      />
                    </Field>
                    {means}
                  </>
                )}
                <label>
                  <input
                    data-help="cqr.confirm"
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  {t(
                    "I checked the current record, actual communication and this final action.",
                    "میں نے موجودہ ریکارڈ، اصل رابطہ اور یہ حتمی عمل چیک کیا۔",
                  )}
                </label>
                <button
                  data-help="cqr.submit"
                  disabled={!reviewed || !can(mode)}
                >
                  {t("Record this action once", "یہ عمل ایک بار درج کریں")}
                </button>
              </fieldset>
              <button
                type="button"
                data-help="cqr.cancel"
                disabled={write.blocked}
                onClick={() => {
                  setMode(undefined);
                  setReviewed(false);
                }}
              >
                {t("Cancel unsent draft", "غیر ارسال مسودہ منسوخ")}
              </button>
            </form>
          )}
          <div className="toolbar">
            {(
              [
                ...(detail.acknowledged_at ? ["Acknowledgement"] : []),
                ...(detail.outcome_at ? ["Outcome"] : []),
                ...(detail.appeal_decided_at ? ["AppealOutcome"] : []),
              ] as Letter[]
            ).map((k) => (
              <span key={k}>
                <button
                  data-help="cqr.paper"
                  disabled={!connected || blocked}
                  onClick={() => void paper(k, "print")}
                >
                  {t("Print", "پرنٹ")} {text(k)}
                </button>
                <button
                  data-help="cqr.paper"
                  disabled={!connected || blocked}
                  onClick={() => void paper(k, "preview")}
                >
                  {t("Preview server PDF", "سرور پی ڈی ایف دیکھیں")} {text(k)}
                </button>
                <button
                  data-help="cqr.paper"
                  disabled={!connected || blocked}
                  onClick={() => void paper(k, "save")}
                >
                  {t("Save server PDF", "سرور پی ڈی ایف محفوظ")} {text(k)}
                </button>
              </span>
            ))}
          </div>
          <div ref={followup}>
            {(detail.can_update ||
              detail.can_write_findings ||
              detail.can_add_action ||
              !!detail.findings) && (
              <MyComplaintInvestigations
                key={detail.complaint_id}
                recordId={detail.complaint_id}
                onEditingChange={setFollowupBusy}
                onChanged={changed}
                user={user}
                revision={revision + localRevision}
                connected={connected}
                readOnly={readOnly || !!mode || loading || !!error}
                timeZone={timeZone}
                onOpenHelp={onOpenHelp}
              />
            )}
          </div>
        </article>
      )}
      {intakeOpen && (
        <Modal
          title={t("Record a new complaint", "نئی شکایت درج کریں")}
          closable={!intakeBusy}
          onClose={() => {
            if (
              !intakeBusy &&
              window.confirm(
                t(
                  "Discard this unsent complaint draft?",
                  "غیر ارسال شکایت مسودہ چھوڑ دیں؟",
                ),
              )
            )
              setIntakeOpen(false);
          }}
        >
          <div data-help-screen="complaints_register">
            <ComplaintIntake
              screenId="complaints_register"
              intakeOnly
              onCancel={() => {
                setIntakeBusy(false);
                setIntakeOpen(false);
              }}
              onRecorded={(r) => {
                setIntakeBusy(false);
                setIntakeOpen(false);
                selected.current = r.complaint_id;
                changed();
              }}
              onPendingChange={setIntakeBusy}
              user={user}
              revision={revision}
              connected={connected}
              readOnly={readOnly}
              noNewWork={readOnly}
              timeZone={timeZone}
              onOpenHelp={onOpenHelp}
            />
          </div>
        </Modal>
      )}
    </section>
  );
}
