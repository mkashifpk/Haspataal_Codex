import test from "node:test";
import assert from "node:assert/strict";
import {
  getOnboardingWizardCapabilityView,
  formatCnic,
  isValidCnic,
  isValidPakMobile,
  isValidEmail,
  validateStep1Input,
  validateStep2Input,
  validateStep3Input,
  validateQualificationInput,
  validateDocumentFile,
  canSubmitEmployeeProfile,
  ONBOARDING_WIZARD_ERROR_MESSAGES,
} from "../src/onboarding-wizard-policy.ts";

test("onboarding_wizard: capability view evaluates facility modes", () => {
  // Default full capability
  const capDefault = getOnboardingWizardCapabilityView(null);
  assert.equal(capDefault.mode, "full");
  assert.equal(capDefault.canCreate, true);
  assert.equal(capDefault.canSubmit, true);

  // Hidden when onboarding_wizard not in screens
  const capHidden = getOnboardingWizardCapabilityView({
    views: { screens: ["risk_dashboard", "owner_dashboard"] },
  });
  assert.equal(capHidden.mode, "hidden");
  assert.equal(capHidden.canCreate, false);

  // Records only mode
  const capRecords = getOnboardingWizardCapabilityView({
    views: { screens: ["onboarding_wizard"], records_only: true },
  });
  assert.equal(capRecords.mode, "records");
  assert.equal(capRecords.canCreate, false);
  assert.match(capRecords.noticeEn, /records view mode/i);

  // Open work only mode
  const capOpenWork = getOnboardingWizardCapabilityView({
    views: { screens: ["onboarding_wizard"], open_work_only: true },
  });
  assert.equal(capOpenWork.mode, "open_work");
  assert.equal(capOpenWork.canCreate, false);
  assert.equal(capOpenWork.canSubmit, true);

  // Setup mode
  const capSetup = getOnboardingWizardCapabilityView({
    views: { screens: ["onboarding_wizard"], setup_only: true },
  });
  assert.equal(capSetup.mode, "setup");
  assert.equal(capSetup.canCreate, true);
});

test("onboarding_wizard: CNIC formatting and strict validation", () => {
  assert.equal(formatCnic("3520112345671"), "35201-1234567-1");
  assert.equal(formatCnic("35201-1234567-1"), "35201-1234567-1");
  assert.equal(formatCnic("12345"), "12345");
  assert.equal(formatCnic("123456"), "12345-6");

  assert.equal(isValidCnic("35201-1234567-1"), true);
  assert.equal(isValidCnic("3520112345671"), true);
  assert.equal(isValidCnic("35201-123456"), false);
  assert.equal(isValidCnic(""), false);
});

test("onboarding_wizard: Step 1 demographics validation enforces mandatory CNIC per MSDS", () => {
  // Missing CNIC fails
  const missingCnic = validateStep1Input({
    full_name: "Dr. Ahmad Raza",
    mobile: "03001234567",
  });
  assert.equal(missingCnic.valid, false);
  assert.match(missingCnic.errors.cnic, /mandatory/i);

  // Short full name fails
  const shortName = validateStep1Input({
    full_name: "Al",
    cnic: "35201-1234567-1",
    mobile: "03001234567",
  });
  assert.equal(shortName.valid, false);
  assert.match(shortName.errors.full_name, /minimum 3 characters/i);

  // Invalid mobile fails
  const invalidMobile = validateStep1Input({
    full_name: "Dr. Ahmad Raza",
    cnic: "35201-1234567-1",
    mobile: "12345",
  });
  assert.equal(invalidMobile.valid, false);
  assert.match(invalidMobile.errors.mobile, /Pakistan mobile number/i);

  // Valid input succeeds
  const valid = validateStep1Input({
    full_name: "Dr. Ahmad Raza",
    cnic: "35201-1234567-1",
    mobile: "03001234567",
    email: "ahmad@hospital.com",
    dob: "1985-05-15",
  });
  assert.equal(valid.valid, true);
  assert.equal(Object.keys(valid.errors).length, 0);
});

test("onboarding_wizard: Step 2 job taxonomy and supervisor cycle prevention", () => {
  // Missing designation fails
  const missingDesig = validateStep2Input({
    base_salary: "50000",
  });
  assert.equal(missingDesig.valid, false);
  assert.match(missingDesig.errors.designation, /required/i);

  // Negative salary fails
  const negSalary = validateStep2Input({
    designation: "Consultant",
    base_salary: "-1000",
  });
  assert.equal(negSalary.valid, false);
  assert.match(negSalary.errors.base_salary, /non-negative/i);

  // Cycle detection: employee cannot report to themselves
  const currentEmpId = 42;
  const cycleResult = validateStep2Input(
    {
      designation: "Medical Officer",
      supervisor_id: 42,
    },
    currentEmpId
  );
  assert.equal(cycleResult.valid, false);
  assert.match(cycleResult.errors.supervisor_id, /cycle/i);

  // Valid supervisor succeeds
  const validJob = validateStep2Input(
    {
      designation: "Medical Officer",
      supervisor_id: 10,
      base_salary: "150000",
    },
    currentEmpId
  );
  assert.equal(validJob.valid, true);
});

test("onboarding_wizard: Step 3 licensing validation enforces clinical registration", () => {
  // Clinical staff requires licence
  const missingLic = validateStep3Input({}, true);
  assert.equal(missingLic.valid, false);
  assert.match(missingLic.errors.license_type, /required for clinical staff/i);

  // Non-clinical staff does not require licence
  const nonClinical = validateStep3Input({}, false);
  assert.equal(nonClinical.valid, true);

  // Valid PMDC licence succeeds
  const validLic = validateStep3Input(
    {
      license_type: "PMDC",
      license_number: "12345-P",
    },
    true
  );
  assert.equal(validLic.valid, true);
});

test("onboarding_wizard: Rule rule:511519d15c rejects PDF for staff ID card photo", () => {
  // Photo must be JPEG or PNG only (PDF is forbidden)
  const pdfPhoto = validateDocumentFile(
    { name: "photo.pdf", type: "application/pdf", size: 1024 * 500 },
    "Photo"
  );
  assert.equal(pdfPhoto.valid, false);
  assert.match(pdfPhoto.error, /Photo must be JPEG or PNG only/i);

  // Valid JPEG photo succeeds
  const jpegPhoto = validateDocumentFile(
    { name: "profile_pic.jpg", type: "image/jpeg", size: 1024 * 1024 },
    "Photo"
  );
  assert.equal(jpegPhoto.valid, true);

  // Valid PNG photo succeeds
  const pngPhoto = validateDocumentFile(
    { name: "profile_pic.png", type: "image/png", size: 1024 * 1024 },
    "Photo"
  );
  assert.equal(pngPhoto.valid, true);

  // PDF is allowed for general documents (e.g. CNIC, Degree, Contract)
  const pdfDegree = validateDocumentFile(
    { name: "mbbs_degree.pdf", type: "application/pdf", size: 1024 * 1024 * 2 },
    "Degree"
  );
  assert.equal(pdfDegree.valid, true);

  // Unsupported formats (e.g. docx, zip) are rejected
  const zipDoc = validateDocumentFile(
    { name: "archive.zip", type: "application/zip", size: 1024 * 1024 },
    "Degree"
  );
  assert.equal(zipDoc.valid, false);
});

test("onboarding_wizard: Rule rule:c1f853fceb & rule:adc6619db9 submission readiness and handover", () => {
  // Profile not ready blocks submission (checklist.ready === false)
  const unreadyEmp = {
    employee_id: 10,
    emp_number: "EMP-00010",
    full_name: "Zainab Bibi",
    employment_status: "Draft",
    checklist: {
      ready: false,
      missing: ["CNIC document", "Staff ID photo"],
    },
  };
  const unreadyGate = canSubmitEmployeeProfile(unreadyEmp);
  assert.equal(unreadyGate.canSubmit, false);
  assert.match(unreadyGate.reasonEn, /Required items missing/i);

  // Ready Draft profile allows submission
  const readyEmp = {
    employee_id: 10,
    emp_number: "EMP-00010",
    full_name: "Zainab Bibi",
    employment_status: "Draft",
    checklist: {
      ready: true,
      missing: [],
    },
  };
  const readyGate = canSubmitEmployeeProfile(readyEmp);
  assert.equal(readyGate.canSubmit, true);

  // Already submitted profile (Awaiting_IT_Provisioning) cannot be re-submitted
  const submittedEmp = {
    employee_id: 10,
    emp_number: "EMP-00010",
    full_name: "Zainab Bibi",
    employment_status: "Awaiting_IT_Provisioning",
    checklist: {
      ready: true,
      missing: [],
    },
  };
  const submittedGate = canSubmitEmployeeProfile(submittedEmp);
  assert.equal(submittedGate.canSubmit, false);
  assert.match(submittedGate.reasonEn, /Only Draft profiles can be finalized/i);
});

test("onboarding_wizard: bilingual error messages dictionary completeness", () => {
  const requiredKeys = [
    "CNIC_ALREADY_EXISTS",
    "EMPLOYEE_DOCUMENT_REQUIRED",
    "CLINICAL_LICENSE_REQUIRED",
    "CYCLE_DETECTED",
    "EMPLOYEE_STATUS_INVALID",
    "UNSUPPORTED_MEDIA_TYPE",
    "FORBIDDEN",
    "VALIDATION_ERROR",
    "NOT_FOUND",
  ];

  for (const key of requiredKeys) {
    const entry = ONBOARDING_WIZARD_ERROR_MESSAGES[key];
    assert.ok(entry, `Missing error dictionary key: ${key}`);
    assert.ok(entry.en && entry.en.length > 5, `Missing English text for ${key}`);
    assert.ok(entry.ur && entry.ur.length > 5, `Missing Urdu text for ${key}`);
  }
});
