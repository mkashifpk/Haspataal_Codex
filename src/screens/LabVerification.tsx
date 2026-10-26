import React, { useEffect, useMemo, useState } from "react";
import { api, call } from "../bridge";
import { bilingual as t, tr } from "../i18n";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as lab from "../generated/lab_verification";
import {
  canVerifyResult,
  isResultOverdue,
  sortVerificationQueue,
  validateVerification,
  verificationWritable,
} from "../lab-verification-policy";

export type VerificationUser = {
  user_id: number;
  username?: string;
  display_name?: string;
  name?: string;
  designation?: string | null;
  employee_id?: number | null;
  permissions: string[];
};

export function LabVerification({
  user,
  connected,
  stream,
  establishment,
  timeZone,
}: {
  user: VerificationUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
}) {
  const [revision, setRevision] = useState(0),
    [search, setSearch] = useState(""),
    [criticalOnly, setCriticalOnly] = useState(false),
    [selected, setSelected] = useState<lab.VerificationItemOut | null>(null),
    [verifyDialog, setVerifyDialog] = useState<lab.VerificationItemOut | null>(null),
    [rejectDialog, setRejectDialog] = useState<lab.VerificationItemOut | null>(null),
    [rejectNote, setRejectNote] = useState(""),
    [delayReason, setDelayReason] = useState(""),
    [actionError, setActionError] = useState<string | null>(null),
    [criticalAlert, setCriticalAlert] = useState<string | null>(null),
    [inspectReqId, setInspectReqId] = useState<number | null>(null),
    [showReqModal, setShowReqModal] = useState(false),
    [inspectReqInput, setInspectReqInput] = useState(""),
    [reportReqId, setReportReqId] = useState<number | null>(null),
    [showReportModal, setShowReportModal] = useState(false),
    [reportReqInput, setReportReqInput] = useState(""),
    [pdfSaving, setPdfSaving] = useState(false),
    [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const activeItemRef = React.useRef<lab.VerificationItemOut | null>(null);

  const viewMode = establishment?.views.screens.find(
    (v) => v.screen_id === "lab_verification"
  )?.view;
  const status = verificationWritable({ mode: viewMode }, user.permissions);

  // Auto-refresh when relevant realtime events arrive
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (
          e.type === "event" &&
          [
            "lab.result.pending_verification",
            "lab.result.critical_pending",
            "critical_result.updated",
            "lab.result.published",
          ].includes(e.event_type)
        ) {
          setRevision((n) => n + 1);
        }
        if (e.type === "stream" && e.status === "Live" && e.resync) {
          setRevision((n) => n + 1);
        }
      }),
    []
  );

  const queue = useLoad(
    () => (status.readable ? lab.verificationQueue() : Promise.resolve([])),
    [revision, status.readable]
  );

  const reqDetail = useLoad(
    () =>
      inspectReqId && (user.permissions.includes("lab.requisition.view") || user.permissions.includes("lab.result.view"))
        ? lab.getRequisitionLabRequisitions(inspectReqId)
        : Promise.resolve(null),
    [inspectReqId]
  );

  const reportPayload = useLoad(
    () =>
      reportReqId && (user.permissions.includes("lab.requisition.view") || user.permissions.includes("lab.result.view"))
        ? lab.reportPrintLabRequisitionsPayload(reportReqId)
        : Promise.resolve(null),
    [reportReqId]
  );

  const write = useClinicalWrite(
    user,
    "lab-verification",
    async (value, command) => {
      const item = activeItemRef.current || selected;
      setVerifyDialog(null);
      setRejectDialog(null);
      setRejectNote("");
      setDelayReason("");
      setActionError(null);
      setSelected(null);
      activeItemRef.current = null;
      setRevision((r) => r + 1);

      if (command.body && typeof command.body === "object" && (command.body as any).decision === "Verified") {
        if (item?.has_critical_value) {
          setCriticalAlert(
            t(
              `Critical result verified for ${item.patient_name} (${item.test_name}). Tell the ordering doctor NOW and record in Critical Results log!`,
              `اہم نتیجہ برائے ${item.patient_name} (${item.test_name}) تصدیق ہو گیا۔ معالج کو فوری مطلع کریں اور اہم نتائج کے رجسٹر میں درج کریں!`
            )
          );
        }
      }
    }
  );

  const filteredQueue = useMemo(() => {
    if (!queue.data) return [];
    let items = queue.data;
    if (criticalOnly) {
      items = items.filter((x) => x.has_critical_value);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (x) =>
          x.patient_name.toLowerCase().includes(q) ||
          x.mrn.toLowerCase().includes(q) ||
          x.code.toLowerCase().includes(q) ||
          x.test_name.toLowerCase().includes(q)
      );
    }
    return sortVerificationQueue(items);
  }, [queue.data, criticalOnly, search]);

  const counts = useMemo(() => {
    if (!queue.data) return { total: 0, critical: 0, stat: 0 };
    return {
      total: queue.data.length,
      critical: queue.data.filter((x) => x.has_critical_value).length,
      stat: queue.data.filter((x) => x.priority === "STAT").length,
    };
  }, [queue.data]);

  function handleOpenVerify(item: lab.VerificationItemOut) {
    setActionError(null);
    activeItemRef.current = item;
    const check = canVerifyResult(user, item);
    if (!check.allowed) {
      setActionError(check.reason ?? t("Cannot verify own result", "اپنا نتیجہ خود تصدیق نہیں کر سکتے"));
      return;
    }
    setDelayReason("");
    setVerifyDialog(item);
  }

  function handleOpenReject(item: lab.VerificationItemOut) {
    setActionError(null);
    activeItemRef.current = item;
    setRejectNote("");
    setRejectDialog(item);
  }

  function submitVerify() {
    if (!verifyDialog) return;
    const isLate = isResultOverdue(verifyDialog.entered_at);
    const check = validateVerification("Verified", "", isLate, delayReason);
    if (!check.valid) {
      setActionError(check.error ?? "Invalid input");
      return;
    }
    write.start({
      method: "POST",
      path: `/lab/results/${verifyDialog.result_id}/verify`,
      body: check.body,
      permission: "lab.result.verify",
      protection: "reconcile",
      label: t(
        `Verify result #${verifyDialog.result_id} (${verifyDialog.code})`,
        `نتیجہ نمبر ${verifyDialog.result_id} کی تصدیق (${verifyDialog.code})`
      ),
    });
  }

  function submitReject() {
    if (!rejectDialog) return;
    const check = validateVerification("Rejected", rejectNote, false, "");
    if (!check.valid) {
      setActionError(check.error ?? "Invalid input");
      return;
    }
    write.start({
      method: "POST",
      path: `/lab/results/${rejectDialog.result_id}/verify`,
      body: check.body,
      permission: "lab.result.verify",
      protection: "reconcile",
      label: t(
        `Reject result #${rejectDialog.result_id} back to bench`,
        `نتیجہ نمبر ${rejectDialog.result_id} مسترد بنچ کو واپس`
      ),
    });
  }

  return (
    <div className="workspace-screen lab-verification" data-help-screen="lab_verification">
      <header className="screen-header">
        <div>
          <h1>{t("Verification queue", "تصدیق کی قطار")}</h1>
          <p className="subtitle">
            {t(
              "Review pending results from the technician bench, verify & publish, or reject back to the bench.",
              "ٹیکنیشن بنچ کے منتظر نتائج کا جائزہ لیں، تصدیق و اشاعت کریں یا بنچ کو مسترد کریں۔"
            )}
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            data-help="verification.queue"
            disabled={queue.loading || write.blocked}
            onClick={() => setRevision((r) => r + 1)}
          >
            {t("Refresh queue", "قطار تازہ کریں")}
          </button>
        </div>
      </header>

      {status.banner && (
        <aside className="notice warning" role="alert">
          {status.banner}
        </aside>
      )}

      {criticalAlert && (
        <aside className="notice error critical-alert" role="alert">
          <div className="alert-content">
            <strong>{t("CRITICAL RESULT ACTION REQUIRED", "انتہائی اہم نتیجہ پر فوری عمل لازم")}</strong>
            <p>{criticalAlert}</p>
          </div>
          <button
            type="button"
            data-help="verification.queue"
            className="secondary"
            onClick={() => setCriticalAlert(null)}
          >
            {t("Dismiss", "خارج کریں")}
          </button>
        </aside>
      )}

      {actionError && (
        <aside className="notice error" role="alert">
          {actionError}
        </aside>
      )}

      <ClinicalWriteFeedback write={write} />

      {/* Summary KPI Cards */}
      <section className="stats-row">
        <div className="stat-card">
          <span className="stat-label">{t("Awaiting Verification", "تصدیق کے منتظر")}</span>
          <span className="stat-value">{counts.total}</span>
        </div>
        <div className={`stat-card ${counts.critical > 0 ? "urgent" : ""}`}>
          <span className="stat-label">{t("Critical Values", "انتہائی اہم نتائج")}</span>
          <span className="stat-value">{counts.critical}</span>
        </div>
        <div className={`stat-card ${counts.stat > 0 ? "stat-priority" : ""}`}>
          <span className="stat-label">{t("STAT Priority", "فوری ترجیح")}</span>
          <span className="stat-value">{counts.stat}</span>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="card filters-card">
        <div className="filter-controls">
          <Field label={t("Find in queue", "قطار میں تلاش")}>
            <input
              type="search"
              data-help="verification.search"
              value={search}
              placeholder={t("Filter by patient, MRN, code, test name...", "مریض، ایم آر این، کوڈ یا ٹیسٹ نام سے تلاش...")}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <label className="checkbox-label" data-help="verification.search">
            <input
              type="checkbox"
              data-help="verification.search"
              checked={criticalOnly}
              onChange={(e) => setCriticalOnly(e.target.checked)}
            />
            {t("Critical values only", "صرف انتہائی اہم نتائج")}
          </label>
        </div>
      </section>

      <LoadState {...queue} retry={() => setRevision((r) => r + 1)} />

      {/* Queue Table */}
      {!queue.loading && !queue.error && (
        <section className="card queue-section">
          <h2>
            {t("Pending results", "منتظر نتائج")} ({filteredQueue.length})
          </h2>
          {filteredQueue.length === 0 ? (
            <Empty>
              {search || criticalOnly
                ? t("No results match the current filters.", "موجودہ فلٹرز سے کوئی نتیجہ مطابقت نہیں رکھتا۔")
                : t("No results are awaiting verification.", "کوئی نتیجہ تصدیق کا منتظر نہیں۔")}
            </Empty>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("Priority", "ترجیح")}</th>
                    <th>{t("Patient / MRN", "مریض / ایم آر این")}</th>
                    <th>{t("Test", "ٹیسٹ")}</th>
                    <th>{t("Flagged values", "نشان زد اقدار")}</th>
                    <th>{t("Performer", "ٹیکنیشن")}</th>
                    <th>{t("Entered", "درج وقت")}</th>
                    <th>{t("Actions", "اعمال")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.map((item) => {
                    const isSelected = selected?.result_id === item.result_id;
                    const canVerify = canVerifyResult(user, item);
                    const isLate = isResultOverdue(item.entered_at);

                    return (
                      <tr
                        key={item.result_id}
                        className={`${isSelected ? "selected-row" : ""} ${
                          item.has_critical_value ? "critical-row" : ""
                        }`}
                      >
                        <td>
                          <div className="badge-group">
                            <span className={`badge priority-${item.priority.toLowerCase()}`}>
                              {item.priority}
                            </span>
                            {item.has_critical_value && (
                              <span className="badge badge-critical" title={t("Critical Value", "انتہائی اہم قدر")}>
                                CRITICAL
                              </span>
                            )}
                            {item.is_correction && (
                              <span className="badge badge-warning" title={t("Correction", "تصحیح")}>
                                {t("Correction", "تصحیح")}
                              </span>
                            )}
                            {isLate && (
                              <span className="badge badge-overdue" title={t("Turnaround Delay", "تاخیر")}>
                                {t("Delayed", "تاخیر")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <strong>{item.patient_name}</strong>
                          <div className="text-muted">{item.mrn}</div>
                        </td>
                        <td>
                          <strong>{item.code}</strong>
                          <div className="text-muted">{item.test_name}</div>
                        </td>
                        <td>
                          <div className="metrics-summary">
                            {Object.entries(item.flags_jsonb || {}).map(([key, flag]) => {
                              const val = item.metrics_jsonb?.[key];
                              const isCrit = ["CL", "CH", "C"].includes(flag);
                              const isAbn = ["L", "H"].includes(flag);
                              return (
                                <span
                                  key={key}
                                  className={`metric-chip ${isCrit ? "crit" : isAbn ? "abn" : "norm"}`}
                                >
                                  {key}: {String(val)} [{flag}]
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td>{item.entered_by_name}</td>
                        <td>{new Date(item.entered_at).toLocaleTimeString()}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="secondary btn-sm"
                              data-help="verification.inspect"
                              onClick={() => setSelected(isSelected ? null : item)}
                            >
                              {isSelected ? t("Hide", "چھپائیں") : t("Inspect", "معائنہ")}
                            </button>
                            {status.writable && (
                              <>
                                <button
                                  type="button"
                                  className="btn-sm btn-primary"
                                  data-help="verification.verify"
                                  disabled={!canVerify.allowed || write.blocked}
                                  title={!canVerify.allowed ? canVerify.reason : undefined}
                                  onClick={() => handleOpenVerify(item)}
                                >
                                  {t("Verify", "تصدیق")}
                                </button>
                                <button
                                  type="button"
                                  className="btn-sm btn-danger"
                                  data-help="verification.reject"
                                  disabled={write.blocked}
                                  onClick={() => handleOpenReject(item)}
                                >
                                  {t("Reject", "مسترد")}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Selected Result Inspection Card */}
      {selected && (
        <section className="card detail-inspection-card">
          <header className="card-header">
            <div>
              <h3>
                {t("Result Inspection", "نتیجہ کا تفصیلی جائزہ")}: {selected.test_name} ({selected.code})
              </h3>
              <p className="subtitle">
                {selected.patient_name} · MRN: {selected.mrn} · Result #{selected.result_id} · Priority: {selected.priority}
              </p>
            </div>
            <div className="card-actions">
              <button
                type="button"
                className="secondary btn-sm"
                data-help="verification.requisition"
                onClick={() => {
                  setShowReqModal(true);
                  setInspectReqInput("");
                  setInspectReqId(null);
                }}
              >
                {t("Requisition detail", "درخواست تفصیل")}
              </button>
              <button
                type="button"
                className="secondary btn-sm"
                data-help="verification.report"
                onClick={() => {
                  setShowReportModal(true);
                  setReportReqInput("");
                  setReportReqId(null);
                }}
              >
                {t("Signed report preview", "دستخط شدہ رپورٹ کا جائزہ")}
              </button>
              <button
                type="button"
                className="secondary btn-sm"
                data-help="verification.inspect"
                onClick={() => setSelected(null)}
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </header>

          {!canVerifyResult(user, selected).allowed && (
            <aside className="notice warning" role="alert">
              {canVerifyResult(user, selected).reason}
            </aside>
          )}

          <div className="metrics-grid-detail">
            <h4>{t("Entered Measurements & Metric Flags", "درج پیمائشیں اور انتباہات")}</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("Metric", "پیمائش")}</th>
                  <th>{t("Measured value", "درج قدر")}</th>
                  <th>{t("Flag", "نشان")}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(selected.metrics_jsonb || {}).map(([key, val]) => {
                  const flag = selected.flags_jsonb?.[key] ?? "N";
                  const isCrit = ["CL", "CH", "C"].includes(flag);
                  const isAbn = ["L", "H"].includes(flag);
                  return (
                    <tr key={key} className={isCrit ? "critical-row" : ""}>
                      <td><strong>{key}</strong></td>
                      <td>{String(val)}</td>
                      <td>
                        <span className={`badge ${isCrit ? "badge-critical" : isAbn ? "badge-warning" : "badge-neutral"}`}>
                          {flag}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected.interpretation && (
            <div className="interpretation-box">
              <strong>{t("Technician interpretation", "ٹیکنیشن کی تشریح")}:</strong>
              <p>{selected.interpretation}</p>
            </div>
          )}

          <div className="stamps-box">
            <span className="text-muted">
              {t("Performed by", "ٹیکنیشن")}: {selected.entered_by_name} ({new Date(selected.entered_at).toLocaleString()})
            </span>
          </div>

          {status.writable && (
            <footer className="card-footer actions">
              <button
                type="button"
                className="btn-primary"
                data-help="verification.verify"
                disabled={!canVerifyResult(user, selected).allowed || write.blocked}
                onClick={() => handleOpenVerify(selected)}
              >
                {t("Verify and publish result", "نتیجہ کی تصدیق اور اشاعت")}
              </button>
              <button
                type="button"
                className="btn-danger"
                data-help="verification.reject"
                disabled={write.blocked}
                onClick={() => handleOpenReject(selected)}
              >
                {t("Reject back to bench", "بنچ کو مسترد کریں")}
              </button>
            </footer>
          )}
        </section>
      )}

      {/* Verify & Publish Confirmation Modal */}
      {verifyDialog && (
        <Modal
          title={t("Confirm Verification and Publication", "تصدیق و اشاعت کی منظوری")}
          onClose={() => !write.busy && setVerifyDialog(null)}
        >
          <div className="dialog-body">
            <p>
              {t(
                `Are you sure you want to verify and publish result #${verifyDialog.result_id} for ${verifyDialog.patient_name}?`,
                `کیا آپ نتیجہ نمبر ${verifyDialog.result_id} برائے ${verifyDialog.patient_name} کی تصدیق اور اشاعت کرنا چاہتے ہیں؟`
              )}
            </p>
            <div className="verification-details-summary">
              <div><strong>{t("Test", "ٹیسٹ")}:</strong> {verifyDialog.test_name} ({verifyDialog.code})</div>
              <div><strong>{t("Technician", "ٹیکنیشن")}:</strong> {verifyDialog.entered_by_name}</div>
              <div><strong>{t("Signing with your stamp", "آپ کی مہر کے ساتھ دستخط")}:</strong> {user.name ?? user.display_name ?? user.username ?? ""} ({user.designation ?? t("Lab Verifier", "لیب ویریفائر")})</div>
            </div>

            {verifyDialog.has_critical_value && (
              <aside className="notice error" role="alert">
                <strong>{t("CRITICAL VALUES DETECTED", "انتہائی اہم نتائج موجود ہیں")}</strong>
                <p>
                  {t(
                    "Verifying this result will publish it to the doctor and open an entry in the Critical Results log. You must notify the doctor immediately!",
                    "اس نتیجہ کی تصدیق سے یہ ڈاکٹر کو شائع ہو جائے گا اور اہم نتائج کے لاگ میں درج ہوگا۔ معالج کو فوری اطلاع کرنا لازم ہے!"
                  )}
                </p>
              </aside>
            )}

            {isResultOverdue(verifyDialog.entered_at) && (
              <Field label={t("Turnaround Delay Reason (optional, MSDS AAC 4)", "تاخیر کی وجہ (اختیاری، ایم ایس ڈی ایس)")}>
                <input
                  type="text"
                  maxLength={500}
                  data-help="verification.delay_reason"
                  placeholder={t("e.g. Reagent calibration, sample re-run...", "مثلاً ری ایجنٹ کیلیبریشن، نمونہ دوبارہ ٹیسٹ...")}
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                />
              </Field>
            )}

            <ErrorBox error={write.error} verbatim />

            <div className="dialog-actions">
              <button
                type="button"
                className="btn-primary"
                data-help="verification.confirm"
                disabled={write.busy}
                onClick={submitVerify}
              >
                {write.busy ? t("Verifying...", "تصدیق ہو رہی ہے...") : t("Confirm & publish", "منظور اور شائع کریں")}
              </button>
              <button
                type="button"
                className="secondary"
                data-help="verification.verify"
                disabled={write.busy}
                onClick={() => setVerifyDialog(null)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectDialog && (
        <Modal
          title={t("Reject Result Back to Bench", "نتیجہ مسترد کر کے بنچ کو واپس بھیجیں")}
          onClose={() => !write.busy && setRejectDialog(null)}
        >
          <div className="dialog-body">
            <p>
              {t(
                `Rejecting result #${rejectDialog.result_id} will notify the bench technician that the sample/result is unusable and requires attention.`,
                `نتیجہ نمبر ${rejectDialog.result_id} مسترد کرنے سے بنچ ٹیکنیشن کو اطلاع جائے گی کہ یہ نتیجہ قابل استعمال نہیں اور دوبارہ توجہ درکار ہے۔`
              )}
            </p>

            <Field label={t("Mandatory Rejection Note *", "مسترد کرنے کی لازمی وجہ *")}>
              <textarea
                required
                rows={3}
                maxLength={1000}
                data-help="verification.reject_note"
                placeholder={t("Explain why this result was rejected (e.g. Inconsistent metrics, hemolyzed sample)...", "نتیجہ مسترد کرنے کی وجہ لکھیں (مثلاً غیر مطابقت، نمونہ خراب)...")}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </Field>

            <ErrorBox error={write.error} verbatim />

            <div className="dialog-actions">
              <button
                type="button"
                className="btn-danger"
                data-help="verification.confirm"
                disabled={write.busy || !rejectNote.trim()}
                onClick={submitReject}
              >
                {write.busy ? t("Rejecting...", "مسترد ہو رہا ہے...") : t("Confirm rejection", "مسترد کرنے کی تصدیق")}
              </button>
              <button
                type="button"
                className="secondary"
                data-help="verification.reject"
                disabled={write.busy}
                onClick={() => setRejectDialog(null)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inspect Requisition Modal */}
      {(showReqModal || inspectReqId !== null) && (
        <Modal
          title={t("Requisition Detail", "لیب درخواست کی تفصیل")}
          onClose={() => {
            setShowReqModal(false);
            setInspectReqId(null);
          }}
        >
          <div className="dialog-body">
            <Field label={t("Inspect Requisition #", "درخواست نمبر درج کریں")}>
              <div className="input-with-button">
                <input
                  type="number"
                  min={1}
                  data-help="verification.requisition"
                  placeholder={t("e.g. 1", "مثلاً 1")}
                  value={inspectReqInput}
                  onChange={(e) => setInspectReqInput(e.target.value)}
                />
                <button
                  type="button"
                  data-help="verification.requisition"
                  onClick={() => {
                    const id = parseInt(inspectReqInput, 10);
                    if (id > 0) setInspectReqId(id);
                  }}
                >
                  {t("Load", "کھولیں")}
                </button>
              </div>
            </Field>
            {inspectReqId && <LoadState {...reqDetail} retry={reqDetail.reload} />}
            {reqDetail.data && (
              <div className="requisition-overview">
                <div><strong>{t("Requisition #", "درخواست نمبر")}:</strong> {reqDetail.data.requisition_number}</div>
                <div><strong>{t("Patient", "مریض")}:</strong> {reqDetail.data.patient_name} ({reqDetail.data.mrn})</div>
                <div><strong>{t("Status", "حالت")}:</strong> {reqDetail.data.status}</div>
                <div><strong>{t("Priority", "ترجیح")}:</strong> {reqDetail.data.priority}</div>
                <div><strong>{t("Ordered At", "آرڈر وقت")}:</strong> {new Date(reqDetail.data.ordered_at).toLocaleString()}</div>
                <h4>{t("Items & Tests", "آئٹمز اور ٹیسٹ")}</h4>
                <ul>
                  {reqDetail.data.items?.map((it) => (
                    <li key={it.lab_requisition_item_id}>
                      {it.code} - {it.test_name} ({it.status}) {it.barcode ? `[Barcode: ${it.barcode}]` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                data-help="verification.requisition"
                onClick={() => {
                  setShowReqModal(false);
                  setInspectReqId(null);
                }}
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Signed Report Payload Modal */}
      {(showReportModal || reportReqId !== null) && (
        <Modal
          title={t("Printable Report Payload Preview", "رپورٹ پرنٹ ڈیٹا کا معائنہ")}
          onClose={() => {
            setShowReportModal(false);
            setReportReqId(null);
          }}
        >
          <div className="dialog-body">
            <Field label={t("Report Requisition #", "رپورٹ درخواست نمبر")}>
              <div className="input-with-button">
                <input
                  type="number"
                  min={1}
                  data-help="verification.report"
                  placeholder={t("e.g. 1", "مثلاً 1")}
                  value={reportReqInput}
                  onChange={(e) => setReportReqInput(e.target.value)}
                />
                <button
                  type="button"
                  data-help="verification.report"
                  onClick={() => {
                    const id = parseInt(reportReqInput, 10);
                    if (id > 0) setReportReqId(id);
                  }}
                >
                  {t("Load", "کھولیں")}
                </button>
              </div>
            </Field>
            {pdfNotice && <p role="status" className="notice info">{pdfNotice}</p>}
            {reportReqId && <LoadState {...reportPayload} retry={reportPayload.reload} />}
            {reportPayload.data && (
              <div className="report-payload-view">
                <div><strong>{t("Requisition #", "درخواست نمبر")}:</strong> {reportPayload.data.fields.requisition_number}</div>
                <div><strong>{t("Patient", "مریض")}:</strong> {reportPayload.data.fields.patient_name} ({reportPayload.data.fields.mrn})</div>
                <div><strong>{t("Report Complete", "مکمل رپورٹ")}:</strong> {reportPayload.data.fields.complete ? t("Yes (Complete)", "ہاں (مکمل)") : t("No (Partial Report)", "نہیں (جزوی رپورٹ)")}</div>
                <h4>{t("Reported Results", "رپورٹ شدہ نتائج")}</h4>
                {reportPayload.data.fields.results?.map((res) => (
                  <div key={res.result_id} className="card result-card-preview">
                    <strong>{res.code} - {res.test_name}</strong>
                    <div className="text-muted">
                      {t("Performed by", "ٹیکنیشن")}: {res.performed_stamp?.text}
                    </div>
                    {res.verified_stamp && (
                      <div className="text-muted">
                        {t("Verified by", "ویریفائر")}: {res.verified_stamp.text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="btn-primary"
                data-help="verification.report"
                disabled={pdfSaving || !reportReqId}
                onClick={async () => {
                  setPdfSaving(true);
                  setPdfNotice(null);
                  try {
                    const res = await call<{ saved?: boolean }>("clinical-pdf", {
                      path: `/lab/requisitions/${reportReqId}/report/pdf`,
                    });
                    setPdfNotice(
                      res?.saved
                        ? t("PDF saved successfully.", "پی ڈی ایف کامیابی سے محفوظ ہو گئی۔")
                        : t("Save cancelled.", "محفوظ کرنا منسوخ ہوا۔")
                    );
                  } catch (e: any) {
                    setPdfNotice(e?.message ?? t("Failed to save PDF", "پی ڈی ایف محفوظ نہ ہو سکی"));
                  } finally {
                    setPdfSaving(false);
                  }
                }}
              >
                {pdfSaving ? t("Saving PDF...", "پی ڈی ایف محفوظ ہو رہی ہے...") : t("Save report PDF", "رپورٹ پی ڈی ایف محفوظ کریں")}
              </button>
              <button
                type="button"
                className="secondary"
                data-help="verification.report"
                onClick={() => {
                  setShowReportModal(false);
                  setReportReqId(null);
                }}
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
