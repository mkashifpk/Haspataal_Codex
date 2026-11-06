import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/complaint_appeals";
import { call } from "../bridge";
import { ErrorBox, Field } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import values from "../complaint-management-values.json";

export function ComplaintAppeals({
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
    [editing, setEditing] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [closed, setClosed] = useState(false),
    [paperBusy, setPaperBusy] = useState(false),
    [paperError, setPaperError] = useState<unknown>(),
    [paperNotice, setPaperNotice] = useState("");
  const selected = useRef<number | undefined>(undefined),
    generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    setReviewed(false);
    try {
      const [list, record] = await Promise.all([
        api.listComplaints({
          status: closed ? "Closed" : "Appealed",
          limit: 1000,
        }),
        selected.current ? api.getComplaint(selected.current) : undefined,
      ]);
      if (n === generation.current) {
        setRows(
          list
            .filter((x) => !closed || x.appeal_decided_at !== null)
            .sort((a, b) =>
              (a.appealed_at ?? "").localeCompare(b.appealed_at ?? ""),
            ),
        );
        setDetail(record);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [closed]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, revision]);
  const write = useClinicalWrite(user, "complaint_appeals", async () => {
    setEditing(false);
    setReviewed(false);
    await load();
  });
  const blocked = write.blocked || paperBusy,
    canDecide =
      !!detail?.can_decide_appeal &&
      user.permissions.includes("complaint.appeal.decide"),
    editable = connected && !readOnly && !loading && !error && !blocked;
  useEffect(() => {
    if (write.error && !write.blocked) void load();
  }, [write.error, write.blocked, load]);
  async function open(id: number) {
    if (blocked || editing) return;
    selected.current = id;
    await load();
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable || !canDecide || !detail || !reviewed) return;
    const f = new FormData(e.currentTarget),
      s = (k: string) => String(f.get(k) ?? "").trim();
    const body: api.AppealDecisionIn = {
      appeal_upheld: s(
        "appeal_upheld",
      ) as api.AppealDecisionIn["appeal_upheld"],
      appeal_decision: s("appeal_decision"),
      means: s("means") as api.AppealDecisionIn["means"],
      satisfaction: (s("satisfaction") ||
        null) as api.AppealDecisionIn["satisfaction"],
    };
    write.start({
      method: "POST",
      path: `/complaints/${detail.complaint_id}/appeal-decision`,
      body,
      permission: {
        recordPath: `/complaints/${detail.complaint_id}`,
        capability: "can_decide_appeal",
      },
      protection: "idempotent",
      reconcilePath: `/complaints/${detail.complaint_id}`,
      label: t("Record appeal decision", "اپیل کا فیصلہ درج کریں"),
    });
  }
  async function paper(action: "print" | "preview" | "save") {
    if (!detail?.appeal_decided_at || !connected || blocked || loading || error)
      return;
    setPaperBusy(true);
    setPaperError(undefined);
    setPaperNotice("");
    try {
      const r =
        action === "print"
          ? await call("print-complaint", {
              kind: "AppealOutcome",
              complaintId: detail.complaint_id,
              expectedVersion: detail.row_version,
            })
          : await call("clinical-pdf", {
              path: `/complaints/${detail.complaint_id}/letter/pdf?letter=AppealOutcome`,
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
            : r.saved
              ? t("Server PDF saved.", "سرور پی ڈی ایف محفوظ۔")
              : t(
                  "Save cancelled; decision unchanged.",
                  "محفوظ منسوخ؛ فیصلہ برقرار۔",
                ),
      );
    } catch (e) {
      setPaperError(e);
    } finally {
      setPaperBusy(false);
    }
  }
  const date = (s: string | null) =>
    s
      ? timeZone
        ? formatHospitalTime(s, timeZone)
        : s
      : t("Not recorded", "درج نہیں");
  const absent = (s: string | null) => s ?? t("Not recorded", "درج نہیں");
  const options = (items: string[]) =>
    items.map((v) => (
      <option key={v} value={v}>
        {v === "Upheld"
          ? t("Upheld", "درست")
          : v === "PartlyUpheld"
            ? t("Partly upheld", "جزوی درست")
            : v === "NotUpheld"
              ? t("Not upheld", "درست نہیں")
              : v === "Telephone"
                ? t("Telephone", "ٹیلی فون")
                : v === "Letter"
                  ? t("Letter", "خط")
                  : v === "InPerson"
                    ? t("In person", "بالمشافہ")
                    : v === "Satisfied"
                      ? t("Satisfied", "مطمئن")
                      : v === "PartlySatisfied"
                        ? t("Partly satisfied", "جزوی مطمئن")
                        : v === "NotSatisfied"
                          ? t("Not satisfied", "غیر مطمئن")
                          : v === "NotKnown"
                            ? t("Not known", "معلوم نہیں")
                            : v}
      </option>
    ));
  return (
    <section
      data-screen="complaint_appeals"
      data-unsaved={editing}
      data-write-pending={write.blocked}
    >
      <div className="section-heading">
        <div>
          <h1>{t("Complaint appeals", "شکایت کی اپیلیں")}</h1>
          <p>
            {t(
              "Review the original complaint, findings, outcome and appeal before an independent decision.",
              "آزاد فیصلے سے پہلے اصل شکایت، تحقیق، جواب اور اپیل کا جائزہ لیں۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="cap.refresh"
            disabled={write.busy || paperBusy}
            onClick={() => void load()}
          >
            {t("Refresh appeals", "اپیلیں تازہ پڑھیں")}
          </button>
          <button data-help="cap.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Keep the draft; writes are not queued offline.",
            "رابطہ نہیں۔ مسودہ رکھیں؛ آف لائن اندراج نہیں ہوتا۔",
          )}
        </p>
      )}
      {readOnly && (
        <p>
          {t(
            "Records only. New decisions are unavailable in this service view.",
            "صرف ریکارڈ۔ اس خدمت میں نئے فیصلے دستیاب نہیں۔",
          )}
        </p>
      )}
      <Field label={t("Show", "دکھائیں")}>
        <select
          data-help="cap.filter"
          value={closed ? "decided" : "pending"}
          disabled={blocked || editing}
          onChange={(e) => setClosed(e.target.value === "decided")}
        >
          <option value="pending">
            {t("Awaiting appeal decision", "اپیل کے فیصلے کے منتظر")}
          </option>
          <option value="decided">
            {t("Decided appeals", "فیصلہ شدہ اپیلیں")}
          </option>
        </select>
      </Field>
      {loading && (
        <p role="status">
          {t("Reading current appeals…", "موجودہ اپیلیں پڑھی جا رہی ہیں…")}
        </p>
      )}
      <ErrorBox error={error} />
      {!loading && !error && (
        <>
          <p>
            {rows.length
              ? `${rows.length} ${t("appeals", "اپیلیں")}`
              : closed
                ? t(
                    "No decided appeals in this list. Use the pending list to review new appeals.",
                    "اس فہرست میں فیصلہ شدہ اپیل نہیں۔ نئی اپیل کو منتظر فہرست دیکھیں۔",
                  )
                : t(
                    "No appeals await a decision. A desk records an actual appeal against a conveyed outcome.",
                    "کوئی اپیل فیصلے کی منتظر نہیں۔ میز پہنچائے گئے نتیجے پر اصل اپیل درج کرتا ہے۔",
                  )}
          </p>
          {rows.length >= 1000 && (
            <p role="alert">
              {t(
                "The list limit is1000. Ask IT/Quality about an authorised narrower report if records are missing.",
                "فہرست کی حد ہزار ہے۔ ریکارڈ کم ہوں تو آئی ٹی یا کوالٹی سے مجاز محدود رپورٹ پوچھیں۔",
              )}
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Tracking number", "شکایت نمبر")}</th>
                  <th>{t("Complainant", "شکایت کنندہ")}</th>
                  <th>{t("Appeal received", "اپیل موصول")}</th>
                  <th>{t("Original decision by", "اصل فیصلہ کرنے والا")}</th>
                  <th>{t("Open", "کھولیں")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.complaint_id}>
                    <td>{r.complaint_number}</td>
                    <td>{r.complainant_name}</td>
                    <td>{date(r.appealed_at)}</td>
                    <td>{absent(r.outcome_stamp?.text ?? null)}</td>
                    <td>
                      <button
                        data-help="cap.open"
                        disabled={blocked || editing}
                        onClick={() => void open(r.complaint_id)}
                      >
                        {t("Review appeal", "اپیل کا جائزہ")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {detail && (
        <article hidden={loading || !!error} key={detail.complaint_id}>
          <h2>
            {detail.complaint_number} · {detail.complainant_name}
          </h2>
          <p>
            {t("Status", "حالت")}:{" "}
            {detail.status === "Appealed"
              ? t("Appealed", "اپیل شدہ")
              : detail.status === "Closed"
                ? t("Closed", "بند")
                : detail.status}{" "}
            · {absent(detail.patient_name)} · {absent(detail.mrn)}
          </p>
          <div className="form-grid">
            <div>
              <h3>{t("Original complaint", "اصل شکایت")}</h3>
              <p className="preserve-whitespace">{detail.description}</p>
              <p>
                {t("Requested outcome", "درخواست کردہ نتیجہ")}:{" "}
                {absent(detail.desired_outcome)}
              </p>
            </div>
            <div>
              <h3>{t("Findings", "تحقیق کے نتائج")}</h3>
              <p className="preserve-whitespace">{absent(detail.findings)}</p>
              <p>
                {absent(detail.findings_by_name)} · {date(detail.findings_at)}
              </p>
              <p>
                {t("Linked safety incident", "منسلک حفاظتی واقعہ")}:{" "}
                {absent(detail.incident_number)}
              </p>
            </div>
            <div>
              <h3>{t("Original outcome", "اصل نتیجہ")}</h3>
              <p>{absent(detail.upheld)}</p>
              <p className="preserve-whitespace">{absent(detail.outcome)}</p>
              <p>
                {absent(detail.outcome_stamp?.text ?? null)} ·{" "}
                {date(detail.outcome_at)}
              </p>
              <p>
                {t("Last day to appeal", "اپیل کی آخری تاریخ")}:{" "}
                {absent(detail.appeal_until)}
              </p>
            </div>
            <div>
              <h3>{t("Appeal as recorded", "درج شدہ اپیل")}</h3>
              <p className="preserve-whitespace">
                {absent(detail.appeal_text)}
              </p>
              <p>{date(detail.appealed_at)}</p>
            </div>
          </div>
          <h3>{t("Contact history", "رابطے کی تاریخ")}</h3>
          {detail.updates.map((u) => (
            <p key={u.update_id}>
              {date(u.informed_at)} · {u.informed_by_name} · {u.stage} ·{" "}
              {u.means}
              <br />
              {u.note}
            </p>
          ))}
          {detail.appeal_decided_at ? (
            <>
              <h3>{t("Final appeal decision", "اپیل کا حتمی فیصلہ")}</h3>
              <p>{absent(detail.appeal_upheld)}</p>
              <p className="preserve-whitespace">
                {absent(detail.appeal_decision)}
              </p>
              <p>
                {absent(detail.appeal_stamp?.text ?? null)} ·{" "}
                {date(detail.appeal_decided_at)}
              </p>
              <p>
                {t("Satisfaction", "اطمینان")}: {absent(detail.satisfaction)}
              </p>
            </>
          ) : !canDecide ? (
            <p role="status">
              {t(
                "The server does not allow you to decide this appeal. The original outcome officer cannot decide its appeal; ask another authorised independent officer.",
                "سرور اس اپیل کا فیصلہ آپ کو نہیں دیتا۔ اصل جواب دینے والا اس کی اپیل نہیں کر سکتا؛ دوسرے آزاد مجاز افسر سے کہیں۔",
              )}
            </p>
          ) : (
            !editing && (
              <button
                data-help="cap.decide"
                disabled={!editable}
                onClick={() => {
                  setReviewed(false);
                  write.clearError();
                  setEditing(true);
                }}
              >
                {t("Decide appeal", "اپیل کا فیصلہ کریں")}
              </button>
            )
          )}
          {editing && (
            <form onSubmit={submit}>
              <fieldset disabled={!editable || !canDecide}>
                <legend>
                  {t(
                    "Record the decision actually conveyed",
                    "اصل پہنچایا فیصلہ درج کریں",
                  )}
                </legend>
                <Field label={t("Appeal upheld", "اپیل درست")}>
                  <select
                    data-help="cap.upheld"
                    name="appeal_upheld"
                    defaultValue=""
                    required
                  >
                    <option value="">
                      {t("Choose the decision", "فیصلہ چنیں")}
                    </option>
                    {options(values.upheld)}
                  </select>
                </Field>
                <Field
                  label={t(
                    "Decision as told to the complainant",
                    "شکایت کنندہ کو بتایا فیصلہ",
                  )}
                >
                  <textarea
                    data-help="cap.decision"
                    name="appeal_decision"
                    required
                    minLength={10}
                    maxLength={8000}
                  />
                </Field>
                <Field
                  label={t(
                    "How the complainant was told",
                    "شکایت کنندہ کو کیسے بتایا",
                  )}
                >
                  <select
                    data-help="cap.means"
                    name="means"
                    defaultValue=""
                    required
                  >
                    <option value="">
                      {t("Choose the actual means", "اصل ذریعہ چنیں")}
                    </option>
                    {options(values.means)}
                  </select>
                </Field>
                <Field label={t("Reported satisfaction", "بتایا گیا اطمینان")}>
                  <select
                    data-help="cap.satisfaction"
                    name="satisfaction"
                    defaultValue=""
                  >
                    <option value="">{t("Not recorded", "درج نہیں")}</option>
                    {options(values.satisfaction)}
                  </select>
                </Field>
                <label>
                  <input
                    data-help="cap.confirm"
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  {t(
                    "I reviewed the current complaint, findings, original outcome and appeal, and recorded the actual communication.",
                    "موجودہ شکایت، تحقیق، اصل نتیجہ اور اپیل پڑھی اور اصل رابطہ درج کیا ہے۔",
                  )}
                </label>
                <button data-help="cap.submit" disabled={!reviewed}>
                  {t(
                    "Record appeal decision once",
                    "اپیل کا فیصلہ ایک بار درج کریں",
                  )}
                </button>
              </fieldset>
              <button
                data-help="cap.cancel"
                type="button"
                disabled={write.blocked}
                onClick={() => {
                  if (
                    confirm(
                      t(
                        "Discard this unsent appeal decision?",
                        "اپیل کا غیر ارسال مسودہ چھوڑیں؟",
                      ),
                    )
                  ) {
                    setEditing(false);
                    setReviewed(false);
                  }
                }}
              >
                {t("Cancel unsent decision", "غیر ارسال فیصلہ منسوخ")}
              </button>
            </form>
          )}
          {detail.appeal_decided_at && (
            <div className="toolbar">
              {(["print", "preview", "save"] as const).map((action) => (
                <button
                  key={action}
                  data-help="cap.paper"
                  disabled={!connected || blocked || loading || !!error}
                  onClick={() => void paper(action)}
                >
                  {action === "print"
                    ? t("Print appeal letter", "اپیل کا خط پرنٹ")
                    : action === "preview"
                      ? t("Preview appeal PDF", "اپیل پی ڈی ایف دیکھیں")
                      : t("Save appeal PDF", "اپیل پی ڈی ایف محفوظ")}
                </button>
              ))}
            </div>
          )}
        </article>
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          void load();
        }}
      />
      <ErrorBox error={paperError} />
      {paperNotice && <p role="status">{paperNotice}</p>}
    </section>
  );
}
