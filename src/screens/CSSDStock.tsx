import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EstablishmentOut } from "../generated/facility_profile";
import {
  PackOut,
  PackIssueIn,
  WardOccupancyOut,
  TheaterOut,
  listPacks,
  issueCssdPacks,
  getPack,
  bedMatrix,
  theaters,
} from "../generated/cssd_stock";
import {
  getCssdStockScreenView,
  isCssdActive,
  canOperateCssd,
  canIssuePacks,
  canViewCssd,
  sortPacksByExpiry,
  validatePackIssue,
  explainCssdStockError,
  ClinicalUser,
} from "../cssd-stock-policy";

interface CSSDStockProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

type TabMode = "stock" | "basket" | "expired";

export const CSSDStock: React.FC<CSSDStockProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigate || onNavigateScreen;
  const viewMode = getCssdStockScreenView(establishment);
  const isServiceActive = isCssdActive(establishment);
  const canOperate = canOperateCssd(currentUser);
  const canIssue = canIssuePacks(currentUser);
  const canView = canViewCssd(currentUser);

  // Data states
  const [packs, setPacks] = useState<PackOut[]>([]);
  const [wards, setWards] = useState<WardOccupancyOut[]>([]);
  const [theatersList, setTheatersList] = useState<TheaterOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<{ en: string; ur: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active tab & search states
  const [activeTab, setActiveTab] = useState<TabMode>("stock");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("Available");
  const [expiringOnly, setExpiringOnly] = useState<boolean>(false);

  // Pack lookup state
  const [lookupCode, setLookupCode] = useState<string>("");
  const [inspectedPack, setInspectedPack] = useState<PackOut | null>(null);
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);

  // Issue Basket state (Rule 3834d11044)
  const [basketCodes, setBasketCodes] = useState<string[]>([]);
  const [scanInput, setScanInput] = useState<string>("");
  const [destinationType, setDestinationType] = useState<"ward" | "ot">("ward");
  const [selectedWardId, setSelectedWardId] = useState<number | null>(null);
  const [selectedOtId, setSelectedOtId] = useState<number | null>(null);
  const [issuing, setIssuing] = useState<boolean>(false);
  const [issueErrors, setIssueErrors] = useState<string[]>([]);

  // Fetch stock and destination matrices
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [packsData, matrixData, otData] = await Promise.all([
        listPacks({ limit: 500 }),
        bedMatrix({ include_beds: false }),
        theaters(),
      ]);
      setPacks(packsData || []);
      setWards(matrixData?.wards || []);
      setTheatersList(otData || []);

      // Pre-select first ward and OT if available
      if (matrixData?.wards?.length && !selectedWardId) {
        setSelectedWardId(matrixData.wards[0].ward_id);
      }
      if (otData?.length && !selectedOtId) {
        setSelectedOtId(otData[0].ot_id);
      }
    } catch (err: any) {
      const code = err?.code || "FETCH_FAILED";
      setErrorMsg(explainCssdStockError(code));
    } finally {
      setLoading(false);
    }
  }, [selectedWardId, selectedOtId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime updates
  useEffect(() => {
    if (!stream) return;
    try {
      const ev = JSON.parse(stream);
      if (ev?.topic === "cssd.cycle.updated" || ev?.type === "cssd.cycle.updated") {
        fetchData();
      }
    } catch {}
  }, [stream, fetchData]);

  // Filtered available stock sorted by FIFO soonest expiry (Rule 613c123950)
  const availableStock = useMemo(() => {
    let filtered = packs.filter((p) => p.status === "Available");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.pack_code.toLowerCase().includes(q) ||
          p.set_name.toLowerCase().includes(q) ||
          p.cycle_number.toLowerCase().includes(q)
      );
    }
    if (expiringOnly) {
      filtered = filtered.filter((p) => p.expiring_soon);
    }
    return sortPacksByExpiry(filtered);
  }, [packs, searchQuery, expiringOnly]);

  // Expired / Quarantine / Recalled packs (Rule 30768e8506)
  const expiredAndCompromised = useMemo(() => {
    return packs.filter((p) => p.status === "Expired" || p.status === "Failed" || p.status === "Recalled");
  }, [packs]);

  // Basket pack details
  const basketPacks = useMemo(() => {
    return basketCodes
      .map((code) => packs.find((p) => p.pack_code === code) || ({ pack_code: code, set_name: "Scanned Pack" } as PackOut));
  }, [basketCodes, packs]);

  // Handle single pack lookup (GET /cssd/packs/{pack_code})
  const handleLookupPack = async () => {
    if (!lookupCode.trim()) return;
    setLookupLoading(true);
    setErrorMsg(null);
    try {
      const pack = await getPack(lookupCode.trim());
      setInspectedPack(pack);
    } catch (err: any) {
      const code = err?.code || "PACK_NOT_FOUND";
      setErrorMsg(explainCssdStockError(code));
    } finally {
      setLookupLoading(false);
    }
  };

  // Add scanned barcode to basket
  const handleAddScanToBasket = () => {
    const code = scanInput.trim().toUpperCase();
    if (!code) return;
    if (basketCodes.includes(code)) {
      setIssueErrors([`Pack "${code}" is already in the basket.`]);
      return;
    }
    setBasketCodes([...basketCodes, code]);
    setScanInput("");
    setIssueErrors([]);
  };

  // Add stock row pack directly to basket
  const handleAddPackToBasket = (packCode: string) => {
    if (!basketCodes.includes(packCode)) {
      setBasketCodes([...basketCodes, packCode]);
      setSuccessMsg(`Pack ${packCode} added to issue basket.`);
    }
  };

  // Remove pack from basket
  const handleRemoveFromBasket = (packCode: string) => {
    setBasketCodes(basketCodes.filter((c) => c !== packCode));
  };

  // Clear basket
  const handleClearBasket = () => {
    setBasketCodes([]);
    setIssueErrors([]);
  };

  // Submit pack issue (POST /cssd/packs/issue)
  const handleConfirmIssue = async () => {
    setIssueErrors([]);
    const validation = validatePackIssue({
      packCodes: basketCodes,
      destinationType,
      wardId: destinationType === "ward" ? selectedWardId : null,
      otId: destinationType === "ot" ? selectedOtId : null,
      wards,
      theaters: theatersList,
    });

    if (!validation.valid) {
      setIssueErrors(validation.errors);
      return;
    }

    setIssuing(true);
    try {
      const payload: PackIssueIn = {
        pack_codes: basketCodes,
        ward_id: destinationType === "ward" ? selectedWardId : null,
        ot_id: destinationType === "ot" ? selectedOtId : null,
      };

      const issued = await issueCssdPacks(payload);
      const destName =
        destinationType === "ward"
          ? wards.find((w) => w.ward_id === selectedWardId)?.name || "Ward"
          : theatersList.find((t) => t.ot_id === selectedOtId)?.name || "Operating Theatre";

      setSuccessMsg(`Successfully issued ${issued.length} sterile pack(s) to ${destName}.`);
      setBasketCodes([]);
      await fetchData();
    } catch (err: any) {
      const code = err?.code || "ISSUE_FAILED";
      setIssueErrors([explainCssdStockError(code, err?.details).en]);
    } finally {
      setIssuing(false);
    }
  };

  // Gating banner for capability states
  if (viewMode === "hidden") {
    return (
      <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300">
          CSSD Sterile Stock Inactive
        </h2>
        <p className="text-gray-500 mt-2">
          The Sterile Supply (CSSD) service is not enabled for this facility profile.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 overflow-y-auto">
      {/* Capability View Mode Notice Banners */}
      {viewMode === "open_work" && (
        <div className="mb-4 p-3 bg-amber-100 border border-amber-400 text-amber-800 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-200 rounded flex justify-between items-center">
          <div>
            <strong>Retiring Service:</strong> No new sterile packs from now on. Existing stock may be issued and inspected.
          </div>
          <span className="text-xs font-semibold px-2 py-1 bg-amber-200 dark:bg-amber-800 rounded">
            Open Work Only
          </span>
        </div>
      )}

      {viewMode === "records" && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-800 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-200 rounded flex justify-between items-center">
          <div>
            <strong>Records Mode:</strong> CSSD is retired. Sterile pack inventory and usage logs are read-only.
          </div>
          <span className="text-xs font-semibold px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded">
            Records
          </span>
        </div>
      )}

      {/* Global Alerts */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200 rounded flex justify-between items-center">
          <div>
            <div>{errorMsg.en}</div>
            <div className="text-sm font-urdu mt-1" dir="rtl">{errorMsg.ur}</div>
          </div>
          <button
            data-help="cssd_stock.dismiss_alert_button"
            onClick={() => setErrorMsg(null)}
            className="px-2 py-1 text-sm bg-red-200 hover:bg-red-300 dark:bg-red-800 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200 rounded flex justify-between items-center">
          <div>{successMsg}</div>
          <button
            data-help="cssd_stock.dismiss_alert_button"
            onClick={() => setSuccessMsg(null)}
            className="px-2 py-1 text-sm bg-green-200 hover:bg-green-300 dark:bg-green-800 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header and Navigation Bar */}
      <header className="flex flex-wrap justify-between items-center pb-4 mb-4 border-b border-gray-300 dark:border-gray-700 gap-2">
        <div className="flex items-center gap-3">
          {navigate && (
            <button
              data-help="cssd_stock.back_button"
              onClick={() => navigate("cssd_board")}
              className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition"
            >
              ← Sterilization Board
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sterile Stock & Issue</h1>
            <p className="text-sm text-gray-500 font-urdu" dir="rtl">
              سٹرائل سٹاک اور وارڈز و آپریشن تھیٹرز کو پیکس کا اجراء
            </p>
          </div>
        </div>

        {/* View Tabs & Refresh */}
        <div className="flex items-center gap-2">
          <button
            data-help="cssd_stock.tab_stock"
            onClick={() => setActiveTab("stock")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition ${
              activeTab === "stock"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
            }`}
          >
            Available Stock ({availableStock.length})
          </button>
          <button
            data-help="cssd_stock.tab_basket"
            onClick={() => setActiveTab("basket")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition flex items-center gap-1.5 ${
              activeTab === "basket"
                ? "bg-emerald-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
            }`}
          >
            <span>Issue Basket</span>
            {basketCodes.length > 0 && (
              <span className="px-1.5 py-0.2 bg-white text-emerald-800 font-bold rounded-full text-xs">
                {basketCodes.length}
              </span>
            )}
          </button>
          <button
            data-help="cssd_stock.tab_expired"
            onClick={() => setActiveTab("expired")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition ${
              activeTab === "expired"
                ? "bg-red-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
            }`}
          >
            Expired / Compromised ({expiredAndCompromised.length})
          </button>
          <button
            data-help="cssd_stock.refresh_button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {/* TAB 1: Available Stock (FIFO soonest expiry first per Rule 613c123950) */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          {/* Search, Filter & Quick Lookup Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                data-help="cssd_stock.search_stock_input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search set name or pack code..."
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 w-64 bg-white dark:bg-gray-700"
              />

              <label className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  data-help="cssd_stock.toggle_expiring_only"
                  checked={expiringOnly}
                  onChange={(e) => setExpiringOnly(e.target.checked)}
                  className="rounded border-gray-300 text-amber-600"
                />
                <span>Expiring Soon Only (Amber)</span>
              </label>
            </div>

            {/* Quick Barcode Scanner/Lookup */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                data-help="cssd_stock.lookup_pack_input"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Scan / type pack barcode..."
                className="text-sm font-mono border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1.5 w-52 bg-white dark:bg-gray-700"
              />
              <button
                data-help="cssd_stock.lookup_pack_button"
                onClick={handleLookupPack}
                disabled={lookupLoading || !lookupCode.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition"
              >
                {lookupLoading ? "Checking..." : "Inspect Pack"}
              </button>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="p-3">Pack Code</th>
                    <th className="p-3">Set / Instrument</th>
                    <th className="p-3">Sterilization Cycle</th>
                    <th className="p-3">Sterilized On</th>
                    <th className="p-3">Expires On (FIFO)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {availableStock.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        {loading ? "Loading sterile stock..." : "No available sterile packs found matching the criteria."}
                      </td>
                    </tr>
                  ) : (
                    availableStock.map((pack) => (
                      <tr
                        key={pack.pack_id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition ${
                          pack.expiring_soon ? "bg-amber-50/60 dark:bg-amber-950/20 font-medium" : ""
                        }`}
                      >
                        <td className="p-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {pack.pack_code}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{pack.set_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{pack.set_code}</div>
                        </td>
                        <td className="p-3 font-mono text-xs">{pack.cycle_number}</td>
                        <td className="p-3 text-xs">{pack.sterilized_on}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
                              pack.expiring_soon ? "text-amber-700 dark:text-amber-400" : ""
                            }`}
                          >
                            {pack.expires_on}
                            {pack.expiring_soon && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-800 text-[10px]">
                                Issue First
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                            Available
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            data-help="cssd_stock.view_pack_button"
                            onClick={() => setInspectedPack(pack)}
                            className="px-2.5 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition"
                          >
                            Details
                          </button>
                          {canIssue && viewMode !== "records" && (
                            <button
                              data-help="cssd_stock.add_to_basket_button"
                              onClick={() => handleAddPackToBasket(pack.pack_code)}
                              disabled={basketCodes.includes(pack.pack_code)}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded transition"
                            >
                              {basketCodes.includes(pack.pack_code) ? "In Basket" : "+ Basket"}
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
        </div>
      )}

      {/* TAB 2: Pack Issue Basket (Rule 3834d11044 & Rule 5298373f7d) */}
      {activeTab === "basket" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Scanned Basket List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-bold mb-1">Barcode Scanner Input (Rule 3834d11044)</h2>
              <p className="text-xs text-gray-500 mb-3">
                Scan sterile pack adhesive labels directly into this basket using a thermal barcode scanner.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  data-help="cssd_stock.scan_barcode_input"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddScanToBasket();
                    }
                  }}
                  placeholder="Scan pack barcode or type code (e.g. SP-2026-000001)..."
                  className="flex-1 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                />
                <button
                  data-help="cssd_stock.scan_add_button"
                  onClick={handleAddScanToBasket}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                >
                  Add to Basket
                </button>
              </div>
            </div>

            {/* Basket Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold">
                  Scanned Pack Items in Basket ({basketCodes.length})
                </h3>
                {basketCodes.length > 0 && (
                  <button
                    data-help="cssd_stock.clear_basket_button"
                    onClick={handleClearBasket}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Clear Basket
                  </button>
                )}
              </div>

              <div className="border rounded max-h-96 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Pack Barcode</th>
                      <th className="p-2">Set Clinical Description</th>
                      <th className="p-2">Expiry Date</th>
                      <th className="p-2 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {basketCodes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-400">
                          The issue basket is empty. Scan pack labels or add packs from the Available Stock tab.
                        </td>
                      </tr>
                    ) : (
                      basketPacks.map((item, idx) => (
                        <tr key={item.pack_code}>
                          <td className="p-2 text-gray-400 font-mono">{idx + 1}</td>
                          <td className="p-2 font-mono font-bold text-blue-600">{item.pack_code}</td>
                          <td className="p-2">{item.set_name}</td>
                          <td className="p-2 font-mono">{item.expires_on || "-"}</td>
                          <td className="p-2 text-right">
                            <button
                              data-help="cssd_stock.remove_from_basket_button"
                              onClick={() => handleRemoveFromBasket(item.pack_code)}
                              className="text-red-600 hover:underline"
                            >
                              Remove
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

          {/* Right Col: Destination Selector & Issue Action (Rule 5298373f7d) */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-base font-bold border-b pb-2">Issue Destination (Rule 5298373f7d)</h3>
              <p className="text-xs text-gray-500">
                Packs must be issued to a registered Ward or Operating Theatre selected from the server matrix; typed IDs are rejected.
              </p>

              {issueErrors.length > 0 && (
                <div className="p-3 bg-red-100 text-red-800 rounded text-xs space-y-1">
                  {issueErrors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">Destination Category *</label>
                <select
                  data-help="cssd_stock.destination_type_select"
                  value={destinationType}
                  onChange={(e) => setDestinationType(e.target.value as any)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                >
                  <option value="ward">Inpatient Ward (v_bed_matrix)</option>
                  <option value="ot">Operating Theatre (ot/theaters)</option>
                </select>
              </div>

              {destinationType === "ward" ? (
                <div>
                  <label className="block text-xs font-semibold mb-1">Select Destination Ward *</label>
                  <select
                    data-help="cssd_stock.ward_select"
                    value={selectedWardId ?? ""}
                    onChange={(e) => {
                      const wid = parseInt(e.target.value, 10);
                      setSelectedWardId(isNaN(wid) ? null : wid);
                    }}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                  >
                    <option value="">-- Choose Ward --</option>
                    {wards.map((w) => (
                      <option key={w.ward_id} value={w.ward_id}>
                        {w.name} ({w.ward_type}) - Total Beds: {w.total_beds}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400 mt-1 block">
                    CSSD staff only sees ward identities; patient names are excluded per MSDS IPC 91.
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold mb-1">Select Operating Theatre *</label>
                  <select
                    data-help="cssd_stock.ot_select"
                    value={selectedOtId ?? ""}
                    onChange={(e) => {
                      const oid = parseInt(e.target.value, 10);
                      setSelectedOtId(isNaN(oid) ? null : oid);
                    }}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                  >
                    <option value="">-- Choose Theatre --</option>
                    {theatersList
                      .filter((t) => t.is_active)
                      .map((t) => (
                        <option key={t.ot_id} value={t.ot_id}>
                          {t.name} ({t.code}) - {t.current_state}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="pt-2 border-t">
                <button
                  data-help="cssd_stock.confirm_issue_button"
                  onClick={handleConfirmIssue}
                  disabled={issuing || basketCodes.length === 0 || !canIssue || viewMode === "records"}
                  className="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded transition shadow-sm"
                >
                  {issuing ? "Issuing Packs..." : `Confirm Issue (${basketCodes.length} Packs)`}
                </button>
                <div className="text-[11px] text-gray-500 mt-1 text-center font-urdu" dir="rtl">
                  وارڈ یا تھیٹر کو پیکس کا باضابطہ اجرا کریں (آل اور نتھنگ پالیسی)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Expired / Reprocessing List (Rule 30768e8506) */}
      {activeTab === "expired" && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
            <strong>Hourly Expiry Worker Notice (Rule 30768e8506):</strong> Expired packs are marked by the background worker every hour. These packs, along with any failed or recalled trays, must be collected from wards/OTs and returned to the CSSD decontamination area for repackaging and re-sterilization.
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold border-b">
                <tr>
                  <th className="p-3">Pack Code</th>
                  <th className="p-3">Set Name</th>
                  <th className="p-3">Sterilized On</th>
                  <th className="p-3">Expired On</th>
                  <th className="p-3">Reason / Status</th>
                  <th className="p-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expiredAndCompromised.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      No expired or compromised packs currently in inventory.
                    </td>
                  </tr>
                ) : (
                  expiredAndCompromised.map((p) => (
                    <tr key={p.pack_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="p-3 font-mono font-bold text-red-600">{p.pack_code}</td>
                      <td className="p-3 font-medium">{p.set_name}</td>
                      <td className="p-3 text-xs">{p.sterilized_on}</td>
                      <td className="p-3 text-xs font-mono">{p.expires_on}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200">
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          data-help="cssd_stock.view_pack_button"
                          onClick={() => setInspectedPack(p)}
                          className="px-2.5 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Single Pack Details Inspection (GET /cssd/packs/{pack_code}) */}
      {inspectedPack && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold">Pack Details: {inspectedPack.pack_code}</h3>
                <div className="text-xs text-gray-500 font-medium">{inspectedPack.set_name}</div>
              </div>
              <button
                data-help="cssd_stock.close_pack_modal_button"
                onClick={() => setInspectedPack(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-gray-50 dark:bg-gray-750 rounded">
              <div>
                <span className="text-gray-500 block">Cycle Number:</span>
                <span className="font-mono font-semibold">{inspectedPack.cycle_number}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Pack Status:</span>
                <span className="font-bold">{inspectedPack.status}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Sterilization Date:</span>
                <span>{inspectedPack.sterilized_on}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Expiry Date:</span>
                <span className="font-bold font-mono">{inspectedPack.expires_on}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Issued To:</span>
                <span>{inspectedPack.issued_to_ward_name || inspectedPack.issued_to_ot_name || "CSSD Stock"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Issued By:</span>
                <span>{inspectedPack.issued_by_name || "-"}</span>
              </div>
              {inspectedPack.patient_name && (
                <div className="col-span-2 pt-1 border-t">
                  <span className="text-gray-500 block">Used on Patient:</span>
                  <span className="font-medium">
                    {inspectedPack.patient_name} ({inspectedPack.mrn})
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center border-t pt-3">
              {inspectedPack.status === "Available" && canIssue && (
                <button
                  data-help="cssd_stock.add_to_basket_button"
                  onClick={() => {
                    handleAddPackToBasket(inspectedPack.pack_code);
                    setInspectedPack(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                >
                  + Add to Issue Basket
                </button>
              )}
              <div className="ml-auto">
                <button
                  data-help="cssd_stock.close_pack_modal_button"
                  onClick={() => setInspectedPack(null)}
                  className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
