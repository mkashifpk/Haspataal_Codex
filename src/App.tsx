import { useCallback, useEffect, useRef, useState } from "react";
import { api, call, resetRequests } from "./bridge";
import type { MeOut, LicenseStatusOut, HealthOut } from "./generated/login";
import type { EstablishmentOut } from "./generated/facility_profile";
import type { HandbookOut } from "./generated/help_center";
import { Details, ErrorBox, Field, Modal } from "./components";
import { Connection } from "./screens/Connection";
import { Login, ChangePassword } from "./screens/Login";
import { Settings, TerminalIdentity } from "./screens/Settings";
import {
  CriticalNotificationToast,
  Notifications,
} from "./screens/Notifications";
import { Approvals } from "./screens/Approvals";
import { Facility } from "./screens/Facility";
import { Incidents } from "./screens/Incidents";
import { CashShift } from "./screens/CashShift";
import { PatientSearch } from "./screens/PatientSearch";
import { Registration } from "./screens/Registration";
import { QueueManagement } from "./screens/QueueManagement";
import { RefundRequests } from "./screens/RefundRequests";
import { CashBack } from "./screens/CashBack";
import { PatientDocuments } from "./screens/PatientDocuments";
import { Tariff } from "./screens/Tariff";
import { Help } from "./screens/Help";
import { setLanguage, tr } from "./i18n";
import { hasUnsavedChanges } from "./unsaved";
const labels: Record<string, [string, string, string]> = {
  app_shell: ["Workspace home", "کام کی جگہ", "⌂"],
  workspace_picker: ["Workspaces", "کام کی جگہیں", "▦"],
  notifications: ["Notifications", "اطلاعات", "◷"],
  approval_queue: ["Approvals", "منظوریاں", "✓"],
  charity_approvals: ["Charity approvals", "فلاحی منظوری", "♡"],
  my_cash_shift: ["My cash shift", "میری کیش شفٹ", "₨"],
  queue_management: ["Queue management", "قطاروں کا انتظام", "≡"],
  refund_waiver_credit: [
    "Refund / waiver / credit",
    "واپسی، رعایت اور ادھار",
    "↩",
  ],
  cash_back_prompts: ["Cash-back", "رقم کی واپسی", "₨"],
  patient_search: ["Patient search", "مریض کی تلاش", "⌕"],
  patient_documents: ["Patient document vault", "مریض کی دستاویزات", "▤"],
  tariff_display: ["Tariff", "نرخ نامہ", "₨"],
  registration: [
    "New registration + OPD slip",
    "نئی رجسٹریشن اور او پی ڈی پرچی",
    "+",
  ],
  report_incident: ["Report an incident", "واقعے کی رپورٹ", "!"],
  facility_profile: ["Facility & services", "ہسپتال اور خدمات", "▤"],
  settings: ["Settings", "ترتیبات", "⚙"],
};
const frontDeskScreens = new Set([
  "queue_management",
  "refund_waiver_credit",
  "cash_back_prompts",
  "patient_documents",
  "tariff_display",
]);
export function App() {
  const [user, setUser] = useState<MeOut | null>(null),
    [server, setServer] = useState<any>(),
    [connected, setConnected] = useState(false),
    [prefs, setPrefs] = useState<any>({
      language: "en",
      theme: "Light",
      ui_scale_pct: 100,
      pdf_download: "Separate",
    }),
    [workspace, setWorkspace] = useState<string | null>(null),
    [screen, setScreen] = useState("connect_server"),
    [license, setLicense] = useState<LicenseStatusOut>(),
    [loginHealth, setLoginHealth] = useState<HealthOut>(),
    [healthError, setHealthError] = useState<unknown>(),
    [est, setEst] = useState<EstablishmentOut>(),
    [outline, setOutline] = useState<HandbookOut>(),
    [meta, setMeta] = useState<any>(),
    [unread, setUnread] = useState<number>(),
    [revision, setRevision] = useState(0),
    [stream, setStream] = useState("Connecting"),
    [error, setError] = useState<unknown>(),
    [helpOpen, setHelpOpen] = useState(false),
    [helpPage, setHelpPage] = useState<string>(),
    [infoOpen, setInfoOpen] = useState(false),
    [logoutOpen, setLogoutOpen] = useState(false),
    [logoutBusy, setLogoutBusy] = useState(false),
    [maintenance, setMaintenance] = useState<any>(),
    [critical, setCritical] = useState<any>(),
    [criticalNotices, setCriticalNotices] = useState<any[]>([]),
    [notice, setNotice] = useState(""),
    [booting, setBooting] = useState(true),
    [clock, setClock] = useState(Date.now());
  const [sessionRecovery, setSessionRecovery] = useState<string | null>(null),
    [sessionPassword, setSessionPassword] = useState(""),
    [sessionBusy, setSessionBusy] = useState(false),
    [sessionError, setSessionError] = useState<unknown>();
  const reauthFlight = useRef(false);
  const logoutFlight = useRef(false);
  const first = useRef(true),
    loaded = useRef(false),
    liveState = useRef({ user, workspace, screen });
  liveState.current = { user, workspace, screen };
  const ur = prefs.language === "ur";
  setLanguage(prefs.language);
  const t = (en: string, urText: string) => (ur ? urText : en);
  const refreshState = useCallback(async () => {
    try {
      const s = await call("state");
      setServer(s.server);
      setConnected(s.connected);
      setUser(s.user);
      setWorkspace(s.workspace);
      setPrefs(s.prefs);
      setSessionRecovery(s.sessionRecovery || null);
      if (first.current) {
        first.current = false;
        setScreen(
          !s.server
            ? "connect_server"
            : s.user
              ? s.workspace
                ? "app_shell"
                : "workspace_picker"
              : "login",
        );
      }
    } catch (e) {
      setError(e);
    } finally {
      setBooting(false);
    }
  }, []);
  const refreshData = useCallback(async () => {
    const current = liveState.current;
    if (!current.user || current.user.must_change_password) return;
    try {
      const [
        establishment,
        handbook,
        settings,
        count,
        me,
        permittedWorkspaces,
      ] = await Promise.all([
        api<EstablishmentOut>("GET", "/establishment"),
        api<HandbookOut>(
          "GET",
          "/meta/handbook" +
            (current.workspace
              ? "?workspace=" + encodeURIComponent(current.workspace)
              : ""),
        ),
        api("GET", "/meta/settings"),
        api<{ unread: number }>("GET", "/notifications/unread-count"),
        api<MeOut>("GET", "/auth/me"),
        api<MeOut["workspaces"]>("GET", "/auth/workspaces"),
      ]);
      if (
        liveState.current.user?.user_id !== current.user.user_id ||
        liveState.current.workspace !== current.workspace
      )
        return;
      setEst(establishment);
      setOutline(handbook);
      setMeta(settings);
      setUnread(count.unread);
      setUser({ ...me, workspaces: permittedWorkspaces });
      setPrefs(me.preferences);
      setMaintenance(
        settings.maintenance_mode
          ? { message: "Hospital maintenance is in progress." }
          : undefined,
      );
      if (!loaded.current) {
        loaded.current = true;
        await Promise.all([
          api("GET", "/meta/enums"),
          api("GET", "/meta/workspaces"),
          api("GET", "/meta/error-codes"),
          api("GET", "/meta/events"),
        ]);
        const available = permittedWorkspaces.filter(
          (w) =>
            establishment.views.workspaces.find((v) => v.workspace === w.code)
              ?.view !== "hidden",
        );
        if (
          !current.workspace &&
          ["login", "workspace_picker", "app_shell"].includes(
            liveState.current.screen,
          )
        ) {
          if (available.length === 1) {
            await call("workspace", { code: available[0].code });
            setWorkspace(available[0].code);
            setScreen(currentScreen => ["login", "workspace_picker", "app_shell"].includes(currentScreen) ? "app_shell" : currentScreen);
          } else {
            setScreen("workspace_picker");
          }
        }
      }
      if (
        current.workspace &&
        (!me.workspaces.some((w) => w.code === current.workspace) ||
          establishment.views.workspaces.some(
            (v) => v.workspace === current.workspace && v.view === "hidden",
          ))
      ) {
        await call("workspace", { code: null });
        setWorkspace(null);
        setScreen("workspace_picker");
      }
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => {
    void refreshState();
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [refreshState]);
  useEffect(() => {
    if (!window.terminal) return;
    return window.terminal.subscribe((e) => {
      if (e.type === "login") {
        if (e.license) setLicense(e.license);
        loaded.current = false;
        setUser(e.user);
        setScreen(e.user.must_change_password ? "login" : "app_shell");
        setSessionRecovery(null);
      }
      if (e.type === "session-recovery") {
        setSessionPassword("");
        setSessionRecovery(e.message);
      }
      if (e.type === "session-restored") {
        setSessionRecovery(null);
        setSessionPassword("");
        setSessionError(undefined);
        setUser(e.user);
        if (e.user.must_change_password) setScreen("login");
        void refreshData();
      }
      if (e.type === "logout") {
        setSessionRecovery(null);
        setSessionPassword("");
        resetRequests();
        loaded.current = false;
        setUser(null);
        setEst(undefined);
        setOutline(undefined);
        setMeta(undefined);
        setUnread(undefined);
        setWorkspace(null);
        setCritical(undefined);
        setCriticalNotices([]);
        setMaintenance(undefined);
        setHelpOpen(false);
        setHelpPage(undefined);
        setLogoutOpen(false);
        setScreen("login");
        setNotice(e.reason);
        void refreshState();
      }
      if (e.type === "prefs") setPrefs({ ...e.prefs });
      if (e.type === "connection") setConnected(e.connected);
      if (e.type === "permissions") {
        setOutline(undefined);
        setHelpOpen(false);
        setHelpPage(undefined);
        setUser(e.user);
        void refreshData();
      }
      if (e.type === "error")
        setError(new Error(e.error?.message || "Terminal error"));
      if (e.type === "stream") {
        setStream(e.status);
        if (e.resync) {
          setRevision((n) => n + 1);
          void refreshData();
        }
      }
      if (e.type === "event") {
        setRevision((n) => n + 1);
        if (e.event_type === "system.license") {
          // The documented DEV fixture belongs to this authenticated socket;
          // an ordinary REST read would erase it with the global DEV state.
          if (e.simulated === true && e.event_id < 0) setLicense(e.payload);
          else
            void api<LicenseStatusOut>("GET", "/meta/license")
              .then(setLicense)
              .catch(setError);
        }
        if (["system.license", "system.maintenance"].includes(e.event_type)) {
          loaded.current = false;
          void refreshData();
        }
        if (e.event_type === "system.maintenance")
          setMaintenance(
            e.payload.enabled || e.payload.maintenance_mode
              ? e.payload
              : undefined,
          );
        if (e.event_type === "admission.code_red")
          setCritical({ kind: "code_red", ...e.payload });
        if (
          e.event_type === "notification.created" &&
          e.payload.severity === "critical"
        )
          setCriticalNotices((current) => [
            ...current.filter(
              (n) => n.notification_id !== e.payload.notification_id,
            ),
            { ...e.payload, id: e.event_id },
          ]);
        if (
          [
            "establishment.changed",
            "notification.created",
            "approval.resolved",
          ].includes(e.event_type)
        )
          void refreshData();
      }
    });
  }, [refreshData, refreshState]);
  useEffect(() => {
    if (user && !user.must_change_password) {
      void call("stream").catch(setError);
      void refreshData();
    }
  }, [user?.user_id, user?.must_change_password, workspace, refreshData]);
  useEffect(() => {
    if (!server) return;
    let cancelled = false;
    const read = () =>
      api<LicenseStatusOut>("GET", "/meta/license")
        .then((v) => {
          if (!cancelled) setLicense(v);
        })
        .catch((e) => {
          if (!cancelled) setError(e);
        });
    void read();
    const id = setInterval(
      read,
      license?.reason?.startsWith("standby_") ? 30000 : 600000,
    );
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [server?.current, !!license?.reason?.startsWith("standby_"), user?.user_id]);
  useEffect(() => {
    if (user || !server) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setLoginHealth(undefined);
    setHealthError(undefined);
    const ping = async () => {
      try {
        await api("GET", "/health/live");
        const health = await api<HealthOut>("GET", "/health");
        if (!cancelled) {
          setLoginHealth(health);
          setHealthError(undefined);
        }
      } catch (e) {
        if (!cancelled) {
          setLoginHealth(undefined);
          setHealthError(e);
        }
      } finally {
        if (!cancelled) timer = setTimeout(ping, 5000);
      }
    };
    void ping();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.user_id, server?.current]);
  useEffect(() => {
    document.documentElement.lang = prefs.language;
    document.documentElement.dir = ur ? "rtl" : "ltr";
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs, ur]);
  useEffect(() => {
    const deepLink = () => {
      if (!window.location.hash.startsWith("#help/")) return;
      try {
        const requested = decodeURIComponent(window.location.hash.slice(6));
        setHelpPage(
          requested.startsWith("screens/") ? requested.slice(8) : requested,
        );
        setHelpOpen(true);
      } catch {
        setError(new Error("This handbook link is invalid."));
      }
    };
    window.addEventListener("hashchange", deepLink);
    deepLink();
    return () => window.removeEventListener("hashchange", deepLink);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setHelpPage(undefined);
        setHelpOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        if (navigate("settings")) setLogoutOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "0"].includes(e.key))
        e.preventDefault();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  const dirty = hasUnsavedChanges;
  async function signOut(all: boolean) {
    if (logoutFlight.current) return;
    if (document.querySelector('[data-write-pending="true"]')) {
      setNotice(
        t(
          "Wait for the pending action to finish.",
          "جاری عمل مکمل ہونے کا انتظار کریں۔",
        ),
      );
      return;
    }
    if (
      dirty() &&
      !window.confirm(
        t(
          "Sign out and discard unsaved input?",
          "سائن آؤٹ کرکے غیر محفوظ اندراج ختم کریں؟",
        ),
      )
    )
      return;
    logoutFlight.current = true;
    setLogoutBusy(true);
    try {
      await call("logout", { all });
    } catch (cause) {
      // Revocation can arrive before the HTTP reply. A server-ended session
      // is already closed; do not attach an old logout error to a new login.
      if (liveState.current.user) setError(cause);
    } finally {
      logoutFlight.current = false;
      setLogoutBusy(false);
    }
  }
  function navigate(next: string) {
    if (sessionRecovery) return false;
    const required: Record<string, string[]> = {
      facility_profile: ["establishment.manage"],
      report_incident: ["incident.report"],
      patient_search: ["patient.search", "patient.view"],
      patient_documents: ["patient.document.view", "patient.document.upload"],
      registration: ["opd.ticket.create"],
      my_cash_shift: ["finance.shift.operate"],
      queue_management: ["opd.queue.view", "opd.ticket.view"],
      refund_waiver_credit: ["opd.ticket.view", "opd.queue.doctor"],
      cash_back_prompts: ["opd.ticket.view", "opd.queue.doctor"],
    };
    if (
      (frontDeskScreens.has(next) &&
        !outline?.workspaces.some((w) =>
          w.screens.some((s) => s.id === next),
        )) ||
      est?.views.screens.some(
        (v) => v.screen_id === next && v.view === "hidden",
      ) ||
      (required[next] &&
        !required[next].some((p) => user?.permissions.includes(p)))
    ) {
      setNotice(
        tr(
          "This screen is not available with your current permissions and hospital services.",
        ),
      );
      return false;
    }
    if (
      next !== screen &&
      document.querySelector('[data-write-pending="true"]')
    ) {
      setNotice(
        "Finish or retry the pending action before leaving this screen.",
      );
      return false;
    }
    if (
      next !== screen &&
      dirty() &&
      !window.confirm("Leave this screen and discard unsaved input?")
    )
      return false;
    setScreen(next);
    setError(undefined);
    setNotice("");
    return true;
  }
  async function selectWorkspace(code: string, newWindow = false) {
    if (!newWindow && document.querySelector('[data-write-pending="true"]')) {
      setNotice(
        "Finish or retry the pending action before changing workspace.",
      );
      return;
    }
    try {
      if (
        !newWindow &&
        dirty() &&
        !window.confirm("Discard unsaved input and switch workspace?")
      )
        return;
      await call("workspace", { code, newWindow });
      if (!newWindow) {
        setOutline(undefined);
        setWorkspace(code);
        if (liveState.current.screen === "workspace_picker") {
          setScreen("app_shell");
        }
      }
    } catch (e) {
      setError(e);
    }
  }
  function route(url: string) {
    const normalized = url
      .replace(/^\//, "")
      .replaceAll("-", "_")
      .split(/[/?]/)[0];
    const known: Record<string, string> = {
      approvals: "approval_queue",
      notifications: "notifications",
      incidents: "report_incident",
      settings: "settings",
      establishment: "facility_profile",
      cash_shifts: "my_cash_shift",
      my_cash_shift: "my_cash_shift",
      patients: "patient_search",
      patient_search: "patient_search",
      registration: "registration",
      registrations: "registration",
      opd_queues: "queue_management",
      queue_management: "queue_management",
      refund_waiver_credit: "refund_waiver_credit",
      cash_back_prompts: "cash_back_prompts",
    };
    if (known[normalized]) navigate(known[normalized]);
    else setNotice("The related destination is outside this foundation build.");
  }
  const workspaceName = user?.workspaces.find((w) => w.code === workspace);
  const visible =
    user?.workspaces.filter(
      (w) =>
        est?.views.workspaces.find((v) => v.workspace === w.code)?.view !==
        "hidden",
    ) || [];
  const nav = [
    "app_shell",
    "workspace_picker",
    "notifications",
    "approval_queue",
    ...(workspace === "zakat" ? ["charity_approvals"] : []),
    ...(user?.permissions.includes("finance.shift.operate")
      ? ["my_cash_shift"]
      : []),
    ...(user?.permissions.includes("patient.search") ||
    user?.permissions.includes("patient.view")
      ? ["patient_search"]
      : []),
    ...(user?.permissions.includes("patient.document.view") || user?.permissions.includes("patient.document.upload")
      ? ["patient_documents"]
      : []),
    "tariff_display",
    ...(workspace === "reception" &&
    user?.permissions.includes("opd.ticket.create")
      ? ["registration"]
      : []),
    ...(user?.permissions.includes("opd.queue.view") ||
    user?.permissions.includes("opd.ticket.view")
      ? ["queue_management"]
      : []),
    ...(user?.permissions.includes("opd.ticket.view") ||
    user?.permissions.includes("opd.queue.doctor")
      ? ["refund_waiver_credit", "cash_back_prompts"]
      : []),
    ...(user?.permissions.includes("incident.report")
      ? ["report_incident"]
      : []),
    ...(user?.permissions.includes("establishment.manage")
      ? ["facility_profile"]
      : []),
    "settings",
  ].filter(
    (id) =>
      (!frontDeskScreens.has(id) ||
        !!outline?.workspaces.some((w) =>
          w.screens.some((s) => s.id === id),
        )) &&
      est?.views.screens.find((v) => v.screen_id === id)?.view !== "hidden",
  );
  const view = est?.views.workspaces.find(
    (v) => v.workspace === workspace,
  )?.view;
  const date = meta?.hospital_timezone
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: meta.hospital_timezone,
      }).format(clock)
    : "";
  return (
    <div className="app">
      <a data-help="shell.navigation" href="#content" className="skip">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">H</span>
          <div>
            <strong>
              haspataal<span className="brand-dot">.</span>
            </strong>
            <small>{server?.hospital || "HOSPITAL TERMINAL"}</small>
          </div>
        </div>
        <div className="header-context">
          <span>
            {workspaceName
              ? ur
                ? workspaceName.label_ur
                : workspaceName.label
              : t("Shared foundation", "بنیادی نظام")}
          </span>
          <small>{date}</small>
        </div>
        <div className="header-actions">
          <span className={"connection-state " + (!connected ? "offline" : "")}>
            {connected ? "●" : "○"}{" "}
            {connected
              ? user
                ? stream
                : t("Connected", "رابطہ قائم")
              : t("Offline", "رابطہ منقطع")}
          </span>
          <button
            data-help="shell.terminal"
            title="This terminal"
            onClick={() => setInfoOpen(true)}
          >
            ⓘ
          </button>
          <button
            data-help="shell.help"
            onClick={() => {
              setHelpPage(undefined);
              setHelpOpen(true);
            }}
          >
            {t("Help · F1", "مدد · F1")}
          </button>
          {user?.permissions.includes("incident.report") && (
            <button
              data-help="shell.navigation"
              onClick={() => navigate("report_incident")}
            >
              {t("Report an incident", "واقعے کی رپورٹ")}
            </button>
          )}
          {!user && server && (
            <button
              data-help="shell.settings"
              onClick={() =>
                navigate(screen === "settings" ? "login" : "settings")
              }
            >
              {t("Settings", "ترتیبات")}
            </button>
          )}
          {user && (
            <button
              data-help="shell.logout"
              className="avatar"
              onClick={() => setLogoutOpen(true)}
              title={user.display_name}
            >
              {user.display_name.slice(0, 1)}
            </button>
          )}
        </div>
      </header>
      {license && ["grace", "locked"].includes(license.state) && (
        <div className="licence-banner" role="alert">
          <strong>{license.message}</strong>
          {license.days_left !== null && (
            <span><bdi>{license.days_left}</bdi> {tr("days left")}</span>
          )}
          <span>
            {license.vendor.company} · {license.vendor.phone} ·{" "}
            {license.vendor.email}
          </span>
        </div>
      )}
      {!connected && server && (
        <div className="offline-banner" role="alert">
          {t(
            "Server unreachable — retrying. Keep this window open; your unsaved input is preserved.",
            "سرور سے رابطہ نہیں — دوبارہ کوشش جاری ہے۔ ونڈو کھلی رکھیں؛ غیر محفوظ اندراج برقرار ہے۔",
          )}
        </div>
      )}
      <div className="body-layout">
        {user && !user.must_change_password && (
          <aside className="sidebar">
            <div className="staff">
              <small>{t("SIGNED IN AS", "صارف")}</small>
              <strong>{user.display_name}</strong>
              <span>{user.designation}</span>
            </div>
            <nav aria-label="Main navigation">
              {nav.map((id) => (
                <button
                  data-help="shell.navigation"
                  className={screen === id ? "active" : ""}
                  key={id}
                  onClick={() => navigate(id)}
                >
                  <span aria-hidden="true">{labels[id][2]}</span>
                  {labels[id][ur ? 1 : 0]}
                  {id === "notifications" && unread !== undefined && (
                    <b>{unread}</b>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <small>
                {t("FOUNDATION · DEVELOPMENT", "بنیادی نظام · زیرِ تعمیر")}
              </small>
              <p>
                {t(
                  "Clinical workspaces follow in later phases.",
                  "طبی کام کی جگہیں اگلے مراحل میں آئیں گی۔",
                )}
              </p>
              <button
                data-help="shell.logout"
                onClick={() => setLogoutOpen(true)}
              >
                {t("Sign out", "سائن آؤٹ")}
              </button>
            </div>
          </aside>
        )}
        <main id="content">
          <ErrorBox error={error} />
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {ur && (
            <p className="translation-note">
              اردو ترجمہ مسودہ ہے؛ مقامی ماہر کا جائزہ باقی ہے۔
            </p>
          )}
          {booting ? (
            <p role="status">Opening terminal…</p>
          ) : !server ? (
            <Connection
              onConnected={async () => {
                await refreshState();
                setScreen("login");
              }}
            />
          ) : user?.must_change_password ? (
            <ChangePassword onDone={refreshState} />
          ) : !user ? (
            screen === "settings" ? (
              <Settings
                user={null}
                prefs={prefs}
                onPrefs={refreshState}
                onFacility={() => {}}
                connected={connected}
                revision={revision}
              />
            ) : (
              <Login
                connected={connected}
                health={loginHealth}
                healthError={healthError}
                hospital={server.hospital}
                onLogin={refreshState}
              />
            )
          ) : (
            <>
              {view && view !== "full" && (
                <p className="notice">
                  {view === "records"
                    ? "Records only"
                    : view === "open_work"
                      ? "This service is retiring. Continue open work; no new work may start."
                      : "Service setup"}
                </p>
              )}
              {screen === "workspace_picker" && (
                <>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">YOUR WORKSPACES</span>
                      <h1>
                        {t(
                          "Where are you working today?",
                          "آج آپ کہاں کام کر رہے ہیں؟",
                        )}
                      </h1>
                      <p className="muted">
                        {t(
                          "Choose a workspace for your next task.",
                          "اگلے کام کے لیے جگہ منتخب کریں۔",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="workspace-grid">
                    {visible.map((w, i) => (
                      <article className="workspace-card" key={w.code}>
                        <span className="workspace-number">0{i + 1}</span>
                        <h2>{ur ? w.label_ur : w.label}</h2>
                        <p>{w.description}</p>
                        <span className="badge">
                          {est?.views.workspaces.find(
                            (v) => v.workspace === w.code,
                          )?.view || "full"}
                        </span>
                        <div className="actions">
                          <button
                            data-help="workspace.open"
                            className="primary"
                            onClick={() => selectWorkspace(w.code)}
                          >
                            {t("Open workspace →", "کام کی جگہ کھولیں")}
                          </button>
                          <button
                            data-help="workspace.open"
                            onClick={() => selectWorkspace(w.code, true)}
                          >
                            {t("Open in new window", "نئی ونڈو میں کھولیں")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {screen === "app_shell" && (
                <>
                  <span className="eyebrow">
                    {t("READY FOR YOUR NEXT TASK", "اگلے کام کے لیے تیار")}
                  </span>
                  <h1>
                    {workspaceName
                      ? ur
                        ? workspaceName.label_ur
                        : workspaceName.label
                      : t("Your shared workspace", "آپ کی مشترکہ کام کی جگہ")}
                  </h1>
                  <p className="lead">
                    {t(
                      "The essentials for a connected hospital team.",
                      "مربوط ہسپتال ٹیم کے لیے بنیادی سہولیات۔",
                    )}
                  </p>
                  <div className="home-grid">
                    {nav
                      .filter(
                        (x) =>
                          ![
                            "app_shell",
                            "workspace_picker",
                            "settings",
                          ].includes(x),
                      )
                      .map((id) => (
                        <button
                          data-help="shell.navigation"
                          className="home-card"
                          onClick={() => navigate(id)}
                          key={id}
                        >
                          <span className="home-icon">{labels[id][2]}</span>
                          <h2>{labels[id][ur ? 1 : 0]}</h2>
                          <span>
                            {id === "notifications" && unread !== undefined
                              ? `${unread} unread`
                              : t("Open →", "کھولیں ←")}
                          </span>
                        </button>
                      ))}
                  </div>
                  <section className="card muted">
                    <h3>{t("About this build", "اس بلڈ کے بارے میں")}</h3>
                    <p>
                      {t(
                        "Shared tools connect to the live DEV hospital. Clinical screens are planned for the next build phases.",
                        "مشترکہ سہولیات حقیقی DEV ہسپتال سے منسلک ہیں۔ طبی صفحات اگلے مراحل میں بنیں گے۔",
                      )}
                    </p>
                  </section>
                </>
              )}
              {screen === "settings" && (
                <Settings
                  user={user}
                  prefs={prefs}
                  onPrefs={refreshState}
                  onFacility={() => navigate("facility_profile")}
                  connected={connected}
                  revision={revision}
                />
              )}
              {screen === "notifications" && (
                <Notifications
                  timeZone={meta?.hospital_timezone}
                  revision={revision}
                  onRefresh={refreshData}
                  onRoute={route}
                />
              )}
              {screen === "approval_queue" && (
                <Approvals user={user} revision={revision} />
              )}
              {screen === "charity_approvals" && (
                <Approvals user={user} revision={revision} charity />
              )}
              {screen === "my_cash_shift" && (
                <CashShift
                  user={user}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                  currency={meta?.currency_code}
                />
              )}
              {screen === "patient_search" && (
                <PatientSearch user={user} revision={revision} timeZone={meta?.hospital_timezone} currency={meta?.currency_code} />
              )}
              {screen === "registration" && (
                <Registration user={user} revision={revision} />
              )}
              {screen === "patient_documents" && <PatientDocuments user={user} revision={revision} />}
              {screen === "tariff_display" && <Tariff revision={revision} />}
              {screen === "queue_management" && (
                <QueueManagement
                  currency={meta?.currency_code}
                  permissions={user.permissions}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                  readOnly={
                    view === "records" ||
                    est?.views.screens.find((s) => s.screen_id === screen)
                      ?.view === "records"
                  }
                  onShift={() =>
                    void selectWorkspace(workspace || "reception", true)
                  }
                />
              )}
              {screen === "refund_waiver_credit" && (
                <RefundRequests
                  currency={meta?.currency_code}
                  permissions={user.permissions}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                  readOnly={
                    view === "records" ||
                    est?.views.screens.find((s) => s.screen_id === screen)
                      ?.view === "records"
                  }
                  onShift={() =>
                    void selectWorkspace(workspace || "reception", true)
                  }
                />
              )}
              {screen === "cash_back_prompts" && (
                <CashBack
                  currency={meta?.currency_code}
                  permissions={user.permissions}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                  readOnly={
                    view === "records" ||
                    est?.views.screens.find((s) => s.screen_id === screen)
                      ?.view === "records"
                  }
                  onShift={() =>
                    void selectWorkspace(workspace || "reception", true)
                  }
                />
              )}
              {screen === "report_incident" && (
                <Incidents
                  user={user}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                />
              )}
              {screen === "facility_profile" && (
                <Facility
                  revision={revision}
                  onChanged={refreshData}
                  storageScope={`${server.fingerprint}:${user.user_id}`}
                />
              )}
            </>
          )}
        </main>
      </div>
      <footer className="statusbar">
        <span>{server?.current || "No server selected"}</span>
        <span>
          {user ? user.username : "Not signed in"} · {prefs.ui_scale_pct}% ·
          v0.1.0
        </span>
      </footer>
      {helpOpen && (
        <Help
          screen={screen}
          initialPage={helpPage}
          outline={outline}
          language={prefs.language}
          onClose={() => {
            setHelpOpen(false);
            setHelpPage(undefined);
            if (window.location.hash.startsWith("#help/"))
              history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search,
              );
          }}
        />
      )}{" "}
      {infoOpen && (
        <Modal
          title={t("Terminal information", "ٹرمینل کی معلومات")}
          onClose={() => setInfoOpen(false)}
        >
          {server ? (
            <TerminalIdentity />
          ) : (
            <p>Connect to a server to identify this terminal.</p>
          )}
        </Modal>
      )}
      {logoutOpen && (
        <Modal
          title={t("Your account", "آپ کا اکاؤنٹ")}
          onClose={() => !logoutBusy && setLogoutOpen(false)}
        >
          <p>
            {t(
              "Finish pending actions before signing out. Resolve uncertain cash-shift requests while this window is open. Unsaved input needs your confirmation before it is discarded. Retained Facility requests stay with this account and hospital.",
              "سائن آؤٹ سے پہلے جاری عمل مکمل کریں۔ غیر یقینی کیش شفٹ کا نتیجہ اسی کھلی ونڈو میں واضح کریں۔ غیر محفوظ اندراج ختم کرنے سے پہلے تصدیق ہوگی۔ ہسپتال کی محفوظ درخواستیں اسی اکاؤنٹ اور ہسپتال کے ساتھ رہتی ہیں۔",
            )}
          </p>
          <div className="actions" data-write-pending={logoutBusy}>
            {logoutBusy && (
              <p role="status">{t("Signing out…", "سائن آؤٹ جاری ہے…")}</p>
            )}
            <button
              data-help="shell.help"
              disabled={logoutBusy}
              onClick={() => {
                setLogoutOpen(false);
                setHelpPage("home");
                setHelpOpen(true);
              }}
            >
              {t("Help & handbook", "مدد اور رہنما")}
            </button>
            <button
              data-help="shell.settings"
              disabled={logoutBusy}
              onClick={() => {
                if (navigate("settings")) setLogoutOpen(false);
              }}
            >
              {t("Settings", "ترتیبات")}
            </button>
            <button
              data-help="shell.logout"
              disabled={logoutBusy}
              onClick={() => setLogoutOpen(false)}
            >
              {t("Keep working", "کام جاری رکھیں")}
            </button>
            <button
              data-help="shell.logout"
              disabled={logoutBusy}
              onClick={() => void signOut(true)}
            >
              {t("Sign out everywhere", "ہر جگہ سائن آؤٹ کریں")}
            </button>
            <button
              data-help="shell.logout"
              className="primary"
              disabled={logoutBusy}
              onClick={() => void signOut(false)}
            >
              {t("Sign out", "سائن آؤٹ کریں")}
            </button>
          </div>
        </Modal>
      )}
      {maintenance && (
        <div className="blocking-banner" role="alert">
          <h1>Hospital maintenance</h1>
          <p>
            {maintenance.message || "The server is undergoing maintenance."}
          </p>
          <button
            data-help="shell.maintenance"
            onClick={() =>
              api("GET", "/meta/settings")
                .then((s) =>
                  setMaintenance(s.maintenance_mode ? maintenance : undefined),
                )
                .catch(setError)
            }
          >
            Check again
          </button>
          <button data-help="shell.logout" onClick={() => setLogoutOpen(true)}>
            Sign out
          </button>
        </div>
      )}
      {criticalNotices.length > 0 && (
        <CriticalNotificationToast
          key={criticalNotices[0].notification_id}
          notice={criticalNotices[0]}
          onDismiss={() => setCriticalNotices((current) => current.slice(1))}
          onOpen={() => navigate("notifications")}
        />
      )}
      {critical?.kind === "code_red" && (
        <Modal
          title={
            critical.kind === "code_red" ? "Code Red" : "Critical notification"
          }
          onClose={() => setCritical(undefined)}
        >
          <Details value={critical} />
          <button
            data-help="shell.critical"
            className="primary"
            onClick={() => setCritical(undefined)}
          >
            Acknowledge on this terminal
          </button>
        </Modal>
      )}
      {sessionRecovery && user && (
        <Modal
          title={t("Confirm your session", "اپنے سیشن کی تصدیق کریں")}
          onClose={() => {}}
        >
          <p>{tr(sessionRecovery)}</p>
          <p>{user.username}</p>
          <ErrorBox error={sessionError} />
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (reauthFlight.current) return;
              reauthFlight.current = true;
              setSessionBusy(true);
              setSessionError(undefined);
              try {
                await call("reauthenticate", { password: sessionPassword });
              } catch (cause) {
                setSessionError(cause);
              } finally {
                setSessionPassword("");
                setSessionBusy(false);
                reauthFlight.current = false;
              }
            }}
          >
            <Field label={t("Password", "پاس ورڈ")}>
              <input
                data-help="shell.session"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                disabled={sessionBusy}
                value={sessionPassword}
                onChange={(e) => setSessionPassword(e.target.value)}
              />
            </Field>
            <button
              data-help="shell.session"
              className="primary"
              disabled={sessionBusy || !connected}
            >
              {t("Confirm your session", "اپنے سیشن کی تصدیق کریں")}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
