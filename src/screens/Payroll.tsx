import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  listRuns,
  getRun,
  generate,
  finalizeHrPayrollRuns,
  paid,
  cancelRun,
  payslip,
  type PayrollRunOut,
  type PayrollRunDetailOut,
  type PayrollRunItemOut,
  type PayslipOut,
} from "../generated/payroll";
import {
  getPayrollCapabilityView,
  calculateEmployeePayrollFormula,
  explainExtraDutyCalculation,
  validateGeneratePayrollForm,
  validateCancelRunForm,
  validateMarkPaidForm,
  formatPayrollRunStatusBadge,
  PAYROLL_ERROR_MESSAGES,
  type SessionInfo,
  type Establishment,
} from "../payroll-policy";

export interface PayrollProps {
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
  session?: SessionInfo | null;
  onNavigateHome?: () => void;
}

export const Payroll: React.FC<PayrollProps> = ({
  user,
  userPermissions,
  currentUserRole,
  establishment,
  session,
  onNavigateHome,
}) => {
  const sessionInfo: SessionInfo | null = useMemo(() => {
    if (session) return session;
    if (user) {
      return {
        user_id: user.user_id,
        employee_id: user.employee_id,
        username: user.username || "",
        roles: user.roles || [],
        permissions: user.permissions ?? userPermissions ?? [],
      } as SessionInfo;
    }
    return null;
  }, [session, user, userPermissions, currentUserRole]);

  // Capability View
  const capability = useMemo(
    () => getPayrollCapabilityView(sessionInfo, establishment),
    [sessionInfo, establishment]
  );

  // Data States
  const [runs, setRuns] = useState<PayrollRunOut[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRunDetailOut | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipOut | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingRunDetail, setLoadingRunDetail] = useState<boolean>(false);
  const [loadingPayslip, setLoadingPayslip] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [generatePeriodStart, setGeneratePeriodStart] = useState<string>("");
  const [generatePeriodEnd, setGeneratePeriodEnd] = useState<string>("");
  const [generateErrors, setGenerateErrors] = useState<Record<string, string>>({});

  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelTargetRunId, setCancelTargetRunId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [showPaidModal, setShowPaidModal] = useState<boolean>(false);
  const [paidTargetRunId, setPaidTargetRunId] = useState<number | null>(null);
  const [paidMethod, setPaidMethod] = useState<"BankTransfer" | "Cash">("BankTransfer");
  const [paidError, setPaidError] = useState<string | null>(null);

  // Fetch runs list
  const fetchRuns = useCallback(async () => {
    if (capability.mode === "hidden") return;
    setLoading(true);
    setError(null);
    try {
      const data = await listRuns();
      setRuns(data || []);
    } catch (err: any) {
      const code = err?.code || err?.message;
      const explanation = PAYROLL_ERROR_MESSAGES[code]?.en || err?.message || "Failed to load payroll runs";
      setError(explanation);
    } finally {
      setLoading(false);
    }
  }, [capability.mode]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Fetch single run details
  const handleSelectRun = async (runId: number) => {
    setLoadingRunDetail(true);
    setError(null);
    try {
      const detail = await getRun(runId);
      setSelectedRun(detail);
    } catch (err: any) {
      const code = err?.code || err?.message;
      const explanation = PAYROLL_ERROR_MESSAGES[code]?.en || err?.message || "Failed to load payroll run details";
      setError(explanation);
    } finally {
      setLoadingRunDetail(false);
    }
  };

  // Fetch payslip details
  const handleViewPayslip = async (payrollItemId: number) => {
    setLoadingPayslip(true);
    setError(null);
    try {
      const slip = await payslip(payrollItemId);
      setSelectedPayslip(slip);
    } catch (err: any) {
      const code = err?.code || err?.message;
      const explanation = PAYROLL_ERROR_MESSAGES[code]?.en || err?.message || "Failed to load payslip";
      setError(explanation);
    } finally {
      setLoadingPayslip(false);
    }
  };

  // Generate Payroll submit
  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateGeneratePayrollForm(generatePeriodStart, generatePeriodEnd);
    if (!validation.valid) {
      setGenerateErrors(validation.errors);
      return;
    }
    setGenerateErrors({});
    setSubmitting(true);
    setError(null);
    try {
      const newRun = await generate({
        period_start: generatePeriodStart.trim(),
        period_end: generatePeriodEnd.trim(),
      });
      setShowGenerateModal(false);
      setGeneratePeriodStart("");
      setGeneratePeriodEnd("");
      setSuccessMessage(`Payroll run ${newRun.run_number} successfully generated for ${newRun.employee_count} employees.`);
      await fetchRuns();
      setSelectedRun(newRun);
    } catch (err: any) {
      const code = err?.code || err?.message;
      const explanation = PAYROLL_ERROR_MESSAGES[code]?.en || err?.message || "Failed to generate payroll run";
      setError(explanation);
    } finally {
      setSubmitting(false);
    }
  };

  // Finalize Run
  const handleFinalize = async (runId: number) => {
    if (!window.confirm("Finalize this payroll run? This will lock calculations, consume credits/commissions, and post to General Ledger.")) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const finalized = await finalizeHrPayrollRuns(runId);
      setSuccessMessage(`Payroll run ${finalized.run_number} finalized successfully.`);
      await fetchRuns();
      if (selectedRun?.run_id === runId) {
        setSelectedRun(finalized);
      }
    } catch (err: any) {
      const code = err?.code || err?.message;
      const explanation = PAYROLL_ERROR_MESSAGES[code]?.en || err?.message || "Failed to finalize payroll run";
      setError(explanation);
    } finally {
      setSubmitting(false);
    }
  };

  // Mark Paid submit
  const handleMarkPaidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paidTargetRunId) return;
    const validation = validateMarkPaidForm(paidMethod);
    if (!validation.valid) {
      setPaidError(validation.error || "Invalid method");
      return;
    }
    setSubmitting(true);
    setPaidError(null);
    try {
      const updated = await paid(paidTargetRunId, { method: paidMethod });
      setShowPaidModal(false);
      setPaidTargetRunId(null);
      setSuccessMessage(`Payroll run ${updated.run_number} marked as Paid via ${paidMethod}.`);
      await fetchRuns();
      if (selectedRun?.run_id === paidTargetRunId) {
        setSelectedRun(updated);
      }
    } catch (err: any) {
      const code = err?.code || err?.message;
      const explanation = PAYROLL_ERROR_MESSAGES[code]?.en || err?.message || "Failed to mark run as paid";
      setPaidError(explanation);
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Run submit
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetRunId) return;
    const validation = validateCancelRunForm(cancelReason);
    if (!validation.valid) {
      setCancelError(validation.error || "Invalid cancellation reason");
      return;
    }
    setSubmitting(true);
    setCancelError(null);
    try {
      const updated = await cancelRun(cancelTargetRunId, { reason: cancelReason.trim() });
      setShowCancelModal(false);
      setCancelTargetRunId(null);
      setCancelReason("");
      setSuccessMessage(`Payroll run ${updated.run_number} was cancelled.`);
      await fetchRuns();
      if (selectedRun?.run_id === cancelTargetRunId) {
        setSelectedRun(updated);
      }
    } catch (err: any) {
      const code = err?.code || err?.message;
      const explanation = PAYROLL_ERROR_MESSAGES[code]?.en || err?.message || "Failed to cancel payroll run";
      setCancelError(explanation);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick period helper
  const handleSetQuickPeriod = (monthsAgo: number) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const endStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    setGeneratePeriodStart(startStr);
    setGeneratePeriodEnd(endStr);
  };

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.run_number.toLowerCase().includes(q) ||
          r.period_start.includes(q) ||
          r.period_end.includes(q)
        );
      }
      return true;
    });
  }, [runs, statusFilter, searchQuery]);

  // Filtered items in selected run
  const filteredItems = useMemo(() => {
    if (!selectedRun) return [];
    if (!searchQuery.trim()) return selectedRun.items;
    const q = searchQuery.toLowerCase();
    return selectedRun.items.filter(
      (item) =>
        item.full_name.toLowerCase().includes(q) ||
        item.emp_number.toLowerCase().includes(q) ||
        item.designation.toLowerCase().includes(q)
    );
  }, [selectedRun, searchQuery]);

  if (capability.mode === "hidden") {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center" data-help="payroll.view_forbidden">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-amber-900 mb-2">Access Restricted / رسائی محدود ہے</h2>
          <p className="text-amber-700 text-sm mb-4">
            {capability.reason || "You do not have permission to access staff payroll processing."}
          </p>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-sm"
              data-help="payroll.btn_back_home"
            >
              Return to Home / ہوم پر واپس جائیں
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-6" data-help="payroll.screen_container">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight" data-help="payroll.title_header">
              Payroll Processing
            </h1>
            <span className="text-sm font-medium text-slate-500 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
              تنخواہیں اور پے رول
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold uppercase">
              {capability.mode === "full" ? "Admin Mode" : "View-Only"}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1" data-help="payroll.subtitle_text">
            Generate monthly runs, audit employee net pay calculations, finalize ledger postings, and print salary slips.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {capability.canRun && (
            <button
              onClick={() => {
                setShowGenerateModal(true);
                handleSetQuickPeriod(1);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm font-medium text-sm flex items-center gap-2"
              data-help="payroll.btn_generate"
            >
              <span className="font-bold">+</span> Generate Payroll / نیا پے رول تیار کریں
            </button>
          )}
          <button
            onClick={fetchRuns}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-md text-sm font-medium shadow-sm"
            data-help="payroll.btn_refresh"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm flex justify-between items-center" data-help="payroll.banner_error">
          <div>
            <strong className="font-semibold">Error: </strong>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold ml-4" data-help="payroll.btn_dismiss_alert">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-sm flex justify-between items-center" data-help="payroll.banner_success">
          <div>
            <strong className="font-semibold">Success: </strong>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-4" data-help="payroll.btn_dismiss_alert">
            ✕
          </button>
        </div>
      )}

      {/* Main Content: Selected Run Detail vs Runs Directory */}
      {selectedRun ? (
        /* DETAIL VIEW */
        <div className="space-y-6" data-help="payroll.run_detail_view">
          {/* Back & Status Header */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedRun(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium flex items-center gap-1.5"
                  data-help="payroll.btn_back_to_runs"
                >
                  ← All Runs / تمام رن
                </button>
                <h2 className="text-xl font-bold text-slate-900" data-help="payroll.text_run_number">
                  {selectedRun.run_number}
                </h2>
                {(() => {
                  const badge = formatPayrollRunStatusBadge(selectedRun.status);
                  return (
                    <span
                      style={{ color: badge.color, backgroundColor: badge.bg }}
                      className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                      data-help="payroll.badge_detail_status"
                    >
                      {badge.label} • {badge.labelUr}
                    </span>
                  );
                })()}
              </div>

              {/* Action Buttons for Run */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedRun.status === "Generated" && capability.canFinalize && (
                  <>
                    <button
                      onClick={() => handleFinalize(selectedRun.run_id)}
                      disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-sm"
                      data-help="payroll.btn_finalize_run"
                    >
                      ✓ Finalize Run / حتمی کریں
                    </button>
                    <button
                      onClick={() => {
                        setCancelTargetRunId(selectedRun.run_id);
                        setShowCancelModal(true);
                      }}
                      disabled={submitting}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded-md text-sm font-medium"
                      data-help="payroll.btn_cancel_run"
                    >
                      Cancel Run / منسوخ کریں
                    </button>
                  </>
                )}

                {selectedRun.status === "Finalized" && capability.canMarkPaid && (
                  <button
                    onClick={() => {
                      setPaidTargetRunId(selectedRun.run_id);
                      setShowPaidModal(true);
                    }}
                    disabled={submitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold shadow-sm"
                    data-help="payroll.btn_mark_paid"
                  >
                    💰 Mark Salaries Paid / تنخواہیں ادا کریں
                  </button>
                )}
              </div>
            </div>

            {/* Run KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div className="bg-slate-50 p-3.5 rounded border border-slate-100">
                <span className="text-xs text-slate-500 block">Period Horizon</span>
                <strong className="text-sm font-semibold text-slate-800">
                  {selectedRun.period_start} to {selectedRun.period_end}
                </strong>
              </div>
              <div className="bg-slate-50 p-3.5 rounded border border-slate-100">
                <span className="text-xs text-slate-500 block">Covered Staff</span>
                <strong className="text-lg font-bold text-slate-800">
                  {selectedRun.employee_count} Employees
                </strong>
              </div>
              <div className="bg-slate-50 p-3.5 rounded border border-slate-100">
                <span className="text-xs text-slate-500 block">Total Net Payroll</span>
                <strong className="text-lg font-bold text-indigo-700">
                  Rs. {Number(selectedRun.total_net || 0).toLocaleString()}
                </strong>
              </div>
              <div className="bg-slate-50 p-3.5 rounded border border-slate-100">
                <span className="text-xs text-slate-500 block">Audit Tracking</span>
                <span className="text-xs text-slate-600 block">
                  Gen: {new Date(selectedRun.generated_at).toLocaleDateString()}
                  {selectedRun.finalized_at && ` | Fin: ${new Date(selectedRun.finalized_at).toLocaleDateString()}`}
                  {selectedRun.paid_at && ` | Paid: ${new Date(selectedRun.paid_at).toLocaleDateString()}`}
                </span>
              </div>
            </div>

            {/* Statutory Formula Banner (rule:0cf7ae94dd) */}
            <div className="mt-4 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded text-xs text-indigo-900" data-help="payroll.banner_formula">
              <div className="font-bold mb-1 flex items-center justify-between">
                <span>Statutory Payroll Formula (Rule 0cf7ae94dd):</span>
                <span className="text-indigo-700">قانون کے مطابق فارمولا</span>
              </div>
              <p className="font-mono text-xs text-indigo-800">
                Base Salary − Unpaid Absences − Internal Credit + Commissions + Extra Duty = Net Payable
              </p>
              <p className="font-urdu text-xs text-indigo-700 mt-0.5">
                بنیادی تنخواہ − غیر حاضریاں کٹوتی − اندرونی ادھار + کمیشن + اضافی ڈیوٹی = خالص قابل ادا رقم
              </p>
            </div>
          </div>

          {/* Search bar for items */}
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900">
              Staff Line Items ({filteredItems.length})
            </h3>
            <input
              type="text"
              placeholder="Filter by staff name, designation or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              data-help="payroll.input_search_items"
            />
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee / ملازم</th>
                    <th className="px-4 py-3 text-right">Base / بنیادی</th>
                    <th className="px-4 py-3 text-right">Absences / چھٹی</th>
                    <th className="px-4 py-3 text-right">Credit / ادھار</th>
                    <th className="px-4 py-3 text-right">Comm. / کمیشن</th>
                    <th className="px-4 py-3 text-right">Extra Duty / اضافی</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-800">Net / خالص</th>
                    <th className="px-4 py-3 text-center">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const formula = calculateEmployeePayrollFormula(item);
                    return (
                      <tr key={item.payroll_item_id} className="hover:bg-slate-50/80 transition-colors" data-help="payroll.item_row">
                        <td className="px-4 py-3">
                          <strong className="text-slate-900 block">{item.full_name}</strong>
                          <span className="text-xs text-slate-500">
                            {item.emp_number} • {item.designation}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          Rs. {Number(item.base_salary).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-mono">
                          {Number(item.unpaid_absence_deduction) > 0
                            ? `-Rs. ${Number(item.unpaid_absence_deduction).toLocaleString()}`
                            : "—"}
                          {Number(item.unpaid_absence_days) > 0 && (
                            <span className="block text-[11px] text-slate-400">
                              ({item.unpaid_absence_days}d)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-mono">
                          {Number(item.internal_credit_deduction) > 0
                            ? `-Rs. ${Number(item.internal_credit_deduction).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-mono">
                          {Number(item.accrued_commissions) > 0
                            ? `+Rs. ${Number(item.accrued_commissions).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-indigo-600 font-mono">
                          {Number(item.extra_duty_pay) > 0
                            ? `+Rs. ${Number(item.extra_duty_pay).toLocaleString()}`
                            : "—"}
                          {Number(item.extra_duty_days) > 0 && (
                            <span className="block text-[11px] text-slate-400">
                              ({item.extra_duty_days}d beyond rest)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          Rs. {Number(item.net_payable).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleViewPayslip(item.payroll_item_id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 rounded text-xs font-medium"
                            data-help="payroll.btn_view_payslip"
                          >
                            View Slip 📄
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No staff items match the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* RUNS LIST VIEW */
        <div className="space-y-4" data-help="payroll.runs_list_view">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-semibold uppercase mr-1">Status:</span>
              {["All", "Generated", "Finalized", "Paid", "Cancelled"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    statusFilter === status
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  data-help="payroll.filter_status"
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search by run # or period..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                data-help="payroll.input_search"
              />
            </div>
          </div>

          {/* Runs Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Run # / رن نمبر</th>
                    <th className="px-4 py-3 text-left">Period / مدت</th>
                    <th className="px-4 py-3 text-left">Status / حالت</th>
                    <th className="px-4 py-3 text-right">Staff Count</th>
                    <th className="px-4 py-3 text-right">Total Net (Rs.)</th>
                    <th className="px-4 py-3 text-left">Generated At</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRuns.map((r) => {
                    const badge = formatPayrollRunStatusBadge(r.status);
                    return (
                      <tr key={r.run_id} className="hover:bg-slate-50/80 transition-colors" data-help="payroll.run_row">
                        <td className="px-4 py-3 font-semibold text-slate-900 font-mono">
                          {r.run_number}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {r.period_start} → {r.period_end}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            style={{ color: badge.color, backgroundColor: badge.bg }}
                            className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {r.employee_count}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          Rs. {Number(r.total_net).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(r.generated_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleSelectRun(r.run_id)}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold"
                            data-help="payroll.btn_view_run"
                          >
                            View Details 🔍
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRuns.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        No payroll runs found matching current filters.
                        {capability.canRun && (
                          <div className="mt-3">
                            <button
                              onClick={() => {
                                setShowGenerateModal(true);
                                handleSetQuickPeriod(1);
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                              data-help="payroll.btn_generate"
                            >
                              Generate First Run
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        Loading payroll runs from server...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE PAYROLL MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="payroll.modal_generate">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Generate Payroll Run / پے رول تیار کریں
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Specify the period start and end date. The server computes all allowances, attendance absences, internal pharmacy/meal deductions, commissions, and extra duties.
            </p>

            {/* Quick buttons */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-500 font-semibold">Quick Range:</span>
              <button
                type="button"
                onClick={() => handleSetQuickPeriod(0)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium"
                data-help="payroll.btn_quick_period"
              >
                Current Month
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickPeriod(1)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium"
                data-help="payroll.btn_quick_period"
              >
                Previous Month
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Period Start Date * / آغاز کی تاریخ
                </label>
                <input
                  type="date"
                  value={generatePeriodStart}
                  onChange={(e) => setGeneratePeriodStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                  data-help="payroll.input_period_start"
                  required
                />
                {generateErrors.period_start && (
                  <p className="text-red-600 text-xs mt-1">{generateErrors.period_start}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Period End Date * / اختتام کی تاریخ
                </label>
                <input
                  type="date"
                  value={generatePeriodEnd}
                  onChange={(e) => setGeneratePeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                  data-help="payroll.input_period_end"
                  required
                />
                {generateErrors.period_end && (
                  <p className="text-red-600 text-xs mt-1">{generateErrors.period_end}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium"
                  data-help="payroll.btn_close_modal"
                >
                  Cancel / منسوخ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold shadow-sm"
                  data-help="payroll.btn_submit_generate"
                >
                  {submitting ? "Computing..." : "Generate Run / تیار کریں"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL RUN DIALOG */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="payroll.modal_cancel">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-red-900 mb-1">
              Cancel Payroll Run / پے رول رن منسوخ کریں
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Cancelling releases all associated attendance punches and unconsumes deductions. Reason is mandatory.
            </p>

            {cancelError && (
              <div className="mb-3 p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cancellation Reason * / منسوخی کی وجہ
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Attendance adjustments required before finalization"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-red-500"
                  data-help="payroll.input_cancel_reason"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium"
                  data-help="payroll.btn_dismiss_cancel"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold shadow-sm"
                  data-help="payroll.btn_confirm_cancel"
                >
                  {submitting ? "Cancelling..." : "Confirm Cancellation / منسوخ کریں"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK PAID DIALOG */}
      {showPaidModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="payroll.modal_paid">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Mark Salaries as Paid / تنخواہیں ادا کریں
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Select disbursement method. This records the disbursement date and marks all payslips as disbursed.
            </p>

            {paidError && (
              <div className="mb-3 p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                {paidError}
              </div>
            )}

            <form onSubmit={handleMarkPaidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method / طریقہ ادائیگی
                </label>
                <select
                  value={paidMethod}
                  onChange={(e) => setPaidMethod(e.target.value as "BankTransfer" | "Cash")}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500"
                  data-help="payroll.select_paid_method"
                >
                  <option value="BankTransfer">Bank Transfer / بینک ٹرانسفر</option>
                  <option value="Cash">Cash / نقد ادائیگی</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaidModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium"
                  data-help="payroll.btn_dismiss_paid"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold shadow-sm"
                  data-help="payroll.btn_confirm_paid"
                >
                  {submitting ? "Updating..." : "Mark as Paid / ادا شدہ درج کریں"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYSLIP DETAIL DRAWER / MODAL */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="payroll.modal_payslip">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Staff Payslip Statement / تنخواہ کی رسید
                </h3>
                <span className="text-xs text-slate-500">
                  Run: {selectedPayslip.run_number} • Period: {selectedPayslip.period_start} to {selectedPayslip.period_end}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1"
                  data-help="payroll.btn_print_payslip"
                >
                  🖨 Print / پرنٹ
                </button>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1"
                  data-help="payroll.btn_close_payslip"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Employee Information */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
              <div>
                <span className="text-xs text-slate-500 block">Employee Name</span>
                <strong className="text-sm text-slate-900">{selectedPayslip.full_name}</strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">ID / Designation</span>
                <span className="text-xs text-slate-700 block">
                  {selectedPayslip.emp_number} • {selectedPayslip.designation}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Department</span>
                <span className="text-xs text-slate-700 block">
                  {selectedPayslip.department_name || "General Facility"}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Run Status</span>
                <span className="text-xs font-bold text-indigo-700 block">
                  {selectedPayslip.run_status}
                </span>
              </div>
            </div>

            {/* Breakdown Line Items */}
            <h4 className="text-sm font-bold text-slate-800 mb-2">Itemized Earnings & Deductions</h4>
            <div className="border border-slate-200 rounded overflow-hidden mb-4">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100 font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-center">Type</th>
                    <th className="px-3 py-2 text-right">Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-white">
                    <td className="px-3 py-2 font-medium">Base Salary</td>
                    <td className="px-3 py-2 text-slate-600">Contractual monthly compensation</td>
                    <td className="px-3 py-2 text-center text-emerald-700 font-semibold">Addition</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                      Rs. {Number(selectedPayslip.base_salary).toLocaleString()}
                    </td>
                  </tr>
                  {(selectedPayslip.lines || []).map((line, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="px-3 py-2 font-medium">{line.category}</td>
                      <td className="px-3 py-2 text-slate-600">{line.description}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            line.line_kind === "Addition"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {line.line_kind}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-semibold ${
                          line.line_kind === "Addition" ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {line.line_kind === "Addition" ? "+" : "-"}Rs.{" "}
                        {Number(line.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-right text-slate-800 text-sm">
                      Net Payable Compensation:
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-base text-indigo-700">
                      Rs. {Number(selectedPayslip.net_payable).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Formula Breakdown Card (rule:0cf7ae94dd) */}
            {(() => {
              const formula = calculateEmployeePayrollFormula(selectedPayslip);
              return (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded p-3 text-xs text-indigo-950 mb-4">
                  <span className="font-bold block mb-1">
                    Audited Calculation (Rule 0cf7ae94dd):
                  </span>
                  <p className="font-mono text-xs">{formula.formulaString}</p>
                  <p className="font-urdu text-xs mt-1 text-indigo-800">{formula.formulaStringUr}</p>
                </div>
              );
            })()}

            {/* Extra Duty statutory note (rule:e846dec8a2) */}
            {Number(selectedPayslip.extra_duty_days) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
                <span className="font-bold block mb-0.5">
                  Extra Duty Statutory Entitlement (Rule e846dec8a2):
                </span>
                <p>
                  Scheduled duties worked beyond the weekly 7-day allowance (7 − rest days). Paid at regular daily rate; specific dates are detailed in the payslip lines.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const PayrollScreen = Payroll;
export default Payroll;
