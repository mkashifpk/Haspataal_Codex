import { useEffect, useState, type FormEvent } from "react";
import * as maternity from "../generated/labour_register_columns";
import { Field, ErrorBox, LoadState, useLoad } from "../components";
import { ApiError } from "../bridge";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { QualityHeading, QualityTable } from "./QualityRegister";

const id = "labour_register_columns";
const sections = {
  Admission: "داخلہ",
  Delivery: "ولادت",
  Mother: "ماں",
  Baby: "بچہ",
  Discharge: "رخصت",
} as const;
const kinds = {
  Text: "متن",
  Number: "عدد",
  Choice: "ایک انتخاب",
  MultiChoice: "کئی انتخاب",
  YesNo: "ہاں یا نہیں",
  Date: "تاریخ",
} as const;
type Draft = {
  row?: maternity.LabourFieldOut;
  section: maternity.LabourFieldIn["section"];
  kind: maternity.LabourFieldIn["kind"];
  rule: "optional" | "required" | "conditional";
  when: string;
};
export function LabourRegisterColumns({
  user,
  connected,
  revision,
  view,
  fromSetup,
  onOpenHelp,
}: {
  user: ClinicalUser;
  connected: boolean;
  revision: number;
  timeZone?: string;
  view?: string;
  fromSetup: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  onOpenHelp: () => void;
}) {
  const [all, setAll] = useState(false),
    [draft, setDraft] = useState<Draft>(),
    [checked, setChecked] = useState(false),
    [error, setError] = useState<unknown>();
  const manage = user.permissions.includes("maternity.policy.manage");
  const viewable =
    view === "full" ||
    view === "open_work" ||
    view === "records" ||
    (view === "setup" && fromSetup);
  const canRead =
    viewable &&
    (manage ||
      user.permissions.some(
        (p) => p === "maternity.view" || p === "maternity.record",
      ));
  const columns = useLoad(
    () =>
      canRead
        ? maternity.listColumns({ include_inactive: all })
        : Promise.resolve([]),
    [canRead, all, revision],
  );
  const write = useClinicalWrite(user, id, async () => {
    setDraft(undefined);
    await columns.reload();
  });
  const conflict =
    write.error instanceof ApiError &&
    write.error.response.error?.code === "VERSION_CONFLICT";
  useEffect(() => {
    if (conflict) {
      setChecked(false);
      void columns.reload();
    }
  }, [conflict]);
  if (!canRead) return null;
  const rows = !columns.loading && !columns.error ? columns.data : undefined;
  const ready =
    manage &&
    connected &&
    !!rows &&
    !write.blocked &&
    (view === "full" || (view === "setup" && fromSetup));
  const row = draft?.row;
  const stale =
    row &&
    columns.data?.find((c) => c.field_id === row.field_id)?.row_version !==
      row.row_version;
  const controlling = columns.data?.find((c) => c.code === draft?.when);
  const eligible =
    columns.data?.filter(
      (c) =>
        c.is_active &&
        c.field_id !== row?.field_id &&
        (c.section === "Baby") === (draft?.section === "Baby"),
    ) ?? [];
  const choice = draft?.kind === "Choice" || draft?.kind === "MultiChoice";
  function start(value?: maternity.LabourFieldOut) {
    setDraft({
      row: value,
      section: value?.section ?? "Admission",
      kind: value?.kind ?? "Text",
      rule: value?.required
        ? "required"
        : value?.when_code
          ? "conditional"
          : "optional",
      when: value?.when_code ?? "",
    });
    setChecked(false);
    setError(undefined);
    write.clearError();
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft || !ready || !checked || stale || conflict) return;
    const f = new FormData(e.currentTarget),
      str = (k: string) => String(f.get(k) ?? "").trim(),
      num = (k: string) => (str(k) ? Number(str(k)) : null);
    const added = str("choices")
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
    const choices = [...(row?.choices ?? []), ...added];
    const min_value = draft.kind === "Number" ? num("min_value") : null,
      max_value = draft.kind === "Number" ? num("max_value") : null;
    const conditional = draft.rule === "conditional";
    if (
      str("label").length < 2 ||
      (choice &&
        (!choices.length || new Set(choices).size !== choices.length)) ||
      (min_value !== null && max_value !== null && min_value > max_value) ||
      (conditional &&
        (!eligible.some((c) => c.code === draft.when) || !str("when_value")))
    ) {
      setError(
        Error(
          t(
            "Check the label, distinct choices, number range and required condition.",
            "عنوان، الگ انتخابات، عدد حد اور شرط چیک کریں۔",
          ),
        ),
      );
      return;
    }
    const common = {
      label: str("label"),
      choices: choice ? choices : undefined,
      unit: str("unit") || null,
      min_value,
      max_value,
      required: draft.rule === "required",
      when_code: conditional ? draft.when : null,
      when_value: conditional ? str("when_value") : null,
      sort_order: Number(str("sort_order")),
    };
    const body = row
      ? {
          ...common,
          expected_version: row.row_version,
          is_active: f.get("is_active") === "on",
        }
      : {
          ...common,
          code: str("code"),
          section: draft.section,
          kind: draft.kind,
        };
    setError(undefined);
    write.start({
      method: row ? "PATCH" : "POST",
      path: row
        ? `/maternity/labour-register/columns/${row.field_id}`
        : "/maternity/labour-register/columns",
      body,
      permission: "maternity.policy.manage",
      protection: row ? "reconcile" : "idempotent",
      reconcilePath: "/maternity/labour-register/columns?include_inactive=true",
      label: t("Save labour register column", "زچگی رجسٹر کالم محفوظ"),
    });
  }
  return (
    <section
      data-screen={id}
      data-unsaved={!!draft}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t("Labour register: the columns", "زچگی رجسٹر: کالم")}
        text={t(
          "Manage the columns used for future entries. The signed history keeps its recorded labels and values.",
          "آئندہ اندراج کے کالم سنبھالیں۔ دستخط تاریخ اصل عنوان و اقدار رکھتی ہے۔",
        )}
        onHelp={onOpenHelp}
      />
      {view === "open_work" && (
        <p className="notice">
          {t("No new maternity work from now on.", "اب نیا زچگی کام نہیں۔")}
        </p>
      )}
      <div className="toolbar">
        <label className="check">
          <input
            data-help="lc.list"
            type="checkbox"
            checked={all}
            disabled={!!draft || write.blocked}
            onChange={(e) => setAll(e.target.checked)}
          />
          {t("Include switched-off columns", "بند کالم بھی")}
        </label>
        {ready && !draft && (
          <button data-help="lc.edit" onClick={() => start()}>
            {t("Add column", "کالم شامل کریں")}
          </button>
        )}
      </div>
      <LoadState {...columns} retry={() => void columns.reload()} />
      {rows && (
        <QualityTable
          columns={[
            t("Column", "کالم"),
            t("Section and kind", "حصہ اور قسم"),
            t("Source", "ذریعہ"),
            t("Status", "حالت"),
          ]}
          empty={t("No columns in this view.", "اس منظر میں کالم نہیں۔")}
          rows={rows.map((c) => ({
            key: c.field_id,
            cells: [
              <>
                {c.label} <bdi>{c.code}</bdi>
                {ready && !draft && (
                  <button data-help="lc.edit" onClick={() => start(c)}>
                    {t("Change column", "کالم بدلیں")}
                  </button>
                )}
              </>,
              `${t(c.section, sections[c.section])} · ${t(c.kind, kinds[c.kind])}`,
              c.source ?? t("Hospital’s own column", "ہسپتال کا اپنا کالم"),
              c.is_active ? t("Active", "فعال") : t("Switched off", "بند"),
            ],
          }))}
        />
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setDraft(undefined);
          void columns.reload();
        }}
      />
      {draft && (
        <form
          className="card"
          onSubmit={submit}
          onChange={() => setChecked(false)}
        >
          <h2>
            {row
              ? t("Change column", "کالم بدلیں")
              : t("Add column", "کالم شامل کریں")}
          </h2>
          <ErrorBox error={error} />
          {stale && (
            <p role="alert">
              {t(
                "The column changed. Compare the current row and reopen it.",
                "کالم بدل گیا۔ موجودہ صف دیکھ کر دوبارہ کھولیں۔",
              )}
            </p>
          )}
          <fieldset disabled={!ready || !!stale || conflict}>
            {row ? (
              <p>
                <bdi>{row.code}</bdi> · {t(row.section, sections[row.section])}{" "}
                · {t(row.kind, kinds[row.kind])}
              </p>
            ) : (
              <>
                <Field label={t("New column code", "نیا کالم کوڈ")}>
                  <input
                    data-help="lc.identity"
                    name="code"
                    pattern="[a-z][a-z0-9_]{1,40}"
                    required
                  />
                </Field>
                <Field label={t("Section", "حصہ")}>
                  <select
                    data-help="lc.identity"
                    value={draft.section}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        section: e.target.value as Draft["section"],
                        when: "",
                      })
                    }
                  >
                    {Object.entries(sections).map(([key, ur]) => (
                      <option key={key} value={key}>
                        {t(key, ur)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Kind", "قسم")}>
                  <select
                    data-help="lc.identity"
                    value={draft.kind}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        kind: e.target.value as Draft["kind"],
                      })
                    }
                  >
                    {Object.entries(kinds).map(([key, ur]) => (
                      <option key={key} value={key}>
                        {t(key, ur)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label={t("Label", "عنوان")}>
              <input
                data-help="lc.fields"
                name="label"
                required
                minLength={2}
                maxLength={120}
                defaultValue={row?.label}
              />
            </Field>
            <Field label={t("Position", "ترتیب")}>
              <input
                data-help="lc.fields"
                name="sort_order"
                type="number"
                min={0}
                max={10000}
                step={1}
                required
                defaultValue={row?.sort_order ?? 100}
              />
            </Field>
            {choice && (
              <>
                {!!row?.choices.length && (
                  <p>
                    {t("Existing choices", "موجود انتخابات")}:{" "}
                    {row.choices.join(" · ")}
                  </p>
                )}
                <Field
                  label={
                    row
                      ? t(
                          "Additional choices, one per line",
                          "مزید انتخابات ایک فی سطر",
                        )
                      : t("Choices, one per line", "انتخابات ایک فی سطر")
                  }
                >
                  <textarea
                    data-help="lc.fields"
                    name="choices"
                    required={!row}
                  />
                </Field>
              </>
            )}
            <Field label={t("Unit", "اکائی")}>
              <input
                data-help="lc.fields"
                name="unit"
                maxLength={20}
                defaultValue={row?.unit ?? ""}
              />
            </Field>
            {draft.kind === "Number" && (
              <>
                <Field label={t("Minimum", "کم از کم")}>
                  <input
                    data-help="lc.fields"
                    name="min_value"
                    type="number"
                    step="any"
                    defaultValue={row?.min_value ?? ""}
                  />
                </Field>
                <Field label={t("Maximum", "زیادہ سے زیادہ")}>
                  <input
                    data-help="lc.fields"
                    name="max_value"
                    type="number"
                    step="any"
                    defaultValue={row?.max_value ?? ""}
                  />
                </Field>
              </>
            )}
            <Field label={t("Required before signing", "دستخط سے پہلے ضروری")}>
              <select
                data-help="lc.condition"
                value={draft.rule}
                onChange={(e) =>
                  setDraft({ ...draft, rule: e.target.value as Draft["rule"] })
                }
              >
                <option value="optional">{t("Optional", "اختیاری")}</option>
                <option value="required">
                  {t("Always required", "ہمیشہ ضروری")}
                </option>
                <option value="conditional">
                  {t("Required for a specific answer", "خاص جواب پر ضروری")}
                </option>
              </select>
            </Field>
            {draft.rule === "conditional" && (
              <>
                <Field label={t("When this column", "جب یہ کالم")}>
                  <select
                    data-help="lc.condition"
                    required
                    value={draft.when}
                    onChange={(e) =>
                      setDraft({ ...draft, when: e.target.value })
                    }
                  >
                    <option value="">
                      {t("Choose its label", "عنوان چنیں")}
                    </option>
                    {eligible.map((c) => (
                      <option key={c.field_id} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {controlling && (
                  <Field label={t("Has this answer", "یہ جواب ہو")}>
                    {controlling.kind === "YesNo" ||
                    controlling.choices.length ? (
                      <select
                        key={controlling.code}
                        data-help="lc.condition"
                        name="when_value"
                        required
                        defaultValue={
                          row?.when_code === controlling.code
                            ? (row?.when_value ?? "")
                            : ""
                        }
                      >
                        <option value="">
                          {t("Choose an answer", "جواب چنیں")}
                        </option>
                        {(controlling.kind === "YesNo"
                          ? ["Yes", "No"]
                          : controlling.choices
                        ).map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={controlling.code}
                        data-help="lc.condition"
                        required
                        name="when_value"
                        defaultValue={
                          row?.when_code === controlling.code
                            ? (row?.when_value ?? "")
                            : ""
                        }
                      />
                    )}
                  </Field>
                )}
              </>
            )}
            {row && (
              <label className="check">
                <input
                  data-help="lc.status"
                  name="is_active"
                  type="checkbox"
                  defaultChecked={row.is_active}
                />
                {t("Active for new entries", "نئے اندراج کے لیے فعال")}
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                data-help="lc.save"
                checked={checked}
                onChange={(e) => {
                  e.stopPropagation();
                  setChecked(e.target.checked);
                }}
              />
              {t(
                "I checked the effect on future register entries.",
                "آئندہ رجسٹر اثر چیک کیا۔",
              )}
            </label>
            <button type="submit" data-help="lc.save" disabled={!checked}>
              {t("Save column", "کالم محفوظ")}
            </button>
          </fieldset>
          <button
            type="button"
            data-help="lc.cancel"
            disabled={write.blocked}
            onClick={() => {
              setDraft(undefined);
              write.clearError();
            }}
          >
            {t("Cancel unsent changes", "غیر ارسال تبدیلی منسوخ")}
          </button>
        </form>
      )}
    </section>
  );
}
