import React, { useState, useEffect, useCallback, useMemo } from "react";
import { idCard, whoami, type IdCardOut, type TerminalIdentityOut } from "../generated/id_card";
import {
  getIdCardCapabilityView,
  getCardPrinterStatus,
  formatCardSize,
  ID_CARD_ERROR_MESSAGES,
} from "../id-card-policy";

export interface IdCardProps {
  initialEmployeeId?: number;
  establishment?: any;
  permissions?: string[];
  currentUser?: {
    username?: string;
    role?: string;
    roles?: string[];
  };
  onOpenHelp?: (topic?: string) => void;
  onNavigateToStaff?: (employeeId?: number) => void;
}

export const IdCard: React.FC<IdCardProps> = ({
  initialEmployeeId,
  establishment,
  permissions = [],
  currentUser,
  onOpenHelp,
  onNavigateToStaff,
}) => {
  // Capability gating derived from establishment views
  const capability = useMemo(
    () => getIdCardCapabilityView(establishment),
    [establishment]
  );

  const canPrintPermission = permissions.includes("hr.idcard.print");

  // State management
  const [activeEmployeeId, setActiveEmployeeId] = useState<number | null>(initialEmployeeId ?? null);
  const [cardData, setCardData] = useState<IdCardOut | null>(null);
  const [loadingCard, setLoadingCard] = useState<boolean>(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Terminal & Card Printer hardware state (GET /terminals/whoami)
  const [terminalIdentity, setTerminalIdentity] = useState<TerminalIdentityOut | null>(null);
  const [loadingTerminal, setLoadingTerminal] = useState<boolean>(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);

  // Card view options
  const [cardSide, setCardSide] = useState<"front" | "back" | "both">("front");
  const [showBleedGuide, setShowBleedGuide] = useState<boolean>(true);
  const [cardTheme, setCardTheme] = useState<"standard" | "clinical" | "executive">("standard");

  // Printing state & recovery (idempotent reprint safety)
  const [printingStatus, setPrintingStatus] = useState<"idle" | "printing" | "success" | "failed">("idle");
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Fetch terminal identity and mapped card printer
  const loadTerminalIdentity = useCallback(async () => {
    setLoadingTerminal(true);
    setTerminalError(null);
    try {
      const identity = await whoami();
      setTerminalIdentity(identity);
    } catch (err: any) {
      console.warn("Could not load terminal identity:", err);
      setTerminalError(err?.message || "Failed to query terminal identity.");
    } finally {
      setLoadingTerminal(false);
    }
  }, []);

  // Fetch ID card designer payload for employee
  const loadCardData = useCallback(
    async (empId: number) => {
      if (!canPrintPermission) {
        setCardError(ID_CARD_ERROR_MESSAGES.FORBIDDEN.en);
        return;
      }

      setLoadingCard(true);
      setCardError(null);
      setPrintingStatus("idle");
      setPrintFeedback(null);

      try {
        const result = await idCard(empId);
        setCardData(result);
        setActiveEmployeeId(empId);
      } catch (err: any) {
        console.error("Failed to load staff ID card:", err);
        const code = err?.code || "VALIDATION_ERROR";
        const msg = ID_CARD_ERROR_MESSAGES[code]?.en || err?.message || "Failed to load ID card designer payload.";
        setCardError(msg);
        setCardData(null);
      } finally {
        setLoadingCard(false);
      }
    },
    [canPrintPermission]
  );

  // Initial load
  useEffect(() => {
    void loadTerminalIdentity();
    if (initialEmployeeId) {
      void loadCardData(initialEmployeeId);
    }
  }, [loadTerminalIdentity, loadCardData, initialEmployeeId]);

  // Printer status analysis
  const printerStatus = useMemo(
    () => getCardPrinterStatus(terminalIdentity),
    [terminalIdentity]
  );

  // Card print dispatch (with reprint safety)
  const handlePrintCard = () => {
    if (!capability.canPrintIdCard || !canPrintPermission || !cardData) {
      return;
    }

    setPrintingStatus("printing");
    setPrintFeedback("Dispatching CR80 card layout to card printer spooler...");

    try {
      // In web/desktop environment, trigger standard print dialog with CR80 dimensions
      // The browser / electron print handler prints the printable card section
      window.print();
      setPrintingStatus("success");
      setPrintFeedback(
        printerStatus.hasCardPrinter
          ? `Card successfully sent to ${printerStatus.printerName}. Verify card feeder on printer.`
          : "Card sent to system printer spooler. Ensure CR80 card stock (85.6mm x 54mm) is loaded in printer."
      );
    } catch (err: any) {
      console.error("Print card failed:", err);
      setPrintingStatus("failed");
      setPrintFeedback(ID_CARD_ERROR_MESSAGES.PRINT_FAILED.en);
    }
  };

  // Export card JSON payload for diagnostic or audit
  const handleExportJson = () => {
    if (!cardData) return;
    const blob = new Blob([JSON.stringify(cardData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `id-card-${cardData.fields?.emp_number || "staff"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-fluid py-3 id-card-workspace">
      {/* Print CSS styles to isolate only the card on physical PVC printer output */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #cr80-card-print-target, #cr80-card-print-target * {
            visibility: visible;
          }
          #cr80-card-print-target {
            position: fixed;
            left: 0;
            top: 0;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            border: none !important;
            width: 85.6mm !important;
            height: 54.0mm !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Context Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center pb-2 mb-3 border-bottom no-print">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h4 className="mb-0 fw-bold text-dark">Staff ID Card Designer & Print</h4>
            <span className="badge bg-primary">CR80 PVC (85.6 × 54.0 mm)</span>
            <span className="badge bg-secondary">Position 147</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Official staff credential card layout, dual barcode/QR rendering, photo verification, and thermal card printer output.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <span className="badge bg-light text-dark border">
            Operator: {currentUser?.username || "demo.hr"}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onOpenHelp?.("id_card")}
            data-help="id_card.btn_f1_help"
            title="Press F1 for Staff ID Card Handbook & Role FAQs"
          >
            F1 Help
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => activeEmployeeId && void loadCardData(activeEmployeeId)}
            disabled={loadingCard || !activeEmployeeId}
            data-help="id_card.btn_refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Capability Notification Banner if restricted */}
      {capability.noticeEn && (
        <div className="alert alert-warning py-2 mb-3 no-print d-flex align-items-center justify-content-between" role="alert">
          <div>
            <strong>Facility Mode: </strong>
            <span>{capability.noticeEn}</span>
          </div>
          <span className="badge bg-dark text-white text-uppercase">{capability.mode}</span>
        </div>
      )}

      {/* Terminal & Mapped Card Printer Bar */}
      <div className="card shadow-sm mb-3 border-light no-print">
        <div className="card-body py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="fw-semibold small text-uppercase text-secondary">
              Terminal Identity:
            </span>
            <span className={`badge ${printerStatus.statusBadgeClass}`}>
              {printerStatus.locationLabel}
            </span>
            <span className="small text-muted">
              {printerStatus.statusTextEn}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary py-0 px-2"
              onClick={() => void loadTerminalIdentity()}
              disabled={loadingTerminal}
              data-help="id_card.btn_check_printer"
              title="Query GET /terminals/whoami for mapped hardware"
            >
              {loadingTerminal ? "Checking..." : "Re-check Printer"}
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Left Column: Staff Search & Designer Options */}
        <div className="col-12 col-lg-4 no-print">
          {/* Staff Search Box */}
          <div className="card shadow-sm mb-3">
            <div className="card-header bg-white py-2">
              <strong className="text-dark small text-uppercase">1. Staff Employee Lookup</strong>
            </div>
            <div className="card-body">
              <button type="button" data-help="id_card.btn_load_card" onClick={() => onNavigateToStaff?.()}>
                Choose staff member / ملازم چنیں
              </button>
            </div>
          </div>

          {/* Card Presentation Settings */}
          <div className="card shadow-sm mb-3">
            <div className="card-header bg-white py-2">
              <strong className="text-dark small text-uppercase">2. Designer & Preview Options</strong>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label htmlFor="card-side-select" className="form-label small fw-semibold text-secondary">
                  Display Side
                </label>
                <select
                  id="card-side-select"
                  className="form-select form-select-sm"
                  value={cardSide}
                  onChange={(e) => setCardSide(e.target.value as any)}
                  data-help="id_card.select_orientation"
                >
                  <option value="front">Front Side Only (Official Credentials)</option>
                  <option value="back">Back Side Only (Policies & Emergency Contacts)</option>
                  <option value="both">Dual Sided (Front & Back Layouts)</option>
                </select>
              </div>

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="bleed-guide-toggle"
                    checked={showBleedGuide}
                    onChange={(e) => setShowBleedGuide(e.target.checked)}
                    data-help="id_card.btn_toggle_guide"
                  />
                  <label className="form-check-label small" htmlFor="bleed-guide-toggle">
                    Show Lanyard Slot & 2mm Bleed Guidelines
                  </label>
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label small fw-semibold text-secondary mb-1">
                  Card Theme Preset
                </label>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm flex-fill ${cardTheme === "standard" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setCardTheme("standard")}
                    data-help="id_card.btn_toggle_theme"
                  >
                    Hospital Navy
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-fill ${cardTheme === "clinical" ? "btn-success" : "btn-outline-success"}`}
                    onClick={() => setCardTheme("clinical")}
                    data-help="id_card.btn_theme_clinical"
                  >
                    Clinical Teal
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-fill ${cardTheme === "executive" ? "btn-dark" : "btn-outline-dark"}`}
                    onClick={() => setCardTheme("executive")}
                    data-help="id_card.btn_theme_executive"
                  >
                    Executive Slate
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Print Actions Box */}
          <div className="card shadow-sm mb-3">
            <div className="card-header bg-white py-2">
              <strong className="text-dark small text-uppercase">3. Card Printer Output</strong>
            </div>
            <div className="card-body">
              {!canPrintPermission && (
                <div className="alert alert-danger py-2 small mb-2" role="alert">
                  Permission 'hr.idcard.print' required to print ID cards.
                </div>
              )}

              <div className="d-grid gap-2">
                <button
                  type="button"
                  className="btn btn-success fw-bold"
                  onClick={handlePrintCard}
                  disabled={!cardData || !canPrintPermission || !capability.canPrintIdCard || loadingCard}
                  data-help="id_card.btn_print"
                >
                  Print to PVC Card Printer
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleExportJson}
                  disabled={!cardData}
                  data-help="id_card.btn_export_json"
                >
                  Download Designer JSON (Audit)
                </button>

                {printingStatus === "failed" && (
                  <button
                    type="button"
                    className="btn btn-outline-warning btn-sm"
                    onClick={handlePrintCard}
                    data-help="id_card.btn_reprint_recovery"
                  >
                    Reprint Card (Safe Retry)
                  </button>
                )}
              </div>

              {printFeedback && (
                <div
                  className={`alert ${
                    printingStatus === "failed"
                      ? "alert-danger"
                      : printingStatus === "success"
                      ? "alert-success"
                      : "alert-info"
                  } py-2 px-3 small mt-3 mb-0`}
                  role="alert"
                >
                  {printFeedback}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: High Fidelity CR80 Card Preview */}
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center no-print">
              <strong className="text-dark small text-uppercase">
                CR80 Standard Card Preview ({formatCardSize(cardData?.card_size_mm)})
              </strong>
              {cardData && (
                <span className="badge bg-light text-dark border">
                  Staff #{cardData.fields?.emp_number}
                </span>
              )}
            </div>

            <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center bg-light">
              {/* Error Display */}
              {cardError && (
                <div className="alert alert-danger w-100 mb-3" role="alert">
                  <strong>Error: </strong>
                  <span>{cardError}</span>
                </div>
              )}

              {/* Loading Display */}
              {loadingCard && (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-2" role="status" />
                  <div className="text-muted small">Loading official card payload from server...</div>
                </div>
              )}

              {/* Empty State */}
              {!loadingCard && !cardData && !cardError && (
                <div className="text-center py-5 text-muted">
                  <div className="fs-1 mb-2">💳</div>
                  <h6>No Staff ID Card Loaded</h6>
                  <p className="small mb-0">
                    Enter a staff employee identifier on the left and click "Load Card" to preview the official PVC layout.
                  </p>
                </div>
              )}

              {/* Printable Card Target Container */}
              {!loadingCard && cardData && (
                <div className="d-flex flex-column align-items-center gap-4">
                  {/* Front Side */}
                  {(cardSide === "front" || cardSide === "both") && (
                    <div
                      id="cr80-card-print-target"
                      className="card shadow border-2 border-dark rounded-3 overflow-hidden position-relative"
                      style={{
                        width: "428px",
                        height: "270px",
                        backgroundColor: "#ffffff",
                        boxSizing: "border-box",
                        position: "relative",
                      }}
                    >
                      {/* Lanyard punch guide overlay */}
                      {showBleedGuide && (
                        <div
                          className="position-absolute no-print"
                          style={{
                            top: "6px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "32px",
                            height: "6px",
                            borderRadius: "3px",
                            border: "1px dashed #adb5bd",
                            backgroundColor: "rgba(255,255,255,0.7)",
                            zIndex: 10,
                          }}
                          title="Lanyard Slot Area (14mm x 3mm)"
                        />
                      )}

                      {/* Header Ribbon */}
                      <div
                        className={`text-white px-3 py-2 text-center ${
                          cardTheme === "clinical"
                            ? "bg-success"
                            : cardTheme === "executive"
                            ? "bg-dark"
                            : "bg-primary"
                        }`}
                        style={{ borderBottom: "3px solid #f1c40f" }}
                      >
                        <div
                          className="fw-bold fs-6 text-uppercase"
                          style={{ letterSpacing: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {cardData.fields?.hospital_name || "HASPATAAL GENERAL HOSPITAL"}
                        </div>
                        <div className="small opacity-75" style={{ fontSize: "10px", letterSpacing: "0.5px" }}>
                          STAFF IDENTITY CARD &bull; پاسپورٹ برائے ملازم
                        </div>
                      </div>

                      {/* Card Content Body */}
                      <div className="p-3 d-flex flex-column justify-content-between" style={{ height: "calc(100% - 46px)" }}>
                        <div className="row g-2 align-items-start">
                          {/* Photo Frame & Blood Group */}
                          <div className="col-4 text-center">
                            <div
                              className="border border-2 border-secondary rounded overflow-hidden d-flex align-items-center justify-content-center bg-light shadow-sm"
                              style={{ width: "95px", height: "115px", margin: "0 auto" }}
                            >
                              {cardData.fields?.photo_document_id ? (
                                <img
                                  src={`/api/v1/hr/employee-documents/${cardData.fields.photo_document_id}/download`}
                                  alt="Staff Photograph"
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  onError={(e) => {
                                    // Fallback if image fails to render
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="text-muted text-center p-1">
                                  <div className="fs-3 mb-1">👤</div>
                                  <div style={{ fontSize: "10px" }}>PHOTO</div>
                                </div>
                              )}
                            </div>

                            {/* Blood Group Badge */}
                            {cardData.fields?.blood_group && (
                              <span className="badge bg-danger mt-1 text-uppercase" style={{ fontSize: "11px" }}>
                                {cardData.fields.blood_group}
                              </span>
                            )}
                          </div>

                          {/* Staff Credentials Details */}
                          <div className="col-8 ps-2">
                            <h5 className="mb-0 fw-bold text-dark text-truncate" style={{ fontSize: "16px" }}>
                              {cardData.fields?.full_name}
                            </h5>
                            <div className="fw-semibold text-primary text-truncate" style={{ fontSize: "13px" }}>
                              {cardData.fields?.designation}
                            </div>
                            <div className="text-muted text-truncate" style={{ fontSize: "11px" }}>
                              {cardData.fields?.department || "Hospital Administration"}
                            </div>

                            <div className="mt-2" style={{ fontSize: "11px", lineHeight: "1.4" }}>
                              <div>
                                <span className="text-muted">EMP ID: </span>
                                <strong className="font-monospace text-dark">{cardData.fields?.emp_number}</strong>
                              </div>
                              {cardData.fields?.license && (
                                <div>
                                  <span className="text-muted">Licence: </span>
                                  <span className="font-monospace text-dark">{cardData.fields.license}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-muted">Joined: </span>
                                <span className="text-dark">{cardData.fields?.joined_on || "—"}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Barcode & QR Row */}
                        <div className="border-top pt-1 d-flex justify-content-between align-items-center">
                          {/* Barcode SVG */}
                          {cardData.barcode_svg ? (
                            <div
                              className="overflow-hidden"
                              style={{ maxHeight: "36px", maxWidth: "230px" }}
                              dangerouslySetInnerHTML={{ __html: cardData.barcode_svg }}
                            />
                          ) : (
                            <span className="text-muted small">No barcode SVG</span>
                          )}

                          {/* QR Code SVG */}
                          {cardData.qr_svg ? (
                            <div
                              style={{ width: "38px", height: "38px" }}
                              dangerouslySetInnerHTML={{ __html: cardData.qr_svg }}
                            />
                          ) : (
                            <span className="text-muted small">No QR</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Access QR Badge Notice per Rule rule:1cc0496368 */}
                  {cardData.badge && (
                    <div className="card border-success shadow-sm p-3 w-100" style={{ maxWidth: "428px" }}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <strong className="text-success small text-uppercase">
                          Active Security Badge QR (rule:1cc0496368)
                        </strong>
                        <span className="badge bg-success font-monospace">
                          {cardData.badge.badge_code}
                        </span>
                      </div>
                      <p className="text-muted small mb-2">
                        This staff member holds an issued Barcode credential. Terminal barcode scanners scan this QR for physical door and attendance access without RFID hardware.
                      </p>
                      <div className="d-flex align-items-center justify-content-center gap-3 bg-light p-2 rounded">
                        {cardData.badge.qr_svg && (
                          <div
                            className="bg-white p-1 rounded border shadow-sm"
                            style={{ width: "70px", height: "70px" }}
                            dangerouslySetInnerHTML={{ __html: cardData.badge.qr_svg }}
                          />
                        )}
                        {cardData.badge.barcode_svg && (
                          <div
                            className="bg-white p-1 rounded border shadow-sm overflow-hidden"
                            style={{ maxHeight: "50px", maxWidth: "220px" }}
                            dangerouslySetInnerHTML={{ __html: cardData.badge.barcode_svg }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Back Side Layout */}
                  {(cardSide === "back" || cardSide === "both") && (
                    <div
                      className="card shadow border-2 border-secondary rounded-3 overflow-hidden position-relative p-3"
                      style={{
                        width: "428px",
                        height: "270px",
                        backgroundColor: "#fcfcfc",
                        boxSizing: "border-box",
                      }}
                    >
                      <div className="text-center border-bottom pb-2 mb-2">
                        <strong className="text-dark small text-uppercase d-block">
                          Hospital Policy & Emergency Information
                        </strong>
                        <span className="text-muted" style={{ fontSize: "10px" }}>
                          قوانین ہسپتال اور ہنگامی رابطے
                        </span>
                      </div>

                      <div style={{ fontSize: "11px", lineHeight: "1.4" }} className="text-secondary">
                        <p className="mb-1">
                          1. This card is the property of {cardData.fields?.hospital_name || "Haspataal"}. It must be worn visibly at all times within clinical and administrative premises.
                        </p>
                        <p className="mb-1">
                          2. Lost or stolen cards must be reported immediately to HR & IT Administration for revocation.
                        </p>
                        <p className="mb-1">
                          3. If found, please return to Human Resources Department or deposit in the nearest secure mailbox.
                        </p>
                      </div>

                      <div className="mt-auto border-top pt-2 d-flex justify-content-between align-items-center" style={{ fontSize: "10px" }}>
                        <div>
                          <strong>Security Helpline: </strong>
                          <span>042-111-HOSP-EMERGENCY</span>
                        </div>
                        <div>
                          <strong>HR Extension: </strong>
                          <span>Ext. 204</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCard;
