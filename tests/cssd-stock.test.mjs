import test from "node:test";
import assert from "node:assert/strict";

import {
  getCssdStockScreenView,
  isCssdActive,
  canOperateCssd,
  canIssuePacks,
  canViewCssd,
  sortPacksByExpiry,
  validatePackIssue,
  explainCssdStockError,
} from "../src/cssd-stock-policy.ts";

test("getCssdStockScreenView evaluates establishment views and capability state (rule:56077b4ba3)", () => {
  // Null fallback
  assert.equal(getCssdStockScreenView(null), "full");

  // Server declared screen view takes precedence
  const estWithScreenView = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [],
    views: {
      screens: [{ screen_id: "cssd_stock", view: "records" }],
      workspaces: [],
    },
  };
  assert.equal(getCssdStockScreenView(estWithScreenView), "records");

  // Capability state fallbacks
  const estRetiring = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Retiring" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getCssdStockScreenView(estRetiring), "open_work");

  const estRetired = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Retired" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getCssdStockScreenView(estRetired), "records");

  const estPreparing = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Preparing" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getCssdStockScreenView(estPreparing), "setup");

  const estAvailable = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Available" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getCssdStockScreenView(estAvailable), "hidden");

  // Inactive cssd fallback
  const estInactive = {
    revision: 1,
    profile: null,
    active: ["pharmacy", "opd"],
    rules_in_force: [],
    capabilities: [],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getCssdStockScreenView(estInactive), "setup");
});

test("isCssdActive and role permissions for CSSD stock and dispatch", () => {
  assert.equal(isCssdActive(null), false);
  assert.equal(isCssdActive({ active: ["opd"] }), false);
  assert.equal(isCssdActive({ active: ["cssd", "ot"] }), true);

  // canOperateCssd & canIssuePacks
  assert.equal(canOperateCssd(null), false);
  assert.equal(canOperateCssd({ permissions: ["ward.view"] }), false);
  assert.equal(canOperateCssd({ permissions: ["cssd.operate"] }), true);
  assert.equal(canIssuePacks({ permissions: ["cssd.operate"] }), true);

  // canViewCssd
  assert.equal(canViewCssd(null), false);
  assert.equal(canViewCssd({ permissions: ["cssd.view"] }), true);
  assert.equal(canViewCssd({ permissions: ["cssd.manage"] }), true);
  assert.equal(canViewCssd({ permissions: ["cssd.pack.use"] }), true);
  assert.equal(canViewCssd({ permissions: ["cssd.operate"] }), true);
  assert.equal(canViewCssd({ permissions: ["reception.view"] }), false);
});

test("sortPacksByExpiry enforces FIFO ordering with expiring_soon prioritized (rule:613c123950)", () => {
  const packs = [
    {
      pack_code: "P-300",
      status: "Available",
      expires_on: "2026-11-20T10:00:00Z",
      expiring_soon: false,
    },
    {
      pack_code: "P-100",
      status: "Available",
      expires_on: "2026-11-05T10:00:00Z",
      expiring_soon: true,
    },
    {
      pack_code: "P-200",
      status: "Available",
      expires_on: "2026-11-15T10:00:00Z",
      expiring_soon: false,
    },
    {
      pack_code: "P-050",
      status: "Available",
      expires_on: "2026-11-02T10:00:00Z",
      expiring_soon: true,
    },
  ];

  const sorted = sortPacksByExpiry(packs);
  assert.equal(sorted[0].pack_code, "P-050"); // expiring soon, earliest date
  assert.equal(sorted[1].pack_code, "P-100"); // expiring soon, next earliest date
  assert.equal(sorted[2].pack_code, "P-200"); // not expiring soon, earlier date
  assert.equal(sorted[3].pack_code, "P-300"); // not expiring soon, later date
});

test("validatePackIssue validates non-empty basket and rejects duplicate pack codes", () => {
  const sampleWards = [{ ward_id: 1, name: "General Ward" }];
  const sampleOTs = [{ ot_id: 10, name: "OR Suite 1" }];

  // Empty basket
  const emptyRes = validatePackIssue({
    packCodes: [],
    destinationType: "ward",
    wardId: 1,
    otId: null,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.errors[0], /at least one sterile pack/);

  // Duplicate pack codes
  const dupRes = validatePackIssue({
    packCodes: ["PACK-01", "PACK-02", "PACK-01"],
    destinationType: "ward",
    wardId: 1,
    otId: null,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(dupRes.valid, false);
  assert.match(dupRes.errors[0], /Duplicate pack codes/);
});

test("validatePackIssue validates destination from server lists only (rule:5298373f7d & rule:3834d11044)", () => {
  const sampleWards = [{ ward_id: 5, name: "Surgical Ward" }];
  const sampleOTs = [{ ot_id: 12, name: "Main Theatre 1" }];

  // Valid ward issue
  const validWardRes = validatePackIssue({
    packCodes: ["PACK-100", "PACK-101"],
    destinationType: "ward",
    wardId: 5,
    otId: null,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(validWardRes.valid, true);
  assert.equal(validWardRes.errors.length, 0);

  // Valid OT issue
  const validOtRes = validatePackIssue({
    packCodes: ["PACK-200"],
    destinationType: "ot",
    wardId: null,
    otId: 12,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(validOtRes.valid, true);
  assert.equal(validOtRes.errors.length, 0);

  // Unlisted ward
  const badWardRes = validatePackIssue({
    packCodes: ["PACK-100"],
    destinationType: "ward",
    wardId: 999,
    otId: null,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(badWardRes.valid, false);
  assert.match(badWardRes.errors[0], /not found in the hospital bed matrix/);

  // Unlisted OT
  const badOtRes = validatePackIssue({
    packCodes: ["PACK-100"],
    destinationType: "ot",
    wardId: null,
    otId: 888,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(badOtRes.valid, false);
  assert.match(badOtRes.errors[0], /not found in the theatre registry/);
});

test("validatePackIssue rejects dual destination or missing destination", () => {
  const sampleWards = [{ ward_id: 1, name: "General Ward" }];
  const sampleOTs = [{ ot_id: 10, name: "Main OT" }];

  // Both ward and OT selected for ward type
  const dualWard = validatePackIssue({
    packCodes: ["P-1"],
    destinationType: "ward",
    wardId: 1,
    otId: 10,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(dualWard.valid, false);
  assert.match(dualWard.errors[0], /simultaneously/);

  // Both ward and OT selected for OT type
  const dualOt = validatePackIssue({
    packCodes: ["P-1"],
    destinationType: "ot",
    wardId: 1,
    otId: 10,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(dualOt.valid, false);
  assert.match(dualOt.errors[0], /simultaneously/);

  // Missing ward
  const missingWard = validatePackIssue({
    packCodes: ["P-1"],
    destinationType: "ward",
    wardId: null,
    otId: null,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(missingWard.valid, false);
  assert.match(missingWard.errors[0], /Select a destination ward/);

  // Missing OT
  const missingOt = validatePackIssue({
    packCodes: ["P-1"],
    destinationType: "ot",
    wardId: null,
    otId: null,
    wards: sampleWards,
    theaters: sampleOTs,
  });
  assert.equal(missingOt.valid, false);
  assert.match(missingOt.errors[0], /Select a destination operating theatre/);
});

test("explainCssdStockError provides comprehensive bilingual error translations", () => {
  // CSSD_PACK_UNUSABLE with pack code
  const packUnusable = explainCssdStockError("CSSD_PACK_UNUSABLE", { pack_code: "PACK-88" });
  assert.match(packUnusable.en, /PACK-88/);
  assert.match(packUnusable.ur, /PACK-88/);

  // CSSD_PACK_UNUSABLE without details
  const generalUnusable = explainCssdStockError("CSSD_PACK_UNUSABLE");
  assert.match(generalUnusable.en, /cannot be issued or used/);
  assert.match(generalUnusable.ur, /جاری یا استعمال نہیں کیا جا سکتا/);

  // REFERENCE_NOT_FOUND
  const refNotFound = explainCssdStockError("REFERENCE_NOT_FOUND");
  assert.match(refNotFound.en, /referenced record/);
  assert.match(refNotFound.ur, /حوالہ شدہ ریکارڈ/);

  // FORBIDDEN
  const forbidden = explainCssdStockError("FORBIDDEN");
  assert.match(forbidden.en, /cssd.operate required/);
  assert.match(forbidden.ur, /cssd.operate درکار ہے/);

  // CAPABILITY_INACTIVE
  const capInactive = explainCssdStockError("CAPABILITY_INACTIVE");
  assert.match(capInactive.en, /CSSD service is inactive/);
  assert.match(capInactive.ur, /سی ایس ایس ڈی سروس غیر فعال ہے/);

  // Unknown fallback
  const fallback = explainCssdStockError("UNKNOWN_CODE");
  assert.match(fallback.en, /UNKNOWN_CODE/);
  assert.match(fallback.ur, /UNKNOWN_CODE/);
});
