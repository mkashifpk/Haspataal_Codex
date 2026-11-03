import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StationProfileOut,
  DirtyBedOut,
  ScanIn,
  BadgeScanResultOut,
  meBadgeStations,
  scanBadgeStationsScans,
} from "../generated/badge_station_kiosk";
import {
  StationConfig,
  DualScanState,
  OutcomeTone,
  validateStationSetup,
  maskStationKey,
  generateGatewayEventId,
  isBedCode,
  processDualScanInput,
  createInitialDualScanState,
  checkDebounce,
  formatScanOutcome,
  enqueueOfflineScan,
  dequeueOfflineScan,
  playOutcomeAudio,
  BADGE_STATION_ERROR_MESSAGES,
} from "../badge-station-kiosk-policy";
import { setStationKey } from "../bridge";

interface BadgeStationKioskProps {
  onOpenHelp?: () => void;
}

const STORAGE_KEY_CONFIG = "haspataal_station_config";
const STORAGE_KEY_OFFLINE_QUEUE = "haspataal_station_offline_queue";

export const BadgeStationKiosk: React.FC<BadgeStationKioskProps> = ({ onOpenHelp }) => {
  // Locale & Setup State
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [stationConfig, setStationConfig] = useState<StationConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.station_key) setStationKey(parsed.station_key);
        return parsed;
      }
    } catch {
      // Fall through
    }
    return { station_id: "W2-KIOSK", station_key: "station_secret_key_demo" };
  });

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [tempStationId, setTempStationId] = useState(stationConfig.station_id);
  const [tempStationKey, setTempStationKey] = useState(stationConfig.station_key);
  const [setupErrors, setSetupErrors] = useState<string[]>([]);

  // Station Profile State
  const [profile, setProfile] = useState<StationProfileOut | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Scanner Input & State
  const [scannerInputValue, setScannerInputValue] = useState("");
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [dualScanState, setDualScanState] = useState<DualScanState>(createInitialDualScanState);

  // Debounce & Last Scan
  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);

  // Flash Outcome State (rule:2554916922)
  const [flashOutcome, setFlashOutcome] = useState<{
    outcome: BadgeScanResultOut["outcome"];
    scan_id?: number;
    detail?: string | null;
  } | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);
  const flashTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Offline Queue State (rule:438ca845ec)
  const [offlineQueue, setOfflineQueue] = useState<ScanIn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);

  // Submission In-flight state
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Keep stationKey synchronized in bridge
  useEffect(() => {
    if (stationConfig.station_key) {
      setStationKey(stationConfig.station_key);
    }
  }, [stationConfig.station_key]);

  // Online / offline window listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Persist offline queue
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(offlineQueue));
    } catch {
      // Ignore storage errors
    }
  }, [offlineQueue]);

  // Load Station Profile
  const loadProfile = useCallback(async () => {
    if (!stationConfig.station_id) return;
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const data = await meBadgeStations({ station_id: stationConfig.station_id });
      setProfile(data);
    } catch (err: any) {
      const code = err?.response?.error?.code || err?.code;
      const msg =
        BADGE_STATION_ERROR_MESSAGES[code]?.[lang] ||
        err?.response?.error?.message ||
        err?.message ||
        "Failed to load station profile";
      setProfileError(msg);
    } finally {
      setLoadingProfile(false);
    }
  }, [stationConfig.station_id, lang]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Ensure scanner input remains focused (rule:141cb8255f)
  useEffect(() => {
    const focusScanner = () => {
      if (!setupModalOpen && !queueDrawerOpen) {
        scannerInputRef.current?.focus();
      }
    };
    focusScanner();
    const interval = setInterval(focusScanner, 2000);
    return () => clearInterval(interval);
  }, [setupModalOpen, queueDrawerOpen]);

  // Dual Scan 60s countdown timer (rule:b2f4ebb077)
  useEffect(() => {
    if (dualScanState.status === "waiting_for_badge" || dualScanState.status === "waiting_for_bed") {
      const timer = setInterval(() => {
        const now = Date.now();
        if (dualScanState.expires_at && now >= dualScanState.expires_at) {
          setDualScanState({
            status: "expired",
            bed_code: null,
            badge_code: null,
            started_at: null,
            expires_at: null,
            seconds_left: 0,
          });
          setGeneralError(
            lang === "ur"
              ? "اسکین کا وقت (60 سیکنڈ) ختم ہو گیا۔ برائے مہربانی دوبارہ اسکین کریں۔"
              : "60-second dual scan session timed out. Please scan again.",
          );
          playOutcomeAudio("danger");
        } else if (dualScanState.expires_at) {
          const secondsLeft = Math.max(0, Math.ceil((dualScanState.expires_at - now) / 1000));
          setDualScanState((prev) => ({ ...prev, seconds_left: secondsLeft }));
        }
      }, 500);
      return () => clearInterval(timer);
    }
  }, [dualScanState.status, dualScanState.expires_at, lang]);

  // Flash outcome 3s countdown & auto-dismiss (rule:2554916922)
  const triggerFlashOutcome = useCallback(
    (outcome: BadgeScanResultOut["outcome"], scanId?: number, detail?: string | null) => {
      setFlashOutcome({ outcome, scan_id: scanId, detail });
      setCountdownSeconds(3);

      const info = formatScanOutcome(outcome, lang);
      playOutcomeAudio(info.tone);

      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      countdownIntervalRef.current = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      flashTimerRef.current = setTimeout(() => {
        setFlashOutcome(null);
        setDualScanState(createInitialDualScanState());
        scannerInputRef.current?.focus();
      }, 3000);
    },
    [lang],
  );

  // Submit scan payload to server (or enqueue offline if server fails)
  const submitScan = async (badgeCode: string, bedCode?: string | null) => {
    setSubmitting(true);
    setGeneralError(null);

    const gatewayEventId = generateGatewayEventId(stationConfig.station_id);
    const payload: ScanIn = {
      station_id: stationConfig.station_id,
      badge_code: badgeCode,
      scanned_at: new Date().toISOString(),
      gateway_event_id: gatewayEventId,
      bed_code: bedCode || null,
    };

    if (!isOnline) {
      // Offline mode: queue locally
      setOfflineQueue((prev) => enqueueOfflineScan(payload, prev));
      triggerFlashOutcome("AttendanceIn", undefined, "Offline queued for sync");
      setSubmitting(false);
      return;
    }

    try {
      const result = await scanBadgeStationsScans(payload);
      triggerFlashOutcome(result.outcome, result.scan_id, result.detail);
      // If result altered dirty beds, reload station profile
      if (result.outcome === "BedCleaned" || result.outcome === "BedCleaningRecorded") {
        loadProfile();
      }
    } catch (err: any) {
      const code = err?.response?.error?.code || err?.code;
      // If network or server error, queue offline per rule:438ca845ec
      if (code === "OFFLINE" || !navigator.onLine || err?.name === "TypeError" || err?.status >= 500) {
        setOfflineQueue((prev) => enqueueOfflineScan(payload, prev));
        triggerFlashOutcome("AttendanceIn", undefined, "Offline queued: server unreachable");
      } else {
        const errorMsg =
          BADGE_STATION_ERROR_MESSAGES[code]?.[lang] ||
          err?.response?.error?.message ||
          err?.message ||
          "Scan submission failed";
        setGeneralError(errorMsg);
        triggerFlashOutcome("Rejected", undefined, errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle incoming scan (from USB scanner or manual entry)
  const handleScanCode = (scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return;

    // Check debounce
    const debounceSec = profile?.debounce_seconds ?? 3;
    if (!checkDebounce(lastScanRef.current, code, debounceSec)) {
      setGeneralError(
        lang === "ur"
          ? `ڈپلیکیٹ اسکین۔ براہ کرم ${debounceSec} سیکنڈ انتظار کریں۔`
          : `Duplicate scan ignored. Please wait ${debounceSec}s before scanning again.`,
      );
      playOutcomeAudio("warning");
      return;
    }
    lastScanRef.current = { code, timestamp: Date.now() };

    // Check if station requires two scans (needs_bed_code, rule:b2f4ebb077)
    if (profile?.needs_bed_code) {
      const { next, readyToSubmit, error } = processDualScanInput(
        dualScanState,
        code,
        profile.dirty_beds,
      );
      if (error) {
        setGeneralError(error);
        return;
      }
      setDualScanState(next);

      if (readyToSubmit && next.badge_code) {
        submitScan(next.badge_code, next.bed_code);
        setDualScanState(createInitialDualScanState());
      }
    } else {
      // Single scan station: direct submission
      submitScan(code, null);
    }
  };

  // Keyboard Enter handler on invisible / primary input
  const onScannerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = scannerInputValue;
      setScannerInputValue("");
      handleScanCode(code);
    }
  };

  // Sync offline queue items (rule:438ca845ec)
  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0 || syncingQueue) return;
    setSyncingQueue(true);
    setGeneralError(null);

    const pending = [...offlineQueue];
    for (const item of pending) {
      try {
        await scanBadgeStationsScans(item);
        setOfflineQueue((prev) => dequeueOfflineScan(item.gateway_event_id!, prev));
      } catch (err: any) {
        // If still unreachable, halt sync loop
        if (err?.code === "OFFLINE" || !navigator.onLine) {
          break;
        }
      }
    }
    setSyncingQueue(false);
    loadProfile();
  };

  // Save station setup (rule:f98f89a7b6)
  const handleSaveSetup = () => {
    const { valid, errors } = validateStationSetup(tempStationId, tempStationKey);
    if (!valid) {
      setSetupErrors(errors);
      return;
    }
    const newConfig: StationConfig = {
      station_id: tempStationId.trim(),
      station_key: tempStationKey.trim(),
    };
    setStationConfig(newConfig);
    setStationKey(newConfig.station_key);
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
    } catch {
      // Ignore
    }
    setSetupModalOpen(false);
    setSetupErrors([]);
    loadProfile();
  };

  // Format outcome styling
  const outcomeCard = flashOutcome ? formatScanOutcome(flashOutcome.outcome, lang) : null;

  return (
    <div
      className="badge-station-kiosk"
      data-help="badge_station_kiosk.container"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
        direction: lang === "ur" ? "rtl" : "ltr",
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* Top Kiosk Header Bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          backgroundColor: "#1e293b",
          borderBottom: "1px solid #334155",
        }}
        data-help="badge_station_kiosk.header"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            data-help="badge_station_kiosk.online_indicator"
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: isOnline ? "#22c55e" : "#ef4444",
              boxShadow: isOnline ? "0 0 10px #22c55e" : "0 0 10px #ef4444",
              border: "none",
              padding: 0,
              cursor: "default",
            }}
            title={isOnline ? "Server Online" : "Offline / Unreachable"}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "0.5px" }}>
              {lang === "ur" ? "بیج اسٹیشن کیوسک" : "Haspataal Badge Station Kiosk"}
            </h1>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
              {profile ? `${profile.label} (${profile.station_id})` : stationConfig.station_id} &bull;{" "}
              {profile ? profile.location_type : "Kiosk Terminal"} &bull;{" "}
              {profile ? profile.action_type : "Scan Ready"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Offline Queue Badge */}
          {offlineQueue.length > 0 && (
            <button
              onClick={() => setQueueDrawerOpen(true)}
              data-help="badge_station_kiosk.offline_queue_button"
              style={{
                backgroundColor: "#f59e0b",
                color: "#1e293b",
                border: "none",
                borderRadius: "6px",
                padding: "6px 14px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>{lang === "ur" ? "آف لائن کیو:" : "Offline Queue:"}</span>
              <span
                style={{
                  backgroundColor: "#ffffff",
                  color: "#d97706",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  fontWeight: 700,
                }}
              >
                {offlineQueue.length}
              </span>
            </button>
          )}

          {/* Bilingual Language Switcher */}
          <button
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
            data-help="badge_station_kiosk.lang_toggle"
            style={{
              backgroundColor: "#334155",
              color: "#f8fafc",
              border: "1px solid #475569",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "13px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {lang === "en" ? "اردو" : "English"}
          </button>

          {/* F1 Contextual Help */}
          <button
            onClick={onOpenHelp}
            data-help="badge_station_kiosk.f1_help_button"
            style={{
              backgroundColor: "#0284c7",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {lang === "ur" ? "مدد (F1)" : "Help (F1)"}
          </button>

          {/* Operator Setup Drawer Button */}
          <button
            onClick={() => {
              setTempStationId(stationConfig.station_id);
              setTempStationKey(stationConfig.station_key);
              setSetupModalOpen(true);
            }}
            data-help="badge_station_kiosk.setup_button"
            style={{
              backgroundColor: "#334155",
              color: "#f8fafc",
              border: "1px solid #475569",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "13px",
              cursor: "pointer",
            }}
            title="Configure Station ID & Key"
          >
            ⚙️ {lang === "ur" ? "ترتیبات" : "Setup"}
          </button>
        </div>
      </header>

      {/* Main Kiosk Hero Display Area */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          position: "relative",
        }}
        data-help="badge_station_kiosk.main_viewport"
        onClick={() => scannerInputRef.current?.focus()}
      >
        {/* Invisible scanner input kept focused for USB hardware typing (rule:141cb8255f) */}
        <input
          ref={scannerInputRef}
          type="text"
          value={scannerInputValue}
          onChange={(e) => setScannerInputValue(e.target.value)}
          onKeyDown={onScannerInputKeyDown}
          autoFocus
          data-help="badge_station_kiosk.scanner_input_hardware"
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
            top: 0,
            left: 0,
            height: "1px",
            width: "1px",
          }}
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Big Flash Outcome Modal / Overlay (rule:2554916922) */}
        {flashOutcome && outcomeCard && (
          <div
            data-help="badge_station_kiosk.flash_outcome_overlay"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: outcomeCard.isGreen
                ? "rgba(22, 101, 52, 0.95)"
                : outcomeCard.isRed
                  ? "rgba(153, 27, 27, 0.95)"
                  : "rgba(180, 83, 9, 0.95)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              animation: "fadeIn 0.2s ease-in-out",
              padding: "32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "96px",
                marginBottom: "24px",
              }}
            >
              {outcomeCard.isGreen ? "✓" : outcomeCard.isRed ? "✕" : "⚠"}
            </div>
            <h2
              style={{
                fontSize: "44px",
                fontWeight: 800,
                margin: "0 0 16px 0",
                color: "#ffffff",
                letterSpacing: "0.5px",
              }}
            >
              {outcomeCard.title}
            </h2>
            <p
              style={{
                fontSize: "24px",
                color: "#e2e8f0",
                maxWidth: "700px",
                margin: "0 0 24px 0",
                lineHeight: "1.4",
              }}
            >
              {outcomeCard.subtitle}
            </p>
            {flashOutcome.detail && (
              <div
                style={{
                  fontSize: "18px",
                  color: "#cbd5e1",
                  backgroundColor: "rgba(0,0,0,0.25)",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  marginBottom: "24px",
                }}
              >
                {flashOutcome.detail}
              </div>
            )}
            {/* 3-Second Countdown Ring */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "18px",
                color: "#f1f5f9",
                backgroundColor: "rgba(0,0,0,0.3)",
                padding: "10px 24px",
                borderRadius: "30px",
              }}
            >
              <span>{lang === "ur" ? "اگلے اسکین کے لیے تیار:" : "Ready for next scan in:"}</span>
              <strong style={{ fontSize: "24px", color: "#38bdf8" }}>{countdownSeconds}s</strong>
            </div>
          </div>
        )}

        {/* Central Kiosk Visual Card */}
        <div
          style={{
            maxWidth: "680px",
            width: "100%",
            backgroundColor: "#1e293b",
            borderRadius: "16px",
            padding: "40px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
            border: "1px solid #334155",
            textAlign: "center",
          }}
          data-help="badge_station_kiosk.central_card"
        >
          {/* Station Icon / Badge Hero */}
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              backgroundColor: "#0284c7",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
              margin: "0 auto 24px auto",
              boxShadow: "0 0 25px rgba(2, 132, 199, 0.4)",
            }}
          >
            🪪
          </div>

          <h2 style={{ fontSize: "32px", fontWeight: 700, margin: "0 0 8px 0" }}>
            {profile ? profile.label : lang === "ur" ? "بیج اسکین کریں" : "Please Present Your Badge"}
          </h2>
          <p style={{ fontSize: "18px", color: "#94a3b8", margin: "0 0 28px 0" }}>
            {profile?.needs_bed_code
              ? lang === "ur"
                ? "اس وارڈ اسٹیشن پر بیڈ کا کیو آر اسٹیکر اور عملے کا بیج دونوں اسکین کریں۔"
                : "This bed station requires scanning the Bed QR sticker and Staff Badge."
              : lang === "ur"
                ? "بار کوڈ یا RFID بیج کو اسکینر کے سامنے لائیں۔ لاگ اِن کی ضرورت نہیں۔"
                : "Hold your barcode or RFID card in front of the scanner. No keyboard needed."}
          </p>

          {/* Dual Scan Progress Banner (rule:b2f4ebb077) */}
          {profile?.needs_bed_code && (
            <div
              data-help="badge_station_kiosk.dual_scan_banner"
              style={{
                backgroundColor:
                  dualScanState.status === "waiting_for_badge" || dualScanState.status === "waiting_for_bed"
                    ? "#0369a1"
                    : "#334155",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "28px",
                textAlign: "left",
                direction: "ltr",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "16px", color: "#f8fafc" }}>
                  {dualScanState.status === "waiting_for_badge"
                    ? "✓ Bed Recorded! Now Scan Staff Badge"
                    : dualScanState.status === "waiting_for_bed"
                      ? "✓ Badge Recorded! Now Scan Bed Sticker"
                      : "Dual Scan Workflow Required"}
                </div>
                {(dualScanState.status === "waiting_for_badge" ||
                  dualScanState.status === "waiting_for_bed") && (
                  <div
                    style={{
                      backgroundColor: "#f43f5e",
                      color: "#ffffff",
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Expires in {dualScanState.seconds_left}s
                  </div>
                )}
              </div>

              {/* Progress Steps */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div
                  style={{
                    backgroundColor: dualScanState.bed_code ? "#166534" : "#1e293b",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #475569",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#cbd5e1" }}>Step 1: Bed QR Sticker</div>
                  <div style={{ fontWeight: 600, fontSize: "14px", marginTop: "2px" }}>
                    {dualScanState.bed_code ? `✓ ${dualScanState.bed_code}` : "Waiting for bed scan..."}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: dualScanState.badge_code ? "#166534" : "#1e293b",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #475569",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#cbd5e1" }}>Step 2: Staff Badge</div>
                  <div style={{ fontWeight: 600, fontSize: "14px", marginTop: "2px" }}>
                    {dualScanState.badge_code ? `✓ ${dualScanState.badge_code}` : "Waiting for badge..."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* On-screen / Manual Scanner Simulator Input (Accessible Fallback) */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "8px" }}>
              {lang === "ur"
                ? "اسکینر ٹیسٹنگ ان پٹ (یا یو ایس بی اسکینر کوڈ ٹائپ کریں):"
                : "Scanner simulation input (USB scanner types here automatically):"}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={scannerInputValue}
                onChange={(e) => setScannerInputValue(e.target.value)}
                onKeyDown={onScannerInputKeyDown}
                placeholder={lang === "ur" ? "کوڈ درج کریں اور Enter دبائیں..." : "Enter code and press Enter..."}
                data-help="badge_station_kiosk.manual_code_input"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: "16px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#f8fafc",
                  textAlign: "center",
                }}
              />
              <button
                onClick={() => {
                  const code = scannerInputValue;
                  setScannerInputValue("");
                  handleScanCode(code);
                }}
                disabled={!scannerInputValue.trim() || submitting}
                data-help="badge_station_kiosk.scan_submit_button"
                style={{
                  backgroundColor: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 20px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "..." : lang === "ur" ? "اسکین" : "Scan"}
              </button>
            </div>
          </div>

          {/* Quick Demo Scan Buttons for Testers */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              justifyContent: "center",
              marginTop: "16px",
            }}
            data-help="badge_station_kiosk.quick_scan_panel"
          >
            <span style={{ fontSize: "12px", color: "#64748b", alignSelf: "center" }}>
              {lang === "ur" ? "فوری ٹیسٹ:" : "Quick Test:"}
            </span>
            <button
              onClick={() => handleScanCode("EMP-1001")}
              data-help="badge_station_kiosk.demo_badge_1"
              style={{
                backgroundColor: "#334155",
                color: "#e2e8f0",
                border: "1px solid #475569",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Badge EMP-1001
            </button>
            <button
              onClick={() => handleScanCode("CARD-SWEEP-1")}
              data-help="badge_station_kiosk.demo_badge_2"
              style={{
                backgroundColor: "#334155",
                color: "#e2e8f0",
                border: "1px solid #475569",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Badge CARD-SWEEP-1
            </button>
            {profile?.needs_bed_code && (
              <button
                onClick={() => handleScanCode("HMS-BED-1")}
                data-help="badge_station_kiosk.demo_bed_1"
                style={{
                  backgroundColor: "#065f46",
                  color: "#d1fae5",
                  border: "1px solid #059669",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Bed HMS-BED-1
              </button>
            )}
          </div>

          {/* Errors or Notices */}
          {generalError && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #ef4444",
                color: "#fca5a5",
                borderRadius: "8px",
                padding: "10px 14px",
                marginTop: "20px",
                fontSize: "14px",
              }}
              data-help="badge_station_kiosk.error_banner"
            >
              {generalError}
            </div>
          )}
        </div>

        {/* Dirty Beds Quick Action Drawer (if station has dirty beds) */}
        {profile && profile.dirty_beds && profile.dirty_beds.length > 0 && (
          <div
            style={{
              maxWidth: "680px",
              width: "100%",
              marginTop: "24px",
              backgroundColor: "#1e293b",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid #334155",
            }}
            data-help="badge_station_kiosk.dirty_beds_card"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "16px", color: "#f8fafc" }}>
                {lang === "ur" ? "وارڈ میں صفائی کے منتظر بیڈز" : "Ward Beds Awaiting Sanitization"}
              </h3>
              <span
                style={{
                  backgroundColor: "#f59e0b",
                  color: "#1e293b",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {profile.dirty_beds.length} {lang === "ur" ? "بیڈز" : "Dirty Beds"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: "10px",
              }}
            >
              {profile.dirty_beds.map((bed) => (
                <button
                  key={bed.bed_id}
                  onClick={() => handleScanCode(`HMS-BED-${bed.bed_id}`)}
                  data-help="badge_station_kiosk.tap_bed_button"
                  style={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #f59e0b",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#f8fafc",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "14px", fontWeight: 700 }}>{bed.label}</div>
                  <div style={{ fontSize: "11px", color: "#f59e0b", marginTop: "2px" }}>
                    {bed.current_state}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Operator Setup Modal (rule:f98f89a7b6: never show the key) */}
      {setupModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          data-help="badge_station_kiosk.setup_modal"
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              borderRadius: "12px",
              padding: "28px",
              maxWidth: "480px",
              width: "100%",
              border: "1px solid #334155",
              color: "#f8fafc",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: 700 }}>
              {lang === "ur" ? "اسٹیشن کی ترتیبات (ایک بار تشکیل)" : "Station Setup (Configure Once)"}
            </h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 20px 0" }}>
              {lang === "ur"
                ? "اسٹیشن آئی ڈی اور خفیہ کلید درج کریں۔ کلید کو اسکرین پر کبھی ظاہر نہیں کیا جاتا۔"
                : "Configure once with Station ID and Station Key (X-Station-Key). The key is never shown on the kiosk screen."}
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", fontWeight: 600 }}>
                {lang === "ur" ? "اسٹیشن آئی ڈی:" : "Station ID:"}
              </label>
              <input
                type="text"
                value={tempStationId}
                onChange={(e) => setTempStationId(e.target.value)}
                placeholder="e.g. W2-KIOSK, GATE-1, BED-4"
                data-help="badge_station_kiosk.setup_station_id_input"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#f8fafc",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", fontWeight: 600 }}>
                {lang === "ur" ? "اسٹیشن خفیہ کلید (X-Station-Key):" : "Station Key (X-Station-Key):"}
              </label>
              <input
                type="password"
                value={tempStationKey}
                onChange={(e) => setTempStationKey(e.target.value)}
                placeholder="Station Secret Key"
                data-help="badge_station_kiosk.setup_station_key_input"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#f8fafc",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                Current: {maskStationKey(stationConfig.station_key)} (Masked per rule:f98f89a7b6)
              </div>
            </div>

            {setupErrors.length > 0 && (
              <div
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  color: "#fca5a5",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  fontSize: "13px",
                }}
              >
                {setupErrors.map((err, i) => (
                  <div key={i}>&bull; {err}</div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => setSetupModalOpen(false)}
                data-help="badge_station_kiosk.setup_cancel_button"
                style={{
                  backgroundColor: "#334155",
                  color: "#f8fafc",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {lang === "ur" ? "منسوخ" : "Cancel"}
              </button>
              <button
                onClick={handleSaveSetup}
                data-help="badge_station_kiosk.setup_save_button"
                style={{
                  backgroundColor: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {lang === "ur" ? "محفوظ کریں" : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Queue Drawer (rule:438ca845ec) */}
      {queueDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          data-help="badge_station_kiosk.queue_drawer"
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "540px",
              width: "100%",
              border: "1px solid #334155",
              color: "#f8fafc",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
                {lang === "ur" ? "آف لائن اسکین کیو (محفوظ شدہ)" : "Offline Scans Queue (Idempotent)"}
              </h3>
              <button
                onClick={() => setQueueDrawerOpen(false)}
                data-help="badge_station_kiosk.queue_close_button"
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px 0" }}>
              {lang === "ur"
                ? "سرور سے رابطہ بحال ہونے پر یہ تمام اسکینز ان کے اصلی ایونٹ آئی ڈی کے ساتھ خودکار بھیجے جائیں گے۔"
                : "These scans were buffered while offline with gateway_event_id. Retries are idempotent."}
            </p>

            <div style={{ flex: 1, overflowY: "auto", marginBottom: "16px" }}>
              {offlineQueue.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "24px" }}>
                  {lang === "ur" ? "کوئی آف لائن اسکین موجود نہیں" : "No queued scans"}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {offlineQueue.map((item, idx) => (
                    <div
                      key={item.gateway_event_id || idx}
                      style={{
                        backgroundColor: "#0f172a",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #334155",
                        fontSize: "13px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong>Badge: {item.badge_code}</strong>
                        <span style={{ color: "#38bdf8" }}>{item.bed_code ? `Bed: ${item.bed_code}` : "Single"}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                        ID: {item.gateway_event_id} &bull; Time: {item.scanned_at}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => setOfflineQueue([])}
                data-help="badge_station_kiosk.queue_clear_button"
                style={{
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 14px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {lang === "ur" ? "کیو صاف کریں" : "Clear Queue"}
              </button>
              <button
                onClick={syncOfflineQueue}
                disabled={syncingQueue || offlineQueue.length === 0}
                data-help="badge_station_kiosk.queue_sync_button"
                style={{
                  backgroundColor: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: syncingQueue ? "not-allowed" : "pointer",
                }}
              >
                {syncingQueue ? "Syncing..." : lang === "ur" ? "ابھی ہم آہنگ کریں" : "Sync Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Status Bar */}
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          backgroundColor: "#1e293b",
          borderTop: "1px solid #334155",
          fontSize: "12px",
          color: "#94a3b8",
        }}
        data-help="badge_station_kiosk.footer"
      >
        <div>
          <span>
            {lang === "ur" ? "اسٹیشن کلید:" : "Station Key:"} {maskStationKey(stationConfig.station_key)} (
            {lang === "ur" ? "محفوظ" : "Secured"})
          </span>
          <span style={{ margin: "0 8px" }}>&bull;</span>
          <span>
            {lang === "ur" ? "ڈیباؤنس:" : "Debounce:"} {profile?.debounce_seconds ?? 3}s
          </span>
        </div>
        <div>
          {lang === "ur"
            ? "کیوسک اسکینر موڈ فعال &bull; USB / کیمرہ ریڈر تیار"
            : "Kiosk Scanner Active &bull; Ready for USB / Camera scan"}
        </div>
      </footer>
    </div>
  );
};
