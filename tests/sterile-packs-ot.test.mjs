import test from "node:test";
import assert from "node:assert/strict";
import {
  getSterilePacksScreenView,
  canUsePack,
  canViewPacks,
  isPackUsable,
  validatePackUseInput,
  isPackExpiringSoon,
  isCssdRecallEvent,
  explainSterilePackError,
} from "../src/sterile-packs-policy.ts";

test("sterile_packs_ot: getSterilePacksScreenView evaluates runtime service capability views (Rule 26e45f89a1)", () => {
  const estFull = {
    views: {
      screens: [{ screen_id: "sterile_packs_ot", view: "full" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estFull), "full");

  const estOpenWork = {
    views: {
      screens: [{ screen_id: "sterile_packs_ot", view: "open_work" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estOpenWork), "open_work");

  const estRecords = {
    views: {
      screens: [{ screen_id: "sterile_packs_ot", view: "records" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estRecords), "records");

  const estHidden = {
    views: {
      screens: [{ screen_id: "sterile_packs_ot", view: "hidden" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estHidden), "hidden");

  // Fallback when missing
  assert.equal(getSterilePacksScreenView(null), "full");
});

test("sterile_packs_ot: role and permission gates for using and viewing sterile packs", () => {
  // canUsePack
  assert.equal(canUsePack(null), false);
  assert.equal(canUsePack({ user_id: 1, username: "nurse", permissions: ["cssd.pack.use"] }), true);
  assert.equal(canUsePack({ user_id: 2, username: "nurse", roles: ["ot_nurse"] }), true);
  assert.equal(canUsePack({ user_id: 3, username: "nurse", roles: ["ward_nurse"] }), true);
  assert.equal(canUsePack({ user_id: 4, username: "admin", roles: ["ot_admin"] }), true);
  assert.equal(canUsePack({ user_id: 5, username: "doc", roles: ["doctor"], permissions: [] }), false);

  // canViewPacks
  assert.equal(canViewPacks(null), false);
  assert.equal(canViewPacks({ user_id: 1, username: "user", permissions: ["cssd.view"] }), true);
  assert.equal(canViewPacks({ user_id: 2, username: "user", permissions: ["cssd.operate"] }), true);
  assert.equal(canViewPacks({ user_id: 3, username: "user", roles: ["cssd_technician"] }), true);
  assert.equal(canViewPacks({ user_id: 4, username: "user", roles: ["ot_nurse"] }), true);
});

test("sterile_packs_ot: isPackUsable enforces Rule 5eabbbecca (rejects unusable packs)", () => {
  // Usable Available pack
  const validPack = {
    pack_id: 101,
    pack_code: "P-101",
    status: "Available",
    cycle_status: "Released",
    cycle_number: "C-2026-001",
    expires_on: "2026-11-30",
  };
  assert.equal(isPackUsable(validPack).usable, true);

  // Usable Issued pack
  const issuedPack = { ...validPack, status: "Issued" };
  assert.equal(isPackUsable(issuedPack).usable, true);

  // Expired pack
  const expiredPack = { ...validPack, status: "Expired" };
  const expCheck = isPackUsable(expiredPack);
  assert.equal(expCheck.usable, false);
  assert(expCheck.reason.includes("EXPIRED"));

  // Failed pack
  const failedPack = { ...validPack, status: "Failed" };
  const failCheck = isPackUsable(failedPack);
  assert.equal(failCheck.usable, false);
  assert(failCheck.reason.includes("failed"));

  // Recalled pack
  const recalledPack = { ...validPack, status: "Recalled" };
  const recCheck = isPackUsable(recalledPack);
  assert.equal(recCheck.usable, false);
  assert(recCheck.reason.includes("RECALLED"));

  // Already Used pack
  const usedPack = { ...validPack, status: "Used", used_at: "2026-11-01T10:00:00Z" };
  const usedCheck = isPackUsable(usedPack);
  assert.equal(usedCheck.usable, false);
  assert(usedCheck.reason.includes("ALREADY USED"));

  // Failed Cycle
  const failedCyclePack = { ...validPack, cycle_status: "Failed" };
  const cycleFailCheck = isPackUsable(failedCyclePack);
  assert.equal(cycleFailCheck.usable, false);
  assert(cycleFailCheck.reason.includes("failed"));

  // Recalled Cycle
  const recalledCyclePack = { ...validPack, cycle_status: "Recalled" };
  const cycleRecCheck = isPackUsable(recalledCyclePack);
  assert.equal(cycleRecCheck.usable, false);
  assert(cycleRecCheck.reason.includes("RECALLED"));
});

test("sterile_packs_ot: validatePackUseInput enforces Rule d8f4d7af47 and cross-field rules", () => {
  // Empty barcode
  assert.equal(validatePackUseInput("", { booking_id: 12 }).valid, false);
  assert.equal(validatePackUseInput("   ", { booking_id: 12 }).valid, false);

  // Missing both operation and admission
  const noContext = validatePackUseInput("P-2026-001", {});
  assert.equal(noContext.valid, false);
  assert(noContext.error.includes("Rule d8f4d7af47"));

  // Valid with booking_id
  assert.equal(validatePackUseInput("P-2026-001", { booking_id: 42 }).valid, true);

  // Valid with admission_id
  assert.equal(validatePackUseInput("P-2026-001", { admission_id: 88 }).valid, true);
});

test("sterile_packs_ot: isPackExpiringSoon and isCssdRecallEvent evaluate safety indicators", () => {
  // Expiry check
  assert.equal(isPackExpiringSoon(null), false);
  assert.equal(isPackExpiringSoon({ expiring_soon: true }), true);
  assert.equal(isPackExpiringSoon({ expiring_soon: false }), false);

  // Recall event detection (Rule 4357be8acb)
  assert.equal(isCssdRecallEvent(null), false);
  assert.equal(isCssdRecallEvent({ status: "Released" }), false);
  assert.equal(isCssdRecallEvent({ status: "Recalled" }), true);
  assert.equal(isCssdRecallEvent({ cycle_status: "Recalled" }), true);
});

test("sterile_packs_ot: explainSterilePackError returns bilingual messages", () => {
  const errUnusable = explainSterilePackError("CSSD_PACK_UNUSABLE");
  assert(errUnusable.en.includes("Rule 5eabbbecca"));
  assert(errUnusable.ur.includes("قاعدہ 5eabbbecca"));

  const errRef = explainSterilePackError("REFERENCE_NOT_FOUND");
  assert(errRef.en.length > 0);
  assert(errRef.ur.length > 0);

  const errVal = explainSterilePackError("VALIDATION_ERROR");
  assert(errVal.en.length > 0);
  assert(errVal.ur.length > 0);
});
