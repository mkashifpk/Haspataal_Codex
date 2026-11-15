import { useState, type FormEvent } from "react";
import { ErrorBox, Field, LoadState, useLoad } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import * as appraisals from "../generated/appraisals_hr";
import * as discipline from "../generated/discipline_health_hr";
import * as files from "../generated/personnel_files_hr";
import { formText, ReportTable } from "./P9cShared";
import { QualityPaper } from "./QualityPaper";

export const personnelReviewScreens = [
  "appraisals_hr", "appraise_staff_doctor", "appraise_staff_head_nurse",
  "discipline_health_hr", "personnel_files_hr", "personnel_files_quality",
  "personnel_files_owner",
] as const;
type Screen = (typeof personnelReviewScreens)[number];
export function isPersonnelReviewScreen(value: string): value is Screen {
  return personnelReviewScreens.some(screen => screen === value);
}
type Props = { screenId: Screen; revision: number; user: ClinicalUser; onOpenHelp: () => void; connected: boolean };
type Selection = { id: number; label: string };

export function PersonnelReview(props: Props) {
  const { screenId } = props;
  return <>
    <button type="button" data-help="personnel.review.help" onClick={props.onOpenHelp}>{t("Help", "مدد")}</button>
    {screenId === "discipline_health_hr" ? <DisciplineHealth {...props} />
      : screenId === "personnel_files_hr" || screenId === "personnel_files_quality" || screenId === "personnel_files_owner" ? <PersonnelFiles {...props} />
        : <AppraisalRegister {...props} />}
  </>;
}

const ratingLabels: Record<number, [string, string]> = {
  1: ["1 - Unsatisfactory", "1 - غیر اطمینان بخش"],
  2: ["2 - Needs Improvement", "2 - بہتری درکار"],
  3: ["3 - Satisfactory", "3 - اطمینان بخش"],
  4: ["4 - Good", "4 - اچھا"],
  5: ["5 - Outstanding", "5 - شاندار"],
};

const overallRatingLabels: Record<string, [string, string]> = {
  Outstanding: ["Outstanding", "شاندار"],
  Good: ["Good", "اچھا"],
  Satisfactory: ["Satisfactory", "اطمینان بخش"],
  NeedsImprovement: ["Needs Improvement", "بہتری درکار"],
  Unsatisfactory: ["Unsatisfactory", "غیر اطمینان بخش"],
};

function AppraisalRegister({ screenId, revision, connected, user }: Props) {
  const [selected, setSelected] = useState<number>();
  const [showStats, setShowStats] = useState(false);
  const [creating, setCreating] = useState<{
    employee_id: number;
    name: string;
    emp_number: string;
    kind: "Probation" | "Annual" | "AdHoc";
    due_on?: string;
  }>();
  const [adHoc, setAdHoc] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<appraisals.StaffLookupOut>();
  const [editingDraft, setEditingDraft] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();

  const mine = screenId !== "appraisals_hr";
  const schedule = useLoad(() => appraisals.appraisalSchedule(), [revision]);
  const register = useLoad(() => appraisals.listAppraisals({ mine: mine || undefined }), [mine, revision]);
  const detail = useLoad(() => selected ? appraisals.getAppraisal(selected) : Promise.resolve(undefined), [selected, revision]);
  const statistics = useLoad(() => showStats ? appraisals.appraisalStatistics() : Promise.resolve(undefined), [showStats, revision]);
  const staffLookup = useLoad(() => (creating || adHoc) && staffSearch
    ? appraisals.lookupStaff({ q: staffSearch, limit: 20 }) : Promise.resolve([]), [creating, adHoc, staffSearch]);
  const appraisal = !detail.loading && !detail.error && detail.data?.appraisal_id === selected ? detail.data : undefined;

  async function createDraftAppraisal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connected || saving) return;
    const form = new FormData(event.currentTarget);
    const empId = creating?.employee_id ?? selectedStaff?.employee_id;
    const kind = (creating?.kind ?? (adHoc ? "AdHoc" : "Annual")) as "Probation" | "Annual" | "AdHoc";
    const period_from = String(form.get("period_from") ?? "");
    const period_to = String(form.get("period_to") ?? "");
    const reason = String(form.get("reason") ?? "").trim() || undefined;
    if (!empId || !period_from || !period_to) return;
    if (kind === "AdHoc" && !reason) return;
    setError(undefined);
    setSaving(true);
    try {
      const created = await appraisals.addAppraisal({
        employee_id: empId,
        kind,
        period_from,
        period_to,
        reason,
        appraiser_user_id: user.user_id,
      });
      setCreating(undefined);
      setAdHoc(false);
      setSelectedStaff(undefined);
      setSelected(created.appraisal_id);
      await Promise.all([schedule.reload(), register.reload()]);
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function updateAppraisalForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appraisal || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const overall = form.get("overall_rating") as appraisals.AppraisalDetailOut["overall_rating"];
    const targets = String(form.get("targets") ?? "").trim() || null;
    const strengths = String(form.get("strengths") ?? "").trim() || null;
    const development_needs = String(form.get("development_needs") ?? "").trim() || null;
    const development_plan = String(form.get("development_plan") ?? "").trim() || null;
    const period_from = String(form.get("period_from") ?? appraisal.period_from);
    const period_to = String(form.get("period_to") ?? appraisal.period_to);

    // Below satisfactory requires development plan (MSDS HRM 136)
    if ((overall === "NeedsImprovement" || overall === "Unsatisfactory") && !development_plan) {
      setError(t("A development plan is required when rating is below Satisfactory.", "اطمینان بخش سے کم درجہ بندی پر ترقی کا منصوبہ لازمی ہے۔"));
      return;
    }

    const ratings: appraisals.RatingIn[] = appraisal.criteria.map(crit => ({
      criterion: crit.criterion,
      kind: crit.kind,
      rating: Number(form.get(`rating_${crit.criterion}`) || 3),
      comment: String(form.get(`comment_${crit.criterion}`) ?? "").trim() || undefined,
    }));

    setError(undefined);
    setSaving(true);
    try {
      await appraisals.updateAppraisal(appraisal.appraisal_id, {
        period_from,
        period_to,
        overall_rating: overall,
        targets,
        strengths,
        development_needs,
        development_plan,
        ratings,
        expected_version: appraisal.row_version,
      });
      setEditingDraft(false);
      await Promise.all([detail.reload(), register.reload()]);
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function signAppraisalAction() {
    if (!appraisal || !connected || saving) return;
    setError(undefined);
    setSaving(true);
    try {
      await appraisals.signAppraisal(appraisal.appraisal_id);
      await Promise.all([detail.reload(), register.reload(), schedule.reload()]);
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppraisalAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appraisal || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") ?? "").trim();
    if (!reason) return;
    setError(undefined);
    setSaving(true);
    try {
      await appraisals.cancelAppraisal(appraisal.appraisal_id, { reason });
      setCancelling(false);
      await Promise.all([detail.reload(), register.reload(), schedule.reload()]);
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function acknowledgeAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appraisal || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const ackDate = String(form.get("acknowledged_on") ?? "");
    const comments = String(form.get("employee_comments") ?? "").trim() || undefined;
    if (!ackDate) return;
    setError(undefined);
    setSaving(true);
    try {
      await appraisals.acknowledgeAppraisal(appraisal.appraisal_id, {
        acknowledged_on: ackDate,
        employee_comments: comments,
      });
      setAcknowledging(false);
      await Promise.all([detail.reload(), register.reload()]);
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function recordTrainingAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appraisal || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const date = String(form.get("date") ?? "");
    const hours = Number(form.get("hours"));
    const category = form.get("category") as appraisals.EmployeeTrainingIn["category"];
    if (!title || !date || !hours) return;
    setError(undefined);
    setSaving(true);
    try {
      await appraisals.addTraining(appraisal.employee_id, {
        title,
        category,
        completed_on: date,
        hours,
        appraisal_id: appraisal.appraisal_id,
      });
      setTrainingMode(false);
      await detail.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  return <section data-screen={screenId}>
    <h1>{t("Staff appraisals", "عملے کی کارکردگی کا جائزہ")}</h1>
    <div className="toolbar">
      <QualityPaper disabled={!connected} documents={[{ path: "/personnel/appraisal-policy/pdf", label: t("appraisal policy", "جائزے کی پالیسی") }]} />
      <button type="button" data-help="personnel.review.appraisal" onClick={() => setShowStats(!showStats)}>
        {showStats ? t("Hide statistics", "اعداد و شمار چھپائیں") : t("Appraisal statistics", "کارکردگی جائزے کے اعداد و شمار")}
      </button>
      {!mine && <button type="button" data-help="personnel.review.appraisal" onClick={() => { setAdHoc(true); setCreating(undefined); }}>
        {t("New ad-hoc appraisal", "نیا وقتی جائزہ")}
      </button>}
    </div>

    <ErrorBox error={error} />

    {showStats && <article className="card">
      <h2>{t("Appraisal statistics", "کارکردگی جائزے کے اعداد و شمار")}</h2>
      <LoadState {...statistics} retry={statistics.reload} />
      {!statistics.loading && !statistics.error && statistics.data && <div>
        <p>{t("Period:", "مدت:")} {statistics.data.date_from} – {statistics.data.date_to} · {t("Grace days:", "رعایتی دن:")} {statistics.data.grace_days}</p>
        <p>{t("On-time percentage (MSDS HRM 137 >90%):", "بروقت تناسب (ایم ایس ڈی ایس >90%):")} <strong>{statistics.data.on_time_pct !== null ? `${statistics.data.on_time_pct}%` : "—"}</strong></p>
        <ReportTable title={t("Appraisal metrics", "جائزے کے پیمانے")}
          columns={[t("Metric", "پیمانہ"), t("Count", "تعداد")]}
          rows={[
            { key: "due", cells: [t("Due appraisals", "مقررہ جائزے"), statistics.data.due] },
            { key: "signed", cells: [t("Signed appraisals", "دستخط شدہ جائزے"), statistics.data.signed] },
            { key: "on_time", cells: [t("Signed on time", "بروقت دستخط شدہ"), statistics.data.on_time] },
            { key: "probation", cells: [t("Probationary appraisals", "آزمائشی جائزے"), statistics.data.probation] },
            { key: "ad_hoc", cells: [t("Ad-hoc appraisals", "وقتی جائزے"), statistics.data.ad_hoc] },
            { key: "missing", cells: [t("Overdue / Missing", "تاخیر شدہ / باقی"), statistics.data.missing] },
            { key: "development_planned", cells: [t("Development planned", "منصوبہ بندی شدہ"), statistics.data.development_planned] },
            { key: "development_trained", cells: [t("Development trained", "تربیت یافتہ"), statistics.data.development_trained] },
          ]} />
      </div>}
    </article>}

    {(creating || adHoc) && <form className="card" onSubmit={createDraftAppraisal}>
      <fieldset disabled={saving || !connected}>
        <legend>{creating ? `${t("Start appraisal", "جائزہ شروع کریں")} (${creating.kind})` : t("New ad-hoc appraisal", "نیا وقتی جائزہ")}</legend>
        {creating ? <p><strong>{creating.emp_number} · {creating.name}</strong></p> : <>
          <Field label={t("Find staff by name or number", "نام یا نمبر سے عملہ تلاش کریں")}>
            <input data-help="personnel.review.appraisal" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
          </Field>
          <LoadState {...staffLookup} retry={staffLookup.reload} />
          {!staffLookup.loading && !staffLookup.error && staffLookup.data && staffLookup.data.length > 0 && <div>
            {staffLookup.data.map(st => (
              <button key={st.employee_id} type="button" data-help="personnel.review.appraisal" onClick={() => setSelectedStaff(st)} style={{ fontWeight: selectedStaff?.employee_id === st.employee_id ? "bold" : "normal" }}>
                {st.emp_number} · {st.full_name} ({st.designation})
              </button>
            ))}
          </div>}
          {selectedStaff && <p>{t("Selected:", "منتخب:")} <strong>{selectedStaff.emp_number} · {selectedStaff.full_name}</strong></p>}
        </>}
        <Field label={t("Period from", "مدت از")}>
          <input data-help="personnel.review.appraisal" type="date" name="period_from" required />
        </Field>
        <Field label={t("Period to", "مدت تا")}>
          <input data-help="personnel.review.appraisal" type="date" name="period_to" required />
        </Field>
        {adHoc && <Field label={t("Reason for ad-hoc appraisal", "وقتی جائزے کی وجہ")}>
          <textarea data-help="personnel.review.appraisal" name="reason" required placeholder={t("Incident, complaint or special review...", "واقعہ، شکایت یا خصوصی جائزہ...")} />
        </Field>}
        <button data-help="personnel.review.appraisal">{t("Create draft appraisal", "مسودہ جائزہ بنائیں")}</button>
        <button type="button" data-help="personnel.review.appraisal" onClick={() => { setCreating(undefined); setAdHoc(false); }}>{t("Cancel", "منسوخ کریں")}</button>
      </fieldset>
    </form>}

    <LoadState {...schedule} retry={schedule.reload} />
    {!schedule.loading && !schedule.error && <ReportTable title={t("Appraisals due", "مقررہ جائزے")}
      columns={[t("Employee", "ملازم"), t("Type", "قسم"), t("Due", "مقررہ تاریخ"), t("Actions", "اقدامات")]}
      rows={(schedule.data ?? []).map(row => ({ key: row.employee_id + ":" + row.kind,
        cells: [
          <bdi>{row.emp_number} · {row.full_name}</bdi>,
          row.kind,
          <span style={{ color: row.overdue ? "var(--color-danger, #d32f2f)" : undefined, fontWeight: row.overdue ? "bold" : "normal" }}>
            {row.due_on}{row.overdue ? ` (${t("Overdue", "تاخیر")})` : ""}
          </span>,
          row.draft_id ? (
            <button type="button" data-help="personnel.review.appraisal" onClick={() => setSelected(row.draft_id!)}>
              {t("Continue draft", "مسودہ جاری رکھیں")}
            </button>
          ) : (
            <button type="button" data-help="personnel.review.appraisal" onClick={() => setCreating({
              employee_id: row.employee_id,
              name: row.full_name,
              emp_number: row.emp_number,
              kind: row.kind,
              due_on: row.due_on,
            })}>
              {t("Start appraisal", "جائزہ شروع کریں")}
            </button>
          ),
        ] }))} />}

    <LoadState {...register} retry={register.reload} />
    {!register.loading && !register.error && <ReportTable title={t("Appraisal register", "جائزوں کا رجسٹر")}
      columns={[t("Appraisal", "جائزہ"), t("Employee", "ملازم"), t("Period", "مدت"), t("Status", "حالت")]}
      rows={(register.data ?? []).map(row => ({ key: row.appraisal_id, cells: [
        <button data-help="personnel.review.appraisal" onClick={() => setSelected(row.appraisal_id)}>{row.appraisal_number}</button>,
        <bdi>{row.emp_number} · {row.full_name}</bdi>,
        `${row.period_from} – ${row.period_to}`,
        row.status,
      ] }))} />}

    {selected && <LoadState {...detail} retry={detail.reload} />}
    {appraisal && <article className="card">
      <h2>{appraisal.appraisal_number} · {appraisal.full_name}</h2>
      <p>{appraisal.period_from} – {appraisal.period_to} · <strong>{appraisal.status}</strong></p>
      <p>{t("Appraiser", "جائزہ لینے والا")} · {appraisal.appraiser_name}</p>
      {appraisal.reason && <p>{t("Reason", "وجہ")}: {appraisal.reason}</p>}
      {appraisal.overall_rating && <p>{t("Overall rating", "مجموعی درجہ")} · {overallRatingLabels[appraisal.overall_rating] ? t(...overallRatingLabels[appraisal.overall_rating]) : appraisal.overall_rating}</p>}
      {appraisal.targets && <p>{t("Targets", "اہداف")}: {appraisal.targets}</p>}
      {appraisal.strengths && <p>{t("Strengths", "خوبیاں")}: {appraisal.strengths}</p>}
      {appraisal.development_needs && <p>{t("Development needs", "ترقی کی ضروریات")}: {appraisal.development_needs}</p>}
      {appraisal.development_plan && <p>{t("Development plan", "ترقی کا منصوبہ")} · {appraisal.development_plan}</p>}
      {appraisal.employee_comments && <p>{t("Employee comments", "ملازم کی رائے")}: {appraisal.employee_comments}</p>}
      {appraisal.acknowledged_on && <p>{t("Acknowledged on", "اعتراف کی تاریخ")}: {appraisal.acknowledged_on}</p>}

      <QualityPaper disabled={!connected} documents={[{ path: `/personnel/appraisals/${appraisal.appraisal_id}/pdf`, label: t("appraisal PDF", "جائزے کی پی ڈی ایف") }]} />

      <div className="toolbar" style={{ marginTop: "12px" }}>
        {appraisal.status === "Draft" && !editingDraft && (
          <button type="button" data-help="personnel.review.appraisal" onClick={() => setEditingDraft(true)}>
            {t("Edit draft appraisal", "مسودہ جائزے میں ترمیم")}
          </button>
        )}
        {appraisal.status === "Draft" && (
          <button type="button" data-help="personnel.review.appraisal" disabled={saving || !connected} onClick={signAppraisalAction}>
            {t("Sign appraisal (Final)", "جائزے پر دستخط کریں (حتمی)")}
          </button>
        )}
        {appraisal.status === "Draft" && !cancelling && (
          <button type="button" data-help="personnel.review.appraisal" onClick={() => setCancelling(true)}>
            {t("Cancel appraisal", "جائزہ منسوخ کریں")}
          </button>
        )}
        {appraisal.status === "Signed" && !acknowledging && (
          <button type="button" data-help="personnel.review.appraisal" onClick={() => setAcknowledging(true)}>
            {t("Record employee acknowledgement", "ملازم کا اعتراف درج کریں")}
          </button>
        )}
        {appraisal.status === "Acknowledged" && !trainingMode && (
          <button type="button" data-help="personnel.review.appraisal" onClick={() => setTrainingMode(true)}>
            {t("Record training for development plan", "ترقی کے منصوبے کے لیے تربیت درج کریں")}
          </button>
        )}
      </div>

      {editingDraft && appraisal.status === "Draft" && <form className="card" onSubmit={updateAppraisalForm}>
        <fieldset disabled={saving || !connected}>
          <legend>{t("Conduct appraisal", "کارکردگی کا جائزہ لیں")}</legend>
          <Field label={t("Overall rating", "مجموعی درجہ")}>
            <select name="overall_rating" data-help="personnel.review.appraisal" defaultValue={appraisal.overall_rating ?? "Satisfactory"} required>
              {Object.entries(overallRatingLabels).map(([code, pair]) => (
                <option key={code} value={code}>{t(...pair)}</option>
              ))}
            </select>
          </Field>
          <fieldset>
            <legend>{t("Evaluation criteria (1 to 5)", "معیارات برائے جائزہ (1 تا 5)")}</legend>
            {appraisal.criteria.map(crit => {
              const current = appraisal.ratings.find(r => r.criterion === crit.criterion);
              return <div key={crit.criterion} style={{ marginBottom: "12px", padding: "8px", border: "1px solid #ddd" }}>
                <strong>{crit.criterion} ({crit.kind})</strong>
                <Field label={t("Score", "اسکور")}>
                  <select name={`rating_${crit.criterion}`} data-help="personnel.review.appraisal" defaultValue={current?.rating ?? 3}>
                    {Object.entries(ratingLabels).map(([num, pair]) => (
                      <option key={num} value={num}>{t(...pair)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Comment", "تبصرہ")}>
                  <input name={`comment_${crit.criterion}`} data-help="personnel.review.appraisal" defaultValue={current?.comment ?? ""} />
                </Field>
              </div>;
            })}
          </fieldset>
          <Field label={t("Targets", "اہداف")}>
            <textarea name="targets" data-help="personnel.review.appraisal" defaultValue={appraisal.targets ?? ""} />
          </Field>
          <Field label={t("Strengths", "خوبیاں")}>
            <textarea name="strengths" data-help="personnel.review.appraisal" defaultValue={appraisal.strengths ?? ""} />
          </Field>
          <Field label={t("Development needs", "ترقی کی ضروریات")}>
            <textarea name="development_needs" data-help="personnel.review.appraisal" defaultValue={appraisal.development_needs ?? ""} />
          </Field>
          <Field label={t("Development plan (required below Satisfactory)", "ترقی کا منصوبہ (اطمینان بخش سے کم پر لازمی)")}>
            <textarea name="development_plan" data-help="personnel.review.appraisal" defaultValue={appraisal.development_plan ?? ""} />
          </Field>
          <button data-help="personnel.review.appraisal">{t("Save draft", "مسودہ محفوظ کریں")}</button>
          <button type="button" data-help="personnel.review.appraisal" onClick={() => setEditingDraft(false)}>{t("Cancel", "منسوخ کریں")}</button>
        </fieldset>
      </form>}

      {cancelling && <form className="card" onSubmit={cancelAppraisalAction}>
        <fieldset disabled={saving || !connected}>
          <legend>{t("Cancel appraisal", "جائزہ منسوخ کریں")}</legend>
          <Field label={t("Cancellation reason", "منسوخی کی وجہ")}>
            <textarea name="reason" data-help="personnel.review.appraisal" required />
          </Field>
          <button data-help="personnel.review.appraisal">{t("Confirm cancellation", "منسوخی کی تصدیق")}</button>
          <button type="button" data-help="personnel.review.appraisal" onClick={() => setCancelling(false)}>{t("Back", "واپس")}</button>
        </fieldset>
      </form>}

      {acknowledging && <form className="card" onSubmit={acknowledgeAction}>
        <fieldset disabled={saving || !connected}>
          <legend>{t("Acknowledge appraisal", "جائزے کا اعتراف")}</legend>
          <Field label={t("Acknowledged on", "اعتراف کی تاریخ")}>
            <input data-help="personnel.review.appraisal" type="date" name="acknowledged_on" required />
          </Field>
          <Field label={t("Employee comments", "ملازم کے تاثرات")}>
            <textarea data-help="personnel.review.appraisal" name="employee_comments" />
          </Field>
          <button data-help="personnel.review.appraisal">{t("Confirm acknowledgement", "اعتراف کی تصدیق")}</button>
          <button type="button" data-help="personnel.review.appraisal" onClick={() => setAcknowledging(false)}>{t("Cancel", "منسوخ کریں")}</button>
        </fieldset>
      </form>}

      {trainingMode && <form className="card" onSubmit={recordTrainingAction}>
        <fieldset disabled={saving || !connected}>
          <legend>{t("Record development training", "ترقیاتی تربیت درج کریں")}</legend>
          <Field label={t("Training title", "تربیت کا عنوان")}>
            <input data-help="personnel.review.appraisal" name="title" required />
          </Field>
          <Field label={t("Category", "زمرہ")}>
            <select name="category" data-help="personnel.review.appraisal">
              <option value="Clinical">{t("Clinical", "طبی")}</option>
              <option value="Safety">{t("Safety", "حفاظت")}</option>
              <option value="Quality">{t("Quality", "معیار")}</option>
              <option value="Management">{t("Management", "انتظام")}</option>
            </select>
          </Field>
          <Field label={t("Completed on", "تکمیل کی تاریخ")}>
            <input data-help="personnel.review.appraisal" type="date" name="date" required />
          </Field>
          <Field label={t("Hours", "گھنٹے")}>
            <input data-help="personnel.review.appraisal" type="number" step="0.5" min="0.5" name="hours" required defaultValue="1" />
          </Field>
          <button data-help="personnel.review.appraisal">{t("Save training", "تربیت محفوظ کریں")}</button>
          <button type="button" data-help="personnel.review.appraisal" onClick={() => setTrainingMode(false)}>{t("Cancel", "منسوخ کریں")}</button>
        </fieldset>
      </form>}
    </article>}
  </section>;
}

const disciplinaryActions = {
  NoAction: "کوئی کارروائی نہیں", Counselling: "مشاورت", VerbalWarning: "زبانی تنبیہ",
  WrittenWarning: "تحریری تنبیہ", FinalWarning: "آخری تنبیہ", Suspension: "معطلی", Termination: "ملازمت کا خاتمہ",
} as const;

const healthKinds = {
  PreEmploymentMedical: "ملازمت سے پہلے طبی معائنہ",
  PeriodicMedical: "دورانیہ وار طبی معائنہ",
  HepatitisBVaccine: "ہیپاٹائٹس بی ویکسین",
  HepatitisBAntibody: "ہیپاٹائٹس بی اینٹی باڈی",
  HepatitisBScreen: "ہیپاٹائٹس بی جانچ",
  HepatitisCScreen: "ہیپاٹائٹس سی جانچ",
  HIVScreen: "ایچ آئی وی جانچ",
  TBScreen: "ٹی بی جانچ",
  TetanusVaccine: "تشنج ویکسین",
  InfluenzaVaccine: "انفلوئنزا ویکسین",
  TyphoidVaccine: "ٹائیفائیڈ ویکسین",
  Other: "دیگر",
} as const satisfies Partial<Record<discipline.HealthRecordIn["kind"], string>>;

function HealthEntry({ employee, onCancel, onSubmit, disabled }: {
  employee: Selection;
  onCancel: () => void;
  onSubmit: (body: discipline.HealthRecordIn) => void;
  disabled: boolean;
}) {
  const [kind, setKind] = useState<keyof typeof healthKinds>("PeriodicMedical");
  const medical = kind.endsWith("Medical");
  const vaccine = kind.endsWith("Vaccine");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = new FormData(event.currentTarget);
    const done_on = formText(form, "done");
    if (!done_on) return;
    onSubmit({
      kind, done_on,
      dose: vaccine ? Number(form.get("dose")) : undefined,
      fit_for_duty: medical ? form.get("fitness") as discipline.HealthRecordIn["fit_for_duty"] : undefined,
      result: formText(form, "result") || undefined,
      next_due: formText(form, "next") || undefined,
      note: formText(form, "note") || undefined,
    });
  }

  return <form className="card" onSubmit={submit}>
    <h2>{t("Record staff health", "عملے کی صحت درج کریں")} · <bdi>{employee.label}</bdi></h2>
    <fieldset disabled={disabled}>
      <Field label={t("Entry type", "اندراج کی قسم")}><select data-help="personnel.review.health" value={kind}
        onChange={event => setKind(event.target.value as keyof typeof healthKinds)}>
        {Object.entries(healthKinds).map(([code, ur]) => <option key={code} value={code}>{t(code.replace(/([a-z])([A-Z])/g, "$1 $2"), ur)}</option>)}
      </select></Field>
      <Field label={t("Date completed", "تکمیل کی تاریخ")}><input name="done" type="date" required data-help="personnel.review.health" /></Field>
      {medical && <Field label={t("Fitness for duty", "کام کے لیے موزونیت")}>
        <select name="fitness" required defaultValue="" data-help="personnel.review.health">
          <option value="">{t("Select fitness", "موزونیت منتخب کریں")}</option>
          <option value="Fit">{t("Fit", "موزوں")}</option>
          <option value="FitWithRestrictions">{t("Fit with restrictions", "پابندیوں کے ساتھ موزوں")}</option>
          <option value="Unfit">{t("Unfit", "ناموزوں")}</option>
        </select>
      </Field>}
      {vaccine && <Field label={t("Dose number", "خوراک کا نمبر")}><input name="dose" type="number" min={1} max={5} required data-help="personnel.review.health" /></Field>}
      <Field label={t("Result", "نتیجہ")}><input name="result" maxLength={500} data-help="personnel.review.health" /></Field>
      <Field label={t("Next due date", "اگلی مقررہ تاریخ")}><input name="next" type="date" data-help="personnel.review.health" /></Field>
      <Field label={t("Note", "نوٹ")}><textarea name="note" maxLength={2000} data-help="personnel.review.health" /></Field>
      <label><input type="checkbox" required data-help="personnel.review.health" /> {t("I checked the employee and this entry.", "میں نے ملازم اور اس اندراج کی تصدیق کی ہے۔")}</label>
      <button data-help="personnel.review.health">{t("Save health entry", "صحت کا اندراج محفوظ کریں")}</button>
      <button type="button" data-help="personnel.review.health" onClick={onCancel}>{t("Cancel", "منسوخ کریں")}</button>
    </fieldset>
  </form>;
}

function DisciplineHealth({ screenId, user, revision, connected }: Props) {
  const { permissions } = user;
  const mayDiscipline = permissions.includes("personnel.discipline.manage");
  const mayHealth = permissions.includes("personnel.health.manage");
  const [employee, setEmployee] = useState<Selection>();
  const [healthEntry, setHealthEntry] = useState<Selection>();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [newCase, setNewCase] = useState<Selection>();
  const [decision, setDecision] = useState<discipline.DisciplinaryCaseOut>();
  const [outcome, setOutcome] = useState<discipline.DisciplinaryDecisionIn["outcome"]>("Decided");
  const maySearch = permissions.some(p => ["facility.compliance.manage","facility.equipment.manage","facility.maintenance.record","facility.drill.manage","personnel.training.record"].includes(p));
  const directory = useLoad(async () => maySearch && search
    ? { query: search, rows: await discipline.staffFacility({ q: search, limit: 30 }) }
    : undefined, [maySearch, search]);
  const matches = !directory.loading && !directory.error && directory.data?.query === search ? directory.data.rows : undefined;
  const cases = useLoad(() => mayDiscipline ? discipline.listCasesPersonnelDisciplinary() : Promise.resolve([]), [mayDiscipline, revision]);
  const due = useLoad(() => mayHealth ? discipline.healthDue() : Promise.resolve([]), [mayHealth, revision]);
  const history = useLoad(async () => mayHealth && employee
    ? { id: employee.id, rows: await discipline.healthRecord(employee.id) } : undefined, [mayHealth, employee, revision]);
  const write = useClinicalWrite(user, screenId, async () => {
    if (healthEntry) {
      setHealthEntry(undefined);
      await Promise.all([history.reload(), due.reload()]);
      return;
    }
    setNewCase(undefined);
    setDecision(undefined);
    await cases.reload();
  });
  const writable = connected && mayDiscipline && !write.blocked && !healthEntry;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!writable) return;
    const form = new FormData(event.currentTarget);
    const date = formText(form, "date");
    if (!date) return;
    const options = { method: "POST", permission: "personnel.discipline.manage", protection: "idempotent" } as const;
    if (newCase) {
      const allegation = formText(form, "allegation");
      if (!allegation) return;
      const body: discipline.DisciplinaryCaseIn = { occurred_on: date, allegation };
      write.start({ ...options, path: `/personnel/employees/${newCase.id}/disciplinary-cases`, body,
        label: t("Open disciplinary case", "تادیبی کیس کھولیں") });
    } else if (decision && !cases.loading && !cases.error && cases.data?.some(row => row.case_id === decision.case_id && row.status === "Open" && row.row_version === decision.row_version)) {
      const note = formText(form, "note");
      const employee_response = formText(form, "response");
      const action = formText(form, "action") as keyof typeof disciplinaryActions;
      if (!note || (outcome === "Decided" && (!Object.hasOwn(disciplinaryActions, action) || (action !== "NoAction" && !employee_response)))) return;
      const body: discipline.DisciplinaryDecisionIn = { outcome, decided_on: date, note,
        action: outcome === "Decided" ? action : undefined, employee_response: employee_response || undefined };
      write.start({ ...options, path: `/personnel/disciplinary-cases/${decision.case_id}/decide`, body,
        label: t("Record case decision", "کیس کا فیصلہ درج کریں") });
    }
  }

  return <section data-screen={screenId} data-unsaved={!!newCase || !!decision || !!healthEntry} data-write-pending={write.blocked}>
    <h1>{t("Discipline and staff health", "نظم و ضبط اور عملے کی صحت")}</h1>
    {maySearch && (mayHealth || mayDiscipline) && <form className="toolbar" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); }}>
      <Field label={t("Staff name or number", "ملازم کا نام یا نمبر")}><input data-help="personnel.review.health" value={query} required
        onChange={e => setQuery(e.target.value)} /></Field>
      <button data-help="personnel.review.health">{t("Find staff", "ملازم تلاش کریں")}</button>
    </form>}
    {search && <>
      <LoadState {...directory} retry={directory.reload} />
      {matches?.length === 0 && <p>{t("No matching staff.", "کوئی مماثل ملازم نہیں۔")}</p>}
      {matches?.map(row => {
        const target = {id:row.employee_id,label:row.emp_number + " · " + row.full_name};
        return <p key={row.employee_id}>{target.label}{" "}
          {mayHealth && <button disabled={!!healthEntry} data-help="personnel.review.health" onClick={() => setEmployee(target)}>{t("Read health record", "صحت کا ریکارڈ دیکھیں")}</button>}
          {writable && !newCase && !decision && <button data-help="personnel.review.discipline" onClick={() => setNewCase(target)}>{t("Open case", "کیس کھولیں")}</button>}
        </p>;
      })}
    </>}
    {(newCase || decision) && <form className="card" onSubmit={submit}>
      <h2>{newCase?.label ?? decision?.case_number}</h2>
      {decision && <p>{decision.allegation}</p>}
      <fieldset disabled={!writable}>
        <Field label={t("Date", "تاریخ")}><input type="date" name="date" data-help="personnel.review.discipline" required /></Field>
        {newCase ? <Field label={t("Allegation", "الزام")}><textarea name="allegation" data-help="personnel.review.discipline" required /></Field> : <>
          <Field label={t("Outcome", "نتیجہ")}><select data-help="personnel.review.discipline" value={outcome}
            onChange={e => setOutcome(e.target.value as typeof outcome)}>
            <option value="Decided">{t("Decide", "فیصلہ")}</option><option value="Dropped">{t("Drop case", "کیس ختم کریں")}</option>
          </select></Field>
          {outcome === "Decided" && <>
            <Field label={t("Action", "کارروائی")}><select data-help="personnel.review.discipline" name="action">
              {Object.entries(disciplinaryActions).map(([code, ur]) => <option key={code} value={code}>{t(code, ur)}</option>)}
            </select></Field>
            <Field label={t("Employee response", "ملازم کا جواب")}><textarea name="response" data-help="personnel.review.discipline" /></Field>
          </>}
          <Field label={t("Reasons", "وجوہات")}><textarea name="note" data-help="personnel.review.discipline" required /></Field>
        </>}
        <label><input type="checkbox" data-help="personnel.review.discipline" required /> {t("I checked the employee and this entry.", "میں نے ملازم اور اس اندراج کی تصدیق کی ہے۔")}</label>
        <button data-help="personnel.review.discipline">{t("Confirm submission", "ارسال کی تصدیق")}</button>
        <button type="button" data-help="personnel.review.discipline" onClick={() => { setNewCase(undefined); setDecision(undefined); }}>{t("Cancel", "منسوخ کریں")}</button>
      </fieldset>
    </form>}
    <ClinicalWriteFeedback write={write} />
    {mayDiscipline && <>
      <LoadState {...cases} retry={cases.reload} />
      {!cases.loading && !cases.error && <ReportTable title={t("Confidential disciplinary register", "خفیہ تادیبی رجسٹر")}
        columns={[t("Case", "کیس"), t("Employee", "ملازم"), t("Date", "تاریخ"), t("Status", "حالت")]}
        rows={(cases.data ?? []).map(row => ({ key: row.case_id,
          cells: [writable && !newCase && !decision && row.status === "Open"
            ? <button data-help="personnel.review.discipline" onClick={() => { setOutcome("Decided"); setDecision(row); }}>{row.case_number}</button>
            : row.case_number, <bdi>{row.emp_number} · {row.full_name}</bdi>, row.occurred_on, row.status] }))} />}
    </>}
    {mayHealth && <>
      <LoadState {...due} retry={due.reload} />
      {!due.loading && !due.error && <ReportTable title={t("Staff health due", "عملے کی مقررہ صحت جانچ")}
        columns={[t("Employee", "ملازم"), t("Next due", "اگلی تاریخ"), t("Missing", "باقی")]}
        rows={(due.data ?? []).map(row => ({ key: row.employee_id, cells: [
          <button disabled={!!healthEntry} data-help="personnel.review.health" onClick={() => setEmployee({ id: row.employee_id, label: row.emp_number + " · " + row.full_name })}>{row.emp_number} · {row.full_name}</button>,
          row.next_due ?? "—", row.missing.join(", "),
        ] }))} />}
      {employee && <LoadState {...history} retry={history.reload} />}
      {employee && !history.loading && !history.error && history.data?.id === employee.id && <>
        <ReportTable title={employee.label}
        columns={[t("Health entry", "صحت کا اندراج"), t("Date", "تاریخ"), t("Next due", "اگلی تاریخ")]}
        rows={history.data.rows.map(row => ({ key: row.record_id, cells: [row.kind, row.done_on, row.next_due ?? "—"] }))} />
        {connected && !write.blocked && !healthEntry && !newCase && !decision &&
          <button data-help="personnel.review.health" onClick={() => setHealthEntry(employee)}>{t("Add health entry", "صحت کا اندراج شامل کریں")}</button>}
      </>}
      {healthEntry && <HealthEntry employee={healthEntry} disabled={!connected || write.blocked}
        onCancel={() => setHealthEntry(undefined)} onSubmit={body => write.start({
          method: "POST", permission: "personnel.health.manage", protection: "idempotent",
          path: `/personnel/employees/${healthEntry.id}/health`, body,
          label: t("Save health entry", "صحت کا اندراج محفوظ کریں"),
        })} />}
    </>}
  </section>;
}

function PersonnelFiles({ screenId, user, revision, connected }: Props) {
  const [incomplete, setIncomplete] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [credential, setCredential] = useState<files.CredentialOut>();
  const [verification, setVerification] = useState<files.CredentialVerifyIn["outcome"]>("Verified");
  const mayOpen = user.permissions.includes("personnel.view");
  const summary = useLoad(() => files.completeness({ incomplete_only: incomplete || undefined }), [incomplete, revision]);
  const detail = useLoad(() => mayOpen && selected ? files.personnelFile(selected) : Promise.resolve(undefined), [mayOpen, selected, revision]);
  const file = !detail.loading && !detail.error && detail.data?.employee_id === selected ? detail.data : undefined;
  const mayVerify = screenId === "personnel_files_hr" && user.permissions.includes("personnel.manage");
  const write = useClinicalWrite(user, screenId, async () => {
    setCredential(undefined);
    await Promise.all([detail.reload(), summary.reload()]);
  });
  const currentCredential = file?.credentials.find(row => row.qualification_id === credential?.qualification_id &&
    row.row_version === credential?.row_version && row.employee_id === selected);
  const maySubmit = connected && mayVerify && !write.blocked && !!currentCredential;

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!maySubmit || !currentCredential) return;
    const data = new FormData(event.currentTarget);
    const verified_on = formText(data, "date");
    const verified_with = formText(data, "source");
    if (!verified_on || (verification !== "NotRequired" && !verified_with)) return;
    const body: files.CredentialVerifyIn = {
      outcome: verification, verified_on, verified_with: verified_with || undefined,
      verification_ref: formText(data, "reference") || undefined,
    };
    write.start({ method: "POST", path: `/personnel/qualifications/${currentCredential.qualification_id}/verify`,
      body, permission: "personnel.manage", protection: "reconcile",
      reconcilePath: `/personnel/employees/${currentCredential.employee_id}/file`,
      label: t("Record credential verification", "اسناد کی تصدیق درج کریں") });
  }

  return <section data-screen={screenId} data-unsaved={!!credential} data-write-pending={write.blocked}>
    <h1>{screenId === "personnel_files_owner" ? t("Personnel files (MSDS HRM)", "عملے کی فائلیں (ایم ایس ڈی ایس)") : t("Personnel files", "عملے کی فائلیں")}</h1>
    {summary.data && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
      <div className="card">
        <h3>{t("Files complete", "فائلیں مکمل")}</h3>
        <p style={{ fontSize: "1.4em", fontWeight: "bold" }}>
          {summary.data.complete_pct !== null ? `${summary.data.complete_pct}%` : "—"}
        </p>
        <small>{summary.data.complete} / {summary.data.staff}</small>
      </div>
      <div className="card">
        <h3>{t("Oriented staff (HRM 131)", "تعارف یافتہ عملہ")}</h3>
        <p style={{ fontSize: "1.4em", fontWeight: "bold" }}>
          {summary.data.orientation.oriented_pct !== null ? `${summary.data.orientation.oriented_pct}%` : "—"}
        </p>
        <small>{t("Target ≥80%", "ہدف ≥80%")}</small>
      </div>
      <div className="card">
        <h3>{t("Patient rights (HRM 133)", "مریض کے حقوق")}</h3>
        <p style={{ fontSize: "1.4em", fontWeight: "bold" }}>
          {summary.data.orientation.patient_rights_pct !== null ? `${summary.data.orientation.patient_rights_pct}%` : "—"}
        </p>
      </div>
      <div className="card">
        <h3>{t("Orientation overdue", "تعارف میں تاخیر")}</h3>
        <p style={{ fontSize: "1.4em", fontWeight: "bold", color: summary.data.orientation.overdue > 0 ? "var(--color-danger, #d32f2f)" : undefined }}>
          {summary.data.orientation.overdue}
        </p>
      </div>
    </div>}
    <label><input type="checkbox" data-help="personnel.review.files" checked={incomplete} disabled={!!credential || write.blocked} onChange={e => { setSelected(undefined); setIncomplete(e.target.checked); }} />
      {t("Incomplete files only", "صرف نامکمل فائلیں")}
    </label>
    <LoadState {...summary} retry={summary.reload} />
    {!summary.loading && !summary.error && summary.data && <ReportTable title={t("File completeness", "فائل کی تکمیل")}
      columns={[t("Employee", "ملازم"), t("Designation", "عہدہ"), t("Missing", "باقی")]}
      rows={summary.data.rows.map(row => ({ key: row.employee_id, cells: [
        mayOpen ? <button data-help="personnel.review.files" disabled={!!credential || write.blocked} onClick={() => setSelected(row.employee_id)}>{row.emp_number} · {row.full_name}</button>
          : <bdi>{row.emp_number} · {row.full_name}</bdi>,
        row.designation,
        row.missing.length > 0 ? row.missing.map(m => <span key={m} style={{ display: "inline-block", margin: "2px", padding: "1px 6px", background: "#f0f2f5", borderRadius: "3px", fontSize: "0.85em" }}>{m}</span>) : t("None (Complete)", "کوئی نہیں (مکمل)"),
      ] }))} />}
    {selected && <LoadState {...detail} retry={detail.reload} />}
    {file && <article className="card">
      <h2>{file.emp_number} · {file.full_name}</h2>
      <p>{file.designation} · {file.department_name} · {file.employment_status}</p>
      <p>{t("Missing", "باقی")} · {file.missing.join(", ") || "—"}</p>
      <p>{t("Documents", "دستاویزات")} · {file.documents.length}</p>
      <ReportTable title={t("Credentials", "اسناد")}
        columns={[t("Credential", "سند"), t("Expiry", "میعاد"), t("Verification", "تصدیق")]}
        rows={file.credentials.map(row => ({key:row.qualification_id,cells:[
          row.title, row.license_expiry ?? "—", <>{row.verification_status}{" "}
            {mayVerify && <button type="button" data-help="personnel.review.credential" disabled={!connected || !!credential || write.blocked}
              onClick={() => { setCredential(row); setVerification("Verified"); }}>{t("Record verification", "تصدیق درج کریں")}</button>}
          </>,
        ]}))} />
      <QualityPaper disabled={!connected} documents={[{ path: `/personnel/employees/${file.employee_id}/file/pdf`, label: t("personnel file PDF", "ملازم کی فائل کی پی ڈی ایف") }]} />
    </article>}
    {credential && <form className="card" onSubmit={verify}>
      <h2>{credential.emp_number} · {credential.full_name} · {credential.title}</h2>
      {!detail.loading && !currentCredential && <p role="alert">{t("The credential changed. Close this form and reopen the current record.", "سند بدل گئی ہے۔ فارم بند کر کے تازہ ریکارڈ کھولیں۔")}</p>}
      <fieldset disabled={!maySubmit}>
        <Field label={t("Outcome", "نتیجہ")}><select data-help="personnel.review.credential" value={verification}
          onChange={e => setVerification(e.target.value as typeof verification)}>
          <option value="Verified">{t("Verified", "تصدیق شدہ")}</option>
          <option value="Failed">{t("Verification failed", "تصدیق ناکام")}</option>
          <option value="NotRequired">{t("Verification not required", "تصدیق ضروری نہیں")}</option>
        </select></Field>
        <Field label={t("Verified on", "تصدیق کی تاریخ")}><input data-help="personnel.review.credential" type="date" name="date" required /></Field>
        <Field label={t("Primary source", "بنیادی ماخذ")}><input data-help="personnel.review.credential" name="source" required={verification !== "NotRequired"} /></Field>
        <Field label={t("Verification reference", "تصدیقی حوالہ")}><input data-help="personnel.review.credential" name="reference" /></Field>
        <label><input data-help="personnel.review.credential" type="checkbox" required /> {t("I checked this employee and credential.", "میں نے ملازم اور سند کی تصدیق کی ہے۔")}</label>
        <button data-help="personnel.review.credential">{t("Save verification", "تصدیق محفوظ کریں")}</button>
      </fieldset>
      <button type="button" data-help="personnel.review.credential" disabled={write.blocked} onClick={() => setCredential(undefined)}>{t("Cancel", "منسوخ کریں")}</button>
    </form>}
    <ClinicalWriteFeedback write={write} />
  </section>;
}
