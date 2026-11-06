import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/incident_types";
import { call } from "../bridge";
import { ErrorBox, Field } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
type Area = api.IncidentTypeOut["area"];
const areas: Area[] = [
  "Clinical",
  "Medication",
  "Anaesthesia",
  "Surgery",
  "Diagnostics",
  "Transfusion",
  "Infection",
  "MotherAndBaby",
  "Behaviour",
  "Facility",
  "Occupational",
];
const areaName = (a: Area) =>
  ({
    Clinical: t("Clinical", "طبی"),
    Medication: t("Medication", "ادویات"),
    Anaesthesia: t("Anaesthesia", "بے ہوشی"),
    Surgery: t("Surgery", "جراحی"),
    Diagnostics: t("Diagnostics", "تشخیص"),
    Transfusion: t("Transfusion", "خون کی منتقلی"),
    Infection: t("Infection", "انفیکشن"),
    MotherAndBaby: t("Mother and baby", "ماں اور بچہ"),
    Behaviour: t("Behaviour", "رویہ"),
    Facility: t("Facility", "عمارت و سہولت"),
    Occupational: t("Occupational", "پیشہ ورانہ"),
  })[a];
export function IncidentTypes({
  user,
  revision,
  connected,
  readOnly,
  onOpenHelp,
}: {
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  onOpenHelp: () => void;
}) {
  const [rows, setRows] = useState<api.IncidentTypeOut[]>([]),
    [area, setArea] = useState<Area | "">(""),
    [activeOnly, setActiveOnly] = useState(true),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [mode, setMode] = useState<"create" | "update">(),
    [record, setRecord] = useState<api.IncidentTypeOut>(),
    [reviewed, setReviewed] = useState(false),
    [paperBusy, setPaperBusy] = useState(false),
    [paperError, setPaperError] = useState<unknown>(),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    setReviewed(false);
    try {
      const r = await api.listTypes({
        area: area || undefined,
        active_only: activeOnly,
      });
      if (n === generation.current)
        setRows(
          r.sort(
            (a, b) =>
              a.sort_order - b.sort_order || a.name.localeCompare(b.name),
          ),
        );
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [area, activeOnly]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, revision]);
  const write = useClinicalWrite(user, "incident_types", async () => {
    setMode(undefined);
    setRecord(undefined);
    setReviewed(false);
    setNotice(
      t(
        "The list changed. Obtain the current sentinel list and replace the copies in patient care areas.",
        "فہرست بدلی۔ موجودہ حفاظتی فہرست لیں اور مریض نگہداشت جگہوں کی نقول بدلیں۔",
      ),
    );
    await load();
  });
  const blocked = write.blocked || paperBusy,
    editable =
      connected &&
      !readOnly &&
      !loading &&
      !error &&
      !blocked &&
      user.permissions.includes("incident.manage");
  const current = record && rows.find((r) => r.type_code === record.type_code),
    stale =
      mode === "update" &&
      (!current || current.row_version !== record?.row_version);
  useEffect(() => {
    if (write.error && !write.blocked) void load();
  }, [write.error, write.blocked, load]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable || !mode || !reviewed || stale) return;
    const f = new FormData(e.currentTarget),
      s = (k: string) => String(f.get(k) ?? "").trim(),
      fields = {
        name: s("name"),
        sentinel: s("sentinel") as api.IncidentTypeOut["sentinel"],
        description: s("description") || null,
        sort_order: Number(s("sort_order")),
      };
    if (mode === "create") {
      const body: api.IncidentTypeIn = {
        ...fields,
        type_code: s("type_code"),
        area: s("area") as Area,
      };
      write.start({
        method: "POST",
        path: "/incident-types",
        body,
        permission: "incident.manage",
        protection: "idempotent",
        reconcilePath: "/incident-types?active_only=false",
        label: t("Add this incident type", "واقعے کی یہ قسم شامل کریں"),
      });
    } else if (record)
      write.start({
        method: "PATCH",
        path: `/incident-types/${encodeURIComponent(record.type_code)}`,
        body: {
          ...fields,
          is_active: f.get("is_active") === "on",
          expected_version: record.row_version,
        },
        permission: "incident.manage",
        protection: "reconcile",
        reconcilePath: "/incident-types?active_only=false",
        label: t(
          "Change or retire this incident type",
          "واقعے کی یہ قسم بدلیں یا سبک دوش کریں",
        ),
      });
  }
  async function pdf(preview: boolean) {
    if (!connected || blocked) return;
    setPaperBusy(true);
    setPaperError(undefined);
    try {
      const r = await call("clinical-pdf", {
        path: "/incidents/sentinel-list/pdf",
        preview,
      });
      setNotice(
        preview
          ? t(
              "Server sentinel PDF opened. Check it and replace the posted copies after approval.",
              "سرور حفاظتی پی ڈی ایف کھلی۔ چیک اور منظوری کے بعد آویزاں نقول بدلیں۔",
            )
          : r.saved
            ? t(
                "Server sentinel PDF saved. Print the current list for wards, ER and theatres.",
                "سرور حفاظتی پی ڈی ایف محفوظ۔ موجودہ فہرست وارڈ، ایمرجنسی و تھیٹر کے لیے پرنٹ کریں۔",
              )
            : t(
                "Save cancelled; no type was changed.",
                "محفوظ منسوخ؛ کوئی قسم نہیں بدلی۔",
              ),
      );
    } catch (e) {
      setPaperError(e);
    } finally {
      setPaperBusy(false);
    }
  }
  return (
    <section
      data-screen="incident_types"
      data-unsaved={!!mode}
      data-write-pending={write.blocked}
    >
      <div className="section-heading">
        <div>
          <h1>
            {t(
              "What to report: incident types and sentinel events",
              "کیا رپورٹ کریں: واقعات کی اقسام اور سنگین واقعات",
            )}
          </h1>
          <p>
            {t(
              "Maintain the reporting list and keep the current sentinel list in every patient care area.",
              "رپورٹ کی فہرست برقرار اور ہر مریض نگہداشت جگہ پر موجودہ سنگین واقعات کی فہرست رکھیں۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="ity.refresh"
            disabled={write.busy || paperBusy}
            onClick={() => void load()}
          >
            {t("Refresh incident types", "واقعات کی اقسام تازہ پڑھیں")}
          </button>
          <button data-help="ity.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
          {user.permissions.includes("incident.manage") && (
            <button
              data-help="ity.new"
              disabled={!editable || !!mode}
              onClick={() => {
                setMode("create");
                setRecord(undefined);
                setReviewed(false);
                write.clearError();
              }}
            >
              {t("Add incident type", "واقعے کی قسم شامل کریں")}
            </button>
          )}
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Keep the draft; no offline changes are queued.",
            "رابطہ نہیں۔ مسودہ رکھیں؛ آف لائن تبدیلی جمع نہیں ہوتی۔",
          )}
        </p>
      )}
      {readOnly && (
        <p>
          {t(
            "Records only. New reporting-list changes are unavailable in this service view.",
            "صرف ریکارڈ۔ اس خدمت میں فہرست کی نئی تبدیلی نہیں۔",
          )}
        </p>
      )}
      <div className="form-grid">
        <Field label={t("Reporting area", "رپورٹ کا شعبہ")}>
          <select
            data-help="ity.filter"
            value={area}
            disabled={blocked || !!mode}
            onChange={(e) => setArea(e.target.value as Area | "")}
          >
            <option value="">{t("All areas", "تمام شعبے")}</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {areaName(a)}
              </option>
            ))}
          </select>
        </Field>
        <label>
          <input
            data-help="ity.active-filter"
            type="checkbox"
            checked={activeOnly}
            disabled={blocked || !!mode}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          {t("Active types only", "صرف فعال اقسام")}
        </label>
      </div>
      {loading && (
        <p role="status">
          {t(
            "Reading current reporting types…",
            "موجودہ رپورٹ کی اقسام پڑھی جا رہی ہیں…",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      {!loading &&
        !error &&
        (rows.length ? (
          areas
            .filter((a) => rows.some((r) => r.area === a))
            .map((a) => (
              <div key={a}>
                <h2>{areaName(a)}</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          t("Code / name", "کوڈ / نام"),
                          t("When sentinel", "کب سنگین واقعہ"),
                          t("What to report", "کیا رپورٹ کریں"),
                          t("Status", "حالت"),
                          t("Order", "ترتیب"),
                          t("Action", "عمل"),
                        ].map((v) => (
                          <th key={v}>{v}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .filter((r) => r.area === a)
                        .map((r) => (
                          <tr key={r.type_code}>
                            <td>
                              {r.type_code}
                              <br />
                              {r.name}
                            </td>
                            <td
                              className={
                                r.sentinel === "Always" ? "field-error" : ""
                              }
                            >
                              {r.sentinel === "Always"
                                ? t(
                                    "Always a sentinel event",
                                    "ہمیشہ سنگین واقعہ",
                                  )
                                : t(
                                    "Sentinel with severe harm or death",
                                    "شدید نقصان یا موت پر سنگین واقعہ",
                                  )}
                            </td>
                            <td>
                              {r.description ?? t("Not recorded", "درج نہیں")}
                            </td>
                            <td>
                              {r.is_active
                                ? t("Active", "فعال")
                                : t(
                                    "Retired — history kept",
                                    "سبک دوش — تاریخ محفوظ",
                                  )}
                            </td>
                            <td>{r.sort_order}</td>
                            <td>
                              {user.permissions.includes("incident.manage") && (
                                <button
                                  data-help="ity.edit"
                                  disabled={!editable || !!mode}
                                  onClick={() => {
                                    setRecord(r);
                                    setMode("update");
                                    setReviewed(false);
                                    write.clearError();
                                  }}
                                >
                                  {t(
                                    "Change or retire",
                                    "بدلیں یا سبک دوش کریں",
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
        ) : (
          <p>
            {t(
              "No reporting types match these filters. Show all areas or include retired types; Quality maintains the list.",
              "ان فلٹر میں قسم نہیں۔ تمام شعبے یا سبک دوش اقسام دکھائیں؛ کوالٹی فہرست رکھتی ہے۔",
            )}
          </p>
        ))}
      {mode && (
        <form key={mode + (record?.type_code ?? "")} onSubmit={submit}>
          {stale && (
            <p role="alert">
              {t(
                "This type changed after you opened it. Keep the draft for comparison, then cancel and reopen the current type; never overwrite with the old version.",
                "یہ قسم کھولنے کے بعد بدلی۔ موازنے کو مسودہ رکھیں، پھر منسوخ و موجودہ قسم کھولیں؛ پرانے نسخے سے نہ بدلیں۔",
              )}
            </p>
          )}
          <fieldset disabled={!editable || stale}>
            <legend>
              {mode === "create"
                ? t("New reporting type", "رپورٹ کی نئی قسم")
                : record?.type_code +
                  " · " +
                  t("loaded version", "پڑھا نسخہ") +
                  " " +
                  record?.row_version}
            </legend>
            {mode === "create" && (
              <>
                <Field
                  label={t("Reporting code", "رپورٹ کا کوڈ")}
                  hint={t(
                    "3–40 uppercase letters, digits or underscore; starts with a letter. This stable code cannot be changed later.",
                    "تین تا چالیس بڑے انگریزی حروف، عدد یا زیر لکیر؛ پہلا حرف۔ یہ مستقل کوڈ بعد میں نہیں بدلتا۔",
                  )}
                >
                  <input
                    data-help="ity.code"
                    name="type_code"
                    required
                    pattern="[A-Z][A-Z0-9_]{2,39}"
                    maxLength={40}
                  />
                </Field>
                <Field label={t("Area", "شعبہ")}>
                  <select
                    data-help="ity.area"
                    name="area"
                    defaultValue=""
                    required
                  >
                    <option value="">
                      {t("Choose the area", "شعبہ چنیں")}
                    </option>
                    {areas.map((a) => (
                      <option key={a} value={a}>
                        {areaName(a)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label={t("Type name", "قسم کا نام")}>
              <input
                data-help="ity.name"
                name="name"
                defaultValue={record?.name ?? ""}
                required
                minLength={3}
                maxLength={200}
              />
            </Field>
            <Field
              label={t("Sentinel classification", "سنگین واقعے کی درجہ بندی")}
            >
              <select
                data-help="ity.sentinel"
                name="sentinel"
                defaultValue={record?.sentinel ?? ""}
                required
              >
                <option value="">
                  {t("Choose deliberately", "سوچ کر چنیں")}
                </option>
                <option value="Always">
                  {t("Always a sentinel event", "ہمیشہ سنگین واقعہ")}
                </option>
                <option value="IfSevereHarm">
                  {t(
                    "Only with severe harm or death",
                    "صرف شدید نقصان یا موت پر",
                  )}
                </option>
              </select>
            </Field>
            <Field
              label={t(
                "What to report under this type",
                "اس قسم میں کیا رپورٹ کریں",
              )}
            >
              <textarea
                data-help="ity.description"
                name="description"
                defaultValue={record?.description ?? ""}
                maxLength={1000}
              />
            </Field>
            <Field label={t("Display order", "دکھانے کی ترتیب")}>
              <input
                data-help="ity.order"
                name="sort_order"
                type="number"
                min={0}
                max={10000}
                step={1}
                defaultValue={record?.sort_order ?? 100}
                required
              />
            </Field>
            {mode === "update" && (
              <label>
                <input
                  data-help="ity.active"
                  type="checkbox"
                  name="is_active"
                  defaultChecked={record?.is_active}
                />
                {t(
                  "Active for new reports (uncheck to retire; past incidents keep it)",
                  "نئی رپورٹ کے لیے فعال (ہٹا کر سبک دوش؛ پچھلے واقعات میں برقرار)",
                )}
              </label>
            )}
            <label>
              <input
                data-help="ity.review"
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              {t(
                "I checked this type, sentinel classification and effect on new reports.",
                "قسم، سنگین درجہ بندی اور نئی رپورٹ پر اثر چیک کیا ہے۔",
              )}
            </label>
            <button data-help="ity.submit" disabled={!reviewed}>
              {mode === "create"
                ? t("Add this type once", "یہ قسم ایک بار شامل کریں")
                : t(
                    "Save this versioned change",
                    "نسخے کے ساتھ تبدیلی محفوظ کریں",
                  )}
            </button>
          </fieldset>
          <button
            data-help="ity.cancel"
            type="button"
            disabled={write.blocked}
            onClick={() => {
              if (
                confirm(
                  t("Discard this unsent change?", "غیر ارسال تبدیلی چھوڑیں؟"),
                )
              ) {
                setMode(undefined);
                setRecord(undefined);
              }
            }}
          >
            {t("Cancel unsent change", "غیر ارسال تبدیلی منسوخ")}
          </button>
        </form>
      )}
      <ClinicalWriteFeedback write={write} onReviewed={() => void load()} />
      <ErrorBox error={paperError} />
      {notice && <p role="status">{notice}</p>}
      <div className="toolbar">
        <button
          data-help="ity.pdf"
          disabled={!connected || blocked}
          onClick={() => void pdf(true)}
        >
          {t(
            "Preview current sentinel PDF",
            "موجودہ سنگین فہرست پی ڈی ایف دیکھیں",
          )}
        </button>
        <button
          data-help="ity.pdf"
          disabled={!connected || blocked}
          onClick={() => void pdf(false)}
        >
          {t("Save current sentinel PDF", "موجودہ سنگین فہرست پی ڈی ایف محفوظ")}
        </button>
      </div>
    </section>
  );
}
