import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getBadgesCapabilityView,
  validateBadgeIssueInput,
  validateBadgeRevocationInput,
  BADGES_ERROR_MESSAGES,
} from "../src/badges-policy.ts";

test("Badges capability view evaluates facility profiles and mode gates", () => {
  const full = getBadgesCapabilityView({});
  assert.equal(full.mode, "full");
  assert.equal(full.canViewBadges, true);
  assert.equal(full.canIssueBadge, true);
  assert.equal(full.canRevokeBadge, true);
  assert.equal(full.canPrintIdCard, true);

  const records = getBadgesCapabilityView({
    views: { records_only: true, screens: ["badges"] },
  });
  assert.equal(records.mode, "records");
  assert.equal(records.canIssueBadge, false);
  assert.equal(records.canRevokeBadge, false);
  assert.equal(records.canPrintIdCard, false);
  assert(records.noticeEn?.includes("Records Mode"));

  const openWork = getBadgesCapabilityView({
    views: { open_work_only: true, screens: ["badges"] },
  });
  assert.equal(openWork.mode, "open_work");
  assert.equal(openWork.canIssueBadge, true);
  assert.equal(openWork.canRevokeBadge, true);
  assert.equal(openWork.canPrintIdCard, true);

  const setup = getBadgesCapabilityView({
    views: { setup_only: true, screens: ["badges"] },
  });
  assert.equal(setup.mode, "setup");
  assert.equal(setup.canIssueBadge, false);
  assert.equal(setup.canRevokeBadge, false);

  const hidden = getBadgesCapabilityView({
    views: { screens: ["other_screen"] },
  });
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canViewBadges, false);
  assert.equal(hidden.canIssueBadge, false);
});

test("Rule rule:1cc0496368: Barcode technology generates badge code and allows blank UID", () => {
  // Barcode allows empty badge_code (server generates code and prints on card)
  const barcodeIssue = validateBadgeIssueInput({
    technology: "Barcode",
    holder_type: "Employee",
    label: "Access Tag",
  });
  assert.equal(barcodeIssue.valid, true);
  assert.equal(Object.keys(barcodeIssue.errors).length, 0);

  // Default technology is Barcode if omitted
  const defaultIssue = validateBadgeIssueInput({
    holder_type: "Employee",
  });
  assert.equal(defaultIssue.valid, true);
});

test("Rule rule:e361c806a1: RFID requires reader UID and Biometric requires enrolment ID", () => {
  // RFID missing UID
  const rfidMissing = validateBadgeIssueInput({
    technology: "RFID",
    badge_code: "  ",
  });
  assert.equal(rfidMissing.valid, false);
  assert(rfidMissing.errors.badge_code?.includes("RFID card UID is mandatory"));

  // RFID valid UID
  const rfidValid = validateBadgeIssueInput({
    technology: "RFID",
    badge_code: "E28011606000020489AB12CD",
    holder_type: "Security",
  });
  assert.equal(rfidValid.valid, true);

  // Biometric missing enrolment ID
  const bioMissing = validateBadgeIssueInput({
    technology: "Biometric",
    badge_code: "",
  });
  assert.equal(bioMissing.valid, false);
  assert(bioMissing.errors.badge_code?.includes("enrolment ID is mandatory"));

  // Biometric valid enrolment ID
  const bioValid = validateBadgeIssueInput({
    technology: "Biometric",
    badge_code: "ENROL-042",
    holder_type: "SupportStaff",
  });
  assert.equal(bioValid.valid, true);
});

test("Rule rule:2906081f38: Lost card revocation requires operational reason", () => {
  // Missing reason
  const noReason = validateBadgeRevocationInput({ reason: " " });
  assert.equal(noReason.valid, false);
  assert(noReason.errors.reason?.includes("minimum 3 characters"));

  // Short reason
  const shortReason = validateBadgeRevocationInput({ reason: "no" });
  assert.equal(shortReason.valid, false);

  // Valid reason
  const validRevoke = validateBadgeRevocationInput({
    reason: "Card lost in transit by staff member",
  });
  assert.equal(validRevoke.valid, true);
});

test("Error dictionary covers statutory error codes with Urdu translations", () => {
  const codes = [
    "BADGE_CODE_TAKEN",
    "BADGE_NOT_FOUND",
    "BADGE_ALREADY_REVOKED",
    "EMPLOYEE_STATUS_INVALID",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "NOT_FOUND",
  ];

  for (const code of codes) {
    const entry = BADGES_ERROR_MESSAGES[code];
    assert(entry, `Missing dictionary entry for ${code}`);
    assert(entry.en.trim().length > 0, `${code} English message empty`);
    assert(entry.ur.trim().length > 0, `${code} Urdu message empty`);
    assert(/[\u0600-\u06ff]/.test(entry.ur), `${code} missing Urdu characters`);
  }
});

test("Catalogue and task-map cover all 4 contract endpoints", () => {
  const bundle = JSON.parse(fs.readFileSync("contracts/badges.json", "utf8"));
  const catalogue = JSON.parse(fs.readFileSync("src/foundation-catalogue.json", "utf8"));
  const taskMap = JSON.parse(fs.readFileSync("src/foundation-task-map.json", "utf8"));

  assert(catalogue.screens.badges, "catalogue missing badges screen");
  assert.equal(bundle.endpoints.length, 4);

  for (const ep of bundle.endpoints) {
    assert(
      catalogue.screens.badges.taskCalls.includes(ep.endpoint),
      `Catalogue missing taskCall ${ep.endpoint}`
    );
    assert(
      taskMap.badges?.[ep.endpoint],
      `Task map missing mapping for ${ep.endpoint}`
    );
  }
});
