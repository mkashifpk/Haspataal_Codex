import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EstablishmentOut } from "../generated/facility_profile";
import {
  OtBookingDetailOut,
  SettlementPreviewOut,
  ContractListItemOut,
  StaffLookupOut,
  ParticipantIn,
  settlementPreview,
  finalizeOtBookings,
  contracts,
  lookupStaff,
  getBookingDetail,
  listBookings,
} from "../generated/ot_settlement";
import {
  getOtSettlementCapabilityView,
  canViewOtSettlement,
  canPreviewSettlement,
  canFinalizeSettlement,
  validateParticipants,
  validateFinalizeReadiness,
  explainOtSettlementError,
  OT_ROLES,
  OT_ROLE_LABELS,
  OtRoleInRoom,
} from "../ot-settlement-policy";

export interface ClinicalUser {
  user_id: number;
  username: string;
  roles?: string[];
  role?: string;
  employee_id?: number | null;
  name?: string;
}

interface OtSettlementProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const OtSettlement: React.FC<OtSettlementProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigate || onNavigateScreen;
  const userRoles = useMemo(() => {
    if (currentUser?.roles && currentUser.roles.length > 0) return currentUser.roles;
    if (currentUser?.role) return [currentUser.role];
    return [];
  }, [currentUser]);

  const viewMode = getOtSettlementCapabilityView(establishment);
  const canView = canViewOtSettlement(userRoles);
  const canPreview = canPreviewSettlement(userRoles);
  const canFinalize = canFinalizeSettlement(userRoles);

  // Bookings list state
  const [bookings, setBookings] = useState<OtBookingDetailOut[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [bookingDetail, setBookingDetail] = useState<OtBookingDetailOut | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Completed");
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Room participants roster state
  const [participants, setParticipants] = useState<ParticipantIn[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [staffResults, setStaffResults] = useState<StaffLookupOut[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffLookupOut | null>(null);
  const [selectedRole, setSelectedRole] = useState<OtRoleInRoom>("PrimarySurgeon");
  const [staffSearching, setStaffSearching] = useState(false);

  // Settlement preview state
  const [preview, setPreview] = useState<SettlementPreviewOut | null>(null);
  const [calculatingPreview, setCalculatingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Finalize state
  const [overrideReason, setOverrideReason] = useState("");
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizeSuccess, setFinalizeSuccess] = useState<string | null>(null);

  // Consultant contracts drawer state
  const [showContractsModal, setShowContractsModal] = useState(false);
  const [consultantContracts, setConsultantContracts] = useState<ContractListItemOut[]>([]);
  const [contractEmployeeFilter, setContractEmployeeFilter] = useState<string>("");
  const [loadingContracts, setLoadingContracts] = useState(false);

  // Printable summary state
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Load Bookings
  const refreshBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const q: { status?: string } = {};
      if (statusFilter !== "All") {
        q.status = statusFilter;
      }
      const data = await listBookings(q);
      const list = Array.isArray(data) ? data : [];
      setBookings(list);
      if (list.length > 0 && !selectedBookingId) {
        setSelectedBookingId(list[0].booking_id);
      }
    } catch {
      // Graceful fallback: maintain existing list
    } finally {
      setLoadingBookings(false);
    }
  }, [statusFilter, selectedBookingId]);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  // Load single booking detail when selected
  useEffect(() => {
    if (!selectedBookingId) {
      setBookingDetail(null);
      setParticipants([]);
      setPreview(null);
      return;
    }

    let active = true;
    getBookingDetail(selectedBookingId)
      .then((detail) => {
        if (!active) return;
        setBookingDetail(detail);
        setPreview(null);
        setFinalizeError(null);
        setFinalizeSuccess(null);

        // Prepopulate participants if surgery has primary surgeon
        if (detail.settlement?.participants && detail.settlement.participants.length > 0) {
          // Already settled
          setParticipants(
            detail.settlement.participants.map((p) => ({
              employee_id: p.employee_id,
              role_in_ot: p.role_in_ot,
            }))
          );
        } else if (detail.primary_surgeon_id) {
          setParticipants([
            {
              employee_id: detail.primary_surgeon_id,
              role_in_ot: "PrimarySurgeon",
            },
          ]);
        } else {
          setParticipants([]);
        }
      })
      .catch(() => {
        if (!active) return;
        // Fallback to item from list if available
        const found = bookings.find((b) => b.booking_id === selectedBookingId);
        if (found) {
          setBookingDetail(found);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedBookingId, bookings]);

  // Staff search debouncing
  useEffect(() => {
    const trimmed = staffSearchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setStaffResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setStaffSearching(true);
      try {
        const results = await lookupStaff({ q: trimmed, limit: 10 });
        setStaffResults(Array.isArray(results) ? results : []);
      } catch {
        setStaffResults([]);
      } finally {
        setStaffSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [staffSearchQuery]);

  // Real-time synchronization
  useEffect(() => {
    if (stream?.includes("ot.settlement.finalized")) {
      refreshBookings();
      if (selectedBookingId) {
        getBookingDetail(selectedBookingId).then((b) => setBookingDetail(b)).catch(() => {});
      }
    }
  }, [stream, refreshBookings, selectedBookingId]);

  // Add participant to roster
  const handleAddParticipant = () => {
    if (!selectedStaff) return;
    const exists = participants.some((p) => p.employee_id === selectedStaff.employee_id);
    if (exists) {
      alert("This staff member is already added to the room roster.");
      return;
    }

    const next = [
      ...participants,
      {
        employee_id: selectedStaff.employee_id,
        role_in_ot: selectedRole,
      },
    ];
    setParticipants(next);
    setSelectedStaff(null);
    setStaffSearchQuery("");
    setStaffResults([]);
    setPreview(null); // Invalidate previous preview under rule:5228072102
  };

  // Remove participant from roster
  const handleRemoveParticipant = (employeeId: number) => {
    const next = participants.filter((p) => p.employee_id !== employeeId);
    setParticipants(next);
    setPreview(null); // Invalidate previous preview under rule:5228072102
  };

  // Run settlement preview
  const handleCalculatePreview = async () => {
    if (!selectedBookingId) return;
    const validation = validateParticipants(participants);
    if (!validation.valid) {
      setPreviewError(validation.error || "Invalid participants list");
      return;
    }

    setCalculatingPreview(true);
    setPreviewError(null);
    try {
      const result = await settlementPreview(selectedBookingId, {
        participants,
      });
      setPreview(result);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "VALIDATION_ERROR";
      setPreviewError(explainOtSettlementError(code, "en"));
    } finally {
      setCalculatingPreview(false);
    }
  };

  // Finalize settlement
  const handleFinalize = async () => {
    if (!selectedBookingId || !preview) return;

    const readiness = validateFinalizeReadiness({
      preview,
      participants,
      overrideReason,
      surgeryStatus: bookingDetail?.status,
      procedurePrice: bookingDetail?.procedure_price,
    });

    if (!readiness.allowed) {
      setFinalizeError(readiness.reason || "Settlement not ready for finalization");
      return;
    }

    setFinalizing(true);
    setFinalizeError(null);
    try {
      const res = await finalizeOtBookings(selectedBookingId, {
        participants,
        commission_cap_override_reason: preview.exceeds_cap ? overrideReason.trim() : null,
      });
      setBookingDetail(res);
      setShowFinalizeModal(false);
      setFinalizeSuccess(
        `Surgery successfully finalized! Settlement #${res.settlement?.settlement_id} triggered split invoice #${res.settlement?.invoice_id}.`
      );
      refreshBookings();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "VALIDATION_ERROR";
      setFinalizeError(explainOtSettlementError(code, "en"));
    } finally {
      setFinalizing(false);
    }
  };

  // Load consultant contracts
  const handleViewContracts = async () => {
    setShowContractsModal(true);
    setLoadingContracts(true);
    try {
      const empId = contractEmployeeFilter ? parseInt(contractEmployeeFilter, 10) : undefined;
      const res = await contracts(empId ? { employee_id: empId } : undefined);
      setConsultantContracts(Array.isArray(res) ? res : []);
    } catch {
      setConsultantContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  };

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.booking_number?.toLowerCase().includes(q) ||
          b.patient_name?.toLowerCase().includes(q) ||
          b.mrn?.toLowerCase().includes(q) ||
          b.procedure_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, searchQuery]);

  const isAlreadySettled = Boolean(bookingDetail?.settlement);
  const finalizeReadiness = validateFinalizeReadiness({
    preview,
    participants,
    overrideReason,
    surgeryStatus: bookingDetail?.status,
    procedurePrice: bookingDetail?.procedure_price,
  });

  if (!canView) {
    return (
      <div className="p-6 text-red-700 bg-red-50 rounded-lg border border-red-200 m-4">
        <h2 className="text-xl font-bold mb-2">Access Denied / رسائی ممنوع ہے</h2>
        <p>You do not have permission to access Post-op settlement (ot_admin role required).</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6">
      {/* Capability View Notice (rule:7c9fedfb50) */}
      {viewMode === "open_work" && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 rounded shadow-sm">
          <p className="font-semibold">Notice: Surgery service is retiring (No new surgery work from now on).</p>
          <p className="text-sm">Completing, settling, and viewing records are permitted.</p>
        </div>
      )}
      {viewMode === "records" && (
        <div className="bg-slate-200 border-l-4 border-slate-500 text-slate-800 p-4 rounded shadow-sm">
          <p className="font-semibold">Records View Only</p>
          <p className="text-sm">Historical and settled theatre records viewable.</p>
        </div>
      )}

      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <h1 className="text-2xl font-bold text-slate-900">Post-Op Bill Settlement & Reconciliation</h1>
            <span className="text-sm font-urdu text-slate-500" dir="rtl">پوسٹ آپریٹو سیٹلمنٹ</span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Log theatre personnel, preview revenue deductions & commission splits, and finalize irreversible settlement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            data-help="ot_settlement.refresh_btn"
            onClick={refreshBookings}
            disabled={loadingBookings}
            className="px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 border border-slate-300"
          >
            <span>🔄</span>
            <span>{loadingBookings ? "Refreshing..." : "Refresh Worklist"}</span>
          </button>

          <button
            data-help="ot_settlement.view_contracts_btn"
            onClick={handleViewContracts}
            className="px-3 py-2 text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2 border border-indigo-200"
          >
            <span>📜</span>
            <span>Consultant Contracts</span>
          </button>

          {isAlreadySettled && (
            <button
              data-help="ot_settlement.print_summary_btn"
              onClick={() => setShowPrintModal(true)}
              className="px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-2 border border-emerald-200"
            >
              <span>🖨️</span>
              <span>Print Settlement Summary</span>
            </button>
          )}
        </div>
      </div>

      {finalizeSuccess && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 p-4 rounded shadow-sm flex items-center justify-between">
          <p className="font-semibold">{finalizeSuccess}</p>
          <button
            data-help="ot_settlement.dismiss_alert_btn"
            onClick={() => setFinalizeSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Surgeries Queue & Selection */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Theatre Surgeries</h2>
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-mono">
              {filteredBookings.length} cases
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status Filter</label>
              <select
                data-help="ot_settlement.status_filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Completed">Completed (Ready for Settlement)</option>
                <option value="Cleaning">Cleaning (Recent Exit)</option>
                <option value="All">All Bookings</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Search Booking / Patient</label>
              <input
                type="text"
                data-help="ot_settlement.booking_search_input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by number, MRN, procedure..."
                className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Select Case</label>
              <select
                data-help="ot_settlement.booking_select"
                value={selectedBookingId || ""}
                onChange={(e) => setSelectedBookingId(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>-- Select a Surgery Booking --</option>
                {filteredBookings.map((b) => (
                  <option key={b.booking_id} value={b.booking_id}>
                    {b.booking_number} - {b.patient_name} ({b.procedure_name}) [{b.status}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Booking Summary Box */}
          {bookingDetail ? (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-slate-900">{bookingDetail.booking_number}</span>
                  <p className="text-xs text-slate-500">MRN: {bookingDetail.mrn}</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    bookingDetail.settlement
                      ? "bg-emerald-100 text-emerald-800"
                      : bookingDetail.status === "Completed"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {bookingDetail.settlement ? "Finalized / Settled" : bookingDetail.status}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                <p><span className="text-slate-500">Patient:</span> <span className="font-semibold">{bookingDetail.patient_name}</span></p>
                <p><span className="text-slate-500">Procedure:</span> <span className="font-semibold">{bookingDetail.procedure_name}</span></p>
                <p><span className="text-slate-500">Primary Surgeon:</span> {bookingDetail.surgeon_name || `#${bookingDetail.primary_surgeon_id}`}</p>
                <p><span className="text-slate-500">Theatre:</span> {bookingDetail.ot_name || "Unassigned"}</p>
                <p>
                  <span className="text-slate-500">Procedure Price:</span>{" "}
                  {bookingDetail.procedure_price ? (
                    <span className="font-bold text-slate-900 font-mono">
                      PKR {bookingDetail.procedure_price.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-red-600 font-medium">Missing Price (Required)</span>
                  )}
                </p>
                <p>
                  <span className="text-slate-500">Consumables Logged:</span>{" "}
                  <span className="font-medium">{bookingDetail.consumables?.length || 0} line items</span>
                </p>
              </div>

              {bookingDetail.settlement && (
                <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                  <p className="font-semibold">Finalized Settlement Details:</p>
                  <p>Settlement ID: #{bookingDetail.settlement.settlement_id}</p>
                  <p>Invoice ID: #{bookingDetail.settlement.invoice_id}</p>
                  <p>Net Profit: PKR {bookingDetail.settlement.net_profit.toLocaleString()}</p>
                  <p>Total Commissions: PKR {bookingDetail.settlement.total_commissions.toLocaleString()}</p>
                  {bookingDetail.settlement.is_commission_cap_override && (
                    <p className="text-amber-800 mt-1">
                      Override Reason: {bookingDetail.settlement.commission_cap_override_reason}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No booking selected
            </div>
          )}
        </div>

        {/* Right 2 Columns: Participants Roster, Split Preview & Finalization */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Theatre Room Personnel Roster */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Theatre Room Participants</h2>
                <p className="text-xs text-slate-500">Log personnel who were present in the operating theatre.</p>
              </div>
              <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                {participants.length} recorded
              </span>
            </div>

            {/* Add Participant Controls */}
            {!isAlreadySettled && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6 relative">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Staff Member Search (Name / Badge)
                    </label>
                    <input
                      type="text"
                      data-help="ot_settlement.participant_staff_search"
                      value={staffSearchQuery}
                      onChange={(e) => {
                        setStaffSearchQuery(e.target.value);
                        setSelectedStaff(null);
                      }}
                      placeholder="Type name or badge..."
                      className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Staff autocomplete dropdown */}
                    {staffResults.length > 0 && !selectedStaff && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {staffResults.map((s) => (
                          <div
                            key={s.employee_id}
                            onClick={() => {
                              setSelectedStaff(s);
                              setStaffSearchQuery(s.full_name);
                              setStaffResults([]);
                            }}
                            className="p-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 text-xs"
                          >
                            <span className="font-semibold text-slate-900">{s.full_name}</span>{" "}
                            <span className="text-slate-500">({s.emp_number})</span>
                            <div className="text-slate-400 text-[10px]">
                              {s.designation} {s.registration ? `• ${s.registration}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {staffSearching && <p className="text-[10px] text-slate-400 mt-1">Searching staff...</p>}
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Role in OT</label>
                    <select
                      data-help="ot_settlement.participant_role_select"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as OtRoleInRoom)}
                      className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {OT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {OT_ROLE_LABELS[role].en} ({OT_ROLE_LABELS[role].ur})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2 flex items-end">
                    <button
                      data-help="ot_settlement.add_participant_btn"
                      onClick={handleAddParticipant}
                      disabled={!selectedStaff}
                      className="w-full py-2 px-3 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Participants Table */}
            {participants.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Staff ID</th>
                      <th className="p-3">Name / Role</th>
                      <th className="p-3">Designated Role</th>
                      {!isAlreadySettled && <th className="p-3 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {participants.map((p) => {
                      const label = OT_ROLE_LABELS[p.role_in_ot] || { en: p.role_in_ot, ur: "" };
                      return (
                        <tr key={p.employee_id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-medium text-slate-600">#{p.employee_id}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800">
                              {p.employee_id === bookingDetail?.primary_surgeon_id
                                ? `${bookingDetail.surgeon_name} (Lead)`
                                : `Staff #${p.employee_id}`}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 font-medium text-slate-700">
                              {label.en}
                            </span>
                          </td>
                          {!isAlreadySettled && (
                            <td className="p-3 text-right">
                              <button
                                data-help="ot_settlement.remove_participant_btn"
                                onClick={() => handleRemoveParticipant(p.employee_id)}
                                className="text-red-600 hover:text-red-800 font-medium"
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                At least one participant (Primary Surgeon) must be logged before settlement preview.
              </p>
            )}
          </div>

          {/* Section 2: Split Math & Preview (rule:5228072102) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Settlement Split Calculation</h2>
                <p className="text-xs text-slate-500">
                  Gross procedure revenue, consumables cost deduction, and consultant commission math.
                </p>
              </div>

              {!isAlreadySettled && (
                <div className="flex items-center gap-2">
                  {preview && (
                    <button
                      data-help="ot_settlement.reset_preview_btn"
                      onClick={() => setPreview(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    data-help="ot_settlement.preview_btn"
                    onClick={handleCalculatePreview}
                    disabled={calculatingPreview || participants.length === 0 || !selectedBookingId}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span>📊</span>
                    <span>{calculatingPreview ? "Calculating..." : "Preview Split Math"}</span>
                  </button>
                </div>
              )}
            </div>

            {previewError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-xs">
                {previewError}
              </div>
            )}

            {/* Display Calculated Preview */}
            {preview ? (
              <div className="space-y-4">
                {/* Revenue & Deductions Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Procedure Revenue</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      PKR {preview.procedure_revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Consumables Cost</span>
                    <span className="text-base font-bold text-rose-700 font-mono">
                      - PKR {preview.consumables_cost.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <span className="text-indigo-600 block font-medium">Net Profit</span>
                    <span className="text-base font-bold text-indigo-950 font-mono">
                      PKR {preview.net_profit.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-emerald-700 block font-medium">Hospital Net</span>
                    <span className="text-base font-bold text-emerald-950 font-mono">
                      PKR {preview.hospital_net.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Participant Commissions Table */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">Participant Commission Breakdown</h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="p-2.5">Participant</th>
                          <th className="p-2.5">Role</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Contract</th>
                          <th className="p-2.5">Basis</th>
                          <th className="p-2.5 text-right">Commission Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {preview.participants.map((p) => (
                          <tr key={p.employee_id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-900">{p.full_name}</td>
                            <td className="p-2.5">{p.role_in_ot}</td>
                            <td className="p-2.5">{p.staff_type}</td>
                            <td className="p-2.5 font-mono">{p.contract_id ? `#${p.contract_id}` : "Default"}</td>
                            <td className="p-2.5 text-slate-600">{p.commission_basis}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              PKR {p.commission_amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold">
                        <tr>
                          <td colSpan={5} className="p-2.5 text-right">Total Commissions:</td>
                          <td className="p-2.5 text-right font-mono text-blue-900">
                            PKR {preview.total_commissions.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Commission Cap Exceeded Warning & Override Input (rule:015f73a404) */}
                {preview.exceeds_cap && (
                  <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                      <span>⚠️</span>
                      <span>Commission Cap Exceeded (OT_COMMISSION_CAP_EXCEEDED)</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      Total commissions ({preview.total_commissions.toLocaleString()}) exceed net profit (
                      {preview.net_profit.toLocaleString()}). A reasoned, documented hospital policy override reason is
                      mandatory before finalization.
                    </p>
                    <div>
                      <label className="block text-xs font-semibold text-amber-900 mb-1">
                        Policy Override Reason / باقاعدہ پالیسی اوور رائیڈ وجہ *
                      </label>
                      <input
                        type="text"
                        data-help="ot_settlement.override_reason_input"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="e.g. Authorized under Medical Director emergency waiver #2026-OT..."
                        className="w-full text-xs border border-amber-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Finalize Button Area */}
                {!isAlreadySettled && (
                  <div className="pt-2 flex justify-end">
                    <button
                      data-help="ot_settlement.finalize_btn"
                      onClick={() => setShowFinalizeModal(true)}
                      disabled={!finalizeReadiness.allowed || !canFinalize}
                      className="px-5 py-2.5 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                      <span>🔒</span>
                      <span>Finalize Surgery & Trigger Split</span>
                    </button>
                  </div>
                )}
              </div>
            ) : isAlreadySettled ? (
              <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg">
                This surgery has already been settled and finalized. See details in the left panel or print summary.
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Click &quot;Preview Split Math&quot; above to inspect the financial deductions and commissions.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Finalize Confirmation Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>⚠️</span>
                <span>Confirm Finalization</span>
              </h3>
              <button
                data-help="ot_settlement.modal_close_btn"
                onClick={() => setShowFinalizeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-700">
              Finalizing surgery settlement is an <strong className="text-red-700">irreversible operation</strong>.
              It will lock all revenue deductions, generate financial commission ledger entries for all theatre
              participants, and emit an atomic settlement event.
            </p>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <p><strong>Booking:</strong> {bookingDetail?.booking_number}</p>
              <p><strong>Patient:</strong> {bookingDetail?.patient_name} ({bookingDetail?.mrn})</p>
              <p><strong>Procedure Net:</strong> PKR {preview?.net_profit.toLocaleString()}</p>
              <p><strong>Total Commissions:</strong> PKR {preview?.total_commissions.toLocaleString()}</p>
              <p><strong>Hospital Net:</strong> PKR {preview?.hospital_net.toLocaleString()}</p>
              {preview?.exceeds_cap && (
                <p className="text-amber-700"><strong>Cap Override:</strong> {overrideReason}</p>
              )}
            </div>

            {finalizeError && (
              <div className="p-3 bg-red-50 text-red-700 rounded text-xs">
                {finalizeError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <button
                data-help="ot_settlement.finalize_cancel_btn"
                onClick={() => setShowFinalizeModal(false)}
                disabled={finalizing}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                data-help="ot_settlement.finalize_confirm_btn"
                onClick={handleFinalize}
                disabled={finalizing}
                className="px-5 py-2 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-400 rounded-lg transition-colors flex items-center gap-2"
              >
                <span>{finalizing ? "Finalizing..." : "Yes, Finalize & Trigger Split"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consultant Contracts Inspector Drawer */}
      {showContractsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>📜</span>
                <span>Active Consultant Contracts (Finance)</span>
              </h3>
              <button
                data-help="ot_settlement.contracts_modal_close_btn"
                onClick={() => setShowContractsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                data-help="ot_settlement.contracts_filter"
                value={contractEmployeeFilter}
                onChange={(e) => setContractEmployeeFilter(e.target.value)}
                placeholder="Filter by staff Employee ID..."
                className="text-xs border border-slate-300 rounded p-2 w-48"
              />
              <button
                data-help="ot_settlement.contracts_search_btn"
                onClick={handleViewContracts}
                className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
              >
                Apply Filter
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-lg">
              {loadingContracts ? (
                <p className="p-6 text-center text-xs text-slate-500">Loading contracts...</p>
              ) : consultantContracts.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">Contract</th>
                      <th className="p-2.5">Doctor / Consultant</th>
                      <th className="p-2.5">Rule Type</th>
                      <th className="p-2.5">Terms</th>
                      <th className="p-2.5">Effective</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {consultantContracts.map((c) => (
                      <tr key={c.contract_id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono">#{c.contract_id}</td>
                        <td className="p-2.5 font-medium">{c.employee_name} ({c.employment_type})</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                            {c.rule_type}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {JSON.stringify(c.terms_jsonb)}
                        </td>
                        <td className="p-2.5 text-slate-500">{c.effective_from}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-6 text-center text-xs text-slate-400">No contracts found.</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                data-help="ot_settlement.contracts_modal_dismiss_btn"
                onClick={() => setShowContractsModal(false)}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Settlement Summary Modal */}
      {showPrintModal && bookingDetail?.settlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Settlement Voucher Summary</h3>
              <button
                data-help="ot_settlement.print_modal_close_btn"
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2 p-4 bg-slate-50 rounded-lg font-mono">
              <p className="font-bold text-center text-sm text-slate-900">Haspataal Operation Theatre Settlement</p>
              <p className="text-center text-slate-500">{timeZone}</p>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span>Voucher / Settlement ID:</span>
                <span>#{bookingDetail.settlement.settlement_id}</span>
              </div>
              <div className="flex justify-between">
                <span>Generated Invoice:</span>
                <span>#{bookingDetail.settlement.invoice_id}</span>
              </div>
              <div className="flex justify-between">
                <span>Booking Reference:</span>
                <span>{bookingDetail.booking_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Patient:</span>
                <span>{bookingDetail.patient_name} ({bookingDetail.mrn})</span>
              </div>
              <div className="flex justify-between">
                <span>Procedure:</span>
                <span>{bookingDetail.procedure_name}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span>Gross Revenue:</span>
                <span>PKR {bookingDetail.settlement.gross_revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Consumables Cost:</span>
                <span>- PKR {bookingDetail.settlement.consumables_cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Net Procedure Profit:</span>
                <span>PKR {bookingDetail.settlement.net_profit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Commissions:</span>
                <span>- PKR {bookingDetail.settlement.total_commissions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800">
                <span>Hospital Net Share:</span>
                <span>PKR {(bookingDetail.settlement.net_profit - bookingDetail.settlement.total_commissions).toLocaleString()}</span>
              </div>
              <hr className="my-2" />
              <p className="font-bold">Participants in Room:</p>
              {bookingDetail.settlement.participants.map((p) => (
                <div key={p.participant_id} className="flex justify-between text-[11px]">
                  <span>{p.full_name} ({p.role_in_ot}):</span>
                  <span>PKR {p.commission_amount.toLocaleString()}</span>
                </div>
              ))}
              <hr className="my-2" />
              <p className="text-[10px] text-slate-500">
                Finalized at {bookingDetail.settlement.finalized_at} by User #{bookingDetail.settlement.finalized_by} (Row v{bookingDetail.settlement.row_version})
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                data-help="ot_settlement.print_voucher_btn"
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
              >
                Print Voucher
              </button>
              <button
                data-help="ot_settlement.print_modal_dismiss_btn"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
