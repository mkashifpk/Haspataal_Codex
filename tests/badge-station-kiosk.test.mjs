import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
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
  BADGE_STATION_ERROR_MESSAGES,
  shouldQueueStationScan,
} from "../src/badge-station-kiosk-policy.ts";

test("badge_station_kiosk: queued feedback never claims attendance, access or cleaning success", () => {
  for (const lang of ["en", "ur"]) {
    const queued = formatScanOutcome("Queued", lang);
    assert.equal(queued.isGreen, false);
    assert.equal(queued.isRed, false);
    assert.equal(queued.tone, "warning");
    assert.notEqual(queued.title, formatScanOutcome("AttendanceIn", lang).title);
  }
});

test("badge_station_kiosk: secure bridge envelope distinguishes network failures from refusals", () => {
  assert.equal(shouldQueueStationScan({ response: { error: { code: "OFFLINE" } } }), true);
  assert.equal(shouldQueueStationScan({ response: { status: 503, error: { code: "TIMEOUT" } } }), true);
  for (const status of [401, 403, 409, 422, 429])
    assert.equal(shouldQueueStationScan({ response: { status, error: { code: "VALIDATION_ERROR" } } }), false);
  assert.equal(shouldQueueStationScan(new TypeError("UI programming error")), false);
  assert.equal(shouldQueueStationScan({ response: { error: { code: "TERMINAL_ERROR" } } }), false);
});

test("badge_station_kiosk: rule:f98f89a7b6 station setup validation and key masking", () => {
  // Invalid empty inputs
  const emptyRes = validateStationSetup("", "");
  assert.equal(emptyRes.valid, false);
  assert(emptyRes.errors.length >= 2);

  // Invalid station ID format
  const invalidIdRes = validateStationSetup("X", "valid_secret_key");
  assert.equal(invalidIdRes.valid, false);

  // Valid station config
  const validRes = validateStationSetup("W2-KIOSK", "secret_station_key_123");
  assert.equal(validRes.valid, true);
  assert.equal(validRes.errors.length, 0);

  // Key masking guarantees station key is never revealed in cleartext (rule:f98f89a7b6)
  const masked = maskStationKey("secret_station_key_123");
  assert(!masked.includes("secret"));
  assert(masked.startsWith("••••"));
  assert.equal(maskStationKey(""), "••••••••");
});

test("badge_station_kiosk: rule:b2f4ebb077 bed code detection logic", () => {
  const dirtyBeds = [
    { bed_id: 1, label: "W2-1", current_state: "Dirty" },
    { bed_id: 2, label: "W2-2", current_state: "Dirty" },
  ];

  // Pattern detection: HMS-BED-... or BED-...
  assert.equal(isBedCode("HMS-BED-10"), true);
  assert.equal(isBedCode("bed-25"), true);
  assert.equal(isBedCode("HMS-BED-W2-1"), true);

  // Explicit match against station dirty beds
  assert.equal(isBedCode("W2-1", dirtyBeds), true);
  assert.equal(isBedCode("w2-2", dirtyBeds), true);

  // Staff badges are not bed codes
  assert.equal(isBedCode("EMP-1001", dirtyBeds), false);
  assert.equal(isBedCode("CARD-SWEEP-1", dirtyBeds), false);
  assert.equal(isBedCode("", dirtyBeds), false);
});

test("badge_station_kiosk: rule:b2f4ebb077 dual scan flow collects bed and badge within 60s", () => {
  const dirtyBeds = [{ bed_id: 1, label: "W2-1", current_state: "Dirty" }];
  const t0 = 1000000;

  // Initial state
  const initial = createInitialDualScanState();
  assert.equal(initial.status, "idle");

  // Step 1: Scan bed sticker first
  const step1 = processDualScanInput(initial, "HMS-BED-1", dirtyBeds, t0);
  assert.equal(step1.readyToSubmit, false);
  assert.equal(step1.next.status, "waiting_for_badge");
  assert.equal(step1.next.bed_code, "HMS-BED-1");
  assert.equal(step1.next.badge_code, null);
  assert.equal(step1.next.expires_at, t0 + 60000);

  // Step 2: Scan staff badge within 60s (at t0 + 15s)
  const step2 = processDualScanInput(step1.next, "EMP-1001", dirtyBeds, t0 + 15000);
  assert.equal(step2.readyToSubmit, true);
  assert.equal(step2.next.status, "complete");
  assert.equal(step2.next.bed_code, "HMS-BED-1");
  assert.equal(step2.next.badge_code, "EMP-1001");

  // Reverse Order Step 1: Scan staff badge first
  const revStep1 = processDualScanInput(initial, "EMP-2002", dirtyBeds, t0);
  assert.equal(revStep1.readyToSubmit, false);
  assert.equal(revStep1.next.status, "waiting_for_bed");
  assert.equal(revStep1.next.badge_code, "EMP-2002");

  // Reverse Order Step 2: Scan bed sticker within 60s
  const revStep2 = processDualScanInput(revStep1.next, "HMS-BED-5", dirtyBeds, t0 + 20000);
  assert.equal(revStep2.readyToSubmit, true);
  assert.equal(revStep2.next.status, "complete");
  assert.equal(revStep2.next.bed_code, "HMS-BED-5");
  assert.equal(revStep2.next.badge_code, "EMP-2002");

  // 60-second window expiration restarts fresh session
  const expiredAttempt = processDualScanInput(step1.next, "NEW-CARD", dirtyBeds, t0 + 65000);
  assert.equal(expiredAttempt.readyToSubmit, false);
  // Restarts with NEW-CARD as first scan
  assert.equal(expiredAttempt.next.status, "waiting_for_bed");
  assert.equal(expiredAttempt.next.badge_code, "NEW-CARD");
});

test("badge_station_kiosk: rule:2554916922 big green / red outcome formatting with bilingual text", () => {
  // Green / Success outcomes
  const attIn = formatScanOutcome("AttendanceIn", "en");
  assert.equal(attIn.isGreen, true);
  assert.equal(attIn.isRed, false);
  assert.equal(attIn.tone, "success");
  assert(attIn.title.includes("Attendance"));

  const attInUr = formatScanOutcome("AttendanceIn", "ur");
  assert(attInUr.title.includes("حاضری"));

  const bedCleaned = formatScanOutcome("BedCleaned", "en");
  assert.equal(bedCleaned.isGreen, true);
  assert.equal(bedCleaned.tone, "success");

  const secPass = formatScanOutcome("SecurityPass", "en");
  assert.equal(secPass.isGreen, true);

  // Red / Danger outcomes
  const unknown = formatScanOutcome("UnknownBadge", "en");
  assert.equal(unknown.isRed, true);
  assert.equal(unknown.isGreen, false);
  assert.equal(unknown.tone, "danger");

  const inactive = formatScanOutcome("InactiveBadge", "en");
  assert.equal(inactive.isRed, true);

  const rejected = formatScanOutcome("Rejected", "ur");
  assert.equal(rejected.isRed, true);
  assert(rejected.title.includes("مسترد"));

  // Amber / Warning outcomes
  const duplicate = formatScanOutcome("Duplicate", "en");
  assert.equal(duplicate.isGreen, false);
  assert.equal(duplicate.isRed, false);
  assert.equal(duplicate.tone, "warning");
});

test("badge_station_kiosk: rule:438ca845ec offline queue and unique gateway_event_id generation", () => {
  // Generates unique event IDs per station
  const ev1 = generateGatewayEventId("W2-KIOSK");
  const ev2 = generateGatewayEventId("W2-KIOSK");
  assert(ev1.startsWith("gw-W2-KIOSK-"));
  assert.notEqual(ev1, ev2);

  // Enqueue offline scan
  const scan1 = {
    station_id: "W2-KIOSK",
    badge_code: "EMP-101",
    gateway_event_id: ev1,
    scanned_at: new Date().toISOString(),
  };

  const queue1 = enqueueOfflineScan(scan1, []);
  assert.equal(queue1.length, 1);

  // Idempotent duplicate check: cannot add identical gateway_event_id twice
  const queueDuplicate = enqueueOfflineScan(scan1, queue1);
  assert.equal(queueDuplicate.length, 1);

  // Enqueue second scan
  const scan2 = {
    station_id: "W2-KIOSK",
    badge_code: "EMP-102",
    gateway_event_id: ev2,
    scanned_at: new Date().toISOString(),
  };
  const queue2 = enqueueOfflineScan(scan2, queue1);
  assert.equal(queue2.length, 2);

  // Dequeue delivered item
  const queueAfterSync = dequeueOfflineScan(ev1, queue2);
  assert.equal(queueAfterSync.length, 1);
  assert.equal(queueAfterSync[0].gateway_event_id, ev2);
});

test("badge_station_kiosk: debounce enforcement prevents duplicate scans", () => {
  const t0 = 5000000;
  const lastScan = { code: "EMP-1001", timestamp: t0 };

  // Scan same badge after 2 seconds (debounce is 5s) -> blocked
  const resTooFast = checkDebounce(lastScan, "EMP-1001", 5, t0 + 2000);
  assert.equal(resTooFast, false);

  // Scan same badge after 6 seconds -> permitted
  const resAllowed = checkDebounce(lastScan, "EMP-1001", 5, t0 + 6000);
  assert.equal(resAllowed, true);

  // Scan different badge immediately -> permitted
  const resDifferent = checkDebounce(lastScan, "EMP-2002", 5, t0 + 1000);
  assert.equal(resDifferent, true);
});

test("badge_station_kiosk: BADGE_STATION_ERROR_MESSAGES contains statutory bilingual messages", () => {
  const requiredCodes = ["BADGE_STATION_UNKNOWN", "VALIDATION_ERROR", "OFFLINE_QUEUED", "SCAN_TIMEOUT"];
  for (const code of requiredCodes) {
    assert(BADGE_STATION_ERROR_MESSAGES[code], `Missing code: ${code}`);
    assert(BADGE_STATION_ERROR_MESSAGES[code].en, `Missing English for ${code}`);
    assert(BADGE_STATION_ERROR_MESSAGES[code].ur, `Missing Urdu for ${code}`);
  }
});

test("badge_station_kiosk: contract endpoints and tasks mapped in catalogue and task map", () => {
  const bundle = JSON.parse(fs.readFileSync("contracts/badge_station_kiosk.json", "utf8"));
  const catalogue = JSON.parse(fs.readFileSync("src/foundation-catalogue.json", "utf8"));
  const taskMap = JSON.parse(fs.readFileSync("src/foundation-task-map.json", "utf8"));

  assert(catalogue.screens.badge_station_kiosk, "badge_station_kiosk missing in foundation-catalogue.json");
  assert(taskMap.badge_station_kiosk, "badge_station_kiosk missing in foundation-task-map.json");

  for (const ep of bundle.endpoints) {
    assert(
      catalogue.screens.badge_station_kiosk.taskCalls.includes(ep.endpoint),
      `Endpoint ${ep.endpoint} missing from catalogue`,
    );
    assert(
      taskMap.badge_station_kiosk[ep.endpoint],
      `Endpoint ${ep.endpoint} missing from taskMap`,
    );
  }
});
