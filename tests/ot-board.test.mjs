import test from "node:test";
import assert from "node:assert/strict";

import {
  getOtBoardScreenView,
  isSurgeryActive,
  canViewOtStatus,
  getStateBadgeInfo,
  sortTheatersForBoard,
  formatDurationMinutes,
  explainOtBoardError,
} from "../src/ot-board-policy.ts";

test("getOtBoardScreenView evaluates establishment views and surgery capability state (rule:cc0fcec2de)", () => {
  // Null fallback
  assert.equal(getOtBoardScreenView(null), "full");

  // Server declared screen view takes precedence
  const estWithScreenView = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [],
    views: {
      screens: [{ screen_id: "ot_board", view: "records" }],
      workspaces: [],
    },
  };
  assert.equal(getOtBoardScreenView(estWithScreenView), "records");

  // Capability state fallbacks
  const estRetiring = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [{ capability: "surgery", state: "Retiring" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtBoardScreenView(estRetiring), "open_work");

  const estRetired = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [{ capability: "surgery", state: "Retired" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtBoardScreenView(estRetired), "records");

  const estPreparing = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [{ capability: "surgery", state: "Preparing" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtBoardScreenView(estPreparing), "setup");

  const estAvailable = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [{ capability: "surgery", state: "Available" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtBoardScreenView(estAvailable), "hidden");

  // Inactive surgery fallback
  const estInactive = {
    revision: 1,
    profile: null,
    active: ["pharmacy", "opd"],
    rules_in_force: [],
    capabilities: [],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtBoardScreenView(estInactive), "setup");
});

test("isSurgeryActive and role permissions for OT status board", () => {
  assert.equal(isSurgeryActive(null), false);
  assert.equal(isSurgeryActive({ active: ["opd"] }), false);
  assert.equal(isSurgeryActive({ active: ["surgery", "ot"] }), true);

  // canViewOtStatus
  assert.equal(canViewOtStatus(null), false);
  // Default user with empty permissions allowed for shared airport-style display board
  assert.equal(canViewOtStatus({ user_id: 1, permissions: [] }), true);
  // Specific permissions
  assert.equal(canViewOtStatus({ permissions: ["ot.status.view"] }), true);
  assert.equal(canViewOtStatus({ permissions: ["ot.booking.view"] }), true);
  assert.equal(canViewOtStatus({ permissions: ["doctor.view"] }), true);
  assert.equal(canViewOtStatus({ permissions: ["ward.view"] }), true);
  assert.equal(canViewOtStatus({ permissions: ["unrelated.perm"] }), false);
});

test("getStateBadgeInfo maps room state to icons and styles (rule:01511e9050)", () => {
  // Available -> 🟢
  const avail = getStateBadgeInfo("Available");
  assert.equal(avail.icon, "🟢");
  assert.equal(avail.label, "Available");
  assert.equal(avail.labelUr, "دستیاب");

  // InSurgery -> 🔴
  const inSurg = getStateBadgeInfo("InSurgery");
  assert.equal(inSurg.icon, "🔴");
  assert.equal(inSurg.label, "In-Surgery");
  assert.equal(inSurg.labelUr, "سرجری جاری ہے");
  assert.match(inSurg.badgeClass, /animate-pulse/);

  // CleaningPrep -> 🟡
  const cleaning = getStateBadgeInfo("CleaningPrep");
  assert.equal(cleaning.icon, "🟡");
  assert.equal(cleaning.label, "Cleaning-Prep");
  assert.equal(cleaning.labelUr, "صفائی / تیاری");

  // EmergencyHold -> ⚠️
  const emHold = getStateBadgeInfo("EmergencyHold");
  assert.equal(emHold.icon, "⚠️");
  assert.equal(emHold.label, "Emergency Hold");
  assert.equal(emHold.labelUr, "ہنگامی ہولڈ");

  // OutOfService -> ⚪
  const outServ = getStateBadgeInfo("OutOfService");
  assert.equal(outServ.icon, "⚪");
  assert.equal(outServ.label, "Out of Service");
});

test("sortTheatersForBoard orders InSurgery and EmergencyHold first", () => {
  const theaters = [
    { ot_id: 1, name: "OR Suite 1", code: "OR-1", theater_type: "General", current_state: "Available", state_changed_at: "", active_booking_id: null, active_procedure: null, active_status: null, actual_start: null, expected_end: null, next_start: null, next_procedure: null },
    { ot_id: 2, name: "OR Suite 2", code: "OR-2", theater_type: "Orthopaedic", current_state: "InSurgery", state_changed_at: "", active_booking_id: 10, active_procedure: "Knee Arthroscopy - Dr. Aslam", active_status: "InProgress", actual_start: "2026-11-01T09:00:00Z", expected_end: "2026-11-01T10:30:00Z", next_start: null, next_procedure: null },
    { ot_id: 3, name: "OR Suite 3", code: "OR-3", theater_type: "Cardiac", current_state: "EmergencyHold", state_changed_at: "", active_booking_id: null, active_procedure: null, active_status: null, actual_start: null, expected_end: null, next_start: null, next_procedure: null },
    { ot_id: 4, name: "OR Suite 4", code: "OR-4", theater_type: "Maternity", current_state: "CleaningPrep", state_changed_at: "", active_booking_id: null, active_procedure: null, active_status: null, actual_start: null, expected_end: null, next_start: null, next_procedure: null },
    { ot_id: 5, name: "OR Suite 5", code: "OR-5", theater_type: "General", current_state: "OutOfService", state_changed_at: "", active_booking_id: null, active_procedure: null, active_status: null, actual_start: null, expected_end: null, next_start: null, next_procedure: null },
  ];

  const sorted = sortTheatersForBoard(theaters);
  assert.equal(sorted[0].current_state, "InSurgery");
  assert.equal(sorted[1].current_state, "EmergencyHold");
  assert.equal(sorted[2].current_state, "CleaningPrep");
  assert.equal(sorted[3].current_state, "Available");
  assert.equal(sorted[4].current_state, "OutOfService");
});

test("formatDurationMinutes computes elapsed time string", () => {
  assert.equal(formatDurationMinutes(null), "");

  // 15 minutes ago
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  assert.equal(formatDurationMinutes(fifteenMinsAgo), "15m elapsed");

  // 75 minutes ago (1h 15m)
  const seventyFiveMinsAgo = new Date(Date.now() - 75 * 60 * 1000).toISOString();
  assert.equal(formatDurationMinutes(seventyFiveMinsAgo), "1h 15m elapsed");
});

test("TheaterBoardOut preserves patient anonymity (rule:01511e9050)", () => {
  const roomData = {
    ot_id: 1,
    name: "OR Suite 1",
    code: "OR-1",
    theater_type: "General",
    current_state: "InSurgery",
    state_changed_at: "2026-11-01T09:00:00Z",
    active_booking_id: 55,
    active_procedure: "Laparoscopic Cholecystectomy - Dr. Imran Khan",
    active_status: "InProgress",
    actual_start: "2026-11-01T09:15:00Z",
    expected_end: "2026-11-01T10:45:00Z",
    next_start: "2026-11-01T11:15:00Z",
    next_procedure: "Inguinal Hernioplasty - Dr. Farooq",
  };

  // Ensure no patient name or MRN keys exist in TheaterBoardOut contract
  assert.equal("patient_name" in roomData, false);
  assert.equal("mrn" in roomData, false);
  assert.equal("patient_id" in roomData, false);

  // Active procedure string contains procedure and surgeon only
  assert.match(roomData.active_procedure, /Cholecystectomy/);
  assert.match(roomData.active_procedure, /Dr\./);
});

test("explainOtBoardError provides clear bilingual messages", () => {
  const forbidden = explainOtBoardError("FORBIDDEN");
  assert.match(forbidden.en, /permission/);
  assert.match(forbidden.ur, /اجازت/);

  const inactive = explainOtBoardError("CAPABILITY_INACTIVE");
  assert.match(inactive.en, /inactive/);
  assert.match(inactive.ur, /غیر فعال/);

  const fallback = explainOtBoardError("OTHER");
  assert.match(fallback.en, /OTHER/);
  assert.match(fallback.ur, /OTHER/);
});
