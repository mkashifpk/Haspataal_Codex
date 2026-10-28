import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../bridge";
import { Empty, ErrorBox, Field, LoadState, Modal } from "../components";
import { bilingual as t, tr } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as beds from "../generated/bed_matrix";
import { useClinicalWrite } from "../clinical-write";
import { canRetryWrite } from "../write-attempt";
import { formatHospitalTime } from "../hospital-time";
import {
  applyBedStateEvent,
  bedAccess,
  bedSnapshot,
  bedStateBody,
  bedStates,
  bedTargets,
  bedTone,
  verifiedMatrixBed,
} from "../bed-matrix-policy";
type Draft = {
  bed: beds.BedMatrixBedOut;
  ward: string;
  state: beds.BedStateIn["state"];
  reason: string;
  ack: boolean;
};
const label = (state: string) =>
  ({
    Available: t("Available", "دستیاب"),
    Reserved: t("Reserved", "محفوظ"),
    Occupied: t("Occupied", "زیر استعمال"),
    Dirty: t("Dirty", "صفائی طلب"),
    Cleaning: t("Cleaning", "صفائی جاری"),
    OutOfService: t("Out of service", "خدمت سے باہر"),
  })[state] || state;
export function BedMatrix({
  user,
  establishment,
  connected,
  stream,
  timeZone,
  onAdmission,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
  onAdmission?: (id: number) => void;
}) {
  const view = establishment.views.screens.find(
    (s) => s.screen_id === "bed_matrix",
  )?.view;
  const access = bedAccess(view, user.permissions),
    live = connected && stream === "Live";
  const [matrix, setMatrix] = useState<beds.BedMatrixOut>(),
    [error, setError] = useState<unknown>(),
    [loading, setLoading] = useState(true),
    [syncing, setSyncing] = useState(false),
    [pending, setPending] = useState<Set<number>>(new Set());
  const [ward, setWard] = useState(""),
    [state, setState] = useState(""),
    [find, setFind] = useState(""),
    [selected, setSelected] = useState<number>();
  const [draft, setDraft] = useState<Draft>(),
    [review, setReview] = useState<beds.BedStateIn>(),
    [draftError, setDraftError] = useState<unknown>(),
    [rebasing, setRebasing] = useState(false);
  const generation = useRef(0),
    matrixRef = useRef(matrix),
    rebaseFlight = useRef(false),
    root = useRef<HTMLElement>(null);
  matrixRef.current = matrix;
  const refresh = useCallback(async () => {
    const n = ++generation.current;
    if (!access.read) {
      setMatrix(undefined);
      return;
    }
    setLoading(!matrixRef.current);
    setSyncing(true);
    setError(undefined);
    try {
      const value = await beds.bedMatrix({ include_beds: true });
      if (n === generation.current) {
        setMatrix(value);
        setPending(new Set());
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) {
        setLoading(false);
        setSyncing(false);
      }
    }
  }, [access.read]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refreshRef.current(), 150);
    };
    const stop = window.terminal.subscribe((e) => {
      if (e.type === "event" && e.event_type === "bed.state_changed") {
        generation.current++;
        setMatrix((m) => (m ? applyBedStateEvent(m, e) : m));
        setSyncing(true);
        if (Number.isSafeInteger(e.payload?.bed_id))
          setPending((old) => new Set(old).add(e.payload.bed_id));
        schedule();
      }
      if (e.type === "stream" && e.status === "Live" && e.resync) {
        generation.current++;
        setSyncing(true);
        schedule();
      }
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, []);
  const write = useClinicalWrite(user, "bed-matrix", async (value, command) => {
    const result = value as beds.BedOut;
    if (command.path !== "/beds/" + result.bed_id + "/state")
      throw Error(
        t(
          "The returned bed differs from the original request. Ask IT to reconcile it.",
          "واپس بستر اصل درخواست سے مختلف ہے۔ آئی ٹی سے نتیجہ چیک کرائیں۔",
        ),
      );
    setDraft(undefined);
    setReview(undefined);
    setSelected(result.bed_id);
    await refreshRef.current();
  });
  const blocked = write.blocked || rebasing;
  const current = !error
    ? verifiedMatrixBed(matrix, selected)
    : undefined;
  const changed =
    !!draft &&
    (!matrix?.beds?.some(
      (b) =>
        b.bed_id === draft.bed.bed_id && (matrix?.wards||[]).some(w=>w.ward_id===b.ward_id) &&
        bedSnapshot(b) === bedSnapshot(draft.bed),
    ) ||
      pending.has(draft.bed.bed_id));
  const time = (v: string) => (timeZone ? formatHospitalTime(v, timeZone) : v);
  useEffect(() => {
    if (write.error instanceof ApiError) void refreshRef.current();
  }, [write.error]);
  useEffect(() => {
    if (!blocked) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [blocked]);
  function begin(target: beds.BedStateIn["state"]) {
    if (
      !current ||
      blocked ||
      syncing ||
      !live ||
      !access.manage ||
      !bedTargets(current).includes(target)
    )
      return;
    setDraft({
      bed: structuredClone(current),
      ward:
        matrix?.wards.find((w) => w.ward_id === current.ward_id)?.name ||
        String(current.ward_id),
      state: target,
      reason: "",
      ack: false,
    });
    setReview(undefined);
    setDraftError(undefined);
    write.clearError();
  }
  function close() {
    if (blocked) return;
    if (
      draft?.reason &&
      !window.confirm(
        t(
          "Discard this unsaved bed service reason?",
          "بستر کی غیر محفوظ وجہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    setDraft(undefined);
    setReview(undefined);
    setDraftError(undefined);
  }
  function prepare() {
    if (!draft || changed || blocked || syncing || !live) return;
    try {
      setReview(bedStateBody(draft.bed, draft.state, draft.reason, draft.ack));
      setDraftError(undefined);
    } catch (e) {
      setDraftError(e);
    }
  }
  async function rebase() {
    if (!draft || write.blocked || rebaseFlight.current) return;
    rebaseFlight.current = true;
    setRebasing(true);
    setDraftError(undefined);
    try {
      const m = await beds.bedMatrix({ include_beds: true }),
        b = verifiedMatrixBed(m, draft.bed.bed_id);
      if (!b || b.ward_id !== draft.bed.ward_id)
        throw Error(
          t(
            "The original bed is missing or moved. Keep your reason for reference and ask IT.",
            "اصل بستر غائب یا منتقل ہے۔ وجہ حوالے کے لیے رکھیں اور آئی ٹی سے کہیں۔",
          ),
        );
      generation.current++;
      setMatrix(m);
      setPending(new Set());
      setError(undefined);
      setSyncing(false);
      setDraft({ ...draft, bed: b, ack: false });
      setReview(undefined);
      write.clearError();
    } catch (e) {
      setDraftError(e);
    } finally {
      rebaseFlight.current = false;
      setRebasing(false);
    }
  }
  function submit() {
    const d = draft,
      body = review;
    if (!d || !body || blocked || changed || syncing || !live) return;
    write.start(
      {
        method: "POST",
        path: "/beds/" + d.bed.bed_id + "/state",
        body,
        permission: "ipd.bed.manage",
        protection: "idempotent",
        reconcilePath: "/beds/matrix?include_beds=true",
        label: d.ward + " / " + d.bed.label + " → " + label(body.state),
      },
      async () => {
        const [me, est, m] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          beds.bedMatrix({ include_beds: true }),
        ]);
        const b = verifiedMatrixBed(m, d.bed.bed_id),
          a = bedAccess(
            est.views.screens.find((s) => s.screen_id === "bed_matrix")?.view,
            me.permissions,
          );
        if (
          me.user_id !== user.user_id ||
          !a.manage ||
          !b ||
          bedSnapshot(b) !== bedSnapshot(d.bed)
        ) {
          await refreshRef.current();
          throw Error(
            t(
              "This bed or your permission changed. Read the current bed and keep your reason.",
              "بستر یا اجازت بدلی۔ وجہ رکھ کر تازہ بستر پڑھیں۔",
            ),
          );
        }
        bedStateBody(b, body.state, body.reason, true);
      },
    );
  }
  if (!access.visible)
    return (
      <Empty>
        {t(
          "This screen is unavailable in the current service view.",
          "موجودہ خدمت میں یہ صفحہ دستیاب نہیں۔",
        )}
      </Empty>
    );
  if (!access.read) return <Empty>{tr("Permission required")}</Empty>;
  const shownWards = (!error ? matrix?.wards || [] : []).filter(
    (w) => !ward || String(w.ward_id) === ward,
  );
  const unverifiedBeds = !error ? (matrix?.beds||[]).filter(b=>!matrix?.wards.some(w=>w.ward_id===b.ward_id)) : [];
  const matches = (b: beds.BedMatrixBedOut) =>
    (!state || b.current_state === state) &&
    (!find.trim() ||
      [b.label, b.patient_name || "", b.mrn || ""].some((v) =>
        v.toLocaleLowerCase().includes(find.trim().toLocaleLowerCase()),
      ));
  const originalObserved = (
    write.observed as beds.BedMatrixOut | undefined
  )?.beds?.find((b) => draft && b.bed_id === draft.bed.bed_id);
  const feedback = (
    <>
      <ErrorBox error={write.error} verbatim />
      {write.notice && <p role="status">{write.notice}</p>}
      {write.attempt && !write.busy && (
        <section className="notice" role="alert">
          <p>
            {t(
              "The result is unknown. Keep this original request; do not create a replacement.",
              "نتیجہ نامعلوم ہے۔ اصل درخواست رکھیں؛ متبادل نہ بنائیں۔",
            )}
          </p>
          <p>
            {write.attempt.body.label} · <code>{write.attempt.key}</code>
          </p>
          {canRetryWrite(write.attempt) && (
            <button data-help="beds.recovery" onClick={write.retry}>
              {t("Retry original request", "اصل درخواست دوبارہ بھیجیں")}
            </button>
          )}
          <button
            data-help="beds.recovery"
            onClick={() => void write.inspect()}
          >
            {t("Read original bed result", "اصل بستر کا نتیجہ پڑھیں")}
          </button>
          {write.checked && (
            <>
              {originalObserved ? (
                <p>
                  <bdi>{originalObserved.label}</bdi> ·{" "}
                  {label(originalObserved.current_state)} ·{" "}
                  <bdi>{time(originalObserved.state_changed_at)}</bdi>
                </p>
              ) : (
                <p>
                  {t(
                    "Original bed was not found. Keep the original request and ask IT.",
                    "اصل بستر نہیں ملا۔ اصل درخواست رکھیں اور آئی ٹی سے کہیں۔",
                  )}
                </p>
              )}
              <button
                data-help="beds.recovery"
                disabled={!originalObserved}
                onClick={() => {
                  write.release();
                  void refreshRef.current();
                }}
              >
                {t(
                  "Bed result reviewed; return to draft",
                  "بستر کا نتیجہ چیک؛ مسودے پر واپس",
                )}
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
  return (
    <section
      className="bed-matrix"
      ref={root}
      data-write-pending={write.blocked || undefined}
      data-unsaved={!!draft || undefined}
    >
      <header className="bed-board-heading">
        <div>
          <h1>{t("Live bed matrix", "بستروں کی تازہ صورت حال")}</h1>
          <p>
            {t(
              "Choose a ward, read its bed states, and check the original bed before changing service readiness.",
              "وارڈ چنیں، بستروں کی حالت پڑھیں، خدمت بدلنے سے پہلے اصل بستر چیک کریں۔",
            )}
          </p>
        </div>
        <button
          data-help="beds.refresh"
          disabled={blocked}
          onClick={() => void refresh()}
        >
          {t("Refresh bed matrix", "بستر فہرست تازہ کریں")}
        </button>
      </header>
      <p role="status">
        {tr(connected ? stream : "Offline")}
        {syncing
          ? " · " + t("Refreshing bed details", "بستر کی تفصیل تازہ ہو رہی ہے")
          : ""}
        {view === "records"
          ? " · " +
            t(
              "Records only — no bed changes",
              "صرف ریکارڈ — بستر نہیں بدل سکتے",
            )
          : view === "open_work"
            ? " · " +
              t(
                "No new inpatient admissions from now on; existing bed work continues.",
                "اب نئے داخلے نہیں؛ موجودہ بستروں کا کام جاری۔",
              )
            : ""}
      </p>
      <LoadState loading={loading} error={error} retry={() => void refresh()} />
      {!draft && feedback}
      {unverifiedBeds.length>0&&<details className="notice" data-testid="unverified-beds"><summary data-help="beds.unverified">{unverifiedBeds.length} {t("beds need their ward verified", "بستروں کے وارڈ کی تصدیق چاہیے")}</summary><p>{t("These beds were returned without a ward summary. Service changes are unavailable until Admissions or IT verifies their ward. Refresh the matrix after it is corrected.", "یہ بستر وارڈ کی تفصیل کے بغیر آئے۔ داخلہ ڈیسک یا آئی ٹی کی وارڈ تصدیق تک خدمت بدلنا بند ہے۔ درستی کے بعد فہرست تازہ کریں۔")}</p><ul>{unverifiedBeds.map(b=><li key={b.bed_id}><bdi>{b.label} · #{b.bed_id}</bdi> · {label(b.current_state)}</li>)}</ul></details>}
      <fieldset disabled={blocked || !!draft}>
        <div className="bed-board-filters">
          <Field label={t("Ward to show", "دکھانے والا وارڈ")}>
            <select
              data-help="beds.filters"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            >
              <option value="">
                {t("All permitted wards", "تمام مجاز وارڈ")}
              </option>
              {matrix?.wards.map((w) => (
                <option key={w.ward_id} value={w.ward_id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Bed state to show", "دکھانے والی بستر حالت")}>
            <select
              data-help="beds.filters"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">{t("All bed states", "تمام حالتیں")}</option>
              {bedStates.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t(
              "Find a bed or returned patient",
              "بستر یا موصولہ مریض تلاش",
            )}
          >
            <input
              data-help="beds.filters"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </Field>
          <button
            data-help="beds.filters"
            onClick={() => {
              setWard("");
              setState("");
              setFind("");
            }}
          >
            {t("Clear bed filters", "بستر کی شرطیں صاف کریں")}
          </button>
        </div>
      </fieldset>
      <div
        className="bed-state-legend"
        aria-label={t("Bed state legend", "بستر کی حالتوں کی پہچان")}
      >
        {bedStates.map((s) => (
          <span key={s} className={"bed-state-label tone-" + bedTone[s]}>
            {label(s)}
          </span>
        ))}
      </div>
      <div className="bed-board-layout">
        <div className="bed-ward-stack">
          {!loading && !error && !shownWards.length && (
            <Empty>
              {t(
                "No wards in this returned scope. Clear filters or ask IT to check ward setup.",
                "اس دائرے میں وارڈ نہیں۔ شرط صاف یا آئی ٹی سے وارڈ ترتیب چیک کرائیں۔",
              )}
            </Empty>
          )}
          {shownWards.map((w) => {
            const rows =
              matrix?.beds?.filter(
                (b) => b.ward_id === w.ward_id && matches(b),
              ) || [];
            return (
              <section
                className="bed-ward"
                key={w.ward_id}
                data-testid={"bed-ward-" + w.ward_id}
              >
                <header>
                  <h2 dir="auto">
                    {w.name}{" "}
                    <small>
                      <bdi>{w.code}</bdi>
                    </small>
                  </h2>
                  <span>
                    {w.ward_type === "Other" ? t("Other", "دیگر") : tr(w.ward_type)} · {w.gender_restriction === "any" ? t("All genders", "تمام اصناف") : tr(w.gender_restriction)}
                  </span>
                </header>
                <p
                  className="bed-counts"
                  data-testid={"bed-counts-" + w.ward_id}
                >
                  {t("Available", "دستیاب")} <b>{w.available}</b> /{" "}
                  {w.total_beds} · {t("Reserved", "محفوظ")} {w.reserved} ·{" "}
                  {t("Occupied", "زیر استعمال")} {w.occupied} ·{" "}
                  {t("Turnover", "ڈسچارج / صفائی")} {w.turnover} ·{" "}
                  {t("Out of service", "خدمت سے باہر")} {w.out_of_service}
                </p>
                {matrix?.beds == null ? (
                  <p>
                    {t(
                      "Bed details were not returned. Refresh before selecting a bed.",
                      "بستر کی تفصیل نہیں آئی۔ چننے سے پہلے تازہ کریں۔",
                    )}
                  </p>
                ) : rows.length ? (
                  <div className="bed-ward-bays">
                    {rows.map((b) => (
                      <button
                        data-help="beds.select"
                        data-testid={"bed-tile-" + b.bed_id}
                        key={b.bed_id}
                        aria-pressed={selected === b.bed_id}
                        className={"bed-tile tone-" + bedTone[b.current_state]}
                        disabled={blocked || !!draft}
                        onClick={() => {
                          setSelected(b.bed_id);
                          requestAnimationFrame(() => {
                            const heading =
                              root.current?.querySelector<HTMLElement>(
                                "[data-bed-context]",
                              );
                            heading?.focus({ preventScroll: true });
                            if (window.matchMedia("(max-width:1100px)").matches)
                              heading?.scrollIntoView({ block: "nearest" });
                          });
                        }}
                      >
                        <strong dir="auto">{b.label}</strong>
                        <span>{label(b.current_state)}</span>
                        {pending.has(b.bed_id) ? (
                          <small>
                            {t(
                              "Occupant details updating",
                              "مریض کی تفصیل تازہ ہو رہی ہے",
                            )}
                          </small>
                        ) : (
                          <>
                            {b.patient_name && (
                              <small>
                                <bdi>
                                  {b.patient_name} · {b.mrn}
                                </bdi>
                              </small>
                            )}
                            {b.is_overflow && (
                              <small>{t("Overflow", "اضافی وارڈ")}</small>
                            )}
                            {b.discharge_blocked_on && (
                              <small>
                                {t("Waiting for", "منتظر")}:{" "}
                                {tr(b.discharge_blocked_on)}
                              </small>
                            )}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>
                    {t(
                      "No beds match these filters in this ward.",
                      "اس وارڈ میں ان شرطوں کا بستر نہیں۔",
                    )}
                  </p>
                )}
              </section>
            );
          })}
        </div>
        <aside className="bed-context card" aria-live="polite">
          {!current ? (
            <Empty>
              {t(
                "Select an actual bed to read its location and next permitted action.",
                "اصل بستر چن کر جگہ اور اگلا مجاز عمل پڑھیں۔",
              )}
            </Empty>
          ) : (
            <>
              <h2 dir="auto" tabIndex={-1} data-bed-context>
                {current.label}
              </h2>
              <p>
                {matrix?.wards.find((w) => w.ward_id === current.ward_id)?.name}
              </p>
              <p
                className={
                  "bed-state-label tone-" + bedTone[current.current_state]
                }
              >
                {label(current.current_state)}
              </p>
              <p>
                {t("State changed", "حالت بدلی")}:{" "}
                <bdi>{time(current.state_changed_at)}</bdi>
              </p>
              {pending.has(current.bed_id) ? (
                <p>
                  {t(
                    "Occupant details updating. Bed changes wait for the current read.",
                    "مریض تفصیل تازہ ہو رہی ہے؛ بستر بدلنے سے پہلے تازہ مطالعہ۔",
                  )}
                </p>
              ) : (
                <>
                  {current.admission_id && (
                    <p>
                      {t("Admission", "داخلہ")}{" "}
                      <bdi>#{current.admission_id}</bdi> ·{" "}
                      {tr(current.admission_status || "Not recorded")}
                    </p>
                  )}
                  {current.patient_name && (
                    <p>
                      <bdi>
                        {current.patient_name} · {current.mrn}
                      </bdi>
                    </p>
                  )}
                  {current.discharge_blocked_on && (
                    <p className="notice">
                      {t("Discharge waiting for", "ڈسچارج منتظر")}:{" "}
                      {tr(current.discharge_blocked_on)}
                    </p>
                  )}
                </>
              )}
              {access.manage ? (
                bedTargets(current).length ? (
                  <div className="actions">
                    {bedTargets(current).map((target) => (
                      <button
                        data-help="beds.service"
                        key={target}
                        disabled={blocked || !!draft || syncing || !live}
                        onClick={() => begin(target)}
                      >
                        {target === "OutOfService"
                          ? t(
                              "Take bed out of service",
                              "بستر خدمت سے باہر کریں",
                            )
                          : t(
                              "Return bed to service",
                              "بستر خدمت میں واپس کریں",
                            )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>
                    {t(
                      "Reserved and occupied beds cannot be taken out of service here. Use the admissions or ward workflow.",
                      "محفوظ اور زیر استعمال بستر یہاں خدمت سے باہر نہیں ہوتے۔ داخلہ یا وارڈ کا طریقہ استعمال کریں۔",
                    )}
                  </p>
                )
              ) : (
                <p>
                  {t(
                    "Your current permission or service view allows reading only.",
                    "موجودہ اجازت یا خدمت صرف مطالعہ دیتی ہے۔",
                  )}
                </p>
              )}
              {current.admission_id && onAdmission && (
                <button
                  data-help="beds.handover"
                  disabled={blocked || !!draft || pending.has(current.bed_id)}
                  onClick={() => onAdmission(current.admission_id!)}
                >
                  {t("Open this admission", "یہ داخلہ کھولیں")}
                </button>
              )}
              <p className="fine">
                {t(
                  "A bed number is a location, not patient identity. Use the verified admission before patient care.",
                  "بستر مقام ہے، مریض کی شناخت نہیں۔ نگہداشت سے پہلے اصل داخلہ تصدیق کریں۔",
                )}
              </p>
              <p className="fine">
                {t(
                  "Service readiness does not record physical cleaning or clear a discharge stage.",
                  "خدمت کی تیاری سے جسمانی صفائی یا ڈسچارج مرحلہ درج نہیں ہوتا۔",
                )}
              </p>
            </>
          )}
        </aside>
      </div>
      {draft && (
        <Modal
          title={t("Review bed service change", "بستر کی خدمت بدلنے کا جائزہ")}
          onClose={close}
          closable={!blocked}
        >
          <p>
            <bdi>
              {draft.ward} / {draft.bed.label}
            </bdi>{" "}
            · {label(draft.bed.current_state)} → {label(draft.state)}
          </p>
          <p>
            {t(
              "Check this actual bed and service readiness. This does not allocate a patient or certify physical cleaning.",
              "اسی اصل بستر اور تیاری کو چیک کریں۔ یہ مریض داخل یا جسمانی صفائی تصدیق نہیں کرتا۔",
            )}
          </p>
          {changed && (
            <p className="notice">
              {t(
                "This bed changed on the server. Your reason is kept; read it before a new review.",
                "سرور پر بستر بدلا۔ وجہ محفوظ؛ نئے جائزے سے پہلے تازہ پڑھیں۔",
              )}
            </p>
          )}
          <ErrorBox error={draftError} />
          <fieldset disabled={blocked || !!review}>
            <Field label={t("Bed service reason", "بستر کی خدمت کی وجہ")}>
              <textarea
                data-help="beds.reason"
                maxLength={300}
                value={draft.reason}
                onChange={(e) =>
                  setDraft({ ...draft, reason: e.target.value, ack: false })
                }
              />
            </Field>
            <label>
              <input
                data-help="beds.review"
                type="checkbox"
                checked={draft.ack}
                onChange={(e) => setDraft({ ...draft, ack: e.target.checked })}
              />
              {t(
                "I checked the actual bed, ward and readiness for this service change.",
                "میں نے اسی بستر، وارڈ اور خدمت کی تیاری چیک کی۔",
              )}
            </label>
          </fieldset>
          {review && (
            <section className="notice" data-testid="bed-service-review">
              <h3>
                {t(
                  "Confirm the original bed and reason",
                  "اصل بستر اور وجہ تصدیق کریں",
                )}
              </h3>
              <p dir="auto">
                {draft.ward} / {draft.bed.label} → {label(review.state)}
              </p>
              <p dir="auto">{review.reason}</p>
            </section>
          )}
          {feedback}
          <div className="actions">
            {!review ? (
              <button
                data-help="beds.review"
                disabled={blocked || changed || syncing || !live}
                onClick={prepare}
              >
                {t("Review bed change", "بستر کی تبدیلی کا جائزہ")}
              </button>
            ) : (
              <>
                <button
                  data-help="beds.confirm"
                  disabled={blocked || changed || syncing || !live}
                  onClick={submit}
                >
                  {t("Confirm bed change", "بستر کی تبدیلی تصدیق")}
                </button>
                <button
                  data-help="beds.review"
                  disabled={blocked}
                  onClick={() => setReview(undefined)}
                >
                  {t("Back to bed reason", "بستر کی وجہ پر واپس")}
                </button>
              </>
            )}
            <button
              data-help="beds.recovery"
              disabled={blocked}
              onClick={() => void rebase()}
            >
              {t(
                "Read current bed and keep reason",
                "وجہ رکھ کر تازہ بستر پڑھیں",
              )}
            </button>
            <button data-help="beds.close" disabled={blocked} onClick={close}>
              {t("Close bed draft", "بستر کا مسودہ بند کریں")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
