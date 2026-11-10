import type { ReactNode } from "react";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityTable } from "./QualityRegister";

export type P9cProps = {
  user: ClinicalUser;
  connected: boolean;
  revision: number;
  timeZone?: string;
  view?: string;
  onOpenHelp: () => void;
};
export function permission(user: ClinicalUser, ...names: string[]) {
  return names.find((name) => user.permissions.includes(name));
}
export const formText = (f: FormData, name: string) =>
  String(f.get(name) ?? "").trim();
export const monthBefore = (timeZone?: string) => {
  const { date_from } = currentMonth(timeZone);
  if (!date_from) return { date_from: "", date_to: "" };
  const last = new Date(Date.parse(date_from) - 86400000)
    .toISOString()
    .slice(0, 10);
  return { date_from: last.slice(0, 7) + "-01", date_to: last };
};
export function ReportTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: { key: string | number; cells: ReactNode[] }[];
}) {
  return (
    <article className="card">
      <h2>{title}</h2>
      <QualityTable
        columns={columns}
        rows={rows}
        empty={t(
          "No entries match this selection.",
          "اس انتخاب کے لیے کوئی اندراج نہیں۔",
        )}
      />
    </article>
  );
}
export function ServiceNotice({ view }: { view?: string }) {
  return view === "open_work" ? (
    <p className="notice">
      {t(
        "No new work for the retiring service. Existing work remains available.",
        "بند ہوتی سروس کے لیے نیا کام نہیں۔ جاری کام دستیاب ہے۔",
      )}
    </p>
  ) : view === "records" ? (
    <p className="notice">
      {t("Records and history only.", "صرف ریکارڈ اور تاریخ۔")}
    </p>
  ) : null;
}
export function ConfirmEntry() {
  return (
    <label>
      <input type="checkbox" required data-help="p9c.write" />{" "}
      {t(
        "I checked this entry and confirm submission.",
        "میں نے اندراج چیک کیا اور ارسال کی تصدیق کرتا ہوں۔",
      )}
    </label>
  );
}
export const percent = (x: number | null | undefined) =>
  x == null ? "—" : x + "%";
