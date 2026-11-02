import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  serviceCatalog,
  addService,
  patchService,
  panels,
  addPanel,
  addPanelDiscount,
  discountPolicies,
  setDiscountPolicy,
  contracts,
  addContract,
  lookupStaff,
  type ServiceListItemOut,
  type ServiceIn,
  type ServicePatch,
  type PanelOut,
  type PanelIn,
  type PanelDiscountIn,
  type DiscountPolicyOut,
  type DiscountPolicyIn,
  type ContractListItemOut,
  type ContractIn,
  type StaffLookupOut,
} from "../generated/billing_admin";
import {
  getBillingAdminCapabilityView,
  validateServiceInput,
  validateServicePatch,
  validatePanelInput,
  validatePanelDiscountInput,
  validateDiscountPolicyInput,
  validateContractInput,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  PANEL_TYPES,
  PANEL_TYPE_LABELS,
  CONTRACT_RULE_TYPES,
  CONTRACT_RULE_TYPE_LABELS,
  BILLING_ADMIN_ERROR_MESSAGES,
  type ServiceCategory,
  type PanelType,
  type ContractRuleType,
} from "../billing-admin-policy";

export interface BillingAdminProps {
  user?: {
    username?: string;
    name?: string;
    user_id?: number;
    roles?: string[];
    permissions?: string[];
  } | null;
  establishment?: any;
  connected?: boolean;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

type BillingTab = "services" | "panels" | "policies" | "contracts";

export const BillingAdmin: React.FC<BillingAdminProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const capabilityView = useMemo(
    () => getBillingAdminCapabilityView(establishment),
    [establishment]
  );

  const currentUser = useMemo(
    () => ({
      username: user?.username || "demo.billing",
      user_id: user?.user_id,
      name: user?.name || user?.username || "Billing Admin",
    }),
    [user]
  );

  // Active Tab
  const [activeTab, setActiveTab] = useState<BillingTab>("services");

  // Notifications
  const [globalError, setGlobalError] = useState<{ code?: string; message: string; messageUr?: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // -------------------------------------------------------------
  // TAB 1: Service Catalogue & Prices
  // -------------------------------------------------------------
  const [servicesList, setServicesList] = useState<ServiceListItemOut[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("");
  const [serviceSearchTerm, setServiceSearchTerm] = useState<string>("");
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);

  // Add Service Modal
  const [showAddServiceModal, setShowAddServiceModal] = useState<boolean>(false);
  const [serviceForm, setServiceForm] = useState<ServiceIn>({
    code: "",
    name: "",
    category: "OPD",
    default_price: "",
  });
  const [isSubmittingService, setIsSubmittingService] = useState<boolean>(false);

  // Edit Service / Patch Modal
  const [editingService, setEditingService] = useState<ServiceListItemOut | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [isSubmittingPatch, setIsSubmittingPatch] = useState<boolean>(false);

  // -------------------------------------------------------------
  // TAB 2: Panels & Welfare Discounts
  // -------------------------------------------------------------
  const [panelsList, setPanelsList] = useState<PanelOut[]>([]);
  const [isLoadingPanels, setIsLoadingPanels] = useState<boolean>(false);

  // Add Panel Modal
  const [showAddPanelModal, setShowAddPanelModal] = useState<boolean>(false);
  const [panelForm, setPanelForm] = useState<PanelIn>({
    code: "",
    name: "",
    panel_type: "SehatSahulat",
    discount_pct: 0,
    is_credit_panel: false,
  });
  const [isSubmittingPanel, setIsSubmittingPanel] = useState<boolean>(false);

  // Add Panel Discount Modal
  const [showAddDiscountModal, setShowAddDiscountModal] = useState<boolean>(false);
  const [discountForm, setDiscountForm] = useState<PanelDiscountIn>({
    panel_id: 0,
    service_id: null,
    discount_pct: "",
    effective_from: new Date().toISOString().split("T")[0],
    effective_to: "",
  });
  const [isSubmittingDiscount, setIsSubmittingDiscount] = useState<boolean>(false);

  // -------------------------------------------------------------
  // TAB 3: Discount Policies & Ceilings
  // -------------------------------------------------------------
  const [policiesList, setPoliciesList] = useState<DiscountPolicyOut[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState<boolean>(false);

  // Set Policy Modal
  const [showSetPolicyModal, setShowSetPolicyModal] = useState<boolean>(false);
  const [policyForm, setPolicyForm] = useState<DiscountPolicyIn>({
    role_code: "doctor",
    user_id: null,
    max_discount_pct: 10,
    max_discount_amount: null,
  });
  const [isSubmittingPolicy, setIsSubmittingPolicy] = useState<boolean>(false);

  // -------------------------------------------------------------
  // TAB 4: Consultant Commission Contracts
  // -------------------------------------------------------------
  const [contractsList, setContractsList] = useState<ContractListItemOut[]>([]);
  const [contractEmployeeFilter, setContractEmployeeFilter] = useState<string>("");
  const [isLoadingContracts, setIsLoadingContracts] = useState<boolean>(false);

  // Add Contract Modal & Staff Search
  const [showAddContractModal, setShowAddContractModal] = useState<boolean>(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>("");
  const [staffSearchResults, setStaffSearchResults] = useState<StaffLookupOut[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffLookupOut | null>(null);
  const [contractForm, setContractForm] = useState<{
    rule_type: ContractRuleType;
    amount: string;
    percentage: string;
    effective_from: string;
    effective_to: string;
    notes: string;
  }>({
    rule_type: "PercentNet",
    amount: "",
    percentage: "50",
    effective_from: new Date().toISOString().split("T")[0],
    effective_to: "",
    notes: "",
  });
  const [isSearchingStaff, setIsSearchingStaff] = useState<boolean>(false);
  const [isSubmittingContract, setIsSubmittingContract] = useState<boolean>(false);

  // Format Helper
  const formatMoney = (amount?: number | null) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "PKR 0.00";
    return `PKR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const explainError = (code?: string, defaultMsg?: string) => {
    if (code && BILLING_ADMIN_ERROR_MESSAGES[code]) {
      return BILLING_ADMIN_ERROR_MESSAGES[code];
    }
    return {
      en: defaultMsg || "An unexpected error occurred.",
      ur: "ایک غیر متوقع خرابی پیش آئی۔",
    };
  };

  // -------------------------------------------------------------
  // Loaders
  // -------------------------------------------------------------
  const loadServices = useCallback(async () => {
    setIsLoadingServices(true);
    try {
      const res = await serviceCatalog({
        category: selectedCategoryFilter || undefined,
      });
      setServicesList(res || []);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingServices(false);
    }
  }, [selectedCategoryFilter]);

  const loadPanels = useCallback(async () => {
    setIsLoadingPanels(true);
    try {
      const res = await panels();
      setPanelsList(res || []);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingPanels(false);
    }
  }, []);

  const loadPolicies = useCallback(async () => {
    setIsLoadingPolicies(true);
    try {
      const res = await discountPolicies();
      setPoliciesList(res || []);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingPolicies(false);
    }
  }, []);

  const loadContracts = useCallback(async () => {
    setIsLoadingContracts(true);
    try {
      const empId = contractEmployeeFilter ? Number(contractEmployeeFilter) : undefined;
      const res = await contracts({ employee_id: empId });
      setContractsList(res || []);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingContracts(false);
    }
  }, [contractEmployeeFilter]);

  const refreshAll = useCallback(() => {
    setGlobalError(null);
    setSuccessBanner(null);
    loadServices();
    loadPanels();
    loadPolicies();
    loadContracts();
  }, [loadServices, loadPanels, loadPolicies, loadContracts]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // -------------------------------------------------------------
  // Handlers: Service Catalogue
  // -------------------------------------------------------------
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateServiceInput(serviceForm);
    if (!val.valid) {
      setGlobalError({ message: val.error || "Invalid service input", messageUr: "سروس کے کوائف درست نہیں ہیں۔" });
      return;
    }

    setIsSubmittingService(true);
    setGlobalError(null);
    try {
      const created = await addService(serviceForm);
      setSuccessBanner(`Service "${created.name}" [${created.code}] created at ${formatMoney(created.default_price)}.`);
      setShowAddServiceModal(false);
      setServiceForm({ code: "", name: "", category: "OPD", default_price: "" });
      loadServices();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingService(false);
    }
  };

  const handleOpenEditService = (service: ServiceListItemOut) => {
    setEditingService(service);
    setEditPrice(String(service.default_price));
    setEditName(service.name);
    setEditIsActive(service.is_active);
    setGlobalError(null);
  };

  const handleSubmitPatchService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    const patchPayload: ServicePatch = {
      expected_version: editingService.row_version,
      name: editName.trim() !== editingService.name ? editName.trim() : undefined,
      default_price: Number(editPrice) !== editingService.default_price ? Number(editPrice) : undefined,
      is_active: editIsActive !== editingService.is_active ? editIsActive : undefined,
    };

    const val = validateServicePatch(patchPayload);
    if (!val.valid) {
      setGlobalError({ message: val.error || "Invalid patch", messageUr: "قیمت یا نام درست درج کریں۔" });
      return;
    }

    setIsSubmittingPatch(true);
    setGlobalError(null);
    try {
      const updated = await patchService(editingService.service_id, patchPayload);
      setSuccessBanner(
        `Service "${updated.name}" updated successfully. New Price: ${formatMoney(updated.default_price)}. Note: Existing tickets retain their snapshotted price per rule:55973e6dbd.`
      );
      setEditingService(null);
      loadServices();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingPatch(false);
    }
  };

  // -------------------------------------------------------------
  // Handlers: Panels & Panel Discounts
  // -------------------------------------------------------------
  const handleSavePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validatePanelInput(panelForm);
    if (!val.valid) {
      setGlobalError({ message: val.error || "Invalid panel input", messageUr: "پینل کے کوائف درست درج کریں۔" });
      return;
    }

    setIsSubmittingPanel(true);
    setGlobalError(null);
    try {
      const created = await addPanel(panelForm);
      setSuccessBanner(`Panel "${created.name}" [${created.code}] created successfully.`);
      setShowAddPanelModal(false);
      setPanelForm({ code: "", name: "", panel_type: "SehatSahulat", discount_pct: 0, is_credit_panel: false });
      loadPanels();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingPanel(false);
    }
  };

  const handleSavePanelDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validatePanelDiscountInput(discountForm);
    if (!val.valid) {
      setGlobalError({ message: val.error || "Invalid panel discount rule", messageUr: "رعایت کی شرائط درست درج کریں۔" });
      return;
    }

    setIsSubmittingDiscount(true);
    setGlobalError(null);
    try {
      const created = await addPanelDiscount(discountForm);
      setSuccessBanner(
        `Effective discount rule created (${created.discount_pct}% discount from ${created.effective_from}${created.effective_to ? ` to ${created.effective_to}` : ""}).`
      );
      setShowAddDiscountModal(false);
      setDiscountForm({
        panel_id: panelsList[0]?.panel_id || 0,
        service_id: null,
        discount_pct: "",
        effective_from: new Date().toISOString().split("T")[0],
        effective_to: "",
      });
      loadPanels();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingDiscount(false);
    }
  };

  // -------------------------------------------------------------
  // Handlers: Discount Policies
  // -------------------------------------------------------------
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateDiscountPolicyInput(policyForm);
    if (!val.valid) {
      setGlobalError({ message: val.error || "Invalid discount policy", messageUr: "رعایت کی حد درست درج کریں۔" });
      return;
    }

    setIsSubmittingPolicy(true);
    setGlobalError(null);
    try {
      const saved = await setDiscountPolicy(policyForm);
      setSuccessBanner(`Discount ceiling updated: Max ${saved.max_discount_pct}% discount for ${saved.role_code || `User #${saved.user_id}`}.`);
      setShowSetPolicyModal(false);
      loadPolicies();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingPolicy(false);
    }
  };

  // -------------------------------------------------------------
  // Handlers: Consultant Contracts & Staff Lookup
  // -------------------------------------------------------------
  const handleSearchStaff = async () => {
    if (!staffSearchQuery.trim()) return;
    setIsSearchingStaff(true);
    setGlobalError(null);
    try {
      const res = await lookupStaff({ q: staffSearchQuery.trim(), limit: 10 });
      setStaffSearchResults(res || []);
      if (res && res.length > 0) {
        setSelectedStaff(res[0]);
      }
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSearchingStaff(false);
    }
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) {
      setGlobalError({ message: "Please search and select a consultant.", messageUr: "براہ کرم کنسلٹنٹ منتخب کریں۔" });
      return;
    }

    const contractInput: ContractIn = {
      employee_id: selectedStaff.employee_id,
      rule_type: contractForm.rule_type,
      amount: contractForm.rule_type === "FixedFee" ? Number(contractForm.amount) : undefined,
      percentage: contractForm.rule_type !== "FixedFee" ? Number(contractForm.percentage) : undefined,
      effective_from: contractForm.effective_from,
      effective_to: contractForm.effective_to.trim() ? contractForm.effective_to : undefined,
      notes: contractForm.notes.trim() || undefined,
    };

    const val = validateContractInput(contractInput);
    if (!val.valid) {
      setGlobalError({ message: val.error || "Invalid commission terms", messageUr: "کمیشن کی شرائط درست درج کریں۔" });
      return;
    }

    setIsSubmittingContract(true);
    setGlobalError(null);
    try {
      const created = await addContract(contractInput);
      setSuccessBanner(`Commission contract created for ${selectedStaff.full_name} (${created.rule_type}).`);
      setShowAddContractModal(false);
      setSelectedStaff(null);
      setStaffSearchResults([]);
      setStaffSearchQuery("");
      setContractForm({
        rule_type: "PercentNet",
        amount: "",
        percentage: "50",
        effective_from: new Date().toISOString().split("T")[0],
        effective_to: "",
        notes: "",
      });
      loadContracts();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingContract(false);
    }
  };

  // Capability View Gating
  if (capabilityView === "hidden") {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-xl font-bold">Billing Admin Screen Unavailable</h2>
        <p className="mt-2 text-sm">This screen is hidden under current facility profile.</p>
      </div>
    );
  }

  // Filtered Services List
  const filteredServices = servicesList.filter((s) => {
    if (serviceSearchTerm) {
      const term = serviceSearchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(term) ||
        s.code.toLowerCase().includes(term) ||
        (s.doctor_name && s.doctor_name.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-lg shadow-inner">
            BA
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight">Price & Policy Management</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                بلنگ ایڈمن
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Service catalogue • Panels & discounts • Discount ceilings • Consultant contracts
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 mt-2 sm:mt-0">
          <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-slate-300">{currentUser.name}</span>
          </div>

          <button
            type="button"
            data-help="billing_admin.refresh_btn"
            onClick={refreshAll}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded-md border border-slate-700 flex items-center space-x-1 transition-colors"
          >
            <span>↻ Refresh</span>
            <span className="text-slate-400 text-[10px]">(ریفریش)</span>
          </button>
        </div>
      </header>

      {/* Notifications Banner */}
      {globalError && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-start justify-between text-sm text-rose-800">
          <div className="flex items-start space-x-2">
            <span className="font-bold text-rose-600">⚠ Error {globalError.code ? `[${globalError.code}]` : ""}:</span>
            <div>
              <p>{globalError.message}</p>
              {globalError.messageUr && <p className="text-xs text-rose-700 mt-0.5">{globalError.messageUr}</p>}
            </div>
          </div>
          <button
            type="button"
            data-help="billing_admin.dismiss_error_btn"
            onClick={() => setGlobalError(null)}
            className="text-xs text-rose-600 hover:text-rose-900 font-semibold ml-4"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {successBanner && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-sm text-emerald-800">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-emerald-600">✓ Success:</span>
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            data-help="billing_admin.dismiss_success_btn"
            onClick={() => setSuccessBanner(null)}
            className="text-xs text-emerald-600 hover:text-emerald-900 font-semibold ml-4"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 pt-2 flex space-x-4">
        <button
          type="button"
          data-help="billing_admin.services_tab"
          onClick={() => setActiveTab("services")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === "services"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>1. Service Catalogue & Prices</span>
          <span className="text-xs font-normal text-slate-400">(سروس ٹیرف)</span>
        </button>

        <button
          type="button"
          data-help="billing_admin.panels_tab"
          onClick={() => setActiveTab("panels")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === "panels"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>2. Panels & Welfare Discounts</span>
          <span className="text-xs font-normal text-slate-400">(پینلز و رعایت)</span>
        </button>

        <button
          type="button"
          data-help="billing_admin.discount_policies_tab"
          onClick={() => setActiveTab("policies")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === "policies"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>3. Discount Ceilings</span>
          <span className="text-xs font-normal text-slate-400">(رعایت کی حد)</span>
        </button>

        <button
          type="button"
          data-help="billing_admin.contracts_tab"
          onClick={() => setActiveTab("contracts")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === "contracts"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>4. Consultant Commission Contracts</span>
          <span className="text-xs font-normal text-slate-400">(کنسلٹنٹ معاہدات)</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* ========================================================= */}
        {/* TAB 1: Service Catalogue & Prices                         */}
        {/* ========================================================= */}
        {activeTab === "services" && (
          <div className="space-y-6">
            {/* Rule 55973e6dbd Notice Card */}
            <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-800">🔒 Rule 55973e6dbd: Price Snapshot Protection:</span>
                <span className="ml-2">
                  Price changes update catalogue prices for future tickets and invoices. Issued records strictly retain their original snapshotted price.
                </span>
              </div>
              <span className="text-[10px] bg-emerald-200/80 text-emerald-800 font-mono px-2 py-0.5 rounded font-bold">
                قاعدہ 55973e6dbd
              </span>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Category (شعبہ / قسم)
                  </label>
                  <select
                    data-help="billing_admin.service_category_filter"
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">All Categories (تمام شعبہ جات)</option>
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} — {SERVICE_CATEGORY_LABELS[cat].en} ({SERVICE_CATEGORY_LABELS[cat].ur})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Search Service (سروس تلاش کریں)
                  </label>
                  <input
                    type="text"
                    data-help="billing_admin.service_search_input"
                    value={serviceSearchTerm}
                    onChange={(e) => setServiceSearchTerm(e.target.value)}
                    placeholder="Search by code, name, doctor..."
                    className="text-xs border border-slate-300 rounded-md px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  data-help="billing_admin.open_add_service_btn"
                  onClick={() => setShowAddServiceModal(true)}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors"
                >
                  <span>+ Add Priced Service</span>
                  <span className="text-emerald-100 font-normal">(نئی سروس شامل کریں)</span>
                </button>
              </div>
            </div>

            {/* Services Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  Hospital Service Catalogue (ہسپتال سروس ٹیرف)
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {filteredServices.length} services shown
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Service Name</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Doctor / Department</th>
                      <th className="px-4 py-2.5 text-right">Default Price (PKR)</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingServices ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Loading services...
                        </td>
                      </tr>
                    ) : filteredServices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No services found matching filters.
                        </td>
                      </tr>
                    ) : (
                      filteredServices.map((s) => (
                        <tr key={s.service_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-indigo-700">{s.code}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{s.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {s.category}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {s.doctor_name ? (
                              <span className="text-slate-900 font-medium">{s.doctor_name}</span>
                            ) : (
                              s.department_name || "—"
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                            {formatMoney(s.default_price)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                s.is_active
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-slate-100 text-slate-600 border border-slate-300"
                              }`}
                            >
                              {s.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              data-help="billing_admin.open_edit_service_btn"
                              onClick={() => handleOpenEditService(s)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded transition-colors"
                            >
                              Edit Price
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
        )}

        {/* ========================================================= */}
        {/* TAB 2: Panels & Welfare Discounts                         */}
        {/* ========================================================= */}
        {activeTab === "panels" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  Hospital Panels & Welfare Funds (پینلز اور فلاحی فنڈز)
                </h3>
                <p className="text-xs text-slate-500">
                  Manage Sehat Sahulat, Zakat, Corporate insurances, and effective-dated discount rules
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  data-help="billing_admin.open_add_panel_btn"
                  onClick={() => setShowAddPanelModal(true)}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  + Add Panel (نیا پینل)
                </button>

                <button
                  type="button"
                  data-help="billing_admin.open_add_panel_discount_btn"
                  onClick={() => {
                    if (panelsList.length > 0) {
                      setDiscountForm((f) => ({ ...f, panel_id: panelsList[0].panel_id }));
                    }
                    setShowAddDiscountModal(true);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  + Effective Discount Rule (رعایت کا اصول)
                </button>
              </div>
            </div>

            {/* Panels Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">Configured Panels (پینلز کی فہرست)</h3>
                <span className="text-xs text-slate-500 font-medium">{panelsList.length} panels</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Panel Name</th>
                      <th className="px-4 py-2.5">Panel Type</th>
                      <th className="px-4 py-2.5 text-right">Baseline Discount %</th>
                      <th className="px-4 py-2.5 text-center">Credit Panel?</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingPanels ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Loading panels...
                        </td>
                      </tr>
                    ) : panelsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          No panels configured yet. Click "+ Add Panel" to create one.
                        </td>
                      </tr>
                    ) : (
                      panelsList.map((p) => (
                        <tr key={p.panel_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-indigo-700">{p.code}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{p.name}</td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {PANEL_TYPE_LABELS[p.panel_type]?.en || p.panel_type}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                            {p.discount_pct}%
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                p.is_credit_panel
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {p.is_credit_panel ? "Yes (Credit/Udhaar)" : "Cash / Copay"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                p.is_active
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {p.is_active ? "Active" : "Inactive"}
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
        )}

        {/* ========================================================= */}
        {/* TAB 3: Discount Ceilings & Policies                       */}
        {/* ========================================================= */}
        {activeTab === "policies" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  Role & User Discount Ceilings (رعایت کی حد)
                </h3>
                <p className="text-xs text-slate-500">
                  Configure maximum authorized concession percentages and amount caps by role or user
                </p>
              </div>

              <div>
                <button
                  type="button"
                  data-help="billing_admin.open_set_policy_btn"
                  onClick={() => setShowSetPolicyModal(true)}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  + Set Discount Ceiling (حد مقرر کریں)
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">Active Policies (فعال پالیسیاں)</h3>
                <span className="text-xs text-slate-500 font-medium">{policiesList.length} policies</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Policy ID</th>
                      <th className="px-4 py-2.5">Scope / Target</th>
                      <th className="px-4 py-2.5 text-right">Max Discount %</th>
                      <th className="px-4 py-2.5 text-right">Max Amount Cap</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingPolicies ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          Loading discount policies...
                        </td>
                      </tr>
                    ) : policiesList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No discount policies defined yet.
                        </td>
                      </tr>
                    ) : (
                      policiesList.map((pol) => (
                        <tr key={pol.policy_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-800">#{pol.policy_id}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {pol.role_code ? (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px]">
                                Role: {pol.role_code}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                                User ID: #{pol.user_id}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                            {pol.max_discount_pct}%
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                            {pol.max_discount_amount ? formatMoney(pol.max_discount_amount) : "No Amount Cap"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                pol.is_active
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {pol.is_active ? "Active" : "Inactive"}
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
        )}

        {/* ========================================================= */}
        {/* TAB 4: Consultant Commission Contracts                    */}
        {/* ========================================================= */}
        {activeTab === "contracts" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <label className="text-xs font-semibold text-slate-600">Filter by Employee ID:</label>
                <input
                  type="number"
                  data-help="billing_admin.contract_employee_filter"
                  value={contractEmployeeFilter}
                  onChange={(e) => setContractEmployeeFilter(e.target.value)}
                  placeholder="e.g. 5"
                  className="text-xs border border-slate-300 rounded-md px-3 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  data-help="billing_admin.apply_contract_filter_btn"
                  onClick={loadContracts}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  Filter
                </button>
              </div>

              <div>
                <button
                  type="button"
                  data-help="billing_admin.open_add_contract_btn"
                  onClick={() => setShowAddContractModal(true)}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  + Add Consultant Contract (نیا معاہدہ)
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  Consultant Commission Contracts (کنسلٹنٹ کمیشن معاہدات)
                </h3>
                <span className="text-xs text-slate-500 font-medium">{contractsList.length} contracts</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Contract ID</th>
                      <th className="px-4 py-2.5">Consultant</th>
                      <th className="px-4 py-2.5">Rule Type</th>
                      <th className="px-4 py-2.5">Terms / Commission</th>
                      <th className="px-4 py-2.5">Effective Dates</th>
                      <th className="px-4 py-2.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingContracts ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Loading contracts...
                        </td>
                      </tr>
                    ) : contractsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          No commission contracts found.
                        </td>
                      </tr>
                    ) : (
                      contractsList.map((c) => (
                        <tr key={c.contract_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-800">#{c.contract_id}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-slate-900">{c.employee_name}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">ID: #{c.employee_id}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                              {c.rule_type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">
                            {c.rule_type === "FixedFee"
                              ? formatMoney(c.terms_jsonb?.amount as number)
                              : `${c.terms_jsonb?.percentage || 0}%`}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">
                            {c.effective_from} {c.effective_to ? `to ${c.effective_to}` : "(Ongoing)"}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate" title={c.notes || ""}>
                            {c.notes || "—"}
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
      </main>

      {/* ========================================================= */}
      {/* MODAL: Add Priced Service (POST /finance/service-catalog) */}
      {/* ========================================================= */}
      {showAddServiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Add Priced Service</h3>
                <p className="text-xs text-emerald-200">ہسپتال ٹیرف میں نئی سروس درج کریں</p>
              </div>
              <button
                type="button"
                data-help="billing_admin.close_service_modal_btn"
                onClick={() => setShowAddServiceModal(false)}
                className="text-emerald-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveService} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Service Code * (سروس کوڈ)
                  </label>
                  <input
                    type="text"
                    required
                    data-help="billing_admin.service_code_input"
                    value={serviceForm.code}
                    onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. OPD-CONS-GEN"
                    className="w-full text-xs font-mono uppercase border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category * (شعبہ)
                  </label>
                  <select
                    data-help="billing_admin.service_category_select"
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value as any })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} — {SERVICE_CATEGORY_LABELS[cat].en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name * (سروس کا نام)
                </label>
                <input
                  type="text"
                  required
                  data-help="billing_admin.service_name_input"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="e.g. General OPD Consultation"
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Price (PKR) * (فیس / قیمت)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">PKR</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-help="billing_admin.service_price_input"
                    value={serviceForm.default_price}
                    onChange={(e) => setServiceForm({ ...serviceForm, default_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full text-xs font-mono font-bold pl-12 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="billing_admin.cancel_service_modal_btn"
                  onClick={() => setShowAddServiceModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingService}
                  data-help="billing_admin.save_service_btn"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingService ? "Saving..." : "Save Service (محفوظ کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Edit Service / Change Price (PATCH /service-catalog/{id}) */}
      {/* ========================================================= */}
      {editingService && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-indigo-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Edit Price — {editingService.code}</h3>
                <p className="text-xs text-indigo-200">سروس فیس کی تبدیلی (قاعدہ 55973e6dbd)</p>
              </div>
              <button
                type="button"
                data-help="billing_admin.close_patch_service_btn"
                onClick={() => setEditingService(null)}
                className="text-indigo-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPatchService} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900">
                <strong>Rule 55973e6dbd:</strong> Price changes apply to future services only. Previously issued invoices, admissions, and tickets will NOT be changed.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name (سروس کا نام)
                </label>
                <input
                  type="text"
                  required
                  data-help="billing_admin.edit_service_name_input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Price (PKR) * (نئی فیس)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">PKR</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-help="billing_admin.edit_service_price_input"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full text-xs font-mono font-bold pl-12 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="activeToggle"
                  data-help="billing_admin.edit_service_active_toggle"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="activeToggle" className="text-xs font-medium text-slate-700">
                  Active in Catalogue (فعال سروس)
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="billing_admin.cancel_patch_service_btn"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPatch}
                  data-help="billing_admin.submit_patch_service_btn"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingPatch ? "Updating..." : "Update Price (تبدیلی محفوظ کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Add Panel (POST /finance/panels)                   */}
      {/* ========================================================= */}
      {showAddPanelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Add Hospital Panel</h3>
                <p className="text-xs text-emerald-200">نیا فلاحی یا کارپوریٹ پینل رجسٹر کریں</p>
              </div>
              <button
                type="button"
                data-help="billing_admin.close_panel_modal_btn"
                onClick={() => setShowAddPanelModal(false)}
                className="text-emerald-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePanel} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Panel Code * (پینل کوڈ)
                  </label>
                  <input
                    type="text"
                    required
                    data-help="billing_admin.panel_code_input"
                    value={panelForm.code}
                    onChange={(e) => setPanelForm({ ...panelForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SSP-01"
                    className="w-full text-xs font-mono uppercase border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Panel Type * (قسم)
                  </label>
                  <select
                    data-help="billing_admin.panel_type_select"
                    value={panelForm.panel_type}
                    onChange={(e) => setPanelForm({ ...panelForm, panel_type: e.target.value as any })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {PANEL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PANEL_TYPE_LABELS[t].en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Panel Name * (نام)
                </label>
                <input
                  type="text"
                  required
                  data-help="billing_admin.panel_name_input"
                  value={panelForm.name}
                  onChange={(e) => setPanelForm({ ...panelForm, name: e.target.value })}
                  placeholder="e.g. State Life Sehat Sahulat"
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Baseline Discount Percentage (%) * (رعایت فیصد)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  data-help="billing_admin.panel_discount_pct_input"
                  value={panelForm.discount_pct}
                  onChange={(e) => setPanelForm({ ...panelForm, discount_pct: e.target.value })}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="creditPanelCheck"
                  data-help="billing_admin.panel_credit_checkbox"
                  checked={panelForm.is_credit_panel}
                  onChange={(e) => setPanelForm({ ...panelForm, is_credit_panel: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="creditPanelCheck" className="text-xs font-medium text-slate-700">
                  Allow Credit (Udhaar) billing for this panel
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="billing_admin.cancel_panel_modal_btn"
                  onClick={() => setShowAddPanelModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPanel}
                  data-help="billing_admin.save_panel_btn"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingPanel ? "Saving..." : "Save Panel (محفوظ کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Add Panel Discount Rule (POST /finance/panel-discounts) */}
      {/* ========================================================= */}
      {showAddDiscountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-indigo-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Effective Panel Discount Rule</h3>
                <p className="text-xs text-indigo-200">تاریخ کے مطابق پینل رعایت کا تعین</p>
              </div>
              <button
                type="button"
                data-help="billing_admin.close_panel_discount_modal_btn"
                onClick={() => setShowAddDiscountModal(false)}
                className="text-indigo-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePanelDiscount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Panel * (پینل)
                </label>
                <select
                  data-help="billing_admin.discount_panel_select"
                  value={discountForm.panel_id}
                  onChange={(e) => setDiscountForm({ ...discountForm, panel_id: Number(e.target.value) })}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {panelsList.map((p) => (
                    <option key={p.panel_id} value={p.panel_id}>
                      {p.name} [{p.code}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service (سروس — خالی رہنے پر تمام سروسز پر لاگو ہوگا)
                </label>
                <select
                  data-help="billing_admin.discount_service_select"
                  value={discountForm.service_id ?? ""}
                  onChange={(e) =>
                    setDiscountForm({
                      ...discountForm,
                      service_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Services (تمام سروسز)</option>
                  {servicesList.map((s) => (
                    <option key={s.service_id} value={s.service_id}>
                      {s.name} [{s.code}] ({formatMoney(s.default_price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Discount Percentage (%) * (رعایت فیصد)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  data-help="billing_admin.rule_discount_pct_input"
                  value={discountForm.discount_pct}
                  onChange={(e) => setDiscountForm({ ...discountForm, discount_pct: e.target.value })}
                  placeholder="e.g. 25"
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective From * (شروع تاریخ)
                  </label>
                  <input
                    type="date"
                    required
                    data-help="billing_admin.discount_effective_from_input"
                    value={discountForm.effective_from}
                    onChange={(e) => setDiscountForm({ ...discountForm, effective_from: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective To (اختتامی تاریخ)
                  </label>
                  <input
                    type="date"
                    data-help="billing_admin.discount_effective_to_input"
                    value={discountForm.effective_to || ""}
                    onChange={(e) => setDiscountForm({ ...discountForm, effective_to: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="billing_admin.cancel_panel_discount_modal_btn"
                  onClick={() => setShowAddDiscountModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDiscount}
                  data-help="billing_admin.save_panel_discount_btn"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingDiscount ? "Saving..." : "Save Discount Rule (محفوظ کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Set Discount Policy (PUT /finance/discount-policies)*/}
      {/* ========================================================= */}
      {showSetPolicyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Set Role / User Discount Ceiling</h3>
                <p className="text-xs text-slate-400">رعایت دینے کی زیادہ سے زیادہ حد مقرر کریں</p>
              </div>
              <button
                type="button"
                data-help="billing_admin.close_policy_modal_btn"
                onClick={() => setShowSetPolicyModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Code (کردار)
                  </label>
                  <select
                    data-help="billing_admin.policy_role_code_input"
                    value={policyForm.role_code || ""}
                    onChange={(e) => setPolicyForm({ ...policyForm, role_code: e.target.value || null, user_id: null })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Or specify User ID --</option>
                    <option value="doctor">Doctor (ڈاکٹر)</option>
                    <option value="cashier">Cashier (کیشیئر)</option>
                    <option value="billing_admin">Billing Admin (بلنگ ایڈمن)</option>
                    <option value="hospital_director">Hospital Director (ڈائریکٹر)</option>
                    <option value="owner">Hospital Owner (مالک)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    User ID (صارف شناختی نمبر)
                  </label>
                  <input
                    type="number"
                    data-help="billing_admin.policy_user_id_input"
                    value={policyForm.user_id ?? ""}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        user_id: e.target.value ? Number(e.target.value) : null,
                        role_code: e.target.value ? null : policyForm.role_code,
                      })
                    }
                    placeholder="e.g. 10"
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maximum Discount Percentage (%) * (زیادہ سے زیادہ رعایت فیصد)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  data-help="billing_admin.policy_max_pct_input"
                  value={policyForm.max_discount_pct}
                  onChange={(e) => setPolicyForm({ ...policyForm, max_discount_pct: e.target.value })}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maximum Discount Amount (PKR) (زیادہ سے زیادہ رقم کی حد)
                </label>
                <input
                  type="number"
                  step="0.01"
                  data-help="billing_admin.policy_max_amount_input"
                  value={policyForm.max_discount_amount ?? ""}
                  onChange={(e) =>
                    setPolicyForm({
                      ...policyForm,
                      max_discount_amount: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Leave empty for percentage-only ceiling"
                  className="w-full text-xs font-mono border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="billing_admin.cancel_policy_modal_btn"
                  onClick={() => setShowSetPolicyModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPolicy}
                  data-help="billing_admin.save_discount_policy_btn"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingPolicy ? "Saving..." : "Save Discount Ceiling (محفوظ کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Add Consultant Contract (POST /finance/consultant-contracts) */}
      {/* ========================================================= */}
      {showAddContractModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Add Consultant Commission Contract</h3>
                <p className="text-xs text-emerald-200">کنسلٹنٹ کمیشن معاہدے کا اندراج</p>
              </div>
              <button
                type="button"
                data-help="billing_admin.close_contract_modal_btn"
                onClick={() => setShowAddContractModal(false)}
                className="text-emerald-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="p-6 space-y-4">
              {/* Staff Lookup */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Find Consultant / Employee * (عملہ تلاش کریں)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    data-help="billing_admin.staff_search_input"
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    placeholder="Type doctor name or designation..."
                    className="flex-1 text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    data-help="billing_admin.search_staff_btn"
                    onClick={handleSearchStaff}
                    disabled={isSearchingStaff}
                    className="px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    {isSearchingStaff ? "Searching..." : "Search"}
                  </button>
                </div>
              </div>

              {staffSearchResults.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Matching Staff:
                  </label>
                  <select
                    data-help="billing_admin.staff_select"
                    value={selectedStaff?.employee_id || ""}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const found = staffSearchResults.find((s) => s.employee_id === id);
                      setSelectedStaff(found || null);
                    }}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {staffSearchResults.map((st) => (
                      <option key={st.employee_id} value={st.employee_id}>
                        {st.full_name} ({st.designation}) — {st.department_name || "General"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedStaff && (
                <div className="p-3 bg-emerald-50 rounded-lg text-xs border border-emerald-200">
                  <strong className="text-emerald-900">{selectedStaff.full_name}</strong>
                  <span className="block text-slate-600">{selectedStaff.designation} • {selectedStaff.department_name}</span>
                  {selectedStaff.registration && (
                    <span className="block text-[11px] font-mono text-emerald-800">
                      License: {selectedStaff.license_type} ({selectedStaff.registration})
                    </span>
                  )}
                </div>
              )}

              {/* Commission Rule Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Commission Rule Type * (کمیشن کی قسم)
                  </label>
                  <select
                    data-help="billing_admin.contract_rule_type_select"
                    value={contractForm.rule_type}
                    onChange={(e) => setContractForm({ ...contractForm, rule_type: e.target.value as any })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CONTRACT_RULE_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {CONTRACT_RULE_TYPE_LABELS[rt].en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  {contractForm.rule_type === "FixedFee" ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Fixed Amount (PKR) * (مقررہ فیس)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        data-help="billing_admin.contract_amount_input"
                        value={contractForm.amount}
                        onChange={(e) => setContractForm({ ...contractForm, amount: e.target.value })}
                        placeholder="e.g. 15000"
                        className="w-full text-xs font-mono font-bold border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Commission Percentage (%) * (فیصد)
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.1"
                        required
                        data-help="billing_admin.contract_pct_input"
                        value={contractForm.percentage}
                        onChange={(e) => setContractForm({ ...contractForm, percentage: e.target.value })}
                        placeholder="e.g. 60"
                        className="w-full text-xs font-mono font-bold border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Effective Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective From * (شروع تاریخ)
                  </label>
                  <input
                    type="date"
                    required
                    data-help="billing_admin.contract_effective_from_input"
                    value={contractForm.effective_from}
                    onChange={(e) => setContractForm({ ...contractForm, effective_from: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective To (اختتامی تاریخ)
                  </label>
                  <input
                    type="date"
                    data-help="billing_admin.contract_effective_to_input"
                    value={contractForm.effective_to}
                    onChange={(e) => setContractForm({ ...contractForm, effective_to: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contract Notes / Terms (وضاحت)
                </label>
                <textarea
                  rows={2}
                  data-help="billing_admin.contract_notes_input"
                  value={contractForm.notes}
                  onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                  placeholder="Terms agreed with consultant..."
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="billing_admin.cancel_contract_modal_btn"
                  onClick={() => setShowAddContractModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingContract}
                  data-help="billing_admin.save_contract_btn"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingContract ? "Saving..." : "Save Contract (محفوظ کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
