import { useEffect, useState, type FormEvent } from "react";
import * as api from "../generated/preventive_programmes_setup";
import { Field, ErrorBox, LoadState, useLoad } from "../components";
import { ApiError } from "../bridge";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
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
import { QualityPaper } from "./QualityPaper";

const id = "preventive_programmes_setup";
const kinds = {
  Immunization: "حفاظتی ٹیکے",
  FamilyPlanning: "خاندانی منصوبہ بندی",
  Tuberculosis: "تپ دق",
  Malaria: "ملیریا",
  Dengue: "ڈینگی",
  Other: "دیگر",
} as const;
export function PreventiveProgrammes({
  user,
  connected,
  revision,
  timeZone,
  onOpenHelp,
  view,
  fromSetup,
  openFacility,
}: {
  user: ClinicalUser;
  connected: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  revision: number;
  timeZone?: string;
  onOpenHelp: () => void;
  view?: string;
  fromSetup: boolean;
  openFacility: () => void;
}) {
  const [all, setAll] = useState(false),
    [editor, setEditor] = useState<api.ProgrammeOut | "new">(),
    [checked, setChecked] = useState(false),
    [error, setError] = useState<unknown>(),
    [selected, setSelected] = useState<api.ProgrammeOut>(),
    [range, setRange] = useState<DateRange>(),
    [cursor, setCursor] = useState<number>();
  const period = range ?? currentMonth(timeZone);
  const manage = user.permissions.includes("programme.manage"),
    readReports = manage || user.permissions.includes("msds.view");
  const viewable =
    view === "full" ||
    view === "open_work" ||
    view === "records" ||
    (view === "setup" && fromSetup);
  const canRead =
    viewable && (readReports || user.permissions.includes("programme.view"));
  const facility = useLoad(
    () => (canRead ? api.getEstablishment() : Promise.resolve(undefined)),
    [canRead, revision],
  );
  const programmes = useLoad(
    () =>
      canRead
        ? api.listProgrammes({ include_inactive: all })
        : Promise.resolve([]),
    [canRead, all, revision],
  );
  const register = useLoad(
    () =>
      canRead && readReports && selected && period.date_to
        ? api.registerPreventiveProgrammes(selected.programme_id, {
            ...period,
            before_id: cursor,
            limit: 100,
          })
        : Promise.resolve([]),
    [
      canRead,
      readReports,
      selected?.programme_id,
      period.date_from,
      period.date_to,
      cursor,
      revision,
    ],
  );
  const write = useClinicalWrite(user, id, async () => {
    setEditor(undefined);
    await programmes.reload();
    await facility.reload();
  });
  const conflict =
    write.error instanceof ApiError &&
    write.error.response.error?.code === "VERSION_CONFLICT";
  useEffect(() => {
    if (conflict) {
      setChecked(false);
      void programmes.reload();
    }
  }, [conflict]);
  if (!canRead) return null;
  const capability =
    !facility.loading && !facility.error
      ? facility.data?.capabilities.find(
          (c) => c.capability === "preventive_programmes",
        )
      : undefined;
  const ready =
    manage &&
    connected &&
    !write.blocked &&
    !programmes.loading &&
    !programmes.error &&
    !!capability &&
    (view === "full" || (view === "setup" && fromSetup));
  const existing = editor === "new" ? undefined : editor;
  const stale =
    existing &&
    programmes.data?.find((p) => p.programme_id === existing.programme_id)
      ?.row_version !== existing.row_version;
  function edit(value: api.ProgrammeOut | "new") {
    setEditor(value);
    setChecked(false);
    setError(undefined);
    write.clearError();
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || !editor || !checked || stale || conflict) return;
    const f = new FormData(e.currentTarget),
      str = (name: string) => String(f.get(name) ?? "").trim();
    const services = str("services")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      !str("name") ||
      !str("guideline") ||
      !services.length ||
      new Set(services).size !== services.length
    ) {
      setError(
        Error(
          t(
            "Provide a name, guideline title and edition, and distinct services, one per line.",
            "نام، رہنما عنوان و ایڈیشن اور الگ خدمات ایک فی سطر لکھیں۔",
          ),
        ),
      );
      return;
    }
    const fields = {
      name: str("name"),
      guideline: str("guideline"),
      national_programme: str("national_programme") || null,
      services,
    };
    const body = existing
      ? {
          ...fields,
          is_offered: f.get("is_offered") === "on",
          expected_version: existing.row_version,
        }
      : { ...fields, kind: str("kind") as api.ProgrammeIn["kind"] };
    setError(undefined);
    write.start({
      method: existing ? "PATCH" : "POST",
      path: existing
        ? `/preventive-programmes/${existing.programme_id}`
        : "/preventive-programmes",
      permission: "programme.manage",
      body,
      protection: existing ? "reconcile" : "idempotent",
      reconcilePath: "/preventive-programmes?include_inactive=true",
      label: t("Save programme", "پروگرام محفوظ"),
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
        title={t("Preventive programmes offered", "پیش کردہ احتیاطی پروگرام")}
        text={t(
          "Haspataal records what your programme’s card says. It does not check the national schedule.",
          "حسپتال آپ کے پروگرام کارڈ کی بات درج کرتا ہے۔ قومی شیڈول چیک نہیں کرتا۔",
        )}
        onHelp={onOpenHelp}
      />
      <LoadState {...facility} retry={() => void facility.reload()} />
      {view === "open_work" && (
        <p className="notice">
          {t(
            "No new enrolments from now on. Open enrolments continue.",
            "اب نیا اندراج نہیں۔ کھلے اندراج جاری ہیں۔",
          )}
        </p>
      )}
      {capability && (
        <article className="card">
          <h2>
            {t("Service readiness and open work", "خدمت تیاری اور کھلا کام")}
          </h2>
          <p>
            {t(
              "Activation requires an offered programme and a staff member who may give it. Retirement requires every open enrolment to be completed or transferred.",
              "فعال کرنے کے لیے پیش کردہ پروگرام اور مجاز عملہ۔ سبک دوشی سے پہلے ہر کھلا اندراج مکمل یا منتقل۔",
            )}
          </p>
          <ul>
            {capability.outstanding.map((row) => (
              <li key={row.kind}>
                {row.label} · {row.count} · {row.how}
              </li>
            ))}
          </ul>
          {user.permissions.includes("establishment.manage") && (
            <button
              data-help="pp.facility"
              disabled={write.blocked}
              onClick={openFacility}
            >
              {t("Open Facility settings", "سہولت ترتیبات کھولیں")}
            </button>
          )}
        </article>
      )}
      <div className="toolbar">
        <label className="check">
          <input
            data-help="pp.list"
            type="checkbox"
            checked={all}
            disabled={!!editor || write.blocked}
            onChange={(e) => setAll(e.target.checked)}
          />
          {t("Include programmes no longer offered", "بند پروگرام بھی شامل")}
        </label>
        {ready && !editor && (
          <button data-help="pp.edit" onClick={() => edit("new")}>
            {t("Add programme", "پروگرام شامل")}
          </button>
        )}
      </div>
      <LoadState {...programmes} retry={() => void programmes.reload()} />
      {!programmes.loading && !programmes.error && (
        <QualityTable
          columns={[
            t("Programme", "پروگرام"),
            t("Guideline", "رہنما"),
            t("Services", "خدمات"),
            t("Offered", "پیش کردہ"),
            t("Open enrolments", "کھلے اندراج"),
          ]}
          empty={t("No programmes in this view.", "اس منظر میں پروگرام نہیں۔")}
          rows={(programmes.data ?? []).map((p) => ({
            key: p.programme_id,
            cells: [
              <>
                {p.name} · {t(p.kind, kinds[p.kind])}
                {p.national_programme && ` · ${p.national_programme}`}
                <div className="toolbar">
                  {readReports && (
                    <button
                      data-help="pp.register"
                      disabled={!!editor || write.blocked}
                      onClick={() => {
                        setSelected(p);
                        setCursor(undefined);
                      }}
                    >
                      {t("Read programme register", "پروگرام رجسٹر پڑھیں")}
                    </button>
                  )}
                  {ready && !editor && (
                    <button data-help="pp.edit" onClick={() => edit(p)}>
                      {t("Change programme", "پروگرام بدلیں")}
                    </button>
                  )}
                </div>
              </>,
              p.guideline,
              p.services.join(" · "),
              p.is_offered
                ? t("Offered", "پیش کردہ")
                : t("No longer offered", "اب پیش نہیں"),
              p.active_enrolments,
            ],
          }))}
        />
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setEditor(undefined);
          void programmes.reload();
        }}
      />
      {editor && (
        <form
          className="card"
          onSubmit={save}
          onChange={() => setChecked(false)}
        >
          <h2>
            {existing
              ? t("Change programme", "پروگرام بدلیں")
              : t("Add programme", "پروگرام شامل")}
          </h2>
          <ErrorBox error={error} />
          {stale && (
            <p role="alert">
              {t(
                "The programme changed. Cancel and reopen the current version.",
                "پروگرام بدل گیا۔ منسوخ اور موجودہ نسخہ کھولیں۔",
              )}
            </p>
          )}
          <fieldset disabled={!ready || !!stale || conflict}>
            <Field label={t("Name", "نام")}>
              <input
                data-help="pp.fields"
                name="name"
                required
                maxLength={200}
                defaultValue={existing?.name}
              />
            </Field>
            {!existing && (
              <Field label={t("Kind", "قسم")}>
                <select data-help="pp.fields" name="kind">
                  {Object.entries(kinds).map(([key, ur]) => (
                    <option key={key} value={key}>
                      {t(key, ur)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t("National programme", "قومی پروگرام")}>
              <input
                data-help="pp.fields"
                name="national_programme"
                defaultValue={existing?.national_programme ?? ""}
              />
            </Field>
            <Field
              label={t("Guideline title and edition", "رہنما عنوان و ایڈیشن")}
            >
              <input
                data-help="pp.fields"
                name="guideline"
                required
                defaultValue={existing?.guideline}
              />
            </Field>
            <Field label={t("Services, one per line", "خدمات ایک فی سطر")}>
              <textarea
                data-help="pp.fields"
                name="services"
                required
                defaultValue={existing?.services.join("\n")}
              />
            </Field>
            {existing && (
              <label className="check">
                <input
                  data-help="pp.offered"
                  name="is_offered"
                  type="checkbox"
                  defaultChecked={existing.is_offered}
                />
                {t("Offered to new enrolments", "نئے اندراج کے لیے پیش")}
              </label>
            )}
            <label className="check">
              <input
                data-help="pp.save"
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  e.stopPropagation();
                  setChecked(e.target.checked);
                }}
              />
              {t(
                "I checked the guideline, services and effect on enrolment.",
                "رہنما، خدمات و اندراج اثر چیک کیا۔",
              )}
            </label>
            <button data-help="pp.save" type="submit" disabled={!checked}>
              {t("Save programme", "پروگرام محفوظ")}
            </button>
          </fieldset>
          <button
            data-help="pp.cancel"
            type="button"
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
      {readReports && (
        <QualityPaper
          disabled={!connected || write.blocked}
          documents={[
            {
              label: t("programme list", "پروگرام فہرست"),
              path: "/preventive-programmes/list/pdf",
            },
          ]}
        />
      )}
      {selected && readReports && period.date_to && (
        <article className="card">
          <h2>{selected.name}</h2>
          <p>
            {t(
              "Register reads are logged against each patient’s record.",
              "رجسٹر پڑھنا ہر مریض کے ریکارڈ پر درج ہے۔",
            )}
          </p>
          <QualityPeriod
            range={period}
            apply={(r) => {
              setRange(r);
              setCursor(undefined);
            }}
            disabled={write.blocked}
          />
          <LoadState {...register} retry={() => void register.reload()} />
          {rows && (
            <>
              <QualityTable
                columns={[
                  t("Patient", "مریض"),
                  t("Service", "خدمت"),
                  t("Given on", "دینے کی تاریخ"),
                  t("Card", "کارڈ"),
                  t("Given by", "دینے والا"),
                ]}
                empty={t(
                  "No services recorded for this period.",
                  "اس مدت میں خدمات درج نہیں۔",
                )}
                rows={rows.map((r) => ({
                  key: r.entry_id,
                  cells: [
                    `${r.patient_name} · ${r.mrn}`,
                    r.service,
                    formatHospitalTime(r.given_at, timeZone!),
                    r.card_number,
                    r.given_by_stamp.text,
                  ],
                }))}
              />
              <QualityPager
                cursor={cursor}
                next={rows.length === 100 ? rows.at(-1)?.entry_id : undefined}
                onPage={setCursor}
              />
            </>
          )}
        </article>
      )}
    </section>
  );
}
