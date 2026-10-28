import { useEffect, useRef, useState } from "react";
import { api, call } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t, tr } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as imaging from "../generated/imaging_quality_setup";
import { useClinicalWrite } from "../clinical-write";
import { canRetryWrite } from "../write-attempt";
import {
  imagingModalities,
  targetFields,
  targetInput,
  findingInput,
  imagingSetupAccess,
  targetSnapshot,
  findingSnapshot,
} from "../imaging-setup-policy";
type Editor =
  | {
      kind: "target";
      modality: imaging.TurnaroundTargetOut["modality"];
      before?: imaging.TurnaroundTargetOut;
    }
  | { kind: "finding"; before?: imaging.CriticalFindingOut };
type Review = {
  editor: Editor;
  body: imaging.TargetIn | imaging.FindingIn | imaging.FindingUpdateIn;
};
const targetLabel = (key: string) =>
  ({
    routine_perform_minutes: t(
      "Routine: order to examination (minutes)",
      "معمول: آرڈر سے معائنہ (منٹ)",
    ),
    routine_report_minutes: t(
      "Routine: examination to report (minutes)",
      "معمول: معائنہ سے رپورٹ (منٹ)",
    ),
    emergency_perform_minutes: t(
      "Emergency: order to examination (minutes)",
      "ہنگامی: آرڈر سے معائنہ (منٹ)",
    ),
    emergency_report_minutes: t(
      "Emergency: examination to report (minutes)",
      "ہنگامی: معائنہ سے رپورٹ (منٹ)",
    ),
  })[key] || key;
function SetupFacts({ value }: { value: any }) {
  if (!value || typeof value !== "object") return null;
  const target = "routine_perform_minutes" in value;
  return (
    <dl className="details">
      {target ? (
        targetFields.map((k) => (
          <div key={k}>
            <dt>{targetLabel(k)}</dt>
            <dd>
              <bdi>{value[k]}</bdi>
            </dd>
          </div>
        ))
      ) : (
        <>
          <div>
            <dt>{t("Finding name", "نتیجے کا نام")}</dt>
            <dd dir="auto">{value.name}</dd>
          </div>
          <div>
            <dt>{t("Finding modality", "نتیجے کا طریقہ")}</dt>
            <dd>
              {value.modality
                ? tr(value.modality)
                : t("Any modality", "کوئی بھی طریقہ")}
            </dd>
          </div>
          <div>
            <dt>{t("Description", "تفصیل")}</dt>
            <dd dir="auto">
              {value.description ||
                t("No description recorded", "تفصیل درج نہیں")}
            </dd>
          </div>
          <div>
            <dt>{t("Sort order", "ترتیب")}</dt>
            <dd>
              <bdi>{value.sort_order}</bdi>
            </dd>
          </div>
          {typeof value.is_active === "boolean" && (
            <div>
              <dt>{t("Status", "حالت")}</dt>
              <dd>
                {value.is_active ? t("Active", "فعال") : t("Retired", "ریٹائر")}
              </dd>
            </div>
          )}
        </>
      )}
      {value.row_version && (
        <div>
          <dt>{t("Record version", "ریکارڈ نسخہ")}</dt>
          <dd>
            <bdi>{value.row_version}</bdi>
          </dd>
        </div>
      )}
    </dl>
  );
}
export function ImagingQualitySetup({
  user,
  establishment,
  connected,
  stream,
  fromFacility = false,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  fromFacility?: boolean;
}) {
  const view =
      establishment.views.screens.find(
        (s) => s.screen_id === "imaging_quality_setup",
      )?.view || "hidden",
    access = imagingSetupAccess(view, user.permissions, fromFacility),
    can = (p: string) => user.permissions.includes(p);
  const canTargets =
      access.visible &&
      [
        "imaging.order.update",
        "diagnostics.quality.view",
        "diagnostics.setup.manage",
      ].some(can),
    canFindings =
      access.visible &&
      [
        "imaging.report.enter",
        "diagnostics.setup.manage",
        "diagnostics.critical.view",
      ].some(can),
    canPdf =
      access.visible &&
      ["diagnostics.quality.view", "imaging.order.update"].some(can);
  const [revision, setRevision] = useState(0),
    [activeOnly, setActiveOnly] = useState(true),
    [query, setQuery] = useState(""),
    [editor, setEditor] = useState<Editor>(),
    [review, setReview] = useState<Review>();
  const [minutes, setMinutes] = useState<Record<string, string>>({}),
    [modality, setModality] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [order, setOrder] = useState("100"),
    [active, setActive] = useState(true),
    [error, setError] = useState<unknown>(),
    [saved, setSaved] = useState<unknown>();
  const pdfFlight = useRef(false);
  const [pdfBusy, setPdfBusy] = useState(false),
    [pdfNotice, setPdfNotice] = useState<
      "opened" | "saved" | "cancelled" | "closed" | ""
    >("");
  const targets = useLoad(
    () =>
      canTargets && connected ? imaging.listTargets() : Promise.resolve([]),
    [canTargets, connected, revision],
  );
  const findings = useLoad(
    () =>
      canFindings && connected
        ? imaging.listFindings({ active_only: activeOnly })
        : Promise.resolve([]),
    [canFindings, connected, activeOnly, revision],
  );
  const write = useClinicalWrite(
    user,
    "imaging_quality_setup",
    async (value) => {
      setSaved(value);
      setEditor(undefined);
      setReview(undefined);
      setRevision((r) => r + 1);
    },
  );
  useEffect(() => {
    if (connected && stream === "Live") setRevision((r) => r + 1);
  }, [connected, stream]);
  const targetRows =
      connected && !targets.loading && !targets.error
        ? targets.data
        : undefined,
    findingRows =
      connected && !findings.loading && !findings.error
        ? findings.data
        : undefined;
  const matches = (findingRows || []).filter((r) =>
    `${r.name} ${r.description || ""} ${r.modality || ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const locked = write.blocked;
  const editorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if(editor) editorRef.current?.querySelector<HTMLInputElement>('input,select,textarea')?.focus();
  }, [editor]);
  function discard() {
    if (locked) return false;
    if (
      editor &&
      !window.confirm(
        t(
          "Discard this unsaved imaging setup draft?",
          "یہ غیر محفوظ عکس ترتیب مسودہ چھوڑ دیں؟",
        ),
      )
    )
      return false;
    setEditor(undefined);
    setReview(undefined);
    setError(undefined);
    return true;
  }
  function edit(next: Editor) {
    if (!discard()) return;
    setSaved(undefined);
    setEditor(next);
    if (next.kind === "target") {
      setMinutes(
        Object.fromEntries(
          targetFields.map((k) => [
            k,
            next.before ? String(next.before[k]) : "",
          ]),
        ),
      );
    } else {
      setName(next.before?.name || "");
      setDescription(next.before?.description || "");
      setModality(next.before?.modality || "");
      setOrder(String(next.before?.sort_order ?? 100));
      setActive(next.before?.is_active ?? true);
    }
  }
  function reviewDraft() {
    setError(undefined);
    try {
      if (!editor) return;
      const body =
        editor.kind === "target"
          ? targetInput(minutes)
          : findingInput(name, modality, description, order);
      setReview({
        editor,
        body:
          editor.kind === "finding" && editor.before
            ? {
                ...body,
                is_active: active,
                expected_version: editor.before.row_version,
              }
            : body,
      });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    const r = review;
    if (!r || !connected || locked || !access.manage) return;
    const ed = r.editor;
    write.start(
      {
        method: ed.kind === "target" ? "PUT" : ed.before ? "PATCH" : "POST",
        path:
          ed.kind === "target"
            ? `/imaging/turnaround-targets/${ed.modality}`
            : ed.before
              ? `/critical-imaging-findings/${ed.before.finding_id}`
              : "/critical-imaging-findings",
        body: r.body,
        permission: "diagnostics.setup.manage",
        protection:
          ed.kind === "finding" && !ed.before ? "idempotent" : "reconcile",
        reconcilePath:
          ed.kind === "target"
            ? "/imaging/turnaround-targets"
            : "/critical-imaging-findings?active_only=false",
        label:
          ed.kind === "target"
            ? t("Reviewed turnaround targets", "جائزہ شدہ مدت ہدف")
            : t("Reviewed critical finding", "جائزہ شدہ اہم نتیجہ"),
      },
      async () => {
        const [me, est] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
        ]);
        const fresh = imagingSetupAccess(
          est.views.screens.find((s) => s.screen_id === "imaging_quality_setup")
            ?.view || "hidden",
          me.permissions,
          fromFacility,
        );
        if (
          me.user_id !== user.user_id ||
          !fresh.manage ||
          (!ed.before && !fresh.create)
        )
          throw Error(
            t(
              "Actor, permission or service view changed. Reopen the setup draft.",
              "صارف، اجازت یا خدمت منظر بدل گیا۔ مسودہ پھر کھولیں۔",
            ),
          );
        if (ed.kind === "target") {
          const row = (await imaging.listTargets()).find(
            (x) => x.modality === ed.modality,
          );
          if (targetSnapshot(row) !== targetSnapshot(ed.before))
            throw Error(
              t(
                "Targets changed since editing. Close review, discard and reload before replacing them.",
                "ترمیم کے بعد ہدف بدلے۔ جائزہ بند، مسودہ چھوڑ اور تازہ کرکے پھر بدلیں۔",
              ),
            );
        } else if (ed.before) {
          const row = (await imaging.listFindings({ active_only: false })).find(
            (x) => x.finding_id === ed.before!.finding_id,
          );
          if (findingSnapshot(row) !== findingSnapshot(ed.before))
            throw Error(
              t(
                "This finding changed since editing. Close review, discard and reload its current version.",
                "ترمیم کے بعد نتیجہ بدلا۔ جائزہ بند، مسودہ چھوڑ، اصل نسخہ تازہ کریں۔",
              ),
            );
        }
      },
    );
  }
  async function pdf(preview: boolean) {
    if (pdfFlight.current || !canPdf || !connected || locked) return;
    pdfFlight.current = true;
    setPdfBusy(true);
    setError(undefined);
    setPdfNotice("");
    try {
      const r = await call<{ opened?: boolean; saved?: boolean }>(
        "clinical-pdf",
        { path: "/diagnostics/imaging-policy/pdf", preview },
      );
      setPdfNotice(
        preview
          ? r.opened
            ? "opened"
            : "closed"
          : r.saved
            ? "saved"
            : "cancelled",
      );
    } catch (e) {
      setError(e);
    } finally {
      pdfFlight.current = false;
      setPdfBusy(false);
    }
  }
  const observed = Array.isArray(write.observed)
    ? write.observed.filter((r: any) =>
        review?.editor.kind === "target"
          ? r.modality === review.editor.modality
          : review?.editor.before
            ? r.finding_id === review.editor.before.finding_id
            : false,
      )
    : [];
  const recovery = write.attempt && !write.busy && (
    <section className="notice" role="alert">
      <p>
        {t(
          "Outcome unknown: draft and navigation stay locked. Do not create a replacement.",
          "نتیجہ نامعلوم: مسودہ و جگہ مقفل۔ متبادل درخواست نہیں۔",
        )}
      </p>
      {write.attempt.body.protection === "idempotent" &&
        canRetryWrite(write.attempt) && (
          <button
            data-help="imaging-setup.recovery"
            disabled={write.busy}
            onClick={write.retry}
          >
            {t("Retry original request", "اصل درخواست کی دوبارہ کوشش")}
          </button>
        )}
      <button
        data-help="imaging-setup.recovery"
        disabled={write.busy}
        onClick={() => void write.inspect()}
      >
        {t("Read current setup", "موجودہ ترتیب پڑھیں")}
      </button>
      {write.checked && (
        <>
          {observed.map((r: any) => (
            <SetupFacts key={r.finding_id || r.modality} value={r} />
          ))}
          {write.attempt.body.protection === "reconcile" ? (
            <button
              data-help="imaging-setup.recovery"
              disabled={write.busy}
              onClick={() => {
                write.release();
                setReview(undefined);
                setEditor(undefined);
                setRevision((r) => r + 1);
              }}
            >
              {t("Result reviewed; reload draft", "نتیجہ چیک؛ مسودہ پھر پڑھیں")}
            </button>
          ) : (
            <p>
              {t(
                "Creation is reconciled by its original key only; a matching name alone is not proof. Outside 24 hours ask IT.",
                "تخلیق صرف اصل کلید سے؛ ایک سا نام ثبوت نہیں۔24گھنٹے بعد آئی ٹی۔",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
  if (!access.visible && !write.attempt)
    return (
      <Empty>
        {t(
          "This setup screen is unavailable here. Preparing services must be opened from Facility & services.",
          "یہ ترتیب یہاں دستیاب نہیں۔ تیاری کی خدمت ہسپتال اور خدمات سے کھولیں۔",
        )}
      </Empty>
    );
  return (
    <section
      data-help-screen="imaging_quality_setup"
      data-write-pending={locked ? "true" : undefined}
    >
      <h1>
        {t(
          "Imaging turnaround, critical findings and policy",
          "عکس نگاری کی مدت، اہم نتائج اور پالیسی",
        )}
      </h1>
      <p>
        {t(
          "The radiology lead maintains documented response targets and critical findings so staff use a consistent list; authorised radiographers read it and obtain the policy.",
          "ریڈیالوجی نگران مقررہ مدت اور اہم نتائج برقرار رکھتا تاکہ عملہ یکساں فہرست لے؛ مجاز ریڈیوگرافر اسے پڑھ اور پالیسی لیتا ہے۔",
        )}
      </p>
      {view === "setup" && (
        <p className="notice">
          {t(
            "Service setup — opened from Facility & services. This does not activate imaging.",
            "خدمت کی تیاری — ہسپتال اور خدمات سے کھلا۔ اس سے عکس خدمت فعال نہیں ہوتی۔",
          )}
        </p>
      )}
      {view === "records" && (
        <p className="notice">
          {t(
            "Records — existing setup corrections only; no new finding or missing target.",
            "ریکارڈ — موجودہ ترتیب کی تصحیح؛ نیا نتیجہ یا غیر موجود ہدف نہیں۔",
          )}
        </p>
      )}
      {view === "open_work" && (
        <p className="notice">
          {t(
            "No new imaging orders from now on. Existing setup and policy remain available.",
            "اب سے نئے عکس احکامات نہیں۔ موجودہ ترتیب اور پالیسی دستیاب ہیں۔",
          )}
        </p>
      )}
      {!connected && (
        <p role="status">
          {t(
            "Reconnect to refresh or save setup. Old lists are hidden.",
            "ترتیب تازہ یا محفوظ کے لیے رابطہ بحال کریں۔ پرانی فہرستیں پوشیدہ ہیں۔",
          )}
        </p>
      )}
      <div className="actions">
        <button
          data-help="imaging-setup.refresh"
          disabled={!connected || locked || targets.loading || findings.loading}
          onClick={() => setRevision((r) => r + 1)}
        >
          {t("Refresh imaging setup", "عکس ترتیب تازہ کریں")}
        </button>
        {canPdf && (
          <>
            <button
              data-help="imaging-setup.pdf"
              disabled={!connected || locked || pdfBusy}
              onClick={() => void pdf(true)}
            >
              {t("Preview imaging policy", "عکس پالیسی کا پیش منظر")}
            </button>
            <button
              data-help="imaging-setup.pdf"
              disabled={!connected || locked || pdfBusy}
              onClick={() => void pdf(false)}
            >
              {t(
                "Save imaging policy to print",
                "عکس پالیسی پرنٹ کے لیے محفوظ",
              )}
            </button>
          </>
        )}
      </div>
      {pdfBusy && (
        <p role="status">
          {t("Fetching the official PDF…", "سرکاری پی ڈی ایف حاصل ہو رہی ہے…")}
        </p>
      )}
      {pdfNotice && (
        <p role="status">
          {pdfNotice === "saved"
            ? t(
                "Policy PDF saved. Open it in your PDF reader to print.",
                "پالیسی پی ڈی ایف محفوظ۔ ریڈر میں کھول کر پرنٹ کریں۔",
              )
            : pdfNotice === "opened"
              ? t(
                  "Official policy preview opened.",
                  "اصل پالیسی پیش منظر کھل گیا۔",
                )
              : pdfNotice === "cancelled"
                ? t(
                    "Save cancelled. No file was saved.",
                    "محفوظ کرنا منسوخ۔ فائل محفوظ نہیں ہوئی۔",
                  )
                : t(
                    "Preview closed before opening; save the PDF instead.",
                    "کھلنے سے پہلے پیش منظر بند؛ پی ڈی ایف محفوظ کریں۔",
                  )}
        </p>
      )}
      <ErrorBox error={error} />
      <ErrorBox error={write.error} />
      {write.notice && <p role="status">{write.notice}</p>}
      {write.busy && <p role="status">{t('Saving or checking setup…','ترتیب محفوظ یا جانچ جاری…')}</p>}
      {saved !== undefined && (
        <section className="card" data-testid="imaging-setup-saved">
          <h2>{t("Confirmed setup record", "تصدیق شدہ ترتیب ریکارڈ")}</h2>
          <SetupFacts value={saved} />
        </section>
      )}
      {!review && recovery}
      <section className="card">
        <h2>{t("Turnaround targets (minutes)", "مدت کے اہداف (منٹ)")}</h2>
        <p>
          {t(
            "Order to examination and examination to report are separate targets. Emergency must not exceed routine. Coordinate changes with other administrators: saving replaces all four values, and someone saving at the same time may replace your changes.",
            "آرڈر سے معائنہ اور معائنہ سے رپورٹ الگ ہدف ہیں۔ ہنگامی ہدف معمول سے زیادہ نہیں ہو سکتا۔ تبدیلی سے پہلے دوسرے منتظم سے رابطہ کریں: محفوظ کرنے سے چاروں قدریں بدلتی ہیں، اور عین اسی وقت کسی اور کی تبدیلی آپ کی قدریں بدل سکتی ہے۔",
          )}
        </p>
        {canTargets ? (
          <>
            <LoadState {...targets} retry={targets.reload} />
            {targetRows && (
              <>
                {!targetRows.length && (
                  <Empty>
                    {t(
                      "No targets returned. An authorised setup manager can set a modality below.",
                      "ہدف نہیں لوٹے۔ مجاز منتظم نیچے طریقے کا ہدف مقرر کرے۔",
                    )}
                  </Empty>
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Modality", "طریقہ")}</th>
                        {targetFields.map((k) => (
                          <th key={k}>{targetLabel(k)}</th>
                        ))}
                        {access.manage && <th>{t("Action", "عمل")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {targetRows.map((r) => (
                        <tr key={r.modality} data-testid="imaging-target-row">
                          <td>{tr(r.modality)}</td>
                          {targetFields.map((k) => (
                            <td key={k}>
                              <bdi>{r[k]}</bdi>
                            </td>
                          ))}
                          {access.manage && (
                            <td>
                              <button
                                data-help="imaging-setup.target-open"
                                disabled={locked || !connected}
                                onClick={() =>
                                  edit({
                                    kind: "target",
                                    modality: r.modality,
                                    before: r,
                                  })
                                }
                              >
                                {t("Edit target", "ہدف بدلیں")}{" "}
                                <bdi>{r.modality}</bdi>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {access.create &&
                  imagingModalities
                    .filter((m) => !targetRows.some((r) => r.modality === m))
                    .map((m) => (
                      <button
                        key={m}
                        data-help="imaging-setup.target-open"
                        disabled={locked || !connected}
                        onClick={() => edit({ kind: "target", modality: m })}
                      >
                        {t("Set target", "ہدف مقرر کریں")} <bdi>{m}</bdi>
                      </button>
                    ))}
              </>
            )}
          </>
        ) : (
          <p>
            {t(
              "Your account cannot read turnaround targets.",
              "مدت ہدف پڑھنے کی اجازت نہیں۔",
            )}
          </p>
        )}
      </section>
      <section className="card">
        <h2>{t("Critical imaging findings", "عکس کے اہم نتائج")}</h2>
        <div className="form-grid">
          <Field label={t("Find a critical finding", "اہم نتیجہ تلاش")}>
            <input
              data-help="imaging-setup.find"
              value={query}
              maxLength={200}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <label>
            <input
              data-help="imaging-setup.filter"
              type="checkbox"
              checked={activeOnly}
              disabled={locked}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            {t("Active findings only", "صرف فعال نتائج")}
          </label>
        </div>
        {access.create && (
          <button
            data-help="imaging-setup.finding-open"
            disabled={locked || !connected}
            onClick={() => edit({ kind: "finding" })}
          >
            {t("Add critical finding", "اہم نتیجہ شامل کریں")}
          </button>
        )}
        {canFindings ? (
          <>
            <LoadState {...findings} retry={findings.reload} />
            {findingRows &&
              (!matches.length ? (
                <Empty>
                  {t(
                    "No findings match this view. Clear search or include retired findings.",
                    "اس منظر میں نتائج نہیں۔ تلاش صاف یا ریٹائر نتائج شامل کریں۔",
                  )}
                </Empty>
              ) : (
                matches.map((r) => (
                  <article
                    className="card"
                    key={r.finding_id}
                    data-testid="imaging-finding-row"
                  >
                    <h3 dir="auto">{r.name}</h3>
                    <p>
                      {r.modality
                        ? tr(r.modality)
                        : t("Any modality", "کوئی بھی طریقہ")}{" "}
                      ·{" "}
                      {r.is_active
                        ? t("Active", "فعال")
                        : t("Retired", "ریٹائر")}{" "}
                      · {t("Sort order", "ترتیب")} <bdi>{r.sort_order}</bdi>
                    </p>
                    <p dir="auto">
                      {r.description ||
                        t("No description recorded", "تفصیل درج نہیں")}
                    </p>
                    {access.manage && (
                      <button
                        data-help="imaging-setup.finding-open"
                        disabled={locked || !connected}
                        onClick={() => edit({ kind: "finding", before: r })}
                      >
                        {t(
                          "Edit / retire / reactivate",
                          "ترمیم / ریٹائر / بحال",
                        )}
                      </button>
                    )}
                  </article>
                ))
              ))}
          </>
        ) : (
          <p>
            {t(
              "Your account cannot read critical findings.",
              "اہم نتائج پڑھنے کی اجازت نہیں۔",
            )}
          </p>
        )}
      </section>
      {editor && (
        <section
          className="card"
          data-dirty="true"
          data-testid="imaging-setup-editor"
          ref={editorRef}
        >
          <h2>
            {editor.kind === "target"
              ? `${t("Edit target", "ہدف بدلیں")} · ${editor.modality}`
              : editor.before
                ? t("Edit critical finding", "اہم نتیجہ بدلیں")
                : t("New critical finding", "نیا اہم نتیجہ")}
          </h2>
          <fieldset disabled={locked || !!review}>
            {editor.kind === "target" ? (
              <div className="form-grid">
                {targetFields.map((k) => (
                  <Field key={k} label={targetLabel(k)}>
                    <input
                      data-help="imaging-setup.target-fields"
                      inputMode="numeric"
                      value={minutes[k] || ""}
                      onChange={(e) =>
                        setMinutes({ ...minutes, [k]: e.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
            ) : (
              <>
                <Field label={t("Finding name", "نتیجے کا نام")}>
                  <input data-field="name"
                    data-help="imaging-setup.finding-fields"
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label={t("Finding modality", "نتیجے کا طریقہ")}>
                  <select data-field="modality"
                    data-help="imaging-setup.finding-fields"
                    value={modality}
                    onChange={(e) => setModality(e.target.value)}
                  >
                    <option value="">
                      {t("Any modality", "کوئی بھی طریقہ")}
                    </option>
                    {imagingModalities.map((m) => (
                      <option key={m} value={m}>
                        {tr(m)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Description", "تفصیل")}>
                  <textarea data-field="description"
                    data-help="imaging-setup.finding-fields"
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <Field label={t("Sort order", "ترتیب")}>
                  <input
                    data-help="imaging-setup.finding-fields"
                    inputMode="numeric"
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                  />
                </Field>
                {editor.before && (
                  <label>
                    <input data-field="is_active"
                      data-help="imaging-setup.finding-active"
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    {t("Finding is active", "نتیجہ فعال ہے")}
                  </label>
                )}
              </>
            )}
          </fieldset>
          <div className="actions">
            <button
              data-help="imaging-setup.review"
              disabled={locked || !connected || !!review}
              onClick={reviewDraft}
            >
              {t("Review setup change", "ترتیب تبدیلی کا جائزہ")}
            </button>
            <button
              data-help="imaging-setup.discard"
              disabled={locked}
              onClick={discard}
            >
              {t("Discard setup draft", "ترتیب مسودہ چھوڑیں")}
            </button>
          </div>
        </section>
      )}
      {review && (
        <Modal
          title={t("Review imaging setup change", "عکس ترتیب تبدیلی کا جائزہ")}
          closable={!locked}
          onClose={() => {
            if (!locked) setReview(undefined);
          }}
        >
          <p>
            {t(
              "Check every value and the exact modality/finding. This changes department setup, not a patient result.",
              "ہر قدر اور عین طریقہ/نتیجہ چیک۔ شعبہ ترتیب بدلتی، مریض نتیجہ نہیں۔",
            )}
          </p>
          <h3>{t("Before", "پہلے")}</h3>
          <SetupFacts value={review.editor.before} />
          <h3>{t("Proposed", "مجوزہ")}</h3>
          <SetupFacts value={review.body} />
          <p>
            <bdi>
              {review.editor.kind === "target"
                ? review.editor.modality
                : review.editor.before?.finding_id ||
                  t("NEW finding", "نیا نتیجہ")}
            </bdi>
          </p>
          <ErrorBox error={write.error} />
          {write.busy && <p role="status">{t('Saving or checking setup…','ترتیب محفوظ یا جانچ جاری…')}</p>}
          <button
            data-help="imaging-setup.confirm"
            disabled={locked || !connected || !access.manage}
            onClick={confirm}
          >
            {t("Confirm reviewed setup", "جائزہ شدہ ترتیب کی تصدیق")}
          </button>
          {recovery}
        </Modal>
      )}
    </section>
  );
}
