import { useState, type FormEvent } from "react";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Field, LoadState, Modal, useLoad } from "../components";
import * as staff from "../generated/staff_training_ipc";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod } from "./QualityRegister";
import {
  ConfirmEntry,
  formText,
  permission,
  ReportTable,
  type P9cProps,
} from "./P9cShared";

const categories = {
  Clinical: "طبی",
  Safety: "حفاظت",
  Emergency: "ایمرجنسی",
  InfectionControl: "انفیکشن کنٹرول",
  PatientRights: "مریض حقوق",
  Quality: "معیار",
  Medication: "ادویات",
  Equipment: "سامان",
  Management: "انتظام",
  Other: "دیگر",
} as const;
const healthKinds = {
  PreEmploymentMedical: "ملازمت سے پہلے طبی معائنہ",
  PeriodicMedical: "دوری طبی معائنہ",
  HepatitisBVaccine: "ہیپاٹائٹس بی ویکسین",
  HepatitisBAntibody: "ہیپاٹائٹس بی اینٹی باڈی",
  HepatitisBScreen: "ہیپاٹائٹس بی اسکرین",
  HepatitisCScreen: "ہیپاٹائٹس سی اسکرین",
  HIVScreen: "ایچ آئی وی اسکرین",
  TBScreen: "ٹی بی اسکرین",
  TetanusVaccine: "تشنج ویکسین",
  InfluenzaVaccine: "انفلوئنزا ویکسین",
  TyphoidVaccine: "ٹائیفائیڈ ویکسین",
  NeedlestickExposure: "سوئی لگنا",
  Other: "دیگر",
} as const;
function opts(values: Record<string, string>) {
  return Object.entries(values).map(([value, ur]) => (
    <option key={value} value={value}>
      {t(value, ur)}
    </option>
  ));
}
type StaffRef = Pick<
  staff.StaffHealthDueOut,
  "employee_id" | "full_name" | "emp_number" | "department_name"
>;
type AttendeeDraft = { employee: number; passed: "" | "yes" | "no" };

export function IpcStaffTraining({
  user,
  connected,
  timeZone,
  revision,
  onOpenHelp,
}: P9cProps) {
  const trainingWrite = user.permissions.includes("personnel.training.record");
  const training = !!permission(
    user,
    "personnel.view",
    "personnel.manage",
    "personnel.training.record",
  );
  const health = user.permissions.includes("personnel.health.manage");
  const [range, setRange] = useState(() => currentMonth(timeZone));
  const [req, setReq] = useState("");
  const [dept, setDept] = useState<number>();
  const [overdue, setOverdue] = useState(false);
  const [draft, setDraft] = useState<"training" | "health">();
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([]);
  const [selected, setSelected] = useState<StaffRef>();
  const [staffQuery, setStaffQuery] = useState("");
  const [staffTerm, setStaffTerm] = useState("");
  const [sessionResult, setSessionResult] =
    useState<staff.TrainingSessionDetailOut>();
  const [kind, setKind] =
    useState<staff.HealthRecordIn["kind"]>("HepatitisBVaccine");
  const sessions = useLoad(
    () =>
      training
        ? staff.listSessions({
            ...(range.date_from ? range : {}),
            category: "InfectionControl",
            requirement_code: req || undefined,
          })
        : Promise.resolve([]),
    [training, range, req, revision],
  );
  const requirements = useLoad(
    () => (training ? staff.trainingRequirements() : Promise.resolve([])),
    [training, revision],
  );
  const compliance = useLoad(
    () =>
      training
        ? staff.trainingCompliance({
            requirement_code: req || undefined,
            department_id: dept,
            overdue_only: overdue || undefined,
          })
        : Promise.resolve([]),
    [training, req, dept, overdue, revision],
  );
  const due = useLoad(
    () => (health ? staff.healthDue() : Promise.resolve([])),
    [health, revision],
  );
  const staffMatches = useLoad(
    () => health && staffTerm ? staff.staffFacility({ q: staffTerm, limit: 30 }) : Promise.resolve([]),
    [health, staffTerm],
  );
  const employee = selected?.employee_id;
  const records = useLoad(
    () =>
      health && employee ? staff.healthRecord(employee) : Promise.resolve([]),
    [health, employee, revision],
  );
  const directory = useLoad(
    () =>
      trainingWrite ? staff.staffFacility({ limit: 500 }) : Promise.resolve([]),
    [trainingWrite, revision],
  );
  const departments = useLoad(
    () => (training ? staff.departments() : Promise.resolve([])),
    [training, revision],
  );
  const write = useClinicalWrite(
    user,
    "staff_training_ipc",
    async (value, command) => {
      if (command.path === "/personnel/training-sessions") {
        setSessionResult(value);
        await Promise.all([sessions.reload(), compliance.reload()]);
      } else await Promise.all([records.reload(), due.reload()]);
      setDraft(undefined);
    },
  );
  const editable = connected && !write.blocked;
  const medical = kind === "PreEmploymentMedical" || kind === "PeriodicMedical";
  const vaccine = kind.endsWith("Vaccine");
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable) return;
    const f = new FormData(e.currentTarget);
    if (draft === "training" && trainingWrite) {
      const department_id = departments.data?.find(
        (x) => String(x.department_id) === formText(f, "department"),
      )?.department_id;
      const requirement_code = requirements.data?.find(
        (x) => x.is_active && x.code === formText(f, "requirement"),
      )?.code;
      if (!attendees.length || !formText(f, "title") || !formText(f, "trainer"))
        return;
      const body: staff.TrainingSessionIn = {
        title: formText(f, "title"),
        category: formText(
          f,
          "category",
        ) as staff.TrainingSessionIn["category"],
        held_on: formText(f, "date"),
        hours: Number(formText(f, "hours")),
        trainer: formText(f, "trainer"),
        venue: formText(f, "venue") || undefined,
        department_id,
        requirement_code,
        note: formText(f, "note") || undefined,
        attendees: attendees.map((x) => ({
          employee_id: x.employee,
          passed: x.passed ? x.passed === "yes" : null,
        })),
      };
      write.start({
        method: "POST",
        path: "/personnel/training-sessions",
        body,
        permission: "personnel.training.record",
        protection: "idempotent",
        label: t("Record training session", "تربیتی نشست درج کریں"),
      });
    }
    if (draft === "health" && health && selected) {
      const body: staff.HealthRecordIn = {
        kind,
        done_on: formText(f, "date"),
        dose:
          vaccine && formText(f, "dose")
            ? Number(formText(f, "dose"))
            : undefined,
        result: formText(f, "result") || undefined,
        fit_for_duty: medical
          ? (formText(f, "fit") as staff.HealthRecordIn["fit_for_duty"])
          : undefined,
        next_due: formText(f, "due") || undefined,
        note: formText(f, "note") || undefined,
      };
      write.start({
        method: "POST",
        path: "/personnel/employees/" + selected.employee_id + "/health",
        body,
        permission: "personnel.health.manage",
        protection: "idempotent",
        label: t(
          "Record confidential health entry",
          "خفیہ صحت اندراج درج کریں",
        ),
      });
    }
  }
  const deptOptions = (departments.data ?? [])
    .filter((x) => x.is_active)
    .map((x) => (
      <option key={x.department_id} value={x.department_id}>
        {x.name}
      </option>
    ));
  const reqOptions = (requirements.data ?? [])
    .filter((x) => x.is_active)
    .map((x) => (
      <option key={x.code} value={x.code}>
        {x.title}
      </option>
    ));
  return (
    <section
      data-screen="staff_training_ipc"
      data-unsaved={!!draft}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t(
          "IPC staff training and health",
          "انفیکشن کنٹرول تربیت اور صحت",
        )}
        text={t(
          "Read training compliance and review confidential staff health follow-up by permission.",
          "اجازت کے مطابق تربیت تعمیل اور خفیہ عملہ صحت پیروی دیکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      {training && (
        <>
          <QualityPeriod range={range} apply={setRange}>
            <Field label={t("Requirement", "ضرورت")}>
              <select
                data-help="ipc.training"
                value={req}
                onChange={(e) => setReq(e.target.value)}
              >
                <option value="">
                  {t("All requirements", "تمام ضروریات")}
                </option>
                {reqOptions}
              </select>
            </Field>
          </QualityPeriod>
          {trainingWrite && (
            <button
              data-help="ipc.training"
              disabled={!editable}
              onClick={() => {
                setAttendees([]);
                setDraft("training");
                write.clearError();
              }}
            >
              {t("Record training session", "تربیتی نشست درج کریں")}
            </button>
          )}
          <LoadState {...requirements} retry={requirements.reload} />
          {!requirements.loading && !requirements.error && (
            <ReportTable
              title={t("Training requirements", "تربیتی ضروریات")}
              columns={[
                t("Requirement", "ضرورت"),
                t("Staff categories", "عملہ زمرے"),
                t("Frequency / standard", "تعدد / معیار"),
              ]}
              rows={(requirements.data ?? [])
                .filter((x) => x.is_active)
                .map((x) => ({
                  key: x.code,
                  cells: [
                    x.title,
                    x.applies_to.join(", "),
                    (x.every_months ?? t("Once", "ایک بار")) +
                      " · " +
                      (x.standard ?? "—"),
                  ],
                }))}
            />
          )}
          <LoadState {...sessions} retry={sessions.reload} />
          {!sessions.loading && !sessions.error && (
            <ReportTable
              title={t(
                "Infection control training sessions",
                "انفیکشن کنٹرول تربیتی نشستیں",
              )}
              columns={[
                t("Session", "نشست"),
                t("Date and duration", "تاریخ اور مدت"),
                t("Trainer / venue", "ٹرینر / مقام"),
                t("Attendees", "شرکاء"),
              ]}
              rows={(sessions.data ?? []).map((x) => ({
                key: x.session_id,
                cells: [
                  x.session_number + " · " + x.title,
                  x.held_on + " · " + x.hours,
                  [x.trainer, x.venue, x.department_name, x.note]
                    .filter(Boolean)
                    .join(" · "),
                  x.attendee_count,
                ],
              }))}
            />
          )}
          {sessionResult && (
            <ReportTable
              title={
                sessionResult.session_number +
                " · " +
                t("Recorded attendance", "درج حاضری")
              }
              columns={[t("Employee", "ملازم"), t("Assessment", "جائزہ")]}
              rows={sessionResult.attendees.map((x) => ({
                key: x.employee_id,
                cells: [
                  x.emp_number + " · " + x.full_name,
                  x.passed === null
                    ? "—"
                    : x.passed
                      ? t("Passed", "کامیاب")
                      : t("Did not pass", "ناکام"),
                ],
              }))}
            />
          )}
          <div className="toolbar">
            <Field label={t("Filter department", "شعبہ فلٹر")}>
              <select
                data-help="ipc.training"
                value={dept ?? ""}
                onChange={(e) =>
                  setDept(
                    departments.data?.find(
                      (x) => String(x.department_id) === e.target.value,
                    )?.department_id,
                  )
                }
              >
                <option value="">{t("All departments", "تمام شعبے")}</option>
                {deptOptions}
              </select>
            </Field>
            <label>
              <input
                data-help="ipc.training"
                type="checkbox"
                checked={overdue}
                onChange={(e) => setOverdue(e.target.checked)}
              />{" "}
              {t("Overdue only", "صرف تاخیر")}
            </label>
          </div>
          <LoadState {...compliance} retry={compliance.reload} />
          {!compliance.loading && !compliance.error && (
            <ReportTable
              title={t("Training compliance", "تربیت تعمیل")}
              columns={[
                t("Employee", "ملازم"),
                t("Requirement", "ضرورت"),
                t("Last / due", "آخری / مقررہ"),
                t("State", "حالت"),
              ]}
              rows={(compliance.data ?? []).map((x) => ({
                key: x.employee_id + ":" + x.requirement_code,
                cells: [
                  x.emp_number + " · " + x.full_name,
                  x.requirement_title,
                  (x.last_on ?? "—") + " / " + (x.next_due ?? "—"),
                  x.state,
                ],
              }))}
            />
          )}
        </>
      )}
      {health && (
        <article className="card">
          <h2>{t("Confidential staff health", "خفیہ عملہ صحت")}</h2>
          <form className="toolbar" onSubmit={event => {
            event.preventDefault();
            setStaffTerm(staffQuery.trim());
          }}>
            <Field label={t("Staff name or number", "ملازم کا نام یا نمبر")}>
              <input data-help="ipc.health" value={staffQuery} required
                onChange={event => { setStaffQuery(event.target.value); setStaffTerm(""); }} />
            </Field>
            <button data-help="ipc.health" disabled={!!draft || write.blocked}>
              {t("Find staff", "ملازم تلاش کریں")}
            </button>
          </form>
          {staffTerm && <>
            <LoadState {...staffMatches} retry={staffMatches.reload} />
            {!staffMatches.loading && !staffMatches.error && (staffMatches.data?.length
              ? staffMatches.data.map(x => (
                <button type="button" key={x.employee_id} data-help="ipc.health"
                  disabled={!!draft || write.blocked} onClick={() => setSelected(x)}>
                  {x.emp_number} · {x.full_name}
                </button>
              ))
              : <p>{t("No matching staff.", "کوئی مماثل ملازم نہیں۔")}</p>)}
          </>}
          <LoadState {...due} retry={due.reload} />
          {!due.loading && !due.error && (
            <ReportTable
              title={t(
                "Health checks and doses due",
                "مقررہ صحت جانچ اور خوراکیں",
              )}
              columns={[
                t("Employee", "ملازم"),
                t(
                  "Pre-employment and hepatitis B",
                  "ملازمت سے پہلے اور ہیپاٹائٹس بی",
                ),
                t("Due and missing", "مقررہ اور غیر مکمل"),
              ]}
              rows={(due.data ?? []).map((x) => ({
                key: x.employee_id,
                cells: [
                  <button data-help="ipc.health" disabled={!!draft || write.blocked} onClick={() => setSelected(x)}>
                    {x.emp_number} · {x.full_name}
                  </button>,
                  (x.pre_employment_medical
                    ? t("Medical recorded", "معائنہ درج")
                    : t("Medical missing", "معائنہ موجود نہیں")) +
                    " · " +
                    x.hepatitis_b_doses +
                    "/3" +
                    (x.hepatitis_b_antibody
                      ? " · " + t("Antibody", "اینٹی باڈی")
                      : "") +
                    (x.exposed
                      ? " · " + t("Blood exposure", "خون سے سامنا")
                      : ""),
                  (x.next_due ?? "—") + " · " + x.missing.join(", "),
                ],
              }))}
            />
          )}
          {selected && (
            <>
              <h3>
                {selected.emp_number} · {selected.full_name}
              </h3>
              <button
                type="button"
                data-help="ipc.health"
                disabled={!editable}
                onClick={() => {
                  setKind("HepatitisBVaccine");
                  setDraft("health");
                  write.clearError();
                }}
              >
                {t("Record health entry", "صحت اندراج درج کریں")}
              </button>
              <LoadState {...records} retry={records.reload} />
              {!records.loading && !records.error && (
                <ReportTable
                  title={t("Health record", "صحت ریکارڈ")}
                  columns={[
                    t("Check or dose", "جانچ یا خوراک"),
                    t("Result and fitness", "نتیجہ اور اہلیت"),
                    t("Follow-up", "پیروی"),
                  ]}
                  rows={(records.data ?? [])
                    .filter((x) => x.employee_id === employee)
                    .map((x) => ({
                      key: x.record_id,
                      cells: [
                        t(x.kind, healthKinds[x.kind]) +
                          " · " +
                          x.done_on +
                          " · " +
                          (x.dose ?? "—"),
                        [x.result, x.fit_for_duty, x.note]
                          .filter(Boolean)
                          .join(" · "),
                        [x.next_due, x.recorded_by_name]
                          .filter(Boolean)
                          .join(" · "),
                      ],
                    }))}
                />
              )}
            </>
          )}
        </article>
      )}
      {!draft && <ClinicalWriteFeedback write={write} />}
      {draft && (
        <Modal
          title={
            draft === "training"
              ? t("Record training session", "تربیتی نشست درج کریں")
              : t(
                  "Record confidential health entry",
                  "خفیہ صحت اندراج درج کریں",
                )
          }
          closable={!write.blocked}
          onClose={() => setDraft(undefined)}
        >
          <form className="form" onSubmit={save}>
            <fieldset disabled={write.blocked}>
              <Field label={t("Date", "تاریخ")}>
                <input
                  data-help="p9c.write"
                  name="date"
                  type="date"
                  defaultValue={range.date_to}
                  max={currentMonth(timeZone).date_to}
                  required
                />
              </Field>
              {draft === "training" ? (
                <>
                  <Field label={t("Session title", "نشست عنوان")}>
                    <input
                      data-help="ipc.training"
                      name="title"
                      required
                      minLength={3}
                      maxLength={200}
                    />
                  </Field>
                  <Field label={t("Category", "زمرہ")}>
                    <select
                      data-help="ipc.training"
                      name="category"
                      defaultValue="InfectionControl"
                    >
                      {opts(categories)}
                    </select>
                  </Field>
                  <Field label={t("Requirement", "ضرورت")}>
                    <select data-help="ipc.training" name="requirement">
                      <option value="">—</option>
                      {reqOptions}
                    </select>
                  </Field>
                  <Field label={t("Hours", "گھنٹے")}>
                    <input
                      data-help="ipc.training"
                      name="hours"
                      type="number"
                      min={0.01}
                      max={200}
                      step="any"
                      required
                    />
                  </Field>
                  <Field label={t("Trainer", "ٹرینر")}>
                    <input
                      data-help="ipc.training"
                      name="trainer"
                      required
                      minLength={2}
                      maxLength={200}
                    />
                  </Field>
                  <Field label={t("Venue", "جگہ")}>
                    <input
                      data-help="ipc.training"
                      name="venue"
                      maxLength={200}
                    />
                  </Field>
                  <Field label={t("Department", "شعبہ")}>
                    <select data-help="ipc.training" name="department">
                      <option value="">—</option>
                      {deptOptions}
                    </select>
                  </Field>
                  <LoadState {...directory} retry={directory.reload} />
                  <Field label={t("Add attendee", "شریک شامل کریں")}>
                    <select
                      data-help="ipc.training"
                      value=""
                      onChange={(e) => {
                        const member = directory.data?.find(
                          (x) => String(x.employee_id) === e.target.value,
                        );
                        if (member)
                          setAttendees((a) => [
                            ...a,
                            { employee: member.employee_id, passed: "" },
                          ]);
                      }}
                    >
                      <option value="">
                        {t("Choose employee", "ملازم چنیں")}
                      </option>
                      {directory.data
                        ?.filter(
                          (x) =>
                            !attendees.some(
                              (a) => a.employee === x.employee_id,
                            ),
                        )
                        .map((x) => (
                          <option key={x.employee_id} value={x.employee_id}>
                            {x.emp_number} · {x.full_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  {attendees.map((a) => (
                    <div key={a.employee} className="toolbar">
                      <Field
                        label={
                          directory.data?.find(
                            (x) => x.employee_id === a.employee,
                          )?.full_name ?? t("Attendee", "شریک")
                        }
                      >
                        <select
                          data-help="ipc.training"
                          value={a.passed}
                          onChange={(e) =>
                            setAttendees((list) =>
                              list.map((x) =>
                                x.employee === a.employee
                                  ? {
                                      ...x,
                                      passed: e.target
                                        .value as AttendeeDraft["passed"],
                                    }
                                  : x,
                              ),
                            )
                          }
                        >
                          <option value="">
                            {t("No assessment", "جائزہ نہیں")}
                          </option>
                          <option value="yes">{t("Passed", "کامیاب")}</option>
                          <option value="no">
                            {t("Did not pass", "ناکام")}
                          </option>
                        </select>
                      </Field>
                      <button
                        type="button"
                        data-help="ipc.training"
                        onClick={() =>
                          setAttendees((list) =>
                            list.filter((x) => x.employee !== a.employee),
                          )
                        }
                      >
                        {t("Remove", "ہٹائیں")}
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <p>
                    {selected?.emp_number} · {selected?.full_name}
                  </p>
                  <Field label={t("Health entry kind", "صحت اندراج قسم")}>
                    <select
                      data-help="ipc.health"
                      value={kind}
                      onChange={(e) => setKind(e.target.value as typeof kind)}
                    >
                      {opts(healthKinds)}
                    </select>
                  </Field>
                  {vaccine && (
                    <Field label={t("Dose number", "خوراک نمبر")}>
                      <input
                        data-help="ipc.health"
                        name="dose"
                        type="number"
                        min={1}
                        max={5}
                        required={kind === "HepatitisBVaccine"}
                      />
                    </Field>
                  )}
                  {medical && (
                    <Field label={t("Fit for duty", "کام کی اہلیت")}>
                      <select data-help="ipc.health" name="fit">
                        <option value="Fit">{t("Fit", "اہل")}</option>
                        <option value="FitWithRestrictions">
                          {t("Fit with restrictions", "شرائط کے ساتھ اہل")}
                        </option>
                        <option value="Unfit">{t("Unfit", "نااہل")}</option>
                      </select>
                    </Field>
                  )}
                  <Field label={t("Result", "نتیجہ")}>
                    <input
                      data-help="ipc.health"
                      name="result"
                      maxLength={500}
                    />
                  </Field>
                  <Field
                    label={t(
                      "Next dose or check due",
                      "اگلی خوراک یا جانچ تاریخ",
                    )}
                  >
                    <input data-help="ipc.health" name="due" type="date" />
                  </Field>
                </>
              )}
              <Field label={t("Note", "نوٹ")}>
                <textarea data-help="p9c.write" name="note" maxLength={2000} />
              </Field>
              <ConfirmEntry />
            </fieldset>
            <ClinicalWriteFeedback write={write} />
            <button
              className="primary"
              data-help="p9c.write"
              disabled={
                !editable || (draft === "training" && !attendees.length)
              }
            >
              {t("Confirm submission", "ارسال کی تصدیق")}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
