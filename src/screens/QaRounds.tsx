import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/qa_rounds";
import { call, ApiError } from "../bridge";
import { ErrorBox, Field, Modal } from "../components";
import { DirectoryPicker } from "../DirectoryPicker";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import {
  formatHospitalTime,
  hospitalTimeInput,
  hospitalTimeToUtc,
  hospitalTimeZoneError,
} from "../hospital-time";
type Frequency = api.RoundIn["frequency"];
type Result = api.RoundAnswerIn["result"];
const frequencies: Frequency[] = [
  "DailyWeekly",
  "MonthlyQuarterly",
  "StorageQuarterly",
];
const frequencyName = (f: Frequency) =>
  ({
    DailyWeekly: t("Daily / weekly round", "روزانہ / ہفتہ وار دورہ"),
    MonthlyQuarterly: t("Monthly / quarterly round", "ماہانہ / سہ ماہی دورہ"),
    StorageQuarterly: t(
      "Drug storage site inspection",
      "ادویات ذخیرہ جگہ کا معائنہ",
    ),
  })[f];
const resultName = (r: Result) =>
  ({
    Satisfactory: t("Satisfactory", "تسلی بخش"),
    NeedsAttention: t("Needs attention", "توجہ درکار"),
    NotApplicable: t("Not applicable", "لاگو نہیں"),
  })[r];
const signature = (items: api.QaChecklistItemOut[]) =>
  items
    .map((i) => [i.item_id, i.row_version, i.position, i.text].join(":"))
    .join("|");
type Draft = {
  frequency: Frequency;
  items: api.QaChecklistItemOut[];
  answers: Record<
    number,
    { result: Result | ""; observation: string; recommendation: string }
  >;
  when: string;
  zone: string;
  remarks: string;
};
export function QaRounds({
  screenId = "qa_rounds",
  user,
  revision,
  connected,
  readOnly,
  noNewWork,
  timeZone,
  onOpenHelp,
}: {
  screenId?: "qa_rounds" | "qa_rounds_owner";
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
}) {
  const [statuses, setStatuses] = useState<api.RoundStatusOut[]>([]),
    [rounds, setRounds] = useState<api.RoundOut[]>([]),
    [allItems, setAllItems] = useState<api.QaChecklistItemOut[]>([]),
    [detail, setDetail] = useState<api.RoundDetailOut>(),
    [loading, setLoading] = useState(false),
    [opening, setOpening] = useState(false),
    [error, setError] = useState<unknown>(),
    [localError, setLocalError] = useState<unknown>(),
    [query, setQuery] = useState<Parameters<typeof api.listRounds>[0]>({
      limit: 100,
    }),
    [historyFrequency, setHistoryFrequency] = useState<Frequency | "">(""),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [catalogFrequency, setCatalogFrequency] =
      useState<Frequency>("DailyWeekly"),
    [includeInactive, setIncludeInactive] = useState(false),
    [mode, setMode] = useState<"round" | "newItem" | "editItem" | "action">(),
    [draft, setDraft] = useState<Draft>(),
    [itemSnapshot, setItemSnapshot] = useState<api.QaChecklistItemOut>(),
    [reviewed, setReviewed] = useState(false),
    [signBody, setSignBody] = useState<api.RoundIn>(),
    [signOpen, setSignOpen] = useState(false),
    [actionFinding, setActionFinding] = useState<api.RoundItemOut>(),
    [notice, setNotice] = useState(""),
    [paperBusy, setPaperBusy] = useState(false),
    [paperError, setPaperError] = useState<unknown>(),
    [paperNotice, setPaperNotice] = useState("");
  const selected = useRef<number | undefined>(undefined),
    generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    setReviewed(false);
    try {
      const [s, r, i, d] = await Promise.all([
        api.status(),
        api.listRounds(query),
        api.listItems({ include_inactive: true }),
        selected.current ? api.getRound(selected.current) : undefined,
      ]);
      if (n === generation.current) {
        setStatuses(s);
        setRounds(r);
        setAllItems(
          i.sort((a, b) => a.position - b.position || a.item_id - b.item_id),
        );
        setDetail(d);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, revision]);
  const write = useClinicalWrite(user, screenId, async (result, command) => {
    if (command.path === "/qa/rounds") {
      selected.current = result.round_id;
      setDetail(result);
      setDraft(undefined);
      setSignBody(undefined);
      setSignOpen(false);
      setQuery((q) => ({ ...q, before_id: undefined }));
    }
    setMode(undefined);
    setItemSnapshot(undefined);
    setActionFinding(undefined);
    setReviewed(false);
    await load();
  });
  useEffect(() => {
    if (write.error && !write.blocked) void load();
  }, [write.error, write.blocked, load]);
  const blocked = write.blocked || paperBusy,
    editable =
      connected && !readOnly && !loading && !error && !opening && !blocked,
    canConduct = user.permissions.includes("qa.round.conduct"),
    canManage = user.permissions.includes("qa.checklist.manage"),
    zoneError =
      hospitalTimeZoneError(timeZone) ||
      (draft && draft.zone !== timeZone
        ? new Error(
            t(
              "Hospital timezone changed. Cancel and reopen the unsent round.",
              "ہسپتال کا وقت بدل گیا۔ غیر ارسال دورہ منسوخ اور دوبارہ کھولیں۔",
            ),
          )
        : undefined);
  const dueError =
    write.error instanceof ApiError &&
    write.error.response.error?.code === "VALIDATION_ERROR" &&
    write.error.response.error.details &&
    "due_date" in write.error.response.error.details
      ? write.error.message
      : undefined;
  const activeFor = (f: Frequency) =>
      allItems.filter((i) => i.frequency === f && i.is_active),
    roundStale =
      !!draft &&
      signature(activeFor(draft.frequency)) !== signature(draft.items),
    currentItem =
      itemSnapshot && allItems.find((i) => i.item_id === itemSnapshot.item_id),
    itemStale =
      mode === "editItem" &&
      (!currentItem || currentItem.row_version !== itemSnapshot?.row_version),
    time = (v: string | null) =>
      v == null
        ? t("Not recorded", "درج نہیں")
        : timeZone
          ? formatHospitalTime(v, timeZone)
          : v;
  const resetDraft = () => {
    setMode(undefined);
    setDraft(undefined);
    setItemSnapshot(undefined);
    setSignOpen(false);
    setSignBody(undefined);
    setActionFinding(undefined);
    setReviewed(false);
    setLocalError(undefined);
    write.clearError();
  };
  const cancelDraft = () => {
    if (!blocked) resetDraft();
  };
  async function begin(f: Frequency) {
    if (!editable || mode || noNewWork || !canConduct || zoneError) return;
    setOpening(true);
    setLocalError(undefined);
    setNotice("");
    try {
      const items = (await api.listItems({ frequency: f })).sort(
        (a, b) => a.position - b.position || a.item_id - b.item_id,
      );
      if (!items.length)
        throw Error(
          t(
            "No active questions. Ask the authorised checklist manager.",
            "فعال سوال نہیں۔ مجاز فہرست منتظم سے کہیں۔",
          ),
        );
      setDraft({
        frequency: f,
        items,
        answers: Object.fromEntries(
          items.map((i) => [
            i.item_id,
            { result: "", observation: "", recommendation: "" },
          ]),
        ),
        when: hospitalTimeInput(Date.now(), timeZone!),
        zone: timeZone!,
        remarks: "",
      });
      setMode("round");
      setReviewed(false);
      void load();
    } catch (e) {
      setLocalError(e);
    } finally {
      setOpening(false);
    }
  }
  function changeAnswer(id: number, patch: Partial<Draft["answers"][number]>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            answers: { ...d.answers, [id]: { ...d.answers[id], ...patch } },
          }
        : d,
    );
    setReviewed(false);
  }
  function prepareSign(e: FormEvent) {
    e.preventDefault();
    if (
      !draft ||
      !editable ||
      roundStale ||
      !canConduct ||
      noNewWork ||
      zoneError
    )
      return;
    setLocalError(undefined);
    try {
      const body: api.RoundIn = {
        frequency: draft.frequency,
        conducted_at: hospitalTimeToUtc(draft.when, draft.zone),
        general_remarks: draft.remarks.trim() || null,
        items: draft.items.map((i) => {
          const a = draft.answers[i.item_id];
          if (
            !a.result ||
            (a.result === "NeedsAttention" && !a.observation.trim())
          )
            throw Error(
              t(
                "Answer every question; Needs attention requires the observation.",
                "ہر سوال کا جواب دیں؛ توجہ درکار میں مشاہدہ ضروری۔",
              ),
            );
          return {
            item_id: i.item_id,
            result: a.result,
            observation: a.observation.trim() || null,
            recommendation: a.recommendation.trim() || null,
          };
        }),
      };
      setSignBody(body);
      setSignOpen(true);
      setReviewed(false);
    } catch (e) {
      setLocalError(e);
    }
  }
  function sign() {
    if (
      !draft ||
      !signBody ||
      !reviewed ||
      !editable ||
      roundStale ||
      noNewWork ||
      !canConduct
    )
      return;
    const snapshot = draft.items;
    write.start(
      {
        method: "POST",
        path: "/qa/rounds",
        body: signBody,
        permission: "qa.round.conduct",
        protection: "idempotent",
        reconcilePath: "/qa/rounds?frequency=" + draft.frequency + "&limit=100",
        label: t("Conduct and sign this round", "یہ دورہ درج اور دستخط کریں"),
      },
      async () => {
        const current = (
          await api.listItems({ frequency: draft.frequency })
        ).sort((a, b) => a.position - b.position || a.item_id - b.item_id);
        if (signature(current) !== signature(snapshot))
          throw Error(
            t(
              "The checklist changed. Cancel the unsent round and reopen the current questions.",
              "فہرست بدل گئی۔ غیر ارسال دورہ منسوخ اور تازہ سوال کھولیں۔",
            ),
          );
      },
    );
  }
  function saveItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable || !canManage || !reviewed || itemStale) return;
    const f = new FormData(e.currentTarget),
      text = String(f.get("text") ?? "").trim(),
      position = Number(f.get("position"));
    if (mode === "newItem") {
      const body: api.QaChecklistItemIn = {
        code: String(f.get("code") ?? "").trim(),
        frequency: String(f.get("frequency")) as Frequency,
        text,
        position,
      };
      write.start({
        method: "POST",
        path: "/qa/checklist-items",
        body,
        permission: "qa.checklist.manage",
        protection: "idempotent",
        reconcilePath:
          "/qa/checklist-items?frequency=" +
          body.frequency +
          "&include_inactive=true",
        label: t("Add this checklist question", "یہ فہرست سوال شامل کریں"),
      });
    } else if (itemSnapshot)
      write.start({
        method: "PATCH",
        path: "/qa/checklist-items/" + itemSnapshot.item_id,
        body: {
          text,
          position,
          is_active: f.has("is_active"),
          expected_version: itemSnapshot.row_version,
        } satisfies api.QaChecklistItemUpdateIn,
        permission: "qa.checklist.manage",
        protection: "reconcile",
        reconcilePath:
          "/qa/checklist-items?frequency=" +
          itemSnapshot.frequency +
          "&include_inactive=true",
        label: t("Save this question version", "سوال کا یہ نسخہ محفوظ کریں"),
      });
  }
  function saveAction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable || !reviewed || !canConduct || !detail) return;
    const f = new FormData(e.currentTarget),
      body: api.QualityActionIn = {
        action_type: String(
          f.get("action_type"),
        ) as api.QualityActionIn["action_type"],
        description: String(f.get("description") ?? "").trim(),
        owner_user_id: Number(f.get("owner_user_id")),
        due_date: String(f.get("due_date")),
        department_id: f.get("department_id")
          ? Number(f.get("department_id"))
          : null,
      };
    if (!body.owner_user_id) {
      setLocalError(
        new Error(t("Choose the named action owner.", "نام سے ذمہ دار چنیں۔")),
      );
      return;
    }
    write.start({
      method: "POST",
      path: "/qa/rounds/" + detail.round_id + "/actions",
      body,
      permission: "qa.round.conduct",
      protection: "idempotent",
      reconcilePath: "/qa/rounds/" + detail.round_id,
      label: t("Raise this action from the round", "دورے سے یہ عمل اٹھائیں"),
    });
  }
  function reviewedHold() {
    const command = write.attempt?.body;
    write.clearError();
    setReviewed(false);
    if (command?.protection === "idempotent") {
      resetDraft();
      setNotice(
        t(
          "Hold closed after review. Read the original server record before a distinct new round, question or action. No replacement was submitted.",
          "جائزے کے بعد روک ختم۔ الگ نیا دورہ، سوال یا عمل سے پہلے اصل سرور ریکارڈ پڑھیں۔ متبادل نہیں بھیجا۔",
        ),
      );
    }
    void load();
  }
  async function paper(preview: boolean) {
    if (!detail || blocked || !connected) return;
    setPaperBusy(true);
    setPaperError(undefined);
    setPaperNotice("");
    try {
      const r = await call("clinical-pdf", {
        path: "/qa/rounds/" + detail.round_id + "/pdf",
        preview,
      });
      setPaperNotice(
        preview
          ? t("Signed round PDF opened.", "دستخط شدہ دورے کی پی ڈی ایف کھلی۔")
          : r.saved
            ? t("Signed round PDF saved.", "دستخط شدہ دورے کی پی ڈی ایف محفوظ۔")
            : t(
                "PDF save cancelled; the signed round is unchanged.",
                "پی ڈی ایف محفوظ منسوخ؛ دستخط شدہ دورہ برقرار۔",
              ),
      );
    } catch (e) {
      setPaperError(e);
    } finally {
      setPaperBusy(false);
    }
  }
  const feedback = (
    <ClinicalWriteFeedback write={write} onReviewed={reviewedHold} />
  );
  return (
    <section
      data-screen={screenId}
      data-unsaved={!!mode || signOpen}
      data-write-pending={write.blocked}
    >
      <div className="section-heading">
        <div>
          <h1>
            {t("Quality assurance rounds", "معیار کی یقین دہانی کے دورے")}
          </h1>
          <p>
            {t(
              "The in-charge checks each practice, signs the record and follows the findings with named actions.",
              "انچارج ہر عمل چیک، ریکارڈ دستخط اور نام والی ذمہ داری سے مشاہدات کی پیروی کرتا ہے۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="qar.refresh"
            disabled={write.busy || paperBusy || opening}
            onClick={() => void load()}
          >
            {t("Refresh rounds and checklists", "دورے اور فہرستیں تازہ کریں")}
          </button>
          <button data-help="qar.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="status">
          {t(
            "Reconnecting. No signatures or changes are queued offline.",
            "رابطہ بحال ہو رہا ہے۔ آف لائن دستخط یا تبدیلی جمع نہیں۔",
          )}
        </p>
      )}
      {!signOpen && feedback}
      <ErrorBox error={zoneError} />
      <ErrorBox error={localError} />
      <ErrorBox error={error} />
      {notice && <p role="status">{notice}</p>}
      {loading && (
        <p role="status">
          {t(
            "Reading rounds and checklists…",
            "دورے اور فہرستیں پڑھی جا رہی ہیں…",
          )}
        </p>
      )}
      {!loading && !error && (
        <>
          <div className="metric-grid qa-round-status">
            {statuses.map((s) => (
              <article
                className={s.is_due ? "card late-entries" : "card"}
                key={s.frequency}
              >
                <h2>{frequencyName(s.frequency)}</h2>
                <p>
                  {s.is_due
                    ? t("Due", "مقررہ معائنہ باقی")
                    : t("Within the current interval", "موجودہ وقفے کے اندر")}
                </p>
                <p>
                  {t(
                    "Active questions / interval days",
                    "فعال سوال / وقفے کے دن",
                  )}
                  : {s.active_items} / {s.interval_days}
                </p>
                <p>
                  {s.last_round_number ?? t("Never conducted", "ابھی نہیں ہوا")}{" "}
                  · {time(s.last_conducted_at)}
                </p>
                {canConduct && (
                  <button
                    data-help="qar.begin"
                    disabled={!editable || !!mode || noNewWork || !!zoneError}
                    onClick={() => void begin(s.frequency)}
                  >
                    {t("Conduct this round", "یہ دورہ کریں")}
                  </button>
                )}
              </article>
            ))}
          </div>
          <h2>{t("Signed rounds", "دستخط شدہ دورے")}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (blocked || mode || (dateFrom && dateTo && dateFrom > dateTo))
                return;
              setQuery({
                frequency: historyFrequency || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                limit: 100,
              });
            }}
          >
            <fieldset disabled={blocked || !!mode}>
              <legend>{t("History filters", "تاریخ کے فلٹر")}</legend>
              <div className="form-grid">
                <Field label={t("Checklist", "فہرست")}>
                  <select
                    data-help="qar.history"
                    value={historyFrequency}
                    onChange={(e) =>
                      setHistoryFrequency(e.target.value as Frequency | "")
                    }
                  >
                    <option value="">
                      {t("All checklists", "تمام فہرستیں")}
                    </option>
                    {frequencies.map((f) => (
                      <option key={f} value={f}>
                        {frequencyName(f)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("From", "سے")}>
                  <input
                    data-help="qar.history"
                    name="date_from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </Field>
                <Field label={t("To", "تک")}>
                  <input
                    data-help="qar.history"
                    name="date_to"
                    type="date"
                    min={dateFrom || undefined}
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </Field>
              </div>
              <button data-help="qar.history">
                {t("Apply round filters", "دوروں کے فلٹر لگائیں")}
              </button>
            </fieldset>
          </form>
          {!rounds.length ? (
            <p>
              {t(
                "No signed rounds match this page and period. Conduct a round if due, or change the filters.",
                "اس صفحے و مدت میں دستخط دورہ نہیں۔ مقررہ معائنہ کریں یا فلٹر بدلیں۔",
              )}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Round", "دورہ"),
                      t("Checklist", "فہرست"),
                      t("Conducted / by", "معائنہ / کرنے والا"),
                      t("Findings", "مشاہدات"),
                      t("Next", "اگلا قدم"),
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r) => (
                    <tr key={r.round_id}>
                      <td>{r.round_number}</td>
                      <td>{frequencyName(r.frequency)}</td>
                      <td>
                        {time(r.conducted_at)} · {r.conducted_by_name}
                      </td>
                      <td>{r.findings}</td>
                      <td>
                        <button
                          data-help="qar.open"
                          disabled={blocked || !!mode}
                          onClick={() => {
                            selected.current = r.round_id;
                            setLocalError(undefined);
                            void load();
                          }}
                        >
                          {t("Open signed round", "دستخط شدہ دورہ کھولیں")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rounds.length === 100 && (
            <button
              data-help="qar.history"
              disabled={blocked || !!mode}
              onClick={() =>
                setQuery((q) => ({
                  ...q,
                  before_id: rounds[rounds.length - 1].round_id,
                }))
              }
            >
              {t("Older rounds", "پرانے دورے")}
            </button>
          )}
          {detail && (
            <article className="card">
              <h2>
                {detail.round_number} · {frequencyName(detail.frequency)}
              </h2>
              <p>{time(detail.conducted_at)}</p>
              <p>{detail.signed_stamp.text}</p>
              <p className="notice">
                {t(
                  "Signed and kept as recorded. Correct a mistake in the next round; this signed record cannot be edited.",
                  "دستخط کے ساتھ محفوظ۔ غلطی اگلے دورے میں درست کریں؛ اس دستخط ریکارڈ کی ترمیم نہیں۔",
                )}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {detail.general_remarks ??
                  t("General remarks not recorded", "عمومی نوٹ درج نہیں")}
              </p>
              {detail.items.map((i) => (
                <section className="card" key={i.item_id}>
                  <h3>
                    {i.position}. {i.text}
                  </h3>
                  <p>{resultName(i.result)}</p>
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {i.observation ??
                      t("Observation not recorded", "مشاہدہ درج نہیں")}
                  </p>
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {i.recommendation ??
                      t("Recommendation not recorded", "سفارش درج نہیں")}
                  </p>
                  {i.result === "NeedsAttention" && canConduct && (
                    <button
                      data-help="qar.raise"
                      disabled={!editable || !!mode}
                      onClick={() => {
                        setActionFinding(i);
                        setMode("action");
                        setReviewed(false);
                        write.clearError();
                      }}
                    >
                      {t(
                        "Raise action from this finding",
                        "اس مشاہدے سے عمل اٹھائیں",
                      )}
                    </button>
                  )}
                </section>
              ))}
              <div className="toolbar">
                <button
                  data-help="qar.pdf"
                  disabled={blocked || !connected}
                  onClick={() => void paper(true)}
                >
                  {t("Preview signed round PDF", "دستخط دورہ پی ڈی ایف دیکھیں")}
                </button>
                <button
                  data-help="qar.pdf"
                  disabled={blocked || !connected}
                  onClick={() => void paper(false)}
                >
                  {t("Save signed round PDF", "دستخط دورہ پی ڈی ایف محفوظ")}
                </button>
              </div>
              <h3>{t("Actions from this round", "اس دورے کے اعمال")}</h3>
              {detail.actions.length ? (
                detail.actions.map((a) => (
                  <p key={a.action_id}>
                    {a.action_number} · {a.description} · {a.owner_name} ·{" "}
                    {a.due_date} ·{" "}
                    {a.status === "Open"
                      ? t("Open", "کھلا")
                      : a.status === "Done"
                        ? t("Done", "مکمل")
                        : t("Cancelled", "منسوخ")}
                  </p>
                ))
              ) : (
                <p>
                  {t(
                    "No actions recorded from this round.",
                    "اس دورے سے عمل درج نہیں۔",
                  )}
                </p>
              )}
            </article>
          )}
          <h2>{t("Checklist questions", "فہرست کے سوال")}</h2>
          <div className="form-grid">
            <Field label={t("Checklist frequency", "فہرست کا وقفہ")}>
              <select
                data-help="qar.catalog"
                disabled={blocked || !!mode}
                value={catalogFrequency}
                onChange={(e) =>
                  setCatalogFrequency(e.target.value as Frequency)
                }
              >
                {frequencies.map((f) => (
                  <option key={f} value={f}>
                    {frequencyName(f)}
                  </option>
                ))}
              </select>
            </Field>
            <label>
              <input
                data-help="qar.catalog"
                type="checkbox"
                disabled={blocked || !!mode}
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              {t("Include retired questions", "سبک دوش سوال بھی")}
            </label>
          </div>
          {canManage && (
            <button
              data-help="qar.item-new"
              disabled={!editable || !!mode}
              onClick={() => {
                setMode("newItem");
                setReviewed(false);
                setItemSnapshot(undefined);
                write.clearError();
              }}
            >
              {t("Add checklist question", "فہرست کا سوال شامل کریں")}
            </button>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    t("Code / position", "کوڈ / ترتیب"),
                    t("Question", "سوال"),
                    t("Source", "ماخذ"),
                    t("Status", "حالت"),
                    t("Next", "اگلا قدم"),
                  ].map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allItems
                  .filter(
                    (i) =>
                      i.frequency === catalogFrequency &&
                      (includeInactive || i.is_active),
                  )
                  .map((i) => (
                    <tr key={i.item_id}>
                      <td>
                        {i.code} · {i.position}
                      </td>
                      <td>{i.text}</td>
                      <td>
                        {i.source ??
                          t(
                            "Establishment’s own question",
                            "ادارے کا اپنا سوال",
                          )}
                      </td>
                      <td>
                        {i.is_active
                          ? t("Active", "فعال")
                          : t("Retired", "سبک دوش")}
                      </td>
                      <td>
                        {canManage && (
                          <button
                            data-help="qar.item-edit"
                            disabled={!editable || !!mode}
                            onClick={() => {
                              setItemSnapshot(i);
                              setMode("editItem");
                              setReviewed(false);
                              write.clearError();
                            }}
                          >
                            {t(
                              "Change or retire question",
                              "سوال بدلیں یا سبک دوش",
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {mode === "round" && draft && (
        <form className="card" onSubmit={prepareSign}>
          <h2>
            {frequencyName(draft.frequency)} ·{" "}
            {t("Unsent inspection", "غیر ارسال معائنہ")}
          </h2>
          <ErrorBox error={zoneError} />
          {roundStale && (
            <p role="alert">
              {t(
                "The checklist changed. Keep these answers for comparison, then cancel and start with the current questions.",
                "فہرست بدل گئی۔ موازنے کو جوابات رکھیں، پھر منسوخ اور تازہ سوال سے شروع کریں۔",
              )}
            </p>
          )}
          <fieldset
            disabled={
              !editable || roundStale || noNewWork || !!zoneError || signOpen
            }
          >
            <Field
              label={t("When conducted", "معائنہ کب ہوا")}
              hint={draft.zone}
            >
              <input
                data-help="qar.when"
                name="conducted_at"
                type="datetime-local"
                required
                max={
                  !zoneError
                    ? hospitalTimeInput(Date.now(), draft.zone)
                    : undefined
                }
                value={draft.when}
                onChange={(e) => setDraft({ ...draft, when: e.target.value })}
              />
            </Field>
            {draft.items.map((i) => {
              const a = draft.answers[i.item_id];
              return (
                <section
                  className="card"
                  key={i.item_id}
                  data-question-id={i.item_id}
                >
                  <h3>
                    {i.position}. {i.text}
                  </h3>
                  <p>
                    {i.source ??
                      t("Establishment’s own question", "ادارے کا اپنا سوال")}
                  </p>
                  <Field label={t("Finding", "مشاہدے کا نتیجہ")}>
                    <select
                      data-help="qar.answer"
                      name={"answer_" + i.item_id}
                      required
                      value={a.result}
                      onChange={(e) =>
                        changeAnswer(i.item_id, {
                          result: e.target.value as Result,
                        })
                      }
                    >
                      <option value="">
                        {t("Choose after checking", "چیک کرنے کے بعد چنیں")}
                      </option>
                      {(
                        [
                          "Satisfactory",
                          "NeedsAttention",
                          "NotApplicable",
                        ] as const
                      ).map((r) => (
                        <option key={r} value={r}>
                          {resultName(r)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("Observation", "مشاہدہ")}>
                    <textarea
                      data-help="qar.observation"
                      required={a.result === "NeedsAttention"}
                      maxLength={1000}
                      value={a.observation}
                      onChange={(e) =>
                        changeAnswer(i.item_id, { observation: e.target.value })
                      }
                    />
                  </Field>
                  <Field label={t("Recommendation", "سفارش")}>
                    <textarea
                      data-help="qar.recommendation"
                      maxLength={1000}
                      value={a.recommendation}
                      onChange={(e) =>
                        changeAnswer(i.item_id, {
                          recommendation: e.target.value,
                        })
                      }
                    />
                  </Field>
                </section>
              );
            })}
            <Field label={t("General remarks", "عمومی نوٹ")}>
              <textarea
                data-help="qar.remarks"
                name="general_remarks"
                maxLength={4000}
                rows={4}
                value={draft.remarks}
                onChange={(e) =>
                  setDraft({ ...draft, remarks: e.target.value })
                }
              />
            </Field>
            <button data-help="qar.prepare">
              {t("Review and sign round", "دورہ دیکھیں اور دستخط کریں")}
            </button>
          </fieldset>
          <button
            type="button"
            data-help="qar.cancel"
            disabled={blocked}
            onClick={() => {
              if (
                window.confirm(
                  t(
                    "Discard this unsent inspection?",
                    "غیر ارسال معائنہ چھوڑ دیں؟",
                  ),
                )
              )
                cancelDraft();
            }}
          >
            {t("Cancel unsent round", "غیر ارسال دورہ منسوخ")}
          </button>
        </form>
      )}
      {(mode === "newItem" || mode === "editItem") && (
        <form
          className="card"
          key={itemSnapshot?.item_id ?? "new"}
          onSubmit={saveItem}
          onChangeCapture={() => setReviewed(false)}
        >
          <h2>
            {mode === "newItem"
              ? t("New checklist question", "نیا فہرست سوال")
              : t("Change or retire this question", "یہ سوال بدلیں یا سبک دوش")}
          </h2>
          {itemStale && (
            <p role="alert">
              {t(
                "This question version changed. Compare the current list, then cancel and reopen the latest question.",
                "سوال کا نسخہ بدل گیا۔ تازہ فہرست ملائیں، منسوخ اور نیا نسخہ کھولیں۔",
              )}
            </p>
          )}
          <fieldset disabled={!editable || !canManage || itemStale}>
            {mode === "newItem" ? (
              <>
                <Field label={t("New question code", "نئے سوال کا کوڈ")}>
                  <input
                    data-help="qar.item-code"
                    name="code"
                    required
                    pattern="[A-Z0-9_]{2,40}"
                    maxLength={40}
                  />
                </Field>
                <Field label={t("Frequency", "وقفہ")}>
                  <select
                    data-help="qar.item-frequency"
                    name="frequency"
                    defaultValue={catalogFrequency}
                  >
                    {frequencies.map((f) => (
                      <option key={f} value={f}>
                        {frequencyName(f)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <p>
                {itemSnapshot?.code} ·{" "}
                {itemSnapshot && frequencyName(itemSnapshot.frequency)}
              </p>
            )}
            <Field label={t("Question text", "سوال کی عبارت")}>
              <textarea
                data-help="qar.item-text"
                name="text"
                required
                minLength={3}
                maxLength={300}
                defaultValue={itemSnapshot?.text}
              />
            </Field>
            <Field label={t("Position", "ترتیب")}>
              <input
                data-help="qar.item-position"
                name="position"
                type="number"
                required
                min={1}
                max={999}
                step={1}
                defaultValue={itemSnapshot?.position ?? 100}
              />
            </Field>
            {mode === "editItem" && (
              <label>
                <input
                  data-help="qar.item-active"
                  name="is_active"
                  type="checkbox"
                  defaultChecked={itemSnapshot?.is_active}
                />
                {t("Active in future rounds", "اگلے دوروں میں فعال")}
              </label>
            )}
            <label>
              <input
                data-help="qar.item-review"
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              {t(
                "I reviewed the wording and its effect on future rounds; past signed rounds are unchanged.",
                "عبارت اور اگلے دوروں پر اثر چیک؛ پچھلے دستخط دورے برقرار۔",
              )}
            </label>
            <button data-help="qar.item-submit" disabled={!reviewed}>
              {t("Save checklist question", "فہرست سوال محفوظ کریں")}
            </button>
          </fieldset>
          <button
            type="button"
            data-help="qar.cancel"
            disabled={blocked}
            onClick={cancelDraft}
          >
            {t("Cancel unsent question change", "غیر ارسال سوال تبدیلی منسوخ")}
          </button>
        </form>
      )}
      {mode === "action" && detail && (
        <form
          className="card"
          onSubmit={saveAction}
          onChangeCapture={() => setReviewed(false)}
        >
          <h2>
            {t("Action from signed finding", "دستخط مشاہدے سے عمل")} ·{" "}
            {detail.round_number}
          </h2>
          <p>
            {actionFinding?.text} · {actionFinding?.observation}
          </p>
          <fieldset disabled={!editable || !canConduct}>
            <Field label={t("Action type", "عمل کی قسم")}>
              <select
                data-help="qar.action-type"
                name="action_type"
                required
                defaultValue=""
              >
                <option value="">{t("Choose a type", "قسم چنیں")}</option>
                <option value="Corrective">{t("Corrective", "اصلاحی")}</option>
                <option value="Preventive">{t("Preventive", "احتیاطی")}</option>
              </select>
            </Field>
            <Field label={t("Work to do", "کرنے کا کام")}>
              <textarea
                data-help="qar.action-description"
                name="description"
                required
                minLength={5}
                maxLength={1000}
              />
            </Field>
            <Field label={t("Named owner", "نام سے ذمہ دار")}>
              <DirectoryPicker
                data-help="qar.owner"
                path="/quality/record-review/people"
                idField="user_id"
                name="owner_user_id"
                userId
                required
              />
            </Field>
            <Field label={t("Department", "شعبہ")}>
              <DirectoryPicker
                data-help="qar.department"
                path="/admin/departments"
                idField="department_id"
                name="department_id"
              />
            </Field>
            <Field label={t("Due date", "آخری تاریخ")}>
              <input
                aria-invalid={dueError ? true : undefined}
                aria-describedby={dueError ? "qar-due-error" : undefined}
                data-help="qar.due"
                name="due_date"
                type="date"
                required
              />
              {dueError && (
                <small id="qar-due-error" className="field-error">
                  {t("Check the due date.", "آخری تاریخ چیک کریں۔")} {dueError}
                </small>
              )}
            </Field>
            <label>
              <input
                data-help="qar.action-review"
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              {t(
                "I checked the finding, owner, work and due date.",
                "مشاہدہ، ذمہ دار، کام اور تاریخ چیک۔",
              )}
            </label>
            <button data-help="qar.action-submit" disabled={!reviewed}>
              {t("Raise this action once", "یہ عمل ایک بار اٹھائیں")}
            </button>
          </fieldset>
          <button
            type="button"
            data-help="qar.cancel"
            disabled={blocked}
            onClick={cancelDraft}
          >
            {t("Cancel unsent action", "غیر ارسال عمل منسوخ")}
          </button>
        </form>
      )}
      <ErrorBox error={paperError} />
      {paperNotice && <p role="status">{paperNotice}</p>}
      {signOpen && draft && signBody && (
        <Modal
          title={t(
            "Sign and keep this QA round",
            "معیار دورہ دستخط اور محفوظ کریں",
          )}
          closable={!write.blocked}
          onClose={() => {
            if (!write.blocked) {
              setSignOpen(false);
              setReviewed(false);
            }
          }}
        >
          <p>
            {frequencyName(draft.frequency)} · {time(signBody.conducted_at)}
          </p>
          <p>
            {t(
              "Signing is the submission. Your in-charge stamp will be applied and the round kept as signed. A mistake is corrected by the next round; this record cannot be edited.",
              "ارسال ہی دستخط ہیں۔ انچارج کی مہر لگے گی اور دورہ محفوظ۔ غلطی اگلے دورے میں درست؛ اس ریکارڈ کی ترمیم نہیں۔",
            )}
          </p>
          <p>
            {t("Questions / needs attention", "سوال / توجہ درکار")}:{" "}
            {signBody.items.length} /{" "}
            {signBody.items.filter((i) => i.result === "NeedsAttention").length}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{signBody.general_remarks}</p>
          <ErrorBox error={error} />
          <button
            data-help="qar.refresh"
            disabled={write.blocked}
            onClick={() => void load()}
          >
            {t("Refresh current checklist", "موجودہ فہرست تازہ کریں")}
          </button>
          <label>
            <input
              data-help="qar.sign-review"
              type="checkbox"
              disabled={!editable || roundStale}
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t(
              "I reviewed every answer and understand this is the final signed record.",
              "ہر جواب پڑھا اور یہ حتمی دستخط ریکارڈ سمجھا۔",
            )}
          </label>
          <button
            data-help="qar.sign"
            disabled={!editable || roundStale || !reviewed}
            onClick={sign}
          >
            {t("Conduct and sign once", "ایک بار درج اور دستخط")}
          </button>
          {feedback}
        </Modal>
      )}
    </section>
  );
}
