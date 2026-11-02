import test from "node:test";
import assert from "node:assert/strict";
import {
  getDiagnosticPartnersCapabilityView,
  getMouExpiryStatus,
  validatePartnerInput,
  validatePartnerUpdateInput,
  DIAGNOSTIC_PARTNERS_ERROR_MESSAGES,
  PARTNER_SERVICES,
} from "../src/diagnostic-partners-policy.ts";

test("diagnostic_partners: capability view resolves based on establishment views.screens (Rule rule:5be909080d)", () => {
  assert.equal(getDiagnosticPartnersCapabilityView(null), "full");
  assert.equal(getDiagnosticPartnersCapabilityView({}), "full");

  // Dictionary format
  const estFull = { views: { screens: { diagnostic_partners: "full" } } };
  assert.equal(getDiagnosticPartnersCapabilityView(estFull), "full");

  const estOpenWork = { views: { screens: { diagnostic_partners: "open_work" } } };
  assert.equal(getDiagnosticPartnersCapabilityView(estOpenWork), "open_work");

  const estRecords = { views: { screens: { diagnostic_partners: "records" } } };
  assert.equal(getDiagnosticPartnersCapabilityView(estRecords), "records");

  const estSetup = { views: { screens: { diagnostic_partners: "setup" } } };
  assert.equal(getDiagnosticPartnersCapabilityView(estSetup), "setup");

  const estHidden = { views: { screens: { diagnostic_partners: "hidden" } } };
  assert.equal(getDiagnosticPartnersCapabilityView(estHidden), "hidden");

  // Array format
  const estArray = { views: { screens: [{ screen_id: "diagnostic_partners", view: "setup" }] } };
  assert.equal(getDiagnosticPartnersCapabilityView(estArray), "setup");
});

test("diagnostic_partners: getMouExpiryStatus warns 30 days ahead and detects expiry (Rule rule:317f71af91)", () => {
  const today = "2026-11-02";

  // Expired via flag
  const r1 = getMouExpiryStatus("2027-01-01", true, today);
  assert.equal(r1.status, "expired");
  assert.match(r1.warningMessage.en, /MOU Expired/i);

  // Expired via past date
  const r2 = getMouExpiryStatus("2026-10-31", false, today);
  assert.equal(r2.status, "expired");
  assert(r2.daysLeft < 0);

  // Expiring soon within 30 days (e.g. 20 days left)
  const r3 = getMouExpiryStatus("2026-11-22", false, today);
  assert.equal(r3.status, "expiring_soon");
  assert.equal(r3.daysLeft, 20);
  assert.match(r3.warningMessage.en, /20 day\(s\) remaining/i);
  assert.match(r3.warningMessage.ur, /20 دن باقی ہیں/i);

  // Valid contract (> 30 days left)
  const r4 = getMouExpiryStatus("2027-11-01", false, today);
  assert.equal(r4.status, "valid");
  assert(r4.daysLeft > 300);

  // No MOU date provided
  const r5 = getMouExpiryStatus(null, false, today);
  assert.equal(r5.status, "no_mou");
});

test("diagnostic_partners: validatePartnerInput enforces statutory validation (Rule rule:317f71af91)", () => {
  const validPartner = {
    name: "National Diagnostic Reference Laboratory",
    services: "Both",
    phc_registration: "PHC-LAB-2026-001",
    accreditation: "PNAC ISO 15189:2022",
    pnra_licence: "PNRA-RAD-092",
    mou_reference: "MOU-REF-2026-01",
    mou_valid_from: "2026-01-01",
    mou_valid_until: "2027-01-01",
    turnaround_hours: 24,
    quality_note: "Annual external QA satisfactory (RIQAS & NEQAS).",
    contact: "042-35800000",
    address: "Main Boulevard, Lahore",
  };

  const res = validatePartnerInput(validPartner);
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, {});

  // Invalid: name too short
  assert.equal(validatePartnerInput({ ...validPartner, name: "A" }).valid, false);

  // Invalid: bad service enum
  assert.equal(validatePartnerInput({ ...validPartner, services: "Pharmacy" }).valid, false);

  // Invalid: turnaround hours out of bounds
  assert.equal(validatePartnerInput({ ...validPartner, turnaround_hours: 0 }).valid, false);
  assert.equal(validatePartnerInput({ ...validPartner, turnaround_hours: 5000 }).valid, false);

  // Invalid: inverted dates
  const invDates = validatePartnerInput({
    ...validPartner,
    mou_valid_from: "2027-01-01",
    mou_valid_until: "2026-01-01",
  });
  assert.equal(invDates.valid, false);
  assert.match(invDates.errors.mou_valid_until, /cannot be earlier/i);
});

test("diagnostic_partners: validatePartnerUpdateInput supports partial updates and optimistic concurrency", () => {
  const validUpdate = {
    name: "National Diagnostic Reference Lab (Updated)",
    turnaround_hours: 18,
    mou_valid_until: "2027-06-30",
    is_active: true,
    expected_version: 2,
  };
  const res = validatePartnerUpdateInput(validUpdate);
  assert.equal(res.valid, true);

  // Invalid turnaround
  const badUpdate = validatePartnerUpdateInput({ turnaround_hours: -1 });
  assert.equal(badUpdate.valid, false);
  assert.match(badUpdate.errors.turnaround_hours, /positive integer/i);
});

test("diagnostic_partners: bilingual error dictionary covers all error codes", () => {
  assert(DIAGNOSTIC_PARTNERS_ERROR_MESSAGES.FORBIDDEN.en);
  assert(DIAGNOSTIC_PARTNERS_ERROR_MESSAGES.FORBIDDEN.ur);
  assert(DIAGNOSTIC_PARTNERS_ERROR_MESSAGES.VALIDATION_ERROR.en);
  assert(DIAGNOSTIC_PARTNERS_ERROR_MESSAGES.VALIDATION_ERROR.ur);
  assert(DIAGNOSTIC_PARTNERS_ERROR_MESSAGES.VERSION_CONFLICT.en);
  assert(DIAGNOSTIC_PARTNERS_ERROR_MESSAGES.VERSION_CONFLICT.ur);
  assert(DIAGNOSTIC_PARTNERS_ERROR_MESSAGES.NOT_FOUND.en);
  assert(DIAGNOSTIC_PARTNERS_ERROR_MESSAGES.NOT_FOUND.ur);
});
