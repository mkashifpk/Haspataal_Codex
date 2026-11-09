import { useState } from "react";
import { call } from "../bridge";
import type { ClinicalUser } from "../clinical-context";
import { ErrorBox, Field, LoadState, useLoad } from "../components";
import * as register from "../generated/consent_register";
import { formatHospitalTime, hospitalTimeZoneError } from "../hospital-time";
import { bilingual as t } from "../i18n";
import { QualityPaper } from "./QualityPaper";
import { currentMonth, QualityHeading, QualityPeriod } from "./QualityRegister";

const categories = {
  General: "عمومی",
  Procedure: "طریقہ علاج",
  Anaesthesia: "بے ہوشی",
  Transfusion: "انتقال خون",
  HighRiskTreatment: "زیادہ خطرے والا علاج",
  AgainstMedicalAdvice: "طبی مشورے کے خلاف",
  Other: "دیگر",
};
const statuses = {
  Draft: "مسودہ",
  Given: "دی گئی",
  Refused: "انکار",
  Withdrawn: "واپس لی گئی",
  Cancelled: "منسوخ",
};
const maxRows = 1000;
type Filters = NonNullable<Parameters<typeof register.listConsents>[0]>;
type ScreenId = "consent_register" | "consent_register_owner";

function ConsentMeasures({ data }: { data: register.ConsentStatisticsOut }) {
  return (
    <>
      <p>
        {data.date_from} – {data.date_to}
      </p>
      <p>
        {t("Decided", "فیصلے")} {data.decided} · {t("Refused", "انکار")}{" "}
        {data.refused} · {t("Thumb impressions", "انگوٹھے کے نشان")}{" "}
        {data.thumb_impressions} · {t("Interpreters", "مترجم")}{" "}
        {data.with_interpreter} · {t("Read aloud", "پڑھ کر سنایا")}{" "}
        {data.read_aloud}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("Measure", "پیمانہ")}</th>
              <th>{t("Reference", "حوالہ")}</th>
              <th>{t("Met / applicable", "پورے / قابل اطلاق")}</th>
              <th>{t("Result", "نتیجہ")}</th>
            </tr>
          </thead>
          <tbody>
            {data.measures.map((measure) => (
              <tr key={measure.measure}>
                <td>{measure.label}</td>
                <td>{measure.reference}</td>
                <td>
                  {measure.met} / {measure.applicable}
                </td>
                <td>
                  {measure.pct === null ? (
                    t("No applicable records", "کوئی قابل اطلاق ریکارڈ نہیں")
                  ) : (
                    <>
                      <strong
                        className={measure.pct < 100 ? "error" : undefined}
                      >
                        {measure.pct}%
                      </strong>
                      {measure.pct < 100 && (
                        <span> · {t("Below target", "ہدف سے کم")}</span>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>{t("By category", "زمرے کے لحاظ سے")}</h3>
      {data.by_category.length === 0 ? (
        <p>
          {t(
            "No category counts for this period.",
            "اس مدت میں کسی زمرے کی گنتی نہیں۔",
          )}
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Category", "زمرہ")}</th>
                <th>{t("Given", "دی گئی")}</th>
                <th>{t("Refused", "انکار")}</th>
                <th>{t("Withdrawn", "واپس لی گئی")}</th>
              </tr>
            </thead>
            <tbody>
              {data.by_category.map((row) => (
                <tr key={row.category}>
                  <th scope="row">
                    {t(row.category, categories[row.category])}
                  </th>
                  <td>{row.given}</td>
                  <td>{row.refused}</td>
                  <td>{row.withdrawn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3>{t("By language", "زبان کے لحاظ سے")}</h3>
      <Counts rows={data.by_language} />
      <h3>{t("By decision maker", "فیصلہ کرنے والے کے لحاظ سے")}</h3>
      <Counts rows={data.by_decider} />
    </>
  );
}

function Counts({ rows }: { rows: register.ConsentCountOut[] }) {
  return rows.length ? (
    <dl className="details">
      {rows.map((row) => (
        <div key={row.key}>
          <dt>{row.key}</dt>
          <dd>{row.count}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p>{t("No counts for this period.", "اس مدت میں کوئی گنتی نہیں۔")}</p>
  );
}

export function ConsentRegister({
  screenId,
  user,
  connected,
  timeZone,
  revision,
  onOpenHelp,
}: {
  screenId: ScreenId;
  user: ClinicalUser;
  connected: boolean;
  timeZone?: string;
  revision: number;
  onOpenHelp: () => void;
}) {
  const canRead = user.permissions.includes("consent.view");
  const canStatistics = user.permissions.includes("consent.statistics.view");
  const month = currentMonth(timeZone);
  const [filters, setFilters] = useState<Filters>();
  const [period, setPeriod] = useState<{
    date_from: string;
    date_to: string;
  }>();
  const [selected, setSelected] = useState<number>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [printError, setPrintError] = useState<unknown>();
  const [printNotice, setPrintNotice] = useState("");
  const currentFilters = filters ?? month;
  const statisticsPeriod = period ?? month;
  const haveDates = Boolean(currentFilters.date_from && currentFilters.date_to);
  const haveStatisticsDates = Boolean(
    statisticsPeriod.date_from && statisticsPeriod.date_to,
  );
  const rows = useLoad(
    () =>
      canRead && haveDates
        ? register.listConsents({ ...currentFilters, limit: maxRows })
        : Promise.resolve(undefined),
    [
      canRead,
      currentFilters.date_from,
      currentFilters.date_to,
      filters,
      revision,
    ],
  );
  const detail = useLoad(
    () =>
      canRead && selected
        ? register.getConsent(selected)
        : Promise.resolve(undefined),
    [canRead, selected, revision],
  );
  const preview = useLoad(
    () =>
      canRead && previewOpen && selected
        ? register.printConsent(selected)
        : Promise.resolve(undefined),
    [canRead, selected, previewOpen, revision],
  );
  const statistics = useLoad(
    () =>
      canStatistics && haveStatisticsDates
        ? register.consentStatistics(statisticsPeriod)
        : Promise.resolve(undefined),
    [
      canStatistics,
      statisticsPeriod.date_from,
      statisticsPeriod.date_to,
      revision,
    ],
  );
  const list = !rows.loading && !rows.error ? rows.data : undefined;
  const record =
    !detail.loading && !detail.error && detail.data?.consent_id === selected
      ? detail.data
      : undefined;
  const paper =
    !preview.loading &&
    !preview.error &&
    record &&
    preview.data?.fields.consent.consent_id === record.consent_id &&
    preview.data.fields.consent.row_version === record.row_version &&
    preview.data.fields.consent.patient_id === record.patient_id
      ? preview.data.fields
      : undefined;
  const dateLabel = (value: string) =>
    timeZone ? formatHospitalTime(value, timeZone) : value;
  const timeError = hospitalTimeZoneError(timeZone);

  function openRecord(id: number | undefined) {
    setSelected(id);
    setPreviewOpen(false);
    setPrintNotice("");
    setPrintError(undefined);
  }

  async function printForm(pdf: boolean) {
    if (!record || !connected || printBusy) return;
    setPrintBusy(true);
    setPrintError(undefined);
    setPrintNotice("");
    try {
      const result = await call("print-consent", {
        consentId: record.consent_id,
        expectedVersion: record.row_version,
        pdf,
        sourceScreen: screenId,
      });
      setPrintNotice(
        result.saved
          ? t("Consent PDF saved.", "رضامندی پی ڈی ایف محفوظ۔")
          : result.printed
            ? t(
                "Consent sent to the document printer.",
                "رضامندی دستاویز پرنٹر کو بھیجی گئی۔",
              )
            : t(
                "Consent PDF save cancelled.",
                "رضامندی پی ڈی ایف محفوظ کرنا منسوخ۔",
              ),
      );
    } catch (error) {
      setPrintError(error);
    } finally {
      setPrintBusy(false);
    }
  }

  return (
    <section data-screen={screenId}>
      <QualityHeading
        title={t(
          "Consent register and statistics",
          "رضامندی رجسٹر اور اعداد و شمار",
        )}
        text={t(
          "Read the decision as recorded, find signed forms still to scan and review consent measures.",
          "درج فیصلہ پڑھیں، اسکین کے منتظر دستخط شدہ فارم تلاش کریں اور رضامندی کے پیمانے دیکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      <ErrorBox error={timeError} />
      {!canRead && !canStatistics && (
        <p role="status">
          {t(
            "Consent register or statistics access is required.",
            "رضامندی رجسٹر یا اعداد و شمار تک رسائی درکار ہے۔",
          )}
        </p>
      )}
      {canRead && (
        <article className="card">
          <h2>{t("Consent register", "رضامندی رجسٹر")}</h2>
          <QualityPeriod
            range={{
              date_from: currentFilters.date_from ?? "",
              date_to: currentFilters.date_to ?? "",
            }}
            disabled={!connected || printBusy}
            apply={(range) => {
              setFilters({ ...filters, ...range });
              openRecord(undefined);
            }}
          />
          <div className="toolbar">
            <Field label={t("Category", "زمرہ")}>
              <select
                data-help="cnr.filters"
                value={filters?.category ?? ""}
                onChange={(e) => {
                  setFilters({
                    ...currentFilters,
                    ...filters,
                    category: (e.target.value as Filters["category"]) || null,
                  });
                  openRecord(undefined);
                }}
                disabled={!connected || printBusy}
              >
                <option value="">{t("All categories", "تمام زمرے")}</option>
                {Object.entries(categories).map(([key, ur]) => (
                  <option key={key} value={key}>
                    {t(key, ur)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Status", "حالت")}>
              <select
                data-help="cnr.filters"
                value={filters?.status ?? ""}
                onChange={(e) => {
                  setFilters({
                    ...currentFilters,
                    ...filters,
                    status: (e.target.value as Filters["status"]) || null,
                  });
                  openRecord(undefined);
                }}
                disabled={!connected || printBusy}
              >
                <option value="">{t("All states", "تمام حالتیں")}</option>
                {Object.entries(statuses).map(([key, ur]) => (
                  <option key={key} value={key}>
                    {t(key, ur)}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check">
              <input
                type="checkbox"
                data-help="cnr.filters"
                checked={!!filters?.unscanned}
                disabled={!connected || printBusy}
                onChange={(e) => {
                  setFilters({
                    ...currentFilters,
                    ...filters,
                    unscanned: e.target.checked,
                  });
                  openRecord(undefined);
                }}
              />
              {t(
                "Signed forms still to scan",
                "دستخط شدہ فارم جن کا اسکین باقی ہے",
              )}
            </label>
            <button
              type="button"
              data-help="cnr.filters"
              disabled={!connected || rows.loading}
              onClick={() => void rows.reload()}
            >
              {t("Refresh register", "رجسٹر تازہ پڑھیں")}
            </button>
          </div>
          <LoadState {...rows} retry={() => void rows.reload()} />
          {list?.length === 0 && (
            <p role="status">
              {t(
                "No consents match these filters. Change the period or clear a filter.",
                "ان فلٹروں سے کوئی رضامندی نہیں ملی۔ مدت بدلیں یا فلٹر ہٹائیں۔",
              )}
            </p>
          )}
          {list?.length === maxRows && (
            <p>
              {t(
                "The list reached 1000 rows. Narrow the period to see a complete result.",
                "فہرست ایک ہزار صف تک پہنچی۔ مکمل نتیجے کے لیے مدت کم کریں۔",
              )}
            </p>
          )}
          {!!list?.length && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Consent and patient", "رضامندی اور مریض")}</th>
                    <th>{t("Form and language", "فارم اور زبان")}</th>
                    <th>{t("Decision", "فیصلہ")}</th>
                    <th>{t("Paper", "کاغذ")}</th>
                    <th>{t("Open", "کھولیں")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.consent_id}>
                      <th scope="row">
                        <bdi>{row.consent_number}</bdi>
                        <br />
                        {row.patient_name} · <bdi>{row.mrn}</bdi>
                      </th>
                      <td>
                        {row.form_title}
                        <br />
                        {row.language}
                      </td>
                      <td>
                        {t(row.status, statuses[row.status])}
                        <br />
                        {dateLabel(row.decided_at ?? row.created_at)}
                      </td>
                      <td>
                        {row.scanned_at
                          ? t("Scan recorded", "اسکین درج")
                          : row.mode === "Signed"
                            ? t("Scan pending", "اسکین باقی")
                            : t("No scan recorded", "اسکین درج نہیں")}
                      </td>
                      <td>
                        <button
                          data-help="cnr.open"
                          disabled={printBusy}
                          aria-pressed={selected === row.consent_id}
                          onClick={() => openRecord(row.consent_id)}
                        >
                          {t("Open consent", "رضامندی کھولیں")}
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
      {selected && (
        <article className="card">
          <h2>{t("Consent details", "رضامندی کی تفصیل")}</h2>
          <button
            data-help="cnr.open"
            disabled={printBusy}
            onClick={() => openRecord(undefined)}
          >
            {t("Close consent", "رضامندی بند کریں")}
          </button>
          <LoadState {...detail} retry={() => void detail.reload()} />
          {record && (
            <>
              <p>
                <strong>
                  <bdi>{record.consent_number}</bdi>
                </strong>{" "}
                · {record.patient_name} · <bdi>{record.mrn}</bdi>
              </p>
              <p>
                {t(record.status, statuses[record.status])} · {record.language}{" "}
                · {dateLabel(record.decided_at ?? record.created_at)}
              </p>
              <div dir={record.direction}>
                <h3>{record.form_title}</h3>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {record.form_body}
                </p>
              </div>
              <dl className="details">
                {record.mode && (
                  <div>
                    <dt>{t("Decision mode", "فیصلے کا طریقہ")}</dt>
                    <dd>{record.mode}</dd>
                  </div>
                )}
                {record.signer && (
                  <div>
                    <dt>{t("Who decided", "فیصلہ کس نے کیا")}</dt>
                    <dd>
                      {[
                        record.signer_name ?? record.signer,
                        record.signer_relationship,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </dd>
                  </div>
                )}
                {record.refusal_reason && (
                  <div>
                    <dt>{t("Reason for refusal", "انکار کی وجہ")}</dt>
                    <dd>{record.refusal_reason}</dd>
                  </div>
                )}
                {record.withdrawal_reason && (
                  <div>
                    <dt>{t("Reason for withdrawal", "واپسی کی وجہ")}</dt>
                    <dd>{record.withdrawal_reason}</dd>
                  </div>
                )}
                {record.emergency_note && (
                  <div>
                    <dt>{t("Emergency note", "ہنگامی نوٹ")}</dt>
                    <dd>{record.emergency_note}</dd>
                  </div>
                )}
                {record.obtained_stamp && (
                  <div>
                    <dt>{t("Taken by", "رضامندی لینے والا")}</dt>
                    <dd>{record.obtained_stamp.text}</dd>
                  </div>
                )}
                {record.scanned_at && (
                  <div>
                    <dt>{t("Paper scanned at", "کاغذ اسکین ہوا")}</dt>
                    <dd>{dateLabel(record.scanned_at)}</dd>
                  </div>
                )}
              </dl>
              <div className="toolbar">
                <button
                  data-help="cnr.preview"
                  disabled={!connected || printBusy}
                  onClick={() => setPreviewOpen(!previewOpen)}
                >
                  {previewOpen
                    ? t("Close form preview", "فارم کا جائزہ بند کریں")
                    : t("Preview printed form", "پرنٹ فارم کا جائزہ")}
                </button>
                <button
                  data-help="cnr.preview"
                  disabled={!connected || printBusy}
                  onClick={() => void printForm(false)}
                >
                  {t("Print consent form", "رضامندی فارم پرنٹ کریں")}
                </button>
                {record.direction === "rtl" && (
                  <button
                    data-help="cnr.preview"
                    disabled={!connected || printBusy}
                    onClick={() => void printForm(true)}
                  >
                    {t(
                      "Save terminal consent PDF",
                      "ٹرمینل رضامندی پی ڈی ایف محفوظ کریں",
                    )}
                  </button>
                )}
              </div>
              {record.direction === "ltr" && (
                <QualityPaper
                  disabled={!connected || printBusy}
                  documents={[
                    {
                      label: t("consent PDF", "رضامندی پی ڈی ایف"),
                      path: `/consents/${record.consent_id}/pdf`,
                    },
                  ]}
                />
              )}
              <ErrorBox error={printError} />
              {printNotice && <p role="status">{printNotice}</p>}
            </>
          )}
          {previewOpen && (
            <LoadState {...preview} retry={() => void preview.reload()} />
          )}
          {previewOpen && paper && (
            <section
              className="notice"
              dir={paper.consent.direction}
              aria-label={t("Printed consent form", "پرنٹ رضامندی فارم")}
            >
              <h3>{paper.consent.form_title}</h3>
              <p>
                {paper.hospital.name} · {paper.hospital.phc_number}
              </p>
              <p>{paper.hospital.issue_line}</p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {paper.consent.form_body}
              </p>
              {[...paper.explained, ...paper.decision].map((line, index) => (
                <p key={index}>
                  <strong>{line.label}</strong> {line.value}
                </p>
              ))}
              {paper.signature_lines.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </section>
          )}
        </article>
      )}
      {canStatistics && (
        <article className="card">
          <h2>{t("Consent statistics", "رضامندی کے اعداد و شمار")}</h2>
          <QualityPeriod
            range={statisticsPeriod}
            apply={setPeriod}
            disabled={!connected}
          />
          <button
            data-help={screenId === "consent_register_owner" ? "cnr.owner" : "cnr.stats"}
            disabled={!connected || !haveStatisticsDates || statistics.loading}
            onClick={() => void statistics.reload()}
          >
            {t("Refresh statistics", "اعداد و شمار تازہ پڑھیں")}
          </button>
          <LoadState {...statistics} retry={() => void statistics.reload()} />
          {!statistics.loading && !statistics.error && statistics.data && (
            <ConsentMeasures data={statistics.data} />
          )}
        </article>
      )}
    </section>
  );
}
