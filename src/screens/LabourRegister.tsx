import React, { useEffect, useState, useRef } from "react";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  LabourFieldOut,
  LabourEntryIn,
  LabourBabyIn,
  LabourEntryOut,
  LabourBabyOut,
  LabourEntryPatch,
  AuthorStampOut,
  NewbornOut,
} from "../generated/labour_register";
import {
  listColumns,
  createEntry,
  listEntriesMaternityLabourRegister,
  getEntry,
  updateEntryMaternityLabourRegister,
  signEntry,
  birthNotification,
  newborns,
} from "../generated/labour_register";
import {
  getLabourRegisterScreenView,
  isMaternityActive,
  groupColumnsBySection,
  isColumnRequired,
  validateColumnValue,
  evaluateMissingRequiredColumns,
  validateLabourEntryIn,
  formatAuthorStamp,
  explainLabourRegisterError,
  DELIVERY_SECTIONS,
  SECTION_TITLES,
  type DeliverySection,
} from "../labour-register-policy";
import { useClinicalWrite, ClinicalWriteFeedback, type ClinicalCommand } from "../clinical-write";
import { api, call } from "../bridge";

export interface LabourRegisterProps {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  stream?: string | null;
  initialEntryId?: number | null;
  initialAdmissionId?: number | null;
  onNavigateScreen?: (screen: string) => void;
}

interface AdmittedMotherSearchMatch {
  admission_id: number;
  patient_id: number;
  mrn: string;
  name: string;
  admission_number: string;
  bed_label?: string | null;
  ward_name?: string | null;
}

interface AttendingStaffMatch {
  employee_id: number;
  name: string;
  designation?: string | null;
}

export function LabourRegister({
  user,
  establishment: propEstablishment,
  connected = true,
  stream = null,
  initialEntryId = null,
  initialAdmissionId = null,
  onNavigateScreen,
}: LabourRegisterProps) {
  // Permissions check
  const canRecord = user.permissions?.includes("maternity.record") ?? false;
  const canView =
    (user.permissions?.includes("maternity.view") ?? false) ||
    canRecord ||
    (user.permissions?.includes("maternity.policy.manage") ?? false);

  // Real-time revision tracking
  const [revision, setRevision] = useState(0);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Active Establishment state
  const [est, setEst] = useState<EstablishmentOut | null>(propEstablishment || null);
  useEffect(() => {
    if (propEstablishment) setEst(propEstablishment);
  }, [propEstablishment]);

  // Screen view mode
  const screenView = getLabourRegisterScreenView(est);
  const maternityActive = isMaternityActive(est);

  // Active View Mode: "worklist" or "entry_detail"
  const [viewMode, setViewMode] = useState<"worklist" | "entry_detail">(
    initialEntryId ? "entry_detail" : "worklist"
  );
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(initialEntryId);

  // Worklist Query Filters
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [filterDateTo, setFilterDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState<"All" | "Draft" | "Signed">("All");

  // Load Columns (Dynamic Form Configuration - rule:1146a499b0)
  const columnsLoad = useLoad<LabourFieldOut[]>(async () => {
    return await listColumns({ include_inactive: false });
  }, [revision]);

  const activeColumns = columnsLoad.data || [];
  const groupedColumns = groupColumnsBySection(activeColumns);

  // Load Worklist Entries
  const entriesLoad = useLoad<LabourEntryOut[]>(async () => {
    return await listEntriesMaternityLabourRegister({
      date_from: filterDateFrom,
      date_to: filterDateTo,
      status: filterStatus === "All" ? null : filterStatus,
      limit: 100,
    });
  }, [filterDateFrom, filterDateTo, filterStatus, revision]);

  // Load Selected Entry Detail
  const selectedEntryLoad = useLoad<LabourEntryOut | null>(async () => {
    if (!selectedEntryId) return null;
    return await getEntry(selectedEntryId);
  }, [selectedEntryId, revision]);

  const currentEntry = selectedEntryLoad.data;

  // Selected Entry Draft Edit State (for PATCH - rule:fe685a82bd)
  const [draftDeliveredAt, setDraftDeliveredAt] = useState("");
  const [draftAttendedBy, setDraftAttendedBy] = useState<number | null>(null);
  const [draftFieldValues, setDraftFieldValues] = useState<Record<string, any>>({});
  const [draftBabies, setDraftBabies] = useState<LabourBabyIn[]>([]);
  const [activeBabyTab, setActiveBabyTab] = useState<number>(1);
  const [missingFieldsAlert, setMissingFieldsAlert] = useState<string[]>([]);
  const [saveDraftNotice, setSaveDraftNotice] = useState<string | null>(null);

  // Sync draft state with loaded entry
  useEffect(() => {
    if (currentEntry) {
      setDraftDeliveredAt(currentEntry.delivered_at ? currentEntry.delivered_at.slice(0, 16) : "");
      setDraftAttendedBy(currentEntry.attended_by);
      setDraftFieldValues(currentEntry.field_values || {});
      setDraftBabies(
        (currentEntry.babies || []).map((b) => ({
          baby_no: b.baby_no,
          newborn_patient_id: b.newborn_patient_id,
          field_values: b.field_values || {},
        }))
      );
      if (currentEntry.babies && currentEntry.babies.length > 0) {
        setActiveBabyTab(currentEntry.babies[0].baby_no);
      }
      setMissingFieldsAlert([]);
    }
  }, [currentEntry]);

  // Load Mother's Registered Newborns (for linking babies - rule:632b575029)
  const motherNewbornsLoad = useLoad<NewbornOut[]>(async () => {
    if (!currentEntry?.patient_id) return [];
    return await newborns({ mother_patient_id: currentEntry.patient_id, limit: 20 });
  }, [currentEntry?.patient_id, revision]);

  const motherNewborns = motherNewbornsLoad.data || [];

  // New Delivery Modal State (rule:e108ec7978)
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newAdmissionId, setNewAdmissionId] = useState<number | null>(initialAdmissionId);
  const [newDeliveredAt, setNewDeliveredAt] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [newAttendedBy, setNewAttendedBy] = useState<number>(user.employee_id || 1);
  const [newMotherSearchQuery, setNewMotherSearchQuery] = useState("");
  const [newMotherSearching, setNewMotherSearching] = useState(false);
  const [newMotherSearchResults, setNewMotherSearchResults] = useState<AdmittedMotherSearchMatch[]>([]);
  const [newSelectedMother, setNewSelectedMother] = useState<AdmittedMotherSearchMatch | null>(null);
  const [newValidationErrors, setNewValidationErrors] = useState<string[]>([]);

  // Attending Staff Dropdown List
  const [staffList, setStaffList] = useState<AttendingStaffMatch[]>([]);
  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await api<any>("GET", "/hr/employees?limit=50&status=Active");
        const list = res.data || (Array.isArray(res) ? res : []);
        setStaffList(
          list.map((e: any) => ({
            employee_id: e.employee_id,
            name: e.full_name || e.name || `Employee #${e.employee_id}`,
            designation: e.designation || e.role,
          }))
        );
      } catch {
        // Fallback default
        if (user.employee_id) {
          setStaffList([
            {
              employee_id: user.employee_id,
              name: `Employee #${user.employee_id}`,
              designation: "Attending Staff",
            },
          ]);
        }
      }
    }
    loadStaff();
  }, [user]);

  // Real-time Event Subscription
  useEffect(() => {
    const handleServerEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<{ topic?: string; payload?: any }>;
      const topic = customEv.detail?.topic || "";

      if (topic === "establishment.changed") {
        setRealtimeNotice(
          t(
            "Establishment profile updated. Delivery register settings refreshed.",
            "ادارے کی سیٹنگز تبدیل ہوئیں۔ زچگی رجسٹر کی تفصیلات تازہ کر دی گئی ہیں۔"
          )
        );
        setRevision((r) => r + 1);
      } else if (topic.startsWith("system.") || topic.startsWith("notification.")) {
        setRevision((r) => r + 1);
      }
    };

    window.addEventListener("haspataal:event", handleServerEvent);
    return () => {
      window.removeEventListener("haspataal:event", handleServerEvent);
    };
  }, []);

  // Clinical write controller
  const write = useClinicalWrite(user, "labour_register", (value: any, cmd: ClinicalCommand) => {
    setRevision((r) => r + 1);
    if (cmd.path === "/maternity/labour-register" && cmd.method === "POST") {
      const created = value as LabourEntryOut;
      setNewModalOpen(false);
      setSelectedEntryId(created.entry_id);
      setViewMode("entry_detail");
    } else if (cmd.path.includes("/sign")) {
      setMissingFieldsAlert([]);
    }
  });

  // Search Mother Admission for New Delivery
  const handleSearchMotherAdmission = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMotherSearchQuery.trim()) return;
    setNewMotherSearching(true);
    try {
      const q = encodeURIComponent(newMotherSearchQuery.trim());
      const res = await api<{ data: AdmittedMotherSearchMatch[] }>(
        "GET",
        `/admissions?q=${q}&status=Admitted&limit=10`
      );
      const list = res.data || (Array.isArray(res) ? (res as any) : []);
      setNewMotherSearchResults(list);
    } catch {
      setNewMotherSearchResults([]);
    } finally {
      setNewMotherSearching(false);
    }
  };

  // Submit New Delivery Entry (rule:632b575029, rule:e108ec7978)
  const handleCreateNewDelivery = () => {
    if (!maternityActive) {
      setNewValidationErrors([
        t(
          "Maternity capability is inactive. Cannot record new deliveries.",
          "زچگی سروس غیر فعال ہے۔ نئی زچگی درج نہیں کی جا سکتی۔"
        ),
      ]);
      return;
    }

    const payload: LabourEntryIn = {
      admission_id: newAdmissionId || 1,
      delivered_at: newDeliveredAt ? new Date(newDeliveredAt).toISOString() : new Date().toISOString(),
      attended_by: newAttendedBy || user.employee_id || 1,
      field_values: {},
      babies: [
        {
          baby_no: 1,
          newborn_patient_id: null,
          field_values: {},
        },
      ],
    };

    const errs = validateLabourEntryIn(payload);
    if (errs.length > 0) {
      setNewValidationErrors(errs);
      return;
    }

    setNewValidationErrors([]);
    write.start({
      path: "/maternity/labour-register",
      method: "POST",
      body: payload,
      permission: "maternity.record",
      protection: "idempotent",
      label: t("Create Labour Register Entry", "لیبر رجسٹر میں زچگی کا اندراج"),
    });
  };

  // Update Field Value in Draft
  const handleFieldChange = (section: DeliverySection, code: string, value: any, babyNo?: number) => {
    if (section === "Baby" && babyNo !== undefined) {
      setDraftBabies((prev) =>
        prev.map((b) => {
          if (b.baby_no === babyNo) {
            return {
              ...b,
              field_values: {
                ...(b.field_values || {}),
                [code]: value,
              },
            };
          }
          return b;
        })
      );
    } else {
      setDraftFieldValues((prev) => ({
        ...prev,
        [code]: value,
      }));
    }
  };

  // Add Twin / Multiple Baby (rule:1146a499b0)
  const handleAddBaby = () => {
    const nextNo = draftBabies.length + 1;
    setDraftBabies((prev) => [
      ...prev,
      {
        baby_no: nextNo,
        newborn_patient_id: null,
        field_values: {},
      },
    ]);
    setActiveBabyTab(nextNo);
  };

  // Remove Baby
  const handleRemoveBaby = (babyNo: number) => {
    if (draftBabies.length <= 1) return;
    setDraftBabies((prev) => prev.filter((b) => b.baby_no !== babyNo));
    setActiveBabyTab(1);
  };

  // Link Newborn Patient ID to Baby
  const handleLinkNewborn = (babyNo: number, newbornPatientId: number | null) => {
    setDraftBabies((prev) =>
      prev.map((b) => (b.baby_no === babyNo ? { ...b, newborn_patient_id: newbornPatientId } : b))
    );
  };

  // Save Draft (PATCH - rule:fe685a82bd)
  const handleSaveDraft = () => {
    if (!currentEntry) return;

    const patchBody: LabourEntryPatch = {
      delivered_at: draftDeliveredAt ? new Date(draftDeliveredAt).toISOString() : null,
      attended_by: draftAttendedBy,
      field_values: draftFieldValues,
      babies: draftBabies,
      expected_version: currentEntry.row_version,
    };

    write.start({
      path: `/maternity/labour-register/${currentEntry.entry_id}`,
      method: "PATCH",
      body: patchBody,
      permission: "maternity.record",
      protection: "reconcile",
      label: t("Save Draft Labour Entry", "ڈرافٹ زچگی محفوظ کریں"),
    });
  };

  // Sign Entry (POST sign - rule:fe685a82bd)
  const handleSignEntry = () => {
    if (!currentEntry) return;

    // Client-side preflight check for missing fields
    const missing = evaluateMissingRequiredColumns(activeColumns, draftFieldValues, draftBabies);
    if (missing.length > 0) {
      setMissingFieldsAlert(missing.map((m) => m.label + (m.baby_no ? ` (Baby ${m.baby_no})` : "")));
    }

    write.start({
      path: `/maternity/labour-register/${currentEntry.entry_id}/sign`,
      method: "POST",
      permission: "maternity.record",
      protection: "reconcile",
      label: t("Sign & Freeze Labour Register Entry", "زچگی اندراج پر دستخط و حتمی توثیق"),
    });
  };

  // Print Birth Notification for Union Council (rule:b4fd64b49f)
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const handlePrintBirthNotification = async (babyNo: number) => {
    if (!currentEntry) return;
    setPrintNotice(null);
    try {
      await call("clinical-pdf", {
        path: `/maternity/labour-register/${currentEntry.entry_id}/babies/${babyNo}/birth-notification/pdf`,
      });
      setPrintNotice(
        t(
          `Birth notification PDF generated for Baby #${babyNo}. Provide to family for Union Council registration.`,
          `نوزائیدہ #${babyNo} کی پیدائش کی اطلاعی رپورٹ تیار کر لی گئی۔ یونین کونسل اندراج کے لیے والدین کے حوالے کریں۔`
        )
      );
    } catch {
      // Fallback direct api call
      try {
        await birthNotification(currentEntry.entry_id, babyNo);
        setPrintNotice(
          t(
            `Birth notification dispatched for Baby #${babyNo}. Hand over to family for Union Council.`,
            `نوزائیدہ #${babyNo} کی پیدائش کی اطلاع بھیج دی گئی۔ یونین کونسل کے لیے والدین کو فراہم کریں۔`
          )
        );
      } catch (err: any) {
        setPrintNotice(
          t("Failed to download birth notification PDF: ", "پیدائش کی اطلاعی رپورٹ ڈاؤنلوڈ نہ ہو سکی: ") +
            (err?.message || "Error")
        );
      }
    }
  };

  // Render Form Input by Field Kind (rule:1146a499b0)
  const renderFieldInput = (
    col: LabourFieldOut,
    values: Record<string, any>,
    section: DeliverySection,
    babyNo?: number,
    isReadOnly = false
  ) => {
    const val = values[col.code];
    const isReq = isColumnRequired(col, values);
    const hasError = missingFieldsAlert.some(
      (m) => m.toLowerCase().includes(col.label.toLowerCase())
    );

    const containerClass = `field-group ${hasError ? "field-error-highlight" : ""}`;

    return (
      <div key={col.code} className={containerClass} style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
          {col.label}
          {col.unit && <span style={{ color: "#6b7280", marginLeft: "0.35rem", fontSize: "0.8rem" }}>({col.unit})</span>}
          {isReq && <span style={{ color: "#dc2626", marginLeft: "0.25rem" }}>*</span>}
        </label>

        {col.source && (
          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.35rem" }}>
            {col.source}
          </div>
        )}

        {isReadOnly ? (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "4px",
              fontSize: "0.9rem",
              minHeight: "38px",
            }}
          >
            {Array.isArray(val)
              ? val.join(", ")
              : val !== undefined && val !== null && val !== ""
              ? String(val)
              : t("— Not Recorded —", "— درج نہیں —")}
          </div>
        ) : (
          <>
            {col.kind === "Number" && (
              <input
                type="number"
                data-help="labour_register.input_number"
                min={col.min_value !== null ? col.min_value : undefined}
                max={col.max_value !== null ? col.max_value : undefined}
                step="any"
                value={val !== undefined && val !== null ? val : ""}
                onChange={(e) =>
                  handleFieldChange(
                    section,
                    col.code,
                    e.target.value === "" ? null : Number(e.target.value),
                    babyNo
                  )
                }
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: hasError ? "1px solid #dc2626" : "1px solid #d1d5db",
                  borderRadius: "4px",
                }}
              />
            )}

            {col.kind === "YesNo" && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  data-help="labour_register.btn_yes"
                  onClick={() => handleFieldChange(section, col.code, "Yes", babyNo)}
                  style={{
                    flex: 1,
                    padding: "0.45rem",
                    borderRadius: "4px",
                    border: val === "Yes" ? "2px solid #2563eb" : "1px solid #d1d5db",
                    background: val === "Yes" ? "#eff6ff" : "#fff",
                    fontWeight: val === "Yes" ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {t("Yes", "ہاں")}
                </button>
                <button
                  type="button"
                  data-help="labour_register.btn_no"
                  onClick={() => handleFieldChange(section, col.code, "No", babyNo)}
                  style={{
                    flex: 1,
                    padding: "0.45rem",
                    borderRadius: "4px",
                    border: val === "No" ? "2px solid #2563eb" : "1px solid #d1d5db",
                    background: val === "No" ? "#eff6ff" : "#fff",
                    fontWeight: val === "No" ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {t("No", "نہیں")}
                </button>
              </div>
            )}

            {col.kind === "Choice" && (
              <select
                data-help="labour_register.select_choice"
                value={val || ""}
                onChange={(e) => handleFieldChange(section, col.code, e.target.value || null, babyNo)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: hasError ? "1px solid #dc2626" : "1px solid #d1d5db",
                  borderRadius: "4px",
                  background: "#fff",
                }}
              >
                <option value="">{t("— Select Option —", "— انتخاب کریں —")}</option>
                {(col.choices || []).map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            )}

            {col.kind === "MultiChoice" && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  background: "#f9fafb",
                  border: hasError ? "1px solid #dc2626" : "1px solid #e5e7eb",
                  borderRadius: "4px",
                }}
              >
                {(col.choices || []).map((ch) => {
                  const arr = Array.isArray(val) ? val : [];
                  const checked = arr.includes(ch);
                  return (
                    <label
                      key={ch}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        data-help="labour_register.checkbox_multichoice"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...arr, ch]
                            : arr.filter((x: string) => x !== ch);
                          handleFieldChange(section, col.code, next, babyNo);
                        }}
                      />
                      {ch}
                    </label>
                  );
                })}
              </div>
            )}

            {col.kind === "Date" && (
              <input
                type="date"
                data-help="labour_register.input_date"
                value={val || ""}
                onChange={(e) => handleFieldChange(section, col.code, e.target.value || null, babyNo)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: hasError ? "1px solid #dc2626" : "1px solid #d1d5db",
                  borderRadius: "4px",
                }}
              />
            )}

            {col.kind === "Text" && (
              <input
                type="text"
                data-help="labour_register.input_text"
                value={val || ""}
                onChange={(e) => handleFieldChange(section, col.code, e.target.value || null, babyNo)}
                placeholder={t("Enter text...", "متن درج کریں...")}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: hasError ? "1px solid #dc2626" : "1px solid #d1d5db",
                  borderRadius: "4px",
                }}
              />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="labour-register-container" style={{ padding: "1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header and Capability Banners */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>{t("Labour Ward Register & Partograph", "لیبر وارڈ رجسٹر اور پارٹوگراف")}</span>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                background: screenView === "full" ? "#dcfce7" : screenView === "open_work" ? "#fef3c7" : "#f3f4f6",
                color: screenView === "full" ? "#166534" : screenView === "open_work" ? "#92400e" : "#374151",
              }}
            >
              {screenView.toUpperCase()}
            </span>
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
            {t(
              "Punjab HMIS delivery register, partograph review, bedside liveborn identification & Union Council notification",
              "پنجاب ایچ ایم آئی ایس زچگی رجسٹر، پارٹوگراف، نوزائیدہ شناخت اور یونین کونسل پیدائش اطلاعی رپورٹ"
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {viewMode === "entry_detail" && (
            <button
              type="button"
              data-help="labour_register.btn_back_worklist"
              onClick={() => {
                setViewMode("worklist");
                setSelectedEntryId(null);
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "4px",
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              {t("← Back to Register Worklist", "← رجسٹر لسٹ پر واپس")}
            </button>
          )}

          {canRecord && screenView !== "records" && (
            <button
              type="button"
              data-help="labour_register.btn_new_delivery"
              onClick={() => setNewModalOpen(true)}
              disabled={!maternityActive}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "4px",
                border: "none",
                background: maternityActive ? "#2563eb" : "#9ca3af",
                color: "#fff",
                fontWeight: 600,
                cursor: maternityActive ? "pointer" : "not-allowed",
              }}
            >
              {t("+ Record New Delivery", "+ نئی زچگی درج کریں")}
            </button>
          )}

          <button
            type="button"
            data-help="labour_register.btn_refresh"
            onClick={() => setRevision((r) => r + 1)}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {t("Refresh", "تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Retiring / Capability Notices */}
      {screenView === "open_work" && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "6px",
            color: "#92400e",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          <strong>{t("Maternity Service Retiring: ", "زچگی سروس ختم کی جا رہی ہے: ")}</strong>
          {t(
            "No new delivery registrations from now on. Existing open labour entries may be completed, signed and printed.",
            "اب مزید نئی زچگی درج نہیں ہوگی۔ موجودہ اوپن کیسز مکمل، سائن اور پرنٹ کیے جا سکتے ہیں۔"
          )}
        </div>
      )}

      {screenView === "records" && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            color: "#374151",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          <strong>{t("Records Only: ", "صرف تاریخی ریکارڈ: ")}</strong>
          {t(
            "Maternity service is retired. Viewing delivery records and printing Union Council notifications only.",
            "زچگی سروس ریٹائر ہو چکی ہے۔ صرف پرانے ریکارڈ دیکھنا اور یونین کونسل سلپ پرنٹ کرنا ممکن ہے۔"
          )}
        </div>
      )}

      {realtimeNotice && (
        <div
          style={{
            padding: "0.5rem 1rem",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            color: "#1e40af",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{realtimeNotice}</span>
          <button
            type="button"
            data-help="labour_register.btn_dismiss_realtime"
            onClick={() => setRealtimeNotice(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#1e40af" }}
          >
            ×
          </button>
        </div>
      )}

      <ClinicalWriteFeedback write={write} />

      {/* ========================================================================= */}
      {/* MODE 1: REGISTER WORKLIST                                                 */}
      {/* ========================================================================= */}
      {viewMode === "worklist" && (
        <div>
          {/* Query Filters */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              background: "#f9fafb",
              padding: "1rem",
              borderRadius: "6px",
              marginBottom: "1rem",
              border: "1px solid #e5e7eb",
              alignItems: "flex-end",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#4b5563", marginBottom: "0.25rem" }}>
                {t("From Date", "تاریخ سے")}
              </label>
              <input
                type="date"
                data-help="labour_register.filter_date_from"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                style={{ padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#4b5563", marginBottom: "0.25rem" }}>
                {t("To Date", "تاریخ تک")}
              </label>
              <input
                type="date"
                data-help="labour_register.filter_date_to"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                style={{ padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#4b5563", marginBottom: "0.25rem" }}>
                {t("Status", "حیثیت")}
              </label>
              <select
                data-help="labour_register.filter_status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                style={{ padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px", background: "#fff" }}
              >
                <option value="All">{t("All Deliveries", "تمام ریکارڈز")}</option>
                <option value="Draft">{t("Draft (In Progress)", "ڈرافٹ (جاری)")}</option>
                <option value="Signed">{t("Signed (Frozen)", "دستخط شدہ (حتمی)")}</option>
              </select>
            </div>
          </div>

          {/* Worklist Table */}
          {entriesLoad.loading ? (
            <LoadState
              loading={entriesLoad.loading}
              error={entriesLoad.error}
              retry={entriesLoad.reload}
            />
          ) : entriesLoad.error ? (
            <ErrorBox error={entriesLoad.error} />
          ) : !entriesLoad.data || entriesLoad.data.length === 0 ? (
            <Empty>
              {t(
                "No delivery entries found in the selected date period.",
                "منتخب مدت میں زچگی کا کوئی اندراج نہیں ملا۔"
              )}
            </Empty>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <tr>
                    <th style={{ padding: "0.75rem 1rem" }}>{t("Entry No.", "اندراج نمبر")}</th>
                    <th style={{ padding: "0.75rem 1rem" }}>{t("Delivered At", "پیدائش کا وقت")}</th>
                    <th style={{ padding: "0.75rem 1rem" }}>{t("Mother / MRN", "والدہ کا نام / ایم آر این")}</th>
                    <th style={{ padding: "0.75rem 1rem" }}>{t("Admission", "داخلہ نمبر")}</th>
                    <th style={{ padding: "0.75rem 1rem" }}>{t("Attended By", "نگران عملہ")}</th>
                    <th style={{ padding: "0.75rem 1rem" }}>{t("Babies", "بچے")}</th>
                    <th style={{ padding: "0.75rem 1rem" }}>{t("Status", "حیثیت")}</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>{t("Action", "عمل")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entriesLoad.data.map((item: LabourEntryOut) => {
                    const isSigned = item.status === "Signed";
                        return (
                          <tr
                            key={item.entry_id}
                            style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                            onClick={() => {
                              setSelectedEntryId(item.entry_id);
                              setViewMode("entry_detail");
                            }}
                          >
                            <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#2563eb" }}>
                              {item.entry_number}
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              {new Date(item.delivered_at).toLocaleString()}
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <div style={{ fontWeight: 600 }}>{item.mother_name}</div>
                              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>MRN: {item.mrn}</div>
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>{item.admission_number}</td>
                            <td style={{ padding: "0.75rem 1rem" }}>{item.attended_by_name}</td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "0.15rem 0.5rem",
                                  background: "#eff6ff",
                                  borderRadius: "12px",
                                  fontSize: "0.8rem",
                                  color: "#1d4ed8",
                                }}
                              >
                                {item.babies?.length || 1} {t("baby", "بچہ")}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <span
                                style={{
                                  padding: "0.2rem 0.6rem",
                                  borderRadius: "4px",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  background: isSigned ? "#dcfce7" : "#fef3c7",
                                  color: isSigned ? "#166534" : "#92400e",
                                }}
                              >
                                {isSigned ? t("Signed", "دستخط شدہ") : t("Draft", "ڈرافٹ")}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                              <button
                                type="button"
                                data-help="labour_register.btn_open_entry"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEntryId(item.entry_id);
                                  setViewMode("entry_detail");
                                }}
                                style={{
                                  padding: "0.35rem 0.75rem",
                                  borderRadius: "4px",
                                  border: "1px solid #d1d5db",
                                  background: "#fff",
                                  fontSize: "0.85rem",
                                  cursor: "pointer",
                                }}
                              >
                                {isSigned ? t("View", "دیکھیں") : t("Edit Draft", "ڈرافٹ تدوین")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

      {/* ========================================================================= */}
      {/* MODE 2: ENTRY DETAIL & DYNAMIC FORM (rule:1146a499b0, rule:fe685a82bd)    */}
      {/* ========================================================================= */}
      {viewMode === "entry_detail" && selectedEntryId && (
        selectedEntryLoad.loading ? (
          <LoadState
            loading={selectedEntryLoad.loading}
            error={selectedEntryLoad.error}
            retry={selectedEntryLoad.reload}
          />
        ) : selectedEntryLoad.error ? (
          <ErrorBox error={selectedEntryLoad.error} />
        ) : !currentEntry ? (
          <Empty>{t("Delivery entry not found.", "زچگی اندراج نہیں ملا۔")}</Empty>
        ) : (() => {
          const entry = currentEntry;
          const isSigned = entry.status === "Signed";
          const babiesList: (LabourBabyOut | LabourBabyIn)[] = isSigned ? entry.babies : draftBabies;

          return (
            <div>
                {/* Entry Meta Card */}
                <div
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "1.25rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{entry.entry_number}</h2>
                        <span
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "4px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            background: isSigned ? "#dcfce7" : "#fef3c7",
                            color: isSigned ? "#166534" : "#92400e",
                          }}
                        >
                          {isSigned ? t("Signed & Frozen", "دستخط شدہ و حتمی") : t("Draft — Editable", "ڈرافٹ — قابل تدوین")}
                        </span>
                      </div>
                      <div style={{ marginTop: "0.5rem", fontSize: "0.95rem", color: "#374151" }}>
                        <strong>{t("Mother: ", "والدہ: ")}</strong>
                        {entry.mother_name} (MRN: {entry.mrn}) •{" "}
                        <strong>{t("Admission: ", "داخلہ: ")}</strong>
                        {entry.admission_number}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "0.85rem", color: "#6b7280" }}>
                      <div>
                        {t("Attended by: ", "نگران عملہ: ")}
                        <strong style={{ color: "#111827" }}>{entry.attended_by_name}</strong>
                      </div>
                      <div>
                        {t("Recorded: ", "اندراج وقت: ")}
                        {new Date(entry.recorded_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Author Stamp Display for Signed Entry (rule:fe685a82bd) */}
                  {isSigned && entry.author_stamp && (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "0.75rem",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        color: "#166534",
                      }}
                    >
                      <strong>{t("Signer Stamp (MSDS IMS 147): ", "دستخط مہر (ایم ایس ڈی ایس): ")}</strong>
                      {formatAuthorStamp(entry.author_stamp)}
                    </div>
                  )}

                  {/* Print Notice feedback */}
                  {printNotice && (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "0.75rem",
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "6px",
                        color: "#1d4ed8",
                        fontSize: "0.85rem",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{printNotice}</span>
                      <button
                        type="button"
                        data-help="labour_register.btn_dismiss_print_notice"
                        onClick={() => setPrintNotice(null)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8" }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Incomplete warning banner */}
                  {missingFieldsAlert.length > 0 && (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "0.75rem 1rem",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: "6px",
                        color: "#991b1b",
                        fontSize: "0.9rem",
                      }}
                    >
                      <strong>{t("Incomplete Register Columns: ", "نامکمل کالمز: ")}</strong>
                      {t("Please complete the following required fields before signing: ", "دستخط کرنے سے پہلے درج ذیل کالم پر کریں: ")}
                      <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                        {missingFieldsAlert.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Form Sections (rule:1146a499b0) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
                  {/* Delivery Metadata (Delivered At & Attended By) */}
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "1.25rem",
                    }}
                  >
                    <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                      {t("Delivery Metadata", "پیدائش بنیادی معلومات")}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                      <div>
                        <label style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                          {t("Delivery Date & Time", "پیدائش کی تاریخ اور وقت")}
                        </label>
                        {isSigned ? (
                          <div style={{ padding: "0.5rem", background: "#f9fafb", borderRadius: "4px" }}>
                            {new Date(entry.delivered_at).toLocaleString()}
                          </div>
                        ) : (
                          <input
                            type="datetime-local"
                            data-help="labour_register.input_delivered_at"
                            value={draftDeliveredAt}
                            onChange={(e) => setDraftDeliveredAt(e.target.value)}
                            style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                          {t("Attending Staff", "نگران ڈاکٹر / ایل ایچ وی / مڈوائف")}
                        </label>
                        {isSigned ? (
                          <div style={{ padding: "0.5rem", background: "#f9fafb", borderRadius: "4px" }}>
                            {entry.attended_by_name}
                          </div>
                        ) : (
                          <select
                            data-help="labour_register.select_attended_by"
                            value={draftAttendedBy || ""}
                            onChange={(e) => setDraftAttendedBy(Number(e.target.value))}
                            style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "4px", background: "#fff" }}
                          >
                            {staffList.map((s) => (
                              <option key={s.employee_id} value={s.employee_id}>
                                {s.name} {s.designation ? `(${s.designation})` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Admission & Baseline */}
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.25rem" }}>
                    <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                      {t(SECTION_TITLES.Admission.en, SECTION_TITLES.Admission.ur)}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                      {groupedColumns.Admission.map((col) =>
                        renderFieldInput(
                          col,
                          isSigned ? entry.field_values : draftFieldValues,
                          "Admission",
                          undefined,
                          isSigned
                        )
                      )}
                    </div>
                  </div>

                  {/* Section 2: Delivery & Labour Progress (Partograph) */}
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.25rem" }}>
                    <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                      {t(SECTION_TITLES.Delivery.en, SECTION_TITLES.Delivery.ur)}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                      {groupedColumns.Delivery.map((col) =>
                        renderFieldInput(
                          col,
                          isSigned ? entry.field_values : draftFieldValues,
                          "Delivery",
                          undefined,
                          isSigned
                        )
                      )}
                    </div>
                  </div>

                  {/* Section 3: Mother Post-Delivery */}
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.25rem" }}>
                    <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                      {t(SECTION_TITLES.Mother.en, SECTION_TITLES.Mother.ur)}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                      {groupedColumns.Mother.map((col) =>
                        renderFieldInput(
                          col,
                          isSigned ? entry.field_values : draftFieldValues,
                          "Mother",
                          undefined,
                          isSigned
                        )
                      )}
                    </div>
                  </div>

                  {/* Section 4: Babies Particulars (rule:632b575029, rule:b4fd64b49f) */}
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                        {t(SECTION_TITLES.Baby.en, SECTION_TITLES.Baby.ur)}
                      </h3>
                      {!isSigned && (
                        <button
                          type="button"
                          data-help="labour_register.btn_add_twin"
                          onClick={handleAddBaby}
                          style={{
                            padding: "0.35rem 0.75rem",
                            borderRadius: "4px",
                            border: "1px solid #2563eb",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {t("+ Add Twin / Triplet Baby", "+ جڑواں / زائد بچہ شامل کریں")}
                        </button>
                      )}
                    </div>

                    {/* Baby Tabs for Multiples */}
                    {babiesList.length > 1 && (
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem" }}>
                        {babiesList.map((b) => (
                          <button
                            key={b.baby_no}
                            type="button"
                            data-help="labour_register.tab_baby"
                            onClick={() => setActiveBabyTab(b.baby_no)}
                            style={{
                              padding: "0.4rem 0.85rem",
                              borderRadius: "4px",
                              border: activeBabyTab === b.baby_no ? "2px solid #2563eb" : "1px solid #d1d5db",
                              background: activeBabyTab === b.baby_no ? "#eff6ff" : "#fff",
                              fontWeight: activeBabyTab === b.baby_no ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            {t(`Baby #${b.baby_no}`, `بچہ #${b.baby_no}`)}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Active Baby Card */}
                    {babiesList
                      .filter((b) => b.baby_no === activeBabyTab)
                      .map((baby) => {
                        const isLiveborn = baby.newborn_patient_id !== null && baby.newborn_patient_id !== undefined;

                        return (
                          <div key={baby.baby_no}>
                            {/* Liveborn vs Stillbirth Identification Bar */}
                            <div
                              style={{
                                padding: "0.75rem",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                marginBottom: "1rem",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                                    {t(`Baby #${baby.baby_no}: `, `بچہ #${baby.baby_no}: `)}
                                  </span>
                                  {isLiveborn ? (
                                    <span style={{ color: "#166534", fontWeight: 600 }}>
                                      {t("Born Alive (Registered Patient ID: ", "زندہ پیدا ہوا (مریض شناختی نمبر: ")}
                                      {baby.newborn_patient_id})
                                    </span>
                                  ) : (
                                    <span style={{ color: "#6b7280" }}>
                                      {t("Stillbirth (No separate patient record)", "مردہ پیدائش (علیحدہ مریض ریکارڈ نہیں)")}
                                    </span>
                                  )}
                                </div>

                                {/* Union Council Notification Slip Print Button (rule:b4fd64b49f) */}
                                {isSigned && isLiveborn && (
                                  <button
                                    type="button"
                                    data-help="labour_register.btn_print_birth_notification"
                                    onClick={() => handlePrintBirthNotification(baby.baby_no)}
                                    style={{
                                      padding: "0.45rem 1rem",
                                      borderRadius: "4px",
                                      border: "none",
                                      background: "#16a34a",
                                      color: "#fff",
                                      fontWeight: 600,
                                      fontSize: "0.85rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {t("🖨️ Print Union Council Birth Notification", "🖨️ یونین کونسل پیدائش اطلاعی سلپ پرنٹ")}
                                  </button>
                                )}
                              </div>

                              {/* Prompt explaining Union Council rule (rule:b4fd64b49f) */}
                              {isSigned && isLiveborn && (
                                <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#166534" }}>
                                  {t(
                                    "Note: Give this official birth notification to the family for Union Council birth certificate registration. Never refer to this document as a birth certificate.",
                                    "نوٹ: یونین کونسل اندراج کے لیے یہ سرکاری اطلاعی سلپ والدین کو فراہم کریں۔ اسے برتھ سرٹیفکیٹ نہ کہیں۔"
                                  )}
                                </p>
                              )}

                              {/* Draft linking of newborn */}
                              {!isSigned && (
                                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                                  <label style={{ fontSize: "0.85rem", color: "#374151" }}>
                                    {t("Liveborn Newborn Link: ", "زندہ نوزائیدہ کا تعلق: ")}
                                  </label>
                                  <select
                                    data-help="labour_register.select_newborn_link"
                                    value={baby.newborn_patient_id || ""}
                                    onChange={(e) =>
                                      handleLinkNewborn(
                                        baby.baby_no,
                                        e.target.value ? Number(e.target.value) : null
                                      )
                                    }
                                    style={{ padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid #d1d5db", background: "#fff" }}
                                  >
                                    <option value="">{t("Stillbirth (No newborn record)", "مردہ پیدائش (کوئی نوزائیدہ ریکارڈ نہیں)")}</option>
                                    {motherNewborns.map((nb) => (
                                      <option key={nb.patient_id} value={nb.patient_id}>
                                        {nb.full_name} ({nb.gender}, born {new Date(nb.born_at).toLocaleTimeString()}) - MRN: {nb.mrn}
                                      </option>
                                    ))}
                                  </select>

                                  {onNavigateScreen && (
                                    <button
                                      type="button"
                                      data-help="labour_register.btn_nav_newborn"
                                      onClick={() => onNavigateScreen("newborn_registration")}
                                      style={{
                                        padding: "0.35rem 0.65rem",
                                        borderRadius: "4px",
                                        border: "1px solid #d1d5db",
                                        background: "#fff",
                                        fontSize: "0.8rem",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {t("Bedside Newborn Registration →", "بیڈ سائیڈ نوزائیدہ رجسٹریشن →")}
                                    </button>
                                  )}

                                  {draftBabies.length > 1 && (
                                    <button
                                      type="button"
                                      data-help="labour_register.btn_remove_baby"
                                      onClick={() => handleRemoveBaby(baby.baby_no)}
                                      style={{
                                        padding: "0.35rem 0.65rem",
                                        borderRadius: "4px",
                                        border: "1px solid #dc2626",
                                        background: "#fef2f2",
                                        color: "#dc2626",
                                        fontSize: "0.8rem",
                                        cursor: "pointer",
                                        marginLeft: "auto",
                                      }}
                                    >
                                      {t("Remove Baby", "بچہ خارج کریں")}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Dynamic Baby Columns */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                              {groupedColumns.Baby.map((col) =>
                                renderFieldInput(
                                  col,
                                  baby.field_values || {},
                                  "Baby",
                                  baby.baby_no,
                                  isSigned
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Section 5: Discharge & Follow-Up */}
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.25rem" }}>
                    <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                      {t(SECTION_TITLES.Discharge.en, SECTION_TITLES.Discharge.ur)}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                      {groupedColumns.Discharge.map((col) =>
                        renderFieldInput(
                          col,
                          isSigned ? entry.field_values : draftFieldValues,
                          "Discharge",
                          undefined,
                          isSigned
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Bar (Draft Operations - rule:fe685a82bd) */}
                {!isSigned && canRecord && screenView !== "records" && (
                  <div
                    style={{
                      position: "sticky",
                      bottom: "1rem",
                      background: "#fff",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      padding: "1rem 1.5rem",
                      marginTop: "2rem",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: "#92400e" }}>
                        {t("Draft Mode: ", "ڈرافٹ موڈ: ")}
                      </span>
                      <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                        {t(
                          "Save draft as labour progresses. Signing permanently freezes the record.",
                          "درد زہ کی پیشرفت کے ساتھ ڈرافٹ محفوظ کریں۔ دستخط کے بعد اندراج حتمی ہو جائے گا۔"
                        )}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button
                        type="button"
                        data-help="labour_register.btn_save_draft"
                        onClick={handleSaveDraft}
                        style={{
                          padding: "0.6rem 1.25rem",
                          borderRadius: "4px",
                          border: "1px solid #d1d5db",
                          background: "#fff",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {t("Save Draft", "ڈرافٹ محفوظ کریں")}
                      </button>

                      <button
                        type="button"
                        data-help="labour_register.btn_sign_entry"
                        onClick={handleSignEntry}
                        style={{
                          padding: "0.6rem 1.5rem",
                          borderRadius: "4px",
                          border: "none",
                          background: "#16a34a",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {t("Sign & Freeze Entry", "دستخط و حتمی اندراج")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD NEW DELIVERY (POST /maternity/labour-register)              */}
      {/* ========================================================================= */}
      {newModalOpen && (
        <Modal
          title={t("Record Delivery in Labour Register", "لیبر رجسٹر میں زچگی کا اندراج")}
          onClose={() => setNewModalOpen(false)}
        >
          <div style={{ padding: "1rem" }}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#6b7280" }}>
              {t(
                "Initiates a new delivery entry in the labour register. Attending staff and time of birth will be logged.",
                "لیبر رجسٹر میں زچگی کا نیا اندراج شروع کرتا ہے۔ پیدائش کا وقت اور نگران عملہ لاگ ہوں گے۔"
              )}
            </p>

            {newValidationErrors.length > 0 && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  color: "#991b1b",
                  marginBottom: "1rem",
                  fontSize: "0.85rem",
                }}
              >
                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  {newValidationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mother Admission Lookup */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                {t("Mother's Admission Context", "والدہ کا داخلہ")}
              </label>
              <form onSubmit={handleSearchMotherAdmission} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="text"
                  data-help="labour_register.input_mother_search"
                  value={newMotherSearchQuery}
                  onChange={(e) => setNewMotherSearchQuery(e.target.value)}
                  placeholder={t("Search admitted mother by MRN or name...", "ایم آر این یا نام سے تلاش کریں...")}
                  style={{ flex: 1, padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
                />
                <button
                  type="submit"
                  data-help="labour_register.btn_mother_search"
                  disabled={newMotherSearching}
                  style={{
                    padding: "0.45rem 0.85rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {newMotherSearching ? t("Searching...", "تلاش جاری...") : t("Search", "تلاش")}
                </button>
              </form>

              {newMotherSearchResults.length > 0 && (
                <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "4px", marginBottom: "0.5rem" }}>
                  {newMotherSearchResults.map((m) => (
                    <div
                      key={m.admission_id}
                      onClick={() => {
                        setNewAdmissionId(m.admission_id);
                        setNewSelectedMother(m);
                        setNewMotherSearchResults([]);
                      }}
                      style={{
                        padding: "0.45rem 0.75rem",
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer",
                        background: newAdmissionId === m.admission_id ? "#eff6ff" : "#fff",
                      }}
                    >
                      <strong>{m.name}</strong> (MRN: {m.mrn}) — Admission: {m.admission_number}
                    </div>
                  ))}
                </div>
              )}

              {newSelectedMother ? (
                <div style={{ padding: "0.5rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "4px", fontSize: "0.85rem" }}>
                  ✓ {newSelectedMother.name} (MRN: {newSelectedMother.mrn}) — Admission #{newSelectedMother.admission_id}
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="number"
                    data-help="labour_register.input_admission_id"
                    value={newAdmissionId || ""}
                    onChange={(e) => setNewAdmissionId(Number(e.target.value))}
                    placeholder={t("Or enter Admission ID directly...", "یا داخلہ نمبر درج کریں...")}
                    style={{ width: "200px", padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    {t("(Active ward/maternity admission)", "(زچگی یا وارڈ میں فعال داخلہ)")}
                  </span>
                </div>
              )}
            </div>

            {/* Delivered At */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                {t("Delivery Date & Time", "پیدائش کی تاریخ اور وقت")}
              </label>
              <input
                type="datetime-local"
                data-help="labour_register.input_new_delivered_at"
                value={newDeliveredAt}
                onChange={(e) => setNewDeliveredAt(e.target.value)}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
              />
            </div>

            {/* Attended By */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                {t("Attending Staff Member", "نگران عملہ")}
              </label>
              <select
                data-help="labour_register.select_new_attended_by"
                value={newAttendedBy}
                onChange={(e) => setNewAttendedBy(Number(e.target.value))}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px", background: "#fff" }}
              >
                {staffList.map((s) => (
                  <option key={s.employee_id} value={s.employee_id}>
                    {s.name} {s.designation ? `(${s.designation})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                data-help="labour_register.btn_cancel_new"
                onClick={() => setNewModalOpen(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {t("Cancel", "منسوخ")}
              </button>

              <button
                type="button"
                data-help="labour_register.btn_submit_new"
                onClick={handleCreateNewDelivery}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "4px",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("Create Delivery Entry", "زچگی اندراج شروع کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
