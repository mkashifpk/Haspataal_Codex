import { useState } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import { QualityPaper } from "./QualityPaper";
import {
  authorizedPersonnel,
  AuthorizedPersonOut,
} from "../generated/msds_authorized_personnel";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

export function MsdsAuthorizedPersonnel({ revision, onOpenHelp, connected }: Props) {
  const staff = useLoad(() => authorizedPersonnel(), [revision]);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [missingRegOnly, setMissingRegOnly] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<AuthorizedPersonOut | null>(null);

  const items: AuthorizedPersonOut[] = staff.data || [];

  const missingRegCount = items.filter((p) => p.clinical && !p.registration).length;
  const clinicalCount = items.filter((p) => p.clinical).length;
  const nursingCount = items.filter((p) => p.staff_category === "Nursing").length;

  const filteredItems = items.filter((p) => {
    if (categoryFilter && p.staff_category !== categoryFilter) return false;
    if (missingRegOnly && (!p.clinical || !!p.registration)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.designation && p.designation.toLowerCase().includes(q)) ||
      (p.department_name && p.department_name.toLowerCase().includes(q)) ||
      (p.registration && p.registration.toLowerCase().includes(q)) ||
      p.writes.some((w) => w.toLowerCase().includes(q))
    );
  });

  return (
    <section data-screen="msds_authorized_personnel">
      <header className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{t("Who may write in the medical record", "طبی ریکارڈ میں لکھنے کے مجاز افراد")}</h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <QualityPaper
            disabled={!connected}
            documents={[
              {
                label: t("Authorized Personnel Register (PDF)", "مجاز افراد کا رجسٹر پی ڈی ایف"),
                path: "/msds/inspection-pack/documents/authorized_personnel/pdf",
              },
              {
                label: t("IMS Policy (PDF)", "آئی ایم ایس پالیسی پی ڈی ایف"),
                path: "/msds/inspection-pack/documents/ims_policy/pdf",
              },
            ]}
          />
          <button type="button" data-help="msds_authorized_personnel.help" onClick={onOpenHelp}>
            {t("Help", "مدد")}
          </button>
        </div>
      </header>

      {/* Statutory context banner (rule:22e29ef97e) */}
      <div className="card" style={{ background: "#f8f9fa", padding: "12px", marginBottom: "16px", borderLeft: "4px solid #007bff" }}>
        <p style={{ margin: 0 }}>
          <strong>{t("MSDS IMS 145 & 147 Statutory Roster", "پنجاب ہیلتھ کمیشن کا لازمی ضابطہ")}: </strong>
          {t(
            "The authorization to write entries into patient medical records is strictly enforced from active server permissions and role mappings. Clinicians must possess valid professional council registration on file.",
            "مریض کے طبی ریکارڈ میں اندراج کی اجازت ہسپتال سرور کی فعال اجازتوں اور کردار سے متعین ہوتی ہے۔ معالجین کا باضابطہ رجسٹریشن نمبر ایچ آر میں درج ہونا لازمی ہے۔"
          )}
        </p>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <article className="card" style={{ textAlign: "center", padding: "12px" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: "bold" }}>{items.length}</div>
          <div style={{ color: "#666" }}>{t("Total Authorized Staff", "کل مجاز عملہ")}</div>
        </article>

        <article className="card" style={{ textAlign: "center", padding: "12px" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#007bff" }}>{clinicalCount}</div>
          <div style={{ color: "#666" }}>{t("Clinicians / Doctors", "ڈاکٹرز اور معالجین")}</div>
        </article>

        <article className="card" style={{ textAlign: "center", padding: "12px" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#28a745" }}>{nursingCount}</div>
          <div style={{ color: "#666" }}>{t("Nursing Staff", "نرسنگ عملہ")}</div>
        </article>

        <article
          className="card"
          style={{
            textAlign: "center",
            padding: "12px",
            borderColor: missingRegCount > 0 ? "var(--color-danger, #d9534f)" : "var(--color-border, #ddd)",
          }}
        >
          <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: missingRegCount > 0 ? "#d9534f" : "green" }}>
            {missingRegCount}
          </div>
          <div style={{ color: missingRegCount > 0 ? "#d9534f" : "#666", fontWeight: missingRegCount > 0 ? "bold" : "normal" }}>
            {t("Missing Registration", "بغیر رجسٹریشن معالج")}
          </div>
        </article>
      </div>

      {/* Register Table & Filters */}
      <article className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
          <h2>{t("Authorized staff roster", "مجاز عملے کی فہرست")}</h2>
          <div className="toolbar" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="search"
              data-help="msds_authorized_personnel.filter"
              placeholder={t("Search name, designation, department...", "نام، عہدہ، شعبہ تلاش کریں...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              data-help="msds_authorized_personnel.filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">{t("All categories", "تمام زمرے")}</option>
              <option value="Clinical">{t("Clinical", "کلینیکل")}</option>
              <option value="Nursing">{t("Nursing", "نرسنگ")}</option>
              <option value="Administrative">{t("Administrative", "انتظامی")}</option>
              <option value="Technical">{t("Technical", "تکنیکی")}</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="checkbox"
                data-help="msds_authorized_personnel.filter"
                checked={missingRegOnly}
                onChange={(e) => setMissingRegOnly(e.target.checked)}
              />
              <span style={{ color: missingRegOnly ? "#d9534f" : "inherit", fontWeight: missingRegOnly ? "bold" : "normal" }}>
                {t("Missing registration only", "صرف بغیر رجسٹریشن")}
              </span>
            </label>
          </div>
        </div>

        <LoadState {...staff} retry={staff.reload} />

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t("Staff Name", "عملہ کا نام")}</th>
                <th>{t("Designation & Specialty", "عہدہ اور خصوصیت")}</th>
                <th>{t("Department", "شعبہ")}</th>
                <th>{t("Council Registration", "کونسل رجسٹریشن")}</th>
                <th>{t("Permitted Record Writes", "مجاز اندراجات")}</th>
                <th>{t("Specimen Stamp", "نمونہ مہر")}</th>
                <th>{t("Actions", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((person) => {
                const lacksReg = person.clinical && !person.registration;
                return (
                  <tr
                    key={person.user_id}
                    className={selectedPerson?.user_id === person.user_id ? "selected" : ""}
                    style={lacksReg ? { backgroundColor: "rgba(220, 53, 69, 0.05)" } : undefined}
                  >
                    <td>
                      <strong>{person.name}</strong>
                      {person.staff_category && (
                        <div>
                          <small className="badge badge-secondary">{person.staff_category}</small>
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{person.designation || "—"}</div>
                      {person.specialty && <small style={{ color: "#666" }}>{person.specialty}</small>}
                    </td>
                    <td>{person.department_name || "—"}</td>
                    <td>
                      {/* rule:5446e323ee: a clinician without one in red: fix it in HR */}
                      {lacksReg ? (
                        <div style={{ color: "#d9534f", fontWeight: "bold" }}>
                          <span className="badge badge-danger" style={{ display: "inline-block", marginBottom: "2px" }}>
                            {t("Missing registration", "رجسٹریشن ندارد")}
                          </span>
                          <div>
                            <small>{t("Fix in HR personnel record", "ایچ آر میں درست کریں")}</small>
                          </div>
                        </div>
                      ) : person.registration ? (
                        <span className="badge badge-success">{person.registration}</span>
                      ) : (
                        <span style={{ color: "#999" }}>{t("N/A (Non-clinical)", "غیر کلینیکل")}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "280px" }}>
                        {person.writes.length > 0 ? (
                          person.writes.map((w) => (
                            <span key={w} className="badge badge-info" style={{ fontSize: "0.8rem" }}>
                              {w}
                            </span>
                          ))
                        ) : (
                          <small style={{ color: "#888" }}>{t("No write permissions", "لکھنے کی اجازت نہیں")}</small>
                        )}
                      </div>
                    </td>
                    <td>
                      {person.stamp ? (
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            border: "1px dashed #666",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: "#fff",
                            whiteSpace: "pre-wrap",
                            maxWidth: "200px",
                          }}
                        >
                          {person.stamp}
                        </div>
                      ) : (
                        <span style={{ color: "#999" }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        data-help="msds_authorized_personnel.view"
                        onClick={() => setSelectedPerson(selectedPerson?.user_id === person.user_id ? null : person)}
                      >
                        {selectedPerson?.user_id === person.user_id ? t("Hide", "چھپائیں") : t("Details", "تفصیل")}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "16px" }}>
                    {t("No authorized staff found matching criteria.", "کوئی عملہ نہیں ملا۔")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Person Inspector */}
        {selectedPerson && (
          <div className="card" style={{ marginTop: "16px", background: "var(--color-bg-secondary, #fafafa)", padding: "16px" }}>
            <h3>{selectedPerson.name} · {selectedPerson.designation || t("Staff Member", "ملازم")}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "12px" }}>
              <div>
                <strong>{t("Staff Category", "عملے کا زمرہ")}:</strong> {selectedPerson.staff_category || "—"}
              </div>
              <div>
                <strong>{t("Department", "شعبہ")}:</strong> {selectedPerson.department_name || "—"}
              </div>
              <div>
                <strong>{t("Council Registration", "رجسٹریشن")}:</strong>{" "}
                {selectedPerson.registration ? (
                  <span className="badge badge-success">{selectedPerson.registration}</span>
                ) : selectedPerson.clinical ? (
                  <span className="badge badge-danger">{t("Missing: Fix in HR", "درکار ہے: ایچ آر میں درست کریں")}</span>
                ) : (
                  "—"
                )}
              </div>
              <div>
                <strong>{t("Assigned Roles", "مفوضہ کردار")}:</strong> {selectedPerson.roles.join(", ")}
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <strong>{t("Permitted Record Sections", "میڈیکل ریکارڈ کے مجاز حصے")}:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                {selectedPerson.writes.map((w) => (
                  <span key={w} className="badge badge-info" style={{ padding: "4px 8px" }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>

            {selectedPerson.stamp && (
              <div style={{ marginTop: "12px" }}>
                <strong>{t("Specimen Digital Signature & Stamp (MSDS IMS 147)", "نمونہ ڈیجیٹل دستخط و مہر")}:</strong>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    border: "1px solid #333",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    background: "#fff",
                    marginTop: "6px",
                    display: "inline-block",
                  }}
                >
                  {selectedPerson.stamp}
                </div>
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
