import test from "node:test";
import assert from "node:assert/strict";

import {
  getOtSettlementCapabilityView,
  canViewOtSettlement,
  canPreviewSettlement,
  canFinalizeSettlement,
  validateParticipants,
  validateFinalizeReadiness,
  explainOtSettlementError,
  OT_ROLES,
  OT_ROLE_LABELS,
} from "../src/ot-settlement-policy.ts";

test("getOtSettlementCapabilityView resolves views under rule:7c9fedfb50", () => {
  assert.equal(getOtSettlementCapabilityView(null), "full");
  assert.equal(getOtSettlementCapabilityView({}), "full");
  assert.equal(
    getOtSettlementCapabilityView({ views: { screens: [{ screen_id: "ot_settlement", view: "open_work" }] } }),
    "open_work"
  );
  assert.equal(
    getOtSettlementCapabilityView({ views: { screens: [{ screen_id: "ot_settlement", view: "records" }] } }),
    "records"
  );
  assert.equal(
    getOtSettlementCapabilityView({ views: { screens: [{ screen_id: "ot_settlement", view: "setup" }] } }),
    "setup"
  );
  assert.equal(
    getOtSettlementCapabilityView({ views: { screens: [{ screen_id: "ot_settlement", view: "hidden" }] } }),
    "hidden"
  );
  assert.equal(
    getOtSettlementCapabilityView({ capabilities: [{ capability: "surgery", state: "Retiring" }] }),
    "open_work"
  );
});

test("canViewOtSettlement and canPreviewSettlement enforce role access", () => {
  assert.equal(canViewOtSettlement(["ot_admin"]), true);
  assert.equal(canViewOtSettlement(["billing_admin"]), true);
  assert.equal(canViewOtSettlement(["hospital_admin"]), true);
  assert.equal(canViewOtSettlement(["nurse"]), false);
  assert.equal(canViewOtSettlement([]), false);

  assert.equal(canPreviewSettlement(["ot_admin"]), true);
  assert.equal(canPreviewSettlement(["billing_admin"]), true);
  assert.equal(canPreviewSettlement(["cashier"]), false);
});

test("canFinalizeSettlement restricts irreversible finalization to ot_admin", () => {
  assert.equal(canFinalizeSettlement(["ot_admin"]), true);
  assert.equal(canFinalizeSettlement(["billing_admin"]), false);
  assert.equal(canFinalizeSettlement(["hospital_admin"]), false);
  assert.equal(canFinalizeSettlement(["doctor"]), false);
});

test("validateParticipants validates participant lists", () => {
  const empty = validateParticipants([]);
  assert.equal(empty.valid, false);
  assert.match(empty.error, /At least one/);

  const invalidId = validateParticipants([{ employee_id: 0, role_in_ot: "PrimarySurgeon" }]);
  assert.equal(invalidId.valid, false);

  const duplicate = validateParticipants([
    { employee_id: 7, role_in_ot: "PrimarySurgeon" },
    { employee_id: 7, role_in_ot: "ScrubNurse" },
  ]);
  assert.equal(duplicate.valid, false);
  assert.match(duplicate.error, /multiple times/);

  const valid = validateParticipants([
    { employee_id: 7, role_in_ot: "PrimarySurgeon" },
    { employee_id: 8, role_in_ot: "Anesthetist" },
  ]);
  assert.equal(valid.valid, true);
});

test("validateFinalizeReadiness enforces preview gate (rule:5228072102) and cap override (rule:015f73a404)", () => {
  const sampleParticipants = [
    { employee_id: 7, role_in_ot: "PrimarySurgeon" },
    { employee_id: 8, role_in_ot: "Anesthetist" },
  ];

  // 1. Surgery must be completed
  const incomplete = validateFinalizeReadiness({
    preview: null,
    participants: sampleParticipants,
    surgeryStatus: "InProgress",
    procedurePrice: 50000,
  });
  assert.equal(incomplete.allowed, false);
  assert.match(incomplete.reason, /Surgery must be completed/);

  // 2. Procedure price missing
  const noPrice = validateFinalizeReadiness({
    preview: null,
    participants: sampleParticipants,
    surgeryStatus: "Completed",
    procedurePrice: null,
  });
  assert.equal(noPrice.allowed, false);
  assert.match(noPrice.reason, /no procedure price/);

  // 3. Preview gate (rule:5228072102)
  const noPreview = validateFinalizeReadiness({
    preview: null,
    participants: sampleParticipants,
    surgeryStatus: "Completed",
    procedurePrice: 50000,
  });
  assert.equal(noPreview.allowed, false);
  assert.match(noPreview.reason, /preview must be calculated/);

  // 4. Mismatched participants count
  const validPreviewBase = {
    procedure_revenue: 50000,
    consumables_revenue: 2000,
    gross_revenue: 52000,
    consumables_cost: 1000,
    net_profit: 51000,
    participants: [
      {
        employee_id: 7,
        full_name: "Dr. Tariq",
        role_in_ot: "PrimarySurgeon",
        staff_type: "Visiting",
        contract_id: 1,
        commission_amount: 15000,
        commission_basis: "30% gross",
      },
    ],
    total_commissions: 15000,
    hospital_net: 36000,
    exceeds_cap: false,
  };

  const changedParticipants = validateFinalizeReadiness({
    preview: validPreviewBase,
    participants: sampleParticipants, // 2 participants vs 1 in preview
    surgeryStatus: "Completed",
    procedurePrice: 50000,
  });
  assert.equal(changedParticipants.allowed, false);
  assert.match(changedParticipants.reason, /Participants have changed/);

  // 5. Commission cap exceeded without override reason (rule:015f73a404)
  const capExceededPreview = {
    ...validPreviewBase,
    participants: [
      validPreviewBase.participants[0],
      {
        employee_id: 8,
        full_name: "Dr. Asma",
        role_in_ot: "Anesthetist",
        staff_type: "Regular",
        contract_id: 2,
        commission_amount: 40000,
        commission_basis: "fixed fee",
      },
    ],
    total_commissions: 55000,
    hospital_net: -4000,
    exceeds_cap: true,
  };

  const capExceededNoReason = validateFinalizeReadiness({
    preview: capExceededPreview,
    participants: sampleParticipants,
    overrideReason: "",
    surgeryStatus: "Completed",
    procedurePrice: 50000,
  });
  assert.equal(capExceededNoReason.allowed, false);
  assert.match(capExceededNoReason.reason, /override reason is mandatory/);

  // 6. Commission cap exceeded WITH override reason
  const capExceededWithReason = validateFinalizeReadiness({
    preview: capExceededPreview,
    participants: sampleParticipants,
    overrideReason: "Approved emergency indigent case under Hospital Policy §4.2",
    surgeryStatus: "Completed",
    procedurePrice: 50000,
  });
  assert.equal(capExceededWithReason.allowed, true);

  // 7. Normal valid preview within cap
  const normalValid = validateFinalizeReadiness({
    preview: {
      ...validPreviewBase,
      participants: [
        validPreviewBase.participants[0],
        {
          employee_id: 8,
          full_name: "Dr. Asma",
          role_in_ot: "Anesthetist",
          staff_type: "Regular",
          contract_id: 2,
          commission_amount: 5000,
          commission_basis: "fixed fee",
        },
      ],
      total_commissions: 20000,
      hospital_net: 31000,
      exceeds_cap: false,
    },
    participants: sampleParticipants,
    surgeryStatus: "Completed",
    procedurePrice: 50000,
  });
  assert.equal(normalValid.allowed, true);
});

test("explainOtSettlementError provides bilingual error explanations", () => {
  assert.match(explainOtSettlementError("OT_ALREADY_SETTLED", "en"), /already settled/);
  assert.match(explainOtSettlementError("OT_ALREADY_SETTLED", "ur"), /پہلے ہی/);

  assert.match(explainOtSettlementError("OT_COMMISSION_CAP_EXCEEDED", "en"), /Commissions exceed/);
  assert.match(explainOtSettlementError("OT_COMMISSION_CAP_EXCEEDED", "ur"), /کمیشن خالص منافع سے/);

  assert.match(explainOtSettlementError("OT_PROCEDURE_PRICE_MISSING", "en"), /no procedure price/);
  assert.match(explainOtSettlementError("OT_PROCEDURE_PRICE_MISSING", "ur"), /قیمت موجود نہیں/);

  assert.match(explainOtSettlementError("OT_SURGERY_NOT_COMPLETE", "en"), /must be completed/);
  assert.match(explainOtSettlementError("OT_SURGERY_NOT_COMPLETE", "ur"), /سرجری مکمل ہونی/);
});

test("OT_ROLES and labels are defined for all theatre staff", () => {
  assert.equal(OT_ROLES.length, 6);
  for (const role of OT_ROLES) {
    assert.ok(OT_ROLE_LABELS[role].en);
    assert.ok(OT_ROLE_LABELS[role].ur);
  }
});
