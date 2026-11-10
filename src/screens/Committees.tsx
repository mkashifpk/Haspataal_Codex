import { useState, type FormEvent } from "react";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Field, LoadState, Modal, useLoad } from "../components";
import * as committees from "../generated/committees_quality";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading } from "./QualityRegister";
import {
  ConfirmEntry,
  formText,
  ReportTable,
  type P9cProps,
} from "./P9cShared";
import { QualityPaper } from "./QualityPaper";

type Id = "my_committees" | "committees_quality" | "committees_ipc";
type Draft = "new" | "edit" | "schedule" | "minutes" | "finalize" | "action";
type Member = committees.MemberIn;
const kinds = {
  Quality: "معیار",
  InfectionControl: "انفیکشن کنٹرول",
  PharmacyTherapeutics: "فارمیسی اور علاج",
  MortalityMorbidity: "اموات اور بیماری",
  MedicalRecords: "طبی ریکارڈ",
  Equipment: "سامان",
  Credentials: "اسناد",
  WasteManagement: "فضلہ انتظام",
  Safety: "حفاظت",
  Other: "دیگر",
} as const;
const roles = { Chair: "صدر", Secretary: "سیکرٹری", Member: "رکن" } as const;

export function Committees({
  screenId,
  user,
  connected,
  revision,
  timeZone,
  onOpenHelp,
  onActions,
}: P9cProps & { screenId: Id; onActions?: () => void }) {
  const my = screenId === "my_committees";
  const manage = !my && user.permissions.includes("committee.manage");
  const [active, setActive] = useState(true);
  const [committeeId, setCommitteeId] = useState<number>();
  const [meetingId, setMeetingId] = useState<number>();
  const [draft, setDraft] = useState<Draft>();
  const [draftVersion, setDraftVersion] = useState<number>();
  const [members, setMembers] = useState<Member[]>([]);
  const list = useLoad(
    () => committees.listCommittees({ active_only: active || undefined }),
    [active, revision],
  );
  const detail = useLoad(
    () =>
      committeeId
        ? committees.getCommittee(committeeId)
        : Promise.resolve(undefined),
    [committeeId, revision],
  );
  const minutes = useLoad(
    () =>
      meetingId ? committees.getMeeting(meetingId) : Promise.resolve(undefined),
    [meetingId, revision],
  );
  const staff = useLoad(
    () => (manage ? committees.people() : Promise.resolve([])),
    [manage, revision],
  );
  const departments = useLoad(
    () => (manage ? committees.departments() : Promise.resolve([])),
    [manage, revision],
  );
  const committee =
    !detail.loading &&
    !detail.error &&
    detail.data?.committee_id === committeeId
      ? detail.data
      : undefined;
  const meeting =
    !minutes.loading && !minutes.error && minutes.data?.meeting_id === meetingId
      ? minutes.data
      : undefined;
  const write = useClinicalWrite(user, screenId, async (value, command) => {
    if (command.path === "/committees") {
      setCommitteeId(value.committee_id);
      setMeetingId(undefined);
    }
    if (draft === "schedule") setMeetingId(value.meeting_id);
    setDraft(undefined);
    await Promise.all([list.reload(), detail.reload(), minutes.reload()]);
  });
  const edit = connected && !write.blocked;
  const departmentOptions = departments.data
    ?.filter((x) => x.is_active)
    .map((x) => (
      <option key={x.department_id} value={x.department_id}>
        {x.name}
      </option>
    ));
  function begin(mode: Draft, initial: Member[] = []) {
    setMembers(initial);
    setDraftVersion(
      mode === "edit"
        ? committee?.row_version
        : mode === "minutes"
          ? meeting?.row_version
          : undefined,
    );
    setDraft(mode);
    write.clearError();
  }
  function patchMember(index: number, part: Partial<Member>) {
    setMembers((all) =>
      all.map((member, i) => (index === i ? { ...member, ...part } : member)),
    );
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;
    const f = new FormData(e.currentTarget);
    const optional = (key: string) => formText(f, key) || null;
    const normalized = members.map((x) => ({
      ...x,
      name: x.name?.trim() || null,
      represents: x.represents?.trim() || null,
    }));
    if (draft === "finalize" && meeting?.can_finalize) {
      const recordPath = "/committee-meetings/" + meeting.meeting_id;
      write.start({
        method: "POST",
        path: recordPath + "/finalize",
        permission: { recordPath, capability: "can_finalize" },
        protection: "reconcile",
        reconcilePath: recordPath,
        label: t("Approve the minutes", "کارروائی منظور کریں"),
      });
      return;
    }
    if (!manage) return;
    if (draft === "new" || draft === "edit") {
      if (
        normalized.some((x) => !x.user_id && !x.name) ||
        normalized.filter((x) => x.role === "Chair").length !== 1 ||
        normalized.filter((x) => x.role === "Secretary").length !== 1
      )
        return;
      const data = {
        name: formText(f, "name"),
        terms_of_reference: optional("terms"),
        meets_every_months: Number(formText(f, "frequency")),
        members: normalized,
      };
      if (!data.name) return;
      if (draft === "new") {
        const body: committees.CommitteeIn = {
          ...data,
          code: formText(f, "code"),
          kind: formText(f, "kind") as committees.CommitteeIn["kind"],
        };
        write.start({
          method: "POST",
          path: "/committees",
          body,
          permission: "committee.manage",
          protection: "idempotent",
          label: t("Create committee", "کمیٹی بنائیں"),
        });
      } else if (committee) {
        const path = "/committees/" + committee.committee_id;
        const body: committees.CommitteeUpdateIn = {
          ...data,
          is_active: f.has("active"),
          expected_version: draftVersion,
        };
        write.start({
          method: "PATCH",
          path,
          body,
          permission: "committee.manage",
          protection: "reconcile",
          reconcilePath: path,
          label: t("Update committee", "کمیٹی تازہ کریں"),
        });
      }
    }
    if (draft === "schedule" && committee) {
      const body: committees.MeetingIn = {
        held_on: formText(f, "date"),
        venue: optional("venue"),
        agenda: optional("agenda"),
      };
      write.start({
        method: "POST",
        path: "/committees/" + committee.committee_id + "/meetings",
        body,
        permission: "committee.manage",
        protection: "idempotent",
        label: t("Schedule meeting", "اجلاس مقرر کریں"),
      });
    }
    if (draft === "minutes" && meeting?.can_edit) {
      if (normalized.some((x) => !x.user_id && !x.name)) return;
      const path = "/committee-meetings/" + meeting.meeting_id;
      const body: committees.MinutesIn = {
        held_on: formText(f, "date"),
        venue: optional("venue"),
        agenda: optional("agenda"),
        attendees: normalized,
        apologies: optional("apologies"),
        issues: optional("issues"),
        activities: optional("activities"),
        outcomes: optional("outcomes"),
        expected_version: draftVersion,
      };
      write.start({
        method: "PUT",
        path,
        body,
        permission: "committee.manage",
        protection: "reconcile",
        reconcilePath: path,
        label: t("Save draft minutes", "مسودہ کارروائی محفوظ کریں"),
      });
    }
    if (draft === "action" && meeting?.status === "Final") {
      const owner_user_id = staff.data?.find(
        (x) => String(x.user_id) === formText(f, "owner"),
      )?.user_id;
      const department_id = departments.data?.find(
        (x) => String(x.department_id) === formText(f, "department"),
      )?.department_id;
      if (!owner_user_id || !formText(f, "description")) return;
      const body: committees.QualityActionIn = {
        action_type: formText(
          f,
          "actionType",
        ) as committees.QualityActionIn["action_type"],
        description: formText(f, "description"),
        owner_user_id,
        department_id,
        due_date: formText(f, "due"),
      };
      write.start({
        method: "POST",
        path: "/committee-meetings/" + meeting.meeting_id + "/actions",
        body,
        permission: "committee.manage",
        protection: "idempotent",
        label: t("Assign meeting action", "اجلاس کارروائی تفویض کریں"),
      });
    }
  }
  const listRows = [...(list.data ?? [])].sort(
    (a, b) =>
      Number(b.is_due) - Number(a.is_due) || a.name.localeCompare(b.name),
  );
  const period = currentMonth(timeZone);
  const isDirectory = draft === "new" || draft === "edit";
  return (
    <section
      data-screen={screenId}
      data-unsaved={!!draft}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={
          my
            ? t("My committees", "میری کمیٹیاں")
            : t("Committees and minutes", "کمیٹیاں اور کارروائی")
        }
        text={t(
          "Review meeting schedules, minutes, and decisions that become actions.",
          "اجلاس شیڈول، کارروائی اور عمل بننے والے فیصلے دیکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      <div className="toolbar">
        <label>
          <input
            type="checkbox"
            data-help="committee.read"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />{" "}
          {t("Active committees only", "صرف فعال کمیٹیاں")}
        </label>
        {manage && (
          <button
            data-help="committee.setup"
            disabled={!edit}
            onClick={() =>
              begin("new", [{ role: "Chair" }, { role: "Secretary" }])
            }
          >
            {t("New committee", "نئی کمیٹی")}
          </button>
        )}
        {onActions && (
          <button data-help="committee.action" onClick={onActions}>
            {t("Review meeting actions", "اجلاس کارروائیاں دیکھیں")}
          </button>
        )}
      </div>
      <LoadState {...list} retry={list.reload} />
      {!list.loading && !list.error && (
        <ReportTable
          title={t("Committee directory", "کمیٹی فہرست")}
          columns={[
            t("Committee", "کمیٹی"),
            t("Last final meeting", "آخری حتمی اجلاس"),
            t("Due", "مقررہ"),
            t("Meetings", "اجلاس"),
          ]}
          rows={listRows.map((x) => ({
            key: x.committee_id,
            cells: [
              <button
                type="button"
                data-help="committee.read"
                onClick={() => {
                  setCommitteeId(x.committee_id);
                  setMeetingId(undefined);
                }}
              >
                {x.name}
              </button>,
              x.last_meeting_on ?? "—",
              <>
                {x.next_due_on ?? "—"}{" "}
                {x.is_due && (
                  <strong className="error">{t("Due", "مقررہ")}</strong>
                )}{" "}
                {!x.is_active && t("Inactive", "غیر فعال")}
              </>,
              x.meetings,
            ],
          }))}
        />
      )}
      {committeeId && <LoadState {...detail} retry={detail.reload} />}
      {committee && (
        <article className="card">
          <h2>
            {committee.name} · {committee.code}
          </h2>
          <p>
            {committee.terms_of_reference ?? "—"} ·{" "}
            {committee.meets_every_months}{" "}
            {t("months between meetings", "اجلاسوں کے درمیان مہینے")}
          </p>
          <ReportTable
            title={t("Committee members", "کمیٹی ارکان")}
            columns={[
              t("Member", "رکن"),
              t("Role", "کردار"),
              t("Represents", "نمائندگی"),
            ]}
            rows={committee.members.map((x, i) => ({
              key: i,
              cells: [x.name, t(x.role, roles[x.role]), x.represents ?? "—"],
            }))}
          />
          {manage && (
            <div className="toolbar">
              <button
                data-help="committee.setup"
                disabled={!edit}
                onClick={() => begin("edit", committee.members)}
              >
                {t("Edit committee", "کمیٹی میں ترمیم")}
              </button>
              {committee.is_active && (
                <button
                  data-help="committee.minutes"
                  disabled={!edit}
                  onClick={() => begin("schedule")}
                >
                  {t("Schedule meeting", "اجلاس مقرر کریں")}
                </button>
              )}
            </div>
          )}
          <ReportTable
            title={t("Meetings", "اجلاس")}
            columns={[
              t("Meeting", "اجلاس"),
              t("Date and venue", "تاریخ اور جگہ"),
              t("Status", "حالت"),
            ]}
            rows={committee.meeting_list.map((x) => ({
              key: x.meeting_id,
              cells: [
                <button
                  data-help="committee.read"
                  onClick={() => setMeetingId(x.meeting_id)}
                >
                  {x.meeting_number}
                </button>,
                x.held_on + " · " + (x.venue ?? "—"),
                x.status === "Final" ? t("Final", "حتمی") : t("Draft", "مسودہ"),
              ],
            }))}
          />
        </article>
      )}
      {meetingId && <LoadState {...minutes} retry={minutes.reload} />}
      {meeting && (
        <article className="card">
          <h2>
            {meeting.meeting_number} ·{" "}
            {meeting.status === "Final"
              ? t("Final minutes", "حتمی کارروائی")
              : t("Draft minutes", "مسودہ کارروائی")}
          </h2>
          <dl>
            {(
              [
                [
                  t("Date and venue", "تاریخ اور جگہ"),
                  meeting.held_on + " · " + (meeting.venue ?? "—"),
                ],
                [t("Agenda", "ایجنڈا"), meeting.agenda],
                [
                  t("Attendees", "شرکاء"),
                  meeting.attendees.map((x) => x.name).join(", "),
                ],
                [t("Apologies", "معذرت"), meeting.apologies],
                [t("Issues", "مسائل"), meeting.issues],
                [
                  t("Activities reviewed", "جائزہ شدہ سرگرمیاں"),
                  meeting.activities,
                ],
                [t("Outcomes", "نتائج"), meeting.outcomes],
                [
                  t("Final author stamp", "حتمی دستخط"),
                  meeting.final_stamp?.text,
                ],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="toolbar">
            {manage && meeting.can_edit && (
              <button
                data-help="committee.minutes"
                disabled={!edit}
                onClick={() => begin("minutes", meeting.attendees)}
              >
                {t("Write draft minutes", "مسودہ کارروائی لکھیں")}
              </button>
            )}
            {meeting.can_finalize && (
              <button
                data-help="committee.minutes"
                disabled={!edit}
                onClick={() => begin("finalize")}
              >
                {t("Approve the minutes", "کارروائی منظور کریں")}
              </button>
            )}
            {manage && meeting.status === "Final" && (
              <button
                data-help="committee.action"
                disabled={!edit}
                onClick={() => begin("action")}
              >
                {t("Assign an action", "کارروائی تفویض کریں")}
              </button>
            )}
          </div>
          <QualityPaper
            disabled={!connected}
            documents={[
              {
                path: "/committee-meetings/" + meeting.meeting_id + "/pdf",
                label: t("minutes PDF", "کارروائی پی ڈی ایف"),
              },
            ]}
          />
          <ReportTable
            title={t("Actions from this meeting", "اس اجلاس کی کارروائیاں")}
            columns={[
              t("Action", "کارروائی"),
              t("Owner", "ذمہ دار"),
              t("Due", "مقررہ"),
              t("Status", "حالت"),
            ]}
            rows={meeting.action_list.map((x) => ({
              key: x.action_id,
              cells: [
                x.action_number + " · " + x.description,
                x.owner_name,
                x.due_date,
                x.status,
              ],
            }))}
          />
        </article>
      )}
      {!my &&
        user.permissions.includes("quality.indicator.view") &&
        period.date_from && (
          <QualityPaper
            disabled={!connected}
            documents={[
              {
                path: "/quality/indicators/pdf?" + new URLSearchParams(period),
                label: t("quality indicators report", "معیار اشاریے رپورٹ"),
              },
            ]}
          />
        )}
      {!draft && <ClinicalWriteFeedback write={write} />}
      {draft && (
        <Modal
          title={t("Confirm committee work", "کمیٹی عمل کی تصدیق")}
          closable={!write.blocked}
          onClose={() => setDraft(undefined)}
        >
          <form className="form" onSubmit={save}>
            <fieldset disabled={write.blocked}>
              {(isDirectory || draft === "minutes" || draft === "action") && (
                <>
                  <LoadState {...staff} retry={staff.reload} />
                  <LoadState {...departments} retry={departments.reload} />
                </>
              )}
              {isDirectory && (
                <>
                  {draft === "new" && (
                    <>
                      <Field label={t("Committee code", "کمیٹی کوڈ")}>
                        <input
                          data-help="committee.setup"
                          name="code"
                          required
                          maxLength={40}
                        />
                      </Field>
                      <Field label={t("Kind", "قسم")}>
                        <select
                          data-help="committee.setup"
                          name="kind"
                          defaultValue={
                            screenId === "committees_ipc"
                              ? "InfectionControl"
                              : "Quality"
                          }
                        >
                          {Object.entries(kinds).map(([key, ur]) => (
                            <option key={key} value={key}>
                              {t(key, ur)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </>
                  )}
                  <Field label={t("Committee name", "کمیٹی نام")}>
                    <input
                      data-help="committee.setup"
                      name="name"
                      required
                      maxLength={200}
                      defaultValue={draft === "edit" ? committee?.name : ""}
                    />
                  </Field>
                  <Field label={t("Terms of reference", "دائرہ کار")}>
                    <textarea
                      data-help="committee.setup"
                      name="terms"
                      maxLength={4000}
                      defaultValue={
                        draft === "edit"
                          ? (committee?.terms_of_reference ?? "")
                          : ""
                      }
                    />
                  </Field>
                  <Field
                    label={t(
                      "Months between meetings",
                      "اجلاسوں کے درمیان مہینے",
                    )}
                  >
                    <input
                      data-help="committee.setup"
                      name="frequency"
                      type="number"
                      min={1}
                      max={60}
                      required
                      defaultValue={
                        draft === "edit" ? committee?.meets_every_months : 1
                      }
                    />
                  </Field>
                  {draft === "edit" && (
                    <label>
                      <input
                        type="checkbox"
                        data-help="committee.setup"
                        name="active"
                        defaultChecked={committee?.is_active}
                      />{" "}
                      {t("Active", "فعال")}
                    </label>
                  )}
                  <p>
                    {t(
                      "Choose one chair and one secretary. Include the departments represented.",
                      "ایک صدر اور ایک سیکرٹری چنیں۔ نمائندہ شعبے شامل کریں۔",
                    )}
                  </p>
                </>
              )}
              {(draft === "schedule" || draft === "minutes") && (
                <>
                  <Field label={t("Meeting date", "اجلاس تاریخ")}>
                    <input
                      type="date"
                      data-help="committee.minutes"
                      name="date"
                      required
                      defaultValue={
                        draft === "minutes" ? meeting?.held_on : period.date_to
                      }
                    />
                  </Field>
                  <Field label={t("Venue", "جگہ")}>
                    <input
                      data-help="committee.minutes"
                      name="venue"
                      maxLength={200}
                      defaultValue={
                        draft === "minutes" ? (meeting?.venue ?? "") : ""
                      }
                    />
                  </Field>
                  <Field label={t("Agenda", "ایجنڈا")}>
                    <textarea
                      data-help="committee.minutes"
                      name="agenda"
                      maxLength={4000}
                      defaultValue={
                        draft === "minutes" ? (meeting?.agenda ?? "") : ""
                      }
                    />
                  </Field>
                </>
              )}
              {(isDirectory || draft === "minutes") && (
                <>
                  {draft === "minutes" && committee?.members.length !== 0 && (
                    <button
                      type="button"
                      data-help="committee.minutes"
                      onClick={() => setMembers(committee?.members ?? [])}
                    >
                      {t(
                        "Load committee members as attendees",
                        "کمیٹی ارکان بطور شرکاء شامل کریں",
                      )}
                    </button>
                  )}
                  {members.map((x, i) => (
                    <fieldset className="card" key={i}>
                      <legend>
                        {t(
                          draft === "minutes" ? "Attendee" : "Member",
                          draft === "minutes" ? "شریک" : "رکن",
                        )}{" "}
                        {i + 1}
                      </legend>
                      <Field label={t("Staff member", "عملہ رکن")}>
                        <select
                          data-help="committee.setup"
                          value={x.user_id ?? ""}
                          onChange={(e) => {
                            const p = staff.data?.find(
                              (y) => String(y.user_id) === e.target.value,
                            );
                            patchMember(i, {
                              user_id: p?.user_id ?? null,
                              name: p?.display_name ?? "",
                              represents: p?.department_name ?? x.represents,
                            });
                          }}
                        >
                          <option value="">
                            {t("External / choose staff", "بیرونی / عملہ چنیں")}
                          </option>
                          {staff.data?.map((p) => (
                            <option key={p.user_id} value={p.user_id}>
                              {p.display_name} · {p.department_name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {!x.user_id && (
                        <Field label={t("External name", "بیرونی نام")}>
                          <input
                            data-help="committee.setup"
                            required
                            value={x.name ?? ""}
                            maxLength={200}
                            onChange={(e) =>
                              patchMember(i, { name: e.target.value })
                            }
                          />
                        </Field>
                      )}
                      <Field label={t("Role", "کردار")}>
                        <select
                          data-help="committee.setup"
                          value={x.role ?? "Member"}
                          onChange={(e) =>
                            patchMember(i, {
                              role: e.target.value as Member["role"],
                            })
                          }
                        >
                          {Object.entries(roles).map(([key, ur]) => (
                            <option key={key} value={key}>
                              {t(key, ur)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label={t("Department represented", "نمائندہ شعبہ")}
                      >
                        <select
                          data-help="committee.setup"
                          value={x.represents ?? ""}
                          onChange={(e) =>
                            patchMember(i, {
                              represents: e.target.value || null,
                            })
                          }
                        >
                          <option value="">—</option>
                          {departments.data
                            ?.filter((p) => p.is_active)
                            .map((p) => (
                              <option key={p.department_id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          {x.represents &&
                            !departments.data?.some(
                              (p) => p.is_active && p.name === x.represents,
                            ) && (
                              <option value={x.represents}>
                                {x.represents}
                              </option>
                            )}
                        </select>
                      </Field>
                      <button
                        type="button"
                        data-help="committee.setup"
                        onClick={() =>
                          setMembers((all) =>
                            all.filter((_, index) => index !== i),
                          )
                        }
                      >
                        {t("Remove member", "رکن ہٹائیں")}
                      </button>
                    </fieldset>
                  ))}
                  <button
                    data-help="committee.setup"
                    type="button"
                    onClick={() =>
                      setMembers((x) => [...x, { role: "Member" }])
                    }
                  >
                    {t("Add member", "رکن شامل کریں")}
                  </button>
                </>
              )}
              {draft === "minutes" &&
                (
                  [
                    ["apologies", t("Apologies", "معذرت"), meeting?.apologies],
                    [
                      "issues",
                      t("Issues discussed", "زیر بحث مسائل"),
                      meeting?.issues,
                    ],
                    [
                      "activities",
                      t(
                        "Quality activities reviewed",
                        "جائزہ شدہ معیار سرگرمیاں",
                      ),
                      meeting?.activities,
                    ],
                    [
                      "outcomes",
                      t("Decisions and outcomes", "فیصلے اور نتائج"),
                      meeting?.outcomes,
                    ],
                  ] as const
                ).map(([name, label, value]) => (
                  <Field key={name} label={label}>
                    <textarea
                      name={name}
                      data-help="committee.minutes"
                      maxLength={6000}
                      defaultValue={value ?? ""}
                    />
                  </Field>
                ))}
              {draft === "finalize" && (
                <p>
                  {meeting?.meeting_number} ·{" "}
                  {t(
                    "This approval finalizes and stamps the minutes.",
                    "یہ منظوری کارروائی حتمی اور دستخط شدہ بنائے گی۔",
                  )}
                </p>
              )}
              {draft === "action" && (
                <>
                  <Field label={t("Action type", "کارروائی قسم")}>
                    <select name="actionType" data-help="committee.action">
                      <option value="Corrective">
                        {t("Corrective", "اصلاحی")}
                      </option>
                      <option value="Preventive">
                        {t("Preventive", "احتیاطی")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("Action description", "کارروائی تفصیل")}>
                    <textarea
                      name="description"
                      data-help="committee.action"
                      required
                      maxLength={2000}
                    />
                  </Field>
                  <Field label={t("Action owner", "کارروائی ذمہ دار")}>
                    <select name="owner" data-help="committee.action" required>
                      <option value="">—</option>
                      {staff.data?.map((x) => (
                        <option key={x.user_id} value={x.user_id}>
                          {x.display_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("Department", "شعبہ")}>
                    <select name="department" data-help="committee.action">
                      <option value="">—</option>
                      {departmentOptions}
                    </select>
                  </Field>
                  <Field label={t("Due date", "مقررہ تاریخ")}>
                    <input
                      type="date"
                      name="due"
                      data-help="committee.action"
                      required
                    />
                  </Field>
                </>
              )}
              <ConfirmEntry />
            </fieldset>
            <ClinicalWriteFeedback write={write} />
            <button
              className="primary"
              data-help="p9c.write"
              disabled={
                !edit ||
                (isDirectory &&
                  (members.filter((x) => x.role === "Chair").length !== 1 ||
                    members.filter((x) => x.role === "Secretary").length !== 1))
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
