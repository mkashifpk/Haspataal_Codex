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
import { useClinicalWrite } from "../clinical-write";
import { canRetryWrite } from "../write-attempt";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as lab from "../generated/lab_bench";
import {
  benchIdentity,
  benchMetrics,
  metricFlag,
  benchRejection,
  benchSnapshot,
  sameBenchSample,
  benchWritable,
} from "../lab-bench-policy";
import { formatHospitalTime, hospitalTimeToUtc } from "../hospital-time";
type Action = "collect" | "receive" | "result" | "correct" | "reject" | "rerun";
type Review = {
  action: Action;
  sample: lab.LabScanOut;
  body: unknown;
  permission: string;
  path: string;
  idempotent: boolean;
};
export function LabBench({
  user,
  connected,
  stream,
  establishment,
  timeZone,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
}) {
  const can = (p: string) => user.permissions.includes(p),
    view =
      establishment.views.screens.find((x) => x.screen_id === "lab_bench")
        ?.view || "hidden",
    visible = ["full", "open_work", "records"].includes(view),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [status, setStatus] = useState(""),
    [find, setFind] = useState(""),
    [buffer, setBuffer] = useState(""),
    [manual, setManual] = useState(""),
    [barcode, setBarcode] = useState(""),
    [needFocus, setNeedFocus] = useState(true),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [interpretation, setInterpretation] = useState(""),
    [identityMode, setIdentityMode] = useState("TwoIdentifiers"),
    [band, setBand] = useState(""),
    [identityNote, setIdentityNote] = useState(""),
    [asked, setAsked] = useState(false),
    [emergency, setEmergency] = useState(false),
    [bandCheck, setBandCheck] = useState<lab.IdentityVerifyOut>(),
    [bandKey, setBandKey] = useState(""),
    [reason, setReason] = useState(""),
    [rejectCode, setRejectCode] =
      useState<lab.SampleRejectIn["code"]>("Haemolysed"),
    [correctId, setCorrectId] = useState(""),
    [partnerRef, setPartnerRef] = useState(""),
    [partnerAt, setPartnerAt] = useState(""),
    [review, setReview] = useState<Review>(),
    [tried, setTried] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [printing, setPrinting] = useState(false),
    [labelPrintFailed, setLabelPrintFailed] = useState(false),
    [saved, setSaved] = useState<{ id: number; status: string }>(),
    [collectedLabel, setCollectedLabel] = useState<lab.PrintOut_LabLabelFieldsOut_>(),
    [replacement, setReplacement] = useState<
      { item: number; barcode: string | null }[]
    >([]);
  const capture = useRef<HTMLInputElement>(null);
  const labelFlight = useRef(false);
  const [worklistRevision, setWorklistRevision] = useState(0);
  const list = useLoad(
    () =>
      visible &&
      view !== "records" &&
      ["lab.sample.collect", "lab.sample.receive", "lab.result.enter"].some(can)
        ? lab.worklistLab(status ? { status: status as "Ordered" } : undefined)
        : Promise.resolve([]),
    [visible, view, status, revision, worklistRevision],
  );
  const scan = useLoad(
    () =>
      visible && barcode && ["lab.sample.receive", "lab.result.enter"].some(can)
        ? lab.scanLab(encodeURIComponent(barcode))
        : Promise.resolve(undefined),
    [visible, barcode, revision],
  );
  const s =
    !scan.loading && !scan.error && scan.data?.sample.barcode === barcode
      ? scan.data
      : undefined;
  const write = useClinicalWrite(
    user,
    `lab-bench:${barcode}`,
    async (value, command) => {
      if (command.path.endsWith("/collect"))
        setCollectedLabel(value as lab.PrintOut_LabLabelFieldsOut_);
      setReview(undefined);
      setDraft({});
      setInterpretation("");
      setAsked(false);
      setEmergency(false);
      setBand("");
      setBandCheck(undefined);
      setBandKey("");
      setReason("");
      setPartnerRef("");
      setPartnerAt("");
      setCorrectId("");
      if (command.path.endsWith("/reject") || command.path.endsWith("/rerun")) {
        const r = value as lab.LabRequisitionDetailOut;
        setReplacement(
          r.items.map((x) => ({
            item: x.lab_requisition_item_id,
            barcode: x.barcode,
          })),
        );
        setBarcode("");
        setManual("");
        setNotice(
          t(
            "Confirmed. Use the actual replacement barcode from the refreshed worklist; do not process the old sample again.",
            "تصدیق ہو گئی۔ تازہ فہرست کا اصل متبادل بارکوڈ لیں؛ پرانا نمونہ پھر پراسیس نہ کریں۔",
          ),
        );
      } else if (
        command.path.endsWith("/results") ||
        command.path.endsWith("/corrections")
      ) {
        const r = value as lab.LabResultOut;
        setSaved({ id: r.result_id, status: r.status });
        setNotice(
          t(
            "Result recorded; verifier review is separate. This is not a published report.",
            "نتیجہ درج؛ تصدیق الگ جائزہ ہے۔ یہ شائع شدہ رپورٹ نہیں۔",
          ),
        );
      } else
        setNotice(
          t(
            "Sample action confirmed. Label the tube at the patient’s side; printing is separate.",
            "نمونے کا عمل تصدیق شدہ۔ مریض کے پاس ٹیوب پر لیبل لگائیں؛ پرنٹ الگ ہے۔",
          ),
        );
      setRevision((n) => n + 1);
      setNeedFocus(true);
    },
  );
  const blocked = write.blocked || printing,
    writable = live && ["full", "open_work"].includes(view),
    dirty =
      Object.values(draft).some(Boolean) ||
      !!interpretation ||
      !!identityNote ||
      !!reason ||
      !!partnerRef ||
      !!partnerAt;
  const rows =
    !list.loading && !list.error
      ? (list.data || []).filter((x) =>
          `${x.patient_name} ${x.mrn} ${x.barcode} ${x.test_name} ${x.requisition_number}`
            .toLowerCase()
            .includes(find.trim().toLowerCase()),
        )
      : [];
  const observed = write.observed as lab.LabScanOut | undefined,
    reconciled = !!observed && !!s && sameBenchSample(observed, s);
  const emergencyOrder =
    !!s && ["Urgent", "STAT"].includes(s.requisition.priority);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshWorklist = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setWorklistRevision(n => n + 1), 250);
    };
    const unsubscribe = window.terminal.subscribe(e => {
      if (e.type === "event" && ["lab.result.pending_verification", "critical_result.updated", "notification.created"].includes(e.event_type)) refreshWorklist();
      if (e.type === "stream" && e.status === "Live" && e.resync) refreshWorklist();
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (needFocus && !scan.loading && !review && !write.blocked && !printing) {
      capture.current?.focus();
      setNeedFocus(false);
    }
  }, [needFocus, scan.loading, review, write.blocked, printing]);
  useEffect(() => {
    if (!write.blocked) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [write.blocked]);
  const time = (v: string) => (timeZone ? formatHospitalTime(v, timeZone) : v);
  function open(code: string) {
    if (blocked || review) return;
    code = code.trim();
    if (!code) {
      setError(
        Error(
          t(
            "Scan or enter the actual sample barcode.",
            "اصل نمونہ بارکوڈ اسکین یا درج کریں۔",
          ),
        ),
      );
      return;
    }
    if (
      code !== barcode &&
      dirty &&
      !window.confirm(
        t(
          "Discard the unsent lab draft and change sample?",
          "غیر ارسال لیب مسودہ چھوڑ کر نمونہ بدلیں؟",
        ),
      )
    )
      return;
    setBarcode(code);
    setManual(code);
    setBuffer("");
    setError(undefined);
    setBandCheck(undefined);
    setBandKey("");
    setSaved(undefined);
    setReplacement([]);
    if (code !== barcode) {
      setDraft({});
      setInterpretation("");
      setIdentityNote("");
      setReason("");
      setAsked(false);
      setEmergency(false);
      setBand("");
      setCorrectId("");
      setPartnerRef("");
      setPartnerAt("");
    }
    setRevision((n) => n + 1);
    setNeedFocus(true);
  }
  async function verifyBand() {
    if (!s || blocked || !band.trim() || !can("patient.view")) return;
    setError(undefined);
    setBandCheck(undefined);
    try {
      const r = await lab.verifyWristband({
        code: band.trim(),
        patient_id: s.patient.patient_id,
      });
      setBandCheck(r);
      setBandKey(`${s.sample.sample_id}:${band.trim()}`);
    } catch (e) {
      setError(e);
    }
  }
  function identity() {
    return benchIdentity(
      identityMode,
      band,
      identityNote,
      asked,
      emergencyOrder && emergency,
    );
  }
  function prepare(action: Action) {
    if (!s || blocked || !writable) return;
    setError(undefined);
    setTried(false);
    try {
      let body: unknown,
        path = "",
        permission = "",
        idempotent = false;
      if (action === "collect" || action === "receive") {
        if (
          bandCheck &&
          !bandCheck.match &&
          bandKey === `${s.sample.sample_id}:${band.trim()}`
        )
          throw Error(
            t(
              "STOP: the wristband belongs to another patient.",
              "رکیں: کلائی کی پٹی دوسرے مریض کی ہے۔",
            ),
          );
        permission =
          action === "collect" ? "lab.sample.collect" : "lab.sample.receive";
        path = `/lab/samples/${s.sample.sample_id}/${action}`;
        if (action === "collect" && s.sample.status !== "Pending")
          throw Error(
            t(
              "Refresh the sample state before collection.",
              "وصولی سے پہلے نمونے کی حالت تازہ کریں۔",
            ),
          );
        if (
          action === "receive" &&
          !["Pending", "Collected"].includes(s.sample.status)
        )
          throw Error(
            t(
              "This sample is not awaiting receipt.",
              "یہ نمونہ وصولی کا منتظر نہیں۔",
            ),
          );
        body = s.sample.status === "Pending" ? identity() : null;
      } else if (action === "result" || action === "correct") {
        permission = "lab.result.enter";
        path = `/lab/items/${s.item.lab_requisition_item_id}/${action === "result" ? "results" : "corrections"}`;
        if (
          action === "result" &&
          (s.sample.status !== "Received" || s.item.status !== "Processing")
        )
          throw Error(
            t(
              "Receive this sample before entering a new result.",
              "نیا نتیجہ درج کرنے سے پہلے یہ نمونہ وصول کریں۔",
            ),
          );
        if (interpretation.trim().length > 4000)
          throw Error(
            t(
              "Interpretation is limited to 4000 characters.",
              "تشریح4000حروف تک ہے۔",
            ),
          );
        const metrics = benchMetrics(s.metric_grid, draft);
        body = {
          metrics,
          ...(interpretation.trim()
            ? { interpretation: interpretation.trim() }
            : {}),
        };
        const sendOut =
          s.sample.send_out_id != null ||
          list.data?.find(
            (x) => x.lab_requisition_item_id === s.item.lab_requisition_item_id,
          )?.is_send_out;
        if (sendOut) {
          if (
            !partnerRef.trim() ||
            partnerRef.length > 100 ||
            !partnerAt ||
            !timeZone
          )
            throw Error(
              t(
                "Enter the partner report reference and reporting time.",
                "شریک رپورٹ حوالہ اور رپورٹ کا وقت دیں۔",
              ),
            );
          body = {
            ...(body as object),
            partner_report_ref: partnerRef.trim(),
            partner_reported_at: hospitalTimeToUtc(partnerAt, timeZone),
          };
        }
        if (action === "correct") {
          const target = s.previous_results.find(
            (r) =>
              r.result_id === Number(correctId) && r.status === "Published",
          );
          if (
            !target ||
            reason.trim().length < 5 ||
            reason.trim().length > 1000
          )
            throw Error(
              t(
                "Select the published result and enter a correction reason of 5–1000 characters.",
                "شائع نتیجہ چنیں اور5تا1000حروف تصحیح وجہ دیں۔",
              ),
            );
          body = {
            ...(body as object),
            corrects_result_id: target.result_id,
            reason: reason.trim(),
          };
          idempotent = true;
        }
      } else if (action === "reject") {
        permission = can("lab.sample.receive")
          ? "lab.sample.receive"
          : "lab.sendout.manage";
        path = `/lab/samples/${s.sample.sample_id}/reject`;
        body = benchRejection(rejectCode, reason);
        idempotent = true;
      } else {
        permission = "lab.rerun.request";
        path = `/lab/items/${s.item.lab_requisition_item_id}/rerun`;
        if (reason.trim().length < 3 || reason.trim().length > 1000)
          throw Error(
            t(
              "Enter a re-run reason of 3–1000 characters.",
              "3تا1000حروف دوبارہ ٹیسٹ کی وجہ دیں۔",
            ),
          );
        body = { reason: reason.trim() };
        idempotent = true;
      }
      if (!benchWritable(user.permissions, permission, view))
        throw Error(
          t(
            "This action requires its own permission.",
            "اس عمل کی الگ اجازت لازم ہے۔",
          ),
        );
      setReview({ action, sample: s, body, permission, path, idempotent });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!review || blocked) return;
    const r = review;
    setTried(true);
    write.start(
      {
        method: "POST",
        path: r.path,
        body: r.body,
        permission: r.permission,
        protection: r.idempotent ? "idempotent" : "reconcile",
        reconcilePath: `/lab/scan/${encodeURIComponent(r.sample.sample.barcode)}`,
        label: t("Confirm lab bench action", "لیب بنچ عمل کی تصدیق"),
      },
      async () => {
        const [me, est, fresh] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          lab.scanLab(encodeURIComponent(r.sample.sample.barcode)),
        ]);
        if (
          me.user_id !== user.user_id ||
          !live ||
          !benchWritable(
            me.permissions,
            r.permission,
            est.views.screens.find((x) => x.screen_id === "lab_bench")?.view ||
              "hidden",
          ) ||
          benchSnapshot(fresh) !== benchSnapshot(r.sample)
        )
          throw Error(
            t(
              "The sample, metric schema, permission or service changed. Close and review again.",
              "نمونہ، پیمائش فہرست، اجازت یا خدمت بدل گئی۔ بند کرکے پھر جائزہ لیں۔",
            ),
          );
        const b = r.body as lab.IdentityIn | null;
        if (b?.wristband_code) {
          const checked = await lab.verifyWristband({
            code: b.wristband_code,
            patient_id: fresh.patient.patient_id,
          });
          setBandCheck(checked);
          setBandKey(`${fresh.sample.sample_id}:${b.wristband_code}`);
          if (!checked.match)
            throw Error(
              t(
                "STOP: the wristband belongs to another patient.",
                "رکیں: کلائی کی پٹی دوسرے مریض کی ہے۔",
              ),
            );
        }
      },
    );
  }
  async function printLabel(pdf: boolean) {
    if (!s || blocked || labelFlight.current || !can("lab.sample.collect")) return;
    labelFlight.current = true;
    setLabelPrintFailed(false);
    setPrinting(true);
    setError(undefined);
    try {
      const r = await call("print-lab-label", {
        sampleId: s.sample.sample_id,
        pdf,
      });
      if (r.label) setCollectedLabel(r.label);
      if (r.printError) { setError(new Error(r.printError)); setNotice(""); setLabelPrintFailed(true); return; }
      setNotice(
        r.saved
          ? t("Label PDF saved.", "لیبل پی ڈی ایف محفوظ۔")
          : r.printed
            ? t(
                "Label sent to the mapped label printer.",
                "لیبل مقررہ لیبل پرنٹر کو بھیج دیا۔",
              )
            : t(
                "Save cancelled; sample action was not repeated.",
                "محفوظ کرنا منسوخ؛ نمونہ عمل نہیں دہرایا۔",
              ),
      );
    } catch (e) {
      setError(e);
    } finally {
      setPrinting(false);
      labelFlight.current = false;
      // Read the server count after intentional print; printing does not change row_version.
      setRevision((n) => n + 1);
    }
  }
  function feedback() {
    return (
      <>
        <ErrorBox error={write.error} verbatim />
        {write.notice && <p role="status">{write.notice}</p>}
        {write.attempt && !write.busy && (
          <section className="notice" role="alert">
            <p>
              {t(
                "Outcome unknown. Keep this original action; do not create a replacement.",
                "نتیجہ نامعلوم۔ اصل عمل رکھیں؛ متبادل نہ بنائیں۔",
              )}
            </p>
            <code>{write.attempt.key}</code>
            {write.attempt.body.protection === "idempotent" &&
              canRetryWrite(write.attempt) && (
                <button data-help="bench.recovery" onClick={write.retry}>
                  {t(
                    "Retry original lab request",
                    "اصل لیب درخواست کی دوبارہ کوشش",
                  )}
                </button>
              )}
            <button
              data-help="bench.recovery"
              onClick={() => void write.inspect()}
            >
              {t("Read current lab state", "موجودہ لیب حالت پڑھیں")}
            </button>
            {write.checked && observed && (
              <>
                <p>
                  {t(
                    "Observed sample / test state",
                    "نمونہ / ٹیسٹ کی اصل حالت",
                  )}
                  : {tr(observed.sample?.status)} · {tr(observed.item?.status)}
                </p>
                {observed.previous_results?.map((r) => (
                  <p key={r.result_id}>
                    #{r.result_id} · {tr(r.status)} · {time(r.entered_at)}
                  </p>
                ))}
                <button
                  data-help="bench.recovery"
                  disabled={!reconciled}
                  onClick={() => {
                    write.release();
                    setReview(undefined);
                    setDraft({});
                    setInterpretation("");
                    setRevision((n) => n + 1);
                    setNeedFocus(true);
                  }}
                >
                  {t(
                    "State reviewed; return without resubmitting",
                    "حالت دیکھی؛ دوبارہ ارسال کے بغیر واپس",
                  )}
                </button>
              </>
            )}
            <p>
              {t(
                "Collect, receive and initial result submission cannot replay. Read the actual state first; another deliberate action is offered only when still needed. No automatic retry. After 24 hours or an unresolved result, ask IT.",
                "نمونہ لینا، وصولی اور پہلا نتیجہ دوبارہ ارسال نہیں۔ پہلے اصل حالت؛ ضرورت ہو تو الگ دستی عمل۔ خودکار کوشش نہیں۔24گھنٹے بعد یا نامعلوم پر آئی ٹی سے کہیں۔",
              )}
            </p>
          </section>
        )}
      </>
    );
  }
  if (!visible)
    return (
      <Empty>
        {t(
          "The lab bench is unavailable for this service view.",
          "اس خدمت کے منظر میں لیب بنچ دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      data-help-screen="lab_bench"
      data-write-pending={blocked}
      data-unsaved={dirty}
    >
      <div className="section-heading">
        <div>
          <h1>{t("Scanner-first lab bench", "اسکینر سے لیب بنچ")}</h1>
          <p>
            {t(
              "Identify the patient, label the tube, receive the sample and enter the actual measured result. Verification and payment belong to other staff.",
              "مریض کی شناخت، ٹیوب لیبل، نمونہ وصول اور اصل پیمائش درج کریں۔ تصدیق اور رقم دوسرے عملے کے کام ہیں۔",
            )}
          </p>
        </div>
        <button
          data-help="bench.refresh"
          disabled={blocked}
          onClick={() => {
            setRevision((n) => n + 1);
            setBandCheck(undefined);
            setBandKey("");
          }}
        >
          {t("Refresh bench", "بنچ تازہ کریں")}
        </button>
      </div>
      <p role="status">
        {tr(connected ? stream : "Offline")} ·{" "}
        {view === "open_work"
          ? t(
              "No new laboratory work; existing samples continue.",
              "نیا لیب کام نہیں؛ موجودہ نمونے جاری۔",
            )
          : view === "records"
            ? t("Records only", "صرف ریکارڈ")
            : t("Laboratory bench", "لیب بنچ")}
      </p>
      <ErrorBox error={error} />
      {labelPrintFailed && <p role="status">{t("Label counted by server; printing failed. Check the tube before deliberately reprinting.", "سرور نے لیبل شمار کیا؛ پرنٹ ناکام۔ دوبارہ پرنٹ سے پہلے ٹیوب چیک کریں۔")}</p>}
      {notice && <p role="status">{notice}</p>}
      {!review && feedback()}
      <input
        className="bench-scanner"
        data-help="bench.scan"
        ref={capture}
        aria-label={t("Scanner capture", "اسکینر اندراج")}
        value={buffer}
        disabled={blocked || !!review}
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            open(buffer);
          }
        }}
      />
      <fieldset disabled={blocked || !!review}>
        <section className="card">
          <h2>{t("Sample scanner", "نمونہ اسکینر")}</h2>
          <button
            data-help="bench.scan"
            onClick={() => capture.current?.focus()}
          >
            {t("Arm sample scanner", "نمونہ اسکینر تیار کریں")}
          </button>
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              open(manual);
            }}
          >
            <Field
              label={t(
                "Sample barcode (manual fallback)",
                "نمونہ بارکوڈ (دستی متبادل)",
              )}
            >
              <input
                data-help="bench.scan"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
            </Field>
            <button data-help="bench.scan">
              {t("Open scanned sample", "اسکین نمونہ کھولیں")}
            </button>
          </form>
          <p>
            {t(
              "The idle scanner capture accepts a USB barcode followed by Enter. Fields and dialogs keep their own focus; use Arm sample scanner when ready.",
              "تیار اسکینر میں یو ایس بی بارکوڈ اور انٹر۔ خانے و مکالمے اپنا فوکس رکھتے ہیں؛ تیار پر اسکینر بٹن دیں۔",
            )}
          </p>
        </section>
      </fieldset>
      <fieldset disabled={blocked || !!review}>
        <section className="card">
          <h2>{t("Open worklist", "باقی کام کی فہرست")}</h2>
          <Field label={t("Worklist status", "کام کی حالت")}>
            <select
              data-help="bench.worklist"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t("All open work", "تمام باقی کام")}</option>
              {[
                "Ordered",
                "SampleCollected",
                "Processing",
                "PendingVerification",
              ].map((x) => (
                <option key={x} value={x}>
                  {tr(x)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Find in returned worklist", "موصولہ کام میں تلاش")}>
            <input
              data-help="bench.worklist"
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </Field>
          <LoadState {...list} retry={list.reload} />
          {!list.loading && !list.error && !rows.length && (
            <Empty>
              {view === "records"
                ? t(
                    "Pending worklist is hidden in Records; scan a known sample for permitted history.",
                    "ریکارڈ میں باقی کام پوشیدہ؛ مجاز تاریخ کو اصل نمونہ اسکین کریں۔",
                  )
                : t(
                    "No matching open work. Refresh or clear the filter.",
                    "باقی کام نہیں ملا۔ تازہ یا چھانٹی صاف کریں۔",
                  )}
            </Empty>
          )}
          {rows.map((x) => (
            <article
              className={`card ${x.is_overdue ? "bench-critical" : ""}`}
              key={x.lab_requisition_item_id}
            >
              <h3>
                <bdi>
                  {x.patient_name} · {x.mrn}
                </bdi>
              </h3>
              <p>
                <bdi>
                  {x.requisition_number} · {x.code} · {x.test_name}
                </bdi>
              </p>
              <p>
                {x.is_emergency && (
                  <strong>{t("Emergency priority", "ہنگامی ترجیح")} · </strong>
                )}
                {tr(x.priority)} · {tr(x.status)} ·{" "}
                {tr(x.sample_status || "Not recorded")} ·{" "}
                {x.due_at
                  ? time(x.due_at)
                  : t(
                      "Turnaround starts at receipt",
                      "مدت وصولی سے شروع ہوتی ہے",
                    )}
                {x.is_overdue && <strong> · {t("OVERDUE", "تاخیر")}</strong>}
              </p>
              {x.is_send_out && (
                <p className="notice">
                  {t(
                    "Send-out sample: hand over through the partner-laboratory workflow.",
                    "بیرونی نمونہ: شریک لیب کے مجاز طریقے سے حوالہ دیں۔",
                  )}
                </p>
              )}
              <button
                data-help="bench.scan"
                disabled={!x.barcode}
                onClick={() => x.barcode && open(x.barcode)}
              >
                {t("Scan this worklist sample", "فہرست کا نمونہ کھولیں")}{" "}
                <bdi>{x.barcode}</bdi>
              </button>
            </article>
          ))}
        </section>
      </fieldset>
      <LoadState {...scan} retry={scan.reload} />
      {s && (
        <>
          <section className="card">
            <h2>
              <bdi>
                {s.patient.patient_name} · {s.patient.mrn}
              </bdi>
            </h2>
            <p>
              {tr(s.patient.gender || "Not recorded")} ·{" "}
              {s.patient.age_years ?? t("Age not recorded", "عمر درج نہیں")} ·{" "}
              <bdi>{s.requisition.requisition_number}</bdi>
            </p>
            <p>
              <bdi>
                {s.item.code} · {s.item.test_name} · {s.sample.barcode} ·{" "}
                {s.sample.sample_type}
              </bdi>
            </p>
            <p>
              {tr(s.sample.status)} · {tr(s.item.status)} ·{" "}
              {tr(s.requisition.priority)}
            </p>
            <p>
              <bdi>{s.requisition.clinical_notes}</bdi>
            </p>
            {saved && (
              <p role="status">
                {t("Recorded result", "درج نتیجہ")} #{saved.id} ·{" "}
                {tr(saved.status)}
              </p>
            )}
          </section>
          <fieldset disabled={blocked || !writable || !!review}>
            <section className="card">
              <h2>
                {t("Identify and handle the sample", "شناخت اور نمونہ عمل")}
              </h2>
              <Field
                label={t("Patient identity method", "مریض شناخت کا طریقہ")}
              >
                <select
                  data-help="bench.identity"
                  value={identityMode}
                  onChange={(e) => {
                    setIdentityMode(e.target.value);
                    setBandCheck(undefined);
                    setBandKey("");
                  }}
                >
                  {["WristbandScan", "TwoIdentifiers", "EmergencyOverride"].map(
                    (x) => (
                      <option key={x} value={x}>
                        {tr(x)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              {identityMode === "WristbandScan" && (
                <>
                  <Field
                    label={t(
                      "Patient wristband barcode",
                      "مریض کلائی پٹی بارکوڈ",
                    )}
                  >
                    <input
                      data-help="bench.identity"
                      value={band}
                      maxLength={80}
                      onChange={(e) => {
                        setBand(e.target.value);
                        setBandCheck(undefined);
                        setBandKey("");
                      }}
                    />
                  </Field>
                  <button
                    data-help="bench.identity"
                    disabled={!can("patient.view") || !band.trim()}
                    onClick={() => void verifyBand()}
                  >
                    {t(
                      "Verify this patient wristband",
                      "اسی مریض کی پٹی چیک کریں",
                    )}
                  </button>
                  {bandCheck &&
                    bandKey === `${s.sample.sample_id}:${band.trim()}` && (
                      <p
                        className={
                          bandCheck.match ? "notice" : "bench-critical"
                        }
                      >
                        {bandCheck.match
                          ? t(
                              "Band matches this patient.",
                              "پٹی اسی مریض کی ہے۔",
                            )
                          : t(
                              "STOP: another patient’s wristband. No sample action.",
                              "رکیں: دوسرے مریض کی پٹی۔ نمونہ عمل نہیں۔",
                            )}
                      </p>
                    )}
                </>
              )}
              {identityMode === "TwoIdentifiers" && (
                <label>
                  <input
                    data-help="bench.identity"
                    type="checkbox"
                    checked={asked}
                    onChange={(e) => setAsked(e.target.checked)}
                  />
                  {t(
                    "I asked and matched name and MRN or date of birth.",
                    "میں نے نام اور ایم آر این یا تاریخ پیدائش پوچھ کر ملائی۔",
                  )}
                </label>
              )}
              {identityMode === "EmergencyOverride" && (
                <label>
                  <input
                    data-help="bench.identity"
                    type="checkbox"
                    disabled={!emergencyOrder}
                    checked={emergency}
                    onChange={(e) => setEmergency(e.target.checked)}
                  />
                  {t(
                    "This emergency patient cannot be identified yet; I recorded why.",
                    "یہ ہنگامی مریض ابھی شناخت نہیں ہو سکتا؛ وجہ درج کی ہے۔",
                  )}
                </label>
              )}
              <Field
                label={t("Identity / emergency note", "شناخت / ہنگامی نوٹ")}
              >
                <textarea
                  data-help="bench.identity"
                  value={identityNote}
                  maxLength={300}
                  onChange={(e) => setIdentityNote(e.target.value)}
                />
              </Field>
              <div className="actions">
                {can("lab.sample.collect") && (
                  <button
                    data-help="bench.collect"
                    disabled={s.sample.status !== "Pending"}
                    onClick={() => prepare("collect")}
                  >
                    {t("Review sample collection", "نمونہ لینے کا جائزہ")}
                  </button>
                )}
                {can("lab.sample.receive") && (
                  <button
                    data-help="bench.collect"
                    disabled={
                      !["Pending", "Collected"].includes(s.sample.status)
                    }
                    onClick={() => prepare("receive")}
                  >
                    {t("Review sample receipt", "نمونہ وصولی کا جائزہ")}
                  </button>
                )}
              </div>
              <p>
                {t(
                  "Label the tube at the patient’s side. LAB_PAYMENT_REQUIRED goes back to reception/cashier; never collect money here.",
                  "مریض کے پاس ٹیوب لیبل۔ ادائیگی لازم ہو تو استقبالیہ/کیشیئر؛ یہاں رقم نہیں۔",
                )}
              </p>
            </section>
          </fieldset>
          {can("lab.sample.collect") && (
            <section className="card">
              <h2>{t("Tube label", "ٹیوب لیبل")}</h2>
              {s.sample.status !== "Pending" && (
                  <>
                    {collectedLabel?.fields.sample_id === s.sample.sample_id &&
                      <pre>{collectedLabel.text}</pre>}
                    <button
                      data-help="bench.label"
                      disabled={blocked}
                      onClick={() => void printLabel(false)}
                    >
                      {t("Print sample label", "نمونہ لیبل پرنٹ کریں")}
                    </button>
                    <button
                      data-help="bench.label"
                      disabled={blocked}
                      onClick={() => void printLabel(true)}
                    >
                      {t("Save label PDF", "لیبل پی ڈی ایف محفوظ کریں")}
                    </button>
                    <p>
                      {t(
                        "Print failure does not undo collection. Reprint the same sample label, never collect again.",
                        "پرنٹ خرابی نمونہ عمل واپس نہیں کرتی۔ اسی نمونے کا لیبل پھر لیں، نمونہ عمل نہ دہرائیں۔",
                      )}
                    </p>
                  </>
                )}
            </section>
          )}
          <fieldset disabled={blocked || !writable || !!review}>
            <section className="card">
              <h2>{t("Measured result grid", "پیمائش نتیجہ جدول")}</h2>
              {s.metric_grid.map((m) => {
                const flag = metricFlag(m, draft[m.key] || ""),
                  critical = ["CL", "CH", "C", "Invalid"].includes(flag),
                  abnormal = ["L", "H"].includes(flag);
                return (
                  <article
                    className={
                      critical
                        ? "bench-critical"
                        : abnormal
                          ? "bench-abnormal"
                          : "card"
                    }
                    key={m.key}
                  >
                    <Field
                      label={`${m.label}${m.unit ? " · " + m.unit : ""}${m.required ? " *" : ""}`}
                    >
                      <input
                        data-help="bench.metrics"
                        inputMode={m.type === "number" ? "decimal" : "text"}
                        value={draft[m.key] || ""}
                        onChange={(e) =>
                          setDraft((old) => ({
                            ...old,
                            [m.key]: e.target.value,
                          }))
                        }
                      />
                    </Field>
                    <p>
                      {t("Patient reference range", "مریض کی حوالہ حد")}:{" "}
                      <bdi>
                        {m.reference_range?.join(" – ") ||
                          t("Not configured", "مقرر نہیں")}
                      </bdi>{" "}
                      · {t("Live preview flag", "ابتدائی نشان")}:{" "}
                      <strong>{flag || "—"}</strong>
                    </p>
                    {m.critical?.values && (
                      <p>
                        {t("Critical text values", "انتہائی اہم متنی قدر")}:{" "}
                        <bdi>{m.critical.values.join(", ")}</bdi>
                      </p>
                    )}
                  </article>
                );
              })}
              <p>
                {t(
                  "Live flags are a preview; the server validates and returns the recorded flags. Critical values require prompt clinical communication through the authorised workflow. No local publication or acknowledgement.",
                  "نشان ابتدائی؛ سرور اصل نشان و جانچ۔ انتہائی اہم نتیجہ مجاز طریقے سے فوراً طبی عملے کو بتائیں۔ مقامی اشاعت یا تصدیق نہیں۔",
                )}
              </p>
              <Field label={t("Interpretation", "تشریح")}>
                <textarea
                  data-help="bench.metrics"
                  value={interpretation}
                  maxLength={4000}
                  onChange={(e) => setInterpretation(e.target.value)}
                />
              </Field>
              {list.data?.find(
                (x) =>
                  x.lab_requisition_item_id === s.item.lab_requisition_item_id,
              )?.is_send_out && (
                <>
                  <Field
                    label={t("Partner report reference", "شریک رپورٹ حوالہ")}
                  >
                    <input
                      data-help="bench.metrics"
                      value={partnerRef}
                      maxLength={100}
                      onChange={(e) => setPartnerRef(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t(
                      "Partner reporting time (hospital time)",
                      "شریک رپورٹ کا وقت (ہسپتال وقت)",
                    )}
                  >
                    <input
                      data-help="bench.metrics"
                      type="datetime-local"
                      value={partnerAt}
                      onChange={(e) => setPartnerAt(e.target.value)}
                    />
                  </Field>
                </>
              )}
              {can("lab.result.enter") && (
                <button
                  data-help="bench.result"
                  disabled={
                    s.sample.status !== "Received" ||
                    s.item.status !== "Processing"
                  }
                  onClick={() => prepare("result")}
                >
                  {t("Review Submit and Broadcast", "درج اور اطلاع کا جائزہ")}
                </button>
              )}
            </section>
            <section className="card">
              <h2>
                {t(
                  "Rejection, re-run and published correction",
                  "نمونہ مسترد، دوبارہ ٹیسٹ اور شائع تصحیح",
                )}
              </h2>
              <Field label={t("Reason / rejection note", "وجہ / مسترد نوٹ")}>
                <textarea
                  data-help="bench.reason"
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <Field label={t("Sample rejection code", "نمونہ مسترد وجہ")}>
                <select
                  data-help="bench.reject"
                  value={rejectCode}
                  onChange={(e) =>
                    setRejectCode(e.target.value as typeof rejectCode)
                  }
                >
                  {[
                    "Haemolysed",
                    "Clotted",
                    "InsufficientVolume",
                    "WrongContainer",
                    "Unlabelled",
                    "Mislabelled",
                    "Leaked",
                    "DelayedTransport",
                    "Contaminated",
                    "RejectedByPartner",
                    "Other",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {tr(x)}
                    </option>
                  ))}
                </select>
              </Field>
              {(can("lab.sample.receive") || can("lab.sendout.manage")) && (
                <button
                  data-help="bench.reject"
                  disabled={
                    s.previous_results.length > 0 ||
                    ["Rejected", "Consumed"].includes(s.sample.status)
                  }
                  onClick={() => prepare("reject")}
                >
                  {t("Review sample rejection", "نمونہ مسترد کرنے کا جائزہ")}
                </button>
              )}
              {can("lab.rerun.request") && (
                <button
                  data-help="bench.rerun"
                  disabled={s.item.status === "Cancelled"}
                  onClick={() => prepare("rerun")}
                >
                  {t("Review a linked re-run", "منسلک دوبارہ ٹیسٹ جائزہ")}
                </button>
              )}
              <Field
                label={t(
                  "Published result to amend",
                  "تصحیح کے لیے شائع نتیجہ",
                )}
              >
                <select
                  data-help="bench.correct"
                  value={correctId}
                  onChange={(e) => setCorrectId(e.target.value)}
                >
                  <option value="">
                    {t("Select actual published result", "اصل شائع نتیجہ چنیں")}
                  </option>
                  {s.previous_results
                    .filter((r) => r.status === "Published")
                    .map((r) => (
                      <option key={r.result_id} value={r.result_id}>
                        #{r.result_id} · {time(r.entered_at)}
                      </option>
                    ))}
                </select>
              </Field>
              {can("lab.result.enter") && (
                <button
                  data-help="bench.correct"
                  disabled={!correctId}
                  onClick={() => prepare("correct")}
                >
                  {t(
                    "Review published correction",
                    "شائع نتیجے کی تصحیح جائزہ",
                  )}
                </button>
              )}
              <p>
                {t(
                  "A rejection or re-run returns actual replacement barcodes; a correction is a new result requiring verification, never an edit of signed history.",
                  "مسترد/دوبارہ ٹیسٹ اصل نئے بارکوڈ دے؛ تصحیح نیا نتیجہ ہے جسے تصدیق چاہیے، دستخط تاریخ کی ترمیم نہیں۔",
                )}
              </p>
            </section>
          </fieldset>
          <section className="card">
            <h2>{t("Previous results / signatures", "پچھلے نتائج / دستخط")}</h2>
            {s.previous_results.map((r) => (
              <article key={r.result_id}>
                <h3>
                  #{r.result_id} · {tr(r.status)}
                </h3>
                {Object.entries(r.metrics_jsonb).map(([key, value]) => (
                  <p key={key}>
                    <bdi>
                      {s.metric_grid.find((m) => m.key === key)?.label || key} ·{" "}
                      {String(value ?? "—")} · {r.flags_jsonb[key]}
                    </bdi>
                  </p>
                ))}
                <p>
                  <bdi>
                    {r.interpretation} · {r.correction_reason} ·{" "}
                    {r.partner_name} · {r.partner_report_ref}
                  </bdi>
                </p>
                <p>
                  <bdi>{r.performed_stamp.text}</bdi>
                </p>
                <p>
                  <bdi>
                    {r.verified_stamp?.text ||
                      t("Pending verification", "تصدیق منتظر")}
                  </bdi>
                </p>
              </article>
            ))}
          </section>
        </>
      )}
      {replacement.length > 0 && (
        <section className="card">
          <h2>
            {t("Actual returned item barcodes", "واپس ملے اصل ٹیسٹ بارکوڈ")}
          </h2>
          {replacement.map((x) => (
            <p key={x.item}>
              #{x.item} · <bdi>{x.barcode || "—"}</bdi>
            </p>
          ))}
        </section>
      )}
      {review && (
        <Modal
          title={t("Confirm lab bench action", "لیب بنچ عمل کی تصدیق")}
          closable={!blocked}
          onClose={() => {
            if (!blocked) {
              setReview(undefined);
              setNeedFocus(true);
            }
          }}
        >
          <p>
            <bdi>
              {review.sample.patient.patient_name} · {review.sample.patient.mrn}{" "}
              · {review.sample.sample.barcode} · {review.sample.item.test_name}
            </bdi>
          </p>
          <p>
            {tr(review.action)} ·{" "}
            {t(
              "Review the identity, actual measured values and reason before confirming once.",
              "ایک تصدیق سے پہلے شناخت، اصل پیمائش و وجہ چیک کریں۔",
            )}
          </p>
          {Object.entries((review.body || {}) as Record<string, unknown>).map(
            ([key, value]) => (
              <p key={key}>
                <bdi>
                  {key === "metrics"
                    ? Object.entries(value as Record<string, unknown>)
                        .map(
                          ([k, v]) =>
                            `${review.sample.metric_grid.find((m) => m.key === k)?.label || k}: ${String(v)}`,
                        )
                        .join(" · ")
                    : String(value ?? "")}
                </bdi>
              </p>
            ),
          )}
          {tried && feedback()}
          <button
            data-help="bench.confirm"
            disabled={blocked}
            onClick={confirm}
          >
            {t("Confirm lab bench action", "لیب بنچ عمل کی تصدیق")}
          </button>
        </Modal>
      )}
    </section>
  );
}
