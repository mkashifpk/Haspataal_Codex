/**
 * Screen 145: staff_directory
 * "Staff directory & records"
 * Workspace: `hr`, Position: 145, Points: 56.
 *
 * Statutory & Quality Rules:
 * - rule:f57cfa01c4: Suspend / resign / terminate revokes the login and every badge at once: confirm with the reason.
 * - rule:83e8fefdaf: Set opening, accrued and carried-forward leave per type and year; leave requests are checked against them.
 * - rule:2cc308be05: Offer status actions strictly by employment_status:
 *     - Draft: none (finish the wizard);
 *     - Awaiting_IT_Provisioning: suspend, resign, terminate, never 'Activate' (IT's login does that);
 *     - Active: suspend, resign, terminate;
 *     - Suspended: reinstate, resign, terminate;
 *     - Resigned or Terminated: 're-join'.
 *     Show returned employment_status (someone IT never gave a login returns to Awaiting_IT_Provisioning).
 *     On reinstatement remind that IT re-enables login and badges issued anew.
 *     On EMPLOYEE_STATUS_INVALID show details.status and reload;
 *     On EMPLOYEE_DOCUMENT_REQUIRED or CLINICAL_LICENSE_REQUIRED instruct document upload.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  searchHrEmployees,
  getHrEmployees,
  orgChart,
  downloadDocumentHrEmployeeDocuments,
  setStatusHrEmployees,
  empBalances,
  setBalance,
  type EmployeeSearchItemOut,
  type EmployeeDetailOut,
  type OrgChartNodeOut,
  type LeaveBalanceOut,
  type EmploymentStatusIn,
  type BalanceIn,
  type EmployeeDocumentOut,
  type QualificationOut,
} from "../generated/staff_directory";
import {
  getStaffDirectoryCapabilityView,
  getAllowedStatusActions,
  validateStatusChangeInput,
  validateLeaveBalanceInput,
  STAFF_DIRECTORY_ERROR_MESSAGES,
  type StaffDirectoryCapabilityView,
  type EmploymentStatus,
  type StatusActionOption,
} from "../staff-directory-policy";
import { ApiError } from "../bridge";

export interface StaffDirectoryProps {
  user?: {
    user_id: number;
    username: string;
    roles: string[];
    permissions: string[];
  };
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  timeZone?: string;
  availableScreens?: string[];
  onNavigateScreen?: (screenId: string,employeeId?:number) => void;
}

interface TreeNode extends OrgChartNodeOut {
  children: TreeNode[];
}

export const StaffDirectory: React.FC<StaffDirectoryProps> = ({
  user,
  establishment,
  connected = true,
  onNavigateScreen,
  availableScreens = [],
}) => {
  // Capability gating
  const capability: StaffDirectoryCapabilityView = useMemo(
    () => getStaffDirectoryCapabilityView(establishment,user?.permissions ?? []),
    [establishment,user?.permissions]
  );

  // Active Tab: 'directory' | 'org_chart'
  const [activeTab, setActiveTab] = useState<"directory" | "org_chart">("directory");

  // Filters for Directory Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);

  // Directory Data State
  const [employees, setEmployees] = useState<EmployeeSearchItemOut[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);

  // Selected Employee Profile Modal State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Status Action Modal State
  const [statusModalEmployee, setStatusModalEmployee] = useState<EmployeeSearchItemOut | EmployeeDetailOut | null>(null);
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<"Active" | "Suspended" | "Resigned" | "Terminated" | "">("");
  const [statusReason, setStatusReason] = useState<string>("");
  const [statusLeftOn, setStatusLeftOn] = useState<string>("");
  const [statusErrors, setStatusErrors] = useState<Record<string, string>>({});
  const [submittingStatus, setSubmittingStatus] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Leave Balances Modal State
  const [leaveModalEmployee, setLeaveModalEmployee] = useState<EmployeeSearchItemOut | EmployeeDetailOut | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceOut[]>([]);
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null);

  // Set Leave Balance Form State
  const [newLeaveType, setNewLeaveType] = useState<"Annual" | "Casual" | "Sick" | "Maternity" | "Unpaid" | "Other">("Annual");
  const [newOpening, setNewOpening] = useState<string>("0");
  const [newAccrued, setNewAccrued] = useState<string>("0");
  const [newCarried, setNewCarried] = useState<string>("0");
  const [balanceFormErrors, setBalanceFormErrors] = useState<Record<string, string>>({});
  const [submittingBalance, setSubmittingBalance] = useState<boolean>(false);

  // Org Chart Data State
  const [orgNodes, setOrgNodes] = useState<OrgChartNodeOut[]>([]);
  const [loadingOrgChart, setLoadingOrgChart] = useState<boolean>(false);
  const [orgChartError, setOrgChartError] = useState<string | null>(null);
  const [orgSearch, setOrgSearch] = useState<string>("");
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // 1. Fetch Employee List
  const fetchEmployees = useCallback(async () => {
    if (!capability.canViewDirectory) {setEmployees([]);setEmployeeDetail(null);return;}
    setLoadingList(true);
    setListError(null);
    try {
      const q = searchQuery.trim() ? searchQuery.trim() : undefined;
      const status = statusFilter ? statusFilter : undefined;
      const deptId = departmentFilter ? Number(departmentFilter) : undefined;
      const data = await searchHrEmployees({
        q,
        status,
        department_id: deptId,
        limit,
      });
      setEmployees(data || []);
    } catch (err: any) {
      const msg = err instanceof ApiError && err.response.error?.message
        ? err.response.error.message
        : "Failed to load staff directory.";
      setListError(msg);
    } finally {
      setLoadingList(false);
    }
  }, [capability.canViewDirectory, searchQuery, statusFilter, departmentFilter, limit]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // 2. Fetch Employee Profile Details
  const fetchEmployeeDetail = useCallback(async (employeeId: number) => {
    setLoadingDetail(true);
    setDetailError(null);
    setDownloadSuccess(null);
    try {
      const data = await getHrEmployees(employeeId);
      setEmployeeDetail(data);
    } catch (err: any) {
      const msg = err instanceof ApiError && err.response.error?.message
        ? err.response.error.message
        : "Failed to retrieve employee profile.";
      setDetailError(msg);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const openProfileModal = (employeeId: number) => {
    setSelectedEmployeeId(employeeId);
    fetchEmployeeDetail(employeeId);
  };

  const closeProfileModal = () => {
    setSelectedEmployeeId(null);
    setEmployeeDetail(null);
    setDetailError(null);
  };

  // 3. Document Download Handler
  const handleDownloadDoc = async (documentId: number, title?: string | null) => {
    setDownloadingDocId(documentId);
    setDownloadSuccess(null);
    try {
      await downloadDocumentHrEmployeeDocuments(documentId);
      setDownloadSuccess(`Downloaded "${title || `Document #${documentId}`}" successfully.`);
    } catch (err: any) {
      const msg = err instanceof ApiError && err.response.error?.message
        ? err.response.error.message
        : "Failed to download document.";
      alert(msg);
    } finally {
      setDownloadingDocId(null);
    }
  };

  // 4. Status Action Handlers
  const openStatusModal = (emp: EmployeeSearchItemOut | EmployeeDetailOut) => {
    setStatusModalEmployee(emp);
    const allowed = getAllowedStatusActions(emp.employment_status);
    setSelectedTargetStatus(allowed.length > 0 ? allowed[0].targetStatus : "");
    setStatusReason("");
    setStatusLeftOn("");
    setStatusErrors({});
    setStatusNotice(null);
  };

  const closeStatusModal = () => {
    setStatusModalEmployee(null);
    setSelectedTargetStatus("");
    setStatusReason("");
    setStatusLeftOn("");
    setStatusErrors({});
    setStatusNotice(null);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalEmployee || !selectedTargetStatus) return;

    const validation = validateStatusChangeInput(
      {
        status: selectedTargetStatus,
        reason: statusReason,
        left_on: statusLeftOn.trim() ? statusLeftOn.trim() : null,
      },
      statusModalEmployee.employment_status
    );

    if (!validation.valid) {
      setStatusErrors(validation.errors);
      return;
    }

    setSubmittingStatus(true);
    setStatusNotice(null);

    try {
      const body: EmploymentStatusIn = {
        status: selectedTargetStatus,
        reason: statusReason.trim(),
        left_on: statusLeftOn.trim() ? statusLeftOn.trim() : null,
      };

      const updated = await setStatusHrEmployees(statusModalEmployee.employee_id, body);

      let successMsg = `Employment status successfully updated to "${updated.employment_status}".`;
      if (selectedTargetStatus === "Active") {
        if (statusModalEmployee.employment_status === "Suspended") {
          successMsg += " Remind staff that IT must re-enable system login and security badges are issued anew.";
        }
      }

      setStatusNotice({ type: "success", message: successMsg });
      fetchEmployees();
      if (selectedEmployeeId === statusModalEmployee.employee_id) {
        fetchEmployeeDetail(statusModalEmployee.employee_id);
      }

      setTimeout(() => {
        closeStatusModal();
      }, 1500);
    } catch (err: any) {
      if (err instanceof ApiError) {
        const code = err.response.error?.code || "";
        const details = err.response.error?.details || {};
        if (code === "EMPLOYEE_STATUS_INVALID") {
          const detailStatus = details.status ? ` (Current status: ${details.status})` : "";
          setStatusNotice({
            type: "danger",
            message: `${STAFF_DIRECTORY_ERROR_MESSAGES.EMPLOYEE_STATUS_INVALID.en}${detailStatus}. Refreshing profile data.`,
          });
          fetchEmployees();
          if (selectedEmployeeId === statusModalEmployee.employee_id) {
            fetchEmployeeDetail(statusModalEmployee.employee_id);
          }
        } else if (code === "EMPLOYEE_DOCUMENT_REQUIRED") {
          setStatusNotice({
            type: "danger",
            message: STAFF_DIRECTORY_ERROR_MESSAGES.EMPLOYEE_DOCUMENT_REQUIRED.en,
          });
        } else if (code === "CLINICAL_LICENSE_REQUIRED") {
          setStatusNotice({
            type: "danger",
            message: STAFF_DIRECTORY_ERROR_MESSAGES.CLINICAL_LICENSE_REQUIRED.en,
          });
        } else {
          setStatusNotice({
            type: "danger",
            message: err.response.error?.message || "Status change was refused by the server.",
          });
        }
      } else {
        setStatusNotice({
          type: "danger",
          message: err?.message || "Network error while updating status.",
        });
      }
    } finally {
      setSubmittingStatus(false);
    }
  };

  // 5. Leave Balances Handlers
  const fetchBalances = useCallback(async (employeeId: number, year: number) => {
    setLoadingBalances(true);
    setLeaveError(null);
    setLeaveSuccess(null);
    try {
      const data = await empBalances(employeeId, { year });
      setLeaveBalances(data || []);
    } catch (err: any) {
      const msg = err instanceof ApiError && err.response.error?.message
        ? err.response.error.message
        : "Failed to load leave balances.";
      setLeaveError(msg);
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  const openLeaveModal = (emp: EmployeeSearchItemOut | EmployeeDetailOut) => {
    setLeaveModalEmployee(emp);
    setSelectedYear(new Date().getFullYear());
    setNewLeaveType("Annual");
    setNewOpening("0");
    setNewAccrued("0");
    setNewCarried("0");
    setBalanceFormErrors({});
    setLeaveSuccess(null);
    fetchBalances(emp.employee_id, new Date().getFullYear());
  };

  const closeLeaveModal = () => {
    setLeaveModalEmployee(null);
    setLeaveBalances([]);
    setLeaveError(null);
    setLeaveSuccess(null);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    if (leaveModalEmployee) {
      fetchBalances(leaveModalEmployee.employee_id, year);
    }
  };

  const handleBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveModalEmployee) return;

    const payload: BalanceIn = {
      employee_id: leaveModalEmployee.employee_id,
      leave_type: newLeaveType,
      year: selectedYear,
      opening: Number(newOpening) || 0,
      accrued: Number(newAccrued) || 0,
      carried_forward: Number(newCarried) || 0,
    };

    const validation = validateLeaveBalanceInput(payload);
    if (!validation.valid) {
      setBalanceFormErrors(validation.errors);
      return;
    }

    setSubmittingBalance(true);
    setLeaveError(null);
    setLeaveSuccess(null);
    setBalanceFormErrors({});

    try {
      await setBalance(payload);
      setLeaveSuccess(`Updated ${newLeaveType} leave balance for ${selectedYear} successfully.`);
      fetchBalances(leaveModalEmployee.employee_id, selectedYear);
    } catch (err: any) {
      const msg = err instanceof ApiError && err.response.error?.message
        ? err.response.error.message
        : "Failed to save leave balance configuration.";
      setLeaveError(msg);
    } finally {
      setSubmittingBalance(false);
    }
  };

  // 6. Org Chart Handlers
  const fetchOrgChart = useCallback(async () => {
    if (!capability.canViewOrgChart) return;
    setLoadingOrgChart(true);
    setOrgChartError(null);
    try {
      const nodes = await orgChart();
      setOrgNodes(nodes || []);
      // Auto-expand all top-level supervisor nodes
      const initialExpanded = new Set<number>();
      (nodes || []).forEach((n) => {
        if (!n.supervisor_id) initialExpanded.add(n.employee_id);
      });
      setExpandedNodes(initialExpanded);
    } catch (err: any) {
      const msg = err instanceof ApiError && err.response.error?.message
        ? err.response.error.message
        : "Failed to load organizational hierarchy.";
      setOrgChartError(msg);
    } finally {
      setLoadingOrgChart(false);
    }
  }, [capability.canViewOrgChart]);

  useEffect(() => {
    if (activeTab === "org_chart" && orgNodes.length === 0) {
      fetchOrgChart();
    }
  }, [activeTab, orgNodes.length, fetchOrgChart]);

  // Build tree from flat orgNodes
  const orgTree: TreeNode[] = useMemo(() => {
    if (!orgNodes.length) return [];
    const map = new Map<number, TreeNode>();
    orgNodes.forEach((n) => {
      map.set(n.employee_id, { ...n, children: [] });
    });

    const roots: TreeNode[] = [];
    orgNodes.forEach((n) => {
      const node = map.get(n.employee_id)!;
      if (n.supervisor_id !== null && map.has(n.supervisor_id)) {
        map.get(n.supervisor_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [orgNodes]);

  const toggleNodeExpand = (id: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Status Badge Helper
  const renderStatusBadge = (status: EmploymentStatus) => {
    let bg = "secondary";
    let textUr = "";
    switch (status) {
      case "Active":
        bg = "success";
        textUr = "فعال";
        break;
      case "Awaiting_IT_Provisioning":
        bg = "info text-dark";
        textUr = "آئی ٹی فراہمی کی منتظر";
        break;
      case "Draft":
        bg = "warning text-dark";
        textUr = "ڈرافٹ";
        break;
      case "Suspended":
        bg = "danger";
        textUr = "معطل";
        break;
      case "Resigned":
        bg = "secondary";
        textUr = "مستعفی";
        break;
      case "Terminated":
        bg = "dark";
        textUr = "برخاست";
        break;
    }
    return (
      <span className={`badge bg-${bg} px-2 py-1`}>
        {status} <small className="opacity-75">({textUr})</small>
      </span>
    );
  };

  // Render Tree Node recursively
  const renderOrgNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.employee_id);
    const matchesSearch = !orgSearch.trim() ||
      node.full_name.toLowerCase().includes(orgSearch.toLowerCase()) ||
      node.designation.toLowerCase().includes(orgSearch.toLowerCase()) ||
      (node.department_name && node.department_name.toLowerCase().includes(orgSearch.toLowerCase()));

    return (
      <div key={node.employee_id} style={{ marginLeft: `${depth * 24}px` }} className="mb-2">
        <div
          className={`card shadow-sm border-start border-4 ${
            depth === 0 ? "border-primary" : "border-info"
          } p-2 d-flex flex-row align-items-center justify-content-between`}
          style={{ backgroundColor: matchesSearch ? "#ffffff" : "#f8f9fa", opacity: matchesSearch ? 1 : 0.6 }}
        >
          <div className="d-flex align-items-center gap-2">
            {hasChildren && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-0 px-2"
                onClick={() => toggleNodeExpand(node.employee_id)}
                data-help="staff_directory.org_chart.expand_toggle"
                title={isExpanded ? "Collapse branch" : "Expand branch"}
              >
                {isExpanded ? "▼" : "▶"}
              </button>
            )}
            {!hasChildren && <span className="text-muted ms-3">•</span>}
            <div>
              <strong className="text-dark fs-6">{node.full_name}</strong>
              <span className="text-muted ms-2">— {node.designation}</span>
              {node.department_name && (
                <span className="badge bg-light text-dark border ms-2">
                  {node.department_name}
                </span>
              )}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {hasChildren && (
              <span className="badge bg-secondary">
                {node.children.length} direct report{node.children.length > 1 ? "s" : ""}
              </span>
            )}
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => openProfileModal(node.employee_id)}
              data-help="staff_directory.view_profile"
            >
              View Profile
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1 ps-2 border-start border-2 border-light">
            {node.children.map((child) => renderOrgNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container-fluid p-3 staff-directory-screen" data-help="staff_directory.container">
      {/* Capability Notice Banner */}
      {capability.noticeEn && (
        <div className="alert alert-info d-flex align-items-center justify-content-between mb-3" role="alert">
          <div>
            <strong>Notice:</strong> {capability.noticeEn}
            <div className="urdu-text small mt-1">{capability.noticeUr}</div>
          </div>
          <span className="badge bg-primary text-uppercase">{capability.mode}</span>
        </div>
      )}

      {/* Screen Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between pb-3 mb-3 border-bottom">
        <div>
          <h2 className="h4 mb-0 d-flex align-items-center gap-2">
            <span>Staff Directory & Records</span>
            <span className="badge bg-secondary fs-6">§6.1, §6.2, §6.6</span>
          </h2>
          <div className="text-muted small urdu-text mt-1">
            عملے کی ڈائریکٹری، اسناد، لاگ ان و بیج اسٹیٹس، اور تنظیمی درجہ بندی
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <ul className="nav nav-pills" role="tablist">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === "directory" ? "active" : ""}`}
                onClick={() => setActiveTab("directory")}
                data-help="staff_directory.tab.directory"
              >
                Directory Worklist / فہرست
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === "org_chart" ? "active" : ""}`}
                onClick={() => setActiveTab("org_chart")}
                data-help="staff_directory.org_chart"
              >
                Org Chart / تنظیمی چارٹ
              </button>
            </li>
          </ul>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => {
              if (activeTab === "directory") fetchEmployees();
              else fetchOrgChart();
            }}
            disabled={loadingList || loadingOrgChart}
            data-help="staff_directory.refresh"
          >
            {loadingList || loadingOrgChart ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: STAFF DIRECTORY WORKLIST                                */}
      {/* ============================================================== */}
      {activeTab === "directory" && (
        <div>
          {/* Search & Filter Toolbar */}
          <div className="card shadow-sm mb-3">
            <div className="card-body p-3">
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-4">
                  <label htmlFor="staffSearchInput" className="form-label small fw-bold mb-1">
                    Search Name / CNIC / Emp # / Mobile
                  </label>
                  <input
                    id="staffSearchInput"
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Dr. Ahmed, EMP-00042, 35201..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-help="staff_directory.search"
                  />
                </div>

                <div className="col-6 col-md-3">
                  <label htmlFor="staffStatusSelect" className="form-label small fw-bold mb-1">
                    Employment Status
                  </label>
                  <select
                    id="staffStatusSelect"
                    className="form-select form-select-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    data-help="staff_directory.filter.status"
                  >
                    <option value="">All Statuses / تمام حالات</option>
                    <option value="Active">Active / فعال</option>
                    <option value="Awaiting_IT_Provisioning">Awaiting IT Provisioning</option>
                    <option value="Draft">Draft / ڈرافٹ</option>
                    <option value="Suspended">Suspended / معطل</option>
                    <option value="Resigned">Resigned / مستعفی</option>
                    <option value="Terminated">Terminated / برخاست</option>
                  </select>
                </div>

                <div className="col-4 col-md-2">
                  <label htmlFor="staffLimitSelect" className="form-label small fw-bold mb-1">
                    Rows
                  </label>
                  <select
                    id="staffLimitSelect"
                    className="form-select form-select-sm"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    data-help="staff_directory.filter.limit"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="col-2 col-md-3 d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-100"
                    onClick={fetchEmployees}
                    disabled={loadingList}
                    data-help="staff_directory.search_button"
                  >
                    {loadingList ? "Searching..." : "Filter Directory"}
                  </button>
                  {searchQuery && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setSearchQuery("")}
                      data-help="staff_directory.clear_search"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {listError && (
            <div className="alert alert-danger" role="alert" data-help="staff_directory.list_error">
              <strong>Error:</strong> {listError}
            </div>
          )}

          {/* Employees Table */}
          <div className="card shadow-sm">
            <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
              <span className="fw-bold small text-uppercase">Staff Directory Worklist ({employees.length} records)</span>
              <span className="small text-muted">
                Statutory Rule <span className="badge bg-light text-dark border">rule:2cc308be05</span> strictly enforces allowed status actions
              </span>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" data-help="staff_directory.table">
                <thead className="table-light">
                  <tr>
                    <th scope="col" style={{ width: "110px" }}>Emp #</th>
                    <th scope="col">Staff Member</th>
                    <th scope="col">Designation & Dept</th>
                    <th scope="col">Status</th>
                    <th scope="col">Category & Contract</th>
                    <th scope="col">Mobile</th>
                    <th scope="col">Supervisor</th>
                    <th scope="col" className="text-end" style={{ width: "220px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                        <span className="text-muted">Loading staff members...</span>
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        No staff members found matching query parameters.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.employee_id} data-help={`staff_directory.row.${emp.employee_id}`}>
                        <td>
                          <span className="badge bg-light text-dark border font-monospace">
                            {emp.emp_number}
                          </span>
                        </td>
                        <td>
                          <strong className="d-block text-dark">{emp.full_name}</strong>
                          <small className="text-muted">ID: {emp.employee_id}</small>
                        </td>
                        <td>
                          <div>{emp.designation}</div>
                          <small className="text-muted">{emp.department_name || "Unassigned"}</small>
                        </td>
                        <td>{renderStatusBadge(emp.employment_status)}</td>
                        <td>
                          <div>{emp.staff_category}</div>
                          <small className="text-muted">{emp.contract_type}</small>
                        </td>
                        <td className="font-monospace small">{emp.mobile}</td>
                        <td className="small">{emp.supervisor_name || "—"}</td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm" role="group">
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={() => openProfileModal(emp.employee_id)}
                              data-help="staff_directory.view_profile"
                              title="View full credentials, documents, and IT login"
                            >
                              Profile
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => openStatusModal(emp)}
                              disabled={!capability.canUpdateStatus || emp.employment_status === "Draft"}
                              data-help="staff_directory.status_action"
                              title={
                                emp.employment_status === "Draft"
                                  ? "Draft profiles must finish wizard to change status"
                                  : "Change employment status (suspend, resign, terminate, reinstate)"
                              }
                            >
                              Status
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-info"
                              onClick={() => openLeaveModal(emp)}
                              disabled={!capability.canManageLeaveBalances}
                              data-help="staff_directory.leave_balances"
                              title="Annual leave balance allowances and adjustments"
                            >
                              Leaves
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ORGANIZATIONAL HIERARCHY TREE                          */}
      {/* ============================================================== */}
      {activeTab === "org_chart" && (
        <div className="card shadow-sm">
          <div className="card-header bg-white py-2 d-flex flex-wrap justify-content-between align-items-center">
            <div>
              <strong className="text-dark">Organizational Reporting Hierarchy</strong>
              <span className="text-muted ms-2 small">GET /hr/org-chart</span>
            </div>
            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Filter supervisor / employee..."
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                style={{ width: "240px" }}
                data-help="staff_directory.org_chart.search"
              />
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  const allIds = new Set<number>();
                  orgNodes.forEach((n) => allIds.add(n.employee_id));
                  setExpandedNodes(allIds);
                }}
                data-help="staff_directory.org_chart.expand_all"
              >
                Expand All
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setExpandedNodes(new Set())}
                data-help="staff_directory.org_chart.collapse_all"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="card-body p-3">
            {orgChartError && (
              <div className="alert alert-danger" role="alert">
                {orgChartError}
              </div>
            )}

            {loadingOrgChart ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary me-2" role="status" />
                <span className="text-muted">Loading supervisor hierarchy tree...</span>
              </div>
            ) : orgTree.length === 0 ? (
              <div className="text-muted text-center py-4">
                No organizational reporting hierarchy records found.
              </div>
            ) : (
              <div>{orgTree.map((root) => renderOrgNode(root, 0))}</div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: FULL EMPLOYEE PROFILE DRAWER / MODAL                  */}
      {/* ============================================================== */}
      {selectedEmployeeId && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content" data-help="staff_directory.profile_modal">
              <div className="modal-header bg-light">
                <div>
                  <h5 className="modal-title mb-0">
                    {employeeDetail?.full_name || `Employee #${selectedEmployeeId}`}
                    {employeeDetail && (
                      <span className="ms-2 font-monospace fs-6 text-muted">
                        ({employeeDetail.emp_number})
                      </span>
                    )}
                  </h5>
                  <div className="text-muted small">
                    Personnel Credentials, Document Vault & IT Provisioning Status
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeProfileModal}
                  aria-label="Close"
                  data-help="staff_directory.profile_modal.close"
                />
              </div>

              <div className="modal-body p-3">
                {detailError && (
                  <div className="alert alert-danger" role="alert">
                    <strong>Error:</strong> {detailError}
                  </div>
                )}

                {downloadSuccess && (
                  <div className="alert alert-success alert-dismissible" role="alert">
                    {downloadSuccess}
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setDownloadSuccess(null)}
                      aria-label="Dismiss"
                      data-help="staff_directory.download_dismiss"
                    />
                  </div>
                )}

                {loadingDetail || !employeeDetail ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary me-2" role="status" />
                    <span>Loading employee profile...</span>
                  </div>
                ) : (
                  <div>
                    {/* Status & Banner Alerts */}
                    <div className="d-flex flex-wrap align-items-center justify-content-between p-2 mb-3 bg-light rounded border">
                      <div className="d-flex align-items-center gap-2">
                        <span>Current Status:</span>
                        {renderStatusBadge(employeeDetail.employment_status)}
                        <span className="badge bg-secondary">{employeeDetail.staff_category}</span>
                        <span className="badge bg-outline-dark border">{employeeDetail.contract_type}</span>
                        {employeeDetail.is_clinical_staff && (
                          <span className="badge bg-primary">Clinical Staff</span>
                        )}
                      </div>

                      <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => openStatusModal(employeeDetail)}
                          disabled={!capability.canUpdateStatus || employeeDetail.employment_status === "Draft"}
                          data-help="staff_directory.status_action"
                        >
                          Change Status
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info"
                          onClick={() => openLeaveModal(employeeDetail)}
                          disabled={!capability.canManageLeaveBalances}
                          data-help="staff_directory.leave_balances"
                        >
                          Leave Balances
                        </button>
                      </div>
                    </div>

                    <div className="toolbar">
                      {availableScreens.includes("badges") && <button data-help="staff_directory.identity" onClick={() => onNavigateScreen?.("badges", employeeDetail.employee_id)}>Open badges / بیجز کھولیں</button>}
                      {availableScreens.includes("id_card") && <button data-help="staff_directory.identity" onClick={() => onNavigateScreen?.("id_card", employeeDetail.employee_id)}>Open ID card / شناختی کارڈ کھولیں</button>}
                    </div>
                    {/* Onboarding Draft notice */}
                    {employeeDetail.employment_status === "Draft" && (
                      <div className="alert alert-warning mb-3 d-flex justify-content-between align-items-center">
                        <div>
                          <strong>Profile in Draft (Step {employeeDetail.onboarding_step}):</strong> This employee has not completed HR onboarding. Finish required steps in the Onboarding Wizard.
                        </div>
                        {onNavigateScreen && (
                          <button
                            type="button"
                            className="btn btn-sm btn-warning"
                            onClick={() => onNavigateScreen("onboarding_wizard",employeeDetail.employee_id)}
                            data-help="staff_directory.open_wizard"
                          >
                            Open Onboarding Wizard
                          </button>
                        )}
                      </div>
                    )}

                    {/* IT Provisioning notice */}
                    {employeeDetail.employment_status === "Awaiting_IT_Provisioning" && (
                      <div className="alert alert-info mb-3">
                        <strong>Awaiting IT Provisioning:</strong> Profile finalized by HR. IT Administration console must provision user login credentials to activate this profile. HR cannot create logins directly (Rule <span className="font-monospace">rule:2cc308be05</span>).
                      </div>
                    )}

                    <div className="row g-3">
                      {/* Section 1: Demographics */}
                      <div className="col-12 col-md-6">
                        <div className="card h-100">
                          <div className="card-header bg-white py-2 fw-bold small text-uppercase">
                            1. Demographics & Contact
                          </div>
                          <div className="card-body p-3 small">
                            <div className="row g-2">
                              <div className="col-6">
                                <span className="text-muted d-block">CNIC:</span>
                                <strong className="font-monospace">{employeeDetail.cnic}</strong>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Mobile:</span>
                                <strong className="font-monospace">{employeeDetail.mobile}</strong>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Father/Husband:</span>
                                <span>{employeeDetail.father_or_husband_name || "—"}</span>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Gender / Blood Group:</span>
                                <span>{employeeDetail.gender || "—"} / {employeeDetail.blood_group || "—"}</span>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Date of Birth:</span>
                                <span>{employeeDetail.dob || "—"}</span>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Email:</span>
                                <span>{employeeDetail.email || "—"}</span>
                              </div>
                              <div className="col-12">
                                <span className="text-muted d-block">Residential Address:</span>
                                <span>{employeeDetail.address || "—"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Job & Taxonomy */}
                      <div className="col-12 col-md-6">
                        <div className="card h-100">
                          <div className="card-header bg-white py-2 fw-bold small text-uppercase">
                            2. Job Taxonomy & Hierarchy
                          </div>
                          <div className="card-body p-3 small">
                            <div className="row g-2">
                              <div className="col-6">
                                <span className="text-muted d-block">Department:</span>
                                <strong>{employeeDetail.department_name || "Unassigned"}</strong>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Designation:</span>
                                <strong>{employeeDetail.designation}</strong>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Specialty:</span>
                                <span>{employeeDetail.specialty || "—"}</span>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Supervisor:</span>
                                <span>{employeeDetail.supervisor_name || "Top level (None)"}</span>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Base Salary:</span>
                                <span>PKR {employeeDetail.base_salary.toLocaleString()}</span>
                              </div>
                              <div className="col-6">
                                <span className="text-muted d-block">Joined / Left On:</span>
                                <span>{employeeDetail.joined_on || "—"} {employeeDetail.left_on ? `/ ${employeeDetail.left_on}` : ""}</span>
                              </div>
                              <div className="col-12">
                                <span className="text-muted d-block">Practice Licence:</span>
                                {employeeDetail.license_type && employeeDetail.license_number ? (
                                  <span className="badge bg-light text-dark border">
                                    {employeeDetail.license_type}: {employeeDetail.license_number}
                                  </span>
                                ) : (
                                  <span className="text-muted">Not applicable / Not recorded</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: IT Login & Security Badges */}
                      <div className="col-12 col-md-6">
                        <div className="card h-100">
                          <div className="card-header bg-white py-2 fw-bold small text-uppercase">
                            3. IT Login & Security Badges
                          </div>
                          <div className="card-body p-3 small">
                            <div className="mb-2">
                              <span className="text-muted">System User Login:</span>{" "}
                              {employeeDetail.user ? (
                                <span className="badge bg-success">
                                  User #{employeeDetail.user.user_id} ({employeeDetail.user.username}) — Active
                                </span>
                              ) : (
                                <span className="badge bg-secondary">No Login Provisioned</span>
                              )}
                            </div>

                            <span className="text-muted d-block mb-1">Active Security Badges:</span>
                            {employeeDetail.badges.length === 0 ? (
                              <div className="text-muted fst-italic">No badges currently issued.</div>
                            ) : (
                              <ul className="list-group list-group-flush border rounded">
                                {employeeDetail.badges.map((b) => (
                                  <li key={b.badge_code} className="list-group-item d-flex justify-content-between align-items-center py-1">
                                    <div>
                                      <span className="font-monospace fw-bold">{b.badge_code}</span>
                                      <span className="badge bg-light text-dark border ms-2">{b.technology}</span>
                                    </div>
                                    <span className="text-muted">{b.holder_type}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Work Schedule & Submit Checklist */}
                      <div className="col-12 col-md-6">
                        <div className="card h-100">
                          <div className="card-header bg-white py-2 fw-bold small text-uppercase">
                            4. Schedule & Submission Checklist
                          </div>
                          <div className="card-body p-3 small">
                            <div className="mb-2">
                              <span className="text-muted">Default Shift:</span>{" "}
                              <strong>{employeeDetail.schedule?.shift_name || "Duty roster only"}</strong>
                            </div>

                            <span className="text-muted d-block mb-1">Submission Readiness:</span>
                            {employeeDetail.checklist?.ready ? (
                              <span className="badge bg-success">Checklist Complete & Ready</span>
                            ) : (
                              <div>
                                <span className="badge bg-warning text-dark mb-1">Missing Requirements:</span>
                                <ul className="mb-0 ps-3">
                                  {(employeeDetail.checklist?.missing || []).map((m, idx) => (
                                    <li key={idx} className="text-danger">{m}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section 5: Document Vault */}
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                            <span className="fw-bold small text-uppercase">
                              5. Document Vault ({employeeDetail.documents.length} files)
                            </span>
                            <span className="small text-muted">GET /hr/employee-documents/&#123;id&#125;/download</span>
                          </div>
                          <div className="table-responsive">
                            <table className="table table-sm align-middle mb-0" data-help="staff_directory.documents_table">
                              <thead className="table-light">
                                <tr>
                                  <th>Type</th>
                                  <th>Title</th>
                                  <th>Format</th>
                                  <th>Required</th>
                                  <th>Verified</th>
                                  <th>Uploaded At</th>
                                  <th className="text-end">Download</th>
                                </tr>
                              </thead>
                              <tbody>
                                {employeeDetail.documents.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="text-center text-muted py-3">
                                      No documents in vault.
                                    </td>
                                  </tr>
                                ) : (
                                  employeeDetail.documents.map((doc) => (
                                    <tr key={doc.document_id}>
                                      <td>
                                        <span className="badge bg-light text-dark border">
                                          {doc.doc_type}
                                        </span>
                                      </td>
                                      <td>{doc.title || "—"}</td>
                                      <td className="small text-muted">{doc.content_type}</td>
                                      <td>
                                        {doc.is_required ? (
                                          <span className="text-danger">Yes</span>
                                        ) : (
                                          <span className="text-muted">No</span>
                                        )}
                                      </td>
                                      <td>
                                        {doc.is_verified ? (
                                          <span className="badge bg-success">Verified</span>
                                        ) : (
                                          <span className="badge bg-warning text-dark">Pending</span>
                                        )}
                                      </td>
                                      <td className="small text-muted">{doc.uploaded_at?.slice(0, 10)}</td>
                                      <td className="text-end">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-primary py-0"
                                          onClick={() => handleDownloadDoc(doc.document_id, doc.title)}
                                          disabled={downloadingDocId === doc.document_id}
                                          data-help="staff_directory.document_download"
                                        >
                                          {downloadingDocId === doc.document_id ? "Downloading..." : "Download"}
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Section 6: Qualifications & Primary Source Verification */}
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-white py-2 fw-bold small text-uppercase">
                            6. Academic & Professional Qualifications (MSDS HRM 142)
                          </div>
                          <div className="table-responsive">
                            <table className="table table-sm align-middle mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th>Type</th>
                                  <th>Qualification Title</th>
                                  <th>Institution</th>
                                  <th>Year</th>
                                  <th>License #</th>
                                  <th>MSDS Verification Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {employeeDetail.qualifications.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="text-center text-muted py-3">
                                      No qualifications recorded.
                                    </td>
                                  </tr>
                                ) : (
                                  employeeDetail.qualifications.map((q) => (
                                    <tr key={q.qualification_id}>
                                      <td>{q.qualification_type}</td>
                                      <td><strong>{q.title}</strong></td>
                                      <td>{q.institution || "—"}</td>
                                      <td>{q.year || "—"}</td>
                                      <td>{q.license_number || "—"}</td>
                                      <td>
                                        <span className={`badge bg-${q.verification_status === "Verified" ? "success" : q.verification_status === "Failed" ? "danger" : "warning text-dark"}`}>
                                          {q.verification_status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={closeProfileModal}
                  data-help="staff_directory.profile_modal.close_btn"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: STATUS CHANGE ACTION MODAL                            */}
      {/* ============================================================== */}
      {statusModalEmployee && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content" data-help="staff_directory.status_modal">
              <form onSubmit={handleStatusSubmit}>
                <div className="modal-header bg-light">
                  <h5 className="modal-title mb-0">
                    Change Employment Status
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeStatusModal}
                    aria-label="Close"
                    disabled={submittingStatus}
                    data-help="staff_directory.status_modal.close"
                  />
                </div>

                <div className="modal-body p-3">
                  <div className="mb-3">
                    <strong className="text-dark d-block">{statusModalEmployee.full_name}</strong>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <span className="text-muted small">Current status:</span>
                      {renderStatusBadge(statusModalEmployee.employment_status)}
                    </div>
                  </div>

                  {statusNotice && (
                    <div className={`alert alert-${statusNotice.type}`} role="alert">
                      {statusNotice.message}
                    </div>
                  )}

                  {/* Allowed Status Actions */}
                  {(() => {
                    const allowed = getAllowedStatusActions(statusModalEmployee.employment_status);

                    if (statusModalEmployee.employment_status === "Draft") {
                      return (
                        <div className="alert alert-warning">
                          <strong>Rule rule:2cc308be05:</strong> Draft profiles cannot change status here. Complete Step 6 in the Onboarding Wizard to transition to Awaiting_IT_Provisioning.
                        </div>
                      );
                    }

                    if (allowed.length === 0) {
                      return (
                        <div className="alert alert-secondary">
                          No status transitions are currently permitted from {statusModalEmployee.employment_status}.
                        </div>
                      );
                    }

                    return (
                      <div>
                        <label className="form-label small fw-bold">Select Target Action:</label>
                        <div className="list-group mb-3">
                          {allowed.map((action) => (
                            <label
                              key={action.targetStatus}
                              className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${
                                selectedTargetStatus === action.targetStatus ? "active" : ""
                              }`}
                              style={{ cursor: "pointer" }}
                            >
                              <input
                                type="radio"
                                name="targetStatusRadio"
                                className="form-check-input my-0"
                                checked={selectedTargetStatus === action.targetStatus}
                                onChange={() => setSelectedTargetStatus(action.targetStatus)}
                                data-help="staff_directory.status_target_radio"
                              />
                              <div className="flex-grow-1">
                                <div className="fw-bold">{action.labelEn}</div>
                                <div className="small opacity-75">{action.hintEn}</div>
                              </div>
                              <span className="badge bg-light text-dark border urdu-text">
                                {action.labelUr}
                              </span>
                            </label>
                          ))}
                        </div>

                        {statusErrors.status && (
                          <div className="text-danger small mb-2">{statusErrors.status}</div>
                        )}

                        {/* Statutory Warning Box: rule:f57cfa01c4 */}
                        {(selectedTargetStatus === "Suspended" ||
                          selectedTargetStatus === "Resigned" ||
                          selectedTargetStatus === "Terminated") && (
                          <div className="alert alert-danger py-2 small mb-3">
                            <strong>Statutory Rule rule:f57cfa01c4:</strong> Suspending, resigning, or terminating revokes the employee's system login and every security badge immediately.
                            <div className="urdu-text mt-1">
                              انتباہ: معطلی، استعفیٰ یا برخاستگی سے سسٹم لاگ ان اور تمام سیکیورٹی بیجز فوری منسوخ کر دیے جائیں گے۔
                            </div>
                          </div>
                        )}

                        {/* Statutory Reminder Box: rule:2cc308be05 Reinstatement */}
                        {selectedTargetStatus === "Active" &&
                          statusModalEmployee.employment_status === "Suspended" && (
                            <div className="alert alert-info py-2 small mb-3">
                              <strong>Rule rule:2cc308be05:</strong> Following reinstatement, IT Console re-enables the system login, and revoked badges must be issued anew.
                              <div className="urdu-text mt-1">
                                بحالی کے بعد، آئی ٹی لاگ ان فعال کرے گا اور نئے سیکیورٹی بیجز جاری کیے جائیں گے۔
                              </div>
                            </div>
                          )}

                        {/* Mandatory Reason Input */}
                        <div className="mb-3">
                          <label htmlFor="statusReasonTextarea" className="form-label small fw-bold">
                            Operational Reason (Mandatory, min 3 characters) *
                          </label>
                          <textarea
                            id="statusReasonTextarea"
                            className={`form-control form-control-sm ${statusErrors.reason ? "is-invalid" : ""}`}
                            rows={3}
                            placeholder="State administrative justification for this status change..."
                            value={statusReason}
                            onChange={(e) => setStatusReason(e.target.value)}
                            data-help="staff_directory.status_reason"
                          />
                          {statusErrors.reason && (
                            <div className="invalid-feedback">{statusErrors.reason}</div>
                          )}
                        </div>

                        {/* Left On Date (for Resigned or Terminated) */}
                        {(selectedTargetStatus === "Resigned" || selectedTargetStatus === "Terminated") && (
                          <div className="mb-3">
                            <label htmlFor="statusLeftOnInput" className="form-label small fw-bold">
                              Effective Left On Date (YYYY-MM-DD)
                            </label>
                            <input
                              id="statusLeftOnInput"
                              type="date"
                              className={`form-control form-control-sm ${statusErrors.left_on ? "is-invalid" : ""}`}
                              value={statusLeftOn}
                              onChange={(e) => setStatusLeftOn(e.target.value)}
                              data-help="staff_directory.status_left_on"
                            />
                            {statusErrors.left_on && (
                              <div className="invalid-feedback">{statusErrors.left_on}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={closeStatusModal}
                    disabled={submittingStatus}
                    data-help="staff_directory.status_modal.cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={
                      submittingStatus ||
                      !selectedTargetStatus ||
                      statusModalEmployee.employment_status === "Draft"
                    }
                    data-help="staff_directory.status_modal.submit"
                  >
                    {submittingStatus ? "Updating Status..." : "Confirm Status Change"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ANNUAL LEAVE BALANCES MODAL                           */}
      {/* ============================================================== */}
      {leaveModalEmployee && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content" data-help="staff_directory.leave_modal">
              <div className="modal-header bg-light">
                <div>
                  <h5 className="modal-title mb-0">Annual Leave Balances</h5>
                  <div className="text-muted small">
                    {leaveModalEmployee.full_name} ({leaveModalEmployee.emp_number})
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeLeaveModal}
                  aria-label="Close"
                  disabled={submittingBalance}
                  data-help="staff_directory.leave_modal.close"
                />
              </div>

              <div className="modal-body p-3">
                {/* Statutory Rule Banner */}
                <div className="alert alert-secondary py-2 small mb-3">
                  <strong>Statutory Rule rule:83e8fefdaf:</strong> Set opening, accrued and carried-forward leave per type and year; leave requests are checked against them.
                  <div className="urdu-text mt-1">
                    ہر قسم اور سال کے لیے ابتدائی، جمع شدہ اور آگے لائی گئی رخصتیں مقرر کریں؛ رخصت کی درخواستیں ان کے مطابق چیک ہوتی ہیں۔
                  </div>
                </div>

                {leaveError && (
                  <div className="alert alert-danger" role="alert">
                    <strong>Error:</strong> {leaveError}
                  </div>
                )}

                {leaveSuccess && (
                  <div className="alert alert-success" role="alert">
                    {leaveSuccess}
                  </div>
                )}

                {/* Year Selector */}
                <div className="d-flex align-items-center gap-2 mb-3">
                  <label htmlFor="leaveYearSelect" className="small fw-bold text-nowrap">
                    Calendar Year:
                  </label>
                  <select
                    id="leaveYearSelect"
                    className="form-select form-select-sm"
                    style={{ width: "120px" }}
                    value={selectedYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    data-help="staff_directory.leave_year_select"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Balances Table */}
                <div className="table-responsive mb-4">
                  <table className="table table-bordered table-sm align-middle mb-0" data-help="staff_directory.leave_balances_table">
                    <thead className="table-light">
                      <tr>
                        <th>Leave Type</th>
                        <th className="text-end">Opening</th>
                        <th className="text-end">Accrued</th>
                        <th className="text-end">Carried Forward</th>
                        <th className="text-end">Used</th>
                        <th className="text-end">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingBalances ? (
                        <tr>
                          <td colSpan={6} className="text-center py-3 text-muted">
                            Loading leave allowances for {selectedYear}...
                          </td>
                        </tr>
                      ) : leaveBalances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-3 text-muted">
                            No leave balance records configured for {selectedYear}. Use form below to initialize.
                          </td>
                        </tr>
                      ) : (
                        leaveBalances.map((b) => (
                          <tr key={b.leave_type}>
                            <td><strong>{b.leave_type}</strong></td>
                            <td className="text-end font-monospace">{b.opening}</td>
                            <td className="text-end font-monospace">{b.accrued}</td>
                            <td className="text-end font-monospace">{b.carried_forward}</td>
                            <td className="text-end font-monospace text-danger">{b.used}</td>
                            <td className="text-end font-monospace fw-bold text-success">{b.available}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Set / Adjust Balance Form (PUT /hr/leave-balances) */}
                <div className="card">
                  <div className="card-header bg-white py-2 fw-bold small text-uppercase">
                    Set / Adjust Allowance (PUT /hr/leave-balances)
                  </div>
                  <div className="card-body p-3">
                    <form onSubmit={handleBalanceSubmit}>
                      <div className="row g-2">
                        <div className="col-12 col-md-3">
                          <label htmlFor="leaveTypeSelect" className="form-label small fw-bold mb-1">
                            Leave Type
                          </label>
                          <select
                            id="leaveTypeSelect"
                            className="form-select form-select-sm"
                            value={newLeaveType}
                            onChange={(e) => setNewLeaveType(e.target.value as any)}
                            data-help="staff_directory.balance_leave_type"
                          >
                            <option value="Annual">Annual / سالانہ</option>
                            <option value="Casual">Casual / اتفاقیہ</option>
                            <option value="Sick">Sick / بیماری</option>
                            <option value="Maternity">Maternity / زچگی</option>
                            <option value="Unpaid">Unpaid / بغیر تنخواہ</option>
                            <option value="Other">Other / دیگر</option>
                          </select>
                        </div>

                        <div className="col-4 col-md-3">
                          <label htmlFor="openingInput" className="form-label small fw-bold mb-1">
                            Opening Days
                          </label>
                          <input
                            id="openingInput"
                            type="number"
                            min="0"
                            step="0.5"
                            className={`form-control form-control-sm ${balanceFormErrors.opening ? "is-invalid" : ""}`}
                            value={newOpening}
                            onChange={(e) => setNewOpening(e.target.value)}
                            data-help="staff_directory.balance_opening"
                          />
                          {balanceFormErrors.opening && (
                            <div className="invalid-feedback">{balanceFormErrors.opening}</div>
                          )}
                        </div>

                        <div className="col-4 col-md-3">
                          <label htmlFor="accruedInput" className="form-label small fw-bold mb-1">
                            Accrued Days
                          </label>
                          <input
                            id="accruedInput"
                            type="number"
                            min="0"
                            step="0.5"
                            className={`form-control form-control-sm ${balanceFormErrors.accrued ? "is-invalid" : ""}`}
                            value={newAccrued}
                            onChange={(e) => setNewAccrued(e.target.value)}
                            data-help="staff_directory.balance_accrued"
                          />
                          {balanceFormErrors.accrued && (
                            <div className="invalid-feedback">{balanceFormErrors.accrued}</div>
                          )}
                        </div>

                        <div className="col-4 col-md-3">
                          <label htmlFor="carriedInput" className="form-label small fw-bold mb-1">
                            Carried Forward
                          </label>
                          <input
                            id="carriedInput"
                            type="number"
                            min="0"
                            step="0.5"
                            className={`form-control form-control-sm ${balanceFormErrors.carried_forward ? "is-invalid" : ""}`}
                            value={newCarried}
                            onChange={(e) => setNewCarried(e.target.value)}
                            data-help="staff_directory.balance_carried"
                          />
                          {balanceFormErrors.carried_forward && (
                            <div className="invalid-feedback">{balanceFormErrors.carried_forward}</div>
                          )}
                        </div>

                        <div className="col-12 text-end mt-3">
                          <button
                            type="submit"
                            className="btn btn-sm btn-primary"
                            disabled={submittingBalance}
                            data-help="staff_directory.set_balance"
                          >
                            {submittingBalance ? "Saving Allowance..." : "Save Leave Allowance"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={closeLeaveModal}
                  disabled={submittingBalance}
                  data-help="staff_directory.leave_modal.close_btn"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StaffDirectory;
