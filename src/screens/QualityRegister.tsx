import { type FormEvent, type ReactNode } from "react";
import { Field } from "../components";
import { hospitalTimeInput, hospitalTimeZoneError } from "../hospital-time";
import { bilingual as t } from "../i18n";

export type DateRange = { date_from: string; date_to: string };
export function currentMonth(timeZone?: string): DateRange {
  if (hospitalTimeZoneError(timeZone)) return { date_from: "", date_to: "" };
  const today = hospitalTimeInput(Date.now(), timeZone!).slice(0, 10);
  return { date_from: `${today.slice(0, 7)}-01`, date_to: today };
}
export function QualityHeading({
  title,
  text,
  onHelp,
}: {
  title: string;
  text: string;
  onHelp: () => void;
}) {
  return (
    <header className="screen-heading">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <button data-help="p9.help" onClick={onHelp}>
        {t("Help", "مدد")}
      </button>
    </header>
  );
}
export function QualityPeriod({
  range,
  apply,
  disabled,
  children,
  maxDays,
}: {
  range: DateRange;
  apply: (range: DateRange) => void;
  disabled?: boolean;
  children?: ReactNode;
  maxDays?: number;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const date_from = String(values.get("date_from")),
      date_to = String(values.get("date_to"));
    const days = (Date.parse(date_to) - Date.parse(date_from)) / 86400000 + 1;
    const end = e.currentTarget.elements.namedItem(
      "date_to",
    ) as HTMLInputElement;
    end.setCustomValidity(
      days < 1
        ? t(
            "To must be on or after From.",
            "آخری تاریخ شروع کے بعد یا برابر ہو۔",
          )
        : maxDays && days > maxDays
          ? t(
              `Choose a period of ${maxDays} days or fewer.`,
              `مدت ${maxDays} دن یا کم ہو۔`,
            )
          : "",
    );
    if (end.reportValidity()) apply({ date_from, date_to });
  }
  return (
    <form
      className="card"
      onSubmit={submit}
      onChange={(e) =>
        (
          e.currentTarget.elements.namedItem("date_to") as HTMLInputElement
        ).setCustomValidity("")
      }
    >
      <fieldset disabled={disabled} className="toolbar">
        <Field label={t("From", "سے")}>
          <input
            data-help="p9.period"
            name="date_from"
            type="date"
            defaultValue={range.date_from}
            required
          />
        </Field>
        <Field label={t("To", "تک")}>
          <input
            data-help="p9.period"
            name="date_to"
            type="date"
            defaultValue={range.date_to}
            required
          />
        </Field>
        {children}
        <button type="submit" data-help="p9.period">
          {t("Read period", "مدت پڑھیں")}
        </button>
      </fieldset>
    </form>
  );
}
export function QualityTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: { key: string | number; cells: ReactNode[] }[];
  empty: string;
}) {
  if (!rows.length) return <p role="status">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, cells }) => (
            <tr key={key}>
              {cells.map((cell, i) => (
                <td key={i}>{cell ?? t("Not recorded", "درج نہیں")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function QualityPager({
  cursor,
  next,
  onPage,
  disabled,
}: {
  cursor?: number;
  next?: number;
  onPage: (cursor?: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="toolbar">
      {cursor !== undefined && (
        <button
          data-help="p9.page"
          disabled={disabled}
          onClick={() => onPage(undefined)}
        >
          {t("Newest records", "تازہ ریکارڈ")}
        </button>
      )}
      {next !== undefined && (
        <button
          data-help="p9.page"
          disabled={disabled}
          onClick={() => onPage(next)}
        >
          {t("Older records", "پرانے ریکارڈ")}
        </button>
      )}
    </div>
  );
}
