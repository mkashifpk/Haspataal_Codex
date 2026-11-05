import { useCallback, useEffect, useRef, useState } from "react";
import { bilingual as t } from "../i18n";
import { ErrorBox, Field } from "../components";
import { WasteHandover } from "../WasteHandover";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as api from "../generated/waste_log_ops";
import {
  departments,
  type DepartmentOut,
} from "../generated/compliance_register_ops";
import { bedMatrix, type WardOccupancyOut } from "../generated/waste_log_ops";
import {
  wasteAccess,
  wasteDraft,
  wasteCategories,
  wasteDisposals,
  wastePayload,
  wasteProblems,
} from "../waste-log-policy";
const names: Record<string, [string, string]> = {
  Infectious: ["Infectious", "متعدی"],
  Sharps: ["Sharps", "نوکیلی اشیا"],
  Pathological: ["Pathological", "جسمانی بافتیں"],
  Pharmaceutical: ["Pharmaceutical", "دواسازی"],
  Chemical: ["Chemical", "کیمیائی"],
  Radioactive: ["Radioactive", "تابکار"],
  NonRisk: ["Non-risk", "غیر خطرناک"],
  Incineration: ["Incineration", "بھٹی میں جلانا"],
  Autoclave: ["Autoclave", "آٹوکلیو"],
  Encapsulation: ["Encapsulation", "محفوظ قالب میں بند کرنا"],
  Landfill: ["Landfill", "محفوظ زمین میں دفن"],
  Recycling: ["Recycling", "دوبارہ استعمال"],
  Other: ["Other", "دیگر"],
};
const name = (s: string) => (names[s] ? t(...names[s]) : s);
const date = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]}-${y}`;
};
export function WasteLog({
  user,
  establishment,
  connected,
  onOpenHelp,
}: {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected: boolean;
  onOpenHelp: () => void;
}) {
  const access = wasteAccess(user.permissions, establishment);
  const [log, setLog] = useState<api.WasteLogOut>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>();
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [category, setCategory] = useState(""),
    [limit, setLimit] = useState(500),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState<api.WasteRecordOut>(),
    [editor, setEditor] = useState(false),
    [draft, setDraft] = useState(wasteDraft),
    [validation, setValidation] = useState<string[]>([]);
  const [handoverPending,setHandoverPending]=useState(false),[handoverActive,setHandoverActive]=useState(false);
  const [vendors, setVendors] = useState<api.VendorOut[]>([]),
    [depts, setDepts] = useState<DepartmentOut[]>([]),
    [wards, setWards] = useState<WardOccupancyOut[]>([]),
    [lookupError, setLookupError] = useState<unknown>();
  const sequence = useRef(0),
    form = useRef<HTMLFormElement>(null);
  const refresh = useCallback(async () => {
    if (!access.canView) return;
    const seq = ++sequence.current;
    setLoading(true);
    setError(undefined);
    if (from && to && from > to) {
      setError(
        new Error(
          t(
            "Start date must not follow end date.",
            "ابتدائی تاریخ آخری تاریخ کے بعد نہ ہو۔",
          ),
        ),
      );
      setLoading(false);
      setLog(undefined);
      return;
    }
    try {
      const data = await api.listWaste({
        date_from: from || undefined,
        date_to: to || undefined,
        category: (category || undefined) as api.WasteIn["category"],
        limit,
      });
      if (seq === sequence.current) {setLog(data);setSelected(current=>current?data.records.find(row=>row.waste_id===current.waste_id)??undefined:undefined);}
    } catch (e) {
      if (seq === sequence.current) {
        setError(e);
        setLog(undefined);
      }
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, [access.canView, from, to, category, limit]);
  useEffect(() => {
    void refresh();
    return () => {
      sequence.current++;
    };
  }, [refresh]);
  const lookups = useCallback(async () => {
    if (!access.canRecord) return;
    setLookupError(undefined);
    const jobs: Promise<unknown>[] = [
      api.vendors({vendor_type: "Contractor"}).then(setVendors),
      departments().then(rows => setDepts(rows.filter(row => row.is_active))),
    ];
    if (
      user.permissions.some((p) =>
        ["ipd.bed.view", "cssd.operate", "infection.control.manage", "complaint.manage", "incident.view", "facility.drill.manage", "roster.manage.all", "facility.equipment.manage", "pharmacy.storage.record"].includes(
          p,
        ),
      )
    )
      jobs.push(
        bedMatrix({ include_beds: false }).then((r) => setWards(r.wards)),
      );
    const results = await Promise.allSettled(jobs);
    for (const r of results)
      if (r.status === "rejected") setLookupError(r.reason);
  }, [access.canRecord, user.permissions]);
  useEffect(() => {
    void lookups();
  }, [lookups]);
  const write = useClinicalWrite(
    user,
    "waste_log_ops",
    async (value: api.WasteRecordOut) => {
      setSelected(value);
      setEditor(false);
      setValidation([]);
      setDraft(wasteDraft());
      await refresh();
    },
  );
  const blocked = write.blocked||handoverPending;
  useEffect(() => {
    if (editor)
      form.current
        ?.querySelector<HTMLElement>("input,select,textarea")
        ?.focus();
  }, [editor]);
  const set = (key: keyof typeof draft, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const rows =
    log?.records.filter((r) =>
      `${r.waste_id} ${r.location ?? ""} ${r.ward_name ?? ""} ${r.department_name ?? ""} ${r.vendor_name ?? ""} ${r.manifest_number ?? ""}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase().trim()),
    ) ?? [];
  const problems: Record<string, [string, string]> = {
    category: ["Choose the actual waste category.", "فضلے کی اصل قسم چنیں۔"],
    area: [
      "Choose a department/ward or enter the collection area.",
      "شعبہ یا وارڈ چنیں یا جمع کرنے کی جگہ لکھیں۔",
    ],
    weight: [
      "Enter measured weight greater than 0 and at most 100,000 kg.",
      "ناپا ہوا وزن صفر سے زیادہ اور 100,000 کلو تک دیں۔",
    ],
    bags: [
      "Bags must be a whole number from 0 to 10,000, or blank.",
      "تھیلوں کی تعداد صفر سے 10,000 تک صحیح عدد یا خالی ہو۔",
    ],
    handover: [
      "Choose the actual contractor and enter its consignment note.",
      "اصل ٹھیکیدار چنیں اور اس کی حوالگی رسید لکھیں۔",
    ],
    disposal: [
      "Choose a listed disposal method or leave blank.",
      "فہرست کا تلفی طریقہ چنیں یا خالی چھوڑیں۔",
    ],
    length: ["Check the displayed text limits.", "متن کی دکھائی حد چیک کریں۔"],
  };
  if (!access.canView)
    return (
      <section data-screen="waste_log_ops">
        <h1>{t("Hospital waste log", "ہسپتال کا فضلہ رجسٹر")}</h1>
        <p role="alert">
          {t(
            "This screen is unavailable with your current permissions or facility view.",
            "موجودہ اجازت یا ادارے کے منظر میں یہ اسکرین دستیاب نہیں۔",
          )}
        </p>
      </section>
    );
  return (
    <section
      data-screen="waste_log_ops"
      data-unsaved="false"
      data-write-pending={blocked}
      className="waste-log"
    >
      <div className="screen-head">
        <div>
          <h1>{t("Hospital waste log", "ہسپتال کا فضلہ رجسٹر")}</h1>
          <p>
            {t(
              "Weigh each category separately, for each collection area. Keep the contractor’s consignment note.",
              "ہر جگہ سے جمع ہر قسم کا وزن الگ ناپیں۔ ٹھیکیدار کی حوالگی رسید رکھیں۔",
            )}
          </p>
        </div>
        <div className="actions">
          <button data-help="wl.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / F1")}
          </button>
          <button
            data-help="wl.refresh"
            disabled={blocked || editor || loading || !connected}
            onClick={() => {
              void refresh();
              void lookups();
            }}
          >
            {t("Refresh", "تازہ کریں")}
          </button>
          {access.canRecord && (
            <button
              data-help="wl.new"
              disabled={blocked || editor || handoverActive || !connected}
              onClick={() => {
                write.clearError();
                setDraft(wasteDraft());
                setValidation([]);
                setEditor(true);
              }}
            >
              {t("Record collection", "فضلہ جمع ہونے کا اندراج")}
            </button>
          )}
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Connection lost. Records cannot be submitted offline.",
            "رابطہ منقطع ہے۔ آف لائن اندراج نہیں بھیجا جا سکتا۔",
          )}
        </p>
      )}
      {!access.canRecord && (
        <p>
          {t(
            "Read-only: recording permission and a full facility view are required for new entries.",
            "صرف مطالعہ: نئے اندراج کے لیے اجازت اور مکمل منظر لازم ہے۔",
          )}
        </p>
      )}
      {access.canRecord && !editor && <WasteHandover user={user} connected={connected} onSaved={refresh} onPending={setHandoverPending} onActive={setHandoverActive} />}
      <ClinicalWriteFeedback
        write={{
          ...write,
          notice: write.notice
            ? t(
                "Confirmed on the server. Keep this record; a failed refresh is not a reason to record it again.",
                "سرور نے تصدیق کی۔ یہی ریکارڈ رکھیں؛ تازہ پڑھنے کی خرابی پر دوبارہ اندراج نہ کریں۔",
              )
            : "",
        }}
        onReviewed={() => {
          setEditor(false);
          setDraft(wasteDraft());
          void refresh();
        }}
      />
      {editor && (
        <form
          ref={form}
          className="panel"
          data-unsaved="true"
          onSubmit={(e) => {
            e.preventDefault();
            if (blocked || !connected || !access.canRecord) return;
            const p = wasteProblems(draft);
            setValidation(p);
            if (p.length) return;
            const body = wastePayload(draft);
            write.start({
              method: "POST",
              path: "/infection/waste",
              body,
              permission: "infection.waste.record",
              protection: "idempotent",
              reconcilePath: body.recorded_on
                ? `/infection/waste?date_from=${body.recorded_on}&date_to=${body.recorded_on}&limit=5000`
                : "/infection/waste?limit=5000",
              label: t(
                "Record this collection once",
                "یہ جمع شدہ فضلہ ایک بار درج کریں",
              ),
            });
          }}
        >
          <h2>{t("Record collection", "فضلہ جمع ہونے کا اندراج")}</h2>
          <p>
            {t(
              "One entry per category and area. Entries cannot be edited or deleted here. Verify the measured weight before saving.",
              "ہر قسم اور جگہ کے لیے ایک اندراج۔ یہاں ترمیم یا حذف ممکن نہیں۔ محفوظ کرنے سے پہلے ناپا وزن چیک کریں۔",
            )}
          </p>
          <ErrorBox error={lookupError} />
          {!!validation.length && (
            <div role="alert">
              {validation.map((p) => (
                <p key={p}>{t(...problems[p])}</p>
              ))}
            </div>
          )}
          <fieldset
            disabled={blocked || !connected || !access.canRecord}
            className="form-grid"
          >
            <Field
              label={t(
                "Collection date (blank: server today)",
                "جمع کرنے کی تاریخ (خالی: سرور کا آج)",
              )}
            >
              <input
                type="date"
                data-help="wl.date"
                value={draft.recorded_on}
                onChange={(e) => set("recorded_on", e.target.value)}
              />
            </Field>
            <Field label={t("Waste category", "فضلے کی قسم")}>
              <select
                required
                data-help="wl.category"
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">{t("Choose category", "قسم چنیں")}</option>
                {wasteCategories.map((v) => (
                  <option key={v} value={v}>
                    {name(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Weight (kg)", "وزن (کلو)")}>
              <input
                required
                data-help="wl.weight"
                type="number"
                min="0"
                max="100000"
                step="any"
                value={draft.weight_kg}
                onChange={(e) => set("weight_kg", e.target.value)}
              />
            </Field>
            <Field label={t("Bags (optional)", "تھیلے (اختیاری)")}>
              <input
                data-help="wl.bags"
                type="number"
                min="0"
                max="10000"
                step="1"
                value={draft.bags}
                onChange={(e) => set("bags", e.target.value)}
              />
            </Field>
            <Field label={t("Department (optional)", "شعبہ (اختیاری)")}>
              <select
                data-help="wl.department"
                value={draft.department_id}
                onChange={(e) => set("department_id", e.target.value)}
              >
                <option value="">{t("Not linked", "ربط نہیں")}</option>
                {depts.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            {!!wards.length && (
              <Field label={t("Ward (optional)", "وارڈ (اختیاری)")}>
                <select
                  data-help="wl.ward"
                  value={draft.ward_id}
                  onChange={(e) => set("ward_id", e.target.value)}
                >
                  <option value="">{t("Not linked", "ربط نہیں")}</option>
                  {wards.map((d) => (
                    <option key={d.ward_id} value={d.ward_id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field
              label={t(
                "Collection area (up to 300 characters)",
                "جمع کرنے کی جگہ (300 حروف تک)",
              )}
            >
              <input
                data-help="wl.location"
                maxLength={300}
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </Field>
            <label className="check">
              <input
                data-help="wl.handover"
                type="checkbox"
                checked={draft.handover}
                onChange={(e) => set("handover", e.target.checked)}
              />
              {t(
                "Contractor handover details are known now",
                "ٹھیکیدار کو حوالگی کی معلومات ابھی معلوم ہیں",
              )}
            </label>
            {draft.handover && (
              <>
                <Field
                  label={t(
                    "Contractor who took the waste",
                    "فضلہ لینے والا ٹھیکیدار",
                  )}
                >
                  <select
                    required
                    data-help="wl.vendor"
                    value={draft.vendor_id}
                    onChange={(e) => set("vendor_id", e.target.value)}
                  >
                    <option value="">
                      {t("Choose registered contractor", "درج ٹھیکیدار چنیں")}
                    </option>
                    {vendors.map((v) => (
                      <option
                        key={v.vendor_id}
                        value={v.vendor_id}
                        disabled={!v.is_active}
                      >
                        {v.name}
                        {!v.is_active ? t(" (inactive)", " (غیر فعال)") : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={t(
                    "Consignment note (up to 100 characters)",
                    "حوالگی رسید (100 حروف تک)",
                  )}
                >
                  <input
                    required
                    data-help="wl.manifest"
                    maxLength={100}
                    value={draft.manifest_number}
                    onChange={(e) => set("manifest_number", e.target.value)}
                  />
                </Field>
                <Field
                  label={t(
                    "Disposal method (optional)",
                    "تلفی کا طریقہ (اختیاری)",
                  )}
                >
                  <select
                    data-help="wl.disposal"
                    value={draft.disposal}
                    onChange={(e) => set("disposal", e.target.value)}
                  >
                    <option value="">{t("Not recorded", "درج نہیں")}</option>
                    {wasteDisposals.map((v) => (
                      <option key={v} value={v}>
                        {name(v)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field
              label={t("Note (up to 1,000 characters)", "نوٹ (1,000 حروف تک)")}
            >
              <textarea
                data-help="wl.note"
                maxLength={1000}
                value={draft.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
            <div className="actions">
              <button type="submit" data-help="wl.save">
                {t("Save collection once", "جمع شدہ فضلہ ایک بار محفوظ کریں")}
              </button>
              <button
                type="button"
                data-help="wl.cancel"
                onClick={() => {
                  setEditor(false);
                  setDraft(wasteDraft());
                  setValidation([]);
                }}
              >
                {t("Cancel unsent entry", "غیر ارسال اندراج منسوخ")}
              </button>
            </div>
          </fieldset>
          <p>
            {t(
              "Handover cannot yet be added to a saved collection here. Ask Operations / IT; do not record the same weight again.",
              "یہاں محفوظ جمع شدہ فضلے میں بعد کی حوالگی شامل نہیں ہو سکتی۔ آپریشنز یا آئی ٹی سے کہیں؛ وہی وزن دوبارہ درج نہ کریں۔",
            )}
          </p>
        </form>
      )}
      <fieldset disabled={blocked || editor} className="filters form-grid">
        <legend>{t("Period and category", "عرصہ اور قسم")}</legend>
        <Field label={t("From date", "ابتدائی تاریخ")}>
          <input
            data-help="wl.filters"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={t("To date", "آخری تاریخ")}>
          <input
            data-help="wl.filters"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label={t("Category filter", "قسم کا فلٹر")}>
          <select
            data-help="wl.filters"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t("All categories", "تمام اقسام")}</option>
            {wasteCategories.map((v) => (
              <option key={v} value={v}>
                {name(v)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Record limit", "اندراج کی حد")}>
          <select
            data-help="wl.limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[100, 500, 1000, 5000].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t(
            "Search loaded areas, contractors or notes",
            "موجودہ جگہ، ٹھیکیدار یا رسید تلاش کریں",
          )}
        >
          <input
            type="search"
            data-help="wl.search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </fieldset>
      <ErrorBox error={error} />
      {loading && (
        <p role="status">{t("Loading waste log…", "فضلہ رجسٹر آ رہا ہے…")}</p>
      )}
      {log && !loading && (
        <>
          <p>
            <bdi dir="ltr">
              {date(log.date_from)} – {date(log.date_to)}
            </bdi>{" "}
            ·{" "}
            {t(
              "Server period; blank dates use this month. Refresh to read changes.",
              "سرور کا عرصہ؛ خالی تاریخوں پر موجودہ مہینہ۔ تبدیلی کے لیے تازہ کریں۔",
            )}
          </p>
          <section className="panel">
            <h2>{t("Server totals by category", "سرور کے قسم وار کل")}</h2>
            <p>
              {t(
                "Local search only filters the loaded entries below; it does not change these server totals.",
                "مقامی تلاش صرف نیچے کے موجودہ اندراج چھانٹتی ہے؛ سرور کے کل نہیں بدلتے۔",
              )}
            </p>
            <div className="waste-table">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Category", "قسم"),
                      t("Collected kg", "جمع شدہ کلو"),
                      t("Bags", "تھیلے"),
                      t("Handed over kg", "حوالہ شدہ کلو"),
                      t("Waiting kg", "منتظر کلو"),
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {log.by_category.map((r) => (
                    <tr key={r.category}>
                      <th>{name(r.category)}</th>
                      <td>
                        <bdi dir="ltr">{r.weight_kg}</bdi>
                      </td>
                      <td>
                        <bdi dir="ltr">{r.bags}</bdi>
                      </td>
                      <td>
                        <bdi dir="ltr">{r.handed_over_kg}</bdi>
                      </td>
                      <td><bdi dir="ltr">{r.weight_kg-r.handed_over_kg}</bdi></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>{t("Server totals by month", "سرور کے ماہ وار کل")}</h3>
            <div className="waste-table">
              <table>
                <thead>
                  <tr>
                    <th>{t("Month", "مہینہ")}</th>
                    <th>{t("Risk kg", "خطرناک کلو")}</th>
                    <th>{t("Non-risk kg", "غیر خطرناک کلو")}</th>
                  </tr>
                </thead>
                <tbody>
                  {log.by_month.map((r) => (
                    <tr key={r.month}>
                      <th>
                        <bdi dir="ltr">{r.month.slice(0, 7)}</bdi>
                      </th>
                      <td>
                        <bdi dir="ltr">{r.risk_kg}</bdi>
                      </td>
                      <td>
                        <bdi dir="ltr">{r.non_risk_kg}</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <h2>{t("Collection entries", "جمع شدہ فضلے کے اندراج")}</h2>
          {log.records.length >= limit && (
            <p role="alert">
              {t(
                "Record limit reached. There may be more entries; narrow the dates/category or increase the limit.",
                "اندراج کی حد آ گئی۔ مزید اندراج ہو سکتے ہیں؛ تاریخ یا قسم محدود کریں یا حد بڑھائیں۔",
              )}
            </p>
          )}
          {!rows.length && (
            <p role="status">
              {t(
                "No matching entries. Check the dates, category and local search.",
                "کوئی ملتا اندراج نہیں۔ تاریخ، قسم اور مقامی تلاش چیک کریں۔",
              )}
            </p>
          )}
          <div className="waste-table">
            <table>
              <thead>
                <tr>
                  {[
                    t("Record / date", "اندراج / تاریخ"),
                    t("Category / area", "قسم / جگہ"),
                    t("Weight / bags", "وزن / تھیلے"),
                    t("Contractor / consignment", "ٹھیکیدار / رسید"),
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.waste_id}>
                    <td>
                      <button
                        data-help="wl.select"
                        className="waste-row"
                        disabled={blocked || editor}
                        onClick={() => setSelected(r)}
                      >
                        #{r.waste_id} · {date(r.recorded_on)}
                      </button>
                    </td>
                    <td>
                      {name(r.category)}
                      <br />
                      {[r.department_name, r.ward_name, r.location]
                        .filter(Boolean)
                        .join(" / ") || t("Area not recorded", "جگہ درج نہیں")}
                    </td>
                    <td>
                      <bdi dir="ltr">
                        {r.weight_kg} kg / {r.bags ?? "—"}
                      </bdi>
                    </td>
                    <td>
                      {r.vendor_name ?? t("Not recorded", "درج نہیں")}
                      <br />
                      {r.manifest_number ?? "—"}
                      <br/>{r.handed_over_on ? `${date(r.handed_over_on)} · ${r.handed_over_by_name ?? t('Not recorded','درج نہیں')}` : t('Waiting','منتظر')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {selected && (
        <section className="panel waste-detail">
          <h2>
            {t("Saved collection", "محفوظ جمع شدہ فضلہ")} #{selected.waste_id}
          </h2>
          <p>
            <bdi dir="ltr">{date(selected.recorded_on)}</bdi> ·{" "}
            {name(selected.category)} ·{" "}
            <bdi dir="ltr">{selected.weight_kg} kg</bdi> · {t("Bags", "تھیلے")}:{" "}
            {selected.bags ?? t("Not recorded", "درج نہیں")}
          </p>
          <p>
            {[selected.department_name, selected.ward_name, selected.location]
              .filter(Boolean)
              .join(" / ") || t("Area not recorded", "جگہ درج نہیں")}
          </p>
          <p>
            {t("Contractor", "ٹھیکیدار")}:{" "}
            {selected.vendor_name ?? t("Not recorded", "درج نہیں")} ·{" "}
            {t("Consignment note", "حوالگی رسید")}:{" "}
            {selected.manifest_number ?? t("Not recorded", "درج نہیں")} ·{" "}
            {t("Disposal", "تلفی")}:{" "}
            {selected.disposal
              ? name(selected.disposal)
              : t("Not recorded", "درج نہیں")}
          </p>
          <p>{selected.note ?? t("No note", "نوٹ نہیں")}</p>
          <p>{selected.handed_over_on ? `${date(selected.handed_over_on)} · ${selected.handed_over_by_name ?? t("Not recorded", "درج نہیں")}` : t("Waiting for contractor handover", "ٹھیکیدار کو حوالگی کا انتظار")}</p>
          <p>
            {t("Recorded by", "درج کرنے والا")}: {selected.recorded_by_name} ·{" "}
            <bdi dir="ltr">{selected.recorded_at}</bdi>
          </p>
          <p>
            {t(
              "Collections never change; a consignment note is final. Select waiting collections at pickup and attach one note without entering their weight again. Ask Operations about a recording mistake.",
              "جمع شدہ اندراج نہیں بدلتا اور حوالگی رسید حتمی ہے۔ وصولی پر منتظر اندراج چن کر ایک رسید منسلک کریں؛ وزن دوبارہ نہ لکھیں۔ اندراج کی غلطی پر آپریشنز سے پوچھیں۔",
            )}
          </p>
        </section>
      )}
    </section>
  );
}
