import { useState, type FormEvent } from "react";
import { ErrorBox, Field, LoadState, useLoad } from "../components";
import { bilingual as t } from "../i18n";
import * as orientation from "../generated/orientation_job_descriptions";
import * as training from "../generated/staff_training_hr";
import { QualityHeading } from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";
import { ReportTable } from "./P9cShared";

const categories: Record<training.TrainingSessionIn["category"], string> = {
  Clinical: "طبی", Safety: "حفاظت", Emergency: "ہنگامی", InfectionControl: "انفیکشن کنٹرول",
  PatientRights: "مریض کے حقوق", Quality: "معیار", Medication: "ادویات", Equipment: "آلات",
  Management: "انتظام", Other: "دیگر",
};

export function HrPersonnel({ screenId, revision, onOpenHelp, canManage = false, canRecordSession = false, connected }: {
  screenId: "orientation_job_descriptions" | "staff_training_hr";
  revision: number;
  onOpenHelp: () => void;
  canManage?: boolean;
  canRecordSession?: boolean;
  connected: boolean;
}) {
  const isOrientation = screenId === "orientation_job_descriptions";
  const [due, setDue] = useState(false);
  const [session, setSession] = useState<number>();
  const [employee, setEmployee] = useState<orientation.OrientationStatusOut>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [issued, setIssued] = useState<orientation.EmployeeJobDescriptionOut>();
  const [trainingMode, setTrainingMode] = useState<"individual" | "session">();
  const [staffSearch, setStaffSearch] = useState("");
  const directory = useLoad(() => trainingMode === "session" && staffSearch
    ? training.staffFacility({ q: staffSearch, limit: 50 }) : Promise.resolve([]), [trainingMode, staffSearch]);
  const requirements = useLoad(() => trainingMode ? training.trainingRequirements() : Promise.resolve([]), [trainingMode]);
  const topics = useLoad(() => employee ? orientation.orientationTopics({ active_only: true }) : Promise.resolve([]), [employee]);
  const staff = useLoad(() => isOrientation
    ? orientation.orientationStatus({ incomplete_only: due || undefined })
    : Promise.resolve([]), [isOrientation, due, revision]);
  const descriptions = useLoad(() => isOrientation ? orientation.listJds() : Promise.resolve([]), [isOrientation, revision]);
  const compliance = useLoad(() => isOrientation
    ? Promise.resolve([])
    : training.trainingCompliance({ overdue_only: due || undefined }), [isOrientation, due, revision]);
  const sessions = useLoad(() => isOrientation ? Promise.resolve([]) : training.listSessions(), [isOrientation, revision]);
  const detail = useLoad(() => session ? training.getSession(session) : Promise.resolve(undefined), [session, revision]);

  async function save(event: FormEvent<HTMLFormElement>, issue: boolean) {
    event.preventDefault();
    if (!employee || !canManage || !connected || saving) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const date = String(fields.get("date") ?? "");
    setError(undefined);
    setSaving(true);
    try {
      if (issue) {
        const jd = descriptions.data?.find(row => row.is_active && String(row.jd_id) === fields.get("jd"));
        if (!jd || descriptions.loading || descriptions.error) return;
        setIssued(await orientation.issueJd(employee.employee_id, { jd_id: jd.jd_id, issued_on: date }));
        await descriptions.reload();
      } else {
        const codes = topics.data?.filter(topic => fields.getAll("topics").includes(topic.code)).map(topic => topic.code);
        if (!codes?.length || topics.loading || topics.error) return;
        await orientation.recordOrientation(employee.employee_id, {
          topic_codes: codes, completed_on: date, employee_signed: fields.has("signed"),
        });
        await staff.reload();
      }
      form.reset();
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function saveTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trainingMode || !connected || saving) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const title = String(fields.get("title") ?? "").trim();
    const date = String(fields.get("date") ?? "");
    const category = fields.get("category") as training.TrainingSessionIn["category"];
    const requirement = requirements.data?.find(row => row.code === fields.get("requirement"));
    const hours = Number(fields.get("hours"));
    if (!title || !date || !Object.hasOwn(categories, category) || !Number.isFinite(hours) || hours <= 0) return;
    setError(undefined);
    setSaving(true);
    try {
      if (trainingMode === "individual" && canManage) {
        const row = compliance.data?.find(x => String(x.employee_id) === fields.get("employee"));
        if (!row || compliance.loading || compliance.error) return;
        await training.addTraining(row.employee_id, { title, category, completed_on: date, hours, requirement_code: requirement?.code });
      } else if (trainingMode === "session" && canRecordSession) {
        const attendees = directory.data?.filter(x => fields.getAll("attendees").includes(String(x.employee_id)))
          .map(x => ({ employee_id: x.employee_id }));
        const trainer = String(fields.get("trainer") ?? "").trim();
        if (!attendees?.length || directory.loading || directory.error || !trainer) return;
        const saved = await training.addSession({ title, category, held_on: date, hours, trainer, attendees, requirement_code: requirement?.code });
        setSession(saved.session_id);
        await sessions.reload();
      }
      await compliance.reload();
      setTrainingMode(undefined);
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  return <section data-screen={screenId}>
    <QualityHeading
      title={isOrientation ? t("Orientation and job descriptions", "تعارفی تربیت اور ملازمت کی تفصیل") : t("Staff training", "عملے کی تربیت")}
      text={isOrientation ? t("Review orientation progress and job descriptions.", "تعارفی تربیت کی پیش رفت اور ملازمت کی تفصیلات دیکھیں۔") : t("Review training compliance and recorded sessions.", "تربیت کی تعمیل اور درج شدہ نشستیں دیکھیں۔")}
      onHelp={onOpenHelp}
    />
    <label><input type="checkbox" data-help="hr.personnel.filter" disabled={saving || !!trainingMode} checked={due} onChange={e => setDue(e.target.checked)} />
      {isOrientation ? t("Incomplete orientation only", "صرف نامکمل تعارفی تربیت") : t("Overdue training only", "صرف تاخیر شدہ تربیت")}
    </label>
    {isOrientation ? <>
      <LoadState {...staff} retry={staff.reload} />
      {!staff.loading && !staff.error && <ReportTable title={t("Orientation register", "تعارفی تربیت کا رجسٹر")}
        columns={[t("Employee", "ملازم"), t("Due date", "مقررہ تاریخ"), t("Topics completed", "مکمل موضوعات"), t("Missing topics", "باقی موضوعات")]}
        rows={(staff.data ?? []).map(x => ({ key: x.employee_id, cells: [
          canManage ? <button type="button" data-help="hr.personnel.employee" disabled={saving} onClick={() => {
            setEmployee(x); setIssued(undefined); setError(undefined);
          }}>{x.emp_number} · {x.full_name}</button> : <bdi>{x.emp_number} · {x.full_name}</bdi>,
          x.due_on ?? "—", x.done + "/" + x.topics, x.missing.join(", "),
        ] }))} />}
      <LoadState {...descriptions} retry={descriptions.reload} />
      {!descriptions.loading && !descriptions.error && <ReportTable title={t("Job descriptions", "ملازمت کی تفصیلات")}
        columns={[t("Title", "عنوان"), t("Purpose", "مقصد"), t("Responsibilities", "ذمہ داریاں"), t("Staff holding it", "متعلقہ عملہ")]}
        rows={(descriptions.data ?? []).map(x => ({ key: x.jd_id, cells: [x.title, x.purpose, x.responsibilities, x.holders] }))} />}
      {employee && canManage && <article className="card" key={employee.employee_id}>
        <h2>{employee.emp_number} · {employee.full_name}</h2>
        <ErrorBox error={error} />
        <LoadState {...topics} retry={topics.reload} />
        {!topics.loading && !topics.error && !!topics.data?.length && <form onSubmit={event => void save(event, false)}>
          <fieldset disabled={saving || !connected}>
            <legend>{t("Record orientation", "تعارفی تربیت درج کریں")}</legend>
            {topics.data.map(topic => <label key={topic.code}>
              <input data-help="hr.personnel.orientation" type="checkbox" name="topics" value={topic.code} /> {topic.title}
            </label>)}
            <Field label={t("Completed on", "تکمیل کی تاریخ")}><input data-help="hr.personnel.orientation" type="date" name="date" required /></Field>
            <label><input data-help="hr.personnel.orientation" type="checkbox" name="signed" /> {t("Employee signed the checklist", "ملازم نے فہرست پر دستخط کیے")}</label>
            <button data-help="hr.personnel.orientation">{t("Save orientation", "تعارفی تربیت محفوظ کریں")}</button>
          </fieldset>
        </form>}
        {!descriptions.loading && !descriptions.error && <form onSubmit={event => void save(event, true)}>
          <fieldset disabled={saving || !connected}>
            <legend>{t("Issue job description", "ملازمت کی تفصیل جاری کریں")}</legend>
            <Field label={t("Job description", "ملازمت کی تفصیل")}><select data-help="hr.personnel.issue" name="jd" required>
              <option value="">{t("Choose a job description", "ملازمت کی تفصیل منتخب کریں")}</option>
              {descriptions.data?.filter(row => row.is_active).map(row => <option key={row.jd_id} value={row.jd_id}>{row.title}</option>)}
            </select></Field>
            <Field label={t("Issued on", "اجرا کی تاریخ")}><input data-help="hr.personnel.issue" type="date" name="date" required /></Field>
            <button data-help="hr.personnel.issue">{t("Issue to employee", "ملازم کو جاری کریں")}</button>
          </fieldset>
        </form>}
        {issued && <div key={issued.assignment_id}>
          <p role="status">{t("Job description issued", "ملازمت کی تفصیل جاری ہو گئی")} · <bdi>{issued.full_name}</bdi></p>
          <QualityPaper disabled={!connected || saving} documents={[{
            label: t("issued job description PDF", "جاری شدہ ملازمت کی تفصیل کی پی ڈی ایف"),
            path: `/personnel/employee-job-descriptions/${issued.assignment_id}/pdf`,
          }]} />
        </div>}
      </article>}
    </> : <>
      {canManage && <button type="button" data-help="hr.personnel.training" disabled={saving} onClick={() => { setError(undefined); setTrainingMode("individual"); }}>{t("Record individual training", "انفرادی تربیت درج کریں")}</button>}
      {canRecordSession && <button type="button" data-help="hr.personnel.training" disabled={saving} onClick={() => { setError(undefined); setStaffSearch(""); setTrainingMode("session"); }}>{t("Record training session", "تربیتی نشست درج کریں")}</button>}
      {trainingMode && <form className="card" key={trainingMode} onSubmit={event => void saveTraining(event)}>
        <ErrorBox error={error} />
        <fieldset disabled={saving || !connected}>
          {trainingMode === "individual" ? <Field label={t("Employee", "ملازم")}><select name="employee" data-help="hr.personnel.training" required>
            <option value="">—</option>
            {[...new Map(compliance.data?.map(x => [x.employee_id, x])).values()].map(x =>
              <option key={x.employee_id} value={x.employee_id}>{x.emp_number} · {x.full_name}</option>)}
          </select></Field> : <>
            <Field label={t("Find staff by name or number", "نام یا نمبر سے عملہ تلاش کریں")}><input data-help="hr.personnel.training"
              onBlur={e => setStaffSearch(e.target.value.trim())} /></Field>
            <LoadState {...directory} retry={directory.reload} />
            {!directory.loading && !directory.error && directory.data?.map(x => <label key={x.employee_id}>
              <input type="checkbox" data-help="hr.personnel.training" name="attendees" value={x.employee_id} /> {x.emp_number} · {x.full_name}
            </label>)}
            <Field label={t("Trainer", "تربیت دینے والا")}><input name="trainer" data-help="hr.personnel.training" required /></Field>
          </>}
          <Field label={t("Title", "عنوان")}><input name="title" data-help="hr.personnel.training" required /></Field>
          <Field label={t("Date", "تاریخ")}><input type="date" name="date" data-help="hr.personnel.training" required /></Field>
          <Field label={t("Hours", "گھنٹے")}><input type="number" min="0.01" step="0.01" name="hours" data-help="hr.personnel.training" required /></Field>
          <Field label={t("Category", "زمرہ")}><select name="category" data-help="hr.personnel.training">
            {Object.entries(categories).map(([key, ur]) => <option key={key} value={key}>{t(key, ur)}</option>)}
          </select></Field>
          <LoadState {...requirements} retry={requirements.reload} />
          <Field label={t("Training requirement", "تربیت کی ضرورت")}><select name="requirement" data-help="hr.personnel.training" disabled={requirements.loading || !!requirements.error}>
            <option value="">—</option>
            {requirements.data?.map(row => <option key={row.code} value={row.code}>{row.title}</option>)}
          </select></Field>
          <button data-help="hr.personnel.training">{t("Save training", "تربیت محفوظ کریں")}</button>
          <button type="button" data-help="hr.personnel.training" onClick={() => setTrainingMode(undefined)}>{t("Cancel", "منسوخ کریں")}</button>
        </fieldset>
      </form>}
      <LoadState {...compliance} retry={compliance.reload} />
      {!compliance.loading && !compliance.error && <ReportTable title={t("Training compliance", "تربیت کی تعمیل")}
        columns={[t("Employee", "ملازم"), t("Requirement", "ضرورت"), t("Next due", "اگلی مقررہ تاریخ"), t("Status", "حالت")]}
        rows={(compliance.data ?? []).map(x => ({ key: x.employee_id + ":" + x.requirement_code,
          cells: [<bdi>{x.emp_number} · {x.full_name}</bdi>, x.requirement_title, x.next_due ?? "—", x.state] }))} />}
      <LoadState {...sessions} retry={sessions.reload} />
      {!sessions.loading && !sessions.error && <ReportTable title={t("Training sessions", "تربیتی نشستیں")}
        columns={[t("Session", "نشست"), t("Date", "تاریخ"), t("Attendees", "شرکاء")]}
        rows={(sessions.data ?? []).map(x => ({ key: x.session_id, cells: [
          <button data-help="hr.personnel.session" onClick={() => setSession(x.session_id)}>{x.session_number} · {x.title}</button>,
          x.held_on, x.attendee_count,
        ] }))} />}
      {session && <LoadState {...detail} retry={detail.reload} />}
      {!detail.loading && !detail.error && detail.data?.session_id === session && detail.data && <article className="card">
        <h2>{detail.data.title}</h2>
        <p>{detail.data.held_on} · {detail.data.trainer}</p>
        <p>{detail.data.note}</p>
      </article>}
    </>}
  </section>;
}
