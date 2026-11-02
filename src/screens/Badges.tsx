/**
 * Screen 146: badges
 * "Security & staff badges"
 * Workspace: `hr`, Position: 146, Points: 47.
 *
 * Statutory & Quality Rules:
 * - rule:1cc0496368: No RFID hardware? Issue technology 'Barcode' (the server makes the code) and print the ID card again: its payload carries the badge QR in `badge`.
 * - rule:e361c806a1: RFID: read the card's UID with the reader and enter it as badge_code; Biometric: the device's enrolment id.
 * - rule:2906081f38: A lost card: revoke it, then issue a new one.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  getHrEmployees,
  issueBadge,
  revokeBadge,
  idCard,
  type EmployeeDetailOut,
  type EmployeeBadgeOut,
  type IssuedBadgeOut,
  type StaffBadgeOut,
  type IdCardOut,
  type BadgeIn,
  type HrReasonIn,
} from "../generated/badges";
import {
  getBadgesCapabilityView,
  validateBadgeIssueInput,
  validateBadgeRevocationInput,
  BADGES_ERROR_MESSAGES,
  type BadgesCapabilityView,
  type BadgeTechnology,
  type BadgeHolderType,
} from "../badges-policy";
import { ApiError } from "../bridge";

export interface BadgesProps {
  user?: {
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

export const Badges: React.FC<BadgesProps> = ({
  user,
  establishment,
  connected = true,
  onNavigateScreen,
}) => {
  // Capability gating
  const capability: BadgesCapabilityView = useMemo(
    () => getBadgesCapabilityView(establishment),
    [establishment]
  );

  // Selected Employee State
  const [employeeIdInput, setEmployeeIdInput] = useState<string>("1");
  const [employee, setEmployee] = useState<EmployeeDetailOut | null>(null);
  const [loadingEmployee, setLoadingEmployee] = useState<boolean>(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  // Success / Notice Banner State
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Issue Badge Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [issueTech, setIssueTech] = useState<BadgeTechnology>("Barcode");
  const [issueBadgeCode, setIssueBadgeCode] = useState<string>("");
  const [issueHolderType, setIssueHolderType] = useState<BadgeHolderType>("Employee");
  const [issueLabel, setIssueLabel] = useState<string>("");
  const [issueErrors, setIssueErrors] = useState<Record<string, string>>({});
  const [submittingIssue, setSubmittingIssue] = useState<boolean>(false);
  const [lastIssuedBadge, setLastIssuedBadge] = useState<IssuedBadgeOut | null>(null);

  // Revoke Badge Modal State
  const [revokingBadge, setRevokingBadge] = useState<EmployeeBadgeOut | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>("");
  const [revokeErrors, setRevokeErrors] = useState<Record<string, string>>({});
  const [submittingRevoke, setSubmittingRevoke] = useState<boolean>(false);

  // ID Card Preview Modal State
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState<boolean>(false);
  const [idCardData, setIdCardData] = useState<IdCardOut | null>(null);
  const [loadingIdCard, setLoadingIdCard] = useState<boolean>(false);
  const [idCardError, setIdCardError] = useState<string | null>(null);

  // 1. Fetch Employee Profile
  const fetchEmployee = useCallback(async (empId: number) => {
    if (!capability.canViewBadges || isNaN(empId) || empId <= 0) return;
    setLoadingEmployee(true);
    setEmployeeError(null);
    try {
      const data = await getHrEmployees(empId);
      setEmployee(data);
    } catch (err: any) {
      const msg = err instanceof ApiError && err.response.error?.message
        ? err.response.error.message
        : "Failed to retrieve employee record.";
      setEmployeeError(msg);
      setEmployee(null);
    } finally {
      setLoadingEmployee(false);
    }
  }, [capability.canViewBadges]);

  useEffect(() => {
    if (employeeIdInput && !isNaN(Number(employeeIdInput))) {
      fetchEmployee(Number(employeeIdInput));
    }
  }, [fetchEmployee]);

  // 2. Issue Badge Handler
  const handleOpenIssueModal = () => {
    setIsIssueModalOpen(true);
    setIssueTech("Barcode");
    setIssueBadgeCode("");
    setIssueHolderType("Employee");
    setIssueLabel("");
    setIssueErrors({});
    setLastIssuedBadge(null);
  };

  const handleCloseIssueModal = () => {
    setIsIssueModalOpen(false);
    setIssueErrors({});
    setLastIssuedBadge(null);
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    const payload: BadgeIn = {
      technology: issueTech,
      badge_code: issueTech === "Barcode" ? undefined : issueBadgeCode.trim(),
      holder_type: issueHolderType,
      label: issueLabel.trim() || undefined,
    };

    const validation = validateBadgeIssueInput(payload);
    if (!validation.valid) {
      setIssueErrors(validation.errors);
      return;
    }

    setSubmittingIssue(true);
    setIssueErrors({});

    try {
      const issued = await issueBadge(employee.employee_id, payload);
      setLastIssuedBadge(issued);
      setSuccessBanner(`Security badge (${issued.technology}) issued successfully for ${employee.full_name}. Badge Code: ${issued.badge_code}`);
      fetchEmployee(employee.employee_id);
    } catch (err: any) {
      if (err instanceof ApiError) {
        const code = err.response.error?.code || "";
        if (code === "BADGE_CODE_TAKEN") {
          setIssueErrors({ badge_code: BADGES_ERROR_MESSAGES.BADGE_CODE_TAKEN.en });
        } else if (code === "EMPLOYEE_STATUS_INVALID") {
          setIssueErrors({ general: BADGES_ERROR_MESSAGES.EMPLOYEE_STATUS_INVALID.en });
        } else {
          setIssueErrors({ general: err.response.error?.message || "Badge issuance was refused by server." });
        }
      } else {
        setIssueErrors({ general: err?.message || "Network error while issuing badge." });
      }
    } finally {
      setSubmittingIssue(false);
    }
  };

  // 3. Revoke Badge Handler
  const handleOpenRevokeModal = (badge: EmployeeBadgeOut) => {
    setRevokingBadge(badge);
    setRevokeReason("");
    setRevokeErrors({});
  };

  const handleCloseRevokeModal = () => {
    setRevokingBadge(null);
    setRevokeReason("");
    setRevokeErrors({});
  };

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingBadge || !employee) return;

    const payload: HrReasonIn = {
      reason: revokeReason.trim(),
    };

    const validation = validateBadgeRevocationInput(payload);
    if (!validation.valid) {
      setRevokeErrors(validation.errors);
      return;
    }

    setSubmittingRevoke(true);
    setRevokeErrors({});

    try {
      await revokeBadge(revokingBadge.badge_code, payload);
      setSuccessBanner(`Badge ${revokingBadge.badge_code} revoked successfully. Rule rule:2906081f38: Issue a new badge to replace lost/defective credentials.`);
      handleCloseRevokeModal();
      fetchEmployee(employee.employee_id);
    } catch (err: any) {
      if (err instanceof ApiError) {
        const code = err.response.error?.code || "";
        if (code === "BADGE_ALREADY_REVOKED") {
          setRevokeErrors({ reason: BADGES_ERROR_MESSAGES.BADGE_ALREADY_REVOKED.en });
        } else {
          setRevokeErrors({ reason: err.response.error?.message || "Failed to revoke badge." });
        }
      } else {
        setRevokeErrors({ reason: err?.message || "Network error while revoking badge." });
      }
    } finally {
      setSubmittingRevoke(false);
    }
  };

  // 4. ID Card Preview Handler
  const handleOpenIdCardModal = async () => {
    if (!employee) return;
    setIsIdCardModalOpen(true);
    setLoadingIdCard(true);
    setIdCardError(null);
    try {
      const card = await idCard(employee.employee_id);
      setIdCardData(card);
    } catch (err: any) {
      const msg = err instanceof ApiError && err.response.error?.message
        ? err.response.error.message
        : "Failed to load ID card preview payload.";
      setIdCardError(msg);
    } finally {
      setLoadingIdCard(false);
    }
  };

  const handleCloseIdCardModal = () => {
    setIsIdCardModalOpen(false);
    setIdCardData(null);
    setIdCardError(null);
  };

  return (
    <div className="container-fluid p-3 badges-screen" data-help="badges.container">
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
            <span>Security & Staff Badges</span>
            <span className="badge bg-secondary fs-6">§6.1, §6.2</span>
          </h2>
          <div className="text-muted small urdu-text mt-1">
            آر ایف آئی ڈی کارڈز، پرنٹ شدہ بارکوڈ کیو آر بیجز، بائیو میٹرک اور شناختی کارڈ کا انتظام
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => {
              if (employee) fetchEmployee(employee.employee_id);
            }}
            disabled={loadingEmployee || !employee}
            data-help="badges.btn_refresh"
          >
            {loadingEmployee ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="alert alert-success alert-dismissible mb-3" role="alert">
          <strong>Success:</strong> {successBanner}
          <button
            type="button"
            className="btn-close"
            onClick={() => setSuccessBanner(null)}
            aria-label="Dismiss"
            data-help="badges.dismiss_success"
          />
        </div>
      )}

      {/* Employee Lookup Toolbar */}
      <div className="card shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label htmlFor="badgeEmpIdInput" className="form-label small fw-bold mb-1">
                Employee Identifier (Database ID)
              </label>
              <input
                id="badgeEmpIdInput"
                type="number"
                min="1"
                className="form-control form-control-sm"
                placeholder="Enter employee database ID (e.g. 1)"
                value={employeeIdInput}
                onChange={(e) => setEmployeeIdInput(e.target.value)}
                data-help="badges.emp_id_input"
              />
            </div>

            <div className="col-12 col-md-3 d-flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm w-100"
                onClick={() => fetchEmployee(Number(employeeIdInput))}
                disabled={loadingEmployee || !employeeIdInput}
                data-help="badges.load_employee"
              >
                {loadingEmployee ? "Loading..." : "Load Employee"}
              </button>
              {employee && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    setEmployee(null);
                    setEmployeeIdInput("");
                  }}
                  data-help="badges.clear_employee"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Employee Error Alert */}
      {employeeError && (
        <div className="alert alert-danger" role="alert">
          <strong>Error:</strong> {employeeError}
        </div>
      )}

      {/* Selected Employee Summary Card */}
      {employee && (
        <div className="card shadow-sm mb-3 border-start border-4 border-primary">
          <div className="card-body p-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center">
              <div>
                <h5 className="mb-1 text-dark">
                  {employee.full_name}{" "}
                  <span className="badge bg-light text-dark border font-monospace fs-6">
                    {employee.emp_number}
                  </span>
                </h5>
                <div className="text-muted small">
                  <strong>{employee.designation}</strong> &bull; {employee.department_name || "Unassigned"} &bull; CNIC: <span className="font-monospace">{employee.cnic}</span>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
                <span className={`badge bg-${employee.employment_status === "Active" ? "success" : "warning text-dark"} px-2 py-1`}>
                  {employee.employment_status}
                </span>
                <span className="badge bg-secondary">{employee.staff_category}</span>
                <span className="badge bg-outline-dark border">{employee.contract_type}</span>
              </div>
            </div>

            {/* Employment Status Warnings */}
            {employee.employment_status === "Draft" && (
              <div className="alert alert-warning py-2 small mt-3 mb-0">
                <strong>Notice:</strong> This profile is in Draft status. Complete onboarding wizard steps before issuing physical access badges.
              </div>
            )}
            {employee.employment_status === "Suspended" && (
              <div className="alert alert-danger py-2 small mt-3 mb-0">
                <strong>Access Blocked:</strong> Employee is currently Suspended. Active badges are revoked, and new badges cannot be issued until reinstatement.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Badges Directory & Management */}
      {employee && (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-white py-2 d-flex flex-wrap justify-content-between align-items-center">
            <div>
              <strong className="text-dark">Issued Access Badges & Enrolments</strong>
              <span className="badge bg-light text-dark border ms-2">
                {employee.badges?.length || 0} active
              </span>
            </div>

            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
              <button
                type="button"
                className="btn btn-sm btn-outline-info"
                onClick={handleOpenIdCardModal}
                disabled={!capability.canPrintIdCard}
                data-help="badges.btn_print_id_card"
              >
                View / Print ID Card (GET /hr/employees/&#123;id&#125;/id-card)
              </button>

              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleOpenIssueModal}
                disabled={!capability.canIssueBadge || employee.employment_status === "Draft" || employee.employment_status === "Suspended"}
                data-help="badges.btn_open_issue_modal"
              >
                + Issue New Badge (POST /hr/employees/&#123;id&#125;/badges)
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Badge Code / UID</th>
                  <th scope="col">Technology</th>
                  <th scope="col">Holder Type</th>
                  <th scope="col">Label / Notes</th>
                  <th scope="col">Issued At</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!employee.badges || employee.badges.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      No security badges currently issued for this staff member. Use "+ Issue New Badge" above.
                    </td>
                  </tr>
                ) : (
                  employee.badges.map((b) => (
                    <tr key={b.badge_code}>
                      <td>
                        <strong className="font-monospace text-dark">{b.badge_code}</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            b.technology === "RFID"
                              ? "bg-primary"
                              : b.technology === "Barcode"
                              ? "bg-success"
                              : "bg-purple text-dark border"
                          }`}
                        >
                          {b.technology}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{b.holder_type}</span>
                      </td>
                      <td>{b.label || "—"}</td>
                      <td className="small text-muted">{b.issued_at?.slice(0, 10)}</td>
                      <td>
                        <span className="badge bg-success">Active</span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleOpenRevokeModal(b)}
                          disabled={!capability.canRevokeBadge}
                          data-help="badges.btn_revoke"
                          title="Revoke badge per Rule rule:2906081f38"
                        >
                          Revoke Badge
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ISSUE NEW BADGE                                       */}
      {/* ============================================================== */}
      {isIssueModalOpen && employee && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleIssueSubmit}>
                <div className="modal-header bg-light">
                  <h5 className="modal-title mb-0">Issue Staff Security Badge</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleCloseIssueModal}
                    aria-label="Close"
                    disabled={submittingIssue}
                    data-help="badges.issue_modal_close"
                  />
                </div>

                <div className="modal-body p-3">
                  <div className="mb-3">
                    <strong className="text-dark d-block">{employee.full_name}</strong>
                    <small className="text-muted">{employee.emp_number} &bull; {employee.designation}</small>
                  </div>

                  {issueErrors.general && (
                    <div className="alert alert-danger" role="alert">
                      {issueErrors.general}
                    </div>
                  )}

                  {/* Technology Selection */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Select Technology:</label>
                    <div className="list-group">
                      {/* Barcode Option */}
                      <label
                        className={`list-group-item list-group-item-action d-flex align-items-start gap-2 ${
                          issueTech === "Barcode" ? "active" : ""
                        }`}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="radio"
                          name="badgeTechRadio"
                          className="form-check-input my-1"
                          checked={issueTech === "Barcode"}
                          onChange={() => setIssueTech("Barcode")}
                          data-help="badges.tech_barcode"
                        />
                        <div>
                          <div className="fw-bold">Printed Barcode / QR (rule:1cc0496368)</div>
                          <div className="small opacity-75">
                            No RFID hardware needed. Server generates the code, printed on the staff ID card for scanner stations.
                          </div>
                        </div>
                      </label>

                      {/* RFID Option */}
                      <label
                        className={`list-group-item list-group-item-action d-flex align-items-start gap-2 ${
                          issueTech === "RFID" ? "active" : ""
                        }`}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="radio"
                          name="badgeTechRadio"
                          className="form-check-input my-1"
                          checked={issueTech === "RFID"}
                          onChange={() => setIssueTech("RFID")}
                          data-help="badges.tech_rfid"
                        />
                        <div>
                          <div className="fw-bold">Physical RFID Card (rule:e361c806a1)</div>
                          <div className="small opacity-75">
                            Read the card's UID with the USB RFID reader and enter as badge_code.
                          </div>
                        </div>
                      </label>

                      {/* Biometric Option */}
                      <label
                        className={`list-group-item list-group-item-action d-flex align-items-start gap-2 ${
                          issueTech === "Biometric" ? "active" : ""
                        }`}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="radio"
                          name="badgeTechRadio"
                          className="form-check-input my-1"
                          checked={issueTech === "Biometric"}
                          onChange={() => setIssueTech("Biometric")}
                          data-help="badges.tech_biometric"
                        />
                        <div>
                          <div className="fw-bold">Biometric Enrolment (rule:e361c806a1)</div>
                          <div className="small opacity-75">
                            Enter the scanner device's enrolment ID.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Badge Code Input (Disabled for Barcode) */}
                  <div className="mb-3">
                    <label htmlFor="issueBadgeCodeInput" className="form-label small fw-bold">
                      Badge Code / UID {issueTech === "Barcode" ? "(Auto-generated)" : "*"}
                    </label>
                    <input
                      id="issueBadgeCodeInput"
                      type="text"
                      className={`form-control form-control-sm font-monospace ${
                        issueErrors.badge_code ? "is-invalid" : ""
                      }`}
                      placeholder={
                        issueTech === "Barcode"
                          ? "Server generates badge code automatically"
                          : issueTech === "RFID"
                          ? "e.g. E280116060000204... (tap card on reader)"
                          : "e.g. BIO-ENROL-042"
                      }
                      value={issueTech === "Barcode" ? "" : issueBadgeCode}
                      onChange={(e) => setIssueBadgeCode(e.target.value)}
                      disabled={issueTech === "Barcode"}
                      data-help="badges.badge_code_input"
                    />
                    {issueErrors.badge_code && (
                      <div className="invalid-feedback">{issueErrors.badge_code}</div>
                    )}
                  </div>

                  {/* Holder Type Selection */}
                  <div className="mb-3">
                    <label htmlFor="issueHolderTypeSelect" className="form-label small fw-bold">
                      Holder Type
                    </label>
                    <select
                      id="issueHolderTypeSelect"
                      className="form-select form-select-sm"
                      value={issueHolderType}
                      onChange={(e) => setIssueHolderType(e.target.value as any)}
                      data-help="badges.holder_type_select"
                    >
                      <option value="Employee">Employee / ملازم</option>
                      <option value="SupportStaff">Support Staff / معاون عملہ</option>
                      <option value="Sweeper">Sweeper / صفائی کارکن</option>
                      <option value="Janitor">Janitor / چوکیدار</option>
                      <option value="Security">Security / سیکیورٹی</option>
                      <option value="Contractor">Contractor / ٹھیکیدار</option>
                    </select>
                  </div>

                  {/* Optional Label */}
                  <div className="mb-3">
                    <label htmlFor="issueLabelInput" className="form-label small fw-bold">
                      Label / Description (Optional)
                    </label>
                    <input
                      id="issueLabelInput"
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Primary Access Tag, Night Shift Card"
                      value={issueLabel}
                      onChange={(e) => setIssueLabel(e.target.value)}
                      data-help="badges.label_input"
                    />
                  </div>

                  {/* Last Issued Barcode SVG Preview */}
                  {lastIssuedBadge && lastIssuedBadge.qr_svg && (
                    <div className="alert alert-success p-2 small mt-2">
                      <div className="fw-bold mb-1">Generated Badge QR Code:</div>
                      <div
                        className="bg-white p-2 text-center rounded border d-inline-block"
                        dangerouslySetInnerHTML={{ __html: lastIssuedBadge.qr_svg }}
                      />
                      <div className="mt-1 font-monospace">{lastIssuedBadge.badge_code}</div>
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCloseIssueModal}
                    disabled={submittingIssue}
                    data-help="badges.issue_modal_cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submittingIssue}
                    data-help="badges.btn_issue"
                  >
                    {submittingIssue ? "Issuing Badge..." : "Issue Badge"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: REVOKE BADGE                                          */}
      {/* ============================================================== */}
      {revokingBadge && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleRevokeSubmit}>
                <div className="modal-header bg-light">
                  <h5 className="modal-title mb-0">Revoke Access Badge</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleCloseRevokeModal}
                    aria-label="Close"
                    disabled={submittingRevoke}
                    data-help="badges.revoke_modal_close"
                  />
                </div>

                <div className="modal-body p-3">
                  <div className="mb-3">
                    <span className="text-muted small d-block">Revoking Badge:</span>
                    <strong className="font-monospace text-danger fs-6">{revokingBadge.badge_code}</strong>
                    <span className="badge bg-secondary ms-2">{revokingBadge.technology}</span>
                  </div>

                  {/* Statutory Rule Banner: rule:2906081f38 */}
                  <div className="alert alert-warning py-2 small mb-3">
                    <strong>Rule rule:2906081f38:</strong> A lost or damaged card must be revoked first; once revoked, a new badge can be issued to replace it.
                    <div className="urdu-text mt-1">
                      گمشدہ یا خراب کارڈ: پہلے منسوخ کریں، پھر اس کی جگہ نیا کارڈ جاری کریں۔
                    </div>
                  </div>

                  {/* Quick Reason Chips */}
                  <div className="mb-2">
                    <span className="small text-muted d-block mb-1">Quick Select Reason:</span>
                    <div className="d-flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-0"
                        onClick={() => setRevokeReason("Card lost in transit")}
                        data-help="badges.quick_reason_lost"
                      >
                        Lost Card
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-0"
                        onClick={() => setRevokeReason("Damaged RFID chip / unreadable")}
                        data-help="badges.quick_reason_damaged"
                      >
                        Damaged Card
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-0"
                        onClick={() => setRevokeReason("Contract ceased or departed")}
                        data-help="badges.quick_reason_duty"
                      >
                        Duty Ceased
                      </button>
                    </div>
                  </div>

                  {/* Operational Reason Textarea */}
                  <div className="mb-3">
                    <label htmlFor="revokeReasonInput" className="form-label small fw-bold">
                      Operational Justification Reason (Mandatory, min 3 chars) *
                    </label>
                    <textarea
                      id="revokeReasonInput"
                      rows={3}
                      className={`form-control form-control-sm ${
                        revokeErrors.reason ? "is-invalid" : ""
                      }`}
                      placeholder="e.g. Staff reported lost card during ward duty"
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                      data-help="badges.revoke_reason_input"
                    />
                    {revokeErrors.reason && (
                      <div className="invalid-feedback">{revokeErrors.reason}</div>
                    )}
                  </div>
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCloseRevokeModal}
                    disabled={submittingRevoke}
                    data-help="badges.revoke_modal_cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger btn-sm"
                    disabled={submittingRevoke}
                    data-help="badges.btn_revoke_confirm"
                  >
                    {submittingRevoke ? "Revoking Badge..." : "Confirm Revocation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ID CARD PREVIEW & PRINT                               */}
      {/* ============================================================== */}
      {isIdCardModalOpen && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-light">
                <h5 className="modal-title mb-0">Staff ID Card Print Preview</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseIdCardModal}
                  aria-label="Close"
                  data-help="badges.idcard_modal_close"
                />
              </div>

              <div className="modal-body p-4 text-center">
                {idCardError && (
                  <div className="alert alert-danger" role="alert">
                    {idCardError}
                  </div>
                )}

                {loadingIdCard || !idCardData ? (
                  <div className="py-5">
                    <div className="spinner-border text-primary me-2" role="status" />
                    <span>Loading ID card designer payload...</span>
                  </div>
                ) : (
                  <div>
                    {/* CR80 Card Preview Container */}
                    <div
                      className="mx-auto card shadow text-start border-2 border-dark rounded-3 overflow-hidden"
                      style={{
                        width: "400px",
                        minHeight: "240px",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                      }}
                    >
                      {/* Card Header */}
                      <div className="bg-primary text-white p-2 text-center">
                        <div className="fw-bold fs-6 text-uppercase letter-spacing-1">
                          {idCardData.fields?.hospital_name || "HASPATAAL GENERAL HOSPITAL"}
                        </div>
                        <small className="opacity-75">OFFICIAL STAFF IDENTITY CARD</small>
                      </div>

                      {/* Card Body */}
                      <div className="p-3">
                        <div className="row g-2 align-items-center">
                          {/* Photo Placeholder */}
                          <div className="col-4 text-center">
                            <div
                              className="border border-2 border-secondary rounded d-flex align-items-center justify-content-center bg-light"
                              style={{ width: "90px", height: "110px", margin: "0 auto" }}
                            >
                              <span className="text-muted small">Photo</span>
                            </div>
                            <span className="badge bg-danger mt-1">
                              {idCardData.fields?.blood_group || "Blood Group"}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="col-8">
                            <h6 className="mb-0 fw-bold text-dark">{idCardData.fields?.full_name}</h6>
                            <div className="text-primary small fw-semibold">{idCardData.fields?.designation}</div>
                            <div className="text-muted small">{idCardData.fields?.department || "Department"}</div>
                            <div className="mt-2 small">
                              <div>Emp #: <strong className="font-monospace">{idCardData.fields?.emp_number}</strong></div>
                              {idCardData.fields?.license && (
                                <div>Licence: <span className="font-monospace">{idCardData.fields.license}</span></div>
                              )}
                              <div>Joined: {idCardData.fields?.joined_on || "—"}</div>
                            </div>
                          </div>
                        </div>

                        {/* Barcode / QR Codes Footer */}
                        <div className="border-top mt-3 pt-2 d-flex justify-content-between align-items-center">
                          {/* Barcode SVG */}
                          {idCardData.barcode_svg && (
                            <div
                              className="overflow-hidden"
                              style={{ maxHeight: "40px" }}
                              dangerouslySetInnerHTML={{ __html: idCardData.barcode_svg }}
                            />
                          )}

                          {/* QR SVG */}
                          {idCardData.qr_svg && (
                            <div
                              style={{ width: "40px", height: "40px" }}
                              dangerouslySetInnerHTML={{ __html: idCardData.qr_svg }}
                            />
                          )}
                        </div>

                        {/* Printed Badge QR (if issued per rule:1cc0496368) */}
                        {idCardData.badge && (
                          <div className="alert alert-success py-1 px-2 mt-2 mb-0 small text-center">
                            <strong className="d-block">Access QR Badge (rule:1cc0496368)</strong>
                            <div
                              className="d-inline-block bg-white p-1 rounded border mt-1"
                              style={{ width: "60px", height: "60px" }}
                              dangerouslySetInnerHTML={{ __html: idCardData.badge.qr_svg }}
                            />
                            <div className="font-monospace mt-1">{idCardData.badge.badge_code}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-muted small mt-3">
                      Dimensions: {idCardData.card_size_mm?.[0]}mm x {idCardData.card_size_mm?.[1]}mm (CR80 Standard Card) &bull; Role: {idCardData.printer_role}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCloseIdCardModal}
                  data-help="badges.idcard_modal_dismiss"
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => window.print()}
                  disabled={loadingIdCard || !idCardData}
                  data-help="badges.idcard_print_action"
                >
                  Print to Card Printer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Badges;
