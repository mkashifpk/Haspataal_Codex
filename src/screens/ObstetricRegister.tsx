import { useState } from "react";
import * as maternity from "../generated/obstetric_register";
import { useLoad, LoadState } from "../components";
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

type Tab = "risk" | "newborn" | "labour";
export function ObstetricRegister({
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
  readOnly: boolean;
  noNewWork: boolean;
  timeZone?: string;
  view?: string;
  onOpenHelp: () => void;
}) {
  const [range, setRange] = useState<DateRange>(),
    [cursor, setCursor] = useState<number>(),
    [tab, setTab] = useState<Tab>("risk"),
    [drafts, setDrafts] = useState(true);
  const period = range ?? currentMonth(timeZone);
  const viewable = !!view && ["full", "open_work", "records"].includes(view);
  const canRead = viewable && user.permissions.includes("maternity.view"),
    canPdf = viewable && (canRead || user.permissions.includes("msds.view"));
  const risk = useLoad(
    () =>
      canRead && tab === "risk" && period.date_to
        ? maternity.assessments({
            ...period,
            high_risk_only: true,
            before_id: cursor,
            limit: 100,
          })
        : Promise.resolve([]),
    [canRead, tab, period.date_from, period.date_to, cursor, revision],
  );
  const newborns = useLoad(
    () =>
      canRead && tab === "newborn" && period.date_to
        ? maternity.newborns({ ...period, before_id: cursor, limit: 100 })
        : Promise.resolve([]),
    [canRead, tab, period.date_from, period.date_to, cursor, revision],
  );
  const labour = useLoad(
    () =>
      canRead && tab === "labour" && period.date_to
        ? maternity.listEntriesMaternityLabourRegister({
            ...period,
            status: drafts ? "Draft" : undefined,
            limit: 500,
          })
        : Promise.resolve([]),
    [canRead, tab, period.date_from, period.date_to, drafts, revision],
  );
  if (!canPdf) return null;
  const format = (value: string) => formatHospitalTime(value, timeZone!);
  const active = tab === "risk" ? risk : tab === "newborn" ? newborns : labour;
  const documentQuery = new URLSearchParams(period);
  const headings: Record<Tab, string> = {
    risk: t("High-risk assessments", "زیادہ خطرہ جائزے"),
    newborn: t("Newborns", "نومولود"),
    labour: t("Labour register", "زچگی رجسٹر"),
  };
  return (
    <section data-screen="obstetric_register">
      <QualityHeading
        title={t(
          "High-risk obstetric patients and newborns",
          "زیادہ خطرے کے زچگی مریض اور نومولود",
        )}
        text={t(
          "Each patient read is logged as access to their record. Follow up missing nutrition entries and unsigned deliveries.",
          "ہر مریض کی پڑھائی ریکارڈ رسائی میں درج۔ غائب غذائی اور غیر دستخط ولادت کی پیروی کریں۔",
        )}
        onHelp={onOpenHelp}
      />
      {view === "open_work" && (
        <p className="notice">
          {t("No new maternity work from now on.", "اب نیا زچگی کام نہیں۔")}
        </p>
      )}
      {period.date_to && (
        <QualityPeriod
          range={period}
          maxDays={366}
          apply={(r) => {
            setRange(r);
            setCursor(undefined);
          }}
        />
      )}
      {canRead && period.date_to && (
        <article className="card">
          <div className="toolbar">
            {(Object.keys(headings) as Tab[]).map((key) => (
              <button
                key={key}
                data-help="obr.tab"
                aria-pressed={key === tab}
                onClick={() => {
                  setTab(key);
                  setCursor(undefined);
                }}
              >
                {headings[key]}
              </button>
            ))}
          </div>
          {tab === "labour" && (
            <label className="check">
              <input
                data-help="obr.draft"
                type="checkbox"
                checked={drafts}
                onChange={(e) => setDrafts(e.target.checked)}
              />
              {t("Draft entries still to sign", "مسودے جن پر دستخط باقی")}
            </label>
          )}
          <LoadState {...active} retry={() => void active.reload()} />
          {!active.loading && !active.error && (
            <>
              {tab === "risk" && (
                <>
                  <QualityTable
                    columns={[
                      t("Date", "تاریخ"),
                      t("Patient", "مریض"),
                      t("Conditions", "حالات"),
                      t("Counselling and plan", "مشورہ و منصوبہ"),
                      t("Nutrition", "غذا"),
                      t("Assessed by", "جائزہ لینے والا"),
                    ]}
                    empty={t(
                      "No high-risk assessments for this period.",
                      "اس مدت میں زیادہ خطرہ جائزے نہیں۔",
                    )}
                    rows={(risk.data ?? []).map((r) => ({
                      key: r.assessment_id,
                      cells: [
                        format(r.assessed_at),
                        `${r.patient_name} · ${r.mrn}`,
                        <>
                          {r.conditions.join(" · ")}
                          {r.condition_note && <p>{r.condition_note}</p>}
                        </>,
                        <>
                          {r.counselled
                            ? t("Counselled", "مشورہ دیا")
                            : t(
                                "Counselling not recorded",
                                "مشورہ درج نہیں",
                              )}{" "}
                          ·{" "}
                          {r.plan === "Refer"
                            ? t("Refer", "ریفر")
                            : t("Care here", "یہاں نگہداشت")}
                          {r.counselling_note && <p>{r.counselling_note}</p>}
                        </>,
                        <>
                          {r.nutrition_assessment && (
                            <p>{r.nutrition_assessment}</p>
                          )}
                          {r.nutrition_advice && <p>{r.nutrition_advice}</p>}
                          {(!r.nutrition_assessment || !r.nutrition_advice) && (
                            <strong className="notice">
                              {t("NOT RECORDED", "درج نہیں")}
                            </strong>
                          )}
                        </>,
                        r.author_stamp.text,
                      ],
                    }))}
                  />
                  <QualityPager
                    cursor={cursor}
                    next={
                      risk.data?.length === 100
                        ? risk.data.at(-1)?.assessment_id
                        : undefined
                    }
                    onPage={setCursor}
                  />
                </>
              )}
              {tab === "newborn" && (
                <>
                  <QualityTable
                    columns={[
                      t("Baby", "بچہ"),
                      t("Mother", "ماں"),
                      t("Born at", "پیدائش"),
                      t("Admission", "داخلہ"),
                    ]}
                    empty={t(
                      "No newborns for this period.",
                      "اس مدت میں نومولود نہیں۔",
                    )}
                    rows={(newborns.data ?? []).map((r) => ({
                      key: r.patient_id,
                      cells: [
                        `${r.full_name} · ${r.mrn}`,
                        `${r.mother_name} · ${r.mother_mrn}`,
                        format(r.born_at),
                        r.admission_number,
                      ],
                    }))}
                  />
                  <QualityPager
                    cursor={cursor}
                    next={
                      newborns.data?.length === 100
                        ? newborns.data.at(-1)?.patient_id
                        : undefined
                    }
                    onPage={setCursor}
                  />
                </>
              )}
              {tab === "labour" && (
                <>
                  <QualityTable
                    columns={[
                      t("Entry", "اندراج"),
                      t("Mother", "ماں"),
                      t("Delivery", "ولادت"),
                      t("Babies", "بچے"),
                      t("Status", "حالت"),
                      t("Attended by", "ذمہ دار"),
                    ]}
                    empty={
                      drafts
                        ? t(
                            "No draft entries for this period.",
                            "اس مدت میں مسودے نہیں۔",
                          )
                        : t(
                            "No delivery entries for this period.",
                            "اس مدت میں ولادت اندراج نہیں۔",
                          )
                    }
                    rows={(labour.data ?? []).map((r) => ({
                      key: r.entry_id,
                      cells: [
                        r.entry_number,
                        `${r.mother_name} · ${r.mrn}`,
                        format(r.delivered_at),
                        r.babies.length,
                        r.status === "Draft"
                          ? t("Draft · still to sign", "مسودہ · دستخط باقی")
                          : t("Signed", "دستخط شدہ"),
                        r.author_stamp?.text ?? r.attended_by_name,
                      ],
                    }))}
                  />
                  {labour.data?.length === 500 && (
                    <p role="status">
                      {t(
                        "The period reached the 500-row display limit. Narrow the dates for more precise review.",
                        "مدت پانچ سو صف کی حد تک۔ مزید واضح جائزہ کے لیے تاریخ محدود کریں۔",
                      )}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </article>
      )}
      {period.date_to && (
        <QualityPaper
          disabled={!connected}
          documents={[
            {
              label: t("high-risk register", "زیادہ خطرہ رجسٹر"),
              path: `/maternity/assessments/register/pdf?${documentQuery}`,
            },
            ...(canRead
              ? [
                  {
                    label: t("labour register", "زچگی رجسٹر"),
                    path: `/maternity/labour-register/pdf?${documentQuery}`,
                  },
                ]
              : []),
          ]}
        />
      )}
    </section>
  );
}
