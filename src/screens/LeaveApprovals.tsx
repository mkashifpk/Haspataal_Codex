import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { TeamLeaveRequestOut, LeaveDecisionIn, LeaveRequestOut, LeaveBalanceOut } from "../generated/leave_approvals";
import { teamLeave, decideLeave, empBalances } from "../generated/leave_approvals";
import {
  getLeaveApprovalsCapabilityView,
  validateLeaveDecision,
  formatLeaveTypeBadge,
  formatLeaveStatusBadge,
  formatLeaveDateRange,
  LEAVE_ERROR_MESSAGES
} from "../leave-approvals-policy";

export interface LeaveApprovalsProps {
  token?: string;
  lang?: "en" | "ur";
  establishment?: any;
  user?: {
    user_id?: number;
    employee_id?: number | null;
    username?: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
  };
  userPermissions?: string[];
  currentUserRole?: string;
  currentEmployeeId?: number | null;
  connected?: boolean;
}

export const LeaveApprovals: React.FC<LeaveApprovalsProps> = ({
  lang = "en",
  establishment,
  user,
  userPermissions = [],
  currentUserRole,
  currentEmployeeId,
  connected = true
}) => {
  const isUrdu = lang === "ur";

  // Permissions & Capability
  const effectivePermissions = useMemo(() => {
    return userPermissions.length > 0 ? userPermissions : (user?.permissions || []);
  }, [userPermissions, user?.permissions]);

  const effectiveRole = currentUserRole || user?.role || user?.roles?.[0] || "";

  const capability = useMemo(() => {
    return getLeaveApprovalsCapabilityView(establishment, effectivePermissions, effectiveRole);
  }, [establishment, effectivePermissions, effectiveRole]);

  // Current year default
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected" | "Cancelled">("Pending");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Data States
  const [requests, setRequests] = useState<TeamLeaveRequestOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState<boolean>(false);
  const [activeRequest, setActiveRequest] = useState<TeamLeaveRequestOut | null>(null);
  const [pendingDecision, setPendingDecision] = useState<"Approved" | "Rejected">("Approved");
  const [decisionNote, setDecisionNote] = useState<string>("");
  const [decisionErrors, setDecisionErrors] = useState<Record<string, string>>({});

  // Employee Balances Modal / Drawer State
  const [balancesModalOpen, setBalancesModalOpen] = useState<boolean>(false);
  const [balanceEmployee, setBalanceEmployee] = useState<{ id: number; name: string; number: string; designation: string } | null>(null);
  const [balances, setBalances] = useState<LeaveBalanceOut[]>([]);
  const [balancesLoading, setBalancesLoading] = useState<boolean>(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [balanceYear, setBalanceYear] = useState<number>(currentYear);

  // Realtime notification
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Fetch Leave Requests
  const fetchRequests = useCallback(async () => {
    if (!capability.canView) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const q = statusFilter === "All" ? undefined : { status: statusFilter };
      const data = await teamLeave(q);
      setRequests(data || []);
    } catch (err: any) {
      const code = err?.code || "NETWORK_ERROR";
      const mapped = LEAVE_ERROR_MESSAGES[code] || {
        en: err?.message || "Failed to load leave requests.",
        ur: "رخصت کی درخواستیں لوڈ کرنے میں ناکامی۔"
      };
      setErrorMessage(isUrdu ? mapped.ur : mapped.en);
    } finally {
      setLoading(false);
    }
  }, [capability.canView, statusFilter, isUrdu]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime listener for leave.requested
  useEffect(() => {
    const handleLeaveRequested = (e: any) => {
      setRealtimeNotice(isUrdu ? "نئی رخصت کی درخواست موصول ہوئی۔ فہرست تازہ کی جا رہی ہے۔" : "New leave request submitted by direct report. Updating inbox...");
      fetchRequests();
      setTimeout(() => setRealtimeNotice(null), 5000);
    };

    window.addEventListener("haspataal:leave.requested", handleLeaveRequested);
    return () => {
      window.removeEventListener("haspataal:leave.requested", handleLeaveRequested);
    };
  }, [fetchRequests, isUrdu]);

  // Fetch Balances for an employee
  const fetchBalances = useCallback(async (employeeId: number, year: number) => {
    setBalancesLoading(true);
    setBalancesError(null);
    try {
      const data = await empBalances(employeeId, { year });
      setBalances(data || []);
    } catch (err: any) {
      const code = err?.code || "NETWORK_ERROR";
      const mapped = LEAVE_ERROR_MESSAGES[code] || {
        en: err?.message || "Failed to load leave balances.",
        ur: "رخصت کا بیلنس حاصل کرنے میں ناکامی۔"
      };
      setBalancesError(isUrdu ? mapped.ur : mapped.en);
    } finally {
      setBalancesLoading(false);
    }
  }, [isUrdu]);

  const handleOpenBalances = (req: TeamLeaveRequestOut) => {
    setBalanceEmployee({
      id: req.employee_id,
      name: req.full_name,
      number: req.emp_number,
      designation: req.designation
    });
    setBalanceYear(currentYear);
    setBalancesModalOpen(true);
    fetchBalances(req.employee_id, currentYear);
  };

  const handleOpenDecision = (req: TeamLeaveRequestOut, decision: "Approved" | "Rejected") => {
    setActiveRequest(req);
    setPendingDecision(decision);
    setDecisionNote("");
    setDecisionErrors({});
    setDecisionModalOpen(true);
  };

  const handleSubmitDecision = async () => {
    if (!activeRequest) return;

    const val = validateLeaveDecision(pendingDecision, decisionNote);
    if (!val.valid) {
      setDecisionErrors(val.errors);
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const body: LeaveDecisionIn = {
        decision: pendingDecision,
        note: decisionNote.trim() || null
      };
      await decideLeave(activeRequest.leave_request_id, body);
      setSuccessMessage(
        isUrdu
          ? `رخصت کی درخواست کامیابی کے ساتھ ${pendingDecision === "Approved" ? "منظور" : "مسترد"} کر دی گئی ہے۔`
          : `Leave request for ${activeRequest.full_name} successfully ${pendingDecision.toLowerCase()}.`
      );
      setDecisionModalOpen(false);
      setActiveRequest(null);
      fetchRequests();
    } catch (err: any) {
      const code = err?.code || "NETWORK_ERROR";
      const mapped = LEAVE_ERROR_MESSAGES[code] || {
        en: err?.message || "Failed to record leave decision.",
        ur: "رخصت کا فیصلہ محفوظ کرنے میں ناکامی۔"
      };
      setErrorMessage(isUrdu ? mapped.ur : mapped.en);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered requests by search query
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.toLowerCase().trim();
    return requests.filter(r =>
      (r.full_name && r.full_name.toLowerCase().includes(q)) ||
      (r.emp_number && r.emp_number.toLowerCase().includes(q)) ||
      (r.designation && r.designation.toLowerCase().includes(q)) ||
      (r.leave_type && r.leave_type.toLowerCase().includes(q))
    );
  }, [requests, searchQuery]);

  // Counts for tabs
  const pendingCount = useMemo(() => {
    return requests.filter(r => r.status === "Pending").length;
  }, [requests]);

  if (capability.mode === "hidden") {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 m-4">
        <h2 className="text-xl font-bold mb-2">
          {isUrdu ? "چھٹیوں کی منظوری غیر فعال ہے" : "Leave Approvals Unavailable"}
        </h2>
        <p>{capability.reason || (isUrdu ? "اس سہولت کے لیے چھٹیوں کی منظوری فعال نہیں ہے۔" : "Leave approvals inbox is not enabled for this facility profile.")}</p>
      </div>
    );
  }

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-6 ${isUrdu ? "rtl" : "ltr"}`} dir={isUrdu ? "rtl" : "ltr"}>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {isUrdu ? "چھٹیوں کی منظوری (سپروائزر ان باکس)" : "Leave Approvals (Supervisor Inbox)"}
            </h1>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${connected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {connected ? (isUrdu ? "براہ راست آن لائن" : "Live") : (isUrdu ? "رابطہ منقطع" : "Offline")}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {isUrdu
              ? "ماتحت عملے کی رخصت کی درخواستوں کا جائزہ لیں، رخصت بیلنس چیک کریں اور باضابطہ منظوری یا تنسیخ کریں۔"
              : "Review direct reports' leave requests, inspect statutory leave balances, and record audited approval or rejection decisions."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-help="leave_approvals.btn_refresh"
            onClick={fetchRequests}
            disabled={loading}
            className="px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? (isUrdu ? "لوڈ ہو رہا ہے..." : "Refreshing...") : (isUrdu ? "تازہ کریں" : "Refresh")}
          </button>
        </div>
      </div>

      {/* Realtime Notification Banner */}
      {realtimeNotice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs uppercase tracking-wider bg-blue-200 text-blue-900 px-2 py-0.5 rounded">
              {isUrdu ? "ریئل ٹائم اطلاع" : "Realtime Alert"}
            </span>
            <span className="text-sm">{realtimeNotice}</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{isUrdu ? "خرابی:" : "Error:"}</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            data-help="leave_approvals.banner_dismiss_error"
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-900 text-sm font-medium underline"
          >
            {isUrdu ? "بند کریں" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{isUrdu ? "کامیابی:" : "Success:"}</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            data-help="leave_approvals.banner_dismiss_success"
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-900 text-sm font-medium underline"
          >
            {isUrdu ? "بند کریں" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            data-help="leave_approvals.filter_status_pending"
            onClick={() => setStatusFilter("Pending")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              statusFilter === "Pending" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>{isUrdu ? "زیر التواء" : "Pending"}</span>
            {pendingCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            data-help="leave_approvals.filter_status_approved"
            onClick={() => setStatusFilter("Approved")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === "Approved" ? "bg-white text-green-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {isUrdu ? "منظور شدہ" : "Approved"}
          </button>
          <button
            type="button"
            data-help="leave_approvals.filter_status_rejected"
            onClick={() => setStatusFilter("Rejected")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === "Rejected" ? "bg-white text-red-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {isUrdu ? "مسترد" : "Rejected"}
          </button>
          <button
            type="button"
            data-help="leave_approvals.filter_status_cancelled"
            onClick={() => setStatusFilter("Cancelled")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === "Cancelled" ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {isUrdu ? "منسوخ شدہ" : "Cancelled"}
          </button>
          <button
            type="button"
            data-help="leave_approvals.filter_status_all"
            onClick={() => setStatusFilter("All")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === "All" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {isUrdu ? "تمام" : "All"}
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              data-help="leave_approvals.filter_search"
              placeholder={isUrdu ? "نام، نمبر یا عہدہ تلاش کریں..." : "Search name, number or designation..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Leave Requests Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3" />
            <p>{isUrdu ? "چھٹیوں کی درخواستیں لوڈ ہو رہی ہیں..." : "Loading leave requests..."}</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base font-medium">
              {searchQuery
                ? (isUrdu ? "تلاش کے مطابق کوئی درخواست نہیں ملی۔" : "No leave requests match your search filter.")
                : statusFilter === "Pending"
                ? (isUrdu ? "کوئی زیر التواء درخواست موجود نہیں ہے۔ تمام درخواستیں نمٹا دی گئی ہیں۔" : "No pending leave requests in your supervisor inbox. Everything is up to date!")
                : (isUrdu ? "اس زمرے میں کوئی درخواست موجود نہیں ہے۔" : "No leave requests found for this filter.")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">{isUrdu ? "ملازم" : "Employee"}</th>
                  <th className="py-3 px-4">{isUrdu ? "رخصت کی قسم" : "Leave Type"}</th>
                  <th className="py-3 px-4">{isUrdu ? "تاریخیں اور دورانیہ" : "Dates & Days"}</th>
                  <th className="py-3 px-4">{isUrdu ? "وجہ / تفصیل" : "Reason"}</th>
                  <th className="py-3 px-4">{isUrdu ? "حالت" : "Status"}</th>
                  <th className="py-3 px-4 text-right">{isUrdu ? "کارروائی" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredRequests.map((req) => {
                  const typeBadge = formatLeaveTypeBadge(req.leave_type);
                  const statusBadge = formatLeaveStatusBadge(req.status);
                  const isPending = req.status === "Pending";

                  return (
                    <tr key={req.leave_request_id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Employee details */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{req.full_name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>#{req.emp_number}</span>
                          <span>•</span>
                          <span>{req.designation}</span>
                        </div>
                      </td>

                      {/* Leave Type */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-md ${typeBadge.colorClass}`}>
                          {isUrdu ? typeBadge.labelUr : typeBadge.labelEn}
                        </span>
                      </td>

                      {/* Dates & Duration */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {formatLeaveDateRange(req.from_date, req.to_date, req.days)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {isUrdu ? "درخواست کی تاریخ:" : "Requested:"} {req.requested_at ? req.requested_at.split("T")[0] : "-"}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-gray-800 line-clamp-2">
                          {req.reason || <span className="text-gray-400 italic">{isUrdu ? "کوئی وجہ درج نہیں" : "No reason provided"}</span>}
                        </div>
                        {req.decision_note && (
                          <div className="text-xs text-gray-600 mt-1 bg-gray-50 p-1.5 rounded border border-gray-200">
                            <span className="font-semibold">{isUrdu ? "سپروائزر نوٹ:" : "Supervisor Note:"}</span> {req.decision_note}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-md ${statusBadge.colorClass}`}>
                          {isUrdu ? statusBadge.labelUr : statusBadge.labelEn}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            data-help="leave_approvals.table_btn_view_balances"
                            onClick={() => handleOpenBalances(req)}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                          >
                            {isUrdu ? "بیلنس دیکھیں" : "Balances"}
                          </button>

                          {capability.canApprove && isPending && (
                            <>
                              <button
                                type="button"
                                data-help="leave_approvals.table_btn_approve"
                                onClick={() => handleOpenDecision(req, "Approved")}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                              >
                                {isUrdu ? "منظور کریں" : "Approve"}
                              </button>
                              <button
                                type="button"
                                data-help="leave_approvals.table_btn_reject"
                                onClick={() => handleOpenDecision(req, "Rejected")}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                              >
                                {isUrdu ? "مسترد کریں" : "Reject"}
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
      </div>

      {/* Decision Modal (Approve / Reject) */}
      {decisionModalOpen && activeRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {pendingDecision === "Approved"
                  ? (isUrdu ? "رخصت کی منظوری" : "Approve Leave Request")
                  : (isUrdu ? "رخصت کا استرداد" : "Reject Leave Request")}
              </h3>
              <button
                type="button"
                data-help="leave_approvals.decision_btn_cancel"
                onClick={() => setDecisionModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
              <div><span className="font-semibold">{isUrdu ? "ملازم:" : "Employee:"}</span> {activeRequest.full_name} (#{activeRequest.emp_number})</div>
              <div><span className="font-semibold">{isUrdu ? "قسم:" : "Type:"}</span> {activeRequest.leave_type}</div>
              <div><span className="font-semibold">{isUrdu ? "دورانیہ:" : "Duration:"}</span> {formatLeaveDateRange(activeRequest.from_date, activeRequest.to_date, activeRequest.days)}</div>
              {activeRequest.reason && (
                <div><span className="font-semibold">{isUrdu ? "وجہ:" : "Reason:"}</span> {activeRequest.reason}</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                {pendingDecision === "Rejected"
                  ? (isUrdu ? "استرداد کی وجہ (لازمی)" : "Rejection Explanation (Required)")
                  : (isUrdu ? "سپروائزر کا اختیاری نوٹ" : "Supervisor Note (Optional)")}
              </label>
              <textarea
                data-help="leave_approvals.decision_note_input"
                rows={3}
                placeholder={
                  pendingDecision === "Rejected"
                    ? (isUrdu ? "براہ کرم استرداد کی ٹھوس وجہ بیان کریں..." : "State mandatory reason for rejecting this leave...")
                    : (isUrdu ? "اختیاری منظوری نوٹ یا ہدایات..." : "Optional approval note or handover reminders...")
                }
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                className={`w-full p-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                  decisionErrors.note ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                }`}
              />
              {decisionErrors.note && (
                <p className="text-xs text-red-600 mt-1">{decisionErrors.note}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                data-help="leave_approvals.decision_btn_cancel"
                onClick={() => setDecisionModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                data-help="leave_approvals.decision_btn_confirm"
                onClick={handleSubmitDecision}
                disabled={actionLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm ${
                  pendingDecision === "Approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading
                  ? (isUrdu ? "محفوظ ہو رہا ہے..." : "Recording...")
                  : pendingDecision === "Approved"
                  ? (isUrdu ? "منظور کریں" : "Confirm Approval")
                  : (isUrdu ? "مسترد کریں" : "Confirm Rejection")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Balances Modal / Drawer */}
      {balancesModalOpen && balanceEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isUrdu ? "ملازم کے چھٹیوں کا بیلنس" : "Employee Leave Balances"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {balanceEmployee.name} (#{balanceEmployee.number}) • {balanceEmployee.designation}
                </p>
              </div>
              <button
                type="button"
                data-help="leave_approvals.balances_btn_close"
                onClick={() => setBalancesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Balances Year & Refresh */}
            <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-700">
                  {isUrdu ? "سال:" : "Year:"}
                </label>
                <select
                  data-help="leave_approvals.balances_year_select"
                  value={balanceYear}
                  onChange={(e) => {
                    const y = parseInt(e.target.value, 10);
                    setBalanceYear(y);
                    fetchBalances(balanceEmployee.id, y);
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                data-help="leave_approvals.balances_btn_refresh"
                onClick={() => fetchBalances(balanceEmployee.id, balanceYear)}
                disabled={balancesLoading}
                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                {balancesLoading ? (isUrdu ? "تازہ ہو رہا ہے..." : "Loading...") : (isUrdu ? "تازہ کریں" : "Refresh")}
              </button>
            </div>

            {/* Balances Content */}
            {balancesLoading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-2" />
                <p className="text-sm">{isUrdu ? "بیلنس چیک کیا جا رہا ہے..." : "Fetching balance ledger..."}</p>
              </div>
            ) : balancesError ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                {balancesError}
              </div>
            ) : balances.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                {isUrdu ? "اس سال کے لیے کوئی چھٹیوں کا بیلنس ریکارڈ نہیں ملا۔" : "No leave balance ledger found for this employee and year."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
                      <th className="py-2.5 px-3">{isUrdu ? "قسم" : "Type"}</th>
                      <th className="py-2.5 px-3 text-right">{isUrdu ? "ابتدائی" : "Opening"}</th>
                      <th className="py-2.5 px-3 text-right">{isUrdu ? "حاصل کردہ" : "Accrued"}</th>
                      <th className="py-2.5 px-3 text-right">{isUrdu ? "سابقہ" : "Forwarded"}</th>
                      <th className="py-2.5 px-3 text-right">{isUrdu ? "استعمال شدہ" : "Used"}</th>
                      <th className="py-2.5 px-3 text-right font-bold text-blue-700">{isUrdu ? "دستیاب" : "Available"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {balances.map((b) => (
                      <tr key={b.leave_type} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-medium text-gray-900">{b.leave_type}</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">{b.opening}</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">+{b.accrued}</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">+{b.carried_forward}</td>
                        <td className="py-2.5 px-3 text-right text-red-600">-{b.used}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                          {b.available} {isUrdu ? "دن" : (b.available === 1 ? "day" : "days")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <button
                type="button"
                data-help="leave_approvals.balances_btn_close"
                onClick={() => setBalancesModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {isUrdu ? "بند کریں" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
