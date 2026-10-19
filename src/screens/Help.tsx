import { tr } from "../i18n";
import { useState } from "react";
import { help } from "../help";
import { call } from "../bridge";
import type { HandbookOut } from "../generated/help_center";
import { Modal } from "../components";
export function Help({
  screen,
  outline,
  language,
  onClose,
}: {
  screen: string;
  outline: HandbookOut | undefined;
  language: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(screen);
  const ur = language === "ur";
  const allowed = new Set(
    outline
      ? [
          ...outline.shared_screens,
          ...outline.workspaces.flatMap((w) => w.screens),
        ].map((s) => s.id)
      : ["connect_server", "login", "settings", "help_center"],
  );
  const pages = Object.entries(help).filter(([id]) => allowed.has(id));
  const found = pages.filter(([, p]) =>
    JSON.stringify(p).toLowerCase().includes(query.toLowerCase()),
  );
  const p = allowed.has(selected) ? help[selected] : undefined;
  return (
    <Modal title={ur ? "مدد اور رہنما" : "Help & handbook"} onClose={onClose}>
      <div className="help-layout">
        <aside>
          <input
            aria-label={tr("Search handbook")}
            placeholder={ur ? "رہنما تلاش کریں" : "Search this handbook"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {found.map(([id, p]) => (
            <button
              className={id === selected ? "selected" : ""}
              key={id}
              onClick={() => setSelected(id)}
            >
              {ur ? p.titleUr : p.title}
            </button>
          ))}
        </aside>
        <article className="help-article">
          {p ? (
            <>
              <span className="eyebrow">
                {ur ? "اردو مسودہ — انسانی جائزہ باقی ہے" : "STAFF HANDBOOK"}
              </span>
              <h1>{ur ? p.titleUr : p.title}</h1>
              <p className="lead">{ur ? p.purposeUr : p.purpose}</p>
              <ol>
                {(ur ? p.stepsUr : p.steps).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <h2>{ur ? "عام سوالات" : "Frequently asked questions"}</h2>
              {(ur ? p.faqUr : p.faq).map(([q, a]) => (
                <section key={q}>
                  <h3>{q}</h3>
                  <p>{a}</p>
                </section>
              ))}
              <button onClick={() => call("print-help")}>
                {ur ? "پرنٹ" : "Print handbook page"}
              </button>
            </>
          ) : (
            <p>
              {ur
                ? "یہ صفحہ دستیاب یا مجاز نہیں ہے۔"
                : "This help page is not available or permitted in this workspace."}
            </p>
          )}
        </article>
      </div>
    </Modal>
  );
}
