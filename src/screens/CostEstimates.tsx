import { estimateView, type EstimateScreenId } from "../estimate-access";
import {
  searchPatients,
  getPatient,
  type PatientSearchHitOut,
} from "../generated/patient_search";
import { useEffect, useRef, useState } from "react";
import { api, call, ApiError } from "../bridge";
import {
  Details,
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
import * as e from "../generated/cost_estimates_admissions";
import { listAdmissions } from "../generated/pending_admissions";
import { useClinicalWrite } from "../clinical-write";
import { canRetryWrite } from "../write-attempt";
import { checkedEstimate, estimateSnapshot } from "../estimate-policy";
import { formatHospitalTime } from "../hospital-time";
type Draft = {
  kind: "prepare" | "explain" | "cancel";
  admissionId: number | null;
  subject?: { patient_id: number; patient_name: string; mrn: string };
  source?: e.EstimateDetailOut;
  body: e.EstimateIn;
  explain: e.EstimateExplainIn;
  cancel: string;
  ack: boolean;
};
export function CostEstimates({
  user,
  establishment,
  connected,
  stream,
  timeZone,
  screenId = "cost_estimates_admissions",
}: {
  screenId?: EstimateScreenId;
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
}) {
  const can = (p: string) => user.permissions.includes(p),
    view = estimateView(screenId, establishment),
    read =
      ["full", "open_work", "records"].includes(view || "") &&
      ["estimate.view", "estimate.prepare", "estimate.explain"].some(can),
    workView = view === "full" || view === "open_work",
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [known, setKnown] = useState(""),
    [record, setRecord] = useState<e.EstimateDetailOut>(),
    [draft, setDraft] = useState<Draft>(),
    [review, setReview] = useState<unknown>(),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [stale, setStale] = useState(false),
    [preview, setPreview] = useState<e.PrintOut_EstimatePrintFieldsOut_>();
  const current = useRef(record);
  current.current = record;
  const root = useRef<HTMLElement>(null),
    flight = useRef(false),
    generation = useRef(0);
  const [patientQuery, setPatientQuery] = useState(""),
    [patientHits, setPatientHits] = useState<PatientSearchHitOut[]>([]),
    [patientSearched,setPatientSearched]=useState(false);
  async function findPatient() {
    if (patientQuery.trim().length < 2) return;
    setBusy(true);
    setError(undefined);
    setPatientSearched(false);
    try {
      setPatientHits(
        await searchPatients({ q: patientQuery.trim(), limit: 20 }),
      );
      setPatientSearched(true);
    } catch (e) {
      setPatientHits([]);
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const work = useLoad(
    () => (read ? e.worklistCostEstimates() : Promise.resolve([])),
    [read, revision],
  );
  const list = useLoad(
    () =>
      read
        ? e.listEstimates({
            limit: 1000,
            status: status ? (status as e.EstimateOut["status"]) : undefined,
          })
        : Promise.resolve([]),
    [read, revision, status],
  );
  const tariff = useLoad(
    () => (read ? e.getTariff() : Promise.resolve(undefined)),
    [read, revision],
  );
  const stays = useLoad(
    () =>
      read && can("ipd.admission.view")
        ? listAdmissions()
        : Promise.resolve([]),
    [read, revision],
  );
  const transfers = useLoad(
    () =>
      draft?.admissionId && can("ipd.admission.view")
        ? e.listTransfers(draft.admissionId)
        : Promise.resolve([]),
    [draft?.admissionId, revision],
  );
  const write = useClinicalWrite(user, screenId, async (value, command) => {
    const body = command.body as e.EstimateIn;
    if (
      !value?.estimate_id ||
      (command.path === "/cost-estimates" &&
        (value.admission_id !== body.admission_id ||
          (body.patient_id && value.patient_id !== body.patient_id))) ||
      (command.path !== "/cost-estimates" &&
        command.path.split("/")[2] !== String(value.estimate_id))
    )
      throw Error(
        "Returned estimate identity differs. Keep the draft and ask IT to reconcile.",
      );
    setRecord(value);
    setDraft(undefined);
    setReview(undefined);
    setStale(false);
    setRevision((n) => n + 1);
  });
  useEffect(() => {
    if (write.error) {
      setReview(undefined);
      if (
        write.error instanceof ApiError &&
        ["ESTIMATE_STATE_INVALID", "ADMISSION_STATE_INVALID"].includes(
          write.error.response.error?.code || "",
        )
      ) {
        setStale(true);
        setRevision((n) => n + 1);
        if (current.current) void reread(current.current.estimate_id);
        if (
          write.error.response.error?.code === "ADMISSION_STATE_INVALID" &&
          draft?.admissionId &&
          can("ipd.admission.view")
        ) {
          const failure = write.error;
          void api<{ status: string }>(
            "GET",
            "/admissions/" + draft.admissionId,
          )
            .then((value) => {
              failure.response.recovery = {
                path: "/admissions/" + draft.admissionId,
                data: value,
              };
              setNotice(
                t("Admission currently: ", "داخلے کی موجودہ حالت: ") +
                  value.status,
              );
            })
            .catch((err) => setError(err));
        }
      }
    }
  }, [write.error]);
  const locked = busy || write.blocked;
  const time = (v: string) => (timeZone ? formatHospitalTime(v, timeZone) : v);
  useEffect(() => {
    if (!locked) return;
    const h = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [locked]);
  async function reread(id: number) {
    const n = ++generation.current;
    setBusy(true);
    setError(undefined);
    setPreview(undefined);
    try {
      const value = await e.getEstimate(id);
      if (n === generation.current) setRecord(value);
    } catch (err) {
      if (n === generation.current) {
        setRecord(undefined);
        setError(err);
      }
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!read) setRecord(undefined);
  }, [read]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = window.terminal.subscribe((v) => {
      if (
        (v.type === "event" && v.event_type === "admission.transferred") ||
        (v.type === "stream" && v.status === "Live" && v.resync)
      ) {
        setStale(true);
        setReview(undefined);
        clearTimeout(timer);
        timer = setTimeout(() => {
          setRevision((n) => n + 1);
          if (current.current && !flight.current)
            void reread(current.current.estimate_id);
        }, 120);
      }
    });
    return () => {
      stop();
      clearTimeout(timer);
      generation.current++;
    };
  }, []);
  const wasLive = useRef(live);
  useEffect(() => {
    if (live && !wasLive.current) {
      setRevision((n) => n + 1);
      setStale(true);
      setReview(undefined);
      if (current.current) void reread(current.current.estimate_id);
    }
    wasLive.current = live;
  }, [live]);
  function leave() {
    return (
      !locked &&
      (!draft ||
        window.confirm(
          t(
            "Discard this unsent estimate draft?",
            "اخراجات کا غیر ارسال مسودہ چھوڑ دیں؟",
          ),
        ))
    );
  }
  function begin(
    kind: Draft["kind"],
    admissionId: number | null,
    transferId?: number,
    source?: e.EstimateDetailOut,
    subject?: Draft["subject"],
  ) {
    if (!leave()) return;
    write.clearError();
    setError(undefined);
    setNotice("");
    setStale(false);
    setReview(undefined);
    setDraft({
      kind,
      admissionId,
      source,
      subject:
        subject ||
        source ||
        work.data?.find((w) => w.admission_id === admissionId) ||
        stays.data?.find((w) => w.admission_id === admissionId),
      body: {
        admission_id: admissionId,
        patient_id: admissionId
          ? undefined
          : subject?.patient_id || source?.patient_id,
        reason: transferId ? "ChangeOfWard" : "Admission",
        transfer_id: transferId,
        ward_id: tariff.data?.wards.find(
          (w) =>
            w.ward_id ===
              (source?.ward_id ??
                stays.data?.find((s) => s.admission_id === admissionId)
                  ?.ward_id) && w.bed_day_price !== null,
        )?.ward_id,
        expected_days: source?.expected_days ?? 1,
        services: [],
        allowances: [],
        note: "",
      },
      explain: {
        explained_to: "",
        explained_relation: "Patient",
        language: "Urdu",
        acknowledged: false,
        note: "",
      },
      cancel: "",
      ack: false,
    });
  }
  async function reviewDraft() {
    if (!draft || locked) return;
    setError(undefined);
    try {
      if (!draft.subject?.patient_id || !draft.subject.mrn)
        throw Error("Choose a verified patient or admission before review.");
      if (!draft.ack)
        throw Error(
          t(
            "Check the patient and this estimate action first.",
            "پہلے مریض اور اخراجات کا عمل چیک کریں۔",
          ),
        );
      if (draft.kind === "prepare") {
        if (!tariff.data || tariff.loading || tariff.error)
          throw Error("Read the current tariff first.");
        setReview(
          checkedEstimate(
            { ...draft.body, admission_id: draft.admissionId },
            tariff.data,
          ),
        );
      } else if (draft.kind === "explain") {
        if (
          draft.explain.explained_to.trim().length < 2 ||
          !draft.explain.acknowledged
        )
          throw Error(
            t(
              "Name who heard the explanation and confirm the actual signed paper.",
              "سننے والے کا نام اور اصل دستخط شدہ کاغذ کی تصدیق دیں۔",
            ),
          );
        setReview({
          ...draft.explain,
          explained_to: draft.explain.explained_to.trim(),
        });
      } else {
        if (draft.cancel.trim().length < 5)
          throw Error("Cancellation reason needs 5–1000 characters.");
        setReview({ reason: draft.cancel.trim() });
      }
    } catch (err) {
      setError(err);
    }
  }
  function submit() {
    if (!draft || !review || locked || stale || !live) return;
    const d = draft,
      body = review,
      permission =
        d.kind === "explain" ? "estimate.explain" : "estimate.prepare",
      path =
        d.kind === "prepare"
          ? "/cost-estimates"
          : `/cost-estimates/${d.source!.estimate_id}/${d.kind}`;
    write.start(
      {
        method: "POST",
        path,
        body,
        permission,
        protection: "idempotent",
        reconcilePath:
          d.kind === "prepare"
            ? `/cost-estimates?${d.admissionId ? "admission_id=" + d.admissionId : "patient_id=" + d.subject?.patient_id}&limit=1000`
            : `/cost-estimates/${d.source!.estimate_id}`,
        label: t("Cost estimate", "متوقع اخراجات") + " · " + d.kind,
      },
      async () => {
        const [actor, est] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
        ]);
        if (
          actor.user_id !== user.user_id ||
          !actor.permissions.includes(permission) ||
          !["full", "open_work"].includes(estimateView(screenId, est) || "")
        )
          throw Error(
            "The account, permission or service view changed. Read before another review.",
          );
        if (d.kind === "prepare") {
          if (d.admissionId && can("ipd.admission.view")) {
            const stay = await api<{ status: string }>(
              "GET",
              "/admissions/" + d.admissionId,
            );
            if (["Cancelled", "Discharged"].includes(stay.status))
              throw Error(
                "The admission is " +
                  stay.status +
                  ". Keep this draft and choose a current admission.",
              );
          } else if (d.admissionId) {
            if (d.source) {
              const latest = await e.getEstimate(d.source.estimate_id);
              if (estimateSnapshot(latest) !== estimateSnapshot(d.source))
                throw Error(
                  "The source estimate changed; read latest and keep input.",
                );
            } else {
              const latest = await e.worklistCostEstimates();
              if (
                !latest.some(
                  (w) =>
                    w.admission_id === d.admissionId &&
                    w.patient_id === d.subject?.patient_id,
                )
              )
                throw Error(
                  "This admission is no longer in your estimate worklist. Ask Admissions to check its state; your input is kept.",
                );
            }
          } else {
            const person = await getPatient(d.subject!.patient_id);
            if (
              person.patient_id !== d.subject!.patient_id ||
              person.mrn !== d.subject!.mrn
            )
              throw Error(
                "The selected patient changed. Read before another review.",
              );
          }
          const now = await e.getTariff();
          checkedEstimate(body as e.EstimateIn, now);
          if (JSON.stringify(now) !== JSON.stringify(tariff.data)) {
            setRevision((n) => n + 1);
            setReview(undefined);
            throw Error(
              "The tariff changed. Review the current prices before preparing.",
            );
          }
        } else {
          const now = await e.getEstimate(d.source!.estimate_id);
          setRecord(now);
          if (
            estimateSnapshot(now) !== estimateSnapshot(d.source!) ||
            !(d.kind === "cancel"
              ? ["Draft", "Explained"].includes(now.status)
              : now.status === "Draft")
          ) {
            setStale(true);
            setReview(undefined);
            throw Error(
              "The estimate is now " +
                now.status +
                ". Read the current record and keep your input.",
            );
          }
        }
      },
    );
  }
  async function paper(kind: "preview" | "native" | "pdf" | "server") {
    if (!record || locked || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      if (kind === "preview") {
        const value = await e.printEstimate(record.estimate_id);
        if (value.fields.estimate.row_version !== record.row_version)
          throw Error("The estimate changed; read it before printing.");
        setPreview(value);
      } else {
        const value = await call<{
          saved?: boolean;
          printed?: boolean;
          cancelled?: boolean;
        }>(
          kind === "server" ? "clinical-pdf" : "print-estimate",
          kind === "server"
            ? { path: `/cost-estimates/${record.estimate_id}/pdf` }
            : {
                screenId,
                estimateId: record.estimate_id,
                expectedVersion: record.row_version,
                pdf: kind === "pdf",
              },
        );
        setNotice(
          value.saved
            ? "Estimate PDF saved."
            : value.printed
              ? "Print job accepted. Check the actual paper."
              : "No file or print success was confirmed.",
        );
      }
    } catch (err) {
      setError(err);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const mutate = (patch: Partial<Draft>) => {
    setReview(undefined);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };
  const match = (...v: (string | null | undefined)[]) =>
    !search || v.some((s) => s?.toLowerCase().includes(search.toLowerCase()));
  if (!read)
    return (
      <Empty>
        {t("Cost estimates unavailable", "اخراجات کی فہرست دستیاب نہیں")}
      </Empty>
    );
  return (
    <section
      ref={root}
      data-estimate-screen={screenId}
      data-unsaved={!!draft}
      data-write-pending={write.blocked}
    >
      <h1>{t("Cost estimates", "متوقع اخراجات")}</h1>
      <p>
        {t(
          "Explain the expected cost from the hospital tariff. An estimate does not collect payment.",
          "ہسپتال کے نرخ سے متوقع خرچ سمجھائیں۔ تخمینے سے ادائیگی وصول نہیں ہوتی۔",
        )}
      </p>
      {view !== "full" && (
        <p className="notice">
          {t("Existing work / records only", "صرف موجودہ کام / ریکارڈ")}
        </p>
      )}
      <div className="actions">
        <button
          data-help="estimates.read"
          disabled={locked}
          onClick={() => {
            setRevision((n) => n + 1);
            if (record) void reread(record.estimate_id);
          }}
        >
          {t("Refresh cost estimates", "اخراجات تازہ کریں")}
        </button>
        <Field label={t("Find estimate or patient", "تخمینہ یا مریض تلاش")}>
          <input
            data-help="estimates.read"
            value={search}
            onChange={(v) => setSearch(v.target.value)}
          />
        </Field>
        <Field label={t("Estimate status", "تخمینے کی حالت")}>
          <select
            data-help="estimates.read"
            value={status}
            onChange={(v) => setStatus(v.target.value)}
          >
            <option value="">{t("All states", "تمام حالتیں")}</option>
            {["Draft", "Explained", "Superseded", "Cancelled"].map((s) => (
              <option
                key={s}
                disabled={s === "ChangeOfWard" && !can("ipd.admission.view")}
              >
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorBox error={error} />
      <ErrorBox error={write.error} />
      {(notice || (!draft && write.notice)) && (
        <p role="status">{notice || (!draft && write.notice)}</p>
      )}
      {write.attempt && !write.busy && (
        <aside className="notice">
          <p>
            {t(
              "The original result is unknown. Keep this draft; do not create a replacement.",
              "اصل نتیجہ نامعلوم ہے۔ مسودہ رکھیں؛ متبادل نہ بنائیں۔",
            )}
          </p>
          <code>{write.attempt.key}</code>
          {canRetryWrite(write.attempt) && (
            <button data-help="estimates.recovery" onClick={write.retry}>
              {t("Retry original request", "اصل درخواست کی دوبارہ کوشش")}
            </button>
          )}
          <button
            data-help="estimates.recovery"
            onClick={() => void write.inspect()}
          >
            {t("Read current result", "موجودہ نتیجہ پڑھیں")}
          </button>
          {write.checked && <Details value={write.observed} />}
          <p>
            {t(
              "A matching list entry alone cannot identify this preparation. If replay is unavailable, ask IT with the original request reference.",
              "صرف ملتی سطر سے اصل تیاری ثابت نہیں۔ دوبارہ کوشش دستیاب نہ ہو تو اصل حوالے کے ساتھ آئی ٹی سے کہیں۔",
            )}
          </p>
        </aside>
      )}
      <div className="split">
        <aside className="card">
          <h2>{t("Estimates to explain", "سمجھانے والے تخمینے")}</h2>
          <LoadState {...work} retry={work.reload} />
          {!work.loading && !work.error && work.data?.length === 0 && (
            <p>
              {t(
                "No estimates waiting for explanation.",
                "کوئی تخمینہ سمجھانے کا منتظر نہیں۔",
              )}
            </p>
          )}
          {!work.loading &&
            !work.error &&
            work.data
              ?.filter((w) => match(w.patient_name, w.mrn, w.admission_number))
              .map((w) => (
                <section
                  className={w.overdue ? "error" : "notice"}
                  key={w.admission_id + ":" + w.transfer_id}
                >
                  <strong>
                    {w.patient_name} · <bdi>{w.mrn}</bdi>
                  </strong>
                  <p>
                    {w.admission_number} · {w.ward_name} · {w.kind} ·{" "}
                    {time(w.since)} {w.overdue ? t("Overdue", "تاخیر") : ""}
                  </p>
                  <p>{w.detail}</p>
                  {w.kind === "ChangeOfWard" && !can("ipd.admission.view") && (
                    <p>
                      {t(
                        "The ward-change record is unavailable to this account. Ask Admissions to prepare the estimate. Existing estimates can still be read and printed.",
                        "اس صارف کو اصل وارڈ منتقلی دستیاب نہیں۔ داخلہ ڈیسک سے تخمینہ تیار کرائیں۔ موجودہ تخمینے پڑھے و پرنٹ کیے جا سکتے ہیں۔",
                      )}
                    </p>
                  )}
                  {workView && can("estimate.prepare") && (
                    <button
                      data-help="estimates.prepare"
                      disabled={
                        locked ||
                        !live ||
                        (w.kind === "ChangeOfWard" &&
                          !can("ipd.admission.view"))
                      }
                      onClick={() =>
                        begin(
                          "prepare",
                          w.admission_id,
                          w.transfer_id ?? undefined,
                          undefined,
                          w,
                        )
                      }
                    >
                      {t(
                        "Prepare for this admission",
                        "اس داخلے کا تخمینہ تیار",
                      )}
                    </button>
                  )}
                </section>
              ))}
          <h2>{t("Estimate register", "تخمینہ رجسٹر")}</h2>
          <LoadState {...list} retry={list.reload} />
          {!list.loading &&
            !list.error &&
            list.data
              ?.filter((r) => match(r.patient_name, r.mrn, r.estimate_number))
              .map((r) => (
                <button
                  className="list-row"
                  data-help="estimates.read"
                  disabled={locked}
                  key={r.estimate_id}
                  onClick={() => {
                    if (leave()) {
                      setDraft(undefined);
                      void reread(r.estimate_id);
                    }
                  }}
                >
                  <strong>{r.patient_name}</strong>
                  <span>
                    {r.estimate_number} · {r.mrn} · {r.status}
                  </span>
                </button>
              ))}
          <Field label={t("Known estimate reference", "معلوم تخمینہ حوالہ")}>
            <input
              data-help="estimates.read"
              inputMode="numeric"
              value={known}
              onChange={(v) => setKnown(v.target.value)}
            />
          </Field>
          <button
            data-help="estimates.read"
            disabled={locked || !/^\d+$/.test(known) || Number(known) < 1}
            onClick={() => {
              if (leave()) {
                setDraft(undefined);
                void reread(Number(known));
              }
            }}
          >
            {t("Read this estimate", "یہ تخمینہ پڑھیں")}
          </button>
        </aside>
        <article className="card">
          {!record ? (
            <Empty>
              {t("Choose an estimate or admission", "تخمینہ یا داخلہ چنیں")}
            </Empty>
          ) : (
            <>
              <h2>{record.estimate_number}</h2>
              <p>
                <strong>{record.patient_name}</strong> · <bdi>{record.mrn}</bdi>{" "}
                · {record.admission_number} · {record.status}
              </p>
              <p>
                {t(
                  "Total / deposit / billed so far",
                  "کل / پیشگی رقم / اب تک بل",
                )}
                :{" "}
                <bdi>
                  {tariff.data?.currency} {record.total} / {record.deposit} /{" "}
                  {record.billed_so_far}
                </bdi>
              </p>
              <p>
                {record.ward_name} · {record.expected_days} {t("days", "دن")} ·{" "}
                {record.reason}
              </p>
              <table className="estimate-lines">
                <thead>
                  <tr>
                    <th>{t("Description", "تفصیل")}</th>
                    <th>{t("Quantity", "مقدار")}</th>
                    <th>{t("Unit price", "فی اکائی")}</th>
                    <th>{t("Amount", "رقم")}</th>
                  </tr>
                </thead>
                <tbody>
                  {record.lines.map((l) => (
                    <tr key={l.line_id}>
                      <td>{l.description}</td>
                      <td>
                        <bdi>{l.quantity}</bdi>
                      </td>
                      <td>
                        <bdi>{l.unit_price}</bdi>
                      </td>
                      <td>
                        <bdi>{l.amount}</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>{record.payment_terms}</p>
              <p>{record.note}</p>
              <p>
                {record.prepared_by_name} · {time(record.prepared_at)}
              </p>
              {record.explained_at && (
                <p>
                  {record.explained_by_name} → {record.explained_to} ·{" "}
                  {record.explained_relation} · {record.language} ·{" "}
                  {time(record.explained_at)}
                </p>
              )}
              {record.cancel_reason && <p>{record.cancel_reason}</p>}
              {record.superseded_by && (
                <p>
                  {t("Superseded by estimate reference", "نئے تخمینے کا حوالہ")}
                  : {record.superseded_by}
                </p>
              )}
              <div className="actions">
                {(["preview", "native", "pdf", "server"] as const).map(
                  (kind, i) => (
                    <button
                      key={kind}
                      data-help="estimates.print"
                      disabled={locked}
                      onClick={() => void paper(kind)}
                    >
                      {
                        [
                          t("Preview estimate form", "تخمینہ فارم دیکھیں"),
                          t("Print estimate", "تخمینہ پرنٹ"),
                          t(
                            "Save terminal estimate PDF",
                            "ٹرمینل تخمینہ پی ڈی ایف",
                          ),
                          t(
                            "Download English server PDF",
                            "سرور انگریزی پی ڈی ایف",
                          ),
                        ][i]
                      }
                    </button>
                  ),
                )}
                {workView &&
                  live &&
                  record.status === "Draft" &&
                  can("estimate.explain") && (
                    <button
                      data-help="estimates.explain"
                      disabled={locked}
                      onClick={() =>
                        begin("explain", record.admission_id, undefined, record)
                      }
                    >
                      {t("Mark explained", "سمجھایا گیا درج کریں")}
                    </button>
                  )}
                {workView &&
                  live &&
                  ["Draft", "Explained"].includes(record.status) &&
                  can("estimate.prepare") && (
                    <button
                      data-help="estimates.cancel"
                      disabled={locked}
                      onClick={() =>
                        begin("cancel", record.admission_id!, undefined, record)
                      }
                    >
                      {t("Cancel estimate", "تخمینہ منسوخ")}
                    </button>
                  )}
                {workView && live && can("estimate.prepare") && (
                  <button
                    data-help="estimates.prepare"
                    disabled={locked}
                    onClick={() =>
                      begin("prepare", record.admission_id!, undefined, record)
                    }
                  >
                    {t("Prepare a revision", "نیا تخمینہ تیار")}
                  </button>
                )}
              </div>
            </>
          )}
          {workView && can("estimate.prepare") && can("ipd.admission.view") && (
            <>
              <h2>
                {t(
                  "Prepare for a current admission",
                  "موجودہ داخلے کے لیے تیاری",
                )}
              </h2>
              <LoadState {...stays} retry={stays.reload} />
              {!stays.loading && !stays.error && (
                <Field label={t("Admission for estimate", "تخمینے کا داخلہ")}>
                  <select
                    data-help="estimates.prepare"
                    value=""
                    disabled={locked || !live}
                    onChange={(v) =>
                      v.target.value && begin("prepare", Number(v.target.value))
                    }
                  >
                    <option value="">
                      {t("Choose a patient and admission", "مریض و داخلہ چنیں")}
                    </option>
                    {stays.data
                      ?.filter(
                        (s) => !["Cancelled", "Discharged"].includes(s.status),
                      )
                      .map((s) => (
                        <option key={s.admission_id} value={s.admission_id}>
                          {s.patient_name} · {s.mrn} · {s.admission_number} ·{" "}
                          {s.status}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </>
          )}
        </article>
      </div>
      {screenId === "cost_estimates_billing" &&
        workView &&
        can("estimate.prepare") &&
        can("patient.search") &&
        can("patient.view") && (
          <section className="card">
            <h2>{t("Prepare before admission", "داخلے سے پہلے تخمینہ")}</h2>
            <Field
              label={t("Find patient for estimate", "تخمینے کا مریض تلاش")}
            >
              <input
                data-help="estimates.patient"
                disabled={locked}
                value={patientQuery}
                onChange={(ev) => {
                  setPatientQuery(ev.target.value);
                  setPatientSearched(false);
                  setPatientHits([]);
                }}
              />
            </Field>
            <button
              data-help="estimates.patient"
              disabled={locked || patientQuery.trim().length < 2}
              onClick={() => void findPatient()}
            >
              {t("Find patient", "مریض تلاش")}
            </button>
            {patientSearched&&!busy&&patientHits.length===0&&<p role="status">{t("No patients matched. Check the name or MRN.","کوئی مریض نہیں ملا۔ نام یا ایم آر این چیک کریں۔")}</p>}
            {patientHits.map((p) => (
              <button
                className="list-row"
                data-help="estimates.patient"
                disabled={locked || !live}
                key={p.patient_id}
                onClick={() =>
                  begin("prepare", null, undefined, undefined, {
                    patient_id: p.patient_id,
                    patient_name: p.full_name,
                    mrn: p.mrn,
                  })
                }
              >
                {p.full_name} · <bdi>{p.mrn}</bdi>
              </button>
            ))}
          </section>
        )}
      {draft && (
        <section className="card" data-unsaved="true">
          <h2>
            {draft.kind === "prepare"
              ? t("Prepare cost estimate", "متوقع خرچ تیار کریں")
              : draft.kind === "explain"
                ? t("Record the explanation", "سمجھانے کا اندراج")
                : t("Cancel estimate", "تخمینہ منسوخ")}
          </h2>
          <p>
            {draft.subject?.patient_name ||
              stays.data?.find((s) => s.admission_id === draft.admissionId)
                ?.patient_name}{" "}
            ·{" "}
            {draft.subject?.mrn ||
              stays.data?.find((s) => s.admission_id === draft.admissionId)
                ?.mrn}
          </p>
          {stale && (
            <p className="notice">
              {t(
                "Data changed. Read latest and keep input before another review.",
                "معلومات بدلیں۔ نئے جائزے سے پہلے تازہ پڑھیں و معلومات رکھیں۔",
              )}
            </p>
          )}
          <fieldset disabled={locked}>
            <ErrorBox error={write.error || error} />
            {draft.kind === "prepare" ? (
              <>
                <LoadState {...tariff} retry={tariff.reload} />
                <Field label={t("Estimate reason", "تخمینے کی وجہ")}>
                  <select
                    data-help="estimates.prepare"
                    data-field="reason"
                    value={draft.body.reason}
                    onChange={(v) =>
                      mutate({
                        body: {
                          ...draft.body,
                          reason: v.target.value as e.EstimateIn["reason"],
                          transfer_id: undefined,
                        },
                      })
                    }
                  >
                    {[
                      "Admission",
                      "ChangeOfWard",
                      "ChangeOfCondition",
                      "Procedure",
                      "OnRequest",
                    ].map((s) => (
                      <option
                        key={s}
                        disabled={
                          s === "ChangeOfWard" && !can("ipd.admission.view")
                        }
                      >
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                {draft.body.reason === "ChangeOfWard" && (
                  <>
                    <LoadState {...transfers} retry={transfers.reload} />
                    <Field label={t("Actual ward transfer", "اصل وارڈ منتقلی")}>
                      <select
                        data-help="estimates.prepare"
                        data-field="transfer_id"
                        value={draft.body.transfer_id ?? ""}
                        onChange={(v) => {
                          const move = transfers.data?.find(
                            (x) => x.transfer_id === Number(v.target.value),
                          );
                          mutate({
                            body: {
                              ...draft.body,
                              transfer_id: move?.transfer_id,
                              ward_id: move?.to_ward_id,
                            },
                          });
                        }}
                      >
                        <option value="">
                          {t("Choose the recorded move", "درج شدہ منتقلی چنیں")}
                        </option>
                        {transfers.data?.map((m) => (
                          <option key={m.transfer_id} value={m.transfer_id}>
                            {m.from_ward_name} → {m.to_ward_name} ·{" "}
                            {m.transferred_at}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
                <Field label={t("Ward to price", "نرخ کا وارڈ")}>
                  <select
                    data-help="estimates.prepare"
                    data-field="ward_id"
                    value={draft.body.ward_id ?? ""}
                    onChange={(v) =>
                      mutate({
                        body: {
                          ...draft.body,
                          ward_id: v.target.value
                            ? Number(v.target.value)
                            : undefined,
                        },
                      })
                    }
                  >
                    <option value="">
                      {t("No bed-days", "بستر کے دن شامل نہیں")}
                    </option>
                    {tariff.data?.wards
                      .filter((w) => w.bed_day_price !== null)
                      .map((w) => (
                        <option key={w.ward_id} value={w.ward_id}>
                          {w.name} · {tariff.data?.currency} {w.bed_day_price}/
                          {t("day", "دن")}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label={t("Expected days", "متوقع دن")}>
                  <input
                    type="number"
                    data-help="estimates.prepare"
                    data-field="expected_days"
                    min="0"
                    max="365"
                    step="1"
                    value={draft.body.expected_days ?? ""}
                    onChange={(v) =>
                      mutate({
                        body: {
                          ...draft.body,
                          expected_days:
                            v.target.value === ""
                              ? null
                              : Number(v.target.value),
                        },
                      })
                    }
                  />
                </Field>
                {(draft.body.services || []).map((s, i) => (
                  <div className="actions" key={i}>
                    <Field
                      label={t("Tariff service", "نرخ کی خدمت") + " " + (i + 1)}
                    >
                      <select
                        data-help="estimates.prepare"
                        data-field={"services." + i + ".service_id service_id"}
                        value={s.service_id}
                        onChange={(v) =>
                          mutate({
                            body: {
                              ...draft.body,
                              services: draft.body.services!.map((x, j) =>
                                i === j
                                  ? { ...x, service_id: Number(v.target.value) }
                                  : x,
                              ),
                            },
                          })
                        }
                      >
                        <option value="0">
                          {t("Choose published service", "شائع شدہ خدمت چنیں")}
                        </option>
                        {tariff.data?.categories
                          .flatMap((c) => c.items)
                          .map((x) => (
                            <option key={x.service_id} value={x.service_id}>
                              {x.code} · {x.name} · {x.price}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field
                      label={
                        t("Service quantity", "خدمت کی مقدار") + " " + (i + 1)
                      }
                    >
                      <input
                        data-help="estimates.prepare"
                        data-field={"services." + i + ".quantity quantity"}
                        type="number"
                        min="0.001"
                        max="1000"
                        step="any"
                        value={s.quantity ?? 1}
                        onChange={(v) =>
                          mutate({
                            body: {
                              ...draft.body,
                              services: draft.body.services!.map((x, j) =>
                                i === j
                                  ? { ...x, quantity: Number(v.target.value) }
                                  : x,
                              ),
                            },
                          })
                        }
                      />
                    </Field>
                    <button
                      data-help="estimates.prepare"
                      onClick={() =>
                        mutate({
                          body: {
                            ...draft.body,
                            services: draft.body.services!.filter(
                              (_, j) => j !== i,
                            ),
                          },
                        })
                      }
                    >
                      {t("Remove service", "خدمت ہٹائیں")}
                    </button>
                  </div>
                ))}
                <button
                  data-help="estimates.prepare"
                  disabled={(draft.body.services?.length || 0) >= 50}
                  onClick={() =>
                    mutate({
                      body: {
                        ...draft.body,
                        services: [
                          ...(draft.body.services || []),
                          { service_id: 0, quantity: 1 },
                        ],
                      },
                    })
                  }
                >
                  {t("Add tariff service", "نرخ کی خدمت شامل")}
                </button>
                {(draft.body.allowances || []).map((a, i) => (
                  <div className="card" key={i}>
                    <Field
                      label={t("Allowance kind", "تخمینی مد") + " " + (i + 1)}
                    >
                      <select
                        data-help="estimates.prepare"
                        value={a.kind}
                        onChange={(v) =>
                          mutate({
                            body: {
                              ...draft.body,
                              allowances: draft.body.allowances!.map((x, j) =>
                                i === j
                                  ? {
                                      ...x,
                                      kind: v.target
                                        .value as e.EstimateAllowanceIn["kind"],
                                    }
                                  : x,
                              ),
                            },
                          })
                        }
                      >
                        {[
                          "Medicines",
                          "Consumables",
                          "Investigations",
                          "Consultant",
                          "Other",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={
                        t("Allowance description", "مد کی تفصیل") +
                        " " +
                        (i + 1)
                      }
                    >
                      <input
                        data-help="estimates.prepare"
                        data-field={
                          "allowances." + i + ".description description"
                        }
                        minLength={3}
                        maxLength={300}
                        value={a.description}
                        onChange={(v) =>
                          mutate({
                            body: {
                              ...draft.body,
                              allowances: draft.body.allowances!.map((x, j) =>
                                i === j
                                  ? { ...x, description: v.target.value }
                                  : x,
                              ),
                            },
                          })
                        }
                      />
                    </Field>
                    <Field
                      label={t("Allowance amount", "مد کی رقم") + " " + (i + 1)}
                    >
                      <input
                        data-help="estimates.prepare"
                        data-field={"allowances." + i + ".amount amount"}
                        type="number"
                        min="0.01"
                        max="100000000"
                        step="any"
                        value={a.amount}
                        onChange={(v) =>
                          mutate({
                            body: {
                              ...draft.body,
                              allowances: draft.body.allowances!.map((x, j) =>
                                i === j
                                  ? { ...x, amount: Number(v.target.value) }
                                  : x,
                              ),
                            },
                          })
                        }
                      />
                    </Field>
                    <button
                      data-help="estimates.prepare"
                      onClick={() =>
                        mutate({
                          body: {
                            ...draft.body,
                            allowances: draft.body.allowances!.filter(
                              (_, j) => j !== i,
                            ),
                          },
                        })
                      }
                    >
                      {t("Remove allowance", "مد ہٹائیں")}
                    </button>
                  </div>
                ))}
                <button
                  data-help="estimates.prepare"
                  disabled={(draft.body.allowances?.length || 0) >= 20}
                  onClick={() =>
                    mutate({
                      body: {
                        ...draft.body,
                        allowances: [
                          ...(draft.body.allowances || []),
                          { kind: "Medicines", description: "", amount: 0 },
                        ],
                      },
                    })
                  }
                >
                  {t("Add allowance", "تخمینی مد شامل")}
                </button>
                <Field
                  label={t(
                    "Deposit (blank: hospital default)",
                    "پیشگی رقم (خالی: ہسپتال کا طے شدہ)",
                  )}
                >
                  <input
                    data-help="estimates.prepare"
                    data-field="deposit"
                    type="number"
                    min="0"
                    step="any"
                    value={draft.body.deposit ?? ""}
                    onChange={(v) =>
                      mutate({
                        body: {
                          ...draft.body,
                          deposit:
                            v.target.value === ""
                              ? null
                              : Number(v.target.value),
                        },
                      })
                    }
                  />
                </Field>
                <Field
                  label={t(
                    "Payment terms (blank: hospital default)",
                    "ادائیگی شرائط (خالی: طے شدہ)",
                  )}
                >
                  <textarea
                    data-help="estimates.prepare"
                    data-field="payment_terms"
                    maxLength={1000}
                    value={draft.body.payment_terms ?? ""}
                    onChange={(v) =>
                      mutate({
                        body: {
                          ...draft.body,
                          payment_terms: v.target.value || null,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t("Estimate note", "تخمینے کا نوٹ")}>
                  <textarea
                    data-help="estimates.prepare"
                    data-field="note"
                    maxLength={2000}
                    value={draft.body.note ?? ""}
                    onChange={(v) =>
                      mutate({ body: { ...draft.body, note: v.target.value } })
                    }
                  />
                </Field>
              </>
            ) : draft.kind === "explain" ? (
              <>
                <Field label={t("Who heard the estimate", "تخمینہ کس نے سنا")}>
                  <input
                    data-help="estimates.explain"
                    data-field="explained_to"
                    minLength={2}
                    maxLength={200}
                    value={draft.explain.explained_to}
                    onChange={(v) =>
                      mutate({
                        explain: {
                          ...draft.explain,
                          explained_to: v.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t("Relationship to patient", "مریض سے رشتہ")}>
                  <select
                    data-help="estimates.explain"
                    data-field="explained_relation"
                    value={draft.explain.explained_relation}
                    onChange={(v) =>
                      mutate({
                        explain: {
                          ...draft.explain,
                          explained_relation: v.target
                            .value as e.EstimateExplainIn["explained_relation"],
                        },
                      })
                    }
                  >
                    {[
                      "Patient",
                      "Relative",
                      "Attendant",
                      "Guardian",
                      "Other",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Language explained in", "سمجھانے کی زبان")}>
                  <select
                    data-help="estimates.explain"
                    data-field="language"
                    value={draft.explain.language}
                    onChange={(v) =>
                      mutate({
                        explain: {
                          ...draft.explain,
                          language: v.target
                            .value as e.EstimateExplainIn["language"],
                        },
                      })
                    }
                  >
                    {[
                      "Urdu",
                      "English",
                      "Punjabi",
                      "Sindhi",
                      "Pashto",
                      "Other",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={t(
                    "Questions and deposit agreement",
                    "سوالات اور پیشگی رقم کا اتفاق",
                  )}
                >
                  <textarea
                    data-help="estimates.explain"
                    data-field="note"
                    maxLength={2000}
                    value={draft.explain.note ?? ""}
                    onChange={(v) =>
                      mutate({
                        explain: { ...draft.explain, note: v.target.value },
                      })
                    }
                  />
                </Field>
                <label>
                  <input
                    data-help="estimates.explain"
                    type="checkbox"
                    checked={draft.explain.acknowledged}
                    onChange={(v) =>
                      mutate({
                        explain: {
                          ...draft.explain,
                          acknowledged: v.target.checked,
                        },
                      })
                    }
                  />
                  {t(
                    "The family signed or thumb-printed the actual printed estimate",
                    "خاندان نے اصل پرنٹ تخمینے پر دستخط یا انگوٹھا لگایا",
                  )}
                </label>
              </>
            ) : (
              <Field
                label={t(
                  "Estimate cancellation reason",
                  "تخمینہ منسوخی کی وجہ",
                )}
              >
                <textarea
                  data-help="estimates.cancel"
                  data-field="reason"
                  minLength={5}
                  maxLength={1000}
                  value={draft.cancel}
                  onChange={(v) => mutate({ cancel: v.target.value })}
                />
              </Field>
            )}
            <label>
              <input
                data-help="estimates.review"
                type="checkbox"
                checked={draft.ack}
                onChange={(v) => mutate({ ack: v.target.checked })}
              />
              {t(
                "I checked this patient, admission and estimate action",
                "میں نے مریض، داخلہ اور تخمینے کا عمل چیک کیا",
              )}
            </label>
            <div className="actions">
              <button
                data-help="estimates.review"
                disabled={!live || stale}
                onClick={() => void reviewDraft()}
              >
                {t("Review estimate action", "تخمینے کا جائزہ")}
              </button>
              <button
                data-help="estimates.recovery"
                onClick={async () => {
                  setError(undefined);
                  try {
                    if (draft.source) {
                      const now = await e.getEstimate(draft.source.estimate_id);
                      setRecord(now);
                      mutate({ source: now, ack: false });
                    }
                    setRevision((n) => n + 1);
                    setStale(false);
                    setReview(undefined);
                  } catch (err) {
                    setError(err);
                  }
                }}
              >
                {t("Read latest and keep input", "تازہ پڑھیں و معلومات رکھیں")}
              </button>
              <button
                data-help="estimates.review"
                onClick={() => {
                  if (leave()) {
                    setDraft(undefined);
                    setReview(undefined);
                  }
                }}
              >
                {t("Close estimate draft", "تخمینہ مسودہ بند")}
              </button>
            </div>
          </fieldset>
        </section>
      )}
      {review !== undefined && draft && (
        <Modal
          title={t("Confirm estimate action", "تخمینے کی تصدیق")}
          onClose={() => !locked && setReview(undefined)}
        >
          <p>
            {draft.subject?.patient_name ||
              stays.data?.find((s) => s.admission_id === draft.admissionId)
                ?.patient_name}{" "}
            · <bdi>{draft.subject?.mrn}</bdi> · {draft.kind}
          </p>
          <Details value={review} />
          <button
            data-help="estimates.confirm"
            disabled={locked || !live || stale}
            onClick={submit}
          >
            {t("Confirm this estimate action", "یہ تخمینہ عمل تصدیق")}
          </button>
          <button
            data-help="estimates.confirm"
            disabled={locked}
            onClick={() => setReview(undefined)}
          >
            {t("Back to estimate input", "تخمینے کی معلومات پر واپس")}
          </button>
        </Modal>
      )}
      {preview && (
        <Modal
          title={t("Estimate form preview", "تخمینہ فارم کا جائزہ")}
          onClose={() => setPreview(undefined)}
        >
          <p>
            {preview.fields.hospital.name} ·{" "}
            {preview.fields.estimate.patient_name} ·{" "}
            <bdi>
              {preview.fields.estimate.mrn} ·{" "}
              {preview.fields.estimate.estimate_number}
            </bdi>
          </p>
          <p>
            {t("Total / deposit / billed so far", "کل / پیشگی رقم / اب تک بل")}:{" "}
            {preview.fields.estimate.total} / {preview.fields.estimate.deposit}{" "}
            / {preview.fields.estimate.billed_so_far}
          </p>
          <table className="estimate-lines">
            <tbody>
              {preview.fields.estimate.lines.map((l) => (
                <tr key={l.line_id}>
                  <td>{l.description}</td>
                  <td>
                    <bdi>{l.quantity}</bdi>
                  </td>
                  <td>
                    <bdi>{l.unit_price}</bdi>
                  </td>
                  <td>
                    <bdi>{l.amount}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.fields.english.map((p, i) => (
            <p key={"en" + i} dir="ltr">
              {p}
            </p>
          ))}
          {preview.fields.urdu.map((p, i) => (
            <p key={"ur" + i} dir="rtl">
              {p}
            </p>
          ))}
          {preview.fields.signature_lines.map((p, i) => (
            <p key={i} dir="auto">
              {p}
            </p>
          ))}
        </Modal>
      )}
    </section>
  );
}
