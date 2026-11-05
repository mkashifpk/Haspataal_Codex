import {canReadDirectory} from "../DirectoryPicker";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, getWithClock } from "../bridge";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { useClinicalWrite } from "../clinical-write";
import { canRetryWrite } from "../write-attempt";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t, tr } from "../i18n";
import { hospitalTimeInput, hospitalTimeToUtc } from "../hospital-time";
import * as roster from "../generated/duty_roster";
import {
  dutyPatch,
  rosterAddDays,
  rosterAreas,
  rosterCopyPeriod,
  rosterDay,
  rosterIsoDay,
  rosterManagePermissions,
  rosterOnLeave,
  rosterReadPermissions,
  rosterRecoveryMayRelease,
  rosterSnapshot,
  swapIsSelf,
  validateDuty,
} from "../roster-policy";
type Form = { entry: roster.EntryIn; original?: roster.RosterEntryOut };
type Command = {
  summary?: string[];
  kind: "batch" | "edit" | "cancel" | "copy" | "record" | "approve" | "reject";
  path: string;
  method: "POST" | "PATCH";
  body: any;
  protection: "idempotent" | "reconcile";
  original?: roster.RosterEntryOut;
  returnOriginal?: roster.RosterEntryOut;
  covering?: roster.RosterableStaffOut;
  swap?: roster.DutySwapOut;
  reconcilePath: string;
  label: string;
};
const swapStates = [
  "Requested",
  "Accepted",
  "Approved",
  "Declined",
  "Rejected",
  "Cancelled",
  "Expired",
] as const;
const entryBody = (r: roster.RosterEntryOut): roster.EntryIn => ({
  employee_id: r.employee_id,
  roster_date: r.roster_date,
  shift_pattern_id: r.shift_pattern_id,
  duty_area: r.duty_area,
  ward_id: r.ward_id,
  department_id: r.department_id,
  zone_label: r.zone_label,
  bed_ids: r.bed_ids,
  is_on_call: r.is_on_call,
  notes: r.notes,
});
const statusLabel = (s: string) =>
  (
    ({
      Active: t("Active", "فعال"),
      Cancelled: t("Cancelled", "منسوخ"),
      Requested: t("Requested", "درخواست"),
      Accepted: t(
        "Accepted — awaiting manager",
        "دونوں راضی — منتظم کا انتظار",
      ),
      Approved: t("Approved", "منظور"),
      Declined: t("Declined", "ساتھی نے انکار کیا"),
      Rejected: t("Rejected", "نامنظور"),
      Expired: t("Expired", "مدت ختم"),
      NoRestDay: t("No rest day", "آرام کا دن نہیں"),
      NotRostered: t("Not rostered", "ڈیوٹی درج نہیں"),
      Ok: t("Rest allowance met", "آرام کی شرط پوری"),
    }) as Record<string, string>
  )[s] || s;
const areaLabel = (s: string) =>
  (
    ({
      Ward: t("Ward", "وارڈ"),
      Department: t("Department", "شعبہ"),
      Emergency: t("Emergency", "ایمرجنسی"),
      OT: t("OT", "آپریشن تھیٹر"),
      Facility: t("Facility", "ادارہ"),
      Other: t("Other", "دیگر"),
    }) as Record<string, string>
  )[s] || s;
export function DutyRoster({
  user,
  connected,
  stream,
  timeZone,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  timeZone?: string;
}) {
  const managePermission = rosterManagePermissions.find((p) =>
      user.permissions.includes(p),
    ),
    canManage = !!managePermission,
    canRead = rosterReadPermissions.some((p) => user.permissions.includes(p));
  const [revision, setRevision] = useState(0),
    [anchor, setAnchor] = useState(""),
    [anchorInput, setAnchorInput] = useState(""),
    [ward, setWard] = useState(""),
    [department, setDepartment] = useState(""),
    [cancelled, setCancelled] = useState(false),
    [find, setFind] = useState(""),
    [selected, setSelected] = useState(0),
    [tab, setTab] = useState("grid"),
    [swapStatus, setSwapStatus] = useState("");
  const [drafts, setDrafts] = useState<roster.EntryIn[]>([]),
    [form, setForm] = useState<Form>(),
    [command, setCommand] = useState<Command>(),
    [ack, setAck] = useState(false),
    [error, setError] = useState<unknown>(),
    [last, setLast] = useState<{ kind: string; value: any }>(),
    [recovery, setRecovery] = useState<any>(),
    [recovering, setRecovering] = useState(false);
  const [copy, setCopy] = useState<roster.CopyIn>(),
    [swapForm, setSwapForm] = useState<{
      roster_id: number;
      covering_employee_id: number;
      return_roster_id: number;
      reason: string;
      agreed: boolean;
    }>(),
    [noteForm, setNoteForm] = useState<{
      kind: "cancel" | "approve" | "reject";
      row?: roster.RosterEntryOut;
      swap?: roster.DutySwapOut;
      note: string;
    }>();
  const live = connected && stream === "Live",
    liveRef = useRef({ live, user });
  liveRef.current = { live, user };
  const clock = useLoad(
    () => getWithClock<ClinicalUser>("/auth/me"),
    [user.user_id, revision],
  );
  let today = "";
  try {
    if (clock.data?.now && timeZone)
      today = hospitalTimeInput(clock.data.now, timeZone).slice(0, 10);
  } catch {}
  const filters = useMemo(
    () => ({
      ward_id: ward ? Number(ward) : undefined,
      department_id: department ? Number(department) : undefined,
    }),
    [ward, department],
  );
  const week = useLoad(
    () =>
      canRead
        ? roster.weekCheck({ ...filters, week_of: anchor || undefined })
        : Promise.resolve(undefined),
    [canRead, filters, anchor, revision],
  );
  const wk = !week.loading && !week.error ? week.data : undefined;
  const start = wk?.week_start,
    end = wk?.week_end;
  const planner = useLoad(
    () =>
      canManage && start && end
        ? roster.staffRosters({
            date_from: start,
            date_to: end,
            department_id: filters.department_id,
          })
        : Promise.resolve(undefined),
    [canManage, start, end, filters.department_id, revision],
  );
  const list = useLoad(
    () =>
      canRead && start && end
        ? roster.listEntriesRosters({
            ...filters,
            date_from: start,
            date_to: end,
            include_cancelled: cancelled,
          })
        : Promise.resolve(undefined),
    [canRead, start, end, filters, cancelled, revision],
  );
  const beds = useLoad(
    () =>
      canReadDirectory("/beds/matrix",user.permissions)
        ? roster.bedMatrix()
        : Promise.resolve(undefined),
    [canReadDirectory("/beds/matrix",user.permissions), revision],
  );
  const swaps = useLoad(
    () =>
      canManage
        ? roster.managerSwaps({
            status: (swapStatus || undefined) as
              roster.DutySwapOut["status"] | undefined,
          })
        : Promise.resolve([]),
    [canManage, swapStatus, revision],
  );
  const staff =
      !planner.loading && !planner.error ? planner.data?.staff || [] : [],
    patterns =
      !planner.loading && !planner.error
        ? planner.data?.shift_patterns || []
        : [],
    rows = !list.loading && !list.error ? list.data?.entries || [] : [];
  const matrix = !beds.loading && !beds.error ? beds.data : undefined;
  const days = start
    ? Array.from({ length: 7 }, (_, i) => rosterAddDays(start, i))
    : [];
  const departmentDirectory=useLoad(()=>roster.departments(),[revision]);
  const departments: [number,string][]=(departmentDirectory.data??[]).filter(row=>row.is_active).map(row=>[row.department_id,row.name]);
  const shifts = Array.from(
    new Map(
      [
        ...rows.map((r) => ({
          shift_pattern_id: r.shift_pattern_id,
          name: r.shift_name,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: false,
        })),
        ...patterns,
      ].map((s) => [s.shift_pattern_id, s]),
    ).values(),
  );
  const ready =
    !!wk &&
    !list.loading &&
    !list.error &&
    !!list.data &&
    (!canManage || (!planner.loading && !planner.error && !!planner.data)) &&
    !!today;
  const write = useClinicalWrite(user, "duty-roster", async (value) => {
    setLast({ kind: command?.kind || "", value });
    if (command?.kind === "batch") setDrafts([]);
    setCommand(undefined);
    setForm(undefined);
    setCopy(undefined);
    setSwapForm(undefined);
    setNoteForm(undefined);
    setRecovery(undefined);
    setRevision((n) => n + 1);
  });
  const blocked = write.blocked || recovering,
    dirty =
      drafts.length > 0 ||
      !!form ||
      !!copy ||
      !!swapForm ||
      !!noteForm ||
      !!command;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = window.terminal.subscribe((e) => {
      if (
        (e.type === "stream" && e.status === "Live" && e.resync) ||
        (e.type === "event" &&
          [
            "roster.changed",
            "roster.swap.updated",
            "bed.state_changed",
          ].includes(e.event_type))
      ) {
        clearTimeout(timer);
        timer = setTimeout(() => setRevision((n) => n + 1), 200);
      }
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, []);
  useEffect(() => {
    if (!dirty && !blocked) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [dirty, blocked]);
  function cancelForm(close: () => void) {
    if (blocked) return;
    if (
      window.confirm(
        t(
          "Discard this unsent roster form?",
          "یہ غیر ارسال ڈیوٹی مسودہ چھوڑ دیں؟",
        ),
      )
    )
      close();
  }
  const mayDay = (day: string) =>
    !!today && (day >= today || user.permissions.includes("roster.manage.all"));
  const notStarted = (d: roster.RosterEntryOut) => {
    try {
      return (
        !!timeZone &&
        !!clock.data?.now &&
        Date.parse(
          hospitalTimeToUtc(d.roster_date + "T" + d.start_time, timeZone),
        ) > Date.parse(clock.data.now)
      );
    } catch {
      return false;
    }
  };
  function begin(
    employee = selected,
    day = start && start < today && end && end >= today ? today : start || "",
    shift = patterns[0]?.shift_pattern_id || 0,
  ) {
    if (!ready || !canManage || blocked) return;
    setError(undefined);
    if (!mayDay(day)) {
      setError(
        Error(
          t(
            "Past duties require HR roster management.",
            "گزشتہ ڈیوٹی کے لیے ایچ آر کی اجازت لازم ہے۔",
          ),
        ),
      );
      return;
    }
    const person = staff.find((s) => s.employee_id === employee);
    if (person && rosterOnLeave(person, day)) {
      setError(
        Error(
          t(
            "This employee is on approved leave that day.",
            "یہ ملازم اس دن منظور شدہ رخصت پر ہے۔",
          ),
        ),
      );
      return;
    }
    setForm({
      entry: {
        employee_id: employee,
        roster_date: day,
        shift_pattern_id: shift,
        duty_area: "Ward",
        ward_id: ward ? Number(ward) : null,
        department_id: null,
        bed_ids: [],
        is_on_call: false,
        notes: "",
        zone_label: "",
      },
    });
  }
  function check(
    entry: roster.EntryIn,
    people = staff,
    ps = patterns,
    bs = matrix?.beds || [],
    day = today,
    perms = user.permissions,
  ) {
    validateDuty(
      entry,
      people,
      ps,
      bs,
      day,
      perms.includes("roster.manage.all"),
    );
    if (
      entry.ward_id &&
      !matrix?.wards.some((w) => w.ward_id === entry.ward_id)
    )
      throw Error(
        t("Choose a current permitted ward.", "موجودہ مجاز وارڈ چنیں۔"),
      );
  }
  function review(c: Command) {
    setError(undefined);
    setAck(false);
    setRecovery(undefined);
    const summary =
      c.kind === "batch"
        ? c.body.entries.map(entryText)
        : c.kind === "copy"
          ? [
              t("Source period", "اصل مدت") +
                ": " +
                c.body.source_from +
                " — " +
                c.body.source_to,
              t("Target starts", "نئی ابتدا") +
                ": " +
                c.body.target_from +
                " · " +
                t("Rotation days", "گردش کے دن") +
                ": " +
                (c.body.rotate_days || 0),
              c.body.ward_id
                ? matrix?.wards.find((w) => w.ward_id === c.body.ward_id)
                    ?.name || "#" + c.body.ward_id
                : t("All permitted wards", "تمام مجاز وارڈ"),
              t(
                "Copies the whole permitted scope, not selected staff only.",
                "پورا مجاز دائرہ نقل، صرف منتخب فرد نہیں۔",
              ),
            ]
          : c.swap
            ? [
                "#" +
                  c.swap.swap_id +
                  " · " +
                  c.swap.requester_name +
                  " → " +
                  c.swap.covering_name,
                c.swap.duty.roster_date + " · " + c.swap.duty.shift_name,
              ]
            : c.original
              ? [
                  c.original.full_name +
                    " · " +
                    c.original.emp_number +
                    " · #" +
                    c.original.roster_id,
                  c.original.roster_date + " · " + c.original.shift_name,
                ]
              : [];
    setCommand(structuredClone({ ...c, summary }));
  }
  const rangePath = (from = start || "", to = end || "", employee?: number) =>
    "/rosters?" +
    new URLSearchParams({
      date_from: from,
      date_to: to,
      include_cancelled: "true",
      ...(employee ? { employee_id: String(employee) } : {}),
    });
  async function preflight(c: Command) {
    const fresh = await getWithClock<ClinicalUser>("/auth/me");
    if (
      !liveRef.current.live ||
      fresh.data.user_id !== user.user_id ||
      !managePermission ||
      !fresh.data.permissions.includes(managePermission)
    )
      throw Error(
        t(
          "Wait for the original permitted user and a live connection.",
          "اصل مجاز صارف اور فعال رابطے کا انتظار کریں۔",
        ),
      );
    if (!timeZone)
      throw Error(
        t(
          "Refresh the hospital timezone before scheduling.",
          "ڈیوٹی سے پہلے ہسپتال کا وقت تازہ کریں۔",
        ),
      );
    const day = hospitalTimeInput(fresh.now, timeZone).slice(0, 10);
    if (c.kind === "copy")
      rosterCopyPeriod(
        c.body.source_from,
        c.body.source_to,
        c.body.target_from,
        c.body.rotate_days || 0,
        day,
        fresh.data.permissions.includes("roster.manage.all"),
      );
    if (c.kind === "batch" || c.kind === "edit") {
      const entries: roster.EntryIn[] =
        c.kind === "batch" ? c.body.entries : [form!.entry];
      const dates = entries.map((e) => e.roster_date).sort();
      const [p, b] = await Promise.all([
        roster.staffRosters({ date_from: dates[0], date_to: dates.at(-1) }),
        canReadDirectory("/beds/matrix",user.permissions)
          ? roster.bedMatrix()
          : Promise.resolve(undefined),
      ]);
      for (const entry of entries)
        validateDuty(
          entry,
          p.staff,
          p.shift_patterns,
          b?.beds || [],
          day,
          fresh.data.permissions.includes("roster.manage.all"),
        );
    }
    if (c.original) {
      const old = c.original;
      const data = await api<roster.RosterRangeOut>(
        "GET",
        rangePath(old.roster_date, old.roster_date, old.employee_id),
      );
      const actual = data.entries.find((r) => r.roster_id === old.roster_id);
      if (!actual || rosterSnapshot(actual) !== rosterSnapshot(old))
        throw Error(
          t(
            "This duty changed. Close the review, refresh and review the current duty.",
            "ڈیوٹی بدل گئی۔ جائزہ بند، تازہ کریں اور موجودہ ڈیوٹی دیکھیں۔",
          ),
        );
      if (!mayDay(old.roster_date))
        throw Error(
          t(
            "Past duties require HR roster management.",
            "گزشتہ ڈیوٹی کے لیے ایچ آر کی اجازت لازم ہے۔",
          ),
        );
    }
    if (c.kind === "record" && c.original) {
      if (
        fresh.data.employee_id === c.original.employee_id ||
        fresh.data.employee_id === c.body.covering_employee_id
      )
        throw Error(
          t(
            "An independent manager must record this swap.",
            "یہ تبادلہ دوسرا مجاز منتظم درج کرے۔",
          ),
        );
      for (const duty of [c.original, c.returnOriginal].filter(
        Boolean,
      ) as roster.RosterEntryOut[]) {
        if (
          Date.parse(
            hospitalTimeToUtc(
              duty.roster_date + "T" + duty.start_time,
              timeZone,
            ),
          ) <= Date.parse(fresh.now)
        )
          throw Error(
            t(
              "The duty has already started. Refresh the swap.",
              "ڈیوٹی شروع ہو چکی۔ تبادلہ تازہ کریں۔",
            ),
          );
        if (duty === c.returnOriginal) {
          const data = await api<roster.RosterRangeOut>(
            "GET",
            rangePath(duty.roster_date, duty.roster_date, duty.employee_id),
          );
          if (
            !data.entries.some(
              (r) => rosterSnapshot(r) === rosterSnapshot(duty),
            )
          )
            throw Error(
              t(
                "The return duty changed. Review again.",
                "بدلے کی ڈیوٹی بدل گئی۔ دوبارہ جائزہ کریں۔",
              ),
            );
        }
      }
      const permitted = await roster.staffRosters({
        date_from: c.original.roster_date,
        date_to: c.original.roster_date,
      });
      if (
        !permitted.staff.some(
          (s) =>
            s.employee_id === c.body.covering_employee_id &&
            s.staff_category === c.original!.staff_category,
        )
      )
        throw Error(
          t(
            "The covering colleague is no longer in the permitted scope.",
            "متبادل ساتھی اب مجاز دائرے میں نہیں۔",
          ),
        );
    }
    if (c.swap) {
      const data = await roster.managerSwaps({ status: "Accepted" });
      const actual = data.find((s) => s.swap_id === c.swap!.swap_id);
      if (
        !actual ||
        actual.row_version !== c.swap.row_version ||
        swapIsSelf(fresh.data.employee_id, actual)
      )
        throw Error(
          t(
            "The swap changed or you are one of its colleagues. Refresh before another decision.",
            "تبادلہ بدل گیا یا آپ اس میں شامل ہیں۔ دوسرے فیصلے سے پہلے تازہ کریں۔",
          ),
        );
    }
    if (!liveRef.current.live)
      throw Error(
        t(
          "Connection changed before submission.",
          "ارسال سے پہلے رابطہ بدل گیا۔",
        ),
      );
  }
  function confirm() {
    if (!command || !ack || blocked || !managePermission) return;
    const c = command;
    write.start(
      {
        method: c.method,
        path: c.path,
        body: c.body,
        permission: managePermission,
        protection: c.protection,
        reconcilePath: c.reconcilePath,
        label: c.label,
      },
      () => preflight(c),
    );
  }
  async function inspect() {
    setRecovering(true);
    setRecovery(undefined);
    setError(undefined);
    try {
      await write.inspect();
      const c = command;
      if (c?.swap) {
        const all = await Promise.all(
          swapStates.map((status) => roster.managerSwaps({ status })),
        );
        const exact = all.flat().find((s) => s.swap_id === c.swap!.swap_id);
        setRecovery(
          exact ? { kind: "swap", record: exact } : { kind: "missing" },
        );
      } else if (c?.original && ["edit", "cancel"].includes(c.kind)) {
        const days = Array.from(
          new Set([c.original.roster_date, c.body.roster_date].filter(Boolean)),
        ) as string[];
        const actual = await Promise.all(
          days.map((d) =>
            api<roster.RosterRangeOut>(
              "GET",
              rangePath(d, d, c.original!.employee_id),
            ),
          ),
        );
        setRecovery({
          kind: "duty",
          record: actual
            .flatMap((v) => v.entries)
            .find((r) => r.roster_id === c.original!.roster_id),
        });
      } else {
        setRecovery({ kind: "read" });
      }
    } catch (e) {
      setError(e);
    } finally {
      setRecovering(false);
    }
  }
  const batchError = (write.error as any)?.response?.error?.details
    ?.entry_index;
  const originalResult =
    recovery?.kind === "duty"
      ? recovery.record
      : command?.original
        ? (write.observed as roster.RosterRangeOut | undefined)?.entries?.find(
            (r) => r.roster_id === command.original!.roster_id,
          )
        : undefined;
  function prepareForm() {
    if (!form) return;
    setError(undefined);
    try {
      check(form.entry);
      if (form.original) {
        const body = dutyPatch(form.original, form.entry),
          from = [form.original.roster_date, form.entry.roster_date].sort();
        review({
          kind: "edit",
          method: "PATCH",
          path: "/rosters/" + form.original.roster_id,
          body,
          protection: "reconcile",
          original: form.original,
          reconcilePath: rangePath(
            form.original.roster_date,
            form.original.roster_date,
            form.original.employee_id,
          ),
          label: t("Change duty", "ڈیوٹی تبدیل کریں"),
        });
      } else {
        if (drafts.length >= 500)
          throw Error(
            t(
              "A batch may contain at most 500 duties.",
              "ایک مسودے میں زیادہ سے زیادہ 500 ڈیوٹیاں۔",
            ),
          );
        setDrafts((d) => [...d, structuredClone(form.entry)]);
        setForm(undefined);
      }
    } catch (e) {
      setError(e);
    }
  }
  if (!canRead)
    return (
      <Empty>
        {t(
          "You do not have permission to view this roster.",
          "آپ کو اس ڈیوٹی فہرست کی اجازت نہیں۔",
        )}
      </Empty>
    );
  const entryText = (e: roster.EntryIn) =>
    [
      staff.find((s) => s.employee_id === e.employee_id)?.full_name ||
        "#" + e.employee_id,
      e.roster_date,
      patterns.find((s) => s.shift_pattern_id === e.shift_pattern_id)?.name ||
        "#" + e.shift_pattern_id,
      areaLabel(e.duty_area || "Department"),
      matrix?.wards.find((w) => w.ward_id === e.ward_id)?.name,
      e.zone_label,
      (e.bed_ids || [])
        .map(
          (id) => matrix?.beds?.find((b) => b.bed_id === id)?.label || "#" + id,
        )
        .join(", "),
      e.is_on_call ? t("On call", "آن کال") : "",
      e.notes,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <section
      data-unsaved={dirty ? "true" : "false"}
      data-write-pending={blocked ? "true" : "false"}
    >
      <header className="section-head roster-heading">
        <div>
          <h1>{t("Nursing duty roster", "نرسنگ ڈیوٹی روسٹر")}</h1>
          <p>
            {t(
              "Plan the whole week, including Sunday. Review duties before saving.",
              "اتوار سمیت پورے ہفتے کی منصوبہ بندی۔ محفوظ کرنے سے پہلے ڈیوٹیاں چیک کریں۔",
            )}
          </p>
        </div>
        <button
          data-help="roster.refresh"
          disabled={blocked}
          onClick={() => setRevision((n) => n + 1)}
        >
          {t("Refresh roster", "روسٹر تازہ کریں")}
        </button>
      </header>
      {!live && (
        <p role="status" className="notice">
          {t(
            "Reconnecting — scheduling waits for Live. Unsent work is kept.",
            "دوبارہ رابطہ — ڈیوٹی کے لیے فعال رابطے کا انتظار۔ مسودہ محفوظ ہے۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      <ErrorBox error={write.error} verbatim />
      {write.notice && <p role="status">{write.notice}</p>}
      <LoadState {...clock} retry={clock.reload} />
      {!today && !clock.loading && (
        <p role="alert">
          {t(
            "Hospital date is unavailable. Refresh before scheduling.",
            "ہسپتال کی تاریخ نہیں ملی۔ ڈیوٹی سے پہلے تازہ کریں۔",
          )}
        </p>
      )}
      <fieldset disabled={blocked || !!form || !!command}>
        <section className="card">
          <form
            className="form-grid roster-period-form"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                rosterDay(anchorInput);
                setAnchor(anchorInput);
              } catch (e) {
                setError(e);
              }
            }}
          >
            <Field
              label={t("Any date in roster week", "روسٹر ہفتے کی کوئی تاریخ")}
            >
              <input
                data-help="roster.period"
                type="date"
                value={anchorInput || start || ""}
                onChange={(e) => setAnchorInput(e.target.value)}
              />
            </Field>
            <button data-help="roster.period">
              {t("Open week", "ہفتہ کھولیں")}
            </button>
            <Field label={t("Filter ward", "وارڈ چھانٹیں")}>
              <select data-field="ward_id"
                data-help="roster.filters"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
              >
                <option value="">
                  {t("All permitted wards", "تمام مجاز وارڈ")}
                </option>
                {matrix?.wards.map((w) => (
                  <option key={w.ward_id} value={w.ward_id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Filter department", "شعبہ چھانٹیں")}>
              <select data-field="department_id"
                data-help="roster.filters"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">
                  {t("All permitted departments", "تمام مجاز شعبے")}
                </option>
                {departments.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <label>
              <input
                data-help="roster.filters"
                type="checkbox"
                checked={cancelled}
                onChange={(e) => setCancelled(e.target.checked)}
              />
              {t("Show cancelled duties", "منسوخ ڈیوٹیاں دکھائیں")}
            </label>
          </form>
        </section>
      </fieldset>
      <LoadState {...week} retry={week.reload} />
      <LoadState {...list} retry={list.reload} />
      {canManage && <LoadState {...planner} retry={planner.reload} />}
      <LoadState {...beds} retry={beds.reload} />
      <LoadState {...departmentDirectory} retry={departmentDirectory.reload} />
      {wk && (
        <p>
          <bdi>
            {start} — {end}
          </bdi>{" "}
          ·{" "}
          {t(
            "Hospital dates; night duty belongs to its start date.",
            "ہسپتال کی تاریخیں؛ رات کی ڈیوٹی آغاز کی تاریخ کی ہے۔",
          )}
        </p>
      )}
      <nav
        className="roster-panels"
        aria-label={t("Roster panels", "روسٹر حصے")}
      >
        <button
          data-help="roster.tabs"
          aria-pressed={tab === "grid"}
          disabled={blocked}
          onClick={() => setTab("grid")}
        >
          {t("Week planner", "ہفتہ منصوبہ")}
        </button>
        <button
          data-help="roster.tabs"
          aria-pressed={tab === "check"}
          disabled={blocked}
          onClick={() => setTab("check")}
        >
          {t("Week check", "ہفتے کی جانچ")}
        </button>
        {canManage && (
          <button
            data-help="roster.tabs"
            aria-pressed={tab === "swaps"}
            disabled={blocked}
            onClick={() => setTab("swaps")}
          >
            {t("Swaps", "ڈیوٹی کے تبادلے")}
          </button>
        )}
      </nav>
      {ready && tab === "grid" && (
        <div className="roster-planner-layout">
          {canManage && (
            <section className="card roster-staff-panel">
              <h2>
                {t("Staff I may roster", "وہ عملہ جس کی ڈیوٹی لگا سکتا ہوں")}
              </h2>
              <Field label={t("Find in permitted staff", "مجاز عملے میں تلاش")}>
                <input
                  data-help="roster.staff"
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                />
              </Field>
              <div className="roster-staff">
                {staff
                  .filter((s) =>
                    (s.full_name + " " + s.emp_number)
                      .toLowerCase()
                      .includes(find.toLowerCase()),
                  )
                  .map((s) => (
                    <button
                      data-help="roster.staff"
                      draggable={!blocked}
                      onDragStart={(e) => {
                        setSelected(s.employee_id);
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData(
                          "text/plain",
                          String(s.employee_id),
                        );
                        e.dataTransfer.setData(
                          "application/haspataal-roster-staff",
                          String(s.employee_id),
                        );
                      }}
                      disabled={blocked}
                      key={s.employee_id}
                      aria-pressed={selected === s.employee_id}
                      onClick={() => setSelected(s.employee_id)}
                    >
                      <bdi>
                        {s.full_name} · {s.emp_number}
                      </bdi>{" "}
                      ·{" "}
                      {s.default_shift_pattern_id
                        ? patterns.find(
                            (p) =>
                              p.shift_pattern_id === s.default_shift_pattern_id,
                          )?.name
                        : t("Roster only", "صرف روسٹر")}
                      <small>
                        {t("Weekly off (ISO 1–7)", "ہفتہ وار چھٹی (1تا7)")}:{" "}
                        {s.default_weekly_off_days.join(", ") || "—"}
                      </small>
                      {s.leave.map((l, i) => (
                        <small key={i}>
                          {t("Approved leave", "منظور شدہ رخصت")}: {l.from_date}{" "}
                          — {l.to_date}
                        </small>
                      ))}
                    </button>
                  ))}
              </div>
              {!staff.length && (
                <Empty>
                  {t(
                    "No active staff in this permitted scope. Ask HR.",
                    "اس مجاز دائرے میں فعال عملہ نہیں۔ ایچ آر سے رابطہ کریں۔",
                  )}
                </Empty>
              )}
              {staff.length > 0 &&
                !staff.some((s) =>
                  (s.full_name + " " + s.emp_number)
                    .toLowerCase()
                    .includes(find.toLowerCase()),
                ) && (
                  <Empty>
                    {t(
                      "No permitted staff match this search. Clear or change the search.",
                      "اس تلاش میں مجاز عملہ نہیں ملا۔ تلاش صاف یا تبدیل کریں۔",
                    )}
                  </Empty>
                )}
              <p>
                {t(
                  "Select a person then Add in a cell, or drag them onto it. Grey days show their leave or fixed weekly off; weekly off can be rostered, approved leave cannot.",
                  "فرد چنیں پھر خانے میں شامل کریں، یا کھینچیں۔ سرمئی دن رخصت یا مقررہ چھٹی؛ چھٹی پر ڈیوٹی ممکن، منظور رخصت پر نہیں۔",
                )}
              </p>
              <button
                data-help="roster.add"
                disabled={!live || blocked}
                onClick={() => begin()}
              >
                {t("Add duty", "ڈیوٹی شامل کریں")}
              </button>
              <button
                data-help="roster.copy"
                disabled={!live || blocked}
                onClick={() =>
                  setCopy({
                    source_from: rosterAddDays(start!, -7),
                    source_to: rosterAddDays(start!, -1),
                    target_from: start!,
                    rotate_days: 0,
                    ...filters,
                  })
                }
              >
                {t("Repeat last week", "پچھلا ہفتہ دہرائیں")}
              </button>
            </section>
          )}
          <section className="card">
            <h2>{t("Weekly grid", "ہفتہ وار جدول")}</h2>
            <div
              className="roster-scroll"
              tabIndex={0}
              role="region"
              aria-label={t("Weekly duty grid", "ہفتہ وار ڈیوٹی جدول")}
            >
              <table className="roster-grid">
                <thead>
                  <tr>
                    <th>{t("Shift", "شفٹ")}</th>
                    {days.map((day) => (
                      <th key={day}>
                        <bdi>{day}</bdi>
                        <br />
                        {
                          [
                            t("Monday", "پیر"),
                            t("Tuesday", "منگل"),
                            t("Wednesday", "بدھ"),
                            t("Thursday", "جمعرات"),
                            t("Friday", "جمعہ"),
                            t("Saturday", "ہفتہ"),
                            t("Sunday", "اتوار"),
                          ][rosterIsoDay(day) - 1]
                        }
                        {planner.data?.holidays
                          .filter((h) => h.holiday_date === day)
                          .map((h) => (
                            <p className="notice" key={h.holiday_id}>
                              {h.name}
                            </p>
                          ))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.shift_pattern_id}>
                      <th>
                        <bdi>
                          {shift.name}
                          <br />
                          {shift.start_time.slice(0, 5)}–
                          {shift.end_time.slice(0, 5)}
                        </bdi>
                        {shift.end_time <= shift.start_time && (
                          <small>{t("Next morning", "اگلی صبح")}</small>
                        )}
                      </th>
                      {days.map((day) => {
                        const person = staff.find(
                            (s) => s.employee_id === selected,
                          ),
                          leave = person && rosterOnLeave(person, day),
                          off =
                            person &&
                            person.default_weekly_off_days.includes(
                              rosterIsoDay(day),
                            );
                        return (
                          <td
                            key={day}
                            className={leave || off ? "roster-muted" : ""}
                            onDragOver={(e) => {
                              if (canManage && !blocked) {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "copy";
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const employee = Number(
                                e.dataTransfer.getData(
                                  "application/haspataal-roster-staff",
                                ) || e.dataTransfer.getData("text/plain"),
                              );
                              if (staff.some((s) => s.employee_id === employee))
                                begin(employee, day, shift.shift_pattern_id);
                            }}
                          >
                            {leave && (
                              <p>
                                {t(
                                  "Selected staff: approved leave",
                                  "منتخب عملہ: منظور رخصت",
                                )}
                              </p>
                            )}
                            {off && (
                              <p>
                                {t(
                                  "Selected staff: fixed day off",
                                  "منتخب عملہ: مقررہ چھٹی",
                                )}
                              </p>
                            )}
                            {rows
                              .filter(
                                (r) =>
                                  r.roster_date === day &&
                                  r.shift_pattern_id === shift.shift_pattern_id,
                              )
                              .map((r) => (
                                <article
                                  className="roster-duty"
                                  key={r.roster_id}
                                >
                                  <strong>
                                    <bdi>{r.full_name}</bdi>
                                  </strong>
                                  <p>
                                    #{r.roster_id} · {statusLabel(r.status)} ·{" "}
                                    {r.ward_name ||
                                      r.department_name ||
                                      areaLabel(r.duty_area)}{" "}
                                    · {r.zone_label}
                                  </p>
                                  {r.bed_ids.length > 0 && (
                                    <p>
                                      {t("Beds", "بستر")}:{" "}
                                      {r.bed_ids
                                        .map(
                                          (id) =>
                                            matrix?.beds?.find(
                                              (b) => b.bed_id === id,
                                            )?.label || "#" + id,
                                        )
                                        .join(", ")}
                                    </p>
                                  )}
                                  {r.is_on_call && (
                                    <p>{t("On call", "آن کال")}</p>
                                  )}
                                  {r.swap_id && (
                                    <p>
                                      {t("Swap", "تبادلہ")} #{r.swap_id}
                                    </p>
                                  )}
                                  {r.notes && <p>{r.notes}</p>}
                                  {r.cancel_reason && <p>{r.cancel_reason}</p>}
                                  {canManage && r.status === "Active" && (
                                    <>
                                      <button
                                        data-help="roster.edit"
                                        disabled={
                                          !live ||
                                          blocked ||
                                          !mayDay(r.roster_date)
                                        }
                                        onClick={() => {
                                          setError(undefined);
                                          setForm({
                                            entry: entryBody(r),
                                            original: structuredClone(r),
                                          });
                                        }}
                                      >
                                        {t("Edit duty", "ڈیوٹی بدلیں")} #
                                        {r.roster_id}
                                      </button>
                                      <button
                                        data-help="roster.cancel"
                                        disabled={
                                          !live ||
                                          blocked ||
                                          !mayDay(r.roster_date)
                                        }
                                        onClick={() =>
                                          setNoteForm({
                                            kind: "cancel",
                                            row: structuredClone(r),
                                            note: "",
                                          })
                                        }
                                      >
                                        {t("Cancel duty", "ڈیوٹی منسوخ کریں")} #
                                        {r.roster_id}
                                      </button>
                                    </>
                                  )}
                                </article>
                              ))}
                            {drafts
                              .filter(
                                (d) =>
                                  d.roster_date === day &&
                                  d.shift_pattern_id === shift.shift_pattern_id,
                              )
                              .map((d, i) => (
                                <p className="notice" key={i}>
                                  {t("Unsent", "غیر ارسال")}: {entryText(d)}
                                </p>
                              ))}
                            {canManage && (
                              <button
                                data-help="roster.add"
                                disabled={
                                  !live ||
                                  blocked ||
                                  !selected ||
                                  !!leave ||
                                  !mayDay(day) ||
                                  !shift.is_active
                                }
                                onClick={() =>
                                  begin(selected, day, shift.shift_pattern_id)
                                }
                              >
                                {t("Add", "شامل کریں")} · {shift.name} · {day}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>
                      {t("On duty / leave / rest", "ڈیوٹی / رخصت / آرام")}
                    </th>
                    {days.map((day) => {
                      const d = wk.days.find((d) => d.day === day);
                      return (
                        <td key={day}>
                          {d ? (
                            <>
                              <p>
                                {d.on_duty} / {d.on_leave} / {d.resting}
                              </p>
                              {d.shifts.map((s) => (
                                <p key={s.shift_pattern_id}>
                                  {s.shift_name}: {s.staff}
                                </p>
                              ))}
                            </>
                          ) : (
                            t("Not recorded", "درج نہیں")
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
            {!rows.length && (
              <Empty>
                {t(
                  "No duties match this week and filters. Add a permitted duty or change the filters.",
                  "اس ہفتے اور چھانٹی میں ڈیوٹی نہیں۔ مجاز ڈیوٹی شامل یا چھانٹی بدلیں۔",
                )}
              </Empty>
            )}
          </section>
        </div>
      )}
      {drafts.length > 0 && (
        <section className="card">
          <h2>{t("Unsent duty batch", "ڈیوٹی کا غیر ارسال مسودہ")}</h2>
          <ol>
            {drafts.map((d, i) => (
              <li
                className={batchError === i ? "error" : ""}
                aria-invalid={batchError === i}
                key={i}
              >
                <b>
                  {t("Entry", "اندراج")} {i + 1}
                </b>
                : {entryText(d)}
                <button
                  data-help="roster.batch"
                  disabled={blocked}
                  onClick={() =>
                    setDrafts((ds) => ds.filter((_, n) => n !== i))
                  }
                >
                  {t("Remove unsent entry", "غیر ارسال اندراج ہٹائیں")} {i + 1}
                </button>
              </li>
            ))}
          </ol>
          <p>
            {t(
              "All duties save together or none do. Check the entry named by an error.",
              "تمام ڈیوٹیاں ایک ساتھ محفوظ ہوں گی یا کوئی نہیں۔ خرابی والے اندراج کو چیک کریں۔",
            )}
          </p>
          <button
            data-help="roster.batch"
            disabled={!live || blocked || !ready}
            onClick={() => {
              try {
                drafts.forEach((d) => check(d));
                review({
                  kind: "batch",
                  path: "/rosters",
                  method: "POST",
                  body: { entries: drafts },
                  protection: "idempotent",
                  reconcilePath: rangePath(),
                  label: t("Save duty batch", "ڈیوٹی مسودہ محفوظ کریں"),
                });
              } catch (e) {
                setError(e);
              }
            }}
          >
            {t("Review duty batch", "ڈیوٹی مسودے کا جائزہ")}
          </button>
        </section>
      )}
      {ready && tab === "check" && (
        <section className="card">
          <h2>{t("Week check", "ہفتے کی جانچ")}</h2>
          <p>
            {t("Required weekly rest days", "ضروری ہفتہ وار آرام")}:{" "}
            {wk!.rest_days_due} ·{" "}
            {t("Staff without enough rest", "ناکافی آرام والا عملہ")}:{" "}
            {wk!.staff_without_rest_day}
          </p>
          {wk!.staff.map((s) => (
            <article
              key={s.employee_id}
              className={
                s.status === "NoRestDay"
                  ? "notice"
                  : s.status === "NotRostered"
                    ? "muted"
                    : "card"
              }
            >
              <strong>
                {s.full_name} · {s.emp_number} · {statusLabel(s.status)}
              </strong>
              <p>
                {t(
                  "Working days / extra duty days",
                  "کام کے دن / اضافی ڈیوٹی دن",
                )}
                : {s.working_days} / {s.extra_duty_days}
              </p>
              <p>
                {t("Duties", "ڈیوٹیاں")}: {s.duty_dates.join(", ") || "—"}
              </p>
              <p>
                {t("Rest", "آرام")}: {s.rest_dates.join(", ") || "—"}
              </p>
              <p>
                {t("Leave", "رخصت")}: {s.leave_dates.join(", ") || "—"}
              </p>
            </article>
          ))}
          <p>
            {t(
              "Extra duty is the server allowance result; this screen does not calculate pay. Sunday remains a normal planning day.",
              "اضافی ڈیوٹی سرور کی شرط کا نتیجہ؛ یہ صفحہ تنخواہ نہیں بناتا۔ اتوار عام منصوبہ بندی کا دن ہے۔",
            )}
          </p>
        </section>
      )}
      {tab === "swaps" && canManage && (
        <section className="card">
          <h2>{t("Duty swaps", "ڈیوٹی کے تبادلے")}</h2>
          <Field label={t("Swap status", "تبادلے کی حالت")}>
            <select data-field="status"
              data-help="roster.swaps"
              disabled={blocked}
              value={swapStatus}
              onChange={(e) => setSwapStatus(e.target.value)}
            >
              <option value="">{t("Open swaps", "جاری تبادلے")}</option>
              {swapStates.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <button
            data-help="roster.record-swap"
            disabled={!live || blocked || !ready}
            onClick={() =>
              setSwapForm({
                roster_id: 0,
                covering_employee_id: 0,
                return_roster_id: 0,
                reason: "",
                agreed: false,
              })
            }
          >
            {t("Record agreed swap", "متفقہ تبادلہ درج کریں")}
          </button>
          <LoadState {...swaps} retry={swaps.reload} />
          {!swaps.loading && !swaps.error && !(swaps.data || []).length && (
            <Empty>
              {t("No swaps match this status.", "اس حالت میں تبادلہ نہیں۔")}
            </Empty>
          )}
          {!swaps.loading &&
            !swaps.error &&
            (swaps.data || []).map((s) => (
              <article className="card" key={s.swap_id}>
                <h3>
                  #{s.swap_id} · {statusLabel(s.status)}
                </h3>
                <p>
                  {s.requester_name} → {s.covering_name} · {s.reason}
                </p>
                <p>
                  #{s.roster_id} · {s.duty.roster_date} · {s.duty.shift_name} ·{" "}
                  {s.duty.ward_name || s.duty.department_name} ·{" "}
                  {s.duty.start_time}–{s.duty.end_time}
                </p>
                {s.return_duty && (
                  <p>
                    {t("Return duty", "بدلے کی ڈیوٹی")} #
                    {s.return_duty.roster_id} · {s.return_duty.roster_date} ·{" "}
                    {s.return_duty.shift_name}
                  </p>
                )}
                <p>
                  {s.decision_note} · {s.decided_by_name} · {s.decided_at}
                </p>
                {s.cover_roster_id && (
                  <p>
                    {t("New covering duty", "نئی متبادل ڈیوٹی")} #
                    {s.cover_roster_id}
                  </p>
                )}
                {s.status === "Accepted" && (
                  <>
                    <p>
                      {swapIsSelf(user.employee_id, s)
                        ? t(
                            "An independent manager must decide your own swap.",
                            "آپ کے تبادلے کا فیصلہ دوسرا مجاز منتظم کرے۔",
                          )
                        : t(
                            "Both colleagues agreed. Review availability before deciding.",
                            "دونوں ساتھی متفق ہیں۔ فیصلے سے پہلے دستیابی دیکھیں۔",
                          )}
                    </p>
                    {(["approve", "reject"] as const).map((kind) => (
                      <button
                        data-help="roster.decide-swap"
                        key={kind}
                        disabled={
                          !live || blocked || swapIsSelf(user.employee_id, s)
                        }
                        onClick={() =>
                          setNoteForm({
                            kind,
                            swap: structuredClone(s),
                            note: "",
                          })
                        }
                      >
                        {kind === "approve"
                          ? t("Approve swap", "تبادلہ منظور کریں")
                          : t("Reject swap", "تبادلہ نامنظور کریں")}{" "}
                        #{s.swap_id}
                      </button>
                    ))}
                  </>
                )}
              </article>
            ))}
        </section>
      )}
      {last && (
        <section className="card" role="status">
          <h2>{t("Confirmed server result", "سرور کا تصدیق شدہ نتیجہ")}</h2>
          {last.kind === "copy" ? (
            <>
              <h3>
                {t("Created duties", "بننے والی ڈیوٹیاں")}:{" "}
                {last.value.created?.length}
              </h3>
              <Details value={last.value.created} />
              <h3>
                {t("Skipped entries and reasons", "چھوڑے اندراج اور وجوہ")}:{" "}
                {last.value.skipped?.length}
              </h3>
              <Details value={last.value.skipped} />
            </>
          ) : (
            <Details value={last.value} />
          )}
          <p>
            {t(
              "A later read failure does not undo this result. Do not submit it again.",
              "بعد کی پڑھائی کی خرابی یہ نتیجہ واپس نہیں کرتی۔ دوبارہ ارسال نہ کریں۔",
            )}
          </p>
        </section>
      )}
      <p>
        {t(
          "No official roster print endpoint is supplied here. Use F1 for the printable handbook. Role/Urdu and fresh-data human review remains required.",
          "یہاں روسٹر کا سرکاری پرنٹ راستہ فراہم نہیں۔ قابل پرنٹ رہنمائی کے لیے ایف ون۔ کردار، اردو اور نئے ریکارڈ کا انسانی جائزہ لازم ہے۔",
        )}
      </p>
      {form && !command && (
        <Modal
          title={
            form.original
              ? t("Edit duty", "ڈیوٹی بدلیں")
              : t("Add duty to draft", "مسودے میں ڈیوٹی شامل کریں")
          }
          onClose={() => cancelForm(() => setForm(undefined))}
          closable={!blocked}
        >
          <ErrorBox error={error} />
          <fieldset disabled={blocked}>
            <div className="form-grid">
              <Field label={t("Duty employee", "ڈیوٹی کا ملازم")}>
                <select data-field="employee_id"
                  data-help="roster.entry"
                  disabled={!!form.original}
                  value={form.entry.employee_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entry: {
                        ...form.entry,
                        employee_id: Number(e.target.value),
                      },
                    })
                  }
                >
                  <option value={0}>
                    {t("Choose permitted staff", "مجاز عملہ چنیں")}
                  </option>
                  {staff.map((s) => (
                    <option key={s.employee_id} value={s.employee_id}>
                      {s.full_name} · {s.emp_number}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Duty start date", "ڈیوٹی شروع ہونے کی تاریخ")}>
                <input data-field="roster_date"
                  data-help="roster.entry"
                  type="date"
                  value={form.entry.roster_date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entry: { ...form.entry, roster_date: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t("Duty shift", "ڈیوٹی کی شفٹ")}>
                <select data-field="shift_pattern_id"
                  data-help="roster.entry"
                  value={form.entry.shift_pattern_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entry: {
                        ...form.entry,
                        shift_pattern_id: Number(e.target.value),
                      },
                    })
                  }
                >
                  <option value={0}>{t("Choose shift", "شفٹ چنیں")}</option>
                  {patterns
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option
                        key={p.shift_pattern_id}
                        value={p.shift_pattern_id}
                      >
                        {p.name} {p.start_time}–{p.end_time}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={t("Duty area", "ڈیوٹی کی جگہ")}>
                <select data-field="duty_area"
                  data-help="roster.location"
                  value={form.entry.duty_area}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entry: {
                        ...form.entry,
                        duty_area: e.target
                          .value as roster.EntryIn["duty_area"],
                        ward_id: null,
                        department_id: null,
                        bed_ids: [],
                      },
                    })
                  }
                >
                  {rosterAreas.map((a) => (
                    <option key={a} value={a}>
                      {areaLabel(a)}
                    </option>
                  ))}
                </select>
              </Field>
              {form.entry.duty_area === "Ward" && (
                <Field label={t("Duty ward", "ڈیوٹی کا وارڈ")}>
                  <select data-field="ward_id"
                    data-help="roster.location"
                    value={form.entry.ward_id || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        entry: {
                          ...form.entry,
                          ward_id: Number(e.target.value) || null,
                          bed_ids: [],
                        },
                      })
                    }
                  >
                    <option value="">{t("Choose ward", "وارڈ چنیں")}</option>
                    {matrix?.wards.map((w) => (
                      <option key={w.ward_id} value={w.ward_id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field
                label={t(
                  "Duty department (optional)",
                  "ڈیوٹی کا شعبہ (اختیاری)",
                )}
              >
                <select data-field="department_id"
                  data-help="roster.location"
                  value={form.entry.department_id || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entry: {
                        ...form.entry,
                        department_id: Number(e.target.value) || null,
                      },
                    })
                  }
                >
                  <option value="">{t("Not assigned", "متعین نہیں")}</option>
                  {departments.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Zone / bay", "زون / حصہ")}>
                <input data-field="zone_label"
                  data-help="roster.location"
                  maxLength={100}
                  value={form.entry.zone_label || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entry: { ...form.entry, zone_label: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t("Duty notes", "ڈیوٹی کے نوٹ")}>
                <textarea data-field="notes"
                  data-help="roster.entry"
                  maxLength={500}
                  value={form.entry.notes || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entry: { ...form.entry, notes: e.target.value },
                    })
                  }
                />
              </Field>
              <label>
                <input
                  data-help="roster.entry"
                  type="checkbox"
                  checked={!!form.entry.is_on_call}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entry: { ...form.entry, is_on_call: e.target.checked },
                    })
                  }
                />
                {t("On call", "آن کال")}
              </label>
            </div>
            {form.entry.duty_area === "Ward" && (
              <fieldset>
                <legend>
                  {t(
                    "Beds this nurse looks after",
                    "اس نرس کے زیر نگہداشت بستر",
                  )}
                </legend>
                {!matrix && (
                  <p>
                    {t(
                      "Refresh permitted bed data before assigning beds.",
                      "بستر مقرر کرنے سے پہلے مجاز معلومات تازہ کریں۔",
                    )}
                  </p>
                )}
                {matrix?.beds
                  ?.filter((b) => b.ward_id === form.entry.ward_id)
                  .map((b) => (
                    <label key={b.bed_id}>
                      <input
                        data-help="roster.beds"
                        type="checkbox"
                        checked={
                          form.entry.bed_ids?.includes(b.bed_id) || false
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            entry: {
                              ...form.entry,
                              bed_ids: e.target.checked
                                ? [...(form.entry.bed_ids || []), b.bed_id]
                                : (form.entry.bed_ids || []).filter(
                                    (id) => id !== b.bed_id,
                                  ),
                            },
                          })
                        }
                      />
                      {b.label} · {tr(b.current_state)}
                    </label>
                  ))}
              </fieldset>
            )}
            <button
              data-help="roster.entry"
              disabled={!live || blocked}
              onClick={prepareForm}
            >
              {form.original
                ? t("Review duty changes", "ڈیوٹی تبدیلی کا جائزہ")
                : t("Add to duty batch", "ڈیوٹی مسودے میں شامل کریں")}
            </button>
          </fieldset>
        </Modal>
      )}
      {copy && !command && (
        <Modal
          title={t("Repeat roster period", "روسٹر مدت دہرائیں")}
          onClose={() => cancelForm(() => setCopy(undefined))}
        >
          <ErrorBox error={error} />
          {(["source_from", "source_to", "target_from"] as const).map(
            (key, i) => (
              <Field
                key={key}
                label={
                  [
                    t("Copy source from", "نقل کی ابتدا"),
                    t("Copy source to", "نقل کا اختتام"),
                    t("Copy target from", "نقل کی نئی ابتدا"),
                  ][i]
                }
              >
                <input
                  data-help="roster.copy"
                  type="date"
                  value={copy[key]}
                  onChange={(e) => setCopy({ ...copy, [key]: e.target.value })}
                />
              </Field>
            ),
          )}
          <Field label={t("Rotate pattern by days", "دنوں کے حساب سے گردش")}>
            <input data-field="rotate_days"
              data-help="roster.copy"
              type="number"
              min={0}
              max={30}
              step={1}
              value={copy.rotate_days || 0}
              onChange={(e) =>
                setCopy({ ...copy, rotate_days: Number(e.target.value) })
              }
            />
          </Field>
          <button
            data-help="roster.copy"
            onClick={() => setCopy({ ...copy, rotate_days: 1 })}
          >
            {t(
              "Repeat, moving everyone's days on",
              "دہرائیں، سب کے دن آگے بڑھائیں",
            )}
          </button>
          <p>
            {t(
              "Copies all manageable active duties in the source and chosen ward/department scope, not just selected staff. Conflicts/leave are skipped by the server with reasons.",
              "اصل مدت اور منتخب وارڈ/شعبے کی تمام مجاز فعال ڈیوٹیاں نقل ہوں گی، صرف منتخب فرد نہیں۔ سرور ٹکراؤ یا رخصت کی وجہ سے چھوڑے اندراج دکھاتا ہے۔",
            )}
          </p>
          <Details value={filters} />
          <button
            data-help="roster.copy"
            disabled={!live || blocked}
            onClick={() => {
              try {
                const period = rosterCopyPeriod(
                  copy.source_from,
                  copy.source_to,
                  copy.target_from,
                  copy.rotate_days || 0,
                  today,
                  user.permissions.includes("roster.manage.all"),
                );
                review({
                  kind: "copy",
                  method: "POST",
                  path: "/rosters/copy",
                  body: { ...period, ...filters },
                  protection: "idempotent",
                  reconcilePath: rangePath(
                    copy.target_from,
                    rosterAddDays(
                      copy.target_from,
                      Math.round(
                        (Date.parse(copy.source_to) -
                          Date.parse(copy.source_from)) /
                          86400000,
                      ),
                    ),
                  ),
                  label: t("Repeat roster period", "روسٹر مدت دہرائیں"),
                });
              } catch (e) {
                setError(e);
              }
            }}
          >
            {t("Review roster copy", "روسٹر نقل کا جائزہ")}
          </button>
        </Modal>
      )}
      {noteForm && !command && (
        <Modal
          title={
            noteForm.kind === "cancel"
              ? t("Cancel duty with reason", "وجہ سے ڈیوٹی منسوخ کریں")
              : t("Review swap decision", "تبادلے کے فیصلے کا جائزہ")
          }
          onClose={() => cancelForm(() => setNoteForm(undefined))}
        >
          <p>
            {noteForm.row
              ? noteForm.row.full_name+' · '+entryText(entryBody(noteForm.row))
              : "#" +
                noteForm.swap?.swap_id +
                " · " +
                noteForm.swap?.requester_name +
                " → " +
                noteForm.swap?.covering_name}
          </p>
          <Field label={t("Decision reason / note", "فیصلے کی وجہ / نوٹ")}>
            <textarea data-field="note reason"
              data-help="roster.reason"
              maxLength={500}
              value={noteForm.note}
              onChange={(e) =>
                setNoteForm({ ...noteForm, note: e.target.value })
              }
            />
          </Field>
          <button
            data-help="roster.reason"
            disabled={
              !live ||
              blocked ||
              (noteForm.kind !== "approve" && noteForm.note.trim().length < 3)
            }
            onClick={() => {
              const n = noteForm;
              if (n.kind === "cancel" && n.row)
                review({
                  kind: "cancel",
                  method: "POST",
                  path: "/rosters/" + n.row.roster_id + "/cancel",
                  body: { reason: n.note.trim() },
                  protection: "reconcile",
                  original: n.row,
                  reconcilePath: rangePath(
                    n.row.roster_date,
                    n.row.roster_date,
                    n.row.employee_id,
                  ),
                  label: t("Cancel duty", "ڈیوٹی منسوخ کریں"),
                });
              else if (n.swap)
                review({
                  kind: n.kind as "approve" | "reject",
                  method: "POST",
                  path: "/rosters/swaps/" + n.swap.swap_id + "/" + n.kind,
                  body: { note: n.note.trim() || null },
                  protection: n.kind === "reject" ? "idempotent" : "reconcile",
                  swap: n.swap,
                  reconcilePath: "/rosters/swaps?status=Accepted",
                  label:
                    n.kind === "approve"
                      ? t("Approve swap", "تبادلہ منظور کریں")
                      : t("Reject swap", "تبادلہ نامنظور کریں"),
                });
            }}
          >
            {t("Review decision", "فیصلے کا جائزہ")}
          </button>
        </Modal>
      )}
      {swapForm && !command && (
        <Modal
          title={t("Record agreed swap", "متفقہ تبادلہ درج کریں")}
          onClose={() => cancelForm(() => setSwapForm(undefined))}
        >
          <ErrorBox error={error} />
          <p>
            {t(
              "For colleagues who agreed in person: confirmation immediately approves the swap and changes the duties. This does not ask the colleague to agree online.",
              "ان ساتھیوں کے لیے جو بالمشافہ متفق ہیں: تصدیق فوراً تبادلہ منظور اور ڈیوٹیاں تبدیل کرتی ہے۔ یہ آن لائن رضامندی کی درخواست نہیں۔",
            )}
          </p>
          <Field label={t("Original duty", "اصل ڈیوٹی")}>
            <select data-field="roster_id"
              data-help="roster.record-swap"
              value={swapForm.roster_id}
              onChange={(e) =>
                setSwapForm({
                  ...swapForm,
                  roster_id: Number(e.target.value),
                  covering_employee_id: 0,
                  return_roster_id: 0,
                })
              }
            >
              <option value={0}>
                {t("Choose current duty", "موجودہ ڈیوٹی چنیں")}
              </option>
              {rows
                .filter((r) => r.status === "Active" && notStarted(r))
                .map((r) => (
                  <option key={r.roster_id} value={r.roster_id}>
                    #{r.roster_id} {r.full_name} {r.roster_date} {r.shift_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("Covering colleague", "متبادل ساتھی")}>
            <select data-field="covering_employee_id"
              data-help="roster.record-swap"
              value={swapForm.covering_employee_id}
              onChange={(e) =>
                setSwapForm({
                  ...swapForm,
                  covering_employee_id: Number(e.target.value),
                  return_roster_id: 0,
                })
              }
            >
              <option value={0}>
                {t("Choose eligible colleague", "اہل ساتھی چنیں")}
              </option>
              {staff
                .filter((s) => {
                  const r = rows.find(
                    (r) => r.roster_id === swapForm.roster_id,
                  );
                  return (
                    r &&
                    s.staff_category === r.staff_category &&
                    s.employee_id !== r.employee_id &&
                    s.employee_id !== user.employee_id
                  );
                })
                .map((s) => (
                  <option key={s.employee_id} value={s.employee_id}>
                    {s.full_name} · {s.emp_number}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("Return duty (optional)", "بدلے کی ڈیوٹی (اختیاری)")}>
            <select data-field="return_roster_id"
              data-help="roster.record-swap"
              value={swapForm.return_roster_id}
              onChange={(e) =>
                setSwapForm({
                  ...swapForm,
                  return_roster_id: Number(e.target.value),
                })
              }
            >
              <option value={0}>{t("Cover only", "صرف متبادل")}</option>
              {rows
                .filter(
                  (r) =>
                    r.employee_id === swapForm.covering_employee_id &&
                    r.status === "Active" &&
                    notStarted(r),
                )
                .map((r) => (
                  <option key={r.roster_id} value={r.roster_id}>
                    #{r.roster_id} {r.roster_date} {r.shift_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("Swap reason", "تبادلے کی وجہ")}>
            <textarea data-field="reason"
              data-help="roster.record-swap"
              maxLength={500}
              value={swapForm.reason}
              onChange={(e) =>
                setSwapForm({ ...swapForm, reason: e.target.value })
              }
            />
          </Field>
          <label>
            <input
              data-help="roster.record-swap"
              type="checkbox"
              checked={swapForm.agreed}
              onChange={(e) =>
                setSwapForm({ ...swapForm, agreed: e.target.checked })
              }
            />
            {t(
              "Both colleagues agreed; I am neither colleague.",
              "دونوں ساتھی راضی ہیں؛ میں ان میں شامل نہیں۔",
            )}
          </label>
          <button
            data-help="roster.record-swap"
            disabled={
              !live ||
              blocked ||
              !swapForm.agreed ||
              !swapForm.roster_id ||
              !swapForm.covering_employee_id ||
              swapForm.reason.trim().length < 3 ||
              rows.find((r) => r.roster_id === swapForm.roster_id)
                ?.employee_id === user.employee_id
            }
            onClick={() =>
              review({
                kind: "record",
                method: "POST",
                path: "/rosters/swaps",
                body: {
                  roster_id: swapForm.roster_id,
                  covering_employee_id: swapForm.covering_employee_id,
                  return_roster_id: swapForm.return_roster_id || null,
                  reason: swapForm.reason.trim(),
                },
                original: structuredClone(
                  rows.find((r) => r.roster_id === swapForm.roster_id)!,
                ),
                returnOriginal: swapForm.return_roster_id
                  ? structuredClone(
                      rows.find(
                        (r) => r.roster_id === swapForm.return_roster_id,
                      )!,
                    )
                  : undefined,
                covering: structuredClone(
                  staff.find(
                    (s) => s.employee_id === swapForm.covering_employee_id,
                  )!,
                ),
                protection: "idempotent",
                reconcilePath: "/rosters/swaps?status=Approved",
                label: t("Record agreed swap", "متفقہ تبادلہ درج کریں"),
              })
            }
          >
            {t("Review agreed swap", "متفقہ تبادلے کا جائزہ")}
          </button>
        </Modal>
      )}
      {command && (
        <Modal
          title={t("Confirm roster action", "روسٹر عمل کی تصدیق")}
          closable={!blocked}
          onClose={() => {
            if (!blocked) setCommand(undefined);
          }}
        >
          <p>{command.label}</p>
          {command.original && (
            <p>
              {entryText(entryBody(command.original))} · v
              {command.original.row_version}
            </p>
          )}
          {command.covering && (
            <p>
              {t("Covering colleague", "متبادل ساتھی")}:{" "}
              <bdi>
                {command.covering.full_name} · {command.covering.emp_number}
              </bdi>
            </p>
          )}
          {command.returnOriginal && (
            <p>
              {t("Return duty", "بدلے کی ڈیوٹی")}:{" "}
              {entryText(entryBody(command.returnOriginal))}
            </p>
          )}
          <ul>
            {command.summary?.map((line, i) => (
              <li key={i}>
                <bdi>{line}</bdi>
              </li>
            ))}
          </ul>
          <details>
            <summary data-help="roster.confirm">
              {t("Request details", "درخواست کی تفصیل")}
            </summary>
            <Details value={command.body} />
          </details>
          <ErrorBox error={write.error} verbatim />
          <p>
            {t(
              "Review the exact people, dates, shift and consequences. Saving a roster does not mark attendance or perform patient care.",
              "اصل عملہ، تاریخ، شفٹ اور اثر چیک کریں۔ روسٹر محفوظ کرنے سے حاضری یا مریض کی نگہداشت درج نہیں ہوتی۔",
            )}
          </p>
          <label>
            <input
              data-help="roster.confirm"
              type="checkbox"
              checked={ack}
              disabled={blocked}
              onChange={(e) => setAck(e.target.checked)}
            />
            {t(
              "I checked the people, dates and action.",
              "میں نے عملہ، تاریخیں اور عمل چیک کیا۔",
            )}
          </label>
          <button
            data-help="roster.confirm"
            disabled={!ack || !live || blocked}
            onClick={confirm}
          >
            {t("Confirm roster action", "روسٹر عمل کی تصدیق")}
          </button>
          {write.busy && (
            <p role="status">
              {t(
                "Sending; wait for the server.",
                "ارسال جاری؛ سرور کا انتظار کریں۔",
              )}
            </p>
          )}
          {write.attempt && !write.busy && (
            <section className="notice" role="alert">
              <p>
                {t(
                  "Outcome unknown. Keep the original request; do not replace it.",
                  "نتیجہ نامعلوم۔ اصل درخواست رکھیں؛ متبادل نہ بنائیں۔",
                )}
              </p>
              <code>{write.attempt.key}</code>
              {write.attempt.body.protection === "idempotent" &&
                canRetryWrite(write.attempt) && (
                  <button
                    data-help="roster.recovery"
                    disabled={!live || write.busy || recovering}
                    onClick={write.retry}
                  >
                    {t("Retry original request", "اصل درخواست دوبارہ بھیجیں")}
                  </button>
                )}
              <button
                data-help="roster.recovery"
                disabled={recovering}
                onClick={() => void inspect()}
              >
                {t("Read original roster result", "اصل روسٹر نتیجہ پڑھیں")}
              </button>
              {recovery && write.checked && (
                <>
                  <p>
                    {t(
                      "A missing row or a matching name is never success. Check the exact ID, status and version.",
                      "غائب سطر یا ملتا نام کامیابی نہیں۔ عین نمبر، حالت اور نسخہ چیک کریں۔",
                    )}
                  </p>
                  <Details
                    value={
                      command.original &&
                      ["edit", "cancel"].includes(command.kind)
                        ? originalResult ||
                          t(
                            "Original duty not found; ask IT before a replacement.",
                            "اصل ڈیوٹی نہیں ملی؛ متبادل سے پہلے آئی ٹی سے پوچھیں۔",
                          )
                        : recovery.kind === "swap"
                          ? recovery.record
                          : recovery.kind === "missing"
                            ? t(
                                "Swap not found; ask IT.",
                                "تبادلہ نہیں ملا؛ آئی ٹی سے کہیں۔",
                              )
                            : write.observed
                    }
                  />
                  {rosterRecoveryMayRelease(
                    command.kind,
                    command.original?.roster_id || command.swap?.swap_id,
                    command.swap ? recovery.record : originalResult,
                  ) ? (
                    <button
                      data-help="roster.recovery"
                      onClick={() => {
                        write.release();
                        setRecovery(undefined);
                        setCommand(undefined);
                        setForm(undefined);
                        setNoteForm(undefined);
                        setSwapForm(undefined);
                        setCopy(undefined);
                        setRevision((n) => n + 1);
                      }}
                    >
                      {t(
                        "Result reviewed; return to planner",
                        "نتیجہ چیک؛ منصوبے پر واپس",
                      )}
                    </button>
                  ) : (
                    <p>
                      {t(
                        "This read does not identify the outcome of the original request. Use the original-key retry within retention; otherwise ask IT before any replacement.",
                        "یہ مطالعہ اصل درخواست کا نتیجہ ثابت نہیں کرتا۔ مدت میں اصل کلید سے کوشش، ورنہ متبادل سے پہلے آئی ٹی سے پوچھیں۔",
                      )}
                    </p>
                  )}
                </>
              )}
            </section>
          )}
        </Modal>
      )}
    </section>
  );
}
