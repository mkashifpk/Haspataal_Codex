import React, { useState, useEffect } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import { call, api } from "../bridge";
import {
  overview,
  getPrefs,
  recordUpload,
  listUploads,
  declaredServices,
  declareServices,
  recordAnswer,
  listAnswers,
  CpsaOverviewOut,
  CpsaAreaOut,
  CpsaDocumentOut,
  DeclarationRowOut,
  DeclarationAnswerOut,
  CpsaUploadOut,
  DeclarationAnswerRecordOut,
  ServicesDeclarationOut,
  ServicesGroupOut,
  ServiceDeclarationOut,
} from "../generated/phc_cpsa_documents";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
  screenId?: string;
  combined?: boolean;
};

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

export function PhcCpsaDocuments({
  revision,
  user,
  onOpenHelp,
  connected,
  screenId = "phc_cpsa_documents",
  combined: initialCombined = false,
}: Props) {
  // Default date range: last 90 days to today
  const today = new Date();
  const past90 = new Date();
  past90.setDate(today.getDate() - 90);

  const [dateFrom, setDateFrom] = useState(formatDate(past90));
  const [dateTo, setDateTo] = useState(formatDate(today));
  const [downloadMode, setDownloadMode] = useState<"Separate" | "Combined">(
    initialCombined ? "Combined" : "Separate"
  );
  const [updatingPref, setUpdatingPref] = useState(false);
  const [localRevision, setLocalRevision] = useState(0);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>("ALL");
  const [selectedKindFilter, setSelectedKindFilter] = useState<string>("ALL");
  const [expandedAreas, setExpandedAreas] = useState<Record<number, boolean>>({});
  const [expandedDocRows, setExpandedDocRows] = useState<Record<string, boolean>>({});

  // Feedback, Errors, and Progress
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});

  // Modal: Confirm or Correct Answer (rule:df4be14940)
  const [answerModalDoc, setAnswerModalDoc] = useState<CpsaDocumentOut | null>(null);
  const [answerModalRowNo, setAnswerModalRowNo] = useState<number>(1);
  const [answerModalQuestion, setAnswerModalQuestion] = useState<"Available" | "Trained" | "Implemented">("Available");
  const [answerChoice, setAnswerChoice] = useState<"Yes" | "No" | "NotApplicable">("Yes");
  const [answerReason, setAnswerReason] = useState("");
  const [answerEvidence, setAnswerEvidence] = useState("");
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [answerModalError, setAnswerModalError] = useState<string | null>(null);

  // Modal: Record Upload (rule:1259fa52a7)
  const [uploadModalDoc, setUploadModalDoc] = useState<CpsaDocumentOut | null>(null);
  const [uploadDate, setUploadDate] = useState(formatDate(today));
  const [portalRef, setPortalRef] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [savingUpload, setSavingUpload] = useState(false);
  const [uploadModalError, setUploadModalError] = useState<string | null>(null);

  // Modal: Upload History
  const [historyUploadDoc, setHistoryUploadDoc] = useState<CpsaDocumentOut | null>(null);
  const [uploadHistory, setUploadHistory] = useState<CpsaUploadOut[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal: Answer History
  const [historyAnswerDoc, setHistoryAnswerDoc] = useState<CpsaDocumentOut | null>(null);
  const [answerHistory, setAnswerHistory] = useState<DeclarationAnswerRecordOut[]>([]);
  const [loadingAnswerHistory, setLoadingAnswerHistory] = useState(false);

  // Modal: Services Declared (Annexure B, CPSA 1.2, rule:e4b42e5a6c)
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [servicesData, setServicesData] = useState<ServicesDeclarationOut | null>(null);
  const [loadingServices, setLoadingServices] = useState(false);
  const [savingServices, setSavingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [declaredServiceState, setDeclaredServiceState] = useState<Record<string, boolean>>({});
  const [serviceRemarks, setServiceRemarks] = useState<Record<string, string>>({});
  const [otherServices, setOtherServices] = useState<
    Array<{ service_name: string; group_name: "MedicalAndAllied" | "SurgicalAndAllied" | "Laboratory" | "Imaging"; remarks: string }>
  >([]);
  const [newOtherName, setNewOtherName] = useState("");
  const [newOtherGroup, setNewOtherGroup] = useState<"MedicalAndAllied" | "SurgicalAndAllied" | "Laboratory" | "Imaging">("MedicalAndAllied");
  const [newOtherRemarks, setNewOtherRemarks] = useState("");

  const isInspector = screenId === "phc_cpsa_documents_inspector";
  const canManage =
    !isInspector &&
    (user.permissions.includes("msds.cpsa.manage") ||
      user.permissions.includes("admin"));

  // Load preferences
  const prefsLoad = useLoad(() => getPrefs(), [revision, localRevision]);
  useEffect(() => {
    if (prefsLoad.data?.pdf_download) {
      setDownloadMode(prefsLoad.data.pdf_download);
    }
  }, [prefsLoad.data?.pdf_download]);

  // Load CPSA Overview
  const cpsaLoad = useLoad(
    () => overview({ date_from: dateFrom, date_to: dateTo }),
    [dateFrom, dateTo, revision, localRevision]
  );
  const cpsaData = cpsaLoad.data;

  // Sync download_mode from server response
  useEffect(() => {
    if (cpsaData?.download_mode) {
      setDownloadMode(cpsaData.download_mode);
    }
  }, [cpsaData?.download_mode]);

  // Expand all areas initially once data arrives
  useEffect(() => {
    if (cpsaData?.areas) {
      const initial: Record<number, boolean> = {};
      cpsaData.areas.forEach((a) => {
        initial[a.area] = true;
      });
      setExpandedAreas(initial);
    }
  }, [cpsaData?.areas]);

  // Toggle download mode preference (rule:26951c23c3)
  const handleTogglePreference = async () => {
    const nextMode = downloadMode === "Separate" ? "Combined" : "Separate";
    try {
      setUpdatingPref(true);
      await api("PUT", "/settings/me", { pdf_download: nextMode });
      setDownloadMode(nextMode);
    } catch {
      // fallback
    } finally {
      setUpdatingPref(false);
    }
  };

  // Check period length (max 366 days, rule:ac7f3933ac)
  const fromTime = new Date(dateFrom).getTime();
  const toTime = new Date(dateTo).getTime();
  const daysDiff = Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24));
  const periodTooLong = daysDiff > 366;

  // PDF Download Handler (uses Electron clinical-pdf bridge)
  const handleDownloadPdf = async (docKey: string, rawUrl: string, preview: boolean) => {
    try {
      setDownloadingDoc(docKey);
      setDownloadNotice(null);
      const path = cleanPdfPath(rawUrl);
      const res = await call("clinical-pdf", { path, preview });
      setDocErrors((prev) => {
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
      setDocErrors((prev) => ({ ...prev, [docKey]: msg }));
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Open non-PDF downloads (Word template, Excel list)
  const handleOpenExternal = (url: string) => {
    if (!url) return;
    window.open(url, "_blank");
  };

  // Expand / Collapse all areas
  const handleExpandAll = (expand: boolean) => {
    if (!cpsaData?.areas) return;
    const next: Record<number, boolean> = {};
    cpsaData.areas.forEach((a) => {
      next[a.area] = expand;
    });
    setExpandedAreas(next);
  };

  // Open Confirm / Correct modal
  const openConfirmModal = (doc: CpsaDocumentOut, rowNo: number, q: "Available" | "Trained" | "Implemented") => {
    setAnswerModalDoc(doc);
    setAnswerModalRowNo(rowNo);
    setAnswerModalQuestion(q);
    const row = doc.rows?.find((r) => r.row_no === rowNo);
    const ans = row?.answers?.find((a) => a.question === q);
    setAnswerChoice(ans?.value === "NotApplicable" ? "NotApplicable" : ans?.value === "No" ? "No" : "Yes");
    setAnswerReason(ans?.confirmation?.reason || ans?.reason || "");
    setAnswerEvidence(ans?.confirmation?.evidence || "");
    setAnswerModalError(null);
  };

  // Submit Confirm / Correct answer (POST /phc/cpsa/declaration/answers)
  const handleSaveAnswer = async () => {
    if (!answerModalDoc) return;
    if (!answerReason.trim()) {
      setAnswerModalError(t("Please provide a reason.", "براہ کرم وجہ درج کریں۔"));
      return;
    }
    if (answerChoice === "Yes" && !answerEvidence.trim()) {
      setAnswerModalError(t("Evidence location is required when answering Yes.", "ہاں کا جواب دیتے ہوئے ثبوت کا مقام درج کرنا لازمی ہے۔"));
      return;
    }
    try {
      setSavingAnswer(true);
      setAnswerModalError(null);
      await recordAnswer({
        document_key: answerModalDoc.key,
        row_no: answerModalRowNo,
        question: answerModalQuestion,
        answer: answerChoice,
        reason: answerReason.trim(),
        evidence: answerChoice === "Yes" ? answerEvidence.trim() : null,
      });
      setAnswerModalDoc(null);
      setLocalRevision((r) => r + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnswerModalError(msg);
    } finally {
      setSavingAnswer(false);
    }
  };

  // Withdraw answer (POST /phc/cpsa/declaration/answers with answer: null)
  const handleWithdrawAnswer = async (docKey: string, rowNo: number, q: "Available" | "Trained" | "Implemented") => {
    try {
      setSavingAnswer(true);
      await recordAnswer({
        document_key: docKey,
        row_no: rowNo,
        question: q,
        answer: null,
        reason: t("Answer withdrawn to restore records' answer", "جواب واپس لے کر ریکارڈز کا جواب بحال کیا گیا"),
      });
      setAnswerModalDoc(null);
      setLocalRevision((r) => r + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnswerModalError(msg);
    } finally {
      setSavingAnswer(false);
    }
  };

  // Open Record Upload modal
  const openUploadModal = (doc: CpsaDocumentOut) => {
    setUploadModalDoc(doc);
    setUploadDate(formatDate(new Date()));
    setPortalRef("");
    setUploadNote("");
    setUploadModalError(null);
  };

  // Submit Record Upload (POST /phc/cpsa/uploads)
  const handleSaveUpload = async () => {
    if (!uploadModalDoc) return;
    try {
      setSavingUpload(true);
      setUploadModalError(null);
      await recordUpload({
        document_key: uploadModalDoc.key,
        uploaded_on: uploadDate,
        portal_reference: portalRef.trim() || null,
        note: uploadNote.trim() || null,
      });
      setUploadModalDoc(null);
      setLocalRevision((r) => r + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadModalError(msg);
    } finally {
      setSavingUpload(false);
    }
  };

  // View Upload History (GET /phc/cpsa/uploads)
  const handleViewUploadHistory = async (doc: CpsaDocumentOut) => {
    setHistoryUploadDoc(doc);
    setLoadingHistory(true);
    try {
      const res = await listUploads({ document_key: doc.key });
      setUploadHistory(res);
    } catch {
      setUploadHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // View Answer History (GET /phc/cpsa/declaration/answers)
  const handleViewAnswerHistory = async (doc: CpsaDocumentOut) => {
    setHistoryAnswerDoc(doc);
    setLoadingAnswerHistory(true);
    try {
      const res = await listAnswers({ document_key: doc.key });
      setAnswerHistory(res);
    } catch {
      setAnswerHistory([]);
    } finally {
      setLoadingAnswerHistory(false);
    }
  };

  // Open Services Declared modal (GET /phc/services)
  const handleOpenServicesModal = async () => {
    setServicesModalOpen(true);
    setLoadingServices(true);
    setServicesError(null);
    try {
      const res = await declaredServices();
      setServicesData(res);
      const declaredMap: Record<string, boolean> = {};
      const remarksMap: Record<string, string> = {};
      const customOthers: Array<{ service_name: string; group_name: "MedicalAndAllied" | "SurgicalAndAllied" | "Laboratory" | "Imaging"; remarks: string }> = [];

      res.groups.forEach((g) => {
        g.services.forEach((s) => {
          if (s.is_listed) {
            declaredMap[s.service_name] = s.declared;
            if (s.remarks) remarksMap[s.service_name] = s.remarks;
          } else {
            customOthers.push({
              service_name: s.service_name,
              group_name: s.group_name,
              remarks: s.remarks || "",
            });
          }
        });
      });

      setDeclaredServiceState(declaredMap);
      setServiceRemarks(remarksMap);
      setOtherServices(customOthers);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setServicesError(msg);
    } finally {
      setLoadingServices(false);
    }
  };

  // Save Services Declaration (PUT /phc/services)
  const handleSaveServices = async () => {
    if (!servicesData) return;
    try {
      setSavingServices(true);
      setServicesError(null);

      const items: Array<{
        service_name: string;
        is_listed: boolean;
        group_name?: "MedicalAndAllied" | "SurgicalAndAllied" | "Laboratory" | "Imaging" | null;
        remarks?: string | null;
      }> = [];

      // Add declared listed services
      servicesData.groups.forEach((g) => {
        g.services.forEach((s) => {
          if (s.is_listed && declaredServiceState[s.service_name]) {
            items.push({
              service_name: s.service_name,
              is_listed: true,
              remarks: serviceRemarks[s.service_name]?.trim() || null,
            });
          }
        });
      });

      // Add custom others lines
      otherServices.forEach((o) => {
        if (o.service_name.trim()) {
          items.push({
            service_name: o.service_name.trim(),
            is_listed: false,
            group_name: o.group_name,
            remarks: o.remarks?.trim() || null,
          });
        }
      });

      const updated = await declareServices({ items });
      setServicesData(updated);
      setServicesModalOpen(false);
      setLocalRevision((r) => r + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setServicesError(msg);
    } finally {
      setSavingServices(false);
    }
  };

  // Filter areas and documents
  const areas = cpsaData?.areas || [];
  const filteredAreas = areas
    .filter((a) => {
      if (selectedAreaFilter !== "ALL" && String(a.area) !== selectedAreaFilter) return false;
      return true;
    })
    .map((a) => {
      const filteredDocs = a.documents.filter((d) => {
        if (selectedKindFilter !== "ALL" && d.kind !== selectedKindFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchNum = d.number.toLowerCase().includes(q);
          const matchTitle = d.title.toLowerCase().includes(q);
          const matchAbout = d.about.toLowerCase().includes(q);
          const matchDept = d.department.toLowerCase().includes(q);
          if (!matchNum && !matchTitle && !matchAbout && !matchDept) return false;
        }
        return true;
      });
      return { ...a, documents: filteredDocs };
    })
    .filter((a) => a.documents.length > 0);

  const counts = cpsaData?.counts;
  const unconfirmedDeclarationRows =
    counts && counts.declaration_rows_confirmed < counts.declaration_rows;

  return (
    <section data-screen={screenId} className="phc-cpsa-documents">
      {/* Top Header */}
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
              ? t("PHC web portal (CPSA) documents (inspector)", "پنجاب ہیلتھ کیئر کمیشن ویب پورٹل دستاویزات (انسپکٹر)")
              : t("PHC web portal (CPSA) documents", "پنجاب ہیلتھ کیئر کمیشن ویب پورٹل دستاویزات")}
          </h1>

          {/* Guidelines Word button */}
          {cpsaData?.guidelines_url && (
            <button
              type="button"
              className="secondary"
              data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.export" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.export" : "phc_cpsa_documents.export"}
              onClick={() => handleOpenExternal(cpsaData.guidelines_url)}
              title={t("Download PHC CPSA guidelines as published (Word)", "پنجاب ہیلتھ کیئر کمیشن کے رہنما اصول ڈاؤن لوڈ کریں")}
            >
              📄 {t("CPSA Guidelines (Word)", "رہنما اصول (ورڈ)")}
            </button>
          )}

          {/* Declaration Annexure A PDF */}
          {cpsaData?.declaration_pdf_url && (
            <button
              type="button"
              className="secondary"
              data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.export" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.export" : "phc_cpsa_documents.export"}
              onClick={() => {
                if (unconfirmedDeclarationRows) {
                  const proceed = window.confirm(
                    t(
                      `Warning: ${counts!.declaration_rows - counts!.declaration_rows_confirmed} answers are unconfirmed and will print with * on the official declaration. The Head of Hospital signs this form under the PHC Act. Proceed to preview?`,
                      `انتباہ: ${counts!.declaration_rows - counts!.declaration_rows_confirmed} جوابات غیر تصدیق شدہ ہیں اور سرکاری اعلامیے پر * کے ساتھ پرنٹ ہوں گے۔ کیا آپ آگے بڑھنا چاہتے ہیں؟`
                    )
                  );
                  if (!proceed) return;
                }
                handleDownloadPdf("declaration_pdf", cpsaData.declaration_pdf_url, true);
              }}
              title={t("Preview or download official PHC Declaration (Annexure A)", "سرکاری اعلامیہ پی ڈی ایف دیکھیں یا ڈاؤن لوڈ کریں")}
            >
              📑 {t("Declaration (Annexure A, PDF)", "اعلامیہ (ضمیمہ الف)")}
            </button>
          )}

          {/* Services Declared Annexure B button (hospital staff only; omit for inspector per rule:88a579cbfe) */}
          {!isInspector && (
            <button
              type="button"
              className="secondary"
              data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
              onClick={handleOpenServicesModal}
              title={t("Review and declare hospital services (CPSA 1.2, Annexure B)", "ہسپتال کی خدمات کا جائزہ لیں اور اعلان کریں")}
            >
              🏥 {t("Declared Services (Annexure B)", "منظور شدہ خدمات (ضمیمہ ب)")}
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Toggle PDF download preference */}
          <button
            type="button"
            className="secondary"
            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
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

          {/* Download all CPSA documents (Combined mode) */}
          {downloadMode === "Combined" && cpsaData?.combined_pdf_url && (
            <button
              type="button"
              className="primary"
              data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.export" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.export" : "phc_cpsa_documents.export"}
              onClick={() => handleDownloadPdf("combined_all", cpsaData.combined_pdf_url, true)}
              disabled={downloadingDoc === "combined_all"}
            >
              {downloadingDoc === "combined_all" ? t("Opening...", "کھل رہا ہے...") : t("Download all CPSA documents", "تمام دستاویزات ڈاؤن لوڈ کریں")}
            </button>
          )}

          <button
            type="button"
            className="secondary"
            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
            onClick={() => setLocalRevision((r) => r + 1)}
            disabled={!connected}
          >
            {t("Refresh", "تازہ کریں")}
          </button>

          <button
            type="button"
            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.help" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.help" : "phc_cpsa_documents.help"}
            onClick={onOpenHelp}
          >
            {t("Help", "مدد")}
          </button>
        </div>
      </header>

      {/* Period Picker & Statutory Policy Note (rule:ac7f3933ac) */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          marginBottom: "12px",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="cpsa-date-from" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
            {t("Inspection Period From:", "مدت کا آغاز:")}
          </label>
          <input
            id="cpsa-date-from"
            type="date"
            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="cpsa-date-to" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
            {t("To:", "اختتام:")}
          </label>
          <input
            id="cpsa-date-to"
            type="date"
            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div style={{ fontSize: "0.85rem", color: periodTooLong ? "#dc3545" : "#6c757d" }}>
          ℹ️{" "}
          {periodTooLong
            ? t("Statutory inspection period cannot exceed 366 days.", "معائنے کی قانونی مدت 366 دن سے زیادہ نہیں ہو سکتی۔")
            : t(
                "Periodic registers and audits print for selected dates; hospital statutory policies print as of today.",
                "رجسٹرز اور آڈٹس منتخب مدت کے لیے پرنٹ ہوتے ہیں؛ ہسپتال کی پالیسیاں موجودہ تاریخ پر پرنٹ ہوتی ہیں۔"
              )}
        </div>
      </div>

      {/* Progress & Quality Officer Guidance Banner (rule:574ae6ad83) */}
      {counts && (
        <div
          className="card"
          style={{
            padding: "14px 18px",
            marginBottom: "16px",
            background: "#f8f9fa",
            border: "1px solid #dee2e6",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "10px",
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: "1rem" }}>
              {t("CPSA Declaration Progress:", "اعلامیہ کی پیش رفت:")}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#6c757d" }}>
              {t(
                "The Quality Officer must resolve red items before the Head of Hospital signs.",
                "کوالٹی آفیسر کو سربراہ کے دستخط سے پہلے سرخ آئٹمز حل کرنے چاہئیں۔"
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
            }}
          >
            {/* Documents Available */}
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "8px",
                background: counts.available === counts.documents ? "#e8f5e9" : "#fff8e1",
                borderTop: `4px solid ${counts.available === counts.documents ? "#28a745" : "#ffc107"}`,
              }}
            >
              <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>
                {counts.available} / {counts.documents}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#495057" }}>
                {t("Available", "دستیاب")}
              </div>
            </div>

            {/* Staff Trained */}
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "8px",
                background: "#f0f7ff",
                borderTop: "4px solid #007bff",
              }}
            >
              <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>
                {counts.trained} / {counts.training_applies}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#495057" }}>
                {t("Staff Trained", "عملہ تربیت یافتہ")}
              </div>
            </div>

            {/* Implemented */}
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "8px",
                background: "#f0f7ff",
                borderTop: "4px solid #17a2b8",
              }}
            >
              <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>
                {counts.implemented} / {counts.implementation_applies}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#495057" }}>
                {t("Implemented", "نافذ شدہ")}
              </div>
            </div>

            {/* Uploaded */}
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "8px",
                background: counts.uploaded > 0 ? "#e8f5e9" : "#fdf4f4",
                borderTop: `4px solid ${counts.uploaded > 0 ? "#28a745" : "#dc3545"}`,
              }}
            >
              <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>
                {counts.uploaded} / {counts.uploads_recorded}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#495057" }}>
                {t("Uploaded to Portal", "پورٹل پر اپ لوڈ")}
              </div>
            </div>

            {/* Confirmed Rows */}
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "8px",
                background: unconfirmedDeclarationRows ? "#fff3cd" : "#e8f5e9",
                borderTop: `4px solid ${unconfirmedDeclarationRows ? "#ffc107" : "#28a745"}`,
              }}
            >
              <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>
                {counts.declaration_rows_confirmed} / {counts.declaration_rows}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#495057" }}>
                {t("Rows Confirmed", "تصدیق شدہ قطاریں")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download notice */}
      {downloadNotice && (
        <div
          className="notice"
          style={{
            background: "#d4edda",
            color: "#155724",
            padding: "8px 12px",
            marginBottom: "12px",
            borderRadius: "4px",
          }}
        >
          {downloadNotice}
        </div>
      )}

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: "10px 14px",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Search */}
          <input
            type="search"
            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
            placeholder={t("Search documents by number, title, or department...", "نمبر، عنوان یا شعبہ سے تلاش کریں...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ minWidth: "260px", padding: "6px 10px" }}
          />

          {/* Area Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="cpsa-area-filter" style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              {t("Area:", "رقبہ:")}
            </label>
            <select
              id="cpsa-area-filter"
              data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
              value={selectedAreaFilter}
              onChange={(e) => setSelectedAreaFilter(e.target.value)}
              style={{ padding: "4px 8px" }}
            >
              <option value="ALL">{t("All 20 Areas", "تمام 20 ابواب")}</option>
              {areas.map((a) => (
                <option key={a.area} value={String(a.area)}>
                  {t(`Area ${a.area}: ${a.title}`, `باب ${a.area}: ${a.title}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Kind Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="cpsa-kind-filter" style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              {t("Kind:", "قسم:")}
            </label>
            <select
              id="cpsa-kind-filter"
              data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
              value={selectedKindFilter}
              onChange={(e) => setSelectedKindFilter(e.target.value)}
              style={{ padding: "4px 8px" }}
            >
              <option value="ALL">{t("All Kinds", "تمام اقسام")}</option>
              <option value="Format">{t("Format", "فارمیٹ")}</option>
              <option value="Policy">{t("Policy", "پالیسی")}</option>
              <option value="Register">{t("Register", "رجسٹر")}</option>
              <option value="Notification">{t("Notification", "نوٹیفکیشن")}</option>
              <option value="Upload">{t("Upload", "اپ لوڈ")}</option>
              <option value="Guideline">{t("Guideline", "رہنما اصول")}</option>
            </select>
          </div>
        </div>

        {/* Global Expand / Collapse */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className="secondary"
            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
            onClick={() => handleExpandAll(true)}
            style={{ fontSize: "0.8rem", padding: "4px 8px" }}
          >
            {t("Expand All", "سب کھولیں")}
          </button>
          <button
            type="button"
            className="secondary"
            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.filter" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.filter" : "phc_cpsa_documents.filter"}
            onClick={() => handleExpandAll(false)}
            style={{ fontSize: "0.8rem", padding: "4px 8px" }}
          >
            {t("Collapse All", "سب سمیٹیں")}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <LoadState {...cpsaLoad} retry={cpsaLoad.reload} />

      {cpsaData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredAreas.map((area) => {
            const isExpanded = expandedAreas[area.area] ?? true;
            return (
              <article
                key={area.area}
                className="card"
                style={{
                  border: "1px solid #ced4da",
                  borderRadius: "6px",
                  overflow: "hidden",
                  padding: 0,
                }}
              >
                {/* Area Header (Collapsible Block, rule:2c3663fd1b) */}
                <header
                  onClick={() =>
                    setExpandedAreas((prev) => ({
                      ...prev,
                      [area.area]: !prev[area.area],
                    }))
                  }
                  style={{
                    background: "#e9ecef",
                    padding: "10px 16px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                      {t(`Area ${area.area}: ${area.title}`, `باب ${area.area}: ${area.title}`)}
                    </h2>
                  </div>
                  <span className="badge" style={{ background: "#495057", color: "#ffffff", padding: "2px 8px", borderRadius: "10px" }}>
                    {area.documents.length} {t("documents", "دستاویزات")}
                  </span>
                </header>

                {/* Area Documents Table */}
                {isExpanded && (
                  <div style={{ overflowX: "auto", padding: "8px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                      <thead>
                        <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #dee2e6", textAlign: "left" }}>
                          <th style={{ padding: "8px", width: "50px" }}>#</th>
                          <th style={{ padding: "8px" }}>{t("Document", "دستاویز")}</th>
                          <th style={{ padding: "8px", width: "110px" }}>{t("Kind", "قسم")}</th>
                          <th style={{ padding: "8px", width: "160px" }}>{t("Status Dots", "حیثیت")}</th>
                          <th style={{ padding: "8px", width: "240px" }}>{t("Downloads", "ڈاؤن لوڈز")}</th>
                          <th style={{ padding: "8px", width: "160px" }}>{t("Actions", "اقدامات")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {area.documents.map((doc) => {
                          const status = doc.status;
                          const rowsExpanded = expandedDocRows[doc.key] ?? false;
                          const err = docErrors[doc.key];

                          // Status dots colors (green Yes, red No, grey N/A, rule:e5f1786f9c)
                          const getDotColor = (val: boolean | null, applies: boolean) => {
                            if (!applies || val === null) return "#6c757d"; // Grey NA
                            return val ? "#28a745" : "#dc3545"; // Green Yes, Red No
                          };

                          return (
                            <React.Fragment key={doc.key}>
                              <tr
                                style={{
                                  borderBottom: "1px solid #e9ecef",
                                  opacity: status.applies ? 1 : 0.65,
                                  background: "#ffffff",
                                }}
                              >
                                {/* Document Number */}
                                <td style={{ padding: "8px", fontWeight: "bold" }}>
                                  {doc.number}
                                </td>

                                {/* Title & Details */}
                                <td style={{ padding: "8px" }}>
                                  <div style={{ fontWeight: "600", color: "#212529" }}>
                                    {doc.title}
                                  </div>
                                  <div style={{ fontSize: "0.8rem", color: "#6c757d", marginTop: "2px" }}>
                                    {doc.about}
                                  </div>
                                  {doc.phi && (
                                    <span
                                      className="badge"
                                      style={{
                                        background: "#fff3cd",
                                        color: "#856404",
                                        fontSize: "0.75rem",
                                        marginTop: "4px",
                                        display: "inline-block",
                                        padding: "1px 6px",
                                        borderRadius: "3px",
                                      }}
                                    >
                                      🔒 {t("PHI Protected (Downloads logged)", "طبی رازداری (ڈاؤن لوڈ ریکارڈ ہوتا ہے)")}
                                    </span>
                                  )}
                                  {/* Inline error for CPSA_DOCUMENT_UNAVAILABLE (rule:b79d20645a) */}
                                  {err && (
                                    <div
                                      style={{
                                        color: "#721c24",
                                        background: "#f8d7da",
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        marginTop: "4px",
                                        fontSize: "0.8rem",
                                      }}
                                    >
                                      ⚠️ {err}
                                    </div>
                                  )}
                                </td>

                                {/* Kind */}
                                <td style={{ padding: "8px" }}>
                                  <span
                                    className="badge"
                                    style={{
                                      padding: "3px 6px",
                                      borderRadius: "4px",
                                      fontSize: "0.78rem",
                                      background:
                                        doc.kind === "Policy"
                                          ? "#cce5ff"
                                          : doc.kind === "Register"
                                          ? "#d4edda"
                                          : doc.kind === "Format"
                                          ? "#e2e3e5"
                                          : "#fff3cd",
                                      color: "#212529",
                                    }}
                                  >
                                    {doc.kind}
                                  </span>
                                </td>

                                {/* Status Dots (rule:2c3663fd1b, rule:e5f1786f9c) */}
                                <td style={{ padding: "8px" }}>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    {/* Available */}
                                    <span
                                      title={t(`Available: ${status.available ? "Yes" : "No"} (${status.available_detail})`, `دستیاب: ${status.available_detail}`)}
                                      style={{
                                        display: "inline-block",
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        background: getDotColor(status.available, status.applies),
                                      }}
                                    />
                                    {/* Staff Trained */}
                                    <span
                                      title={t(`Trained: ${status.trained === null ? "N/A" : status.trained ? "Yes" : "No"} (${status.trained_detail})`, `تربیت یافتہ: ${status.trained_detail}`)}
                                      style={{
                                        display: "inline-block",
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        background: getDotColor(status.trained, status.applies),
                                      }}
                                    />
                                    {/* Implemented */}
                                    <span
                                      title={t(`Implemented: ${status.implemented === null ? "N/A" : status.implemented ? "Yes" : "No"} (${status.implemented_detail})`, `نافذ: ${status.implemented_detail}`)}
                                      style={{
                                        display: "inline-block",
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        background: getDotColor(status.implemented, status.applies),
                                      }}
                                    />
                                    {/* Uploaded */}
                                    <span
                                      title={t(`Uploaded: ${status.uploaded ? "Yes" : "No"}${status.last_upload ? ` on ${status.last_upload.uploaded_on}` : ""}`, `اپ لوڈ: ${status.uploaded ? "ہاں" : "نہیں"}`)}
                                      style={{
                                        display: "inline-block",
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        background: status.uploaded ? "#28a745" : "#dc3545",
                                      }}
                                    />
                                  </div>
                                  <div style={{ fontSize: "0.72rem", color: "#6c757d", marginTop: "4px" }}>
                                    {t("Avail / Train / Imp / Upl", "دستیاب / تربیت / نفاذ / اپ لوڈ")}
                                  </div>
                                </td>

                                {/* Downloads (rule:983aa913ef, rule:26951c23c3) */}
                                <td style={{ padding: "8px" }}>
                                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {/* PHC Template */}
                                    {doc.template_url && (
                                      <button
                                        type="button"
                                        className="secondary"
                                        data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.export" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.export" : "phc_cpsa_documents.export"}
                                        onClick={() => handleOpenExternal(doc.template_url!)}
                                        style={{ fontSize: "0.78rem", padding: "3px 6px" }}
                                        title={t(`PHC Template: ${doc.template || "Download"}`, `پنجاب ہیلتھ کیئر کمیشن فارمیٹ: ${doc.template}`)}
                                      >
                                        📥 {t("Template", "فارمیٹ")}
                                      </button>
                                    )}

                                    {/* Filled PDF */}
                                    {downloadMode === "Separate" && doc.pdf_url && (
                                      <>
                                        <button
                                          type="button"
                                          className="secondary"
                                          data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.export" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.export" : "phc_cpsa_documents.export"}
                                          onClick={() => handleDownloadPdf(doc.key, doc.pdf_url!, true)}
                                          disabled={downloadingDoc === doc.key}
                                          style={{ fontSize: "0.78rem", padding: "3px 6px" }}
                                          title={t("Preview filled statutory PDF", "پی ڈی ایف دیکھیں")}
                                        >
                                          👁️ {t("Preview", "دیکھیں")}
                                        </button>
                                        <button
                                          type="button"
                                          className="secondary"
                                          data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.export" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.export" : "phc_cpsa_documents.export"}
                                          onClick={() => handleDownloadPdf(doc.key, doc.pdf_url!, false)}
                                          disabled={downloadingDoc === doc.key}
                                          style={{ fontSize: "0.78rem", padding: "3px 6px" }}
                                          title={t("Save filled statutory PDF", "پی ڈی ایف محفوظ کریں")}
                                        >
                                          💾 {t("Save PDF", "محفوظ")}
                                        </button>
                                      </>
                                    )}

                                    {/* Filled Excel (for CPSA 1 lists) */}
                                    {doc.xlsx_url && (
                                      <button
                                        type="button"
                                        className="secondary"
                                        data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.export" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.export" : "phc_cpsa_documents.export"}
                                        onClick={() => handleOpenExternal(doc.xlsx_url!)}
                                        style={{ fontSize: "0.78rem", padding: "3px 6px" }}
                                        title={t("Download filled Excel sheet as required by PHC", "ایکسل شیٹ ڈاؤن لوڈ کریں")}
                                      >
                                        📊 {t("Excel", "ایکسل")}
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {/* Actions */}
                                <td style={{ padding: "8px" }}>
                                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {/* Declaration Rows Toggle */}
                                    {doc.rows && doc.rows.length > 0 && (
                                      <button
                                        type="button"
                                        className="secondary"
                                        data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                                        onClick={() =>
                                          setExpandedDocRows((prev) => ({
                                            ...prev,
                                            [doc.key]: !prev[doc.key],
                                          }))
                                        }
                                        style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                      >
                                        {rowsExpanded ? t("Hide Rows", "قطاریں چھپائیں") : t("Rows", "قطاریں")}{" "}
                                        ({doc.rows.length})
                                      </button>
                                    )}

                                    {/* Record Upload (rule:1259fa52a7) */}
                                    {canManage && (
                                      <button
                                        type="button"
                                        className="secondary"
                                        data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.upload" : "phc_cpsa_documents.upload"}
                                        onClick={() => openUploadModal(doc)}
                                        style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                        title={t("Record upload to PHC HCE web portal", "پورٹل پر اپ لوڈ درج کریں")}
                                      >
                                        📤 {t("Upload", "اپ لوڈ")}
                                      </button>
                                    )}

                                    {/* Upload History */}
                                    <button
                                      type="button"
                                      className="secondary"
                                      data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.upload" : "phc_cpsa_documents.upload"}
                                      onClick={() => handleViewUploadHistory(doc)}
                                      style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                      title={t("View upload history", "اپ لوڈ ہسٹری دیکھیں")}
                                    >
                                      🕒 {t("Uploads", "اپ لوڈز")}
                                    </button>

                                    {/* Answer History */}
                                    <button
                                      type="button"
                                      className="secondary"
                                      data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                                      onClick={() => handleViewAnswerHistory(doc)}
                                      style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                      title={t("View declaration confirmation history", "اعلامیہ ہسٹری دیکھیں")}
                                    >
                                      📝 {t("Answers", "جوابات")}
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Declaration Rows Sub-table (rule:1dfd790709, rule:df4be14940) */}
                              {rowsExpanded && doc.rows && (
                                <tr style={{ background: "#f1f3f5" }}>
                                  <td colSpan={6} style={{ padding: "10px 16px" }}>
                                    <div style={{ fontWeight: "bold", marginBottom: "6px", fontSize: "0.85rem" }}>
                                      {t("Declaration Rows (Annexure A):", "اعلامیہ کی قطاریں (ضمیمہ الف):")}
                                    </div>
                                    <table style={{ width: "100%", background: "#ffffff", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                      <thead>
                                        <tr style={{ background: "#e9ecef", borderBottom: "1px solid #ced4da" }}>
                                          <th style={{ padding: "6px" }}>{t("Statement", "بیان")}</th>
                                          <th style={{ padding: "6px", width: "130px" }}>{t("Available", "دستیاب")}</th>
                                          <th style={{ padding: "6px", width: "130px" }}>{t("Trained", "تربیت")}</th>
                                          <th style={{ padding: "6px", width: "130px" }}>{t("Implemented", "نفاذ")}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {doc.rows.map((row) => (
                                          <tr key={row.row_no} style={{ borderBottom: "1px solid #e9ecef" }}>
                                            <td style={{ padding: "6px" }}>
                                              <div>{row.text}</div>
                                            </td>
                                            {(["Available", "Trained", "Implemented"] as const).map((q) => {
                                              const ans = row.answers?.find((a) => a.question === q);
                                              if (!ans) return <td key={q} style={{ padding: "6px" }}>-</td>;
                                              const isFixed = ans.fixed;
                                              const isConfirmed = ans.confirmation !== null;

                                              return (
                                                <td key={q} style={{ padding: "6px", verticalAlign: "top" }}>
                                                  {isFixed ? (
                                                    <span style={{ color: "#6c757d", fontStyle: "italic" }}>
                                                      NA
                                                    </span>
                                                  ) : (
                                                    <div>
                                                      <div style={{ fontWeight: "bold", color: ans.value === "Yes" ? "#28a745" : ans.value === "No" ? "#dc3545" : "#6c757d" }}>
                                                        {ans.value}
                                                      </div>
                                                      <div style={{ fontSize: "0.72rem", color: "#6c757d" }}>
                                                        {isConfirmed ? (
                                                          <span style={{ color: "#007bff" }}>
                                                            ✓ {ans.confirmation?.decided_by_name}
                                                          </span>
                                                        ) : (
                                                          <span style={{ color: "#e65100" }}>
                                                            * {t("from records", "ریکارڈز سے")}
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div style={{ fontSize: "0.7rem", color: "#495057", marginTop: "2px" }}>
                                                        {ans.reason}
                                                      </div>
                                                      {canManage && (
                                                        <div style={{ marginTop: "4px", display: "flex", gap: "4px" }}>
                                                          <button
                                                            type="button"
                                                            className="secondary"
                                                            data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                                                            onClick={() => openConfirmModal(doc, row.row_no, q)}
                                                            style={{ fontSize: "0.7rem", padding: "1px 4px" }}
                                                          >
                                                            {t("Confirm", "تصدیق")}
                                                          </button>
                                                          {isConfirmed && (
                                                            <button
                                                              type="button"
                                                              className="secondary"
                                                              data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                                                              onClick={() => handleWithdrawAnswer(doc.key, row.row_no, q)}
                                                              style={{ fontSize: "0.7rem", padding: "1px 4px", color: "#dc3545" }}
                                                            >
                                                              {t("Withdraw", "واپس")}
                                                            </button>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* MODAL: Confirm or Correct Answer (rule:df4be14940) */}
      {answerModalDoc && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              maxWidth: "560px",
              width: "100%",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>
              {t("Confirm or Correct Declaration Answer", "اعلامیہ کے جواب کی تصدیق یا درستگی")}
            </h3>
            <div style={{ fontSize: "0.85rem", color: "#6c757d", marginBottom: "14px" }}>
              <strong>{answerModalDoc.number} {answerModalDoc.title}</strong> — {t("Question:", "سوال:")}{" "}
              <code>{answerModalQuestion}</code>
            </div>

            {answerModalError && (
              <div style={{ color: "#721c24", background: "#f8d7da", padding: "8px", borderRadius: "4px", marginBottom: "12px", fontSize: "0.85rem" }}>
                {answerModalError}
              </div>
            )}

            {/* Answer Choice */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.88rem" }}>
                {t("Answer:", "جواب:")}
              </label>
              <select
                data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                value={answerChoice}
                onChange={(e) => setAnswerChoice(e.target.value as "Yes" | "No" | "NotApplicable")}
                style={{ width: "100%", padding: "6px" }}
              >
                <option value="Yes">{t("Yes", "ہاں")}</option>
                <option value="No">{t("No", "نہیں")}</option>
                <option value="NotApplicable">{t("Not Applicable", "غیر لاگو")}</option>
              </select>
            </div>

            {/* Reason (required) */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.88rem" }}>
                {t("Reason / Verification Note (Required):", "وجہ / تصدیقی نوٹ (لازمی):")}
              </label>
              <textarea
                data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                rows={3}
                style={{ width: "100%", padding: "6px" }}
                placeholder={t("Explain what was verified or why the records' answer is adjusted...", "وضاحت درج کریں کہ کیا چیک کیا گیا...")}
                value={answerReason}
                onChange={(e) => setAnswerReason(e.target.value)}
              />
            </div>

            {/* Evidence (required if Yes) */}
            {answerChoice === "Yes" && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.88rem" }}>
                  {t("Where is the evidence kept? (Required for Yes):", "ثبوت کہاں موجود ہے؟ (ہاں کے لیے لازمی):")}
                </label>
                <input
                  type="text"
                  data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                  style={{ width: "100%", padding: "6px" }}
                  placeholder={t("e.g., HR Employee File #102, Fire Safety Register, On-site display board", "مثلاً ایچ آر فائل، فائر سیفٹی رجسٹر، آن سائٹ بورڈ")}
                  value={answerEvidence}
                  onChange={(e) => setAnswerEvidence(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                onClick={() => setAnswerModalDoc(null)}
                disabled={savingAnswer}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                className="primary"
                data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                onClick={handleSaveAnswer}
                disabled={savingAnswer}
              >
                {savingAnswer ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Answer", "جواب محفوظ کریں")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Upload (rule:1259fa52a7) */}
      {uploadModalDoc && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              maxWidth: "500px",
              width: "100%",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>
              {t("Record Upload to PHC Web Portal", "پورٹل پر اپ لوڈ کا اندراج")}
            </h3>
            <div style={{ fontSize: "0.85rem", color: "#6c757d", marginBottom: "14px" }}>
              <strong>{uploadModalDoc.number} {uploadModalDoc.title}</strong>
            </div>

            {uploadModalError && (
              <div style={{ color: "#721c24", background: "#f8d7da", padding: "8px", borderRadius: "4px", marginBottom: "12px", fontSize: "0.85rem" }}>
                {uploadModalError}
              </div>
            )}

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.88rem" }}>
                {t("Uploaded On:", "اپ لوڈ کی تاریخ:")}
              </label>
              <input
                type="date"
                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.upload" : "phc_cpsa_documents.upload"}
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                style={{ width: "100%", padding: "6px" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.88rem" }}>
                {t("Portal Reference / Filename:", "پورٹل حوالہ یا فائل کا نام:")}
              </label>
              <input
                type="text"
                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.upload" : "phc_cpsa_documents.upload"}
                placeholder={t("e.g. ACK-2026-991 or 1.1-qualified-head.pdf", "مثلاً پورٹل رسید نمبر یا فائل کا نام")}
                value={portalRef}
                onChange={(e) => setPortalRef(e.target.value)}
                style={{ width: "100%", padding: "6px" }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.88rem" }}>
                {t("Note (Optional):", "نوٹ (اختیاری):")}
              </label>
              <textarea
                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.upload" : "phc_cpsa_documents.upload"}
                rows={2}
                placeholder={t("Additional remarks regarding upload...", "اضافی تفصیلات...")}
                value={uploadNote}
                onChange={(e) => setUploadNote(e.target.value)}
                style={{ width: "100%", padding: "6px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.upload" : "phc_cpsa_documents.upload"}
                onClick={() => setUploadModalDoc(null)}
                disabled={savingUpload}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                className="primary"
                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.upload" : "phc_cpsa_documents.upload"}
                onClick={handleSaveUpload}
                disabled={savingUpload}
              >
                {savingUpload ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Record Upload", "اندراج کریں")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Upload History */}
      {historyUploadDoc && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              maxWidth: "600px",
              width: "100%",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0 }}>
                {t("Upload History", "اپ لوڈ ہسٹری")} — {historyUploadDoc.number}
              </h3>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.upload" : "phc_cpsa_documents.upload"}
                onClick={() => setHistoryUploadDoc(null)}
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            {loadingHistory ? (
              <p>{t("Loading history...", "لوڈ ہو رہا ہے...")}</p>
            ) : uploadHistory.length === 0 ? (
              <p style={{ color: "#6c757d" }}>{t("No uploads recorded yet for this document.", "ابھی تک کوئی اپ لوڈ درج نہیں ہوا۔")}</p>
            ) : (
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
                      <th style={{ padding: "6px" }}>{t("Date", "تاریخ")}</th>
                      <th style={{ padding: "6px" }}>{t("Reference", "حوالہ")}</th>
                      <th style={{ padding: "6px" }}>{t("Note", "نوٹ")}</th>
                      <th style={{ padding: "6px" }}>{t("Recorded By", "درج کنندہ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadHistory.map((u) => (
                      <tr key={u.upload_id} style={{ borderBottom: "1px solid #e9ecef" }}>
                        <td style={{ padding: "6px" }}>{u.uploaded_on}</td>
                        <td style={{ padding: "6px" }}>{u.portal_reference || "-"}</td>
                        <td style={{ padding: "6px" }}>{u.note || "-"}</td>
                        <td style={{ padding: "6px" }}>{u.recorded_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Answer History */}
      {historyAnswerDoc && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              maxWidth: "650px",
              width: "100%",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0 }}>
                {t("Declaration Answers History", "اعلامیہ جوابات کی ہسٹری")} — {historyAnswerDoc.number}
              </h3>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "phc_cpsa_documents_inspector" ? "phc_cpsa_documents_inspector.declaration" : screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.declaration" : "phc_cpsa_documents.declaration"}
                onClick={() => setHistoryAnswerDoc(null)}
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            {loadingAnswerHistory ? (
              <p>{t("Loading answers...", "لوڈ ہو رہا ہے...")}</p>
            ) : answerHistory.length === 0 ? (
              <p style={{ color: "#6c757d" }}>{t("No manual confirmations recorded yet.", "ابھی تک کوئی باضابطہ تصدیق درج نہیں ہوئی۔")}</p>
            ) : (
              <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
                      <th style={{ padding: "6px" }}>{t("Question", "سوال")}</th>
                      <th style={{ padding: "6px" }}>{t("Answer", "جواب")}</th>
                      <th style={{ padding: "6px" }}>{t("Reason", "وجہ")}</th>
                      <th style={{ padding: "6px" }}>{t("Evidence", "ثبوت")}</th>
                      <th style={{ padding: "6px" }}>{t("By", "بذریعہ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {answerHistory.map((ans) => (
                      <tr key={ans.answer_id} style={{ borderBottom: "1px solid #e9ecef" }}>
                        <td style={{ padding: "6px" }}>{ans.question}</td>
                        <td style={{ padding: "6px", fontWeight: "bold" }}>
                          {ans.answer || t("Withdrawn", "واپس")}
                        </td>
                        <td style={{ padding: "6px" }}>{ans.reason}</td>
                        <td style={{ padding: "6px" }}>{ans.evidence || "-"}</td>
                        <td style={{ padding: "6px" }}>
                          {ans.decided_by_name}
                          <div style={{ fontSize: "0.7rem", color: "#6c757d" }}>{ans.decided_at.slice(0, 10)}</div>
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

      {/* MODAL: Services Declared (Annexure B, rule:e4b42e5a6c) */}
      {servicesModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              maxWidth: "850px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "8px",
              boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0 }}>
                {t("Declared Services (CPSA 1.2, Annexure B)", "ہسپتال کی منظور شدہ خدمات (ضمیمہ ب)")}
              </h3>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                onClick={() => setServicesModalOpen(false)}
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            {servicesError && (
              <div style={{ color: "#721c24", background: "#f8d7da", padding: "8px", borderRadius: "4px", marginBottom: "12px", fontSize: "0.85rem" }}>
                {servicesError}
              </div>
            )}

            {loadingServices ? (
              <p>{t("Loading declared services...", "خدمات لوڈ ہو رہی ہیں...")}</p>
            ) : servicesData ? (
              <div>
                {/* Services summary bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "8px 12px", borderRadius: "4px", marginBottom: "14px" }}>
                  <div>
                    <strong>{servicesData.declared}</strong> {t("listed services declared", "فہرست شدہ خدمات")} •{" "}
                    <strong>{otherServices.length}</strong> {t("custom (Others) lines", "اضافی خدمات")}
                    {servicesData.declared_by_name && (
                      <span style={{ marginLeft: "10px", fontSize: "0.8rem", color: "#6c757d" }}>
                        ({t("Last saved by", "آخری محفوظ کنندہ")}: {servicesData.declared_by_name})
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {servicesData.pdf_url && (
                      <button
                        type="button"
                        className="secondary"
                        data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                        onClick={() => handleDownloadPdf("services_pdf", servicesData.pdf_url, true)}
                        style={{ fontSize: "0.8rem", padding: "3px 8px" }}
                      >
                        📄 {t("PDF", "پی ڈی ایف")}
                      </button>
                    )}
                    {servicesData.xlsx_url && (
                      <button
                        type="button"
                        className="secondary"
                        data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                        onClick={() => handleOpenExternal(servicesData.xlsx_url)}
                        style={{ fontSize: "0.8rem", padding: "3px 8px" }}
                      >
                        📊 {t("Excel", "ایکسل")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Groups checklist */}
                {servicesData.groups.map((group) => (
                  <div key={group.group_name} style={{ marginBottom: "16px" }}>
                    <h4 style={{ margin: "0 0 8px 0", borderBottom: "1px solid #ced4da", paddingBottom: "4px" }}>
                      {group.label}
                    </h4>
                    <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #e9ecef", borderRadius: "4px", padding: "4px 8px" }}>
                      {group.services
                        .filter((s) => s.is_listed)
                        .map((s) => (
                          <div
                            key={s.service_name}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "4px 0",
                              borderBottom: "1px solid #f8f9fa",
                            }}
                          >
                            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
                              <input
                                type="checkbox"
                                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                                checked={declaredServiceState[s.service_name] ?? false}
                                onChange={(e) =>
                                  setDeclaredServiceState((prev) => ({
                                    ...prev,
                                    [s.service_name]: e.target.checked,
                                  }))
                                }
                              />
                              <span>{s.service_name}</span>
                            </label>
                            {declaredServiceState[s.service_name] && (
                              <input
                                type="text"
                                data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                                placeholder={t("Remarks (e.g. 24/7 or consultant)", "تبصرہ")}
                                value={serviceRemarks[s.service_name] ?? ""}
                                onChange={(e) =>
                                  setServiceRemarks((prev) => ({
                                    ...prev,
                                    [s.service_name]: e.target.value,
                                  }))
                                }
                                style={{ width: "200px", padding: "2px 6px", fontSize: "0.8rem" }}
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}

                {/* Others lines (is_listed: false) */}
                <div style={{ marginTop: "16px", borderTop: "2px solid #dee2e6", paddingTop: "12px" }}>
                  <h4 style={{ margin: "0 0 8px 0" }}>
                    {t("Custom Hospital Services ('Others' Lines):", "ہسپتال کی دیگر خدمات:")}
                  </h4>
                  {otherServices.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <span style={{ fontWeight: "bold", width: "180px", fontSize: "0.85rem" }}>
                        {item.service_name}
                      </span>
                      <span className="badge" style={{ background: "#e9ecef", color: "#495057", padding: "2px 6px" }}>
                        {item.group_name}
                      </span>
                      <span style={{ fontSize: "0.82rem", color: "#6c757d", flex: 1 }}>
                        {item.remarks || "-"}
                      </span>
                      <button
                        type="button"
                        className="secondary"
                        data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                        onClick={() =>
                          setOtherServices((prev) => prev.filter((_, i) => i !== idx))
                        }
                        style={{ padding: "2px 6px", color: "#dc3545", fontSize: "0.75rem" }}
                      >
                        ✕ {t("Remove", "حذف")}
                      </button>
                    </div>
                  ))}

                  {/* Add new Other line */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                      placeholder={t("Custom service name...", "خدمت کا نام...")}
                      value={newOtherName}
                      onChange={(e) => setNewOtherName(e.target.value)}
                      style={{ minWidth: "180px", padding: "4px 8px" }}
                    />
                    <select
                      data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                      value={newOtherGroup}
                      onChange={(e) => setNewOtherGroup(e.target.value as any)}
                      style={{ padding: "4px 8px" }}
                    >
                      <option value="MedicalAndAllied">{t("Medical and Allied", "میڈیکل")}</option>
                      <option value="SurgicalAndAllied">{t("Surgical and Allied", "سرجیکل")}</option>
                      <option value="Laboratory">{t("Laboratory", "لیبارٹری")}</option>
                      <option value="Imaging">{t("Imaging", "امیجنگ")}</option>
                    </select>
                    <input
                      type="text"
                      data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                      placeholder={t("Remarks...", "تبصرہ...")}
                      value={newOtherRemarks}
                      onChange={(e) => setNewOtherRemarks(e.target.value)}
                      style={{ minWidth: "150px", padding: "4px 8px" }}
                    />
                    <button
                      type="button"
                      className="secondary"
                      data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                      onClick={() => {
                        if (!newOtherName.trim()) return;
                        setOtherServices((prev) => [
                          ...prev,
                          {
                            service_name: newOtherName.trim(),
                            group_name: newOtherGroup,
                            remarks: newOtherRemarks.trim(),
                          },
                        ]);
                        setNewOtherName("");
                        setNewOtherRemarks("");
                      }}
                      style={{ padding: "4px 10px" }}
                    >
                      + {t("Add", "شامل کریں")}
                    </button>
                  </div>
                </div>

                {/* Save button */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="secondary"
                    data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                    onClick={() => setServicesModalOpen(false)}
                    disabled={savingServices}
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      className="primary"
                      data-help={screenId === "phc_cpsa_documents_owner" ? "phc_cpsa_documents_owner.services" : "phc_cpsa_documents.services"}
                      onClick={handleSaveServices}
                      disabled={savingServices}
                    >
                      {savingServices ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Services Declaration", "خدمات کا اعلان محفوظ کریں")}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
