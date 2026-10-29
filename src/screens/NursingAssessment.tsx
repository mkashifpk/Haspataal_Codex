import { useEffect, useState } from "react";
import { ApiError } from "../bridge";
import {
  Details,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import {
  WardAdmission,
  type WardContext,
  type WardProps,
} from "../ward-admission";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import * as a from "../generated/nursing_assessment";
import {
  bmiSuggestion,
  nutritionRisk,
  nursingWriteAllowed,
} from "../nursing-assessment-policy";
type Draft = {
  kind: "screening" | "care";
  weight: string;
  height: string;
  bmi: string;
  loss: string;
  acute: string;
  plan: string;
  care: a.NursingCarePlanIn;
  ack: boolean;
};
const riskLabel=(risk:string|null)=>risk==='Low'?t('Low','کم'):risk==='Medium'?t('Medium','درمیانہ'):risk==='High'?t('High','زیادہ'):t('Not screened','جائزہ نہیں ہوا');
const careLabel=(field:string)=>({problems:t('Problems','مسائل'),goals:t('Goals','مقاصد'),interventions:t('Interventions','اقدامات'),evaluation:t('Evaluation','جائزے کا نتیجہ')})[field]||field;
export function NursingAssessment(props: WardProps) {
  return (
    <section>
      <h1>
        {t("Nursing assessment and care plan", "نرسنگ جائزہ و نگہداشت منصوبہ")}
      </h1>
      <p>
        {t(
          "At admission and each review, the nurse records the actual nutrition assessment and the nursing plan. Due flags come from the server, not this terminal’s clock.",
          "داخلے اور ہر جائزے پر نرس اصل غذائی جائزہ و نگہداشت منصوبہ درج کرے۔ تاخیر کی علامت سرور سے، ٹرمینل کی گھڑی سے نہیں۔",
        )}
      </p>
      <WardAdmission {...props} screenId="nursing_assessment">
        {(ctx) => <AssessmentForm {...props} ctx={ctx} />}
      </WardAdmission>
    </section>
  );
}
function AssessmentForm({
  ctx,
  user,
  connected,
  stream,
  timeZone,
}: WardProps & { ctx: WardContext }) {
  const id = ctx.admission.admission_id,
    [tick, setTick] = useState(0),
    [draft, setDraft] = useState<Draft>(),
    [review, setReview] = useState<
      a.NutritionScreeningIn | a.NursingCarePlanIn
    >(),
    [error, setError] = useState<unknown>(),
    [stale, setStale] = useState(false);
  const read = useLoad(
    () => a.nursingAssessmentView(id),
    [id, tick, ctx.admission.row_version, ctx.revision],
  );
  const data = read.data?.admission_id === id ? read.data : undefined;
  const allowed =
      ctx.ready &&
      connected &&
      stream === "Live" &&
      nursingWriteAllowed(ctx.view, ctx.admission.status, user.permissions),
    write = useClinicalWrite(
      user,
      "nursing_assessment:" + id,
      async (result) => {
        if (result.admission_id !== id)
          throw Error(
            "Assessment identity changed; read before another action",
          );
        read.setData(result);
        setDraft(undefined);
        setReview(undefined);
        setTick((n) => n + 1);
      },
    );
  const stamp = (s: string) => (timeZone ? formatHospitalTime(s, timeZone) : s);
  useEffect(() => {
    if (write.error) {
      setReview(undefined);
      if (
        write.error instanceof ApiError &&
        ["VERSION_CONFLICT", "ADMISSION_STATE_INVALID"].includes(
          write.error.response.error?.code || "",
        )
      ) {
        setStale(true);
        setTick((n) => n + 1);
        void ctx.reload();
      }
    }
  }, [write.error]);
  useEffect(() => {
    if (!draft) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [draft]);
  const change = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setReview(undefined);
  };
  function begin(kind: Draft["kind"]) {
    if (
      !allowed ||
      write.blocked ||
      !data ||
      read.loading ||
      read.error ||
      (draft &&
        !window.confirm(
          t(
            "Discard this unsent assessment draft?",
            "یہ غیر ارسال جائزہ مسودہ چھوڑ دیں؟",
          ),
        ))
    )
      return;
    setDraft({
      kind,
      weight: "",
      height: "",
      bmi: "",
      loss: "",
      acute: "",
      plan: "",
      care: {
        problems: data.care_plan?.problems || "",
        goals: data.care_plan?.goals || "",
        interventions: data.care_plan?.interventions || "",
        evaluation: data.care_plan?.evaluation || "",
        expected_version: data.care_plan?.row_version ?? null,
      },
      ack: false,
    });
    setReview(undefined);
    setError(undefined);
    write.clearError();
    setStale(false);
  }
  function prepare() {
    if (!draft || !allowed || stale || !draft.ack) return;
    setError(undefined);
    try {
      if (draft.kind === "screening") {
        for (const [label, value, min, max] of [
          ["Weight", draft.weight, 0.5, 400],
          ["Height", draft.height, 30, 250],
        ] as const) {
          if (
            value &&
            (!Number.isFinite(Number(value)) ||
              Number(value) < min ||
              Number(value) > max)
          )
            throw Error(`${label}: ${min}–${max}`);
        }
        if (
          !["0", "1", "2"].includes(draft.bmi) ||
          !["0", "1", "2"].includes(draft.loss) ||
          !["0", "2"].includes(draft.acute)
        )
          throw Error(
            t(
              "Choose all three actual assessment scores.",
              "جائزے کے تینوں اصل اسکور چنیں۔",
            ),
          );
        const risk = nutritionRisk([+draft.bmi, +draft.loss, +draft.acute]);
        if (risk.needsPlan && !draft.plan.trim())
          throw Error(
            t(
              "Medium or High risk needs the actual nutrition plan.",
              "درمیانے یا زیادہ خطرے پر اصل غذائی منصوبہ لازم۔",
            ),
          );
        setReview({
          weight_kg: draft.weight ? +draft.weight : null,
          height_cm: draft.height ? +draft.height : null,
          bmi_score: +draft.bmi,
          weight_loss_score: +draft.loss,
          acute_disease_score: +draft.acute,
          plan: draft.plan.trim() || null,
        });
      } else {
        for (const field of ["problems", "goals", "interventions"] as const)
          if (draft.care[field].trim().length < 3)
            throw Error(
              t(
                "Problems, goals and interventions each need at least 3 characters.",
                "مسائل، مقاصد و اقدامات ہر ایک کم از کم3حروف۔",
              ),
            );
        setReview({
          ...draft.care,
          problems: draft.care.problems.trim(),
          goals: draft.care.goals.trim(),
          interventions: draft.care.interventions.trim(),
          evaluation: draft.care.evaluation?.trim() || null,
        });
      }
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!draft || !review || !allowed || stale || write.blocked) return;
    const kind = draft.kind;
    write.start(
      {
        method: kind === "screening" ? "POST" : "PUT",
        path: `/admissions/${id}/${kind === "screening" ? "nutrition-screenings" : "nursing-care-plan"}`,
        body: review,
        permission: "ipd.nursing_assessment.record",
        protection: kind === "screening" ? "idempotent" : "reconcile",
        reconcilePath: `/admissions/${id}/nursing-assessment`,
        label:
          kind === "screening"
            ? t("Record nutrition screening", "غذائی جائزہ درج کریں")
            : t("Save nursing care plan", "نرسنگ منصوبہ محفوظ کریں"),
      },
      async () => {
        await ctx.preflight("ipd.nursing_assessment.record");
        const fresh = await a.nursingAssessmentView(id);
        if (
          kind === "care" &&
          (fresh.care_plan?.row_version ?? null) !== draft.care.expected_version
        ) {
          read.setData(fresh);
          setStale(true);
          setReview(undefined);
          throw Error(
            t(
              "The care plan changed. Your input is kept; compare the current version before another review.",
              "نگہداشت منصوبہ بدلا۔ معلومات محفوظ؛ اگلے جائزے سے پہلے موجودہ نسخہ ملائیں۔",
            ),
          );
        }
      },
    );
  }
  const suggestion = draft
    ? bmiSuggestion(draft.weight, draft.height)
    : undefined;
  const scoreReady =
    !!draft && draft.bmi !== "" && draft.loss !== "" && draft.acute !== "";
  const risk =
    draft && scoreReady
      ? nutritionRisk([+draft.bmi, +draft.loss, +draft.acute])
      : undefined;
  return (
    <section
      className="nursing-assessment"
      data-write-pending={write.blocked}
      data-unsaved={!!draft}
    >
      <LoadState {...read} retry={read.reload} />
      <ErrorBox error={error} />
      <ClinicalWriteFeedback
        key={review ? "review" : "input"}
        write={write}
        onReviewed={() => {
          setStale(true);
          setTick((n) => n + 1);
        }}
      />
      {data && !read.loading && !read.error && (
        <section className="card">
          <h2>
            {ctx.admission.ward_name} · {ctx.admission.bed_label} ·{" "}
            {t("Assessment status", "جائزے کی حالت")}
          </h2>
          <p className={data.screening_overdue ? "error" : ""}>
            {data.screening_overdue
              ? t("Nutrition screening overdue", "غذائی جائزے میں تاخیر")
              : t(
                  "Nutrition screening not overdue",
                  "غذائی جائزے میں تاخیر نہیں",
                )}
          </p>
          <p className={data.care_plan_overdue ? "error" : ""}>
            {data.care_plan_overdue
              ? t("Nursing care plan overdue", "نرسنگ منصوبے میں تاخیر")
              : t(
                  "Nursing care plan not overdue",
                  "نرسنگ منصوبے میں تاخیر نہیں",
                )}
          </p>
          <p>
            {t("Latest nutrition risk", "آخری غذائی خطرہ")}:{" "}
            {riskLabel(data.latest_risk)}
          </p>
          <h3>{t("Nutrition screening history", "غذائی جائزے کی تاریخ")}</h3>
          {data.nutrition_screenings.map((s) => (
            <article key={s.screening_id}>
              <p>
                {stamp(s.screened_at)} · {riskLabel(s.risk)} ·{" "}
                {t("Total score", "کل اسکور")}: {s.total_score}
              </p>
              <p>
                {s.weight_kg ?? t("Weight not recorded", "وزن درج نہیں")} kg ·{" "}
                {s.height_cm ?? t("Height not recorded", "قد درج نہیں")} cm ·
                {t('BMI score','بی ایم آئی اسکور')} {s.bmi_score} · {t('Weight-loss score','وزن نقصان اسکور')} {s.weight_loss_score} · {t('Acute illness score','شدید بیماری اسکور')} {s.acute_disease_score}
              </p>
              <p>{s.plan}</p>
              <p>{s.author_stamp.text}</p>
            </article>
          ))}
          {!data.nutrition_screenings.length && (
            <p>
              {t("No nutrition screening recorded.", "غذائی جائزہ درج نہیں۔")}
            </p>
          )}
          <h3>
            {t("Current nursing care plan", "موجودہ نرسنگ نگہداشت منصوبہ")}
          </h3>
          {data.care_plan ? (
            <>
              <p>
                {t("Version", "نسخہ")}: {data.care_plan.row_version}
              </p>
              {(
                ["problems", "goals", "interventions", "evaluation"] as const
              ).map((f) => (
                <p key={f}>
                  {careLabel(f)}: {data.care_plan![f] || t("Not recorded", "درج نہیں")}
                </p>
              ))}
              <p>
                {data.care_plan.author_stamp.text} ·{" "}
                {stamp(data.care_plan.updated_at)}
              </p>
            </>
          ) : (
            <p>
              {t("No nursing care plan recorded.", "نرسنگ منصوبہ درج نہیں۔")}
            </p>
          )}
          <div className="actions">
            <button
              data-help="assessment.screen"
              disabled={!allowed || write.blocked}
              onClick={() => begin("screening")}
            >
              {t("New nutrition screening", "نیا غذائی جائزہ")}
            </button>
            <button
              data-help="assessment.care"
              disabled={!allowed || write.blocked}
              onClick={() => begin("care")}
            >
              {t(
                "Write / review nursing care plan",
                "نرسنگ منصوبہ لکھیں / جائزہ",
              )}
            </button>
          </div>
          {!allowed && (
            <p>
              {t(
                "Recording needs current patient identity, an active stay, permission, a writable service view and Live connection. Read-only records stay visible.",
                "اندراج کے لیے اصل شناخت، جاری داخلہ، اجازت، قابل تحریر خدمت و جاری رابطہ لازم۔ صرف پڑھنے کا ریکارڈ نظر آتا ہے۔",
              )}
            </p>
          )}
        </section>
      )}
      {draft && (
        <fieldset disabled={write.blocked || !ctx.ready} className="card">
          <legend>
            {draft.kind === "screening"
              ? t("Nutrition screening draft", "غذائی جائزہ مسودہ")
              : t("Nursing care-plan draft", "نرسنگ منصوبہ مسودہ")}
          </legend>
          {stale && (
            <p role="alert">
              {t(
                "Compare the current assessment above. Your unsent input is kept.",
                "اوپر موجودہ جائزہ ملائیں۔ غیر ارسال معلومات محفوظ ہیں۔",
              )}
            </p>
          )}
          {draft.kind === "screening" ? (
            <>
              <Field
                label={t("Weight (kg, optional)", "وزن (کلوگرام، اختیاری)")}
              >
                <input
                  data-help="assessment.screen"
                  data-field="weight_kg"
                  type="number"
                  min="0.5"
                  max="400"
                  step="any"
                  value={draft.weight}
                  onChange={(e) => change({ weight: e.target.value })}
                />
              </Field>
              <Field
                label={t("Height (cm, optional)", "قد (سینٹی میٹر، اختیاری)")}
              >
                <input
                  data-help="assessment.screen"
                  data-field="height_cm"
                  type="number"
                  min="30"
                  max="250"
                  step="any"
                  value={draft.height}
                  onChange={(e) => change({ height: e.target.value })}
                />
              </Field>
              {suggestion && (
                <p>
                  BMI {suggestion.bmi.toFixed(2)} ·{" "}
                  {t("Suggested score", "تجویز کردہ اسکور")}: {suggestion.score}{" "}
                  <button
                    data-help="assessment.screen"
                    onClick={() => change({ bmi: String(suggestion.score) })}
                  >
                    {t(
                      "Use suggested BMI score",
                      "تجویز کردہ بی ایم آئی اسکور لیں",
                    )}
                  </button>
                </p>
              )}
              <Field label={t("BMI score", "بی ایم آئی اسکور")}>
                <select
                  data-help="assessment.screen"
                  data-field="bmi_score"
                  value={draft.bmi}
                  onChange={(e) => change({ bmi: e.target.value })}
                >
                  <option value="">
                    {t("Choose actual score", "اصل اسکور چنیں")}
                  </option>
                  <option value="0">0 · BMI &gt;20</option>
                  <option value="1">1 · BMI18.5–20</option>
                  <option value="2">2 · BMI&lt;18.5</option>
                </select>
              </Field>
              <Field
                label={t(
                  "Unplanned weight-loss score",
                  "بلا ارادہ وزن کم ہونے کا اسکور",
                )}
              >
                <select
                  data-help="assessment.screen"
                  data-field="weight_loss_score"
                  value={draft.loss}
                  onChange={(e) => change({ loss: e.target.value })}
                >
                  <option value="">
                    {t("Choose actual score", "اصل اسکور چنیں")}
                  </option>
                  <option value="0">0 · &lt;5%</option>
                  <option value="1">1 · 5–10%</option>
                  <option value="2">2 · &gt;10%</option>
                </select>
              </Field>
              <p>
                {t(
                  "Unplanned loss during the last 3–6 months.",
                  "پچھلے3تا6ماہ میں بلا ارادہ وزن کا نقصان۔",
                )}
              </p>
              <Field
                label={t(
                  "Acute illness with no intake over 5 days",
                  "شدید بیماری میں5دن سے زیادہ غذا نہ لینا",
                )}
              >
                <select
                  data-help="assessment.screen"
                  data-field="acute_disease_score"
                  value={draft.acute}
                  onChange={(e) => change({ acute: e.target.value })}
                >
                  <option value="">
                    {t("Choose actual assessment", "اصل جائزہ چنیں")}
                  </option>
                  <option value="0">0 · {t("No", "نہیں")}</option>
                  <option value="2">2 · {t("Yes", "ہاں")}</option>
                </select>
              </Field>
              {risk && (
                <p>
                  {t("Preview risk", "خطرے کا پیش منظر")}: {riskLabel(risk.risk)} ·{" "}
                  {risk.total}
                </p>
              )}
              <Field label={t("Nutrition plan", "غذائی منصوبہ")}>
                <textarea
                  data-help="assessment.screen"
                  data-field="plan"
                  maxLength={2000}
                  value={draft.plan}
                  onChange={(e) => change({ plan: e.target.value })}
                />
              </Field>
              <p>
                {t(
                  "Medium and High risk need the actual plan, such as the dietitian handover or food chart. Saving never orders a consultation or food itself.",
                  "درمیانے و زیادہ خطرے پر اصل منصوبہ، مثلاً غذائی ماہر کو حوالہ یا غذا چارٹ۔ محفوظ کرنا خود مشورہ یا غذا کا حکم نہیں۔",
                )}
              </p>
            </>
          ) : (
            <>
              {(
                ["problems", "goals", "interventions", "evaluation"] as const
              ).map((f, i) => (
                <Field
                  key={f}
                  label={
                    [
                      t("Nursing problems", "نرسنگ مسائل"),
                      t("Nursing goals", "نرسنگ مقاصد"),
                      t("Nursing interventions", "نرسنگ اقدامات"),
                      t(
                        "Review evaluation (optional)",
                        "جائزے کا نتیجہ (اختیاری)",
                      ),
                    ][i]
                  }
                >
                  <textarea
                    data-help="assessment.care"
                    data-field={f}
                    minLength={f === "evaluation" ? undefined : 3}
                    maxLength={4000}
                    value={draft.care[f] || ""}
                    onChange={(e) =>
                      change({ care: { ...draft.care, [f]: e.target.value } })
                    }
                  />
                </Field>
              ))}
              <p>
                {t("Editing version", "زیر ترمیم نسخہ")}:{" "}
                {draft.care.expected_version ?? t("New plan", "نیا منصوبہ")}
              </p>
            </>
          )}
          <label>
            <input
              data-help="assessment.review"
              type="checkbox"
              checked={draft.ack}
              onChange={(e) => change({ ack: e.target.checked })}
            />
            {t(
              "I checked this patient and the actual nursing assessment",
              "میں نے مریض و اصل نرسنگ جائزہ چیک کیا",
            )}
          </label>
          <div className="actions">
            <button
              data-help="assessment.review"
              disabled={!allowed || !draft.ack || stale}
              onClick={prepare}
            >
              {t("Review assessment entry", "جائزے کے اندراج کا جائزہ")}
            </button>
            <button
              data-help="assessment.recovery"
              onClick={async () => {
                try {
                  const fresh = await a.nursingAssessmentView(id);
                  read.setData(fresh);
                  setDraft({
                    ...draft,
                    care: {
                      ...draft.care,
                      expected_version: fresh.care_plan?.row_version ?? null,
                    },
                    ack: false,
                  });
                  setReview(undefined);
                  setStale(false);
                  setError(undefined);
                  await ctx.reload();
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t(
                "Read latest assessment and keep input",
                "تازہ جائزہ پڑھیں و معلومات رکھیں",
              )}
            </button>
            <button
              data-help="assessment.review"
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      "Discard this unsent assessment draft?",
                      "غیر ارسال جائزہ مسودہ چھوڑ دیں؟",
                    ),
                  )
                ) {
                  setDraft(undefined);
                  setReview(undefined);
                }
              }}
            >
              {t("Close assessment draft", "جائزے کا مسودہ بند")}
            </button>
          </div>
        </fieldset>
      )}
      {review && draft && (
        <Modal
          title={t("Review nursing assessment", "نرسنگ جائزے کی تصدیق")}
          closable={!write.blocked}
          onClose={() => setReview(undefined)}
        >
          <p>
            {ctx.patient.full_name} · <bdi>{ctx.patient.mrn}</bdi> ·{" "}
            {ctx.admission.admission_number} · {ctx.admission.ward_name}{" "}
            {ctx.admission.bed_label}
          </p>
          <Details value={review} />
          <div className="actions">
            <button
              data-help="assessment.review"
              disabled={!allowed || write.blocked || stale}
              onClick={confirm}
            >
              {t("Confirm this assessment once", "یہ جائزہ ایک بار تصدیق کریں")}
            </button>
            <button
              data-help="assessment.review"
              disabled={write.blocked}
              onClick={() => setReview(undefined)}
            >
              {t("Back to assessment input", "جائزے کی معلومات پر واپس")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
