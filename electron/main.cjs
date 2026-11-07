const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  safeStorage,
  dialog,
  session,
  protocol,
  net,
  shell,
} = require("electron");
const fs = require("node:fs");
// Replaced with a literal by the distributable build. Source Electron runs are DEV.
const BUILD_IS_DEV = typeof __BUILD_IS_DEV__ === "undefined" ? !app.isPackaged : __BUILD_IS_DEV__;
const devReview = BUILD_IS_DEV ? require("./dev-review.cjs").createDevReview() : null;
const path = require("node:path");
const os = require("node:os");
const { X509Certificate } = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { assetUrl } = require("./local-assets.cjs");
const { migrateRecovery } = require("./recovery-migration.cjs");
let recoveryMigrationError;
let hasAppWindow = false;
const terminalUrl = "app://terminal/index.html";
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const WebSocket = require("ws");
const { request, checkedRoot, LocalUploadError } = require("./transport.cjs");
const { discover } = require("./discovery.cjs");
const { validate, permissionAllows, matchOperation: findOperation } = require("./contract.cjs");
const { createPreferenceQueue } = require("./preference-queue.cjs");
const {preferenceBody}=require('./preference-body.cjs');
const {mayReplayAfterRefresh}=require('./auth-replay.cjs');
const { isDegradedHealthResponse } = require("./health-response.cjs");
const { unseenEvent, simulatedLicenseEvent } = require("./event-cursor.cjs");
const {
  selectConfiguration,
  serverAddresses,
  discoveryPort,
} = require("./provisioning.cjs");
let server = null,
  auth = null,
  refreshFlight = null,
  refreshTimer,
  recoveryTimer,
  recoveryStep = 0,
  addressFlight = null,
  configuredDiscoveryPort = 47632,
  provisioningPending = false,
  managedConnection = false,
  recoveryRunning = false;
let credentialFlight = false;
let logoutPending = false;
let connected = false,
  pendingCa = null,
  prefs = { theme: "Light", language: "en", ui_scale_pct: 100 };
const windows = new Map(),
  streams = new Map();
const clinicalViewers = new Set();

function closeClinicalViewers() {
  for (const viewer of clinicalViewers) if(!viewer.isDestroyed()) viewer.destroy();
  clinicalViewers.clear();
}
const root = path.join(__dirname, "..");
const bundles = fs
  .readdirSync(path.join(root, "contracts"))
  .filter((n) => n.endsWith('.json') && !n.startsWith("meta-") && !n.startsWith("handbook-"))
  .sort()
  .map((n) =>
    JSON.parse(fs.readFileSync(path.join(root, "contracts", n), "utf8")),
  );
const operations = bundles.flatMap((b) => b.endpoints || []);
const schemas = Object.assign({}, ...bundles.map((b) => b.schemas || {}));
let preferenceContext = 0;
const queuePrefs = createPreferenceQueue({
  read: () => prefs,
  write: savePrefs,
  context: () => preferenceContext,
});
const mac = Object.values(os.networkInterfaces())
  .flat()
  .find(
    (n) => !n.internal && n.family === "IPv4" && n.mac !== "00:00:00:00:00:00",
  )?.mac;
const locationFile = () => path.join(app.getPath("userData"), "server.json");
const tokenFile = () => path.join(app.getPath("userData"), "session.enc");
const prefsFile = () =>
  path.join(app.getPath("userData"), "login-display.json");
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
function broadcast(message) {
  for (const win of BrowserWindow.getAllWindows())
    win.webContents.send("terminal-event", message);
}
function publicServer() {
  return server
    ? {
        current: server.current,
        urls: server.urls,
        source: server.source,
        fingerprint: server.ca_fingerprint_sha256,
        hospital: server.hospital_name,
      }
    : null;
}
function state() {
  return {
    server: publicServer(),
    connected,
    user: auth?.user || null,
    prefs,
    sessionRecovery: auth?.recovery || null,
  };
}
function stopStreams() {
  for (const stream of streams.values()) {
    stream.stopped = true;
    clearTimeout(stream.timer);
    stream.socket?.close();
  }
  streams.clear();
}
function clearSession(reason = "Signed out") {
  closeClinicalViewers();
  preferenceContext++;
  clearTimeout(refreshTimer);
  auth = null;
  refreshFlight = null;
  let storageFailure = false;
  try {
    fs.unlinkSync(tokenFile());
  } catch (e) {
    if (e.code !== "ENOENT") storageFailure = true;
  }
  for (const stream of streams.values()) {
    stream.stopped = true;
    clearTimeout(stream.timer);
    stream.socket?.close();
  }
  streams.clear();
  for (const id of windows.keys()) windows.set(id, null);
  prefs = readJson(prefsFile()) || {
    theme: "Light",
    language: "en",
    ui_scale_pct: 100,
  };
  applyZoom(prefs.ui_scale_pct);
  broadcast({ type: "logout", reason });
  if (storageFailure)
    broadcast({
      type: "error",
      error: {
        message:
          "The secure session cache could not be removed. The session is closed; ask IT to check terminal storage.",
      },
    });
}
function acceptTokens(data) {
  if (
    !data.access_token ||
    !data.refresh_token ||
    !Number.isFinite(data.expires_in)
  )
    throw new Error("CONTRACT_MISMATCH: token response is incomplete");
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("Windows secure token storage is unavailable");
  const encrypted = safeStorage.encryptString(data.refresh_token);
  fs.writeFileSync(tokenFile(), encrypted);
  auth = {
    ...auth,
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000,
    user: data.user || auth?.user,
    recovery: null,
  };
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(
    () => refresh().catch(() => {}),
    Math.max(1000, data.expires_in * 1000 - 60000),
  );
  for (const s of streams.values())
    if (s.socket?.readyState === WebSocket.OPEN)
      s.socket.send(
        JSON.stringify({ type: "auth", access_token: auth.access }),
      );
}
function devBuildHeaders() {
  return BUILD_IS_DEV ? devReview.headers() : {};
}
function headers(workspace) {
  return {
    ...(mac ? { "X-Terminal-Mac": mac } : {}),
    ...devBuildHeaders(),
    ...(auth?.access ? { Authorization: `Bearer ${auth.access}` } : {}),
    ...(workspace ? { "X-Active-Workspace": workspace } : {}),
  };
}
function apiPath(p) {
  if (
    typeof p !== "string" ||
    !p.startsWith("/") ||
    p.startsWith("//") ||
    p.includes("\\") ||
    p.includes("..")
  )
    throw new Error("Invalid API path");
  return p.startsWith("/health") ? p : "/api/v1" + p;
}
function isCountedLabLabel(method, path) {
  return method === "GET" && /^\/lab\/samples\/[1-9]\d*\/label(?:\?|$)/.test(path);
}
async function raw(method, p, body, workspace, key, binary = false, customHeaders = {}) {
  if (!server?.current) throw new Error("Connect to the hospital server first");
  const originalServer = server;
  const originalUrl = server.current;
  const send = () =>
    request(server.current + apiPath(p), {
      ca: server.ca_pem,
      method,
      body,
      headers: {
        ...headers(workspace),
        ...(customHeaders || {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      binary,
    });
  try {
    const result = await send();
    if (!connected) {
      connected = true;
      broadcast({ type: "connection", connected: true });
    }
    return result;
  } catch (e) {
    if (e instanceof LocalUploadError) throw e;
    if (server !== originalServer) throw e;
    try {
      // Probe the other pinned addresses before announcing an outage. A write
      // may have committed: only reads can be repeated automatically.
      await pickAddress(originalUrl);
      broadcast({ type: "connection", connected: true });
    } catch {
      connected = false;
      broadcast({ type: "connection", connected: false });
      scheduleRecovery();
      throw e;
    }
    if (method === "GET" && !isCountedLabLabel(method, p)) {
      try {
        return await send();
      } catch (readError) {
        connected = false;
        broadcast({ type: "connection", connected: false });
        scheduleRecovery();
        throw readError;
      }
    }
    throw e;
  }
}
function errorResult(result) {
  return {
    ok: false,
    status: result.status,
    error: result.body?.error || {
      code: "CONTRACT_MISMATCH",
      message:
        "Server returned an unexpected response format. Contact the backend team.",
    },
    request_id: result.body?.request_id,
  };
}
async function refresh() {
  if (refreshFlight) return refreshFlight;
  if (!auth?.refresh) throw new Error("Sign in again");
  if (credentialFlight) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh().catch(() => {}), 5000);
    throw new Error("An account action is already pending.");
  }
  if (auth.recovery) throw new Error(auth.recovery);
  if (!connected) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh().catch(() => {}), 30000);
    throw new Error(
      "Server unreachable. Your input is preserved; waiting to renew your session.",
    );
  }
  refreshFlight = (async () => {
    try {
      const r = await raw("POST", "/auth/refresh", {
        refresh_token: auth.refresh,
      });
      if (r.status !== 200) {
        const message = r.body?.error?.message || "Session refresh failed";
        if (r.status >= 400 && r.status < 500 && ![408, 429].includes(r.status))
          clearSession(message);
        throw new Error(message);
      }
      acceptTokens(r.body.data);
    } catch (e) {
      if (auth) {
        // A lost rotation must never reuse the old refresh token. Keep drafts
        // mounted, block authenticated operations and ask the SAME user to sign
        // in explicitly. Revocation/refusal above still clears every window.
        auth.recovery =
          "Session renewal could not be confirmed. Sign in again to keep working; your unsaved input is preserved.";
        clearTimeout(refreshTimer);
        for (const stream of streams.values()) {
          stream.stopped = true;
          clearTimeout(stream.timer);
          stream.socket?.close();
        }
        streams.clear();
        closeClinicalViewers();
        broadcast({ type: "session-recovery", message: auth.recovery });
      }
      throw e;
    } finally {
      refreshFlight = null;
    }
  })();
  return refreshFlight;
}
function matchOperation(method, p) {
  return findOperation(operations, method, p);
}
async function api(method, p, body, workspace, key, retried = false, customHeaders = {}) {
  if (
    method === "POST" &&
    p === "/establishment/changes" &&
    recoveryMigrationError
  )
    throw new Error(recoveryMigrationError);
  const op = matchOperation(method, p);
  if (!op && !["/health", "/health/live"].includes(p))
    throw new Error("Endpoint is outside the foundation contract");
  if (auth?.recovery && op?.access.authentication !== "public" && op?.access.authentication !== "station_key")
    throw new Error(auth.recovery);
  if (auth && !auth.recovery && Date.now() > auth.expires - 60000)
    await refresh();
  if (op?.access.authentication === "user" && !auth)
    return {
      ok: false,
      error: { code: "SIGN_IN_REQUIRED", message: "Please sign in." },
    };
  if (op && !permissionAllows(op, auth?.user))
    return {
      ok: false,
      error: {
        code: "PERMISSION_REQUIRED",
        message:
          "Your current permissions do not allow this action. Refresh your workspace or contact the administrator.",
      },
    };
  if (method !== "GET" && !connected)
    return {
      ok: false,
      error: {
        code: "OFFLINE",
        message:
          "Server unreachable. Your input has been kept; reconnect before saving.",
      },
    };
  const requestSession = auth;
  const r = await raw(method, p, body, workspace, key, false, customHeaders);
  if (requestSession && requestSession !== auth)
    return {
      ok: false,
      error: {
        code: "SESSION_CHANGED",
        message:
          "The account session changed while reading this result. Reload the current view.",
      },
    };
  if (!retried && !isCountedLabLabel(method, p) && r.status === 401 && r.body?.error?.code === "TOKEN_EXPIRED") {
    await refresh();
    if(mayReplayAfterRefresh(r))return api(method, p, body, workspace, key, true, customHeaders);
    const refusal=errorResult(r);
    refusal.error.details={...refusal.error.details,session_refreshed:true};
    return refusal;
  }
  if (["TOKEN_REVOKED", "REFRESH_TOKEN_REUSED"].includes(r.body?.error?.code))
    clearSession(r.body.error.message);
  if (r.status === 403 && r.body?.error?.code === "FORBIDDEN" && auth) {
    const me = await raw("GET", "/auth/me");
    if (me.status === 200) {
      auth.user = me.body.data;
      closeClinicalViewers();
      broadcast({ type: "permissions", user: auth.user });
    }
  }
  const degradedHealth = isDegradedHealthResponse(p, r.status, r.body);
  if (r.status >= 400 && !degradedHealth) return errorResult(r);
  const responseSchema = Object.values(
    (
      op?.responses?.[String(r.status)] ||
      (degradedHealth ? op?.responses?.["200"] : undefined)
    )?.content || {},
  )[0]?.schema;
  const problems = responseSchema
    ? validate(r.body, responseSchema, schemas)
    : [];
  if (problems.length)
    return {
      ok: false,
      status: r.status,
      error: {
        code: "CONTRACT_MISMATCH",
        message:
          "The server response does not match its declared contract. Contact the backend team.",
        details: { fields: problems },
      },
      request_id: r.body?.request_id,
    };
  if (!r.body || typeof r.body !== "object" || !("data" in r.body))
    return errorResult(r);
  return {
    ok: true,
    data: r.body.data,
    meta: r.body.meta,
    request_id: r.body.request_id,
  };
}
async function refreshAddresses() {
  const r = await raw("GET", "/meta/server-info");
  if (r.status !== 200)
    throw new Error(r.body?.error?.message || "Cannot read server information");
  const info = r.body.data;
  if (info.ca_fingerprint_sha256 !== server.ca_fingerprint_sha256)
    throw new Error("Hospital certificate identity has changed. Ask IT.");
  if (!Array.isArray(info.urls))
    throw new Error("CONTRACT_MISMATCH: server addresses missing");
  server.urls = [...new Set([...serverAddresses(info.urls), ...server.urls])];
  server.hospital_name = info.hospital_name;
  fs.writeFileSync(locationFile(), JSON.stringify(server));
  return info;
}
async function pickAddress(failedUrl) {
  if (addressFlight) return addressFlight;
  const target = server;
  addressFlight = pickPinnedAddress(target, failedUrl);
  try {
    return await addressFlight;
  } finally {
    addressFlight = null;
  }
}
async function pickPinnedAddress(target, failedUrl) {
  let lastError;
  const urls = [...new Set([target.current, ...target.urls].filter(Boolean))];
  if (failedUrl)
    urls.sort((a, b) => Number(a === failedUrl) - Number(b === failedUrl));
  for (const url of urls) {
    try {
      const r = await request(url + "/health/live", {
        ca: target.ca_pem,
        headers: headers(),
        timeoutMs: 4000,
      });
      if (r.status === 200) {
        if (server !== target)
          throw new Error("Hospital server selection changed");
        target.current = url;
        fs.writeFileSync(locationFile(), JSON.stringify(target));
        connected = true;
        return;
      }
    } catch (e) {
      lastError = e;
    }
  }
  connected = false;
  throw lastError || new Error("Hospital server is unreachable");
}
function scheduleRecovery() {
  if (recoveryTimer || recoveryRunning || (!server && !provisioningPending))
    return;
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    recoveryRunning = true;
    let failed = false;
    try {
      if (server) await pickAddress();
      else await loadProvisioning();
      recoveryStep = 0;
      broadcast({ type: "connection", connected: true });
      for (const id of streams.keys()) connectStream(id);
    } catch {
      recoveryStep++;
      failed = true;
    } finally {
      recoveryRunning = false;
      if (failed) scheduleRecovery();
    }
  }, [1000, 2000, 5000, 10000, 30000][Math.min(recoveryStep, 4)]);
}
function applyZoom(value) {
  const zoom = Math.max(100, Math.min(250, Math.round(value)));
  prefs.ui_scale_pct = zoom;
  for (const win of BrowserWindow.getAllWindows())
    win.webContents.setZoomFactor(zoom / 100);
  broadcast({ type: "prefs", prefs });
  return zoom;
}
async function savePrefs(value, owner) {
  if (value.__readPreferences) {
    if (!auth) throw new Error("Sign in before reloading account preferences");
    const r = await api("GET", "/settings/me");
    if (!r.ok) return r;
    if (owner !== preferenceContext || !auth)
      throw new Error("The session changed while reading preferences.");
    prefs = r.data;
    auth.user.preferences = prefs;
    applyZoom(prefs.ui_scale_pct);
    return { ok: true, data: prefs };
  }
  if (value.ui_scale_pct !== undefined)
    value.ui_scale_pct = Math.max(
      100,
      Math.min(250, Math.round(value.ui_scale_pct)),
    );
  if (auth) {
    const r = await api("PUT", "/settings/me", preferenceBody(value));
    if (!r.ok) return r;
    if (owner !== preferenceContext)
      throw new Error("The session changed while saving preferences.");
    prefs = r.data;
    auth.user.preferences = prefs;
  } else {
    prefs = { ...prefs, ...value };
    fs.writeFileSync(prefsFile(), JSON.stringify(prefs));
  }
  applyZoom(prefs.ui_scale_pct);
  broadcast({ type: "prefs", prefs });
  return { ok: true, data: prefs };
}
async function readAccountDisplay() {
  if (auth?.user.must_change_password) return;
  try {
    const r = await queuePrefs({ __readPreferences: true });
    if (!r.ok) throw new Error(r.error?.message || "Preference read failed");
  } catch {
    return "Your session is confirmed, but display preferences could not be reloaded. The server's session preferences are shown. Use Settings > Reload preferences after reconnecting; do not repeat sign-in or password changes.";
  }
}
function connectStream(id) {
  const win = BrowserWindow.fromId(id);
  if (!win || !auth || auth.recovery || !connected) return;
  let stream = streams.get(id);
  if (!stream) {
    stream = {
      last: null,
      initialCursor: null,
      seen: new Set(),
      backoff: 1000,
      stopped: false,
    };
    streams.set(id, stream);
  }
  if (
    stream.socket &&
    [WebSocket.OPEN, WebSocket.CONNECTING].includes(stream.socket.readyState)
  )
    return;
  clearTimeout(stream.timer);
  const socket = new WebSocket(
    server.current.replace(/^http/, "ws") + "/ws/v1/events",
    { ca: server.ca_pem, headers: headers(windows.get(id)) },
  );
  stream.socket = socket;
  const send = (value) => {
    if (!win.isDestroyed()) win.webContents.send("terminal-event", value);
  };
  socket.on("open", () => {
    if (auth)
      socket.send(
        JSON.stringify({
          type: "auth",
          access_token: auth.access,
          resume_from: stream.last,
        }),
      );
  });
  socket.on("message", (raw) => {
    if (
      stream.stopped ||
      streams.get(id) !== stream ||
      stream.socket !== socket
    )
      return;
    try {
      const m = JSON.parse(raw);
      if (m.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (m.type === "welcome") {
        stream.backoff = 1000;
        if (stream.last === null) {
          stream.last = m.last_event_id;
          stream.initialCursor = m.last_event_id;
          send({ type: "stream", status: "Live", resync: true });
        } else send({ type: "stream", status: "Catching up" });
      }
      if (m.type === "replay_complete")
        send({ type: "stream", status: "Live", resync: true });
      if (simulatedLicenseEvent(m)) send(m);
      if (unseenEvent(stream, m)) {
        stream.seen.add(m.event_id);
        if (stream.seen.size > 5000)
          stream.seen = new Set([...stream.seen].slice(-2000));
        stream.last = Math.max(stream.last || 0, m.event_id);
        if (m.event_type === "session.revoked") {
          clearSession("Your session was ended by the server.");
          return;
        }
        send(m);
      }
      if (m.type === "error") send({ type: "stream", status: m.message });
    } catch {
      send({
        type: "stream",
        status: "Invalid realtime message — contact backend support",
      });
    }
  });
  let failed = false;
  socket.on("error", () => {
    failed = true;
    send({ type: "stream", status: "Reconnecting" });
  });
  socket.on("close", async (code) => {
    if (stream.stopped || !auth || win.isDestroyed()) return;
    send({ type: "stream", status: "Reconnecting" });
    if (code === 4003) {
      clearSession("Your session was revoked.");
      return;
    }
    if (code === 4001) {
      try {
        await refresh();
      } catch {
        return;
      }
    }
    // A TCP/TLS failure must also try alternate addresses, even on an idle
    // screen with no API request to trigger recovery. Keep the replay cursor.
    if (failed || code === 1006 || code === 1012) {
      try {
        await pickAddress(server.current);
      } catch {
        connected = false;
        broadcast({ type: "connection", connected: false });
        scheduleRecovery();
        return;
      }
    }
    if (stream.stopped || !auth || win.isDestroyed()) return;
    stream.timer = setTimeout(
      () => connectStream(id),
      Math.min(stream.backoff, 30000),
    );
    stream.backoff *= 2;
  });
}
function createWindow(workspace = null) {
  hasAppWindow = true;
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 640,
    minHeight: 480,
    title: "Haspataal",
    backgroundColor: "#f6f7f8",
    show: !process.env.HASPATAAL_TEST,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  windows.set(win.id, workspace);
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url.split("#")[0] !== terminalUrl) event.preventDefault();
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (
      (input.control || input.meta) &&
      ["+", "=", "-", "0"].includes(input.key)
    ) {
      event.preventDefault();
      if (input.type === "keyDown")
        queuePrefs((current) => ({
          ui_scale_pct:
            input.key === "0"
              ? 100
              : current.ui_scale_pct + (input.key === "-" ? -10 : 10),
        }))
          .then((r) => {
            if (!r.ok) broadcast({ type: "error", ...r });
          })
          .catch((e) =>
            broadcast({ type: "error", error: { message: e.message } }),
          );
    }
  });
  win.webContents.on("did-finish-load", () => {
    win.webContents.setVisualZoomLevelLimits(1, 1);
    applyZoom(prefs.ui_scale_pct);
  });
  win.on("closed", () => {
    const s = streams.get(win.id);
    if (s) {
      s.stopped = true;
      clearTimeout(s.timer);
      s.socket?.close();
    }
    streams.delete(win.id);
    windows.delete(win.id);
  });
  win.loadURL(terminalUrl);
  return win;
}
async function loadProvisioning() {
  const selected = await selectConfiguration({
    savedPath: locationFile(),
    developmentFile: !app.isPackaged
      ? process.env.HASPATAAL_DEV_CONFIG
      : undefined,
  });
  if (!selected) return;
  provisioningPending = true;
  managedConnection = ["policy", "file"].includes(selected.source);
  const urls = serverAddresses(selected.server_urls || selected.urls);
  configuredDiscoveryPort = discoveryPort(selected.discovery_port);
  let pem = selected.ca_pem;
  if (!pem) {
    let failure;
    for (const url of urls) {
      try {
        const response = await request(url + "/ca.crt", {
          bootstrap: true,
          headers: devBuildHeaders(),
          timeoutMs: 4000,
        });
        if (response.status !== 200)
          throw new Error("Cannot download hospital root");
        pem = checkedRoot(response.body, selected.ca_fingerprint_sha256);
        break;
      } catch (error) {
        failure = error;
      }
    }
    if (!pem) throw failure || new Error("Cannot download hospital root");
  }
  checkedRoot(pem, selected.ca_fingerprint_sha256);
  server = {
    urls,
    current: urls.includes(selected.current) ? selected.current : urls[0],
    ca_pem: pem,
    ca_fingerprint_sha256: new X509Certificate(pem).fingerprint256,
    hospital_name: selected.hospital_name,
    source: selected.source || "user",
    discovery_port: configuredDiscoveryPort,
  };
  await pickAddress();
  await refreshAddresses();
  provisioningPending = false;
}

ipcMain.handle("terminal", async (event, action, args = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (
    !win ||
    !windows.has(win.id) ||
    event.senderFrame !== event.sender.mainFrame
  )
    throw new Error("Untrusted IPC sender");
  const credentialAction = [
    "login",
    "reauthenticate",
    "change-password",
  ].includes(action);
  if (credentialAction && credentialFlight)
    return {
      ok: false,
      error: {
        code: "ACTION_IN_PROGRESS",
        message: "An account action is already pending.",
      },
    };
  if (credentialAction) credentialFlight = true;
  try {
    if (credentialAction && refreshFlight) await refreshFlight;
    if (action === "state")
      return { ok: true, data: { ...state(), workspace: windows.get(win.id) } };
    if (BUILD_IS_DEV && action === "dev-review") {
      if (Object.hasOwn(args, "code")) {
        devReview.set(args.code);
        broadcast({ type: "dev-review-changed" });
      }
      return { ok: true, data: { code: devReview.get() } };
    }
    if (action === "discover")
      return { ok: true, data: await discover(configuredDiscoveryPort) };
    if (action === "inspect-server") {
      if (auth) throw new Error("Sign out before changing servers");
      if (managedConnection)
        throw new Error(
          "IT manages this terminal's server. Ask IT to update its provisioning.",
        );
      const u = new URL(args.url);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.pathname !== "/" ||
        u.search ||
        u.hash
      )
        throw new Error("Enter an HTTPS server address, without a path");
      const r = await request(u.origin + "/ca.crt", { bootstrap: true, headers: devBuildHeaders() });
      if (r.status !== 200)
        throw new Error("Cannot download hospital root certificate");
      const cert = new X509Certificate(r.body);
      pendingCa = {
        url: u.origin,
        pem: r.body,
        fingerprint: cert.fingerprint256,
      };
      return { ok: true, data: { fingerprint: cert.fingerprint256 } };
    }
    if (action === "trust-server") {
      if (auth || !pendingCa) throw new Error("Inspect the server first");
      if (managedConnection)
        throw new Error(
          "IT manages this terminal's server. Ask IT to update its provisioning.",
        );
      checkedRoot(pendingCa.pem, args.fingerprint);
      server = {
        urls: [pendingCa.url],
        current: pendingCa.url,
        ca_pem: pendingCa.pem,
        ca_fingerprint_sha256: pendingCa.fingerprint,
        source: "user",
      };
      pendingCa = null;
      await pickAddress();
      await refreshAddresses();
      return { ok: true, data: state() };
    }
    if (action === 'station-config-load' || action === 'station-config-save') {
      const { saveStationConfig, loadStationConfig } = require('./station-config.cjs');
      const file = path.join(app.getPath('userData'), 'station-config.enc');
      if (action === 'station-config-save') {
        saveStationConfig(file, args, safeStorage);
        return { ok: true, data: null };
      }
      return { ok: true, data: loadStationConfig(file, safeStorage) };
    }
    if (action === "api") {
      if (
        /^\/(auth\/(login|refresh|logout|change-password)|settings\/me\/change-password)(\?|$)/.test(
          args.path,
        )
      )
        throw new Error("Use the dedicated session action");
      const requestActor = auth?.user.user_id;
      const { stationHeaders, isStationNetworkFailure } = require('./station-security.cjs');
      let response;
      try {
      response = await api(
        args.method,
        args.path,
        args.body,
        windows.get(win.id),
        args.key,
        false,
        stationHeaders(args.path, args.headers),
      );
      } catch (error) {
        if (args.path === '/badge-stations/scans' && isStationNetworkFailure(error))
          return { ok: false, error: { code: 'OFFLINE', message: 'Station scan outcome is unconfirmed. Retain the original gateway event ID for retry.' } };
        throw error;
      }
      return response;
    }
    if (action === 'print-dose-label') {
      const actor=auth?.user.user_id;
      if(!actor || !Number.isSafeInteger(args.marId) || args.marId<=0)throw Error('Sign in and select a recorded preparation label');
      const current=await api('GET','/auth/me');if(!current.ok)return current;
      if(current.data.user_id!==actor||!current.data.permissions.includes('ipd.mar.administer'))throw Error('Dose-label viewing permission changed. Ask the responsible team.');
      const label = await require('./dose-label.cjs').readPreparedDoseLabel(api,args.marId,windows.get(win.id));
      if(!label.ok)return label;
      const payload=label.data;
      const terminal=await api('GET','/terminals/whoami');if(!terminal.ok)return terminal;
      if(actor!==auth?.user.user_id)throw Error('The session changed before label printing');
      return {ok:true,data:await require('./opd-print.cjs').printSlip(payload,terminal.data,{owner:win,pdf:false})};
    }
    if (action === "compliance-scan") {
      if (!Number.isSafeInteger(args.documentId) || args.documentId <= 0) throw new Error('Select an actual compliance entry');
      const scanPath=`/facility/compliance-documents/${args.documentId}/scan`;
      const op=matchOperation('GET',scanPath);
      if(!auth || !op || !permissionAllows(op,auth.user))throw new Error('You do not have permission to view this scan');
      if(Date.now()>auth.expires-60000)await refresh();
      const actorSession=auth;
      const r=await raw('GET',scanPath,undefined,windows.get(win.id),undefined,true);
      if(actorSession!==auth)throw new Error('The session changed during scan download');
      if(r.status!==200){try{r.body=JSON.parse(r.bytes.toString('utf8'))}catch{}return errorResult(r);}
      const scan=require('./compliance-files.cjs').checkedScan(r.bytes,r.headers['content-type']);
      if(args.save){
        const target=await dialog.showSaveDialog(win,{defaultPath:`Compliance-${args.documentId}.${scan.extension}`,filters:[{name:scan.type==='application/pdf'?'PDF':'Image',extensions:[scan.extension]}]});
        if(actorSession!==auth || !permissionAllows(op,auth?.user))throw new Error('The session or permission changed before saving');
        if(!target.canceled)fs.writeFileSync(target.filePath,r.bytes);
        return {ok:true,data:{saved:!target.canceled,type:scan.type}};
      }
      const viewer=new BrowserWindow({width:1050,height:850,parent:win,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,plugins:scan.type==='application/pdf'}});
      clinicalViewers.add(viewer);viewer.once('closed',()=>clinicalViewers.delete(viewer));
      viewer.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      viewer.webContents.on('will-navigate',e=>e.preventDefault());
      try{await viewer.loadURL(`data:${scan.type};base64,${r.bytes.toString('base64')}`);}catch{if(!viewer.isDestroyed())viewer.destroy();throw new Error('The scan preview could not open. Save the same scan instead.');}
      return {ok:true,data:{opened:true,type:scan.type}};
    }
    if (action === "patient-file") {
      if (!Number.isSafeInteger(args.documentId) || args.documentId <= 0)
        throw new Error("Invalid document");
      const p = `/patient-documents/${args.documentId}/download`;
      const op = matchOperation("GET", p);
      if (!auth || !op || !permissionAllows(op, auth.user))
        throw new Error("You do not have permission to view patient documents");
      const documentActor=auth.user.user_id;
      if (Date.now() > auth.expires - 60000) await refresh();
      let r = await raw(
        "GET",
        p,
        undefined,
        windows.get(win.id),
        undefined,
        true,
      );
      if (r.status !== 200) {
        try {
          r.body = JSON.parse(r.bytes.toString("utf8"));
        } catch {}
        if (r.status === 401 && r.body?.error?.code === "TOKEN_EXPIRED") {
          await refresh();
          r = await raw(
            "GET",
            p,
            undefined,
            windows.get(win.id),
            undefined,
            true,
          );
          if (r.status !== 200) {
            try {
              r.body = JSON.parse(r.bytes.toString("utf8"));
            } catch {}
            return errorResult(r);
          }
        } else {
          if (r.body?.error?.code === "TOKEN_REVOKED")
            clearSession(r.body.error.message);
          return errorResult(r);
        }
      }
      const type = String(r.headers["content-type"]).split(";")[0];
      if(documentActor!==auth?.user.user_id)throw Error('The session changed during patient document download');
      if (!["image/jpeg", "image/png", "application/pdf"].includes(type))
        throw new Error("Unexpected patient document type");
      if ((type === "application/pdf" && args.save) || args.saveImage) {
        const extension=type==='application/pdf'?'pdf':type==='image/png'?'png':'jpg';
        const target = await dialog.showSaveDialog(win, {
          defaultPath: `Patient-document-${args.documentId}.${extension}`,
          filters: [{ name: type==='application/pdf'?'PDF':'Image', extensions: [extension] }],
        });
        if (!target.canceled) fs.writeFileSync(target.filePath, r.bytes);
        return { ok: true, data: { saved: !target.canceled, type } };
      }
      return { ok: true, data: { type, base64: r.bytes.toString("base64") } };
    }
    if (action === "critical-result-alarm") {
      const actor = auth?.user.user_id;
      const workspace = windows.get(win.id);
      const screenId = require('./critical-alarm.cjs').criticalAlarmScreen(workspace);
      if (!actor || !screenId || !auth.user.permissions.includes('diagnostics.critical.view')) throw new Error('Critical alarm requires an authorised diagnostic workspace');
      if (!Number.isSafeInteger(args.criticalResultId) || args.criticalResultId <= 0) throw new Error('Invalid critical result');
      const [record, facility] = await Promise.all([
        api('GET', `/critical-results/${args.criticalResultId}`, undefined, windows.get(win.id)),
        api('GET', '/establishment', undefined, windows.get(win.id)),
      ]);
      if (!record.ok) return record;
      if (!facility.ok) return facility;
      if (actor !== auth?.user.user_id || windows.get(win.id) !== workspace) throw new Error('The session changed before the alarm');
      const view = facility.data.views.screens.find(s => s.screen_id === screenId)?.view;
      if (!['full','open_work'].includes(view)) throw new Error('The critical-result work view is unavailable');
      const doctor = screenId === 'critical_results_doctor';
      if (doctor) {
        const mine = await api('GET', '/critical-results?mine=true&open_only=true&limit=1000&patient_id='+record.data.patient_id, undefined, workspace);
        if (!mine.ok) return mine;
        if (actor !== auth?.user.user_id || windows.get(win.id) !== workspace) throw new Error('The session changed before the alarm');
        if (!mine.data.some(r => r.critical_result_id === args.criticalResultId)) return {ok:true,data:{played:false}};
      }
      const played = require('./critical-alarm.cjs').criticalAlarmRecord(record.data, args.criticalResultId, require('./critical-alarm.cjs').criticalAlarmSources(screenId));
      if (played) shell.beep();
      return {ok:true,data:{played}};
    }
    if (action === "print-discharge-summary") {
      if(!Number.isSafeInteger(args.admissionId)||args.admissionId<1||!Number.isSafeInteger(args.bedId)||!Number.isSafeInteger(args.rosterId)||!Number.isSafeInteger(args.patientId)||!Number.isSafeInteger(args.expectedVersion)||typeof args.mrn!=='string')throw Error('Invalid summary reference');
      const actor=auth?.user.user_id,workspace=windows.get(win.id);
      const [mine,payload,est]=await Promise.all([api('GET','/ipd/my-beds',undefined,workspace),api('GET',`/admissions/${args.admissionId}/discharge-summary/print-payload`,undefined,workspace),api('GET','/establishment',undefined,workspace)]);
      if(!mine.ok)return mine;if(!payload.ok)return payload;if(!est.ok)return est;
      if(!['full','open_work','records'].includes(est.data.views.screens.find(s=>s.screen_id==='my_beds')?.view)||!mine.data.some(b=>b.bed_id===args.bedId&&b.roster_id===args.rosterId&&b.admission_id===args.admissionId&&b.mrn===args.mrn))throw Error('The duty or admission changed. Read before printing.');
      require('./discharge-summary-print.cjs').assertSummary(payload.data,args.admissionId,args.patientId,args.mrn,args.expectedVersion);
      const terminal=await api('GET','/terminals/whoami');if(!terminal.ok)return terminal;
      if(!actor||actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw Error('The session changed before printing');
      return {ok:true,data:await require('./discharge-summary-print.cjs').printSummary(payload.data,terminal.data,{owner:win,pdf:false,language:prefs.language})};
    }
    if (action === "print-estimate") {
      if(!Number.isSafeInteger(args.estimateId)||args.estimateId<1||!Number.isSafeInteger(args.expectedVersion))throw new Error('Invalid estimate reference');
      const actor=auth?.user.user_id,workspace=windows.get(win.id),screenId=args.screenId||'cost_estimates_admissions';
      if(!['cost_estimates_admissions','cost_estimates_billing','explain_estimate'].includes(screenId))throw Error('Invalid estimate workspace');
      const [record,payload,est]=await Promise.all([api('GET','/cost-estimates/'+args.estimateId,undefined,workspace),api('GET','/cost-estimates/'+args.estimateId+'/print-payload',undefined,workspace),api('GET','/establishment',undefined,workspace)]);
      if(!record.ok)return record;if(!payload.ok)return payload;if(!est.ok)return est;
      if(!['full','open_work','records'].includes(require('./estimate-access.cjs').estimateView(screenId,est.data)))throw new Error('The estimate records view is unavailable');
      const f=require('./estimate-print.cjs').assertEstimate(payload.data,args.estimateId);
      if(record.data.row_version!==args.expectedVersion||f.estimate.row_version!==args.expectedVersion||record.data.patient_id!==f.estimate.patient_id||record.data.mrn!==f.estimate.mrn)throw new Error('The estimate changed. Read it before printing.');
      const terminal=await api('GET','/terminals/whoami');if(!terminal.ok)return terminal;
      if(!actor||actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw new Error('The session changed before estimate printing');
      const tariff=await api('GET','/tariff',undefined,workspace);if(!tariff.ok)return tariff;
      if(actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw new Error('The session changed before estimate printing');
      const printed=await require('./estimate-print.cjs').printEstimate({...payload.data,currency:tariff.data.currency},terminal.data,{owner:win,pdf:!!args.pdf,language:prefs.language});
      if(printed.bytes){const target=await dialog.showSaveDialog(win,{defaultPath:'Estimate-'+record.data.estimate_number+'.pdf',filters:[{name:'PDF',extensions:['pdf']}]});if(!target.canceled)fs.writeFileSync(target.filePath,printed.bytes);return{ok:true,data:{saved:!target.canceled}};}
      return{ok:true,data:printed};
    }
    if (action === "print-complaint") {
      const actor=auth?.user.user_id,workspace=windows.get(win.id),notice=args.kind==='Notice';
      if(!notice&&(!Number.isSafeInteger(args.complaintId)||args.complaintId<1||!Number.isSafeInteger(args.expectedVersion)||!['Acknowledgement','Outcome','AppealOutcome'].includes(args.kind)))throw Error('Invalid complaint document reference');
      if(notice&&args.complaintId!=null)throw Error('Invalid complaint notice');
      let record;if(!notice){record=await api('GET','/complaints/'+args.complaintId,undefined,workspace);if(!record.ok)return record;if(record.data.row_version!==args.expectedVersion)throw Error('The complaint changed. Read it before printing.');}
      const payload=await api('GET',notice?'/complaints/notice/print-payload':'/complaints/'+args.complaintId+'/letter/print-payload?letter='+args.kind,undefined,workspace);if(!payload.ok)return payload;
      require('./complaint-print.cjs').assertComplaintPaper(payload.data,record?.data.complaint_number,notice?undefined:args.kind);
      const terminal=await api('GET','/terminals/whoami');if(!terminal.ok)return terminal;
      if(!actor||actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw Error('The session changed before complaint printing');
      const printed=await require('./complaint-print.cjs').printComplaint(payload.data,terminal.data,{owner:win,pdf:!!args.pdf,language:prefs.language});
      if(printed.bytes){if(actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw Error('The session changed before saving');const target=await dialog.showSaveDialog(win,{defaultPath:notice?'Complaint-notice.pdf':'Complaint-'+record.data.complaint_number+'-'+args.kind+'.pdf',filters:[{name:'PDF',extensions:['pdf']}]});if(actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw Error('The session changed before saving');if(!target.canceled)fs.writeFileSync(target.filePath,printed.bytes);return{ok:true,data:{saved:!target.canceled}};}
      return{ok:true,data:printed};
    }
    if (action === "print-consent") {
      if(!Number.isSafeInteger(args.consentId)||args.consentId<1||!Number.isSafeInteger(args.expectedVersion))throw Error('Invalid consent reference');
      const actor=auth?.user.user_id,workspace=windows.get(win.id);
      const [record,payload,est]=await Promise.all([api('GET','/consents/'+args.consentId,undefined,workspace),api('GET','/consents/'+args.consentId+'/print-payload',undefined,workspace),api('GET','/establishment',undefined,workspace)]);
      if(!record.ok)return record;if(!payload.ok)return payload;if(!est.ok)return est;
      if(!['full','open_work','records'].includes(est.data.views.screens.find(s=>s.screen_id==='consents_admissions')?.view))throw Error('The consent records view is unavailable');
      const f=require('./consent-print.cjs').assertConsent(payload.data,args.consentId);
      if(record.data.row_version!==args.expectedVersion||f.consent.row_version!==args.expectedVersion||record.data.patient_id!==f.consent.patient_id||record.data.mrn!==f.consent.mrn)throw Error('The consent changed. Read it before printing; do not use the old form.');
      const terminal=await api('GET','/terminals/whoami');if(!terminal.ok)return terminal;
      if(!actor||actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw Error('The session changed before consent printing');
      const printed=await require('./consent-print.cjs').printConsent(payload.data,terminal.data,{owner:win,pdf:!!args.pdf});
      if(printed.bytes){const target=await dialog.showSaveDialog(win,{defaultPath:'Consent-'+record.data.consent_number+'.pdf',filters:[{name:'PDF',extensions:['pdf']}]});if(!target.canceled)fs.writeFileSync(target.filePath,printed.bytes);return{ok:true,data:{saved:!target.canceled}};}
      return{ok:true,data:printed};
    }
    if (action === "print-wristband") {
      if(!Number.isSafeInteger(args.wristbandId)||args.wristbandId<1||!Number.isSafeInteger(args.patientId)||args.patientId<1||typeof args.mrn!=='string')throw Error('Invalid wristband reference');
      const actor=auth?.user.user_id,workspace=windows.get(win.id);
      const [history,payload,est]=await Promise.all([api('GET','/wristbands?patient_id='+args.patientId,undefined,workspace),api('GET','/wristbands/'+args.wristbandId+'/print-payload',undefined,workspace),api('GET','/establishment',undefined,workspace)]);
      if(!history.ok)return history;if(!payload.ok)return payload;if(!est.ok)return est;
      const row=history.data.find(b=>b.wristband_id===args.wristbandId);
      if(!row?.is_current||row.patient_id!==args.patientId||row.mrn!==args.mrn)throw Error('The band changed or was replaced. Read the current band before printing.');
      if(!['full','open_work','records'].includes(est.data.views.screens.find(s=>s.screen_id==='wristbands_admissions')?.view))throw Error('The wristband records view is unavailable');
      const {assertWristband,wristbandHtml}=require('./wristband-print.cjs');assertWristband(payload.data,args.wristbandId,args.mrn);
      const terminal=await api('GET','/terminals/whoami');if(!terminal.ok)return terminal;
      if(!actor||actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw Error('The session changed before wristband printing');
      const printed=await require('./opd-print.cjs').printSlip(payload.data,terminal.data,{owner:win,pdf:!!args.pdf,renderHtml:wristbandHtml});
      if(printed.bytes){const target=await dialog.showSaveDialog(win,{defaultPath:'Wristband-'+args.wristbandId+'.pdf',filters:[{name:'PDF',extensions:['pdf']}]});if(!target.canceled)fs.writeFileSync(target.filePath,printed.bytes);return{ok:true,data:{saved:!target.canceled}};}
      return{ok:true,data:printed};
    }
    if (action === "print-lab-label") {
      if(!Number.isSafeInteger(args.sampleId)||args.sampleId<=0)throw new Error('Invalid lab sample');
      const actor=auth?.user.user_id;
      const payload=await api('GET',`/lab/samples/${args.sampleId}/label`,undefined,windows.get(win.id));if(!payload.ok)return payload;
      require('./lab-label-safety.cjs').assertLabLabel(payload.data,args.sampleId);
      try {
      const terminal=await api('GET','/terminals/whoami');if(!terminal.ok)return {ok:true,data:{label:payload.data,printError:terminal.error?.message || 'Cannot read the terminal printer mapping'}};
      if(!actor||actor!==auth?.user.user_id)throw new Error('The session changed before label printing');
      const printed=await require('./opd-print.cjs').printSlip(payload.data,terminal.data,{owner:win,pdf:!!args.pdf});
      if(printed.bytes){const target=await dialog.showSaveDialog(win,{defaultPath:`Lab-sample-${args.sampleId}.pdf`,filters:[{name:'PDF',extensions:['pdf']}]});if(!target.canceled)fs.writeFileSync(target.filePath,printed.bytes);return {ok:true,data:{saved:!target.canceled,label:payload.data}};}
      return {ok:true,data:{...printed,label:payload.data}};
      } catch (error) { return {ok:true,data:{label:payload.data,printError:error.message}}; }
    }
    if (action === "print-pharmacy") {
      if (!Number.isSafeInteger(args.dispensationId) || args.dispensationId <= 0) throw new Error("Invalid dispensation");
      const requestUser = auth?.user.user_id, workspace = windows.get(win.id);
      const payload = await api("GET", `/dispensations/${args.dispensationId}/${args.labels ? "labels" : "receipt-payload"}`, undefined, workspace);
      if (!payload.ok) return payload;
      const terminal = await api("GET", "/terminals/whoami");if(!terminal.ok)return terminal;
      const documents = args.labels ? payload.data : [payload.data];
      if(!Array.isArray(documents) || !documents.length)throw new Error("No pharmacy print documents returned");
      const {printSlip} = require("./opd-print.cjs");let printedCount=0;
      for(const document of documents) {
        if(document.document_type !== (args.labels ? "dispensing_label" : "pharmacy_receipt") || document.printer_role !== (args.labels ? "label" : "receipt"))throw new Error("Unexpected pharmacy print document");
        if((args.labels ? document.fields.dispensation_id : document.fields.dispensation.dispensation_id)!==args.dispensationId)throw new Error("Pharmacy print identity changed");
        if(!requestUser || requestUser!==auth?.user.user_id)throw new Error("The session changed before printing");
        const printed=await printSlip(document,terminal.data,{owner:win,pdf:!!args.pdf});
        if(printed.bytes){
          const target=await dialog.showSaveDialog(win,{defaultPath:`Dispensation-${args.dispensationId}${args.labels ? "-label-"+document.fields.dispensation_item_id : "-receipt"}.pdf`,filters:[{name:"PDF",extensions:["pdf"]}]});
          if(target.canceled)return {ok:true,data:{saved:false,count:printedCount}};
          fs.writeFileSync(target.filePath,printed.bytes);
        }
        printedCount++;
      }
      return {ok:true,data:{saved:!!args.pdf,printed:!args.pdf,count:printedCount}};
    }
    if (action === "print-prescription") {
      if (!Number.isSafeInteger(args.prescriptionId) || args.prescriptionId <= 0) throw new Error("Invalid prescription");
      const requestUser = auth?.user.user_id;
      const payload = await api("GET", `/prescriptions/${args.prescriptionId}/print-payload`, undefined, windows.get(win.id));
      if (!payload.ok) return payload;
      if (payload.data.document_type !== "prescription") throw new Error("Unexpected prescription print payload");
      const terminal = await api("GET", "/terminals/whoami");
      if (!terminal.ok) return terminal;
      if (!requestUser || requestUser !== auth?.user.user_id) throw new Error("The session changed before printing");
      const { printSlip } = require("./opd-print.cjs");
      const printed = await printSlip(payload.data, terminal.data, {owner:win,pdf:!!args.pdf});
      if (printed.bytes) {
        const selected=await dialog.showSaveDialog(win,{defaultPath:`Prescription-${args.prescriptionId}.pdf`,filters:[{name:"PDF",extensions:["pdf"]}]});
        if(!selected.canceled)fs.writeFileSync(selected.filePath,printed.bytes);
        return {ok:true,data:{saved:!selected.canceled}};
      }
      return {ok:true,data:printed};
    }
    if (action === "print-clinical-note") {
      if (!Number.isSafeInteger(args.encounterId) || args.encounterId <= 0) throw new Error("Invalid clinical note");
      const requestUser = auth?.user.user_id;
      const payload = await api("GET", `/clinical-encounters/${args.encounterId}/print-payload`, undefined, windows.get(win.id));
      if (!payload.ok) return payload;
      const terminal = await api("GET", "/terminals/whoami");
      if (!terminal.ok) return terminal;
      const releases = await api("GET", "/icd/releases");
      if (!releases.ok) return releases;
      if (!requestUser || requestUser !== auth?.user.user_id) throw new Error("The session changed before printing");
      const { printClinical } = require("./clinical-print.cjs");
      const printed = await printClinical({...payload.data, icd11_citation:releases.data.icd11_citation}, terminal.data, {owner: win, pdf: !!args.pdf, language: prefs.language});
      if (printed.bytes) {
        const selected = await dialog.showSaveDialog(win, {defaultPath:`Clinical-note-${args.encounterId}.pdf`,filters:[{name:"PDF",extensions:["pdf"]}]});
        if (!selected.canceled) fs.writeFileSync(selected.filePath, printed.bytes);
        return {ok:true,data:{saved:!selected.canceled}};
      }
      return {ok:true,data:printed};
    }
    if (action === "print-sendout") {
      if(!Number.isSafeInteger(args.sendOutId)||args.sendOutId<1)throw new Error('Invalid manifest ID');
      const actor=auth?.user.user_id, workspace=windows.get(win.id);
      const [record,payload,est]=await Promise.all([api('GET','/lab/send-outs/'+args.sendOutId,undefined,workspace),api('GET','/lab/send-outs/'+args.sendOutId+'/print-payload',undefined,workspace),api('GET','/establishment',undefined,workspace)]);
      if(!record.ok)return record;if(!payload.ok)return payload;if(!est.ok)return est;
      if(!actor||actor!==auth?.user.user_id||workspace!==windows.get(win.id))throw new Error('Session changed before manifest printing');
      if(!['full','open_work','records'].includes(est.data.views.screens.find(x=>x.screen_id==='lab_send_outs')?.view))throw new Error('The send-out records view is unavailable');
      const f=require('./sendout-print.cjs').assertSendOut(payload.data,args.sendOutId);
      if(record.data.send_out_id!==f.send_out_id||record.data.manifest_number!==f.manifest_number||record.data.items.length!==f.items.length||f.items.some(i=>!record.data.items.some(r=>r.sample_id===i.sample_id&&r.barcode===i.barcode&&r.mrn===i.mrn)))throw new Error('Manifest print identity changed');
      const terminal=await api('GET','/terminals/whoami');if(!terminal.ok)return terminal;
      if(actor!==auth?.user.user_id)throw new Error('Session changed before manifest printing');
      const printed=await require('./sendout-print.cjs').printSendOut(payload.data,terminal.data,{owner:win,pdf:!!args.pdf,language:prefs.language});
      if(printed.bytes){const target=await dialog.showSaveDialog(win,{defaultPath:'Manifest-'+f.manifest_number+'.pdf',filters:[{name:'PDF',extensions:['pdf']}]});if(!target.canceled)fs.writeFileSync(target.filePath,printed.bytes);return{ok:true,data:{saved:!target.canceled,label:payload.data}};}
      return {ok:true,data:{...printed,label:payload.data}};
    }
    if (action === "print-diagnostic") {
      if (!Number.isSafeInteger(args.id) || args.id<=0 || !["lab","imaging"].includes(args.kind)) throw new Error("Invalid diagnostic report");
      const requestUser=auth?.user.user_id;
      const base=args.kind==="lab"?`/lab/requisitions/${args.id}`:`/imaging/orders/${args.id}`;
      const payload=await api("GET",`${base}/report/print-payload`,undefined,windows.get(win.id));
      if(!payload.ok)return payload;
      const terminal=await api("GET","/terminals/whoami");if(!terminal.ok)return terminal;
      if(!requestUser || requestUser!==auth?.user.user_id)throw new Error("Session changed before printing");
      const printed=await require("./diagnostic-print.cjs").printDiagnostic(payload.data,terminal.data,{owner:win,pdf:!!args.pdf,language:prefs.language});
      if(printed.bytes){const target=await dialog.showSaveDialog(win,{defaultPath:`${args.kind}-report-${args.id}.pdf`,filters:[{name:"PDF",extensions:["pdf"]}]});if(!target.canceled)fs.writeFileSync(target.filePath,printed.bytes);return{ok:true,data:{saved:!target.canceled}}}
      return {ok:true,data:printed};
    }
    if (action === "pacs-viewer") {
      if(!Number.isSafeInteger(args.orderId)||args.orderId<=0)throw new Error("Invalid imaging order");
      const requestUser=auth?.user.user_id;
      const record=await api("GET",`/imaging/orders/${args.orderId}`,undefined,windows.get(win.id));if(!record.ok)return record;
      if(!requestUser||requestUser!==auth?.user.user_id)throw new Error("Session changed before opening the viewer");
      if(!record.data.viewer_url)throw new Error("No PACS viewer URL is available for this study. Ask radiology to check its study link.");
      const target=new URL(record.data.viewer_url);if(!["https:","http:"].includes(target.protocol)||target.username||target.password)throw new Error("Unsafe PACS viewer URL");
      const viewer=new BrowserWindow({width:1200,height:850,parent:win,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
      clinicalViewers.add(viewer);viewer.once("closed",()=>clinicalViewers.delete(viewer));
      viewer.webContents.setWindowOpenHandler(()=>({action:"deny"}));
      viewer.webContents.on("will-navigate",(e,url)=>{try{if(new URL(url).origin!==target.origin)e.preventDefault()}catch{e.preventDefault()}});
      viewer.webContents.on("will-redirect",(e,url)=>{try{if(new URL(url).origin!==target.origin)e.preventDefault()}catch{e.preventDefault()}});
      viewer.webContents.on("will-attach-webview",e=>e.preventDefault());
      await viewer.loadURL(target.href);
      return{ok:true,data:{opened:true}};
    }
    if (action === "service-setup-handbook") {
      if (!auth || !["establishment.manage", "diagnostics.setup.manage"].every(p => auth.user.permissions.includes(p)))
        throw new Error("Your current permissions do not allow this action. Refresh your workspace or contact the administrator.");
      // Facility setup spans workspaces: omit X-Active-Workspace only for this
      // authorised metadata read. Normal api calls keep their window's scope.
      return await api("GET", "/meta/handbook", undefined, undefined);
    }
    if (action === "clinical-pdf") {
      if (typeof args.path !== "string" || !/^(?:\/(?:clinical-encounters|referrals)\/[1-9]\d*\/pdf|\/(?:lab\/requisitions|imaging\/orders)\/[1-9]\d*\/report\/pdf|\/(?:consents|cost-estimates|incidents)\/[1-9]\d*\/pdf|\/admissions\/[1-9]\d*\/discharge-summary\/pdf|\/preventive-programmes\/list\/pdf|\/home-visits\/notice\/pdf|\/incidents\/sentinel-list\/pdf|\/diagnostics\/(?:services|imaging-policy)\/pdf|\/facility\/equipment\/plan\/pdf|\/facility\/compliance-documents\/register\/pdf|\/facility\/drills\/[1-9]\d*\/pdf)$/.test(args.path) && !/^\/complaints\/[1-9]\d*\/letter\/pdf\?letter=(?:Acknowledgement|Outcome|AppealOutcome)$/.test(args.path)) if(!require("./complaint-report-path.cjs").isComplaintReportPath(args.path) && !require("./incident-report-path.cjs").isIncidentReportPath(args.path)) throw new Error("Clinical download not permitted");
      const op=matchOperation("GET",args.path);
      if(!op || !auth || !permissionAllows(op,auth.user)) throw new Error("You do not have permission to download this document");
      if(Date.now()>auth.expires-60000)await refresh();
      const requestSession=auth;
      const r=await raw("GET",args.path,undefined,windows.get(win.id),undefined,true);
      if(requestSession!==auth)throw new Error("The session changed during download");
      if(r.status!==200){try{r.body=JSON.parse(r.bytes.toString("utf8"))}catch{}return errorResult(r)}
      if(String(r.headers["content-type"]).split(";")[0]!=="application/pdf" || !r.bytes.subarray(0,5).equals(Buffer.from("%PDF-")))throw new Error("The server did not return a PDF");
      if(args.preview){
        const viewer=new BrowserWindow({width:1050,height:850,parent:win,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,plugins:true}});
        clinicalViewers.add(viewer);viewer.once("closed",()=>clinicalViewers.delete(viewer));
        viewer.webContents.setWindowOpenHandler(()=>({action:"deny"}));
        viewer.webContents.on("will-navigate",e=>e.preventDefault());
        try {
          await viewer.loadURL("data:application/pdf;base64,"+r.bytes.toString("base64"));
        } catch {
          if(viewer.isDestroyed())return{ok:true,data:{opened:false,cancelled:true}};
          viewer.destroy();
          throw new Error("The PDF preview could not open. Save the document and open it in your PDF reader.");
        }
        return{ok:true,data:{opened:true}};
      }
      const selected=await dialog.showSaveDialog(win,{defaultPath:args.path.startsWith('/facility/drills/') ? 'Haspataal-drill-'+args.path.split('/')[3]+'.pdf' : args.path === '/diagnostics/services/pdf' ? 'Haspataal-diagnostic-services.pdf' : args.path === '/diagnostics/imaging-policy/pdf' ? 'Haspataal-imaging-policy.pdf' : `Clinical-document-${args.path.split("/")[args.path.startsWith("/imaging/orders/") ? 3 : 2]}.pdf`,filters:[{name:"PDF",extensions:["pdf"]}]});
      if(requestSession!==auth || !permissionAllows(op,auth?.user))throw new Error("The session or permission changed before saving the PDF");
      if(!selected.canceled)fs.writeFileSync(selected.filePath,r.bytes);
      return {ok:true,data:{saved:!selected.canceled}};
    }
    if (action === "print-opd") {
      if (!Number.isSafeInteger(args.ticketId) || args.ticketId <= 0)
        throw new Error("Invalid ticket");
      const payload = await api(
        "GET",
        `/opd-tickets/${args.ticketId}/print-payload`,
        undefined,
        windows.get(win.id),
      );
      if (!payload.ok) return payload;
      const terminal = await api("GET", "/terminals/whoami");
      if (!terminal.ok) return terminal;
      const { printSlip } = require("./opd-print.cjs");
      const printed = await printSlip(payload.data, terminal.data, {
        owner: win,
        pdf: !!args.pdf,
      });
      if (printed.bytes) {
        const selected =
          process.env.HASPATAAL_TEST === "1"
            ? {
                canceled: false,
                filePath: path.join(root, "artifacts/opd-slip.pdf"),
              }
            : await dialog.showSaveDialog(win, {
                defaultPath: payload.data.fields.ticket_number + ".pdf",
                filters: [{ name: "PDF", extensions: ["pdf"] }],
              });
        if (!selected.canceled)
          fs.writeFileSync(selected.filePath, printed.bytes);
        return { ok: true, data: { saved: !selected.canceled } };
      }
      return { ok: true, data: printed };
    }
    if (action === "login") {
      if (auth) throw new Error("Already signed in");
      await refreshAddresses();
      const r = await raw("POST", "/auth/login", args);
      if (r.status !== 200) return errorResult(r);
      acceptTokens(r.body.data);
      preferenceContext++;
      prefs = auth.user.preferences;
      applyZoom(prefs.ui_scale_pct);
      const preferenceWarning = await readAccountDisplay();
      if (!auth)
        throw new Error("The session ended during sign-in. Sign in again.");
      broadcast({
        type: "login",
        user: auth.user,
        license: r.body.data.license,
      });
      if (preferenceWarning)
        broadcast({ type: "error", error: { message: preferenceWarning } });
      return {
        ok: true,
        data: { user: auth.user, license: r.body.data.license },
      };
    }
    if (action === "change-password") {
      if (!auth || auth.recovery)
        throw new Error("Confirm your session before changing the password");
      // Old-session revocation can reach its socket before the HTTP token pair.
      // Retire that socket first; only the new session may update this window.
      stopStreams();
      let r;
      try {
        r = await raw(
          "POST",
          args.settings
            ? "/settings/me/change-password"
            : "/auth/change-password",
          {
            current_password: args.current_password,
            new_password: args.new_password,
          },
        );
      } catch (cause) {
        if (auth) {
          auth.recovery =
            "Password change could not be confirmed. Sign in with the new password first; do not repeat the password change.";
          broadcast({ type: "session-recovery", message: auth.recovery });
        }
        throw cause;
      }
      if (r.status !== 200) {
        if (
          ["TOKEN_REVOKED", "REFRESH_TOKEN_REUSED"].includes(
            r.body?.error?.code,
          )
        )
          clearSession(r.body.error.message);
        else for (const id of windows.keys()) connectStream(id);
        return errorResult(r);
      }
      acceptTokens(r.body.data);
      try {
        const me = await raw("GET", "/auth/me");
        if (me.status !== 200)
          throw new Error("Cannot reload account after password change");
        auth.user = me.body.data;
      } catch {
        auth.recovery =
          "Your password changed. Sign in with the new password; the password change will not be repeated.";
        broadcast({ type: "session-recovery", message: auth.recovery });
        return { ok: true, data: { account_refresh_needed: true } };
      }
      const preferenceWarning = await readAccountDisplay();
      if (!auth)
        throw new Error(
          "Your password changed, but the session ended. Sign in with the new password; do not repeat the change.",
        );
      broadcast({ type: "login", user: auth.user });
      if (preferenceWarning)
        broadcast({ type: "error", error: { message: preferenceWarning } });
      for (const id of windows.keys()) connectStream(id);
      return { ok: true, data: auth.user };
    }
    if (action === "reauthenticate") {
      if (!auth?.recovery) throw new Error("No session recovery is pending");
      const priorUser = auth.user;
      const r = await raw("POST", "/auth/login", {
        username: priorUser.username,
        password: args.password,
      });
      if (r.status !== 200) return errorResult(r);
      if (r.body?.data?.user?.user_id !== priorUser.user_id)
        throw new Error(
          "The account identity changed. Sign out and contact IT.",
        );
      acceptTokens(r.body.data);
      preferenceContext++;
      prefs = auth.user.preferences;
      applyZoom(prefs.ui_scale_pct);
      const preferenceWarning = await readAccountDisplay();
      if (!auth) throw new Error("The restored session ended. Sign in again.");
      broadcast({ type: "session-restored", user: auth.user });
      if (preferenceWarning)
        broadcast({ type: "error", error: { message: preferenceWarning } });
      for (const id of windows.keys()) connectStream(id);
      return { ok: true };
    }
    if (action === "logout") {
      if (logoutPending)
        throw new Error("Sign-out is already pending. Wait for the result.");
      if (credentialFlight)
        throw new Error(
          "Wait for the account action to finish before signing out.",
        );
      logoutPending = true;
      try {
        const r = await api("POST", "/auth/logout", {
          all_sessions: !!args.all,
        });
        if (!r.ok) return r;
        clearSession();
        return { ok: true };
      } finally {
        logoutPending = false;
      }
    }
    if (action === "prefs") {
      if (credentialFlight)
        throw new Error(
          "Wait for the account action to finish before changing display preferences.",
        );
      return await queuePrefs(args);
    }
    if (action === "prefs-refresh") {
      if (credentialFlight)
        throw new Error(
          "Wait for the account action to finish before reloading display preferences.",
        );
      return await queuePrefs({ __readPreferences: true });
    }
    if (action === "workspace") {
      if (
        args.code !== null &&
        !auth?.user.workspaces.some((w) => w.code === args.code)
      )
        throw new Error("Workspace is not permitted");
      const est = await api("GET", "/establishment");
      if (!est.ok) return est;
      if (
        est.data.views.workspaces.some(
          (v) => v.workspace === args.code && v.view === "hidden",
        )
      )
        throw new Error("This workspace is hidden by the facility services");
      if (args.newWindow) createWindow(args.code);
      else windows.set(win.id, args.code);
      return { ok: true };
    }
    if (action === "stream") {
      connectStream(win.id);
      return { ok: true };
    }
    if (action === "download") {
      const filenames = {
        "/incidents/sentinel-list/pdf": "Haspataal-what-to-report.pdf",
        "/tariff/pdf": "Haspataal-tariff.pdf",
        "/facility/equipment/plan/pdf": "Haspataal-equipment-plan.pdf",
        "/facility/compliance-documents/register/pdf": "Haspataal-compliance-register.pdf",
      };
      if (!Object.hasOwn(filenames, args.path))
        throw new Error("Download not permitted");
      const op = matchOperation("GET", args.path);
      if (!op || !permissionAllows(op, auth?.user))
        throw new Error("You do not have permission to download this document");
      if (auth && Date.now() > auth.expires - 60000) await refresh();
      const downloadSession = auth;
      let r = await raw(
        "GET",
        args.path,
        undefined,
        windows.get(win.id),
        undefined,
        true,
      );
      const parseError = () => {
        try { r.body = JSON.parse(r.bytes.toString("utf8")); } catch {}
      };
      if (r.status !== 200) {
        parseError();
        if (auth && r.status === 401 && r.body?.error?.code === "TOKEN_EXPIRED") {
          await refresh();
          r = await raw("GET", args.path, undefined, windows.get(win.id), undefined, true);
          if (r.status !== 200) parseError();
        }
        if (r.status !== 200) {
          if (r.body?.error?.code === "TOKEN_REVOKED") clearSession(r.body.error.message);
          return errorResult(r);
        }
      }
      if (auth !== downloadSession || !permissionAllows(op, auth?.user)) throw new Error("The account or its download permission changed. Download again from the current account.");
      if (
        String(r.headers["content-type"]).split(";")[0] !== "application/pdf" ||
        !r.bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
      )
        throw new Error("The server did not return a PDF");
      const result = await dialog.showSaveDialog(win, {
        defaultPath: filenames[args.path],
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (auth !== downloadSession || !permissionAllows(op, auth?.user)) throw new Error("The account or download permission changed before saving.");
      if (!result.canceled) fs.writeFileSync(result.filePath, r.bytes);
      return { ok: true, data: { saved: !result.canceled } };
    }
    if (action === "print-help") {
      return await new Promise((resolve) => {
        win.webContents.print({ silent: false }, (success, failureReason) => {
          resolve(
            success
              ? { ok: true }
              : {
                  ok: false,
                  error: {
                    code: "PRINT_FAILED",
                    message: failureReason || "The handbook was not printed.",
                  },
                },
          );
        });
      });
    }
    if (action === "print-admin-slip") {
      if (
        !auth ||
        ![
          "admin.user.provision",
          "admin.user.manage",
          "admin.badge_station.manage",
        ].some((p) => auth.user.permissions.includes(p))
      )
        throw new Error("Credential printing is not permitted");
      if (
        ![args.target, args.credential, args.kind].every(
          (v) => typeof v === "string" && v.length > 0 && v.length < 1000,
        )
      )
        throw new Error("Invalid credential slip");
      const escape = (value) =>
        value.replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c],
        );
      const slip = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      slip.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      slip.webContents.on("will-navigate", (e) => e.preventDefault());
      try {
        await slip.loadURL(
          "data:text/html;charset=utf-8," +
            encodeURIComponent(
              `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Private credential slip</title><style>body{font:18px sans-serif;margin:40px}strong{font:24px monospace;white-space:pre-wrap}</style><h1>Haspataal — private credential</h1><p>${escape(args.target)}</p><h2>${escape(args.kind)}</h2><strong>${escape(args.credential)}</strong><p>Deliver privately. Change a temporary password at first sign-in. The personnel file still needs its required CNIC copy.</p>`,
            ),
        );
        return await new Promise((resolve) =>
          slip.webContents.print({ silent: false }, (success, reason) =>
            resolve(
              success
                ? { ok: true }
                : {
                    ok: false,
                    error: {
                      code: "PRINT_FAILED",
                      message:
                        reason ||
                        "Credential slip was not printed. Reprint; do not repeat the account action.",
                    },
                  },
            ),
          ),
        );
      } finally {
        slip.destroy();
      }
    }
    throw new Error("Unsupported terminal action");
  } catch (e) {
    if (e instanceof LocalUploadError) return {
      ok: false,
      local_rejection: true,
      request_sent: false,
      error: { code: "LOCAL_UPLOAD_REJECTED", message: e.message },
    };
    return { ok: false, error: { code: "TERMINAL_ERROR", message: e.message } };
  } finally {
    if (credentialAction) credentialFlight = false;
  }
});
app.whenReady().then(async () => {
  if (process.env.HASPATAAL_TEST_DATA)
    app.setPath("userData", process.env.HASPATAAL_TEST_DATA);
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  protocol.handle("app", (request) => {
    try {
      return net.fetch(assetUrl(request.url, path.join(root, "dist")));
    } catch {
      return new Response("Terminal asset not found", { status: 404 });
    }
  });
  try {
    await migrateRecovery({
      WebContentsView,
      legacyUrl: pathToFileURL(path.join(root, "dist", "index.html")).href,
      targetUrl: "app://terminal/storage-migration.html",
    });
  } catch {
    recoveryMigrationError =
      "Facility recovery records could not be migrated. Apply is blocked. Ask IT to reconcile the old and new terminal recovery holds before changing the facility.";
  }
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) =>
      callback(
        permission === "media" &&
          contents.getURL().split("#")[0] === terminalUrl &&
          details.mediaTypes?.length === 1 &&
          details.mediaTypes[0] === "video",
      ),
  );
  prefs = readJson(prefsFile()) || prefs;
  let failure;
  try {
    await loadProvisioning();
  } catch (e) {
    failure = e.message;
    scheduleRecovery();
  }
  const win = createWindow();
  if (failure)
    win.webContents.once("did-finish-load", () =>
      win.webContents.send("terminal-event", {
        type: "error",
        error: { message: failure },
      }),
    );
});
app.on("window-all-closed", () => {
  if (!hasAppWindow) return;
  clearTimeout(refreshTimer);
  clearTimeout(recoveryTimer);
  app.quit();
});
