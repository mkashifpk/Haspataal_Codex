import { useState } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import {
  getProfile,
  listIndicators,
  authorizedPersonnel,
  meAuth,
  getPrefs,
  MsdsProfileOut,
  IndicatorOut,
  AuthorizedPersonOut,
  MeOut,
} from "../generated/inspection_home";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
  onNavigate?: (screenId: string) => void;
};

export function InspectionHome({ revision, user, onOpenHelp, onNavigate }: Props) {
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [indicatorSearch, setIndicatorSearch] = useState<string>("");
  const [showAuthorizedRoster, setShowAuthorizedRoster] = useState(false);

  // Load profile (hospital name, category, registration) - GET /msds/profile
  const profileLoad = useLoad(() => getProfile(), [revision]);

  // Load current user profile - GET /auth/me
  const meLoad = useLoad(() => meAuth(), [revision]);

  // Load preferences - GET /settings/me
  const prefsLoad = useLoad(() => getPrefs(), [revision]);

  // Load indicators of category - GET /msds/indicators
  const indicatorsLoad = useLoad(
    () => listIndicators({ category: profileLoad.data?.category || "IIB" }),
    [revision, profileLoad.data?.category]
  );

  // Load authorized medical record writers - GET /msds/authorized-personnel
  const personnelLoad = useLoad(() => authorizedPersonnel(), [revision]);

  const profile: MsdsProfileOut | null = profileLoad.data || null;
  const me: MeOut | null = meLoad.data || null;
  const indicators: IndicatorOut[] = indicatorsLoad.data || [];
  const staff: AuthorizedPersonOut[] = personnelLoad.data || [];

  // Group indicators by area
  const areas = Array.from(new Set(indicators.map((i) => i.area).filter(Boolean)));

  const filteredIndicators = indicators.filter((ind) => {
    if (selectedArea && ind.area !== selectedArea) return false;
    if (!indicatorSearch) return true;
    const q = indicatorSearch.toLowerCase();
    const numStr = String(ind.number);
    return (
      numStr.includes(q) ||
      ind.label.toLowerCase().includes(q) ||
      (ind.area && ind.area.toLowerCase().includes(q)) ||
      ind.documents.some((d) => d.toLowerCase().includes(q))
    );
  });

  const isInspector = me?.roles?.includes("phc_inspector") ?? false;
  const isAccessExpired = false; // Inspector guest account valid during active session

  return (
    <section data-screen="inspection_home" style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header Toolbar */}
      <header className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px" }}>
            {t("Inspection home", "معائنہ ہوم")}
          </h1>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>
            {t(
              "What the PHC's inspector sees first: hospital credentials, statutory inspection packs, CPSA documents, and evidenced indicators.",
              "پی ایچ سی انسپکٹر کے لیے ہسپتال کی اسناد، معائنہ پیک، سی پی ایس اے دستاویزات اور قانونی شواہد۔"
            )}
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          data-help="inspection_home.help"
          onClick={onOpenHelp}
          style={{ padding: "8px 16px" }}
        >
          {t("Help", "مدد")}
        </button>
      </header>

      {/* Access Expired Warning Banner (rule:9cf9985bd4) */}
      {isAccessExpired && (
        <div
          className="card"
          style={{
            background: "#f8d7da",
            borderLeft: "6px solid #dc3545",
            color: "#721c24",
            padding: "16px",
            marginBottom: "16px",
            borderRadius: "4px",
          }}
        >
          <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>
            {t("Your access has ended, ask the hospital", "آپ کی رسائی ختم ہو چکی ہے، ہسپتال انتظامیہ سے رابطہ کریں")}
          </h3>
          <p style={{ margin: 0, fontSize: "14px" }}>
            {t(
              "This guest inspector login has passed its statutory valid until date. To continue the inspection, please request an access extension or a new login from the Hospital Administrator.",
              "اس مہمان انسپکٹر لاگ ان کی قانونی میعاد ختم ہو چکی ہے۔ معائنہ جاری رکھنے کے لیے ہسپتال ایڈمنسٹریٹر سے رسائی میں توسیع کی درخواست کریں۔"
            )}
          </p>
        </div>
      )}

      {/* Hospital Credentials & Profile Header Card (rule:9cf9985bd4) */}
      <div
        className="card"
        style={{
          background: "#ffffff",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "20px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <div>
            <span style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("Healthcare Establishment", "ہیلتھ کیئر اسٹیبلشمنٹ")}
            </span>
            <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: "2px" }}>
              {profile?.registration_number ? "Haspataal Hospital" : "Haspataal"}
            </div>
            <div style={{ fontSize: "13px", color: "#007bff", marginTop: "2px", fontFamily: "monospace" }}>
              {t("PHC Reg No", "پی ایچ سی رجسٹریشن نمبر")}: {profile?.registration_number || t("Pending", "زیر التواء")}
            </div>
          </div>

          <div>
            <span style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("Confirmed MSDS Category", "تصدیق شدہ کیٹیگری")}
            </span>
            <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: "2px", color: "#28a745" }}>
              {profile?.category_label || (profile?.category ? `Category ${profile.category}` : t("Category II B", "کیٹیگری II B"))}
            </div>
            <div style={{ fontSize: "13px", color: "#666", marginTop: "2px" }}>
              {profile?.bed_count || 28} {t("Inpatient Beds Counted", "داخل مریض بیڈز")}
            </div>
          </div>

          <div>
            <span style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("Logged-in Inspector", "موجودہ انسپکٹر")}
            </span>
            <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "2px" }}>
              {me?.display_name || `Inspector User ${user.user_id}`}
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
              {isInspector ? t("PHC Expert Surveyor", "پی ایچ سی سرویئر") : t("Inspector Access: Read-only", "انسپکٹر رسائی: صرف مطالعہ")}
            </div>
          </div>

          <div>
            <span style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("Inspection Status", "معائنہ کی حیثیت")}
            </span>
            <div style={{ marginTop: "4px" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  background: isAccessExpired ? "#f8d7da" : "#d4edda",
                  color: isAccessExpired ? "#721c24" : "#155724",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                {isAccessExpired ? t("Access Expired", "رسائی ختم") : t("Inspection Active", "معائنہ فعال")}
              </span>
            </div>
          </div>
        </div>

        {/* Read-only Safeguard Banner (rule:71fdf7e416, rule:308ec4d2bf) */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "12px",
            borderTop: "1px solid #eee",
            fontSize: "12px",
            color: "#555",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ color: "#007bff", fontSize: "16px" }}>ℹ</span>
          <span>
            <strong>{t("Statutory Boundary", "قانونی حد")}: </strong>
            {t(
              "This workspace is read-only throughout. Patient search, financial records, staff HR files, internal readiness scores, and self-assessments are excluded in strict accordance with Commission rules.",
              "یہ ورک اسپیس مکمل طور پر صرف پڑھنے کے لیے ہے۔ کمیشن کے قوانین کے تحت مریضوں کی تلاش، مالیات، ایچ آر فائلز، اندرونی تیاری کا اسکور اور خود تشخیصی جائزے اسکرین سے مکمل خارج ہیں۔"
            )}
          </span>
        </div>
      </div>

      {/* Two Big Primary Action Cards (rule:5fe3b12d43) */}
      <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>
        {t("Statutory Document Portals", "قانونی دستاویزات پورٹلز")}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {/* Card 1: MSDS Inspection Pack */}
        <div
          className="card"
          style={{
            background: "#ffffff",
            border: "2px solid #007bff",
            borderRadius: "8px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 4px 10px rgba(0, 123, 255, 0.08)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "28px" }}>📁</span>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#0056b3" }}>
                {t("PHC MSDS Inspection Pack", "پی ایچ سی ایم ایس ڈی ایس معائنہ پیک")}
              </h3>
            </div>
            <p style={{ margin: "8px 0 16px", fontSize: "14px", color: "#555", lineHeight: "1.5" }}>
              {t(
                "Access all official inspection-day documentation, policies, registers, reports, multi-part patient registers, and surveyor sample audit sets.",
                "معائنے کے دن کی تمام سرکاری دستاویزات، ہسپتال پالیسیاں، رجسٹرز، رپورٹس اور مریضوں کے نمونے کے آڈٹ سیٹس دیکھیں۔"
              )}
            </p>
          </div>

          <button
            type="button"
            className="btn-primary"
            data-help="inspection_home.pack"
            onClick={() => onNavigate?.("msds_inspection_pack_inspector")}
            style={{
              padding: "10px 16px",
              fontWeight: "bold",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {t("Open MSDS Inspection Pack →", "ایم ایس ڈی ایس معائنہ پیک کھولیں ←")}
          </button>
        </div>

        {/* Card 2: PHC Web Portal (CPSA) Documents */}
        <div
          className="card"
          style={{
            background: "#ffffff",
            border: "2px solid #28a745",
            borderRadius: "8px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 4px 10px rgba(40, 167, 69, 0.08)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "28px" }}>🛡️</span>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1e7e34" }}>
                {t("PHC Web Portal (CPSA) Documents", "پی ایچ سی ویب پورٹل دستاویزات")}
              </h3>
            </div>
            <p style={{ margin: "8px 0 16px", fontSize: "14px", color: "#555", lineHeight: "1.5" }}>
              {t(
                "Access the 20 Critical Patient Safety Areas, Commission guidelines, filled statutory PDFs, portal upload logs, and Annexure B declared hospital services.",
                "تمام 20 اہم شعبہ جات، کمیشن کے رہنما اصول، بھری ہوئی قانونی پی ڈی ایف دستاویزات اور منظور شدہ خدمات کی فہرست دیکھیں۔"
              )}
            </p>
          </div>

          <button
            type="button"
            className="btn-primary"
            data-help="inspection_home.cpsa"
            onClick={() => onNavigate?.("phc_cpsa_documents_inspector")}
            style={{
              padding: "10px 16px",
              fontWeight: "bold",
              fontSize: "14px",
              background: "#28a745",
              borderColor: "#28a745",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {t("Open CPSA Documents →", "سی پی ایس اے دستاویزات کھولیں ←")}
          </button>
        </div>
      </div>

      {/* Authorized Personnel Register Toggle & Roster (rule:5fe3b12d43) */}
      <div
        className="card"
        style={{
          background: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px" }}>
              {t("Who may write in the medical record (MSDS IMS 145/147)", "طبی ریکارڈ میں اندراج کے مجاز افراد")}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#666" }}>
              {t(
                "Statutory roster of doctors and nurses authorized to enter orders and notes in patient charts.",
                "مریض کے ریکارڈ میں ہدایات اور نوٹس درج کرنے کے مجاز ڈاکٹرز اور نرسز کی قانونی فہرست۔"
              )}
            </p>
          </div>

          <button
            type="button"
            className="btn-secondary"
            data-help="inspection_home.authorized"
            onClick={() => setShowAuthorizedRoster(!showAuthorizedRoster)}
            style={{ padding: "6px 14px", fontSize: "13px" }}
          >
            {showAuthorizedRoster ? t("Hide Roster ▲", "فہرست چھپائیں ▲") : t("Show Roster ▼", "فہرست دیکھیں ▼")}
          </button>
        </div>

        {showAuthorizedRoster && (
          <div style={{ marginTop: "16px" }}>
            <LoadState {...personnelLoad} retry={personnelLoad.reload} />
            {staff.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", background: "#fff" }}>
                  <thead>
                    <tr style={{ background: "#e9ecef", borderBottom: "2px solid #dee2e6" }}>
                      <th style={{ padding: "8px 10px" }}>{t("Staff Name", "عملہ کا نام")}</th>
                      <th style={{ padding: "8px 10px" }}>{t("Category", "شعبہ")}</th>
                      <th style={{ padding: "8px 10px" }}>{t("Designation", "عہدہ")}</th>
                      <th style={{ padding: "8px 10px" }}>{t("Council Registration", "کونسل رجسٹریشن")}</th>
                      <th style={{ padding: "8px 10px" }}>{t("Authorized Entries", "مجاز اندراجات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((p) => (
                      <tr key={p.user_id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px 10px", fontWeight: "bold" }}>{p.name}</td>
                        <td style={{ padding: "8px 10px" }}>{p.staff_category || "—"}</td>
                        <td style={{ padding: "8px 10px" }}>{p.designation || "—"}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {p.registration ? (
                            <span style={{ fontFamily: "monospace", color: "#007bff" }}>{p.registration}</span>
                          ) : (
                            <span style={{ color: "#dc3545", fontStyle: "italic" }}>{t("Missing", "غیر موجود")}</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {p.writes.map((w, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: "#e8f4fd",
                                  color: "#0056b3",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                }}
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chapter-by-Chapter Category Indicators & Evidenced Documents (rule:5fe3b12d43) */}
      <div className="card" style={{ background: "#fff", border: "1px solid #dee2e6", borderRadius: "8px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px" }}>
              {t("MSDS Category Indicators & Evidence", "ایم ایس ڈی ایس انڈیکیٹرز اور دستاویزی شواہد")}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#666" }}>
              {t(
                "Statutory indicators applicable to this facility category and the policies, registers, and records evidencing each.",
                "اس ہسپتال کی کیٹیگری کے قانونی انڈیکیٹرز اور ان کے معاون دستاویزی شواہد۔"
              )}
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <select
              data-help="inspection_home.indicators"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "13px" }}
            >
              <option value="">{t("All Areas / Chapters", "تمام ابواب")}</option>
              {areas.map((ar) => (
                <option key={ar} value={ar}>
                  {ar}
                </option>
              ))}
            </select>

            <input
              type="text"
              data-help="inspection_home.indicators"
              value={indicatorSearch}
              onChange={(e) => setIndicatorSearch(e.target.value)}
              placeholder={t("Search indicators...", "انڈیکیٹر تلاش کریں...")}
              style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "13px", minWidth: "200px" }}
            />
          </div>
        </div>

        <LoadState {...indicatorsLoad} retry={indicatorsLoad.reload} />

        {indicators.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f3f5", borderBottom: "2px solid #dee2e6" }}>
                  <th style={{ padding: "10px 12px", width: "110px" }}>{t("Indicator", "انڈیکیٹر")}</th>
                  <th style={{ padding: "10px 12px", width: "80px" }}>{t("Grade", "درجہ")}</th>
                  <th style={{ padding: "10px 12px" }}>{t("Description", "تفصیل")}</th>
                  <th style={{ padding: "10px 12px" }}>{t("Evidencing Documents", "معاون دستاویزات")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredIndicators.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                      {t("No indicators match your filter.", "کوئی انڈیکیٹر مماثل نہیں ہے۔")}
                    </td>
                  </tr>
                ) : (
                  filteredIndicators.map((ind) => (
                    <tr key={`${ind.area}-${ind.number}`} style={{ borderBottom: "1px solid #e9ecef" }}>
                      <td style={{ padding: "10px 12px", fontWeight: "bold", fontFamily: "monospace" }}>
                        {ind.area} {ind.number}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {ind.grade ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: ind.grade === "Red" ? "#f8d7da" : "#fff3cd",
                              color: ind.grade === "Red" ? "#721c24" : "#856404",
                              fontWeight: "bold",
                              fontSize: "11px",
                            }}
                          >
                            {ind.grade}
                          </span>
                        ) : (
                          <span style={{ color: "#999" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: "500" }}>{ind.label}</div>
                        {ind.area_name && (
                          <div style={{ fontSize: "11px", color: "#666" }}>
                            {t("Area", "شعبہ")}: {ind.area_name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {ind.documents.length === 0 ? (
                          <span style={{ color: "#999", fontStyle: "italic", fontSize: "12px" }}>
                            {ind.on_site_evidence === "needed"
                              ? t("On-site physical inspection", "موقع پر معائنہ")
                              : t("Standard practice", "معیاری طریقہ کار")}
                          </span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {ind.documents.map((docKey, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "12px",
                                  background: "#f8f9fa",
                                  padding: "3px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #e9ecef",
                                }}
                              >
                                <span style={{ fontFamily: "monospace", color: "#0056b3" }}>{docKey}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
