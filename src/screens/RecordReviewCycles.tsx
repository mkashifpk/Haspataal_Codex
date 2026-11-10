import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../bridge";
import type { ClinicalUser } from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Field, LoadState, useLoad } from "../components";
import * as review from "../generated/record_review_cycles";
import { bilingual as t } from "../i18n";
import { QualityHeading } from "./QualityRegister";

const cyclesPath = "/quality/record-reviews";
const statuses = {
  Planned: "منصوبہ بند",
  InReview: "زیر جائزہ",
  Closed: "بند",
  Cancelled: "منسوخ",
};
const disciplines = {
  Medical: "طبی",
  Nursing: "نرسنگ",
  Pharmacy: "فارمیسی",
  Laboratory: "لیبارٹری",
  Other: "دیگر",
};
const recordStates = { Active: "فعال", Discharged: "ڈسچارج", Visit: "ملاقات" };
type Discipline = review.ReviewerOut["discipline"];
type Draft =
  | { kind: "create"; due: review.NextDueOut | null }
  | { kind: "panel" | "start" | "close" | "cancel"; cycle: review.CycleOut }
  | { kind: "assign"; cycle: review.CycleOut; item: review.ItemListOut };

function PanelFields({
  people,
  active,
}: {
  people: review.PersonOut[];
  active: review.ReviewerOut[];
}) {
  if (!people.length)
    return (
      <p role="status">
        {t(
          "No staff are currently eligible to review records.",
          "فی الحال کوئی عملہ ریکارڈ جائزے کا اہل نہیں۔",
        )}
      </p>
    );
  return (
    <>
      <p>
        {t(
          "Choose eligible staff from both medical and nursing disciplines. Reassign pending records before removing a reviewer.",
          "طبی اور نرسنگ دونوں شعبوں سے اہل عملہ چنیں۔ جائزہ لینے والے کو ہٹانے سے پہلے زیر التوا ریکارڈ دوبارہ مقرر کریں۔",
        )}
      </p>
      {people.map((person) => {
        const selected = active.find(
          (reviewer) =>
            reviewer.user_id === person.user_id && reviewer.is_active,
        );
        return (
          <div key={person.user_id} className="toolbar">
            <label className="check">
              <input
                data-help="rrc.panel"
                type="checkbox"
                name="reviewer"
                value={person.user_id}
                defaultChecked={!!selected}
              />
              {person.display_name}
              {person.designation ? ` · ${person.designation}` : ""}
            </label>
            <Field label={t("Discipline", "شعبہ")}>
              <select
                data-help="rrc.panel"
                name={`discipline_${person.user_id}`}
                aria-label={`${t("Discipline", "شعبہ")} · ${person.display_name}`}
                defaultValue={selected?.discipline ?? person.default_discipline}
              >
                {Object.entries(disciplines).map(([key, ur]) => (
                  <option key={key} value={key}>
                    {t(key, ur)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        );
      })}
    </>
  );
}

function SamplingPlan({ plan }: { plan: review.PlanPreviewOut }) {
  return (
    <>
      <p>
        {plan.method} · {t("Confidence", "اعتماد")} {plan.confidence_level}% · z
        = {plan.z} · {t("Margin", "غلطی کی حد")} {plan.margin_pct}% ·{" "}
        {t("Minimum per group", "فی گروہ کم از کم")} {plan.min_per_stratum}
      </p>
      <p>
        {t("Population", "کل ریکارڈ")} {plan.population} ·{" "}
        {t("Required sample", "درکار نمونہ")} {plan.required_sample} ·{" "}
        {t("Planned sample", "منصوبہ بند نمونہ")} {plan.planned_sample}
      </p>
      {plan.is_drawn && (
        <p>
          {t("Sample frozen", "نمونہ مقفل")} · {t("Draw seed", "قرعہ کا عدد")}{" "}
          {plan.seed} · {t("Records drawn", "منتخب ریکارڈ")}{" "}
          {plan.drawn_records} · {t("Unassigned", "غیر مقرر")} {plan.unassigned}
        </p>
      )}
      {plan.strata.length === 0 ? (
        <p role="status">
          {t(
            "No eligible records in the selected period.",
            "منتخب مدت میں کوئی اہل ریکارڈ نہیں۔",
          )}
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Department", "شعبہ")}</th>
                <th>{t("Record state", "ریکارڈ کی حالت")}</th>
                <th>{t("Population", "کل ریکارڈ")}</th>
                <th>{t("Sample", "نمونہ")}</th>
              </tr>
            </thead>
            <tbody>
              {plan.strata.map((row) => (
                <tr key={row.stratum}>
                  <td>
                    {row.department_name ??
                      t("No department recorded", "شعبہ درج نہیں")}
                  </td>
                  <td>{t(row.record_state, recordStates[row.record_state])}</td>
                  <td>{row.population}</td>
                  <td>{row.sample}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function RecordReviewCycles({
  user,
  screenId = "record_review_cycles",
  connected,
  readOnly,
  revision,
  onOpenHelp,
}: {
  user: ClinicalUser;
  screenId?: "record_review_cycles" | "record_review_overview";
  connected: boolean;
  readOnly: boolean;
  revision: number;
  onOpenHelp: () => void;
}) {
  const canManage = user.permissions.includes("quality.review.manage");
  const canRead = canManage || user.permissions.includes("quality.review.view");
  const [cycleFilter, setCycleFilter] = useState<review.CycleOut["status"]>();
  const [cycleId, setCycleId] = useState<number>();
  const [itemId, setItemId] = useState<number>();
  const [draft, setDraft] = useState<Draft>();
  const [confirmed, setConfirmed] = useState(false);
  const editor = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (draft) editor.current?.focus();
  }, [draft]);
  const schedule = useLoad(
    () => (canRead ? review.reviewStatus() : Promise.resolve(undefined)),
    [canRead, revision],
  );
  const cycles = useLoad(
    () =>
      canRead
        ? review.listCyclesQualityRecordReviews({
            status: cycleFilter,
            limit: 200,
          })
        : Promise.resolve(undefined),
    [canRead, cycleFilter, revision],
  );
  const detail = useLoad(
    () =>
      canRead && cycleId
        ? review.getCycleQualityRecordReviews(cycleId)
        : Promise.resolve(undefined),
    [canRead, cycleId, revision],
  );
  const sample = useLoad(
    () =>
      canRead && cycleId
        ? review.samplePlan(cycleId)
        : Promise.resolve(undefined),
    [canRead, cycleId, revision],
  );
  const item = useLoad(
    () =>
      canManage && itemId ? review.getItem(itemId) : Promise.resolve(undefined),
    [canManage, itemId, revision],
  );
  const selectingPanel = draft?.kind === "panel" || draft?.kind === "create";
  const directory = useLoad(
    () =>
      canManage && selectingPanel
        ? review.people()
        : Promise.resolve(undefined),
    [canManage, selectingPanel, revision],
  );
  const people =
    !directory.loading && !directory.error
      ? directory.data?.filter((person) => person.can_review)
      : undefined;
  const current =
    !detail.loading && !detail.error && detail.data?.cycle_id === cycleId
      ? detail.data
      : undefined;
  const plan = !sample.loading && !sample.error ? sample.data : undefined;
  const activeItem =
    !item.loading && !item.error && item.data?.item_id === itemId
      ? item.data
      : undefined;
  const status =
    !schedule.loading && !schedule.error ? schedule.data : undefined;
  const list = !cycles.loading && !cycles.error ? cycles.data : undefined;
  const refresh = async () => {
    await Promise.all([
      schedule.reload(),
      cycles.reload(),
      detail.reload(),
      sample.reload(),
      item.reload(),
    ]);
  };
  const write = useClinicalWrite(
    user,
    screenId,
    async (result, command) => {
      if (command.path === cyclesPath) setCycleId(result.cycle_id);
      await refresh();
      setDraft(undefined);
      setConfirmed(false);
    },
  );
  const editable = connected && !readOnly && canManage && !write.blocked;
  const draftCycle = draft && "cycle" in draft ? draft.cycle : undefined;
  const stale =
    !!draftCycle &&
    !!current &&
    (draftCycle.cycle_id !== current.cycle_id ||
      draftCycle.row_version !== current.row_version ||
      draftCycle.status !== current.status ||
      JSON.stringify(draftCycle.reviewers) !==
        JSON.stringify(current.reviewers));
  const ready =
    editable &&
    !stale &&
    (!draftCycle || !!current) &&
    (!selectingPanel || !!people);
  const closeChecks = [
    {
      ok: !!current && current.items.every((row) => row.status === "Reviewed"),
      label: t(
        "Every sampled record reviewed",
        "ہر منتخب ریکارڈ کا جائزہ مکمل",
      ),
    },
    {
      ok: current?.deficiencies.open === 0,
      label: t("No open deficiencies", "کوئی کھلی کمی نہیں"),
    },
    {
      ok:
        !!current &&
        (current.deficiencies.total === 0 || current.actions.length > 0),
      label: t(
        "Action recorded if deficiencies were found",
        "کمی ہو تو کارروائی درج",
      ),
    },
  ];
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      write.error.response.error?.code?.startsWith("RECORD_REVIEW")
    ) {
      setConfirmed(false);
      void refresh();
    }
  }, [write.error]);

  function edit(next: Draft | undefined) {
    setDraft(next);
    setConfirmed(false);
    write.clearError();
  }
  function chooseCycle(id: number) {
    setCycleId(id);
    setItemId(undefined);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !ready || !confirmed) return;
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const chosen = (people ?? [])
      .filter((person) =>
        data.getAll("reviewer").includes(String(person.user_id)),
      )
      .map((person) => ({
        user_id: person.user_id,
        discipline: text(`discipline_${person.user_id}`) as Discipline,
      }));
    const permission = "quality.review.manage";
    const label = t("Save this review action", "یہ جائزہ کارروائی محفوظ کریں");
    if (draft.kind === "create") {
      const period_start = text("period_start");
      const period_end = text("period_end");
      if (period_start > period_end) {
        const end = event.currentTarget.elements.namedItem("period_end");
        if (end instanceof HTMLInputElement) {
          end.setCustomValidity(
            t(
              "The end must be on or after the start.",
              "انتہا ابتدا کے برابر یا بعد ہو۔",
            ),
          );
          end.reportValidity();
        }
        return;
      }
      const defaultPeriod =
        draft.due?.period_start === period_start &&
        draft.due.period_end === period_end;
      const confidence = text("confidence");
      const body: review.CycleIn = {
        ...(defaultPeriod ? {} : { period_start, period_end }),
        ...(text("title") ? { title: text("title") } : {}),
        ...(text("due_date") ? { due_date: text("due_date") } : {}),
        ...(confidence
          ? {
              confidence_level: Number(
                confidence,
              ) as review.CycleIn["confidence_level"],
            }
          : {}),
        ...(text("margin_pct")
          ? { margin_pct: Number(text("margin_pct")) }
          : {}),
        ...(text("min_per_stratum")
          ? { min_per_stratum: Number(text("min_per_stratum")) }
          : {}),
        include_opd: data.has("include_opd"),
        reviewers: chosen,
      };
      write.start(
        {
          method: "POST",
          path: cyclesPath,
          body,
          permission,
          label,
          protection: "idempotent",
          reconcilePath: cyclesPath,
        },
        async () => {
          if (defaultPeriod) {
            const live = (await review.reviewStatus()).next_due;
            if (
              live?.period_start !== period_start ||
              live.period_end !== period_end
            ) {
              await schedule.reload();
              throw Error(
                t(
                  "The next due period changed. Reopen the plan and compare dates.",
                  "اگلی مدت بدل گئی۔ منصوبہ دوبارہ کھول کر تاریخیں ملائیں۔",
                ),
              );
            }
          }
        },
      );
      return;
    }
    const cycle = draft.cycle;
    const base = `${cyclesPath}/${cycle.cycle_id}`;
    const prepare = async () => {
      const live = await review.getCycleQualityRecordReviews(cycle.cycle_id);
      if (
        live.row_version !== cycle.row_version ||
        live.status !== cycle.status ||
        JSON.stringify(live.reviewers) !== JSON.stringify(cycle.reviewers) ||
        JSON.stringify(live.items) !== JSON.stringify(cycle.items)
      ) {
        await refresh();
        throw Error(
          t(
            "The saved cycle changed. Compare the current record and reopen the draft.",
            "محفوظ چکر بدل گیا۔ موجودہ ریکارڈ ملائیں اور مسودہ دوبارہ کھولیں۔",
          ),
        );
      }
    };
    const reconcile = {
      permission,
      label,
      protection: "reconcile" as const,
      reconcilePath: base,
    };
    if (draft.kind === "panel") {
      write.start(
        {
          ...reconcile,
          method: "PUT",
          path: base + "/reviewers",
          body: { reviewers: chosen },
        },
        prepare,
      );
    } else if (draft.kind === "assign") {
      const reviewer = cycle.reviewers.find(
        (row) =>
          row.is_active && row.user_id === Number(text("reviewer_user_id")),
      );
      if (!reviewer) return;
      write.start(
        {
          ...reconcile,
          method: "POST",
          path: `/quality/record-review-items/${draft.item.item_id}/assign`,
          body: { reviewer_user_id: reviewer.user_id },
        },
        prepare,
      );
    } else if (
      draft.kind === "start" &&
      plan?.population &&
      current?.status === "Planned"
    ) {
      write.start(
        { ...reconcile, method: "POST", path: base + "/start" },
        prepare,
      );
    } else if (
      draft.kind === "close" &&
      closeChecks.every((check) => check.ok)
    ) {
      write.start(
        {
          ...reconcile,
          method: "POST",
          path: base + "/close",
          body: { summary: text("summary") },
        },
        prepare,
      );
    } else if (draft.kind === "cancel") {
      write.start(
        {
          ...reconcile,
          method: "POST",
          path: base + "/cancel",
          body: { reason: text("reason") },
        },
        prepare,
      );
    }
  }

  return (
    <section
      data-screen={screenId}
      data-unsaved={!!draft}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={screenId === "record_review_overview" ? t("Medical record review (MSDS)", "طبی ریکارڈ کا جائزہ (ایم ایس ڈی ایس)") : t("Record review cycles", "طبی ریکارڈ کے جائزے")}
        text={t(
          "Plan a cycle, choose the panel, review the sampling plan and follow the records and deficiencies through closure.",
          "جائزے کی مدت اور پینل طے کریں، نمونے کا منصوبہ دیکھیں اور ریکارڈ و کمیوں کی بندش تک پیروی کریں۔",
        )}
        onHelp={onOpenHelp}
      />
      {!canRead && (
        <p role="status">
          {t(
            "Record review access is required.",
            "طبی ریکارڈ جائزے تک رسائی درکار ہے۔",
          )}
        </p>
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          edit(undefined);
          void refresh();
        }}
      />
      {canRead && (
        <article className="card">
          <h2>{t("Review schedule", "جائزے کا شیڈول")}</h2>
          <LoadState {...schedule} retry={() => void schedule.reload()} />
          {status && (
            <>
              <p>
                {status.next_due ? (
                  <>
                    <strong>{status.next_due.label}</strong> ·{" "}
                    {status.next_due.period_start} –{" "}
                    {status.next_due.period_end} · {t("Due", "آخری تاریخ")}{" "}
                    {status.next_due.due_by}
                    {status.next_due.is_overdue && (
                      <strong className="error">
                        {" "}
                        · {t("Overdue", "تاخیر")}
                      </strong>
                    )}
                  </>
                ) : (
                  t(
                    "The last completed period is covered.",
                    "پچھلی مکمل مدت کا جائزہ درج ہے۔",
                  )
                )}
              </p>
              <p>
                MSDS {status.indicator_156.indicator} ·{" "}
                {status.indicator_156.evidence}
              </p>
              <p>
                {t("Open deficiencies", "کھلی کمیاں")}{" "}
                {status.open_deficiencies} ·{" "}
                {t("Overdue actions", "تاخیر کی کارروائیاں")}{" "}
                {status.overdue_actions}
              </p>
              {editable && !draft && (
                <button
                  data-help="rrc.plan"
                  onClick={() => edit({ kind: "create", due: status.next_due })}
                >
                  {t("Plan review", "جائزہ منصوبہ بنائیں")}
                </button>
              )}
            </>
          )}
        </article>
      )}
      {canRead && (
        <article className="card">
          <h2>{t("Review cycles", "جائزے کے چکر")}</h2>
          <div className="toolbar">
            <Field label={t("Cycle status", "جائزے کی حالت")}>
              <select
                data-help="rrc.list"
                value={cycleFilter ?? ""}
                disabled={!!draft || !connected}
                onChange={(e) =>
                  setCycleFilter(
                    (e.target.value || undefined) as typeof cycleFilter,
                  )
                }
              >
                <option value="">{t("All states", "تمام حالتیں")}</option>
                {Object.entries(statuses).map(([key, ur]) => (
                  <option key={key} value={key}>
                    {t(key, ur)}
                  </option>
                ))}
              </select>
            </Field>
            <button
              data-help="rrc.list"
              disabled={!connected || write.blocked}
              onClick={() => void refresh()}
            >
              {t("Refresh review records", "جائزہ ریکارڈ تازہ پڑھیں")}
            </button>
          </div>
          <LoadState {...cycles} retry={() => void cycles.reload()} />
          {list?.length === 0 && (
            <p role="status">
              {t(
                "No review cycles match this filter.",
                "اس فلٹر سے کوئی جائزہ نہیں ملا۔",
              )}
            </p>
          )}
          {!!list?.length && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Cycle", "جائزہ")}</th>
                    <th>{t("Period", "مدت")}</th>
                    <th>{t("State", "حالت")}</th>
                    <th>{t("Reviewed", "جائزہ ہوا")}</th>
                    <th>{t("Open", "کھولیں")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.cycle_id}>
                      <th scope="row">
                        {row.cycle_number}
                        <br />
                        {row.title}
                      </th>
                      <td>
                        {row.period_start} – {row.period_end}
                      </td>
                      <td>{t(row.status, statuses[row.status])}</td>
                      <td>
                        {row.items_reviewed} / {row.items_total}
                      </td>
                      <td>
                        <button
                          data-help="rrc.list"
                          disabled={!!draft}
                          onClick={() => chooseCycle(row.cycle_id)}
                        >
                          {t("Open cycle", "جائزہ کھولیں")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}
      {cycleId && (
        <article className="card">
          <LoadState {...detail} retry={() => void detail.reload()} />
          {current && (
            <>
              <h2>
                {current.cycle_number} · {current.title}
              </h2>
              <p>
                {t(current.status, statuses[current.status])} ·{" "}
                {current.period_start} – {current.period_end} ·{" "}
                {t("Due", "آخری تاریخ")} {current.due_date}
              </p>
              <h3>{t("Review panel", "جائزہ پینل")}</h3>
              {!current.reviewers.length && (
                <p>
                  {t(
                    "No reviewers on this cycle yet.",
                    "اس جائزے میں ابھی کوئی جائزہ لینے والا نہیں۔",
                  )}
                </p>
              )}
              {current.reviewers.map((row) => (
                <div key={row.user_id}>
                  <p>
                    {row.display_name} ·{" "}
                    {t(row.discipline, disciplines[row.discipline])} ·{" "}
                    {row.reviewed} / {row.assigned}
                    {!row.is_active && ` · ${t("Inactive", "غیر فعال")}`}
                  </p>
                  <progress
                    aria-label={row.display_name}
                    max={Math.max(1, row.assigned)}
                    value={row.reviewed}
                  />
                </div>
              ))}
              {editable &&
                !draft &&
                ["Planned", "InReview"].includes(current.status) && (
                  <button
                    data-help="rrc.panel"
                    onClick={() => edit({ kind: "panel", cycle: current })}
                  >
                    {t("Edit review panel", "جائزہ پینل بدلیں")}
                  </button>
                )}
              <h3>{t("Sampling plan", "نمونے کا منصوبہ")}</h3>
              <LoadState {...sample} retry={() => void sample.reload()} />
              {plan && <SamplingPlan plan={plan} />}
              {editable && !draft && current.status === "Planned" && (
                <button
                  data-help="rrc.start"
                  disabled={
                    !plan?.population ||
                    !current.reviewers.some((row) => row.is_active)
                  }
                  onClick={() => edit({ kind: "start", cycle: current })}
                >
                  {t("Start review", "جائزہ شروع کریں")}
                </button>
              )}
              {current.items.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Record and MRN", "ریکارڈ اور ایم آر این")}</th>
                        <th>{t("Reviewer", "جائزہ لینے والا")}</th>
                        <th>{t("State", "حالت")}</th>
                        <th>{t("Actions", "اعمال")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.items.map((row) => (
                        <tr key={row.item_id}>
                          <th scope="row">
                            <bdi>
                              {row.record_number} · {row.mrn}
                            </bdi>
                          </th>
                          <td>
                            {row.reviewer_name ?? t("Unassigned", "غیر مقرر")}
                          </td>
                          <td>
                            {row.status === "Reviewed"
                              ? t("Reviewed", "جائزہ مکمل")
                              : t("Pending", "زیر التوا")}
                          </td>
                          <td>
                            {canManage && (
                              <button
                                data-help="rrc.item"
                                disabled={!!draft}
                                onClick={() => setItemId(row.item_id)}
                              >
                                {t("Read sampled record", "منتخب ریکارڈ پڑھیں")}
                              </button>
                            )}
                            {editable &&
                              !draft &&
                              current.status === "InReview" &&
                              row.status === "Pending" && (
                                <button
                                  data-help="rrc.assign"
                                  onClick={() =>
                                    edit({
                                      kind: "assign",
                                      cycle: current,
                                      item: row,
                                    })
                                  }
                                >
                                  {t(
                                    "Assign reviewer",
                                    "جائزہ لینے والا مقرر کریں",
                                  )}
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <h3>{t("Deficiencies and actions", "کمیاں اور کارروائیاں")}</h3>
              <p>
                {t("Open deficiencies", "کھلی کمیاں")}{" "}
                {current.deficiencies.open} / {current.deficiencies.total} ·{" "}
                {t("Actions recorded", "درج کارروائیاں")}{" "}
                {current.actions.length}
              </p>
              {current.actions.map((action) => (
                <p key={action.action_id}>
                  <bdi>{action.action_number}</bdi> · {action.description} ·{" "}
                  {action.owner_name}
                </p>
              ))}
              {current.status === "InReview" && (
                <>
                  <ul>
                    {closeChecks.map(({ ok, label }) => (
                      <li key={label}>
                        {ok ? t("Ready", "تیار") : t("Pending", "زیر التوا")} ·{" "}
                        {label}
                      </li>
                    ))}
                  </ul>
                  {editable && !draft && (
                    <button
                      data-help="rrc.close"
                      disabled={!closeChecks.every((check) => check.ok)}
                      onClick={() => edit({ kind: "close", cycle: current })}
                    >
                      {t("Close review", "جائزہ بند کریں")}
                    </button>
                  )}
                </>
              )}
              {current.summary && <p>{current.summary}</p>}
              {current.cancel_reason && <p>{current.cancel_reason}</p>}
              {editable &&
                !draft &&
                ["Planned", "InReview"].includes(current.status) && (
                  <button
                    data-help="rrc.cancel"
                    onClick={() => edit({ kind: "cancel", cycle: current })}
                  >
                    {t("Cancel cycle", "جائزہ منسوخ کریں")}
                  </button>
                )}
            </>
          )}
        </article>
      )}
      {itemId && (
        <article className="card">
          <h2>{t("Sampled record", "منتخب ریکارڈ")}</h2>
          <button data-help="rrc.item" onClick={() => setItemId(undefined)}>
            {t("Close sampled record", "منتخب ریکارڈ بند کریں")}
          </button>
          <LoadState {...item} retry={() => void item.reload()} />
          {activeItem && (
            <>
              <p>
                <bdi>
                  {activeItem.record_number} · {activeItem.mrn}
                </bdi>{" "}
                · {activeItem.department_name}
              </p>
              {activeItem.criteria.map((criterion) => (
                <p key={criterion.code}>
                  <strong>{criterion.title}</strong> ·{" "}
                  {activeItem.answers?.[criterion.code]?.answer ??
                    activeItem.auto_results[criterion.code]?.result ??
                    t(
                      "Reviewer answer needed",
                      "جائزہ لینے والے کا جواب درکار",
                    )}
                  {activeItem.auto_results[criterion.code]?.detail &&
                    ` · ${activeItem.auto_results[criterion.code].detail}`}
                </p>
              ))}
              {activeItem.reviewer_note && <p>{activeItem.reviewer_note}</p>}
              {activeItem.deficiencies.map((row) => (
                <p key={row.deficiency_id}>
                  {row.description} · {row.status}
                </p>
              ))}
            </>
          )}
        </article>
      )}
      {draft && (
        <form
          className="card"
          onSubmit={save}
          onChange={(e) => {
            if (!(
              e.target instanceof HTMLInputElement &&
              e.target.name === "confirmed"
            ))
              setConfirmed(false);
            const end = e.currentTarget.elements.namedItem("period_end");
            if (end instanceof HTMLInputElement) end.setCustomValidity("");
          }}
        >
          <h2 ref={editor} tabIndex={-1}>
            {t("Review this change", "اس تبدیلی کا جائزہ")}
          </h2>
          {stale && (
            <p role="alert">
              {t(
                "The saved cycle changed. Compare it, cancel the draft and reopen it.",
                "محفوظ چکر بدل گیا۔ موازنہ کریں، مسودہ منسوخ کر کے دوبارہ کھولیں۔",
              )}
            </p>
          )}
          {selectingPanel && (
            <LoadState {...directory} retry={() => void directory.reload()} />
          )}
          <fieldset disabled={!ready}>
            {draft.kind === "create" && (
              <>
                <Field label={t("Period start", "مدت کی ابتدا")}>
                  <input
                    data-help="rrc.plan"
                    name="period_start"
                    type="date"
                    required
                    defaultValue={draft.due?.period_start}
                  />
                </Field>
                <Field label={t("Period end", "مدت کی انتہا")}>
                  <input
                    data-help="rrc.plan"
                    name="period_end"
                    type="date"
                    required
                    defaultValue={draft.due?.period_end}
                  />
                </Field>
                <Field label={t("Due date", "آخری تاریخ")}>
                  <input data-help="rrc.plan" name="due_date" type="date" />
                </Field>
                <Field label={t("Cycle title", "جائزے کا عنوان")}>
                  <input
                    data-help="rrc.plan"
                    name="title"
                    minLength={3}
                    maxLength={200}
                  />
                </Field>
                <Field label={t("Confidence", "اعتماد")}>
                  <select data-help="rrc.plan" name="confidence">
                    <option value="">
                      {t("Hospital default", "ہسپتال کی ترتیب")}
                    </option>
                    <option value="90">90%</option>
                    <option value="95">95%</option>
                    <option value="99">99%</option>
                  </select>
                </Field>
                <Field label={t("Margin of error %", "غلطی کی حد فیصد")}>
                  <input
                    data-help="rrc.plan"
                    name="margin_pct"
                    type="number"
                    min={3}
                    max={20}
                    step="any"
                  />
                </Field>
                <Field label={t("Minimum per group", "فی گروہ کم از کم")}>
                  <input
                    data-help="rrc.plan"
                    name="min_per_stratum"
                    type="number"
                    min={1}
                    max={50}
                  />
                </Field>
                <label className="check">
                  <input
                    data-help="rrc.plan"
                    name="include_opd"
                    type="checkbox"
                  />
                  {t("Include OPD visits", "او پی ڈی ملاقاتیں شامل کریں")}
                </label>
              </>
            )}
            {selectingPanel && people && (
              <PanelFields
                people={people}
                active={draftCycle?.reviewers ?? []}
              />
            )}
            {draft.kind === "start" && (
              <p>
                {t(
                  "Starting draws the records, notifies reviewers and freezes the sample and dates.",
                  "شروع کرنے سے ریکارڈ منتخب، جائزہ لینے والوں کو اطلاع اور نمونہ و تاریخیں مقفل ہوں گی۔",
                )}
              </p>
            )}
            {draft.kind === "assign" && (
              <Field label={t("Assign to panel member", "پینل ممبر مقرر کریں")}>
                <select
                  data-help="rrc.assign"
                  name="reviewer_user_id"
                  required
                  defaultValue=""
                >
                  <option value="">
                    {t("Choose an eligible panel member", "اہل پینل ممبر چنیں")}
                  </option>
                  {draft.cycle.reviewers
                    .filter(
                      (row) =>
                        row.is_active &&
                        row.user_id !== draft.item.reviewer_user_id,
                    )
                    .map((row) => (
                      <option value={row.user_id} key={row.user_id}>
                        {row.display_name} ·{" "}
                        {t(row.discipline, disciplines[row.discipline])}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {draft.kind === "close" && (
              <Field label={t("Closing minutes", "اختتامی روداد")}>
                <textarea
                  data-help="rrc.close"
                  name="summary"
                  required
                  minLength={10}
                  maxLength={5000}
                />
              </Field>
            )}
            {draft.kind === "cancel" && (
              <Field label={t("Reason for cancelling", "منسوخی کی وجہ")}>
                <textarea
                  data-help="rrc.cancel"
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                />
              </Field>
            )}
            <label className="check">
              <input
                data-help="rrc.save"
                name="confirmed"
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t(
                "I checked the current cycle and this action.",
                "میں نے موجودہ جائزہ اور یہ کارروائی چیک کی۔",
              )}
            </label>
            <button data-help="rrc.save" disabled={!confirmed}>
              {t("Save review action", "جائزے کی کارروائی محفوظ کریں")}
            </button>
          </fieldset>
          <button
            type="button"
            data-help="rrc.save"
            disabled={write.blocked}
            onClick={() => edit(undefined)}
          >
            {t("Cancel draft", "مسودہ منسوخ کریں")}
          </button>
        </form>
      )}
    </section>
  );
}
