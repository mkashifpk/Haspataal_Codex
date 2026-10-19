import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  hospitalTimeInput,
  hospitalTimeToUtc,
  formatHospitalTime,
  hospitalTimeZoneError,
} from "../src/hospital-time.ts";
import {
  createFacilityAttempt,
  readFacilityAttempt,
  mayRetryFacilityAttempt,
  definitiveFacilityRefusal,
  storedFacilityAttempt,
  storeFacilityAttempt,
  removeFacilityAttempt,
} from "../src/facility-recovery.ts";
const require = createRequire(import.meta.url);
const { isDegradedHealthResponse } = require("../electron/health-response.cjs");
const { validate } = require("../electron/contract.cjs");

test("documented health 503 is a readable degraded envelope; other failures are not", () => {
  const bundle = JSON.parse(fs.readFileSync("contracts/login.json", "utf8"));
  const op = bundle.endpoints.find((e) => e.endpoint === "GET /health");
  const schema = Object.values(op.responses["200"].content)[0].schema;
  const body = {
    data: {
      status: "degraded",
      version: "1.0.0",
      server_time: "2026-10-19T15:30:00Z",
      components: { database: "down", realtime: "up" },
      maintenance_mode: false,
      license: {
        state: "grace",
        reason: "hardware_changed",
        detail: "Synthetic contract fixture",
        grace_until: null,
        days_left: null,
      },
      uptime_seconds: 10,
    },
    meta: { server_time: "2026-10-19T15:30:00Z" },
    request_id: "unit-health-contract",
  };
  assert(isDegradedHealthResponse("/health", 503, body));
  assert.deepEqual(validate(body, schema, bundle.schemas), []);
  assert(!isDegradedHealthResponse("/other", 503, body));
  assert(!isDegradedHealthResponse("/health", 500, body));
  assert(
    !isDegradedHealthResponse("/health", 503, {
      error: { code: "UNAVAILABLE" },
    }),
  );
  delete body.data.components;
  assert(
    validate(body, schema, bundle.schemas).some((e) =>
      e.includes("components"),
    ),
    "degraded does not bypass contract validation",
  );
});
test("hospital wall time converts independently of workstation timezone", () => {
  const instant = "2026-10-19T15:30:00.000Z";
  assert.equal(hospitalTimeInput(instant, "Asia/Karachi"), "2026-10-19T20:30");
  assert.equal(hospitalTimeToUtc("2026-10-19T20:30", "Asia/Karachi"), instant);
  assert.match(
    formatHospitalTime(instant, "Asia/Karachi"),
    /20:30.*Asia\/Karachi/,
  );
  assert.equal(
    hospitalTimeInput(instant, "America/Los_Angeles"),
    "2026-10-19T08:30",
  );
  assert.equal(hospitalTimeToUtc("2026-10-19T21:00", "Asia/Kolkata"), instant);
});
test("missing/invalid zones and impossible or ambiguous hospital times are refused", () => {
  assert(hospitalTimeZoneError(undefined));
  assert(hospitalTimeZoneError("unknown/hospital"));
  assert.throws(
    () => hospitalTimeToUtc("2026-02-30T12:00", "Asia/Karachi"),
    /valid hospital/,
  );
  assert.throws(
    () => hospitalTimeToUtc("2026-03-08T02:30", "America/New_York"),
    /does not exist/,
  );
  assert.throws(
    () => hospitalTimeToUtc("2026-11-01T01:30", "America/New_York"),
    /ambiguous/,
  );
});
test("Facility recovery preserves the original identity/payload despite later draft edits or reload", () => {
  const body = {
    reason: "Synthetic unit test",
    expected_revision: 3,
    capabilities: [{ capability: "imaging", state: "Preparing" }],
    acknowledged: ["reviewed"],
  };
  const preview = {
    revision: 3,
    profile: null,
    moves: [],
    problems: [],
    acknowledgements: [],
    warnings: [],
    allowed: true,
  };
  const attempt = createFacilityAttempt(body, preview, 1000);
  const serialized = JSON.stringify(attempt);
  body.reason = "Changed draft";
  body.capabilities[0].state = "Active";
  preview.revision = 4;
  const restored = readFacilityAttempt(serialized);
  assert.equal(restored.key, attempt.key);
  assert.deepEqual(restored.body, attempt.body);
  assert.equal(restored.body.reason, "Synthetic unit test");
  assert.equal(restored.body.capabilities[0].state, "Preparing");
  assert(mayRetryFacilityAttempt(restored, 1001));
  assert(!mayRetryFacilityAttempt(restored, 1000 + 86400000));
  assert(!mayRetryFacilityAttempt(restored, 999));
  assert.throws(() => readFacilityAttempt('{"version":1}'), /invalid/);
});
test("only definite refusals release a Facility attempt for a new preview", () => {
  assert(
    definitiveFacilityRefusal({
      response: { status: 409, error: { code: "VERSION_CONFLICT" } },
    }),
  );
  assert(definitiveFacilityRefusal({ response: { status: 422 } }));
  for (const status of [undefined, 201, 408, 429, 500, 503])
    assert(!definitiveFacilityRefusal({ response: { status } }));
  assert(!definitiveFacilityRefusal(new Error("lost reply")));
});

test("durable Facility records survive a new reader and windows cannot overwrite or delete one another", () => {
  const entries = new Map();
  const store = {
    get length() {
      return entries.size;
    },
    key: (i) => [...entries.keys()][i] || null,
    getItem: (key) => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const preview = {
    revision: 1,
    profile: null,
    moves: [],
    problems: [],
    acknowledgements: [],
    warnings: [],
    allowed: true,
  };
  const first = createFacilityAttempt(
    { reason: "First window", expected_revision: 1, acknowledged: [] },
    preview,
    1000,
  );
  const second = createFacilityAttempt(
    { reason: "Second window", expected_revision: 1, acknowledged: [] },
    preview,
    2000,
  );
  storeFacilityAttempt(store, "hospital-a:user-1", first);
  storeFacilityAttempt(store, "hospital-a:user-1", second);
  assert.equal(entries.size, 2);
  assert.equal(
    storedFacilityAttempt(store, "hospital-a:user-1").key,
    first.key,
  );
  assert.equal(storedFacilityAttempt(store, "hospital-a:user-2"), undefined);
  assert.equal(storedFacilityAttempt(store, "hospital-b:user-1"), undefined);
  removeFacilityAttempt(store, "hospital-a:user-1", second);
  assert.equal(
    storedFacilityAttempt(store, "hospital-a:user-1").key,
    first.key,
  );
});
