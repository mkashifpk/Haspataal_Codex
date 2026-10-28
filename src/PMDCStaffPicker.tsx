import { useRef, useState } from "react";
import {
  lookupStaff,
  type StaffLookupOut,
} from "./generated/radiology_worklist";
import { Field, ErrorBox } from "./components";
import { bilingual as t } from "./i18n";
// Same PMDC-only lookup contract as contrast-doctor selection; IDs are employee IDs.
export function PMDCStaffPicker({
  value,
  onSelect,
  disabled = false,
}: {
  value?: StaffLookupOut;
  onSelect: (row?: StaffLookupOut) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState(""),
    [rows, setRows] = useState<StaffLookupOut[]>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    generation = useRef(0);
  async function search() {
    const n = ++generation.current;
    setBusy(true);
    setError(undefined);
    setRows(undefined);
    onSelect(undefined);
    try {
      const r = await lookupStaff({
        q: q.trim(),
        license_type: "PMDC",
        limit: 20,
      });
      if (n === generation.current) setRows(r);
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  return (
    <section>
      <Field
        label={t(
          "Find the second registered doctor",
          "دوسرے رجسٹرڈ ڈاکٹر کی تلاش",
        )}
      >
        <input
          data-help="consents.doctor"
          value={q}
          maxLength={80}
          disabled={disabled}
          onChange={(e) => {
            generation.current++;
            setQ(e.target.value);
            setRows(undefined);
            onSelect(undefined);
            setBusy(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (q.trim().length >= 2 && !disabled && !busy) void search();
            }
          }}
        />
      </Field>
      <button
        type="button"
        data-help="consents.doctor"
        disabled={disabled || busy || q.trim().length < 2}
        onClick={() => void search()}
      >
        {t("Search PMDC doctors", "پی ایم ڈی سی ڈاکٹر تلاش")}
      </button>
      <ErrorBox error={error} />
      {rows && (
        <Field
          label={t("Second doctor who concurs", "اتفاق کرنے والا دوسرا ڈاکٹر")}
        >
          <select
            data-help="consents.doctor"
            value={value?.employee_id || ""}
            disabled={disabled}
            onChange={(e) =>
              onSelect(
                rows.find((r) => r.employee_id === Number(e.target.value)),
              )
            }
          >
            <option value="">
              {t("Choose the actual doctor", "اصل ڈاکٹر منتخب کریں")}
            </option>
            {rows.map((r) => (
              <option key={r.employee_id} value={r.employee_id}>
                {r.full_name} · {r.registration}
              </option>
            ))}
          </select>
        </Field>
      )}
      {rows && !rows.length && (
        <p>
          {t("No registered doctors match.", "کوئی رجسٹرڈ ڈاکٹر نہیں ملا۔")}
        </p>
      )}
      {value && (
        <p>
          {value.full_name} · {value.registration}
        </p>
      )}
    </section>
  );
}
