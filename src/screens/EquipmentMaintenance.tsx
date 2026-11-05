import {canReadDirectory} from "../DirectoryPicker";
import {DirectoryPicker} from "../DirectoryPicker";
import { equipmentText, equipmentValue } from "../equipment-maintenance-copy";
import {
  vendors as loadVendorDirectory,
  type VendorOut,
} from "../generated/equipment_maintenance";
/**
 * Screen 158: Medical Equipment and Maintenance (`equipment_maintenance`)
 * Companion to Screen 159: `equipment_maintenance_ops`
 * Workspace: `maintenance` / `ops_admin`
 * MSDS FMS 122–125
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { ApiError, call } from "../bridge";
import {
  listEquipment,
  getEquipment,
  updateEquipment,
  addPlan,
  updatePlan,
  recordVisit,
  scheduleFacilityMaintenance,
  listVisitsFacilityMaintenance,
  maintenanceStatistics,
  staffFacility,
  assets as fetchAssetsList,
  createAsset,
  type EquipmentOut,
  type EquipmentDetailOut,
  type MaintenancePlanOut,
  type MaintenanceRecordOut,
  type MaintenanceStatisticsOut,
  type FacilityStaffOut,
  type AssetIn,
  type EquipmentIn,
  type MaintenancePlanIn,
  type MaintenancePlanUpdateIn,
  type MaintenanceRecordIn,
} from "../generated/equipment_maintenance";
import {
  isPlanOverdue,
  filterSchedule,
  validateAssetForm,
  validateEquipmentForm,
  validateMaintenancePlanForm,
  validateMaintenancePlanUpdateForm,
  validateMaintenanceRecordForm,
  computeVisitStatusImpact,
  formatOnTimeBadge,
  getEquipmentStatusTone,
  getResultTone,
  formatComplianceRate,
  EQUIPMENT_ERROR_MESSAGES,
  equipmentAccess,
  equipmentDay,
  type EquipmentScreenId,
  type MaintenanceScheduleTab,
} from "../equipment-maintenance-policy";

interface Props {
  timeZone?: string;
  screenId?: EquipmentScreenId;
  lang?: "en" | "ur";
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
  establishment?: any;
  connected?: boolean;
  onNavigateHome?: () => void;
  onOpenHelp?: () => void;
}

export const EquipmentMaintenance: React.FC<Props> = ({
  timeZone,
  screenId = "equipment_maintenance",
  lang = "en",
  user,
  userPermissions = [],
  currentUserRole,
  establishment,
  connected = true,
  onOpenHelp,
}) => {
  const access = useMemo(
    () => equipmentAccess(user, establishment, screenId),
    [user, establishment, screenId],
  );
  const t = (en: string, ur: string) => (lang === "ur" ? ur : en);
  // Active Tab
  const [activeTab, setActiveTab] =
    useState<MaintenanceScheduleTab>("schedule");

  // General Loading & Notification States
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tab 1: Maintenance Schedule Data
  const [schedulePlans, setSchedulePlans] = useState<MaintenancePlanOut[]>([]);
  const [scheduleDays, setScheduleDays] = useState<number>(30);
  const [schedulePerformedBy, setSchedulePerformedBy] = useState<
    "All" | "InHouse" | "Contractor"
  >("All");
  const [scheduleSearch, setScheduleSearch] = useState<string>("");

  // Tab 2: Equipment Inventory Data
  const [equipmentList, setEquipmentList] = useState<EquipmentOut[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [selectedEquipmentDetail, setSelectedEquipmentDetail] =
    useState<EquipmentDetailOut | null>(null);
  const detailSequence = useRef(0);
  const [inventoryMedicalOnly, setInventoryMedicalOnly] =
    useState<boolean>(true);
  const [inventoryOverdueOnly, setInventoryOverdueOnly] =
    useState<boolean>(false);
  const [inventoryIncludeDisposed, setInventoryIncludeDisposed] =
    useState<boolean>(false);
  const [inventorySearch, setInventorySearch] = useState<string>("");

  // Tab 3: Maintenance Records Log
  const [maintenanceRecords, setMaintenanceRecords] = useState<
    MaintenanceRecordOut[]
  >([]);
  const [logKindFilter, setLogKindFilter] = useState<string>("All");
  const [logResultFilter, setLogResultFilter] = useState<string>("All");
  const [logDateFrom, setLogDateFrom] = useState<string>("");
  const [logDateTo, setLogDateTo] = useState<string>("");

  // Tab 4: Statistics & Compliance
  const [stats, setStats] = useState<MaintenanceStatisticsOut | null>(null);

  // Staff list for in-house assignments
  const [staffList, setStaffList] = useState<FacilityStaffOut[]>([]);
  const [vendorDirectory, setVendorDirectory] = useState<VendorOut[]>([]);

  // Modals state
  const [isRecordVisitModalOpen, setIsRecordVisitModalOpen] =
    useState<boolean>(false);
  const [targetAssetForVisit, setTargetAssetForVisit] = useState<{
    asset_id: number;
    asset_tag: string;
    asset_name: string;
    plan_id?: number | null;
    kind?: string;
  } | null>(null);
  const [visitFormData, setVisitFormData] = useState<
    Partial<MaintenanceRecordIn>
  >({
    kind: "PreventiveMaintenance",
    performed_on: equipmentDay(timeZone),
    result: undefined,
    findings: "",
    certificate_no: "",
    return_to_service: false,
  });
  const [visitPerformedBy, setVisitPerformedBy] = useState<
    "InHouse" | "Contractor"
  >("InHouse");
  const [visitErrors, setVisitErrors] = useState<Record<string, string>>({});

  // Add / Edit Plan Modal state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);
  const [planModalMode, setPlanModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [planFormData, setPlanFormData] = useState<
    Partial<MaintenancePlanIn & MaintenancePlanUpdateIn>
  >({
    kind: "PreventiveMaintenance",
    interval_days: undefined,
    performed_by: "InHouse",
    next_due: "",
    reason: "",
    is_active: true,
  });
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});

  // Edit Equipment Modal state
  const [isEditEquipmentModalOpen, setIsEditEquipmentModalOpen] =
    useState<boolean>(false);
  const [equipmentFormData, setEquipmentFormData] = useState<
    Partial<EquipmentIn>
  >({});
  const [equipmentErrors, setEquipmentErrors] = useState<
    Record<string, string>
  >({});

  // Onboarding Wizard state
  const [onboardStep, setOnboardStep] = useState<1 | 2 | 3 | 4>(1);
  const [onboardAssetIn, setOnboardAssetIn] = useState<Partial<AssetIn>>({
    category: "MedicalEquipment",
    status: "Active",
  });
  const [createdAssetId, setCreatedAssetId] = useState<number | null>(null);
  const [onboardVersion, setOnboardVersion] = useState<number | null>(null);
  const [onboardEquipIn, setOnboardEquipIn] = useState<Partial<EquipmentIn>>({
    is_medical: true,
    maintained_by: "InHouse",
  });
  const [onboardPlanIn, setOnboardPlanIn] = useState<
    Partial<MaintenancePlanIn>
  >({
    kind: "PreventiveMaintenance",
    interval_days: undefined,
    performed_by: "InHouse",
    next_due: "",
  });
  const [onboardVisitIn, setOnboardVisitIn] = useState<
    Partial<MaintenanceRecordIn>
  >({
    kind: "Commissioning",
    performed_on: equipmentDay(timeZone),
    result: undefined,
    findings: "",
    return_to_service: false,
  });
  const [onboardErrors, setOnboardErrors] = useState<Record<string, string>>(
    {},
  );

  // PDF Download Notice
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  // Keep keyboard work inside the current editor. Native F1 Help owns its own
  // focus while open; unresolved writes may focus only the original retry.
  useEffect(() => {
    if (
      !isRecordVisitModalOpen &&
      !isPlanModalOpen &&
      !isEditEquipmentModalOpen
    )
      return;
    const dialog = document.querySelector<HTMLElement>(
      "[data-equipment-dialog]",
    );
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,[tabindex]",
        ),
      ].filter((el) => !el.matches(":disabled") && el.getClientRects().length);
    (controls()[0] ?? dialog).focus();
    const trap = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (!frozen.current) {
          setIsRecordVisitModalOpen(false);
          setIsPlanModalOpen(false);
          setIsEditEquipmentModalOpen(false);
        }
      }
      if (event.key !== "Tab") return;
      if (frozen.current) {
        event.preventDefault();
        document
          .querySelector<HTMLButtonElement>('[data-help="em-retry-original"]')
          ?.focus();
        return;
      }
      const list = controls(),
        first = list[0],
        last = list.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      }
      if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap, true);
    return () => {
      document.removeEventListener("keydown", trap, true);
      previous?.focus();
    };
  }, [isRecordVisitModalOpen, isPlanModalOpen, isEditEquipmentModalOpen]);

  type FrozenWrite = {
    label: string;
    request: () => Promise<any>;
    confirmed: (data: any) => void;
    createdAt: number;
  };
  const flight = useRef(false);
  const frozen = useRef<FrozenWrite | null>(null);
  const [pendingWrite, setPendingWrite] = useState<FrozenWrite | null>(null);
  const runMutation = async (
    label: string,
    request: () => Promise<any>,
    confirmed: (data: any) => void,
    retry = false,
  ) => {
    if (flight.current || (frozen.current && !retry))
      throw new Error(
        "Resolve the original pending request before starting another action.",
      );
    const action = {
      label,
      request,
      confirmed,
      createdAt: frozen.current?.createdAt ?? Date.now(),
    };
    if (retry && Date.now() - action.createdAt >= 24 * 60 * 60 * 1000)
      throw new Error(
        "Retry retention has expired. Ask IT to reconcile the original request before any new write.",
      );
    frozen.current = action;
    setPendingWrite(action);
    flight.current = true;
    setLoading(true);
    let data: any;
    try {
      data = await request();
    } catch (error) {
      const reply = error instanceof ApiError ? error.response : undefined;
      if (
        reply &&
        ((reply.status && reply.status >= 400 && reply.status < 500) ||
          reply.local_rejection ||
          reply.request_sent === false ||
          ["PERMISSION_REQUIRED", "SIGN_IN_REQUIRED"].includes(
            reply.error?.code ?? "",
          ))
      ) {
        frozen.current = null;
        setPendingWrite(null);
      }
      throw error;
    } finally {
      flight.current = false;
      setLoading(false);
    }
    // Confirmation/read failures must never retry an already confirmed write.
    frozen.current = null;
    setPendingWrite(null);
    confirmed(data);
  };
  const retryOriginal = async () => {
    const action = frozen.current;
    if (!action) return;
    try {
      await runMutation(action.label, action.request, action.confirmed, true);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Request remains unconfirmed.",
      );
    }
  };

  // Load Schedule (rule:f32032152a)
  const loadSchedule = useCallback(async () => {
    if (!access.canView) return;
    try {
      setLoading(true);
      const query: any = { days: scheduleDays };
      if (schedulePerformedBy !== "All") {
        query.performed_by = schedulePerformedBy;
      }
      const data = await scheduleFacilityMaintenance(query);
      setSchedulePlans(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load maintenance schedule.");
    } finally {
      setLoading(false);
    }
  }, [access.canView, scheduleDays, schedulePerformedBy]);

  // Load Equipment Inventory
  const loadEquipment = useCallback(async () => {
    if (!access.canView) return;
    try {
      setLoading(true);
      const query: any = {
        medical_only: inventoryMedicalOnly,
        overdue_only: inventoryOverdueOnly,
        include_disposed: inventoryIncludeDisposed,
      };
      const data = await listEquipment(query);
      setEquipmentList(data);
      if (data.length > 0 && !selectedAssetId) {
        setSelectedAssetId((current) => current ?? data[0].asset_id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load equipment inventory.");
    } finally {
      setLoading(false);
    }
  }, [
    access.canView,
    inventoryMedicalOnly,
    inventoryOverdueOnly,
    inventoryIncludeDisposed,
    selectedAssetId,
  ]);

  // Load Equipment Details
  const loadEquipmentDetails = useCallback(
    async (assetId: number) => {
      if (!access.canView) return;
      const sequence = ++detailSequence.current;
      setSelectedEquipmentDetail(null);
      try {
        const detail = await getEquipment(assetId);
        if (sequence !== detailSequence.current || detail.asset_id !== assetId)
          return;
        setSelectedEquipmentDetail(detail);
      } catch (err: any) {
        if (sequence !== detailSequence.current) return;
        setErrorMessage(
          err.message || `Failed to load details for asset #${assetId}`,
        );
      }
    },
    [access.canView],
  );

  // Load Maintenance Records Log
  const loadRecords = useCallback(async () => {
    if (!access.canView) return;
    try {
      setLoading(true);
      const query: any = {};
      if (logKindFilter !== "All") query.kind = logKindFilter;
      if (logResultFilter !== "All") query.result = logResultFilter;
      if (logDateFrom) query.date_from = logDateFrom;
      if (logDateTo) query.date_to = logDateTo;
      const data = await listVisitsFacilityMaintenance(query);
      setMaintenanceRecords(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load maintenance records.");
    } finally {
      setLoading(false);
    }
  }, [access.canView, logKindFilter, logResultFilter, logDateFrom, logDateTo]);

  // Load Statistics
  const loadStatistics = useCallback(async () => {
    if (!access.canView) return;
    try {
      const data = await maintenanceStatistics();
      setStats(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load maintenance statistics.");
    }
  }, [access.canView]);

  // Load Staff
  const loadStaff = useCallback(async () => {
    if (!access.canPickStaff) return;
    try {
      const staff = await staffFacility({ limit: 100 });
      setStaffList(staff);
    } catch {
      setErrorMessage(
        t(
          "Staff lookup failed. Refresh before recording an in-house visit.",
          "عملے کی تلاش ناکام ہوئی۔ اندرونی وزٹ درج کرنے سے پہلے تازہ کریں۔",
        ),
      );
    }
  }, [access.canPickStaff]);

  const loadVendors = useCallback(async () => {
    if (!access.canManage && !access.canRecord) return;
    try {
      setVendorDirectory((await loadVendorDirectory({vendor_type:"Contractor"})).filter(row=>row.is_active));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t(
              "Vendor directory could not be loaded. Refresh the directories.",
              "فراہم کنندگان کی فہرست نہیں کھلی۔ فہرستیں تازہ کریں۔",
            ),
      );
    }
  }, [access.canManage, access.canRecord]);
  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  // Initial Data Fetch
  useEffect(() => {
    loadSchedule();
    loadStaff();
    loadStatistics();
  }, [loadSchedule, loadStaff, loadStatistics]);

  // Tab change trigger
  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (activeTab === "schedule") {
      loadSchedule();
    } else if (activeTab === "inventory") {
      loadEquipment();
    } else if (activeTab === "records") {
      loadRecords();
    } else if (activeTab === "statistics") {
      loadStatistics();
    }
  }, [activeTab, loadSchedule, loadEquipment, loadRecords, loadStatistics]);

  // Fetch detail when selectedAssetId changes
  useEffect(() => {
    if (selectedAssetId) {
      loadEquipmentDetails(selectedAssetId);
    } else {
      setSelectedEquipmentDetail(null);
    }
  }, [selectedAssetId, loadEquipmentDetails]);

  // Filtered schedule items (rule:f32032152a)
  const filteredSchedule = useMemo(() => {
    return filterSchedule(schedulePlans, schedulePerformedBy, scheduleSearch);
  }, [schedulePlans, schedulePerformedBy, scheduleSearch]);

  // Overdue count in current schedule
  const overdueCount = useMemo(() => {
    return schedulePlans.filter((p) => isPlanOverdue(p)).length;
  }, [schedulePlans]);

  // Filtered inventory items
  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return equipmentList;
    const q = inventorySearch.toLowerCase().trim();
    return equipmentList.filter(
      (e) =>
        e.asset_tag?.toLowerCase().includes(q) ||
        e.name?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q) ||
        e.manufacturer?.toLowerCase().includes(q) ||
        e.model?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q),
    );
  }, [equipmentList, inventorySearch]);

  // Export Written Plan PDF (rule:17da0307d8)
  const handlePreviewPlanPdf = async () => {
    setPdfBusy(true);
    setPdfNotice(null);
    try {
      const result = await call<{ opened: boolean }>("clinical-pdf", {
        path: "/facility/equipment/plan/pdf",
        preview: true,
      });
      setPdfNotice(
        result.opened
          ? t(
              "Equipment plan opened. Use the PDF viewer's Print control if required.",
              "آلات کا منصوبہ کھل گیا۔ ضرورت پر پی ڈی ایف ونڈو کا پرنٹ بٹن استعمال کریں۔",
            )
          : t("PDF preview cancelled.", "پی ڈی ایف کا پیش منظر منسوخ ہوا۔"),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t(
              "PDF preview failed. Save the PDF instead.",
              "پیش منظر ناکام ہوا۔ پی ڈی ایف محفوظ کریں۔",
            ),
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const handleExportPlanPdf = async () => {
    try {
      setPdfBusy(true);
      setPdfNotice(null);
      const result = await call<{ saved: boolean }>("download", {
        path: "/facility/equipment/plan/pdf",
      });
      setPdfNotice(
        result.saved
          ? t(
              "Equipment plan PDF saved.",
              "آلات کے منصوبے کی پی ڈی ایف محفوظ ہو گئی۔",
            )
          : t(
              "PDF save cancelled. No equipment record was changed.",
              "پی ڈی ایف محفوظ کرنا منسوخ ہوا۔ آلات کا ریکارڈ تبدیل نہیں ہوا۔",
            ),
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to download equipment plan PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  // Open Visit Recorder Modal
  const openRecordVisitModal = (asset: {
    asset_id: number;
    asset_tag: string;
    asset_name: string;
    plan_id?: number | null;
    kind?: string;
  }) => {
    setTargetAssetForVisit(asset);
    setVisitFormData({
      kind: (asset.kind as any) || "PreventiveMaintenance",
      plan_id: asset.plan_id || null,
      performed_on: equipmentDay(timeZone),
      result: undefined,
      findings: "",
      certificate_no: "",
      return_to_service: false,
    });
    setVisitErrors({});
    setIsRecordVisitModalOpen(true);
  };

  // Submit Visit Form (rule:f6412c4eca)
  const handleSubmitVisit = async (e: React.FormEvent) => {
    if (!access.canRecord || !connected || frozen.current) {
      setErrorMessage(
        t(
          "This action is not available. Resolve pending work or refresh your permissions.",
          "یہ کارروائی دستیاب نہیں۔ زیر التوا درخواست حل کریں یا اجازت تازہ کریں۔",
        ),
      );
      return;
    }

    e.preventDefault();
    if (!targetAssetForVisit) return;

    const validation = validateMaintenanceRecordForm(
      visitFormData,
      visitPerformedBy,
    );
    if (!validation.valid) {
      setVisitErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      const payload: MaintenanceRecordIn = {
        kind: visitFormData.kind as any,
        plan_id: visitFormData.plan_id || undefined,
        performed_on: visitFormData.performed_on!,
        result: visitFormData.result as any,
        findings: visitFormData.findings!,
        certificate_no: visitFormData.certificate_no || undefined,
        work_order_id: visitFormData.kind==='Breakdown'?visitFormData.work_order_id:null,
        return_to_service: visitFormData.return_to_service,
      };

      if (visitPerformedBy === "InHouse") {
        payload.employee_id = Number(visitFormData.employee_id);
      } else {
        payload.technician = visitFormData.technician;
        payload.vendor_id = visitFormData.vendor_id
          ? Number(visitFormData.vendor_id)
          : undefined;
      }

      await runMutation(
        "recordVisit",
        () => recordVisit(targetAssetForVisit.asset_id, payload),
        (result) => {
          setSuccessMessage(
            `Maintenance visit (${payload.kind} - ${payload.result}) recorded successfully for ${targetAssetForVisit.asset_tag}.`,
          );
          setIsRecordVisitModalOpen(false);

          // Refresh data
          loadSchedule();
          loadStatistics();
          if (selectedAssetId === targetAssetForVisit.asset_id) {
            loadEquipmentDetails(targetAssetForVisit.asset_id);
          }
          if (activeTab === "records") {
            loadRecords();
          }
        },
      );
    } catch (err: any) {
      const code = err?.response?.error?.code || err?.code || "";
      if (code === "VERSION_CONFLICT" && selectedAssetId)
        void loadEquipmentDetails(selectedAssetId);
      const mapped = EQUIPMENT_ERROR_MESSAGES[code];
      setErrorMessage(
        mapped
          ? `${mapped.en} (${code})`
          : err.message || "Failed to record maintenance visit.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Open Add Plan Modal
  const openAddPlanModal = () => {
    if (!selectedEquipmentDetail) return;
    setPlanModalMode("create");
    setEditingPlanId(null);
    setPlanFormData({
      kind: "PreventiveMaintenance",
      interval_days: undefined,
      performed_by: "InHouse",
      next_due: "",
      reason: "",
      is_active: true,
    });
    setPlanErrors({});
    setIsPlanModalOpen(true);
  };

  // Open Edit Plan Modal
  const openEditPlanModal = (plan: MaintenancePlanOut) => {
    setPlanModalMode("edit");
    setEditingPlanId(plan.plan_id);
    setPlanFormData({
      kind: plan.kind,
      interval_days: plan.interval_days,
      performed_by: plan.performed_by,
      vendor_id: plan.vendor_id,
      oem_reference: plan.oem_reference,
      checklist: plan.checklist,
      next_due: plan.next_due,
      reason: "",
      is_active: plan.is_active,
      expected_version: plan.row_version,
    });
    setPlanErrors({});
    setIsPlanModalOpen(true);
  };

  // Submit Plan Form
  const handleSubmitPlan = async (e: React.FormEvent) => {
    if (!access.canManage || !connected || frozen.current) {
      setErrorMessage(
        t(
          "This action is not available. Resolve pending work or refresh your permissions.",
          "یہ کارروائی دستیاب نہیں۔ زیر التوا درخواست حل کریں یا اجازت تازہ کریں۔",
        ),
      );
      return;
    }

    e.preventDefault();
    if (!selectedAssetId) return;

    if (planModalMode === "create") {
      const validation = validateMaintenancePlanForm(
        planFormData,
        selectedEquipmentDetail?.plans || [],
      );
      if (!validation.valid) {
        setPlanErrors(validation.errors);
        return;
      }

      try {
        setLoading(true);
        await runMutation(
          "addPlan",
          () =>
            addPlan(selectedAssetId, {
              kind: planFormData.kind as any,
              interval_days: Number(planFormData.interval_days),
              performed_by: planFormData.performed_by as any,
              vendor_id:
                planFormData.performed_by === "Contractor"
                  ? Number(planFormData.vendor_id)
                  : null,
              oem_reference: planFormData.oem_reference || null,
              checklist: planFormData.checklist || null,
              next_due: planFormData.next_due!,
            }),
          (result) => {
            setSuccessMessage(
              `Maintenance plan (${planFormData.kind}) added successfully.`,
            );
            setIsPlanModalOpen(false);
            loadEquipmentDetails(selectedAssetId);
            loadSchedule();
          },
        );
      } catch (err: any) {
        const code = err?.response?.error?.code || err?.code || "";
        if (code === "VERSION_CONFLICT" && selectedAssetId)
          void loadEquipmentDetails(selectedAssetId);
        const mapped = EQUIPMENT_ERROR_MESSAGES[code];
        setErrorMessage(
          mapped
            ? `${mapped.en} (${code})`
            : err.message || "Failed to add plan.",
        );
      } finally {
        setLoading(false);
      }
    } else {
      // Edit mode
      const validation = validateMaintenancePlanUpdateForm(planFormData);
      if (!validation.valid) {
        setPlanErrors(validation.errors);
        return;
      }

      try {
        setLoading(true);
        await runMutation(
          "updatePlan",
          () =>
            updatePlan(editingPlanId!, {
              interval_days: planFormData.interval_days
                ? Number(planFormData.interval_days)
                : undefined,
              performed_by: planFormData.performed_by as any,
              vendor_id:
                planFormData.performed_by === "Contractor"
                  ? Number(planFormData.vendor_id)
                  : null,
              oem_reference: planFormData.oem_reference || null,
              checklist: planFormData.checklist || null,
              next_due: planFormData.next_due || undefined,
              is_active: planFormData.is_active,
              reason: planFormData.reason!,
              expected_version: planFormData.expected_version,
            }),
          (result) => {
            setSuccessMessage("Maintenance plan updated successfully.");
            setIsPlanModalOpen(false);
            loadEquipmentDetails(selectedAssetId);
            loadSchedule();
          },
        );
      } catch (err: any) {
        const code = err?.response?.error?.code || err?.code || "";
        if (code === "VERSION_CONFLICT" && selectedAssetId)
          void loadEquipmentDetails(selectedAssetId);
        const mapped = EQUIPMENT_ERROR_MESSAGES[code];
        setErrorMessage(
          mapped
            ? `${mapped.en} (${code})`
            : err.message || "Failed to update plan.",
        );
      } finally {
        setLoading(false);
      }
    }
  };

  // Open Edit Equipment Modal
  const openEditEquipmentModal = () => {
    if (!selectedEquipmentDetail) return;
    setEquipmentFormData({
      is_medical: selectedEquipmentDetail.is_medical,
      manufacturer: selectedEquipmentDetail.manufacturer || "",
      model: selectedEquipmentDetail.model || "",
      supplier_vendor_id: selectedEquipmentDetail.supplier_vendor_id,
      warranty_until: selectedEquipmentDetail.warranty_until || "",
      maintained_by: selectedEquipmentDetail.maintained_by,
      service_vendor_id: selectedEquipmentDetail.service_vendor_id,
      service_contract_ref: selectedEquipmentDetail.service_contract_ref || "",
      service_contract_until:
        selectedEquipmentDetail.service_contract_until || "",
      ot_id: selectedEquipmentDetail.ot_id,
      expected_version: selectedEquipmentDetail.row_version,
    });
    setEquipmentErrors({});
    setIsEditEquipmentModalOpen(true);
  };

  // Submit Edit Equipment Form
  const handleSubmitEditEquipment = async (e: React.FormEvent) => {
    if (!access.canManage || !connected || frozen.current) {
      setErrorMessage(
        t(
          "This action is not available. Resolve pending work or refresh your permissions.",
          "یہ کارروائی دستیاب نہیں۔ زیر التوا درخواست حل کریں یا اجازت تازہ کریں۔",
        ),
      );
      return;
    }

    e.preventDefault();
    if (!selectedAssetId) return;

    const validation = validateEquipmentForm(equipmentFormData);
    if (!validation.valid) {
      setEquipmentErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      await runMutation(
        "updateEquipment",
        () =>
          updateEquipment(selectedAssetId, equipmentFormData as EquipmentIn),
        (result) => {
          setSuccessMessage("Equipment specification updated successfully.");
          setIsEditEquipmentModalOpen(false);
          loadEquipmentDetails(selectedAssetId);
          loadEquipment();
        },
      );
    } catch (err: any) {
      const code = err?.response?.error?.code || err?.code || "";
      if (code === "VERSION_CONFLICT" && selectedAssetId)
        void loadEquipmentDetails(selectedAssetId);
      const mapped = EQUIPMENT_ERROR_MESSAGES[code];
      setErrorMessage(
        mapped
          ? `${mapped.en} (${code})`
          : err.message || "Failed to update equipment.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Wizard Step 1: Create Asset (rule:79dedf48b1)
  const handleOnboardStep1 = async (e: React.FormEvent) => {
    if (!access.canOnboard || !connected || frozen.current) {
      setErrorMessage(
        t(
          "This action is not available. Resolve pending work or refresh your permissions.",
          "یہ کارروائی دستیاب نہیں۔ زیر التوا درخواست حل کریں یا اجازت تازہ کریں۔",
        ),
      );
      return;
    }

    e.preventDefault();
    const validation = validateAssetForm(onboardAssetIn);
    if (!validation.valid) {
      setOnboardErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      if (canReadDirectory("/ops/assets",user?.permissions??[])) {
        const existing = await fetchAssetsList();
        if (
          existing.some(
            (asset) =>
              asset.asset_tag.toLowerCase() ===
              onboardAssetIn.asset_tag?.trim().toLowerCase(),
          )
        ) {
          setOnboardErrors({
            asset_tag: t(
              "This tag already exists. Open its inventory record instead of creating another asset.",
              "یہ ٹیگ پہلے موجود ہے۔ نیا اثاثہ بنانے کے بجائے اس کا ریکارڈ کھولیں۔",
            ),
          });
          return;
        }
      }
      await runMutation(
        "createAsset",
        () => createAsset(onboardAssetIn as AssetIn),
        (res) => {
          setCreatedAssetId(res.asset_id);
          setOnboardVersion(res.row_version);
          setOnboardErrors({});
          setOnboardStep(2);
          setSuccessMessage(
            `Asset ${res.asset_tag} (#${res.asset_id}) registered. Now specify medical equipment OEM attributes.`,
          );
        },
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to register hospital asset.");
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Wizard Step 2: Set Equipment Specifications (rule:79dedf48b1)
  const handleOnboardStep2 = async (e: React.FormEvent) => {
    if (!access.canOnboard || !connected || frozen.current) {
      setErrorMessage(
        t(
          "This action is not available. Resolve pending work or refresh your permissions.",
          "یہ کارروائی دستیاب نہیں۔ زیر التوا درخواست حل کریں یا اجازت تازہ کریں۔",
        ),
      );
      return;
    }

    e.preventDefault();
    if (!createdAssetId) return;

    const validation = validateEquipmentForm(onboardEquipIn);
    if (!validation.valid) {
      setOnboardErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      if (onboardVersion === null)
        throw new Error(
          "Re-read and review the saved asset before editing its specification.",
        );
      await runMutation(
        "updateEquipment",
        () =>
          updateEquipment(createdAssetId, {
            ...onboardEquipIn,
            expected_version: onboardVersion,
          } as EquipmentIn),
        (result) => {
          setOnboardErrors({});
          setOnboardStep(3);
          setSuccessMessage(
            "Medical equipment profile saved. Now define the OEM preventive maintenance/calibration plan.",
          );
        },
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save equipment specification.");
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Wizard Step 3: Add OEM Plan (rule:79dedf48b1)
  const handleOnboardStep3 = async (e: React.FormEvent) => {
    if (!access.canOnboard || !connected || frozen.current) {
      setErrorMessage(
        t(
          "This action is not available. Resolve pending work or refresh your permissions.",
          "یہ کارروائی دستیاب نہیں۔ زیر التوا درخواست حل کریں یا اجازت تازہ کریں۔",
        ),
      );
      return;
    }

    e.preventDefault();
    if (!createdAssetId) return;

    const validation = validateMaintenancePlanForm(onboardPlanIn, []);
    if (!validation.valid) {
      setOnboardErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      await runMutation(
        "addPlan",
        () =>
          addPlan(createdAssetId, {
            kind: onboardPlanIn.kind as any,
            interval_days: Number(onboardPlanIn.interval_days),
            performed_by: onboardPlanIn.performed_by as any,
            vendor_id: onboardPlanIn.vendor_id
              ? Number(onboardPlanIn.vendor_id)
              : undefined,
            oem_reference: onboardPlanIn.oem_reference || undefined,
            checklist: onboardPlanIn.checklist || undefined,
            next_due: onboardPlanIn.next_due!,
          }),
        (result) => {
          setOnboardErrors({});
          setOnboardStep(4);
          setSuccessMessage(
            "Preventive plan configured. Now record the initial Commissioning visit to establish commissioned date.",
          );
        },
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add initial maintenance plan.");
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Wizard Step 4: Record Commissioning Visit (rule:79dedf48b1)
  const handleOnboardStep4 = async (e: React.FormEvent) => {
    if (!access.canOnboard || !connected || frozen.current) {
      setErrorMessage(
        t(
          "This action is not available. Resolve pending work or refresh your permissions.",
          "یہ کارروائی دستیاب نہیں۔ زیر التوا درخواست حل کریں یا اجازت تازہ کریں۔",
        ),
      );
      return;
    }

    e.preventDefault();
    if (!createdAssetId) return;

    const validation = validateMaintenanceRecordForm(onboardVisitIn, "InHouse");
    if (!validation.valid) {
      setOnboardErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      await runMutation(
        "recordVisit",
        () =>
          recordVisit(createdAssetId, {
            kind: "Commissioning",
            performed_on: onboardVisitIn.performed_on!,
            result: onboardVisitIn.result as any,
            findings: onboardVisitIn.findings!,
            employee_id: onboardVisitIn.employee_id
              ? Number(onboardVisitIn.employee_id)
              : undefined,
            certificate_no: onboardVisitIn.certificate_no || undefined,
            return_to_service: false,
          }),
        (result) => {
          setSuccessMessage(
            `Commissioning visit recorded for asset #${createdAssetId}. Check the server's current equipment status before use.`,
          );
          setOnboardStep(1);
          setCreatedAssetId(null);
          setOnboardEquipIn({ is_medical: true, maintained_by: "InHouse" });
          setOnboardPlanIn({
            kind: "PreventiveMaintenance",
            performed_by: "InHouse",
            next_due: "",
          });
          setOnboardVisitIn({
            kind: "Commissioning",
            result: undefined,
            findings: "",
            performed_on: equipmentDay(timeZone),
            return_to_service: false,
          });
          setOnboardAssetIn({ category: "MedicalEquipment", status: "Active" });
          setSelectedAssetId(createdAssetId);
          setActiveTab("inventory");
          loadEquipment();
          loadSchedule();
        },
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to record commissioning visit.");
    } finally {
      setLoading(false);
    }
  };

  if (!access.canView)
    return (
      <section role="alert">
        {t(
          "Equipment records are not available with your current permissions and hospital screen view.",
          "موجودہ اجازت اور ہسپتال کے منظر میں آلات کا ریکارڈ دستیاب نہیں۔",
        )}
      </section>
    );
  return (
    <div
      className="equipment-maintenance-screen"
      data-screen={screenId}
      data-write-pending={!!pendingWrite}
      data-unsaved={
        isRecordVisitModalOpen ||
        isPlanModalOpen ||
        isEditEquipmentModalOpen ||
        onboardStep > 1 ||
        !!onboardAssetIn.asset_tag ||
        !!onboardAssetIn.name
      }
      dir={lang === "ur" ? "rtl" : "ltr"}
      style={{
        padding: "16px",
        minHeight: "100%",
        background: "var(--soft)",
        color: "var(--ink)",
      }}
    >
      {pendingWrite && (
        <section
          role="alert"
          style={{
            position: "fixed",
            top: "70px",
            insetInline: "5%",
            zIndex: 20000,
            padding: 16,
            background: "var(--warning)",
            color: "var(--ink)",
            border: "2px solid var(--ink)",
          }}
        >
          <p>
            {t(
              "The original request is pending or unconfirmed. Keep this screen open; retry the original request before starting another action.",
              "اصل درخواست زیر التوا یا غیر تصدیق شدہ ہے۔ یہ صفحہ کھلا رکھیں اور نئی کارروائی سے پہلے اصل درخواست دوبارہ بھیجیں۔",
            )}
          </p>
          <button
            data-help="em-retry-original"
            disabled={loading}
            onClick={retryOriginal}
          >
            {t("Retry original request", "اصل درخواست دوبارہ بھیجیں")}
          </button>
        </section>
      )}
      <fieldset
        disabled={!!pendingWrite}
        style={{ border: 0, padding: 0, minWidth: 0 }}
      >
        {/* Top Banner / Navigation Bar */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            borderBottom: "1px solid #cbd5e1",
            paddingBottom: "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  fontWeight: "700",
                  color: "var(--ink)",
                }}
              >
                {" "}
                {equipmentText(
                  "Medical Equipment & Maintenance (MSDS FMS 122–125)",
                  lang,
                )}{" "}
              </h1>
              <span
                style={{
                  fontSize: "0.85rem",
                  background: "#e0e7ff",
                  color: "#3730a3",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontWeight: "600",
                }}
              >
                {" "}
                {equipmentText("Workspace:", lang)}{" "}
                {screenId === "equipment_maintenance_ops"
                  ? t("Operations", "آپریشنز")
                  : t("Maintenance", "دیکھ بھال")}
              </span>
            </div>
            <p
              style={{
                margin: "4px 0 0 0",
                color: "var(--muted)",
                fontSize: "0.9rem",
              }}
            >
              طبی سازوسامان، توثیق (Calibration)، احتیاطی دیکھ بھال اور معائنے
              کا نظام
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              data-help="em-pdf-plan"
              onClick={handleExportPlanPdf}
              disabled={pdfBusy}
              style={{
                padding: "8px 14px",
                background: "#0284c7",
                color: "var(--accent-text)",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📄</span>
              <span>
                {pdfBusy
                  ? equipmentText("Exporting PDF...", lang)
                  : equipmentText("Export Inspector Plan (PDF)", lang)}
              </span>
            </button>
            {(access.canManage || access.canRecord) && (
              <button
                type="button"
                data-help="em-refresh-lookups"
                onClick={() => {
                  void loadStaff();
                  void loadVendors();
                }}
              >
                {t("Refresh staff / vendors", "عملہ / فراہم کنندگان تازہ کریں")}
              </button>
            )}
            <button
              type="button"
              data-help="em-preview-plan"
              onClick={handlePreviewPlanPdf}
              disabled={pdfBusy}
            >
              {t("View / print plan", "منصوبہ دیکھیں / پرنٹ کریں")}
            </button>

            <button
              type="button"
              data-help="em-onboard-btn"
              disabled={!access.canOnboard}
              onClick={() => setActiveTab("onboarding")}
              style={{
                padding: "8px 14px",
                background: "#16a34a",
                color: "var(--accent-text)",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>➕</span>
              <span> {equipmentText("Onboard New Equipment", lang)} </span>
            </button>

            {onOpenHelp && (
              <button
                type="button"
                data-help="em-help-btn"
                onClick={onOpenHelp}
                style={{
                  padding: "8px 12px",
                  background: "var(--soft)",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                {" "}
                {equipmentText("F1 Help", lang)}{" "}
              </button>
            )}
          </div>
        </header>

        {/* Global Alerts */}
        {errorMessage && (
          <div
            style={{
              background: "#fee2e2",
              borderLeft: "4px solid #ef4444",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
              color: "#991b1b",
            }}
          >
            <strong> {equipmentText("Error:", lang)} </strong> {errorMessage}
            <button
              onClick={() => setErrorMessage(null)}
              style={{
                float: "right",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#991b1b",
                fontWeight: "bold",
              }}
              data-help="em-dismiss-error"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              background: "#dcfce7",
              borderLeft: "4px solid #22c55e",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
              color: "#166534",
            }}
          >
            <strong> {equipmentText("Success:", lang)} </strong>{" "}
            {successMessage}
            <button
              onClick={() => setSuccessMessage(null)}
              style={{
                float: "right",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#166534",
                fontWeight: "bold",
              }}
              data-help="em-dismiss-success"
            >
              ×
            </button>
          </div>
        )}

        {pdfNotice && (
          <div
            style={{
              background: "#e0f2fe",
              borderLeft: "4px solid #0284c7",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
              color: "#0369a1",
            }}
          >
            <strong> {equipmentText("Inspector Notice:", lang)} </strong>{" "}
            {pdfNotice}
            <button
              onClick={() => setPdfNotice(null)}
              style={{
                float: "right",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#0369a1",
                fontWeight: "bold",
              }}
              data-help="em-dismiss-pdf"
            >
              ×
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <nav
          style={{
            display: "flex",
            gap: "8px",
            borderBottom: "2px solid #e2e8f0",
            marginBottom: "16px",
          }}
          className="equipment-tabs"
        >
          <button
            type="button"
            data-help="em-tab-schedule"
            onClick={() => setActiveTab("schedule")}
            style={{
              padding: "10px 16px",
              background:
                activeTab === "schedule" ? "var(--paper)" : "transparent",
              border: "1px solid #e2e8f0",
              borderBottom:
                activeTab === "schedule"
                  ? "2px solid #2563eb"
                  : "1px solid #e2e8f0",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "schedule" ? "700" : "500",
              color: activeTab === "schedule" ? "#2563eb" : "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span> {equipmentText("📅 Maintenance Schedule", lang)} </span>
            {overdueCount > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "var(--accent-text)",
                  fontSize: "0.75rem",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontWeight: "bold",
                }}
              >
                {overdueCount} {equipmentText("Overdue", lang)}{" "}
              </span>
            )}
          </button>

          <button
            type="button"
            data-help="em-tab-inventory"
            onClick={() => setActiveTab("inventory")}
            style={{
              padding: "10px 16px",
              background:
                activeTab === "inventory" ? "var(--paper)" : "transparent",
              border: "1px solid #e2e8f0",
              borderBottom:
                activeTab === "inventory"
                  ? "2px solid #2563eb"
                  : "1px solid #e2e8f0",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "inventory" ? "700" : "500",
              color: activeTab === "inventory" ? "#2563eb" : "var(--muted)",
            }}
          >
            {" "}
            {equipmentText("🏥 Equipment Inventory", lang)}{" "}
          </button>

          <button
            type="button"
            data-help="em-tab-records"
            onClick={() => setActiveTab("records")}
            style={{
              padding: "10px 16px",
              background:
                activeTab === "records" ? "var(--paper)" : "transparent",
              border: "1px solid #e2e8f0",
              borderBottom:
                activeTab === "records"
                  ? "2px solid #2563eb"
                  : "1px solid #e2e8f0",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "records" ? "700" : "500",
              color: activeTab === "records" ? "#2563eb" : "var(--muted)",
            }}
          >
            {" "}
            {equipmentText("📝 Maintenance Log", lang)}{" "}
          </button>

          <button
            type="button"
            data-help="em-tab-statistics"
            onClick={() => setActiveTab("statistics")}
            style={{
              padding: "10px 16px",
              background:
                activeTab === "statistics" ? "var(--paper)" : "transparent",
              border: "1px solid #e2e8f0",
              borderBottom:
                activeTab === "statistics"
                  ? "2px solid #2563eb"
                  : "1px solid #e2e8f0",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "statistics" ? "700" : "500",
              color: activeTab === "statistics" ? "#2563eb" : "var(--muted)",
            }}
          >
            {" "}
            {equipmentText("📊 MSDS FMS 122-125 KPIs", lang)}{" "}
          </button>

          <button
            type="button"
            data-help="em-tab-onboarding"
            disabled={!access.canOnboard}
            onClick={() => setActiveTab("onboarding")}
            style={{
              padding: "10px 16px",
              background:
                activeTab === "onboarding" ? "var(--paper)" : "transparent",
              border: "1px solid #e2e8f0",
              borderBottom:
                activeTab === "onboarding"
                  ? "2px solid #2563eb"
                  : "1px solid #e2e8f0",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "onboarding" ? "700" : "500",
              color: activeTab === "onboarding" ? "#2563eb" : "var(--muted)",
            }}
          >
            {" "}
            {equipmentText("⚙️ Asset Onboarding Wizard", lang)}{" "}
          </button>
        </nav>

        {/* TAB 1: MAINTENANCE SCHEDULE (rule:f32032152a) */}
        {activeTab === "schedule" && (
          <section data-section="schedule">
            {/* Overdue alert notice */}
            {overdueCount > 0 && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #f87171",
                  padding: "12px 16px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#b91c1c",
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }}>⚠️</span>
                  <div>
                    <strong>
                      {" "}
                      {equipmentText("Attention:", lang)} {overdueCount}{" "}
                      {equipmentText(
                        "maintenance/calibration plan(s) are OVERDUE!",
                        lang,
                      )}{" "}
                    </strong>
                    <div style={{ fontSize: "0.85rem", color: "#991b1b" }}>
                      {" "}
                      {equipmentText(
                        "MSDS FMS 125 requires planned maintenance to be performed within regulatory grace periods.",
                        lang,
                      )}{" "}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Filter Bar */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                background: "var(--paper)",
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                marginBottom: "16px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                  htmlFor="em-schedule-days"
                >
                  {" "}
                  {equipmentText("Timeframe (Due within):", lang)}{" "}
                </label>
                <select
                  data-help="em-schedule-days"
                  value={scheduleDays}
                  onChange={(e) => setScheduleDays(Number(e.target.value))}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #94a3b8",
                  }}
                  id="em-schedule-days"
                >
                  <option value={7}>
                    {" "}
                    {equipmentText("Next 7 Days", lang)}{" "}
                  </option>
                  <option value={14}>
                    {" "}
                    {equipmentText("Next 14 Days", lang)}{" "}
                  </option>
                  <option value={30}>
                    {" "}
                    {equipmentText("Next 30 Days", lang)}{" "}
                  </option>
                  <option value={90}>
                    {" "}
                    {equipmentText("Next 90 Days", lang)}{" "}
                  </option>
                  <option value={180}>
                    {" "}
                    {equipmentText("Next 180 Days", lang)}{" "}
                  </option>
                  <option value={365}>
                    {" "}
                    {equipmentText("Next 365 Days", lang)}{" "}
                  </option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                  htmlFor="em-schedule-performed-by"
                >
                  {" "}
                  {equipmentText(
                    "Performed By (Contractor / In-House):",
                    lang,
                  )}{" "}
                </label>
                <select
                  data-help="em-schedule-performed-by"
                  value={schedulePerformedBy}
                  onChange={(e) =>
                    setSchedulePerformedBy(e.target.value as any)
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #94a3b8",
                  }}
                  id="em-schedule-performed-by"
                >
                  <option value="All">
                    {" "}
                    {equipmentText("All Providers (تمام ادارے)", lang)}{" "}
                  </option>
                  <option value="Contractor">
                    {" "}
                    {equipmentText(
                      "Contractors Only (ٹھیکیدار/بیرونی انجینئرز)",
                      lang,
                    )}{" "}
                  </option>
                  <option value="InHouse">
                    {" "}
                    {equipmentText(
                      "In-House Hospital Staff (اندرونی عملہ)",
                      lang,
                    )}{" "}
                  </option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: "200px" }}>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                  htmlFor="em-schedule-search"
                >
                  {" "}
                  {equipmentText("Search Asset or Kind:", lang)}{" "}
                </label>
                <input
                  type="text"
                  data-help="em-schedule-search"
                  placeholder="Search tag, equipment name, vendor..."
                  value={scheduleSearch}
                  onChange={(e) => setScheduleSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #94a3b8",
                  }}
                  id="em-schedule-search"
                />
              </div>

              <button
                type="button"
                data-help="em-schedule-refresh"
                onClick={loadSchedule}
                disabled={loading}
                style={{
                  alignSelf: "flex-end",
                  padding: "7px 12px",
                  background: "var(--soft)",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                {" "}
                {equipmentText("🔄 Refresh", lang)}{" "}
              </button>
            </div>

            {/* Schedule Table */}
            <div
              style={{
                background: "var(--paper)",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--soft)",
                      borderBottom: "2px solid #e2e8f0",
                      color: "#475569",
                    }}
                  >
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Asset Tag", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Equipment Name", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Department", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Maintenance Kind", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Interval", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Performed By", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Due Date", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Status", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Actions", lang)}{" "}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedule.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: "24px",
                          textAlign: "center",
                          color: "#94a3b8",
                        }}
                      >
                        {" "}
                        {equipmentText(
                          "No maintenance or calibration visits due within selected criteria.",
                          lang,
                        )}{" "}
                      </td>
                    </tr>
                  ) : (
                    filteredSchedule.map((plan) => {
                      const overdue = isPlanOverdue(plan);
                      return (
                        <tr
                          key={plan.plan_id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: overdue ? "#fff1f2" : "var(--paper)",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 14px",
                              fontWeight: "600",
                              color: overdue ? "#b91c1c" : "var(--ink)",
                            }}
                          >
                            {plan.asset_tag}
                          </td>
                          <td
                            style={{ padding: "10px 14px", fontWeight: "500" }}
                          >
                            {plan.asset_name}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              color: "var(--muted)",
                            }}
                          >
                            {plan.department_name || "—"}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span
                              style={{
                                background: "var(--soft)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                                fontWeight: "500",
                              }}
                            >
                              {equipmentValue(plan.kind, lang)}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {plan.interval_days}{" "}
                            {equipmentText("days", lang)}{" "}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {plan.performed_by === "Contractor" ? (
                              <span
                                style={{ color: "#d97706", fontWeight: "600" }}
                              >
                                {" "}
                                {equipmentText("Contractor", lang)}{" "}
                                {plan.vendor_name
                                  ? `(${plan.vendor_name})`
                                  : ""}
                              </span>
                            ) : (
                              <span
                                style={{ color: "#2563eb", fontWeight: "600" }}
                              >
                                {" "}
                                {equipmentText("In-House Staff", lang)}{" "}
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              fontWeight: overdue ? "700" : "400",
                              color: overdue ? "#dc2626" : "var(--ink)",
                            }}
                          >
                            {plan.next_due}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {overdue ? (
                              <span
                                style={{
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  fontSize: "0.8rem",
                                  fontWeight: "700",
                                }}
                              >
                                {" "}
                                {equipmentText("OVERDUE (", lang)}{" "}
                                {Math.abs(plan.days_left)}{" "}
                                {equipmentText("d)", lang)}{" "}
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: "#dcfce7",
                                  color: "#166534",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  fontSize: "0.8rem",
                                  fontWeight: "600",
                                }}
                              >
                                {" "}
                                {equipmentText("Due in", lang)} {plan.days_left}{" "}
                                {equipmentText("d", lang)}{" "}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <button
                              type="button"
                              data-help="em-schedule-record-btn"
                              disabled={!access.canRecord}
                              onClick={() =>
                                openRecordVisitModal({
                                  asset_id: plan.asset_id,
                                  asset_tag: plan.asset_tag,
                                  asset_name: plan.asset_name,
                                  plan_id: plan.plan_id,
                                  kind: plan.kind,
                                })
                              }
                              style={{
                                padding: "4px 10px",
                                background: overdue ? "#b91c1c" : "#2563eb",
                                color: "var(--accent-text)",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: "600",
                              }}
                            >
                              {" "}
                              {equipmentText("Record Visit", lang)}{" "}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: EQUIPMENT INVENTORY */}
        {activeTab === "inventory" && (
          <section
            data-section="inventory"
            style={{
              display: "grid",
              gridTemplateColumns: "350px 1fr",
              gap: "16px",
            }}
          >
            {/* Left Column: Equipment Master List */}
            <div
              style={{
                background: "var(--paper)",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                display: "flex",
                flexDirection: "column",
                height: "750px",
              }}
            >
              <div
                style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}
              >
                <input
                  type="text"
                  data-help="em-inv-search"
                  placeholder="Search equipment tag, name..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    marginBottom: "8px",
                  }}
                  id="em-inv-search"
                />

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    fontSize: "0.8rem",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <input
                      type="checkbox"
                      data-help="em-inv-medical-only"
                      checked={inventoryMedicalOnly}
                      onChange={(e) =>
                        setInventoryMedicalOnly(e.target.checked)
                      }
                      id="em-inv-medical-only"
                    />
                    <span>
                      {" "}
                      {equipmentText("Medical Equipment Only", lang)}{" "}
                    </span>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <input
                      type="checkbox"
                      data-help="em-inv-overdue-only"
                      checked={inventoryOverdueOnly}
                      onChange={(e) =>
                        setInventoryOverdueOnly(e.target.checked)
                      }
                      id="em-inv-overdue-only"
                    />
                    <span> {equipmentText("Overdue Items Only", lang)} </span>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <input
                      type="checkbox"
                      data-help="em-inv-disposed"
                      checked={inventoryIncludeDisposed}
                      onChange={(e) =>
                        setInventoryIncludeDisposed(e.target.checked)
                      }
                      id="em-inv-disposed"
                    />
                    <span>
                      {" "}
                      {equipmentText(
                        "Include Written-Off / Disposed",
                        lang,
                      )}{" "}
                    </span>
                  </label>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                {filteredInventory.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      color: "#94a3b8",
                    }}
                  >
                    {" "}
                    {equipmentText(
                      "No equipment matched your filters.",
                      lang,
                    )}{" "}
                  </div>
                ) : (
                  filteredInventory.map((eq) => {
                    const isSelected = eq.asset_id === selectedAssetId;
                    const tone = getEquipmentStatusTone(eq.status);
                    return (
                      <button
                        type="button"
                        key={eq.asset_id}
                        data-help="em-inv-item"
                        onClick={() => setSelectedAssetId(eq.asset_id)}
                        style={{
                          padding: "10px",
                          marginBottom: "6px",
                          borderRadius: "6px",
                          border: isSelected
                            ? "2px solid #2563eb"
                            : "1px solid #e2e8f0",
                          background: isSelected ? "#eff6ff" : "var(--paper)",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{ fontWeight: "700", color: "var(--ink)" }}
                          >
                            {eq.asset_tag}
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontWeight: "600",
                              background:
                                tone === "success"
                                  ? "#dcfce7"
                                  : tone === "danger"
                                    ? "#fee2e2"
                                    : tone === "warning"
                                      ? "#fef3c7"
                                      : "var(--soft)",
                              color:
                                tone === "success"
                                  ? "#166534"
                                  : tone === "danger"
                                    ? "#991b1b"
                                    : tone === "warning"
                                      ? "#92400e"
                                      : "#475569",
                            }}
                          >
                            {eq.status}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: "600",
                            color: "#1e293b",
                            marginBottom: "2px",
                          }}
                        >
                          {eq.name}
                        </div>
                        <div
                          style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                        >
                          {eq.department_name ||
                            eq.location ||
                            "General Hospital"}
                          {eq.ot_name ? ` • OT: ${eq.ot_name}` : ""}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Selected Equipment Details */}
            <div
              style={{
                background: "var(--paper)",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "16px",
                height: "750px",
                overflowY: "auto",
              }}
            >
              {!selectedEquipmentDetail ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "50px",
                    color: "#94a3b8",
                  }}
                >
                  {" "}
                  {equipmentText(
                    "Select an equipment asset from the inventory to view specifications, maintenance plans, and certificates.",
                    lang,
                  )}{" "}
                </div>
              ) : (
                <div>
                  {/* Header banner */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      borderBottom: "1px solid #e2e8f0",
                      paddingBottom: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "1.3rem",
                            fontWeight: "700",
                          }}
                        >
                          {selectedEquipmentDetail.name} (
                          {selectedEquipmentDetail.asset_tag})
                        </h2>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            background:
                              getEquipmentStatusTone(
                                selectedEquipmentDetail.status,
                              ) === "success"
                                ? "#dcfce7"
                                : getEquipmentStatusTone(
                                      selectedEquipmentDetail.status,
                                    ) === "danger"
                                  ? "#fee2e2"
                                  : "#fef3c7",
                            color:
                              getEquipmentStatusTone(
                                selectedEquipmentDetail.status,
                              ) === "success"
                                ? "#166534"
                                : getEquipmentStatusTone(
                                      selectedEquipmentDetail.status,
                                    ) === "danger"
                                  ? "#991b1b"
                                  : "#92400e",
                          }}
                        >
                          {equipmentValue(selectedEquipmentDetail.status, lang)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--muted)",
                          marginTop: "4px",
                        }}
                      >
                        {" "}
                        {equipmentText("Asset #", lang)}{" "}
                        {selectedEquipmentDetail.asset_id}{" "}
                        {equipmentText("• Category:", lang)}{" "}
                        {selectedEquipmentDetail.category}{" "}
                        {equipmentText("• Location:", lang)}{" "}
                        {selectedEquipmentDetail.location || "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        data-help="em-detail-edit-btn"
                        disabled={
                          !access.canManage ||
                          selectedEquipmentDetail.status === "Disposed"
                        }
                        onClick={openEditEquipmentModal}
                        style={{
                          padding: "6px 12px",
                          background: "var(--soft)",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "600",
                          fontSize: "0.85rem",
                        }}
                      >
                        {" "}
                        {equipmentText("✏️ Edit Specs", lang)}{" "}
                      </button>
                      <button
                        type="button"
                        data-help="em-detail-record-visit-btn"
                        disabled={
                          !access.canRecord ||
                          selectedEquipmentDetail.status === "Disposed"
                        }
                        onClick={() =>
                          openRecordVisitModal({
                            asset_id: selectedEquipmentDetail.asset_id,
                            asset_tag: selectedEquipmentDetail.asset_tag,
                            asset_name: selectedEquipmentDetail.name,
                          })
                        }
                        style={{
                          padding: "6px 12px",
                          background: "#2563eb",
                          color: "var(--accent-text)",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "600",
                          fontSize: "0.85rem",
                        }}
                      >
                        {" "}
                        {equipmentText("➕ Record Visit", lang)}{" "}
                      </button>
                    </div>
                  </div>

                  {/* Contract Expired Alert */}
                  {selectedEquipmentDetail.contract_expired && (
                    <div
                      style={{
                        background: "#fef3c7",
                        borderLeft: "4px solid #f59e0b",
                        padding: "10px 14px",
                        borderRadius: "4px",
                        marginBottom: "16px",
                        color: "#92400e",
                        fontSize: "0.9rem",
                      }}
                    >
                      <strong>
                        {" "}
                        {equipmentText(
                          "Warning: Service Contract Expired!",
                          lang,
                        )}{" "}
                      </strong>{" "}
                      {equipmentText(
                        "The maintenance contract for this medical device expired on",
                        lang,
                      )}{" "}
                      {selectedEquipmentDetail.service_contract_until}.
                    </div>
                  )}

                  {/* Grid of specs */}
                  <p>{t('Supplier','فراہم کنندہ')}: <strong>{selectedEquipmentDetail.supplier_name??t('Not recorded','درج نہیں')}</strong></p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                      gap: "12px",
                      marginBottom: "16px",
                      background: "var(--soft)",
                      padding: "12px",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>
                        {" "}
                        {equipmentText("Manufacturer / Model:", lang)}{" "}
                      </span>
                      <strong>
                        {selectedEquipmentDetail.manufacturer || "—"} /{" "}
                        {selectedEquipmentDetail.model || "—"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>
                        {" "}
                        {equipmentText("Serial Number:", lang)}{" "}
                      </span>
                      <strong>
                        {selectedEquipmentDetail.serial_no || "—"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>
                        {" "}
                        {equipmentText("Operating Theatre:", lang)}{" "}
                      </span>
                      <strong>
                        {selectedEquipmentDetail.ot_name || "N/A"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>
                        {" "}
                        {equipmentText("Commissioned On:", lang)}{" "}
                      </span>
                      <strong>
                        {selectedEquipmentDetail.commissioned_on ||
                          "Not Commissioned"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>
                        {" "}
                        {equipmentText("Warranty Until:", lang)}{" "}
                      </span>
                      <strong>
                        {selectedEquipmentDetail.warranty_until || "—"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>
                        {" "}
                        {equipmentText("Maintained By:", lang)}{" "}
                      </span>
                      <strong>
                        {selectedEquipmentDetail.maintained_by} (
                        {selectedEquipmentDetail.service_vendor_name ||
                          "Internal"}
                        )
                      </strong>
                    </div>
                  </div>

                  {/* Maintenance Plans Section */}
                  <div style={{ marginBottom: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1rem",
                          fontWeight: "700",
                        }}
                      >
                        {" "}
                        {equipmentText(
                          "Active Maintenance & Calibration Plans",
                          lang,
                        )}{" "}
                      </h3>
                      <button
                        type="button"
                        data-help="em-add-plan-btn"
                        disabled={
                          !access.canManage ||
                          selectedEquipmentDetail.status === "Disposed"
                        }
                        onClick={openAddPlanModal}
                        style={{
                          padding: "4px 8px",
                          background: "#0284c7",
                          color: "var(--accent-text)",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight: "600",
                        }}
                      >
                        {" "}
                        {equipmentText("➕ Add Plan", lang)}{" "}
                      </button>
                    </div>

                    {selectedEquipmentDetail.plans.length === 0 ? (
                      <div
                        style={{
                          padding: "12px",
                          background: "var(--soft)",
                          borderRadius: "4px",
                          color: "#94a3b8",
                          fontSize: "0.85rem",
                        }}
                      >
                        {" "}
                        {equipmentText(
                          "No active maintenance plans. Add an OEM preventive or calibration plan.",
                          lang,
                        )}{" "}
                      </div>
                    ) : (
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "0.85rem",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: "var(--soft)",
                              borderBottom: "1px solid #cbd5e1",
                              textAlign: "left",
                            }}
                          >
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Kind", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Interval", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Provider", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Next Due", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Actions", lang)}{" "}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEquipmentDetail.plans.map((p) => (
                            <tr
                              key={p.plan_id}
                              style={{ borderBottom: "1px solid #f1f5f9" }}
                            >
                              <td style={{ padding: "8px", fontWeight: "600" }}>
                                {p.kind}
                              </td>
                              <td style={{ padding: "8px" }}>
                                {p.interval_days}{" "}
                                {equipmentText("days", lang)}{" "}
                              </td>
                              <td style={{ padding: "8px" }}>
                                {p.performed_by}{" "}
                                {p.vendor_name ? `(${p.vendor_name})` : ""}
                              </td>
                              <td
                                style={{
                                  padding: "8px",
                                  color: p.overdue ? "#dc2626" : "var(--ink)",
                                  fontWeight: p.overdue ? "700" : "400",
                                }}
                              >
                                {p.next_due} {p.overdue ? "(OVERDUE)" : ""}
                              </td>
                              <td style={{ padding: "8px" }}>
                                <button
                                  type="button"
                                  data-help="em-edit-plan-btn"
                                  disabled={
                                    !access.canManage ||
                                    selectedEquipmentDetail.status ===
                                      "Disposed"
                                  }
                                  onClick={() => openEditPlanModal(p)}
                                  style={{
                                    padding: "2px 6px",
                                    background: "none",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  {" "}
                                  {equipmentText("Edit", lang)}{" "}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Maintenance Records History */}
                  <div>
                    <h3
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "1rem",
                        fontWeight: "700",
                      }}
                    >
                      {" "}
                      {equipmentText(
                        "Maintenance & Calibration Visits",
                        lang,
                      )}{" "}
                    </h3>
                    {selectedEquipmentDetail.records.length === 0 ? (
                      <div
                        style={{
                          padding: "12px",
                          background: "var(--soft)",
                          borderRadius: "4px",
                          color: "#94a3b8",
                          fontSize: "0.85rem",
                        }}
                      >
                        {" "}
                        {equipmentText(
                          "No visit history recorded yet for this asset.",
                          lang,
                        )}{" "}
                      </div>
                    ) : (
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "0.85rem",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: "var(--soft)",
                              borderBottom: "1px solid #cbd5e1",
                              textAlign: "left",
                            }}
                          >
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Date", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Kind", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Result", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Attribution", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Certificate No", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("On-Time", lang)}{" "}
                            </th>
                            <th style={{ padding: "8px" }}>
                              {" "}
                              {equipmentText("Findings", lang)}{" "}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEquipmentDetail.records.map((r) => {
                            const badge = formatOnTimeBadge(r.on_time);
                            return (
                              <tr
                                key={r.record_id}
                                style={{ borderBottom: "1px solid #f1f5f9" }}
                              >
                                <td
                                  style={{
                                    padding: "8px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {r.performed_on}
                                </td>
                                <td
                                  style={{ padding: "8px", fontWeight: "600" }}
                                >
                                  {equipmentValue(r.kind, lang)}
                                </td>
                                <td style={{ padding: "8px" }}>
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      fontWeight: "bold",
                                      background:
                                        r.result === "Pass"
                                          ? "#dcfce7"
                                          : r.result === "Fail"
                                            ? "#fee2e2"
                                            : "#fef3c7",
                                      color:
                                        r.result === "Pass"
                                          ? "#166534"
                                          : r.result === "Fail"
                                            ? "#991b1b"
                                            : "#92400e",
                                    }}
                                  >
                                    {equipmentValue(r.result, lang)}
                                  </span>
                                </td>
                                <td style={{ padding: "8px" }}>
                                  {r.vendor_name || r.employee_name || r.technician || t('Not recorded','درج نہیں')}
                                </td>
                                <td
                                  style={{
                                    padding: "8px",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {r.certificate_no || "—"}
                                </td>
                                <td style={{ padding: "8px" }}>
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      padding: "1px 6px",
                                      borderRadius: "10px",
                                      fontWeight: "600",
                                      background:
                                        badge.tone === "success"
                                          ? "#dcfce7"
                                          : badge.tone === "warning"
                                            ? "#fee2e2"
                                            : "var(--soft)",
                                      color:
                                        badge.tone === "success"
                                          ? "#166534"
                                          : badge.tone === "warning"
                                            ? "#991b1b"
                                            : "var(--muted)",
                                    }}
                                  >
                                    {lang === "ur"
                                      ? badge.labelUr
                                      : badge.labelEn}
                                  </span>
                                </td>
                                <td
                                  style={{ padding: "8px", color: "#475569" }}
                                >
                                  {r.findings}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: MAINTENANCE RECORDS LOG */}
        {activeTab === "records" && (
          <section data-section="records">
            {/* Filters Bar */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                background: "var(--paper)",
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                marginBottom: "16px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                  htmlFor="em-log-kind"
                >
                  {" "}
                  {equipmentText("Filter by Kind:", lang)}{" "}
                </label>
                <select
                  data-help="em-log-kind"
                  value={logKindFilter}
                  onChange={(e) => setLogKindFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #94a3b8",
                  }}
                  id="em-log-kind"
                >
                  <option value="All">
                    {" "}
                    {equipmentText("All Kinds", lang)}{" "}
                  </option>
                  <option value="Commissioning">
                    {" "}
                    {equipmentText("Commissioning", lang)}{" "}
                  </option>
                  <option value="PreventiveMaintenance">
                    {" "}
                    {equipmentText("Preventive Maintenance", lang)}{" "}
                  </option>
                  <option value="Calibration">
                    {" "}
                    {equipmentText("Calibration", lang)}{" "}
                  </option>
                  <option value="Inspection">
                    {" "}
                    {equipmentText("Inspection", lang)}{" "}
                  </option>
                  <option value="ElectricalSafety">
                    {" "}
                    {equipmentText("Electrical Safety", lang)}{" "}
                  </option>
                  <option value="Breakdown">
                    {" "}
                    {equipmentText("Breakdown Repair", lang)}{" "}
                  </option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                  htmlFor="em-log-result"
                >
                  {" "}
                  {equipmentText("Filter by Result:", lang)}{" "}
                </label>
                <select
                  data-help="em-log-result"
                  value={logResultFilter}
                  onChange={(e) => setLogResultFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #94a3b8",
                  }}
                  id="em-log-result"
                >
                  <option value="All">
                    {" "}
                    {equipmentText("All Results", lang)}{" "}
                  </option>
                  <option value="Pass"> {equipmentText("Pass", lang)} </option>
                  <option value="Adjusted">
                    {" "}
                    {equipmentText("Adjusted", lang)}{" "}
                  </option>
                  <option value="Fail"> {equipmentText("Fail", lang)} </option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                  htmlFor="em-log-date-from"
                >
                  {" "}
                  {equipmentText("Date From:", lang)}{" "}
                </label>
                <input
                  type="date"
                  data-help="em-log-date-from"
                  value={logDateFrom}
                  onChange={(e) => setLogDateFrom(e.target.value)}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "4px",
                    border: "1px solid #94a3b8",
                  }}
                  id="em-log-date-from"
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                  htmlFor="em-log-date-to"
                >
                  {" "}
                  {equipmentText("Date To:", lang)}{" "}
                </label>
                <input
                  type="date"
                  data-help="em-log-date-to"
                  value={logDateTo}
                  onChange={(e) => setLogDateTo(e.target.value)}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "4px",
                    border: "1px solid #94a3b8",
                  }}
                  id="em-log-date-to"
                />
              </div>

              <button
                type="button"
                data-help="em-log-filter-btn"
                onClick={loadRecords}
                disabled={loading}
                style={{
                  alignSelf: "flex-end",
                  padding: "7px 12px",
                  background: "#2563eb",
                  color: "var(--accent-text)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                {" "}
                {equipmentText("Filter Visits", lang)}{" "}
              </button>
            </div>

            {/* Visits Table */}
            <div
              style={{
                background: "var(--paper)",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--soft)",
                      borderBottom: "2px solid #e2e8f0",
                      color: "#475569",
                    }}
                  >
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("ID", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Asset Tag", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Equipment Name", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Visit Date", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Kind", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Result", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Technician / Staff", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Certificate No", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("On-Time", lang)}{" "}
                    </th>
                    <th style={{ padding: "10px 14px" }}>
                      {" "}
                      {equipmentText("Findings", lang)}{" "}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        style={{
                          padding: "24px",
                          textAlign: "center",
                          color: "#94a3b8",
                        }}
                      >
                        {" "}
                        {equipmentText(
                          "No maintenance records found for selected filters.",
                          lang,
                        )}{" "}
                      </td>
                    </tr>
                  ) : (
                    maintenanceRecords.map((rec) => {
                      const badge = formatOnTimeBadge(rec.on_time);
                      return (
                        <tr
                          key={rec.record_id}
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                        >
                          <td
                            style={{ padding: "10px 14px", color: "#94a3b8" }}
                          >
                            #{rec.record_id}
                          </td>
                          <td
                            style={{ padding: "10px 14px", fontWeight: "600" }}
                          >
                            {rec.asset_tag}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {rec.asset_name}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {rec.performed_on}
                          </td>
                          <td
                            style={{ padding: "10px 14px", fontWeight: "500" }}
                          >
                            {equipmentValue(rec.kind, lang)}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: "bold",
                                background:
                                  rec.result === "Pass"
                                    ? "#dcfce7"
                                    : rec.result === "Fail"
                                      ? "#fee2e2"
                                      : "#fef3c7",
                                color:
                                  rec.result === "Pass"
                                    ? "#166534"
                                    : rec.result === "Fail"
                                      ? "#991b1b"
                                      : "#92400e",
                              }}
                            >
                              {equipmentValue(rec.result, lang)}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {rec.vendor_name || rec.employee_name || rec.technician || t('Not recorded','درج نہیں')}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              fontFamily: "monospace",
                            }}
                          >
                            {rec.certificate_no || "—"}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                padding: "1px 6px",
                                borderRadius: "10px",
                                fontWeight: "600",
                                background:
                                  badge.tone === "success"
                                    ? "#dcfce7"
                                    : badge.tone === "warning"
                                      ? "#fee2e2"
                                      : "var(--soft)",
                                color:
                                  badge.tone === "success"
                                    ? "#166534"
                                    : badge.tone === "warning"
                                      ? "#991b1b"
                                      : "var(--muted)",
                              }}
                            >
                              {lang === "ur" ? badge.labelUr : badge.labelEn}
                            </span>
                          </td>
                          <td
                            style={{ padding: "10px 14px", color: "#334155" }}
                          >
                            {rec.findings}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 4: MSDS FMS 122–125 STATISTICS & KPIS */}
        {activeTab === "statistics" && (
          <section data-section="statistics">
            {!stats ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#94a3b8",
                }}
              >
                {" "}
                {equipmentText("Loading compliance metrics...", lang)}{" "}
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                    marginBottom: "24px",
                  }}
                >
                  {/* Metric: On-Time Rate */}
                  <div
                    style={{
                      background: "var(--paper)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText(
                        "MSDS FMS 125: On-Time Compliance",
                        lang,
                      )}{" "}
                    </div>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: "800",
                        color: "var(--ink)",
                      }}
                    >
                      {formatComplianceRate(stats.on_time_pct).formatted}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginTop: "4px",
                      }}
                    >
                      {stats.on_time} / {stats.planned_done}{" "}
                      {equipmentText(
                        "planned visits within grace period",
                        lang,
                      )}{" "}
                    </div>
                  </div>

                  {/* Metric: Overdue Plans */}
                  <div
                    style={{
                      background: "var(--paper)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText("Overdue Plans (FMS 122)", lang)}{" "}
                    </div>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: "800",
                        color: stats.overdue_plans > 0 ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {stats.overdue_plans}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginTop: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText("Plans exceeding OEM interval", lang)}{" "}
                    </div>
                  </div>

                  {/* Metric: Out of Service */}
                  <div
                    style={{
                      background: "var(--paper)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText("Out of Service Devices", lang)}{" "}
                    </div>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: "800",
                        color: stats.out_of_service > 0 ? "#ea580c" : "#16a34a",
                      }}
                    >
                      {stats.out_of_service}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginTop: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText(
                        "Taken offline due to failed tests",
                        lang,
                      )}{" "}
                    </div>
                  </div>

                  {/* Metric: Calibrations */}
                  <div
                    style={{
                      background: "var(--paper)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText("Calibrations Logged", lang)}{" "}
                    </div>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: "800",
                        color: "#2563eb",
                      }}
                    >
                      {stats.calibrations}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginTop: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText(
                        "With valid certification stamps",
                        lang,
                      )}{" "}
                    </div>
                  </div>

                  {/* Metric: Breakdowns */}
                  <div
                    style={{
                      background: "var(--paper)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText("Failures & Breakdowns", lang)}{" "}
                    </div>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: "800",
                        color: "#b91c1c",
                      }}
                    >
                      {stats.failures} / {stats.breakdowns}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginTop: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText(
                        "Failures / Emergency breakdowns",
                        lang,
                      )}{" "}
                    </div>
                  </div>

                  {/* Metric: Contracts Expired */}
                  <div
                    style={{
                      background: "var(--paper)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText("Contracts Expired (FMS 124)", lang)}{" "}
                    </div>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: "800",
                        color:
                          stats.contracts_expired > 0 ? "#d97706" : "#16a34a",
                      }}
                    >
                      {stats.contracts_expired}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginTop: "4px",
                      }}
                    >
                      {" "}
                      {equipmentText(
                        "External vendor MOUs requiring renewal",
                        lang,
                      )}{" "}
                    </div>
                  </div>
                </div>

                {/* FMS Requirements Reference Card */}
                <div
                  style={{
                    background: "var(--paper)",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "20px",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: "1.1rem",
                      fontWeight: "700",
                    }}
                  >
                    {" "}
                    {equipmentText(
                      "MSDS FMS 122–125 Healthcare Standards Overview",
                      lang,
                    )}{" "}
                  </h3>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "20px",
                      color: "#475569",
                      lineHeight: "1.6",
                      fontSize: "0.9rem",
                    }}
                  >
                    <li>
                      <strong> {equipmentText("FMS 122:", lang)} </strong>{" "}
                      {equipmentText(
                        "Hospital maintains an updated inventory of all medical equipment, with manufacturer guidelines, preventive maintenance schedule, and calibration certificate numbers.",
                        lang,
                      )}{" "}
                    </li>
                    <li>
                      <strong> {equipmentText("FMS 123:", lang)} </strong>{" "}
                      {equipmentText(
                        "Medical equipment is commissioned before use and tested by qualified staff or authorized contractor engineers.",
                        lang,
                      )}{" "}
                    </li>
                    <li>
                      <strong> {equipmentText("FMS 124:", lang)} </strong>{" "}
                      {equipmentText(
                        "Formal service contract/MOU is maintained with vendors for high-end equipment maintenance, with defined response times.",
                        lang,
                      )}{" "}
                    </li>
                    <li>
                      <strong> {equipmentText("FMS 125:", lang)} </strong>{" "}
                      {equipmentText(
                        "Medical equipment maintenance is monitored and evaluated against on-time compliance benchmarks (grace period of",
                        lang,
                      )}{" "}
                      {stats.grace_days} {equipmentText("days).", lang)}{" "}
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 5: ASSET ONBOARDING WIZARD (rule:79dedf48b1) */}
        {activeTab === "onboarding" && (
          <section
            data-section="onboarding"
            style={{
              maxWidth: "800px",
              margin: "0 auto",
              background: "var(--paper)",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "24px",
            }}
          >
            {/* Wizard Progress Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "24px",
                position: "relative",
              }}
            >
              <div style={{ textAlign: "center", flex: 1 }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: onboardStep >= 1 ? "#2563eb" : "var(--line)",
                    color: "var(--accent-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 6px",
                    fontWeight: "bold",
                  }}
                >
                  1
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: onboardStep === 1 ? "700" : "500",
                    color: onboardStep === 1 ? "#2563eb" : "var(--muted)",
                  }}
                >
                  {" "}
                  {equipmentText("Asset Register", lang)}{" "}
                </div>
              </div>

              <div style={{ textAlign: "center", flex: 1 }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: onboardStep >= 2 ? "#2563eb" : "var(--line)",
                    color: "var(--accent-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 6px",
                    fontWeight: "bold",
                  }}
                >
                  2
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: onboardStep === 2 ? "700" : "500",
                    color: onboardStep === 2 ? "#2563eb" : "var(--muted)",
                  }}
                >
                  {" "}
                  {equipmentText("Medical Specs", lang)}{" "}
                </div>
              </div>

              <div style={{ textAlign: "center", flex: 1 }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: onboardStep >= 3 ? "#2563eb" : "var(--line)",
                    color: "var(--accent-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 6px",
                    fontWeight: "bold",
                  }}
                >
                  3
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: onboardStep === 3 ? "700" : "500",
                    color: onboardStep === 3 ? "#2563eb" : "var(--muted)",
                  }}
                >
                  {" "}
                  {equipmentText("OEM Plan", lang)}{" "}
                </div>
              </div>

              <div style={{ textAlign: "center", flex: 1 }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: onboardStep >= 4 ? "#2563eb" : "var(--line)",
                    color: "var(--accent-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 6px",
                    fontWeight: "bold",
                  }}
                >
                  4
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: onboardStep === 4 ? "700" : "500",
                    color: onboardStep === 4 ? "#2563eb" : "var(--muted)",
                  }}
                >
                  {" "}
                  {equipmentText("Commissioning", lang)}{" "}
                </div>
              </div>
            </div>

            {/* STEP 1: Core Hospital Asset (POST /ops/assets) */}
            {onboardStep === 1 && (
              <form onSubmit={handleOnboardStep1}>
                <label>{t('Department','شعبہ')}<DirectoryPicker path="/admin/departments" idField="department_id" value={onboardAssetIn.department_id??''} onChange={e=>setOnboardAssetIn({...onboardAssetIn,department_id:e.target.value?Number(e.target.value):null})} data-help="em-onboard-location"/></label>
                <label>{t('Ward','وارڈ')}<DirectoryPicker path="/beds/matrix?include_beds=false" idField="ward_id" list="wards" value={onboardAssetIn.ward_id??''} onChange={e=>setOnboardAssetIn({...onboardAssetIn,ward_id:e.target.value?Number(e.target.value):null})} data-help="em-onboard-location"/></label>
                {errorMessage && (
                  <p
                    role="alert"
                    style={{
                      background: "var(--error)",
                      color: "var(--ink)",
                      padding: 10,
                    }}
                  >
                    {errorMessage}
                  </p>
                )}
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "1.1rem",
                    fontWeight: "700",
                  }}
                >
                  {" "}
                  {equipmentText(
                    "Step 1: Register Hospital Asset (POST /ops/assets)",
                    lang,
                  )}{" "}
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-tag"
                    >
                      {" "}
                      {equipmentText("Asset Tag *", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-tag"
                      placeholder="e.g. EQ-MED-VENT-01"
                      value={onboardAssetIn.asset_tag || ""}
                      onChange={(e) =>
                        setOnboardAssetIn({
                          ...onboardAssetIn,
                          asset_tag: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: onboardErrors.asset_tag
                          ? "1px solid #ef4444"
                          : "1px solid #cbd5e1",
                      }}
                      id="em-onboard-tag"
                    />
                    {onboardErrors.asset_tag && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {onboardErrors.asset_tag}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-name"
                    >
                      {" "}
                      {equipmentText("Asset Name *", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-name"
                      placeholder="e.g. ICU Ventilator Dräger Evita"
                      value={onboardAssetIn.name || ""}
                      onChange={(e) =>
                        setOnboardAssetIn({
                          ...onboardAssetIn,
                          name: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: onboardErrors.name
                          ? "1px solid #ef4444"
                          : "1px solid #cbd5e1",
                      }}
                      id="em-onboard-name"
                    />
                    {onboardErrors.name && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {onboardErrors.name}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-category"
                    >
                      {" "}
                      {equipmentText("Category *", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-category"
                      value={onboardAssetIn.category || "MedicalEquipment"}
                      onChange={(e) =>
                        setOnboardAssetIn({
                          ...onboardAssetIn,
                          category: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-category"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-serial"
                    >
                      {" "}
                      {equipmentText("Serial Number", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-serial"
                      placeholder="e.g. SN-98127391"
                      value={onboardAssetIn.serial_no || ""}
                      onChange={(e) =>
                        setOnboardAssetIn({
                          ...onboardAssetIn,
                          serial_no: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-serial"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-location"
                    >
                      {" "}
                      {equipmentText("Location / Room", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-location"
                      placeholder="e.g. ICU Bed 4"
                      value={onboardAssetIn.location || ""}
                      onChange={(e) =>
                        setOnboardAssetIn({
                          ...onboardAssetIn,
                          location: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-location"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-cost"
                    >
                      {" "}
                      {equipmentText("Purchase Cost (PKR)", lang)}{" "}
                    </label>
                    <input
                      type="number"
                      data-help="em-onboard-cost"
                      placeholder="e.g. 1500000"
                      value={onboardAssetIn.purchase_cost || ""}
                      onChange={(e) =>
                        setOnboardAssetIn({
                          ...onboardAssetIn,
                          purchase_cost: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-cost"
                    />
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    type="submit"
                    data-help="em-onboard-step1-btn"
                    disabled={loading}
                    style={{
                      padding: "8px 18px",
                      background: "#2563eb",
                      color: "var(--accent-text)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    {" "}
                    {equipmentText("Continue to Step 2 ➔", lang)}{" "}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Medical Equipment Attributes (PUT /facility/equipment/{asset_id}) */}
            {onboardStep === 2 && (
              <form onSubmit={handleOnboardStep2}>
                <label>{t('Theatre','تھیٹر')}<DirectoryPicker path="/ot/theaters" idField="ot_id" value={onboardEquipIn.ot_id??''} onChange={e=>setOnboardEquipIn({...onboardEquipIn,ot_id:e.target.value?Number(e.target.value):null})} data-help="em-onboard-maintainer"/></label>
                {errorMessage && (
                  <p
                    role="alert"
                    style={{
                      background: "var(--error)",
                      color: "var(--ink)",
                      padding: 10,
                    }}
                  >
                    {errorMessage}
                  </p>
                )}
                <label style={{ display: "block", marginBlock: "10px" }}>
                  {t("Supplier (optional)", "فراہم کنندہ (اختیاری)")}
                  <DirectoryPicker
                    data-help="em-onboard-supplier"
                    value={onboardEquipIn.supplier_vendor_id ?? ""}
                    onChange={(e) =>
                      setOnboardEquipIn({
                        ...onboardEquipIn,
                        supplier_vendor_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    id="em-onboard-supplier"
                   path="/finance/vendors?vendor_type=EquipmentSupplier" idField="vendor_id" />
                </label>
                <label style={{ display: "block", marginBlock: "10px" }}>
                  {t(
                    "Service contractor (optional)",
                    "دیکھ بھال کا ٹھیکیدار (اختیاری)",
                  )}
                  <DirectoryPicker
                    data-help="em-onboard-service-vendor"
                    value={onboardEquipIn.service_vendor_id ?? ""}
                    onChange={(e) =>
                      setOnboardEquipIn({
                        ...onboardEquipIn,
                        service_vendor_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    id="em-onboard-service-vendor"
                   path="/finance/vendors?vendor_type=Contractor" idField="vendor_id" />
                </label>
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "1.1rem",
                    fontWeight: "700",
                  }}
                >
                  {t(
                    "Step 2: Equipment details and service contract",
                    "مرحلہ 2: آلات کی تفصیل اور سروس کا معاہدہ",
                  )}
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-maker"
                    >
                      {" "}
                      {equipmentText("Manufacturer", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-maker"
                      placeholder="e.g. Dräger, GE Healthcare, Philips"
                      value={onboardEquipIn.manufacturer || ""}
                      onChange={(e) =>
                        setOnboardEquipIn({
                          ...onboardEquipIn,
                          manufacturer: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-maker"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-model"
                    >
                      {" "}
                      {equipmentText("Model", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-model"
                      placeholder="e.g. Evita V500"
                      value={onboardEquipIn.model || ""}
                      onChange={(e) =>
                        setOnboardEquipIn({
                          ...onboardEquipIn,
                          model: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-model"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-maintainer"
                    >
                      {" "}
                      {equipmentText("Maintenance Provider", lang)}{" "}
                    </label>
                    <select
                      data-help="em-onboard-maintainer"
                      value={onboardEquipIn.maintained_by}
                      onChange={(e) =>
                        setOnboardEquipIn({
                          ...onboardEquipIn,
                          maintained_by: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-maintainer"
                    >
                      <option value="InHouse">
                        {" "}
                        {equipmentText(
                          "In House Hospital Technicians",
                          lang,
                        )}{" "}
                      </option>
                      <option value="Contractor">
                        {" "}
                        {equipmentText(
                          "Contractor (External Service Partner)",
                          lang,
                        )}{" "}
                      </option>
                      <option value="Mixed">
                        {" "}
                        {equipmentText(
                          "Mixed (In House + Contractor)",
                          lang,
                        )}{" "}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-warranty"
                    >
                      {" "}
                      {equipmentText("Warranty Expiry Date", lang)}{" "}
                    </label>
                    <input
                      type="date"
                      data-help="em-onboard-warranty"
                      value={onboardEquipIn.warranty_until || ""}
                      onChange={(e) =>
                        setOnboardEquipIn({
                          ...onboardEquipIn,
                          warranty_until: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-warranty"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-contract-ref"
                    >
                      {" "}
                      {equipmentText("Service Contract Ref (MOU)", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-contract-ref"
                      placeholder="e.g. MOU-2026-MED-04"
                      value={onboardEquipIn.service_contract_ref || ""}
                      onChange={(e) =>
                        setOnboardEquipIn({
                          ...onboardEquipIn,
                          service_contract_ref: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-contract-ref"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-contract-until"
                    >
                      {" "}
                      {equipmentText("Service Contract Expiry Date", lang)}{" "}
                    </label>
                    <input
                      type="date"
                      data-help="em-onboard-contract-until"
                      value={onboardEquipIn.service_contract_until || ""}
                      onChange={(e) =>
                        setOnboardEquipIn({
                          ...onboardEquipIn,
                          service_contract_until: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-contract-until"
                    />
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    type="submit"
                    data-help="em-onboard-step2-btn"
                    disabled={loading}
                    style={{
                      padding: "8px 18px",
                      background: "#2563eb",
                      color: "var(--accent-text)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    {" "}
                    {equipmentText("Continue to Step 3 ➔", lang)}{" "}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: OEM Maintenance Plan (POST /facility/equipment/{asset_id}/plans) */}
            {onboardStep === 3 && (
              <form onSubmit={handleOnboardStep3}>
                {errorMessage && (
                  <p
                    role="alert"
                    style={{
                      background: "var(--error)",
                      color: "var(--ink)",
                      padding: 10,
                    }}
                  >
                    {errorMessage}
                  </p>
                )}
                {onboardPlanIn.performed_by === "Contractor" && (
                  <>
                    <label style={{ display: "block", marginBlock: "10px" }}>
                      {t("Contractor *", "ٹھیکیدار *")}
                      <DirectoryPicker
                        data-help="em-onboard-plan-vendor"
                        value={onboardPlanIn.vendor_id ?? ""}
                        onChange={(e) =>
                          setOnboardPlanIn({
                            ...onboardPlanIn,
                            vendor_id: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        required
                        id="em-onboard-plan-vendor"
                       path="/finance/vendors?vendor_type=Contractor" idField="vendor_id" />
                    </label>
                  </>
                )}
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "1.1rem",
                    fontWeight: "700",
                  }}
                >
                  {t(
                    "Step 3: Manufacturer maintenance plan",
                    "مرحلہ 3: سازندے کی ہدایات کے مطابق منصوبہ",
                  )}
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-plan-kind"
                    >
                      {" "}
                      {equipmentText("Maintenance Kind *", lang)}{" "}
                    </label>
                    <select
                      data-help="em-onboard-plan-kind"
                      value={onboardPlanIn.kind}
                      onChange={(e) =>
                        setOnboardPlanIn({
                          ...onboardPlanIn,
                          kind: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-plan-kind"
                    >
                      <option value="PreventiveMaintenance">
                        {" "}
                        {equipmentText("Preventive Maintenance", lang)}{" "}
                      </option>
                      <option value="Calibration">
                        {" "}
                        {equipmentText("Calibration", lang)}{" "}
                      </option>
                      <option value="Inspection">
                        {" "}
                        {equipmentText("Safety Inspection", lang)}{" "}
                      </option>
                      <option value="ElectricalSafety">
                        {" "}
                        {equipmentText("Electrical Safety", lang)}{" "}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-interval"
                    >
                      {" "}
                      {equipmentText(
                        "Interval Days (from OEM Manual) *",
                        lang,
                      )}{" "}
                    </label>
                    <input
                      type="number"
                      data-help="em-onboard-interval"
                      placeholder="90 = quarterly, 180 = semi-annual, 365 = annual"
                      value={onboardPlanIn.interval_days ?? ""}
                      onChange={(e) =>
                        setOnboardPlanIn({
                          ...onboardPlanIn,
                          interval_days: Number(e.target.value),
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: onboardErrors.interval_days
                          ? "1px solid #ef4444"
                          : "1px solid #cbd5e1",
                      }}
                      id="em-onboard-interval"
                    />
                    {onboardErrors.interval_days && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {onboardErrors.interval_days}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-plan-performed-by"
                    >
                      {" "}
                      {equipmentText("Performed By *", lang)}{" "}
                    </label>
                    <select
                      data-help="em-onboard-plan-performed-by"
                      value={onboardPlanIn.performed_by}
                      onChange={(e) =>
                        setOnboardPlanIn({
                          ...onboardPlanIn,
                          performed_by: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-plan-performed-by"
                    >
                      <option value="InHouse">
                        {" "}
                        {equipmentText("In-House Staff", lang)}{" "}
                      </option>
                      <option value="Contractor">
                        {" "}
                        {equipmentText("Contractor Engineer", lang)}{" "}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-plan-due"
                    >
                      {" "}
                      {equipmentText("First Due Date *", lang)}{" "}
                    </label>
                    <input
                      type="date"
                      data-help="em-onboard-plan-due"
                      value={onboardPlanIn.next_due || ""}
                      onChange={(e) =>
                        setOnboardPlanIn({
                          ...onboardPlanIn,
                          next_due: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-plan-due"
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-plan-oem"
                    >
                      {" "}
                      {equipmentText(
                        "OEM Guideline Reference / Protocol Note",
                        lang,
                      )}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-plan-oem"
                      placeholder="e.g. Dräger Evita V500 Service Manual Section 4.2"
                      value={onboardPlanIn.oem_reference || ""}
                      onChange={(e) =>
                        setOnboardPlanIn({
                          ...onboardPlanIn,
                          oem_reference: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-plan-oem"
                    />
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    type="submit"
                    data-help="em-onboard-step3-btn"
                    disabled={loading}
                    style={{
                      padding: "8px 18px",
                      background: "#2563eb",
                      color: "var(--accent-text)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    {" "}
                    {equipmentText("Continue to Step 4 ➔", lang)}{" "}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Initial Commissioning Visit (POST /facility/equipment/{asset_id}/maintenance) */}
            {onboardStep === 4 && (
              <form onSubmit={handleOnboardStep4}>
                {errorMessage && (
                  <p
                    role="alert"
                    style={{
                      background: "var(--error)",
                      color: "var(--ink)",
                      padding: 10,
                    }}
                  >
                    {errorMessage}
                  </p>
                )}
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "1.1rem",
                    fontWeight: "700",
                  }}
                >
                  {" "}
                  {equipmentText(
                    "Step 4: Record Commissioning Visit (Establishes commissioned_on)",
                    lang,
                  )}{" "}
                </h3>

                <div
                  style={{
                    background: "#e0f2fe",
                    borderLeft: "4px solid #0284c7",
                    padding: "10px 14px",
                    borderRadius: "4px",
                    marginBottom: "16px",
                    color: "#0369a1",
                    fontSize: "0.85rem",
                  }}
                >
                  {" "}
                  {equipmentText(
                    "MSDS FMS 122 ii b mandate: Recording the Commissioning visit dates",
                    lang,
                  )}{" "}
                  <code> {equipmentText("commissioned_on", lang)} </code>{" "}
                  {equipmentText(
                    "and approves the device for active patient care.",
                    lang,
                  )}{" "}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-comm-date"
                    >
                      {" "}
                      {equipmentText("Commissioning Date *", lang)}{" "}
                    </label>
                    <input
                      type="date"
                      data-help="em-onboard-comm-date"
                      value={onboardVisitIn.performed_on || ""}
                      onChange={(e) =>
                        setOnboardVisitIn({
                          ...onboardVisitIn,
                          performed_on: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-comm-date"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-comm-staff"
                    >
                      {" "}
                      {equipmentText(
                        "Commissioning Officer (In-House Staff)",
                        lang,
                      )}{" "}
                    </label>
                    <select
                      data-help="em-onboard-comm-staff"
                      value={onboardVisitIn.employee_id || ""}
                      onChange={(e) =>
                        setOnboardVisitIn({
                          ...onboardVisitIn,
                          employee_id: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-comm-staff"
                    >
                      <option value="">
                        {" "}
                        {equipmentText(
                          "Select Hospital Engineer / Official",
                          lang,
                        )}{" "}
                      </option>
                      {staffList.map((st) => (
                        <option key={st.employee_id} value={st.employee_id}>
                          {st.full_name} ({st.designation})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-comm-result"
                    >
                      {" "}
                      {equipmentText("Result *", lang)}{" "}
                    </label>
                    <select
                      data-help="em-onboard-comm-result"
                      value={onboardVisitIn.result ?? ""}
                      onChange={(e) =>
                        setOnboardVisitIn({
                          ...onboardVisitIn,
                          result: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-comm-result"
                    >
                      <option value="">
                        {t("Select the actual result", "اصل نتیجہ منتخب کریں")}
                      </option>
                      <option value="Pass">
                        {" "}
                        {equipmentText(
                          "Pass (Ready for Clinical Service)",
                          lang,
                        )}{" "}
                      </option>
                      <option value="Adjusted">
                        {" "}
                        {equipmentText(
                          "Adjusted (Calibrated & Passed)",
                          lang,
                        )}{" "}
                      </option>
                      <option value="Fail">
                        {" "}
                        {equipmentText("Fail (Unfit for Service)", lang)}{" "}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-comm-cert"
                    >
                      {" "}
                      {equipmentText(
                        "Certificate / Installation Report Reference",
                        lang,
                      )}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-onboard-comm-cert"
                      placeholder="e.g. COMM-CERT-2026-09"
                      value={onboardVisitIn.certificate_no || ""}
                      onChange={(e) =>
                        setOnboardVisitIn({
                          ...onboardVisitIn,
                          certificate_no: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-onboard-comm-cert"
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-onboard-comm-findings"
                    >
                      {" "}
                      {equipmentText(
                        "Commissioning Findings & Installation Tests *",
                        lang,
                      )}{" "}
                    </label>
                    <textarea
                      rows={3}
                      data-help="em-onboard-comm-findings"
                      value={onboardVisitIn.findings || ""}
                      onChange={(e) =>
                        setOnboardVisitIn({
                          ...onboardVisitIn,
                          findings: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: onboardErrors.findings
                          ? "1px solid #ef4444"
                          : "1px solid #cbd5e1",
                      }}
                      id="em-onboard-comm-findings"
                    />
                    {onboardErrors.findings && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {onboardErrors.findings}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    type="submit"
                    data-help="em-onboard-step4-btn"
                    disabled={loading}
                    style={{
                      padding: "10px 24px",
                      background: "#16a34a",
                      color: "var(--accent-text)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "700",
                    }}
                  >
                    {" "}
                    {equipmentText(
                      "Complete Onboarding & Commission Item ✔",
                      lang,
                    )}{" "}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* MODAL 1: RECORD VISIT (rule:f6412c4eca) */}
        {isRecordVisitModalOpen && targetAssetForVisit && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "var(--paper)",
                borderRadius: "8px",
                width: "600px",
                maxWidth: "90%",
                padding: "24px",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
              role="dialog"
              aria-modal="true"
              data-equipment-dialog
              tabIndex={-1}
              aria-label={t("Record equipment visit", "آلات کا وزٹ درج کریں")}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                <h3
                  style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}
                >
                  {" "}
                  {equipmentText(
                    "Record Maintenance / Calibration Visit (rule:f6412c4eca)",
                    lang,
                  )}{" "}
                </h3>
                <button
                  type="button"
                  data-help="em-visit-modal-close"
                  onClick={() => setIsRecordVisitModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  background: "var(--soft)",
                  padding: "10px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  fontSize: "0.85rem",
                }}
              >
                {" "}
                {equipmentText("Asset:", lang)}{" "}
                <strong>{targetAssetForVisit.asset_name}</strong> (
                {targetAssetForVisit.asset_tag})
              </div>

              <form onSubmit={handleSubmitVisit}>
                {visitFormData.kind==='Breakdown'&&<label>{t('Repair work order','مرمت کا کام')}<DirectoryPicker path="/ops/work-orders" idField="work_order_id" value={visitFormData.work_order_id??''} onChange={e=>setVisitFormData({...visitFormData,work_order_id:e.target.value?Number(e.target.value):null})} data-help="em-visit-findings"/></label>}
                {errorMessage && (
                  <p
                    role="alert"
                    style={{
                      background: "var(--error)",
                      color: "var(--ink)",
                      padding: 10,
                    }}
                  >
                    {errorMessage}
                  </p>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-visit-kind"
                    >
                      {" "}
                      {equipmentText("Visit Kind *", lang)}{" "}
                    </label>
                    <select
                      data-help="em-visit-kind"
                      value={visitFormData.kind}
                      onChange={(e) =>
                        setVisitFormData({
                          ...visitFormData,
                          kind: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-visit-kind"
                    >
                      <option value="PreventiveMaintenance">
                        {" "}
                        {equipmentText("Preventive Maintenance", lang)}{" "}
                      </option>
                      <option value="Calibration">
                        {" "}
                        {equipmentText("Calibration", lang)}{" "}
                      </option>
                      <option value="Inspection">
                        {" "}
                        {equipmentText("Inspection", lang)}{" "}
                      </option>
                      <option value="ElectricalSafety">
                        {" "}
                        {equipmentText("Electrical Safety", lang)}{" "}
                      </option>
                      <option value="Breakdown">
                        {" "}
                        {equipmentText("Breakdown Repair", lang)}{" "}
                      </option>
                      <option value="Commissioning">
                        {" "}
                        {equipmentText("Commissioning", lang)}{" "}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-visit-date"
                    >
                      {" "}
                      {equipmentText("Visit Date *", lang)}{" "}
                    </label>
                    <input
                      type="date"
                      data-help="em-visit-date"
                      value={visitFormData.performed_on || ""}
                      onChange={(e) =>
                        setVisitFormData({
                          ...visitFormData,
                          performed_on: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-visit-date"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-visit-result"
                    >
                      {" "}
                      {equipmentText("Result *", lang)}{" "}
                    </label>
                    <select
                      data-help="em-visit-result"
                      value={visitFormData.result ?? ""}
                      onChange={(e) =>
                        setVisitFormData({
                          ...visitFormData,
                          result: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-visit-result"
                    >
                      <option value="">
                        {t("Select the actual result", "اصل نتیجہ منتخب کریں")}
                      </option>
                      <option value="Pass">
                        {" "}
                        {equipmentText("Pass", lang)}{" "}
                      </option>
                      <option value="Adjusted">
                        {" "}
                        {equipmentText("Adjusted (Calibrated)", lang)}{" "}
                      </option>
                      <option value="Fail">
                        {" "}
                        {equipmentText(
                          "Fail (Takes out of service)",
                          lang,
                        )}{" "}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-visit-performed-by"
                    >
                      {" "}
                      {equipmentText("Provider Type", lang)}{" "}
                    </label>
                    <select
                      data-help="em-visit-performed-by"
                      value={visitPerformedBy}
                      onChange={(e) =>
                        setVisitPerformedBy(e.target.value as any)
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-visit-performed-by"
                    >
                      <option value="InHouse">
                        {" "}
                        {equipmentText("In-House Staff", lang)}{" "}
                      </option>
                      <option value="Contractor">
                        {" "}
                        {equipmentText("Contractor Engineer", lang)}{" "}
                      </option>
                    </select>
                  </div>

                  {visitPerformedBy === "InHouse" ? (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          marginBottom: "4px",
                        }}
                        htmlFor="em-visit-staff-select"
                      >
                        {" "}
                        {equipmentText(
                          "Hospital Staff Technician (GET /facility/staff) *",
                          lang,
                        )}{" "}
                      </label>
                      <select
                        data-help="em-visit-staff-select"
                        value={visitFormData.employee_id || ""}
                        onChange={(e) =>
                          setVisitFormData({
                            ...visitFormData,
                            employee_id: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: visitErrors.employee_id
                            ? "1px solid #ef4444"
                            : "1px solid #cbd5e1",
                        }}
                        id="em-visit-staff-select"
                      >
                        <option value="">
                          {" "}
                          {equipmentText(
                            "Select Technician / Official",
                            lang,
                          )}{" "}
                        </option>
                        {staffList.map((st) => (
                          <option key={st.employee_id} value={st.employee_id}>
                            {st.full_name} ({st.designation})
                          </option>
                        ))}
                      </select>
                      {visitErrors.employee_id && (
                        <div
                          style={{
                            color: "#ef4444",
                            fontSize: "0.8rem",
                            marginTop: "2px",
                          }}
                        >
                          {visitErrors.employee_id}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            fontWeight: "600",
                            marginBottom: "4px",
                          }}
                          htmlFor="em-visit-technician"
                        >
                          {" "}
                          {equipmentText(
                            "Contractor Technician Name *",
                            lang,
                          )}{" "}
                        </label>
                        <input
                          type="text"
                          data-help="em-visit-technician"
                          placeholder="e.g. Engr. Asim"
                          value={visitFormData.technician || ""}
                          onChange={(e) =>
                            setVisitFormData({
                              ...visitFormData,
                              technician: e.target.value,
                            })
                          }
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "4px",
                            border: visitErrors.technician
                              ? "1px solid #ef4444"
                              : "1px solid #cbd5e1",
                          }}
                          id="em-visit-technician"
                        />
                        {visitErrors.technician && (
                          <div
                            style={{
                              color: "#ef4444",
                              fontSize: "0.8rem",
                              marginTop: "2px",
                            }}
                          >
                            {visitErrors.technician}
                          </div>
                        )}
                      </div>

                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            fontWeight: "600",
                            marginBottom: "4px",
                          }}
                          htmlFor="em-visit-vendor-id"
                        >
                          {" "}
                          {t("Contractor", "ٹھیکیدار")}{" "}
                        </label>
                        <DirectoryPicker
                          data-help="em-visit-vendor-id"
                          value={visitFormData.vendor_id || ""}
                          onChange={(e) =>
                            setVisitFormData({
                              ...visitFormData,
                              vendor_id: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "4px",
                            border: "1px solid #cbd5e1",
                          }}
                          id="em-visit-vendor-id"
                         path="/finance/vendors?vendor_type=Contractor" idField="vendor_id" />
                      </div>
                    </>
                  )}

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-visit-cert"
                    >
                      {" "}
                      {equipmentText(
                        "Calibration Certificate Number",
                        lang,
                      )}{" "}
                      {visitFormData.kind === "Calibration" &&
                      visitFormData.result !== "Fail"
                        ? "*"
                        : ""}
                    </label>
                    <input
                      type="text"
                      data-help="em-visit-cert"
                      placeholder="e.g. ISO-CAL-2026-449"
                      value={visitFormData.certificate_no || ""}
                      onChange={(e) =>
                        setVisitFormData({
                          ...visitFormData,
                          certificate_no: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: visitErrors.certificate_no
                          ? "1px solid #ef4444"
                          : "1px solid #cbd5e1",
                      }}
                      id="em-visit-cert"
                    />
                    {visitErrors.certificate_no && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {visitErrors.certificate_no}
                      </div>
                    )}
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-visit-findings"
                    >
                      {" "}
                      {equipmentText("Findings & Technical Notes *", lang)}{" "}
                    </label>
                    <textarea
                      rows={3}
                      data-help="em-visit-findings"
                      placeholder="Document test values, parts replaced, calibration results..."
                      value={visitFormData.findings || ""}
                      onChange={(e) =>
                        setVisitFormData({
                          ...visitFormData,
                          findings: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: visitErrors.findings
                          ? "1px solid #ef4444"
                          : "1px solid #cbd5e1",
                      }}
                      id="em-visit-findings"
                    />
                    {visitErrors.findings && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {visitErrors.findings}
                      </div>
                    )}
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.9rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        data-help="em-visit-return-service"
                        checked={visitFormData.return_to_service}
                        onChange={(e) =>
                          setVisitFormData({
                            ...visitFormData,
                            return_to_service: e.target.checked,
                          })
                        }
                        id="em-visit-return-service"
                      />
                      <span>
                        {" "}
                        {equipmentText(
                          "Return to Service (Restore Active state if currently Out of Service)",
                          lang,
                        )}{" "}
                      </span>
                    </label>
                  </div>
                </div>

                {visitFormData.result === "Fail" && (
                  <div
                    style={{
                      background: "#fef2f2",
                      borderLeft: "4px solid #ef4444",
                      padding: "10px",
                      borderRadius: "4px",
                      marginBottom: "14px",
                      color: "#991b1b",
                      fontSize: "0.85rem",
                    }}
                  >
                    ⚠️ <strong> {equipmentText("Warning:", lang)} </strong>{" "}
                    {equipmentText(
                      "Recording a Fail result will take this medical equipment",
                      lang,
                    )}{" "}
                    <strong> {equipmentText("Out of Service", lang)} </strong>{" "}
                    {equipmentText("for patient safety.", lang)}{" "}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsRecordVisitModalOpen(false)}
                    style={{
                      padding: "8px 14px",
                      background: "var(--soft)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    data-help="em-visit-cancel"
                  >
                    {" "}
                    {equipmentText("Cancel", lang)}{" "}
                  </button>
                  <button
                    type="submit"
                    data-help="em-visit-submit-btn"
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      background: "#2563eb",
                      color: "var(--accent-text)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    {loading
                      ? equipmentText("Recording...", lang)
                      : equipmentText("Save Maintenance Visit", lang)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: ADD / EDIT MAINTENANCE PLAN */}
        {isPlanModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "var(--paper)",
                borderRadius: "8px",
                width: "550px",
                maxWidth: "90%",
                padding: "24px",
              }}
              role="dialog"
              aria-modal="true"
              data-equipment-dialog
              tabIndex={-1}
              aria-label={t("Equipment editor", "آلات کا ترمیمی مکالمہ")}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                <h3
                  style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}
                >
                  {planModalMode === "create"
                    ? "Add Maintenance Plan (OEM Protocol)"
                    : equipmentText("Edit Maintenance Plan", lang)}
                </h3>
                <button
                  type="button"
                  data-help="em-plan-modal-close"
                  onClick={() => setIsPlanModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitPlan}>
                {errorMessage && (
                  <p
                    role="alert"
                    style={{
                      background: "var(--error)",
                      color: "var(--ink)",
                      padding: 10,
                    }}
                  >
                    {errorMessage}
                  </p>
                )}
                {planFormData.performed_by === "Contractor" && (
                  <>
                    <label style={{ display: "block", marginBlock: "10px" }}>
                      {t("Contractor *", "ٹھیکیدار *")}
                      <DirectoryPicker
                        data-help="em-plan-vendor"
                        value={planFormData.vendor_id ?? ""}
                        onChange={(e) =>
                          setPlanFormData({
                            ...planFormData,
                            vendor_id: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        required
                        id="em-plan-vendor"
                       path="/finance/vendors?vendor_type=Contractor" idField="vendor_id" />
                    </label>
                  </>
                )}
                <label>
                  {t("OEM reference", "سازندے کی ہدایات کا حوالہ")}
                  <input
                    data-help="em-plan-oem"
                    value={planFormData.oem_reference ?? ""}
                    maxLength={500}
                    onChange={(e) =>
                      setPlanFormData({
                        ...planFormData,
                        oem_reference: e.target.value,
                      })
                    }
                    id="em-plan-oem"
                  />
                </label>
                <label>
                  {t("Maintenance checklist", "دیکھ بھال کی جانچ فہرست")}
                  <textarea
                    data-help="em-plan-checklist"
                    value={planFormData.checklist ?? ""}
                    maxLength={4000}
                    onChange={(e) =>
                      setPlanFormData({
                        ...planFormData,
                        checklist: e.target.value,
                      })
                    }
                    id="em-plan-checklist"
                  />
                </label>
                {planModalMode === "edit" && (
                  <label>
                    <input
                      type="checkbox"
                      data-help="em-plan-active"
                      checked={planFormData.is_active ?? true}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          is_active: e.target.checked,
                        })
                      }
                      id="em-plan-active"
                    />
                    {t(
                      "Plan remains active (uncheck to end it)",
                      "منصوبہ فعال ہے (ختم کرنے کے لیے نشان ہٹائیں)",
                    )}
                  </label>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-plan-kind"
                    >
                      {" "}
                      {equipmentText("Kind *", lang)}{" "}
                    </label>
                    <select
                      data-help="em-plan-kind"
                      disabled={planModalMode === "edit"}
                      value={planFormData.kind}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          kind: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-plan-kind"
                    >
                      <option value="PreventiveMaintenance">
                        {" "}
                        {equipmentText("Preventive Maintenance", lang)}{" "}
                      </option>
                      <option value="Calibration">
                        {" "}
                        {equipmentText("Calibration", lang)}{" "}
                      </option>
                      <option value="Inspection">
                        {" "}
                        {equipmentText("Inspection", lang)}{" "}
                      </option>
                      <option value="ElectricalSafety">
                        {" "}
                        {equipmentText("Electrical Safety", lang)}{" "}
                      </option>
                    </select>
                    {planErrors.kind && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {planErrors.kind}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-plan-interval"
                    >
                      {" "}
                      {equipmentText("Interval Days *", lang)}{" "}
                    </label>
                    <input
                      type="number"
                      data-help="em-plan-interval"
                      value={planFormData.interval_days || ""}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          interval_days: Number(e.target.value),
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: planErrors.interval_days
                          ? "1px solid #ef4444"
                          : "1px solid #cbd5e1",
                      }}
                      id="em-plan-interval"
                    />
                    {planErrors.interval_days && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {planErrors.interval_days}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-plan-performed-by"
                    >
                      {" "}
                      {equipmentText("Performed By *", lang)}{" "}
                    </label>
                    <select
                      data-help="em-plan-performed-by"
                      value={planFormData.performed_by}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          performed_by: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-plan-performed-by"
                    >
                      <option value="InHouse">
                        {" "}
                        {equipmentText("In-House Staff", lang)}{" "}
                      </option>
                      <option value="Contractor">
                        {" "}
                        {equipmentText("Contractor", lang)}{" "}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-plan-due-date"
                    >
                      {" "}
                      {equipmentText("Next Due Date *", lang)}{" "}
                    </label>
                    <input
                      type="date"
                      data-help="em-plan-due-date"
                      value={planFormData.next_due || ""}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          next_due: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-plan-due-date"
                    />
                  </div>

                  {planModalMode === "edit" && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          marginBottom: "4px",
                        }}
                        htmlFor="em-plan-edit-reason"
                      >
                        {" "}
                        {equipmentText(
                          "Reason for Modification (Mandatory Audit Note) *",
                          lang,
                        )}{" "}
                      </label>
                      <input
                        type="text"
                        data-help="em-plan-edit-reason"
                        placeholder="e.g. Adjusted interval following manufacturer bulletin"
                        value={planFormData.reason || ""}
                        onChange={(e) =>
                          setPlanFormData({
                            ...planFormData,
                            reason: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: planErrors.reason
                            ? "1px solid #ef4444"
                            : "1px solid #cbd5e1",
                        }}
                        id="em-plan-edit-reason"
                      />
                      {planErrors.reason && (
                        <div
                          style={{
                            color: "#ef4444",
                            fontSize: "0.8rem",
                            marginTop: "2px",
                          }}
                        >
                          {planErrors.reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsPlanModalOpen(false)}
                    style={{
                      padding: "8px 14px",
                      background: "var(--soft)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    data-help="em-plan-cancel"
                  >
                    {" "}
                    {equipmentText("Cancel", lang)}{" "}
                  </button>
                  <button
                    type="submit"
                    data-help="em-plan-submit-btn"
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      background: "#0284c7",
                      color: "var(--accent-text)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    {loading
                      ? equipmentText("Saving...", lang)
                      : equipmentText("Save Plan", lang)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: EDIT EQUIPMENT SPECIFICATIONS */}
        {isEditEquipmentModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "var(--paper)",
                borderRadius: "8px",
                width: "600px",
                maxWidth: "90%",
                padding: "24px",
              }}
              role="dialog"
              aria-modal="true"
              data-equipment-dialog
              tabIndex={-1}
              aria-label={t("Equipment editor", "آلات کا ترمیمی مکالمہ")}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                <h3
                  style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}
                >
                  {t("Edit equipment details", "آلات کی تفصیل میں ترمیم")}
                </h3>
                <button
                  type="button"
                  data-help="em-edit-equip-modal-close"
                  onClick={() => setIsEditEquipmentModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitEditEquipment}>
                <label>{t('Theatre','تھیٹر')}<DirectoryPicker path="/ot/theaters" idField="ot_id" value={equipmentFormData.ot_id??''} onChange={e=>setEquipmentFormData({...equipmentFormData,ot_id:e.target.value?Number(e.target.value):null})} data-help="em-edit-maintainer"/></label>
                {errorMessage && (
                  <p
                    role="alert"
                    style={{
                      background: "var(--error)",
                      color: "var(--ink)",
                      padding: 10,
                    }}
                  >
                    {errorMessage}
                  </p>
                )}
                <label style={{ display: "block", marginBlock: "10px" }}>
                  {t("Supplier (optional)", "فراہم کنندہ (اختیاری)")}
                  <DirectoryPicker
                    data-help="em-edit-supplier"
                    value={equipmentFormData.supplier_vendor_id ?? ""}
                    onChange={(e) =>
                      setEquipmentFormData({
                        ...equipmentFormData,
                        supplier_vendor_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    id="em-edit-supplier"
                   path="/finance/vendors?vendor_type=EquipmentSupplier" idField="vendor_id" />
                </label>
                <label style={{ display: "block", marginBlock: "10px" }}>
                  {t(
                    "Service contractor (optional)",
                    "دیکھ بھال کا ٹھیکیدار (اختیاری)",
                  )}
                  <DirectoryPicker
                    data-help="em-edit-service-vendor"
                    value={equipmentFormData.service_vendor_id ?? ""}
                    onChange={(e) =>
                      setEquipmentFormData({
                        ...equipmentFormData,
                        service_vendor_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    id="em-edit-service-vendor"
                   path="/finance/vendors?vendor_type=Contractor" idField="vendor_id" />
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-edit-maker"
                    >
                      {" "}
                      {equipmentText("Manufacturer", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-edit-maker"
                      value={equipmentFormData.manufacturer || ""}
                      onChange={(e) =>
                        setEquipmentFormData({
                          ...equipmentFormData,
                          manufacturer: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-edit-maker"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-edit-model"
                    >
                      {" "}
                      {equipmentText("Model", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-edit-model"
                      value={equipmentFormData.model || ""}
                      onChange={(e) =>
                        setEquipmentFormData({
                          ...equipmentFormData,
                          model: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-edit-model"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-edit-maintainer"
                    >
                      {" "}
                      {equipmentText("Maintained By", lang)}{" "}
                    </label>
                    <select
                      data-help="em-edit-maintainer"
                      value={equipmentFormData.maintained_by}
                      onChange={(e) =>
                        setEquipmentFormData({
                          ...equipmentFormData,
                          maintained_by: e.target.value as any,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-edit-maintainer"
                    >
                      <option value="InHouse">
                        {" "}
                        {equipmentText("InHouse", lang)}{" "}
                      </option>
                      <option value="Contractor">
                        {" "}
                        {equipmentText("Contractor", lang)}{" "}
                      </option>
                      <option value="Mixed">
                        {" "}
                        {equipmentText("Mixed", lang)}{" "}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-edit-warranty"
                    >
                      {" "}
                      {equipmentText("Warranty Until", lang)}{" "}
                    </label>
                    <input
                      type="date"
                      data-help="em-edit-warranty"
                      value={equipmentFormData.warranty_until || ""}
                      onChange={(e) =>
                        setEquipmentFormData({
                          ...equipmentFormData,
                          warranty_until: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-edit-warranty"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-edit-contract-ref"
                    >
                      {" "}
                      {equipmentText("Service Contract Ref", lang)}{" "}
                    </label>
                    <input
                      type="text"
                      data-help="em-edit-contract-ref"
                      value={equipmentFormData.service_contract_ref || ""}
                      onChange={(e) =>
                        setEquipmentFormData({
                          ...equipmentFormData,
                          service_contract_ref: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-edit-contract-ref"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                      htmlFor="em-edit-contract-until"
                    >
                      {" "}
                      {equipmentText("Service Contract Expiry", lang)}{" "}
                    </label>
                    <input
                      type="date"
                      data-help="em-edit-contract-until"
                      value={equipmentFormData.service_contract_until || ""}
                      onChange={(e) =>
                        setEquipmentFormData({
                          ...equipmentFormData,
                          service_contract_until: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                      }}
                      id="em-edit-contract-until"
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsEditEquipmentModalOpen(false)}
                    style={{
                      padding: "8px 14px",
                      background: "var(--soft)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    data-help="em-edit-cancel"
                  >
                    {" "}
                    {equipmentText("Cancel", lang)}{" "}
                  </button>
                  <button
                    type="submit"
                    data-help="em-edit-equip-submit-btn"
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      background: "#2563eb",
                      color: "var(--accent-text)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    {loading
                      ? equipmentText("Saving...", lang)
                      : equipmentText("Update Specifications", lang)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
};

export default EquipmentMaintenance;
