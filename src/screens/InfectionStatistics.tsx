import { useState } from "react";
import { LoadState, useLoad } from "../components";
import * as ipc from "../generated/infection_statistics";
import { bilingual as t } from "../i18n";
import { AuditBreakdown } from "./IpcAudits";
import {
  monthBefore,
  percent,
  permission,
  ReportTable,
  type P9cProps,
} from "./P9cShared";
import { QualityHeading, QualityPeriod } from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

type Id =
  | "infection_statistics_ipc"
  | "infection_statistics"
  | "infection_statistics_owner";
export function InfectionStatistics({
  screenId,
  user,
  connected,
  timeZone,
  revision,
  onOpenHelp,
  onFollowup,
  onActions,
}: P9cProps & {
  screenId: Id;
  onFollowup?: () => void;
  onActions?: () => void;
}) {
  const access = !!permission(
    user,
    "infection.control.manage",
    "infection.statistics.view",
  );
  const [range, setRange] = useState(() => monthBefore(timeZone));
  const read = access && !!range.date_from;
  const rates = useLoad(
    () => (read ? ipc.ssiRates(range) : Promise.resolve(undefined)),
    [read, range, revision],
  );
  const audits = useLoad(
    () =>
      read
        ? ipc.listAudits({ ...range, limit: 100 })
        : Promise.resolve(undefined),
    [read, range, revision],
  );
  const waste = useLoad(
    () =>
      read
        ? ipc.listWaste({ ...range, limit: 100 })
        : Promise.resolve(undefined),
    [read, range, revision],
  );
  const cases = useLoad(
    () =>
      read
        ? ipc.listCasesInfection({ ...range, limit: 100 })
        : Promise.resolve([]),
    [read, range, revision],
  );
  const surveillance = useLoad(
    () => (access ? ipc.ssiSurveillance({ limit: 500 }) : Promise.resolve([])),
    [access, revision],
  );
  const data = !rates.loading && !rates.error ? rates.data : undefined;
  const groups = data
    ? ([
        [t("By surgeon", "سرجن کے لحاظ سے"), data.by_surgeon],
        [t("By procedure", "عمل کے لحاظ سے"), data.by_procedure],
        [t("By theatre", "تھیٹر کے لحاظ سے"), data.by_theatre],
        [t("By wound class", "زخم قسم کے لحاظ سے"), data.by_wound_class],
        [t("By month", "ماہ کے لحاظ سے"), data.by_month],
      ] as const)
    : [];
  return (
    <section data-screen={screenId}>
      <QualityHeading
        title={t("Infection control statistics", "انفیکشن کنٹرول اعداد")}
        text={t(
          "Review the monthly infection rates, surveillance coverage, audits and waste evidence.",
          "ماہانہ انفیکشن شرح، نگرانی کوریج، آڈٹ اور فضلہ شواہد دیکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      <QualityPeriod range={range} apply={setRange} />
      <LoadState {...rates} retry={rates.reload} />
      {data && (
        <>
          <div className="workspace-grid">
            <article className="card">
              <h2>
                {t("Surgical site infection rate", "جراحی مقام انفیکشن شرح")}
              </h2>
              <strong>
                {data.infections}/{data.operations} · {percent(data.rate_pct)}
              </strong>
            </article>
            <article className="card">
              <h2>{t("Surveillance complete", "نگرانی مکمل")}</h2>
              <strong>
                {data.surveillance_complete}/{data.operations} ·{" "}
                {percent(data.surveillance_complete_pct)}
              </strong>
            </article>
            <article className="card">
              <h2>{t("Suspected now", "اب مشتبہ")}</h2>
              <strong>{data.suspected_now}</strong>
            </article>
          </div>
          {data.surveillance_complete_pct !== null &&
            data.surveillance_complete_pct < 100 && (
              <p className="notice">
                {t(
                  "Incomplete surveillance can miss infections. Follow up due and overdue patients.",
                  "نامکمل نگرانی میں انفیکشن رہ سکتے ہیں۔ مقررہ اور تاخیر مریضوں کی پیروی کریں۔",
                )}
              </p>
            )}
          {groups.map(([title, rows]) => (
            <ReportTable
              key={title}
              title={title}
              columns={[
                t("Group", "گروہ"),
                t("Operations", "آپریشن"),
                t("Confirmed infections", "تصدیق شدہ انفیکشن"),
                t("Follow-up complete", "پیروی مکمل"),
                t("Rate", "شرح"),
              ]}
              rows={rows.map((x) => ({
                key: x.key,
                cells: [
                  x.label ?? x.key,
                  x.operations,
                  x.infections,
                  x.surveillance_complete,
                  percent(x.rate_pct),
                ],
              }))}
            />
          ))}
          <ReportTable
            title={t(
              "Confirmed healthcare infections",
              "تصدیق شدہ ہسپتال انفیکشن",
            )}
            columns={[t("Kind", "قسم"), t("Count", "تعداد")]}
            rows={data.healthcare_infections.map((x) => ({
              key: x.key,
              cells: [x.key, x.count],
            }))}
          />
        </>
      )}
      {read && (
        <QualityPaper
          disabled={!connected}
          documents={[
            {
              path: "/infection/report/pdf?" + new URLSearchParams(range),
              label: t("infection control report", "انفیکشن کنٹرول رپورٹ"),
            },
          ]}
        />
      )}
      {onActions && (
        <button type="button" data-help="ipc.stats" onClick={onActions}>
          {t("Open action register", "کارروائی رجسٹر کھولیں")}
        </button>
      )}
      <LoadState {...surveillance} retry={surveillance.reload} />
      {!surveillance.loading && !surveillance.error && (
        <ReportTable
          title={t("Due and overdue surveillance", "مقررہ اور تاخیر نگرانی")}
          columns={[
            t("Operation", "آپریشن"),
            t("Patient", "مریض"),
            t("State", "حالت"),
            t("Day / window", "دن / مدت"),
          ]}
          rows={(surveillance.data ?? [])
            .filter((x) => x.state === "Overdue" || x.state === "Due")
            .sort(
              (a, b) =>
                Number(b.state === "Overdue") - Number(a.state === "Overdue"),
            )
            .map((x) => ({
              key: x.booking_id,
              cells: [
                x.booking_number + " · " + x.procedure_name,
                <>
                  {x.patient_name} · <bdi>{x.mrn}</bdi>
                </>,
                x.state,
                x.day + "/" + x.window_days,
              ],
            }))}
        />
      )}
      {onFollowup && (
        <button type="button" data-help="ipc.stats" onClick={onFollowup}>
          {t("Open wound surveillance", "زخم نگرانی کھولیں")}
        </button>
      )}
      <LoadState {...cases} retry={cases.reload} />
      {!cases.loading && !cases.error && (
        <ReportTable
          title={t("Infection cases in the period", "مدت کے انفیکشن کیس")}
          columns={[
            t("Case and patient", "کیس اور مریض"),
            t("Kind and onset", "قسم اور آغاز"),
            t("Status", "حالت"),
          ]}
          rows={(cases.data ?? []).map((x) => ({
            key: x.case_id,
            cells: [
              <>
                {x.case_number} · {x.patient_name} · <bdi>{x.mrn}</bdi>
              </>,
              x.kind + " · " + x.onset_date,
              x.status,
            ],
          }))}
        />
      )}
      <LoadState {...audits} retry={audits.reload} />
      {!audits.loading && !audits.error && audits.data && (
        <AuditBreakdown audit={audits.data} />
      )}
      <LoadState {...waste} retry={waste.reload} />
      {!waste.loading && !waste.error && waste.data && (
        <ReportTable
          title={t("Waste by category", "قسم کے مطابق فضلہ")}
          columns={[
            t("Category", "قسم"),
            t("Collected kg", "جمع کلو"),
            t("Handed over kg", "حوالہ کلو"),
          ]}
          rows={waste.data.by_category.map((x) => ({
            key: x.category,
            cells: [
              x.category,
              x.weight_kg,
              <strong
                className={
                  x.category !== "NonRisk" && x.handed_over_kg < x.weight_kg
                    ? "error"
                    : undefined
                }
              >
                {x.handed_over_kg}
              </strong>,
            ],
          }))}
        />
      )}
    </section>
  );
}
