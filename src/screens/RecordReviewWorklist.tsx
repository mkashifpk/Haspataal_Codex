import { useState, type FormEvent } from "react";
import { ApiError } from "../bridge";
import type { ClinicalUser } from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Field, LoadState, useLoad } from "../components";
import * as review from "../generated/record_review_worklist";
import { formatHospitalTime } from "../hospital-time";
import { bilingual as t } from "../i18n";
import { QualityHeading } from "./QualityRegister";

type ScreenId =
  "record_review_worklist_doctor" | "record_review_worklist_nursing";
const groups = {
  Timeliness: "بروقت",
  Legibility: "پڑھنے کے قابل",
  Completeness: "مکمل",
};
const automatic = { Pass: "Yes", Fail: "No", NA: "NA" } as const;
const responses = {
  Yes: ["Yes", "ہاں"],
  No: ["No", "نہیں"],
  NA: ["Not applicable", "لاگو نہیں"],
} as const;
type Choice = keyof typeof responses;

function suggested(item: review.ItemOut, code: string): Choice | undefined {
  const value = item.auto_results[code];
  return value && automatic[value.result];
}

function needsComment(
  choice: Choice | undefined,
  original: Choice | undefined,
) {
  return (
    choice === "No" ||
    (choice !== undefined && original !== undefined && choice !== original)
  );
}

function Snapshot({
  item,
  timeZone,
}: {
  item: review.ItemOut;
  timeZone?: string;
}) {
  const admission = item.snapshot.admission;
  const visit = item.snapshot.visit;
  const record = admission ?? visit;
  const date = (value: string) =>
    timeZone ? formatHospitalTime(value, timeZone) : value;
  return (
    <article className="card">
      <h2>{t("Record snapshot", "ریکارڈ کی جھلک")}</h2>
      <p>
        <bdi>
          {item.record_number} · {item.mrn}
        </bdi>{" "}
        · {item.department_name}
      </p>
      {record && (
        <p>
          {record.patient_name} · {record.status}
        </p>
      )}
      {admission && (
        <>
          <h3>
            {t("Admission and initial care", "داخلہ اور ابتدائی نگہداشت")}
          </h3>
          <p>
            {admission.primary_doctor_name} · {admission.ward_name}
          </p>
          <p>{admission.admission_reason}</p>
          <p>{admission.provisional_diagnosis}</p>
          <p>{admission.initial_care_plan}</p>
          {admission.details_stamp && <p>{admission.details_stamp.text}</p>}
          {admission.discharge_summary && (
            <div>
              <h3>{t("Discharge summary", "ڈسچارج خلاصہ")}</h3>
              <p>
                {admission.discharge_summary.status} ·{" "}
                {admission.discharge_summary.final_diagnosis}
              </p>
              <p>
                {admission.discharge_summary.signer_name}{" "}
                {admission.discharge_summary.signed_at &&
                  date(admission.discharge_summary.signed_at)}
              </p>
            </div>
          )}
          <h3>
            {t(
              "Vitals, nursing notes and doses",
              "وائٹل، نرسنگ نوٹس اور خوراکیں",
            )}
          </h3>
          <p>
            {t("Vitals recorded", "وائٹل درج")} {admission.vitals.count} ·{" "}
            {t("Longest gap, minutes", "سب سے طویل وقفہ، منٹ")}{" "}
            {admission.vitals.longest_gap_minutes ?? "—"}
          </p>
          <p>
            {t("Nursing notes", "نرسنگ نوٹس")} {admission.nursing_notes.count} ·{" "}
            {t("Scheduled doses", "مقررہ خوراکیں")} {admission.doses.scheduled}{" "}
            · {t("Administered", "دی گئیں")} {admission.doses.administered} ·{" "}
            {t("Uncharted", "درج نہیں")} {admission.doses.uncharted}
          </p>
          <h3>{t("Operations", "آپریشن")}</h3>
          {admission.operations.length === 0 && (
            <p>{t("No operations recorded.", "کوئی آپریشن درج نہیں۔")}</p>
          )}
          {admission.operations.map((operation) => (
            <p key={operation.booking_number}>
              <bdi>{operation.booking_number}</bdi> · {operation.procedure_name}{" "}
              · {operation.surgeon_name} ·{" "}
              {operation.actual_start && date(operation.actual_start)} ·{" "}
              {operation.operative_note_status}
            </p>
          ))}
          <h3>{t("Documents and consent", "دستاویزات اور رضامندی")}</h3>
          {admission.documents.length === 0 &&
            admission.consents.length === 0 && (
              <p>
                {t(
                  "No documents or consents in this snapshot.",
                  "اس جھلک میں دستاویز یا رضامندی نہیں۔",
                )}
              </p>
            )}
          {admission.documents.map((document, index) => (
            <p key={index}>
              {document.title ?? document.doc_type} ·{" "}
              {date(document.uploaded_at)}
            </p>
          ))}
          {admission.consents.map((consent) => (
            <p key={consent.consent_number}>
              <bdi>{consent.consent_number}</bdi> · {consent.form_title} ·{" "}
              {consent.status}
            </p>
          ))}
        </>
      )}
      <h3>{t("Clinical notes", "طبی نوٹس")}</h3>
      {!record?.encounters.length && (
        <p>
          {t(
            "No encounter notes in this snapshot.",
            "اس جھلک میں ملاقات کے نوٹس نہیں۔",
          )}
        </p>
      )}
      {record?.encounters.map((note) => (
        <section key={note.encounter_id}>
          <h4>
            {note.encounter_type} · {note.status}
          </h4>
          <p>
            {note.doctor_name} · {date(note.finalized_at ?? note.created_at)}
          </p>
          {[
            note.chief_complaint,
            note.history,
            note.diagnosis,
            note.plan,
            note.clinical_note,
          ]
            .filter(Boolean)
            .map((line, index) => (
              <p
                key={index}
                style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {line}
              </p>
            ))}
        </section>
      ))}
      {record && (
        <p>
          {t("Prescriptions", "نسخے")} {record.prescriptions} ·{" "}
          {t("Lab requisitions", "لیب درخواستیں")} {record.lab_requisitions} ·{" "}
          {t("Imaging orders", "عکس درخواستیں")} {record.imaging_orders}
        </p>
      )}
    </article>
  );
}

export function RecordReviewWorklist({
  screenId,
  user,
  connected,
  readOnly,
  timeZone,
  revision,
  onOpenHelp,
}: {
  screenId: ScreenId;
  user: ClinicalUser;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  revision: number;
  onOpenHelp: () => void;
}) {
  const eligible = user.permissions.includes("quality.review.perform");
  const [includeReviewed, setIncludeReviewed] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [draft, setDraft] = useState<review.ItemOut>();
  const [answers, setAnswers] = useState<
    Record<string, { answer?: Choice; comment: string }>
  >({});
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [stale, setStale] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);
  const list = useLoad(
    () =>
      eligible
        ? review.myItems({ include_reviewed: includeReviewed })
        : Promise.resolve(undefined),
    [eligible, includeReviewed, revision],
  );
  const criteria = useLoad(
    () =>
      eligible
        ? review.criteria({ active_only: true })
        : Promise.resolve(undefined),
    [eligible, revision],
  );
  const detail = useLoad(
    () =>
      eligible && selected
        ? review.getItem(selected)
        : Promise.resolve(undefined),
    [eligible, selected],
  );
  const current =
    !detail.loading && !detail.error && detail.data?.item_id === selected
      ? detail.data
      : undefined;
  const rows = !list.loading && !list.error ? list.data : undefined;
  const catalogue =
    !criteria.loading && !criteria.error ? criteria.data : undefined;
  const write = useClinicalWrite(
    user,
    screenId,
    async (saved: review.ItemOut) => {
      detail.setData(saved);
      setDraft(undefined);
      setConfirmed(false);
      await list.reload();
    },
  );
  const canEdit =
    eligible &&
    connected &&
    !readOnly &&
    !write.blocked &&
    current?.status === "Pending" &&
    current.reviewer_user_id === user.user_id;
  const complete =
    !!draft &&
    draft.criteria.every(({ code }) => {
      const a = answers[code];
      return (
        !!a?.answer &&
        (!needsComment(a.answer, suggested(draft, code)) || !!a.comment.trim())
      );
    });
  const errorCode =
    write.error instanceof ApiError
      ? write.error.response.error?.code
      : undefined;

  function begin(item: review.ItemOut) {
    setDraft(item);
    setAnswers(
      Object.fromEntries(
        item.criteria.map(({ code }) => [
          code,
          { answer: suggested(item, code), comment: "" },
        ]),
      ),
    );
    setNote("");
    setConfirmed(false);
    setStale(false);
    write.clearError();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !draft || !complete || !confirmed || stale) return;
    const base = `/quality/record-review-items/${draft.item_id}`;
    const body: review.RecordReviewIn = {
      answers: Object.fromEntries(
        draft.criteria.map(({ code }) => [
          code,
          {
            answer: answers[code].answer!,
            comment: answers[code].comment.trim() || null,
          },
        ]),
      ),
      note: note.trim() || null,
    };
    write.start(
      {
        method: "POST",
        path: base + "/review",
        body,
        permission: "quality.review.perform",
        protection: "reconcile",
        reconcilePath: base,
        label: t("Submit the final record review", "حتمی ریکارڈ جائزہ بھیجیں"),
      },
      async () => {
        const live = await review.getItem(draft.item_id);
        if (
          live.status !== "Pending" ||
          live.reviewer_user_id !== user.user_id ||
          JSON.stringify(live.criteria) !== JSON.stringify(draft.criteria) ||
          JSON.stringify(live.auto_results) !==
            JSON.stringify(draft.auto_results) ||
          JSON.stringify(live.snapshot) !== JSON.stringify(draft.snapshot)
        ) {
          detail.setData(live);
          setStale(true);
          setConfirmed(false);
          throw Error(
            t(
              "The record or checklist changed. Compare the current version before starting a new review.",
              "ریکارڈ یا چیک لسٹ بدل گئی۔ نیا جائزہ شروع کرنے سے پہلے موجودہ ورژن ملائیں۔",
            ),
          );
        }
      },
    );
  }

  return (
    <section
      data-screen={screenId}
      data-unsaved={!!draft}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t("My record reviews", "میرے ریکارڈ جائزے")}
        text={t(
          "Read the records assigned to you and confirm each checklist answer before submitting the final review.",
          "اپنے مقررہ ریکارڈ پڑھیں اور حتمی جائزہ بھیجنے سے پہلے چیک لسٹ کا ہر جواب چیک کریں۔",
        )}
        onHelp={onOpenHelp}
      />
      {!eligible && (
        <p role="status">
          {t(
            "Record reviewer permission is required.",
            "ریکارڈ جائزہ لینے کی اجازت درکار ہے۔",
          )}
        </p>
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setDraft(undefined);
          setConfirmed(false);
          void detail.reload();
          void list.reload();
        }}
      />
      {eligible && (
        <article className="card">
          <h2>{t("Assigned records", "مقررہ ریکارڈ")}</h2>
          <div className="toolbar">
            <button
              data-help={
                screenId === "record_review_worklist_nursing"
                  ? "rrw.nursing"
                  : "rrw.list"
              }
              disabled={!connected || write.blocked}
              onClick={() => void list.reload()}
            >
              {t("Refresh assigned records", "مقررہ ریکارڈ تازہ پڑھیں")}
            </button>
            <label className="check">
              <input
                data-help="rrw.list"
                type="checkbox"
                checked={includeReviewed}
                disabled={!!draft}
                onChange={(e) => setIncludeReviewed(e.target.checked)}
              />
              {t("Include reviewed records", "جائزہ شدہ ریکارڈ شامل کریں")}
            </label>
            <button
              data-help="rrw.criteria"
              onClick={() => setShowCriteria(!showCriteria)}
            >
              {showCriteria
                ? t("Hide active criteria", "فعال معیار چھپائیں")
                : t("Show active criteria", "فعال معیار دکھائیں")}
            </button>
          </div>
          {showCriteria && (
            <div>
              <LoadState {...criteria} retry={() => void criteria.reload()} />
              {catalogue?.length === 0 && (
                <p>
                  {t(
                    "No active criteria are configured.",
                    "کوئی فعال معیار مقرر نہیں۔",
                  )}
                </p>
              )}
              {catalogue?.map((criterion) => (
                <p key={criterion.code}>
                  {t(criterion.category, groups[criterion.category])} ·{" "}
                  {criterion.title}
                </p>
              ))}
            </div>
          )}
          <LoadState {...list} retry={() => void list.reload()} />
          {rows?.length === 0 && (
            <p role="status">
              {t(
                "You have no records in this worklist. Check back after Quality assigns a review.",
                "اس کام فہرست میں آپ کا کوئی ریکارڈ نہیں۔ کوالٹی کے مقرر کرنے کے بعد دوبارہ دیکھیں۔",
              )}
            </p>
          )}
          {rows?.map((row) => (
            <p key={row.item_id}>
              <bdi>
                {row.record_number} · {row.mrn}
              </bdi>{" "}
              · {row.cycle_number} · {row.due_date} ·{" "}
              {row.status === "Reviewed"
                ? t("Reviewed", "جائزہ مکمل")
                : t("Pending", "زیر التوا")}{" "}
              <button
                data-help="rrw.open"
                disabled={!!draft || !connected}
                onClick={() => {
                  setSelected(row.item_id);
                  write.clearError();
                }}
              >
                {t("Open record for review", "جائزے کے لیے ریکارڈ کھولیں")}
              </button>
            </p>
          ))}
        </article>
      )}
      {selected && (
        <article className="card">
          <button
            data-help="rrw.open"
            disabled={!!draft || write.blocked}
            onClick={() => setSelected(undefined)}
          >
            {t("Close selected record", "منتخب ریکارڈ بند کریں")}
          </button>
          <LoadState {...detail} retry={() => void detail.reload()} />
          {current && (
            <div className="split">
              <Snapshot item={current} timeZone={timeZone} />
              <article className="card">
                <h2>{t("Review checklist", "جائزہ چیک لسٹ")}</h2>
                {canEdit && !draft && (
                  <button data-help="rrw.open" onClick={() => begin(current)}>
                    {t("Start checklist review", "چیک لسٹ جائزہ شروع کریں")}
                  </button>
                )}
                {current.status === "Reviewed" && (
                  <>
                    <p>
                      {t("Review submitted", "جائزہ جمع ہوا")}
                      {current.score_pct !== null && ` · ${current.score_pct}%`}
                    </p>
                    {current.criteria.map(({ code, title }) => (
                      <p key={code}>
                        {title} · {current.answers?.[code]?.answer}{" "}
                        {current.answers?.[code]?.comment}
                      </p>
                    ))}
                    {current.reviewer_note && <p>{current.reviewer_note}</p>}
                    {current.deficiencies.map((row) => (
                      <p key={row.deficiency_id}>
                        {row.description} · {row.status}
                      </p>
                    ))}
                  </>
                )}
                {draft && (
                  <form onSubmit={submit}>
                    {(stale ||
                      errorCode === "RECORD_REVIEW_FROZEN" ||
                      errorCode === "RECORD_REVIEW_NOT_ASSIGNED") && (
                      <p role="alert">
                        {t(
                          "Compare the current record before another review. Cancel the draft to read it again.",
                          "دوسرے جائزے سے پہلے موجودہ ریکارڈ ملائیں۔ دوبارہ پڑھنے کے لیے مسودہ منسوخ کریں۔",
                        )}
                      </p>
                    )}
                    <fieldset
                      disabled={
                        !canEdit ||
                        stale ||
                        errorCode === "RECORD_REVIEW_FROZEN" ||
                        errorCode === "RECORD_REVIEW_NOT_ASSIGNED"
                      }
                    >
                      {Object.entries(groups).map(([group, ur]) => (
                        <section key={group}>
                          <h3>{t(group, ur)}</h3>
                          {draft.criteria
                            .filter((criterion) => criterion.category === group)
                            .map(({ code, title, guidance }) => {
                              const a = answers[code];
                              const required = needsComment(
                                a.answer,
                                suggested(draft, code),
                              );
                              return (
                                <div key={code}>
                                  <p>
                                    <strong>{title}</strong> · <bdi>{code}</bdi>
                                  </p>
                                  {guidance && <p>{guidance}</p>}
                                  {draft.auto_results[code] && (
                                    <p>
                                      {t("System check", "سرور جانچ")} ·{" "}
                                      {draft.auto_results[code].detail}
                                    </p>
                                  )}
                                  <Field
                                    label={`${t("Answer", "جواب")} · ${code}`}
                                  >
                                    <select
                                      data-help="rrw.answer"
                                      value={a.answer ?? ""}
                                      required
                                      onChange={(e) => {
                                        setAnswers({
                                          ...answers,
                                          [code]: {
                                            ...a,
                                            answer: (e.target.value ||
                                              undefined) as Choice | undefined,
                                          },
                                        });
                                        setConfirmed(false);
                                      }}
                                    >
                                      <option value="">
                                        {t("Choose an answer", "جواب چنیں")}
                                      </option>
                                      {Object.entries(responses).map(
                                        ([key, [en, ur]]) => (
                                          <option key={key} value={key}>
                                            {t(en, ur)}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </Field>
                                  <Field
                                    label={`${t("Comment", "تبصرہ")} · ${code}`}
                                  >
                                    <textarea
                                      data-help="rrw.answer"
                                      value={a.comment}
                                      required={required}
                                      maxLength={1000}
                                      aria-invalid={
                                        required && !a.comment.trim()
                                      }
                                      className={
                                        required && !a.comment.trim()
                                          ? "error"
                                          : undefined
                                      }
                                      onChange={(e) => {
                                        setAnswers({
                                          ...answers,
                                          [code]: {
                                            ...a,
                                            comment: e.target.value,
                                          },
                                        });
                                        setConfirmed(false);
                                      }}
                                    />
                                  </Field>
                                </div>
                              );
                            })}
                        </section>
                      ))}
                      <Field
                        label={t("Reviewer note", "جائزہ لینے والے کا نوٹ")}
                      >
                        <textarea
                          data-help="rrw.submit"
                          maxLength={2000}
                          value={note}
                          onChange={(e) => {
                            setNote(e.target.value);
                            setConfirmed(false);
                          }}
                        />
                      </Field>
                      <label className="check">
                        <input
                          data-help="rrw.submit"
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                        />
                        {t(
                          "I checked every answer and understand the review is final.",
                          "میں نے ہر جواب دیکھا اور سمجھتا ہوں جائزہ حتمی ہے۔",
                        )}
                      </label>
                      <button
                        data-help="rrw.submit"
                        disabled={!complete || !confirmed}
                      >
                        {t("Submit final review", "حتمی جائزہ بھیجیں")}
                      </button>
                    </fieldset>
                    <button
                      type="button"
                      data-help="rrw.submit"
                      disabled={write.blocked}
                      onClick={() => {
                        setDraft(undefined);
                        setConfirmed(false);
                        write.clearError();
                        void detail.reload();
                      }}
                    >
                      {t("Cancel unsent review", "غیر ارسال جائزہ منسوخ کریں")}
                    </button>
                  </form>
                )}
              </article>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
