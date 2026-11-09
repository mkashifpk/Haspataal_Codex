import { useEffect, useState, type FormEvent } from "react";
import * as education from "../generated/education_materials";
import { useLoad, LoadState, Field, ErrorBox } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { ApiError } from "../bridge";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import {
  currentMonth,
  QualityHeading,
  QualityPeriod,
  QualityTable,
  QualityPager,
  type DateRange,
} from "./QualityRegister";

const kinds = {
  Poster: "پوسٹر",
  Leaflet: "پرچہ",
  Booklet: "کتابچہ",
  Video: "ویڈیو",
  Other: "دیگر",
} as const;
const languages = {
  Urdu: "اردو",
  English: "انگریزی",
  Punjabi: "پنجابی",
  Other: "دیگر",
} as const;
const size = 100;
const id = "education_materials";
export function EducationMaterials({
  user,
  connected,
  readOnly,
  noNewWork,
  timeZone,
  revision,
  onOpenHelp,
}: {
  user: ClinicalUser;
  connected: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  timeZone?: string;
  revision: number;
  onOpenHelp: () => void;
}) {
  const [includeRetired, setIncludeRetired] = useState(false);
  const [editor, setEditor] = useState<education.MaterialOut | "new">();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<unknown>();
  const [range, setRange] = useState<DateRange>();
  const [cursor, setCursor] = useState<number>();
  const [version, setVersion] = useState(0);
  const selected = range ?? currentMonth(timeZone);
  const manage = user.permissions.includes("education.manage");
  const readRegister = manage || user.permissions.includes("msds.view");
  const readMaterials =
    readRegister || user.permissions.includes("education.give");
  const materials = useLoad(
    () =>
      readMaterials
        ? education.listMaterials({ include_inactive: includeRetired })
        : Promise.resolve([]),
    [readMaterials, includeRetired, version, revision],
  );
  const register = useLoad(
    () =>
      readRegister && selected.date_to
        ? education.registerEducation({
            ...selected,
            limit: size,
            before_id: cursor,
          })
        : Promise.resolve([]),
    [readRegister, selected.date_from, selected.date_to, cursor, revision],
  );
  const write = useClinicalWrite(user, id, async () => {
    setEditor(undefined);
    setVersion((v) => v + 1);
  });
  const conflict =
    write.error instanceof ApiError &&
    write.error.response.error?.code === "VERSION_CONFLICT";
  useEffect(() => {
    if (conflict) {
      setConfirmed(false);
      void materials.reload();
    }
  }, [conflict]);
  const permitted =
    manage && connected && !readOnly && !noNewWork && !write.blocked;
  const ready = permitted && !materials.loading && !materials.error;
  const existing = editor === "new" ? undefined : editor;
  const stale =
    existing &&
    materials.data?.find((item) => item.material_id === existing.material_id)
      ?.row_version !== existing.row_version;
  function start(row: education.MaterialOut | "new") {
    setEditor(row);
    setConfirmed(false);
    setError(undefined);
    write.clearError();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !ready || !confirmed || stale || conflict) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title")).trim(),
      topic = String(form.get("topic")).trim();
    if (title.length < 3 || topic.length < 3) {
      setError(
        Error(
          t(
            "Title and topic each need at least three characters.",
            "عنوان اور موضوع میں کم از کم تین حرف ہوں۔",
          ),
        ),
      );
      return;
    }
    const body: education.MaterialIn = {
      title,
      topic,
      kind: form.get("kind") as education.MaterialIn["kind"],
      language: form.get("language") as education.MaterialIn["language"],
      displayed_at: String(form.get("displayed_at") ?? "").trim() || null,
    };
    setError(undefined);
    write.start({
      method: existing ? "PATCH" : "POST",
      path: existing
        ? `/education/materials/${existing.material_id}`
        : "/education/materials",
      body: existing
        ? {
            ...body,
            is_active: form.get("active") === "on",
            expected_version: existing.row_version,
          }
        : body,
      permission: "education.manage",
      protection: existing ? "reconcile" : "idempotent",
      reconcilePath: "/education/materials?include_inactive=true",
      label: existing
        ? t("Update material", "مواد بدلیں")
        : t("Add material", "مواد شامل کریں"),
    });
  }
  const rows = !register.loading && !register.error ? register.data : undefined;
  return (
    <section
      data-screen={id}
      data-unsaved={!!editor}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t(
          "Health education: materials and register",
          "صحت کی تعلیم: مواد اور رجسٹر",
        )}
        text={t(
          "Keep track of the materials offered and the guidance staff actually gave.",
          "پیش کیے گئے مواد اور عملے کی اصل رہنمائی کا ریکارڈ رکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      {readMaterials && (
        <article className="card">
          <h2>{t("Education materials", "تعلیمی مواد")}</h2>
          <div className="toolbar">
            <label className="check">
              <input
                data-help="ed.list"
                type="checkbox"
                checked={includeRetired}
                disabled={!!editor || write.blocked}
                onChange={(e) => setIncludeRetired(e.target.checked)}
              />
              {t("Include retired materials", "سبک دوش مواد بھی")}
            </label>
            {ready && !editor && (
              <button data-help="ed.edit" onClick={() => start("new")}>
                {t("Add material", "مواد شامل کریں")}
              </button>
            )}
          </div>
          <LoadState {...materials} retry={() => void materials.reload()} />
          {!materials.loading && !materials.error && (
            <QualityTable
              columns={[
                t("Title", "عنوان"),
                t("Topic", "موضوع"),
                t("Kind and language", "قسم و زبان"),
                t("Displayed or kept at", "جگہ"),
                t("Status", "حالت"),
              ]}
              empty={t(
                "No materials match this view.",
                "اس منظر میں مواد نہیں۔",
              )}
              rows={(materials.data ?? []).map((row) => ({
                key: row.material_id,
                cells: [
                  row.title,
                  row.topic,
                  `${t(row.kind, kinds[row.kind])} · ${t(row.language, languages[row.language])}`,
                  row.displayed_at,
                  <>
                    {row.is_active
                      ? t("Active", "فعال")
                      : t("Retired", "سبک دوش")}{" "}
                    {ready && !editor && (
                      <button data-help="ed.edit" onClick={() => start(row)}>
                        {t("Change material", "مواد بدلیں")}
                      </button>
                    )}
                  </>,
                ],
              }))}
            />
          )}
          <ClinicalWriteFeedback
            write={write}
            onReviewed={() => {
              setEditor(undefined);
              setVersion((v) => v + 1);
            }}
          />
          {editor && (
            <form onSubmit={submit} onChange={() => setConfirmed(false)}>
              <h3>
                {existing
                  ? t("Change material", "مواد بدلیں")
                  : t("Add material", "مواد شامل کریں")}
              </h3>
              <ErrorBox error={error} />
              {stale && (
                <p role="alert">
                  {t(
                    "This material changed. Compare the current row, cancel this draft and open it again.",
                    "مواد بدل گیا۔ موجودہ صف دیکھیں، مسودہ منسوخ کر کے دوبارہ کھولیں۔",
                  )}
                </p>
              )}
              <fieldset disabled={!ready || !!stale || conflict}>
                <Field label={t("Title", "عنوان")}>
                  <input
                    data-help="ed.fields"
                    name="title"
                    required
                    minLength={3}
                    maxLength={200}
                    defaultValue={existing?.title}
                  />
                </Field>
                <Field label={t("Topic", "موضوع")}>
                  <input
                    data-help="ed.fields"
                    name="topic"
                    required
                    minLength={3}
                    maxLength={200}
                    defaultValue={existing?.topic}
                  />
                </Field>
                <Field label={t("Kind", "قسم")}>
                  <select
                    data-help="ed.fields"
                    name="kind"
                    defaultValue={existing?.kind}
                  >
                    {Object.entries(kinds).map(([key, ur]) => (
                      <option key={key} value={key}>
                        {t(key, ur)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Language", "زبان")}>
                  <select
                    data-help="ed.fields"
                    name="language"
                    defaultValue={existing?.language}
                  >
                    {Object.entries(languages).map(([key, ur]) => (
                      <option key={key} value={key}>
                        {t(key, ur)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={t("Displayed or kept at", "نمائش یا رکھنے کی جگہ")}
                >
                  <input
                    data-help="ed.fields"
                    name="displayed_at"
                    maxLength={200}
                    defaultValue={existing?.displayed_at ?? ""}
                  />
                </Field>
                {existing && (
                  <label className="check">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={existing.is_active}
                      data-help="ed.active"
                    />
                    {t(
                      "Active for future education",
                      "آئندہ رہنمائی کے لیے فعال",
                    )}
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    data-help="ed.save"
                    checked={confirmed}
                    onChange={(e) => {
                      e.stopPropagation();
                      setConfirmed(e.target.checked);
                    }}
                  />
                  {t(
                    "I checked these changes. Past education records are kept.",
                    "تبدیلیاں دیکھ لیں۔ پرانے تعلیمی ریکارڈ محفوظ رہیں گے۔",
                  )}
                </label>
                <button data-help="ed.save" type="submit" disabled={!confirmed}>
                  {t("Save material", "مواد محفوظ کریں")}
                </button>
              </fieldset>
              <button
                type="button"
                data-help="ed.cancel"
                disabled={write.blocked}
                onClick={() => {
                  setEditor(undefined);
                  write.clearError();
                }}
              >
                {t("Cancel unsent changes", "غیر ارسال تبدیلی منسوخ")}
              </button>
            </form>
          )}
        </article>
      )}
      {readRegister && selected.date_to && (
        <article className="card">
          <h2>{t("Education given", "دی گئی رہنمائی")}</h2>
          <p>
            {t(
              "Reading this register is logged as access to each patient’s record.",
              "رجسٹر پڑھنا ہر مریض کے ریکارڈ میں درج ہے۔",
            )}
          </p>
          <QualityPeriod
            range={selected}
            apply={(next) => {
              setRange(next);
              setCursor(undefined);
            }}
            disabled={write.blocked}
          />
          <LoadState {...register} retry={() => void register.reload()} />
          {rows && (
            <>
              <QualityTable
                columns={[
                  t("Date", "تاریخ"),
                  t("Patient", "مریض"),
                  t("Topic", "موضوع"),
                  t("Method", "طریقہ"),
                  t("Material", "مواد"),
                  t("Given by", "دینے والا"),
                ]}
                empty={t(
                  "No education recorded for this period.",
                  "اس مدت میں رہنمائی درج نہیں۔",
                )}
                rows={rows.map((row) => ({
                  key: row.education_id,
                  cells: [
                    formatHospitalTime(row.given_at, timeZone!),
                    `${row.patient_name} · ${row.mrn}`,
                    row.topic,
                    t(
                      row.method,
                      {
                        Verbal: "زبانی",
                        Leaflet: "پرچہ",
                        WrittenInstructions: "تحریری ہدایات",
                        Demonstration: "عملی نمائش",
                        Video: "ویڈیو",
                      }[row.method],
                    ),
                    row.material_title,
                    row.given_by_stamp.text,
                  ],
                }))}
              />
              <QualityPager
                cursor={cursor}
                next={
                  rows.length === size ? rows.at(-1)?.education_id : undefined
                }
                onPage={setCursor}
              />
            </>
          )}
        </article>
      )}
    </section>
  );
}
