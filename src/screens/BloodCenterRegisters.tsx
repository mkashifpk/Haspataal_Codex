import { useState } from "react";
import * as center from "../generated/blood_center_registers";
import { LoadState, useLoad } from "../components";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import {
  currentMonth,
  QualityHeading,
  QualityPeriod,
  QualityTable,
  QualityPager,
  type DateRange,
} from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

function lastQuarter(timeZone?: string): DateRange {
  const current = currentMonth(timeZone);
  if (!current.date_to) return current;
  const [year, month] = current.date_to.split("-").map(Number);
  const quarter = Math.floor((month - 1) / 3) * 3;
  const iso = (m: number, d: number) =>
    new Date(Date.UTC(year, m, d)).toISOString().slice(0, 10);
  return { date_from: iso(quarter - 3, 1), date_to: iso(quarter, 0) };
}
export function BloodCenterRegisters({
  user,
  connected,
  revision,
  timeZone,
  view,
  onOpenHelp,
}: {
  user: ClinicalUser;
  connected: boolean;
  revision: number;
  timeZone?: string;
  view?: string;
  readOnly: boolean;
  noNewWork: boolean;
  onOpenHelp: () => void;
}) {
  const [range, setRange] = useState<DateRange>(),
    [cursor, setCursor] = useState<number>(),
    [selected, setSelected] = useState<number>();
  const period = range ?? lastQuarter(timeZone);
  const canRead =
    !!view &&
    ["full", "open_work", "records"].includes(view) &&
    user.permissions.includes("blood_center.view");
  const summary = useLoad(
    () =>
      canRead && period.date_to
        ? center.centerReturn(period)
        : Promise.resolve(undefined),
    [canRead, period.date_from, period.date_to, revision],
  );
  const donations = useLoad(
    () =>
      canRead && period.date_to
        ? center.listDonations({ ...period, limit: 100, before_id: cursor })
        : Promise.resolve([]),
    [
      canRead,
      period.date_from,
      period.date_to,
      cursor,
      revision,
    ],
  );
  const detail = useLoad(
    () =>
      canRead && selected
        ? center.getDonation(selected)
        : Promise.resolve(undefined),
    [canRead, selected, revision],
  );
  if (!canRead) return null;
  const data = !summary.loading && !summary.error ? summary.data : undefined;
  const rows =
    !donations.loading && !donations.error ? donations.data : undefined;
  const donation =
    !detail.loading && !detail.error && detail.data?.donation_id === selected
      ? detail.data
      : undefined;
  const sex = (value: string) =>
    value === "Female" ? t("Female", "خاتون") : t("Male", "مرد");
  return (
    <section data-screen="blood_center_registers">
      <QualityHeading
        title={t(
          "Blood center: return and registers",
          "بلڈ سینٹر: گوشوارہ اور رجسٹر",
        )}
        text={t(
          "Read computed figures for the period. The registers identify donors by number, age and sex.",
          "مدت کے حساب شدہ اعداد پڑھیں۔ رجسٹر عطیہ دہندہ کو نمبر، عمر اور جنس سے دکھاتے ہیں۔",
        )}
        onHelp={onOpenHelp}
      />
      {view === "open_work" && (
        <p className="notice">
          {t(
            "No new blood center work from now on.",
            "اب نیا بلڈ سینٹر کام نہیں۔",
          )}
        </p>
      )}
      {period.date_to && (
        <QualityPeriod
          range={period}
          maxDays={366}
          apply={(p) => {
            setRange(p);
            setCursor(undefined);
            setSelected(undefined);
          }}
        />
      )}
      <LoadState {...summary} retry={() => void summary.reload()} />
      {data && (
        <article className="card">
          <h2>
            {data.date_from} – {data.date_to}
          </h2>
          <div className="metric-grid">
            {[
              [t("Donors attending", "حاضر عطیہ دہندگان"), data.donors],
              [t("Collections", "جمع شدہ"), data.collections],
              [
                t("Whole blood not used", "غیر استعمال مکمل خون"),
                data.whole_blood_not_used,
              ],
            ].map(([label, count]) => (
              <article key={label}>
                <h3>{label}</h3>
                <strong>{count}</strong>
              </article>
            ))}
          </div>
          <div className="metric-grid">
            {[
              {
                title: t("Donation status", "عطیہ حالت"),
                rows: data.donations_by_status.map((r) => [r.status, r.n]),
              },
              {
                title: t("Collection kind", "جمع کی قسم"),
                rows: data.collections_by_kind.map((r) => [
                  r.donation_kind,
                  r.n,
                ]),
              },
              {
                title: t("Deferrals", "التوا"),
                rows: data.deferrals_by_kind.map((r) => [r.kind, r.n]),
              },
              {
                title: t("Components produced", "تیار اجزا"),
                rows: data.components_produced.map((r) => [r.component, r.n]),
              },
              {
                title: t("Components released", "جاری اجزا"),
                rows: data.components_released.map((r) => [r.component, r.n]),
              },
              {
                title: t("Discard reasons", "ضائع وجوہ"),
                rows: data.components_discarded.map((r) => [
                  r.discard_reason,
                  r.n,
                ]),
              },
              {
                title: t("Donor reactions", "عطیہ دہندہ ردعمل"),
                rows: data.donor_reactions.map((r) => [r.reaction, r.n]),
              },
              {
                title: t("Patient reactions", "مریض ردعمل"),
                rows: data.patient_reactions.map((r) => [
                  r.reaction_class,
                  r.n,
                ]),
              },
            ].map((group) => (
              <article key={group.title}>
                <h3>{group.title}</h3>
                {group.rows.length ? (
                  <dl>
                    {group.rows.map(([key, count]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p>{t("No recorded rows", "درج صف نہیں")}</p>
                )}
              </article>
            ))}
          </div>
          <h3>{t("Infection screens", "انفیکشن جانچ")}</h3>
          <QualityTable
            columns={[
              t("Marker", "مارکر"),
              t("Reactive", "ردعمل مثبت"),
              t("Reactive on repeat", "دوبارہ مثبت"),
            ]}
            rows={data.infections.map((x) => ({
              key: x.marker,
              cells: [x.marker, x.reactive, x.repeat_reactive],
            }))}
            empty={t("No infection screen counts.", "انفیکشن جانچ تعداد نہیں۔")}
          />
          <QualityPaper
            disabled={!connected}
            documents={[
              {
                label: t("blood center registers", "بلڈ سینٹر رجسٹر"),
                path: `/blood-center/registers/pdf?${new URLSearchParams(period)}`,
              },
            ]}
          />
        </article>
      )}
      <article className="card">
        <h2>{t("Donation trace", "عطیہ کی پیروی")}</h2>
        <p>
          {t(
            "Opening a donation is logged as a read of the donor’s record and each named patient’s record.",
            "عطیہ کھولنا عطیہ دہندہ اور ہر نام والے مریض کے ریکارڈ پر درج ہے۔",
          )}
        </p>
        <button
          data-help="bcr.open"
          disabled={!connected || donations.loading}
          onClick={() => void donations.reload()}
        >
          {t("Read donations for this period", "مدت کے عطیات پڑھیں")}
        </button>
        {period.date_to && (
          <>
            <LoadState {...donations} retry={() => void donations.reload()} />
            {rows && (
              <>
                <QualityTable
                  columns={[
                    t("Donation", "عطیہ"),
                    t("Donor number", "عطیہ دہندہ نمبر"),
                    t("Age", "عمر"),
                    t("Sex", "جنس"),
                    t("Status", "حالت"),
                  ]}
                  rows={rows.map((r) => ({
                    key: r.donation_id,
                    cells: [
                      <button
                        data-help="bcr.open"
                        onClick={() => setSelected(r.donation_id)}
                      >
                        {r.donation_number}
                      </button>,
                      r.donor_number,
                      r.age_years,
                      sex(r.donor_sex),
                      r.status,
                    ],
                  }))}
                  empty={t(
                    "No donations for this period.",
                    "اس مدت میں عطیات نہیں۔",
                  )}
                />
                <QualityPager
                  cursor={cursor}
                  next={
                    rows.length === 100 ? rows.at(-1)?.donation_id : undefined
                  }
                  onPage={setCursor}
                  moreLabel={t("More", "مزید")}
                />
              </>
            )}
          </>
        )}
        {selected && (
          <LoadState {...detail} retry={() => void detail.reload()} />
        )}
        {donation && (
          <article>
            <h3>{donation.donation_number}</h3>
            <p>
              {donation.donor_number} · {donation.age_years} ·{" "}
              {sex(donation.donor_sex)} · {donation.status}
            </p>
            <p>
              {donation.donation_kind} · {donation.venue} ·{" "}
              {donation.attended_at}
            </p>
            <p>{donation.assessed_stamp.text}</p>
            <h4>{t("Components", "اجزا")}</h4>
            <ul>
              {donation.components.map((c) => (
                <li key={c.component_id}>
                  {c.component} · {c.status}
                </li>
              ))}
            </ul>
            <h4>{t("Transfusions", "منتقلی")}</h4>
            <ul>
              {donation.transfusions.map((r) => (
                <li key={r.transfusion_id}>
                  {r.unit_number} · {r.mrn} · {r.status}
                </li>
              ))}
            </ul>
          </article>
        )}
      </article>
    </section>
  );
}
