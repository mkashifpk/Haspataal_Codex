import React, { useState } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import {
  listInspectors,
  createInspector,
  revokeInspector,
  inspectorActivity,
  InspectorAccountOut,
  InspectorAccountCreatedOut,
  InspectorActivityOut,
} from "../generated/phc_inspector_accounts";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

const ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  ACCOUNT_EXPIRED: {
    en: "This guest account has expired (the PHC inspector's access ended).",
    ur: "یہ مہمان اکاؤنٹ ختم ہو چکا ہے (پی ایچ سی انسپکٹر کی رسائی کی مدت ختم ہو گئی ہے)۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to do this (requires msds.inspector.manage).",
    ur: "آپ کے پاس اس کارروائی کی اجازت نہیں ہے (msds.inspector.manage درکار ہے)۔",
  },
  INSPECTOR_ACCESS_TOO_LONG: {
    en: "An inspector's access lasts at most the days the setting inspector_access_max_days allows (maximum 30 days).",
    ur: "انسپکٹر کی رسائی زیادہ سے زیادہ سیٹنگ کے مطابق ہو سکتی ہے (زیادہ سے زیادہ 30 دن)۔",
  },
  INSPECTOR_ACCOUNT_EXISTS: {
    en: "This inspector already has a login for these dates (its password was shown once): revoke it to create a new one.",
    ur: "اس انسپکٹر کے پاس پہلے سے ان تاریخوں کا لاگ ان موجود ہے: نیا بنانے کے لیے پرانا منسوخ کریں۔",
  },
  INSPECTOR_ACCOUNT_CLOSED: {
    en: "This inspector account is already revoked or expired.",
    ur: "یہ انسپکٹر اکاؤنٹ پہلے ہی منسوخ یا ختم ہو چکا ہے۔",
  },
  VALIDATION_ERROR: {
    en: "The request is invalid. Please verify all required fields.",
    ur: "درخواست غلط ہے۔ براہ کرم تمام مطلوبہ فیلڈز کی تصدیق کریں۔",
  },
};

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function PhcInspectorAccounts({ revision, user, onOpenHelp, connected }: Props) {
  const [includeClosed, setIncludeClosed] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<InspectorAccountCreatedOut | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InspectorAccountOut | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [activityTarget, setActivityTarget] = useState<InspectorAccountOut | null>(null);
  const [activityData, setActivityData] = useState<InspectorActivityOut | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Form states for New Inspector Login
  const today = formatIsoDate(new Date());
  const defaultUntil = formatIsoDate(new Date(Date.now() + 3 * 86400000)); // 3 days default
  const [formName, setFormName] = useState("");
  const [formDesignation, setFormDesignation] = useState("Expert Surveyor");
  const [formOrg, setFormOrg] = useState("Punjab Healthcare Commission");
  const [formRef, setFormRef] = useState("");
  const [formValidFrom, setFormValidFrom] = useState(today);
  const [formValidUntil, setFormValidUntil] = useState(defaultUntil);
  const [formNote, setFormNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Load inspectors
  const inspectorsLoad = useLoad(
    () => listInspectors({ include_closed: includeClosed }),
    [revision, includeClosed]
  );

  const accounts: InspectorAccountOut[] = inspectorsLoad.data || [];

  const canManage = user.permissions.includes("msds.inspector.manage");

  const activeCount = accounts.filter((a) => a.state === "Active").length;
  const expiredCount = accounts.filter((a) => a.state === "Expired").length;
  const revokedCount = accounts.filter((a) => a.state === "Revoked").length;

  const handleOpenCreate = () => {
    setFormName("");
    setFormDesignation("Expert Surveyor");
    setFormOrg("Punjab Healthcare Commission");
    setFormRef("");
    setFormValidFrom(formatIsoDate(new Date()));
    setFormValidUntil(formatIsoDate(new Date(Date.now() + 3 * 86400000)));
    setFormNote("");
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Inspector name is required.");
      return;
    }
    if (!formValidUntil) {
      setFormError("Valid until date is required.");
      return;
    }

    const fromDate = new Date(formValidFrom || today);
    const untilDate = new Date(formValidUntil);
    const diffDays = Math.ceil((untilDate.getTime() - fromDate.getTime()) / 86400000);

    if (diffDays < 0) {
      setFormError("Valid until date cannot be earlier than valid from date.");
      return;
    }
    if (diffDays > 30) {
      setFormError(
        t(
          "An inspector's access lasts at most 30 days (setting inspector_access_max_days: INSPECTOR_ACCESS_TOO_LONG).",
          "انسپکٹر کی رسائی زیادہ سے زیادہ 30 دن کے لیے ہو سکتی ہے (INSPECTOR_ACCESS_TOO_LONG)۔"
        )
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await createInspector({
        inspector_name: formName.trim(),
        designation: formDesignation.trim() || null,
        organization: formOrg.trim() || "Punjab Healthcare Commission",
        reference: formRef.trim() || null,
        valid_from: formValidFrom || today,
        valid_until: formValidUntil,
        note: formNote.trim() || null,
      });
      setCreateModalOpen(false);
      setCreatedCredentials(res);
      setCopiedPassword(false);
      inspectorsLoad.reload();
    } catch (err: any) {
      const code = err?.code || err?.message || "VALIDATION_ERROR";
      const mapped = ERROR_MESSAGES[code] ? t(ERROR_MESSAGES[code].en, ERROR_MESSAGES[code].ur) : String(err);
      setFormError(mapped);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    if (createdCredentials?.temporary_password) {
      navigator.clipboard?.writeText(createdCredentials.temporary_password);
      setCopiedPassword(true);
    }
  };

  const handleOpenRevoke = (acc: InspectorAccountOut) => {
    setRevokeTarget(acc);
    setRevokeReason("");
    setRevokeError(null);
  };

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTarget) return;
    if (revokeReason.trim().length < 3) {
      setRevokeError("Revocation reason is required (at least 3 characters).");
      return;
    }
    setRevoking(true);
    setRevokeError(null);
    try {
      await revokeInspector(revokeTarget.inspector_account_id, {
        reason: revokeReason.trim(),
      });
      setRevokeTarget(null);
      inspectorsLoad.reload();
    } catch (err: any) {
      const code = err?.code || err?.message || "VALIDATION_ERROR";
      const mapped = ERROR_MESSAGES[code] ? t(ERROR_MESSAGES[code].en, ERROR_MESSAGES[code].ur) : String(err);
      setRevokeError(mapped);
    } finally {
      setRevoking(false);
    }
  };

  const handleOpenActivity = async (acc: InspectorAccountOut) => {
    setActivityTarget(acc);
    setActivityData(null);
    setActivityLoading(true);
    setActivityError(null);
    try {
      const data = await inspectorActivity(acc.inspector_account_id);
      setActivityData(data);
    } catch (err: any) {
      setActivityError(String(err?.message || err));
    } finally {
      setActivityLoading(false);
    }
  };

  const renderStateBadge = (state: InspectorAccountOut["state"]) => {
    let bg = "#6c757d";
    let text = state;
    if (state === "Active") {
      bg = "#28a745";
    } else if (state === "NotYetValid") {
      bg = "#17a2b8";
    } else if (state === "Expired") {
      bg = "#dc3545";
    } else if (state === "Revoked") {
      bg = "#fd7e14";
    }
    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: "4px",
          background: bg,
          color: "#fff",
          fontSize: "12px",
          fontWeight: "bold",
        }}
      >
        {text}
      </span>
    );
  };

  return (
    <section data-screen="phc_inspector_accounts" style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header Toolbar */}
      <header className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px" }}>
            {t("PHC inspectors' logins", "پی ایچ سی انسپکٹرز کے لاگ انز")}
          </h1>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>
            {t(
              "A read-only guest login for each PHC inspector for the days of the inspection, and what each inspector looked at.",
              "معائنے کے ایام کے دوران ہر پی ایچ سی انسپکٹر کے لیے صرف پڑھنے کا لاگ ان اور ان کی سرگرمی کا ریکارڈ۔"
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {canManage && (
            <button
              type="button"
              className="btn-primary"
              data-help="phc_inspector_accounts.create"
              onClick={handleOpenCreate}
              style={{ padding: "8px 16px", fontWeight: "bold" }}
            >
              {t("+ New Inspector Login", "+ نیا انسپکٹر لاگ ان")}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            data-help="phc_inspector_accounts.help"
            onClick={onOpenHelp}
            style={{ padding: "8px 16px" }}
          >
            {t("Help", "مدد")}
          </button>
        </div>
      </header>

      {/* Statutory Guidance Notice (rule:53b35729cc, rule:75483bec77) */}
      <div
        className="card"
        style={{
          background: "#e8f4fd",
          borderLeft: "4px solid #007bff",
          padding: "12px 16px",
          marginBottom: "16px",
          borderRadius: "4px",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>
          <strong>{t("Statutory PHC Inspection Protocol", "پی ایچ سی معائنے کا قانونی ضابطہ")}: </strong>
          {t(
            "Guest inspector accounts provide strictly read-only access to hospital policies, inspection pack documentation, and patient registers. Accounts expire automatically at midnight following the valid until date (at most 30 days). Temporary passwords are shown only once upon creation.",
            "مہمان انسپکٹر اکاؤنٹس ہسپتال کی پالیسیوں، معائنہ پیک اور مریضوں کے رجسٹرز تک صرف پڑھنے کی رسائی فراہم کرتے ہیں۔ اکاؤنٹس مقررہ تاریخ کے بعد خودکار طور پر غیر فعال ہو جاتے ہیں۔ عارضی پاس ورڈ صرف ایک بار دکھایا جاتا ہے۔"
          )}
        </p>
      </div>

      {/* Summary Metrics & Filter Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ background: "#f8f9fa", padding: "8px 12px", borderRadius: "4px", border: "1px solid #ddd" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>{t("Active Accounts", "فعال اکاؤنٹس")}: </span>
            <strong style={{ color: "#28a745", fontSize: "16px" }}>{activeCount}</strong>
          </div>
          <div style={{ background: "#f8f9fa", padding: "8px 12px", borderRadius: "4px", border: "1px solid #ddd" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>{t("Expired", "مدت ختم")}: </span>
            <strong style={{ color: "#dc3545", fontSize: "16px" }}>{expiredCount}</strong>
          </div>
          <div style={{ background: "#f8f9fa", padding: "8px 12px", borderRadius: "4px", border: "1px solid #ddd" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>{t("Revoked", "منسوخ شدہ")}: </span>
            <strong style={{ color: "#fd7e14", fontSize: "16px" }}>{revokedCount}</strong>
          </div>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            data-help="phc_inspector_accounts.filter"
            checked={includeClosed}
            onChange={(e) => setIncludeClosed(e.target.checked)}
          />
          {t("Include closed accounts (Expired / Revoked)", "بند شدہ اکاؤنٹس بھی دکھائیں (منسوخ یا مدت ختم)")}
        </label>
      </div>

      {/* Main Table / Load State */}
      <LoadState {...inspectorsLoad} retry={inspectorsLoad.reload} />

      {inspectorsLoad.data && (
        <div className="card" style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: "4px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f1f3f5", borderBottom: "2px solid #dee2e6" }}>
                <th style={{ padding: "10px 12px" }}>{t("Inspector", "انسپکٹر")}</th>
                <th style={{ padding: "10px 12px" }}>{t("Organization & Letter Ref", "ادارہ اور لیٹر حوالہ")}</th>
                <th style={{ padding: "10px 12px" }}>{t("Validity Window", "رسائی کی مدت")}</th>
                <th style={{ padding: "10px 12px" }}>{t("State", "حالت")}</th>
                <th style={{ padding: "10px 12px" }}>{t("Last Login", "آخری لاگ ان")}</th>
                <th style={{ padding: "10px 12px" }}>{t("Documents Read", "ملاحظہ شدہ دستاویزات")}</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>{t("Actions", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#666" }}>
                    {t(
                      "No inspector accounts found. Create a new inspector login to grant read-only inspection access.",
                      "کوئی انسپکٹر اکاؤنٹ نہیں ملا۔ معائنے کے لیے نیا مہمان لاگ ان بنائیں۔"
                    )}
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.inspector_account_id} style={{ borderBottom: "1px solid #e9ecef" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: "bold" }}>{acc.inspector_name}</div>
                      <div style={{ fontSize: "12px", color: "#007bff", fontFamily: "monospace" }}>
                        {acc.username}
                      </div>
                      {acc.designation && (
                        <div style={{ fontSize: "12px", color: "#666" }}>{acc.designation}</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div>{acc.organization}</div>
                      {acc.reference ? (
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          Ref: {acc.reference}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "#999" }}>—</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div>
                        {acc.valid_from} {t("to", "تا")} {acc.valid_until}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {t("Expires", "میعاد")}: {new Date(acc.expires_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{renderStateBadge(acc.state)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {acc.last_login_at ? (
                        <span style={{ fontSize: "13px" }}>
                          {new Date(acc.last_login_at).toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: "#999", fontStyle: "italic", fontSize: "12px" }}>
                          {t("Never logged in", "کبھی لاگ ان نہیں ہوئے")}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: acc.documents_read > 0 ? "#e3f2fd" : "#f1f3f5",
                          color: acc.documents_read > 0 ? "#0d47a1" : "#495057",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {acc.documents_read} {t("patient records", "مریض ریکارڈز")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          data-help="phc_inspector_accounts.activity"
                          onClick={() => handleOpenActivity(acc)}
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          {t("Activity", "سرگرمی")}
                        </button>
                        {canManage && (acc.state === "Active" || acc.state === "NotYetValid") && (
                          <button
                            type="button"
                            className="btn-danger"
                            data-help="phc_inspector_accounts.revoke"
                            onClick={() => handleOpenRevoke(acc)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "#dc3545",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            {t("Revoke", "منسوخ")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Inspector Login Modal (rule:53b35729cc) */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "540px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>
              {t("Create PHC Inspector Guest Login", "پی ایچ سی انسپکٹر مہمان لاگ ان بنائیں")}
            </h2>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
              {t(
                "Issue a temporary read-only account for the inspection days. The temporary password will be shown ONCE upon creation.",
                "معائنے کے دنوں کے لیے عارضی لاگ ان جاری کریں۔ عارضی پاس ورڈ صرف ایک بار دکھایا جائے گا۔"
              )}
            </p>

            {formError && (
              <div
                style={{
                  background: "#f8d7da",
                  color: "#721c24",
                  padding: "10px 14px",
                  borderRadius: "4px",
                  marginBottom: "16px",
                  fontSize: "14px",
                  border: "1px solid #f5c6cb",
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                  {t("Inspector Name", "انسپکٹر کا نام")} *
                </label>
                <input
                  type="text"
                  required
                  data-help="phc_inspector_accounts.create"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dr. Saima Rauf"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                    {t("Designation", "عہدہ")}
                  </label>
                  <input
                    type="text"
                    data-help="phc_inspector_accounts.create"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    placeholder="e.g. Lead Surveyor"
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                    {t("Organization", "ادارہ")}
                  </label>
                  <input
                    type="text"
                    data-help="phc_inspector_accounts.create"
                    value={formOrg}
                    onChange={(e) => setFormOrg(e.target.value)}
                    placeholder="Punjab Healthcare Commission"
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                  {t("Inspection Letter Reference", "معائنہ لیٹر کا حوالہ")}
                </label>
                <input
                  type="text"
                  data-help="phc_inspector_accounts.create"
                  value={formRef}
                  onChange={(e) => setFormRef(e.target.value)}
                  placeholder="e.g. PHC/INSP/2026/0417"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                    {t("Valid From", "شروع تاریخ")}
                  </label>
                  <input
                    type="date"
                    data-help="phc_inspector_accounts.create"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                    {t("Valid Until (Max 30 days)", "آخری تاریخ (زیادہ سے زیادہ 30 دن)")} *
                  </label>
                  <input
                    type="date"
                    required
                    data-help="phc_inspector_accounts.create"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                  {t("Internal Note", "اندرونی نوٹ")}
                </label>
                <textarea
                  data-help="phc_inspector_accounts.create"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. 3-day regular licensing inspection"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  data-help="phc_inspector_accounts.create"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={submitting}
                  style={{ padding: "8px 16px" }}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  data-help="phc_inspector_accounts.create"
                  disabled={submitting}
                  style={{ padding: "8px 16px", fontWeight: "bold" }}
                >
                  {submitting ? t("Creating...", "بنایا جا رہا ہے...") : t("Create Login", "لاگ ان بنائیں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Reveal Modal (rule:53b35729cc - Shown ONCE) */}
      {createdCredentials && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#d4edda",
                  color: "#28a745",
                  fontSize: "24px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "8px",
                }}
              >
                ✓
              </div>
              <h2 style={{ margin: 0, fontSize: "20px" }}>
                {t("Inspector Login Created", "انسپکٹر لاگ ان تیار ہے")}
              </h2>
            </div>

            <div
              style={{
                background: "#fff3cd",
                border: "1px solid #ffeeba",
                color: "#856404",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              <strong>{t("Hand it to the inspector in person", "انسپکٹر کو ذاتی طور پر فراہم کریں")}: </strong>
              {t(
                "This temporary password is shown ONCE and is never shown again. Only its cryptographic hash is stored on the server.",
                "یہ عارضی پاس ورڈ صرف ایک بار دکھایا جاتا ہے اور دوبارہ کبھی ظاہر نہیں ہوگا۔ سرور پر صرف اس کا ہیش محفوظ ہوتا ہے۔"
              )}
            </div>

            <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "6px", padding: "16px", marginBottom: "16px" }}>
              <div style={{ marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", color: "#666", display: "block" }}>{t("Username", "صارف نام")}</span>
                <span style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: "bold", color: "#007bff" }}>
                  {createdCredentials.username}
                </span>
              </div>

              <div>
                <span style={{ fontSize: "12px", color: "#666", display: "block" }}>
                  {t("Temporary Password (shown once)", "عارضی پاس ورڈ (صرف ایک بار)")}
                </span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                  <code
                    style={{
                      fontFamily: "monospace",
                      fontSize: "18px",
                      background: "#e9ecef",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      letterSpacing: "1px",
                      flex: 1,
                      wordBreak: "break-all",
                    }}
                  >
                    {createdCredentials.temporary_password}
                  </code>
                  <button
                    type="button"
                    className="btn-secondary"
                    data-help="phc_inspector_accounts.create"
                    onClick={handleCopyPassword}
                    style={{ padding: "6px 12px", fontSize: "13px", whiteSpace: "nowrap" }}
                  >
                    {copiedPassword ? t("Copied!", "کاپی ہو گیا!") : t("Copy", "کاپی کریں")}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
              <div>{t("Inspector", "انسپکٹر")}: <strong>{createdCredentials.inspector_name}</strong></div>
              <div>{t("Access valid until", "رسائی کی میعاد")}: <strong>{createdCredentials.valid_until} (midnight)</strong></div>
            </div>

            <button
              type="button"
              className="btn-primary"
              data-help="phc_inspector_accounts.create"
              onClick={() => setCreatedCredentials(null)}
              style={{ width: "100%", padding: "10px", fontWeight: "bold" }}
            >
              {t("I have recorded the credentials", "میں نے تفصیلات نوٹ کر لی ہیں")}
            </button>
          </div>
        </div>
      )}

      {/* Revoke Modal (rule:f33b9f1b16) */}
      {revokeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "20px", color: "#dc3545" }}>
              {t("Revoke Inspector Access", "انسپکٹر رسائی منسوخ کریں")}
            </h2>
            <p style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>
              {t(
                "Revoking access will immediately invalidate all active sessions for this inspector.",
                "رسائی منسوخ کرنے سے اس انسپکٹر کے تمام فعال سیشنز فوری طور پر ختم ہو جائیں گے۔"
              )}
            </p>

            <div style={{ background: "#f8f9fa", padding: "10px 12px", borderRadius: "4px", marginBottom: "16px", fontSize: "13px" }}>
              <div>{t("Inspector", "انسپکٹر")}: <strong>{revokeTarget.inspector_name}</strong></div>
              <div>{t("Username", "صارف نام")}: <code>{revokeTarget.username}</code></div>
            </div>

            {revokeError && (
              <div
                style={{
                  background: "#f8d7da",
                  color: "#721c24",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  marginBottom: "12px",
                  fontSize: "13px",
                }}
              >
                {revokeError}
              </div>
            )}

            <form onSubmit={handleRevokeSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                  {t("Reason for Revocation", "منسوخی کی وجہ")} *
                </label>
                <textarea
                  required
                  data-help="phc_inspector_accounts.revoke"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. The inspection ended a day early"
                  rows={3}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  data-help="phc_inspector_accounts.revoke"
                  onClick={() => setRevokeTarget(null)}
                  disabled={revoking}
                  style={{ padding: "8px 16px" }}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  data-help="phc_inspector_accounts.revoke"
                  disabled={revoking || revokeReason.trim().length < 3}
                  style={{
                    padding: "8px 16px",
                    fontWeight: "bold",
                    background: "#dc3545",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  {revoking ? t("Revoking...", "منسوخ کیا جا رہا ہے...") : t("Confirm Revoke", "منسوخی کی تصدیق کریں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Drawer / Modal (rule:3feef8a897) */}
      {activityTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "700px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>
                {t("Inspector Activity Audit", "انسپکٹر سرگرمی آڈٹ")}
              </h2>
              <button
                type="button"
                className="btn-secondary"
                data-help="phc_inspector_accounts.activity"
                onClick={() => setActivityTarget(null)}
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "#f8f9fa", padding: "10px 14px", borderRadius: "4px", marginBottom: "16px", fontSize: "13px" }}>
              <div>{t("Inspector", "انسپکٹر")}: <strong>{activityTarget.inspector_name}</strong> ({activityTarget.organization})</div>
              <div>{t("Username", "صارف نام")}: <code>{activityTarget.username}</code></div>
              <div>{t("State", "حالت")}: {renderStateBadge(activityTarget.state)}</div>
            </div>

            {activityLoading && (
              <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>
                {t("Loading activity history...", "سرگرمی ہسٹری لوڈ کی جا رہی ہے...")}
              </div>
            )}

            {activityError && (
              <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "4px", marginBottom: "16px" }}>
                {activityError}
              </div>
            )}

            {activityData && (
              <div>
                {/* Section 1: Logins */}
                <h3 style={{ fontSize: "16px", borderBottom: "1px solid #dee2e6", paddingBottom: "6px", marginTop: "16px" }}>
                  {t("Login Attempts", "لاگ ان کی کوششیں")} ({activityData.logins.length})
                </h3>
                {activityData.logins.length === 0 ? (
                  <p style={{ color: "#666", fontSize: "13px", fontStyle: "italic" }}>
                    {t("No login attempts recorded yet.", "ابھی تک کوئی لاگ ان ریکارڈ نہیں ہوا۔")}
                  </p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "16px" }}>
                    <thead>
                      <tr style={{ background: "#f1f3f5" }}>
                        <th style={{ padding: "6px 8px" }}>{t("Time", "وقت")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("IP Address", "آئی پی ایڈریس")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("Status", "حیثیت")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("Notes / Reason", "وجوہات")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityData.logins.map((lg, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "6px 8px" }}>{new Date(lg.at).toLocaleString()}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{lg.ip || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>
                            <span style={{ color: lg.is_success ? "#28a745" : "#dc3545", fontWeight: "bold" }}>
                              {lg.is_success ? t("Success", "کامیاب") : t("Failed", "ناکام")}
                            </span>
                          </td>
                          <td style={{ padding: "6px 8px", color: "#666" }}>{lg.failure_reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Section 2: Patient Documents Downloaded */}
                <h3 style={{ fontSize: "16px", borderBottom: "1px solid #dee2e6", paddingBottom: "6px", marginTop: "20px" }}>
                  {t("Patient Documents Read", "ملاحظہ شدہ مریض دستاویزات")} ({activityData.documents_read.length})
                </h3>
                <p style={{ fontSize: "12px", color: "#666", margin: "4px 0 8px" }}>
                  {t(
                    "The hospital's statutory answer to 'who looked at what' (PHI access audit log).",
                    "قانونی آڈٹ ریکارڈ کہ کس نے کون سا مریض ریکارڈ ملاحظہ کیا۔"
                  )}
                </p>
                {activityData.documents_read.length === 0 ? (
                  <p style={{ color: "#666", fontSize: "13px", fontStyle: "italic" }}>
                    {t("No patient-named documents downloaded yet.", "ابھی تک مریض کا کوئی ریکارڈ ڈاؤن لوڈ نہیں کیا گیا۔")}
                  </p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#f1f3f5" }}>
                        <th style={{ padding: "6px 8px" }}>{t("Time", "وقت")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("Resource", "وسیلہ / دستاویز")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("Resource ID", "شناخت")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("IP Address", "آئی پی ایڈریس")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityData.documents_read.map((doc, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "6px 8px" }}>{new Date(doc.at).toLocaleString()}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{doc.resource}</td>
                          <td style={{ padding: "6px 8px" }}>{doc.resource_id || "—"}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{doc.ip || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button
                type="button"
                className="btn-primary"
                data-help="phc_inspector_accounts.activity"
                onClick={() => setActivityTarget(null)}
                style={{ padding: "8px 16px" }}
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
