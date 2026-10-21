import { useEffect, useState } from "react";
import { help } from "../help";
import { call } from "../bridge";
import type { HandbookOut } from "../generated/help_center";
import { ErrorBox, Modal } from "../components";
import {
  controlGuides,
  foundationJourney,
  deliveredHelpScreens as phase1Screens,
  workspaceFocus,
} from "../foundation-help";
import { foundationErrors } from "../foundation-errors";
import catalogue from "../foundation-catalogue.json";
import taskHelp from "../foundation-task-map.json";
import { tr } from "../i18n";

export function Help({
  screen,
  initialPage,
  outline,
  language,
  onClose,
}: {
  screen: string;
  initialPage?: string;
  outline: HandbookOut | undefined;
  language: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(initialPage || screen),
    [error, setError] = useState<unknown>(),
    [printing, setPrinting] = useState(false);
  const ur = language === "ur",
    lang = ur ? 1 : 0;
  const t = (en: string, urText: string) => (ur ? urText : en);
  const allowed = new Set(
    outline
      ? [
          ...outline.shared_screens,
          ...outline.workspaces.flatMap((w) => w.screens),
        ].map((s) => s.id)
      : ["connect_server", "login", "settings", "help_center"],
  );
  const screenPages = Object.entries(help).filter(([id]) => allowed.has(id));
  const workspaces = [...(outline?.workspaces || [])].sort(
    (a, b) => Number(b.yours) - Number(a.yours),
  );
  const selectedWorkspace = workspaces.find((w) => w.page === selected);
  const page = allowed.has(selected) ? help[selected] : undefined;
  const publicControls = new Set([
    "settings.sections",
    "settings.display",
    "settings.zoom",
    "settings.diagnostics",
  ]);
  const controlsFor = (id: string) =>
    Object.entries(controlGuides).filter(
      ([key, g]) =>
        g.screens.includes(id) &&
        (!key.startsWith("settings.it.") || allowed.has("it_console")) &&
        (outline || id !== "settings" || publicControls.has(key)),
    );
  const searchText = (id: string) =>
    JSON.stringify([
      !outline && id === "settings"
        ? {
            title: help[id].title,
            titleUr: help[id].titleUr,
            steps: help[id].steps.filter((_, i) => [0, 1, 3].includes(i)),
            stepsUr: help[id].stepsUr.filter((_, i) => [0, 1, 3].includes(i)),
            faq: help[id].faq.slice(1),
            faqUr: help[id].faqUr.slice(1),
          }
        : help[id],
      controlsFor(id),
      catalogue.faq
        .filter((f) => f.screen_id === id)
        .map((f) => foundationErrors[f.code || f.entity || ""]),
    ]);
  const links = [
    ...screenPages.map(([id, p]) => ({
      id,
      title: ur ? p.titleUr : p.title,
      text: searchText(id),
    })),
    ...workspaces.map((w) => ({
      id: w.page,
      title: `${ur ? w.label_ur : w.label} · ${t("foundation guide", "بنیادی رہنما")}`,
      text: JSON.stringify([
        w.label,
        w.label_ur,
        foundationJourney,
        outline?.roles,
        ...[...outline!.shared_screens, ...w.screens]
          .filter((s) => phase1Screens.includes(s.id))
          .map((s) => searchText(s.id)),
      ]),
    })),
  ];
  const found = links.filter(
    (p) =>
      p.text.toLowerCase().includes(query.trim().toLowerCase()) ||
      p.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    setSelected(initialPage || screen);
  }, [initialPage, screen]);
  useEffect(() => {
    const contextual = (event: KeyboardEvent) => {
      if (event.key === "F1") {
        event.preventDefault();
        setSelected(screen);
        setQuery("");
      }
    };
    document.addEventListener("keydown", contextual);
    return () => document.removeEventListener("keydown", contextual);
  }, [screen]);
  function open(id: string) {
    setSelected(id);
    setError(undefined);
  }
  function instructions(id: string, roleTasks = false) {
    const p = help[id];
    if (!p || !allowed.has(id)) return null;
    const steps = ur ? p.stepsUr : p.steps;
    const mapping =
      (taskHelp as Record<string, Record<string, string>>)[id] || {};
    const screenMeta =
      outline &&
      [
        ...outline.shared_screens,
        ...outline.workspaces.flatMap((w) => w.screens),
      ].find((s) => s.id === id);
    const granted = new Set(
      screenMeta?.tasks.map((task) => mapping[`${task.method} ${task.path}`]),
    );
    const mapped = new Set(Object.values(mapping));
    const controls = controlsFor(id).filter(
      ([key]) => !roleTasks || !mapped.has(key) || granted.has(key),
    );
    return (
      <>
        {!roleTasks && (
          <ol>
            {(!outline && id === "settings"
              ? steps.filter((_, i) => [0, 1, 3].includes(i))
              : steps
            ).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
        {controls.map(([key, g]) => (
          <section
            id={roleTasks ? undefined : key}
            key={key}
            className="help-control"
          >
            <h3>{g.title[lang]}</h3>
            <p>{g.body[lang]}</p>
          </section>
        ))}
      </>
    );
  }
  const related = selectedWorkspace
    ? [
        ...new Set(
          [...outline!.shared_screens, ...selectedWorkspace.screens]
            .filter(
              (s) =>
                phase1Screens.includes(s.id) && help[s.id] && allowed.has(s.id),
            )
            .map((s) => s.id),
        ),
      ]
    : [];
  const faq = (id: string) =>
    catalogue.faq
      .filter((f) => f.screen_id === id)
      .map((f) => {
        const answer = foundationErrors[f.code || f.entity || ""];
        return (
          answer && (
            <section key={f.id} id={f.id}>
              <h3 dir="auto">
                {ur
                  ? `${f.code || f.entity} — یہ حالت یا پیغام کیوں، اور اگلا قدم؟`
                  : f.question}
              </h3>
              <p>{answer[lang]}</p>
            </section>
          )
        );
      });
  return (
    <Modal title={t("Help & handbook", "مدد اور رہنما")} onClose={onClose}>
      <div className="help-layout">
        <aside aria-label={t("Handbook pages", "رہنما صفحات")}>
          <input
            data-help="help.search"
            aria-label={tr("Search handbook")}
            placeholder={t("Search this handbook", "رہنما تلاش کریں")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {found.length === 0 && (
            <p>
              {t(
                "No permitted help matches this search.",
                "اس تلاش کی کوئی مجاز مدد نہیں ملی۔",
              )}
            </p>
          )}
          {found.map((p) => (
            <button
              data-help="help.search"
              className={p.id === selected ? "selected" : ""}
              key={p.id}
              onClick={() => open(p.id)}
            >
              {p.title}
            </button>
          ))}
        </aside>
        <article className="help-article" key={selected}>
          <span className="eyebrow">
            {t(
              "STAFF HANDBOOK · translation and human journey review pending",
              "عملے کا رہنما · اردو مسودہ اور انسانی جائزہ باقی",
            )}
          </span>
          <ErrorBox error={error} />
          {selected === "home" ? (
            <>
              <h1>{t("Your handbook", "آپ کا رہنما")}</h1>
              <p>
                {t(
                  "Search the permitted pages or choose your workspace guide. Your workspaces appear first.",
                  "مجاز صفحات تلاش کریں یا اپنے کام کی جگہ کا رہنما منتخب کریں۔ آپ کی جگہیں پہلے دکھتی ہیں۔",
                )}
              </p>
              {workspaces.map((w) => (
                <button
                  key={w.code}
                  data-help="help.links"
                  onClick={() => open(w.page)}
                >
                  {ur ? w.label_ur : w.label}
                </button>
              ))}
            </>
          ) : page ? (
            <>
              <h1>{ur ? page.titleUr : page.title}</h1>
              <p className="lead">
                {!outline && selected === "settings"
                  ? t(
                      "Before sign-in: check this terminal's connection, identity and display preferences.",
                      "سائن اِن سے پہلے: اس ٹرمینل کا رابطہ، شناخت اور ڈسپلے دیکھیں۔",
                    )
                  : ur
                    ? page.purposeUr
                    : page.purpose}
              </p>
              <h2>{t("Steps and controls", "مراحل اور کنٹرول")}</h2>
              {instructions(selected)}
              <h2>{t("Frequently asked questions", "عام سوالات")}</h2>
              {(ur ? page.faqUr : page.faq)
                .filter((_, i) => outline || selected !== "settings" || i > 0)
                .map(([q, a]) => (
                  <section key={q}>
                    <h3>{q}</h3>
                    <p>{a}</p>
                  </section>
                ))}
              {outline && faq(selected)}
              {phase1Screens.includes(selected) &&
                (outline || selected !== "settings") && (
                  <figure className="handbook-example">
                    <img
                      src={
                        new URL(
                          `handbook/${selected}-${ur ? "ur" : "en"}.png`,
                          document.baseURI,
                        ).href
                      }
                      alt={t(
                        `${page.title} — synthetic DEV example`,
                        `${page.titleUr} — فرضی ڈیَو مثال`,
                      )}
                    />
                    <figcaption>
                      {t(
                        "Synthetic DEV screen example. Your records and available actions depend on permissions and current server state.",
                        "فرضی ڈیَو صفحے کی مثال۔ آپ کے ریکارڈ اور اقدامات اجازت اور سرور کی موجودہ حالت پر ہیں۔",
                      )}
                    </figcaption>
                  </figure>
                )}
              {selected === "settings" && allowed.has("it_console") && (
                <figure className="handbook-example">
                  <img
                    src={
                      new URL(
                        `handbook/settings-it-${ur ? "ur" : "en"}.png`,
                        document.baseURI,
                      ).href
                    }
                    alt={t(
                      "Settings system hardware — synthetic DEV example",
                      "نظام کے آلات — فرضی ڈیَو مثال",
                    )}
                  />
                  <figcaption>
                    {t(
                      "Authorized system sections. No credentials are shown in this example.",
                      "مجاز نظام کے حصے۔ اس مثال میں کوئی خفیہ کوائف نہیں۔",
                    )}
                  </figcaption>
                </figure>
              )}
              {workspaces.length > 0 && (
                <>
                  <h2>
                    {t(
                      "Workspace guides and role tasks",
                      "کام کی جگہ کے رہنما اور کردار کے کام",
                    )}
                  </h2>
                  {workspaces.map((w) => (
                    <button
                      data-help="help.links"
                      key={w.code}
                      onClick={() => open(w.page)}
                    >
                      {ur ? w.label_ur : w.label} ·{" "}
                      {t("foundation guide", "بنیادی رہنما")}
                    </button>
                  ))}
                </>
              )}
            </>
          ) : selectedWorkspace ? (
            <>
              <h1>
                {ur ? selectedWorkspace.label_ur : selectedWorkspace.label} ·{" "}
                {foundationJourney.title[lang]}
              </h1>
              <p className="notice">
                {t(
                  "Scope: the eleven Phase 1 screens, including the permitted System (IT) parts of Settings. Later clinical, financial and other IT workspace journeys remain outside this guide. Available tasks follow your combined permissions; a role name never grants an action.",
                  "دائرہ: پہلے مرحلے کے گیارہ صفحات اور ترتیبات کے مجاز نظام (آئی ٹی) حصے۔ بعد کے طبی، مالی اور دیگر آئی ٹی کام رہنما سے باہر ہیں۔ کام موجودہ مجموعی اجازت پر ہیں؛ کردار کا نام خود اجازت نہیں دیتا۔",
                )}
              </p>
              <p className="lead">
                {workspaceFocus[selectedWorkspace.code]?.[lang]}
              </p>
              {(outline?.roles || []).map((role) => (
                <section key={role}>
                  <h2 dir="auto">{role}</h2>
                  <p>
                    {t(
                      "For this role, use the granted foundation task index below. Requesters track My requests; eligible approvers review and confirm decisions; establishment managers use Facility only when offered. A read-only account reads fresh records from an authorized upstream colleague and does not create or decide them.",
                      "اس کردار میں نیچے دیے مجاز بنیادی کام کریں۔ درخواست کنندہ اپنی درخواستیں دیکھے؛ مجاز منظوری دینے والا جائزہ اور تصدیق کرے؛ ہسپتال منتظم کو حصہ ملے تب ہی استعمال کرے۔ صرف پڑھنے والا مجاز ساتھی کے نئے ریکارڈ دیکھے، خود نہ بنائے یا فیصلہ کرے۔",
                    )}
                  </p>
                  <p>
                    {catalogue.roles
                      .find((r) => r.workspace === selectedWorkspace.code)
                      ?.roles.some(
                        (catalogueRole) =>
                          catalogueRole.replaceAll("_", "").toLowerCase() ===
                          role.replaceAll("_", "").toLowerCase(),
                      )
                      ? t(
                          "This role belongs to this workspace in the backend catalogue.",
                          "بیک اینڈ فہرست میں یہ کردار اس کام کی جگہ سے متعلق ہے۔",
                        )
                      : t(
                          "This is another role on your current account; only tasks granted to the account are listed.",
                          "یہ موجودہ اکاؤنٹ کا دوسرا کردار ہے؛ صرف اکاؤنٹ کے مجاز کام دکھتے ہیں۔",
                        )}
                  </p>
                </section>
              ))}
              <h2>
                {t(
                  "Start, work, hand over and finish",
                  "آغاز، کام، حوالگی اور اختتام",
                )}
              </h2>
              <ol>
                {foundationJourney.steps.map((step, i) => (
                  <li key={i}>{step[lang]}</li>
                ))}
              </ol>
              <h2>
                {t(
                  "How do I…? Supported foundation task index",
                  "کیسے کروں؟ مجاز بنیادی کاموں کی فہرست",
                )}
              </h2>
              {related.map((id) => (
                <section key={id}>
                  <h3>{ur ? help[id].titleUr : help[id].title}</h3>
                  {instructions(id, true)}
                  {faq(id)}
                  <button data-help="help.links" onClick={() => open(id)}>
                    {t(
                      "Open screen help and example",
                      "صفحے کی مدد اور مثال کھولیں",
                    )}
                  </button>
                </section>
              ))}
              <h2>{t("Exceptions and recovery", "استثنا اور بحالی")}</h2>
              <p>{foundationJourney.recovery[lang]}</p>
              <h2>{t("Glossary", "اصطلاحات")}</h2>
              {foundationJourney.glossary.map((word, i) => (
                <p key={i}>{word[lang]}</p>
              ))}
              <h2>
                {t(
                  "Guided DEV practice — human review pending",
                  "ڈیَو مشق — انسانی جائزہ باقی",
                )}
              </h2>
              <p>
                {t(
                  "Create a fresh synthetic incident through the app using an authorized demo account; note its returned number, reopen it in My reports and verify all values. Read a fresh notification or approval raised by the authorized upstream role. An eligible approver decides with requester and reviewer present; the requester verifies the outcome or a permitted withdrawal. Change a display preference, sign in again to check persistence, then restore it. Test F1 from a field and dialog, both zoom bounds and reset. Verify refusal of editing/deleting append-only reports and denied decisions. Record new IDs, actual outcomes, reviewer name and Urdu corrections; seeded browsing and agent tests do not pass this human journey.",
                  "مجاز ڈیمو اکاؤنٹ سے ایپ میں نیا فرضی واقعہ بنائیں، نمبر لکھیں، میری رپورٹیں میں کھول کر قدریں چیک کریں۔ مجاز کردار کی نئی اطلاع یا منظوری پڑھیں۔ مجاز فرد درخواست کنندہ اور جائزہ لینے والے کی موجودگی میں فیصلہ کرے؛ بھیجنے والا نتیجہ یا مجاز واپسی چیک کرے۔ ذاتی ترتیب بدل کر دوبارہ لاگ اِن سے برقرار ہونا دیکھیں، پھر بحال کریں۔ خانے اور مکالمے سے F1، دونوں سائز حدیں اور معمول آزمائیں۔ ناقابل ترمیم رپورٹ میں ترمیم/حذف اور ممنوع فیصلے کا انکار دیکھیں۔ نئے نمبر، اصل نتائج، جائزہ لینے والے کا نام اور اردو اصلاحات لکھیں؛ پرانے ریکارڈ یا ایجنٹ جانچ انسانی کامیابی نہیں۔",
                )}
              </p>
            </>
          ) : (
            <p>
              {t(
                "This help page is not available or permitted in this workspace.",
                "یہ صفحہ دستیاب یا مجاز نہیں ہے۔",
              )}
            </p>
          )}
          {(page || selectedWorkspace) && (
            <>
              <a
                data-help="help.links"
                href={`#help/${encodeURIComponent(selectedWorkspace ? selected : `screens/${selected}`)}`}
              >
                {t("Link to this help page", "اس مدد کے صفحے کا ربط")}
              </a>
              <p className="muted">
                {t("Contract revision", "معاہدے کی ترمیم")}:{" "}
                {catalogue.revision} ·{" "}
                {t(
                  "Human and language review pending",
                  "انسانی اور لسانی جائزہ باقی",
                )}
              </p>
              <button
                data-help="help.print"
                disabled={printing}
                onClick={async () => {
                  setPrinting(true);
                  setError(undefined);
                  try {
                    await call("print-help");
                  } catch (e) {
                    setError(e);
                  } finally {
                    setPrinting(false);
                  }
                }}
              >
                {t("Print handbook page", "رہنما صفحہ پرنٹ")}
              </button>
            </>
          )}
        </article>
      </div>
    </Modal>
  );
}
