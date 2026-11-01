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

test("sterile_packs_ward: getSterilePacksScreenView evaluates runtime service capability views (Rule b531dda372)", () => {
  const estFull = {
    views: {
      screens: [{ screen_id: "sterile_packs_ward", view: "full" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estFull, "sterile_packs_ward"), "full");

  const estOpenWork = {
    views: {
      screens: [{ screen_id: "sterile_packs_ward", view: "open_work" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estOpenWork, "sterile_packs_ward"), "open_work");

  const estRecords = {
    views: {
      screens: [{ screen_id: "sterile_packs_ward", view: "records" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estRecords, "sterile_packs_ward"), "records");

  const estHidden = {
    views: {
      screens: [{ screen_id: "sterile_packs_ward", view: "hidden" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estHidden, "sterile_packs_ward"), "hidden");

  // Fallback when missing
  assert.equal(getSterilePacksScreenView(null, "sterile_packs_ward"), "full");
});

test("sterile_packs_ward: role and permission gates for ward_nurse workspace", () => {
  // canUsePack permits ward_nurse role and cssd.pack.use
  assert.equal(canUsePack(null), false);
  assert.equal(canUsePack({ user_id: 1, username: "nurse", roles: ["ward_nurse"] }), true);
  assert.equal(canUsePack({ user_id: 2, username: "nurse", permissions: ["cssd.pack.use"] }), true);
  assert.equal(canUsePack({ user_id: 3, username: "pharmacist", roles: ["pharmacist"], permissions: [] }), false);

  // canViewPacks permits ward_nurse role and cssd permissions
  assert.equal(canViewPacks(null), false);
  assert.equal(canViewPacks({ user_id: 1, username: "nurse", roles: ["ward_nurse"] }), true);
  assert.equal(canViewPacks({ user_id: 2, username: "nurse", permissions: ["cssd.view"] }), true);
});

test("sterile_packs_ward: isPackUsable enforces Rule 5eabbbecca (rejects unusable packs on the ward)", () => {
  const validPack = {
    pack_id: 301,
    pack_code: "P-WARD-01",
    status: "Available",
    cycle_status: "Released",
    cycle_number: "C-2026-W01",
    expires_on: "2026-12-31",
  };
  assert.equal(isPackUsable(validPack).usable, true);

  // Recalled pack
  const recalledPack = { ...validPack, status: "Recalled" };
  const recCheck = isPackUsable(recalledPack);
  assert.equal(recCheck.usable, false);
  assert(recCheck.reason.includes("RECALLED"));

  // Expired pack
  const expiredPack = { ...validPack, status: "Expired" };
  const expCheck = isPackUsable(expiredPack);
  assert.equal(expCheck.usable, false);
  assert(expCheck.reason.includes("EXPIRED"));

  // Used pack
  const usedPack = { ...validPack, status: "Used" };
  const usedCheck = isPackUsable(usedPack);
  assert.equal(usedCheck.usable, false);
  assert(usedCheck.reason.includes("ALREADY USED"));

  // Failed sterilization cycle
  const failedCyclePack = { ...validPack, cycle_status: "Failed" };
  const failCycleCheck = isPackUsable(failedCyclePack);
  assert.equal(failCycleCheck.usable, false);
  assert(failCycleCheck.reason.includes("failed"));
});

test("sterile_packs_ward: validatePackUseInput enforces Rule d8f4d7af47 and cross-field rules for admissions", () => {
  // Empty barcode rejected
  assert.equal(validatePackUseInput("", { admission_id: 15 }).valid, false);

  // Missing admission_id and booking_id rejected
  assert.equal(validatePackUseInput("P-WARD-01", {}).valid, false);

  // Valid with ward admission_id
  assert.equal(validatePackUseInput("P-WARD-01", { admission_id: 55 }).valid, true);
});

test("sterile_packs_ward: isPackExpiringSoon and isCssdRecallEvent safety checks (Rule 4357be8acb)", () => {
  assert.equal(isPackExpiringSoon({ expiring_soon: true }), true);
  assert.equal(isPackExpiringSoon({ expiring_soon: false }), false);

  // Recall event detection
  assert.equal(isCssdRecallEvent({ status: "Recalled" }), true);
  assert.equal(isCssdRecallEvent({ cycle_status: "Recalled" }), true);
  assert.equal(isCssdRecallEvent({ status: "Released" }), false);
});

test("sterile_packs_ward: explainSterilePackError returns bilingual guidance", () => {
  const explained = explainSterilePackError("CSSD_PACK_UNUSABLE");
  assert(explained.en.includes("Rule 5eabbbecca"));
  assert(explained.ur.includes("قاعدہ 5eabbbecca"));

  const notFound = explainSterilePackError("REFERENCE_NOT_FOUND");
  assert(notFound.en.length > 0);
  assert(notFound.ur.length > 0);
});
