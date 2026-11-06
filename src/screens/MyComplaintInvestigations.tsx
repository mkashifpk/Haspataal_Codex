import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../generated/my_complaint_investigations";
import { ErrorBox, Field, Modal } from "../components";
import { DirectoryPicker } from "../DirectoryPicker";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import { Incidents } from "./Incidents";
import type { IncidentDetailOut } from "../generated/report_incident";
import { ApiError } from "../bridge";

type Mode = "findings" | "update" | "action";
const blankAction = () => ({
  action_type: "Corrective" as api.QualityActionIn["action_type"],
  description: "",
  owner_user_id: "",
  department_id: "",
  due_date: "",
});
const blankUpdate = () => ({
  stage: "Progress" as api.ComplaintUpdateIn["stage"],
  means: "InPerson" as api.ComplaintUpdateIn["means"],
  note: "",
  extended_until: "",
  extension_reason: "",
});
export function MyComplaintInvestigations({
  user,
  revision,
  connected,
  readOnly,
  timeZone,
  onOpenHelp,
  recordId,
  onEditingChange,
  onChanged,
}: {
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
  recordId?: number;
  onEditingChange?: (editing: boolean) => void;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<api.ComplaintOut[]>([]),
    [detail, setDetail] = useState<api.ComplaintDetailOut>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [mode, setMode] = useState<Mode>(),
    [findings, setFindings] = useState(""),
    [update, setUpdate] = useState(blankUpdate),
    [action, setAction] = useState(blankAction),
    [reviewed, setReviewed] = useState(false),
    [reportOpen, setReportOpen] = useState(false),
    [reported, setReported] = useState<IncidentDetailOut>();
  const [incidentPending, setIncidentPending] = useState(false);
  const selected = useRef<number | undefined>(recordId),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const list = recordId
        ? []
        : await api.listComplaints({
            mine: true,
            status: "Acknowledged",
            limit: 1000,
          });
      const current = selected.current
        ? await api.getComplaint(selected.current)
        : undefined;
      if (n === generation.current) {
        setRows(
          list
            .filter((r) => r.investigator_user_id === user.user_id)
            .sort((a, b) =>
              (a.answer_due ?? "9999").localeCompare(b.answer_due ?? "9999"),
            ),
        );
        setDetail(current);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [user.user_id, recordId]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh, revision]);
  // Contact/action inserts may refresh the detail without changing its row_version.
  useEffect(() => {
    setReviewed(false);
  }, [detail]);
  const write = useClinicalWrite(
    user,
    recordId ? "complaints_register" : "my_complaint_investigations",
    async () => {
      setMode(undefined);
      setReviewed(false);
      setReported(undefined);
      await refresh();
      onChanged?.();
    },
  );
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      write.error.response.error?.code === "COMPLAINT_STATE_INVALID"
    )
      void refresh();
  }, [write.error, refresh]);
  useEffect(() => {
    onEditingChange?.(!!mode || reportOpen || write.blocked);
  }, [mode, reportOpen, write.blocked, onEditingChange]);
  const blocked = write.blocked || reportOpen,
    editable = connected && !readOnly && !loading && !error;
  const can = (which: Mode) =>
    !!detail &&
    editable &&
    detail[
      which === "findings"
        ? "can_write_findings"
        : which === "update"
          ? "can_update"
          : "can_add_action"
    ];
  const clearDraft = () => {
    setMode(undefined);
    setReviewed(false);
    setReported(undefined);
  };
  async function open(r: api.ComplaintOut) {
    if (
      blocked ||
      (mode &&
        !window.confirm(
          t(
            "Discard this unsent complaint draft?",
            "یہ غیر ارسال شکایت مسودہ چھوڑ دیں؟",
          ),
        ))
    )
      return;
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const current = await api.getComplaint(r.complaint_id);
      if (n === generation.current) {
        selected.current = current.complaint_id;
        setDetail(current);
        clearDraft();
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }
  function begin(which: Mode) {
    if (blocked || !can(which)) return;
    setMode(which);
    setReviewed(false);
    setFindings(detail?.findings ?? "");
    setUpdate({
      ...blankUpdate(),
      means: detail?.preferred_means ?? "InPerson",
    });
    setAction(blankAction());
    setReported(undefined);
  }
  function submit() {
    if (!mode || !detail || !reviewed || !can(mode) || blocked) return;
    const base = `/complaints/${detail.complaint_id}`;
    const body =
      mode === "findings"
        ? {
            findings: findings.trim(),
            ...((reported?.incident_id ?? detail.incident_id) != null
              ? { incident_id: reported?.incident_id ?? detail.incident_id }
              : {}),
          }
        : mode === "update"
          ? {
              stage: update.stage,
              means: update.means,
              note: update.note.trim(),
              ...(update.stage === "Extension"
                ? {
                    extended_until: update.extended_until,
                    extension_reason: update.extension_reason.trim(),
                  }
                : {}),
            }
          : {
              action_type: action.action_type,
              description: action.description.trim(),
              owner_user_id: Number(action.owner_user_id),
              due_date: action.due_date,
              department_id: action.department_id
                ? Number(action.department_id)
                : null,
            };
    write.start({
      method: "POST",
      path:
        base +
        (mode === "findings"
          ? "/findings"
          : mode === "update"
            ? "/updates"
            : "/actions"),
      body,
      permission: {
        recordPath: base,
        capability:
          mode === "findings"
            ? "can_write_findings"
            : mode === "update"
              ? "can_update"
              : "can_add_action",
      },
      protection: "idempotent",
      reconcilePath: base,
      label:
        mode === "findings"
          ? t("Record findings", "تحقیق کے نتائج درج کریں")
          : mode === "update"
            ? t("Record actual contact", "اصل رابطہ درج کریں")
            : t("Record action", "عمل درج کریں"),
    });
  }
  const stamp = (value: string) =>
    timeZone
      ? formatHospitalTime(value, timeZone)
      : t("Hospital time zone unavailable", "ہسپتال کا وقت دستیاب نہیں");
  return (
    <section
      data-screen={
        recordId ? "complaints_register" : "my_complaint_investigations"
      }
      data-unsaved={!!mode}
      data-write-pending={write.blocked || incidentPending}
    >
      <div className="section-heading">
        <div>
          <h1>
            {recordId
              ? t("Investigation and follow-up", "تحقیق اور اگلا کام")
              : t(
                  "Complaints I investigate",
                  "جن شکایات کی میں تحقیق کرتا ہوں",
                )}
          </h1>
          <p>
            {t(
              "Check the facts, keep the complainant informed and assign accountable improvements. The complaints officer conveys the outcome.",
              "حقائق چیک کریں، شکایت کنندہ کو باخبر رکھیں اور بہتری کی ذمہ داری دیں۔ حتمی جواب شکایات افسر پہنچاتا ہے۔",
            )}
          </p>
        </div>
        <div className="actions">
          <button
            data-help={recordId ? "crw.refresh" : "mci.refresh"}
            disabled={blocked || loading}
            onClick={() => void refresh()}
          >
            {t("Refresh investigations", "تحقیقات تازہ کریں")}
          </button>
          <button
            data-help={recordId ? "crw.help" : "mci.help"}
            onClick={onOpenHelp}
          >
            F1 · {t("Help", "مدد")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Keep your draft open; no writes are queued offline.",
            "رابطہ نہیں۔ مسودہ کھلا رکھیں؛ آف لائن اندراج جمع نہیں ہوتے۔",
          )}
        </p>
      )}
      {readOnly && (
        <p>
          {t(
            "Records only. New findings, contacts and actions are unavailable.",
            "صرف ریکارڈ۔ نئے نتائج، رابطہ یا عمل دستیاب نہیں۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          void refresh();
          onChanged?.();
        }}
      />
      {loading && (
        <p role="status">
          {t(
            "Reading current assignments…",
            "تازہ ذمہ داریاں پڑھی جا رہی ہیں…",
          )}
        </p>
      )}
      {!recordId && !loading && !error && !rows.length && (
        <p>
          {t(
            "No acknowledged complaint is currently assigned to you. The complaints officer names the investigator; a notification brings the assignment here.",
            "فی الحال کوئی تسلیم شدہ شکایت آپ کے ذمے نہیں۔ شکایات افسر تحقیق کار مقرر کرتا ہے؛ اطلاع ذمہ داری یہاں لاتی ہے۔",
          )}
        </p>
      )}
      {!recordId && rows.length === 1000 && (
        <p role="alert">
          {t(
            "The list reached its limit. Ask the complaints officer to reconcile outstanding assignments.",
            "فہرست حد تک پہنچ گئی۔ شکایات افسر سے باقی ذمہ داریاں چیک کرائیں۔",
          )}
        </p>
      )}
      {!recordId && !loading && !error && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  t("Complaint", "شکایت"),
                  t("Complainant / location", "شکایت کنندہ / مقام"),
                  t("Answer due", "جواب کی تاریخ"),
                  t("Next", "اگلا قدم"),
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.complaint_id}>
                  <td>
                    <bdi>{r.complaint_number}</bdi> · {r.category}
                  </td>
                  <td>
                    {[r.complainant_name, r.department_name, r.ward_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className={r.answer_overdue ? "error" : ""}>
                    {r.answer_due ?? t("Not recorded", "درج نہیں")}
                    {r.answer_overdue && (
                      <strong> · {t("Overdue", "تاخیر")}</strong>
                    )}
                  </td>
                  <td>
                    <button
                      data-help={recordId ? "crw.open" : "mci.open"}
                      disabled={blocked}
                      onClick={() => void open(r)}
                    >
                      {t("Open investigation", "تحقیق کھولیں")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && !loading && !error && (
        <article className="panel investigation-detail">
          <h2>
            <bdi>{detail.complaint_number}</bdi> · {detail.status}
          </h2>
          <p>{detail.description}</p>
          <p>
            <strong>{t("Requested outcome", "درخواست کردہ نتیجہ")}: </strong>
            {detail.desired_outcome ?? t("Not recorded", "درج نہیں")}
          </p>
          <p>
            {[
              detail.patient_name,
              detail.mrn,
              detail.admission_number,
              detail.department_name,
              detail.ward_name,
            ]
              .filter(Boolean)
              .join(" · ") ||
              t("No patient or location recorded", "مریض یا مقام درج نہیں")}
          </p>
          <dl>
            {[
              [t("Complainant", "شکایت کنندہ"), detail.complainant_name],
              [
                t("Preferred contact", "پسندیدہ رابطہ"),
                [
                  detail.preferred_means,
                  detail.complainant_phone,
                  detail.complainant_contact,
                ]
                  .filter(Boolean)
                  .join(" · "),
              ],
              [
                t("Received", "موصول"),
                `${stamp(detail.received_at)} · ${detail.received_by_name}`,
              ],
              [t("Contact person", "رابطے کا ذمہ دار"), detail.contact_name],
              [t("Investigator", "تحقیق کار"), detail.investigator_name],
              [t("Course of action", "طریقہ عمل"), detail.course_of_action],
              [t("Answer due", "جواب کی تاریخ"), detail.answer_due],
              [
                t("Extension reason", "مزید وقت کی وجہ"),
                detail.extension_reason,
              ],
              [t("Next step", "اگلا قدم"), detail.next_step],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? t("Not recorded", "درج نہیں")}</dd>
              </div>
            ))}
          </dl>
          {detail.answer_overdue && (
            <p className="error" role="alert">
              {t(
                "Answer overdue. Contact the complainant and the complaints officer; an extension records actual communication, not a completed response.",
                "جواب کی تاریخ گزر گئی۔ شکایت کنندہ اور افسر سے رابطہ کریں؛ مزید وقت اصل رابطہ درج کرتا ہے، مکمل جواب نہیں۔",
              )}
            </p>
          )}
          <h3>{t("Recorded findings", "درج شدہ نتائج")}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {detail.findings ??
              t("No findings recorded yet.", "ابھی نتائج درج نہیں۔")}
          </p>
          {detail.findings_at && (
            <p>
              {detail.findings_by_name} · {stamp(detail.findings_at)}
            </p>
          )}
          {detail.incident_number && (
            <p>
              {t("Linked safety incident", "منسلک حفاظتی واقعہ")}:{" "}
              <bdi>{detail.incident_number}</bdi>
            </p>
          )}
          <div className="actions">
            {(["findings", "update", "action"] as Mode[]).map(
              (which) =>
                can(which) && (
                  <button
                    key={which}
                    data-help={
                      which === "findings"
                        ? recordId
                          ? "crw.findings"
                          : "mci.findings"
                        : which === "update"
                          ? recordId
                            ? "crw.update"
                            : "mci.update"
                          : recordId
                            ? "crw.action"
                            : "mci.action"
                    }
                    disabled={blocked || !!mode}
                    onClick={() => begin(which)}
                  >
                    {which === "findings"
                      ? t("Write findings", "نتائج لکھیں")
                      : which === "update"
                        ? t(
                            "Record contact / extension",
                            "رابطہ / مزید وقت درج کریں",
                          )
                        : t(
                            "Add corrective / preventive action",
                            "اصلاحی / احتیاطی عمل شامل کریں",
                          )}
                  </button>
                ),
            )}
          </div>
          <h3>{t("Contacts already made", "ہو چکے رابطے")}</h3>
          {!detail.updates.length ? (
            <p>{t("No contacts recorded.", "کوئی رابطہ درج نہیں۔")}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Stage / means", "مرحلہ / ذریعہ"),
                      t("Told", "بتایا"),
                      t("When / who", "وقت / کس نے"),
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.updates.map((u) => (
                    <tr key={u.update_id}>
                      <td>
                        {u.stage} · {u.means}
                      </td>
                      <td>{u.note}</td>
                      <td>
                        {stamp(u.informed_at)} · {u.informed_by_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3>{t("Actions", "اقدامات")}</h3>
          {!detail.actions.length ? (
            <p>{t("No actions recorded.", "کوئی عمل درج نہیں۔")}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Action / owner", "عمل / ذمہ دار"),
                      t("Work", "کام"),
                      t("Due / state", "تاریخ / حالت"),
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.actions.map((a) => (
                    <tr key={a.action_id}>
                      <td>
                        {a.action_number} · {a.owner_name}
                        {a.department_name && ` · ${a.department_name}`}
                      </td>
                      <td>{a.description}</td>
                      <td>
                        {a.due_date} · {a.status}
                        {a.is_overdue && (
                          <strong className="error">
                            {" "}
                            · {t("Overdue", "تاخیر")}
                          </strong>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {detail.outcome && (
            <p>
              {t(
                "Outcome conveyed by the complaints officer",
                "افسر کا پہنچایا گیا جواب",
              )}
              : {detail.outcome}
            </p>
          )}
        </article>
      )}
      {mode && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2>
            {mode === "findings"
              ? t("Findings draft", "نتائج کا مسودہ")
              : mode === "update"
                ? t(
                    "Actual contact with the complainant",
                    "شکایت کنندہ سے اصل رابطہ",
                  )
                : t("Corrective / preventive work", "اصلاحی / احتیاطی کام")}
          </h2>
          <p>
            {t(
              "Live changes preserve this draft. Review the current record above before submission. A lost reply keeps the exact original request locked for retry.",
              "تازہ تبدیلیاں یہ مسودہ محفوظ رکھتی ہیں۔ ارسال سے پہلے اوپر موجودہ ریکارڈ دیکھیں۔ جواب کھونے پر عین اصل درخواست دوبارہ کوشش کے لیے مقفل رہتی ہے۔",
            )}
          </p>
          <fieldset disabled={write.blocked || reportOpen || !editable}>
            {mode === "findings" && (
              <>
                <Field
                  label={t(
                    "Facts, people spoken to and records read",
                    "حقائق، جن سے بات ہوئی اور پڑھے ریکارڈ",
                  )}
                >
                  <textarea
                    data-help={
                      recordId ? "crw.findings-text" : "mci.findings-text"
                    }
                    required
                    minLength={10}
                    maxLength={8000}
                    rows={8}
                    value={findings}
                    onChange={(e) => {
                      setFindings(e.target.value);
                      setReviewed(false);
                    }}
                  />
                </Field>
                <p>
                  {reported
                    ? t(
                        "The new incident below will be linked when these findings are recorded.",
                        "نتائج درج کرنے پر نیچے نیا واقعہ منسلک ہوگا۔",
                      )
                    : t(
                        "If this reveals a safety incident, report it first. A confirmed new report can be linked here without typing a record number.",
                        "حفاظتی واقعہ ملے تو پہلے رپورٹ کریں۔ تصدیق شدہ نئی رپورٹ ریکارڈ نمبر لکھے بغیر یہاں منسلک ہوتی ہے۔",
                      )}
                </p>
                {reported && (
                  <p role="status">
                    <bdi>{reported.incident_number}</bdi> ·{" "}
                    {reported.description}
                  </p>
                )}
                {!reported &&
                  !detail?.incident_id &&
                  user.permissions.includes("incident.report") && (
                    <button
                      type="button"
                      data-help={recordId ? "crw.report" : "mci.report"}
                      onClick={() => setReportOpen(true)}
                    >
                      {t(
                        "Report a newly found safety incident",
                        "نیا ملنے والا حفاظتی واقعہ رپورٹ کریں",
                      )}
                    </button>
                  )}
              </>
            )}
            {mode === "update" && (
              <>
                <div className="fields">
                  <Field label={t("Contact stage", "رابطے کا مرحلہ")}>
                    <select
                      data-help={recordId ? "crw.stage" : "mci.stage"}
                      value={update.stage}
                      onChange={(e) => {
                        setUpdate({
                          ...update,
                          stage: e.target
                            .value as api.ComplaintUpdateIn["stage"],
                        });
                        setReviewed(false);
                      }}
                    >
                      {[
                        ["Progress", "پیش رفت"],
                        ["Extension", "مزید وقت"],
                        ["Other", "دیگر"],
                      ].map(([en, ur]) => (
                        <option key={en} value={en}>
                          {t(en, ur)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t("Actual means of contact", "اصل ذریعہ رابطہ")}
                  >
                    <select
                      data-help={recordId ? "crw.means" : "mci.means"}
                      value={update.means}
                      onChange={(e) => {
                        setUpdate({
                          ...update,
                          means: e.target
                            .value as api.ComplaintUpdateIn["means"],
                        });
                        setReviewed(false);
                      }}
                    >
                      {[
                        ["Telephone", "ٹیلی فون"],
                        ["SMS", "پیغام"],
                        ["Letter", "خط"],
                        ["Email", "ای میل"],
                        ["InPerson", "بالمشافہ"],
                      ].map(([en, ur]) => (
                        <option key={en} value={en}>
                          {t(en, ur)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field
                  label={t("What was actually told", "حقیقت میں کیا بتایا گیا")}
                >
                  <textarea
                    data-help={
                      recordId ? "crw.contact-note" : "mci.contact-note"
                    }
                    required
                    minLength={5}
                    maxLength={2000}
                    rows={4}
                    value={update.note}
                    onChange={(e) => {
                      setUpdate({ ...update, note: e.target.value });
                      setReviewed(false);
                    }}
                  />
                </Field>
                {update.stage === "Extension" && (
                  <>
                    <Field
                      label={t(
                        "New answer date told to the complainant",
                        "شکایت کنندہ کو بتائی نئی جواب تاریخ",
                      )}
                    >
                      <input
                        type="date"
                        data-help={
                          recordId ? "crw.extension-date" : "mci.extension-date"
                        }
                        required
                        value={update.extended_until}
                        onChange={(e) => {
                          setUpdate({
                            ...update,
                            extended_until: e.target.value,
                          });
                          setReviewed(false);
                        }}
                      />
                    </Field>
                    <Field
                      label={t(
                        "Why more time is needed",
                        "مزید وقت کیوں درکار ہے",
                      )}
                    >
                      <textarea
                        data-help={
                          recordId
                            ? "crw.extension-reason"
                            : "mci.extension-reason"
                        }
                        required
                        maxLength={1000}
                        value={update.extension_reason}
                        onChange={(e) => {
                          setUpdate({
                            ...update,
                            extension_reason: e.target.value,
                          });
                          setReviewed(false);
                        }}
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            {mode === "action" && (
              <>
                <div className="fields">
                  <Field label={t("Action type", "عمل کی قسم")}>
                    <select
                      data-help={
                        recordId ? "crw.action-type" : "mci.action-type"
                      }
                      value={action.action_type}
                      onChange={(e) => {
                        setAction({
                          ...action,
                          action_type: e.target
                            .value as api.QualityActionIn["action_type"],
                        });
                        setReviewed(false);
                      }}
                    >
                      <option value="Corrective">
                        {t("Corrective", "اصلاحی")}
                      </option>
                      <option value="Preventive">
                        {t("Preventive", "احتیاطی")}
                      </option>
                    </select>
                  </Field>
                  <Field
                    label={t(
                      "Responsible person with a login",
                      "لاگ ان والا ذمہ دار فرد",
                    )}
                  >
                    <DirectoryPicker
                      data-help={recordId ? "crw.owner" : "mci.owner"}
                      path="/staff/lookup"
                      idField="user_id"
                      search
                      userId
                      required
                      value={action.owner_user_id}
                      onChange={(e) => {
                        setAction({ ...action, owner_user_id: e.target.value });
                        setReviewed(false);
                      }}
                    />
                  </Field>
                  <Field label={t("Department (optional)", "شعبہ (اختیاری)")}>
                    <DirectoryPicker
                      data-help={recordId ? "crw.department" : "mci.department"}
                      path="/admin/departments"
                      idField="department_id"
                      value={action.department_id}
                      onChange={(e) => {
                        setAction({ ...action, department_id: e.target.value });
                        setReviewed(false);
                      }}
                    />
                  </Field>
                  <Field label={t("Due date", "آخری تاریخ")}>
                    <input
                      data-help={recordId ? "crw.due" : "mci.due"}
                      type="date"
                      required
                      value={action.due_date}
                      onChange={(e) => {
                        setAction({ ...action, due_date: e.target.value });
                        setReviewed(false);
                      }}
                    />
                  </Field>
                </div>
                <Field label={t("What needs to be done", "کیا کام کرنا ہے")}>
                  <textarea
                    data-help={
                      recordId
                        ? "crw.action-description"
                        : "mci.action-description"
                    }
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={4}
                    value={action.description}
                    onChange={(e) => {
                      setAction({ ...action, description: e.target.value });
                      setReviewed(false);
                    }}
                  />
                </Field>
              </>
            )}
            <label className="check">
              <input
                type="checkbox"
                data-help={recordId ? "crw.confirm" : "mci.confirm"}
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              {t(
                "I checked this complaint, the current record and this actual entry.",
                "میں نے شکایت، موجودہ ریکارڈ اور یہ اصل اندراج چیک کیا ہے۔",
              )}
            </label>
            <div className="actions">
              <button
                type="button"
                data-help={recordId ? "crw.cancel" : "mci.cancel"}
                onClick={clearDraft}
              >
                {t("Cancel unsent draft", "غیر ارسال مسودہ منسوخ کریں")}
              </button>
              <button
                type="submit"
                data-help={recordId ? "crw.submit" : "mci.submit"}
                className="primary"
                disabled={!reviewed || !can(mode)}
              >
                {t("Record this entry", "یہ اندراج درج کریں")}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {reportOpen && (
        <Modal
          title={t(
            "Report the safety incident first",
            "پہلے حفاظتی واقعہ رپورٹ کریں",
          )}
          onClose={() => {
            if (
              !incidentPending &&
              window.confirm(
                t(
                  "Close the incident report? Keep any confirmed report for the findings.",
                  "واقعے کی رپورٹ بند کریں؟ تصدیق شدہ رپورٹ نتائج کے لیے محفوظ رہے گی۔",
                ),
              )
            )
              setReportOpen(false);
          }}
        >
          <div data-help-screen="report_incident">
            <Incidents
              user={user}
              revision={revision}
              timeZone={timeZone}
              onRecorded={setReported}
              onPendingChange={setIncidentPending}
            />
          </div>
          {reported && (
            <button
              data-help={recordId ? "crw.use-incident" : "mci.use-incident"}
              disabled={incidentPending}
              onClick={() => setReportOpen(false)}
            >
              {t(
                "Use this confirmed incident",
                "یہ تصدیق شدہ واقعہ استعمال کریں",
              )}
            </button>
          )}
        </Modal>
      )}
    </section>
  );
}
