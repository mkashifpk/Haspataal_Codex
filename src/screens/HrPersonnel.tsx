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

const staffCategories = [
  "Clinical", "Nursing", "Administrative", "Technical", "SupportZeroInterface", "Visiting",
] as const;

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
  const [editingSession, setEditingSession] = useState(false);
  const [employee, setEmployee] = useState<orientation.OrientationStatusOut>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [issued, setIssued] = useState<orientation.EmployeeJobDescriptionOut>();
  const [trainingMode, setTrainingMode] = useState<"individual" | "session" | "requirement">();
  const [editingReq, setEditingReq] = useState<training.TrainingRequirementOut>();
  const [jdMode, setJdMode] = useState<"create" | "edit">();
  const [editingJd, setEditingJd] = useState<orientation.JobDescriptionOut>();
  const [editingTopic, setEditingTopic] = useState<orientation.OrientationTopicOut>();
  const [staffSearch, setStaffSearch] = useState("");
  const [inchargeSearch, setInchargeSearch] = useState("");
  const [selectedIncharge, setSelectedIncharge] = useState<orientation.StaffLookupOut>();
  const [selectedIndividualEmp, setSelectedIndividualEmp] = useState<number>();

  const directory = useLoad(() => trainingMode === "session" && staffSearch
    ? training.staffFacility({ q: staffSearch, limit: 50 }) : Promise.resolve([]), [trainingMode, staffSearch]);
  const inchargeLookup = useLoad(() => isOrientation && inchargeSearch
    ? orientation.lookupStaff({ q: inchargeSearch, limit: 20 }) : Promise.resolve([]), [isOrientation, inchargeSearch]);
  const requirements = useLoad(() => trainingMode || !isOrientation
    ? training.trainingRequirements() : Promise.resolve([]), [trainingMode, isOrientation, revision]);
  const topics = useLoad(() => isOrientation
    ? orientation.orientationTopics({ active_only: !canManage ? true : undefined }) : Promise.resolve([]), [isOrientation, canManage, revision]);
  const depts = useLoad(() => isOrientation
    ? orientation.departments() : training.departments(), [isOrientation, revision]);
  const staff = useLoad(() => isOrientation
    ? orientation.orientationStatus({ incomplete_only: due || undefined })
    : Promise.resolve([]), [isOrientation, due, revision]);
  const descriptions = useLoad(() => isOrientation ? orientation.listJds() : Promise.resolve([]), [isOrientation, revision]);
  const compliance = useLoad(() => isOrientation
    ? Promise.resolve([])
    : training.trainingCompliance({ overdue_only: due || undefined }), [isOrientation, due, revision]);
  const sessions = useLoad(() => isOrientation ? Promise.resolve([]) : training.listSessions(), [isOrientation, revision]);
  const detail = useLoad(() => session ? training.getSession(session) : Promise.resolve(undefined), [session, revision]);
  const empAppraisals = useLoad(() => selectedIndividualEmp
    ? training.listAppraisals({ employee_id: selectedIndividualEmp }) : Promise.resolve([]), [selectedIndividualEmp]);

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

  async function saveSignatures(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issued || !canManage || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const empDate = String(form.get("employee_signed_on") ?? "");
    const inchargeDate = String(form.get("incharge_signed_on") ?? "");
    const inchargeUserId = selectedIncharge?.user_id ?? Number(form.get("incharge_user_id"));
    if (!empDate || !inchargeDate || !inchargeUserId) return;
    setError(undefined);
    setSaving(true);
    try {
      const updated = await orientation.signJd(issued.assignment_id, {
        employee_signed_on: empDate,
        incharge_user_id: inchargeUserId,
        incharge_signed_on: inchargeDate,
      });
      setIssued(updated);
      setSelectedIncharge(undefined);
      setInchargeSearch("");
      await Promise.all([staff.reload(), descriptions.reload()]);
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function saveJd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "").trim();
    const responsibilities = String(form.get("responsibilities") ?? "").trim();
    const appraisal_criteria = String(form.get("appraisal_criteria") ?? "").trim();
    const deptId = form.get("department_id") ? Number(form.get("department_id")) : null;
    const reportsTo = String(form.get("reports_to") ?? "").trim() || null;
    const qualifications = String(form.get("qualifications") ?? "").trim() || null;
    const isActive = form.has("is_active");
    if (!title || !purpose || !responsibilities || !appraisal_criteria) return;
    setError(undefined);
    setSaving(true);
    try {
      if (jdMode === "create") {
        await orientation.addJd({
          title, purpose, responsibilities, appraisal_criteria,
          department_id: deptId, reports_to: reportsTo, qualifications, is_active: isActive,
        });
      } else if (jdMode === "edit" && editingJd) {
        await orientation.updateJd(editingJd.jd_id, {
          title, purpose, responsibilities, appraisal_criteria,
          department_id: deptId, reports_to: reportsTo, qualifications, is_active: isActive,
          expected_version: editingJd.row_version,
        });
      }
      setJdMode(undefined);
      setEditingJd(undefined);
      await descriptions.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function saveTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTopic || !canManage || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim() || null;
    const sortOrder = Number(form.get("sort_order") || "0");
    const isActive = form.has("is_active");
    if (!title) return;
    setError(undefined);
    setSaving(true);
    try {
      await orientation.updateTopic(editingTopic.code, {
        title, description, sort_order: sortOrder, is_active: isActive,
      });
      setEditingTopic(undefined);
      await topics.reload();
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
        const empId = Number(fields.get("employee"));
        const appraisalId = fields.get("appraisal_id") ? Number(fields.get("appraisal_id")) : undefined;
        const provider = String(fields.get("provider") ?? "").trim() || undefined;
        const certificateNo = String(fields.get("certificate_no") ?? "").trim() || undefined;
        const validUntil = String(fields.get("valid_until") ?? "") || undefined;
        if (!empId) return;
        await training.addTraining(empId, {
          title, category, completed_on: date, hours,
          requirement_code: requirement?.code,
          appraisal_id: appraisalId,
          provider, certificate_no: certificateNo, valid_until: validUntil,
        });
      } else if (trainingMode === "session" && canRecordSession) {
        const attendeeIds = fields.getAll("attendees").map(Number);
        const attendees: training.AttendeeIn[] = attendeeIds.map(id => ({
          employee_id: id,
          passed: fields.has(`passed_${id}`) ? true : undefined,
        }));
        const trainer = String(fields.get("trainer") ?? "").trim();
        const venue = String(fields.get("venue") ?? "").trim() || undefined;
        const deptId = fields.get("department_id") ? Number(fields.get("department_id")) : undefined;
        const note = String(fields.get("note") ?? "").trim() || undefined;
        if (!attendees.length || !trainer) return;
        const saved = await training.addSession({
          title, category, held_on: date, hours, trainer, venue,
          department_id: deptId, attendees, note, requirement_code: requirement?.code,
        });
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

  async function saveSessionUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail.data || !canRecordSession || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const date = String(form.get("date") ?? "");
    const category = form.get("category") as training.TrainingSessionIn["category"];
    const hours = Number(form.get("hours"));
    const trainer = String(form.get("trainer") ?? "").trim();
    const venue = String(form.get("venue") ?? "").trim() || undefined;
    const deptId = form.get("department_id") ? Number(form.get("department_id")) : undefined;
    const reqCode = String(form.get("requirement") ?? "").trim() || undefined;
    const note = String(form.get("note") ?? "").trim() || undefined;
    const reason = String(form.get("reason") ?? "").trim();
    if (!title || !date || !trainer || !reason || !hours) return;
    const attendees: training.AttendeeIn[] = detail.data.attendees.map(a => ({
      employee_id: a.employee_id,
      passed: form.has(`passed_${a.employee_id}`),
    }));
    setError(undefined);
    setSaving(true);
    try {
      await training.updateSession(detail.data.session_id, {
        title, held_on: date, category, hours, trainer, venue,
        department_id: deptId, requirement_code: reqCode, note, reason,
        attendees, expected_version: detail.data.row_version,
      });
      setEditingSession(false);
      await Promise.all([detail.reload(), sessions.reload(), compliance.reload()]);
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function saveRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingReq || !canManage || !connected || saving) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const standard = String(form.get("standard") ?? "").trim() || null;
    const months = form.get("every_months") ? Number(form.get("every_months")) : null;
    const isActive = form.has("is_active");
    const appliesTo = form.getAll("applies_to") as ("Clinical" | "Nursing" | "Administrative" | "Technical" | "SupportZeroInterface" | "Visiting")[];
    if (!title || !appliesTo.length) return;
    setError(undefined);
    setSaving(true);
    try {
      await training.updateRequirement(editingReq.code, {
        title, standard, every_months: months, is_active: isActive, applies_to: appliesTo,
      });
      setEditingReq(undefined);
      await requirements.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  // Sort compliance grid: Never and Overdue first (rule:b48295c6aa)
  const statePriority: Record<string, number> = { Never: 0, Overdue: 1, Current: 2 };
  const sortedCompliance = [...(compliance.data ?? [])].sort(
    (a, b) => (statePriority[a.state] ?? 3) - (statePriority[b.state] ?? 3)
  );

  return <section data-screen={screenId}>
    <QualityHeading
      title={isOrientation ? t("Orientation and job descriptions", "تعارفی تربیت اور ملازمت کی تفصیل") : t("Staff training", "عملے کی تربیت")}
      text={isOrientation ? t("Review orientation progress and job descriptions.", "تعارفی تربیت کی پیش رفت اور ملازمت کی تفصیلات دیکھیں۔") : t("Review training compliance and recorded sessions.", "تربیت کی تعمیل اور درج شدہ نشستیں دیکھیں۔")}
      onHelp={onOpenHelp}
    />
    <label><input type="checkbox" data-help="hr.personnel.filter" disabled={saving || !!trainingMode} checked={due} onChange={e => setDue(e.target.checked)} />
      {isOrientation ? t("Incomplete orientation only", "صرف نامکمل تعارفی تربیت") : t("Overdue training only", "صرف تاخیر شدہ تربیت")}
    </label>
    <ErrorBox error={error} />
    {isOrientation ? <>
      <QualityPaper disabled={!connected} documents={[{
        path: "/personnel/appraisal-policy/pdf",
        label: t("appraisal policy PDF", "کارکردگی جائزے کی پالیسی پی ڈی ایف"),
      }]} />
      <LoadState {...staff} retry={staff.reload} />
      {!staff.loading && !staff.error && <ReportTable title={t("Orientation register", "تعارفی تربیت کا رجسٹر")}
        columns={[t("Employee", "ملازم"), t("Due date", "مقررہ تاریخ"), t("Topics completed", "مکمل موضوعات"), t("Missing topics", "باقی موضوعات")]}
        rows={(staff.data ?? []).map(x => ({ key: x.employee_id, cells: [
          canManage ? <button type="button" data-help="hr.personnel.employee" disabled={saving} onClick={() => {
            setEmployee(x); setIssued(undefined); setError(undefined);
          }}>{x.emp_number} · {x.full_name}</button> : <bdi>{x.emp_number} · {x.full_name}</bdi>,
          <span style={{ color: x.overdue ? "var(--color-danger, #d32f2f)" : undefined, fontWeight: x.overdue ? "bold" : "normal" }}>
            {x.due_on ?? "—"}{x.overdue ? ` (${t("Overdue", "تاخیر")})` : ""}
          </span>,
          x.done + "/" + x.topics, x.missing.join(", "),
        ] }))} />}

      <LoadState {...descriptions} retry={descriptions.reload} />
      {!descriptions.loading && !descriptions.error && <>
        <ReportTable title={t("Job descriptions", "ملازمت کی تفصیلات")}
          columns={[t("Title", "عنوان"), t("Department", "شعبہ"), t("Purpose", "مقصد"), t("Staff holding it", "متعلقہ عملہ"), t("Actions", "اقدامات")]}
          rows={(descriptions.data ?? []).map(x => ({ key: x.jd_id, cells: [
            x.title, x.department_name ?? "—", x.purpose, x.holders,
            canManage ? <button type="button" data-help="hr.personnel.issue" onClick={() => { setEditingJd(x); setJdMode("edit"); }}>{t("Edit", "ترمیم")}</button> : "—",
          ] }))} />
        {canManage && !jdMode && <button type="button" data-help="hr.personnel.issue" onClick={() => { setEditingJd(undefined); setJdMode("create"); }}>
          {t("Add job description", "نئی ملازمت کی تفصیل شامل کریں")}
        </button>}
      </>}

      {jdMode && <form className="card" onSubmit={saveJd}>
        <fieldset disabled={saving || !connected}>
          <legend>{jdMode === "create" ? t("New job description", "نئی ملازمت کی تفصیل") : t("Edit job description", "ملازمت کی تفصیل میں ترمیم")}</legend>
          <Field label={t("Title", "عنوان")}><input data-help="hr.personnel.issue" name="title" defaultValue={editingJd?.title ?? ""} required /></Field>
          <Field label={t("Department", "شعبہ")}><select data-help="hr.personnel.issue" name="department_id" defaultValue={editingJd?.department_id ?? ""}>
            <option value="">{t("None / Hospital-wide", "کوئی نہیں / ہسپتال گیر")}</option>
            {depts.data?.map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
          </select></Field>
          <Field label={t("Purpose", "مقصد")}><textarea data-help="hr.personnel.issue" name="purpose" defaultValue={editingJd?.purpose ?? ""} required /></Field>
          <Field label={t("Responsibilities", "ذمہ داریاں")}><textarea data-help="hr.personnel.issue" name="responsibilities" defaultValue={editingJd?.responsibilities ?? ""} required /></Field>
          <Field label={t("Appraisal criteria", "کارکردگی کا معیار")}><textarea data-help="hr.personnel.issue" name="appraisal_criteria" defaultValue={editingJd?.appraisal_criteria ?? ""} required /></Field>
          <Field label={t("Reports to", "رپورٹ برائے")}><input data-help="hr.personnel.issue" name="reports_to" defaultValue={editingJd?.reports_to ?? ""} /></Field>
          <Field label={t("Qualifications", "قابلیت")}><input data-help="hr.personnel.issue" name="qualifications" defaultValue={editingJd?.qualifications ?? ""} /></Field>
          <label><input data-help="hr.personnel.issue" type="checkbox" name="is_active" defaultChecked={editingJd?.is_active ?? true} /> {t("Active", "فعال")}</label>
          <button data-help="hr.personnel.issue">{t("Save job description", "ملازمت کی تفصیل محفوظ کریں")}</button>
          <button type="button" data-help="hr.personnel.issue" onClick={() => { setJdMode(undefined); setEditingJd(undefined); }}>{t("Cancel", "منسوخ کریں")}</button>
        </fieldset>
      </form>}

      {canManage && editingTopic && <form className="card" onSubmit={saveTopic}>
        <fieldset disabled={saving || !connected}>
          <legend>{t("Edit orientation topic", "تعارفی تربیت کے موضوع میں ترمیم")} · {editingTopic.code}</legend>
          <Field label={t("Title", "عنوان")}><input data-help="hr.personnel.orientation" name="title" defaultValue={editingTopic.title} required /></Field>
          <Field label={t("Description", "تفصیل")}><textarea data-help="hr.personnel.orientation" name="description" defaultValue={editingTopic.description ?? ""} /></Field>
          <Field label={t("Sort order", "ترتیب")}><input data-help="hr.personnel.orientation" type="number" name="sort_order" defaultValue={editingTopic.sort_order} /></Field>
          <label><input data-help="hr.personnel.orientation" type="checkbox" name="is_active" defaultChecked={editingTopic.is_active} /> {t("Active", "فعال")}</label>
          <button data-help="hr.personnel.orientation">{t("Save topic", "موضوع محفوظ کریں")}</button>
          <button type="button" data-help="hr.personnel.orientation" onClick={() => setEditingTopic(undefined)}>{t("Cancel", "منسوخ کریں")}</button>
        </fieldset>
      </form>}

      {employee && canManage && <article className="card" key={employee.employee_id}>
        <h2>{employee.emp_number} · {employee.full_name}</h2>
        <LoadState {...topics} retry={topics.reload} />
        {!topics.loading && !topics.error && !!topics.data?.length && <form onSubmit={event => void save(event, false)}>
          <fieldset disabled={saving || !connected}>
            <legend>{t("Record orientation", "تعارفی تربیت درج کریں")}</legend>
            {(["Hospital", "Department", "Job"] as const).map(part => {
              const partTopics = topics.data?.filter(top => top.part === part) ?? [];
              if (!partTopics.length) return null;
              return <fieldset key={part}>
                <legend>{part === "Hospital" ? t("Hospital orientation", "ہسپتال کا تعارف") : part === "Department" ? t("Department orientation", "شعبے کا تعارف") : t("Job orientation", "ملازمت کا تعارف")}</legend>
                {partTopics.map(topic => <div key={topic.code}>
                  <label>
                    <input data-help="hr.personnel.orientation" type="checkbox" name="topics" value={topic.code} /> {topic.title}
                  </label>
                  {canManage && <button type="button" style={{ marginLeft: "8px", fontSize: "0.8em" }} data-help="hr.personnel.orientation" onClick={() => setEditingTopic(topic)}>{t("Edit topic", "موضوع میں ترمیم")}</button>}
                </div>)}
              </fieldset>;
            })}
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
          <p role="status">{t("Job description issued", "ملازمت کی تفصیل جاری ہو گئی")} · <bdi>{issued.full_name}</bdi> ({issued.status})</p>
          <QualityPaper disabled={!connected || saving} documents={[{
            label: t("issued job description PDF", "جاری شدہ ملازمت کی تفصیل کی پی ڈی ایف"),
            path: `/personnel/employee-job-descriptions/${issued.assignment_id}/pdf`,
          }]} />

          {issued.status !== "Signed" && canManage && <form onSubmit={saveSignatures} className="card">
            <fieldset disabled={saving || !connected}>
              <legend>{t("Record signatures", "دستخط درج کریں")}</legend>
              <Field label={t("Employee signed on", "ملازم کے دستخط کی تاریخ")}>
                <input data-help="hr.personnel.issue" type="date" name="employee_signed_on" required defaultValue={issued.issued_on} />
              </Field>
              <Field label={t("Find in-charge (PMDC/PNC/Name)", "انچارج تلاش کریں")}>
                <input data-help="hr.personnel.issue" value={inchargeSearch} onChange={e => setInchargeSearch(e.target.value)} placeholder={t("Type name or number...", "نام یا نمبر لکھیں...")} />
              </Field>
              <LoadState {...inchargeLookup} retry={inchargeLookup.reload} />
              {!inchargeLookup.loading && !inchargeLookup.error && inchargeLookup.data && inchargeLookup.data.length > 0 && <div>
                <p>{t("Select in-charge:", "انچارج منتخب کریں:")}</p>
                {inchargeLookup.data.filter(u => u.user_id).map(user => (
                  <button key={user.employee_id} type="button" data-help="hr.personnel.issue" onClick={() => setSelectedIncharge(user)} style={{ fontWeight: selectedIncharge?.user_id === user.user_id ? "bold" : "normal" }}>
                    {user.full_name} ({user.designation})
                  </button>
                ))}
              </div>}
              {selectedIncharge && <p>{t("Selected in-charge:", "منتخب انچارج:")} <strong>{selectedIncharge.full_name}</strong></p>}
              <Field label={t("In-charge signed on", "انچارج کے دستخط کی تاریخ")}>
                <input data-help="hr.personnel.issue" type="date" name="incharge_signed_on" required defaultValue={issued.issued_on} />
              </Field>
              <button data-help="hr.personnel.issue" disabled={!selectedIncharge}>{t("Save signatures", "دستخط محفوظ کریں")}</button>
            </fieldset>
          </form>}
        </div>}
      </article>}
    </> : <>
      <div className="toolbar">
        {canManage && <button type="button" data-help="hr.personnel.training" disabled={saving} onClick={() => { setError(undefined); setTrainingMode("individual"); }}>{t("Record individual training", "انفرادی تربیت درج کریں")}</button>}
        {canRecordSession && <button type="button" data-help="hr.personnel.training" disabled={saving} onClick={() => { setError(undefined); setStaffSearch(""); setTrainingMode("session"); }}>{t("Record training session", "تربیتی نشست درج کریں")}</button>}
        {canManage && <button type="button" data-help="hr.personnel.training" disabled={saving} onClick={() => { setError(undefined); setTrainingMode("requirement"); }}>{t("Manage requirements", "تربیت کی شرائط کا انتظام")}</button>}
      </div>

      {trainingMode === "requirement" && <article className="card">
        <h2>{t("Training requirements", "تربیت کی شرائط")}</h2>
        <LoadState {...requirements} retry={requirements.reload} />
        {!requirements.loading && !requirements.error && <ReportTable title={t("Mandatory requirements", "لازمی شرائط")}
          columns={[t("Code", "کوڈ"), t("Title", "عنوان"), t("Interval (Months)", "وقفہ (مہینے)"), t("Applies to", "اطلاق"), t("Action", "کارروائی")]}
          rows={(requirements.data ?? []).map(r => ({ key: r.code, cells: [
            r.code, r.title, r.every_months ?? t("Once", "ایک بار"), r.applies_to.join(", "),
            canManage ? <button type="button" data-help="hr.personnel.training" onClick={() => setEditingReq(r)}>{t("Edit", "ترمیم")}</button> : "—",
          ] }))} />}

        {editingReq && <form className="card" onSubmit={saveRequirement}>
          <fieldset disabled={saving || !connected}>
            <legend>{t("Edit requirement", "شرط میں ترمیم")} · {editingReq.code}</legend>
            <Field label={t("Title", "عنوان")}><input data-help="hr.personnel.training" name="title" defaultValue={editingReq.title} required /></Field>
            <Field label={t("Standard", "معیار")}><input data-help="hr.personnel.training" name="standard" defaultValue={editingReq.standard ?? ""} /></Field>
            <Field label={t("Every (months)", "ہر (مہینے)")}><input data-help="hr.personnel.training" type="number" name="every_months" defaultValue={editingReq.every_months ?? ""} placeholder={t("Leave blank for once", "ایک بار کے لیے خالی چھوڑیں")} /></Field>
            <fieldset>
              <legend>{t("Applies to categories", "زمروں پر اطلاق")}</legend>
              {staffCategories.map(cat => <label key={cat}>
                <input data-help="hr.personnel.training" type="checkbox" name="applies_to" value={cat} defaultChecked={editingReq.applies_to.includes(cat)} /> {cat}
              </label>)}
            </fieldset>
            <label><input data-help="hr.personnel.training" type="checkbox" name="is_active" defaultChecked={editingReq.is_active} /> {t("Active", "فعال")}</label>
            <button data-help="hr.personnel.training">{t("Save requirement", "شرط محفوظ کریں")}</button>
            <button type="button" data-help="hr.personnel.training" onClick={() => setEditingReq(undefined)}>{t("Cancel", "منسوخ کریں")}</button>
          </fieldset>
        </form>}
      </article>}

      {trainingMode && trainingMode !== "requirement" && <form className="card" key={trainingMode} onSubmit={event => void saveTraining(event)}>
        <fieldset disabled={saving || !connected}>
          {trainingMode === "individual" ? <>
            <Field label={t("Employee", "ملازم")}><select name="employee" data-help="hr.personnel.training" required onChange={e => setSelectedIndividualEmp(Number(e.target.value) || undefined)}>
              <option value="">—</option>
              {[...new Map(compliance.data?.map(x => [x.employee_id, x])).values()].map(x =>
                <option key={x.employee_id} value={x.employee_id}>{x.emp_number} · {x.full_name}</option>)}
            </select></Field>
            {selectedIndividualEmp && <LoadState {...empAppraisals} retry={empAppraisals.reload} />}
            {selectedIndividualEmp && !empAppraisals.loading && empAppraisals.data && empAppraisals.data.length > 0 && <Field label={t("Requested by appraisal", "جائزے کی درخواست کے تحت")}>
              <select name="appraisal_id" data-help="hr.personnel.training">
                <option value="">{t("None / Independent", "کوئی نہیں / آزادانہ")}</option>
                {empAppraisals.data.map(a => <option key={a.appraisal_id} value={a.appraisal_id}>{a.appraisal_number} ({a.period_from} - {a.period_to})</option>)}
              </select>
            </Field>}
            <Field label={t("Provider / Institute", "ادارہ / فراہم کنندہ")}><input name="provider" data-help="hr.personnel.training" /></Field>
            <Field label={t("Certificate number", "سرٹیفکیٹ نمبر")}><input name="certificate_no" data-help="hr.personnel.training" /></Field>
            <Field label={t("Valid until", "میعاد تا")}><input type="date" name="valid_until" data-help="hr.personnel.training" /></Field>
          </> : <>
            <Field label={t("Find staff by name or number", "نام یا نمبر سے عملہ تلاش کریں")}><input data-help="hr.personnel.training"
              onBlur={e => setStaffSearch(e.target.value.trim())} /></Field>
            <LoadState {...directory} retry={directory.reload} />
            {!directory.loading && !directory.error && directory.data?.map(x => <div key={x.employee_id}>
              <label>
                <input type="checkbox" data-help="hr.personnel.training" name="attendees" value={x.employee_id} /> {x.emp_number} · {x.full_name}
              </label>
              <label style={{ marginLeft: "12px", fontSize: "0.85em" }}>
                <input type="checkbox" data-help="hr.personnel.training" name={`passed_${x.employee_id}`} /> {t("Passed assessment", "امتحان میں کامیاب")}
              </label>
            </div>)}
            <Field label={t("Trainer", "تربیت دینے والا")}><input name="trainer" data-help="hr.personnel.training" required /></Field>
            <Field label={t("Venue", "مقام")}><input name="venue" data-help="hr.personnel.training" /></Field>
            <Field label={t("Department", "شعبہ")}><select name="department_id" data-help="hr.personnel.training">
              <option value="">{t("Hospital-wide / None", "ہسپتال گیر / کوئی نہیں")}</option>
              {depts.data?.map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
            </select></Field>
            <Field label={t("Note", "نوٹ")}><textarea name="note" data-help="hr.personnel.training" /></Field>
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
        rows={sortedCompliance.map(x => ({ key: x.employee_id + ":" + x.requirement_code,
          cells: [
            <bdi>{x.emp_number} · {x.full_name}</bdi>,
            x.requirement_title,
            x.next_due ?? "—",
            <span style={{ color: x.state === "Overdue" || x.state === "Never" ? "var(--color-danger, #d32f2f)" : undefined, fontWeight: x.state === "Overdue" ? "bold" : "normal" }}>
              {x.state}
            </span>,
          ] }))} />}

      <LoadState {...sessions} retry={sessions.reload} />
      {!sessions.loading && !sessions.error && <ReportTable title={t("Training sessions", "تربیتی نشستیں")}
        columns={[t("Session", "نشست"), t("Date", "تاریخ"), t("Trainer", "تربیت کار"), t("Attendees", "شرکاء")]}
        rows={(sessions.data ?? []).map(x => ({ key: x.session_id, cells: [
          <button data-help="hr.personnel.session" onClick={() => { setSession(x.session_id); setEditingSession(false); }}>{x.session_number} · {x.title}</button>,
          x.held_on, x.trainer, x.attendee_count,
        ] }))} />}

      {session && <LoadState {...detail} retry={detail.reload} />}
      {!detail.loading && !detail.error && detail.data?.session_id === session && detail.data && <article className="card">
        <h2>{detail.data.title} ({detail.data.session_number})</h2>
        <p>{detail.data.held_on} · {detail.data.trainer} · {detail.data.hours} {t("hours", "گھنٹے")}</p>
        {detail.data.venue && <p>{t("Venue", "مقام")}: {detail.data.venue}</p>}
        {detail.data.department_name && <p>{t("Department", "شعبہ")}: {detail.data.department_name}</p>}
        {detail.data.note && <p>{detail.data.note}</p>}

        <h3>{t("Attendees", "شرکاء")} ({detail.data.attendees.length})</h3>
        <ul>
          {detail.data.attendees.map(a => (
            <li key={a.employee_id}>
              {a.emp_number} · {a.full_name} ({a.department_name ?? "—"}) — {a.passed ? t("Passed", "کامیاب") : t("Attended", "حاضر")}
            </li>
          ))}
        </ul>

        {canRecordSession && !editingSession && <button type="button" data-help="hr.personnel.session" onClick={() => setEditingSession(true)}>
          {t("Edit session", "نشست میں ترمیم")}
        </button>}

        {editingSession && <form className="card" onSubmit={saveSessionUpdate}>
          <fieldset disabled={saving || !connected}>
            <legend>{t("Edit session", "نشست میں ترمیم")} · {detail.data.session_number}</legend>
            <Field label={t("Title", "عنوان")}><input name="title" data-help="hr.personnel.training" defaultValue={detail.data.title} required /></Field>
            <Field label={t("Date", "تاریخ")}><input type="date" name="date" data-help="hr.personnel.training" defaultValue={detail.data.held_on} required /></Field>
            <Field label={t("Hours", "گھنٹے")}><input type="number" min="0.01" step="0.01" name="hours" data-help="hr.personnel.training" defaultValue={detail.data.hours} required /></Field>
            <Field label={t("Trainer", "تربیت کار")}><input name="trainer" data-help="hr.personnel.training" defaultValue={detail.data.trainer} required /></Field>
            <Field label={t("Venue", "مقام")}><input name="venue" data-help="hr.personnel.training" defaultValue={detail.data.venue ?? ""} /></Field>
            <Field label={t("Department", "شعبہ")}><select name="department_id" data-help="hr.personnel.training" defaultValue={detail.data.department_id ?? ""}>
              <option value="">{t("None / Hospital-wide", "کوئی نہیں / ہسپتال گیر")}</option>
              {depts.data?.map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
            </select></Field>
            <Field label={t("Category", "زمرہ")}><select name="category" data-help="hr.personnel.training" defaultValue={detail.data.category}>
              {Object.entries(categories).map(([k, ur]) => <option key={k} value={k}>{t(k, ur)}</option>)}
            </select></Field>
            <Field label={t("Requirement", "شرط")}><select name="requirement" data-help="hr.personnel.training" defaultValue={detail.data.requirement_code ?? ""}>
              <option value="">—</option>
              {requirements.data?.map(r => <option key={r.code} value={r.code}>{r.title}</option>)}
            </select></Field>
            <fieldset>
              <legend>{t("Attendee assessments", "شرکاء کے امتحانات")}</legend>
              {detail.data.attendees.map(a => <label key={a.employee_id} style={{ display: "block" }}>
                <input type="checkbox" data-help="hr.personnel.training" name={`passed_${a.employee_id}`} defaultChecked={!!a.passed} /> {a.emp_number} · {a.full_name} ({t("Passed", "کامیاب")})
              </label>)}
            </fieldset>
            <Field label={t("Note", "نوٹ")}><textarea name="note" data-help="hr.personnel.training" defaultValue={detail.data.note ?? ""} /></Field>
            <Field label={t("Reason for change", "تبدیلی کی وجہ")}><input name="reason" data-help="hr.personnel.training" required placeholder={t("Document why session record is updated", "نشست کی تبدیلی کی وجہ درج کریں")} /></Field>
            <button data-help="hr.personnel.training">{t("Update session", "نشست اپ ڈیٹ کریں")}</button>
            <button type="button" data-help="hr.personnel.training" onClick={() => setEditingSession(false)}>{t("Cancel", "منسوخ کریں")}</button>
          </fieldset>
        </form>}
      </article>}
    </>}
  </section>;
}
