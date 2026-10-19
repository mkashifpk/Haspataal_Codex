import { useRef, useState } from "react";
import { lookupStaff, type StaffLookupOut } from "./generated/registration";
import { ErrorBox, Field } from "./components";
import { tr } from "./i18n";

export function StaffPicker({
  label,
  value,
  onSelect,
  required = false,
  invalid = false,
}: {
  label: string;
  value?: number | null;
  onSelect: (id: number | null) => void;
  required?: boolean;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StaffLookupOut[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const generation = useRef(0);
  async function search() {
    const n = ++generation.current;
    setBusy(true);
    setError(undefined);
    setRows(undefined);
    onSelect(null);
    try {
      const result = await lookupStaff({ q: query.trim(), limit: 20 });
      if (n === generation.current) setRows(result);
    } catch (cause) {
      if (n === generation.current) setError(cause);
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  return (
    <div className="lookup staff-picker">
      <Field
        label={label}
        hint={tr("Search active staff by name or employee number.")}
      >
        <input
          data-help="incident.staff"
          aria-label={label}
          aria-invalid={invalid}
          maxLength={80}
          value={query}
          onChange={(e) => {
            ++generation.current;
            setQuery(e.target.value);
            setRows(undefined);
            setError(undefined);
            setBusy(false);
            onSelect(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (query.trim().length >= 2 && !busy) void search();
            }
          }}
        />
      </Field>
      <button
        data-help="incident.staff"
        type="button"
        disabled={busy || query.trim().length < 2}
        onClick={() => void search()}
      >
        {busy ? tr("Searching…") : tr("Find staff member")}
      </button>
      <ErrorBox error={error} />
      {rows && (
        <>
          <Field label={tr("Select staff member")}>
            <select
              data-help="incident.staff"
              aria-label={tr("Select staff member")}
              aria-invalid={invalid}
              required={required}
              value={value || ""}
              onChange={(e) => onSelect(Number(e.target.value) || null)}
            >
              <option value="">
                {required ? tr("Select a staff member") : tr("No staff link")}
              </option>
              {rows.map((row) => (
                <option key={row.employee_id} value={row.employee_id}>
                  {row.emp_number} · {row.full_name} · {row.designation}
                  {row.department_name ? ` · ${row.department_name}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {rows.length === 0 && (
            <p role="status">{tr("No active staff match this search.")}</p>
          )}
        </>
      )}
    </div>
  );
}
