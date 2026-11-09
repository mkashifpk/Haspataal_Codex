import { useEffect, useState, type FormEvent } from "react";
import * as feedback from "../generated/patient_feedback";
import { ErrorBox, Field, LoadState, useLoad } from "../components";
import { ApiError } from "../bridge";
import { DirectoryPicker } from "../DirectoryPicker";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import {
  formatHospitalTime,
  hospitalTimeInput,
  hospitalTimeZoneError,
} from "../hospital-time";
import { bilingual as t } from "../i18n";
import { feedbackLabel } from "./RecordFeedback";
import { QualityPaper } from "./QualityPaper";

const screenId = "patient_feedback";
const pageSize = 100;
type Filter = {
  date_from: string;
  date_to: string;
  review_pending: boolean;
  satisfied?: boolean;
};

export function PatientFeedback({
  user,
  connected,
  readOnly,
  noNewWork,
  timeZone,
  revision,
  onOpenHelp,
}: {
  user: ClinicalUser;
  connected: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  timeZone?: string;
  revision: number;
  onOpenHelp: () => void;
}) {
  const zoneError = hospitalTimeZoneError(timeZone);
  const today = !zoneError
    ? hospitalTimeInput(Date.now(), timeZone!).slice(0, 10)
    : "";
  const defaults: Filter = {
    date_from: today.slice(0, 7) + "-01",
    date_to: today,
    review_pending: true,
  };
  const [filter, setFilter] = useState<Filter>();
  const active = filter ?? defaults;
  const [before, setBefore] = useState<number>();
  const [selected, setSelected] = useState<number>();
  const [mode, setMode] = useState<"review" | "action">();
  const [approved, setApproved] = useState(false);
  const [localError, setLocalError] = useState<unknown>();
  const [refresh, setRefresh] = useState(0);
  const canReview = user.permissions.includes("feedback.review");
  const canRead = canReview || user.permissions.includes("msds.view");
  const readable = canRead && !zoneError;
  const records = useLoad(
    () =>
      readable
        ? feedback.registerPatientFeedback({
            ...active,
            limit: pageSize,
            before_id: before,
          })
        : Promise.resolve([]),
    [
      readable,
      active.date_from,
      active.date_to,
      active.review_pending,
      active.satisfied,
      before,
      revision,
      refresh,
    ],
  );
  const summary = useLoad(
    () =>
      readable
        ? feedback.summaryPatientFeedback({
            date_from: active.date_from,
            date_to: active.date_to,
          })
        : Promise.resolve(undefined),
    [readable, active.date_from, active.date_to, revision, refresh],
  );
  const selectedRecord = useLoad(
    () =>
      selected && canRead
        ? feedback.getPatientFeedback(selected)
        : Promise.resolve(undefined),
    [canRead, selected, revision, refresh],
  );
  const detail =
    canRead && selectedRecord.data?.feedback_id === selected
      ? selectedRecord.data
      : undefined;
  function reload() {
    setApproved(false);
    setRefresh((n) => n + 1);
  }
  const write = useClinicalWrite(user, screenId, async () => {
    setMode(undefined);
    reload();
  });
  const editable =
    !!detail &&
    !selectedRecord.loading &&
    !selectedRecord.error &&
    !readOnly &&
    !noNewWork &&
    connected &&
    canReview &&
    !write.blocked &&
    !zoneError;
  const problem =
    write.error instanceof ApiError ? write.error.response.error : undefined;
  useEffect(() => {
    if (problem?.code === "FEEDBACK_ALREADY_REVIEWED") {
      setMode(undefined);
      reload();
    }
  }, [problem]);

  function filterRows(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const from = String(fields.get("date_from")),
      to = String(fields.get("date_to"));
    if (from > to) {
      setLocalError(
        Error(
          t("From must be on or before To.", "شروع کی تاریخ آخر سے بعد نہ ہو۔"),
        ),
      );
      return;
    }
    const answer = fields.get("satisfied");
    setLocalError(undefined);
    setSelected(undefined);
    setBefore(undefined);
    setFilter({
      date_from: from,
      date_to: to,
      review_pending: fields.get("review_pending") === "on",
      satisfied: answer ? answer === "yes" : undefined,
    });
    reload();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || !approved || !detail) return;
    const values = new FormData(event.currentTarget);
    const path = `/patient-feedback/${detail.feedback_id}`;
    setLocalError(undefined);
    if (mode === "review" && !detail.reviewed_at) {
      const action_taken = String(values.get("action_taken") ?? "").trim();
      if (action_taken.length < 3) {
        setLocalError(
          Error(
            t(
              "Write the action taken, at least three characters.",
              "کیا عمل ہوا، کم از کم تین حرف لکھیں۔",
            ),
          ),
        );
        return;
      }
      write.start({
        method: "POST",
        path: `${path}/review`,
        body: { action_taken },
        permission: "feedback.review",
        protection: "reconcile",
        reconcilePath: path,
        label: t("Record the in-charge’s review", "انچارج کا جائزہ درج کریں"),
      });
    } else if (mode === "action" && detail.reviewed_at) {
      const description = String(values.get("description") ?? "").trim();
      const owner_user_id = Number(values.get("owner_user_id"));
      if (description.length < 5 || !owner_user_id) {
        setLocalError(
          Error(
            t(
              "Describe the work and choose its owner by name.",
              "کام لکھیں اور ذمہ دار نام سے چنیں۔",
            ),
          ),
        );
        return;
      }
      const department = values.get("department_id");
      const body: feedback.QualityActionIn = {
        action_type:
          values.get("action_type") === "Preventive"
            ? "Preventive"
            : "Corrective",
        description,
        owner_user_id,
        due_date: String(values.get("due_date")),
        department_id: department ? Number(department) : undefined,
      };
      write.start({
        method: "POST",
        path: `${path}/actions`,
        body,
        permission: "feedback.review",
        protection: "idempotent",
        reconcilePath: path,
        label: t("Raise the follow-up action", "پیروی کا عمل درج کریں"),
      });
    }
  }
  const list = !records.loading && !records.error ? records.data : undefined;
  const totals = !summary.loading && !summary.error ? summary.data : undefined;
  const currentPage = [...(list ?? [])].sort(
    (a, b) => Number(a.satisfied) - Number(b.satisfied),
  );
  const editLocked = !!mode || write.blocked;
  const answerLabel = (yes: boolean) =>
    yes ? t("Satisfied", "مطمئن") : t("Dissatisfied", "غیر مطمئن");
  return (
    <section
      data-screen={screenId}
      data-unsaved={!!mode}
      data-write-pending={write.blocked}
    >
      <header className="screen-heading">
        <div>
          <h1>
            {t(
              "Patient feedback: review and actions",
              "مریض رائے: جائزہ اور اقدامات",
            )}
          </h1>
          <p>
            {t(
              "Review Annex A responses and assign follow-up. Reading a named response is logged in the patient’s record.",
              "ضمیمہ الف کی رائے دیکھیں اور پیروی دیں۔ نام والی رائے پڑھنا مریض کے ریکارڈ میں درج ہے۔",
            )}
          </p>
        </div>
        <button data-help="pfr.help" onClick={onOpenHelp}>
          {t("Help", "مدد")}
        </button>
      </header>
      <ErrorBox error={zoneError} />
      {!canRead && (
        <p role="status">
          {t(
            "Feedback review records are not available to this login.",
            "اس لاگ ان کو رائے کے ریکارڈ دستیاب نہیں۔",
          )}
        </p>
      )}
      {readable && (
        <>
          <form className="card toolbar" onSubmit={filterRows}>
            <fieldset disabled={editLocked}>
              <Field label={t("From", "سے")}>
                <input
                  data-help="pfr.filter"
                  name="date_from"
                  type="date"
                  required
                  defaultValue={active.date_from}
                />
              </Field>
              <Field label={t("To", "تک")}>
                <input
                  data-help="pfr.filter"
                  name="date_to"
                  type="date"
                  required
                  defaultValue={active.date_to}
                />
              </Field>
              <Field label={t("Satisfaction", "اطمینان")}>
                <select data-help="pfr.filter" name="satisfied">
                  <option value="">{t("All answers", "تمام جواب")}</option>
                  <option value="yes">{answerLabel(true)}</option>
                  <option value="no">{answerLabel(false)}</option>
                </select>
              </Field>
              <label className="check">
                <input
                  data-help="pfr.filter"
                  name="review_pending"
                  type="checkbox"
                  defaultChecked
                />
                {t("Review pending", "جائزہ باقی")}
              </label>
              <button data-help="pfr.filter" type="submit">
                {t("Apply feedback filters", "رائے فلٹر لگائیں")}
              </button>
            </fieldset>
          </form>
          <ErrorBox error={localError} />
          <LoadState {...records} retry={() => void records.reload()} />
          {list && (
            <article className="card">
              <h2>{t("Responses", "رائے")}</h2>
              {!list.length ? (
                <p role="status">
                  {t(
                    "No responses match this page and period.",
                    "اس صفحہ اور مدت میں کوئی رائے نہیں۔",
                  )}
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          t("Response", "رائے"),
                          t("Received", "موصول"),
                          t("Patient", "مریض"),
                          t("Answer", "جواب"),
                          t("Review", "جائزہ"),
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentPage.map((row) => (
                        <tr
                          key={row.feedback_id}
                          className={
                            !row.satisfied ? "feedback-dissatisfied" : undefined
                          }
                        >
                          <td>
                            <button
                              data-help="pfr.open"
                              disabled={editLocked}
                              onClick={() => {
                                setSelected(row.feedback_id);
                                setLocalError(undefined);
                              }}
                            >
                              {row.feedback_number}
                            </button>
                          </td>
                          <td>{row.received_on}</td>
                          <td>
                            {row.patient_name ?? t("Not named", "نام نہیں دیا")}
                            {row.mrn && ` · ${row.mrn}`}
                          </td>
                          <td>
                            <strong>{answerLabel(row.satisfied)}</strong>
                          </td>
                          <td>
                            {row.reviewed_at
                              ? t("Reviewed", "جائزہ شدہ")
                              : row.review_pending
                                ? t("Pending", "باقی")
                                : t("No pending review", "جائزہ باقی نہیں")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="toolbar">
                {before && (
                  <button
                    data-help="pfr.filter"
                    disabled={editLocked}
                    onClick={() => setBefore(undefined)}
                  >
                    {t("Newest responses", "تازہ ترین رائے")}
                  </button>
                )}
                {list.length === pageSize && (
                  <button
                    data-help="pfr.filter"
                    disabled={editLocked}
                    onClick={() => setBefore(list.at(-1)!.feedback_id)}
                  >
                    {t("Older responses", "پرانی رائے")}
                  </button>
                )}
              </div>
            </article>
          )}
          {selected && (
            <LoadState
              {...selectedRecord}
              retry={() => void selectedRecord.reload()}
            />
          )}
          <ClinicalWriteFeedback
            write={write}
            onReviewed={() => {
              setMode(undefined);
              reload();
            }}
          />
          {detail && (
            <article
              className="card"
              aria-label={t("Selected response", "منتخب رائے")}
            >
              <h2>
                {detail.feedback_number} · {answerLabel(detail.satisfied)}
              </h2>
              <p>
                {detail.patient_name ?? t("Not named", "نام نہیں دیا")}
                {detail.mrn && ` · ${detail.mrn}`} · {detail.received_on}
              </p>
              <p>
                {feedbackLabel(detail.channel)} ·{" "}
                {feedbackLabel(detail.respondent)} · {detail.recorded_by_name}
              </p>
              <ul>
                {detail.reasons.map((reason) => (
                  <li key={reason}>{feedbackLabel(reason)}</li>
                ))}
              </ul>
              {detail.other_reason && <p>{detail.other_reason}</p>}
              {detail.comments && <p>{detail.comments}</p>}
              <h3>
                {t("Action by the person in charge", "انچارج کی کارروائی")}
              </h3>
              {detail.reviewed_at ? (
                <>
                  <p>{detail.review_action}</p>
                  <p>
                    {detail.reviewed_by_name} ·{" "}
                    {formatHospitalTime(detail.reviewed_at, timeZone!)}
                  </p>
                </>
              ) : (
                <p>{t("No review recorded.", "جائزہ درج نہیں۔")}</p>
              )}
              {editable && !mode && (
                <button
                  data-help="pfr.edit"
                  onClick={() => {
                    setMode(detail.reviewed_at ? "action" : "review");
                    setApproved(false);
                    write.clearError();
                  }}
                >
                  {detail.reviewed_at
                    ? t("Raise action", "عمل درج کریں")
                    : t("Review response", "رائے کا جائزہ")}
                </button>
              )}
              {!!detail.actions.length && (
                <ul>
                  {detail.actions.map((action) => (
                    <li key={action.action_id}>
                      <strong>{action.action_number}</strong> ·{" "}
                      {action.description} · {action.owner_name} ·{" "}
                      {action.due_date} · {action.status}
                      {action.department_name && ` · ${action.department_name}`}
                    </li>
                  ))}
                </ul>
              )}
              {mode && (
                <form onSubmit={submit} onChange={() => setApproved(false)}>
                  <fieldset disabled={!editable}>
                    {mode === "review" ? (
                      <Field label={t("Action taken", "کیا عمل ہوا")}>
                        <textarea
                          required
                          name="action_taken"
                          minLength={3}
                          maxLength={2000}
                          data-help="pfr.review"
                        />
                      </Field>
                    ) : (
                      <>
                        <Field label={t("Action type", "عمل کی قسم")}>
                          <select name="action_type" data-help="pfr.action">
                            <option value="Corrective">
                              {t("Corrective", "اصلاحی")}
                            </option>
                            <option value="Preventive">
                              {t("Preventive", "احتیاطی")}
                            </option>
                          </select>
                        </Field>
                        <Field label={t("Description", "تفصیل")}>
                          <textarea
                            required
                            name="description"
                            minLength={5}
                            maxLength={1000}
                            data-help="pfr.action"
                          />
                        </Field>
                        <Field label={t("Owner by name", "ذمہ دار نام سے")}>
                          <DirectoryPicker
                            required
                            name="owner_user_id"
                            path="/quality/record-review/people"
                            idField="user_id"
                            data-help="pfr.owner"
                            disabled={!editable}
                          />
                        </Field>
                        <Field label={t("Department", "شعبہ")}>
                          <DirectoryPicker
                            name="department_id"
                            path="/admin/departments"
                            idField="department_id"
                            data-help="pfr.department"
                            disabled={!editable}
                          />
                        </Field>
                        <Field label={t("Due date", "مقررہ تاریخ")}>
                          <input
                            required
                            name="due_date"
                            type="date"
                            min={today}
                            data-help="pfr.action"
                          />
                        </Field>
                      </>
                    )}
                    <label className="check">
                      <input
                        type="checkbox"
                        data-help="pfr.confirm"
                        checked={approved}
                        onChange={(e) => {
                          e.stopPropagation();
                          setApproved(e.target.checked);
                        }}
                      />
                      {mode === "review"
                        ? t(
                            "I checked the response. This review is final and dated by the server.",
                            "رائے چیک کی۔ جائزہ حتمی ہے اور سرور تاریخ دے گا۔",
                          )
                        : t(
                            "I checked the owner, due date and work.",
                            "ذمہ دار، تاریخ اور کام چیک کیے۔",
                          )}
                    </label>
                    <button
                      data-help="pfr.submit"
                      type="submit"
                      disabled={!approved}
                    >
                      {mode === "review"
                        ? t("Save final review", "حتمی جائزہ محفوظ")
                        : t("Assign action", "عمل تفویض کریں")}
                    </button>
                  </fieldset>
                  <button
                    type="button"
                    data-help="pfr.cancel"
                    disabled={write.blocked}
                    onClick={() => {
                      setMode(undefined);
                      setLocalError(undefined);
                      write.clearError();
                    }}
                  >
                    {t("Cancel unsent changes", "غیر ارسال تبدیلی منسوخ")}
                  </button>
                </form>
              )}
            </article>
          )}
          <LoadState {...summary} retry={() => void summary.reload()} />
          {totals && (
            <article className="card">
              <h2>{t("Period summary", "مدت کا خلاصہ")}</h2>
              <p>
                {totals.date_from} – {totals.date_to}
              </p>
              <div className="metric-grid">
                {[
                  [t("Responses", "رائے"), totals.responses],
                  [answerLabel(true), totals.satisfied],
                  [answerLabel(false), totals.dissatisfied],
                  [t("Still to review", "جائزہ باقی"), totals.review_pending],
                  [t("Actions raised", "درج اقدامات"), totals.actions_raised],
                ].map(([name, count]) => (
                  <article key={name}>
                    <strong>{count}</strong>
                    <p>{name}</p>
                  </article>
                ))}
              </div>
              {totals.reasons.length ? (
                <ul>
                  {totals.reasons.map((reason) => (
                    <li key={String(reason.satisfied) + reason.reason}>
                      {answerLabel(reason.satisfied)} ·{" "}
                      {t(reason.label, feedbackLabel(reason.reason))} ·{" "}
                      <meter
                        aria-label={reason.label}
                        min={0}
                        max={Math.max(1, totals.responses)}
                        value={reason.responses}
                      />{" "}
                      {reason.responses}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {t(
                    "No reasons were recorded for this period.",
                    "اس مدت میں وجوہ درج نہیں۔",
                  )}
                </p>
              )}
            </article>
          )}
        </>
      )}
      {(canReview || user.permissions.includes("feedback.record")) && (
        <QualityPaper
          disabled={!connected || write.blocked}
          documents={[
            {
              label: t("blank feedback form", "خالی رائے فارم"),
              path: "/patient-feedback/form/pdf",
            },
          ]}
        />
      )}
    </section>
  );
}
