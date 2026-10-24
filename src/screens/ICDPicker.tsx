import { useEffect, useRef, useState } from "react";
import { bilingual as t } from "../i18n";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import * as icd from "../generated/icd_picker";

export function ICDPicker({
  onPick,
  disabled = false,
}: {
  onPick?: (code: string, term: icd.IcdDetailOut) => void;
  disabled?: boolean;
}) {
  const releases = useLoad(icd.releases, []),
    system = releases.data?.coding_system;
  const [mode, setMode] = useState<"search" | "browse">("search"),
    [q, setQ] = useState(""),
    [parent, setParent] = useState<string>(),
    [code, setCode] = useState<string>();
  const [items, setItems] = useState<icd.IcdSearchOut>(),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState<unknown>(),
    [picked, setPicked] = useState<icd.IcdDetailOut>();
  const generation = useRef(0);
  // A previous choice must not survive a changed search or hospital classification.
  useEffect(() => {
    setPicked(undefined);
    setCode(undefined);
  }, [q, mode, parent, system]);
  useEffect(() => {
    const n = ++generation.current;
    setItems(undefined);
    setSearchError(undefined);
    setSearching(false);
    if (
      !system ||
      releases.loading ||
      releases.error ||
      q.trim().length < 2 ||
      mode !== "search"
    )
      return;
    setSearching(true);
    const timer = setTimeout(() => {
      void icd
        .searchIcdCodes({ q: q.trim(), system, limit: 30 })
        .then((v) => {
          if (n === generation.current) setItems(v);
        })
        .catch((e) => {
          if (n === generation.current) setSearchError(e);
        })
        .finally(() => {
          if (n === generation.current) setSearching(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [q, mode, system, releases.loading, releases.error]);
  const browse = useLoad(
    () =>
      system && mode === "browse"
        ? icd.browse({ system, parent })
        : Promise.resolve(undefined),
    [system, mode, parent],
  );
  const detail = useLoad(
    () =>
      code && system
        ? icd.detail(encodeURIComponent(code), { system })
        : Promise.resolve(undefined),
    [code, system],
  );
  const selected =
    !detail.loading && !detail.error && detail.data?.code === code
      ? detail.data
      : undefined;
  const entries =
    (mode === "search"
      ? items?.items
      : !browse.loading && !browse.error
        ? browse.data?.items
        : []) || [];
  const ordered = [...entries].sort(
    (a, b) => Number(a.is_residual) - Number(b.is_residual),
  );
  const show = (c: string) => {
    setCode(c);
    setPicked(undefined);
  };
  return (
    <section data-help-screen="icd_picker">
      <div className="section-heading">
        <div>
          <h1>{t("ICD code picker", "تشخیصی کوڈ کا انتخاب")}</h1>
          <p>
            {t(
              "Find the most specific diagnosis code. Verify its title and place in the classification before choosing.",
              "زیادہ مخصوص تشخیصی کوڈ تلاش کریں۔ انتخاب سے پہلے عنوان اور درجہ بندی میں مقام چیک کریں۔",
            )}
          </p>
        </div>
        <button data-help="icd.refresh" onClick={() => void releases.reload()}>
          {t("Refresh classification", "درجہ بندی تازہ کریں")}
        </button>
      </div>
      <LoadState {...releases} retry={releases.reload} />
      {system && !releases.loading && !releases.error && (
        <>
          <p>
            <strong dir="ltr">{system}</strong> ·{" "}
            {releases.data?.releases
              .filter((r) => r.is_active && r.code_system === system)
              .map((r) => r.release_label)
              .join(", ") ||
              t("No active release loaded", "کوئی فعال فہرست لوڈ نہیں")}
          </p>
          <div className="actions">
            <button
              data-help="icd.search"
              aria-pressed={mode === "search"}
              onClick={() => setMode("search")}
            >
              {t("Search codes", "کوڈ تلاش کریں")}
            </button>
            <button
              data-help="icd.browse"
              aria-pressed={mode === "browse"}
              onClick={() => setMode("browse")}
            >
              {t("Browse classification", "درجہ بندی دیکھیں")}
            </button>
          </div>
          {mode === "search" ? (
            <>
              <Field
                label={t(
                  "Code prefix or diagnosis words",
                  "کوڈ کا آغاز یا تشخیص کے الفاظ",
                )}
                hint={t(
                  "Type at least 2 characters; results update after a short pause. Up to 30 matches; narrow the words for more specific results.",
                  "کم از کم 2 حروف لکھیں؛ مختصر وقفے پر نتائج آئیں گے۔ زیادہ سے زیادہ 30 نتائج؛ زیادہ مخصوص الفاظ سے تلاش محدود کریں۔",
                )}
              >
                <input
                  data-help="icd.search"
                  value={q}
                  maxLength={100}
                  onChange={(e) => {
                    generation.current++;
                    setItems(undefined);
                    setQ(e.target.value);
                    setCode(undefined);
                  }}
                />
              </Field>
              {searching && (
                <p role="status">
                  {t("Searching classification…", "درجہ بندی تلاش ہو رہی ہے…")}
                </p>
              )}
              <ErrorBox error={searchError} />
              {q.trim().length < 2 && (
                <Empty>
                  {t(
                    "Enter a code prefix or diagnosis to begin.",
                    "شروع کرنے کے لیے کوڈ یا تشخیص لکھیں۔",
                  )}
                </Empty>
              )}
              {items && !ordered.length && (
                <Empty>
                  {t(
                    "No matching codes. Try fewer or different words, or browse chapters.",
                    "کوئی کوڈ نہیں ملا۔ کم یا مختلف الفاظ آزمائیں یا ابواب دیکھیں۔",
                  )}
                </Empty>
              )}
            </>
          ) : (
            <>
              <button
                data-help="icd.browse"
                onClick={() => {
                  setParent(undefined);
                  setCode(undefined);
                }}
              >
                {t("All chapters", "تمام ابواب")}
              </button>
              <LoadState {...browse} retry={browse.reload} />
              {browse.data?.parent && !browse.loading && !browse.error && (
                <p>
                  <strong>
                    {browse.data.parent.code} · {browse.data.parent.title}
                  </strong>
                  <button
                    data-help="icd.browse"
                    onClick={() => {
                      setParent(browse.data?.parent?.parent_code || undefined);
                      setCode(undefined);
                    }}
                  >
                    {t("Parent level", "اوپر کی سطح")}
                  </button>
                </p>
              )}
              {!browse.loading && !browse.error && !ordered.length && (
                <Empty>
                  {t(
                    "No child entries at this level.",
                    "اس سطح پر مزید اندراج نہیں۔",
                  )}
                </Empty>
              )}
            </>
          )}
          <div className="split">
            <div>
              {ordered.map((r) => (
                <article className="card" key={r.code}>
                  <button
                    data-help="icd.detail"
                    className="list-row"
                    onClick={() => show(r.code)}
                  >
                    <strong dir="ltr">{r.code}</strong>
                    <span dir="auto">{r.title}</span>
                    {"parent_title" in r && (
                      <small className="muted" dir="auto">
                        {String(r.parent_title || "")}
                      </small>
                    )}
                  </button>
                  {r.is_residual && (
                    <p>
                      {t(
                        "Other specified / unspecified — prefer a specific code when supported by the clinical record.",
                        "دیگر مخصوص / غیر متعین — طبی ریکارڈ اجازت دے تو زیادہ مخصوص کوڈ چنیں۔",
                      )}
                    </p>
                  )}
                  {!r.is_leaf && (
                    <button
                      data-help="icd.browse"
                      onClick={() => {
                        setParent(r.code);
                        setMode("browse");
                        setCode(undefined);
                      }}
                    >
                      {t("Browse children", "ذیلی اندراج دیکھیں")}
                    </button>
                  )}
                </article>
              ))}
            </div>
            <div>
              {code && (
                <>
                  <LoadState {...detail} retry={detail.reload} />
                  {selected && (
                    <article className="card">
                      <h2 dir="auto">
                        <bdi>{selected.code}</bdi> · {selected.title}
                      </h2>
                      <p dir="auto">
                        {selected.ancestors
                          .map((a) => `${a.code} · ${a.title}`)
                          .join(" → ")}
                      </p>
                      <p>
                        {selected.code_system} · {selected.release_label}
                      </p>
                      {selected.uri && <p dir="ltr">{selected.uri}</p>}
                      {selected.is_residual && (
                        <p className="notice">
                          {t(
                            "This is a residual code. Review specific alternatives before selecting.",
                            "یہ غیر مخصوص کوڈ ہے۔ انتخاب سے پہلے مخصوص متبادل چیک کریں۔",
                          )}
                        </p>
                      )}
                      {selected.children.map((c) => (
                        <p key={c.code}>
                          <button
                            data-help="icd.detail"
                            onClick={() => show(c.code)}
                          >
                            <bdi>{c.code}</bdi> · {c.title}
                          </button>
                        </p>
                      ))}
                      {selected.kind === "category" && (
                        <button
                          data-help="icd.select"
                          disabled={disabled}
                          onClick={() => {
                            setPicked(selected);
                            onPick?.(selected.code, selected);
                          }}
                        >
                          {t(
                            "Choose this diagnosis code",
                            "یہ تشخیصی کوڈ چنیں",
                          )}
                        </button>
                      )}
                    </article>
                  )}
                </>
              )}
              {picked && (
                <p role="status">
                  <bdi>{picked.code}</bdi> · {picked.title} ·{" "}
                  {t(
                    "Chosen for this form; no clinical record has been saved by the picker.",
                    "اس فارم کے لیے منتخب؛ کوڈ چننے سے طبی ریکارڈ محفوظ نہیں ہوا۔",
                  )}
                </p>
              )}
            </div>
          </div>
        </>
      )}
      {releases.data?.icd11_citation && (
        <small className="muted" dir="ltr">
          {releases.data.icd11_citation}
        </small>
      )}
      {releases.data?.releases
        .filter((r) => r.is_active && r.code_system === system)
        .map((r) => (
          <p key={r.release_id}>
            <small dir="ltr">{r.licence_note}</small>
          </p>
        ))}
    </section>
  );
}
