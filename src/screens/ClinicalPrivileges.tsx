import React, { useEffect, useState, useMemo, useCallback } from "react";
import { bilingual as t } from "../i18n";
import type { EstablishmentOut } from "../generated/facility_profile";
import type { ClinicalUser } from "../clinical-privileges-policy";
import type {
  ClinicalPrivilegeOut,
  PrivilegeGrantIn,
  PrivilegeUpdateIn,
  PrivilegeRevokeIn,
  EmployeeSearchItemOut,
} from "../generated/clinical_privileges";
import {
  listPrivileges,
  grantPrivilege,
  updatePrivilege,
  revokePrivilege,
  searchHrEmployees,
  theatrePolicyPdf,
} from "../generated/clinical_privileges";
import {
  evaluateClinicalPrivilegesView,
  canManagePrivileges,
  canViewPrivileges,
  canSearchEmployees,
  canViewTheatrePolicy,
  getPrivilegeStatus,
  validateGrantInput,
  validateUpdateInput,
  validateRevokeInput,
  explainClinicalPrivilegesError,
  PRIVILEGE_LABELS,
  type PrivilegeType,
} from "../clinical-privileges-policy";

export interface ClinicalPrivilegesProps {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigateScreen?: (screen: string) => void;
  onBack?: () => void;
}

export function ClinicalPrivileges({
  user,
  establishment,
  connected = true,
  stream,
  timeZone,
  onNavigateScreen,
  onBack,
}: ClinicalPrivilegesProps) {
  // Service view capability
  const viewInfo = useMemo(() => evaluateClinicalPrivilegesView(establishment), [establishment]);
  const userCanManage = useMemo(() => canManagePrivileges(user), [user]);
  const userCanView = useMemo(() => canViewPrivileges(user), [user]);
  const userCanSearchEmployees = useMemo(() => canSearchEmployees(user), [user]);
  const userCanViewPolicy = useMemo(() => canViewTheatrePolicy(user), [user]);

  // Main state
  const [privileges, setPrivileges] = useState<ClinicalPrivilegeOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<{ en: string; ur: string; actionEn?: string; actionUr?: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterPrivilege, setFilterPrivilege] = useState<string>("");
  const [includeRevoked, setIncludeRevoked] = useState<boolean>(false);

  // Selected for detail drawer
  const [selectedPrivilege, setSelectedPrivilege] = useState<ClinicalPrivilegeOut | null>(null);

  // Grant Modal
  const [showGrantModal, setShowGrantModal] = useState<boolean>(false);
  const [grantEmployeeQuery, setGrantEmployeeQuery] = useState<string>("");
  const [employeeSearchResults, setEmployeeSearchResults] = useState<EmployeeSearchItemOut[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchItemOut | null>(null);
  const [grantPrivilegeType, setGrantPrivilegeType] = useState<PrivilegeType>("Surgery");
  const [grantScope, setGrantScope] = useState<string>("");
  const [grantBasis, setGrantBasis] = useState<string>("");
  const [grantValidFrom, setGrantValidFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [grantValidUntil, setGrantValidUntil] = useState<string>("");
  const [grantErrors, setGrantErrors] = useState<Record<string, string>>({});
  const [grantSubmitting, setGrantSubmitting] = useState<boolean>(false);

  // Edit / Renew Modal
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingPrivilege, setEditingPrivilege] = useState<ClinicalPrivilegeOut | null>(null);
  const [editScope, setEditScope] = useState<string>("");
  const [editBasis, setEditBasis] = useState<string>("");
  const [editValidUntil, setEditValidUntil] = useState<string>("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);

  // Revoke Modal
  const [showRevokeModal, setShowRevokeModal] = useState<boolean>(false);
  const [revokingPrivilege, setRevokingPrivilege] = useState<ClinicalPrivilegeOut | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>("");
  const [revokeErrors, setRevokeErrors] = useState<Record<string, string>>({});
  const [revokeSubmitting, setRevokeSubmitting] = useState<boolean>(false);

  // Policy PDF Modal
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [policyLoading, setPolicyLoading] = useState<boolean>(false);

  // Success notifications
  const [successBanner, setSuccessBanner] = useState<{ en: string; ur: string } | null>(null);

  // Load Privileges Register
  const loadRegister = useCallback(async () => {
    if (!userCanView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listPrivileges({
        include_revoked: includeRevoked,
        privilege: filterPrivilege ? (filterPrivilege as PrivilegeType) : undefined,
      });
      setPrivileges(data || []);
    } catch (err: unknown) {
      const explained = explainClinicalPrivilegesError(err);
      setErrorMsg({
        en: explained.message,
        ur: explained.messageUr,
        actionEn: explained.action,
        actionUr: explained.actionUr,
      });
    } finally {
      setLoading(false);
    }
  }, [userCanView, includeRevoked, filterPrivilege]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  // HR Employee Search for Grant Dialog
  useEffect(() => {
    let active = true;
    if (!showGrantModal || !grantEmployeeQuery || grantEmployeeQuery.trim().length < 2) {
      setEmployeeSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchHrEmployees({
          q: grantEmployeeQuery.trim(),
          status: "Active",
          limit: 20,
        });
        if (active) {
          setEmployeeSearchResults(results || []);
        }
      } catch {
        if (active) setEmployeeSearchResults([]);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showGrantModal, grantEmployeeQuery]);

  // Filtered privileges based on client search input
  const filteredPrivileges = useMemo(() => {
    return privileges.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.full_name?.toLowerCase().includes(q);
        const matchesLic = p.license_number?.toLowerCase().includes(q);
        const matchesDesig = p.designation?.toLowerCase().includes(q);
        const matchesScope = p.scope?.toLowerCase().includes(q);
        if (!matchesName && !matchesLic && !matchesDesig && !matchesScope) {
          return false;
        }
      }
      return true;
    });
  }, [privileges, searchQuery]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let revoked = 0;

    for (const p of privileges) {
      const status = getPrivilegeStatus(p);
      if (status.status === "Active") active++;
      else if (status.status === "ExpiringSoon") {
        expiring++;
        active++;
      } else if (status.status === "Expired") expired++;
      else if (status.status === "Revoked") revoked++;
    }

    return { active, expiring, expired, revoked };
  }, [privileges]);

  // Open Grant Modal
  const handleOpenGrantModal = () => {
    setSelectedEmployee(null);
    setGrantEmployeeQuery("");
    setGrantPrivilegeType("Surgery");
    setGrantScope("");
    setGrantBasis("");
    setGrantValidFrom(new Date().toISOString().slice(0, 10));
    setGrantValidUntil("");
    setGrantErrors({});
    setShowGrantModal(true);
  };

  // Submit Grant
  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      setGrantErrors({ employee_id: "Please select an employee." });
      return;
    }

    const payload: PrivilegeGrantIn = {
      employee_id: selectedEmployee.employee_id,
      privilege: grantPrivilegeType,
      scope: grantScope.trim(),
      basis: grantBasis.trim(),
      valid_from: grantValidFrom || null,
      valid_until: grantValidUntil || null,
    };

    const val = validateGrantInput(payload);
    if (!val.valid) {
      setGrantErrors(val.errors);
      return;
    }

    setGrantSubmitting(true);
    setGrantErrors({});
    try {
      await grantPrivilege(payload);
      setShowGrantModal(false);
      setSuccessBanner({
        en: `Privilege "${PRIVILEGE_LABELS[grantPrivilegeType]?.en || grantPrivilegeType}" granted successfully to ${selectedEmployee.full_name}.`,
        ur: `اہلکار ${selectedEmployee.full_name} کو اختیار کامیابی سے جاری کر دیا گیا۔`,
      });
      await loadRegister();
    } catch (err: unknown) {
      const explained = explainClinicalPrivilegesError(err);
      setGrantErrors({
        submit: `${explained.message} (${explained.action})`,
      });
    } finally {
      setGrantSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (p: ClinicalPrivilegeOut) => {
    setEditingPrivilege(p);
    setEditScope(p.scope || "");
    setEditBasis(p.basis || "");
    setEditValidUntil(p.valid_until || "");
    setEditErrors({});
    setShowEditModal(true);
  };

  // Submit Edit / Renew
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrivilege) return;

    const payload: PrivilegeUpdateIn = {
      scope: editScope.trim(),
      basis: editBasis.trim(),
      valid_until: editValidUntil || null,
      expected_version: editingPrivilege.row_version,
    };

    const val = validateUpdateInput(payload);
    if (!val.valid) {
      setEditErrors(val.errors);
      return;
    }

    setEditSubmitting(true);
    setEditErrors({});
    try {
      await updatePrivilege(editingPrivilege.privilege_id, payload);
      setShowEditModal(false);
      setSuccessBanner({
        en: `Privilege updated and renewed successfully for ${editingPrivilege.full_name}.`,
        ur: `اہلکار ${editingPrivilege.full_name} کا اختیار تجدید اور اپ ڈیٹ ہو گیا۔`,
      });
      await loadRegister();
    } catch (err: unknown) {
      const explained = explainClinicalPrivilegesError(err);
      setEditErrors({
        submit: `${explained.message} (${explained.action})`,
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  // Open Revoke Modal
  const handleOpenRevokeModal = (p: ClinicalPrivilegeOut) => {
    setRevokingPrivilege(p);
    setRevokeReason("");
    setRevokeErrors({});
    setShowRevokeModal(true);
  };

  // Submit Revocation
  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingPrivilege) return;

    const payload: PrivilegeRevokeIn = {
      reason: revokeReason.trim(),
    };

    const val = validateRevokeInput(payload);
    if (!val.valid) {
      setRevokeErrors(val.errors);
      return;
    }

    setRevokeSubmitting(true);
    setRevokeErrors({});
    try {
      await revokePrivilege(revokingPrivilege.privilege_id, payload);
      setShowRevokeModal(false);
      setSuccessBanner({
        en: `Privilege revoked for ${revokingPrivilege.full_name}. Their clinical signatures will be refused from now on.`,
        ur: `اہلکار ${revokingPrivilege.full_name} کا اختیار منسوخ کر دیا گیا۔ اب ان کے دستخط قبول نہیں کیے جائیں گے۔`,
      });
      await loadRegister();
    } catch (err: unknown) {
      const explained = explainClinicalPrivilegesError(err);
      setRevokeErrors({
        submit: `${explained.message} (${explained.action})`,
      });
    } finally {
      setRevokeSubmitting(false);
    }
  };

  // View Theatre Policy PDF
  const handleViewPolicy = async () => {
    setShowPolicyModal(true);
    setPolicyLoading(true);
    try {
      await theatrePolicyPdf();
    } catch {
      // Ignored for presentation
    } finally {
      setPolicyLoading(false);
    }
  };

  return (
    <div className="workspace-screen clinical-privileges-screen">
      {/* View capability banner (rule: caf82033b4) */}
      {viewInfo.banner && (
        <div className={`notice notice-${viewInfo.view === "records" ? "info" : "warning"}`} role="alert">
          <strong>{viewInfo.banner}</strong>
        </div>
      )}

      {/* Success banner */}
      {successBanner && (
        <div className="notice notice-success" role="status">
          <p>{t(successBanner.en, successBanner.ur)}</p>
          <button
            type="button"
            className="btn-link"
            onClick={() => setSuccessBanner(null)}
            aria-label="Dismiss success notice"
            data-help="clinical_privileges.dismiss_success"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="notice notice-danger" role="alert">
          <p>
            <strong>{t(errorMsg.en, errorMsg.ur)}</strong>
          </p>
          {errorMsg.actionEn && (
            <p className="notice-subtext">{t(errorMsg.actionEn, errorMsg.actionUr || "")}</p>
          )}
        </div>
      )}

      {/* Screen Header */}
      <div className="screen-header">
        <div className="title-area">
          {onBack && (
            <button
              type="button"
              className="btn btn-secondary back-button"
              onClick={onBack}
              data-help="clinical_privileges.back_button"
            >
              ← {t("Back", "واپس")}
            </button>
          )}
          <h1>{t("Clinical Privileges", "کلینیکل اختیارات")}</h1>
          <p className="subtitle">
            {t(
              "Who may operate, give anaesthesia, assess patients for anaesthesia and discharge them from recovery (MSDS COP 32, 39, 45).",
              "کون سرجری کر سکتا ہے، اینستھیزیا دے سکتا ہے، مریض کا معائنہ کر سکتا ہے اور ریکوری سے فارغ کر سکتا ہے۔"
            )}
          </p>
        </div>

        <div className="header-actions">
          {userCanViewPolicy && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleViewPolicy}
              data-help="clinical_privileges.theatre_policy_button"
            >
              📄 {t("Theatre Policy (PDF)", "تھیٹر پالیسی (پی ڈی ایف)")}
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline"
            onClick={loadRegister}
            disabled={loading}
            data-help="clinical_privileges.refresh_button"
          >
            🔄 {t("Refresh", "تازہ کریں")}
          </button>

          {userCanManage && viewInfo.canCreateNew && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenGrantModal}
              data-help="clinical_privileges.grant_button"
            >
              ➕ {t("Grant Privilege", "نیا اختیار جاری کریں")}
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Tiles */}
      <div className="kpi-grid">
        <button
          type="button"
          className="kpi-card kpi-active"
          onClick={() => { setFilterPrivilege(""); setIncludeRevoked(false); }}
          data-help="clinical_privileges.kpi_active"
        >
          <div className="kpi-value">{kpis.active}</div>
          <div className="kpi-label">{t("Active Grants", "فعال کلینیکل اختیارات")}</div>
        </button>

        <button
          type="button"
          className={`kpi-card ${kpis.expiring > 0 ? "kpi-warning" : "kpi-neutral"}`}
          onClick={() => { setFilterPrivilege(""); setIncludeRevoked(false); }}
          data-help="clinical_privileges.kpi_expiring"
        >
          <div className="kpi-value">{kpis.expiring}</div>
          <div className="kpi-label">
            {t("Expiring within 30 days", "30 دنوں میں ختم ہونے والے")} (Rule fa7737b903)
          </div>
        </button>

        <button
          type="button"
          className="kpi-card kpi-expired"
          onClick={() => { setFilterPrivilege(""); setIncludeRevoked(false); }}
          data-help="clinical_privileges.kpi_expired"
        >
          <div className="kpi-value">{kpis.expired}</div>
          <div className="kpi-label">{t("Expired Grants", "ختم شدہ اختیارات")}</div>
        </button>

        <button
          type="button"
          className="kpi-card kpi-revoked"
          onClick={() => setIncludeRevoked(true)}
          data-help="clinical_privileges.kpi_revoked"
        >
          <div className="kpi-value">{kpis.revoked}</div>
          <div className="kpi-label">{t("Revoked History", "منسوخ شدہ تاریخچہ")}</div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-group">
          <label htmlFor="privilege-search" className="sr-only">
            {t("Search clinician or scope", "ڈاکٹر یا دائرہ کار تلاش کریں")}
          </label>
          <input
            id="privilege-search"
            type="search"
            className="form-control"
            placeholder={t(
              "Search by clinician name, license number, or scope...",
              "ڈاکٹر کے نام، لائسنس نمبر یا دائرہ کار سے تلاش کریں..."
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-help="clinical_privileges.search"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="privilege-category-filter" className="sr-only">
            {t("Privilege Category", "اختیار کی قسم")}
          </label>
          <select
            id="privilege-category-filter"
            className="form-control"
            value={filterPrivilege}
            onChange={(e) => setFilterPrivilege(e.target.value)}
            data-help="clinical_privileges.filter_privilege"
          >
            <option value="">{t("All Privilege Categories", "تمام اختیارات کی اقسام")}</option>
            {Object.keys(PRIVILEGE_LABELS).map((cat) => (
              <option key={cat} value={cat}>
                {PRIVILEGE_LABELS[cat as PrivilegeType].en} - {PRIVILEGE_LABELS[cat as PrivilegeType].ur}
              </option>
            ))}
          </select>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(e) => setIncludeRevoked(e.target.checked)}
              data-help="clinical_privileges.include_revoked"
            />
            {t("Include revoked privileges", "منسوخ شدہ اختیارات بھی دکھائیں")}
          </label>
        </div>
      </div>

      {/* Register List / Table */}
      <div className="register-container">
        {loading ? (
          <div className="loading-state" role="status">
            <div className="spinner" />
            <p>{t("Loading clinical privileges register...", "کلینیکل اختیارات لوڈ ہو رہے ہیں...")}</p>
          </div>
        ) : filteredPrivileges.length === 0 ? (
          <div className="empty-state">
            <p>
              {t(
                "No clinical privileges match the current criteria.",
                "موجودہ معیار پر کوئی کلینیکل اختیار پورا نہیں اترتا۔"
              )}
            </p>
            {userCanManage && viewInfo.canCreateNew && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleOpenGrantModal}
                data-help="clinical_privileges.grant_button"
              >
                ➕ {t("Grant First Privilege", "پہلا اختیار جاری کریں")}
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped table-hover privileges-table">
              <thead>
                <tr>
                  <th>{t("Clinician", "ڈاکٹر / معالج")}</th>
                  <th>{t("Privilege Category", "اختیار کی نوعیت")}</th>
                  <th>{t("Authorized Scope", "مجاز دائرہ کار")}</th>
                  <th>{t("Basis / Committee", "بنیاد و کمیٹی منظوری")}</th>
                  <th>{t("Validity", "میعاد")}</th>
                  <th>{t("Status", "حیثیت")}</th>
                  <th>{t("Actions", "اقدامات")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrivileges.map((p) => {
                  const statusInfo = getPrivilegeStatus(p);
                  const isExpiring = statusInfo.status === "ExpiringSoon";
                  return (
                    <tr
                      key={p.privilege_id}
                      className={`${p.revoked_at ? "row-revoked" : ""} ${isExpiring ? "row-expiring" : ""}`}
                    >
                      <td>
                        <strong>{p.full_name}</strong>
                        <div className="subtext">
                          {p.designation} {p.specialty ? `• ${p.specialty}` : ""}
                        </div>
                        <div className="subtext">
                          {p.license_type || "License"}: <code>{p.license_number || "N/A"}</code>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-category">
                          {PRIVILEGE_LABELS[p.privilege]?.en || p.privilege}
                        </span>
                        <div className="subtext-ur">{PRIVILEGE_LABELS[p.privilege]?.ur || ""}</div>
                      </td>
                      <td className="scope-cell">
                        <div className="scope-text">{p.scope}</div>
                      </td>
                      <td className="basis-cell">
                        <div className="basis-text">{p.basis}</div>
                        <div className="subtext">
                          {t("By", "منجانب")}: {p.granted_by_name} ({p.granted_at?.slice(0, 10)})
                        </div>
                      </td>
                      <td>
                        <div>{t("From", "از")}: {p.valid_from}</div>
                        <div>
                          {t("Until", "تا")}:{" "}
                          {p.valid_until ? (
                            <strong className={isExpiring ? "text-warning" : ""}>
                              {p.valid_until}
                            </strong>
                          ) : (
                            <span className="text-muted">{t("Indefinite", "مستقل")}</span>
                          )}
                        </div>
                        {isExpiring && (
                          <div className="expiring-notice">
                            ⚠️ {t(`Expires in ${statusInfo.daysRemaining}d`, `${statusInfo.daysRemaining} دن میں ختم`)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${statusInfo.badgeClass}`}>
                          {t(statusInfo.label, statusInfo.labelUr)}
                        </span>
                        {p.revoked_at && (
                          <div className="revoked-reason-box" title={p.revoke_reason || ""}>
                            {t("Reason", "وجہ")}: {p.revoke_reason}
                          </div>
                        )}
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setSelectedPrivilege(p)}
                          data-help="clinical_privileges.details_button"
                          title={t("View full privilege details", "مکمل تفصیلات دیکھیں")}
                        >
                          👁️
                        </button>

                        {userCanManage && !viewInfo.isReadOnly && !p.revoked_at && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => handleOpenEditModal(p)}
                              data-help="clinical_privileges.edit_button"
                              title={t("Edit scope or renew validity", "دائرہ کار تبدیل یا تجدید کریں")}
                            >
                              ✏️ {t("Edit / Renew", "تجدید")}
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-danger-outline"
                              onClick={() => handleOpenRevokeModal(p)}
                              data-help="clinical_privileges.revoke_button"
                              title={t("Revoke privilege", "اختیار منسوخ کریں")}
                            >
                              ⛔ {t("Revoke", "منسوخ")}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grant Privilege Modal */}
      {showGrantModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h2>{t("Grant Clinical Privilege", "نیا کلینیکل اختیار جاری کریں")}</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowGrantModal(false)}
                data-help="clinical_privileges.grant_cancel_button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGrantSubmit}>
              <div className="modal-body">
                {grantErrors.submit && (
                  <div className="notice notice-danger" role="alert">
                    {grantErrors.submit}
                  </div>
                )}

                {/* Employee / Clinician Selection */}
                <div className="form-group">
                  <label htmlFor="grant-employee-search">
                    {t("Select Clinician / Employee", "ڈاکٹر / معالج منتخب کریں")}{" "}
                    <span className="required">*</span>
                  </label>
                  {selectedEmployee ? (
                    <div className="selected-employee-card">
                      <div>
                        <strong>{selectedEmployee.full_name}</strong> ({selectedEmployee.designation})
                        <div className="subtext">
                          ID: {selectedEmployee.employee_id} • Staff: {selectedEmployee.staff_category} • {selectedEmployee.department_name || "General"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => setSelectedEmployee(null)}
                        data-help="clinical_privileges.grant_change_employee"
                      >
                        {t("Change", "تبدیل کریں")}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        id="grant-employee-search"
                        type="search"
                        className={`form-control ${grantErrors.employee_id ? "is-invalid" : ""}`}
                        placeholder={t("Type clinician name to search HR records...", "ایچ آر ریکارڈ میں تلاش کے لیے نام درج کریں...")}
                        value={grantEmployeeQuery}
                        onChange={(e) => setGrantEmployeeQuery(e.target.value)}
                        data-help="clinical_privileges.grant_employee_select"
                        autoComplete="off"
                      />
                      {employeeSearchResults.length > 0 && (
                        <ul className="autocomplete-list">
                          {employeeSearchResults.map((emp) => (
                            <li
                              key={emp.employee_id}
                              onClick={() => {
                                setSelectedEmployee(emp);
                                setEmployeeSearchResults([]);
                              }}
                            >
                              <strong>{emp.full_name}</strong> - {emp.designation} ({emp.staff_category})
                            </li>
                          ))}
                        </ul>
                      )}
                      {grantErrors.employee_id && (
                        <div className="invalid-feedback">{grantErrors.employee_id}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Privilege Category */}
                <div className="form-group">
                  <label htmlFor="grant-privilege-type">
                    {t("Privilege Category", "اختیار کی نوعیت")} <span className="required">*</span>
                  </label>
                  <select
                    id="grant-privilege-type"
                    className="form-control"
                    value={grantPrivilegeType}
                    onChange={(e) => setGrantPrivilegeType(e.target.value as PrivilegeType)}
                    data-help="clinical_privileges.grant_privilege_select"
                  >
                    {Object.keys(PRIVILEGE_LABELS).map((cat) => (
                      <option key={cat} value={cat}>
                        {PRIVILEGE_LABELS[cat as PrivilegeType].en} ({PRIVILEGE_LABELS[cat as PrivilegeType].ur})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Authorized Scope of Practice */}
                <div className="form-group">
                  <label htmlFor="grant-scope">
                    {t("Authorized Scope of Practice", "مجاز طبی و جراحی دائرہ کار")}{" "}
                    <span className="required">*</span>
                  </label>
                  <textarea
                    id="grant-scope"
                    rows={3}
                    className={`form-control ${grantErrors.scope ? "is-invalid" : ""}`}
                    placeholder={t(
                      "Specify exact procedures permitted (e.g. Laparoscopic cholecystectomy, open appendectomy, emergency laparotomy)...",
                      "مجاز طریقہ کار کی واضح تفصیل (مثلاً لیپروسکوپک پتے کا آپریشن، اپینڈکس، ہنگامی سرجری)..."
                    )}
                    value={grantScope}
                    onChange={(e) => setGrantScope(e.target.value)}
                    data-help="clinical_privileges.grant_scope_input"
                  />
                  {grantErrors.scope && <div className="invalid-feedback">{grantErrors.scope}</div>}
                </div>

                {/* Basis / Qualifications / Committee Approval */}
                <div className="form-group">
                  <label htmlFor="grant-basis">
                    {t("Basis for Grant (Credentials / Committee Approval)", "منظوری کی بنیاد (اسناد و کریڈینشلز کمیٹی فیصلہ)")}{" "}
                    <span className="required">*</span>
                  </label>
                  <textarea
                    id="grant-basis"
                    rows={2}
                    className={`form-control ${grantErrors.basis ? "is-invalid" : ""}`}
                    placeholder={t(
                      "e.g. FCPS General Surgery (PMDC Verified), Credentials Committee Approval Ref CC-2026-04...",
                      "مثلاً ایف سی پی ایس جنرل سرجری، کریڈینشلز کمیٹی کی منظوری ریفرنس نمبر..."
                    )}
                    value={grantBasis}
                    onChange={(e) => setGrantBasis(e.target.value)}
                    data-help="clinical_privileges.grant_basis_input"
                  />
                  {grantErrors.basis && <div className="invalid-feedback">{grantErrors.basis}</div>}
                </div>

                {/* Date Fields */}
                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label htmlFor="grant-valid-from">
                      {t("Valid From", "نافذ العمل از")}
                    </label>
                    <input
                      id="grant-valid-from"
                      type="date"
                      className="form-control"
                      value={grantValidFrom}
                      onChange={(e) => setGrantValidFrom(e.target.value)}
                      data-help="clinical_privileges.grant_valid_from_input"
                    />
                  </div>

                  <div className="form-group col-md-6">
                    <label htmlFor="grant-valid-until">
                      {t("Valid Until (Annual Review)", "آخری تاریخ (سالانہ جائزہ)")}
                    </label>
                    <input
                      id="grant-valid-until"
                      type="date"
                      className={`form-control ${grantErrors.valid_until ? "is-invalid" : ""}`}
                      value={grantValidUntil}
                      onChange={(e) => setGrantValidUntil(e.target.value)}
                      data-help="clinical_privileges.grant_valid_until_input"
                    />
                    <small className="form-text text-muted">
                      {t("Leave blank for indefinite until revoked.", "خالی چھوڑنے پر منسوخی تک برقرار رہے گا۔")}
                    </small>
                    {grantErrors.valid_until && (
                      <div className="invalid-feedback">{grantErrors.valid_until}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGrantModal(false)}
                  data-help="clinical_privileges.grant_cancel_button"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={grantSubmitting}
                  data-help="clinical_privileges.grant_submit_button"
                >
                  {grantSubmitting ? t("Granting...", "جاری ہو رہا ہے...") : t("Confirm & Grant", "اختیار جاری کریں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Renew Modal */}
      {showEditModal && editingPrivilege && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h2>
                {t("Edit / Renew Clinical Privilege", "کلینیکل اختیار میں ترمیم و تجدید")}:{" "}
                {editingPrivilege.full_name}
              </h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowEditModal(false)}
                data-help="clinical_privileges.edit_cancel_button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {editErrors.submit && (
                  <div className="notice notice-danger" role="alert">
                    {editErrors.submit}
                  </div>
                )}

                <div className="info-box">
                  <strong>{t("Category", "نوعیت")}:</strong> {editingPrivilege.privilege} •{" "}
                  <strong>{t("Granted By", "جاری کنندہ")}:</strong> {editingPrivilege.granted_by_name}
                </div>

                <div className="form-group">
                  <label htmlFor="edit-scope">
                    {t("Authorized Scope of Practice", "مجاز طبی و جراحی دائرہ کار")}
                  </label>
                  <textarea
                    id="edit-scope"
                    rows={3}
                    className={`form-control ${editErrors.scope ? "is-invalid" : ""}`}
                    value={editScope}
                    onChange={(e) => setEditScope(e.target.value)}
                    data-help="clinical_privileges.edit_scope_input"
                  />
                  {editErrors.scope && <div className="invalid-feedback">{editErrors.scope}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="edit-basis">
                    {t("Basis for Grant (Credentials / Committee Approval)", "منظوری کی بنیاد")}
                  </label>
                  <textarea
                    id="edit-basis"
                    rows={2}
                    className={`form-control ${editErrors.basis ? "is-invalid" : ""}`}
                    value={editBasis}
                    onChange={(e) => setEditBasis(e.target.value)}
                    data-help="clinical_privileges.edit_basis_input"
                  />
                  {editErrors.basis && <div className="invalid-feedback">{editErrors.basis}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="edit-valid-until">
                    {t("Extend / Set Valid Until Date", "تجدید کی نئی آخری تاریخ")}
                  </label>
                  <input
                    id="edit-valid-until"
                    type="date"
                    className={`form-control ${editErrors.valid_until ? "is-invalid" : ""}`}
                    value={editValidUntil}
                    onChange={(e) => setEditValidUntil(e.target.value)}
                    data-help="clinical_privileges.edit_valid_until_input"
                  />
                  {editErrors.valid_until && (
                    <div className="invalid-feedback">{editErrors.valid_until}</div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  data-help="clinical_privileges.edit_cancel_button"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSubmitting}
                  data-help="clinical_privileges.edit_submit_button"
                >
                  {editSubmitting ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Changes & Renew", "تبدیلیاں محفوظ و تجدید کریں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Privilege Modal */}
      {showRevokeModal && revokingPrivilege && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{t("Revoke Clinical Privilege", "کلینیکل اختیار کی منسوخی")}</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowRevokeModal(false)}
                data-help="clinical_privileges.revoke_cancel_button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRevokeSubmit}>
              <div className="modal-body">
                <div className="notice notice-danger" role="alert">
                  <strong>{t("Statutory Warning (Rule aedb3bf41a)", "قانونی تنبیہ")}</strong>:{" "}
                  {t(
                    `Revoking ${revokingPrivilege.full_name}'s privilege for ${revokingPrivilege.privilege} is permanent. From this moment onward, any clinical signatures requiring this privilege (such as surgical records, anaesthesia charts, or discharge orders) will be refused by the system.`,
                    `اس اہلکار کے اختیارات منسوخ کرنے کے بعد سسٹم ان کے دستخط شدہ سرجیکل یا اینستھیزیا ریکارڈز کو مسترد کر دے گا۔`
                  )}
                </div>

                {revokeErrors.submit && (
                  <div className="notice notice-danger" role="alert">
                    {revokeErrors.submit}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="revoke-reason">
                    {t("Mandatory Revocation Reason", "منسوخی کی لازمی وجہ")}{" "}
                    <span className="required">*</span>
                  </label>
                  <textarea
                    id="revoke-reason"
                    rows={3}
                    className={`form-control ${revokeErrors.reason ? "is-invalid" : ""}`}
                    placeholder={t(
                      "Explain why this privilege is being revoked (e.g. Resignation, disciplinary action, license expiry, credentials committee review)...",
                      "منسوخی کی تفصیلی وجہ درج کریں (مثلاً استعفیٰ، تادیبی کارروائی، لائسنس کی میعاد ختم)..."
                    )}
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    data-help="clinical_privileges.revoke_reason_input"
                  />
                  {revokeErrors.reason && (
                    <div className="invalid-feedback">{revokeErrors.reason}</div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRevokeModal(false)}
                  data-help="clinical_privileges.revoke_cancel_button"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={revokeSubmitting}
                  data-help="clinical_privileges.revoke_submit_button"
                >
                  {revokeSubmitting ? t("Revoking...", "منسوخ ہو رہا ہے...") : t("Confirm Revocation", "منسوخی کی توثیق کریں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedPrivilege && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h2>{t("Privilege Grant Details", "اختیار کی مکمل تفصیلات")}</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setSelectedPrivilege(null)}
                data-help="clinical_privileges.detail_close_button"
              >
                ✕
              </button>
            </div>

            <div className="modal-body detail-drawer-body">
              <div className="detail-section">
                <h3>{t("Clinician Credentials", "ڈاکٹر کی اسناد و شناخت")}</h3>
                <div className="detail-grid">
                  <div>
                    <label>{t("Full Name", "پورا نام")}</label>
                    <p>{selectedPrivilege.full_name}</p>
                  </div>
                  <div>
                    <label>{t("Designation / Specialty", "عہدہ و شعبہ")}</label>
                    <p>{selectedPrivilege.designation} {selectedPrivilege.specialty ? `(${selectedPrivilege.specialty})` : ""}</p>
                  </div>
                  <div>
                    <label>{t("Professional License", "پیشہ ورانہ لائسنس")}</label>
                    <p>{selectedPrivilege.license_type || "PMDC"}: {selectedPrivilege.license_number || "N/A"}</p>
                  </div>
                  <div>
                    <label>{t("Employee ID", "ملازم کا کوڈ")}</label>
                    <p>{selectedPrivilege.employee_id}</p>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>{t("Privilege & Scope", "اختیار اور مجاز دائرہ کار")}</h3>
                <div className="detail-grid">
                  <div>
                    <label>{t("Privilege Category", "نوعیت")}</label>
                    <p>{PRIVILEGE_LABELS[selectedPrivilege.privilege]?.en || selectedPrivilege.privilege}</p>
                  </div>
                  <div>
                    <label>{t("Validity Period", "میعاد")}</label>
                    <p>{selectedPrivilege.valid_from} {t("to", "تا")} {selectedPrivilege.valid_until || t("Indefinite", "مستقل")}</p>
                  </div>
                  <div className="full-width">
                    <label>{t("Authorized Scope of Practice", "مجاز دائرہ کار")}</label>
                    <p className="pre-wrap">{selectedPrivilege.scope}</p>
                  </div>
                  <div className="full-width">
                    <label>{t("Basis / Committee Reference", "منظوری کی بنیاد و حوالہ")}</label>
                    <p className="pre-wrap">{selectedPrivilege.basis}</p>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>{t("Audit Trail", "آڈٹ ریکارڈ")}</h3>
                <div className="detail-grid">
                  <div>
                    <label>{t("Granted By", "جاری کنندہ")}</label>
                    <p>{selectedPrivilege.granted_by_name} ({selectedPrivilege.granted_at?.slice(0, 19).replace("T", " ")})</p>
                  </div>
                  <div>
                    <label>{t("Record Version", "ریکارڈ ورژن")}</label>
                    <p>{selectedPrivilege.row_version}</p>
                  </div>
                  {selectedPrivilege.revoked_at && (
                    <>
                      <div>
                        <label>{t("Revoked By", "منسوخ کنندہ")}</label>
                        <p>{selectedPrivilege.revoked_by_name} ({selectedPrivilege.revoked_at?.slice(0, 19).replace("T", " ")})</p>
                      </div>
                      <div className="full-width">
                        <label>{t("Revocation Reason", "منسوخی کا سبب")}</label>
                        <p className="text-danger pre-wrap">{selectedPrivilege.revoke_reason}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedPrivilege(null)}
                data-help="clinical_privileges.detail_close_button"
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theatre Policy PDF Modal */}
      {showPolicyModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h2>{t("Theatre Policy Document (PDF)", "آپریشن تھیٹر پالیسی دستاویز")}</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowPolicyModal(false)}
                data-help="clinical_privileges.pdf_modal_close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body pdf-preview-body">
              {policyLoading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>{t("Fetching theatre policy PDF...", "تھیٹر پالیسی حاصل کی جا رہی ہے...")}</p>
                </div>
              ) : (
                <div className="pdf-info-card">
                  <p>
                    {t(
                      "The official hospital Operating Theatre clinical privilege and credentialing policy document is available from the server.",
                      "ہسپتال کی سرکاری آپریشن تھیٹر کلینیکل استحقاق اور کریڈینشلنگ پالیسی دستاویز سرور پر دستیاب ہے۔"
                    )}
                  </p>
                  <p className="subtext">
                    <code>GET /api/v1/ot/theatre-policy/pdf</code> (MSDS COP 32, 39, 45)
                  </p>
                  <div className="pdf-actions">
                    <a
                      href="/api/v1/ot/theatre-policy/pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      data-help="clinical_privileges.pdf_download_link"
                    >
                      📥 {t("Open / Download Theatre Policy PDF", "تھیٹر پالیسی پی ڈی ایف کھولیں / ڈاؤن لوڈ کریں")}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPolicyModal(false)}
                data-help="clinical_privileges.pdf_modal_close"
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ClinicalPrivileges;
