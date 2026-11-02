/**
 * Screen 140: diagnostic_partners
 * "Partner laboratories and imaging centres"
 * Workspace: `lab_admin`, Position: 140, Points: 44.
 *
 * Statutory & Quality Rules:
 * - rule:317f71af91: Record the PHC registration, the accreditation (PNAC) or PNRA licence, the MOU
 *                    reference and period, the turnaround agreed (hours) and a quality note; renew the
 *                    MOU before mou_valid_until (the worklist warns 30 days ahead; an expired MOU stops dispatches).
 * - rule:91092686de: Retire a partner with is_active false; its history stays.
 * - rule:5be909080d: Exists for the service outsourced_diagnostics (setup): show it as
 *                    GET /establishment views.screens says for screen_id diagnostic_partners (full; open_work:
 *                    without its new work, with the banner "No new ... from now on"; records: history and
 *                    corrections only; setup: only from Facility settings; hidden: in no menu), after login
 *                    and again on establishment.changed. Never decide it from the profile's category.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  listPartners,
  createPartner,
  updatePartner,
  type PartnerOut,
  type PartnerIn,
  type PartnerUpdateIn,
} from "../generated/diagnostic_partners";
import {
  getDiagnosticPartnersCapabilityView,
  getMouExpiryStatus,
  validatePartnerInput,
  validatePartnerUpdateInput,
  DIAGNOSTIC_PARTNERS_ERROR_MESSAGES,
  PARTNER_SERVICES,
  type DiagnosticPartnersCapabilityView,
  type PartnerService,
} from "../diagnostic-partners-policy";

export interface DiagnosticPartnersProps {
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

export const DiagnosticPartners: React.FC<DiagnosticPartnersProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  const capabilityView: DiagnosticPartnersCapabilityView = useMemo(
    () => getDiagnosticPartnersCapabilityView(establishment),
    [establishment]
  );

  const canManagePartners = useMemo(
    () =>
      user.roles.includes("owner") ||
      user.roles.includes("hospital_admin") ||
      user.roles.includes("clinic_director") ||
      user.roles.includes("lab_admin") ||
      user.roles.includes("radiologist") ||
      user.permissions.includes("diagnostics.setup.manage"),
    [user]
  );

  // Data & loading states
  const [partners, setPartners] = useState<PartnerOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Filters
  const [selectedService, setSelectedService] = useState<"All" | "Lab" | "Imaging">("All");
  const [activeOnly, setActiveOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerOut | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formServices, setFormServices] = useState<PartnerService>("Lab");
  const [formPhcReg, setFormPhcReg] = useState("");
  const [formAccreditation, setFormAccreditation] = useState("");
  const [formPnraLicence, setFormPnraLicence] = useState("");
  const [formMouRef, setFormMouRef] = useState("");
  const [formMouFrom, setFormMouFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [formMouUntil, setFormMouUntil] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  });
  const [formTurnaroundHours, setFormTurnaroundHours] = useState("24");
  const [formQualityNote, setFormQualityNote] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formAddress, setFormAddress] = useState("");

  // Fetch partners
  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPartners({
        services: selectedService === "All" ? null : (selectedService as "Lab" | "Imaging"),
        active_only: activeOnly,
      });
      setPartners(data || []);
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = DIAGNOSTIC_PARTNERS_ERROR_MESSAGES[code]?.en || err.message || "Failed to load partners";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  }, [selectedService, activeOnly]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    if (!searchQuery.trim()) return partners;
    const q = searchQuery.toLowerCase();
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phc_registration && p.phc_registration.toLowerCase().includes(q)) ||
        (p.mou_reference && p.mou_reference.toLowerCase().includes(q))
    );
  }, [partners, searchQuery]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormName("");
    setFormServices("Lab");
    setFormPhcReg("");
    setFormAccreditation("");
    setFormPnraLicence("");
    setFormMouRef("");
    setFormMouFrom(new Date().toISOString().split("T")[0]);
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    setFormMouUntil(d.toISOString().split("T")[0]);
    setFormTurnaroundHours("24");
    setFormQualityNote("");
    setFormContact("");
    setFormAddress("");
    setShowAddModal(true);
  };

  // Submit Add Partner
  const handleSubmitAdd = async () => {
    const payload: PartnerIn = {
      name: formName.trim(),
      services: formServices,
      phc_registration: formPhcReg.trim() || null,
      accreditation: formAccreditation.trim() || null,
      pnra_licence: formPnraLicence.trim() || null,
      mou_reference: formMouRef.trim() || null,
      mou_valid_from: formMouFrom || null,
      mou_valid_until: formMouUntil || null,
      turnaround_hours: formTurnaroundHours ? Number(formTurnaroundHours) : null,
      quality_note: formQualityNote.trim() || null,
      contact: formContact.trim() || null,
      address: formAddress.trim() || null,
    };

    const val = validatePartnerInput(payload);
    if (!val.valid) {
      const firstErr = Object.values(val.errors)[0];
      setStatusMessage({ text: firstErr, isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await createPartner(payload);
      setShowAddModal(false);
      setStatusMessage({ text: `Partner '${payload.name}' registered successfully.`, isError: false });
      fetchPartners();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = DIAGNOSTIC_PARTNERS_ERROR_MESSAGES[code]?.en || err.message || "Failed to create partner";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Open Edit / Renew Modal
  const handleOpenEdit = (partner: PartnerOut) => {
    setEditingPartner(partner);
    setFormName(partner.name);
    setFormServices(partner.services);
    setFormPhcReg(partner.phc_registration || "");
    setFormAccreditation(partner.accreditation || "");
    setFormPnraLicence(partner.pnra_licence || "");
    setFormMouRef(partner.mou_reference || "");
    setFormMouFrom(partner.mou_valid_from || "");
    setFormMouUntil(partner.mou_valid_until || "");
    setFormTurnaroundHours(partner.turnaround_hours ? String(partner.turnaround_hours) : "");
    setFormQualityNote(partner.quality_note || "");
    setFormContact(partner.contact || "");
    setFormAddress(partner.address || "");
    setShowEditModal(true);
  };

  // Submit Edit / Renew Partner
  const handleSubmitEdit = async () => {
    if (!editingPartner) return;

    const payload: PartnerUpdateIn = {
      name: formName.trim(),
      services: formServices,
      phc_registration: formPhcReg.trim() || null,
      accreditation: formAccreditation.trim() || null,
      pnra_licence: formPnraLicence.trim() || null,
      mou_reference: formMouRef.trim() || null,
      mou_valid_from: formMouFrom || null,
      mou_valid_until: formMouUntil || null,
      turnaround_hours: formTurnaroundHours ? Number(formTurnaroundHours) : null,
      quality_note: formQualityNote.trim() || null,
      contact: formContact.trim() || null,
      address: formAddress.trim() || null,
      expected_version: editingPartner.row_version,
    };

    const val = validatePartnerUpdateInput(payload);
    if (!val.valid) {
      const firstErr = Object.values(val.errors)[0];
      setStatusMessage({ text: firstErr, isError: true });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      await updatePartner(editingPartner.partner_id, payload);
      setShowEditModal(false);
      setEditingPartner(null);
      setStatusMessage({ text: `Partner '${payload.name}' updated / MOU renewed successfully.`, isError: false });
      fetchPartners();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = DIAGNOSTIC_PARTNERS_ERROR_MESSAGES[code]?.en || err.message || "Failed to update partner";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Toggle Retire / Reactivate Partner under Rule 91092686de
  const handleToggleRetire = async (partner: PartnerOut) => {
    setLoading(true);
    try {
      await updatePartner(partner.partner_id, {
        is_active: !partner.is_active,
        expected_version: partner.row_version,
      });
      setStatusMessage({
        text: `Partner '${partner.name}' marked ${!partner.is_active ? "Active" : "Retired (History retained)"}.`,
        isError: false,
      });
      fetchPartners();
    } catch (err: any) {
      const code = err?.code || "VALIDATION_ERROR";
      const msg = DIAGNOSTIC_PARTNERS_ERROR_MESSAGES[code]?.en || err.message || "Failed to change partner status";
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="diagnostic-partners-screen p-4 max-w-7xl mx-auto space-y-4">
      {/* Service Banner for Rule 5be909080d */}
      {capabilityView === "open_work" && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 rounded shadow">
          <p className="font-semibold text-base">
            No new laboratory or outsourced diagnostics work from now on
          </p>
          <p className="text-sm">
            بیرونی تشخیصی شراکت داروں کا نیا کام اب بند ہے۔ موجودہ شراکت داریوں کا آڈٹ کیا جا سکتا ہے۔
          </p>
        </div>
      )}

      {capabilityView === "records" && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-900 p-4 rounded shadow">
          <span className="font-bold uppercase tracking-wider text-xs bg-blue-700 text-white px-2 py-0.5 rounded mr-2">
            Records
          </span>
          <span className="text-sm font-medium">
            Records Mode: View diagnostic partners, agreements and quality accreditations only. New agreements disabled.
          </span>
        </div>
      )}

      {/* Screen Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Partner Laboratories & Imaging Centres | تشخیصی شراکت دار
          </h1>
          <p className="text-sm text-gray-600">
            External referral partners, MOUs, quality accreditations and turnaround compliance (MSDS AAC 6, 14).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm font-medium transition"
            onClick={fetchPartners}
            data-help="diagnostic_partners.btn_refresh"
          >
            {loading ? "Refreshing..." : "↻ Refresh | ریفریش"}
          </button>
        </div>
      </div>

      {/* Status Feedback */}
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-gray-50 p-3 rounded border">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Service Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-700">Services:</span>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value as "All" | "Lab" | "Imaging")}
              className="px-2 py-1 border rounded text-xs bg-white"
              data-help="diagnostic_partners.select_service_filter"
            >
              <option value="All">All Services | تمام سروسز</option>
              <option value="Lab">Laboratory | لیبارٹری</option>
              <option value="Imaging">Imaging / Radiology | ریڈیالوجی</option>
            </select>
          </div>

          {/* Active Only Toggle */}
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              id="active_only_filter"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded text-blue-600"
              data-help="diagnostic_partners.checkbox_active_only"
            />
            <label htmlFor="active_only_filter" className="text-xs font-medium text-gray-800">
              Active Only | صرف فعال
            </label>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Search partner name or PHC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1 border rounded text-xs w-48 sm:w-64"
              data-help="diagnostic_partners.search_query"
            />
          </div>
        </div>

        {canManagePartners && capabilityView === "full" && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow flex items-center gap-1.5 transition"
            data-help="diagnostic_partners.btn_open_add_partner"
          >
            + Add Diagnostic Partner | نیا پارٹنر شامل کریں
          </button>
        )}
      </div>

      {/* Partners Worklist Table */}
      <div className="overflow-x-auto bg-white rounded border shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
            <tr>
              <th className="p-3">Partner Name & Services</th>
              <th className="p-3">Accreditation / Licensing</th>
              <th className="p-3">MOU Reference & Timeline</th>
              <th className="p-3">Agreed TAT</th>
              <th className="p-3">Active Send-outs</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPartners.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  {loading ? "Loading diagnostic partners..." : "No diagnostic referral partners found."}
                </td>
              </tr>
            ) : (
              filteredPartners.map((partner) => {
                const expiryInfo = getMouExpiryStatus(partner.mou_valid_until, partner.mou_expired);
                return (
                  <tr key={partner.partner_id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-semibold text-gray-900">{partner.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium text-[11px] ${
                            partner.services === "Both"
                              ? "bg-purple-100 text-purple-800"
                              : partner.services === "Imaging"
                              ? "bg-cyan-100 text-cyan-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {partner.services}
                        </span>
                        {partner.contact && <span>• Contact: {partner.contact}</span>}
                      </div>
                    </td>

                    <td className="p-3 text-xs">
                      <div className="text-gray-800">
                        PHC: <span className="font-mono font-medium">{partner.phc_registration || "—"}</span>
                      </div>
                      {partner.accreditation && (
                        <div className="text-emerald-700">ISO: {partner.accreditation}</div>
                      )}
                      {partner.pnra_licence && (
                        <div className="text-purple-700">PNRA: {partner.pnra_licence}</div>
                      )}
                    </td>

                    <td className="p-3 text-xs">
                      <div className="font-mono text-gray-700 font-medium">
                        {partner.mou_reference || "No Ref"}
                      </div>
                      <div className="text-gray-500">
                        {partner.mou_valid_from || "—"} to {partner.mou_valid_until || "—"}
                      </div>
                      <div className="mt-1">
                        {expiryInfo.status === "expired" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                            ⛔ MOU Expired (Dispatches Halted)
                          </span>
                        )}
                        {expiryInfo.status === "expiring_soon" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                            ⚠️ Expiring ({expiryInfo.daysLeft} days left)
                          </span>
                        )}
                        {expiryInfo.status === "valid" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-800">
                            ✓ Valid ({expiryInfo.daysLeft} days left)
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 text-gray-800 font-medium">
                      {partner.turnaround_hours ? `${partner.turnaround_hours}h` : "—"}
                    </td>

                    <td className="p-3 text-gray-700 font-bold">
                      {partner.tests_sent_out}
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          partner.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {partner.is_active ? "Active" : "Retired"}
                      </span>
                    </td>

                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      {canManagePartners && capabilityView === "full" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(partner)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium"
                            data-help="diagnostic_partners.btn_edit_partner"
                          >
                            Edit / Renew MOU
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleRetire(partner)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              partner.is_active
                                ? "bg-red-50 hover:bg-red-100 text-red-700"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                            }`}
                            data-help="diagnostic_partners.btn_toggle_retire"
                          >
                            {partner.is_active ? "Retire" : "Reactivate"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: ADD / EDIT PARTNER */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">
                {showAddModal
                  ? "Register Diagnostic Referral Partner | نیا پارٹنر درج کریں"
                  : `Update / Renew Partner: ${editingPartner?.name}`}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setEditingPartner(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                data-help="diagnostic_partners.btn_cancel_partner"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Partner Laboratory or Imaging Centre Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chughtai Lab Central / Excel Diagnostics"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full font-medium"
                  data-help="diagnostic_partners.input_partner_name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Services Offered *</label>
                <select
                  value={formServices}
                  onChange={(e) => setFormServices(e.target.value as PartnerService)}
                  className="px-3 py-1.5 border rounded text-xs w-full bg-white font-medium"
                  data-help="diagnostic_partners.select_partner_services"
                >
                  <option value="Lab">Laboratory Only (Clinical Pathology, Molecular)</option>
                  <option value="Imaging">Imaging Only (MRI, CT, Nuclear Medicine)</option>
                  <option value="Both">Both (Lab and Imaging Services)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  PHC Registration / Licence Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. PHC-LAB-2026-981"
                  value={formPhcReg}
                  onChange={(e) => setFormPhcReg(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full font-mono"
                  data-help="diagnostic_partners.input_phc_reg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Accreditation (PNAC ISO 15189 / CAP)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PNAC ISO 15189 Certificate #123"
                  value={formAccreditation}
                  onChange={(e) => setFormAccreditation(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="diagnostic_partners.input_accreditation"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  PNRA Licence Number (Mandatory for Imaging / Radiation)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PNRA-DIAG-XRAY-445"
                  value={formPnraLicence}
                  onChange={(e) => setFormPnraLicence(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full font-mono"
                  data-help="diagnostic_partners.input_pnra_licence"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  MOU Reference Letter / Agreement Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. MOU-2026-DIAG-01"
                  value={formMouRef}
                  onChange={(e) => setFormMouRef(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full font-mono"
                  data-help="diagnostic_partners.input_mou_ref"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Agreed SLA Turnaround (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="2160"
                  placeholder="e.g. 24"
                  value={formTurnaroundHours}
                  onChange={(e) => setFormTurnaroundHours(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="diagnostic_partners.input_turnaround_hours"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">MOU Valid From *</label>
                <input
                  type="date"
                  value={formMouFrom}
                  onChange={(e) => setFormMouFrom(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="diagnostic_partners.input_mou_from"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  MOU Valid Until (Expiry Date) *
                </label>
                <input
                  type="date"
                  value={formMouUntil}
                  onChange={(e) => setFormMouUntil(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="diagnostic_partners.input_mou_until"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Phone / Email</label>
                <input
                  type="text"
                  placeholder="e.g. 042-111-222-333, info@lab.pk"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="diagnostic_partners.input_contact"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Physical Address / Hub</label>
                <input
                  type="text"
                  placeholder="e.g. 14-Jail Road, Lahore"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="diagnostic_partners.input_address"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Quality Assurance Note (External EQAS, Accreditation, Inspection Notes)
                </label>
                <textarea
                  rows={3}
                  placeholder="Document hospital verification of quality, EQAS participation (RIQAS, NEQAS), proficiency testing..."
                  value={formQualityNote}
                  onChange={(e) => setFormQualityNote(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs w-full"
                  data-help="diagnostic_partners.input_quality_note"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setEditingPartner(null);
                }}
                className="px-4 py-2 border rounded text-xs font-semibold text-gray-700 hover:bg-gray-100"
                data-help="diagnostic_partners.btn_cancel_partner"
              >
                Cancel | منسوخ
              </button>
              <button
                type="button"
                onClick={showAddModal ? handleSubmitAdd : handleSubmitEdit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow"
                data-help="diagnostic_partners.btn_submit_partner"
              >
                {showAddModal ? "Register Partner | پارٹنر محفوظ کریں" : "Save / Renew Agreement | تجدید کریں"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
