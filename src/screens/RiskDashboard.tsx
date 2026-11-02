/**
 * Screen 142: risk_dashboard
 * "Risk & compliance"
 * Workspace: `owner_dashboard`, Position: 142, Points: 48.
 *
 * Statutory & Quality Rules:
 * - rule:a50f18c5d4: Word it as 'flagged for review'. Critical (e.g. VOIDED_BUT_EXAMINED) pops a notification.
 * - Delivery Gate: Heuristic findings for human review (not accusations), safe writes, audit logs,
 *   bilingual F1 help, bounded 100-250% zoom.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  riskSummary,
  riskFindings,
  reviewFinding,
  riskRules,
  adminAuditLog,
  type RiskSummaryOut,
  type RiskFindingListItemOut,
  type RiskRuleOut,
  type AuditEntryOut,
  type ReviewIn,
  type RiskSeverity,
  type RiskReviewStatus,
} from "../generated/risk_dashboard";
import {
  getRiskDashboardCapabilityView,
  validateReviewInput,
  calculateRiskSummaryStats,
  getSeverityBadge,
  getReviewStatusBadge,
  RISK_DASHBOARD_ERROR_MESSAGES,
  type RiskDashboardCapabilityView,
} from "../risk-dashboard-policy";

export interface RiskDashboardProps {
  user: {
    user_id: number;
    username: string;
    roles: string[];
    permissions: string[];
  };
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  timeZone?: string;
  onNavigateScreen?: (screenId: string) => void;
}

type TabKey = "findings" | "rules" | "audit";

type ReviewOutcomeStatus = "UnderReview" | "Resolved" | "FalsePositive" | "Escalated";

export const RiskDashboard: React.FC<RiskDashboardProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  // Capability view derivation
  const capabilityView: RiskDashboardCapabilityView = useMemo(
    () => getRiskDashboardCapabilityView(establishment),
    [establishment]
  );

  // Permission checks
  const canViewRisk = useMemo(
    () =>
      user.permissions?.includes("risk.view") ||
      user.roles?.includes("owner") ||
      user.roles?.includes("hospital_admin") ||
      user.roles?.includes("hospital_director") ||
      user.roles?.includes("clinic_director"),
    [user]
  );

  const canReviewRisk = useMemo(
    () =>
      user.permissions?.includes("risk.review") ||
      user.roles?.includes("owner") ||
      user.roles?.includes("hospital_admin") ||
      user.roles?.includes("hospital_director"),
    [user]
  );

  const canViewAudit = useMemo(
    () =>
      user.permissions?.includes("admin.audit.view") ||
      user.roles?.includes("owner") ||
      user.roles?.includes("hospital_admin"),
    [user]
  );

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabKey>("findings");

  // Data states
  const [summaries, setSummaries] = useState<RiskSummaryOut[]>([]);
  const [findings, setFindings] = useState<RiskFindingListItemOut[]>([]);
  const [rules, setRules] = useState<RiskRuleOut[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntryOut[]>([]);

  // Filter states for Findings
  const [statusFilter, setStatusFilter] = useState<string>("Open");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter states for Audit Trail
  const [auditEntityType, setAuditEntityType] = useState<string>("");
  const [auditAction, setAuditAction] = useState<string>("");
  const [auditSearch, setAuditSearch] = useState<string>("");

  // Loading & Feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<{ en: string; ur: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Critical Notification banner state (Rule rule:a50f18c5d4)
  const [criticalNotification, setCriticalNotification] = useState<{
    summary: string;
    rule_code: string;
  } | null>(null);

  // Review Modal State
  const [selectedFinding, setSelectedFinding] = useState<RiskFindingListItemOut | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewOutcomeStatus>("Resolved");
  const [reviewNote, setReviewNote] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Audit Diff View Modal
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<AuditEntryOut | null>(null);

  // Fetch summary and findings
  const fetchRiskData = useCallback(async () => {
    if (!canViewRisk) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const [sumRes, findRes] = await Promise.all([
        riskSummary(),
        riskFindings({
          status: statusFilter === "All" ? null : statusFilter,
          severity: severityFilter === "All" ? null : severityFilter,
          limit: 200,
        }),
      ]);

      setSummaries(sumRes || []);
      setFindings(findRes || []);

      // Check for critical notifications under Rule rule:a50f18c5d4
      const criticalItem = findRes?.find(
        (f) => (f.severity === "Critical" || f.rule_code === "VOIDED_BUT_EXAMINED") && f.review_status === "Open"
      );
      if (criticalItem) {
        setCriticalNotification({
          summary: criticalItem.summary,
          rule_code: criticalItem.rule_code,
        });
      }
    } catch (err: any) {
      console.error("Fetch risk error:", err);
      const code = err?.code || (err?.status === 403 ? "FORBIDDEN" : "VALIDATION_ERROR");
      setErrorMessage(RISK_DASHBOARD_ERROR_MESSAGES[code] || RISK_DASHBOARD_ERROR_MESSAGES.VALIDATION_ERROR);
    } finally {
      setLoading(false);
    }
  }, [canViewRisk, statusFilter, severityFilter]);

  // Fetch Rules
  const fetchRules = useCallback(async () => {
    if (!canViewRisk) return;
    try {
      const res = await riskRules();
      setRules(res || []);
    } catch (err) {
      console.error("Fetch rules error:", err);
    }
  }, [canViewRisk]);

  // Fetch Audit Log
  const fetchAudit = useCallback(async () => {
    if (!canViewAudit) return;
    setLoading(true);
    try {
      const res = await adminAuditLog({
        entity_type: auditEntityType.trim() || null,
        action: auditAction.trim() || null,
        limit: 100,
      });
      setAuditLogs(res || []);
    } catch (err: any) {
      console.error("Fetch audit error:", err);
    } finally {
      setLoading(false);
    }
  }, [canViewAudit, auditEntityType, auditAction]);

  // Initial and tab data load
  useEffect(() => {
    if (activeTab === "findings") {
      fetchRiskData();
    } else if (activeTab === "rules") {
      fetchRules();
    } else if (activeTab === "audit") {
      fetchAudit();
    }
  }, [activeTab, fetchRiskData, fetchRules, fetchAudit]);

  // Summary statistics
  const summaryStats = useMemo(() => calculateRiskSummaryStats(summaries), [summaries]);

  // Filtered Findings
  const filteredFindings = useMemo(() => {
    if (!searchQuery.trim()) return findings;
    const q = searchQuery.toLowerCase();
    return findings.filter(
      (f) =>
        f.rule_name.toLowerCase().includes(q) ||
        f.rule_code.toLowerCase().includes(q) ||
        f.summary.toLowerCase().includes(q) ||
        (f.subject_user_name && f.subject_user_name.toLowerCase().includes(q)) ||
        f.entity_id.toLowerCase().includes(q)
    );
  }, [findings, searchQuery]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (!auditSearch.trim()) return auditLogs;
    const q = auditSearch.toLowerCase();
    return auditLogs.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        a.entity_type.toLowerCase().includes(q) ||
        (a.entity_id && a.entity_id.toLowerCase().includes(q)) ||
        (a.user_name && a.user_name.toLowerCase().includes(q)) ||
        (a.reason && a.reason.toLowerCase().includes(q))
    );
  }, [auditLogs, auditSearch]);

  // Open Review Dialog
  const handleOpenReview = (finding: RiskFindingListItemOut) => {
    setSelectedFinding(finding);
    setReviewStatus(finding.review_status === "Open" ? "Resolved" : (finding.review_status as ReviewOutcomeStatus));
    setReviewNote(finding.review_note || "");
    setErrorMessage(null);
  };

  // Submit Review Outcome
  const handleSubmitReview = async () => {
    if (!selectedFinding) return;

    const validation = validateReviewInput(
      reviewStatus,
      reviewNote,
      selectedFinding.subject_user_id,
      user.user_id
    );

    if (!validation.valid) {
      setErrorMessage({
        en: validation.messageEn || "Validation failed.",
        ur: validation.messageUr || "درخواست نامکمل ہے۔",
      });
      return;
    }

    setSubmittingReview(true);
    setErrorMessage(null);

    try {
      const payload: ReviewIn = {
        status: reviewStatus,
        note: reviewNote.trim() || null,
      };

      await reviewFinding(selectedFinding.risk_event_id, payload);
      setSuccessMessage(
        `Risk finding #${selectedFinding.risk_event_id} marked as ${reviewStatus} successfully.`
      );
      setSelectedFinding(null);
      await fetchRiskData();
    } catch (err: any) {
      console.error("Review submit error:", err);
      const code = err?.code || (err?.status === 403 ? "SELF_APPROVAL_FORBIDDEN" : "VALIDATION_ERROR");
      setErrorMessage(RISK_DASHBOARD_ERROR_MESSAGES[code] || RISK_DASHBOARD_ERROR_MESSAGES.VALIDATION_ERROR);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (capabilityView === "hidden") {
    return (
      <div className="p-6 text-center text-gray-500 bg-white rounded-lg border shadow-sm">
        <p className="font-semibold text-base">Risk and compliance screen is disabled under establishment configuration.</p>
        <p className="text-sm mt-1">ہسپتال کی ترتیبات میں رسک ڈیش بورڈ غیر فعال ہے۔</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Risk & Compliance Dashboard
            </h1>
            <span className="text-xs bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded">
              رسک اور کمپلائنس
            </span>
            <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded">
              Workspace: Owner / Hospital Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Heuristic findings <strong>flagged for human review</strong> (not accusations), compliance audit trails, and risk rules.
          </p>
        </div>

        <button
          onClick={() => {
            if (activeTab === "findings") fetchRiskData();
            else if (activeTab === "rules") fetchRules();
            else if (activeTab === "audit") fetchAudit();
          }}
          disabled={loading}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          data-help="risk_dashboard.btn_refresh"
        >
          <span>🔄</span>
          <span>Refresh Data | ڈیٹا تازہ کریں</span>
        </button>
      </div>

      {/* Critical Alert Banner (Rule rule:a50f18c5d4) */}
      {criticalNotification && (
        <div className="p-3.5 bg-rose-50 border-2 border-rose-400 text-rose-900 rounded-lg shadow-sm text-xs flex items-start justify-between gap-3 animate-pulse">
          <div className="flex items-start gap-2.5">
            <span className="text-lg">🚨</span>
            <div>
              <p className="font-bold text-sm text-rose-900">
                Critical Finding Flagged for Review: {criticalNotification.rule_code}
              </p>
              <p className="mt-0.5 text-rose-800 font-medium">
                {criticalNotification.summary}
              </p>
              <p className="mt-1 text-[11px] text-rose-700">
                قاعدہ a50f18c5d4: یہ انتباہ فوری انسانی جائزے کے لیے نشان زد ہے (کوئی حتمی الزام نہیں)۔ برائے مہربانی فوری کارروائی کریں۔
              </p>
            </div>
          </div>
          <span
            role="button"
            onClick={() => setCriticalNotification(null)}
            className="text-rose-600 hover:text-rose-900 font-bold px-2 py-1 cursor-pointer"
          >
            ✕
          </span>
        </div>
      )}

      {/* Capability View Alert Banner */}
      {capabilityView === "open_work" && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>
            <strong>Restricted Mode:</strong> Reviewing existing compliance findings and audit logs without initiating new risk sweeps.
          </span>
        </div>
      )}

      {/* Error and Success Feedback */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs flex items-center justify-between">
          <div>
            <p className="font-semibold">{errorMessage.en}</p>
            <p className="text-red-700 mt-0.5">{errorMessage.ur}</p>
          </div>
          <span
            role="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-800 font-bold px-2 py-1 cursor-pointer"
          >
            ✕
          </span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center justify-between">
          <p className="font-semibold">{successMessage}</p>
          <span
            role="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold px-2 py-1 cursor-pointer"
          >
            ✕
          </span>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex border-b text-xs sm:text-sm font-semibold overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab("findings")}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "findings"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          data-help="risk_dashboard.tab_findings"
        >
          <span>🚩</span>
          <span>Flagged Findings for Review ({summaryStats.totalOpenCount}) | نشان زد آڈٹ فائنڈنگز</span>
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "rules"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          data-help="risk_dashboard.tab_rules"
        >
          <span>📜</span>
          <span>Risk Detection Rules ({rules.length || summaries.length}) | رسک قوانین</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "audit"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          data-help="risk_dashboard.tab_audit"
        >
          <span>🔍</span>
          <span>Administrative Audit Trail | انتظامی آڈٹ ٹریل</span>
        </button>
      </div>

      {/* TAB 1: Flagged Findings for Review */}
      {activeTab === "findings" && (
        <div className="space-y-4">
          {/* Risk Summary Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
            <div className="p-3 bg-white border rounded-lg shadow-sm">
              <span className="text-gray-500 font-medium block">Total Flagged</span>
              <span className="text-xl font-bold text-gray-900 mt-1 block">
                {summaryStats.totalOpenCount}
              </span>
              <span className="text-[10px] text-gray-400">Open for human review</span>
            </div>

            <div className={`p-3 border rounded-lg shadow-sm ${
              summaryStats.criticalCount > 0 ? "bg-rose-50 border-rose-300" : "bg-white"
            }`}>
              <span className="text-gray-500 font-medium block">Critical Alerts</span>
              <span className="text-xl font-bold text-rose-700 mt-1 block">
                {summaryStats.criticalCount}
              </span>
              <span className="text-[10px] text-rose-600 font-semibold">Immediate attention</span>
            </div>

            <div className="p-3 bg-white border rounded-lg shadow-sm">
              <span className="text-gray-500 font-medium block">High Severity</span>
              <span className="text-xl font-bold text-orange-600 mt-1 block">
                {summaryStats.highCount}
              </span>
              <span className="text-[10px] text-gray-400">Escalated signals</span>
            </div>

            <div className="p-3 bg-white border rounded-lg shadow-sm">
              <span className="text-gray-500 font-medium block">Medium Severity</span>
              <span className="text-xl font-bold text-amber-600 mt-1 block">
                {summaryStats.mediumCount}
              </span>
              <span className="text-[10px] text-gray-400">Compliance deviations</span>
            </div>

            <div className="p-3 bg-white border rounded-lg shadow-sm">
              <span className="text-gray-500 font-medium block">Low Severity</span>
              <span className="text-xl font-bold text-blue-600 mt-1 block">
                {summaryStats.lowCount}
              </span>
              <span className="text-[10px] text-gray-400">Routine warnings</span>
            </div>

            <div className="p-3 bg-white border rounded-lg shadow-sm">
              <span className="text-gray-500 font-medium block">Peak Risk Score</span>
              <span className="text-xl font-bold text-purple-700 mt-1 block">
                {summaryStats.highestScore}
              </span>
              <span className="text-[10px] text-purple-600 font-medium">Heuristic scale (0-100)</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-gray-50 p-3 rounded-lg border flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-700">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2 py-1 border rounded bg-white text-gray-800"
                  data-help="risk_dashboard.select_status_filter"
                >
                  <option value="All">All Statuses | تمام حالات</option>
                  <option value="Open">Flagged for review (Open) | زیرِ جائزہ</option>
                  <option value="UnderReview">Under Review | زیرِ غور</option>
                  <option value="Resolved">Resolved | حل شدہ</option>
                  <option value="FalsePositive">False Positive | غلط الارم</option>
                  <option value="Escalated">Escalated | آگے بھیجا گیا</option>
                </select>
              </div>

              {/* Severity Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-700">Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-2 py-1 border rounded bg-white text-gray-800"
                  data-help="risk_dashboard.select_severity_filter"
                >
                  <option value="All">All Severities | تمام درجے</option>
                  <option value="Critical">Critical | انتہائی نازک</option>
                  <option value="High">High | زیادہ</option>
                  <option value="Medium">Medium | درمیانہ</option>
                  <option value="Low">Low | معمولی</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Search finding, user, rule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1 border rounded bg-white text-gray-800 w-48 sm:w-60"
                  data-help="risk_dashboard.input_search"
                >
                </input>
              </div>
            </div>

            <div className="text-[11px] text-gray-500">
              Showing <strong>{filteredFindings.length}</strong> findings
            </div>
          </div>

          {/* Findings Table */}
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>
                    <th className="py-2.5 px-3">ID / Time</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Rule & Finding Summary</th>
                    <th className="py-2.5 px-3">Target Entity</th>
                    <th className="py-2.5 px-3">Subject Staff</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFindings.length > 0 ? (
                    filteredFindings.map((finding) => {
                      const sevBadge = getSeverityBadge(finding.severity);
                      const statusBadge = getReviewStatusBadge(finding.review_status);
                      const isSelf = finding.subject_user_id === user.user_id;

                      return (
                        <tr key={finding.risk_event_id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-semibold text-gray-800">
                              #{finding.risk_event_id}
                            </span>
                            <span className="block text-[10px] text-gray-400 mt-0.5">
                              {new Date(finding.detected_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${sevBadge.className}`}>
                              {sevBadge.labelEn}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-gray-900 block">
                              {finding.rule_name || finding.rule_code}
                            </span>
                            <span className="text-gray-600 text-[11px] mt-0.5 block max-w-md">
                              {finding.summary}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                              {finding.entity_type} #{finding.entity_id}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {finding.subject_user_name ? (
                              <span className="font-medium text-gray-800">
                                {finding.subject_user_name}
                                {isSelf && (
                                  <span className="ml-1 text-[10px] text-rose-600 font-bold">
                                    (You | آپ)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">System/Unknown</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                            {finding.risk_score}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${statusBadge.className}`}>
                              {statusBadge.labelEn}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {canReviewRisk ? (
                              <button
                                onClick={() => handleOpenReview(finding)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded border border-indigo-200 text-xs transition-colors"
                                data-help="risk_dashboard.btn_open_review"
                              >
                                Review | جائزہ
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">View only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        {loading ? "Loading risk findings..." : "No findings match the current filter criteria."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Risk Rules Catalogue */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="bg-white p-4 border rounded-lg shadow-sm">
            <h3 className="font-bold text-sm text-gray-800">
              Heuristic Risk Detection Rules & Thresholds
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Active automated detection rules flagging anomalous operational, inventory, and clinical patterns for human compliance review.
            </p>
          </div>

          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>
                    <th className="py-2.5 px-3">Rule Code</th>
                    <th className="py-2.5 px-3">Rule Name & Objective</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3 text-right">Base Score</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Threshold Configuration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.length > 0 ? (
                    rules.map((r) => {
                      const sevBadge = getSeverityBadge(r.severity);
                      return (
                        <tr key={r.rule_id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-gray-900">
                            {r.code}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-gray-900 block">{r.name}</span>
                            <span className="text-gray-500 text-[11px] block mt-0.5 max-w-lg">
                              {r.description}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${sevBadge.className}`}>
                              {sevBadge.labelEn}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                            {r.base_score}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              r.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                            }`}>
                              {r.is_active ? "Active | فعال" : "Disabled | معطل"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                            {JSON.stringify(r.config_jsonb || {})}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        {loading ? "Loading detection rules..." : "No risk rules returned from server."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Administrative Audit Trail */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          {/* Audit Filter Bar */}
          <div className="bg-gray-50 p-3 rounded-lg border flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Entity type (e.g. opd_ticket)..."
                value={auditEntityType}
                onChange={(e) => setAuditEntityType(e.target.value)}
                className="px-2 py-1 border rounded bg-white text-gray-800 w-36"
                data-help="risk_dashboard.input_audit_entity_type"
              >
              </input>

              <input
                type="text"
                placeholder="Action (e.g. ticket.void)..."
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
                className="px-2 py-1 border rounded bg-white text-gray-800 w-36"
                data-help="risk_dashboard.input_audit_action"
              >
              </input>

              <input
                type="text"
                placeholder="Search user, reason, ID..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="px-3 py-1 border rounded bg-white text-gray-800 w-44"
                data-help="risk_dashboard.input_audit_search"
              >
              </input>

              <button
                onClick={fetchAudit}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-900 text-white rounded font-medium transition-colors"
                data-help="risk_dashboard.btn_filter_audit"
              >
                Filter Audit | فلٹر کریں
              </button>
            </div>

            <div className="text-[11px] text-gray-500">
              Showing <strong>{filteredAuditLogs.length}</strong> logged entries
            </div>
          </div>

          {/* Audit Table */}
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>
                    <th className="py-2.5 px-3">Audit ID / At</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Entity</th>
                    <th className="py-2.5 px-3">Operator / User</th>
                    <th className="py-2.5 px-3">Workspace / IP</th>
                    <th className="py-2.5 px-3">Reason / Details</th>
                    <th className="py-2.5 px-3 text-center">State Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAuditLogs.length > 0 ? (
                    filteredAuditLogs.map((entry) => (
                      <tr key={entry.audit_id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-semibold text-gray-900 block">
                            #{entry.audit_id}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(entry.at).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-700">
                          {entry.action}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-800">
                          {entry.entity_type} {entry.entity_id ? `#${entry.entity_id}` : ""}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-gray-800 block">
                            {entry.user_name || `User #${entry.user_id}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                          <span>{entry.workspace || "-"}</span>
                          <span className="block text-[10px] text-gray-400">{entry.ip || ""}</span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-700 max-w-xs truncate">
                          {entry.reason || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {(entry.before_jsonb || entry.after_jsonb) ? (
                            <button
                              onClick={() => setSelectedAuditEntry(entry)}
                              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-medium border"
                              data-help="risk_dashboard.btn_view_diff"
                            >
                              Diff | فرق دیکھیں
                            </button>
                          ) : (
                            <span className="text-gray-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        {loading ? "Loading audit log..." : "No audit log entries match current filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal Dialog */}
      {selectedFinding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 border text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-gray-900">
                  Record Human Review Outcome
                </h3>
                <span className="text-[11px] text-gray-500">
                  Finding #{selectedFinding.risk_event_id} ({selectedFinding.rule_name})
                </span>
              </div>
              <span
                role="button"
                onClick={() => setSelectedFinding(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </span>
            </div>

            {/* Heuristic Notice per Rule rule:a50f18c5d4 */}
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded">
              <p className="font-semibold">
                Finding Status: Flagged for Review (Not an Accusation)
              </p>
              <p className="mt-0.5 text-indigo-800">
                {selectedFinding.summary}
              </p>
            </div>

            {/* Self-Review Guard */}
            {selectedFinding.subject_user_id === user.user_id && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-800 rounded font-semibold">
                ⚠️ Self-Review Forbidden: You are recorded as the subject user for this finding. An independent supervisor or compliance officer must record the review outcome.
              </div>
            )}

            {/* Evidence summary */}
            {selectedFinding.evidence_jsonb && Object.keys(selectedFinding.evidence_jsonb).length > 0 && (
              <div className="bg-gray-50 p-2.5 rounded border">
                <span className="font-semibold text-gray-700 block mb-1">Evidence Context (JSON):</span>
                <pre className="text-[11px] text-gray-600 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {JSON.stringify(selectedFinding.evidence_jsonb, null, 2)}
                </pre>
              </div>
            )}

            {/* Review Form */}
            <div className="space-y-3">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Review Outcome Status | فیصلے کی نوعیت:
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as ReviewOutcomeStatus)}
                  disabled={selectedFinding.subject_user_id === user.user_id}
                  className="w-full px-3 py-1.5 border rounded bg-white text-gray-800 font-medium"
                  data-help="risk_dashboard.select_review_status"
                >
                  <option value="UnderReview">Under Review | زیرِ غور (تحقیقات جاری ہیں)</option>
                  <option value="Resolved">Resolved | حل شدہ (مناسب وضاحت مل گئی)</option>
                  <option value="FalsePositive">False Positive | غلط الارم (سسٹم کی غلط نشاندہی)</option>
                  <option value="Escalated">Escalated | آگے بھیجا گیا (اعلیٰ انتظامیہ کو ارسال)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Audit Review Note (Mandatory for Resolved/FalsePositive/Escalated) | آڈٹ وضاحتی نوٹ:
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain findings, mitigating evidence, or root cause justification..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  disabled={selectedFinding.subject_user_id === user.user_id}
                  className="w-full px-3 py-1.5 border rounded bg-white text-gray-800"
                  data-help="risk_dashboard.input_review_note"
                >
                </textarea>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setSelectedFinding(null)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold transition-colors"
                data-help="risk_dashboard.btn_cancel_review"
              >
                Cancel | منسوخ
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview || selectedFinding.subject_user_id === user.user_id}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold transition-colors disabled:opacity-50"
                data-help="risk_dashboard.btn_submit_review"
              >
                {submittingReview ? "Recording..." : "Save Outcome | نتیجہ محفوظ کریں"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State Diff Modal */}
      {selectedAuditEntry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-5 space-y-4 border text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-gray-900">
                  Audit Record State Diff
                </h3>
                <span className="text-[11px] text-gray-500">
                  Audit #{selectedAuditEntry.audit_id} ({selectedAuditEntry.action})
                </span>
              </div>
              <span
                role="button"
                onClick={() => setSelectedAuditEntry(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 bg-gray-50 border rounded">
                <span className="font-semibold text-gray-700 block mb-1">State Before (JSON):</span>
                <pre className="text-[10px] text-gray-600 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {JSON.stringify(selectedAuditEntry.before_jsonb, null, 2) || "null"}
                </pre>
              </div>

              <div className="p-2.5 bg-gray-50 border rounded">
                <span className="font-semibold text-gray-700 block mb-1">State After (JSON):</span>
                <pre className="text-[10px] text-gray-600 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {JSON.stringify(selectedAuditEntry.after_jsonb, null, 2) || "null"}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setSelectedAuditEntry(null)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded font-medium transition-colors"
                data-help="risk_dashboard.btn_close_diff"
              >
                Close | بند کریں
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
