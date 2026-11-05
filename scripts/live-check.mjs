import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { request, checkedRoot } = require("../electron/transport.cjs");
const config = JSON.parse(fs.readFileSync(".dev-terminal.json", "utf8"));
const ca = checkedRoot(config.ca_pem, config.ca_fingerprint_sha256);
// Use a reachable pinned address, as the terminal does. The first configured
// address may be an office LAN address unavailable over the VPN.
let base;
for (const address of config.server_urls) {
  try {
    const health = await request(address + "/health", { ca, timeoutMs: 3000 });
    if (health.status === 200) { base = address; break; }
  } catch { /* Try the next configured address; never relax TLS. */ }
}
if (!base) throw new Error("No configured pinned DEV server address is reachable");
const records = [];
let token;
const { validate } = require("../electron/contract.cjs");
const bundles = fs
  .readdirSync("contracts")
  .filter(n=>n.endsWith('.json'))
  .map((n) => JSON.parse(fs.readFileSync("contracts/" + n, "utf8")));
const schemas = Object.assign({}, ...bundles.map((b) => b.schemas || {}));
const operations = bundles.flatMap((b) => b.endpoints || []);
async function get(method, path, body) {
  const r = await request(base + "/api/v1" + path, {
    ca,
    method,
    body,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Haspataal-Developer": "mkashif",
      "X-Haspataal-Implementation": "1",
    },
  });
  const op = operations.find(
    (o) => o.endpoint === method + " " + path.split("?")[0],
  );
  const schema = Object.values(
    op?.responses?.[String(r.status)]?.content || {},
  )[0]?.schema;
  const problems = schema ? validate(r.body, schema, schemas) : [];
  records.push({
    method,
    path,
    status: r.status,
    request_id: r.body?.request_id,
    error: r.body?.error,
    problems,
  });
  if (r.status >= 400 || problems.length)
    throw new Error(
      `${method} ${path}: ${r.status} ${r.body?.error?.code || problems.join("; ")}`,
    );
  return r.body.data;
}
try {
  const d = await get("POST", "/auth/login", {
    username: "demo.owner",
    password: "Demo-pass-2026",
  });
  token = d.access_token;
  for (const path of [
    "/auth/me",
    "/auth/workspaces",
    "/settings/sections",
    "/settings/me",
    "/meta/enums",
    "/meta/settings",
    "/meta/workspaces",
    "/meta/error-codes",
    "/meta/events",
    "/meta/handbook?workspace=owner_dashboard",
    "/establishment",
    "/establishment/profiles",
    "/establishment/staffing",
    "/establishment/changes",
    "/msds/profile",
    "/msds/category-confirmations",
    "/facility/compliance-documents?category=Hospital",
    "/notifications?limit=5",
    "/notifications/unread-count",
    "/approvals?mine=true",
    "/incident-types",
    "/incidents?mine=true",
    "/admin/departments",
  ])
    await get("GET", path);
  await get("POST", "/establishment/changes/preview", {
    reason: "Codex foundation validation: preview only",
    capabilities: [],
  });
  if (token) {
    await get("POST", "/auth/logout", { all_sessions: false });
    token = null;
  }

  // Verify reception role & my_cash_shift endpoints
  const recepAuth = await get("POST", "/auth/login", {
    username: "demo.reception",
    password: "Demo-pass-2026",
  });
  token = recepAuth.access_token;
  const shift = await get("GET", "/finance/cash-shifts/mine");
  if (shift?.shift_id) {
    await get("GET", `/finance/cash-shifts/${shift.shift_id}/transactions`);
  }

  // Verify patient_search endpoints (Screen 13)
  let searchHits = await get("GET", "/patients/search?q=SCN&limit=5");
  if (!Array.isArray(searchHits) || searchHits.length === 0) {
    searchHits = await get("GET", "/patients/search?q=MRN&limit=5");
  }
  if (Array.isArray(searchHits) && searchHits.length > 0) {
    const patientId = searchHits[0].patient_id;
    await get("GET", `/patients/${patientId}`);
    await get("GET", `/patients/${patientId}/financial-summary`);
  }
  console.log(`Verified ${records.length} live requests.`);
} finally {
  if (token) await get("POST", "/auth/logout", { all_sessions: false });
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync(
    "artifacts/live-check.json",
    JSON.stringify(records, null, 2),
  );
}
