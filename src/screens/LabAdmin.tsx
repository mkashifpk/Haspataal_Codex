/**
 * Screen 139: lab_admin
 * "Lab administration"
 * Workspace: `lab_admin`, Position: 139, Points: 76.
 *
 * Statutory & Quality Rules:
 * - rule:26ecdbf976: A metric schema editor builds metric_schema (key, label, unit, ref ranges,
 *                    critical: low/high for a number, values for a text metric such as Positive).
 * - rule:c8be844050: Per test (MSDS AAC 1, 4-6): turnaround_minutes (routine) and emergency_turnaround_minutes
 *                    (Urgent, STAT; empty: the hospital defaults), availability InHouse or SendOut with
 *                    send_out_partner_id (GET /diagnostic-partners?services=Lab), available_24h for the
 *                    basic tests, notifiable_disease for a test whose positive result is a priority disease.
 * - rule:0f8b607b2c: Exists for the service laboratory or outsourced_diagnostics (setup): show it as
 *                    GET /establishment views.screens says for screen_id lab_admin (full; open_work: without
 *                    its new work, with the banner "No new ... from now on"; records: history and corrections
 *                    only; setup: only from Facility settings; hidden: in no menu), after login and again
 *                    on establishment.changed. Never decide it from the profile's category.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  listTests,
  createTest,
  updateTest,
  setPrice,
  getBom,
  putBom,
  reagents as getReagents,
  createReagent,
  receiveBatch,
  adjustReagent,
  dashboard as getDashboard,
  setContractor,
  lookupStaff,
  type LabTestListItemOut,
  type LabTestIn,
  type LabTestUpdate,
  type MetricDef,
  type PriceIn,
  type BomLineOut,
  type BomLineIn,
  type ReagentStockOut,
  type ReagentIn,
  type ReagentBatchIn,
  type ReagentAdjustIn,
  type LabDashboardOut,
  type ContractorIn,
  type StaffLookupOut,
} from "../generated/lab_admin";
import { api } from "../generated/api";
import {
  getLabAdminCapabilityView,
  validateLabTestInput,
  validateLabTestUpdate,
  validateMetricSchema,
  validateBomInput,
  validateReagentInput,
  validateReagentBatchInput,
  validateReagentAdjustInput,
  validateContractorInput,
  createDefaultMetric,
  LAB_ADMIN_ERROR_MESSAGES,
  TEST_SECTIONS,
  SAMPLE_TYPES,
  COMMON_NOTIFIABLE_DISEASES,
  REAGENT_ADJUST_REASONS,
  type LabAdminCapabilityView,
} from "../lab-admin-policy";

export interface LabAdminProps {
  user: {
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

type ActiveTab = "tests" | "reagents" | "dashboard";

interface DiagnosticPartner {
  partner_id: number;
  name: string;
  services: string;
  mou_expired?: boolean;
  is_active?: boolean;
}

export const LabAdmin: React.FC<LabAdminProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  const capabilityView: LabAdminCapabilityView = useMemo(
    () => getLabAdminCapabilityView(establishment),
    [establishment]
  );

  const canManageTests = useMemo(
    () =>
      user.roles.includes("owner") ||
      user.roles.includes("lab_admin") ||
      user.permissions.includes("lab.test.manage"),
    [user]
  );

  const canUpdatePrice = useMemo(
    () =>
      user.roles.includes("owner") ||
      user.roles.includes("lab_admin") ||
      user.permissions.includes("lab.price.update"),
    [user]
  );

  const canManageBom = useMemo(
    () =>
      user.roles.includes("owner") ||
      user.roles.includes("lab_admin") ||
      user.permissions.includes("lab.bom.manage"),
    [user]
  );

  const canManageReagents = useMemo(
    () =>
      user.roles.includes("owner") ||
      user.roles.includes("lab_admin") ||
      user.permissions.includes("lab.reagent.manage"),
    [user]
  );

  const canViewDashboard = useMemo(
    () =>
      user.roles.includes("owner") ||
      user.roles.includes("lab_admin") ||
      user.permissions.includes("lab.dashboard.view"),
    [user]
  );

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>("tests");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Data states
  const [tests, setTests] = useState<LabTestListItemOut[]>([]);
  const [reagentsList, setReagentsList] = useState<ReagentStockOut[]>([]);
  const [dashboardData, setDashboardData] = useState<LabDashboardOut | null>(null);
  const [partners, setPartners] = useState<DiagnosticPartner[]>([]);

  // Filter dates for dashboard
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  // Modal states
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [showEditTestModal, setShowEditTestModal] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTestListItemOut | null>(null);

  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pricingTest, setPricingTest] = useState<LabTestListItemOut | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [priceReason, setPriceReason] = useState("");

  const [showBomModal, setShowBomModal] = useState(false);
  const [bomTest, setBomTest] = useState<LabTestListItemOut | null>(null);
  const [bomLines, setBomLines] = useState<BomLineIn[]>([]);
  const [selectedBomReagentId, setSelectedBomReagentId] = useState<number>(0);
  const [bomQtyPerTest, setBomQtyPerTest] = useState("1");

  const [showAddReagentModal, setShowAddReagentModal] = useState(false);
  const [showReceiveBatchModal, setShowReceiveBatchModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Test form fields
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formSection, setFormSection] = useState("General");
  const [formSampleType, setFormSampleType] = useState("Blood");
  const [formPrice, setFormPrice] = useState("0");
  const [formTurnaround, setFormTurnaround] = useState("");
  const [formEmergencyTurnaround, setFormEmergencyTurnaround] = useState("");
  const [formAvailability, setFormAvailability] = useState<"InHouse" | "SendOut">("InHouse");
  const [formSendOutPartnerId, setFormSendOutPartnerId] = useState<number | null>(null);
  const [formAvailable24h, setFormAvailable24h] = useState(false);
  const [formNotifiableDisease, setFormNotifiableDisease] = useState("");
  const [formMetrics, setFormMetrics] = useState<MetricDef[]>([createDefaultMetric()]);

  // Reagent form fields
  const [reagentCode, setReagentCode] = useState("");
  const [reagentName, setReagentName] = useState("");
  const [reagentUnit, setReagentUnit] = useState("ml");
  const [reagentThreshold, setReagentThreshold] = useState("10");
  const [reagentNearExpiryDays, setReagentNearExpiryDays] = useState("90");

  // Receive Batch form fields
  const [batchReagentId, setBatchReagentId] = useState<number>(0);
  const [batchNo, setBatchNo] = useState("");
  const [batchExpiry, setBatchExpiry] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  });
  const [batchQty, setBatchQty] = useState("100");
  const [batchTotalCost, setBatchTotalCost] = useState("0");
  const [batchVendorInvoiceId, setBatchVendorInvoiceId] = useState("");

  // Adjustment form fields
  const [adjustBatchId, setAdjustBatchId] = useState("");
  const [adjustQty, setAdjustQty] = useState("1");
  const [adjustReason, setAdjustReason] = useState<"Adjustment" | "Expiry" | "Damage">("Expiry");
  const [adjustNote, setAdjustNote] = useState("");

  // Contractor Agreement form fields
  const [staffQuery, setStaffQuery] = useState("");
  const [staffResults, setStaffResults] = useState<StaffLookupOut[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [hospitalSharePct, setHospitalSharePct] = useState("60");
  const [contractorEffectiveFrom, setContractorEffectiveFrom] = useState(() => new Date().toISOString().split("T")[0]);

  // Fetch tests
  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTests(searchQuery ? { q: searchQuery } : undefined);
      setTests(data);
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to load tests";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Fetch reagents
  const fetchReagents = useCallback(async () => {
    if (!canManageReagents && !canManageBom) return;
    try {
      const data = await getReagents();
      setReagentsList(data);
    } catch (err: any) {
      console.warn("Could not load reagents", err);
    }
  }, [canManageReagents, canManageBom]);

  // Fetch dashboard
  const fetchDashboard = useCallback(async () => {
    if (!canViewDashboard) return;
    try {
      const data = await getDashboard({
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setDashboardData(data);
    } catch (err: any) {
      console.warn("Could not load lab dashboard", err);
    }
  }, [canViewDashboard, dateFrom, dateTo]);

  // Fetch partners for SendOut
  const fetchPartners = useCallback(async () => {
    try {
      const res = await api<DiagnosticPartner[]>("GET", "/diagnostic-partners?services=Lab");
      setPartners(res || []);
    } catch (e) {
      // Diagnostic partners may not yet have entries
      setPartners([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTests();
    fetchReagents();
    fetchPartners();
  }, [fetchTests, fetchReagents, fetchPartners]);

  // Load dashboard when tab selected
  useEffect(() => {
    if (activeTab === "dashboard") {
      fetchDashboard();
    }
  }, [activeTab, fetchDashboard]);

  // Realtime subscription
  useEffect(() => {
    const handleEvent = (e: any) => {
      if (e?.detail?.topic === "lab.reagent.low_stock") {
        fetchReagents();
        fetchTests();
        if (activeTab === "dashboard") fetchDashboard();
        setStatusMessage({ text: "Reagent stock alert received: inventory refreshed automatically.", isError: false });
      }
    };
    window.addEventListener("haspataal:realtime", handleEvent);
    return () => window.removeEventListener("haspataal:realtime", handleEvent);
  }, [fetchReagents, fetchTests, fetchDashboard, activeTab]);

  // Reset Add Test modal
  const handleOpenAddTest = () => {
    setFormCode("");
    setFormName("");
    setFormSection("General");
    setFormSampleType("Blood");
    setFormPrice("0");
    setFormTurnaround("");
    setFormEmergencyTurnaround("");
    setFormAvailability("InHouse");
    setFormSendOutPartnerId(null);
    setFormAvailable24h(false);
    setFormNotifiableDisease("");
    setFormMetrics([createDefaultMetric()]);
    setShowAddTestModal(true);
  };

  // Metric Schema Editor Actions
  const handleAddMetric = () => {
    setFormMetrics((prev) => [
      ...prev,
      createDefaultMetric({
        key: `metric_${prev.length + 1}`,
        label: `Parameter ${prev.length + 1}`,
      }),
    ]);
  };

  const handleRemoveMetric = (index: number) => {
    if (formMetrics.length <= 1) return;
    setFormMetrics((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMetric = (index: number, patch: Partial<MetricDef>) => {
    setFormMetrics((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m))
    );
  };

  // Submit Add Test
  const handleSubmitAddTest = async () => {
    const payload: LabTestIn = {
      code: formCode.trim(),
      name: formName.trim(),
      section: formSection,
      sample_type: formSampleType,
      metric_schema: formMetrics,
      price: Number(formPrice) || 0,
      turnaround_minutes: formTurnaround ? Number(formTurnaround) : null,
      emergency_turnaround_minutes: formEmergencyTurnaround ? Number(formEmergencyTurnaround) : null,
      availability: formAvailability,
      send_out_partner_id: formAvailability === "SendOut" ? formSendOutPartnerId : null,
      available_24h: formAvailable24h,
      notifiable_disease: formNotifiableDisease.trim() || null,
    };

    const val = validateLabTestInput(payload);
    if (!val.valid) {
      const firstErr = Object.values(val.errors)[0];
      setStatusMessage({ text: firstErr, isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await createTest(payload);
      setShowAddTestModal(false);
      setStatusMessage({ text: `Lab test '${payload.name}' created successfully.`, isError: false });
      fetchTests();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to create test";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Test modal
  const handleOpenEditTest = (test: LabTestListItemOut) => {
    setEditingTest(test);
    setFormName(test.name);
    setFormSection(test.section || "General");
    setFormSampleType(test.sample_type || "Blood");
    setFormTurnaround(test.turnaround_minutes ? String(test.turnaround_minutes) : "");
    setFormEmergencyTurnaround(test.emergency_turnaround_minutes ? String(test.emergency_turnaround_minutes) : "");
    setFormAvailability(test.availability);
    setFormSendOutPartnerId(test.send_out_partner_id);
    setFormAvailable24h(test.available_24h);
    setFormNotifiableDisease(test.notifiable_disease || "");
    setFormMetrics(
      test.metric_schema && test.metric_schema.length > 0
        ? test.metric_schema.map((m) => ({
            key: m.key,
            label: m.label,
            type: m.type,
            unit: m.unit,
            decimals: m.decimals,
            required: m.required ?? true,
            ref: m.ref,
            critical: m.critical
              ? {
                  low: m.critical.low,
                  high: m.critical.high,
                  values: m.critical.values,
                }
              : null,
          }))
        : [createDefaultMetric()]
    );
    setShowEditTestModal(true);
  };

  // Submit Edit Test
  const handleSubmitEditTest = async () => {
    if (!editingTest) return;

    const payload: LabTestUpdate = {
      name: formName.trim(),
      section: formSection,
      sample_type: formSampleType,
      metric_schema: formMetrics,
      turnaround_minutes: formTurnaround ? Number(formTurnaround) : null,
      emergency_turnaround_minutes: formEmergencyTurnaround ? Number(formEmergencyTurnaround) : null,
      availability: formAvailability,
      send_out_partner_id: formAvailability === "SendOut" ? formSendOutPartnerId : null,
      available_24h: formAvailable24h,
      notifiable_disease: formNotifiableDisease.trim() || null,
      row_version: editingTest.row_version,
    };

    const val = validateLabTestUpdate(payload);
    if (!val.valid) {
      const firstErr = Object.values(val.errors)[0];
      setStatusMessage({ text: firstErr, isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await updateTest(editingTest.test_id, payload);
      setShowEditTestModal(false);
      setEditingTest(null);
      setStatusMessage({ text: `Lab test '${payload.name}' updated successfully.`, isError: false });
      fetchTests();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to update test";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Open Price modal
  const handleOpenPriceModal = (test: LabTestListItemOut) => {
    setPricingTest(test);
    setNewPrice(test.price !== undefined && test.price !== null ? String(test.price) : "0");
    setPriceReason("Annual tariff revision / hospital price schedule update");
    setShowPriceModal(true);
  };

  // Submit Price change
  const handleSubmitPrice = async () => {
    if (!pricingTest) return;
    const priceVal = Number(newPrice);
    if (isNaN(priceVal) || priceVal < 0) {
      setStatusMessage({ text: "Price must be a non-negative number.", isError: true });
      return;
    }
    if (!priceReason.trim()) {
      setStatusMessage({ text: "A non-empty reason is required for price changes.", isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await setPrice(pricingTest.test_id, {
        price: priceVal,
        reason: priceReason.trim(),
      });
      setShowPriceModal(false);
      setPricingTest(null);
      setStatusMessage({ text: `Price for '${pricingTest.name}' set to Rs. ${priceVal}.`, isError: false });
      fetchTests();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to set test price";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Open BOM modal
  const handleOpenBomModal = async (test: LabTestListItemOut) => {
    setBomTest(test);
    setShowBomModal(true);
    setLoading(true);
    try {
      const lines = await getBom(test.test_id);
      setBomLines(
        lines.map((l) => ({
          reagent_id: l.reagent_id,
          qty_per_test: l.qty_per_test,
        }))
      );
      if (reagentsList.length > 0) {
        setSelectedBomReagentId(reagentsList[0].reagent_id);
      }
    } catch (err: any) {
      console.warn("Could not fetch BOM lines", err);
      setBomLines([]);
    } finally {
      setLoading(false);
    }
  };

  // Add line to BOM
  const handleAddBomLine = () => {
    if (!selectedBomReagentId || Number(selectedBomReagentId) <= 0) {
      setStatusMessage({ text: "Select a reagent to add to the BOM.", isError: true });
      return;
    }
    const qty = Number(bomQtyPerTest);
    if (isNaN(qty) || qty <= 0) {
      setStatusMessage({ text: "Quantity per test must be greater than 0.", isError: true });
      return;
    }

    if (bomLines.some((l) => l.reagent_id === selectedBomReagentId)) {
      setStatusMessage({ text: "Reagent already present in BOM lines.", isError: true });
      return;
    }

    setBomLines((prev) => [...prev, { reagent_id: selectedBomReagentId, qty_per_test: qty }]);
  };

  // Remove line from BOM
  const handleRemoveBomLine = (index: number) => {
    setBomLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit BOM
  const handleSubmitBom = async () => {
    if (!bomTest) return;
    const val = validateBomInput(bomLines);
    if (!val.valid) {
      setStatusMessage({ text: val.error || "Invalid BOM lines", isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await putBom(bomTest.test_id, { lines: bomLines });
      setShowBomModal(false);
      setBomTest(null);
      setStatusMessage({ text: `BOM for '${bomTest.name}' updated (${bomLines.length} reagents).`, isError: false });
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to update BOM";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Submit Add Reagent
  const handleSubmitAddReagent = async () => {
    const payload: ReagentIn = {
      code: reagentCode.trim(),
      name: reagentName.trim(),
      unit: reagentUnit.trim(),
      low_stock_threshold: Number(reagentThreshold) || 0,
      near_expiry_alert_days: Number(reagentNearExpiryDays) || 90,
    };

    const val = validateReagentInput(payload);
    if (!val.valid) {
      const firstErr = Object.values(val.errors)[0];
      setStatusMessage({ text: firstErr, isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await createReagent(payload);
      setShowAddReagentModal(false);
      setStatusMessage({ text: `Reagent '${payload.name}' registered successfully.`, isError: false });
      fetchReagents();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to add reagent";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Submit Receive Batch
  const handleSubmitReceiveBatch = async () => {
    const payload: ReagentBatchIn = {
      reagent_id: Number(batchReagentId),
      batch_no: batchNo.trim(),
      expiry_date: batchExpiry,
      qty_received: Number(batchQty) || 0,
      total_cost: Number(batchTotalCost) || 0,
      vendor_invoice_id: batchVendorInvoiceId ? Number(batchVendorInvoiceId) : null,
    };

    const val = validateReagentBatchInput(payload);
    if (!val.valid) {
      const firstErr = Object.values(val.errors)[0];
      setStatusMessage({ text: firstErr, isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await receiveBatch(payload);
      setShowReceiveBatchModal(false);
      setStatusMessage({ text: `Batch '${payload.batch_no}' received into stock (${payload.qty_received} units).`, isError: false });
      fetchReagents();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to receive batch";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Submit Reagent Adjustment
  const handleSubmitAdjust = async () => {
    const payload: ReagentAdjustIn = {
      reagent_batch_id: Number(adjustBatchId),
      qty: Number(adjustQty) || 0,
      reason: adjustReason,
      note: adjustNote.trim(),
    };

    const val = validateReagentAdjustInput(payload);
    if (!val.valid) {
      const firstErr = Object.values(val.errors)[0];
      setStatusMessage({ text: firstErr, isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await adjustReagent(payload);
      setShowAdjustModal(false);
      setStatusMessage({ text: `Reagent adjustment recorded: -${payload.qty} units (${payload.reason}).`, isError: false });
      fetchReagents();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to adjust reagent stock";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Staff lookup for contractor agreement
  const handleLookupStaff = async () => {
    if (!staffQuery.trim() || staffQuery.trim().length < 2) {
      setStatusMessage({ text: "Type at least 2 characters to search staff.", isError: true });
      return;
    }

    setLoading(true);
    try {
      const results = await lookupStaff({ q: staffQuery.trim(), limit: 10 });
      setStaffResults(results);
      if (results.length > 0) {
        setSelectedStaffId(results[0].employee_id);
      }
    } catch (err: any) {
      console.warn("Staff lookup failed", err);
    } finally {
      setLoading(false);
    }
  };

  // Submit Contractor Agreement
  const handleSubmitContractor = async () => {
    const payload: ContractorIn = {
      hospital_share_pct: Number(hospitalSharePct),
      contractor_employee_id: selectedStaffId,
      contractor_vendor_id: null,
      effective_from: contractorEffectiveFrom,
    };

    const val = validateContractorInput(payload);
    if (!val.valid) {
      const firstErr = Object.values(val.errors)[0];
      setStatusMessage({ text: firstErr, isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await setContractor(payload);
      setStatusMessage({
        text: `Revenue-share agreement updated: Hospital ${payload.hospital_share_pct}%, Contractor ${
          100 - Number(payload.hospital_share_pct)
        }% effective from ${payload.effective_from}.`,
        isError: false,
      });
      fetchDashboard();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to set contractor share";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Toggle test active
  const handleToggleActive = async (test: LabTestListItemOut) => {
    setLoading(true);
    try {
      await updateTest(test.test_id, {
        is_active: !test.is_active,
        row_version: test.row_version,
      });
      fetchTests();
      setStatusMessage({
        text: `Test '${test.name}' marked ${!test.is_active ? "Active" : "Inactive"}.`,
        isError: false,
      });
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = LAB_ADMIN_ERROR_MESSAGES[code]?.en || err.message || "Failed to toggle test status";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lab-admin-screen p-4 max-w-7xl mx-auto space-y-4">
      {/* Service Banner for Rule 0f8b607b2c */}
      {capabilityView === "open_work" && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 rounded shadow">
          <p className="font-semibold text-base">
            No new laboratory or outsourced diagnostics work from now on
          </p>
          <p className="text-sm">
            نئی لیبارٹری یا آؤٹ سورس ٹیسٹنگ کا آغاز اب بند ہے۔ موجودہ ٹیسٹس اور تاریخ کا جائزہ لیا جا سکتا ہے۔
          </p>
        </div>
      )}

      {capabilityView === "records" && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-900 p-4 rounded shadow">
          <span className="font-bold uppercase tracking-wider text-xs bg-blue-700 text-white px-2 py-0.5 rounded mr-2">
            Records
          </span>
          <span className="text-sm font-medium">
            Records Mode: View catalogue, bill-of-materials and quality records only. New entries disabled.
          </span>
        </div>
      )}

      {/* Screen Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Lab Administration & Catalogue | لیبارٹری ایڈمنسٹریشن
          </h1>
          <p className="text-sm text-gray-600">
            Test catalogue & prices, reagents & batches, bill of materials, profit and revenue share (MSDS AAC 1-6).
          </p>
        </div>

        {/* Global Action Refresh */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm font-medium transition"
            onClick={() => {
              fetchTests();
              fetchReagents();
              if (activeTab === "dashboard") fetchDashboard();
            }}
            data-help="lab_admin.btn_refresh"
          >
            {loading ? "Refreshing..." : "↻ Refresh | ریفریش"}
          </button>
        </div>
      </div>

      {/* Notifications / Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3 rounded text-sm font-medium flex items-center justify-between ${
            statusMessage.isError
              ? "bg-red-100 border border-red-300 text-red-800"
              : "bg-green-100 border border-green-300 text-green-800"
          }`}
        >
          <span>{statusMessage.text}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={() => setStatusMessage(null)}
            className="ml-4 text-xs font-bold underline hover:opacity-75 cursor-pointer"
          >
            Dismiss
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("tests")}
          className={`py-2 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "tests"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          data-help="lab_admin.tab_tests"
        >
          📋 Test Catalogue ({tests.length}) | ٹیسٹ کیٹلاگ
        </button>

        {(canManageReagents || canManageBom) && (
          <button
            type="button"
            onClick={() => setActiveTab("reagents")}
            className={`py-2 px-4 font-semibold text-sm border-b-2 transition ${
              activeTab === "reagents"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            data-help="lab_admin.tab_reagents"
          >
            🧪 Reagents & Batches ({reagentsList.length}) | ری ایجنٹ اسٹاک
          </button>
        )}

        {canViewDashboard && (
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`py-2 px-4 font-semibold text-sm border-b-2 transition ${
              activeTab === "dashboard"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            data-help="lab_admin.tab_dashboard"
          >
            📊 Profit & Contractor Share | منافع اور کنٹریکٹر حصہ
          </button>
        )}
      </div>

      {/* TAB 1: TEST CATALOGUE */}
      {activeTab === "tests" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50 p-3 rounded border">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search test code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchTests()}
                className="px-3 py-1.5 border rounded text-sm w-full sm:w-72"
                data-help="lab_admin.search_query"
              />
              <button
                type="button"
                onClick={fetchTests}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                data-help="lab_admin.search_query"
              >
                Search
              </button>
            </div>

            {canManageTests && capabilityView === "full" && (
              <button
                type="button"
                onClick={handleOpenAddTest}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold shadow flex items-center gap-1.5 transition"
                data-help="lab_admin.btn_open_add_test"
              >
                + Add Lab Test | نیا لیب ٹیسٹ
              </button>
            )}
          </div>

          {/* Test Table */}
          <div className="overflow-x-auto bg-white rounded border shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Test Name & Section</th>
                  <th className="p-3">Sample</th>
                  <th className="p-3">Turnaround (Routine / Stat)</th>
                  <th className="p-3">Availability</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      {loading ? "Loading tests..." : "No lab tests found matching search criteria."}
                    </td>
                  </tr>
                ) : (
                  tests.map((test) => (
                    <tr key={test.test_id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-medium text-blue-700">{test.code}</td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-900">{test.name}</div>
                        <div className="text-xs text-gray-500">
                          {test.section}
                          {test.available_24h && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              24/7 Basic
                            </span>
                          )}
                          {test.notifiable_disease && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              ⚠️ {test.notifiable_disease}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-gray-600">{test.sample_type}</td>
                      <td className="p-3 text-gray-600">
                        <div>Routine: {test.turnaround_minutes ? `${test.turnaround_minutes}m` : "Default"}</div>
                        <div className="text-xs text-amber-700">
                          Urgent: {test.emergency_turnaround_minutes ? `${test.emergency_turnaround_minutes}m` : "Default"}
                        </div>
                      </td>
                      <td className="p-3">
                        {test.availability === "SendOut" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                            SendOut: {test.send_out_partner_name || `Partner #${test.send_out_partner_id}`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                            InHouse
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-gray-900">
                        {test.price !== undefined && test.price !== null ? `Rs. ${test.price}` : "—"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            test.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {test.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        {canManageTests && capabilityView === "full" && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditTest(test)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                            data-help="lab_admin.btn_edit_test"
                          >
                            Edit
                          </button>
                        )}

                        {canUpdatePrice && capabilityView === "full" && (
                          <button
                            type="button"
                            onClick={() => handleOpenPriceModal(test)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium"
                            data-help="lab_admin.btn_set_price"
                          >
                            Price
                          </button>
                        )}

                        {(canManageBom || canManageReagents) && (
                          <button
                            type="button"
                            onClick={() => handleOpenBomModal(test)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-medium"
                            data-help="lab_admin.btn_view_bom"
                          >
                            BOM
                          </button>
                        )}

                        {canManageTests && capabilityView === "full" && (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(test)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              test.is_active
                                ? "bg-red-50 hover:bg-red-100 text-red-700"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                            }`}
                            data-help="lab_admin.btn_toggle_active"
                          >
                            {test.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: REAGENTS & INVENTORY */}
      {activeTab === "reagents" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Reagents & Consumables Stock | ری ایجنٹ اور کیمیکلز
              </h2>
              <p className="text-xs text-gray-500">
                Live FEFO-eligible stock deducted on result submission. Out of stock blocks test issuance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManageReagents && capabilityView === "full" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setReagentCode("");
                      setReagentName("");
                      setReagentUnit("ml");
                      setReagentThreshold("10");
                      setReagentNearExpiryDays("90");
                      setShowAddReagentModal(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow transition"
                    data-help="lab_admin.btn_open_add_reagent"
                  >
                    + Add Reagent | نیا ری ایجنٹ
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (reagentsList.length > 0) setBatchReagentId(reagentsList[0].reagent_id);
                      setBatchNo("");
                      setBatchQty("100");
                      setBatchTotalCost("0");
                      setBatchVendorInvoiceId("");
                      setShowReceiveBatchModal(true);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow transition"
                    data-help="lab_admin.btn_open_receive_batch"
                  >
                    📥 Receive Batch | بیچ وصولی
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustBatchId("");
                      setAdjustQty("1");
                      setAdjustReason("Expiry");
                      setAdjustNote("");
                      setShowAdjustModal(true);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow transition"
                    data-help="lab_admin.btn_open_adjust_stock"
                  >
                    📉 Write Off / Adjust | اسٹاک ایڈجسٹمنٹ
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Reagents Table */}
          <div className="overflow-x-auto bg-white rounded border shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Reagent Name</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3">Available Stock</th>
                  <th className="p-3">Threshold</th>
                  <th className="p-3">Next Expiry</th>
                  <th className="p-3">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reagentsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No reagents registered. Click "+ Add Reagent" to configure chemicals.
                    </td>
                  </tr>
                ) : (
                  reagentsList.map((r) => {
                    const isLow = r.qty_available <= r.low_stock_threshold;
                    return (
                      <tr key={r.reagent_id} className={`hover:bg-gray-50 ${isLow ? "bg-red-50/50" : ""}`}>
                        <td className="p-3 font-mono font-medium text-blue-700">{r.code}</td>
                        <td className="p-3 font-semibold text-gray-900">{r.name}</td>
                        <td className="p-3 text-gray-600">{r.unit}</td>
                        <td className="p-3 font-bold text-gray-900">{r.qty_available}</td>
                        <td className="p-3 text-gray-600">{r.low_stock_threshold}</td>
                        <td className="p-3 text-gray-700">{r.next_expiry || "None"}</td>
                        <td className="p-3">
                          {isLow ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                              ⚠️ Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                              ✓ Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROFIT & CONTRACTOR SHARE */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Date Filter & Metrics */}
          <div className="bg-white p-4 rounded border shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <h2 className="text-base font-semibold text-gray-900">
                Financial Performance & Revenue Split | آمدن اور اخراجات
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-gray-600">From:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-1 border rounded text-xs"
                  data-help="lab_admin.input_date_from"
                />
                <label className="text-xs font-medium text-gray-600">To:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-1 border rounded text-xs"
                  data-help="lab_admin.input_date_to"
                />
                <button
                  type="button"
                  onClick={fetchDashboard}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
                  data-help="lab_admin.btn_apply_date_filter"
                >
                  Apply Filter
                </button>
              </div>
            </div>

            {/* Dashboard Cards */}
            {dashboardData ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-gray-50 p-3 rounded border text-center">
                  <div className="text-xs text-gray-500">Gross Revenue</div>
                  <div className="text-lg font-bold text-gray-900">Rs. {dashboardData.gross_revenue}</div>
                </div>
                <div className="bg-red-50 p-3 rounded border text-center">
                  <div className="text-xs text-red-700">Reagent COGS</div>
                  <div className="text-lg font-bold text-red-700">Rs. {dashboardData.reagent_cogs}</div>
                </div>
                <div className="bg-emerald-50 p-3 rounded border text-center">
                  <div className="text-xs text-emerald-700">Net Profit</div>
                  <div className="text-lg font-bold text-emerald-700">Rs. {dashboardData.net_profit}</div>
                </div>
                <div className="bg-blue-50 p-3 rounded border text-center">
                  <div className="text-xs text-blue-700">Hospital ({dashboardData.hospital_share_pct}%)</div>
                  <div className="text-lg font-bold text-blue-700">Rs. {dashboardData.hospital_share}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded border text-center">
                  <div className="text-xs text-purple-700">Contractor Share</div>
                  <div className="text-lg font-bold text-purple-700">Rs. {dashboardData.contractor_share}</div>
                </div>
                <div className="bg-amber-50 p-3 rounded border text-center">
                  <div className="text-xs text-amber-700">Test Reruns</div>
                  <div className="text-lg font-bold text-amber-700">{dashboardData.reruns}</div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">Loading lab financial performance...</div>
            )}
          </div>

          {/* Revenue by Test Breakdown */}
          {dashboardData && dashboardData.by_test && dashboardData.by_test.length > 0 && (
            <div className="bg-white p-4 rounded border shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Revenue by Test Category | ٹیسٹ وار آمدن</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                    <tr>
                      <th className="p-2">Test Name</th>
                      <th className="p-2">Tests Performed</th>
                      <th className="p-2 text-right">Revenue Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dashboardData.by_test.map((t, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-2 font-medium text-gray-900">{t.name}</td>
                        <td className="p-2 text-gray-600">{t.tests}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">Rs. {t.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Contractor Agreement Panel */}
          {canUpdatePrice && capabilityView === "full" && (
            <div className="bg-white p-4 rounded border shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">
                Configure Contractor Revenue Share Agreement | کنٹریکٹر معاہدہ ریونیو شیئرنگ
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contractor Staff Lookup (PMDC / Staff)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search employee name or PMDC..."
                      value={staffQuery}
                      onChange={(e) => setStaffQuery(e.target.value)}
                      className="px-2 py-1.5 border rounded text-xs w-full"
                      data-help="lab_admin.input_staff_lookup"
                    />
                    <button
                      type="button"
                      onClick={handleLookupStaff}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-semibold"
                      data-help="lab_admin.btn_lookup_staff"
                    >
                      Find
                    </button>
                  </div>
                  {staffResults.length > 0 && (
                    <select
                      value={selectedStaffId || ""}
                      onChange={(e) => setSelectedStaffId(Number(e.target.value) || null)}
                      className="mt-2 px-2 py-1.5 border rounded text-xs w-full bg-white"
                      data-help="lab_admin.select_contractor_employee"
                    >
                      {staffResults.map((s) => (
                        <option key={s.employee_id} value={s.employee_id}>
                          {s.full_name} ({s.designation}) - {s.registration || "No Reg"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Hospital Share % (Contractor receives {100 - (Number(hospitalSharePct) || 0)}%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={hospitalSharePct}
                    onChange={(e) => setHospitalSharePct(e.target.value)}
                    className="px-3 py-1.5 border rounded text-xs w-full"
                    data-help="lab_admin.input_hospital_share_pct"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Effective From Date</label>
                  <input
                    type="date"
                    value={contractorEffectiveFrom}
                    onChange={(e) => setContractorEffectiveFrom(e.target.value)}
                    className="px-3 py-1.5 border rounded text-xs w-full"
                    data-help="lab_admin.input_contractor_effective_from"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitContractor}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow transition"
                  data-help="lab_admin.btn_submit_contractor"
                >
                  Save Revenue Share Agreement | معاہدہ محفوظ کریں
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT LAB TEST */}
      {(showAddTestModal || showEditTestModal) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">
                {showAddTestModal ? "Add New Lab Test | نیا لیب ٹیسٹ" : `Edit Test: ${editingTest?.name}`}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddTestModal(false);
                  setShowEditTestModal(false);
                  setEditingTest(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                data-help="lab_admin.btn_cancel_test"
              >
                ✕
              </button>
            </div>

            {/* Test Core Attributes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Test Code *</label>
                <input
                  type="text"
                  placeholder="e.g. CBC, LFT, FBS, DengueNS1"
                  value={formCode}
                  disabled={showEditTestModal}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full disabled:bg-gray-100 font-mono"
                  data-help="lab_admin.input_test_code"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Test Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Complete Blood Count"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_test_name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Section *</label>
                <select
                  value={formSection}
                  onChange={(e) => setFormSection(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full bg-white"
                  data-help="lab_admin.select_section"
                >
                  {TEST_SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Specimen / Sample Type *</label>
                <select
                  value={formSampleType}
                  onChange={(e) => setFormSampleType(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full bg-white"
                  data-help="lab_admin.select_sample_type"
                >
                  {SAMPLE_TYPES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {showAddTestModal && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Price (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="px-3 py-1.5 border rounded text-xs w-full"
                    data-help="lab_admin.input_price"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Routine Turnaround (mins)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 120"
                  value={formTurnaround}
                  onChange={(e) => setFormTurnaround(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_turnaround"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Urgent / STAT Turnaround (mins)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 30"
                  value={formEmergencyTurnaround}
                  onChange={(e) => setFormEmergencyTurnaround(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_emergency_turnaround"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Availability *</label>
                <select
                  value={formAvailability}
                  onChange={(e) => setFormAvailability(e.target.value as "InHouse" | "SendOut")}
                  className="px-3 py-1.5 border rounded text-xs w-full bg-white"
                  data-help="lab_admin.select_availability"
                >
                  <option value="InHouse">InHouse (Performed on-site)</option>
                  <option value="SendOut">SendOut (Referred to partner laboratory)</option>
                </select>
              </div>

              {formAvailability === "SendOut" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    SendOut Partner Laboratory *
                  </label>
                  <select
                    value={formSendOutPartnerId || ""}
                    onChange={(e) => setFormSendOutPartnerId(Number(e.target.value) || null)}
                    className="px-3 py-1.5 border rounded text-xs w-full bg-white"
                    data-help="lab_admin.select_send_out_partner"
                  >
                    <option value="">Select partner laboratory...</option>
                    {partners.map((p) => (
                      <option key={p.partner_id} value={p.partner_id}>
                        {p.name} {p.mou_expired ? "(MOU Expired)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Statutory Notifiable Priority Disease
                </label>
                <input
                  type="text"
                  list="notifiable_list"
                  placeholder="e.g. Dengue Fever, Cholera"
                  value={formNotifiableDisease}
                  onChange={(e) => setFormNotifiableDisease(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_notifiable_disease"
                />
                <datalist id="notifiable_list">
                  {COMMON_NOTIFIABLE_DISEASES.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="avail_24h"
                  checked={formAvailable24h}
                  onChange={(e) => setFormAvailable24h(e.target.checked)}
                  className="rounded text-blue-600"
                  data-help="lab_admin.checkbox_available_24h"
                />
                <label htmlFor="avail_24h" className="text-xs font-medium text-gray-800">
                  Available 24/7 (MSDS AAC 1 v emergency test)
                </label>
              </div>
            </div>

            {/* METRIC SCHEMA EDITOR (Rule rule:26ecdbf976) */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Result Metric Schema (rule:26ecdbf976) | نتائج کے پیرامیٹرز
                  </h3>
                  <p className="text-xs text-gray-500">
                    Define result parameters, data types, units, reference intervals and critical panic limits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddMetric}
                  className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-semibold hover:bg-blue-100"
                  data-help="lab_admin.btn_add_metric"
                >
                  + Add Parameter
                </button>
              </div>

              <div className="space-y-3">
                {formMetrics.map((metric, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">Parameter #{idx + 1}</span>
                      {formMetrics.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMetric(idx)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold"
                          data-help="lab_admin.btn_remove_metric"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-gray-600">Key (Internal ID) *</label>
                        <input
                          type="text"
                          value={metric.key}
                          onChange={(e) => handleUpdateMetric(idx, { key: e.target.value })}
                          className="px-2 py-1 border rounded text-xs w-full font-mono"
                          data-help="lab_admin.input_metric_key"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-gray-600">Label (Report Heading) *</label>
                        <input
                          type="text"
                          value={metric.label}
                          onChange={(e) => handleUpdateMetric(idx, { label: e.target.value })}
                          className="px-2 py-1 border rounded text-xs w-full"
                          data-help="lab_admin.input_metric_label"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-gray-600">Type *</label>
                        <select
                          value={metric.type || "number"}
                          onChange={(e) =>
                            handleUpdateMetric(idx, {
                              type: e.target.value as "number" | "text",
                              critical: e.target.value === "text" ? { values: ["Positive", "Reactive"] } : null,
                            })
                          }
                          className="px-2 py-1 border rounded text-xs w-full bg-white"
                          data-help="lab_admin.select_metric_type"
                        >
                          <option value="number">Numeric (Quantitative)</option>
                          <option value="text">Text (Qualitative/Finding)</option>
                        </select>
                      </div>

                      {metric.type !== "text" && (
                        <div>
                          <label className="text-[11px] font-medium text-gray-600">Unit (e.g. mg/dL, g/L)</label>
                          <input
                            type="text"
                            value={metric.unit || ""}
                            onChange={(e) => handleUpdateMetric(idx, { unit: e.target.value })}
                            className="px-2 py-1 border rounded text-xs w-full"
                            data-help="lab_admin.input_metric_unit"
                          />
                        </div>
                      )}
                    </div>

                    {/* Reference and Critical Limits for Numeric */}
                    {metric.type !== "text" ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-gray-200">
                        <div>
                          <label className="text-[11px] font-medium text-gray-600">Normal Low</label>
                          <input
                            type="number"
                            step="any"
                            value={metric.ref?.default ? metric.ref.default[0] : ""}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : 0;
                              const high = metric.ref?.default ? metric.ref.default[1] : 100;
                              handleUpdateMetric(idx, { ref: { default: [val, high] } });
                            }}
                            className="px-2 py-1 border rounded text-xs w-full"
                            data-help="lab_admin.input_ref_low"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-gray-600">Normal High</label>
                          <input
                            type="number"
                            step="any"
                            value={metric.ref?.default ? metric.ref.default[1] : ""}
                            onChange={(e) => {
                              const low = metric.ref?.default ? metric.ref.default[0] : 0;
                              const val = e.target.value ? Number(e.target.value) : 100;
                              handleUpdateMetric(idx, { ref: { default: [low, val] } });
                            }}
                            className="px-2 py-1 border rounded text-xs w-full"
                            data-help="lab_admin.input_ref_high"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-red-700">Panic Critical Low</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 7.0"
                            value={metric.critical?.low !== null && metric.critical?.low !== undefined ? metric.critical.low : ""}
                            onChange={(e) => {
                              const lowVal = e.target.value ? Number(e.target.value) : null;
                              handleUpdateMetric(idx, {
                                critical: { ...(metric.critical || {}), low: lowVal },
                              });
                            }}
                            className="px-2 py-1 border rounded text-xs w-full border-red-200"
                            data-help="lab_admin.input_crit_low"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-red-700">Panic Critical High</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 20.0"
                            value={metric.critical?.high !== null && metric.critical?.high !== undefined ? metric.critical.high : ""}
                            onChange={(e) => {
                              const highVal = e.target.value ? Number(e.target.value) : null;
                              handleUpdateMetric(idx, {
                                critical: { ...(metric.critical || {}), high: highVal },
                              });
                            }}
                            className="px-2 py-1 border rounded text-xs w-full border-red-200"
                            data-help="lab_admin.input_crit_high"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 border-t border-gray-200">
                        <label className="text-[11px] font-medium text-red-700">
                          Critical Qualitative Values (comma-separated, e.g. Positive, Reactive)
                        </label>
                        <input
                          type="text"
                          value={metric.critical?.values?.join(", ") || ""}
                          onChange={(e) => {
                            const vals = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                            handleUpdateMetric(idx, { critical: { values: vals } });
                          }}
                          className="px-2 py-1 border rounded text-xs w-full border-red-200"
                          data-help="lab_admin.input_crit_values"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddTestModal(false);
                  setShowEditTestModal(false);
                  setEditingTest(null);
                }}
                className="px-4 py-2 border rounded text-xs font-semibold text-gray-700 hover:bg-gray-100"
                data-help="lab_admin.btn_cancel_test"
              >
                Cancel | منسوخ
              </button>
              <button
                type="button"
                onClick={showAddTestModal ? handleSubmitAddTest : handleSubmitEditTest}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow"
                data-help="lab_admin.btn_submit_test"
              >
                {showAddTestModal ? "Create Test | ٹیسٹ بنائیں" : "Save Changes | تبدیلیاں محفوظ کریں"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SET PRICE */}
      {showPriceModal && pricingTest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-gray-900">
                Update Test Price: {pricingTest.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowPriceModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
                data-help="lab_admin.btn_cancel_price"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Price (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="px-3 py-1.5 border rounded text-sm w-full"
                  data-help="lab_admin.input_new_price"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Price Change *</label>
                <textarea
                  rows={3}
                  value={priceReason}
                  onChange={(e) => setPriceReason(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_price_reason"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowPriceModal(false)}
                className="px-3 py-1.5 border rounded text-xs font-semibold text-gray-700"
                data-help="lab_admin.btn_cancel_price"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitPrice}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow"
                data-help="lab_admin.btn_submit_price"
              >
                Set Price | قیمت مقرر کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BILL OF MATERIALS (BOM) */}
      {showBomModal && bomTest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Bill of Materials (BOM): {bomTest.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Reagents automatically deducted from inventory each time this test result is validated.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBomModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
                data-help="lab_admin.btn_cancel_bom"
              >
                ✕
              </button>
            </div>

            {/* Add Line to BOM */}
            {canManageBom && capabilityView === "full" && (
              <div className="bg-gray-50 p-3 rounded border flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Reagent</label>
                  <select
                    value={selectedBomReagentId}
                    onChange={(e) => setSelectedBomReagentId(Number(e.target.value))}
                    className="px-2 py-1.5 border rounded text-xs w-full bg-white"
                    data-help="lab_admin.select_bom_reagent"
                  >
                    <option value="0">Choose reagent...</option>
                    {reagentsList.map((r) => (
                      <option key={r.reagent_id} value={r.reagent_id}>
                        {r.name} ({r.code}) [{r.unit}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-28">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Qty Per Test</label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={bomQtyPerTest}
                    onChange={(e) => setBomQtyPerTest(e.target.value)}
                    className="px-2 py-1.5 border rounded text-xs w-full"
                    data-help="lab_admin.input_bom_qty"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddBomLine}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
                  data-help="lab_admin.btn_add_bom_line"
                >
                  + Add Line
                </button>
              </div>
            )}

            {/* Current BOM Lines */}
            <div className="border rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                  <tr>
                    <th className="p-2">Reagent</th>
                    <th className="p-2">Quantity Per Test</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bomLines.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-gray-500">
                        No reagents assigned to this test's bill of materials.
                      </td>
                    </tr>
                  ) : (
                    bomLines.map((line, idx) => {
                      const r = reagentsList.find((x) => x.reagent_id === line.reagent_id);
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 font-medium text-gray-900">
                            {r ? `${r.name} (${r.code})` : `Reagent #${line.reagent_id}`}
                          </td>
                          <td className="p-2 text-gray-800">
                            {line.qty_per_test} {r?.unit || ""}
                          </td>
                          <td className="p-2 text-right">
                            {canManageBom && capabilityView === "full" && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBomLine(idx)}
                                className="text-red-600 hover:text-red-800 font-semibold text-xs"
                                data-help="lab_admin.btn_remove_bom_line"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowBomModal(false)}
                className="px-3 py-1.5 border rounded text-xs font-semibold text-gray-700"
                data-help="lab_admin.btn_cancel_bom"
              >
                Close
              </button>
              {canManageBom && capabilityView === "full" && (
                <button
                  type="button"
                  onClick={handleSubmitBom}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow"
                  data-help="lab_admin.btn_submit_bom"
                >
                  Save BOM | بل آف میٹیریل محفوظ کریں
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD REAGENT */}
      {showAddReagentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-gray-900">Add New Reagent | نیا ری ایجنٹ</h3>
              <button
                type="button"
                onClick={() => setShowAddReagentModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
                data-help="lab_admin.btn_cancel_reagent"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reagent Code *</label>
                <input
                  type="text"
                  placeholder="e.g. RG-LYSE-01"
                  value={reagentCode}
                  onChange={(e) => setReagentCode(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full font-mono"
                  data-help="lab_admin.input_reagent_code"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reagent Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Hematology Stromatolyser 500ml"
                  value={reagentName}
                  onChange={(e) => setReagentName(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_reagent_name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Unit of Measurement *</label>
                <input
                  type="text"
                  placeholder="e.g. ml, strip, test, kit"
                  value={reagentUnit}
                  onChange={(e) => setReagentUnit(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_reagent_unit"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Low Stock Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={reagentThreshold}
                  onChange={(e) => setReagentThreshold(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_reagent_threshold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Near Expiry Alert (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={reagentNearExpiryDays}
                  onChange={(e) => setReagentNearExpiryDays(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_reagent_expiry_alert_days"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowAddReagentModal(false)}
                className="px-3 py-1.5 border rounded text-xs font-semibold text-gray-700"
                data-help="lab_admin.btn_cancel_reagent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAddReagent}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow"
                data-help="lab_admin.btn_submit_reagent"
              >
                Add Reagent | ری ایجنٹ درج کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE REAGENT BATCH */}
      {showReceiveBatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-gray-900">Receive Reagent Batch | بیچ وصولی</h3>
              <button
                type="button"
                onClick={() => setShowReceiveBatchModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
                data-help="lab_admin.btn_cancel_batch"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Reagent *</label>
                <select
                  value={batchReagentId}
                  onChange={(e) => setBatchReagentId(Number(e.target.value))}
                  className="px-3 py-1.5 border rounded text-xs w-full bg-white"
                  data-help="lab_admin.select_batch_reagent"
                >
                  {reagentsList.map((r) => (
                    <option key={r.reagent_id} value={r.reagent_id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Batch Number *</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-2026-X01"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full font-mono"
                  data-help="lab_admin.input_batch_no"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Expiry Date *</label>
                <input
                  type="date"
                  value={batchExpiry}
                  onChange={(e) => setBatchExpiry(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_batch_expiry"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Received *</label>
                <input
                  type="number"
                  min="1"
                  value={batchQty}
                  onChange={(e) => setBatchQty(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_batch_qty"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Total Cost (PKR)</label>
                <input
                  type="number"
                  min="0"
                  value={batchTotalCost}
                  onChange={(e) => setBatchTotalCost(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_batch_cost"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor Invoice ID (Optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 102"
                  value={batchVendorInvoiceId}
                  onChange={(e) => setBatchVendorInvoiceId(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_batch_vendor_invoice"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowReceiveBatchModal(false)}
                className="px-3 py-1.5 border rounded text-xs font-semibold text-gray-700"
                data-help="lab_admin.btn_cancel_batch"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReceiveBatch}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow"
                data-help="lab_admin.btn_submit_batch"
              >
                Receive Batch | اسٹاک میں شامل کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WRITE OFF / ADJUST REAGENT STOCK */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-gray-900">
                Write-off / Adjust Reagent Stock | اسٹاک ایڈجسٹمنٹ
              </h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
                data-help="lab_admin.btn_cancel_adjust"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reagent Batch ID *</label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={adjustBatchId}
                  onChange={(e) => setAdjustBatchId(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_adjust_batch_id"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity to Deduct *</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_adjust_qty"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason *</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as "Adjustment" | "Expiry" | "Damage")}
                  className="px-3 py-1.5 border rounded text-xs w-full bg-white"
                  data-help="lab_admin.select_adjust_reason"
                >
                  {REAGENT_ADJUST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Audit Note *</label>
                <textarea
                  rows={3}
                  placeholder="Mandatory explanation for surveyor audit..."
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="lab_admin.input_adjust_note"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="px-3 py-1.5 border rounded text-xs font-semibold text-gray-700"
                data-help="lab_admin.btn_cancel_adjust"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAdjust}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow"
                data-help="lab_admin.btn_submit_adjust"
              >
                Confirm Write-Off | تصدیق کریں
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
