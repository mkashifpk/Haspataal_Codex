import { useEffect, useState } from "react";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  MedicationWorklistItemOut,
  OwnMedicineOut,
  OwnMedicineIdentifyIn,
  DrugStockOut,
} from "../generated/own_medicines_pharmacy";
import {
  safetyWorklist,
  listOwn,
  searchDrugs,
} from "../generated/own_medicines_pharmacy";
import {
  pharmacyOwnMedicinesAccess,
  validateIdentifyInput,
  canIdentifyMedicine,
  formatStockBadge,
  getHighAlertTone,
} from "../own-medicines-pharmacy-policy";

export interface OwnMedicinesPharmacyProps {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
}

export function OwnMedicinesPharmacy({
  user,
  connected,
  stream,
  establishment,
  timeZone,
}: OwnMedicinesPharmacyProps) {
  const screenView =
    establishment.views.screens.find(
      (s) => s.screen_id === "own_medicines_pharmacy",
    )?.view || "full";

  const access = pharmacyOwnMedicinesAccess(
    user.permissions,
    screenView,
  );

  const [tick, setTick] = useState(0);
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<number | null>(null);
  const [manualAdmissionInput, setManualAdmissionInput] = useState("");
  const [activePatientLabel, setActivePatientLabel] = useState<string | null>(null);

  // Identification modal states
  const [identifyingMedicine, setIdentifyingMedicine] = useState<OwnMedicineOut | null>(null);
  const [identificationStatus, setIdentificationStatus] = useState<
    "Identified" | "NotIdentifiable" | "Expired" | "Damaged"
  >("Identified");
  const [drugSearchQuery, setDrugSearchQuery] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<DrugStockOut | null>(null);
  const [notes, setNotes] = useState("");
  const [storedAt, setStoredAt] = useState<"Ward" | "Pharmacy">("Pharmacy");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isReviewing, setIsReviewing] = useState(false);

  // Clinical write setup
  const write = useClinicalWrite(
    user,
    `own_meds_identify:${selectedAdmissionId || 0}`,
    async () => {
      setIdentifyingMedicine(null);
      setIsReviewing(false);
      setSelectedDrug(null);
      setNotes("");
      setValidationErrors({});
      setTick((n) => n + 1);
    },
  );

  // Worklist loader
  const worklistState = useLoad(
    async () => {
      if (!access.canViewWorklist) return [];
      return safetyWorklist({ mine: mineOnly });
    },
    [access.canViewWorklist, mineOnly, tick],
  );

  // Active admission own medicines loader
  const admissionMedsState = useLoad(
    async () => {
      if (!selectedAdmissionId || !access.canListOwn) return [];
      return listOwn(selectedAdmissionId);
    },
    [selectedAdmissionId, access.canListOwn, tick],
  );

  // Formulary drugs search state
  const [drugSearchResults, setDrugSearchResults] = useState<DrugStockOut[]>([]);
  const [searchingDrugs, setSearchingDrugs] = useState(false);
  const [drugSearchError, setDrugSearchError] = useState<string | null>(null);

  const executeDrugSearch = async (query: string) => {
    if (!query.trim()) {
      setDrugSearchResults([]);
      return;
    }
    setSearchingDrugs(true);
    setDrugSearchError(null);
    try {
      const results = await searchDrugs({ q: query.trim(), limit: 15 });
      setDrugSearchResults(results);
    } catch (err: any) {
      setDrugSearchError(err?.message || "Failed to search formulary drugs");
    } finally {
      setSearchingDrugs(false);
    }
  };

  // Realtime event listener
  useEffect(() => {
    if (!connected) return;
    const handleEvent = (e: CustomEvent) => {
      const topic = e.detail?.topic || "";
      if (
        topic.startsWith("session.") ||
        topic.startsWith("system.") ||
        topic === "notification.created"
      ) {
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("haspataal:event" as any, handleEvent);
    return () => window.removeEventListener("haspataal:event" as any, handleEvent);
  }, [connected]);

  const worklistItems = (worklistState.data || []).filter(
    (i) => i.kind === "OwnMedicineToIdentify",
  );

  const ownMedicines = admissionMedsState.data || [];

  const handleSelectWorklistItem = (item: MedicationWorklistItemOut) => {
    if (item.admission_id) {
      setSelectedAdmissionId(item.admission_id);
      setManualAdmissionInput(String(item.admission_id));
      setActivePatientLabel(
        `${item.patient_name || "Patient"} (${item.mrn || "No MRN"}) - Ward: ${item.ward_name || "N/A"} Bed: ${item.bed_label || "N/A"}`,
      );
    }
  };

  const handleManualLoadAdmission = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(manualAdmissionInput.trim(), 10);
    if (!isNaN(id) && id > 0) {
      setSelectedAdmissionId(id);
      setActivePatientLabel(`Admission #${id}`);
    }
  };

  const openIdentifyModal = (med: OwnMedicineOut) => {
    const check = canIdentifyMedicine(med);
    if (!check.allowed) {
      return;
    }
    setIdentifyingMedicine(med);
    setStoredAt(med.stored_at || "Pharmacy");
    setIdentificationStatus("Identified");
    setSelectedDrug(null);
    setDrugSearchQuery(med.medicine_name || "");
    setNotes("");
    setValidationErrors({});
    setIsReviewing(false);
    // Auto-search formulary using medicine name if available
    if (med.medicine_name) {
      executeDrugSearch(med.medicine_name);
    } else {
      setDrugSearchResults([]);
    }
  };

  const handleValidateAndReview = () => {
    const drugId = selectedDrug ? selectedDrug.drug_id : null;
    const result = validateIdentifyInput(
      identificationStatus,
      drugId,
      notes,
      storedAt,
    );
    if (!result.valid) {
      setValidationErrors(result.errors);
      return;
    }
    setValidationErrors({});
    setIsReviewing(true);
  };

  const handleConfirmIdentify = () => {
    if (!identifyingMedicine) return;
    const body: OwnMedicineIdentifyIn = {
      identification: identificationStatus,
      drug_id: selectedDrug ? selectedDrug.drug_id : null,
      note: notes.trim() || null,
      stored_at: storedAt,
    };

    write.start(
      {
        method: "POST",
        path: `/own-medicines/${identifyingMedicine.own_medicine_id}/identify`,
        body,
        permission: "patient.own_medicine.identify",
        protection: "idempotent",
        label: t("Identify patient's own medicine", "مریض کی دوا کی شناخت کریں"),
      },
      async () => {},
    );
  };

  if (access.isDenied) {
    return (
      <section className="own-medicines-screen" aria-labelledby="screen-title">
        <h1 id="screen-title">
          {t("Identify patients' own medicines", "مریض کی ادویات کی شناخت")}
        </h1>
        <ErrorBox
          error={t(
            "You do not have permission to view or identify patients' own medicines.",
            "آپ کے پاس مریض کی اپنی ادویات دیکھنے یا شناخت کرنے کا اختیار نہیں ہے۔",
          )}
        />
      </section>
    );
  }

  return (
    <section className="own-medicines-screen" aria-labelledby="screen-title">
      <header className="screen-header">
        <h1 id="screen-title">
          {t("Identify patients' own medicines", "مریض کی ادویات کی شناخت")}
        </h1>
        <p className="screen-purpose">
          {t(
            "Identify the medicines patients brought in, before they are kept.",
            "مریض کے لائے ہوئے ادویات کی شناخت کریں اس سے پہلے کہ انہیں محفوظ کیا جائے۔",
          )}
        </p>

        {access.isRetiring && (
          <div className="banner banner-warning" role="alert">
            <strong>
              {t(
                "No new own medicines to identify from now on",
                "اب سے مریض کی ادویات کی نئی شناخت نہیں کی جائے گی",
              )}
            </strong>{" "}
            —{" "}
            {t(
              "Inpatient pharmacy service is retiring; finalize open work only.",
              "ان ڈور فارمیسی سروس ریٹائر ہو رہی ہے؛ صرف کھلا ہوا کام مکمل کریں۔",
            )}
          </div>
        )}

        {access.isRecordsOnly && (
          <div className="banner banner-info" role="status">
            <strong>
              {t("Records Only Mode", "صرف ریکارڈز موڈ")}
            </strong>{" "}
            —{" "}
            {t(
              "Inpatient service is retired. History and past identifications are read-only.",
              "ان ڈور سروس ریٹائر ہو چکی ہے۔ پرانی شناختوں کی صرف تاریخ دیکھی جا سکتی ہے۔",
            )}
          </div>
        )}
      </header>

      <ClinicalWriteFeedback write={write} />

      <div className="own-medicines-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "1.5rem", marginTop: "1rem" }}>
        {/* Left Column: Safety Worklist for Pharmacist */}
        <div className="worklist-pane card" style={{ border: "1px solid var(--border-color, #ccc)", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>
              {t("Awaiting Identification", "شناخت کی منتظر ادویات")}
            </h2>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-help="ownmeds_pharma.filter_mine"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                />
                {t("Mine only", "صرف میری")}
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                data-help="ownmeds_pharma.refresh_worklist"
                onClick={() => setTick((t) => t + 1)}
                title={t("Refresh medication safety worklist", "حفاظتی فہرست کو تازہ کریں")}
              >
                {t("Refresh", "تازہ کریں")}
              </button>
            </div>
          </div>

          <LoadState
            loading={worklistState.loading}
            error={worklistState.error}
            retry={worklistState.reload}
          />

          {!worklistState.loading && worklistItems.length === 0 && (
            <Empty>
              {t(
                "No patients' own medicines waiting for identification.",
                "شناخت کے لیے کوئی ادویات منتظر نہیں ہیں۔",
              )}
            </Empty>
          )}

          {worklistItems.length > 0 && (
            <ul className="worklist-items-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {worklistItems.map((item, idx) => {
                const isSelected = item.admission_id === selectedAdmissionId;
                return (
                  <li
                    key={`worklist-${item.admission_id}-${idx}`}
                    style={{
                      border: isSelected ? "2px solid var(--primary-color, #0284c7)" : "1px solid var(--border-color, #ddd)",
                      background: isSelected ? "var(--highlight-bg, #f0f9ff)" : "transparent",
                      padding: "0.75rem",
                      borderRadius: "4px",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong>{item.patient_name || t("Unknown Patient", "نامعلوم مریض")}</strong>
                        <span style={{ fontSize: "0.85rem", color: "#666", marginLeft: "0.5rem" }}>
                          {item.mrn}
                        </span>
                      </div>
                      {item.is_overdue && (
                        <span className="badge badge-danger" style={{ background: "#dc2626", color: "#fff", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem" }}>
                          {t("OVERDUE", "تاخیر شدہ")}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem", marginTop: "0.25rem", color: "#444" }}>
                      <span>{t("Ward", "وارڈ")}: {item.ward_name || "N/A"}</span> | <span>{t("Bed", "بستر")}: {item.bed_label || "N/A"}</span>
                    </div>
                    {item.detail && (
                      <div style={{ fontSize: "0.85rem", fontStyle: "italic", marginTop: "0.25rem" }}>
                        {item.detail}
                      </div>
                    )}
                    <div style={{ marginTop: "0.5rem", textAlign: "right" }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-outline"}`}
                        data-help="ownmeds_pharma.select_admission"
                        onClick={() => handleSelectWorklistItem(item)}
                      >
                        {isSelected ? t("Viewing", "دیکھ رہے ہیں") : t("Inspect & Identify", "معائنہ اور شناخت کریں")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right Column: Admission Own Medicines Inspector & Identification */}
        <div className="admission-pane card" style={{ border: "1px solid var(--border-color, #ccc)", padding: "1rem", borderRadius: "6px" }}>
          {/* Header & manual search */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", margin: 0 }}>
                {t("Admission Own Medicines", "داخلے کی ذاتی ادویات")}
              </h2>
              {activePatientLabel && (
                <div style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.25rem" }}>
                  {activePatientLabel}
                </div>
              )}
            </div>
            <form onSubmit={handleManualLoadAdmission} style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="number"
                placeholder={t("Admission ID", "داخلہ نمبر")}
                data-help="ownmeds_pharma.manual_admission_id"
                value={manualAdmissionInput}
                onChange={(e) => setManualAdmissionInput(e.target.value)}
                style={{ width: "120px", padding: "4px 8px" }}
              />
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                data-help="ownmeds_pharma.load_admission"
              >
                {t("Load", "لوڈ")}
              </button>
              {selectedAdmissionId && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  data-help="ownmeds_pharma.refresh_admission"
                  onClick={() => setTick((t) => t + 1)}
                  title={t("Refresh own medicines inventory", "فہرست تازہ کریں")}
                >
                  {t("Refresh", "تازہ")}
                </button>
              )}
            </form>
          </div>

          {!selectedAdmissionId && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
              <p>
                {t(
                  "Select an item from the waiting queue on the left or enter an Admission ID to view and identify brought-in medicine packs.",
                  "بائیں جانب منتظر فہرست سے ایک داخلہ منتخب کریں یا لائی گئی ادویات کی شناخت کے لیے داخلہ نمبر درج کریں۔",
                )}
              </p>
            </div>
          )}

          {selectedAdmissionId && (
            <>
              <LoadState
                loading={admissionMedsState.loading}
                error={admissionMedsState.error}
                retry={admissionMedsState.reload}
              />

              {!admissionMedsState.loading && ownMedicines.length === 0 && (
                <Empty>
                  {t(
                    "No personal medicines have been recorded for this admission.",
                    "اس داخلے کے لیے کوئی ذاتی ادویات درج نہیں کی گئیں۔",
                  )}
                </Empty>
              )}

              {ownMedicines.length > 0 && (
                <div className="table-responsive" style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                        <th style={{ padding: "8px" }}>{t("Medicine Pack", "دوا کا نام")}</th>
                        <th style={{ padding: "8px" }}>{t("Qty / Form", "مقدار / شکل")}</th>
                        <th style={{ padding: "8px" }}>{t("Expiry / Batch", "میعاد / بیچ")}</th>
                        <th style={{ padding: "8px" }}>{t("Brought By / Kept At", "لانے والا / مقام")}</th>
                        <th style={{ padding: "8px" }}>{t("Status / Identification", "حیثیت / شناخت")}</th>
                        <th style={{ padding: "8px", textAlign: "right" }}>{t("Action", "عمل")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownMedicines.map((med) => {
                        const canIdentify = canIdentifyMedicine(med).allowed && access.canIdentify;
                        return (
                          <tr key={`med-${med.own_medicine_id}`} style={{ borderBottom: "1px solid #eee" }}>
                            <td style={{ padding: "8px" }}>
                              <strong>{med.medicine_name}</strong>
                              {med.strength && <span style={{ marginLeft: "4px", color: "#555" }}>({med.strength})</span>}
                            </td>
                            <td style={{ padding: "8px" }}>
                              <div>{med.quantity}</div>
                              {med.form && <small style={{ color: "#777" }}>{med.form}</small>}
                            </td>
                            <td style={{ padding: "8px" }}>
                              <div>
                                {med.expiry_date || t("No date", "کوئی تاریخ نہیں")}
                                {med.is_expired && (
                                  <span className="badge badge-danger" style={{ marginLeft: "6px", background: "#ef4444", color: "#fff", padding: "1px 5px", borderRadius: "3px", fontSize: "0.75rem" }}>
                                    {t("EXPIRED", "ختم شدہ")}
                                  </span>
                                )}
                              </div>
                              {med.batch_no && <small style={{ color: "#777" }}>{t("Batch", "بیچ")}: {med.batch_no}</small>}
                            </td>
                            <td style={{ padding: "8px" }}>
                              <div>{med.brought_by}</div>
                              <span style={{ fontSize: "0.8rem", color: med.stored_at === "Pharmacy" ? "#0284c7" : "#059669" }}>
                                {med.stored_at === "Pharmacy" ? t("Hospital Pharmacy", "ہسپتال فارمیسی") : t("Ward Cupboard", "وارڈ الماری")}
                              </span>
                            </td>
                            <td style={{ padding: "8px" }}>
                              <div>
                                <span className="badge" style={{ padding: "2px 6px", borderRadius: "4px", background: med.status === "Received" ? "#fef3c7" : "#e0e7ff", color: "#1e293b", fontWeight: "bold" }}>
                                  {med.status}
                                </span>
                              </div>
                              {med.identification && (
                                <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                                  <strong>{med.identification}</strong>
                                  {med.drug_name && <div>&rarr; {med.drug_name}</div>}
                                  {med.identification_note && <div style={{ color: "#555" }}>{med.identification_note}</div>}
                                  {med.identified_by_name && <small style={{ color: "#888" }}>{t("By", "از")}: {med.identified_by_name}</small>}
                                </div>
                              )}
                              {!med.identification && med.status === "Received" && (
                                <small style={{ color: "#d97706", display: "block", marginTop: "2px" }}>
                                  {t("Pending identification", "شناخت زیر التواء")}
                                </small>
                              )}
                            </td>
                            <td style={{ padding: "8px", textAlign: "right" }}>
                              {canIdentify ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  data-help="ownmeds_pharma.identify_button"
                                  onClick={() => openIdentifyModal(med)}
                                >
                                  {t("Identify", "شناخت کریں")}
                                </button>
                              ) : (
                                <span style={{ fontSize: "0.8rem", color: "#888" }}>
                                  {med.identification ? t("Identified", "شناخت شدہ") : t("Read Only", "صرف مطالعہ")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Identification Modal Dialog */}
      {identifyingMedicine && (
        <Modal
          title={`${t("Identify Patient's Medicine", "مریض کی دوا کی شناخت")}: ${identifyingMedicine.medicine_name}`}
          onClose={() => {
            if (!write.busy) {
              setIdentifyingMedicine(null);
            }
          }}
        >
          <div className="identify-dialog" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="medicine-summary" style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem" }}>
                <div><strong>{t("Pack Name", "نام")}:</strong> {identifyingMedicine.medicine_name}</div>
                <div><strong>{t("Quantity", "مقدار")}:</strong> {identifyingMedicine.quantity}</div>
                <div><strong>{t("Strength / Form", "طاقت / شکل")}:</strong> {identifyingMedicine.strength || "—"} / {identifyingMedicine.form || "—"}</div>
                <div>
                  <strong>{t("Expiry Date", "میعاد")}:</strong> {identifyingMedicine.expiry_date || "—"}
                  {identifyingMedicine.is_expired && (
                    <span style={{ color: "#ef4444", fontWeight: "bold", marginLeft: "4px" }}>
                      ({t("EXPIRED", "ختم شدہ")})
                    </span>
                  )}
                </div>
                <div><strong>{t("Brought By", "لانے والا")}:</strong> {identifyingMedicine.brought_by}</div>
                <div><strong>{t("Current Storage", "موجودہ مقام")}:</strong> {identifyingMedicine.stored_at}</div>
              </div>
            </div>

            {!isReviewing ? (
              <>
                {/* Form fields */}
                <Field
                  label={t("Identification Status", "شناخت کی حیثیت")}
                  hint={validationErrors.identification}
                >
                  <select
                    data-help="ownmeds_pharma.status_select"
                    value={identificationStatus}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setIdentificationStatus(val);
                      if (val !== "Identified") {
                        setSelectedDrug(null);
                      }
                    }}
                    style={{ width: "100%", padding: "6px" }}
                  >
                    <option value="Identified">
                      {t("Identified (Matches Hospital Formulary)", "شناخت شدہ (ہسپتال فارمولری سے مطابقت رکھتی ہے)")}
                    </option>
                    <option value="NotIdentifiable">
                      {t("Not Identifiable (Unknown or unlabelled)", "ناقابل شناخت (نامعلوم یا بغیر لیبل)")}
                    </option>
                    <option value="Expired">
                      {t("Expired (Passed expiry date)", "ختم شدہ (میعاد ختم ہو چکی ہے)")}
                    </option>
                    <option value="Damaged">
                      {t("Damaged (Crushed, contaminated, or broken pack)", "خراب / تباہ شدہ (ٹوٹی ہوئی یا آلودہ)")}
                    </option>
                  </select>
                </Field>

                {/* Formulary Search (required if Identified) */}
                {identificationStatus === "Identified" && (
                  <div className="formulary-match-section" style={{ border: "1px solid #bfdbfe", background: "#eff6ff", padding: "0.75rem", borderRadius: "4px" }}>
                    <Field
                      label={t("Formulary Drug Match", "فارمولری دوا کا انتخاب")}
                      hint={validationErrors.drug_id}
                    >
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input
                          type="text"
                          placeholder={t("Search drug name or code...", "دوا کا نام یا کوڈ تلاش کریں...")}
                          data-help="ownmeds_pharma.drug_search_input"
                          value={drugSearchQuery}
                          onChange={(e) => setDrugSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              executeDrugSearch(drugSearchQuery);
                            }
                          }}
                          style={{ flex: 1, padding: "6px" }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          data-help="ownmeds_pharma.drug_search_button"
                          onClick={() => executeDrugSearch(drugSearchQuery)}
                          disabled={searchingDrugs}
                        >
                          {searchingDrugs ? t("Searching...", "تلاش جاری...") : t("Search Formulary", "فارمولری تلاش کریں")}
                        </button>
                      </div>
                    </Field>

                    {drugSearchError && (
                      <div style={{ color: "#ef4444", fontSize: "0.85rem", marginTop: "4px" }}>
                        {drugSearchError}
                      </div>
                    )}

                    {selectedDrug && (
                      <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "#fff", border: "1px solid #93c5fd", borderRadius: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <strong>{selectedDrug.name}</strong> ({selectedDrug.code})
                            {selectedDrug.generic_name && (
                              <div style={{ fontSize: "0.8rem", color: "#666" }}>
                                {t("Generic", "جنیرک")}: {selectedDrug.generic_name}
                              </div>
                            )}
                          </div>
                          <div>
                            {(() => {
                              const badge = formatStockBadge(selectedDrug);
                              const bg = badge.tone === "danger" ? "#fee2e2" : badge.tone === "warning" ? "#fef3c7" : "#dcfce7";
                              const fg = badge.tone === "danger" ? "#b91c1c" : badge.tone === "warning" ? "#b45309" : "#15803d";
                              return (
                                <span style={{ background: bg, color: fg, padding: "2px 6px", borderRadius: "3px", fontSize: "0.75rem", fontWeight: "bold" }}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* LASA Warnings */}
                        {selectedDrug.lasa_with && selectedDrug.lasa_with.length > 0 && (
                          <div style={{ marginTop: "4px", fontSize: "0.8rem", color: "#b45309", background: "#fffbeb", padding: "4px", borderRadius: "3px" }}>
                            ⚠️ <strong>{t("LASA Warning", "مشابہ دوا کا انتباہ")}:</strong> {t("Looks or sounds like", "دیکھنے یا سننے میں مشابہ")}: {selectedDrug.lasa_with.join(", ")}
                          </div>
                        )}

                        {/* High Alert Warning */}
                        {selectedDrug.high_alert_category && (
                          <div style={{ marginTop: "4px", fontSize: "0.8rem", color: "#dc2626", background: "#fef2f2", padding: "4px", borderRadius: "3px" }}>
                            🚨 <strong>{t("HIGH-ALERT MEDICINE", "انتہائی محتاط دوا")} ({selectedDrug.high_alert_category}):</strong> {t("Requires dual-person verification upon dispensing.", "فراہمی کے وقت دو افراد کی تصدیق لازمی ہے۔")}
                          </div>
                        )}
                      </div>
                    )}

                    {drugSearchResults.length > 0 && (
                      <div style={{ maxHeight: "150px", overflowY: "auto", marginTop: "0.5rem", border: "1px solid #ddd", borderRadius: "4px", background: "#fff" }}>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                          {drugSearchResults.map((drug) => {
                            const isPicked = selectedDrug?.drug_id === drug.drug_id;
                            const badge = formatStockBadge(drug);
                            return (
                              <li
                                key={`drug-opt-${drug.drug_id}`}
                                style={{
                                  padding: "6px 8px",
                                  borderBottom: "1px solid #f0f0f0",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  background: isPicked ? "#e0f2fe" : "transparent",
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: isPicked ? "bold" : "normal" }}>
                                    {drug.name} <small style={{ color: "#666" }}>[{drug.code}]</small>
                                  </div>
                                  <small style={{ color: "#777" }}>
                                    {drug.form} | {drug.strength || "N/A"} | {badge.label}
                                  </small>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline"
                                  data-help="ownmeds_pharma.drug_select_button"
                                  onClick={() => setSelectedDrug(drug)}
                                >
                                  {isPicked ? t("Selected", "منتخب") : t("Select", "منتخب کریں")}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Storage destination update */}
                <Field
                  label={t("Where will this pack be kept from now on?", "یہ دوا اب سے کہاں محفوظ کی جائے گی؟")}
                  hint={validationErrors.stored_at}
                >
                  <select
                    data-help="ownmeds_pharma.stored_at_select"
                    value={storedAt}
                    onChange={(e) => setStoredAt(e.target.value as any)}
                    style={{ width: "100%", padding: "6px" }}
                  >
                    <option value="Pharmacy">{t("Hospital Pharmacy (Locked custody)", "ہسپتال فارمیسی (محفوظ تحویل)")}</option>
                    <option value="Ward">{t("Ward Cupboard (Bedside nursing custody)", "وارڈ الماری (نرسنگ تحویل)")}</option>
                  </select>
                </Field>

                {/* Notes */}
                <Field
                  label={t("Pharmacist Notes & Observations", "فارماسسٹ کے نوٹس اور مشاہدات")}
                  hint={validationErrors.note}
                >
                  <textarea
                    data-help="ownmeds_pharma.notes_input"
                    rows={2}
                    maxLength={500}
                    placeholder={t("Brand verification, physical condition, packaging remarks (max 500 chars)...", "برانڈ، پیکجنگ، یا طبعی حالت کے بارے میں نوٹس...")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: "100%", padding: "6px" }}
                  />
                </Field>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-help="ownmeds_pharma.cancel_button"
                    onClick={() => setIdentifyingMedicine(null)}
                  >
                    {t("Cancel", "منسوخ کریں")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-help="ownmeds_pharma.review_button"
                    onClick={handleValidateAndReview}
                  >
                    {t("Review Identification", "شناخت کا جائزہ لیں")}
                  </button>
                </div>
              </>
            ) : (
              /* Review Step */
              <div className="review-step" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div className="alert alert-info" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "0.75rem", borderRadius: "4px" }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem" }}>
                    {t("Confirm Identification Decision", "شناخت کے فیصلے کی تصدیق کریں")}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    {t(
                      "Once identified, personal medicines transition to Retained state and cannot be re-identified (rule:dfd5ef5981).",
                      "ایک بار شناخت کے بعد، ذاتی ادویات محفوظ حالت میں چلی جاتی ہیں اور دوبارہ شناخت نہیں کی جا سکتیں۔",
                    )}
                  </p>
                </div>

                <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: "0.75rem", borderRadius: "4px", fontSize: "0.9rem" }}>
                  <div><strong>{t("Status", "حیثیت")}:</strong> {identificationStatus}</div>
                  {selectedDrug && (
                    <div style={{ marginTop: "4px" }}>
                      <strong>{t("Matched Formulary Drug", "منتخب فارمولری دوا")}:</strong> {selectedDrug.name} ({selectedDrug.code})
                    </div>
                  )}
                  <div style={{ marginTop: "4px" }}>
                    <strong>{t("Kept At", "محفوظ مقام")}:</strong> {storedAt}
                  </div>
                  {notes && (
                    <div style={{ marginTop: "4px" }}>
                      <strong>{t("Notes", "نوٹس")}:</strong> {notes}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-help="ownmeds_pharma.cancel_button"
                    onClick={() => setIsReviewing(false)}
                    disabled={write.busy}
                  >
                    {t("Back to Edit", "ترمیم پر واپس")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-help="ownmeds_pharma.confirm_button"
                    onClick={handleConfirmIdentify}
                    disabled={write.busy}
                  >
                    {write.busy ? t("Recording...", "محفوظ ہو رہا ہے...") : t("Confirm & Identify", "تصدیق اور شناخت مکمل کریں")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
