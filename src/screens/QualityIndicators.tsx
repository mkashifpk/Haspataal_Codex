import { useState, type FormEvent } from "react";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Field, LoadState, Modal, useLoad } from "../components";
import * as indicators from "../generated/quality_indicators";
import * as targets from "../generated/quality_indicator_targets";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod } from "./QualityRegister";
import {
  ConfirmEntry,
  formText,
  monthBefore,
  ReportTable,
  type P9cProps,
} from "./P9cShared";
import { QualityPaper } from "./QualityPaper";

const units = {
  Percent: ["%", "٪"],
  PerThousandPatientDays: ["per 1,000 patient days", "فی ۱۰۰۰ مریض دن"],
  Count: ["count", "تعداد"],
  Days: ["days", "دن"],
} as const;
const states = {
  Met: ["Met", "پورا"],
  NotMet: ["Not met", "پورا نہیں"],
  NoTarget: ["No target", "ہدف نہیں"],
  NoData: ["", ""],
  NotApplicable: ["Not applicable", "قابل اطلاق نہیں"],
} as const;
const groups = {
  Assessment: "جائزہ",
  Diagnostics: "تشخیص",
  Procedures: "طبی عمل",
  Medication: "ادویات",
  Anaesthesia: "بے ہوشی",
  Blood: "خون",
  Records: "ریکارڈ",
  Outcomes: "نتائج",
} as const;
const direction = {
  Higher: ["Higher is better", "زیادہ بہتر"],
  Lower: ["Lower is better", "کم بہتر"],
  Neither: ["No preferred direction", "کوئی ترجیحی سمت نہیں"],
} as const;
const local = (pair: readonly [string, string]) => t(pair[0], pair[1]);
const symbol = (comparison: string | null) =>
  comparison === "AtLeast" ? "≥" : comparison === "AtMost" ? "≤" : "";
const statusClass = (status: string) =>
  status === "NotMet"
    ? "error"
    : status === "Met"
      ? "success"
      : status === "NoTarget"
        ? "muted"
        : undefined;
function amount(value: number | null, unit: keyof typeof units) {
  return value === null ? "—" : value + " " + local(units[unit]);
}

export function IndicatorTargets({
  user,
  connected,
  revision,
  onOpenHelp,
}: P9cProps) {
  const canRead = user.permissions.includes("quality.indicator.view"),
    canWrite = user.permissions.includes("quality.indicator.manage");
  const [row, setRow] = useState<targets.IndicatorTargetOut>();
  const list = useLoad(
    () => (canRead ? targets.indicatorTargets() : Promise.resolve([])),
    [canRead, revision],
  );
  const write = useClinicalWrite(
    user,
    "quality_indicator_targets",
    async () => {
      setRow(undefined);
      await list.reload();
    },
  );
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!row || !canWrite || !connected || write.blocked) return;
    const f = new FormData(e.currentTarget),
      raw = formText(f, "target");
    if (!raw || !formText(f, "note")) return;
    const body: targets.IndicatorTargetIn = {
      target: Number(raw),
      comparison: formText(
        f,
        "comparison",
      ) as targets.IndicatorTargetIn["comparison"],
      note: formText(f, "note"),
    };
    write.start(
      {
        method: "PUT",
        path: "/quality/indicator-targets/" + encodeURIComponent(row.code),
        body,
        permission: "quality.indicator.manage",
        protection: "reconcile",
        reconcilePath: "/quality/indicator-targets",
        label: t("Set indicator benchmark", "اشاریہ معیار مقرر کریں"),
      },
      async () => {
        const current = (await targets.indicatorTargets()).find(
          (x) => x.code === row.code,
        );
        if (!current || current.row_version !== row.row_version)
          throw new Error(
            t(
              "The benchmark changed. Close the draft and refresh before writing.",
              "معیار بدل گیا۔ مسودہ بند کر کے لکھنے سے پہلے تازہ کریں۔",
            ),
          );
      },
    );
  }
  return (
    <section
      data-screen="quality_indicator_targets"
      data-unsaved={!!row}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t("Quality indicator benchmarks", "معیار اشاریہ اہداف")}
        text={t(
          "Read the current hospital benchmarks and their source.",
          "موجودہ ہسپتال اہداف اور ماخذ پڑھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      <LoadState {...list} retry={list.reload} />
      {!list.loading && !list.error && (
        <ReportTable
          title={t("Benchmark register", "ہدف رجسٹر")}
          columns={[
            t("Indicator", "اشاریہ"),
            t("Unit and direction", "اکائی اور سمت"),
            t("Benchmark", "معیار"),
            t("Source and author", "ماخذ اور مصنف"),
            t("Action", "عمل"),
          ]}
          rows={(list.data ?? []).map((x) => ({
            key: x.code,
            cells: [
              x.title + " · " + x.msds,
              local(units[x.unit]) + " · " + local(direction[x.better]),
              symbol(x.comparison) + " " + amount(x.target, x.unit),
              <>
                {x.note ?? "—"}
                <br />
                {x.set_by_name} {x.set_at}
              </>,
              canWrite && (
                <button
                  data-help="ind.target"
                  disabled={!connected || write.blocked}
                  onClick={() => {
                    setRow(x);
                    write.clearError();
                  }}
                >
                  {t("Set benchmark", "معیار مقرر کریں")}
                </button>
              ),
            ],
          }))}
        />
      )}
      {!row && <ClinicalWriteFeedback write={write} />}
      {row && (
        <Modal
          title={t("Set indicator benchmark", "اشاریہ معیار مقرر کریں")}
          closable={!write.blocked}
          onClose={() => setRow(undefined)}
        >
          <form className="form" onSubmit={save}>
            <fieldset disabled={write.blocked}>
              <p>
                {row.title} · {row.msds} · {local(units[row.unit])} ·{" "}
                {local(direction[row.better])}
              </p>
              <Field label={t("Benchmark value", "معیار قدر")}>
                <input
                  data-help="ind.target"
                  name="target"
                  type="number"
                  min={0}
                  max={100000}
                  step="any"
                  required
                  defaultValue={row.target ?? ""}
                />
              </Field>
              <Field label={t("Comparison", "موازنہ")}>
                <select
                  data-help="ind.target"
                  name="comparison"
                  defaultValue={
                    row.comparison ??
                    (row.better === "Lower" ? "AtMost" : "AtLeast")
                  }
                >
                  <option value="AtLeast">{t("At least", "کم از کم")}</option>
                  <option value="AtMost">
                    {t("At most", "زیادہ سے زیادہ")}
                  </option>
                </select>
              </Field>
              <Field label={t("Source of benchmark", "معیار ماخذ")}>
                <textarea
                  data-help="ind.target"
                  name="note"
                  required
                  maxLength={1000}
                  defaultValue={row.note ?? ""}
                />
              </Field>
              <ConfirmEntry />
            </fieldset>
            <ClinicalWriteFeedback write={write} />
            <button
              data-help="p9c.write"
              className="primary"
              disabled={!connected || write.blocked}
            >
              {t("Confirm benchmark", "معیار کی تصدیق")}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

export function QualityIndicators({
  screenId,
  user,
  connected,
  timeZone,
  revision,
  onOpenHelp,
}: P9cProps & { screenId: "quality_indicators" | "quality_indicators_owner" }) {
  const allowed = user.permissions.includes("quality.indicator.view");
  const [range, setRange] = useState(() => currentMonth(timeZone));
  const [code, setCode] = useState<string>();
  const [months, setMonths] = useState(12);
  const list = useLoad(
    () =>
      allowed && range.date_from
        ? indicators.qualityIndicators(range)
        : Promise.resolve(undefined),
    [allowed, range, revision],
  );
  const benchmarks = useLoad(
    () => (allowed ? indicators.indicatorTargets() : Promise.resolve([])),
    [allowed, revision],
  );
  const trend = useLoad(
    () =>
      allowed && code
        ? indicators.indicatorTrend(code, { months })
        : Promise.resolve(undefined),
    [allowed, code, months, revision],
  );
  const report = !list.loading && !list.error ? list.data : undefined;
  const series =
    !trend.loading && !trend.error && trend.data?.code === code
      ? trend.data
      : undefined;
  const grouped = new Map<string, indicators.QualityIndicatorOut[]>();
  for (const x of report?.indicators ?? [])
    grouped.set(x.group, [...(grouped.get(x.group) ?? []), x]);
  const max = Math.max(
    1,
    ...(series?.points.flatMap((x) => [x.value ?? 0, x.target ?? 0]) ?? []),
  );
  return (
    <section data-screen={screenId}>
      <QualityHeading
        title={t("Clinical quality indicators", "طبی معیار اشاریے")}
        text={t(
          "Compare results with hospital benchmarks and review monthly trends.",
          "ہسپتال کے اہداف سے نتائج ملائیں اور ماہانہ رجحان دیکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      <div className="toolbar">
        <button
          data-help="ind.report"
          onClick={() => setRange(currentMonth(timeZone))}
        >
          {t("This month so far", "یہ ماہ اب تک")}
        </button>
        <button
          data-help="ind.report"
          onClick={() => setRange(monthBefore(timeZone))}
        >
          {t("Last month", "گزشتہ ماہ")}
        </button>
      </div>
      <QualityPeriod
        key={range.date_from + range.date_to}
        range={range}
        apply={setRange}
      />
      <LoadState {...list} retry={list.reload} />
      <LoadState {...benchmarks} retry={benchmarks.reload} />
      {report && (
        <>
          <p>
            {report.date_from} — {report.date_to} · {t("Met", "پورا")}{" "}
            {report.met} · {t("Not met", "پورا نہیں")} {report.not_met}
          </p>
          {[...grouped].map(([group, rows]) => (
            <section key={group} className="card">
              <h2>{t(rows[0].group_title, groups[rows[0].group])}</h2>
              <div className="workspace-grid">
                {rows.map((x) => (
                  <article className="card" key={x.code}>
                    <h3>{x.title}</h3>
                    <p>
                      {x.msds} ·{" "}
                      <strong className={statusClass(x.status)}>
                        {local(states[x.status])}
                      </strong>
                    </p>
                    <p>
                      <strong>
                        {x.value === null ? "" : amount(x.value, x.unit)}
                      </strong>{" "}
                      · {x.numerator} / {x.denominator ?? "—"}
                    </p>
                    <p>
                      {t("Target", "ہدف")} {symbol(x.comparison)}{" "}
                      {amount(x.target, x.unit)}
                    </p>
                    <p>
                      {benchmarks.data?.find((b) => b.code === x.code)?.note}
                    </p>
                    <button
                      data-help="ind.report"
                      onClick={() => setCode(x.code)}
                    >
                      {t("Open trend", "رجحان کھولیں")}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))}
          <QualityPaper
            disabled={!connected}
            documents={[
              {
                path: "/quality/indicators/pdf?" + new URLSearchParams(range),
                label: t("quality indicators report", "معیار اشاریے رپورٹ"),
              },
            ]}
          />
        </>
      )}
      {code && (
        <Modal
          title={t("Indicator trend", "اشاریہ رجحان")}
          onClose={() => setCode(undefined)}
        >
          <Field label={t("Months", "مہینے")}>
            <select
              data-help="ind.report"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              {[3, 6, 12, 24].map((x) => (
                <option value={x} key={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <LoadState {...trend} retry={trend.reload} />
          {series && (
            <ReportTable
              title={series.title}
              columns={[
                t("Month", "مہینہ"),
                t("Value / target", "قدر / ہدف"),
                t("Count", "شمار"),
                t("State", "حالت"),
              ]}
              rows={series.points.map((x) => ({
                key: x.month,
                cells: [
                  x.month +
                    " · " +
                    (x.frozen ? t("Frozen", "منجمد") : t("Live", "براہ راست")),
                  <>
                    {x.value !== null && (
                      <div
                        aria-hidden
                        style={{
                          height: 12,
                          width: (100 * x.value) / max + "%",
                          background: x.frozen
                            ? "currentColor"
                            : "repeating-linear-gradient(135deg,currentColor 0 2px,transparent 2px 5px)",
                        }}
                      />
                    )}
                    {amount(x.value, series.unit)} / {symbol(x.comparison)}{" "}
                    {amount(x.target, series.unit)}
                  </>,
                  (x.numerator ?? "—") + " / " + (x.denominator ?? "—"),
                  <strong className={statusClass(x.status)}>
                    {local(states[x.status])}
                  </strong>,
                ],
              }))}
            />
          )}
        </Modal>
      )}
    </section>
  );
}
