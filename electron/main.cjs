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
} = require("electron");
const fs = require("node:fs");
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
const { request, checkedRoot } = require("./transport.cjs");
const { discover } = require("./discovery.cjs");
const { validate, permissionAllows } = require("./contract.cjs");
const { createPreferenceQueue } = require("./preference-queue.cjs");
const { isDegradedHealthResponse } = require("./health-response.cjs");
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
let connected = false,
  pendingCa = null,
  prefs = { theme: "Light", language: "en", ui_scale_pct: 100 };
const windows = new Map(),
  streams = new Map();
const root = path.join(__dirname, "..");
const bundles = fs
  .readdirSync(path.join(root, "contracts"))
  .filter((n) => !n.startsWith("meta-") && !n.startsWith("handbook-"))
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
function headers(workspace) {
  return {
    ...(mac ? { "X-Terminal-Mac": mac } : {}),
    ...(!app.isPackaged
      ? {
          "X-Haspataal-Developer": "mkashif",
          "X-Haspataal-Implementation": "1",
        }
      : {}),
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
async function raw(method, p, body, workspace, key, binary = false) {
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
    if (method === "GET") {
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
  return operations.find((e) => {
    const [m, route] = e.endpoint.split(" ");
    return (
      m === method &&
      new RegExp("^" + route.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(
        p.split("?")[0],
      )
    );
  });
}
async function api(method, p, body, workspace, key, retried = false) {
  if (method === "POST" && p === "/establishment/changes" && recoveryMigrationError)
    throw new Error(recoveryMigrationError);
  const op = matchOperation(method, p);
  if (!op && !["/health", "/health/live"].includes(p))
    throw new Error("Endpoint is outside the foundation contract");
  if (auth?.recovery && op?.access.authentication !== "public")
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
  const r = await raw(method, p, body, workspace, key);
  if (requestSession && requestSession !== auth)
    return { ok: false, error: { code: "SESSION_CHANGED", message: "The account session changed while reading this result. Reload the current view." } };
  if (!retried && r.status === 401 && r.body?.error?.code === "TOKEN_EXPIRED") {
    await refresh();
    return api(method, p, body, workspace, key, true);
  }
  if (["TOKEN_REVOKED", "REFRESH_TOKEN_REUSED"].includes(r.body?.error?.code))
    clearSession(r.body.error.message);
  if (r.status === 403 && r.body?.error?.code === "FORBIDDEN" && auth) {
    const me = await raw("GET", "/auth/me");
    if (me.status === 200) {
      auth.user = me.body.data;
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
    return {ok:true,data:prefs};
  }
  if (value.ui_scale_pct !== undefined)
    value.ui_scale_pct = Math.max(
      100,
      Math.min(250, Math.round(value.ui_scale_pct)),
    );
  if (auth) {
    const r = await api("PUT", "/settings/me", value);
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
    const r = await queuePrefs({__readPreferences:true});
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
    stream = { last: null, seen: new Set(), backoff: 1000, stopped: false };
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
          send({ type: "stream", status: "Live", resync: true });
        } else send({ type: "stream", status: "Catching up" });
      }
      if (m.type === "replay_complete")
        send({ type: "stream", status: "Live", resync: true });
      if (m.type === "event" && !stream.seen.has(m.event_id)) {
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
      const r = await request(u.origin + "/ca.crt", { bootstrap: true });
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
    if (action === "api") {
      if (
        /^\/(auth\/(login|refresh|logout|change-password)|settings\/me\/change-password)(\?|$)/.test(
          args.path,
        )
      )
        throw new Error("Use the dedicated session action");
      return await api(
        args.method,
        args.path,
        args.body,
        windows.get(win.id),
        args.key,
      );
    }
    if (action === "patient-file") {
      if (!Number.isSafeInteger(args.documentId) || args.documentId <= 0)
        throw new Error("Invalid document");
      const p = `/patient-documents/${args.documentId}/download`;
      const op = matchOperation("GET", p);
      if (!auth || !op || !permissionAllows(op, auth.user))
        throw new Error("You do not have permission to view patient documents");
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
      if (!["image/jpeg", "image/png", "application/pdf"].includes(type))
        throw new Error("Unexpected patient document type");
      if (type === "application/pdf" && args.save) {
        const target = await dialog.showSaveDialog(win, {
          defaultPath: `Patient-document-${args.documentId}.pdf`,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (!target.canceled) fs.writeFileSync(target.filePath, r.bytes);
        return { ok: true, data: { saved: !target.canceled, type } };
      }
      return { ok: true, data: { type, base64: r.bytes.toString("base64") } };
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
      if (!auth) throw new Error("The session ended during sign-in. Sign in again.");
      broadcast({
        type: "login",
        user: auth.user,
        license: r.body.data.license,
      });
      if (preferenceWarning) broadcast({type:"error",error:{message:preferenceWarning}});
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
      if (!auth) throw new Error("Your password changed, but the session ended. Sign in with the new password; do not repeat the change.");
      broadcast({ type: "login", user: auth.user });
      if (preferenceWarning) broadcast({type:"error",error:{message:preferenceWarning}});
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
      if (preferenceWarning) broadcast({type:"error",error:{message:preferenceWarning}});
      for (const id of windows.keys()) connectStream(id);
      return { ok: true };
    }
    if (action === "logout") {
      const r = await api("POST", "/auth/logout", { all_sessions: !!args.all });
      if (!r.ok) return r;
      clearSession();
      return { ok: true };
    }
    if (action === "prefs") {
      if (credentialFlight) throw new Error("Wait for the account action to finish before changing display preferences.");
      return await queuePrefs(args);
    }
    if (action === "prefs-refresh") {
      if (credentialFlight) throw new Error("Wait for the account action to finish before reloading display preferences.");
      return await queuePrefs({__readPreferences:true});
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
      if (args.path !== "/incidents/sentinel-list/pdf")
        throw new Error("Download not permitted");
      const r = await raw(
        "GET",
        args.path,
        undefined,
        windows.get(win.id),
        undefined,
        true,
      );
      if (
        r.status !== 200 ||
        !r.bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
      )
        throw new Error("The server did not return a PDF");
      const result = await dialog.showSaveDialog(win, {
        defaultPath: "Haspataal-what-to-report.pdf",
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
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
      if (!auth || !["admin.user.provision", "admin.user.manage", "admin.badge_station.manage"].some(p => auth.user.permissions.includes(p)))
        throw new Error("Credential printing is not permitted");
      if (![args.target,args.credential,args.kind].every(v => typeof v === "string" && v.length > 0 && v.length < 1000))
        throw new Error("Invalid credential slip");
      const escape = value => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
      const slip = new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
      slip.webContents.setWindowOpenHandler(() => ({action:"deny"}));
      slip.webContents.on("will-navigate", e => e.preventDefault());
      try {
        await slip.loadURL("data:text/html;charset=utf-8,"+encodeURIComponent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Private credential slip</title><style>body{font:18px sans-serif;margin:40px}strong{font:24px monospace;white-space:pre-wrap}</style><h1>Haspataal — private credential</h1><p>${escape(args.target)}</p><h2>${escape(args.kind)}</h2><strong>${escape(args.credential)}</strong><p>Deliver privately. Change a temporary password at first sign-in. The personnel file still needs its required CNIC copy.</p>`));
        return await new Promise(resolve => slip.webContents.print({silent:false},(success,reason)=>resolve(success?{ok:true}:{ok:false,error:{code:"PRINT_FAILED",message:reason || "Credential slip was not printed. Reprint; do not repeat the account action."}})));
      } finally {slip.destroy();}
    }
    throw new Error("Unsupported terminal action");
  } catch (e) {
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
    recoveryMigrationError = "Facility recovery records could not be migrated. Apply is blocked. Ask IT to reconcile the old and new terminal recovery holds before changing the facility.";
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
