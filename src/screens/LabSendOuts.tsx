import { useEffect, useRef, useState } from "react";
import { api, call, ApiError } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { useClinicalWrite } from "../clinical-write";
import { canRetryWrite } from "../write-attempt";
import { bilingual as t } from "../i18n";
import { formatHospitalTime, hospitalTimeToUtc } from "../hospital-time";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as so from "../generated/lab_send_outs";
import * as lab from "../generated/lab_bench";
import { benchMetrics, metricFlag, benchSnapshot } from "../lab-bench-policy";
import {
  assertManifestSample,
  dispatchBody,
  manifestItemSnapshot,
  partnerEligible,
  partnerReportFields,
  pendingSnapshot,
  sendOutAccess,
  sendOutLimit,
} from "../lab-sendout-policy";
type Props = {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
};
type Review =
  | {
      kind: "dispatch";
      body: so.SendOutIn;
      rows: so.SendOutPendingOut[];
      partner: so.PartnerOut;
    }
  | {
      kind: "result" | "reject";
      body: so.ResultIn | so.SampleRejectIn;
      sample?: lab.LabScanOut;
      item: so.SendOutItemOut;
      manifestId: number;
    };
const viewOf = (e: EstablishmentOut) =>
  e.views.screens.find((x) => x.screen_id === "lab_send_outs")?.view ||
  "hidden";
const statusLabel = (s: string) =>
  (
    ({
      Routine: t("Routine", "معمول"),
      Urgent: t("Urgent", "فوری"),
      STAT: t("STAT — immediate", "فوری STAT"),
      Pending: t("Pending", "منتظر"),
      Cancelled: t("Cancelled", "منسوخ"),
      ReRunRequired: t("Repeat test required", "دوبارہ ٹیسٹ لازم"),
      Dispatched: t("At partner", "شریک کے پاس"),
      Rejected: t("Rejected — replacement required", "مسترد — متبادل لازم"),
      Consumed: t("Result entered", "نتیجہ درج"),
      Processing: t("Processing", "پراسیس ہو رہا ہے"),
      PendingVerification: t("Pending verification", "تصدیق کے منتظر"),
      Published: t("Published", "شائع شدہ"),
      SampleCollected: t("Sample collected", "نمونہ لیا"),
      Collected: t("Collected", "لیا گیا"),
      Received: t("Received", "وصول شدہ"),
      Ordered: t("Awaiting collection", "نمونہ لینے کے منتظر"),
    }) as Record<string, string>
  )[s] || s;
export function LabSendOuts({
  user,
  connected,
  stream,
  establishment,
  timeZone,
}: Props) {
  const view = viewOf(establishment),
    access = sendOutAccess(user.permissions, view),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [detailRevision, setDetailRevision] = useState(0);
  const [partnerId, setPartnerId] = useState(""),
    [selected, setSelected] = useState<number[]>([]),
    [courier, setCourier] = useState(""),
    [note, setNote] = useState(""),
    [pendingFind, setPendingFind] = useState("");
  const [filterPartner, setFilterPartner] = useState(""),
    [outstanding, setOutstanding] = useState(true),
    [limit, setLimit] = useState("100"),
    [find, setFind] = useState("");
  const [filters, setFilters] = useState<Parameters<typeof so.listSendOuts>[0]>(
    { outstanding: true, limit: 100 },
  );
  const [id, setId] = useState(0),
    [lookup, setLookup] = useState(""),
    [sampleId, setSampleId] = useState(0),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [interpretation, setInterpretation] = useState(""),
    [reference, setReference] = useState(""),
    [reportedAt, setReportedAt] = useState(""),
    [rejectionNote, setRejectionNote] = useState("");
  const [review, setReview] = useState<Review>(),
    [submitted, setSubmitted] = useState(false),
    [error, setError] = useState<unknown>(),
    [printing, setPrinting] = useState(false),
    [notice, setNotice] = useState<
      "dispatch" | "result" | "reject" | "printed" | "saved" | "cancelled"
    >(),
    [savedResult, setSavedResult] = useState<{ id: number; status: string }>(),
    [replacement, setReplacement] =
      useState<{ item: number; barcode: string | null }[]>();
  const printFlight = useRef(false),
    currentId = useRef(id);
  currentId.current = id;
  const partners = useLoad(
    () =>
      access.read
        ? so.listPartners({ services: "Lab", active_only: false })
        : Promise.resolve([]),
    [access.read, revision],
  );
  const pending = useLoad(
    () => (access.work ? so.sendOutsPending() : Promise.resolve([])),
    [access.work, revision],
  );
  const manifests = useLoad(
    () =>
      access.read
        ? so.listSendOuts({
            ...filters,
            ...(view === "records" ? { outstanding: false } : {}),
          })
        : Promise.resolve([]),
    [access.read, view, filters, revision],
  );
  const detail = useLoad(
    () => (access.read && id ? so.getSendOut(id) : Promise.resolve(undefined)),
    [access.read, id, detailRevision, view],
  );
  const manifest =
    !detail.loading && !detail.error && detail.data?.send_out_id === id
      ? detail.data
      : undefined;
  const item = manifest?.items.find((x) => x.sample_id === sampleId);
  const scan = useLoad(
    () =>
      access.result && item
        ? lab.scanLab(encodeURIComponent(item.barcode))
        : Promise.resolve(undefined),
    [
      access.result,
      id,
      item?.sample_id,
      item?.barcode,
      item?.item_status,
      item?.sample_status,
      detailRevision,
    ],
  );
  const sample =
    !scan.loading &&
    !scan.error &&
    item &&
    scan.data?.sample.sample_id === sampleId &&
    scan.data.sample.barcode === item.barcode
      ? scan.data
      : undefined;
  const currentPending =
      !pending.loading && !pending.error ? pending.data || [] : [],
    currentPartners =
      !partners.loading && !partners.error ? partners.data || [] : [];
  const chosenPartner = currentPartners.find(
    (p) => p.partner_id === Number(partnerId),
  );
  const dispatchRows = currentPending.filter((r) =>
    `${r.barcode} ${r.patient_name} ${r.mrn} ${r.test_name} ${r.requisition_number} ${r.partner_name}`
      .toLowerCase()
      .includes(pendingFind.trim().toLowerCase()),
  );
  const rows =
    !manifests.loading && !manifests.error
      ? (manifests.data || []).filter((r) =>
          `${r.manifest_number} ${r.partner_name} ${r.courier}`
            .toLowerCase()
            .includes(find.trim().toLowerCase()),
        )
      : [];
  const resultDirty =
    Object.values(draft).some(Boolean) ||
    !!interpretation ||
    !!reference ||
    !!reportedAt ||
    !!rejectionNote;
  const dirty = selected.length > 0 || !!courier || !!note || resultDirty;
  function resetResult() {
    setDraft({});
    setInterpretation("");
    setReference("");
    setReportedAt("");
    setRejectionNote("");
  }
  const refresh = () => {
    setRevision((n) => n + 1);
    setDetailRevision((n) => n + 1);
  };
  const write = useClinicalWrite(
    user,
    "lab-sendouts",
    async (value, command) => {
      const kind = review?.kind;
      setReview(undefined);
      if (command.path === "/lab/send-outs") {
        const record = value as so.SendOutDetailOut;
        setId(record.send_out_id);
        setLookup(String(record.send_out_id));
        setSelected([]);
        setCourier("");
        setNote("");
        setSampleId(0);
        setNotice("dispatch");
      } else if (command.path.endsWith("/results")) {
        const r = value as so.LabResultOut;
        setSavedResult({ id: r.result_id, status: r.status });
        resetResult();
        setNotice("result");
      } else if (kind === "reject") {
        const r = value as so.LabRequisitionDetailOut;
        setReplacement(
          r.items
            .filter(
              (x) =>
                x.lab_requisition_item_id ===
                (review as Extract<Review, { kind: "result" | "reject" }>).item
                  .lab_requisition_item_id,
            )
            .map((x) => ({
              item: x.lab_requisition_item_id,
              barcode: x.barcode,
            })),
        );
        resetResult();
        setSampleId(0);
        setNotice("reject");
      }
      refresh();
    },
  );
  const blocked = write.blocked || printing;
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (e.type === "stream" && e.status === "Live" && e.resync) refresh();
      }),
    [],
  );
  useEffect(() => {
    if (!dirty && !blocked) return;
    const stop = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty, blocked]);
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      [
        "DIAGNOSTIC_PARTNER_INVALID",
        "LAB_SAMPLE_STATE_INVALID",
        "LAB_ITEM_STATE_INVALID",
      ].includes(write.error.response.error?.code || "")
    )
      refresh();
  }, [write.error]);
  const time = (v?: string | null) =>
    v
      ? timeZone
        ? formatHospitalTime(v, timeZone)
        : v
      : t("Not recorded", "درج نہیں");
  function openManifest(next: number) {
    if (blocked || review) return;
    if (!Number.isSafeInteger(next) || next < 1) {
      setError(
        Error(
          t(
            "Enter an actual positive manifest ID.",
            "اصل مثبت روانگی فہرست نمبر دیں۔",
          ),
        ),
      );
      return;
    }
    if (
      next !== id &&
      resultDirty &&
      !window.confirm(
        t(
          "Discard the unsent partner result draft?",
          "غیر ارسال شریک نتیجہ مسودہ چھوڑیں؟",
        ),
      )
    )
      return;
    if (next !== id) {
      resetResult();
      setSampleId(0);
      setSavedResult(undefined);
      setReplacement(undefined);
    }
    setError(undefined);
    setId(next);
    setLookup(String(next));
    setDetailRevision((n) => n + 1);
  }
  function openSample(next: so.SendOutItemOut) {
    if (blocked || review) return;
    if (
      next.sample_id !== sampleId &&
      resultDirty &&
      !window.confirm(
        t(
          "Discard the unsent partner result draft?",
          "غیر ارسال شریک نتیجہ مسودہ چھوڑیں؟",
        ),
      )
    )
      return;
    resetResult();
    setSampleId(next.sample_id);
    setError(undefined);
    setSavedResult(undefined);
    setDetailRevision((n) => n + 1);
  }
  function prepare(kind: Review["kind"]) {
    if (blocked || review || !live) return;
    setError(undefined);
    setSubmitted(false);
    try {
      if (kind === "dispatch") {
        if (
          !access.work ||
          pending.loading ||
          pending.error ||
          partners.loading ||
          partners.error
        )
          throw Error(
            t(
              "Refresh current samples and partners first.",
              "پہلے موجودہ نمونے اور شریک تازہ کریں۔",
            ),
          );
        const body = dispatchBody(
          chosenPartner,
          selected,
          currentPending,
          courier,
          note,
        );
        setReview({
          kind,
          body,
          rows: selected.map((s) =>
            currentPending.find((x) => x.sample_id === s)!,
          ),
          partner: chosenPartner!,
        });
      } else {
        if (
          !manifest ||
          !item ||
          (kind === "reject" && !access.work) ||
          (kind === "result" && (!sample || !access.result))
        )
          throw Error(
            t(
              "Read the exact current manifest sample first.",
              "پہلے فہرست کا عین موجودہ نمونہ پڑھیں۔",
            ),
          );
        if (
          item.sample_status !== "Dispatched" ||
          item.item_status !== "Processing" ||
          item.result_entered_at
        )
          throw Error(
            t(
              "Refresh the current outstanding sample.",
              "موجودہ باقی نمونہ تازہ کریں۔",
            ),
          );
        if (kind === "result")
          assertManifestSample(sample!, item, manifest.send_out_id);
        if (kind === "result") {
          if (!timeZone)
            throw Error(
              t(
                "Hospital timezone is unavailable. Refresh before recording a time.",
                "ہسپتال کا زمانی علاقہ نہیں۔ وقت درج کرنے سے پہلے تازہ کریں۔",
              ),
            );
          const fields = partnerReportFields(
              reference,
              reportedAt,
              interpretation,
            ),
            metrics = benchMetrics(sample!.metric_grid, draft);
          setReview({
            kind,
            body: {
              ...fields,
              partner_reported_at: hospitalTimeToUtc(reportedAt, timeZone),
              metrics,
            },
            sample,
            item,
            manifestId: id,
          });
        } else {
          if (rejectionNote.trim().length > 500)
            throw Error(
              t(
                "The rejection note is limited to500characters.",
                "مسترد نوٹ500حروف تک ہے۔",
              ),
            );
          setReview({
            kind,
            body: {
              code: "RejectedByPartner",
              ...(rejectionNote.trim() ? { note: rejectionNote.trim() } : {}),
            },
            sample,
            item,
            manifestId: id,
          });
        }
      }
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!review || blocked || submitted || !live) return;
    const frozen = review;
    setSubmitted(true);
    const command =
      frozen.kind === "dispatch"
        ? {
            path: "/lab/send-outs",
            permission: "lab.sendout.manage",
            protection: "idempotent" as const,
            reconcilePath: "/lab/send-outs?limit=500",
          }
        : frozen.kind === "result"
          ? {
              path: `/lab/items/${frozen.item.lab_requisition_item_id}/results`,
              permission: "lab.result.enter",
              protection: "reconcile" as const,
              reconcilePath: `/lab/scan/${encodeURIComponent(frozen.item.barcode)}`,
            }
          : {
              path: `/lab/samples/${frozen.item.sample_id}/reject`,
              permission: "lab.sendout.manage",
              protection: "idempotent" as const,
              reconcilePath: `/lab/requisitions/${frozen.item.requisition_id}`,
            };
    write.start(
      {
        method: "POST",
        ...command,
        body: frozen.body,
        label:
          frozen.kind === "dispatch"
            ? t("Dispatch one manifest", "ایک فہرست روانہ کریں")
            : frozen.kind === "result"
              ? t("Record partner result", "شریک نتیجہ درج کریں")
              : t("Record partner rejection", "شریک کا مسترد درج کریں"),
      },
      async () => {
        const [me, est] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
        ]);
        const a = sendOutAccess(me.permissions, viewOf(est));
        if (
          me.user_id !== user.user_id ||
          (frozen.kind !== "result" && !a.work) ||
          (frozen.kind === "result" && !a.result)
        )
          throw Error(
            t(
              "The actor, permission or service changed. Close and review again.",
              "صارف، اجازت یا خدمت بدل گئی۔ بند کرکے پھر جائزہ لیں۔",
            ),
          );
        if (frozen.kind === "dispatch") {
          const [list, ps] = await Promise.all([
            so.sendOutsPending(),
            so.listPartners({ services: "Lab", active_only: false }),
          ]);
          const p = ps.find((x) => x.partner_id === frozen.body.partner_id);
          dispatchBody(
            p,
            frozen.body.sample_ids,
            list,
            frozen.body.courier || "",
            frozen.body.note || "",
          );
          if (
            p?.row_version !== frozen.partner.row_version ||
            frozen.rows.some((r) => {
              const n = list.find((x) => x.sample_id === r.sample_id);
              return !n || pendingSnapshot(n) !== pendingSnapshot(r);
            })
          )
            throw Error(
              t(
                "A selected sample or partner changed. Close and review the current pending list.",
                "منتخب نمونہ یا شریک بدل گیا۔ بند کرکے موجودہ فہرست دیکھیں۔",
              ),
            );
        } else {
          const [m, s] = await Promise.all([
            so.getSendOut(frozen.manifestId),
            frozen.kind === "result"
              ? lab.scanLab(encodeURIComponent(frozen.item.barcode))
              : Promise.resolve(undefined),
          ]);
          const row = m.items.find(
            (x) => x.sample_id === frozen.item.sample_id,
          );
          if (
            !row ||
            manifestItemSnapshot(row) !== manifestItemSnapshot(frozen.item) ||
            (frozen.kind === "result" &&
              (!s ||
                !frozen.sample ||
                benchSnapshot(s) !== benchSnapshot(frozen.sample)))
          )
            throw Error(
              t(
                "The sample, result or manifest changed. Close and review its current state.",
                "نمونہ، نتیجہ یا فہرست بدل گئی۔ بند کرکے تازہ حالت دیکھیں۔",
              ),
            );
          if (frozen.kind === "result")
            assertManifestSample(s!, row, m.send_out_id);
          else if (
            row.sample_status !== "Dispatched" ||
            row.item_status !== "Processing" ||
            row.result_entered_at
          )
            throw Error("The partner sample is no longer awaiting rejection.");
        }
      },
    );
  }
  async function print(pdf: boolean) {
    if (!manifest || blocked || review || printFlight.current || !access.print)
      return;
    printFlight.current = true;
    setPrinting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await call("print-sendout", {
        sendOutId: manifest.send_out_id,
        pdf,
      });
      setNotice(
        result.saved ? "saved" : result.printed ? "printed" : "cancelled",
      );
    } catch (e) {
      setError(e);
    } finally {
      printFlight.current = false;
      setPrinting(false);
    }
  }
  // Recovery renders only a safe projection: rejection replies contain billing data.
  const observed = write.observed as any;
  const observationMatches =
    review?.kind === "dispatch"
      ? Array.isArray(observed)
      : review?.kind === "result"
        ? observed?.sample?.sample_id === review.item.sample_id &&
          observed?.sample?.barcode === review.item.barcode &&
          observed?.patient?.mrn === review.item.mrn
        : review?.kind === "reject"
          ? observed?.requisition_id === review.item.requisition_id &&
            observed?.mrn === review.item.mrn
          : false;
  function release() {
    if (!write.checked || !observationMatches) return;
    write.release();
    setReview(undefined);
    setSampleId(0);
    resetResult();
    refresh();
  }
  if (!access.read)
    return (
      <Empty>
        {t(
          "Send-out work is unavailable or you lack viewing permission.",
          "بیرونی لیب کام دستیاب نہیں یا پڑھنے کی اجازت نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      className="sendout-screen"
      data-help-screen="lab_send_outs"
      data-write-pending={blocked}
      data-unsaved={dirty && !blocked}
    >
      <header className="section-heading">
        <div>
          <h1>
            {t(
              "Samples sent to partner laboratories",
              "شراکت دار لیب کو بھیجے گئے نمونے",
            )}
          </h1>
          <p>
            {t(
              "Match samples, hand them over on one signed manifest, then record each real partner report.",
              "نمونے ملائیں، ایک دستخط فہرست پر حوالہ، پھر ہر اصل شریک رپورٹ درج کریں۔",
            )}
          </p>
        </div>
        <button
          data-help="sendout.refresh"
          disabled={blocked}
          onClick={refresh}
        >
          {t("Refresh send-outs", "بیرونی لیب کام تازہ کریں")}
        </button>
      </header>
      <p className="muted">
        {live
          ? t("Live connection", "لائیو رابطہ")
          : t(
              "Disconnected or reconnecting — writes blocked.",
              "رابطہ منقطع یا بحال — ارسال بند۔",
            )}
        {t(
          " · Dispatches have no dedicated live event; refresh after another terminal changes them.",
          " · روانگی کا الگ لائیو واقعہ نہیں؛ دوسرے ٹرمینل کی تبدیلی پر تازہ کریں۔",
        )}
      </p>
      {view === "open_work" && (
        <p className="notice">
          {t(
            "No new outsourced diagnostic orders from now on; finish existing samples and reports.",
            "اب نئے بیرونی تشخیصی احکام نہیں؛ موجودہ نمونے و رپورٹس مکمل کریں۔",
          )}
        </p>
      )}
      {view === "records" && (
        <p className="notice">
          {t(
            "Records — manifest history and printing only.",
            "ریکارڈ — صرف فہرست کی تاریخ اور پرنٹ۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      {!review && <ErrorBox error={write.error} verbatim />}
      {notice && (
        <p role="status">
          {
            {
              dispatch: t(
                "Dispatch confirmed. Print this same manifest for the courier to sign; do not dispatch again.",
                "روانگی تصدیق۔ اسی فہرست کو لے جانے والے کے دستخط کے لیے پرنٹ؛ دوبارہ روانگی نہیں۔",
              ),
              result: t(
                "Partner result recorded for independent verification; not a published report.",
                "شریک نتیجہ آزاد تصدیق کے لیے درج؛ شائع رپورٹ نہیں۔",
              ),
              reject: t(
                "Partner rejection recorded. Collect the actual replacement barcode; never reuse the rejected sample.",
                "شریک مسترد درج۔ اصل متبادل بارکوڈ سے نمونہ لیں؛ پرانا استعمال نہیں۔",
              ),
              printed: t(
                "Manifest sent to the printer.",
                "فہرست پرنٹر کو بھیجی۔",
              ),
              saved: t("Manifest PDF saved.", "فہرست پی ڈی ایف محفوظ۔"),
              cancelled: t(
                "PDF save cancelled; dispatch and results are unchanged.",
                "پی ڈی ایف محفوظ منسوخ؛ روانگی و نتائج نہیں بدلے۔",
              ),
            }[notice]
          }
        </p>
      )}
      {savedResult && (
        <p>
          {t("Recorded result", "درج نتیجہ")} <bdi>{savedResult.id}</bdi> ·{" "}
          {statusLabel(savedResult.status)}
        </p>
      )}
      {replacement && (
        <aside className="notice" data-testid="sendout-replacement">
          <h2>{t("Replacement sample to collect", "متبادل نمونہ لینا ہے")}</h2>
          {replacement.map((r) => (
            <p key={r.item}>
              <bdi>
                {r.barcode ||
                  t(
                    "No replacement barcode returned — refresh and ask the laboratory.",
                    "متبادل بارکوڈ نہیں — تازہ کرکے لیب سے رابطہ۔",
                  )}
              </bdi>
            </p>
          ))}
          <p>
            {t(
              "Collection and tube labelling belong to the collection/bench workflow. This screen has not collected the replacement.",
              "نمونہ لینا اور ٹیوب لیبل متعلقہ بنچ طریقہ ہے۔ یہاں متبادل نمونہ نہیں لیا گیا۔",
            )}
          </p>
        </aside>
      )}
      <fieldset disabled={blocked || !!review}>
        {access.work && (
          <section className="card">
            <h2>{t("Samples awaiting dispatch", "روانگی کے منتظر نمونے")}</h2>
            <LoadState {...pending} retry={pending.reload} />
            <LoadState {...partners} retry={partners.reload} />
            <Field
              label={t(
                "Find pending sample or patient",
                "منتظر نمونہ یا مریض تلاش",
              )}
            >
              <input
                data-help="sendout.find-pending"
                value={pendingFind}
                onChange={(e) => setPendingFind(e.target.value)}
              />
            </Field>
            {!pending.loading && !pending.error && !dispatchRows.length && (
              <p>
                {t(
                  "No collected send-out samples match. Collection and payment prerequisites are handled in their own workflows.",
                  "کوئی لیا ہوا بیرونی نمونہ نہیں ملا۔ نمونہ لینے اور ادائیگی کی شرط متعلقہ طریقوں میں پوری کریں۔",
                )}
              </p>
            )}
            <div className="sendout-samples">
              {dispatchRows.map((r) => (
                <article
                  className="card"
                  key={r.sample_id}
                  data-testid="sendout-pending-row"
                >
                  <label>
                    <input
                      data-help="sendout.select"
                      type="checkbox"
                      checked={selected.includes(r.sample_id)}
                      onChange={(e) => {
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, r.sample_id]
                            : ids.filter((x) => x !== r.sample_id),
                        );
                        if (e.target.checked && !partnerId && r.partner_id)
                          setPartnerId(String(r.partner_id));
                      }}
                    />
                    {t("Select sample", "نمونہ چنیں")}{" "}
                    <bdi>
                      {r.barcode} · {r.test_name}
                    </bdi>
                  </label>
                  <p>
                    <bdi>
                      {r.patient_name} · {r.mrn} · {r.requisition_number}
                    </bdi>
                  </p>
                  <p>
                    {statusLabel(r.sample_status)} · {statusLabel(r.priority)} ·{" "}
                    {t("Usual partner", "معمول کا شریک")}:{" "}
                    <bdi>
                      {r.partner_name || t("Not configured", "مقرر نہیں")}
                    </bdi>
                  </p>
                </article>
              ))}
            </div>
            <p>
              {t("Selected samples", "منتخب نمونے")}: {selected.length}
            </p>
            <div className="form-grid">
              <Field
                label={t(
                  "Dispatch to one partner laboratory",
                  "ایک شراکت دار لیب کو روانگی",
                )}
              >
                <select
                  data-help="sendout.partner"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  <option value="">{t("Choose a partner", "شریک چنیں")}</option>
                  {currentPartners.map((p) => (
                    <option
                      key={p.partner_id}
                      value={p.partner_id}
                      disabled={!partnerEligible(p)}
                    >
                      {p.name}
                      {!partnerEligible(p)
                        ? t(
                            " — unavailable / expired MOU",
                            " — غیر دستیاب / معاہدہ ختم",
                          )
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Courier (optional)", "لے جانے والا (اختیاری)")}>
                <input
                  data-help="sendout.courier"
                  value={courier}
                  maxLength={200}
                  onChange={(e) => setCourier(e.target.value)}
                />
              </Field>
            </div>
            {chosenPartner && (
              <aside className="notice">
                <p>
                  <bdi>
                    {chosenPartner.name} · {chosenPartner.phc_registration} ·{" "}
                    {chosenPartner.contact}
                  </bdi>
                </p>
                <p>
                  {t(
                    "MOU reference / validity / turnaround hours",
                    "معاہدہ حوالہ / مدت / گھنٹے",
                  )}
                  :{" "}
                  <bdi>
                    {chosenPartner.mou_reference} ·{" "}
                    {chosenPartner.mou_valid_from} —{" "}
                    {chosenPartner.mou_valid_until} ·{" "}
                    {chosenPartner.turnaround_hours ??
                      t("Not recorded", "درج نہیں")}
                  </bdi>
                </p>
                {!partnerEligible(chosenPartner) && (
                  <p className="error">
                    {t(
                      "This partner is unavailable or its MOU has expired. Choose another valid partner or contact Lab Admin.",
                      "شریک غیر دستیاب یا معاہدہ ختم۔ دوسرا مجاز شریک یا لیب ایڈمن سے رابطہ۔",
                    )}
                  </p>
                )}
                {currentPending.some(
                  (r) =>
                    selected.includes(r.sample_id) &&
                    r.partner_id !== chosenPartner.partner_id,
                ) && (
                  <p>
                    {t(
                      "Some tests have a different usual partner. Verify this deliberate destination before confirming.",
                      "کچھ ٹیسٹ کا معمول شریک مختلف۔ تصدیق سے پہلے یہ واضح منزل چیک کریں۔",
                    )}
                  </p>
                )}
              </aside>
            )}
            <Field
              label={t("Dispatch note (optional)", "روانگی نوٹ (اختیاری)")}
            >
              <textarea
                data-help="sendout.note"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <button
              data-help="sendout.review-dispatch"
              disabled={
                !live ||
                pending.loading ||
                !!pending.error ||
                partners.loading ||
                !!partners.error
              }
              onClick={() => prepare("dispatch")}
            >
              {t("Review dispatch", "روانگی کا جائزہ")}
            </button>
          </section>
        )}
        <div className="sendout-layout">
          <section className="card">
            <h2>{t("Manifest register", "روانگی فہرست رجسٹر")}</h2>
            <div className="form-grid">
              <Field label={t("Filter by partner", "شریک کی چھانٹی")}>
                <select
                  data-help="sendout.filters"
                  value={filterPartner}
                  onChange={(e) => setFilterPartner(e.target.value)}
                >
                  <option value="">{t("All partners", "تمام شریک")}</option>
                  {currentPartners.map((p) => (
                    <option key={p.partner_id} value={p.partner_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t("Maximum manifests (1–500)", "فہرستوں کی حد (1–500)")}
              >
                <input
                  data-help="sendout.filters"
                  value={limit}
                  inputMode="numeric"
                  onChange={(e) => setLimit(e.target.value)}
                />
              </Field>
            </div>
            {view !== "records" && (
              <label>
                <input
                  data-help="sendout.filters"
                  type="checkbox"
                  checked={outstanding}
                  onChange={(e) => setOutstanding(e.target.checked)}
                />
                {t("Outstanding manifests only", "صرف باقی نتائج والی فہرستیں")}
              </label>
            )}
            <button
              data-help="sendout.filters"
              onClick={() => {
                try {
                  setFilters({
                    limit: sendOutLimit(limit),
                    outstanding,
                    ...(filterPartner
                      ? { partner_id: Number(filterPartner) }
                      : {}),
                  });
                  setError(undefined);
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t("Apply manifest filters", "فہرست کی چھانٹی لگائیں")}
            </button>
            <Field
              label={t("Find in returned manifests", "موصولہ فہرستوں میں تلاش")}
            >
              <input
                data-help="sendout.find"
                value={find}
                onChange={(e) => setFind(e.target.value)}
              />
            </Field>
            <LoadState {...manifests} retry={manifests.reload} />
            {!manifests.loading && !manifests.error && !rows.length && (
              <p>
                {t(
                  "No manifests match. Turn off outstanding-only to read completed history.",
                  "کوئی فہرست نہیں ملی۔ مکمل تاریخ کے لیے باقی کی شرط ہٹائیں۔",
                )}
              </p>
            )}
            {rows.map((r) => (
              <article
                key={r.send_out_id}
                className="card"
                data-testid="sendout-register-row"
              >
                <strong>
                  <bdi>
                    {r.manifest_number} · {r.partner_name}
                  </bdi>
                </strong>
                <p>
                  {t(
                    "Samples / returned / rejected / outstanding",
                    "نمونے / لوٹے / مسترد / باقی",
                  )}
                  :{" "}
                  <bdi>
                    {r.samples} / {r.returned} / {r.rejected} / {r.outstanding}
                  </bdi>
                </p>
                <p>
                  {t("Due", "مقرر وقت")}: <bdi>{time(r.due_at)}</bdi>
                </p>
                <button
                  data-help="sendout.open"
                  onClick={() => openManifest(r.send_out_id)}
                >
                  {t("Open manifest", "روانگی فہرست کھولیں")}
                </button>
              </article>
            ))}
            {manifests.data?.length === filters?.limit &&
              !manifests.loading &&
              !manifests.error && (
                <p>
                  {t(
                    "Limit reached; narrow the partner filter. There is no next-page cursor.",
                    "حد پوری؛ شریک چھانٹی محدود کریں۔ اگلے صفحے کا کرسر نہیں۔",
                  )}
                </p>
              )}
          </section>
          <section className="card">
            <div className="form-grid">
              <Field
                label={t("Known manifest ID", "روانگی فہرست کا معلوم نمبر")}
              >
                <input
                  data-help="sendout.open"
                  value={lookup}
                  inputMode="numeric"
                  onChange={(e) => setLookup(e.target.value)}
                />
              </Field>
              <button
                data-help="sendout.open"
                onClick={() =>
                  openManifest(/^\d+$/.test(lookup) ? Number(lookup) : 0)
                }
              >
                {t("Read known manifest", "معلوم روانگی فہرست پڑھیں")}
              </button>
            </div>
            <LoadState {...detail} retry={detail.reload} />
            {!id && (
              <p>
                {t(
                  "Open a manifest to track its actual samples and results.",
                  "اصل نمونے و نتائج دیکھنے کو فہرست کھولیں۔",
                )}
              </p>
            )}
            {manifest && (
              <div data-testid="sendout-detail">
                <h2>
                  <bdi>
                    {manifest.manifest_number} · {manifest.partner_name}
                  </bdi>
                </h2>
                <p>
                  <bdi>
                    {manifest.phc_registration} · {manifest.contact}
                  </bdi>
                </p>
                <p>
                  {t("Dispatched by / at", "روانہ کرنے والا / وقت")}:{" "}
                  <bdi>
                    {manifest.dispatched_by_name} ·{" "}
                    {time(manifest.dispatched_at)}
                  </bdi>
                </p>
                <p>
                  {t("Courier / note", "لے جانے والا / نوٹ")}:{" "}
                  <bdi>
                    {manifest.courier} · {manifest.note}
                  </bdi>
                </p>
                <p>
                  {t("MOU turnaround hours / due", "معاہدہ گھنٹے / مقرر وقت")}:{" "}
                  <bdi>
                    {manifest.turnaround_hours ?? t("Not recorded", "درج نہیں")}{" "}
                    · {time(manifest.due_at)}
                  </bdi>
                </p>
                <p>
                  {t(
                    "Samples / returned / rejected / outstanding",
                    "نمونے / لوٹے / مسترد / باقی",
                  )}
                  :{" "}
                  <bdi>
                    {manifest.samples} / {manifest.returned} /{" "}
                    {manifest.rejected} / {manifest.outstanding}
                  </bdi>
                </p>
                {access.print && (
                  <div className="actions">
                    <button
                      data-help="sendout.print"
                      onClick={() => void print(false)}
                    >
                      {t(
                        "Print courier manifest (A4)",
                        "لے جانے والے کی فہرست پرنٹ (اے فور)",
                      )}
                    </button>
                    <button
                      data-help="sendout.print"
                      onClick={() => void print(true)}
                    >
                      {t("Save manifest PDF", "روانگی فہرست پی ڈی ایف محفوظ")}
                    </button>
                  </div>
                )}
                <p>
                  {t(
                    "Printing is separate. A printer failure never repeats dispatch or result entry. Obtain courier signatures on paper.",
                    "پرنٹ الگ۔ خرابی روانگی یا نتیجہ دوبارہ نہیں کرتی۔ کاغذ پر لے جانے والے کے دستخط لیں۔",
                  )}
                </p>
                {manifest.items.map((r) => (
                  <article
                    className="card"
                    key={r.sample_id}
                    data-testid="sendout-item"
                  >
                    <strong>
                      <bdi>
                        {r.barcode} · {r.test_name}
                      </bdi>
                    </strong>
                    <p>
                      <bdi>
                        {r.patient_name} · {r.mrn} · {r.requisition_number}
                      </bdi>
                    </p>
                    <p>
                      {statusLabel(r.sample_status)} ·{" "}
                      {statusLabel(r.item_status)}
                    </p>
                    <p>
                      {t(
                        "Result entered / partner reported / reference",
                        "نتیجہ درج / شریک رپورٹ / حوالہ",
                      )}
                      :{" "}
                      <bdi>
                        {time(r.result_entered_at)} ·{" "}
                        {time(r.partner_reported_at)} ·{" "}
                        {r.partner_report_ref || t("Not recorded", "درج نہیں")}
                      </bdi>
                    </p>
                    {r.rejection_code && (
                      <p>
                        {r.rejection_code === "RejectedByPartner"
                          ? t(
                              "Rejected by partner — replacement collection required",
                              "شریک نے مسترد کیا — متبادل نمونہ لینا لازم",
                            )
                          : r.rejection_code}
                      </p>
                    )}
                    {(access.work || access.result) &&
                      r.sample_status === "Dispatched" &&
                      !r.result_entered_at && (
                        <button
                          data-help="sendout.result-open"
                          onClick={() => openSample(r)}
                        >
                          {t(
                            "Enter partner result or rejection",
                            "شریک نتیجہ یا مسترد درج کریں",
                          )}
                        </button>
                      )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
        {item && (access.work || access.result) && (
          <section className="card" data-testid="sendout-result-form">
            <h2>
              {t("Partner report for this sample", "اس نمونے کی شریک رپورٹ")}
            </h2>
            <p>
              <bdi>
                {item.barcode} · {item.patient_name} · {item.mrn} ·{" "}
                {item.test_name}
              </bdi>
            </p>
            <LoadState {...scan} retry={scan.reload} />
            {sample &&
              sample.sample.status === "Dispatched" &&
              sample.item.status === "Processing" &&
              !item.result_entered_at && (
                <>
                  <div className="form-grid">
                    {sample.metric_grid.map((m) => {
                      const flag = metricFlag(m, draft[m.key] || "");
                      return (
                        <article
                          key={m.key}
                          className={
                            ["CL", "CH", "C", "Invalid"].includes(flag)
                              ? "bench-critical"
                              : ["L", "H"].includes(flag)
                                ? "bench-abnormal"
                                : "card"
                          }
                        >
                          <Field
                            label={`${m.label}${m.unit ? " · " + m.unit : ""}${m.required ? " *" : ""}`}
                          >
                            <input
                              data-help="sendout.metrics"
                              inputMode={
                                m.type === "number" ? "decimal" : "text"
                              }
                              value={draft[m.key] || ""}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  [m.key]: e.target.value,
                                }))
                              }
                            />
                          </Field>
                          <p>
                            {t(
                              "Patient reference range / preview flag",
                              "مریض کی حوالہ حد / ابتدائی نشان",
                            )}
                            :{" "}
                            <bdi>
                              {m.reference_range?.join(" – ") ||
                                t("Not configured", "مقرر نہیں")}{" "}
                              · {flag || "—"}
                            </bdi>
                          </p>
                          {m.critical?.values && (
                            <p>
                              {t(
                                "Critical text values",
                                "انتہائی اہم متنی اقدار",
                              )}
                              : <bdi>{m.critical.values.join(", ")}</bdi>
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  <div className="form-grid">
                    <Field
                      label={t("Partner report reference", "شریک رپورٹ حوالہ")}
                    >
                      <input
                        data-help="sendout.report-reference"
                        value={reference}
                        maxLength={100}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </Field>
                    <Field
                      label={t(
                        "Partner reported at (hospital time)",
                        "شریک رپورٹ کا وقت (ہسپتال)",
                      )}
                    >
                      <input
                        data-help="sendout.report-time"
                        type="datetime-local"
                        value={reportedAt}
                        onChange={(e) => setReportedAt(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field
                    label={t(
                      "Partner interpretation (optional)",
                      "شریک تشریح (اختیاری)",
                    )}
                  >
                    <textarea
                      data-help="sendout.interpretation"
                      maxLength={4000}
                      value={interpretation}
                      onChange={(e) => setInterpretation(e.target.value)}
                    />
                  </Field>
                  <button
                    data-help="sendout.result-review"
                    disabled={!live}
                    onClick={() => prepare("result")}
                  >
                    {t("Review partner result", "شریک نتیجے کا جائزہ")}
                  </button>
                  <p>
                    {t(
                      "Entry goes to independent verification; it does not publish a report.",
                      "اندراج آزاد تصدیق کو جاتا، رپورٹ شائع نہیں کرتا۔",
                    )}
                  </p>
                </>
              )}
            {access.work &&
              item.sample_status === "Dispatched" &&
              !item.result_entered_at && (
                <>
                  <Field
                    label={t(
                      "Partner rejection note (optional)",
                      "شریک مسترد نوٹ (اختیاری)",
                    )}
                  >
                    <textarea
                      data-help="sendout.reject"
                      maxLength={500}
                      value={rejectionNote}
                      onChange={(e) => setRejectionNote(e.target.value)}
                    />
                  </Field>
                  <button
                    data-help="sendout.reject"
                    disabled={!live}
                    onClick={() => prepare("reject")}
                  >
                    {t("Review Rejected by partner", "شریک کے مسترد کا جائزہ")}
                  </button>
                </>
              )}
            {sample &&
              (sample.sample.status !== "Dispatched" ||
                sample.item.status !== "Processing" ||
                !!item.result_entered_at) && (
                <p className="notice">
                  {t(
                    "This sample no longer awaits partner entry. Refresh the manifest and inspect its history; do not enter a replacement result.",
                    "یہ نمونہ شریک اندراج کے منتظر نہیں۔ فہرست تازہ کرکے تاریخ دیکھیں؛ متبادل نتیجہ نہ بھیجیں۔",
                  )}
                </p>
              )}
          </section>
        )}
      </fieldset>
      {review && (
        <Modal
          title={
            review.kind === "dispatch"
              ? t("Confirm one courier dispatch", "ایک روانگی کی تصدیق")
              : review.kind === "result"
                ? t("Confirm partner result", "شریک نتیجہ کی تصدیق")
                : t("Confirm partner rejection", "شریک مسترد کی تصدیق")
          }
          closable={!write.blocked}
          onClose={() => {
            if (!write.blocked) {
              setReview(undefined);
              setDetailRevision((n) => n + 1);
            }
          }}
        >
          <div data-help-screen="lab_send_outs">
            {review.kind === "dispatch" ? (
              <>
                <h3>
                  <bdi>{review.partner.name}</bdi>
                </h3>
                <p>
                  {t("Courier / note", "لے جانے والا / نوٹ")}:{" "}
                  <bdi>
                    {review.body.courier} · {review.body.note}
                  </bdi>
                </p>
                {review.rows.map((r) => (
                  <p key={r.sample_id}>
                    <bdi>
                      {r.barcode} · {r.patient_name} · {r.mrn} · {r.test_name}
                    </bdi>
                  </p>
                ))}
              </>
            ) : (
              <>
                <h3>
                  <bdi>
                    {review.item.barcode} · {review.item.patient_name} ·{" "}
                    {review.item.mrn}
                  </bdi>
                </h3>
                {review.kind === "result" ? (
                  <>
                    <p>
                      {t(
                        "Report reference / reported time",
                        "رپورٹ حوالہ / وقت",
                      )}
                      :{" "}
                      <bdi>
                        {(review.body as so.ResultIn).partner_report_ref} ·{" "}
                        {time((review.body as so.ResultIn).partner_reported_at)}
                      </bdi>
                    </p>
                    {Object.entries((review.body as so.ResultIn).metrics).map(
                      ([key, value]) => (
                        <p key={key}>
                          <bdi>
                            {review.sample!.metric_grid.find(
                              (m) => m.key === key,
                            )?.label || key}
                            : {String(value)}
                          </bdi>
                        </p>
                      ),
                    )}
                    <p>
                      <bdi>{(review.body as so.ResultIn).interpretation}</bdi>
                    </p>
                  </>
                ) : (
                  <p>
                    {t(
                      "Rejected by partner — a new sample must be collected.",
                      "شریک نے مسترد کیا — نیا نمونہ لینا لازم۔",
                    )}{" "}
                    <bdi>{(review.body as so.SampleRejectIn).note}</bdi>
                  </p>
                )}
              </>
            )}
            <ErrorBox error={write.error} verbatim />
            {write.attempt && !write.busy && (
              <section className="notice" role="alert">
                <p>
                  {t(
                    "The result is unknown. Draft, Escape and navigation stay locked. Do not create a replacement.",
                    "نتیجہ نامعلوم۔ مسودہ، ایسکیپ اور جگہ مقفل۔ متبادل نہ بنائیں۔",
                  )}
                </p>
                <code>{write.attempt.key}</code>
                {write.attempt.body.protection === "idempotent" &&
                canRetryWrite(write.attempt) ? (
                  <button data-help="sendout.recovery" onClick={write.retry}>
                    {t("Retry original request", "اصل درخواست کی دوبارہ کوشش")}
                  </button>
                ) : (
                  <p>
                    {t(
                      "No replay is allowed. Read and reconcile the original outcome.",
                      "دوبارہ ارسال نہیں۔ اصل نتیجہ پڑھ کر چیک کریں۔",
                    )}
                  </p>
                )}
                <button
                  data-help="sendout.recovery"
                  onClick={() => void write.inspect()}
                >
                  {t("Read current result", "موجودہ نتیجہ پڑھیں")}
                </button>
                {write.checked && observationMatches && (
                  <>
                    <section data-testid="sendout-reconciliation">
                      {review.kind === "dispatch" ? (
                        observed.map((r: so.SendOutOut) => (
                          <p key={r.send_out_id}>
                            <bdi>
                              {r.manifest_number} · {r.partner_name} ·{" "}
                              {time(r.dispatched_at)}
                            </bdi>{" "}
                            · {r.samples}
                          </p>
                        ))
                      ) : review.kind === "result" ? (
                        <>
                          <p>
                            <bdi>{observed.sample.barcode}</bdi> ·{" "}
                            {statusLabel(observed.item.status)}
                          </p>
                          {observed.previous_results.map(
                            (r: lab.RequisitionResultOut) => (
                              <article key={r.result_id}>
                                <p>
                                  {t(
                                    "Result / status / partner reference",
                                    "نتیجہ / حالت / شریک حوالہ",
                                  )}
                                  :{" "}
                                  <bdi>
                                    {r.result_id} · {statusLabel(r.status)} ·{" "}
                                    {r.partner_report_ref}
                                  </bdi>
                                </p>
                                {Object.entries(r.metrics_jsonb).map(
                                  ([k, v]) => (
                                    <p key={k}>
                                      <bdi>
                                        {k}: {String(v)}
                                      </bdi>
                                    </p>
                                  ),
                                )}
                                <p>
                                  <bdi>{r.interpretation}</bdi>
                                </p>
                              </article>
                            ),
                          )}
                        </>
                      ) : (
                        observed.items
                          .filter(
                            (r: so.RequisitionItemOut) =>
                              r.lab_requisition_item_id ===
                              review.item.lab_requisition_item_id,
                          )
                          .map((r: so.RequisitionItemOut) => (
                            <p key={r.lab_requisition_item_id}>
                              <bdi>{r.barcode}</bdi> · {statusLabel(r.status)} ·{" "}
                              {statusLabel(r.sample_status || "")}
                            </p>
                          ))
                      )}
                    </section>
                    <button data-help="sendout.recovery" onClick={release}>
                      {t(
                        "Result reviewed; return to current work",
                        "نتیجہ چیک؛ موجودہ کام پر واپس",
                      )}
                    </button>
                  </>
                )}
                {write.checked && !observationMatches && (
                  <p className="error">
                    {t(
                      "The returned identity differs. Ask IT to reconcile before any replacement action.",
                      "لوٹی شناخت مختلف۔ متبادل سے پہلے آئی ٹی سے چیک کرائیں۔",
                    )}
                  </p>
                )}
              </section>
            )}
            <button
              data-help="sendout.confirm"
              disabled={write.blocked || submitted || !live}
              onClick={confirm}
            >
              {t("Confirm once", "ایک بار تصدیق")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
