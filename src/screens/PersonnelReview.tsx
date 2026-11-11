import { useState } from "react";
import { LoadState, useLoad } from "../components";
import { bilingual as t } from "../i18n";
import * as appraisals from "../generated/appraisals_hr";
import * as discipline from "../generated/discipline_health_hr";
import * as files from "../generated/personnel_files_hr";
import { ReportTable } from "./P9cShared";

export const personnelReviewScreens = [
  "appraisals_hr", "appraise_staff_doctor", "appraise_staff_head_nurse",
  "discipline_health_hr", "personnel_files_hr", "personnel_files_quality",
] as const;
type Screen = (typeof personnelReviewScreens)[number];
export function isPersonnelReviewScreen(value: string): value is Screen {
  return personnelReviewScreens.some(screen => screen === value);
}
type Props = { screenId: Screen; revision: number; permissions: readonly string[]; onOpenHelp: () => void };
type Selection = { id: number; label: string };

export function PersonnelReview(props: Props) {
  const { screenId } = props;
  return <>
    <button type="button" data-help="personnel.review.help" onClick={props.onOpenHelp}>{t("Help", "مدد")}</button>
    {screenId === "discipline_health_hr" ? <DisciplineHealth {...props} />
      : screenId === "personnel_files_hr" || screenId === "personnel_files_quality" ? <PersonnelFiles {...props} />
        : <AppraisalRegister {...props} />}
  </>;
}

function AppraisalRegister({ screenId, revision }: Props) {
  const [selected, setSelected] = useState<number>();
  const mine = screenId !== "appraisals_hr";
  const schedule = useLoad(() => appraisals.appraisalSchedule(), [revision]);
  const register = useLoad(() => appraisals.listAppraisals({ mine: mine || undefined }), [mine, revision]);
  const detail = useLoad(() => selected ? appraisals.getAppraisal(selected) : Promise.resolve(undefined), [selected, revision]);
  const appraisal = !detail.loading && !detail.error && detail.data?.appraisal_id === selected ? detail.data : undefined;

  return <section data-screen={screenId}>
    <h1>{t("Staff appraisals", "عملے کی کارکردگی کا جائزہ")}</h1>
    <LoadState {...schedule} retry={schedule.reload} />
    {!schedule.loading && !schedule.error && <ReportTable title={t("Appraisals due", "مقررہ جائزے")}
      columns={[t("Employee", "ملازم"), t("Type", "قسم"), t("Due", "مقررہ تاریخ")]}
      rows={(schedule.data ?? []).map(row => ({ key: row.employee_id + ":" + row.kind,
        cells: [<bdi>{row.emp_number} · {row.full_name}</bdi>, row.kind, row.due_on] }))} />}
    <LoadState {...register} retry={register.reload} />
    {!register.loading && !register.error && <ReportTable title={t("Appraisal register", "جائزوں کا رجسٹر")}
      columns={[t("Appraisal", "جائزہ"), t("Employee", "ملازم"), t("Status", "حالت")]}
      rows={(register.data ?? []).map(row => ({ key: row.appraisal_id, cells: [
        <button data-help="personnel.review.appraisal" onClick={() => setSelected(row.appraisal_id)}>{row.appraisal_number}</button>,
        <bdi>{row.emp_number} · {row.full_name}</bdi>, row.status,
      ] }))} />}
    {selected && <LoadState {...detail} retry={detail.reload} />}
    {appraisal && <article className="card">
      <h2>{appraisal.appraisal_number} · {appraisal.full_name}</h2>
      <p>{appraisal.period_from} – {appraisal.period_to} · {appraisal.status}</p>
      <p>{t("Appraiser", "جائزہ لینے والا")} · {appraisal.appraiser_name}</p>
      {appraisal.overall_rating && <p>{t("Overall rating", "مجموعی درجہ")} · {appraisal.overall_rating}</p>}
      {appraisal.development_plan && <p>{t("Development plan", "ترقی کا منصوبہ")} · {appraisal.development_plan}</p>}
    </article>}
  </section>;
}

function DisciplineHealth({ screenId, permissions, revision }: Props) {
  const mayDiscipline = permissions.includes("personnel.discipline.manage");
  const mayHealth = permissions.includes("personnel.health.manage");
  const [employee, setEmployee] = useState<Selection>();
  const cases = useLoad(() => mayDiscipline ? discipline.listCasesPersonnelDisciplinary() : Promise.resolve([]), [mayDiscipline, revision]);
  const due = useLoad(() => mayHealth ? discipline.healthDue() : Promise.resolve([]), [mayHealth, revision]);
  const history = useLoad(async () => mayHealth && employee
    ? { id: employee.id, rows: await discipline.healthRecord(employee.id) } : undefined, [mayHealth, employee, revision]);

  return <section data-screen={screenId}>
    <h1>{t("Discipline and staff health", "نظم و ضبط اور عملے کی صحت")}</h1>
    {mayDiscipline && <>
      <LoadState {...cases} retry={cases.reload} />
      {!cases.loading && !cases.error && <ReportTable title={t("Confidential disciplinary register", "خفیہ تادیبی رجسٹر")}
        columns={[t("Case", "کیس"), t("Employee", "ملازم"), t("Date", "تاریخ"), t("Status", "حالت")]}
        rows={(cases.data ?? []).map(row => ({ key: row.case_id,
          cells: [row.case_number, <bdi>{row.emp_number} · {row.full_name}</bdi>, row.occurred_on, row.status] }))} />}
    </>}
    {mayHealth && <>
      <LoadState {...due} retry={due.reload} />
      {!due.loading && !due.error && <ReportTable title={t("Staff health due", "عملے کی مقررہ صحت جانچ")}
        columns={[t("Employee", "ملازم"), t("Next due", "اگلی تاریخ"), t("Missing", "باقی")]}
        rows={(due.data ?? []).map(row => ({ key: row.employee_id, cells: [
          <button data-help="personnel.review.health" onClick={() => setEmployee({ id: row.employee_id, label: row.emp_number + " · " + row.full_name })}>{row.emp_number} · {row.full_name}</button>,
          row.next_due ?? "—", row.missing.join(", "),
        ] }))} />}
      {employee && <LoadState {...history} retry={history.reload} />}
      {employee && !history.loading && !history.error && history.data?.id === employee.id && <ReportTable title={employee.label}
        columns={[t("Health entry", "صحت کا اندراج"), t("Date", "تاریخ"), t("Next due", "اگلی تاریخ")]}
        rows={history.data.rows.map(row => ({ key: row.record_id, cells: [row.kind, row.done_on, row.next_due ?? "—"] }))} />}
    </>}
  </section>;
}

function PersonnelFiles({ screenId, permissions, revision }: Props) {
  const [incomplete, setIncomplete] = useState(false);
  const [selected, setSelected] = useState<number>();
  const mayOpen = permissions.includes("personnel.view");
  const summary = useLoad(() => files.completeness({ incomplete_only: incomplete || undefined }), [incomplete, revision]);
  const detail = useLoad(() => mayOpen && selected ? files.personnelFile(selected) : Promise.resolve(undefined), [mayOpen, selected, revision]);
  const file = !detail.loading && !detail.error && detail.data?.employee_id === selected ? detail.data : undefined;

  return <section data-screen={screenId}>
    <h1>{t("Personnel files", "عملے کی فائلیں")}</h1>
    <label><input type="checkbox" data-help="personnel.review.files" checked={incomplete} onChange={e => { setSelected(undefined); setIncomplete(e.target.checked); }} />
      {t("Incomplete files only", "صرف نامکمل فائلیں")}
    </label>
    <LoadState {...summary} retry={summary.reload} />
    {!summary.loading && !summary.error && summary.data && <ReportTable title={t("File completeness", "فائل کی تکمیل")}
      columns={[t("Employee", "ملازم"), t("Designation", "عہدہ"), t("Missing", "باقی")]}
      rows={summary.data.rows.map(row => ({ key: row.employee_id, cells: [
        mayOpen ? <button data-help="personnel.review.files" onClick={() => setSelected(row.employee_id)}>{row.emp_number} · {row.full_name}</button>
          : <bdi>{row.emp_number} · {row.full_name}</bdi>, row.designation, row.missing.join(", "),
      ] }))} />}
    {selected && <LoadState {...detail} retry={detail.reload} />}
    {file && <article className="card">
      <h2>{file.emp_number} · {file.full_name}</h2>
      <p>{file.designation} · {file.department_name} · {file.employment_status}</p>
      <p>{t("Missing", "باقی")} · {file.missing.join(", ") || "—"}</p>
      <p>{t("Credentials", "اسناد")} · {file.credentials.length} · {t("Documents", "دستاویزات")} · {file.documents.length}</p>
    </article>}
  </section>;
}
