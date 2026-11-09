import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../bridge";
import type { ClinicalUser } from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Field, LoadState, useLoad } from "../components";
import * as policy from "../generated/consent_policy_setup";
import { bilingual as t } from "../i18n";
import { QualityPaper } from "./QualityPaper";
import { QualityHeading } from "./QualityRegister";

const formsPath = "/consent-forms?include_inactive=true";
const makersPath = "/consent-decision-makers";
const languages = {
  English: "انگریزی",
  Urdu: "اردو",
  Punjabi: "پنجابی",
  Saraiki: "سرائیکی",
  Pashto: "پشتو",
  Sindhi: "سندھی",
  Balochi: "بلوچی",
};
const categories = {
  General: "عمومی",
  Procedure: "طریقہ علاج",
  Anaesthesia: "بے ہوشی",
  Transfusion: "انتقال خون",
  HighRiskTreatment: "زیادہ خطرے والا علاج",
  AgainstMedicalAdvice: "طبی مشورے کے خلاف",
  Other: "دیگر",
};
const takers = {
  AnyStaff: ["Any staff", "کوئی بھی عملہ"],
  Doctor: ["Doctor", "ڈاکٹر"],
  Anaesthetist: ["Anaesthetist", "ماہر بے ہوشی"],
} as const;
const relationships = {
  Guardian: "سرپرست",
  Attorney: "مختار",
  Spouse: "شریک حیات",
  Child: "اولاد",
  Parent: "والدین",
  Sibling: "بہن بھائی",
  OtherRelative: "دیگر رشتہ دار",
  CareProvider: "نگہداشت کرنے والا",
};

type Language = policy.ConsentFormTextIn["language"];
type Draft =
  | { kind: "new" }
  | { kind: "form" | "status"; form: policy.ConsentFormOut }
  | { kind: "text"; form: policy.ConsentFormOut; language: Language }
  | { kind: "maker"; maker: policy.DecisionMakerOut };

function textVersion(
  form: policy.ConsentFormOut | undefined,
  language: Language,
) {
  return form?.texts.find((entry) => entry.language === language)?.row_version;
}

export function ConsentPolicySetup({
  user,
  connected,
  readOnly,
  revision,
  onOpenHelp,
  openSettings,
}: {
  user: ClinicalUser;
  connected: boolean;
  readOnly: boolean;
  revision: number;
  onOpenHelp: () => void;
  openSettings: () => void;
}) {
  const [includeRetired, setIncludeRetired] = useState(false);
  const [formId, setFormId] = useState<number>();
  const [language, setLanguage] = useState<Language>("English");
  const [draft, setDraft] = useState<Draft>();
  const [reviewed, setReviewed] = useState(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (draft) editorHeading.current?.focus();
  }, [draft]);
  const canRead = user.permissions.some(
    (permission) =>
      permission === "consent.view" || permission === "consent.configure",
  );
  const forms = useLoad(
    () =>
      canRead
        ? policy.listForms({ include_inactive: includeRetired })
        : Promise.resolve(undefined),
    [canRead, includeRetired, revision],
  );
  const makers = useLoad(
    () => (canRead ? policy.listDecisionMakers() : Promise.resolve(undefined)),
    [canRead, revision],
  );
  const formRows = !forms.loading && !forms.error ? forms.data : undefined;
  const makerRows = !makers.loading && !makers.error ? makers.data : undefined;
  const form = formRows?.find((row) => row.form_id === formId);
  const savedText = form?.texts.find((row) => row.language === language);
  const write = useClinicalWrite(
    user,
    "consent_policy_setup",
    async (result, command) => {
      if (command.path.startsWith("/consent-forms")) {
        setFormId(result.form_id);
        if (draft?.kind === "new") setLanguage(result.texts[0].language);
        await forms.reload();
      } else {
        await makers.reload();
      }
      setDraft(undefined);
      setReviewed(false);
    },
  );
  const canChange =
    connected &&
    !readOnly &&
    user.permissions.includes("consent.configure") &&
    !write.blocked;
  const stale =
    draft?.kind === "maker"
      ? !!makerRows &&
        makerRows.find((row) => row.relationship === draft.maker.relationship)
          ?.row_version !== draft.maker.row_version
      : draft &&
        draft.kind !== "new" &&
        !!formRows &&
        (!form ||
          (draft.kind === "text"
            ? textVersion(form, draft.language) !==
              textVersion(draft.form, draft.language)
            : form.row_version !== draft.form.row_version));
  const ready =
    canChange && (draft?.kind === "maker" ? !!makerRows : !!formRows) && !stale;
  const refusal =
    write.error instanceof ApiError
      ? write.error.response.error?.code
      : undefined;
  const reloadForms = forms.reload;
  const reloadMakers = makers.reload;
  useEffect(() => {
    if (refusal !== "VERSION_CONFLICT" && refusal !== "CONSENT_FORM_EXISTS")
      return;
    setReviewed(false);
    if (draft?.kind === "maker") void reloadMakers();
    else void reloadForms();
  }, [write.error]);

  function edit(next: Draft | undefined) {
    setDraft(next);
    setReviewed(false);
    write.clearError();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !ready || !reviewed) return;
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? "").trim();
    const permission = "consent.configure";
    const label = t(
      "Save consent policy change",
      "رضامندی پالیسی تبدیلی محفوظ کریں",
    );
    if (draft.kind === "maker") {
      const priority = (name: string) =>
        value(name) === "" ? null : Number(value(name));
      const body: policy.DecisionMakerUpdateIn = {
        description: value("description"),
        adult_priority: priority("adult_priority"),
        minor_priority: priority("minor_priority"),
        expected_version: draft.maker.row_version,
      };
      write.start({
        method: "PATCH",
        path: `${makersPath}/${draft.maker.relationship}`,
        body,
        permission,
        label,
        protection: "reconcile",
        reconcilePath: makersPath,
      });
      return;
    }
    const heading = value("heading");
    const bodyText = value("body");
    const metadata = {
      title: value("title"),
      situations: value("situations"),
      taken_by: value("taken_by") as policy.ConsentFormIn["taken_by"],
      requires_witness: values.has("requires_witness"),
      sort_order: Number(value("sort_order")),
    };
    if (draft.kind === "new") {
      const body: policy.ConsentFormIn = {
        ...metadata,
        code: value("code"),
        category: value("category") as policy.ConsentFormIn["category"],
        texts: [
          { language: value("language") as Language, heading, body: bodyText },
        ],
      };
      write.start({
        method: "POST",
        path: "/consent-forms",
        body,
        permission,
        label,
        protection: "idempotent",
        reconcilePath: formsPath,
      });
      return;
    }
    const base = `/consent-forms/${draft.form.form_id}`;
    if (draft.kind === "text") {
      const version = textVersion(draft.form, draft.language);
      const body: policy.ConsentTextIn = {
        heading,
        body: bodyText,
        expected_version: version,
      };
      write.start(
        {
          method: "PUT",
          path: `${base}/texts/${draft.language}`,
          body,
          permission,
          label,
          protection: "reconcile",
          reconcilePath: formsPath,
        },
        async () => {
          const current = (
            await policy.listForms({ include_inactive: true })
          ).find((row) => row.form_id === draft.form.form_id);
          if (!current || textVersion(current, draft.language) !== version) {
            await reloadForms();
            throw Error(
              t(
                "This language changed. Compare the saved text before editing again.",
                "یہ زبان بدل گئی۔ دوبارہ ترمیم سے پہلے محفوظ متن دیکھیں۔",
              ),
            );
          }
        },
      );
      return;
    }
    const body: policy.ConsentFormUpdateIn =
      draft.kind === "status"
        ? {
            is_active: !draft.form.is_active,
            expected_version: draft.form.row_version,
          }
        : { ...metadata, expected_version: draft.form.row_version };
    write.start({
      method: "PATCH",
      path: base,
      body,
      permission,
      label,
      protection: "reconcile",
      reconcilePath: formsPath,
    });
  }

  const sourceForm = draft && "form" in draft ? draft.form : undefined;
  const sourceText =
    draft?.kind === "text"
      ? sourceForm?.texts.find((entry) => entry.language === draft.language)
      : undefined;
  return (
    <section
      data-screen="consent_policy_setup"
      data-unsaved={!!draft}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t("Consent policy setup", "رضامندی پالیسی کی ترتیب")}
        text={t(
          "Manage the hospital’s consent forms and the order in which a decision maker is asked.",
          "ہسپتال کے رضامندی فارم اور فیصلہ کرنے والوں کی ترتیب سنبھالیں۔",
        )}
        onHelp={onOpenHelp}
      />
      {!canRead && (
        <p role="status">
          {t(
            "Consent policy access is required.",
            "رضامندی پالیسی تک رسائی درکار ہے۔",
          )}
        </p>
      )}
      {canRead && (
        <article className="card">
          <h2>
            {t("Written policy for approval", "منظوری کے لیے تحریری پالیسی")}
          </h2>
          <p>
            {t(
              "Print the current policy for the medical director’s signature and yearly review. Have the legal adviser approve each language’s text before use.",
              "طبی ڈائریکٹر کے دستخط اور سالانہ جائزے کے لیے موجودہ پالیسی پرنٹ کریں۔ استعمال سے پہلے ہر زبان کے متن کی قانونی مشیر سے منظوری لیں۔",
            )}
          </p>
          <QualityPaper
            disabled={!connected || !!draft || write.blocked}
            documents={[
              {
                label: t("consent policy", "رضامندی پالیسی"),
                path: "/consent-policy/pdf",
              },
            ]}
          />
          <p>
            {t(
              "Age of consent, validity days, scan deadline and the emergency second-doctor rule are hospital settings.",
              "رضامندی کی عمر، مدت، اسکین کی آخری حد اور ہنگامی دوسرے ڈاکٹر کی شرط ہسپتال کی ترتیبات میں ہیں۔",
            )}
          </p>
          {user.permissions.includes("admin.settings.manage") && (
            <button
              data-help="cps.settings"
              disabled={!!draft || write.blocked}
              onClick={openSettings}
            >
              {t("Open hospital settings", "ہسپتال کی ترتیبات کھولیں")}
            </button>
          )}
        </article>
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          edit(undefined);
          void reloadForms();
          void reloadMakers();
        }}
      />
      {canRead && (
        <article className="card">
          <h2>{t("Forms and languages", "فارم اور زبانیں")}</h2>
          <div className="toolbar">
            <button
              data-help="cps.forms"
              disabled={!connected || forms.loading || write.blocked}
              onClick={() => void reloadForms()}
            >
              {t("Refresh forms", "فارم تازہ پڑھیں")}
            </button>
            <label className="check">
              <input
                type="checkbox"
                data-help="cps.forms"
                disabled={!!draft}
                checked={includeRetired}
                onChange={(e) => setIncludeRetired(e.target.checked)}
              />
              {t("Include retired forms", "بند فارم شامل کریں")}
            </label>
            {canChange && !draft && formRows && (
              <button
                data-help="cps.form"
                onClick={() => edit({ kind: "new" })}
              >
                {t("Add a form", "فارم شامل کریں")}
              </button>
            )}
          </div>
          <LoadState {...forms} retry={() => void reloadForms()} />
          {formRows?.length === 0 && (
            <p role="status">
              {t(
                "No forms in this list. Include retired forms or ask the policy administrator.",
                "اس فہرست میں کوئی فارم نہیں۔ بند فارم شامل کریں یا پالیسی منتظم سے رابطہ کریں۔",
              )}
            </p>
          )}
          {!!formRows?.length && (
            <Field label={t("Consent form", "رضامندی فارم")}>
              <select
                data-help="cps.forms"
                value={form?.form_id ?? ""}
                disabled={!!draft}
                onChange={(e) => {
                  const selected = formRows.find(
                    (row) => row.form_id === Number(e.target.value),
                  );
                  setFormId(selected?.form_id);
                  setLanguage(selected?.texts[0]?.language ?? "English");
                }}
              >
                <option value="">{t("Choose a form", "فارم چنیں")}</option>
                {formRows.map((row) => (
                  <option key={row.form_id} value={row.form_id}>
                    {row.title} · {row.code}
                    {!row.is_active ? t(" (retired)", " (بند)") : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form && (
            <>
              <p>
                <strong>{form.title}</strong> ·{" "}
                {t(form.category, categories[form.category])} ·{" "}
                {t(takers[form.taken_by][0], takers[form.taken_by][1])} ·{" "}
                {form.requires_witness
                  ? t("Witness required", "گواہ لازم")
                  : t("Witness optional", "گواہ اختیاری")}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{form.situations}</p>
              <div className="toolbar">
                {canChange && !draft && (
                  <>
                    <button
                      data-help="cps.form"
                      onClick={() => edit({ kind: "form", form })}
                    >
                      {t("Edit form details", "فارم کی تفصیل بدلیں")}
                    </button>
                    <button
                      data-help="cps.status"
                      onClick={() => edit({ kind: "status", form })}
                    >
                      {form.is_active
                        ? t("Retire form", "فارم بند کریں")
                        : t("Reactivate form", "فارم دوبارہ فعال کریں")}
                    </button>
                  </>
                )}
              </div>
              <Field label={t("Form language", "فارم کی زبان")}>
                <select
                  data-help="cps.text"
                  value={language}
                  disabled={!!draft}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                >
                  {Object.entries(languages).map(([key, ur]) => (
                    <option key={key} value={key}>
                      {t(key, ur)}
                      {form.texts.some((entry) => entry.language === key)
                        ? ""
                        : t(" (no text)", " (متن موجود نہیں)")}
                    </option>
                  ))}
                </select>
              </Field>
              {savedText ? (
                <div dir={savedText.direction}>
                  <h3>{savedText.heading}</h3>
                  <p
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {savedText.body}
                  </p>
                </div>
              ) : (
                <p>
                  {t(
                    "This form has no text in that language.",
                    "اس فارم کا اس زبان میں متن موجود نہیں۔",
                  )}
                </p>
              )}
              {canChange && !draft && (
                <button
                  data-help="cps.text"
                  onClick={() => edit({ kind: "text", form, language })}
                >
                  {savedText
                    ? t("Edit language text", "زبان کا متن بدلیں")
                    : t("Add language text", "زبان کا متن شامل کریں")}
                </button>
              )}
            </>
          )}
        </article>
      )}
      {canRead && (
        <article className="card">
          <h2>{t("Decision makers", "فیصلہ کرنے والے")}</h2>
          <p>
            {t(
              "Priority 1 is asked first. A blank priority means this relationship may not decide for that group.",
              "ترجیح ۱ سے پہلے پوچھا جاتا ہے۔ خالی ترجیح کا مطلب ہے اس گروہ کے لیے یہ رشتہ فیصلہ نہیں کر سکتا۔",
            )}
          </p>
          <button
            data-help="cps.makers"
            disabled={!connected || makers.loading || write.blocked}
            onClick={() => void reloadMakers()}
          >
            {t("Refresh decision makers", "فیصلہ کرنے والے تازہ پڑھیں")}
          </button>
          <LoadState {...makers} retry={() => void reloadMakers()} />
          {makerRows?.length === 0 && (
            <p role="status">
              {t(
                "The policy has no decision makers listed.",
                "پالیسی میں کوئی فیصلہ کرنے والا درج نہیں۔",
              )}
            </p>
          )}
          {makerRows?.map((maker) => (
            <div className="card" key={maker.relationship}>
              <strong>
                {t(maker.relationship, relationships[maker.relationship])}
              </strong>
              <p>{maker.description}</p>
              <p>
                {t("Adult priority", "بالغ کی ترجیح")}{" "}
                {maker.adult_priority ?? t("Not allowed", "اجازت نہیں")} ·{" "}
                {t("Child priority", "بچے کی ترجیح")}{" "}
                {maker.minor_priority ?? t("Not allowed", "اجازت نہیں")}
              </p>
              {canChange && !draft && (
                <button
                  data-help="cps.makers"
                  onClick={() => edit({ kind: "maker", maker })}
                >
                  {t("Edit", "بدلیں")}{" "}
                  {t(maker.relationship, relationships[maker.relationship])}
                </button>
              )}
            </div>
          ))}
        </article>
      )}
      {draft && (
        <form
          className="card"
          onSubmit={save}
          onChange={(event) => {
            if (!(
              event.target instanceof HTMLInputElement &&
              event.target.name === "confirmed"
            ))
              setReviewed(false);
          }}
        >
          <h2 ref={editorHeading} tabIndex={-1}>
            {t("Review policy change", "پالیسی تبدیلی کا جائزہ")}
          </h2>
          {stale && (
            <p role="alert">
              {t(
                "The saved record changed. Compare the current version, cancel this draft and reopen it.",
                "محفوظ ریکارڈ بدل گیا۔ موجودہ ورژن دیکھیں، یہ مسودہ منسوخ کر کے دوبارہ کھولیں۔",
              )}
            </p>
          )}
          <fieldset disabled={!ready}>
            {draft.kind === "new" && (
              <>
                <Field label={t("Form code", "فارم کوڈ")}>
                  <input
                    data-help="cps.form"
                    name="code"
                    dir="ltr"
                    required
                    pattern="[A-Z][A-Z0-9_]{1,39}"
                    maxLength={40}
                  />
                </Field>
                <Field label={t("Category", "زمرہ")}>
                  <select
                    data-help="cps.form"
                    name="category"
                    defaultValue=""
                    required
                  >
                    <option value="">
                      {t("Choose a category", "زمرہ چنیں")}
                    </option>
                    {Object.entries(categories).map(([key, ur]) => (
                      <option key={key} value={key}>
                        {t(key, ur)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {(draft.kind === "new" || draft.kind === "form") && (
              <>
                <Field label={t("Form title", "فارم کا عنوان")}>
                  <input
                    data-help="cps.form"
                    name="title"
                    required
                    minLength={3}
                    maxLength={200}
                    defaultValue={sourceForm?.title}
                  />
                </Field>
                <Field
                  label={t("When consent is needed", "رضامندی کب درکار ہے")}
                >
                  <textarea
                    data-help="cps.form"
                    name="situations"
                    required
                    minLength={10}
                    maxLength={2000}
                    defaultValue={sourceForm?.situations}
                  />
                </Field>
                <Field label={t("Who takes consent", "رضامندی کون لیتا ہے")}>
                  <select
                    data-help="cps.form"
                    name="taken_by"
                    defaultValue={sourceForm?.taken_by ?? "AnyStaff"}
                  >
                    {Object.entries(takers).map(([key, [en, ur]]) => (
                      <option key={key} value={key}>
                        {t(en, ur)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Display order", "دکھانے کی ترتیب")}>
                  <input
                    data-help="cps.form"
                    name="sort_order"
                    type="number"
                    required
                    min={0}
                    max={10000}
                    defaultValue={sourceForm?.sort_order ?? 0}
                  />
                </Field>
                <label className="check">
                  <input
                    data-help="cps.form"
                    name="requires_witness"
                    type="checkbox"
                    defaultChecked={sourceForm?.requires_witness}
                  />
                  {t("A witness must sign", "گواہ کے دستخط لازم ہیں")}
                </label>
              </>
            )}
            {(draft.kind === "new" || draft.kind === "text") && (
              <>
                {draft.kind === "new" ? (
                  <Field label={t("First language", "پہلی زبان")}>
                    <select
                      data-help="cps.text"
                      name="language"
                      defaultValue=""
                      required
                    >
                      <option value="">
                        {t("Choose a language", "زبان چنیں")}
                      </option>
                      {Object.entries(languages).map(([key, ur]) => (
                        <option key={key} value={key}>
                          {t(key, ur)}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <p>
                    {t(draft.language, languages[draft.language])} ·{" "}
                    {draft.form.title}
                  </p>
                )}
                <Field label={t("Language heading", "زبان کا عنوان")}>
                  <input
                    data-help="cps.text"
                    name="heading"
                    dir="auto"
                    required
                    minLength={3}
                    maxLength={200}
                    defaultValue={sourceText?.heading}
                  />
                </Field>
                <Field
                  label={t(
                    "Declaration, one paragraph per line",
                    "اعلان، ہر سطر پر ایک پیراگراف",
                  )}
                >
                  <textarea
                    data-help="cps.text"
                    name="body"
                    dir={sourceText?.direction ?? "auto"}
                    rows={5}
                    required
                    minLength={20}
                    maxLength={20000}
                    defaultValue={sourceText?.body}
                  />
                </Field>
              </>
            )}
            {draft.kind === "status" && (
              <p>
                {draft.form.title} ·{" "}
                {draft.form.is_active
                  ? t(
                      "Retiring keeps earlier consents and removes this form from new use.",
                      "بند کرنے سے پرانی رضامندیاں محفوظ اور نئے استعمال سے فارم ہٹتا ہے۔",
                    )
                  : t(
                      "Reactivation makes this form available for new consent.",
                      "دوبارہ فعال کرنے سے یہ فارم نئی رضامندی کے لیے دستیاب ہو گا۔",
                    )}
              </p>
            )}
            {draft.kind === "maker" && (
              <>
                <p>
                  {t(
                    draft.maker.relationship,
                    relationships[draft.maker.relationship],
                  )}
                </p>
                <Field label={t("Relationship description", "رشتے کی وضاحت")}>
                  <input
                    data-help="cps.makers"
                    name="description"
                    required
                    minLength={3}
                    maxLength={500}
                    defaultValue={draft.maker.description}
                  />
                </Field>
                <Field label={t("Adult priority", "بالغ کی ترجیح")}>
                  <input
                    data-help="cps.makers"
                    name="adult_priority"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={draft.maker.adult_priority ?? ""}
                  />
                </Field>
                <Field label={t("Child priority", "بچے کی ترجیح")}>
                  <input
                    data-help="cps.makers"
                    name="minor_priority"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={draft.maker.minor_priority ?? ""}
                  />
                </Field>
              </>
            )}
            <label className="check">
              <input
                data-help="cps.save"
                name="confirmed"
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              {t(
                "I reviewed this policy change.",
                "میں نے اس پالیسی تبدیلی کا جائزہ لیا۔",
              )}
            </label>
            <button data-help="cps.save" disabled={!reviewed}>
              {t("Save policy change", "پالیسی تبدیلی محفوظ کریں")}
            </button>
          </fieldset>
          <button
            type="button"
            data-help="cps.cancel"
            disabled={write.blocked}
            onClick={() => edit(undefined)}
          >
            {t("Cancel draft", "مسودہ منسوخ کریں")}
          </button>
        </form>
      )}
    </section>
  );
}
