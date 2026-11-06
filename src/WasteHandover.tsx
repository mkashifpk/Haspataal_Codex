import { useCallback, useEffect, useState, useRef } from "react";
import * as api from "./generated/waste_log_ops";
import type { ClinicalUser } from "./clinical-context";
import { useClinicalWrite, ClinicalWriteFeedback } from "./clinical-write";
import { ErrorBox, Field } from "./components";
import { ApiError } from "./bridge";
import { bilingual as t } from "./i18n";

export function WasteHandover({
  user,
  connected,
  onSaved,
  onPending,
  onActive,
}: {
  user: ClinicalUser;
  connected: boolean;
  onSaved: () => Promise<void>;
  onPending: (v: boolean) => void;
  onActive: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<api.WasteRecordOut[]>([]),
    [vendors, setVendors] = useState<api.VendorOut[]>([]),
    [ids, setIds] = useState<number[]>([]),
    [vendor, setVendor] = useState(""),
    [manifest, setManifest] = useState(""),
    [disposal, setDisposal] = useState<api.WasteHandoverIn["disposal"] | "">(
      "",
    ),
    [day, setDay] = useState(""),
    [error, setError] = useState<unknown>(),
    [loading, setLoading] = useState(false),
    [conflict, setConflict] = useState("");
  const [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [last, setLast] = useState<api.WasteHandoverOut>();
  const generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      if (dateFrom && dateTo && dateFrom > dateTo)
        throw Error(
          t(
            "Collection start cannot follow end.",
            "جمع کرنے کی ابتدا آخر کے بعد نہیں ہو سکتی۔",
          ),
        );
      const [log, v] = await Promise.all([
        api.listWaste({
          awaiting_handover: true,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 5000,
        }),
        api.vendors({ vendor_type: "Contractor" }),
      ]);
      if (n !== generation.current) return;
      const active = v.filter((r) => r.is_active);
      setRows(log.records);
      setVendors(active);
      setVendor((old) =>
        active.some((v) => String(v.vendor_id) === old) ? old : "",
      );
      setIds((old) =>
        old.filter((id) => log.records.some((r) => r.waste_id === id)),
      );
    } catch (e) {
      if (n === generation.current) {
        setError(e);
        setRows([]);
        setVendors([]);
        setIds([]);
        setVendor("");
      }
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [dateFrom, dateTo]);
  const write = useClinicalWrite(
    user,
    "waste_log_ops:handover",
    async (value: api.WasteHandoverOut) => {
      setLast(value);
      setIds([]);
      setManifest("");
      setDay("");
      setVendor("");
      setDisposal("");
      setOpen(false);
      await onSaved();
    },
  );
  useEffect(() => {
    if (open) void load();
    return () => {
      generation.current++;
    };
  }, [open, load]);
  useEffect(() => {
    if (!(write.error instanceof ApiError)) return;
    const refusal = write.error.response.error;
    if (refusal?.code === "WASTE_HANDED_OVER") {
      const d = refusal.details;
      setConflict(
        t(
          `Collection ${d?.waste_id} already has final note ${d?.manifest_number} dated ${d?.handed_over_on}. The write will not be retried.`,
          `جمع شدہ فضلے ${d?.waste_id} کی حتمی رسید ${d?.manifest_number} تاریخ ${d?.handed_over_on} موجود ہے۔ دوبارہ ارسال نہیں ہوگا۔`,
        ),
      );
      void load();
      void onSaved();
    } else if (
      refusal?.code === "REFERENCE_NOT_FOUND" &&
      refusal.details?.field === "waste_ids"
    )
      void load();
  }, [write.error, load, onSaved]);
  const blocked = write.blocked;
  useEffect(() => onPending(blocked), [blocked, onPending]);
  useEffect(() => onActive(open), [open, onActive]);
  return (
    <section
      data-write-pending={blocked}
      data-unsaved={open && (ids.length > 0 || !!manifest)}
    >
      <button
        data-help="wl.handover"
        disabled={blocked || !connected}
        onClick={() => {
          if (open) {
            setIds([]);
            setManifest("");
            setDay("");
          }
          setOpen((v) => !v);
          setConflict("");
        }}
      >
        {open
          ? t("Cancel unsent handover", "غیر ارسال حوالگی منسوخ")
          : t("Hand over waiting collections", "منتظر جمع شدہ فضلہ حوالے کریں")}
      </button>
      {conflict && <p role="alert">{conflict}</p>}
      <ClinicalWriteFeedback write={write} />
      {last && (
        <article className="panel">
          <h2>{t("Confirmed consignment note", "تصدیق شدہ حوالگی رسید")}</h2>
          <p>
            {last.vendor_name} · {last.manifest_number} · {last.handed_over_on}{" "}
            · {last.weight_kg} kg
          </p>
          {last.records.map((r) => (
            <p key={r.waste_id}>
              {r.recorded_on} · {r.category} · {r.weight_kg} kg ·{" "}
              {r.handed_over_on} · {r.handed_over_by_name} · {r.manifest_number}
            </p>
          ))}
        </article>
      )}
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConflict("");
            if (
              error ||
              loading ||
              !disposal ||
              !ids.length ||
              ids.length > 500 ||
              !vendors.some((v) => String(v.vendor_id) === vendor) ||
              !manifest.trim() ||
              !ids.every((id) => rows.some((r) => r.waste_id === id))
            )
              return;
            const dates = rows
              .filter((r) => ids.includes(r.waste_id))
              .map((r) => r.recorded_on)
              .sort();
            const reconcile = new URLSearchParams({
              date_from: dates[0]!,
              date_to: dates.at(-1)!,
              limit: "5000",
            });
            write.start({
              method: "POST",
              path: "/infection/waste/handover",
              permission: "infection.waste.record",
              protection: "idempotent",
              label: t(
                "Hand over selected collections",
                "منتخب فضلہ حوالے کریں",
              ),
              body: {
                waste_ids: ids,
                vendor_id: Number(vendor),
                manifest_number: manifest.trim(),
                disposal,
                handed_over_on: day || null,
              },
              reconcilePath: "/infection/waste?" + reconcile,
            });
          }}
        >
          <h2>
            {t("One consignment note at pickup", "وصولی پر ایک حوالگی رسید")}
          </h2>
          <p>
            {t(
              "Select the whole collections covered by this note. Their weights are already recorded; never enter them again. The note becomes final.",
              "رسید میں شامل مکمل اندراج چنیں۔ ان کا وزن پہلے درج ہے؛ دوبارہ نہ لکھیں۔ رسید حتمی ہو جاتی ہے۔",
            )}
          </p>
          <ErrorBox error={error} />
          <fieldset disabled={blocked || !connected || loading}>
            <Field
              label={t(
                "Collection date from (optional)",
                "جمع کرنے کی ابتدا (اختیاری)",
              )}
            >
              <input
                data-help="wl.filters"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setIds([]);
                  setDateFrom(e.target.value);
                }}
              />
            </Field>
            <Field
              label={t(
                "Collection date to (optional)",
                "جمع کرنے کی انتہا (اختیاری)",
              )}
            >
              <input
                data-help="wl.filters"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setIds([]);
                  setDateTo(e.target.value);
                }}
              />
            </Field>
            <button
              type="button"
              data-help="wl.refresh"
              onClick={() => void load()}
            >
              {t("Refresh waiting collections", "منتظر فہرست تازہ کریں")}
            </button>
            {rows.length === 5000 && (
              <p role="alert">
                {t(
                  "Showing at most5000waiting collections. Narrow collection dates if this note needs older records.",
                  "زیادہ سے زیادہ پانچ ہزار منتظر اندراج دکھتے ہیں۔ پرانے اندراج کے لیے جمع کرنے کی تاریخ محدود کریں۔",
                )}
              </p>
            )}
            {!loading && !error && !rows.length && (
              <p>
                {t(
                  "No collections are waiting.",
                  "کوئی جمع شدہ فضلہ منتظر نہیں۔",
                )}
              </p>
            )}
            <p>
              {t(
                "One request covers at most500whole collections.",
                "ایک درخواست میں زیادہ سے زیادہ پانچ سو مکمل اندراج شامل ہیں۔",
              )}
            </p>
            {rows.map((r) => (
              <label key={r.waste_id}>
                <input
                  type="checkbox"
                  data-help="wl.handover"
                  disabled={!ids.includes(r.waste_id) && ids.length >= 500}
                  checked={ids.includes(r.waste_id)}
                  onChange={(e) =>
                    setIds((old) =>
                      e.target.checked && old.length < 500
                        ? [...old, r.waste_id]
                        : old.filter((id) => id !== r.waste_id),
                    )
                  }
                />
                {r.recorded_on} · {r.category} ·{" "}
                {[r.ward_name, r.department_name, r.location]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                · {r.weight_kg} kg
              </label>
            ))}
            <Field label={t("Contractor", "ٹھیکیدار")}>
              <select
                data-help="wl.vendor"
                required
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              >
                <option value="">{t("Choose by name", "نام سے چنیں")}</option>
                {vendors.map((v) => (
                  <option key={v.vendor_id} value={v.vendor_id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            {!loading && !error && !vendors.length && (
              <p>
                {t(
                  "Finance adds the missing contractor.",
                  "غائب ٹھیکیدار مالیات درج کرتا ہے۔",
                )}
              </p>
            )}
            <Field label={t("Consignment note", "حوالگی رسید")}>
              <input
                data-help="wl.manifest"
                required
                maxLength={100}
                value={manifest}
                onChange={(e) => setManifest(e.target.value)}
              />
            </Field>
            <Field label={t("Disposal", "تلفی")}>
              <select
                required
                data-help="wl.disposal"
                value={disposal}
                onChange={(e) => setDisposal(e.target.value as typeof disposal)}
              >
                <option value="">
                  {t("Choose actual disposal", "اصل تلفی چنیں")}
                </option>
                {[
                  "Incineration",
                  "Autoclave",
                  "Encapsulation",
                  "Landfill",
                  "Recycling",
                  "Other",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field
              label={t(
                "Handover date (blank means today)",
                "حوالگی کی تاریخ (خالی یعنی آج)",
              )}
            >
              <input
                name="handed_over_on"
                data-help="wl.date"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              {write.error instanceof ApiError &&
                write.error.response.error?.code === "VALIDATION_ERROR" && (
                  <small role="alert">{write.error.message}</small>
                )}
            </Field>
            <p>
              {t("Selected weight", "منتخب وزن")}:{" "}
              {rows
                .filter((r) => ids.includes(r.waste_id))
                .reduce((n, r) => n + r.weight_kg, 0)}{" "}
              kg
            </p>
            <button
              data-help="wl.save"
              disabled={
                !!error ||
                !disposal ||
                !ids.length ||
                ids.length > 500 ||
                !vendor ||
                !manifest.trim()
              }
            >
              {t("Confirm handover", "حوالگی کی تصدیق")}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
