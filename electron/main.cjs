const {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  dialog,
  session,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const { pathToFileURL } = require("node:url");
const WebSocket = require("ws");
const { request, checkedRoot } = require("./transport.cjs");
const { discover } = require("./discovery.cjs");
const { validate, permissionAllows } = require("./contract.cjs");
const { createPreferenceQueue } = require("./preference-queue.cjs");
const { isDegradedHealthResponse } = require("./health-response.cjs");
let server = null,
  auth = null,
  refreshFlight = null,
  refreshTimer,
  recoveryTimer,
  recoveryStep = 0;
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
  return { server: publicServer(), connected, user: auth?.user || null, prefs };
}
function clearSession(reason = "Signed out") {
  preferenceContext++;
  clearTimeout(refreshTimer);
  auth = null;
  refreshFlight = null;
  try {
    fs.unlinkSync(tokenFile());
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
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
  auth = {
    ...auth,
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000,
    user: data.user || auth?.user,
  };
  fs.writeFileSync(tokenFile(), safeStorage.encryptString(data.refresh_token));
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
  try {
    const result = await request(server.current + apiPath(p), {
      ca: server.ca_pem,
      method,
      body,
      headers: {
        ...headers(workspace),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      binary,
    });
    if (!connected) {
      connected = true;
      broadcast({ type: "connection", connected: true });
    }
    return result;
  } catch (e) {
    connected = false;
    broadcast({ type: "connection", connected: false });
    scheduleRecovery();
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
  refreshFlight = (async () => {
    try {
      const r = await raw("POST", "/auth/refresh", {
        refresh_token: auth.refresh,
      });
      if (r.status !== 200) {
        const message = r.body?.error?.message || "Session refresh failed";
        clearSession(message);
        throw new Error(message);
      }
      acceptTokens(r.body.data);
    } catch (e) {
      if (auth)
        clearSession("Session refresh could not be confirmed. Sign in again.");
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
  const op = matchOperation(method, p);
  if (!op && !["/health", "/health/live"].includes(p))
    throw new Error("Endpoint is outside the foundation contract");
  if (auth && Date.now() > auth.expires - 60000) await refresh();
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
  const r = await raw(method, p, body, workspace, key);
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
  server.urls = [...new Set([...info.urls, ...server.urls])];
  server.hospital_name = info.hospital_name;
  fs.writeFileSync(locationFile(), JSON.stringify(server));
  return info;
}
async function pickAddress() {
  let lastError;
  for (const url of [
    ...new Set([server.current, ...server.urls].filter(Boolean)),
  ]) {
    try {
      const r = await request(url + "/health/live", { ca: server.ca_pem });
      if (r.status === 200) {
        server.current = url;
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
  if (recoveryTimer || !server) return;
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    try {
      await pickAddress();
      recoveryStep = 0;
      broadcast({ type: "connection", connected: true });
      for (const id of streams.keys()) connectStream(id);
    } catch {
      recoveryStep++;
      scheduleRecovery();
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
function connectStream(id) {
  const win = BrowserWindow.fromId(id);
  if (!win || !auth || !connected) return;
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
  socket.on("error", () => send({ type: "stream", status: "Reconnecting" }));
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
    stream.timer = setTimeout(
      () => connectStream(id),
      Math.min(stream.backoff, 30000),
    );
    stream.backoff *= 2;
  });
}
function createWindow(workspace = null) {
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
    if (url !== pathToFileURL(path.join(root, "dist/index.html")).href)
      event.preventDefault();
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
  win.loadFile(path.join(root, "dist/index.html"));
  return win;
}
async function loadProvisioning() {
  let provision;
  if (process.platform === "win32") {
    provision = await new Promise((resolve) =>
      execFile(
        "reg",
        ["query", "HKLM\\SOFTWARE\\Policies\\Haspataal\\Terminal", "/reg:64"],
        { windowsHide: true },
        (err, out) => {
          if (err) return resolve(null);
          const v = {};
          for (const line of out.split(/\r?\n/)) {
            const m = line.match(/^\s+(\S+)\s+REG_(?:SZ|DWORD)\s+(.*)$/);
            if (m) v[m[1]] = m[2].trim();
          }
          resolve(
            v.ServerUrls
              ? {
                  server_urls: v.ServerUrls.split(";").filter(Boolean),
                  ca_fingerprint_sha256: v.CaFingerprintSha256,
                  hospital_name: v.HospitalName,
                  source: "policy",
                }
              : null,
          );
        },
      ),
    );
  }
  if (!provision && !app.isPackaged && process.env.HASPATAAL_DEV_CONFIG)
    provision = readJson(process.env.HASPATAAL_DEV_CONFIG);
  if (!provision) {
    provision = readJson(
      path.join(
        process.env.ProgramData || "C:\\ProgramData",
        "Haspataal Terminal",
        "terminal.json",
      ),
    );
    if (provision) {
      if (provision.schema !== "haspataal.terminal/1")
        throw new Error("Unsupported terminal provisioning schema");
      provision.source = "file";
    }
  }
  if (provision) {
    const urls = provision.server_urls;
    if (!Array.isArray(urls) || !urls.length)
      throw new Error("Provisioning has no server addresses");
    let pem = provision.ca_pem;
    if (!pem) {
      const r = await request(new URL("/ca.crt", urls[0]).href, {
        bootstrap: true,
      });
      if (r.status !== 200) throw new Error("Cannot download hospital root");
      pem = r.body;
    }
    server = {
      urls,
      current: urls[0],
      ca_pem: checkedRoot(pem, provision.ca_fingerprint_sha256),
      ca_fingerprint_sha256: new X509Certificate(pem).fingerprint256,
      hospital_name: provision.hospital_name,
      source: provision.source || "file",
    };
  } else server = readJson(locationFile());
  if (server) {
    checkedRoot(server.ca_pem, server.ca_fingerprint_sha256);
    await pickAddress();
    await refreshAddresses();
  }
}
ipcMain.handle("terminal", async (event, action, args = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (
    !win ||
    !windows.has(win.id) ||
    event.senderFrame !== event.sender.mainFrame
  )
    throw new Error("Untrusted IPC sender");
  try {
    if (action === "state")
      return { ok: true, data: { ...state(), workspace: windows.get(win.id) } };
    if (action === "discover") return { ok: true, data: await discover() };
    if (action === "inspect-server") {
      if (auth) throw new Error("Sign out before changing servers");
      const u = new URL(args.url);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.pathname !== "/"
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
      const r = await raw("POST", "/auth/login", args);
      if (r.status !== 200) return errorResult(r);
      acceptTokens(r.body.data);
      preferenceContext++;
      prefs = auth.user.preferences;
      applyZoom(prefs.ui_scale_pct);
      await refreshAddresses();
      broadcast({ type: "login", user: auth.user });
      return {
        ok: true,
        data: { user: auth.user, license: r.body.data.license },
      };
    }
    if (action === "change-password") {
      const r = await raw("POST", "/auth/change-password", args);
      if (r.status !== 200) return errorResult(r);
      acceptTokens(r.body.data);
      const me = await raw("GET", "/auth/me");
      if (me.status !== 200) return errorResult(me);
      auth.user = me.body.data;
      broadcast({ type: "login", user: auth.user });
      return { ok: true, data: auth.user };
    }
    if (action === "logout") {
      const r = await api("POST", "/auth/logout", { all_sessions: !!args.all });
      if (!r.ok) return r;
      clearSession();
      return { ok: true };
    }
    if (action === "prefs") {
      return await queuePrefs(args);
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
    throw new Error("Unsupported terminal action");
  } catch (e) {
    return { ok: false, error: { code: "TERMINAL_ERROR", message: e.message } };
  }
});
app.whenReady().then(async () => {
  if (process.env.HASPATAAL_TEST_DATA)
    app.setPath("userData", process.env.HASPATAAL_TEST_DATA);
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) =>
      callback(
        permission === "media" &&
          contents.getURL() ===
            pathToFileURL(path.join(root, "dist/index.html")).href &&
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
  clearTimeout(refreshTimer);
  clearTimeout(recoveryTimer);
  app.quit();
});
