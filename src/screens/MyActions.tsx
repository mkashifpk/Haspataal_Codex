import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../generated/my_actions";
import { ApiError } from "../bridge";
import { ErrorBox, Field } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";

export function MyActions({
  user,
  revision,
  connected,
  readOnly,
  timeZone,
  initialAction,
  onOpenHelp,
  onChanged,
}: {
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  initialAction?: number;
  onOpenHelp: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<api.QualityActionOut[]>([]),
    [detail, setDetail] = useState<api.QualityActionOut>(),
    [error, setError] = useState<unknown>(),
    [loading, setLoading] = useState(false),
    [editing, setEditing] = useState(false),
    [status, setStatus] = useState<api.ActionDoneIn["status"]>("Done"),
    [note, setNote] = useState(""),
    [version, setVersion] = useState<number>(),
    [reviewed, setReviewed] = useState(false);
  const selected = useRef<number | undefined>(initialAction),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const list = await api.listActions({
        mine: true,
        status: "Open",
        limit: 1000,
      });
      const record = selected.current
        ? await api.getAction(selected.current)
        : undefined;
      if (record && record.owner_user_id !== user.user_id)
        throw Error(
          t(
            "This action is not assigned to you. Open the authorised action register for management work.",
            "یہ عمل آپ کے ذمے نہیں۔ انتظامی کام کے لیے مجاز عمل رجسٹر کھولیں۔",
          ),
        );
      if (n === generation.current) {
        setRows(
          list
            .filter((a) => a.owner_user_id === user.user_id)
            .sort((a, b) => a.due_date.localeCompare(b.due_date)),
        );
        setDetail(record);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [user.user_id]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh, revision]);
  const write = useClinicalWrite(user, "my_actions", async () => {
    setEditing(false);
    setReviewed(false);
    setNote("");
    await refresh();
    onChanged();
  });
  useEffect(() => {
    setReviewed(false);
  }, [detail]);
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      ["VERSION_CONFLICT", "QUALITY_ACTION_CLOSED"].includes(
        write.error.response.error?.code ?? "",
      )
    )
      void refresh();
  }, [write.error, refresh]);
  const writable =
    connected &&
    !readOnly &&
    !loading &&
    !error &&
    detail?.status === "Open" &&
    detail.owner_user_id === user.user_id;
  const mismatch = editing && version !== detail?.row_version;
  const choose = useCallback(
    async (id: number) => {
      const n = ++generation.current;
      setLoading(true);
      setError(undefined);
      try {
        const record = await api.getAction(id);
        if (record.owner_user_id !== user.user_id)
          throw Error(
            t(
              "This action belongs to someone else.",
              "یہ عمل کسی اور کے ذمے ہے۔",
            ),
          );
        if (n === generation.current) {
          selected.current = id;
          setDetail(record);
          setEditing(false);
          setReviewed(false);
          setNote("");
        }
      } catch (e) {
        if (n === generation.current) setError(e);
      } finally {
        if (n === generation.current) setLoading(false);
      }
    },
    [user.user_id],
  );
  useEffect(() => {
    if (initialAction && selected.current !== initialAction) void choose(initialAction);
  }, [initialAction, choose]);
  function open(id: number) {
    if (
      write.blocked ||
      (editing &&
        !window.confirm(
          t(
            "Discard the unsent completion draft?",
            "غیر ارسال تکمیل مسودہ چھوڑ دیں؟",
          ),
        ))
    )
      return;
    void choose(id);
  }
  function submit() {
    if (
      !detail ||
      !writable ||
      write.blocked ||
      !reviewed ||
      mismatch ||
      version == null
    )
      return;
    const base = `/quality/actions/${detail.action_id}`;
    write.start({
      method: "POST",
      path: base + "/complete",
      body: { status, note: note.trim(), expected_version: version },
      permission: { recordPath: base, ownerField: "owner_user_id" },
      protection: "reconcile",
      reconcilePath: base,
      label:
        status === "Done"
          ? t("Close action with evidence", "ثبوت کے ساتھ عمل مکمل کریں")
          : t("Cancel action with reason", "وجہ کے ساتھ عمل منسوخ کریں"),
    });
  }
  return (
    <section
      data-screen="my_actions"
      data-unsaved={editing}
      data-write-pending={write.blocked}
    >
      <div className="section-heading">
        <div>
          <h1>{t("My actions", "میرے اقدامات")}</h1>
          <p>
            {t(
              "Do the corrective or preventive work assigned to you, then record the evidence or the reason it could not proceed. Closure is final.",
              "اپنے ذمے اصلاحی یا احتیاطی کام کریں، پھر ثبوت یا کام نہ ہونے کی وجہ درج کریں۔ تکمیل حتمی ہے۔",
            )}
          </p>
        </div>
        <div className="actions">
          <button
            data-help="ma.refresh"
            disabled={write.blocked || loading}
            onClick={() => void refresh()}
          >
            {t("Refresh my actions", "میرے اقدامات تازہ کریں")}
          </button>
          <button data-help="ma.help" onClick={onOpenHelp}>
            F1 · {t("Help", "مدد")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Keep the draft open; nothing is submitted offline.",
            "رابطہ نہیں۔ مسودہ کھلا رکھیں؛ آف لائن کچھ ارسال نہیں ہوتا۔",
          )}
        </p>
      )}
      {readOnly && (
        <p>
          {t(
            "Records only; completion is unavailable.",
            "صرف ریکارڈ؛ تکمیل دستیاب نہیں۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setEditing(false);
          void refresh();
          onChanged();
        }}
      />
      {loading && (
        <p role="status">
          {t(
            "Reading your current actions…",
            "آپ کے تازہ اقدامات پڑھے جا رہے ہیں…",
          )}
        </p>
      )}
      {!loading && !error && !rows.length && (
        <p>
          {t(
            "No open actions are assigned to you. New assignments arrive by notification.",
            "آپ کے ذمے کوئی کھلا عمل نہیں۔ نئی ذمہ داری اطلاع سے آتی ہے۔",
          )}
        </p>
      )}
      {rows.length === 1000 && (
        <p role="alert">
          {t(
            "The list is bounded at1000. Ask Quality to reconcile any further open work.",
            "فہرست ہزار تک محدود ہے۔ مزید کھلا کام کوالٹی سے چیک کرائیں۔",
          )}
        </p>
      )}
      {!loading && !error && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  t("Action / source", "عمل / ماخذ"),
                  t("Work", "کام"),
                  t("Due", "آخری تاریخ"),
                  t("Next", "اگلا قدم"),
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.action_id}>
                  <td>
                    <bdi>{a.action_number}</bdi>
                    <br />
                    {a.source} · <bdi>{a.source_number}</bdi>
                  </td>
                  <td>{a.description}</td>
                  <td className={a.is_overdue ? "error" : ""}>
                    {a.due_date}
                    {a.is_overdue && (
                      <strong> · {t("Overdue", "تاخیر")}</strong>
                    )}
                  </td>
                  <td>
                    <button
                      data-help="ma.open"
                      disabled={write.blocked}
                      onClick={() => open(a.action_id)}
                    >
                      {t("Open action", "عمل کھولیں")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && !loading && !error && (
        <article className="panel">
          <h2>
            <bdi>{detail.action_number}</bdi> · {detail.status}
          </h2>
          <p>
            {detail.action_type} · {detail.source} ·{" "}
            <bdi>{detail.source_number}</bdi>
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{detail.description}</p>
          <p>
            {t("Owner", "ذمہ دار")}: {detail.owner_name}
            {detail.department_name && ` · ${detail.department_name}`}
          </p>
          <p>
            {t("Due", "آخری تاریخ")}: {detail.due_date}
            {detail.is_overdue && (
              <strong className="error"> · {t("Overdue", "تاخیر")}</strong>
            )}
          </p>
          <p>
            {t("Assigned by", "ذمہ داری دینے والا")}: {detail.created_by_name} ·{" "}
            {timeZone
              ? formatHospitalTime(detail.created_at, timeZone)
              : t(
                  "Hospital time zone unavailable",
                  "ہسپتال کا وقت دستیاب نہیں",
                )}
          </p>
          {detail.status === "Open" ? (
            <p>
              {t(
                "Complete the actual work before recording Done. Cancelled requires the reason it was dropped. The record cannot be reopened or edited here afterwards.",
                "مکمل درج کرنے سے پہلے اصل کام کریں۔ منسوخی میں کام چھوڑنے کی وجہ لازم ہے۔ بعد میں یہاں ریکارڈ دوبارہ کھل یا بدل نہیں سکتا۔",
              )}
            </p>
          ) : (
            <>
              <h3>{t("Final evidence / reason", "حتمی ثبوت / وجہ")}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {detail.outcome_note ?? t("Not recorded", "درج نہیں")}
              </p>
              <p>
                {detail.completed_by_name ??
                  t("Author not recorded", "مصنف درج نہیں")}
                {detail.completed_at &&
                  ` · ${timeZone ? formatHospitalTime(detail.completed_at, timeZone) : detail.completed_at}`}
              </p>
            </>
          )}
          {writable && !editing && (
            <button
              data-help="ma.complete"
              disabled={write.blocked}
              onClick={() => {
                setEditing(true);
                setVersion(detail.row_version);
                setStatus("Done");
                setNote("");
                setReviewed(false);
              }}
            >
              {t("Review completion / cancellation", "تکمیل / منسوخی کا جائزہ")}
            </button>
          )}
        </article>
      )}
      {editing && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2>{t("Record actual result", "اصل نتیجہ درج کریں")}</h2>
          <p>
            {t(
              "Review the source, work and current record above. This closes the action, not the complaint or incident that created it.",
              "اوپر ماخذ، کام اور موجودہ ریکارڈ چیک کریں۔ یہ عمل بند ہوتا ہے، اسے بنانے والی شکایت یا واقعہ نہیں۔",
            )}
          </p>
          {mismatch && (
            <div role="alert">
              <p>
                {t(
                  "The record changed while you were writing. Your note remains. Compare the current state before using its latest version.",
                  "لکھتے وقت ریکارڈ بدل گیا۔ نوٹ محفوظ ہے۔ نیا ورژن لینے سے پہلے تازہ حالت ملائیں۔",
                )}
              </p>
              {detail?.status === "Open" && (
                <button
                  type="button"
                  data-help="ma.compare"
                  disabled={write.blocked}
                  onClick={() => {
                    setVersion(detail.row_version);
                    setReviewed(false);
                  }}
                >
                  {t(
                    "Use current version; retain my note",
                    "موجودہ ورژن لیں؛ نوٹ رکھیں",
                  )}
                </button>
              )}
            </div>
          )}
          <fieldset disabled={write.blocked || !writable}>
            <Field label={t("Result", "نتیجہ")}>
              <select
                data-help="ma.status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as api.ActionDoneIn["status"]);
                  setReviewed(false);
                }}
              >
                <option value="Done">
                  {t("Done — evidence of work", "مکمل — کام کا ثبوت")}
                </option>
                <option value="Cancelled">
                  {t("Cancelled — why it was dropped", "منسوخ — چھوڑنے کی وجہ")}
                </option>
              </select>
            </Field>
            <Field
              label={
                status === "Done"
                  ? t("What was done and the evidence", "کیا کام ہوا اور ثبوت")
                  : t("Why the action was dropped", "عمل کیوں چھوڑا گیا")
              }
            >
              <textarea
                data-help="ma.note"
                required
                minLength={3}
                maxLength={2000}
                rows={6}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setReviewed(false);
                }}
              />
            </Field>
            <label className="check">
              <input
                data-help="ma.confirm"
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              {t(
                "I checked this action and its final evidence or reason.",
                "میں نے یہ عمل اور اس کا حتمی ثبوت یا وجہ چیک کی ہے۔",
              )}
            </label>
            <button
              data-help="ma.submit"
              className="primary"
              type="submit"
              disabled={!reviewed || mismatch}
            >
              {t("Close this action finally", "یہ عمل حتمی طور پر بند کریں")}
            </button>
          </fieldset>
          <button
            data-help="ma.cancel"
            type="button"
            disabled={write.blocked}
            onClick={() => {
              setEditing(false);
              setReviewed(false);
            }}
          >
            {t("Cancel unsent draft", "غیر ارسال مسودہ منسوخ کریں")}
          </button>
        </form>
      )}
    </section>
  );
}
