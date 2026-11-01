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

test("sterile_packs_ot_admin: getSterilePacksScreenView evaluates runtime service capability views (Rule d897ee980e)", () => {
  const estFull = {
    views: {
      screens: [{ screen_id: "sterile_packs_ot_admin", view: "full" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estFull, "sterile_packs_ot_admin"), "full");

  const estOpenWork = {
    views: {
      screens: [{ screen_id: "sterile_packs_ot_admin", view: "open_work" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estOpenWork, "sterile_packs_ot_admin"), "open_work");

  const estRecords = {
    views: {
      screens: [{ screen_id: "sterile_packs_ot_admin", view: "records" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estRecords, "sterile_packs_ot_admin"), "records");

  const estHidden = {
    views: {
      screens: [{ screen_id: "sterile_packs_ot_admin", view: "hidden" }],
    },
  };
  assert.equal(getSterilePacksScreenView(estHidden, "sterile_packs_ot_admin"), "hidden");

  // Fallback when missing
  assert.equal(getSterilePacksScreenView(null, "sterile_packs_ot_admin"), "full");
});

test("sterile_packs_ot_admin: role and permission gates for ot_admin workspace", () => {
  // canUsePack permits ot_admin role and cssd.pack.use
  assert.equal(canUsePack(null), false);
  assert.equal(canUsePack({ user_id: 1, username: "admin", roles: ["ot_admin"] }), true);
  assert.equal(canUsePack({ user_id: 2, username: "admin", permissions: ["cssd.pack.use"] }), true);
  assert.equal(canUsePack({ user_id: 3, username: "accountant", roles: ["cashier"], permissions: [] }), false);

  // canViewPacks permits ot_admin role and cssd permissions
  assert.equal(canViewPacks(null), false);
  assert.equal(canViewPacks({ user_id: 1, username: "admin", roles: ["ot_admin"] }), true);
  assert.equal(canViewPacks({ user_id: 2, username: "admin", permissions: ["cssd.view"] }), true);
  assert.equal(canViewPacks({ user_id: 3, username: "admin", permissions: ["cssd.manage"] }), true);
});

test("sterile_packs_ot_admin: isPackUsable enforces Rule 5eabbbecca (rejects unusable packs in ot_admin)", () => {
  const validPack = {
    pack_id: 201,
    pack_code: "P-ADM-01",
    status: "Available",
    cycle_status: "Released",
    cycle_number: "C-2026-999",
    expires_on: "2026-12-15",
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

  // Failed sterilization cycle
  const failedCyclePack = { ...validPack, cycle_status: "Failed" };
  const failCycleCheck = isPackUsable(failedCyclePack);
  assert.equal(failCycleCheck.usable, false);
  assert(failCycleCheck.reason.includes("failed"));
});

test("sterile_packs_ot_admin: validatePackUseInput enforces Rule d8f4d7af47 and cross-field rules", () => {
  // Empty barcode rejected
  assert.equal(validatePackUseInput("", { booking_id: 10 }).valid, false);

  // Missing surgical booking or admission rejected
  assert.equal(validatePackUseInput("P-ADM-01", {}).valid, false);

  // Valid with surgical booking
  assert.equal(validatePackUseInput("P-ADM-01", { booking_id: 25 }).valid, true);
});

test("sterile_packs_ot_admin: isPackExpiringSoon and isCssdRecallEvent safety checks (Rule 4357be8acb)", () => {
  assert.equal(isPackExpiringSoon({ expiring_soon: true }), true);
  assert.equal(isPackExpiringSoon({ expiring_soon: false }), false);

  // Recall event detection
  assert.equal(isCssdRecallEvent({ status: "Recalled" }), true);
  assert.equal(isCssdRecallEvent({ cycle_status: "Recalled" }), true);
  assert.equal(isCssdRecallEvent({ status: "Released" }), false);
});

test("sterile_packs_ot_admin: explainSterilePackError returns bilingual guidance", () => {
  const explained = explainSterilePackError("CSSD_PACK_UNUSABLE");
  assert(explained.en.includes("Rule 5eabbbecca"));
  assert(explained.ur.includes("قاعدہ 5eabbbecca"));

  const notFound = explainSterilePackError("REFERENCE_NOT_FOUND");
  assert(notFound.en.length > 0);
  assert(notFound.ur.length > 0);
});
