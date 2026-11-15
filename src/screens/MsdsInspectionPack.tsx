import React, { useState, useEffect } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import { call, api } from "../bridge";
import {
  inspectionPack,
  getProfile,
  getPrefs,
  requestPackExport,
  getPackExport,
  registerParts,
  searchPatients,
  InspectionPackOut,
  PackDocumentOut,
  MsdsProfileOut,
  MsdsPackExportOut,
  RegisterPartsOut,
  RegisterPartOut,
  PatientSearchHitOut,
} from "../generated/msds_inspection_pack";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
  screenId?: string;
  combined?: boolean;
};

type FrameworkCategory = "Clinic" | "IIC" | "IIB" | "IIA" | "I";

function cleanPdfPath(url: string): string {
  if (url.startsWith("/api/v1")) {
    return url.substring("/api/v1".length);
  }
  return url;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MsdsInspectionPack({
  revision,
  user,
  onOpenHelp,
  connected,
  screenId = "msds_inspection_pack",
  combined: initialCombined = false,
}: Props) {
  // Default date range: last 90 days to today
  const today = new Date();
  const past90 = new Date();
  past90.setDate(today.getDate() - 90);

  const [dateFrom, setDateFrom] = useState<string>(formatDate(past90));
  const [dateTo, setDateTo] = useState<string>(formatDate(today));
  const [selectedCategory, setSelectedCategory] = useState<FrameworkCategory>("IIB");
  const [localRevision, setLocalRevision] = useState(0);

  // Preference for download mode (Separate vs Combined)
  const [downloadMode, setDownloadMode] = useState<"Separate" | "Combined">(
    initialCombined ? "Combined" : "Separate"
  );
  const [updatingPref, setUpdatingPref] = useState(false);

  // Search & Filters for document rows
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("ALL");
  const [stateFilter, setStateFilter] = useState<string>("ALL");

  // Combined Pack Export state
  const [activeExport, setActiveExport] = useState<MsdsPackExportOut | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Individual document download feedback/errors: map of doc.key -> reason/notice
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  // Patient register parts state
  const [patientRegisterParts, setPatientRegisterParts] = useState<RegisterPartsOut | null>(null);
  const [loadingParts, setLoadingParts] = useState(false);

  // Selected Records (surveyor's sample: 1-25 patients)
  const [sampleSearchQuery, setSampleSearchQuery] = useState("");
  const [sampleSearchResults, setSampleSearchResults] = useState<PatientSearchHitOut[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<PatientSearchHitOut[]>([]);
  const [downloadingSample, setDownloadingSample] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  // Profile data
  const profileLoad = useLoad(() => getProfile(), [revision, localRevision]);
  const profile = profileLoad.data;

  // Sync confirmed category from profile on first load
  useEffect(() => {
    if (profile?.category) {
      setSelectedCategory(profile.category as FrameworkCategory);
    }
  }, [profile?.category]);

  // Preferences load
  const prefsLoad = useLoad(() => getPrefs(), [revision, localRevision]);
  useEffect(() => {
    if (prefsLoad.data?.pdf_download) {
      setDownloadMode(prefsLoad.data.pdf_download);
    }
  }, [prefsLoad.data?.pdf_download]);

  // Inspection pack documents load
  const packLoad = useLoad(
    () =>
      inspectionPack({
        category: selectedCategory,
        date_from: dateFrom,
        date_to: dateTo,
      }),
    [selectedCategory, dateFrom, dateTo, revision, localRevision]
  );
  const packData = packLoad.data;

  // Sync download_mode if returned in pack response
  useEffect(() => {
    if (packData?.download_mode) {
      setDownloadMode(packData.download_mode);
    }
  }, [packData?.download_mode]);

  // Load patient register parts whenever date range changes (hospital staff only; omit for inspector per rule:fd814af39b)
  useEffect(() => {
    if (screenId === "msds_inspection_pack_inspector") return;
    let active = true;
    async function fetchParts() {
      try {
        setLoadingParts(true);
        const res = await registerParts({ date_from: dateFrom, date_to: dateTo });
        if (active) setPatientRegisterParts(res);
      } catch (err) {
        console.error("Failed to load patient register parts:", err);
      } finally {
        if (active) setLoadingParts(false);
      }
    }
    fetchParts();
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, revision, localRevision, screenId]);

  // Poll active combined export if Queued
  useEffect(() => {
    if (!activeExport || activeExport.status !== "Queued") return;
    const interval = setInterval(async () => {
      try {
        const updated = await getPackExport(activeExport.export_id);
        setActiveExport(updated);
        if (updated.status !== "Queued") {
          setExporting(false);
        }
      } catch (err) {
        console.error("Failed to poll pack export:", err);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeExport]);

  // Search patients debounced (hospital staff only; omit for inspector per rule:fd814af39b)
  useEffect(() => {
    if (screenId === "msds_inspection_pack_inspector") return;
    if (!sampleSearchQuery.trim()) {
      setSampleSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchingPatients(true);
        const hits = await searchPatients({ q: sampleSearchQuery.trim(), limit: 10 });
        setSampleSearchResults(hits);
      } catch (err) {
        console.error("Patient search failed:", err);
      } finally {
        setSearchingPatients(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [sampleSearchQuery]);

  // Toggle user download preference (PUT /settings/me)
  const handleTogglePreference = async () => {
    const nextMode = downloadMode === "Separate" ? "Combined" : "Separate";
    try {
      setUpdatingPref(true);
      await api("PUT", "/settings/me", { pdf_download: nextMode });
      setDownloadMode(nextMode);
      setLocalRevision((r) => r + 1);
    } catch (err) {
      console.error("Failed to update PDF download preference:", err);
    } finally {
      setUpdatingPref(false);
    }
  };

  // Start Combined Export
  const handleStartCombinedExport = async () => {
    try {
      setExporting(true);
      setExportError(null);
      const res = await requestPackExport({
        category: selectedCategory,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setActiveExport(res);
      if (res.status === "Ready") {
        setExporting(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportError(msg);
      setExporting(false);
    }
  };

  // Download a single document PDF via Electron bridge
  const handleDownloadPdf = async (docKey: string, rawUrl: string, preview: boolean) => {
    try {
      setDownloadingDoc(docKey);
      setDownloadNotice(null);
      const path = cleanPdfPath(rawUrl);
      const res = await call("clinical-pdf", { path, preview });
      setDownloadErrors((prev) => {
        const copy = { ...prev };
        delete copy[docKey];
        return copy;
      });
      setDownloadNotice(
        preview
          ? t("Document opened in viewer.", "دستاویز پی ڈی ایف ویور میں کھولی گئی۔")
          : res.saved
          ? t("Document PDF saved.", "دستاویز پی ڈی ایف محفوظ ہو گئی۔")
          : t("Document save cancelled.", "دستاویز محفوظ کرنا منسوخ۔")
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDownloadErrors((prev) => ({ ...prev, [docKey]: msg }));
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Download Selected Records PDF (rule:65bf4a5335)
  const handleDownloadSelectedRecords = async (preview: boolean) => {
    if (selectedPatients.length === 0 || selectedPatients.length > 25) return;
    try {
      setDownloadingSample(true);
      setSampleError(null);
      const queryParams = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
      });
      selectedPatients.forEach((p) => queryParams.append("patient_id", String(p.patient_id)));
      const path = `/msds/selected-records/pdf?${queryParams.toString()}`;
      const res = await call("clinical-pdf", { path, preview });
      setDownloadNotice(
        preview
          ? t("Surveyor sample opened in viewer.", "سیمپل ریکارڈ ویور میں کھولا گیا۔")
          : res.saved
          ? t("Surveyor sample PDF saved.", "سیمپل ریکارڈ پی ڈی ایف محفوظ ہو گئی۔")
          : t("Save cancelled.", "محفوظ کرنا منسوخ۔")
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSampleError(msg);
    } finally {
      setDownloadingSample(false);
    }
  };

  // Check period length (max 366 days, rule:3e0597139f)
  const fromTime = new Date(dateFrom).getTime();
  const toTime = new Date(dateTo).getTime();
  const daysDiff = Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24));
  const periodTooLong = daysDiff > 366;

  // Filtered documents list
  const isInspector = screenId === "msds_inspection_pack_inspector";
  const documents = packData?.documents || [];
  const filteredDocuments = documents.filter((doc) => {
    // rule:fbd3233cbe: The inspector's pack leaves out the hospital's internal preparation (the self-assessment, the training and personnel-file gap lists): do not mention them.
    if (isInspector) {
      if (
        doc.key === "self_assessment" ||
        doc.key.includes("self_assessment") ||
        doc.key.includes("gap")
      ) {
        return false;
      }
    }
    if (kindFilter !== "ALL" && doc.kind !== kindFilter) return false;
    if (stateFilter !== "ALL" && doc.state !== stateFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchAbout = doc.about.toLowerCase().includes(q);
      const matchInd = doc.indicators.some((ind) => String(ind).includes(q));
      if (!matchTitle && !matchAbout && !matchInd) return false;
    }
    return true;
  });

  return (
    <section data-screen={screenId}>
      {/* Top Toolbar */}
      <header
        className="toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>
            {isInspector
              ? t("PHC inspection pack (inspector)", "پنجاب ہیلتھ کیئر کمیشن معائنہ دستاویزات (انسپکٹر)")
              : t("PHC inspection pack", "پنجاب ہیلتھ کیئر کمیشن معائنہ دستاویزات")}
          </h1>

          {/* Framework Category Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="pack-category-select" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
              {t("Category:", "کیٹیگری:")}
            </label>
            <select
              id="pack-category-select"
              data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.filter" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.filter" : "msds_inspection_pack.filter"}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as FrameworkCategory)}
              style={{ padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}
            >
              <option value="Clinic">{t("Clinic", "کلینک")}</option>
              <option value="IIC">{t("Category II C", "کیٹیگری 2 سی")}</option>
              <option value="IIB">{t("Category II B", "کیٹیگری 2 بی")}</option>
              <option value="IIA">{t("Category II A", "کیٹیگری 2 اے")}</option>
              <option value="I">{t("Category I", "کیٹیگری 1")}</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Download Mode Toggle (rule:072826b187) */}
          <button
            type="button"
            className="secondary"
            data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.filter" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.filter" : "msds_inspection_pack.filter"}
            onClick={handleTogglePreference}
            disabled={updatingPref || !connected}
            title={t(
              "Toggle PDF download mode preference (Separate files vs Combined inspection pack PDF)",
              "پی ڈی ایف ڈاؤن لوڈ طریقہ کار تبدیل کریں (علیحدہ فائلیں بمقابلہ مشترکہ فائل)"
            )}
            style={{ fontSize: "0.85rem" }}
          >
            {t("Download Mode:", "ڈاؤن لوڈ موڈ:")}{" "}
            <strong>
              {downloadMode === "Separate"
                ? t("Separate PDFs", "علیحدہ فائلیں")
                : t("Combined PDF", "مشترکہ فائل")}
            </strong>
          </button>

          <button
            type="button"
            className="secondary"
            data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.filter" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.filter" : "msds_inspection_pack.filter"}
            onClick={() => setLocalRevision((r) => r + 1)}
            disabled={!connected}
          >
            {t("Refresh", "تازہ کریں")}
          </button>

          <button
            type="button"
            data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.help" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.help" : "msds_inspection_pack.help"}
            onClick={onOpenHelp}
          >
            {t("Help", "مدد")}
          </button>
        </div>
      </header>

      {/* Category confirmation & Registration Banner */}
      {profile && (
        <div
          className="card"
          style={{
            background: profile.needs_confirmation ? "#fff3cd" : "#f0f7ff",
            color: profile.needs_confirmation ? "#856404" : "#004085",
            padding: "10px 14px",
            marginBottom: "12px",
            borderLeft: `4px solid ${profile.needs_confirmation ? "#ffeeba" : "#b8daff"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <strong>{t("Hospital PHC Licence:", "ہسپتال لائسنس:")} </strong>
            <span>
              {profile.category_label || selectedCategory} • {t("Registration:", "رجسٹریشن:")}{" "}
              <code>{profile.registration_number || t("Not confirmed", "غیر تصدیق شدہ")}</code>
            </span>
            {profile.suggestion && (
              <span style={{ marginLeft: "12px", color: "#495057" }}>
                ({profile.suggestion.beds} {t("inpatient beds", "ان ڈور بیڈز")})
              </span>
            )}
          </div>
          {profile.needs_confirmation && (
            <div style={{ fontWeight: "bold" }}>
              ⚠️{" "}
              {t(
                "Ask the Hospital Admin to record the PHC category (Facility settings).",
                "ہسپتال ایڈمن سے کہیں کہ فیسیلٹی ترتیبات میں کیٹیگری کی تصدیق کریں۔"
              )}
            </div>
          )}
        </div>
      )}

      {/* Date Range Picker (rule:3e0597139f) */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          marginBottom: "14px",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="pack-date-from" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
            {t("Inspection Period From:", "معائنے کا آغاز:")}
          </label>
          <input
            id="pack-date-from"
            type="date"
            data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.filter" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.filter" : "msds_inspection_pack.filter"}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "4px 8px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="pack-date-to" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
            {t("To:", "اختتام:")}
          </label>
          <input
            id="pack-date-to"
            type="date"
            data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.filter" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.filter" : "msds_inspection_pack.filter"}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "4px 8px" }}
          />
        </div>

        <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
          {t(
            "Period applies to registers and reports; policies print as of today (max 366 days).",
            "مدت رجسٹروں اور رپورٹوں پر لاگو ہوتی ہے؛ پالیسیاں موجودہ تاریخ کے مطابق پرنٹ ہوتی ہیں۔"
          )}
        </span>

        {periodTooLong && (
          <div style={{ color: "#dc3545", fontWeight: "bold", fontSize: "0.85rem", width: "100%" }}>
            ⚠️{" "}
            {t(
              "Selected period exceeds statutory 366-day limit. Please shorten date range.",
              "منتخب کردہ مدت 366 دن کی قانونی حد سے زیادہ ہے۔ براہ کرم تاریخیں درست کریں۔"
            )}
          </div>
        )}
      </div>

      {/* Combined Export Banner (rule:072826b187, rule:dc4c2f86a3) */}
      {downloadMode === "Combined" && (
        <div
          className="card"
          style={{
            padding: "14px 18px",
            marginBottom: "14px",
            background: "#e8f4f8",
            border: "1px solid #b8dae4",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "1.1rem" }}>
              📦 {t("Combined PHC Inspection Pack", "مشترکہ پی ایچ سی معائنہ پیک")}
            </h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#495057" }}>
              {t(
                "Builds every permitted policy, register, and report into a single indexed PDF with a table of contents.",
                "تمام پالیسیوں، رجسٹروں اور رپورٹس کو ایک ہی انڈیکس شدہ پی ڈی ایف دستاویز میں تیار کرتا ہے۔"
              )}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {exporting || (activeExport && activeExport.status === "Queued") ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="spinner" aria-hidden="true" />
                <button
                  type="button"
                  data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                  disabled
                  style={{ opacity: 0.7 }}
                >
                  {t("Preparing combined inspection pack…", "مشترکہ پیک تیار ہو رہا ہے…")}
                </button>
              </div>
            ) : activeExport && activeExport.status === "Ready" && activeExport.download_url ? (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                  onClick={() =>
                    handleDownloadPdf("combined_pack", activeExport.download_url!, false)
                  }
                  disabled={!connected}
                  style={{ background: "#28a745", color: "#fff", borderColor: "#28a745" }}
                >
                  📥 {t("Download Pack PDF", "پیک پی ڈی ایف ڈاؤن لوڈ")} (
                  {activeExport.size_bytes
                    ? `${(activeExport.size_bytes / 1024).toFixed(0)} KB`
                    : "PDF"}
                  )
                </button>
                <button
                  type="button"
                  className="secondary"
                  data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                  onClick={() =>
                    handleDownloadPdf("combined_pack", activeExport.download_url!, true)
                  }
                  disabled={!connected}
                >
                  {t("Preview", "دیکھیں")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                  onClick={handleStartCombinedExport}
                  disabled={!connected || periodTooLong}
                >
                  🔄 {t("Rebuild", "دوبارہ بنائیں")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                onClick={handleStartCombinedExport}
                disabled={exporting || !connected || periodTooLong}
                style={{ padding: "8px 16px", fontWeight: "bold" }}
              >
                📥 {t("Download the inspection pack", "معائنہ پیک تیار کریں")}
              </button>
            )}
          </div>
          {exportError && (
            <div style={{ color: "#dc3545", width: "100%", fontSize: "0.85rem" }}>
              {exportError}
            </div>
          )}
        </div>
      )}

      {/* Global Notice Banner */}
      {downloadNotice && (
        <div
          role="status"
          style={{
            background: "#d4edda",
            color: "#155724",
            padding: "8px 14px",
            borderRadius: "4px",
            marginBottom: "12px",
            fontSize: "0.9rem",
          }}
        >
          {downloadNotice}
        </div>
      )}

      {/* Loading & Error States */}
      <LoadState {...packLoad} retry={packLoad.reload} />

      {packData && (
        <>
          {/* Documents Search & Filters */}
          <div
            className="toolbar"
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
              background: "#f8f9fa",
              padding: "8px 12px",
              borderRadius: "4px",
              marginBottom: "14px",
            }}
          >
            <div style={{ flex: 1, minWidth: "200px" }}>
              <input
                type="search"
                data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.filter" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.filter" : "msds_inspection_pack.filter"}
                placeholder={t("Search documents by title, kind, or indicator...", "دستاویزات تلاش کریں...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "5px 8px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{t("Kind:", "قسم:")}</label>
              <select
                data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.filter" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.filter" : "msds_inspection_pack.filter"}
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                style={{ padding: "4px 8px" }}
              >
                <option value="ALL">{t("All Kinds", "تمام اقسام")}</option>
                <option value="Policy">{t("Policy", "پالیسی")}</option>
                <option value="Register">{t("Register", "رجسٹر")}</option>
                <option value="Report">{t("Report", "رپورٹ")}</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{t("Status:", "حالت:")}</label>
              <select
                data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.filter" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.filter" : "msds_inspection_pack.filter"}
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                style={{ padding: "4px 8px" }}
              >
                <option value="ALL">{t("All States", "تمام حالتیں")}</option>
                <option value="Ready">{t("Ready (Green)", "تیار (سبز)")}</option>
                <option value="Attention">{t("Attention (Amber)", "توجہ طلب (پیلے)")}</option>
                <option value="NotReady">{t("Not Ready (Red)", "غیر تیار (سرخ)")}</option>
              </select>
            </div>
          </div>

          {/* Documents Table (rule:26b1420bd0, rule:33849e8f0d) */}
          <div style={{ overflowX: "auto", marginBottom: "20px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ background: "#e9ecef", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>
                  <th style={{ padding: "10px 12px", width: "40px", textAlign: "center" }}>{t("State", "حالت")}</th>
                  <th style={{ padding: "10px 12px" }}>{t("Document Title", "دستاویز کا عنوان")}</th>
                  <th style={{ padding: "10px 12px", width: "100px" }}>{t("Kind", "قسم")}</th>
                  <th style={{ padding: "10px 12px", width: "130px" }}>{t("Scope", "دائرہ کار")}</th>
                  <th style={{ padding: "10px 12px", width: "150px" }}>{t("Indicators", "انڈیکیٹرز")}</th>
                  <th style={{ padding: "10px 12px", width: "220px", textAlign: "right" }}>{t("Actions", "کارروائی")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => {
                  const stateColor =
                    doc.state === "Ready" ? "#28a745" : doc.state === "Attention" ? "#ffc107" : "#dc3545";
                  const isPatientRegister = doc.key === "patient_record_register";
                  const docError = downloadErrors[doc.key];

                  return (
                    <tr
                      key={doc.key}
                      style={{
                        borderBottom: "1px solid #e9ecef",
                        background: !doc.allowed ? "#f8f9fa" : "#ffffff",
                        opacity: !doc.allowed ? 0.65 : 1,
                      }}
                    >
                      {/* State Dot (rule:26b1420bd0) */}
                      <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top" }}>
                        <span
                          title={doc.detail || doc.state}
                          style={{
                            display: "inline-block",
                            width: "14px",
                            height: "14px",
                            borderRadius: "50%",
                            backgroundColor: stateColor,
                            marginTop: "3px",
                          }}
                        />
                      </td>

                      {/* Title & Description */}
                      <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "bold", color: !doc.allowed ? "#6c757d" : "#212529" }}>
                          {doc.title}
                        </div>
                        {doc.about && (
                          <div style={{ fontSize: "0.8rem", color: "#6c757d", marginTop: "2px" }}>
                            {doc.about}
                          </div>
                        )}
                        {/* Inline Detail Notice */}
                        {doc.detail && (
                          <div style={{ fontSize: "0.75rem", color: "#495057", marginTop: "2px", fontStyle: "italic" }}>
                            ℹ️ {doc.detail}
                          </div>
                        )}
                        {/* Download error / reason (rule:bf04bf5e85) */}
                        {docError && (
                          <div style={{ fontSize: "0.8rem", color: "#dc3545", marginTop: "4px", fontWeight: "bold" }}>
                            ⚠️ {docError}
                          </div>
                        )}
                      </td>

                      {/* Kind Badge */}
                      <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            background:
                              doc.kind === "Policy" ? "#e3f2fd" : doc.kind === "Register" ? "#e8f5e9" : "#fff3e0",
                            color:
                              doc.kind === "Policy" ? "#0d47a1" : doc.kind === "Register" ? "#1b5e20" : "#e65100",
                          }}
                        >
                          {doc.kind}
                        </span>
                      </td>

                      {/* Scope Badge */}
                      <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: "0.8rem", color: "#495057" }}>
                        {doc.period ? t("Period: 90 days", "مدت: 90 دن") : t("As of today", "آج کے مطابق")}
                      </td>

                      {/* Indicators Evidenced */}
                      <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                        {doc.indicators.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {doc.indicators.slice(0, 5).map((num) => (
                              <span
                                key={num}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "1px 5px",
                                  background: "#e9ecef",
                                  borderRadius: "3px",
                                }}
                              >
                                MSDS {num}
                              </span>
                            ))}
                            {doc.indicators.length > 5 && (
                              <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                                +{doc.indicators.length - 5}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "#adb5bd" }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "10px 12px", verticalAlign: "top", textAlign: "right" }}>
                        {!doc.allowed ? (
                          <div style={{ fontSize: "0.75rem", color: "#dc3545" }}>
                            {t("Needs one of: ", "ضروری اجازت: ")}
                            {doc.required_permissions.join(", ")}
                          </div>
                        ) : isPatientRegister && !isInspector ? (
                          // Patient register parts (rule:5951fe09b2)
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                            {loadingParts ? (
                              <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>
                                {t("Loading register parts...", "رجسٹر پارٹس لوڈ ہو رہے ہیں...")}
                              </span>
                            ) : patientRegisterParts?.parts && patientRegisterParts.parts.length > 1 ? (
                              patientRegisterParts.parts.map((p) => (
                                <div key={p.part} style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                  <span style={{ fontSize: "0.75rem", color: "#495057" }}>
                                    {t(`Part ${p.part} of ${patientRegisterParts.parts.length}`, `حصہ ${p.part} از ${patientRegisterParts.parts.length}`)} ({p.entries})
                                  </span>
                                  <button
                                    type="button"
                                    data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                                    style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                    onClick={() => handleDownloadPdf(`${doc.key}_part_${p.part}`, p.pdf_url, false)}
                                    disabled={downloadingDoc === `${doc.key}_part_${p.part}` || !connected}
                                  >
                                    📥 {t("Download", "ڈاؤن لوڈ")}
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                                    style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                    onClick={() => handleDownloadPdf(`${doc.key}_part_${p.part}`, p.pdf_url, true)}
                                    disabled={downloadingDoc === `${doc.key}_part_${p.part}` || !connected}
                                  >
                                    {t("Preview", "دیکھیں")}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div style={{ display: "flex", gap: "4px" }}>
                                <button
                                  type="button"
                                  data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                                  style={{ fontSize: "0.8rem", padding: "3px 8px" }}
                                  onClick={() => handleDownloadPdf(doc.key, doc.pdf_url, false)}
                                  disabled={downloadingDoc === doc.key || !connected}
                                >
                                  📥 {t("Download PDF", "ڈاؤن لوڈ")}
                                </button>
                                <button
                                  type="button"
                                  className="secondary"
                                  data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                                  style={{ fontSize: "0.8rem", padding: "3px 8px" }}
                                  onClick={() => handleDownloadPdf(doc.key, doc.pdf_url, true)}
                                  disabled={downloadingDoc === doc.key || !connected}
                                >
                                  {t("Preview", "دیکھیں")}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Standard document actions
                          <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                              style={{ fontSize: "0.8rem", padding: "3px 8px" }}
                              onClick={() => handleDownloadPdf(doc.key, doc.pdf_url, false)}
                              disabled={downloadingDoc === doc.key || !connected}
                            >
                              📥 {t("Download PDF", "ڈاؤن لوڈ")}
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              data-help={screenId === "msds_inspection_pack_inspector" ? "msds_inspection_pack_inspector.export" : screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.export" : "msds_inspection_pack.export"}
                              style={{ fontSize: "0.8rem", padding: "3px 8px" }}
                              onClick={() => handleDownloadPdf(doc.key, doc.pdf_url, true)}
                              disabled={downloadingDoc === doc.key || !connected}
                            >
                              {t("Preview", "دیکھیں")}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Surveyor's Sample: Selected Medical Records (rule:65bf4a5335) - hospital staff only, omit for inspector (rule:fd814af39b) */}
          {!isInspector && (
            <div
              className="card"
              style={{
              padding: "16px 20px",
              marginTop: "20px",
              background: "#fafbfc",
              border: "1px solid #e1e4e8",
              borderRadius: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
                📋 {t("Surveyor's Sample: Selected Medical Records (1–25 patients)", "معائنہ کار سیمپل: منتخب مریضوں کا میڈیکل ریکارڈ")}
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                {t("Rule 65bf4a5335: Prints complete clinical record with retained scans/PDFs", "قانون: مکمل کلینیکل ریکارڈ اور دستاویزات شامل ہوں گی")}
              </span>
            </div>

            <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#495057" }}>
              {t(
                "Pick 1 to 25 patients from the search register for the surveyor's sample audit. Each patient printed is logged as a read of their medical record.",
                "معائنہ کار کے سیمپل آڈٹ کے لیے 1 سے 25 مریض منتخب کریں۔ ہر مریض کا ریکارڈ پرنٹ کرنا ان کے میڈیکل ریکارڈ کے باضابطہ مطالعہ کے طور پر درج ہوتا ہے۔"
              )}
            </p>

            {/* Patient Search Input */}
            <div style={{ position: "relative", marginBottom: "12px", maxWidth: "450px" }}>
              <input
                type="search"
                data-help={screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.sample" : "msds_inspection_pack.sample"}
                placeholder={t("Search patient by MRN, name, phone, or CNIC...", "مریض کا نام، ایم آر این، فون یا شناختی کارڈ...")}
                value={sampleSearchQuery}
                onChange={(e) => setSampleSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "6px 10px" }}
              />

              {/* Autocomplete Results */}
              {sampleSearchResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "#ffffff",
                    border: "1px solid #ced4da",
                    borderRadius: "4px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    zIndex: 20,
                    maxHeight: "220px",
                    overflowY: "auto",
                  }}
                >
                  {sampleSearchResults.map((p) => {
                    const alreadyPicked = selectedPatients.some((x) => x.patient_id === p.patient_id);
                    return (
                      <div
                        key={p.patient_id}
                        style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid #f1f3f5",
                          cursor: alreadyPicked || selectedPatients.length >= 25 ? "not-allowed" : "pointer",
                          background: alreadyPicked ? "#f8f9fa" : "#ffffff",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                        onClick={() => {
                          if (alreadyPicked || selectedPatients.length >= 25) return;
                          setSelectedPatients((prev) => [...prev, p]);
                          setSampleSearchQuery("");
                          setSampleSearchResults([]);
                        }}
                      >
                        <div>
                          <strong>{p.full_name}</strong> <code>({p.mrn})</code>
                          <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                            {p.gender} • {p.age_years ? `${p.age_years}y` : ""} • {p.mobile || p.cnic || "No contact"}
                          </div>
                        </div>
                        {alreadyPicked ? (
                          <span style={{ fontSize: "0.75rem", color: "#28a745" }}>✓ {t("Added", "شامل")}</span>
                        ) : (
                          <button
                            type="button"
                            className="secondary"
                            data-help={screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.sample" : "msds_inspection_pack.sample"}
                            style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                            disabled={selectedPatients.length >= 25}
                          >
                            + {t("Add", "شامل کریں")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Patients Chips List */}
            {selectedPatients.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                {selectedPatients.map((p) => (
                  <div
                    key={p.patient_id}
                    style={{
                      background: "#e7f5ff",
                      border: "1px solid #a5d8ff",
                      borderRadius: "16px",
                      padding: "4px 10px",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>
                      <strong>{p.full_name}</strong> ({p.mrn})
                    </span>
                    <button
                      type="button"
                      data-help={screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.sample" : "msds_inspection_pack.sample"}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#dc3545",
                        cursor: "pointer",
                        fontWeight: "bold",
                        padding: 0,
                        fontSize: "0.9rem",
                      }}
                      onClick={() =>
                        setSelectedPatients((prev) => prev.filter((x) => x.patient_id !== p.patient_id))
                      }
                      title={t("Remove patient", "مریض خارج کریں")}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "#6c757d", fontStyle: "italic", marginBottom: "14px" }}>
                {t("No patients selected yet. Search above to add 1 to 25 patients.", "ابھی تک کوئی مریض منتخب نہیں ہوا۔ تلاش سے 1 تا 25 مریض شامل کریں۔")}
              </p>
            )}

            {/* Download Sample Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                data-help={screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.sample" : "msds_inspection_pack.sample"}
                onClick={() => handleDownloadSelectedRecords(false)}
                disabled={
                  downloadingSample ||
                  selectedPatients.length === 0 ||
                  selectedPatients.length > 25 ||
                  !connected ||
                  periodTooLong
                }
                style={{ padding: "8px 16px", fontWeight: "bold" }}
              >
                📥 {t("Download Selected Records (PDF)", "منتخب ریکارڈ پی ڈی ایف ڈاؤن لوڈ")} ({selectedPatients.length}/25)
              </button>

              <button
                type="button"
                className="secondary"
                data-help={screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.sample" : "msds_inspection_pack.sample"}
                onClick={() => handleDownloadSelectedRecords(true)}
                disabled={
                  downloadingSample ||
                  selectedPatients.length === 0 ||
                  selectedPatients.length > 25 ||
                  !connected ||
                  periodTooLong
                }
              >
                {t("Preview", "دیکھیں")}
              </button>

              {selectedPatients.length > 0 && (
                <button
                  type="button"
                  className="secondary"
                  data-help={screenId === "msds_inspection_pack_owner" ? "msds_inspection_pack_owner.sample" : "msds_inspection_pack.sample"}
                  onClick={() => setSelectedPatients([])}
                >
                  {t("Clear Sample", "سیمپل خالی کریں")}
                </button>
              )}

              <span style={{ fontSize: "0.8rem", color: "#6c757d", fontStyle: "italic" }}>
                {t("Note: Each patient printed is logged as a read of their medical record.", "نوٹ: پرنٹ ہونے والے ہر مریض کا اندراج ان کے میڈیکل ریکارڈ میں درج ہوتا ہے۔")}
              </span>
            </div>

            {sampleError && (
              <div
                style={{
                  background: "#f8d7da",
                  color: "#721c24",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  marginTop: "10px",
                  fontSize: "0.85rem",
                }}
              >
                ⚠️ {sampleError}
              </div>
            )}
          </div>
          )}
        </>
      )}
    </section>
  );
}
