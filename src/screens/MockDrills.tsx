import {DirectoryPicker} from "../DirectoryPicker";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, call, getWithClock } from "../bridge";
import { Field, ErrorBox } from "../components";
import { bilingual as t } from "../i18n";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { formatHospitalTime, hospitalTimeZoneError } from "../hospital-time";
import {
  departments,
  type DepartmentOut,
} from "../generated/compliance_register_ops";
import { bedMatrix } from "../generated/waste_log_ops";
import {
  getProfile,
  type EstablishmentOut,
} from "../generated/facility_profile";
import * as api from "../generated/mock_drills_ops";
import {
  drillAccess,
  drillDraft,
  drillKinds,
  drillShifts,
  drillOutcomes,
  drillPayload,
  validateDrill,
  missingToSign,
  actionPayload,
  type DrillDraft,
} from "../mock-drills-policy";
const words: Record<string, [string, string]> = {
  Fire: ["Fire", "آگ"],
  Evacuation: ["Evacuation", "انخلا"],
  CodeBlue: ["Code blue", "کوڈ بلیو"],
  MassCasualty: ["Mass casualty", "بڑی تعداد میں زخمی"],
  Earthquake: ["Earthquake", "زلزلہ"],
  BombThreat: ["Bomb threat", "بم کا خطرہ"],
  ChemicalSpill: ["Chemical spill", "کیمیائی مادہ گرنا"],
  PowerFailure: ["Power failure", "بجلی کی بندش"],
  InfantAbduction: ["Infant abduction", "بچے کا اغوا"],
  Flood: ["Flood", "سیلاب"],
  Other: ["Other", "دیگر"],
  Morning: ["Morning", "صبح"],
  Evening: ["Evening", "شام"],
  Night: ["Night", "رات"],
  Satisfactory: ["Satisfactory", "اطمینان بخش"],
  NeedsImprovement: ["Needs improvement", "بہتری درکار"],
  Unsatisfactory: ["Unsatisfactory", "غیر اطمینان بخش"],
  Draft: ["Draft", "مسودہ"],
  Final: ["Signed / final", "دستخط شدہ / حتمی"],
  Corrective: ["Corrective", "اصلاحی"],
  Preventive: ["Preventive", "احتیاطی"],
  Open: ["Open", "کھلا"],
  Done: ["Done", "مکمل"],
  Cancelled: ["Cancelled", "منسوخ"],
  observations: ["Observations", "مشاہدات"],
  outcome: ["Outcome", "نتیجہ"],
  participants: ["Participants", "شرکاء"],
};
const label = (s: string) => (words[s] ? t(...words[s]) : s);
type Editor = {
  mode: "create" | "edit" | "sign" | "action";
  original?: api.DrillDetailOut;
};
const emptyAction = () => ({
  action_type: "",
  description: "",
  owner_user_id: "",
  due_date: "",
  department_id: "",
});
export function MockDrills({
  user,
  establishment,
  connected,
  timeZone,
  onOpenHelp,
}: {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
}) {
  const access = drillAccess(user.permissions, establishment),
    zoneProblem = hospitalTimeZoneError(timeZone);
  const [tab, setTab] = useState<"coverage" | "reports">("coverage"),
    [cov, setCov] = useState<api.DrillCoverageOut>(),
    [covError, setCovError] = useState<unknown>(),
    [covLoading, setCovLoading] = useState(false);
  const [rows, setRows] = useState<api.DrillOut[]>([]),
    [listLoading, setListLoading] = useState(false),
    [listError, setListError] = useState<unknown>();
  const [kind, setKind] = useState(""),
    [department, setDepartment] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number>(),
    [detail, setDetail] = useState<api.DrillDetailOut>(),
    [detailError, setDetailError] = useState<unknown>(),
    [detailLoading, setDetailLoading] = useState(false);
  const [staff, setStaff] = useState<api.FacilityStaffOut[]>([]),
    [staffQuery, setStaffQuery] = useState(""),
    [depts, setDepts] = useState<DepartmentOut[]>([]),
    [wards, setWards] = useState<
      { ward_id: number; name: string; code: string }[]
    >([]),
    [lookupError, setLookupError] = useState<unknown>();
  const [editor, setEditor] = useState<Editor>(),
    [draft, setDraft] = useState<DrillDraft>(drillDraft()),
    [action, setAction] = useState(emptyAction()),
    [validation, setValidation] = useState(""),
    [pdfBusy, setPdfBusy] = useState(false),
    [pdfError, setPdfError] = useState<unknown>(),
    [pdfNotice, setPdfNotice] = useState("");
  const listSeq = useRef(0),
    detailSeq = useRef(0),
    coverageSeq = useRef(0),
    form = useRef<HTMLFormElement>(null);
  const loadCoverage = useCallback(async () => {
    if (!access.canView) return;
    const seq = ++coverageSeq.current;
    setCovLoading(true);
    setCovError(undefined);
    try {
      const value = await api.coverage();
      if (seq === coverageSeq.current) setCov(value);
    } catch (e) {
      if (seq === coverageSeq.current) setCovError(e);
    } finally {
      if (seq === coverageSeq.current) setCovLoading(false);
    }
  }, [access.canView]);
  const loadList = useCallback(async () => {
    if (!access.canView) return;
    const seq = ++listSeq.current;
    setListLoading(true);
    setListError(undefined);
    try {
      const value = await api.listDrills({
        kind: (kind || undefined) as api.DrillOut["kind"] | undefined,
        department_id: department ? Number(department) : undefined,
        status: (status || undefined) as "Draft" | "Final" | undefined,
        date_from: from || undefined,
        date_to: to || undefined,
      });
      if (seq === listSeq.current) setRows(value);
    } catch (e) {
      if (seq === listSeq.current) setListError(e);
    } finally {
      if (seq === listSeq.current) setListLoading(false);
    }
  }, [access.canView, kind, department, status, from, to]);
  const readDetail = useCallback(async (id: number) => {
    const seq = ++detailSeq.current;
    setDetailLoading(true);
    setDetailError(undefined);
    try {
      const value = await api.getDrill(id);
      if (seq === detailSeq.current) setDetail(value);
    } catch (e) {
      if (seq === detailSeq.current) setDetailError(e);
    } finally {
      if (seq === detailSeq.current) setDetailLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadCoverage();
    return () => {
      coverageSeq.current++;
    };
  }, [loadCoverage]);
  useEffect(() => {
    void loadList();
    return () => {
      listSeq.current++;
    };
  }, [loadList]);
  useEffect(() => {
    setDetail(undefined);
    if (selected && access.canView) void readDetail(selected);
    return () => {
      detailSeq.current++;
    };
  }, [selected, access.canView, readDetail]);
  const loadLookups = useCallback(async () => {
    if (!access.canView) return;
    setLookupError(undefined);
    const jobs: Promise<unknown>[] = [departments().then(rows=>setDepts(rows.filter(r=>r.is_active)))];
    if (access.canManage)
      jobs.push(api.staffFacility({ limit: 500 }).then(setStaff));
    if (
      user.permissions.some((p) =>
        ["ipd.bed.view", "cssd.operate", "infection.control.manage", "complaint.manage", "incident.view", "facility.drill.manage", "roster.manage.all", "facility.equipment.manage", "pharmacy.storage.record"].includes(
          p,
        ),
      )
    )
      jobs.push(
        bedMatrix({ include_beds: false }).then((v) => setWards(v.wards)),
      );
    const results = await Promise.allSettled(jobs);
    for (const r of results)
      if (r.status === "rejected") setLookupError(r.reason);
  }, [access.canView, access.canManage, user.permissions]);
  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);
  const refresh = () => {
    void loadCoverage();
    void loadList();
    if (selected) void readDetail(selected);
    void loadLookups();
  };
  const write = useClinicalWrite(
    user,
    "mock_drills_ops",
    async (value: api.DrillDetailOut | api.QualityActionOut) => {
      setEditor(undefined);
      setValidation("");
      if ("action_id" in value) {
        if (value.drill_id) await readDetail(value.drill_id);
      } else {
        detailSeq.current++;
        setSelected(value.drill_id);
        setDetail(value);
      }
      await Promise.all([loadCoverage(), loadList()]);
    },
  );
  const blocked = write.blocked || pdfBusy;
  useEffect(() => {
    if (editor)
      form.current
        ?.querySelector<HTMLElement>("input,textarea,select,button")
        ?.focus();
  }, [editor]);
  const choose = (id: number) => {
    if (blocked || editor) return;
    setSelected(id);
    setTab("reports");
    setPdfNotice("");
    setPdfError(undefined);
  };
  const open = (mode: Editor["mode"]) => {
    if (blocked || editor || !access.canManage || !connected || zoneProblem)
      return;
    if (mode !== "create" && !detail) return;
    write.clearError();
    setEditor({ mode, original: mode === "create" ? undefined : detail });
    setDraft(drillDraft(mode === "create" ? undefined : detail, timeZone));
    setAction(emptyAction());
    setValidation("");
    setTab("reports");
  };
  const update = (
    key: Exclude<keyof DrillDraft, "participants">,
    value: string,
  ) => setDraft((d) => ({ ...d, [key]: value }));
  async function findStaff() {
    setLookupError(undefined);
    try {
      const found = await api.staffFacility({
        q: staffQuery.trim() || undefined,
        limit: 500,
      });
      setStaff((previous) => [
        ...new Map(
          [...previous, ...found].map((s) => [s.employee_id, s]),
        ).values(),
      ]);
    } catch (e) {
      setLookupError(e);
    }
  }
  const instant = (value: string) =>
    timeZone && !zoneProblem ? formatHospitalTime(value, timeZone) : value;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editor || blocked || !access.canManage || !connected || zoneProblem)
      return;
    const original = editor.original;
    if (editor.mode === "sign") {
      if (!original || missingToSign(original).length) return;
      write.start({
        method: "POST",
        path: `/facility/drills/${original.drill_id}/finalize`,
        permission: "facility.drill.manage",
        protection: "idempotent",
        reconcilePath: `/facility/drills/${original.drill_id}`,
        label: t("Sign this drill report", "اس مشق کی رپورٹ پر دستخط کریں"),
      });
      return;
    }
    if (editor.mode === "action") {
      if (
        !action.action_type ||
        !action.owner_user_id ||
        !action.due_date ||
        action.description.trim().length < 5 ||
        action.description.length > 1000
      ) {
        setValidation(
          t(
            "Choose the action type, actual owner and due date; describe the action in5–1000characters.",
            "عمل کی قسم، اصل ذمہ دار اور آخری تاریخ چنیں؛5سے1000حروف میں وضاحت دیں۔",
          ),
        );
        return;
      }
      write.start({
        method: "POST",
        path: `/facility/drills/${original!.drill_id}/actions`,
        body: actionPayload(action),
        permission: "facility.drill.manage",
        protection: "idempotent",
        reconcilePath: `/facility/drills/${original!.drill_id}`,
        label: t("Record follow-up action", "فالو اپ عمل درج کریں"),
      });
      return;
    }
    if (validateDrill(draft).length) {
      setValidation(
        t(
          "Check the required drill, place, time and shift, limits and participant roles; each participant may appear once.",
          "مشق، مقام، وقت، شفٹ، حد اور شرکاء کے کردار چیک کریں؛ ہر شریک ایک بار آ سکتا ہے۔",
        ),
      );
      return;
    }
    try {
      const body = drillPayload(draft, timeZone!, original);
      write.start(
        {
          method: original ? "PUT" : "POST",
          path: original
            ? `/facility/drills/${original.drill_id}`
            : "/facility/drills",
          body: original
            ? { ...body, expected_version: original.row_version }
            : body,
          permission: "facility.drill.manage",
          protection: original ? "reconcile" : "idempotent",
          reconcilePath: original
            ? `/facility/drills/${original.drill_id}`
            : "/facility/drills",
          label: t(
            "Save draft drill report",
            "مشق کی رپورٹ کا مسودہ محفوظ کریں",
          ),
        },
        async () => {
          const clock = await getWithClock<api.DrillCoverageOut>(
            "/facility/drills/coverage",
          );
          if (Date.parse(body.held_at) > Date.parse(clock.now))
            throw new Error(
              t(
                "Report a drill after it was held. Check the hospital date/time.",
                "مشق ہونے کے بعد رپورٹ درج کریں۔ ہسپتال کی تاریخ اور وقت چیک کریں۔",
              ),
            );
        },
      );
    } catch (error) {
      setValidation(error instanceof Error ? error.message : String(error));
    }
  }
  async function pdf(preview: boolean) {
    if (!detail || blocked) return;
    setPdfBusy(true);
    setPdfError(undefined);
    setPdfNotice("");
    try {
      const result = await call("clinical-pdf", {
        path: `/facility/drills/${detail.drill_id}/pdf`,
        preview,
      });
      setPdfNotice(preview ? "opened" : result.saved ? "saved" : "cancelled");
    } catch (e) {
      setPdfError(e);
    } finally {
      setPdfBusy(false);
    }
  }
  const conflict =
    write.error instanceof ApiError &&
    write.error.response.error?.code === "VERSION_CONFLICT";
  const closedDraft =
    !!editor?.original &&
    editor.mode === "edit" &&
    detail?.drill_id === editor.original.drill_id &&
    detail.status === "Final";
  const currentStaff = (id: string) =>
    staff.find((s) => String(s.employee_id) === id);
  if (!access.canView)
    return (
      <section className="card">
        <h2>{t("Mock drills unavailable", "فرضی مشقیں دستیاب نہیں")}</h2>
        <p>
          {t(
            "Your permissions or the current facility view do not permit this screen.",
            "آپ کی اجازت یا سہولت کا موجودہ منظر اس اسکرین کی اجازت نہیں دیتا۔",
          )}
        </p>
      </section>
    );
  return (
    <section
      className="drill-screen"
      data-screen="mock_drills_ops"
      data-write-pending={blocked ? "true" : undefined}
      data-unsaved={editor ? "true" : "false"}
    >
      <header className="dr-heading">
        <div>
          <h2>{t("Mock drills", "فرضی مشقیں")}</h2>
          <p>
            {t(
              "Review coverage, report the drill that was held, then sign and assign the follow-up.",
              "کوریج دیکھیں، ہو چکی مشق کی رپورٹ دیں، پھر دستخط اور فالو اپ مقرر کریں۔",
            )}
          </p>
        </div>
        <div className="actions">
          <button data-help="dr.help" onClick={onOpenHelp}>
            {t("Help · F1", "مدد · F1")}
          </button>
          <button data-help="dr.refresh" disabled={blocked} onClick={refresh}>
            {t("Refresh", "تازہ کریں")}
          </button>
          {access.canManage && (
            <button
              className="primary"
              data-help="dr.new"
              disabled={blocked || !!editor || !connected || !!zoneProblem}
              onClick={() => open("create")}
            >
              {t("Report a drill", "مشق کی رپورٹ دیں")}
            </button>
          )}
        </div>
      </header>
      <p className="muted">
        {t(
          "Urdu wording is a draft awaiting language review.",
          "اردو متن زبان کے جائزے کا منتظر مسودہ ہے۔",
        )}
      </p>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected: reconnect before saving or downloading.",
            "رابطہ منقطع: محفوظ یا ڈاؤن لوڈ کرنے سے پہلے رابطہ بحال کریں۔",
          )}
        </p>
      )}
      {access.view === "records" && (
        <p className="notice">
          {t("Records view: read only.", "ریکارڈ منظر: صرف پڑھنے کے لیے۔")}
        </p>
      )}
      <ErrorBox error={zoneProblem} verbatim />
      <ClinicalWriteFeedback
        write={{
          ...write,
          notice: write.notice
            ? t(
                "Confirmed on the server. A later read or print failure does not undo this action.",
                "سرور نے تصدیق کی۔ بعد کی پڑھائی یا پرنٹ کی خرابی اس عمل کو واپس نہیں کرتی۔",
              )
            : "",
        }}
        onReviewed={() => {
          setEditor(undefined);
          refresh();
        }}
      />
      <div className="actions dr-tabs">
        <button
          data-help="dr.coverage"
          aria-pressed={tab === "coverage"}
          disabled={blocked || !!editor}
          onClick={() => setTab("coverage")}
        >
          {t("Coverage", "کوریج")}
        </button>
        <button
          data-help="dr.reports"
          aria-pressed={tab === "reports"}
          disabled={blocked || !!editor}
          onClick={() => setTab("reports")}
        >
          {t("Drill reports", "مشقوں کی رپورٹس")}
        </button>
      </div>
      {tab === "coverage" ? (
        <section className="card">
          <ErrorBox error={covError} verbatim />
          {covLoading && (
            <p role="status">
              {t("Reading coverage…", "کوریج پڑھی جا رہی ہے…")}
            </p>
          )}
          {cov && (
            <>
              <h3>
                {t("Department and shift coverage", "شعبے اور شفٹ کی کوریج")}
              </h3>
              <p>
                {t("Server period:", "سرور کا عرصہ:")} {cov.months}{" "}
                {t("months since", "ماہ، آغاز")} <bdi>{cov.since}</bdi> ·{" "}
                {cov.drills} {t("signed drills", "دستخط شدہ مشقیں")}
              </p>
              <p>
                {cov.shifts
                  .map((s) => `${label(s.shift)}: ${s.drills}`)
                  .join(" · ")}
              </p>
              <p
                className={
                  cov.departments_not_drilled.length ? "dr-missing" : ""
                }
              >
                {t("Departments not drilled:", "مشق نہ کرنے والے شعبے:")}{" "}
                {cov.departments_not_drilled.join(", ") ||
                  t("None listed by server", "سرور کی فہرست میں کوئی نہیں")}
              </p>
              {!cov.departments.length && (
                <p>
                  {t(
                    "No departments returned. Refresh or ask Operations to check department setup; no coverage is invented.",
                    "کوئی شعبہ واپس نہیں آیا۔ تازہ کریں یا شعبوں کی ترتیب چیک کرائیں؛ کوریج فرض نہیں ہوتی۔",
                  )}
                </p>
              )}
              <div className="dr-scroll">
                <table className="dr-table">
                  <thead>
                    <tr>
                      <th>{t("Department", "شعبہ")}</th>
                      {drillShifts.map((s) => (
                        <th key={s}>{label(s)}</th>
                      ))}
                      <th>
                        {t(
                          "Staff drilled / active staff",
                          "مشق کرنے والا / فعال عملہ",
                        )}
                      </th>
                      <th>
                        {t(
                          "Missing shifts / last drill",
                          "باقی شفٹیں / آخری مشق",
                        )}
                      </th>
                      <th>{t("Reports", "رپورٹس")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cov.departments.map((d) => (
                      <tr
                        key={d.department_id}
                        className={
                          cov.departments_not_drilled.includes(
                            d.department_name,
                          )
                            ? "dr-missing"
                            : ""
                        }
                      >
                        <th>{d.department_name}</th>
                        <td>{d.morning}</td>
                        <td>{d.evening}</td>
                        <td>{d.night}</td>
                        <td>
                          <bdi dir="ltr">{d.staff_drilled} / {d.staff}</bdi>
                        </td>
                        <td>
                          {d.shifts_missing.map(label).join(", ") ||
                            t("No shifts missing", "کوئی شفٹ باقی نہیں")}
                          <br />
                          {d.last_drill_at
                            ? <bdi dir="ltr">{instant(d.last_drill_at)}</bdi>
                            : t(
                                "Not drilled in this period",
                                "اس عرصے میں مشق نہیں",
                              )}
                        </td>
                        <td>
                          <button
                            data-help="dr.department-reports"
                            disabled={blocked || !!editor}
                            onClick={() => {
                              setDepartment(String(d.department_id));
                              setFrom(cov.since);
                              setTo("");
                              setKind("");
                              setStatus("");
                              setSearch("");
                              setTab("reports");
                            }}
                          >
                            {t("Show reports", "رپورٹس دکھائیں")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : (
        <>
          <fieldset
            className="dr-grid"
            disabled={blocked || !!editor}
            data-unsaved="false"
          >
            <Field label={t("Kind", "قسم")}>
              <select
                data-help="dr.filters"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="">{t("All kinds", "تمام اقسام")}</option>
                {drillKinds.map((k) => (
                  <option key={k} value={k}>
                    {label(k)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Department", "شعبہ")}>
              <select
                data-help="dr.filters"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">{t("All departments", "تمام شعبے")}</option>
                {depts.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Status", "حالت")}>
              <select
                data-help="dr.filters"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{t("All statuses", "تمام حالتیں")}</option>
                <option value="Draft">{label("Draft")}</option>
                <option value="Final">{label("Final")}</option>
              </select>
            </Field>
            <Field label={t("From date", "اس تاریخ سے")}>
              <input
                type="date"
                data-help="dr.filters"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label={t("To date", "اس تاریخ تک")}>
              <input
                type="date"
                data-help="dr.filters"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <Field
              label={t(
                "Search scenario or report number",
                "منظرنامہ یا رپورٹ نمبر تلاش کریں",
              )}
            >
              <input
                data-help="dr.search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </fieldset>
          <ErrorBox error={listError} verbatim />
          {listLoading && (
            <p role="status">
              {t("Reading drill reports…", "رپورٹس پڑھی جا رہی ہیں…")}
            </p>
          )}
          <div className="dr-columns">
            <div className="dr-list">
              {rows
                .filter((r) =>
                  `${r.drill_number} ${r.scenario} ${r.place || ""}`
                    .toLowerCase()
                    .includes(search.trim().toLowerCase()),
                )
                .map((r) => (
                  <button
                    className="dr-row"
                    data-help="dr.select"
                    key={r.drill_id}
                    aria-pressed={selected === r.drill_id}
                    disabled={blocked || !!editor}
                    onClick={() => choose(r.drill_id)}
                  >
                    <strong>
                      <bdi>{r.drill_number}</bdi> · {label(r.status)}
                    </strong>
                    <span>{r.scenario}</span>
                    <span>
                      {label(r.kind)} ·{" "}
                      {r.place || t("Place not recorded", "مقام درج نہیں")} ·{" "}
                      {label(r.shift)}
                    </span>
                    <span>{instant(r.held_at)}</span>
                    <span>
                      {r.participant_count} {t("participants", "شرکاء")} ·{" "}
                      {r.actions} {t("actions", "اقدامات")}
                    </span>
                  </button>
                ))}
              {!listLoading &&
                !listError &&
                !rows.some((r) =>
                  `${r.drill_number} ${r.scenario} ${r.place || ""}`
                    .toLowerCase()
                    .includes(search.trim().toLowerCase()),
                ) && (
                  <p className="notice">
                    {t(
                      "No reports match. Clear the filters or report an actual drill after it was held.",
                      "کوئی رپورٹ نہیں ملی۔ فلٹر ہٹائیں یا مشق ہونے کے بعد اصل رپورٹ دیں۔",
                    )}
                  </p>
                )}
            </div>
            <div className="card dr-detail">
              <ErrorBox error={detailError} verbatim />
              {detailLoading && (
                <p role="status">
                  {t("Reading selected drill…", "منتخب مشق پڑھی جا رہی ہے…")}
                </p>
              )}
              {!selected && !editor && (
                <p>
                  {t(
                    "Select a report to review its participants, findings and follow-up.",
                    "شرکاء، نتائج اور فالو اپ دیکھنے کے لیے رپورٹ منتخب کریں۔",
                  )}
                </p>
              )}
              {detail &&
                !detailLoading &&
                !detailError &&
                editor?.mode !== "create" && (
                  <>
                    <h3>
                      <bdi>{detail.drill_number}</bdi> · {label(detail.status)}
                    </h3>
                    <p>{detail.scenario}</p>
                    <dl className="dr-facts">
                      {[
                        [
                          t("Kind / shift", "قسم / شفٹ"),
                          `${label(detail.kind)} · ${label(detail.shift)}`,
                        ],
                        [t("Held at", "مشق کا وقت"), instant(detail.held_at)],
                        [
                          t("Place", "مقام"),
                          [
                            detail.department_name,
                            detail.ward_name,
                            detail.area,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        ],
                        [
                          t("Announced", "اعلان ہوا"),
                          detail.announced ? t("Yes", "ہاں") : t("No", "نہیں"),
                        ],
                        [
                          t("External agency", "بیرونی ادارہ"),
                          detail.external_agency,
                        ],
                        [
                          t("Response minutes", "ابتدائی ردعمل کے منٹ"),
                          detail.response_minutes === null
                            ? "—"
                            : String(detail.response_minutes),
                        ],
                        [
                          t("Evacuation minutes", "انخلا کے منٹ"),
                          detail.evacuation_minutes === null
                            ? "—"
                            : String(detail.evacuation_minutes),
                        ],
                        [t("Observations", "مشاہدات"), detail.observations],
                        [
                          t("Outcome", "نتیجہ"),
                          detail.outcome ? label(detail.outcome) : null,
                        ],
                      ].map(([name, value]) => (
                        <div key={name}>
                          <dt>{name}</dt>
                          <dd dir="auto">
                            {value || t("Not recorded", "درج نہیں")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <h4>{t("Participants and roles", "شرکاء اور کردار")}</h4>
                    {detail.participants.length ? (
                      <ul>
                        {detail.participants.map((p) => (
                          <li key={p.employee_id}>
                            {p.employee_name} · <bdi>{p.emp_number}</bdi> ·{" "}
                            {p.department_name} · {p.drill_role}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>{t("No participants recorded.", "شرکاء درج نہیں۔")}</p>
                    )}
                    {detail.final_stamp && (
                      <p className="notice" dir="auto">
                        {detail.final_stamp.text}
                      </p>
                    )}
                    <div className="actions">
                      <button
                        data-help="dr.latest"
                        disabled={blocked}
                        onClick={() => void readDetail(detail.drill_id)}
                      >
                        {t("Read latest report", "تازہ رپورٹ پڑھیں")}
                      </button>
                      <button
                        data-help="dr.pdf"
                        disabled={blocked || !connected}
                        onClick={() => void pdf(true)}
                      >
                        {t("View / print report", "رپورٹ دیکھیں / پرنٹ کریں")}
                      </button>
                      <button
                        data-help="dr.pdf"
                        disabled={blocked || !connected}
                        onClick={() => void pdf(false)}
                      >
                        {t("Save report PDF", "رپورٹ پی ڈی ایف محفوظ کریں")}
                      </button>
                      {access.canManage && detail.status === "Draft" && (
                        <>
                          <button
                            data-help="dr.edit"
                            disabled={
                              blocked || !!editor || !connected || !!zoneProblem
                            }
                            onClick={() => open("edit")}
                          >
                            {t("Complete draft", "مسودہ مکمل کریں")}
                          </button>
                          <button
                            data-help="dr.sign"
                            disabled={
                              blocked || !!editor || !connected || !!zoneProblem
                            }
                            onClick={() => open("sign")}
                          >
                            {t("Review and sign", "جائزہ اور دستخط")}
                          </button>
                        </>
                      )}
                      {access.canManage && detail.status === "Final" && (
                        <button
                          data-help="dr.action"
                          disabled={blocked || !!editor || !connected}
                          onClick={() => open("action")}
                        >
                          {t("Record follow-up action", "فالو اپ عمل درج کریں")}
                        </button>
                      )}
                    </div>
                    {detail.status === "Final" && (
                      <p>
                        {t(
                          "Signed report: its content and participants are frozen. Follow-up actions remain separate.",
                          "دستخط شدہ رپورٹ: معلومات اور شرکاء حتمی ہیں۔ فالو اپ اقدامات الگ رہتے ہیں۔",
                        )}
                      </p>
                    )}
                    <h4>{t("Follow-up actions", "فالو اپ اقدامات")}</h4>
                    {detail.action_list.length ? (
                      detail.action_list.map((a) => (
                        <section key={a.action_id} className="dr-action">
                          <h5>
                            <bdi>{a.action_number}</bdi> · {label(a.status)}
                            {a.is_overdue ? ` · ${t("Overdue", "تاخیر")}` : ""}
                          </h5>
                          <p>
                            {label(a.action_type)} · {a.description}
                          </p>
                          <p>
                            {t("Owner", "ذمہ دار")}: {a.owner_name} ·{" "}
                            {t("Due", "آخری تاریخ")}: <bdi>{a.due_date}</bdi>
                          </p>
                          {a.outcome_note && <p>{a.outcome_note}</p>}
                        </section>
                      ))
                    ) : (
                      <p>{t("No actions recorded.", "اقدامات درج نہیں۔")}</p>
                    )}
                  </>
                )}
              <ErrorBox error={pdfError} verbatim />
              {pdfNotice && (
                <p role="status">
                  {pdfNotice === "opened"
                    ? t(
                        "Report opened. Close the viewer to return.",
                        "رپورٹ کھل گئی۔ واپس آنے کے لیے ونڈو بند کریں۔",
                      )
                    : pdfNotice === "saved"
                      ? t(
                          "PDF saved. No drill was reported again.",
                          "پی ڈی ایف محفوظ۔ مشق دوبارہ درج نہیں ہوئی۔",
                        )
                      : t(
                          "PDF save cancelled. No report changed.",
                          "پی ڈی ایف محفوظ کرنا منسوخ۔ رپورٹ نہیں بدلی۔",
                        )}
                </p>
              )}
              {editor && (
                <form ref={form} onSubmit={submit} className="dr-editor">
                  <h3>
                    {editor.mode === "create"
                      ? t("Report a drill", "مشق کی رپورٹ دیں")
                      : editor.mode === "edit"
                        ? t("Complete draft", "مسودہ مکمل کریں")
                        : editor.mode === "sign"
                          ? t("Confirm signature", "دستخط کی تصدیق")
                          : t(
                              "Record follow-up action",
                              "فالو اپ عمل درج کریں",
                            )}
                  </h3>
                  {editor.original && (
                    <p>
                      {t("Original version", "اصل نسخہ")}:{" "}
                      {editor.original.row_version} ·{" "}
                      <bdi>{editor.original.drill_number}</bdi>
                    </p>
                  )}
                  {conflict && (
                    <p className="notice" role="alert">
                      {t(
                        "Another terminal changed this report. Your draft remains intact. Read latest to compare; Cancel and reopen before reapplying against the new version.",
                        "دوسرے ٹرمینل نے رپورٹ بدلی۔ مسودہ برقرار ہے۔ تازہ پڑھ کر موازنہ کریں؛ نئے نسخے پر تبدیلی سے پہلے منسوخ اور دوبارہ کھولیں۔",
                      )}
                    </p>
                  )}
                  <ErrorBox error={lookupError} verbatim />
                  {validation && (
                    <p className="error" role="alert">
                      {validation}
                    </p>
                  )}
                  <fieldset
                    disabled={
                      blocked ||
                      !access.canManage ||
                      !connected ||
                      !!zoneProblem
                    }
                  >
                    {editor.mode === "sign" ? (
                      <>
                        <p>
                          {t(
                            "Signing freezes this report and includes it in server coverage. Review the report and participants above first.",
                            "دستخط رپورٹ حتمی کر کے سرور کوریج میں شامل کرتے ہیں۔ پہلے اوپر رپورٹ اور شرکاء چیک کریں۔",
                          )}
                        </p>
                        {missingToSign(editor.original!).length > 0 && (
                          <p role="alert">
                            {t(
                              "Complete before signing:",
                              "دستخط سے پہلے مکمل کریں:",
                            )}{" "}
                            {missingToSign(editor.original!)
                              .map(label)
                              .join(", ")}
                          </p>
                        )}
                      </>
                    ) : editor.mode === "action" ? (
                      <>
                        <Field label={t("Find action owner by name / badge", "عمل کا ذمہ دار نام / بیج سے تلاش کریں")}>
                          <input data-help="dr.staff" maxLength={100} value={staffQuery} onChange={e=>setStaffQuery(e.target.value)}/>
                        </Field>
                        <button type="button" data-help="dr.staff" onClick={()=>void findStaff()}>{t("Find staff", "عملہ تلاش کریں")}</button>
                        <Field label={t("Action type", "عمل کی قسم")}>
                          <select
                            required
                            data-help="dr.action-fields"
                            value={action.action_type}
                            onChange={(e) =>
                              setAction((a) => ({
                                ...a,
                                action_type: e.target.value,
                              }))
                            }
                          >
                            <option value="">
                              {t("Choose type", "قسم چنیں")}
                            </option>
                            {["Corrective", "Preventive"].map((k) => (
                              <option key={k} value={k}>
                                {label(k)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("Action description", "عمل کی وضاحت")}>
                          <textarea
                            required
                            minLength={5}
                            maxLength={1000}
                            data-help="dr.action-fields"
                            value={action.description}
                            onChange={(e) =>
                              setAction((a) => ({
                                ...a,
                                description: e.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field
                          label={t(
                            "Owner (staff login)",
                            "ذمہ دار (عملے کا لاگ ان)",
                          )}
                        >
                          <DirectoryPicker
                            required
                            data-help="dr.action-owner"
                            value={action.owner_user_id}
                            onChange={(e) =>
                              setAction((a) => ({
                                ...a,
                                owner_user_id: e.target.value,
                              }))
                            }
                           path="/staff/lookup" idField="user_id" userId search />
                        </Field>
                        <Field label={t("Due date", "آخری تاریخ")}>
                          <input
                            type="date"
                            required
                            data-help="dr.action-fields"
                            value={action.due_date}
                            onChange={(e) =>
                              setAction((a) => ({
                                ...a,
                                due_date: e.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t("Action department", "عمل کا شعبہ")}>
                          <select
                            data-help="dr.department"
                            value={action.department_id}
                            onChange={(e) =>
                              setAction((a) => ({
                                ...a,
                                department_id: e.target.value,
                              }))
                            }
                          >
                            <option value="">
                              {t("Not linked", "ربط نہیں")}
                            </option>
                            {depts.map((d) => (
                              <option
                                key={d.department_id}
                                value={d.department_id}
                              >
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <p>
                          {t(
                            "The owner is notified and closes the action with evidence in the action register. This screen does not fabricate completion.",
                            "ذمہ دار کو اطلاع جاتی ہے اور وہ عمل رجسٹر میں ثبوت کے ساتھ مکمل کرتا ہے۔ یہاں تکمیل فرض نہیں ہوتی۔",
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="dr-grid">
                          <Field label={t("Drill kind", "مشق کی قسم")}>
                            <select
                              required
                              data-help="dr.kind"
                              value={draft.kind}
                              onChange={(e) => update("kind", e.target.value)}
                            >
                              <option value="">
                                {t("Choose kind", "قسم چنیں")}
                              </option>
                              {drillKinds.map((k) => (
                                <option key={k} value={k}>
                                  {label(k)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={t("Shift", "شفٹ")}>
                            <select
                              required
                              data-help="dr.shift"
                              value={draft.shift}
                              onChange={(e) => update("shift", e.target.value)}
                            >
                              <option value="">
                                {t("Choose shift", "شفٹ چنیں")}
                              </option>
                              {drillShifts.map((k) => (
                                <option key={k} value={k}>
                                  {label(k)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <Field label={t("Scenario", "منظرنامہ")}>
                          <textarea
                            required
                            minLength={5}
                            maxLength={2000}
                            data-help="dr.scenario"
                            value={draft.scenario}
                            onChange={(e) => update("scenario", e.target.value)}
                          />
                        </Field>
                        <div className="dr-grid">
                          <Field label={t("Department", "شعبہ")}>
                            <select
                              data-help="dr.department"
                              value={draft.department_id}
                              onChange={(e) =>
                                update("department_id", e.target.value)
                              }
                            >
                              <option value="">
                                {t("Not linked", "ربط نہیں")}
                              </option>
                              {depts.map((d) => (
                                <option
                                  key={d.department_id}
                                  value={d.department_id}
                                >
                                  {d.name}
                                  {!d.is_active
                                    ? ` · ${t("inactive", "غیر فعال")}`
                                    : ""}
                                </option>
                              ))}
                              {draft.department_id &&
                                !depts.some(
                                  (d) =>
                                    String(d.department_id) ===
                                    draft.department_id,
                                ) && (
                                  <option value={draft.department_id}>
                                    {editor.original?.department_name ||
                                      draft.department_id}
                                  </option>
                                )}
                            </select>
                          </Field>
                          <Field label={t("Ward", "وارڈ")}>
                            <select
                              data-help="dr.ward"
                              value={draft.ward_id}
                              onChange={(e) =>
                                update("ward_id", e.target.value)
                              }
                            >
                              <option value="">
                                {t("Not linked", "ربط نہیں")}
                              </option>
                              {wards.map((w) => (
                                <option key={w.ward_id} value={w.ward_id}>
                                  {w.code} · {w.name}
                                </option>
                              ))}
                              {draft.ward_id &&
                                !wards.some(
                                  (w) => String(w.ward_id) === draft.ward_id,
                                ) && (
                                  <option value={draft.ward_id}>
                                    {editor.original?.ward_name ||
                                      draft.ward_id}
                                  </option>
                                )}
                            </select>
                          </Field>
                        </div>
                        <Field
                          label={t(
                            "Other area (department, ward or area required)",
                            "دیگر جگہ (شعبہ، وارڈ یا جگہ لازم)",
                          )}
                        >
                          <input
                            maxLength={200}
                            data-help="dr.area"
                            value={draft.area}
                            onChange={(e) => update("area", e.target.value)}
                          />
                        </Field>
                        <Field
                          label={t(
                            "Held at · hospital time",
                            "مشق کا وقت · ہسپتال کا وقت",
                          )}
                          hint={timeZone}
                        >
                          <input
                            type="datetime-local"
                            required
                            data-help="dr.time"
                            value={draft.held_at}
                            onChange={(e) => update("held_at", e.target.value)}
                          />
                        </Field>
                        <Field
                          label={t("Was it announced?", "کیا اعلان ہوا تھا؟")}
                        >
                          <select
                            required
                            data-help="dr.announced"
                            value={draft.announced}
                            onChange={(e) =>
                              update("announced", e.target.value)
                            }
                          >
                            <option value="">
                              {t("Choose actual answer", "اصل جواب چنیں")}
                            </option>
                            <option value="yes">{t("Yes", "ہاں")}</option>
                            <option value="no">{t("No", "نہیں")}</option>
                          </select>
                        </Field>
                        <Field
                          label={t(
                            "External agency (e.g. Rescue1122 / Civil Defence)",
                            "بیرونی ادارہ (ریسکیو1122 / سول ڈیفنس)",
                          )}
                        >
                          <input
                            maxLength={200}
                            data-help="dr.agency"
                            value={draft.external_agency}
                            onChange={(e) =>
                              update("external_agency", e.target.value)
                            }
                          />
                        </Field>
                        <div className="dr-grid">
                          <Field
                            label={t(
                              "Response minutes",
                              "ابتدائی ردعمل کے منٹ",
                            )}
                          >
                            <input
                              type="number"
                              min={0}
                              max={600}
                              step="any"
                              data-help="dr.minutes"
                              value={draft.response_minutes}
                              onChange={(e) =>
                                update("response_minutes", e.target.value)
                              }
                            />
                          </Field>
                          <Field
                            label={t("Evacuation minutes", "انخلا کے منٹ")}
                          >
                            <input
                              type="number"
                              min={0}
                              max={600}
                              step="any"
                              data-help="dr.minutes"
                              value={draft.evacuation_minutes}
                              onChange={(e) =>
                                update("evacuation_minutes", e.target.value)
                              }
                            />
                          </Field>
                        </div>
                        <Field label={t("Observations", "مشاہدات")}>
                          <textarea
                            maxLength={8000}
                            data-help="dr.observations"
                            value={draft.observations}
                            onChange={(e) =>
                              update("observations", e.target.value)
                            }
                          />
                        </Field>
                        <Field label={t("Outcome", "نتیجہ")}>
                          <select
                            data-help="dr.outcome"
                            value={draft.outcome}
                            onChange={(e) => update("outcome", e.target.value)}
                          >
                            <option value="">
                              {t("Not yet recorded", "ابھی درج نہیں")}
                            </option>
                            {drillOutcomes.map((k) => (
                              <option key={k} value={k}>
                                {label(k)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <h4>
                          {t("Participants and roles", "شرکاء اور کردار")}
                        </h4>
                        <Field
                          label={t(
                            "Find staff by name / badge",
                            "عملہ نام / بیج سے تلاش کریں",
                          )}
                        >
                          <input
                            data-help="dr.staff"
                            maxLength={100}
                            value={staffQuery}
                            onChange={(e) => setStaffQuery(e.target.value)}
                          />
                        </Field>
                        <button
                          type="button"
                          data-help="dr.staff"
                          onClick={() => void findStaff()}
                        >
                          {t("Find staff", "عملہ تلاش کریں")}
                        </button>
                        {draft.participants.map((p, index) => (
                          <div key={index} className="dr-participant">
                            <Field label={t("Participant", "شریک")}>
                              <select
                                required
                                data-help="dr.participant"
                                value={p.employee_id}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    participants: d.participants.map(
                                      (item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              employee_id: e.target.value,
                                            }
                                          : item,
                                    ),
                                  }))
                                }
                              >
                                <option value="">
                                  {t("Choose staff member", "عملے کا فرد چنیں")}
                                </option>
                                {staff.map((s) => (
                                  <option
                                    key={s.employee_id}
                                    value={s.employee_id}
                                  >
                                    {s.full_name} · {s.emp_number}
                                  </option>
                                ))}
                                {p.employee_id &&
                                  !currentStaff(p.employee_id) && (
                                    <option value={p.employee_id}>
                                      {editor.original?.participants.find(
                                        (s) =>
                                          String(s.employee_id) ===
                                          p.employee_id,
                                      )?.employee_name || p.employee_id}
                                    </option>
                                  )}
                              </select>
                            </Field>
                            <Field
                              label={t(
                                "Role in this drill",
                                "اس مشق میں کردار",
                              )}
                            >
                              <input
                                required
                                minLength={2}
                                maxLength={200}
                                data-help="dr.participant-role"
                                value={p.drill_role}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    participants: d.participants.map(
                                      (item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              drill_role: e.target.value,
                                            }
                                          : item,
                                    ),
                                  }))
                                }
                              />
                            </Field>
                            <button
                              type="button"
                              data-help="dr.participant-remove"
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  participants: d.participants.filter(
                                    (_, i) => i !== index,
                                  ),
                                }))
                              }
                            >
                              {t("Remove participant", "شریک ہٹائیں")}
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          data-help="dr.participant-add"
                          disabled={draft.participants.length >= 500}
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              participants: [
                                ...d.participants,
                                { employee_id: "", drill_role: "" },
                              ],
                            }))
                          }
                        >
                          {t("Add participant", "شریک شامل کریں")}
                        </button>
                        {editor.mode === "edit" && (
                          <p>
                            {t(
                              "Saving replaces the whole participant list. Review every retained or removed name.",
                              "محفوظ کرنا شرکاء کی پوری فہرست بدلتا ہے۔ ہر برقرار یا ہٹایا گیا نام چیک کریں۔",
                            )}
                          </p>
                        )}
                      </>
                    )}
                    <div className="actions">
                      <button
                        type="button"
                        data-help="dr.cancel"
                        onClick={() => {
                          setEditor(undefined);
                          setValidation("");
                        }}
                      >
                        {t("Cancel draft", "مسودہ منسوخ")}
                      </button>
                      <button
                        type="submit"
                        className="primary"
                        data-help="dr.submit"
                        disabled={
                          closedDraft ||
                          (editor.mode === "sign" &&
                            !!missingToSign(editor.original!).length)
                        }
                      >
                        {editor.mode === "sign"
                          ? t("Confirm and sign", "تصدیق اور دستخط")
                          : editor.mode === "action"
                            ? t("Save action", "عمل محفوظ کریں")
                            : t(
                                "Save draft report",
                                "رپورٹ کا مسودہ محفوظ کریں",
                              )}
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
