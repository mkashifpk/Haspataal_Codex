import { useState, type FormEvent, type ReactNode } from "react";
import { call } from "../bridge";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import * as corr from "../generated/diagnostic_correlation";
import * as med from "../generated/medication_statistics";
import * as estimates from "../generated/estimate_statistics";
import * as surgery from "../generated/surgical_statistics";
import { formatHospitalTime } from "../hospital-time";
import { bilingual as t } from "../i18n";
import {
  currentMonth,
  QualityHeading,
  QualityPeriod,
  QualityTable,
} from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

type View = "full" | "open_work" | "records" | "setup" | "hidden";
type Base = {
  user: ClinicalUser;
  connected: boolean;
  timeZone?: string;
  revision: number;
  onOpenHelp: () => void;
};
const serviceVisible = (view?: View) =>
  view === "full" || view === "open_work" || view === "records";
const percent = (n: number | null) => (n === null ? "—" : `${n}%`);
const when = (x: string | null, timeZone?: string) =>
  x ? (timeZone ? formatHospitalTime(x, timeZone) : x) : "—";
function panel(title: string, columns: string[], rows: ReactNode[][]) {
  return (
    <article className="card">
      <h2>{title}</h2>
      <QualityTable
        columns={columns}
        rows={rows.map((cells, key) => ({ key, cells }))}
        empty={t(
          "No entries for this selection.",
          "اس انتخاب میں کوئی اندراج نہیں۔",
        )}
      />
    </article>
  );
}
function totals(values: [string, ReactNode][]) {
  return (
    <div className="workspace-grid">
      {values.map(([label, result]) => (
        <article className="card" key={label}>
          <strong>{result}</strong>
          <p>{label}</p>
        </article>
      ))}
    </div>
  );
}
function counts(title: string, rows: [string, number][]) {
  return panel(title, [t("Group", "گروہ"), t("Count", "تعداد")], rows);
}
function measures(rows: [string, string, number, number, number | null][]) {
  return panel(
    t("MSDS measures", "ایم ایس ڈی ایس پیمائش"),
    [
      t("Measure", "پیمائش"),
      "MSDS",
      t("Met / applicable", "پورا / قابل اطلاق"),
      t("Percent", "فیصد"),
    ],
    rows.map(([label, reference, n, d, pct]) => [
      label,
      reference,
      `${n} / ${d}`,
      <strong className={pct !== null && pct < 100 ? "error" : undefined}>
        {percent(pct)}
      </strong>,
    ]),
  );
}
function retirement(view?: View) {
  return view === "open_work" ? (
    <p className="notice" role="status">
      {t(
        "No new work for the retiring service. Existing work remains available.",
        "بند ہوتی سروس کے لیے نیا کام نہیں۔ موجودہ کام دستیاب ہے۔",
      )}
    </p>
  ) : view === "records" ? (
    <p className="notice" role="status">
      {t("Records and history only.", "صرف ریکارڈ اور تاریخ۔")}
    </p>
  ) : null;
}

const correlationPath = "/diagnostics/correlations";
const outcomes = {
  Correlates: "مطابقت",
  PartlyCorrelates: "جزوی مطابقت",
  DoesNotCorrelate: "مطابقت نہیں",
  NotAssessable: "جائزہ ممکن نہیں",
} as const;
type Candidate = Pick<
  corr.CorrelationWorkItemOut,
  | "source"
  | "lab_result_id"
  | "imaging_order_id"
  | "patient_name"
  | "mrn"
  | "examination"
>;
export function DiagnosticCorrelation({
  user,
  connected,
  view,
  timeZone,
  revision,
  onOpenHelp,
}: Base & { view?: View }) {
  const visible = serviceVisible(view);
  const mayReview =
    visible &&
    user.permissions.includes("diagnostics.correlation.review") &&
    view !== "records";
  const readable =
    visible &&
    user.permissions.some((p) =>
      ["diagnostics.quality.view", "diagnostics.correlation.review"].includes(
        p,
      ),
    );
  const [range, setRange] = useState(() => currentMonth(timeZone));
  const [source, setSource] = useState<"Lab" | "Imaging" | "">("");
  const [filter, setFilter] = useState<keyof typeof outcomes | "">("");
  const [outcome, setOutcome] = useState<keyof typeof outcomes>("Correlates");
  const [draft, setDraft] = useState<Candidate>();
  const [dirty, setDirty] = useState(false);
  const q = { ...range, source: source || undefined, limit: 500 };
  const pending = useLoad(
    () =>
      mayReview && range.date_from
        ? corr.correlationWorklist(q)
        : Promise.resolve([]),
    [mayReview, range, source, revision],
  );
  const history = useLoad(
    () =>
      readable && range.date_from
        ? corr.correlationRegister({ ...q, outcome: filter || undefined })
        : Promise.resolve([]),
    [readable, range, source, filter, revision],
  );
  const refresh = () => Promise.all([pending.reload(), history.reload()]);
  const write = useClinicalWrite(user, "diagnostic_correlation", async () => {
    setDraft(undefined);
    await refresh();
  });
  const begin = (x: Candidate) => {
    setDraft(x);
    setDirty(false);
    setOutcome("Correlates");
    write.clearError();
  };
  const editable = mayReview && connected && !write.blocked;
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft || !editable) return;
    const form = new FormData(e.currentTarget);
    const clinical_diagnosis = String(form.get("diagnosis") ?? "").trim(),
      note = String(form.get("note") ?? "").trim();
    if (
      !clinical_diagnosis ||
      (outcome !== "Correlates" && !note) ||
      (draft.source === "Lab" ? !draft.lab_result_id : !draft.imaging_order_id)
    )
      return;
    const body: corr.CorrelationIn = {
      source: draft.source,
      lab_result_id: draft.source === "Lab" ? draft.lab_result_id : null,
      imaging_order_id:
        draft.source === "Imaging" ? draft.imaging_order_id : null,
      clinical_diagnosis,
      outcome,
      note: note || null,
    };
    write.start({
      method: "POST",
      path: correlationPath,
      body,
      permission: "diagnostics.correlation.review",
      protection: "idempotent",
      label: t("Save correlation review", "مطابقت جائزہ محفوظ کریں"),
    });
  }
  return (
    <section
      data-screen="diagnostic_correlation"
      data-unsaved={!!draft}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t("Diagnostic correlation review", "تشخیصی مطابقت کا جائزہ")}
        text={t(
          "Read unreviewed reports and append a correlation with the clinical diagnosis.",
          "غیر جائزہ شدہ رپورٹس پڑھیں اور طبی تشخیص سے مطابقت کا جائزہ شامل کریں۔",
        )}
        onHelp={onOpenHelp}
      />
      {retirement(view)}
      {readable ? (
        <>
          <QualityPeriod range={range} disabled={!!draft} apply={setRange}>
            <Field label={t("Report source", "رپورٹ ماخذ")}>
              <select
                data-help="dc.filter"
                value={source}
                onChange={(e) => setSource(e.target.value as typeof source)}
              >
                <option value="">{t("Both services", "دونوں خدمات")}</option>
                <option value="Lab">{t("Laboratory", "لیبارٹری")}</option>
                <option value="Imaging">{t("Imaging", "امیجنگ")}</option>
              </select>
            </Field>
            <button
              data-help="dc.filter"
              type="button"
              onClick={() => void refresh()}
            >
              {t("Refresh reviews", "جائزے تازہ کریں")}
            </button>
          </QualityPeriod>
          {mayReview && (
            <>
              <LoadState {...pending} retry={pending.reload} />
              {!pending.loading &&
                !pending.error &&
                panel(
                  t("Unreviewed reports", "غیر جائزہ شدہ رپورٹس"),
                  [
                    t("Report and patient", "رپورٹ اور مریض"),
                    t("Reported", "رپورٹ شدہ"),
                    t("Clinical context", "طبی پس منظر"),
                    t("Review", "جائزہ"),
                  ],
                  (pending.data ?? []).map((x) => [
                    <>
                      {x.examination} · {x.source} · {x.patient_name} ·{" "}
                      <bdi>{x.mrn}</bdi>
                    </>,
                    when(x.reported_at, timeZone),
                    x.clinical_context ?? "—",
                    <button
                      data-help="dc.review"
                      disabled={
                        !editable ||
                        !!draft ||
                        (x.source === "Lab"
                          ? !x.lab_result_id
                          : !x.imaging_order_id)
                      }
                      onClick={() => begin(x)}
                    >
                      {t("Review report", "رپورٹ کا جائزہ")}
                    </button>,
                  ]),
                )}
            </>
          )}
          <Field label={t("Review outcome", "جائزہ نتیجہ")}>
            <select
              data-help="dc.filter"
              disabled={!!draft}
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="">{t("All outcomes", "تمام نتائج")}</option>
              {Object.entries(outcomes).map(([en, ur]) => (
                <option key={en} value={en}>
                  {t(en, ur)}
                </option>
              ))}
            </select>
          </Field>
          <LoadState {...history} retry={history.reload} />
          <p>
            {t(
              "Not assessable reviews are excluded from the diagnostic correlation indicator.",
              "ناقابل جائزہ اندراج تشخیصی مطابقت اشاریے سے خارج ہیں۔",
            )}
          </p>
          {!history.loading &&
            !history.error &&
            panel(
              t("Correlation history", "مطابقت کی تاریخ"),
              [
                t("Report and patient", "رپورٹ اور مریض"),
                t("Diagnosis / outcome", "تشخیص / نتیجہ"),
                t("Reviewed by", "جائزہ لینے والا"),
                t("Review", "جائزہ"),
              ],
              (history.data ?? []).map((x) => [
                <>
                  {x.examination} · {x.source} · {x.patient_name} ·{" "}
                  <bdi>{x.mrn}</bdi>
                </>,
                <>
                  {x.clinical_diagnosis} · {t(x.outcome, outcomes[x.outcome])} ·{" "}
                  {x.note}
                </>,
                `${x.reviewed_by_name} · ${when(x.reviewed_at, timeZone)}`,
                mayReview && (
                  <button
                    data-help="dc.review"
                    disabled={
                      !editable ||
                      !!draft ||
                      (x.source === "Lab"
                        ? !x.lab_result_id
                        : !x.imaging_order_id)
                    }
                    onClick={() => begin(x)}
                  >
                    {t("Review again", "دوبارہ جائزہ")}
                  </button>
                ),
              ]),
            )}
        </>
      ) : (
        <Empty>
          {t(
            "Diagnostic correlation access is required.",
            "تشخیصی مطابقت تک رسائی درکار ہے۔",
          )}
        </Empty>
      )}
      {!draft && <ClinicalWriteFeedback write={write} />}
      {draft && (
        <Modal
          title={t("Append correlation review", "مطابقت جائزہ شامل کریں")}
          closable={!write.blocked}
          onClose={() => {
            if (
              !write.blocked &&
              (!dirty ||
                window.confirm(
                  t(
                    "Discard the unsent review?",
                    "غیر ارسال شدہ جائزہ چھوڑیں؟",
                  ),
                ))
            )
              setDraft(undefined);
          }}
        >
          <form
            className="form"
            onSubmit={save}
            onChange={() => setDirty(true)}
          >
            <fieldset disabled={write.blocked}>
              <p>
                {draft.examination} · {draft.patient_name} ·{" "}
                <bdi>{draft.mrn}</bdi>
              </p>
              <Field label={t("Clinical diagnosis", "طبی تشخیص")}>
                <textarea
                  data-help="dc.review"
                  name="diagnosis"
                  maxLength={500}
                  required
                />
              </Field>
              <Field label={t("Outcome", "نتیجہ")}>
                <select
                  data-help="dc.review"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                >
                  {Object.entries(outcomes).map(([en, ur]) => (
                    <option key={en} value={en}>
                      {t(en, ur)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Review note", "جائزہ نوٹ")}>
                <textarea
                  data-help="dc.review"
                  name="note"
                  maxLength={1000}
                  required={outcome !== "Correlates"}
                />
              </Field>
              <label>
                <input data-help="dc.review" type="checkbox" required />{" "}
                {t(
                  "I checked the report, patient and outcome.",
                  "میں نے رپورٹ، مریض اور نتیجہ چیک کیا ہے۔",
                )}
              </label>
            </fieldset>
            <ClinicalWriteFeedback write={write} />
            <button
              type="submit"
              data-help="dc.review"
              className="primary"
              disabled={!editable}
            >
              {t("Confirm review", "جائزے کی تصدیق کریں")}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

export function MedicationStatistics({
  user,
  connected,
  timeZone,
  revision,
  onOpenHelp,
}: Base) {
  const [range, setRange] = useState(() => currentMonth(timeZone));
  const [selected, setSelected] = useState<number>();
  const read = user.permissions.includes("medication.statistics.view");
  const recall = user.permissions.includes("pharmacy.recall.view");
  const policy = user.permissions.some((x) =>
    ["medication.safety.view", "medication.safety.configure"].includes(x),
  );
  const statistics = useLoad(
    () =>
      read && range.date_from
        ? med.safetyStatistics(range)
        : Promise.resolve(undefined),
    [read, range, revision],
  );
  const rows = useLoad(
    () => (recall ? med.listRecalls() : Promise.resolve([])),
    [recall, revision],
  );
  const detail = useLoad(
    () =>
      recall && selected ? med.getRecall(selected) : Promise.resolve(undefined),
    [recall, selected, revision],
  );
  const alerts = useLoad(
    () => (policy ? med.highAlertList() : Promise.resolve(undefined)),
    [policy, revision],
  );
  const data =
    !statistics.loading && !statistics.error ? statistics.data : undefined;
  const item =
    !detail.loading && !detail.error && detail.data?.recall_id === selected
      ? detail.data
      : undefined;
  const a = !alerts.loading && !alerts.error ? alerts.data : undefined;
  return (
    <section data-screen="medication_statistics">
      <QualityHeading
        title={t("Medication safety statistics", "ادویات حفاظت کے اعداد")}
        text={t(
          "Review MSDS measures, dose checks, queries and recalls.",
          "ایم ایس ڈی ایس پیمائش، خوراک جانچ، سوالات اور واپسی دیکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      {read && (
        <>
          <QualityPeriod range={range} apply={setRange} />
          <LoadState {...statistics} retry={statistics.reload} />
          {data && (
            <>
              {totals([
                [t("Doses given", "دی گئی خوراکیں"), data.doses_given],
                [
                  t("High-alert doses", "ہائی الرٹ خوراکیں"),
                  data.high_alert_doses,
                ],
                [t("Variances", "انحراف"), data.variances],
                [t("Verbal orders", "زبانی احکام"), data.verbal_orders],
              ])}
              {measures(
                data.measures.map((x) => [
                  x.title,
                  x.msds,
                  x.numerator,
                  x.denominator,
                  x.pct,
                ]),
              )}
              {counts(
                t("Dose identity checks", "خوراک شناخت جانچ"),
                data.doses_by_identity.map((x) => [x.value, x.count]),
              )}
              {counts(
                t("Medicine checks", "دوا جانچ"),
                data.doses_by_drug_check.map((x) => [x.value, x.count]),
              )}
              {counts(
                t("Queries by reason", "وجہ کے لحاظ سے سوالات"),
                data.queries_by_reason.map((x) => [x.value, x.count]),
              )}
              {counts(
                t("Queries by outcome", "نتیجے کے لحاظ سے سوالات"),
                data.queries_by_outcome.map((x) => [x.value, x.count]),
              )}
              {panel(
                t("Recall durations", "واپسی کی مدت"),
                [
                  t("Recall and drug", "واپسی اور دوا"),
                  t("Class / status", "درجہ / حالت"),
                  t("Opened / closed", "کھلا / بند"),
                  t("Days open", "کھلے دن"),
                ],
                data.recalls.map((x) => [
                  `${x.recall_number} · ${x.drug_name}`,
                  `${x.recall_class} · ${x.status}`,
                  `${when(x.opened_at, timeZone)} / ${when(x.closed_at, timeZone)}`,
                  x.days_open,
                ]),
              )}
            </>
          )}
        </>
      )}
      {recall && (
        <>
          <LoadState {...rows} retry={rows.reload} />
          {!rows.loading &&
            !rows.error &&
            panel(
              t("Recall register", "واپسی رجسٹر"),
              [
                t("Recall", "واپسی"),
                t("Drug and reason", "دوا اور وجہ"),
                t("Class and status", "درجہ اور حالت"),
                t("Stock / patients", "اسٹاک / مریض"),
              ],
              (rows.data ?? []).map((x) => [
                <button
                  data-help="ms.recall"
                  onClick={() => setSelected(x.recall_id)}
                >
                  {x.recall_number}
                </button>,
                <>
                  {x.drug_name} · {x.source} · {x.reason}
                </>,
                `${x.recall_class} · ${x.status}`,
                `${x.stock_left} / ${x.patients_to_contact}`,
              ]),
            )}
          {selected && <LoadState {...detail} retry={detail.reload} />}
          {item && (
            <>
              <article className="card">
                <h2>
                  {item.recall_number} · {item.drug_name}
                </h2>
                <p>
                  {item.reason} · {item.status} ·{" "}
                  {item.closing_note ?? item.cancel_reason}
                </p>
              </article>
              {panel(
                t("Recall batches", "واپسی بیچ"),
                [
                  t("Batch / expiry", "بیچ / میعاد"),
                  t("Received / pharmacy / ward", "موصول / فارمیسی / وارڈ"),
                  t(
                    "Dispensed / administered / theatre",
                    "فراہم / دی گئی / تھیٹر",
                  ),
                ],
                item.batches.map((x) => [
                  `${x.batch_no} · ${x.expiry_date}`,
                  `${x.qty_received} / ${x.pharmacy_qty} / ${x.ward_qty}`,
                  `${x.dispensed_qty} / ${x.administered_qty} / ${x.theatre_qty}`,
                ]),
              )}
              {panel(
                t("Ward stock", "وارڈ اسٹاک"),
                [t("Ward", "وارڈ"), t("Batch", "بیچ"), t("Quantity", "مقدار")],
                item.ward_stock.map((x) => [x.ward_name, x.batch_no, x.qty]),
              )}
              {panel(
                t("Patient follow-up", "مریض پیروی"),
                [
                  t("Patient", "مریض"),
                  t("Quantity", "مقدار"),
                  t("Outcome", "نتیجہ"),
                ],
                item.patients.map((x) => [
                  <>
                    {x.patient_name ?? x.walkin_name ?? "—"} ·{" "}
                    <bdi>{x.mrn}</bdi>
                  </>,
                  x.quantity,
                  `${x.outcome} · ${x.note ?? "—"}`,
                ]),
              )}
            </>
          )}
        </>
      )}
      {policy && (
        <>
          <LoadState {...alerts} retry={alerts.reload} />
          {a && (
            <>
              {panel(
                t("High-alert medicines", "ہائی الرٹ ادویات"),
                [
                  t("Category", "زمرہ"),
                  t("Drug", "دوا"),
                  t("Strength and form", "طاقت اور شکل"),
                ],
                a.categories.flatMap((x) =>
                  x.drugs.map((d) => [
                    x.label,
                    `${d.code} · ${d.name}`,
                    `${d.strength ?? "—"} · ${d.form}`,
                  ]),
                ),
              )}
              {panel(
                t("Restricted medicines", "محدود ادویات"),
                [t("Drug", "دوا"), t("Schedule", "شیڈول")],
                a.restricted.map((x) => [`${x.code} · ${x.name}`, x.schedule]),
              )}
              {panel(
                t("Look-alike and sound-alike pairs", "ملتے جلتے نام اور شکل"),
                [
                  t("First drug", "پہلی دوا"),
                  t("Second drug", "دوسری دوا"),
                  t("Note", "نوٹ"),
                ],
                a.lasa_pairs.map((x) => [
                  `${x.drug_name} · ${x.drug_strength ?? "—"}`,
                  `${x.other_drug_name} · ${x.other_drug_strength ?? "—"}`,
                  x.note,
                ]),
              )}
            </>
          )}
          <QualityPaper
            disabled={!connected}
            documents={[
              {
                path: "/medication-safety/policy/pdf",
                label: t("medication safety policy", "ادویات حفاظت پالیسی"),
              },
            ]}
          />
        </>
      )}
    </section>
  );
}

export function EstimateStatistics({
  user,
  connected,
  combined,
  timeZone,
  revision,
  onOpenHelp,
}: Base & { combined: boolean }) {
  const [range, setRange] = useState(() => currentMonth(timeZone));
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<unknown>();
  const read = user.permissions.includes("estimate.view");
  const mayList = user.permissions.some((x) =>
    ["estimate.view", "estimate.prepare", "estimate.explain"].includes(x),
  );
  const mayPolicy = user.permissions.some((x) =>
    ["estimate.view", "estimate.prepare"].includes(x),
  );
  const report = useLoad(
    () =>
      read && range.date_from
        ? estimates.statisticsCostEstimates(range)
        : Promise.resolve(undefined),
    [read, range, revision],
  );
  const work = useLoad(
    () => (mayList ? estimates.worklistCostEstimates() : Promise.resolve([])),
    [mayList, revision],
  );
  const stats = !report.loading && !report.error ? report.data : undefined;
  const papers = [
    ...(mayPolicy
      ? [
          {
            path: "/tariff/pricing-policy/pdf",
            label: t("pricing policy", "قیمت پالیسی"),
          },
        ]
      : []),
    { path: "/tariff/pdf", label: t("tariff PDF", "نرخ نامہ پی ڈی ایف") },
  ];
  async function pack() {
    if (!connected || printing) return;
    setPrinting(true);
    setError(undefined);
    setMessage("");
    try {
      const r = await call("estimate-pdf-pack", {
        paths: papers.map((x) => x.path),
      });
      setMessage(
        r.saved
          ? t("Combined PDF saved.", "مشترکہ پی ڈی ایف محفوظ ہوئی۔")
          : t("PDF save cancelled.", "پی ڈی ایف محفوظ کرنا منسوخ۔"),
      );
    } catch (e) {
      setError(e);
    } finally {
      setPrinting(false);
    }
  }
  return (
    <section data-screen="estimate_statistics">
      <QualityHeading
        title={t(
          "Cost estimates: statistics and the pricing policy",
          "لاگت تخمینے: اعداد اور قیمت پالیسی",
        )}
        text={t(
          "Review whether estimates were explained in time and bills matched quoted costs.",
          "دیکھیں تخمینے بروقت سمجھائے گئے اور بل تخمینوں سے ملے۔",
        )}
        onHelp={onOpenHelp}
      />
      {read && (
        <>
          <QualityPeriod range={range} apply={setRange} />
          <LoadState {...report} retry={report.reload} />
          {stats && (
            <>
              {totals([
                [
                  t("Explained in time (PRE 78)", "بروقت سمجھائے"),
                  percent(stats.explained_in_time_pct),
                ],
                [
                  t("Ward changes explained (PRE 79)", "وارڈ تبدیلی سمجھائی"),
                  percent(stats.ward_changes_explained_pct),
                ],
                [
                  t("Bills within accuracy", "درستگی میں بل"),
                  percent(stats.bills_within_accuracy_pct),
                ],
              ])}
              {panel(
                t("Estimate evidence", "تخمینہ شواہد"),
                [t("Measure", "پیمائش"), t("Count or target", "تعداد یا ہدف")],
                [
                  [
                    t(
                      "Admissions / explained / in time",
                      "داخلے / سمجھائے / بروقت",
                    ),
                    `${stats.admissions} / ${stats.explained} / ${stats.explained_in_time}`,
                  ],
                  [
                    t("Explanation target hours", "وضاحت ہدف گھنٹے"),
                    stats.estimate_due_hours,
                  ],
                  [
                    t("Ward changes / explained", "وارڈ تبدیلی / سمجھائی"),
                    `${stats.ward_changes} / ${stats.ward_changes_explained}`,
                  ],
                  [
                    t(
                      "Estimated discharges / accurate bills",
                      "تخمینی ڈسچارج / درست بل",
                    ),
                    `${stats.discharges_estimated} / ${stats.bills_within_accuracy}`,
                  ],
                  [
                    t("Accuracy threshold", "درستگی حد"),
                    percent(stats.accuracy_pct),
                  ],
                ],
              )}
              {counts(
                t("Estimates by reason", "وجہ کے لحاظ سے تخمینے"),
                stats.by_reason.map((x) => [x.key, x.count]),
              )}
            </>
          )}
        </>
      )}
      {combined ? (
        <button
          data-help="est.stats.pdf"
          disabled={!connected || printing}
          onClick={() => void pack()}
        >
          {t(
            "Save combined estimate documents",
            "مشترکہ تخمینہ دستاویزات محفوظ کریں",
          )}
        </button>
      ) : (
        <QualityPaper disabled={!connected} documents={papers} />
      )}
      <ErrorBox error={error} />
      {message && <p role="status">{message}</p>}
      {mayList && (
        <>
          <LoadState {...work} retry={work.reload} />
          {!work.loading &&
            !work.error &&
            panel(
              t("Estimate worklist", "تخمینہ کام کی فہرست"),
              [
                t("Admission and patient", "داخلہ اور مریض"),
                t("Kind and ward", "قسم اور وارڈ"),
                t("Since", "کب سے"),
                t("Details", "تفصیل"),
              ],
              (work.data ?? []).map((x) => [
                <>
                  <bdi>
                    {x.admission_number} · {x.mrn}
                  </bdi>{" "}
                  · {x.patient_name}
                </>,
                `${x.kind} · ${x.ward_name ?? "—"}`,
                when(x.since, timeZone),
                <>
                  {x.detail}
                  {x.overdue && (
                    <strong className="error">
                      {" "}
                      · {t("Overdue", "تاخیر شدہ")}
                    </strong>
                  )}
                </>,
              ]),
            )}
        </>
      )}
    </section>
  );
}

export function SurgicalStatistics({
  screenId,
  user,
  view,
  timeZone,
  revision,
  onOpenHelp,
}: Base & {
  screenId: "surgical_statistics" | "surgical_statistics_owner";
  view?: View;
}) {
  const read =
    serviceVisible(view) &&
    user.permissions.includes("ot.clinical_statistics.view");
  const incident =
    serviceVisible(view) &&
    user.permissions.some((x) =>
      [
        "incident.view",
        "incident.report",
        "ot.clinical_statistics.view",
      ].includes(x),
    );
  const [range, setRange] = useState(() => currentMonth(timeZone));
  const [area, setArea] = useState<"Surgery" | "Anaesthesia">("Surgery");
  const stats = useLoad(
    () =>
      read && range.date_from
        ? surgery.clinicalStatistics(range)
        : Promise.resolve(undefined),
    [read, range, revision],
  );
  const events = useLoad(
    () =>
      incident
        ? surgery.listIncidents({ area, open_only: true, limit: 500 })
        : Promise.resolve([]),
    [incident, area, revision],
  );
  const d = !stats.loading && !stats.error ? stats.data : undefined;
  return (
    <section data-screen={screenId}>
      <QualityHeading
        title={t("Surgical care statistics", "جراحی نگہداشت کے اعداد")}
        text={t(
          "Read theatre, anaesthesia, recovery and adverse-event measures.",
          "تھیٹر، بے ہوشی، بحالی اور منفی واقعات کی پیمائش پڑھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      {retirement(view)}
      {read && (
        <>
          <QualityPeriod range={range} apply={setRange} />
          <LoadState {...stats} retry={stats.reload} />
          {d && (
            <>
              {totals([
                [t("Operations", "آپریشن"), d.operations],
                [
                  t("With anaesthetist", "بے ہوشی معالج کے ساتھ"),
                  d.with_anaesthetist,
                ],
                [
                  t("Adverse events in period", "مدت کے منفی واقعات"),
                  d.adverse_events.total,
                ],
                [
                  t("Open adverse events now", "اب کھلے منفی واقعات"),
                  d.adverse_events.open_now,
                ],
                [
                  t("Chart gap threshold (min)", "چارٹ وقفہ حد (منٹ)"),
                  d.chart_gap_minutes,
                ],
              ])}
              {measures(
                d.measures.map((x) => [
                  x.label,
                  x.reference,
                  x.met,
                  x.applicable,
                  x.pct,
                ]),
              )}
              {panel(
                t("By surgeon", "سرجن کے لحاظ سے"),
                [
                  t("Surgeon", "سرجن"),
                  t("Operations", "آپریشن"),
                  t(
                    "Notes signed / checklists complete",
                    "دستخط نوٹ / مکمل چیک لسٹ",
                  ),
                  t("Adverse events", "منفی واقعات"),
                ],
                d.by_surgeon.map((x) => [
                  x.name,
                  x.operations,
                  `${x.operative_notes_signed} / ${x.checklists_complete}`,
                  x.adverse_events,
                ]),
              )}
              {panel(
                t("By theatre", "تھیٹر کے لحاظ سے"),
                [
                  t("Theatre", "تھیٹر"),
                  t("Operations", "آپریشن"),
                  t("Adverse events", "منفی واقعات"),
                ],
                d.by_theatre.map((x) => [
                  x.name ?? "—",
                  x.operations,
                  x.adverse_events,
                ]),
              )}
              {counts(
                t("Adverse events by kind", "قسم کے لحاظ سے منفی واقعات"),
                d.adverse_events.by_kind.map((x) => [x.key, x.count]),
              )}
              {counts(
                t("Adverse events by severity", "شدت کے لحاظ سے منفی واقعات"),
                d.adverse_events.by_severity.map((x) => [x.key, x.count]),
              )}
              {counts(
                t("Adverse events by category", "زمرے کے لحاظ سے منفی واقعات"),
                d.adverse_events.by_category.map((x) => [x.key, x.count]),
              )}
            </>
          )}
        </>
      )}
      {incident && (
        <>
          <Field
            label={t("Open adverse event area", "کھلے منفی واقعے کا شعبہ")}
          >
            <select
              data-help="surg.events"
              value={area}
              onChange={(e) => setArea(e.target.value as typeof area)}
            >
              <option value="Surgery">{t("Surgery", "جراحی")}</option>
              <option value="Anaesthesia">{t("Anaesthesia", "بے ہوشی")}</option>
            </select>
          </Field>
          <LoadState {...events} retry={events.reload} />
          {!events.loading &&
            !events.error &&
            panel(
              t("Open adverse events", "کھلے منفی واقعات"),
              [
                t("Incident and procedure", "واقعہ اور عمل"),
                t("Occurrence and harm", "وقت اور نقصان"),
                t("Status", "حالت"),
              ],
              (events.data ?? []).map((x) => [
                <>
                  <bdi>{x.incident_number}</bdi> · {x.type_name} ·{" "}
                  {x.procedure_name ?? "—"}
                </>,
                `${when(x.occurred_at, timeZone)} · ${x.harm}`,
                x.status,
              ]),
            )}
        </>
      )}
    </section>
  );
}
