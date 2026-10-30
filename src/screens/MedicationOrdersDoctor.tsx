import { useEffect, useState, useCallback, useMemo } from "react";
import { api, ApiError } from "../bridge";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as m from "../generated/medication_orders_doctor";

export interface MedicationOrdersDoctorProps {
  user: ClinicalUser;
  establishment?: EstablishmentOut;
  connected?: boolean;
  stream?: string;
  timeZone?: string;
  availableScreens?: string[];
  initialPrescriptionId?: number;
  onRoute?: (screen: string, id?: number) => void;
}

export function MedicationOrdersDoctor({
  user,
  establishment,
  connected,
  stream,
  timeZone,
  initialPrescriptionId,
  onRoute,
}: MedicationOrdersDoctorProps) {
  const can = (permission: string) => user.permissions.includes(permission);
  const canCreate = can("prescription.create");
  const canCancel = can("prescription.cancel");
  const canView = can("prescription.view");
  const canSafety = can("medication.safety.view") || can("patient.wristband.print");

  const [tab, setTab] = useState<"verbal" | "queries" | "worklist">("verbal");
  const [mineOnly, setMineOnly] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [queryStatus, setQueryStatus] = useState<"Open" | "Answered" | "Withdrawn" | "All">("Open");
  const [search, setSearch] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  // Time formatter helper
  const formatTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return formatHospitalTime(iso, timeZone || "Asia/Karachi");
    } catch {
      return iso;
    }
  };

  // Countersign Dialog State (Rule 15dd98f03c: readback verification before countersigning)
  const [countersignTarget, setCountersignTarget] = useState<m.VerbalOrderOut | null>(null);
  const [readbackConfirmed, setReadbackConfirmed] = useState(false);
  const [countersignSubmitting, setCountersignSubmitting] = useState(false);
  const [countersignError, setCountersignError] = useState<string | null>(null);

  // Pharmacy Query Answer Dialog State (Rule aac4a043c3: ConfirmedAsWritten vs Changed)
  const [queryTarget, setQueryTarget] = useState<m.PrescriptionQueryOut | null>(null);
  const [answerOutcome, setAnswerOutcome] = useState<"ConfirmedAsWritten" | "Changed">("ConfirmedAsWritten");
  const [answerText, setAnswerText] = useState("");
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  // Stop Item Dialog State (for Changed queries or explicit stop)
  const [stopItemTarget, setStopItemTarget] = useState<{
    prescriptionId: number;
    itemId: number;
    drugName: string;
  } | null>(null);
  const [stopReason, setStopReason] = useState("");
  const [stopSubmitting, setStopSubmitting] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [stoppedItemIds, setStoppedItemIds] = useState<Set<number>>(new Set());

  // Prescription Details Inspection Modal
  const [detailPrescriptionId, setDetailPrescriptionId] = useState<number | null>(
    initialPrescriptionId || null
  );
  const [detailData, setDetailData] = useState<m.PrescriptionDetailOut | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 1. Load Verbal Orders
  const loadVerbalOrders = useCallback(async () => {
    if (!canView && !can("prescription.verbal.record")) return [];
    return m.listVerbalOrders({
      mine: mineOnly,
      pending: pendingOnly ? true : undefined,
      limit: 200,
    });
  }, [canView, mineOnly, pendingOnly]);

  const {
    data: verbalOrders,
    loading: verbalLoading,
    error: verbalError,
    reload: reloadVerbal,
  } = useLoad(loadVerbalOrders, [loadVerbalOrders, refreshTick]);

  // 2. Load Queries
  const loadQueries = useCallback(async () => {
    if (!canView && !can("prescription.query.raise")) return [];
    return m.listQueries({
      mine: mineOnly,
      status: queryStatus === "All" ? null : queryStatus,
      limit: 200,
    });
  }, [canView, mineOnly, queryStatus]);

  const {
    data: queries,
    loading: queriesLoading,
    error: queriesError,
    reload: reloadQueries,
  } = useLoad(loadQueries, [loadQueries, refreshTick]);

  // 3. Load Safety Worklist
  const loadWorklist = useCallback(async () => {
    if (!canSafety) return [];
    return m.safetyWorklist({ mine: mineOnly });
  }, [canSafety, mineOnly]);

  const {
    data: worklist,
    loading: worklistLoading,
    error: worklistError,
    reload: reloadWorklist,
  } = useLoad(loadWorklist, [loadWorklist, refreshTick]);

  // Realtime updates subscription
  useEffect(() => {
    if (!stream) return;
    try {
      const parts = stream.split(":");
      const eventType = parts[0];
      if (eventType === "medication.order.updated" || eventType === "notification.created") {
        setRefreshTick((t) => t + 1);
        if (detailPrescriptionId) {
          fetchPrescriptionDetail(detailPrescriptionId);
        }
      }
    } catch {
      // ignore
    }
  }, [stream, detailPrescriptionId]);

  // Fetch single prescription detail
  const fetchPrescriptionDetail = async (rxId: number) => {
    setDetailPrescriptionId(rxId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await m.getPrescription(rxId);
      setDetailData(res);
    } catch (err: any) {
      setDetailError(err?.message || "Failed to load prescription detail");
    } finally {
      setDetailLoading(false);
    }
  };

  // Execute Countersign
  const handleExecuteCountersign = async () => {
    if (!countersignTarget || !readbackConfirmed || !canCreate) return;
    setCountersignSubmitting(true);
    setCountersignError(null);
    try {
      await m.countersign(countersignTarget.prescription_id);
      setCountersignTarget(null);
      setReadbackConfirmed(false);
      setRefreshTick((t) => t + 1);
    } catch (err: any) {
      setCountersignError(err?.message || "Failed to countersign verbal order");
    } finally {
      setCountersignSubmitting(false);
    }
  };

  // Execute Stop Line
  const handleExecuteStopItem = async () => {
    if (!stopItemTarget || !stopReason.trim() || !canCancel) return;
    setStopSubmitting(true);
    setStopError(null);
    try {
      await m.stop(stopItemTarget.prescriptionId, stopItemTarget.itemId, {
        reason: stopReason.trim(),
      });
      setStoppedItemIds((prev) => new Set(prev).add(stopItemTarget.itemId));
      setStopItemTarget(null);
      setStopReason("");
      setRefreshTick((t) => t + 1);
      if (detailPrescriptionId === stopItemTarget.prescriptionId) {
        fetchPrescriptionDetail(stopItemTarget.prescriptionId);
      }
    } catch (err: any) {
      setStopError(err?.message || "Failed to stop medication line");
    } finally {
      setStopSubmitting(false);
    }
  };

  // Execute Answer Query
  const handleExecuteAnswerQuery = async () => {
    if (!queryTarget || !answerText.trim() || !canCreate) return;

    // Rule aac4a043c3 check
    if (answerOutcome === "Changed") {
      const itemId = queryTarget.prescription_item_id;
      if (itemId && !stoppedItemIds.has(itemId)) {
        // Warning: must stop line first
        setAnswerError(
          t(
            "Rule: To answer 'Changed', the queried medication line must be stopped first. Please click 'Stop Queried Line' before submitting your answer.",
            "قاعدہ: 'تبدیل شدہ' جواب کے لیے متعلقہ دوا کی سطر پہلے روکنا ضروری ہے۔ برائے مہربانی جواب جمع کرانے سے پہلے 'سطر روکیں' پر کلک کریں۔"
          )
        );
        return;
      }
    }

    setAnswerSubmitting(true);
    setAnswerError(null);
    try {
      await m.answerQuery(queryTarget.query_id, {
        outcome: answerOutcome,
        answer: answerText.trim(),
      });
      setQueryTarget(null);
      setAnswerText("");
      setRefreshTick((t) => t + 1);
    } catch (err: any) {
      setAnswerError(err?.message || "Failed to submit query answer");
    } finally {
      setAnswerSubmitting(false);
    }
  };

  // Filtered lists
  const filteredVerbal = useMemo(() => {
    if (!verbalOrders) return [];
    if (!search.trim()) return verbalOrders;
    const q = search.toLowerCase();
    return verbalOrders.filter(
      (o) =>
        o.patient_name.toLowerCase().includes(q) ||
        o.mrn.toLowerCase().includes(q) ||
        o.prescription_number.toLowerCase().includes(q)
    );
  }, [verbalOrders, search]);

  const filteredQueries = useMemo(() => {
    if (!queries) return [];
    if (!search.trim()) return queries;
    const q = search.toLowerCase();
    return queries.filter(
      (r) =>
        r.patient_name.toLowerCase().includes(q) ||
        r.mrn.toLowerCase().includes(q) ||
        r.prescription_number.toLowerCase().includes(q) ||
        (r.drug_name && r.drug_name.toLowerCase().includes(q))
    );
  }, [queries, search]);

  const filteredWorklist = useMemo(() => {
    if (!worklist) return [];
    if (!search.trim()) return worklist;
    const q = search.toLowerCase();
    return worklist.filter(
      (w) =>
        (w.patient_name && w.patient_name.toLowerCase().includes(q)) ||
        (w.mrn && w.mrn.toLowerCase().includes(q)) ||
        (w.prescription_number && w.prescription_number.toLowerCase().includes(q)) ||
        w.title.toLowerCase().includes(q)
    );
  }, [worklist, search]);

  return (
    <section className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("Verbal orders to countersign and pharmacy queries", "زبانی احکامات کی توثیق اور فارمیسی کے سوالات")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Countersign my verbal and telephone orders; answer the pharmacist's queries on my orders.",
            "اپنے زبانی اور ٹیلی فونک احکامات کی توثیق کریں اور فارماسسٹ کے سوالات کے جوابات دیں۔"
          )}
        </p>
      </header>

      {/* Navigation Tabs and Global Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/40 p-3 rounded-lg border">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-help="medication.doctor.verbal"
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "verbal" ? "bg-primary text-primary-foreground shadow" : "bg-background hover:bg-muted"
            }`}
            onClick={() => setTab("verbal")}
          >
            {t("Verbal Orders", "زبانی احکامات")}
            {verbalOrders && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary-foreground/20">
                {verbalOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-help="medication.doctor.queries"
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "queries" ? "bg-primary text-primary-foreground shadow" : "bg-background hover:bg-muted"
            }`}
            onClick={() => setTab("queries")}
          >
            {t("Pharmacy Queries", "فارمیسی سوالات")}
            {queries && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary-foreground/20">
                {queries.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-help="medication.doctor.worklist"
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "worklist" ? "bg-primary text-primary-foreground shadow" : "bg-background hover:bg-muted"
            }`}
            onClick={() => setTab("worklist")}
          >
            {t("Safety Worklist", "حفاظتی فہرست")}
            {worklist && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary-foreground/20">
                {worklist.length}
              </span>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              data-help="medication.doctor.worklist"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t("My orders only", "صرف میرے احکام")}
          </label>

          {tab === "verbal" && (
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                data-help="medication.doctor.verbal"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t("Pending countersign only", "صرف زیر التواء توثیق")}
            </label>
          )}

          {tab === "queries" && (
            <select
              data-help="medication.doctor.queries"
              value={queryStatus}
              onChange={(e) => setQueryStatus(e.target.value as any)}
              className="text-xs px-2 py-1.5 rounded border bg-background"
            >
              <option value="Open">{t("Open Queries", "کھلے سوالات")}</option>
              <option value="Answered">{t("Answered", "جواب شدہ")}</option>
              <option value="Withdrawn">{t("Withdrawn", "واپس شدہ")}</option>
              <option value="All">{t("All Queries", "تمام سوالات")}</option>
            </select>
          )}

          <input
            type="search"
            data-help="medication.doctor.worklist"
            placeholder={t("Filter by name, MRN, Rx...", "نام، ایم آر این یا نسخہ سے تلاش...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded border bg-background w-48"
          />

          <button
            type="button"
            data-help="medication.doctor.worklist"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="text-xs px-3 py-1.5 rounded border bg-background hover:bg-muted"
          >
            {t("Refresh", "تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      {tab === "verbal" && (
        <div className="space-y-4">
          <LoadState loading={verbalLoading} error={verbalError} retry={reloadVerbal} />
          {!verbalLoading && !verbalError && filteredVerbal.length === 0 && (
            <Empty>
              {t("No verbal or telephone orders found.", "کوئی زبانی یا ٹیلی فونک حکم نہیں ملا۔")}
            </Empty>
          )}

          <div className="grid gap-3">
            {filteredVerbal.map((order) => {
              const isOverdue = order.is_overdue;
              const isCountersigned = Boolean(order.countersigned_at);

              return (
                <article
                  key={order.prescription_id}
                  className={`border rounded-lg p-4 transition-shadow bg-card flex flex-col md:flex-row justify-between gap-4 ${
                    isOverdue && !isCountersigned ? "border-red-500 bg-red-50/20 dark:bg-red-950/20" : ""
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base">{order.patient_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted font-mono">{order.mrn}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                        {order.prescription_number}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        {order.order_mode}
                      </span>

                      {/* Overdue indicator (Rule 15dd98f03c) */}
                      {isOverdue && !isCountersigned && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white font-medium flex items-center gap-1">
                          ⚠️ {t("Overdue", "زائد المیعاد")}
                        </span>
                      )}

                      {isCountersigned && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-600 text-white font-medium flex items-center gap-1">
                          ✔️ {t("Countersigned", "توثیق شدہ")}
                          {order.countersigned_late && ` (${t("Late", "تاخیر سے")})`}
                        </span>
                      )}
                    </div>

                    {/* Order Details */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        <strong>{t("Recorded by:", "درج کنندہ:")}</strong> {order.received_by_name} |{" "}
                        <strong>{t("Taken at:", "وقت:")}</strong>{" "}
                        {formatTime(order.created_at)} |{" "}
                        <strong>{t("Countersign due:", "توثیق کی حد:")}</strong>{" "}
                        <span className={isOverdue && !isCountersigned ? "text-red-600 font-bold" : ""}>
                          {formatTime(order.countersign_due_at)}
                        </span>
                      </p>
                      {order.countersigned_by_name && (
                        <p className="text-emerald-700 dark:text-emerald-400">
                          <strong>{t("Countersigned by:", "توثیق کنندہ:")}</strong> {order.countersigned_by_name} (
                          {formatTime(order.countersigned_at)})
                        </p>
                      )}
                    </div>

                    {/* Ordered Lines */}
                    <div className="bg-muted/30 p-2.5 rounded border text-sm mt-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                        {t("Prescribed Medications (Lines):", "تجویز کردہ ادویات:")}
                      </span>
                      <ul className="list-disc pl-5 space-y-1">
                        {order.lines.map((lineText, idx) => (
                          <li key={idx} className="font-medium text-foreground">
                            {lineText}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex md:flex-col justify-end gap-2 self-center md:self-start">
                    {!isCountersigned && canCreate && (
                      <button
                        type="button"
                        data-help="medication.doctor.countersign"
                        onClick={() => {
                          setCountersignTarget(order);
                          setReadbackConfirmed(false);
                          setCountersignError(null);
                        }}
                        className="px-4 py-2 text-sm font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                      >
                        {t("Read Back & Countersign", "دہرا کر تصدیق کریں")}
                      </button>
                    )}

                    <button
                      type="button"
                      data-help="medication.doctor.detail"
                      onClick={() => fetchPrescriptionDetail(order.prescription_id)}
                      className="px-3 py-1.5 text-xs font-medium rounded border bg-background hover:bg-muted"
                    >
                      {t("View Prescription", "نسخہ دیکھیں")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === "queries" && (
        <div className="space-y-4">
          <LoadState loading={queriesLoading} error={queriesError} retry={reloadQueries} />
          {!queriesLoading && !queriesError && filteredQueries.length === 0 && (
            <Empty>{t("No pharmacy queries found.", "کوئی فارمیسی سوال نہیں ملا۔")}</Empty>
          )}

          <div className="grid gap-3">
            {filteredQueries.map((qRow) => {
              const isOpen = qRow.status === "Open";

              return (
                <article
                  key={qRow.query_id}
                  className={`border rounded-lg p-4 transition-shadow bg-card flex flex-col md:flex-row justify-between gap-4 ${
                    isOpen ? "border-amber-500/80 bg-amber-50/15 dark:bg-amber-950/15" : ""
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base">{qRow.patient_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted font-mono">{qRow.mrn}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                        {qRow.prescription_number}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 font-medium">
                        {qRow.reason}
                      </span>

                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          isOpen
                            ? "bg-amber-600 text-white"
                            : qRow.status === "Answered"
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-500 text-white"
                        }`}
                      >
                        {qRow.status === "Open" && "⏳ "}
                        {qRow.status === "Answered" && "✔️ "}
                        {qRow.status}
                      </span>
                    </div>

                    {/* Medicine information */}
                    <div className="text-sm font-medium text-foreground">
                      {qRow.drug_name ? (
                        <span>
                          {qRow.drug_name} {qRow.dose_text} {qRow.route} {qRow.frequency_code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          {t("Whole prescription query", "پورے نسخے سے متعلق سوال")}
                        </span>
                      )}
                    </div>

                    {/* Question */}
                    <div className="bg-amber-100/40 dark:bg-amber-900/30 p-2.5 rounded border border-amber-200 dark:border-amber-800 text-sm">
                      <p className="font-medium text-amber-900 dark:text-amber-200">
                        "{qRow.question}"
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        {t("Raised by:", "سائل:")} {qRow.raised_by_name} (
                        {formatTime(qRow.raised_at)})
                      </p>
                    </div>

                    {/* Answer if answered */}
                    {qRow.answer && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded border border-emerald-200 dark:border-emerald-800 text-sm">
                        <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                          <span>{t("Outcome:", "نتیجہ:")}</span>
                          <span className="underline">{qRow.outcome}</span>
                        </div>
                        <p className="mt-1 text-emerald-900 dark:text-emerald-200">{qRow.answer}</p>
                        {qRow.answer_stamp && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                            {qRow.answer_stamp.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex md:flex-col justify-end gap-2 self-center md:self-start">
                    {isOpen && canCreate && (
                      <button
                        type="button"
                        data-help="medication.doctor.answer"
                        onClick={() => {
                          setQueryTarget(qRow);
                          setAnswerOutcome("ConfirmedAsWritten");
                          setAnswerText("");
                          setAnswerError(null);
                        }}
                        className="px-4 py-2 text-sm font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow"
                      >
                        {t("Answer Query", "سوال کا جواب دیں")}
                      </button>
                    )}

                    <button
                      type="button"
                      data-help="medication.doctor.detail"
                      onClick={() => fetchPrescriptionDetail(qRow.prescription_id)}
                      className="px-3 py-1.5 text-xs font-medium rounded border bg-background hover:bg-muted"
                    >
                      {t("View Prescription", "نسخہ دیکھیں")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === "worklist" && (
        <div className="space-y-4">
          <LoadState loading={worklistLoading} error={worklistError} retry={reloadWorklist} />
          {!worklistLoading && !worklistError && filteredWorklist.length === 0 && (
            <Empty>{t("No medication safety items waiting.", "کوئی زیر التواء حفاظتی کام نہیں ملا۔")}</Empty>
          )}

          <div className="grid gap-3">
            {filteredWorklist.map((item, idx) => (
              <article
                key={idx}
                className={`border rounded-lg p-3 bg-card flex items-center justify-between gap-4 ${
                  item.is_overdue ? "border-red-500 bg-red-50/20 dark:bg-red-950/20" : ""
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{item.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted">{item.kind}</span>
                    {item.is_overdue && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white font-medium">
                        ⚠️ {t("Overdue", "زائد المیعاد")}
                      </span>
                    )}
                  </div>
                  {item.detail && <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>}
                  {item.patient_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.patient_name} ({item.mrn}) | Ward: {item.ward_name || "N/A"}, Bed: {item.bed_label || "N/A"}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {item.prescription_id && (
                    <button
                      type="button"
                      data-help="medication.doctor.detail"
                      onClick={() => fetchPrescriptionDetail(item.prescription_id!)}
                      className="px-3 py-1.5 text-xs font-medium rounded border bg-background hover:bg-muted"
                    >
                      {t("Inspect Rx", "نسخہ چیک کریں")}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Countersign Modal (Rule 15dd98f03c) */}
      {countersignTarget && (
        <Modal
          title={t("Read Back and Countersign Verbal Order", "زبانی حکم دہرا کر توثیق کریں")}
          onClose={() => setCountersignTarget(null)}
        >
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded text-sm space-y-1">
              <p>
                <strong>{t("Patient:", "مریض:")}</strong> {countersignTarget.patient_name} ({countersignTarget.mrn})
              </p>
              <p>
                <strong>{t("Prescription:", "نسخہ نمبر:")}</strong> {countersignTarget.prescription_number} (
                {countersignTarget.order_mode})
              </p>
              <p>
                <strong>{t("Taken by Nurse:", "حکم وصول کنندہ نرس:")}</strong> {countersignTarget.received_by_name} (
                {formatTime(countersignTarget.created_at)})
              </p>
            </div>

            <div className="border rounded p-3 bg-background">
              <span className="text-xs font-bold uppercase text-muted-foreground block mb-2">
                {t("Ordered Medication Lines to Verify:", "تصدیق کے لیے ادویات کی سطریں:")}
              </span>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {countersignTarget.lines.map((l, i) => (
                  <li key={i} className="font-medium">
                    {l}
                  </li>
                ))}
              </ul>
            </div>

            {/* Read-back confirmation checkbox */}
            <div className="border p-3 rounded bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800">
              <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  data-help="medication.doctor.countersign"
                  checked={readbackConfirmed}
                  onChange={(e) => setReadbackConfirmed(e.target.checked)}
                  className="mt-1 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span className="font-medium text-amber-950 dark:text-amber-100">
                  {t(
                    "I confirm that this verbal/telephone order was read back accurately and I verify that the medicine, dose, route, and frequency match my instructions.",
                    "میں تصدیق کرتا ہوں کہ یہ زبانی/ٹیلی فونک حکم مجھے بالکل درست پڑھ کر سنایا گیا تھا اور ادویات، مقدار، راستہ اور تکرار میری ہدایات کے عین مطابق ہیں۔"
                  )}
                </span>
              </label>
            </div>

            {countersignError && <ErrorBox error={new Error(countersignError)} />}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-help="medication.doctor.countersign"
                onClick={() => setCountersignTarget(null)}
                className="px-4 py-2 text-sm rounded border bg-background hover:bg-muted"
                disabled={countersignSubmitting}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                data-help="medication.doctor.countersign"
                onClick={handleExecuteCountersign}
                disabled={!readbackConfirmed || countersignSubmitting}
                className="px-4 py-2 text-sm font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                {countersignSubmitting ? t("Submitting...", "جمع ہو رہا ہے...") : t("Confirm Countersignature", "توثیق کی تصدیق کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Answer Query Modal (Rule aac4a043c3) */}
      {queryTarget && (
        <Modal
          title={t("Answer Pharmacy Query", "فارمیسی سوال کا جواب دیں")}
          onClose={() => setQueryTarget(null)}
        >
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded text-sm space-y-1">
              <p>
                <strong>{t("Patient:", "مریض:")}</strong> {queryTarget.patient_name} ({queryTarget.mrn}) | Rx:{" "}
                {queryTarget.prescription_number}
              </p>
              <p>
                <strong>{t("Query from Pharmacist:", "فارماسسٹ کا سوال:")}</strong> {queryTarget.question}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("Reason:", "وجہ:")} {queryTarget.reason} | {t("Raised by:", "سائل:")} {queryTarget.raised_by_name}
              </p>
            </div>

            {/* Outcome choices */}
            <div className="space-y-2">
              <label className="text-sm font-semibold block">{t("Answer Outcome:", "جواب کا نتیجہ:")}</label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-2.5 rounded border cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    data-help="medication.doctor.answer"
                    name="outcome"
                    value="ConfirmedAsWritten"
                    checked={answerOutcome === "ConfirmedAsWritten"}
                    onChange={() => setAnswerOutcome("ConfirmedAsWritten")}
                  />
                  <div>
                    <p className="text-sm font-medium">{t("Confirmed As Written", "جیسا لکھا ہے درست ہے")}</p>
                    <p className="text-xs text-muted-foreground">{t("Order stands unchanged", "حکم برقرار رہے گا")}</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded border cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    data-help="medication.doctor.answer"
                    name="outcome"
                    value="Changed"
                    checked={answerOutcome === "Changed"}
                    onChange={() => setAnswerOutcome("Changed")}
                  />
                  <div>
                    <p className="text-sm font-medium">{t("Changed", "تبدیل شدہ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("Stop line & prescribe replacement", "سطر روکیں اور متبادل دیں")}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* If Changed: Stop line rule enforcement */}
            {answerOutcome === "Changed" && queryTarget.prescription_item_id && (
              <div className="border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded text-xs space-y-2">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {t(
                    "Rule: To answer 'Changed', the queried medication line must be stopped first.",
                    "قاعدہ: 'تبدیل شدہ' کے انتخاب کی صورت میں دوا کی سطر پہلے روکنا ضروری ہے۔"
                  )}
                </p>
                {stoppedItemIds.has(queryTarget.prescription_item_id) ? (
                  <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                    ✔️ {t("Queried line is stopped. You can now submit your answer.", "دوا کی سطر روک دی گئی ہے۔ اب آپ جواب جمع کر سکتے ہیں۔")}
                  </p>
                ) : (
                  <button
                    type="button"
                    data-help="medication.doctor.stop"
                    onClick={() =>
                      setStopItemTarget({
                        prescriptionId: queryTarget.prescription_id,
                        itemId: queryTarget.prescription_item_id!,
                        drugName: queryTarget.drug_name || "Queried item",
                      })
                    }
                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-medium text-xs"
                  >
                    {t("Stop Queried Line Now", "متعلقہ دوا کی سطر ابھی روکیں")}
                  </button>
                )}
              </div>
            )}

            {/* Answer Text input */}
            <div className="space-y-1">
              <label className="text-sm font-semibold block">
                {t("Doctor's Explanation / Answer:", "ڈاکٹر کی وضاحت / جواب:")}
              </label>
              <textarea
                data-help="medication.doctor.answer"
                rows={3}
                placeholder={t(
                  "Explain clinical reasoning or replacement prescription details...",
                  "طبی وجہ یا متبادل نسخے کی تفصیل درج کریں..."
                )}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                className="w-full text-sm p-2 rounded border bg-background"
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  "Your PMDC stamp and timestamp will be attached to this official answer.",
                  "اس سرکاری جواب کے ساتھ آپ کا پی ایم ڈی سی مہر اور وقت درج کیا جائے گا۔"
                )}
              </p>
            </div>

            {answerError && <ErrorBox error={new Error(answerError)} />}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-help="medication.doctor.answer"
                onClick={() => setQueryTarget(null)}
                className="px-4 py-2 text-sm rounded border bg-background hover:bg-muted"
                disabled={answerSubmitting}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                data-help="medication.doctor.answer"
                onClick={handleExecuteAnswerQuery}
                disabled={!answerText.trim() || answerSubmitting}
                className="px-4 py-2 text-sm font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {answerSubmitting ? t("Submitting...", "جمع ہو رہا ہے...") : t("Submit Answer", "جواب جمع کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Stop Line Modal */}
      {stopItemTarget && (
        <Modal
          title={t("Stop Medication Line", "دوا کی سطر روکیں")}
          onClose={() => setStopItemTarget(null)}
        >
          <div className="space-y-4">
            <p className="text-sm">
              {t("Stop medication line:", "دوا کی سطر روکنے کی تصدیق:")}{" "}
              <strong className="text-red-600">{stopItemTarget.drugName}</strong>
            </p>

            <div className="space-y-1">
              <label className="text-sm font-semibold block">{t("Reason for stopping:", "روکنے کی وجہ:")}</label>
              <input
                type="text"
                data-help="medication.doctor.stop"
                placeholder={t("e.g. Ineffective, Changed by query, Adverse effect...", "مثلاً: غیر مؤثر، سوال پر تبدیلی، الرجی...")}
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
                className="w-full text-sm p-2 rounded border bg-background"
              />
            </div>

            {stopError && <ErrorBox error={new Error(stopError)} />}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-help="medication.doctor.stop"
                onClick={() => setStopItemTarget(null)}
                className="px-4 py-2 text-sm rounded border bg-background hover:bg-muted"
                disabled={stopSubmitting}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                data-help="medication.doctor.stop"
                onClick={handleExecuteStopItem}
                disabled={!stopReason.trim() || stopSubmitting}
                className="px-4 py-2 text-sm font-semibold rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {stopSubmitting ? t("Stopping...", "روکا جا رہا ہے...") : t("Confirm Stop Line", "سطر روکنے کی تصدیق کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Prescription Detail Modal */}
      {detailPrescriptionId && (
        <Modal
          title={`${t("Prescription Details", "نسخے کی تفصیلات")} #${detailPrescriptionId}`}
          onClose={() => setDetailPrescriptionId(null)}
        >
          <div className="space-y-4">
            <LoadState loading={detailLoading} error={detailError} retry={() => fetchPrescriptionDetail(detailPrescriptionId)} />

            {detailData && (
              <div className="space-y-4 text-sm">
                <div className="bg-muted p-3 rounded grid grid-cols-2 gap-2">
                  <div>
                    <p>
                      <strong>{t("Patient:", "مریض:")}</strong> {detailData.patient_name} ({detailData.mrn})
                    </p>
                    <p>
                      <strong>{t("Prescriber:", "معالج:")}</strong> {detailData.prescriber_name}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>{t("Status:", "حالت:")}</strong> {detailData.status}
                    </p>
                    <p>
                      <strong>{t("Order Mode:", "حکم کی نوعیت:")}</strong> {detailData.order_mode}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-semibold mb-2">{t("Medication Items:", "ادویات کی فہرست:")}</h4>
                  <div className="border rounded divide-y">
                    {detailData.items.map((item) => (
                      <div key={item.prescription_item_id} className="p-3 flex justify-between items-center gap-3">
                        <div>
                          <p className="font-medium">
                            {item.drug_name} — {item.dose_text} ({item.route}, {item.frequency_code})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Qty Prescribed: {item.qty_prescribed} | Dispensed: {item.qty_dispensed} | Stock Status:{" "}
                            {item.stock_status}
                          </p>
                          {item.item_status === "Stopped" && (
                            <p className="text-xs text-red-600 font-semibold mt-0.5">
                              🛑 Stopped: {item.stop_reason}
                            </p>
                          )}
                        </div>

                        {item.item_status !== "Stopped" && canCancel && (
                          <button
                            type="button"
                            data-help="medication.doctor.stop"
                            onClick={() =>
                              setStopItemTarget({
                                prescriptionId: detailData.prescription_id,
                                itemId: item.prescription_item_id,
                                drugName: item.drug_name || "Prescribed drug",
                              })
                            }
                            className="px-2.5 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
                          >
                            {t("Stop Line", "سطر روکیں")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    data-help="medication.doctor.detail"
                    onClick={() => setDetailPrescriptionId(null)}
                    className="px-4 py-2 text-sm rounded border bg-background hover:bg-muted"
                  >
                    {t("Close", "بند کریں")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
