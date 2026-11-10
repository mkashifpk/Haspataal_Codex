import { useEffect, useState, type FormEvent } from "react";
import * as adr from "../generated/adr_report";
import { Field, LoadState, useLoad, ErrorBox } from "../components";
import { ApiError } from "../bridge";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading } from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

const id = "adr_report",
  adrType = "ADVERSE_DRUG_REACTION";
const textFields = [
  ["product_name", "Product name", "دوا کا نام"],
  [
    "active_ingredients",
    "Active ingredients and strength",
    "فعال اجزا اور طاقت",
  ],
  ["dosage_form", "Dosage form", "دوا کی شکل"],
  ["pack_size", "Pack size", "پیک سائز"],
  [
    "registration_number",
    "Registration number on pack",
    "پیک کا رجسٹریشن نمبر",
  ],
  ["manufacture_date", "Manufacture date", "تیاری کی تاریخ"],
  ["manufacturer_name", "Manufacturer", "بنانے والا"],
  ["manufacturer_address", "Manufacturer address", "بنانے والے کا پتہ"],
  ["manufacturer_phone", "Manufacturer phone", "بنانے والے کا فون"],
  ["manufacturer_fax", "Manufacturer fax", "بنانے والے کا فیکس"],
  ["complaint_received_on", "Complaint received on", "شکایت موصول تاریخ"],
  ["tests_attached", "Test results attached", "ساتھ ٹیسٹ نتیجہ"],
  ["manufacturer_contact_details", "Contact details", "رابطے کی تفصیل"],
] as const;
const recipients = ["DRAP", "Manufacturer", "Supplier"] as const;
const requiredParticulars = new Set([
  "product_name", "active_ingredients", "dosage_form", "manufacturer_name", "complaint_received_on",
]);
const sources = {
  Patient: "مریض",
  Attendant: "تیماردار",
  SelfInspection: "اپنا معائنہ",
  Other: "دیگر",
} as const;
export function AdrReport({
  user,
  connected,
  readOnly,
  noNewWork,
  revision,
  timeZone,
  onOpenHelp,
  entry,
}: {
  user: ClinicalUser;
  connected: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  revision: number;
  timeZone?: string;
  onOpenHelp: () => void;
  entry?: { incidentId: number; drugId: number | null };
}) {
  const [selected, setSelected] = useState<number | undefined>(entry?.incidentId);
  const [filters, setFilters] = useState<{ date_from?: string; date_to?: string; open_only?: boolean }>({});
  const [mode, setMode] = useState<"edit" | "send">();
  const [version, setVersion] = useState<number | null>();
  const [approved, setApproved] = useState(false),
    [source, setSource] = useState(""),
    [batchKind, setBatchKind] = useState(""),
    [batchId, setBatchId] = useState("");
  const [localError, setLocalError] = useState<unknown>();
  const canRead = user.permissions.some((p) =>
    ["incident.view", "incident.manage"].includes(p),
  );
  const canList = user.permissions.includes("incident.view");
  const incidents = useLoad(
    () =>
      canList
        ? adr.listIncidents({ ...filters, type_code: adrType, limit: 500 })
        : Promise.resolve([]),
    [canList, filters, revision],
  );
  const incident = useLoad(
    () =>
      canRead && selected
        ? adr.getIncident(selected)
        : Promise.resolve(undefined),
    [canRead, selected, revision],
  );
  const sourceIncident =
    !incident.loading &&
    !incident.error &&
    incident.data?.incident_id === selected &&
    incident.data?.type_code === adrType
      ? incident.data
      : undefined;
  const report = useLoad(
    () =>
      sourceIncident
        ? adr.getIncidentsAdrReport(sourceIncident.incident_id)
        : Promise.resolve(undefined),
    [sourceIncident?.incident_id, revision],
  );
  const canReadStock = user.permissions.some((p) =>
    ["pharmacy.formulary.view", "pharmacy.stock.view"].includes(p),
  );
  const listedIncident = incidents.data?.find(row => row.incident_id === selected && row.type_code === adrType);
  const drug = listedIncident?.drug_id ?? (entry?.incidentId === selected ? entry?.drugId : undefined);
  const stock = useLoad(
    () =>
      mode === "edit" && batchKind === "stock" && canReadStock && drug
        ? adr.stockStatus(drug)
        : Promise.resolve(undefined),
    [mode, batchKind, canReadStock, drug],
  );
  const write = useClinicalWrite(user, id, async () => {
    setMode(undefined);
    await report.reload();
  });
  const problem =
    write.error instanceof ApiError
      ? write.error.response.error?.code
      : undefined;
  useEffect(() => {
    if (
      problem &&
      [
        "ADR_REPORT_ALREADY_SENT",
        "ADR_REPORT_SENT",
        "VERSION_CONFLICT",
      ].includes(problem)
    ) {
      setApproved(false);
      void report.reload();
    }
  }, [problem]);
  const current =
    report.data?.incident_id === selected ? report.data : undefined;
  const editable =
    !!current &&
    !!sourceIncident &&
    !report.loading &&
    !report.error &&
    connected &&
    !readOnly &&
    !noNewWork &&
    !write.blocked &&
    user.permissions.includes("incident.manage");
  const locked = !!current?.submissions.length;
  const changed = mode === "edit" && current?.row_version !== version;
  const remaining = recipients.filter(
    (r) => !current?.submissions.some((s) => s.recipient === r),
  );
  const period = currentMonth(timeZone);
  const batch =
    stock.data?.drug_id === drug
      ? stock.data?.batches.find((b) => String(b.batch_id) === batchId)
      : undefined;
  function begin(next: "edit" | "send") {
    setMode(next);
    setVersion(current?.row_version);
    setSource(current?.complaint_source ?? "");
    setBatchKind("");
    setBatchId("");
    setApproved(false);
    setLocalError(undefined);
    write.clearError();
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable || !current || !approved) return;
    const f = new FormData(e.currentTarget),
      value = (k: string) => String(f.get(k) ?? "").trim(),
      path = `/incidents/${current.incident_id}/adr-report`;
    setLocalError(undefined);
    if (mode === "edit" && !locked && !changed) {
      if (!source || [...requiredParticulars].some(key => !value(key))) {
        setLocalError(Error(t("Complete the medicine, manufacturer, complaint date and source.", "دوا، بنانے والا، شکایت تاریخ اور ذریعہ مکمل کریں۔")));
        return;
      }
      if (source === "Other" && !value("complaint_source_other")) {
        setLocalError(
          Error(t("Describe the other source.", "دیگر ذریعہ لکھیں۔")),
        );
        return;
      }
      if (batchKind === "stock" && (!batch || stock.loading || stock.error)) {
        setLocalError(
          Error(
            t(
              "Choose the actual medicine batch first.",
              "پہلے اصل دوا بیچ چنیں۔",
            ),
          ),
        );
        return;
      }
      const expiry = batchKind === "stock" ? batch?.expiry_date : batchKind === "external" ? value("expiry_date") : current.expiry_date;
      if (expiry && value("manufacture_date") && value("manufacture_date") >= expiry) {
        setLocalError(Error(t("Manufacture date must be before expiry.", "تیاری تاریخ میعاد سے پہلے ہو۔")));
        return;
      }
      const body: adr.AdrReportIn = {
        ...Object.fromEntries(textFields.map(([k]) => [k, value(k) || null])),
        complaint_source: (source ||
          null) as adr.AdrReportIn["complaint_source"],
        complaint_source_other:
          source === "Other" ? value("complaint_source_other") : null,
        similar_reports: value("similar_reports")
          ? Number(value("similar_reports"))
          : null,
        manufacturer_contacted: value("manufacturer_contacted")
          ? value("manufacturer_contacted") === "yes"
          : null,
      };
      if (batchKind === "stock") body.batch_id = batch!.batch_id;
      if (batchKind === "external") {
        body.batch_number = value("batch_number") || null;
        body.expiry_date = value("expiry_date") || null;
      }
      if (current.saved) body.expected_version = current.row_version;
      write.start({
        method: "PUT",
        path,
        body,
        permission: "incident.manage",
        protection: "reconcile",
        reconcilePath: path,
        label: t("Save ADR report", "دوا ردعمل رپورٹ محفوظ"),
      });
    } else if (mode === "send" && current.saved) {
      const recipient = value("recipient") as adr.AdrSendIn["recipient"];
      if (!remaining.includes(recipient)) return;
      write.start({
        method: "POST",
        path: `${path}/submissions`,
        body: {
          recipient,
          sent_on: value("sent_on"),
          reference: value("reference") || null,
        },
        permission: "incident.manage",
        protection: "idempotent",
        reconcilePath: path,
        label: t("Record where the report was sent", "رپورٹ بھیجنے کی جگہ درج"),
      });
    }
  }
  return (
    <section
      data-screen={id}
      data-unsaved={!!mode}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t("Adverse drug reaction report", "دوا کے مضر ردعمل کی رپورٹ")}
        text={t(
          "Choose an ADR incident. Use the actual medicine pack, sign the printed form by hand and record where it was sent.",
          "مضر ردعمل واقعہ چنیں۔ اصل دوا پیک، پرنٹ پر ہاتھ سے دستخط اور بھیجنے کی جگہ درج کریں۔",
        )}
        onHelp={onOpenHelp}
      />
      {canList && <form className="toolbar" onSubmit={event => {
        event.preventDefault();
        if (mode || write.blocked) return;
        const fields = new FormData(event.currentTarget);
        const date_from = String(fields.get("date_from") ?? "");
        const date_to = String(fields.get("date_to") ?? "");
        if (date_from && date_to && date_from > date_to) {
          setLocalError(Error(t("From must be on or before To.", "ابتدا انتہا کے برابر یا پہلے ہو۔")));
          return;
        }
        setLocalError(undefined);
        setSelected(undefined);
        setFilters({ date_from: date_from || undefined, date_to: date_to || undefined, open_only: fields.has("open_only") });
      }}>
        <Field label={t("From", "ابتدا")}><input type="date" name="date_from" data-help="adr.source" disabled={!!mode || write.blocked} /></Field>
        <Field label={t("To", "انتہا")}><input type="date" name="date_to" data-help="adr.source" disabled={!!mode || write.blocked} /></Field>
        <label className="check"><input type="checkbox" name="open_only" data-help="adr.source" disabled={!!mode || write.blocked} />{t("Open incidents only", "صرف کھلے واقعات")}</label>
        <button data-help="adr.source" disabled={!connected || !!mode || write.blocked}>{t("Apply ADR filters", "ردعمل فلٹر لگائیں")}</button>
      </form>}
      {!mode && <ErrorBox error={localError} />}
      <LoadState {...incidents} retry={() => void incidents.reload()} />
      {canList && !incidents.loading && !incidents.error && (
        <Field label={t("ADR incident", "دوا ردعمل واقعہ")}>
          <select
            data-help="adr.source"
            disabled={!!mode || write.blocked}
            value={selected ?? ""}
            onChange={(e) =>
              setSelected(e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="">
              {t("Choose the incident number", "واقعہ نمبر چنیں")}
            </option>
            {sourceIncident && !listedIncident && <option value={sourceIncident.incident_id}>{sourceIncident.incident_number} · {sourceIncident.type_name}</option>}
            {incidents.data
              ?.filter((x) => x.type_code === adrType)
              .map((x) => (
                <option value={x.incident_id} key={x.incident_id}>
                  {x.incident_number} · {x.type_name}
                </option>
              ))}
          </select>
        </Field>
      )}
      {!incidents.loading && !incidents.error && !incidents.data?.length && (
        <p role="status">
          {t(
            "No ADR incidents are available. Record the incident first.",
            "ردعمل واقعہ دستیاب نہیں۔ پہلے واقعہ درج کریں۔",
          )}
        </p>
      )}
      {selected && (
        <>
          <LoadState {...incident} retry={() => void incident.reload()} />
          <LoadState {...report} retry={() => void report.reload()} />
        </>
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setMode(undefined);
          void report.reload();
        }}
      />
      {current && (
        <article className="card">
          <h2>
            {current.incident_number} ·{" "}
            {current.saved
              ? t("Saved ADR report", "محفوظ ردعمل رپورٹ")
              : t("Pre-filled draft", "پہلے سے بھرا مسودہ")}
          </h2>
          {locked && (
            <p className="notice">
              {t(
                "First sending is recorded. The report fields are locked.",
                "پہلا ارسال درج ہے۔ رپورٹ خانے مقفل ہیں۔",
              )}
            </p>
          )}
          <dl>
            {textFields.map(
              ([key, en, ur]) =>
                current[key] && (
                  <div key={key}>
                    <dt>{t(en, ur)}</dt>
                    <dd>{current[key]}</dd>
                  </div>
                ),
            )}
            {current.batch_number && (
              <div>
                <dt>{t("Batch and expiry", "بیچ و میعاد")}</dt>
                <dd>
                  {current.batch_number}
                  {current.expiry_date && ` · ${current.expiry_date}`}
                </dd>
              </div>
            )}
          </dl>
          {current.contact_stamp && (
            <p>
              {current.contact_stamp.text} ·{" "}
              {t(
                "Sign by hand on the printed report.",
                "پرنٹ پر ہاتھ سے دستخط کریں۔",
              )}
            </p>
          )}
          {!!current.submissions.length && (
            <ul>
              {current.submissions.map((s) => (
                <li key={s.recipient}>
                  {s.recipient} · {s.sent_on}
                  {s.reference && ` · ${s.reference}`} · {s.sent_by_name}
                </li>
              ))}
            </ul>
          )}
          {editable && !mode && (
            <div className="toolbar">
              {!locked && (
                <button data-help="adr.fields" onClick={() => begin("edit")}>
                  {t("Edit report details", "رپورٹ تفصیل بدلیں")}
                </button>
              )}
              {current.saved && remaining.length > 0 && (
                <button data-help="adr.send" onClick={() => begin("send")}>
                  {t("Mark as sent", "ارسال درج کریں")}
                </button>
              )}
            </div>
          )}
          {current.saved && (
            <QualityPaper
              disabled={!connected || write.blocked}
              documents={[
                {
                  label: t("ADR report", "ردعمل رپورٹ"),
                  path: `/incidents/${current.incident_id}/adr-report/pdf`,
                },
              ]}
            />
          )}
          {mode && (
            <form onSubmit={submit} onChange={() => setApproved(false)}>
              <ErrorBox error={localError} />
              {changed && (
                <p role="alert">
                  {t(
                    "The report version changed. Cancel and reopen its current version.",
                    "رپورٹ نسخہ بدل گیا۔ منسوخ اور تازہ نسخہ کھولیں۔",
                  )}
                </p>
              )}
              <fieldset
                disabled={!editable || !!changed || (mode === "edit" && locked)}
              >
                {mode === "edit" ? (
                  <>
                    {textFields.map(([key, en, ur]) => (
                      <Field key={key} label={t(en, ur)}>
                        <input
                          name={key}
                          required={requiredParticulars.has(key)}
                          type={
                            key.endsWith("_date") || key.endsWith("_on")
                              ? "date"
                              : "text"
                          }
                          data-help="adr.fields"
                          defaultValue={current[key] ?? ""}
                        />
                      </Field>
                    ))}
                    <Field label={t("Complaint source", "شکایت ذریعہ")}>
                      <select
                        name="complaint_source"
                        required
                        data-help="adr.fields"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                      >
                        <option value="">
                          {t("Not recorded", "درج نہیں")}
                        </option>
                        {Object.entries(sources).map(([name, ur]) => (
                          <option key={name} value={name}>
                            {t(name, ur)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {source === "Other" && (
                      <Field label={t("Other source", "دیگر ذریعہ")}>
                        <input
                          data-help="adr.fields"
                          name="complaint_source_other"
                          required
                          defaultValue={current.complaint_source_other ?? ""}
                        />
                      </Field>
                    )}
                    <Field label={t("Similar reports", "ملتی رپورٹس")}>
                      <input
                        data-help="adr.fields"
                        type="number"
                        min={0}
                        step={1}
                        name="similar_reports"
                        defaultValue={current.similar_reports ?? ""}
                      />
                    </Field>
                    <Field
                      label={t("Manufacturer contacted", "بنانے والے سے رابطہ")}
                    >
                      <select
                        data-help="adr.fields"
                        name="manufacturer_contacted"
                        defaultValue={
                          current.manufacturer_contacted == null
                            ? ""
                            : current.manufacturer_contacted
                              ? "yes"
                              : "no"
                        }
                      >
                        <option value="">
                          {t("Not recorded", "درج نہیں")}
                        </option>
                        <option value="yes">{t("Yes", "ہاں")}</option>
                        <option value="no">{t("No", "نہیں")}</option>
                      </select>
                    </Field>
                    <Field label={t("Batch source", "بیچ ذریعہ")}>
                      <select
                        data-help="adr.batch"
                        value={batchKind}
                        onChange={(e) => {
                          setBatchKind(e.target.value);
                          setBatchId("");
                        }}
                      >
                        <option value="">
                          {t(
                            "Keep the recorded batch details",
                            "درج بیچ برقرار",
                          )}
                        </option>
                        {drug && canReadStock && (
                          <option value="stock">
                            {t(
                              "Dispensed here: choose a stock batch",
                              "یہاں ملی: اسٹاک بیچ چنیں",
                            )}
                          </option>
                        )}
                        <option value="external">
                          {t(
                            "Bought outside: copy from pack",
                            "باہر سے خریدی: پیک سے لکھیں",
                          )}
                        </option>
                      </select>
                    </Field>
                    {batchKind === "stock" && (
                      <>
                        <LoadState
                          {...stock}
                          retry={() => void stock.reload()}
                        />
                        <Field label={t("Batch from stock", "اسٹاک سے بیچ")}>
                          <select
                            data-help="adr.batch"
                            required
                            value={batchId}
                            disabled={stock.loading || !!stock.error}
                            onChange={(e) => setBatchId(e.target.value)}
                          >
                            <option value="">
                              {t("Choose the batch number", "بیچ نمبر چنیں")}
                            </option>
                            {stock.data?.batches.map((b) => (
                              <option key={b.batch_id} value={b.batch_id}>
                                {b.batch_no} · {b.expiry_date}
                                {b.is_expired
                                  ? ` · ${t("Expired", "میعاد ختم")}`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {!stock.loading &&
                          !stock.error &&
                          !stock.data?.batches.length && (
                            <p>
                              {t(
                                "No stock batch was found. Ask Pharmacy to verify the dispensing record.",
                                "اسٹاک بیچ نہیں ملا۔ فارمیسی سے اصل ریکارڈ چیک کرائیں۔",
                              )}
                            </p>
                          )}
                      </>
                    )}
                    {batchKind === "external" && (
                      <>
                        <Field label={t("Batch on pack", "پیک بیچ")}>
                          <input
                            data-help="adr.batch"
                            name="batch_number"
                            defaultValue={current.batch_number ?? ""}
                          />
                        </Field>
                        <Field label={t("Expiry on pack", "پیک میعاد")}>
                          <input
                            data-help="adr.batch"
                            name="expiry_date"
                            type="date"
                            defaultValue={current.expiry_date ?? ""}
                          />
                        </Field>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      {t(
                        "Record an actual sending. The first entry locks the report. This form records the sending only.",
                        "اصل ارسال درج کریں۔ پہلا ارسال رپورٹ مقفل کرتا ہے۔ یہ فارم صرف ارسال درج کرتا ہے۔",
                      )}
                    </p>
                    <Field label={t("Recipient", "وصول کنندہ")}>
                      <select name="recipient" data-help="adr.send" required>
                        {remaining.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("Sent on", "ارسال تاریخ")}>
                      <input
                        name="sent_on"
                        data-help="adr.send"
                        type="date"
                        required
                        max={period.date_to || undefined}
                      />
                    </Field>
                    <Field label={t("Reference", "حوالہ")}>
                      <input name="reference" data-help="adr.send" />
                    </Field>
                  </>
                )}
                <label className="check">
                  <input
                    data-help="adr.save"
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => {
                      e.stopPropagation();
                      setApproved(e.target.checked);
                    }}
                  />
                  {t(
                    "I checked the actual source information.",
                    "اصل ذریعہ معلومات چیک کی۔",
                  )}
                </label>
                <button type="submit" data-help="adr.save" disabled={!approved}>
                  {mode === "edit"
                    ? t("Save ADR report", "ردعمل رپورٹ محفوظ")
                    : t("Record sending", "ارسال درج")}
                </button>
              </fieldset>
              <button
                type="button"
                data-help="adr.cancel"
                disabled={write.blocked}
                onClick={() => {
                  setMode(undefined);
                  write.clearError();
                }}
              >
                {t("Cancel unsent changes", "غیر ارسال تبدیلی منسوخ")}
              </button>
            </form>
          )}
        </article>
      )}
    </section>
  );
}
