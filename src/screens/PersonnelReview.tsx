import { useState, type FormEvent } from "react";
import { Field, LoadState, useLoad } from "../components";
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
      : screenId === "personnel_files_hr" || screenId === "personnel_files_quality" ? <PersonnelFiles {...props} />
        : <AppraisalRegister {...props} />}
  </>;
}

function AppraisalRegister({ screenId, revision, connected }: Props) {
  const [selected, setSelected] = useState<number>();
  const mine = screenId !== "appraisals_hr";
  const schedule = useLoad(() => appraisals.appraisalSchedule(), [revision]);
  const register = useLoad(() => appraisals.listAppraisals({ mine: mine || undefined }), [mine, revision]);
  const detail = useLoad(() => selected ? appraisals.getAppraisal(selected) : Promise.resolve(undefined), [selected, revision]);
  const appraisal = !detail.loading && !detail.error && detail.data?.appraisal_id === selected ? detail.data : undefined;

  return <section data-screen={screenId}>
    <h1>{t("Staff appraisals", "عملے کی کارکردگی کا جائزہ")}</h1>
    <QualityPaper disabled={!connected} documents={[{ path: "/personnel/appraisal-policy/pdf", label: t("appraisal policy", "جائزے کی پالیسی") }]} />
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
      <QualityPaper disabled={!connected} documents={[{ path: `/personnel/appraisals/${appraisal.appraisal_id}/pdf`, label: t("appraisal PDF", "جائزے کی پی ڈی ایف") }]} />
    </article>}
  </section>;
}

const disciplinaryActions = {
  NoAction: "کوئی کارروائی نہیں", Counselling: "مشاورت", VerbalWarning: "زبانی تنبیہ",
  WrittenWarning: "تحریری تنبیہ", FinalWarning: "آخری تنبیہ", Suspension: "معطلی", Termination: "ملازمت کا خاتمہ",
} as const;

function DisciplineHealth({ screenId, user, revision, connected }: Props) {
  const { permissions } = user;
  const mayDiscipline = permissions.includes("personnel.discipline.manage");
  const mayHealth = permissions.includes("personnel.health.manage");
  const [employee, setEmployee] = useState<Selection>();
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
    setNewCase(undefined);
    setDecision(undefined);
    await cases.reload();
  });
  const writable = connected && mayDiscipline && !write.blocked;

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

  return <section data-screen={screenId} data-unsaved={!!newCase || !!decision} data-write-pending={write.blocked}>
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
          {mayHealth && <button data-help="personnel.review.health" onClick={() => setEmployee(target)}>{t("Read health record", "صحت کا ریکارڈ دیکھیں")}</button>}
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

function PersonnelFiles({ screenId, user, revision, connected }: Props) {
  const [incomplete, setIncomplete] = useState(false);
  const [selected, setSelected] = useState<number>();
  const mayOpen = user.permissions.includes("personnel.view");
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
      <QualityPaper disabled={!connected} documents={[{ path: `/personnel/employees/${file.employee_id}/file/pdf`, label: t("personnel file PDF", "ملازم کی فائل کی پی ڈی ایف") }]} />
    </article>}
  </section>;
}
