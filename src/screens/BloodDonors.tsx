import React, { useEffect, useState } from "react";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  DonorOut,
  DonorIn,
  DonorPatch,
  DonorDetailOut,
} from "../generated/blood_donors";
import {
  listDonors,
  getDonor,
} from "../generated/blood_donors";
import {
  evaluateDonorAccessPolicy,
  validateDonorSearchQuery,
  validateDonorRegistration,
  validateDonorCorrection,
  evaluateDonorEligibility,
  type DonorRegistrationInput,
  type DonorCorrectionInput,
} from "../blood-donors-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function BloodDonors({
  user,
  establishment,
  connected,
  stream,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
}) {
  const view = establishment.views.screens.find(
    (s) => s.screen_id === "blood_donors",
  )?.view;
  const access = evaluateDonorAccessPolicy({
    establishmentActive: establishment.active,
    screenView: view,
    permissions: user.permissions,
  });
  const live = connected && stream === "Live";

  // Search state (rule:71bc3f69b3)
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [donors, setDonors] = useState<DonorOut[]>([]);

  // Selected donor detail (rule:d7bf9e8097)
  const [selectedDonorId, setSelectedDonorId] = useState<number | null>(null);
  const [selectedDonor, setSelectedDonor] = useState<DonorDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isCorrectOpen, setIsCorrectOpen] = useState(false);

  // Registration Form (rule:40349aea7e)
  const [regForm, setRegForm] = useState<DonorRegistrationInput>({
    full_name: "",
    sex: "",
    date_of_birth: "",
    id_kind: "CNIC",
    id_number: "",
    phone: "",
    email: "",
    address: "",
  });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  // Correction Form (rule:73b2977f2f)
  const [correctForm, setCorrectForm] = useState<DonorCorrectionInput>({
    expected_version: 1,
    reason: "",
    full_name: "",
    sex: "Male",
    date_of_birth: "",
    id_kind: "CNIC",
    id_number: "",
    phone: "",
    email: "",
    address: "",
  });
  const [correctErrors, setCorrectErrors] = useState<Record<string, string>>({});

  // Clinical write integration
  const write = useClinicalWrite(user, "blood_donors", () => {
    setIsRegisterOpen(false);
    setIsCorrectOpen(false);
    if (selectedDonorId) {
      handleSelectDonor(selectedDonorId);
    }
    if (hasSearched && searchQuery.trim().length >= 2) {
      handleSearch(searchQuery);
    }
  });

  // Handle BLOOD_DONOR_EXISTS error by searching for the existing donor
  useEffect(() => {
    if (write.error && typeof write.error === "object") {
      const err = write.error as any;
      if (err.code === "BLOOD_DONOR_EXISTS") {
        setIsRegisterOpen(false);
        if (regForm.id_number) {
          setSearchQuery(regForm.id_number);
          handleSearch(regForm.id_number);
        }
      }
    }
  }, [write.error]);

  // Search execution
  const handleSearch = async (queryToSearch = searchQuery) => {
    const val = validateDonorSearchQuery(queryToSearch);
    if (!val.valid) {
      setSearchError(val.error ?? "Invalid search query");
      return;
    }
    setSearchError(null);
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await listDonors({ q: queryToSearch.trim(), limit: 50 });
      setDonors(res);
      // If exactly 1 donor found, automatically select them
      if (res.length === 1) {
        handleSelectDonor(res[0].donor_id);
      }
    } catch (err: any) {
      setSearchError(err?.message || "Failed to search blood donors");
      setDonors([]);
    } finally {
      setSearching(false);
    }
  };

  // Fetch detail
  const handleSelectDonor = async (id: number) => {
    setSelectedDonorId(id);
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await getDonor(id);
      setSelectedDonor(res);
    } catch (err: any) {
      setDetailError(err?.message || "Failed to load donor record");
      setSelectedDonor(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open correction modal
  const handleOpenCorrect = (donor: DonorDetailOut) => {
    setCorrectForm({
      expected_version: donor.row_version,
      reason: "",
      full_name: donor.full_name,
      sex: donor.sex,
      date_of_birth: donor.date_of_birth,
      id_kind: donor.id_kind,
      id_number: donor.id_number,
      phone: donor.phone || "",
      email: donor.email || "",
      address: donor.address || "",
    });
    setCorrectErrors({});
    setIsCorrectOpen(true);
  };

  // Submit registration (rule:40349aea7e, rule:5850958062)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!access.canRegister || !live || write.busy) return;

    const val = validateDonorRegistration(regForm);
    if (!val.valid) {
      setRegErrors(val.errors);
      return;
    }
    setRegErrors({});

    const payload: DonorIn = {
      full_name: regForm.full_name.trim(),
      sex: regForm.sex as "Male" | "Female",
      date_of_birth: regForm.date_of_birth,
      id_kind: regForm.id_kind as "CNIC" | "Passport" | "ProofOfRegistration" | "Other",
      id_number: regForm.id_number.trim(),
      phone: regForm.phone?.trim() || null,
      email: regForm.email?.trim() || null,
      address: regForm.address?.trim() || null,
    };

    write.start({
      method: "POST",
      path: "/blood-center/donors",
      body: payload,
      permission: "blood_center.donor.register",
      protection: "idempotent",
      reconcilePath: "/blood-center/donors",
      label: t("Register blood donor", "خون کا عطیہ دہندہ رجسٹر کریں"),
    });
  };

  // Submit correction (rule:73b2977f2f)
  const handleCorrectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonor || !access.canUpdate || !live || write.busy) return;

    const val = validateDonorCorrection(correctForm);
    if (!val.valid) {
      setCorrectErrors(val.errors);
      return;
    }
    setCorrectErrors({});

    const patch: DonorPatch = {
      expected_version: correctForm.expected_version,
      reason: correctForm.reason.trim(),
      full_name: correctForm.full_name?.trim() || null,
      sex: correctForm.sex || null,
      date_of_birth: correctForm.date_of_birth || null,
      id_kind: correctForm.id_kind || null,
      id_number: correctForm.id_number?.trim() || null,
      phone: correctForm.phone?.trim() || null,
      email: correctForm.email?.trim() || null,
      address: correctForm.address?.trim() || null,
    };

    write.start({
      method: "PATCH",
      path: `/blood-center/donors/${selectedDonor.donor_id}`,
      body: patch,
      permission: "blood_center.donor.register",
      protection: "reconcile",
      reconcilePath: `/blood-center/donors/${selectedDonor.donor_id}`,
      label: t("Correct donor particulars", "عطیہ دہندہ کی معلومات درست کریں"),
    });
  };

  // Real-time reactive listener for establishment.changed
  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "establishment.changed") {
        if (hasSearched && searchQuery.trim().length >= 2) {
          handleSearch(searchQuery);
        }
      }
    };
    window.addEventListener("haspataal:event", handleEvent);
    return () => window.removeEventListener("haspataal:event", handleEvent);
  }, [hasSearched, searchQuery]);

  return (
    <div
      className="p-6 max-w-7xl mx-auto space-y-6"
      data-help="blood_donors.screen"
    >
      {/* Retiring / Read-only banners (rule:6a58b93e99) */}
      {access.retiringBannerText && (
        <div
          className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded shadow-sm"
          data-help="blood_donors.retiring_banner"
        >
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-lg">⚠ Service Retiring:</span>
            <span>{access.retiringBannerText}</span>
          </div>
          <p className="text-sm text-amber-700 mt-1">
            Existing donors remain accessible and can be corrected or consulted.
          </p>
        </div>
      )}

      {access.isReadOnly && (
        <div
          className="p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-900 rounded text-sm"
          data-help="blood_donors.records_banner"
        >
          <strong>Records Mode:</strong> Blood center is in records mode. Donor registration is disabled; consultation and corrections remain available.
        </div>
      )}

      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {t("Blood Donors", "خون کے عطیہ دہندگان")}
            </h1>
            <button
              type="button"
              onClick={() => {
                if (hasSearched && searchQuery.trim().length >= 2) handleSearch(searchQuery);
              }}
              className={`px-2 py-0.5 text-xs font-semibold rounded-full border cursor-pointer ${
                live ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-gray-100 text-gray-800 border-gray-300"
              }`}
              data-help="blood_donors.refresh"
              title="Click to refresh donor search results"
            >
              {live ? "● Live Updates" : "Offline / Refresh"}
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {t(
              "Find blood donors or register a donor once for life with an immutable donor number (PBTA Standards ch.2 S.1.1).",
              "خون کے عطیہ دہندگان تلاش کریں یا مستقل ڈونر نمبر کے ساتھ زندگی میں ایک بار رجسٹر کریں (پی بی ٹی اے معیار)۔"
            )}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {access.canRegister && (
            <button
              onClick={() => {
                setRegErrors({});
                setIsRegisterOpen(true);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-md shadow-sm transition-colors text-sm flex items-center space-x-2"
              data-help="blood_donors.register_button"
            >
              <span>+</span>
              <span>{t("Register New Donor", "نیا عطیہ دہندہ رجسٹر کریں")}</span>
            </button>
          )}
        </div>
      </div>

      <ClinicalWriteFeedback write={write} />

      {/* Search Bar - rule:71bc3f69b3: Search first */}
      <div
        className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-3"
        data-help="blood_donors.search_section"
      >
        <div className="flex items-center justify-between">
          <label
            htmlFor="donor-search"
            className="block text-sm font-semibold text-gray-700"
          >
            {t("Search Donors (Search First)", "عطیہ دہندگان تلاش کریں (پہلے تلاش کریں)")}
          </label>
          <span className="text-xs text-gray-500">
            {t("Search by Donor #, CNIC, Phone or Name (min 2 chars)", "ڈونر نمبر، شناختی کارڈ، فون یا نام سے تلاش کریں (کم از کم 2 حروف)")}
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <input
              id="donor-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. 35202-1234567-1, 03001234567, BD-2026-0001, Ahmad"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-rose-500 focus:border-rose-500 text-sm"
              data-help="blood_donors.search_input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchError(null);
                }}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm"
                data-help="blood_donors.search_clear"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-md shadow-sm transition-colors flex items-center justify-center space-x-2"
            data-help="blood_donors.search_button"
          >
            {searching ? (
              <span>{t("Searching...", "تلاش جاری ہے...")}</span>
            ) : (
              <span>🔍 {t("Search", "تلاش")}</span>
            )}
          </button>
        </form>

        {searchError && (
          <p className="text-sm text-rose-600 font-medium" data-help="blood_donors.search_error">
            {searchError}
          </p>
        )}

        <div className="text-xs text-gray-500 flex items-center space-x-1.5 pt-1">
          <span>ℹ</span>
          <span>
            {t(
              "Privacy Notice: There is no unauthenticated list of every donor. Each donor record viewed is logged for audit and regulatory compliance (rule:71bc3f69b3).",
              "رازداری کا نوٹس: عطیہ دہندگان کی کوئی کھلی فہرست نہیں ہے۔ ہر ریکارڈ کا معائنہ ضوابط کے تحت لاگ کیا جاتا ہے۔"
            )}
          </span>
        </div>
      </div>

      {/* Main Grid: Results & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search Results */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">
                {t("Donor Search Results", "تلاش کے نتائج")}
              </h2>
              {hasSearched && (
                <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
                  {donors.length} {t("found", "ملے")}
                </span>
              )}
            </div>

            {!hasSearched ? (
              <div className="p-8 text-center" data-help="blood_donors.prompt_search">
                <span className="text-4xl">🔍</span>
                <p className="text-sm font-medium text-gray-600 mt-2">
                  {t("Search first to find a donor", "عطیہ دہندہ تلاش کرنے کے لیے اوپر تلاش کریں")}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t(
                    "Enter a donor number, CNIC, or mobile number to look up their eligibility.",
                    "اہلیت جانچنے کے لیے ڈونر نمبر یا شناختی کارڈ درج کریں۔"
                  )}
                </p>
              </div>
            ) : searching ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                <LoadState loading={true} error={null} retry={() => handleSearch()} />
              </div>
            ) : donors.length === 0 ? (
              <div className="p-8 text-center" data-help="blood_donors.empty_results">
                <Empty>
                  <p className="text-sm font-medium text-gray-700">
                    {t("No donors found matching your search", "کوئی مماثل عطیہ دہندہ نہیں ملا")}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      "Check for typos, or register this donor once for life.",
                      "املا کی جانچ کریں یا اس عطیہ دہندہ کو نیا رجسٹر کریں۔"
                    )}
                  </p>
                  {access.canRegister && (
                    <button
                      onClick={() => {
                        setRegErrors({});
                        setRegForm((prev) => ({
                          ...prev,
                          id_number: searchQuery.trim(),
                        }));
                        setIsRegisterOpen(true);
                      }}
                      className="mt-3 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 rounded text-xs font-semibold"
                      data-help="blood_donors.empty_register_prompt"
                    >
                      + {t("Register Donor with this ID", "اس شناختی نمبر سے رجسٹر کریں")}
                    </button>
                  )}
                </Empty>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto" data-help="blood_donors.list_table">
                {donors.map((d) => {
                  const elig = evaluateDonorEligibility(d);
                  const isSelected = selectedDonorId === d.donor_id;
                  return (
                    <button
                      type="button"
                      key={d.donor_id}
                      onClick={() => handleSelectDonor(d.donor_id)}
                      className={`w-full text-left p-4 cursor-pointer transition-colors block ${
                        isSelected
                          ? "bg-rose-50 border-l-4 border-rose-600"
                          : "hover:bg-gray-50"
                      }`}
                      data-help="blood_donors.select_donor"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-gray-900 text-sm">
                              {d.full_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({d.sex}, {d.age_years} yrs)
                            </span>
                          </div>
                          <div className="text-xs font-mono text-rose-700 mt-0.5">
                            {d.donor_number}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            elig.statusBadge.variant === "success"
                              ? "bg-emerald-100 text-emerald-800"
                              : elig.statusBadge.variant === "warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {elig.statusBadge.label}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          <strong>{d.id_kind}:</strong> {d.id_number}
                        </span>
                        {d.phone && (
                          <span>
                            <strong>Tel:</strong> {d.phone}
                          </span>
                        )}
                        {d.abo && (
                          <span className="font-semibold text-rose-800">
                            Group: {d.abo} {d.rh === "Positive" ? "+" : "-"}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Donor Detailed Inspection Record */}
        <div className="lg:col-span-7 space-y-4">
          {loadingDetail ? (
            <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
              <LoadState loading={true} error={null} retry={() => selectedDonorId && handleSelectDonor(selectedDonorId)} />
              <p className="text-sm text-gray-500 mt-2">
                {t("Loading donor record & audit history...", "ڈونر کا ریکارڈ لوڈ ہو رہا ہے...")}
              </p>
            </div>
          ) : detailError ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <ErrorBox error={detailError} />
            </div>
          ) : !selectedDonor ? (
            <div
              className="bg-white p-12 rounded-lg border border-dashed border-gray-300 text-center text-gray-500"
              data-help="blood_donors.select_prompt"
            >
              <span className="text-4xl text-gray-300">👤</span>
              <p className="text-sm font-medium mt-2">
                {t("Select a donor from search results to view their full record.", "مکمل تفصیلات دیکھنے کے لیے بائیں جانب سے ڈونر منتخب کریں۔")}
              </p>
            </div>
          ) : (
            <div
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden space-y-6 p-6"
              data-help="blood_donors.detail_card"
            >
              {/* Audit notification banner (rule:d7bf9e8097) */}
              <div
                className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 flex items-center justify-between"
                data-help="blood_donors.audit_notice"
              >
                <span>
                  🔒 <strong>Regulatory Audit:</strong> Opening this donor's record is logged on the server with your staff identity (PBTA Act s.10).
                </span>
                <span className="text-blue-700 font-mono">
                  v{selectedDonor.row_version}
                </span>
              </div>

              {/* Donor Header & Eligibility Badge */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedDonor.full_name}
                    </h2>
                    <span className="text-sm text-gray-500">
                      ({selectedDonor.sex}, {selectedDonor.age_years} {t("years old", "سال")})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm font-semibold text-rose-700 font-mono bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                      {selectedDonor.donor_number}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t("Registered on", "رجسٹرڈ تاریخ")}{" "}
                      {new Date(selectedDonor.registered_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2">
                  {(() => {
                    const elig = evaluateDonorEligibility(selectedDonor);
                    return (
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          elig.statusBadge.variant === "success"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : elig.statusBadge.variant === "warning"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
                        data-help="blood_donors.eligibility_badge"
                      >
                        {elig.statusBadge.label}
                      </span>
                    );
                  })()}

                  {access.canUpdate && (
                    <button
                      onClick={() => handleOpenCorrect(selectedDonor)}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition-colors"
                      data-help="blood_donors.edit_button"
                    >
                      ✏ {t("Correct Particulars", "معلومات درست کریں")}
                    </button>
                  )}
                </div>
              </div>

              {/* Eligibility & Deferral Alert (rule:d7bf9e8097) */}
              {selectedDonor.permanently_deferred ? (
                <div
                  className="p-4 bg-rose-50 border-l-4 border-rose-600 text-rose-900 rounded text-sm"
                  data-help="blood_donors.permanent_deferral_warning"
                >
                  <div className="font-bold text-base flex items-center space-x-2">
                    <span>⛔</span>
                    <span>{t("Permanently Deferred — Never Accept Blood", "مستقل مسترد — کبھی خون قبول نہ کریں")}</span>
                  </div>
                  <p className="mt-1 text-xs text-rose-800">
                    {t(
                      "This donor has a permanent deferral recorded. In accordance with PBTA blood safety standards, no donation can ever be collected from this donor.",
                      "پی بی ٹی اے معیار کے مطابق اس عطیہ دہندہ سے کبھی بھی خون نہیں لیا جا سکتا۔"
                    )}
                  </p>
                </div>
              ) : selectedDonor.deferred_now ? (
                <div
                  className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded text-sm"
                  data-help="blood_donors.temporary_deferral_warning"
                >
                  <div className="font-bold flex items-center space-x-2">
                    <span>⏳</span>
                    <span>{t("Active Temporary Deferral in Force", "عارضی التواء لاگو ہے")}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-800">
                    {t(
                      `Donor cannot donate today. Earliest permitted donation date: ${
                        selectedDonor.may_donate_from || "Pending deferral review"
                      }.`,
                      `ڈونر آج خون نہیں دے سکتے۔ اگلی ممکنہ تاریخ: ${
                        selectedDonor.may_donate_from || "زیر التواء"
                      }`
                    )}
                  </p>
                </div>
              ) : (
                <div
                  className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 rounded text-sm flex items-center justify-between"
                  data-help="blood_donors.eligible_notice"
                >
                  <div>
                    <span className="font-bold">✓ {t("Eligible to Donate", "عطیہ دینے کے اہل ہیں")}</span>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {t("No active deferrals in force.", "کوئی التواء لاگو نہیں ہے۔")}
                    </p>
                  </div>
                </div>
              )}

              {/* Demographics & Clinical Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-lg text-xs">
                <div>
                  <span className="text-gray-500 block">{t("Identification", "شناخت")}</span>
                  <span className="font-semibold text-gray-800 block mt-0.5">
                    {selectedDonor.id_kind}: {selectedDonor.id_number}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t("Blood Group", "بلڈ گروپ")}</span>
                  <span className="font-bold text-rose-700 text-sm block mt-0.5">
                    {selectedDonor.abo ? `${selectedDonor.abo} ${selectedDonor.rh === "Positive" ? "Rh+" : "Rh-"}` : "Not Tested Yet"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t("Total Donations", "کل عطیات")}</span>
                  <span className="font-semibold text-gray-800 block mt-0.5">
                    {selectedDonor.donations_collected ?? 0} {t("times", "بار")}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t("Last Donated", "آخری عطیہ")}</span>
                  <span className="font-semibold text-gray-800 block mt-0.5">
                    {selectedDonor.last_collected_at
                      ? new Date(selectedDonor.last_collected_at).toLocaleDateString()
                      : "Never"}
                  </span>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-1 text-xs">
                <h3 className="font-semibold text-gray-700 text-sm">
                  {t("Contact Details", "رابطہ کی تفصیلات")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white border border-gray-200 p-3 rounded">
                  <div>
                    <span className="text-gray-500 block">{t("Phone / Mobile", "فون / موبائل")}</span>
                    <span className="font-medium text-gray-800">
                      {selectedDonor.phone || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">{t("Email Address", "ای میل")}</span>
                    <span className="font-medium text-gray-800">
                      {selectedDonor.email || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">{t("Postal Address", "پتہ")}</span>
                    <span className="font-medium text-gray-800">
                      {selectedDonor.address || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deferrals Log (rule:d7bf9e8097) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">
                    {t("Deferral History", "التواء کی تاریخ")}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {selectedDonor.deferrals.length} {t("records", "ریکارڈز")}
                  </span>
                </div>

                {selectedDonor.deferrals.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded border border-gray-100">
                    {t("No deferral records on file for this donor.", "اس عطیہ دہندہ کے لیے کوئی التواء درج نہیں ہے۔")}
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Type", "قسم")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Reason", "وجہ")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Dates", "تواریخ")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Decided By", "فیصلہ کن")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Status", "حیثیت")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {selectedDonor.deferrals.map((def) => (
                          <tr key={def.deferral_id}>
                            <td className="px-3 py-2 font-medium">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  def.kind === "Permanent"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {def.kind}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-800">{def.reason}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {def.deferred_from}
                              {def.deferred_until ? ` to ${def.deferred_until}` : " (Permanent)"}
                            </td>
                            <td className="px-3 py-2 text-gray-500 font-mono text-[11px]">
                              {def.decided_stamp?.text || "—"}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              {def.in_force ? (
                                <span className="text-amber-700">● In Force</span>
                              ) : (
                                <span className="text-gray-400">Expired / Revoked</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Past Donations Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">
                    {t("Donation History", "عطیات کی تاریخ")}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {selectedDonor.donations.length} {t("donations", "عطیات")}
                  </span>
                </div>

                {selectedDonor.donations.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded border border-gray-100">
                    {t("No blood donations collected yet.", "ابھی تک کوئی عطیہ خون وصول نہیں کیا گیا۔")}
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Donation #", "عطیہ نمبر")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Date", "تاریخ")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Venue", "مقام")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Hb", "ایچ بی")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Volume", "مقدار")}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            {t("Status", "حیثیت")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {selectedDonor.donations.map((don) => (
                          <tr key={don.donation_id}>
                            <td className="px-3 py-2 font-mono font-medium text-rose-700">
                              {don.donation_number}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {new Date(don.attended_at).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{don.venue}</td>
                            <td className="px-3 py-2 text-gray-800">{don.hb_g_dl} g/dL</td>
                            <td className="px-3 py-2 text-gray-800">
                              {don.volume_ml ? `${don.volume_ml} mL` : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  don.status === "Cleared"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : don.status === "Reactive" || don.status === "Rejected"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {don.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Register New Donor (rule:40349aea7e, rule:5850958062) */}
      {isRegisterOpen && (
        <Modal
          title={t("Register Blood Donor (Once for Life)", "خون کا عطیہ دہندہ رجسٹر کریں (زندگی میں ایک بار)")}
          onClose={() => setIsRegisterOpen(false)}
        >
          <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto p-1 text-sm" data-help="blood_donors.modal_register">
            <div className="p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded text-xs">
              <strong>PBTA Standard S.1.1.1:</strong> A blood donor is registered once for life. If already registered, the existing donor record will be opened instead.
            </div>

            <Field label={t("Full Name *", "پورا نام *")} hint={regErrors.full_name}>
              <input
                type="text"
                value={regForm.full_name}
                onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                placeholder="Donor full legal name"
                className="w-full px-3 py-2 border rounded-md text-sm"
                data-help="blood_donors.form_name"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Sex *", "جنس *")} hint={regErrors.sex}>
                <select
                  value={regForm.sex}
                  onChange={(e) => setRegForm({ ...regForm, sex: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-help="blood_donors.form_sex"
                >
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>

              <Field label={t("Date of Birth *", "تاریخ پیدائش *")} hint={regErrors.date_of_birth}>
                <input
                  type="date"
                  value={regForm.date_of_birth}
                  onChange={(e) => setRegForm({ ...regForm, date_of_birth: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-help="blood_donors.form_dob"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("ID Kind *", "شناخت کی قسم *")} hint={regErrors.id_kind}>
                <select
                  value={regForm.id_kind}
                  onChange={(e) => setRegForm({ ...regForm, id_kind: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-help="blood_donors.form_id_kind"
                >
                  <option value="CNIC">CNIC</option>
                  <option value="Passport">Passport</option>
                  <option value="ProofOfRegistration">Proof of Registration (Refugee)</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label={t("ID Number *", "شناختی نمبر *")} hint={regErrors.id_number}>
                <input
                  type="text"
                  value={regForm.id_number}
                  onChange={(e) => setRegForm({ ...regForm, id_number: e.target.value })}
                  placeholder="e.g. 35202-1234567-1"
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                  data-help="blood_donors.form_id_number"
                />
              </Field>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <span className="text-xs font-semibold text-gray-700 block mb-2">
                {t("Contact Information (At least one required) *", "رابطہ کی تفصیلات (کم از کم ایک لازمی) *")}
              </span>
              {regErrors.contact && (
                <p className="text-xs text-rose-600 font-medium mb-2">{regErrors.contact}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("Mobile / Phone", "موبائل نمبر")}>
                  <input
                    type="tel"
                    value={regForm.phone || ""}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    data-help="blood_donors.form_phone"
                  />
                </Field>

                <Field label={t("Email", "ای میل")}>
                  <input
                    type="email"
                    value={regForm.email || ""}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="donor@example.com"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    data-help="blood_donors.form_email"
                  />
                </Field>
              </div>

              <div className="mt-3">
                <Field label={t("Residential Address", "رہائشی پتہ")}>
                  <textarea
                    value={regForm.address || ""}
                    onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                    rows={2}
                    placeholder="Street, City, District"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    data-help="blood_donors.form_address"
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                data-help="blood_donors.modal_register_cancel"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                disabled={write.busy}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-md text-sm shadow-sm"
                data-help="blood_donors.modal_register_submit"
              >
                {write.busy ? t("Registering...", "رجسٹریشن جاری ہے...") : t("Register Donor", "ڈونر رجسٹر کریں")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Correct Particulars (rule:73b2977f2f) */}
      {isCorrectOpen && selectedDonor && (
        <Modal
          title={t(`Correct Particulars: ${selectedDonor.donor_number}`, `معلومات درست کریں: ${selectedDonor.donor_number}`)}
          onClose={() => setIsCorrectOpen(false)}
        >
          <form onSubmit={handleCorrectSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto p-1 text-sm" data-help="blood_donors.modal_correct">
            <div className="p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-900 rounded text-xs">
              <strong>Audit Notice:</strong> The donor number never changes (rule:73b2977f2f). Every correction is versioned and logged.
            </div>

            <Field label={t("Mandatory Reason for Correction *", "درستگی کی لازمی وجہ *")} hint={correctErrors.reason}>
              <input
                type="text"
                value={correctForm.reason}
                onChange={(e) => setCorrectForm({ ...correctForm, reason: e.target.value })}
                placeholder="e.g. Corrected typo in CNIC or spelling of name"
                className="w-full px-3 py-2 border rounded-md text-sm"
                data-help="blood_donors.form_correct_reason"
              />
            </Field>

            <Field label={t("Full Name", "پورا نام")} hint={correctErrors.full_name}>
              <input
                type="text"
                value={correctForm.full_name || ""}
                onChange={(e) => setCorrectForm({ ...correctForm, full_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                data-help="blood_donors.form_correct_name"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Sex", "جنس")}>
                <select
                  value={correctForm.sex || "Male"}
                  onChange={(e) => setCorrectForm({ ...correctForm, sex: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-help="blood_donors.form_correct_sex"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>

              <Field label={t("Date of Birth", "تاریخ پیدائش")}>
                <input
                  type="date"
                  value={correctForm.date_of_birth || ""}
                  onChange={(e) => setCorrectForm({ ...correctForm, date_of_birth: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-help="blood_donors.form_correct_dob"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("ID Kind", "شناخت کی قسم")}>
                <select
                  value={correctForm.id_kind || "CNIC"}
                  onChange={(e) => setCorrectForm({ ...correctForm, id_kind: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-help="blood_donors.form_correct_id_kind"
                >
                  <option value="CNIC">CNIC</option>
                  <option value="Passport">Passport</option>
                  <option value="ProofOfRegistration">Proof of Registration</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label={t("ID Number", "شناختی نمبر")} hint={correctErrors.id_number}>
                <input
                  type="text"
                  value={correctForm.id_number || ""}
                  onChange={(e) => setCorrectForm({ ...correctForm, id_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                  data-help="blood_donors.form_correct_id_number"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Phone / Mobile", "فون")}>
                <input
                  type="tel"
                  value={correctForm.phone || ""}
                  onChange={(e) => setCorrectForm({ ...correctForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-help="blood_donors.form_correct_phone"
                />
              </Field>

              <Field label={t("Email", "ای میل")}>
                <input
                  type="email"
                  value={correctForm.email || ""}
                  onChange={(e) => setCorrectForm({ ...correctForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-help="blood_donors.form_correct_email"
                />
              </Field>
            </div>

            <Field label={t("Residential Address", "رہائشی پتہ")}>
              <textarea
                value={correctForm.address || ""}
                onChange={(e) => setCorrectForm({ ...correctForm, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-md text-sm"
                data-help="blood_donors.form_correct_address"
              />
            </Field>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsCorrectOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                data-help="blood_donors.modal_correct_cancel"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                disabled={write.busy}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm shadow-sm"
                data-help="blood_donors.modal_correct_submit"
              >
                {write.busy ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Correction", "درستگی محفوظ کریں")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
