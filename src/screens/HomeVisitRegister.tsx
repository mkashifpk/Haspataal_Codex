import { useState } from "react";
import * as home from "../generated/home_visit_register";
import { LoadState, useLoad } from "../components";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import {
  currentMonth,
  QualityHeading,
  QualityPeriod,
  QualityTable,
  QualityPager,
  type DateRange,
} from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

const outcomes = {
  ManagedAtHome: ["Managed at home", "گھر پر نگہداشت"],
  AskedToAttend: ["Asked to attend", "حاضر ہونے کو کہا"],
  Referred: ["Referred", "ریفر کیا"],
} as const;
export function HomeVisitRegister({
  user,
  connected,
  revision,
  timeZone,
  onOpenHelp,
  view,
}: {
  user: ClinicalUser;
  connected: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  revision: number;
  timeZone?: string;
  onOpenHelp: () => void;
  view?: string;
}) {
  const [range, setRange] = useState<DateRange>();
  const [cursor, setCursor] = useState<number>();
  const [selected, setSelected] = useState<number>();
  const period = range ?? currentMonth(timeZone);
  const viewable = !!view && ["full", "open_work", "records"].includes(view);
  const canOpen = user.permissions.includes("homevisit.view");
  const canRead =
    viewable && (canOpen || user.permissions.includes("msds.view"));
  const rows = useLoad(
    () =>
      canRead && period.date_to
        ? home.registerHomeVisits({ ...period, limit: 100, before_id: cursor })
        : Promise.resolve([]),
    [canRead, period.date_from, period.date_to, cursor, revision],
  );
  const policy = useLoad(
    () => (canRead ? home.policy() : Promise.resolve(undefined)),
    [canRead, revision],
  );
  const detail = useLoad(
    () =>
      canRead && canOpen && selected
        ? home.getHomeVisits(selected)
        : Promise.resolve(undefined),
    [canRead, canOpen, selected, revision],
  );
  if (!canRead) return null;
  const list = !rows.loading && !rows.error ? rows.data : undefined;
  const visit =
    !detail.loading && !detail.error && detail.data?.home_visit_id === selected
      ? detail.data
      : undefined;
  const format = (value: string) => formatHospitalTime(value, timeZone!);
  return (
    <section data-screen="home_visit_register">
      <QualityHeading
        title={t("Home visits: the register", "گھریلو دورے: رجسٹر")}
        text={t(
          "Each row read is logged as access to the patient’s record.",
          "ہر صف کا پڑھنا مریض کے ریکارڈ کی رسائی میں درج ہے۔",
        )}
        onHelp={onOpenHelp}
      />
      {view === "open_work" && (
        <p className="notice">
          {t(
            "No new home visits from now on.",
            "اب کوئی نیا گھریلو دورہ نہیں۔",
          )}
        </p>
      )}
      {policy.data && !policy.loading && !policy.error && (
        <p>
          {policy.data.provided
            ? t("Home visits are provided.", "گھریلو دورے فراہم ہیں۔")
            : t("Home visits are not provided.", "گھریلو دورے فراہم نہیں ہیں۔")}
        </p>
      )}
      <LoadState {...policy} retry={() => void policy.reload()} />
      <QualityPaper
        disabled={!connected}
        documents={[
          {
            label: t("home visit notice", "گھریلو دورہ نوٹس"),
            path: "/home-visits/notice/pdf",
          },
        ]}
      />
      {period.date_to && (
        <QualityPeriod
          range={period}
          apply={(next) => {
            setRange(next);
            setCursor(undefined);
            setSelected(undefined);
          }}
        />
      )}
      <LoadState {...rows} retry={() => void rows.reload()} />
      {list && (
        <>
          <QualityTable
            columns={[
              t("Visit", "دورہ"),
              t("Date", "تاریخ"),
              t("Patient", "مریض"),
              t("Visited by", "جانے والا"),
              t("Outcome", "نتیجہ"),
            ]}
            empty={t(
              "No home visits recorded for this period.",
              "اس مدت میں کوئی گھریلو دورہ درج نہیں۔",
            )}
            rows={list.map((row) => ({
              key: row.home_visit_id,
              cells: [
                canOpen ? (
                  <button
                    data-help="hvr.open"
                    onClick={() => setSelected(row.home_visit_id)}
                  >
                    {row.visit_number}
                  </button>
                ) : (
                  row.visit_number
                ),
                format(row.visited_at),
                `${row.patient_name} · ${row.mrn}`,
                row.author_stamp.name,
                t(outcomes[row.outcome][0], outcomes[row.outcome][1]),
              ],
            }))}
          />
          <QualityPager
            cursor={cursor}
            next={list.length === 100 ? list.at(-1)?.home_visit_id : undefined}
            onPage={(next) => {
              setSelected(undefined);
              setCursor(next);
            }}
          />
        </>
      )}
      {selected && <LoadState {...detail} retry={() => void detail.reload()} />}
      {visit && (
        <article className="card">
          <h2>
            {visit.visit_number} · {visit.patient_name}
          </h2>
          <p>
            {visit.mrn} · {format(visit.visited_at)}
          </p>
          <dl>
            {[
              [t("Requested by", "درخواست گزار"), visit.requested_by],
              [t("Reason", "وجہ"), visit.reason],
              [t("Address", "پتہ"), visit.address],
              [t("History", "تاریخچہ"), visit.history],
              [t("Assessment", "جائزہ"), visit.assessment],
              [t("Care given", "دی گئی نگہداشت"), visit.care_given],
              [
                t("Outcome", "نتیجہ"),
                t(outcomes[visit.outcome][0], outcomes[visit.outcome][1]),
              ],
              [t("Follow-up", "پیروی"), visit.follow_up],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? t("Not recorded", "درج نہیں")}</dd>
              </div>
            ))}
          </dl>
          <p>{visit.author_stamp.text}</p>
        </article>
      )}
    </section>
  );
}
