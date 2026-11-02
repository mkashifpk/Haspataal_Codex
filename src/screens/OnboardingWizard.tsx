/**
 * Screen 143: onboarding_wizard
 * "Staff onboarding & credentials wizard"
 * Workspace: `hr`, Position: 143, Points: 63.
 *
 * Statutory & Quality Rules:
 * - rule:adc6619db9: Step 6 never creates a login — it hands over to IT (status Awaiting_IT_Provisioning).
 * - rule:c1f853fceb: Grey out Submit until GET /hr/employees/{id}.checklist.ready is true.
 * - rule:44d2ead844: Upload files as multipart/form-data (file + doc_type + optional title); only paths stored in DB.
 * - rule:511519d15c: Documents are PDF, JPEG or PNG; Photo (ID card) is JPEG/PNG only, max 16MP.
 * - rule:cd04ca0d57: Step 4 Visiting OT split contract is configured by Billing Admin in billing_admin; wizard never sends it.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  createHrEmployees,
  step1,
  step2,
  step3,
  addQualification,
  uploadDocumentHrEmployeesDocuments,
  submit as submitOnboarding,
  getHrEmployees,
  type EmployeeIn,
  type Step1In,
  type Step2In,
  type Step3In,
  type QualificationIn,
  type EmployeeDetailOut,
  type QualificationOut,
  type EmployeeDocumentOut,
} from "../generated/onboarding_wizard";
import {
  getOnboardingWizardCapabilityView,
  formatCnic,
  validateStep1Input,
  validateStep2Input,
  validateStep3Input,
  validateQualificationInput,
  validateDocumentFile,
  canSubmitEmployeeProfile,
  ONBOARDING_WIZARD_ERROR_MESSAGES,
  type OnboardingWizardCapabilityView,
} from "../onboarding-wizard-policy";
import { api } from "../bridge";

export interface OnboardingWizardProps {
  user: {
    user_id: number;
    username: string;
    roles: string[];
    permissions: string[];
  };
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  timeZone?: string;
  onNavigateScreen?: (screenId: string) => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

interface DepartmentOption {
  department_id: number;
  name: string;
  code?: string;
}

interface SupervisorOption {
  employee_id: number;
  emp_number: string;
  full_name: string;
  designation: string;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  // Capability evaluation
  const capability: OnboardingWizardCapabilityView = useMemo(
    () => getOnboardingWizardCapabilityView(establishment),
    [establishment]
  );

  // Active step & active employee state
  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [employee, setEmployee] = useState<EmployeeDetailOut | null>(null);
  const [searchEmpIdInput, setSearchEmpIdInput] = useState<string>("");

  // Loading & error feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ code?: string; message: string; ur?: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Departments & Supervisors reference data
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);

  // Step 1: Demographics Form State
  const [step1Data, setStep1Data] = useState<{
    full_name: string;
    father_or_husband_name: string;
    cnic: string;
    dob: string;
    gender: "male" | "female" | "other" | "";
    mobile: string;
    email: string;
    address: string;
    blood_group: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "Unknown" | "";
    contract_type: "Permanent" | "Contract" | "Visiting";
    staff_category: "Clinical" | "Nursing" | "Administrative" | "Technical" | "SupportZeroInterface" | "Visiting";
    designation: string;
  }>({
    full_name: "",
    father_or_husband_name: "",
    cnic: "",
    dob: "",
    gender: "",
    mobile: "",
    email: "",
    address: "",
    blood_group: "",
    contract_type: "Permanent",
    staff_category: "Clinical",
    designation: "",
  });
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});

  // Step 2: Job & Finance Form State
  const [step2Data, setStep2Data] = useState<{
    department_id: string;
    designation: string;
    specialty: string;
    supervisor_id: string;
    base_salary: string;
    contract_type: "Permanent" | "Contract" | "Visiting";
    staff_category: "Clinical" | "Nursing" | "Administrative" | "Technical" | "SupportZeroInterface" | "Visiting";
    is_clinical_staff: boolean;
    joined_on: string;
  }>({
    department_id: "",
    designation: "",
    specialty: "",
    supervisor_id: "",
    base_salary: "0",
    contract_type: "Permanent",
    staff_category: "Clinical",
    is_clinical_staff: true,
    joined_on: new Date().toISOString().slice(0, 10),
  });
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});

  // Step 3: Licences & Qualifications State
  const [step3License, setStep3License] = useState<{
    license_type: "PMDC" | "PNC" | "Other" | "";
    license_number: string;
  }>({
    license_type: "PMDC",
    license_number: "",
  });
  const [step3LicenseErrors, setStep3LicenseErrors] = useState<Record<string, string>>({});

  // Add Qualification Modal State
  const [isQualModalOpen, setIsQualModalOpen] = useState<boolean>(false);
  const [qualFormData, setQualFormData] = useState<{
    qualification_type: "Education" | "Experience" | "License" | "Certification";
    title: string;
    institution: string;
    year: string;
    license_number: string;
    license_expiry: string;
    notes: string;
  }>({
    qualification_type: "Education",
    title: "",
    institution: "",
    year: new Date().getFullYear().toString(),
    license_number: "",
    license_expiry: "",
    notes: "",
  });
  const [qualErrors, setQualErrors] = useState<Record<string, string>>({});

  // Step 5: Document Upload State
  const [uploadDocType, setUploadDocType] = useState<
    "CNIC" | "Degree" | "PMDC" | "PNC" | "Experience" | "Contract" | "Photo" | "Other"
  >("CNIC");
  const [uploadDocTitle, setUploadDocTitle] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  // Step 6: Confirmation Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);

  // Populate form fields whenever employee is loaded or updated
  const syncEmployeeToForms = useCallback((emp: EmployeeDetailOut) => {
    setEmployee(emp);
    if (emp.onboarding_step && emp.onboarding_step >= 1 && emp.onboarding_step <= 6) {
      setActiveStep(emp.onboarding_step as WizardStep);
    }

    // Sync Step 1
    setStep1Data({
      full_name: emp.full_name || "",
      father_or_husband_name: emp.father_or_husband_name || "",
      cnic: emp.cnic || "",
      dob: emp.dob || "",
      gender: emp.gender === "male" || emp.gender === "female" || emp.gender === "other" ? emp.gender : "",
      mobile: emp.mobile || "",
      email: emp.email || "",
      address: emp.address || "",
      blood_group: emp.blood_group || "",
      contract_type: emp.contract_type || "Permanent",
      staff_category: emp.staff_category || "Clinical",
      designation: emp.designation || "",
    });

    // Sync Step 2
    setStep2Data({
      department_id: emp.department_id ? String(emp.department_id) : "",
      designation: emp.designation || "",
      specialty: emp.specialty || "",
      supervisor_id: emp.supervisor_id ? String(emp.supervisor_id) : "",
      base_salary: emp.base_salary !== undefined ? String(emp.base_salary) : "0",
      contract_type: emp.contract_type || "Permanent",
      staff_category: emp.staff_category || "Clinical",
      is_clinical_staff: Boolean(emp.is_clinical_staff),
      joined_on: emp.joined_on || new Date().toISOString().slice(0, 10),
    });

    // Sync Step 3
    setStep3License({
      license_type: emp.license_type || (emp.is_clinical_staff ? "PMDC" : ""),
      license_number: emp.license_number || "",
    });
  }, []);

  // Fetch departments and potential supervisors
  const fetchReferenceData = useCallback(async () => {
    try {
      // Departments
      const deptRes = await api<DepartmentOption[]>("GET", "/admin/departments");
      if (Array.isArray(deptRes)) {
        setDepartments(deptRes);
      }
    } catch {
      // Non-fatal if departments cannot be loaded
    }

    try {
      // Supervisors list from /hr/employees
      const empRes = await api<any[]>("GET", "/hr/employees");
      if (Array.isArray(empRes)) {
        setSupervisors(
          empRes.map((e) => ({
            employee_id: e.employee_id,
            emp_number: e.emp_number || `EMP-${e.employee_id}`,
            full_name: e.full_name || "Staff",
            designation: e.designation || "Employee",
          }))
        );
      }
    } catch {
      // Non-fatal if employees list fails
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Load employee profile by ID
  const loadEmployee = useCallback(
    async (empId: number) => {
      if (!empId || isNaN(empId)) return;
      setLoading(true);
      setErrorBanner(null);
      setSuccessBanner(null);

      try {
        const emp = await getHrEmployees(empId);
        syncEmployeeToForms(emp);
        setSuccessBanner(`Loaded employee ${emp.emp_number} (${emp.full_name}).`);
      } catch (err: any) {
        const code = err?.response?.error?.code || "NOT_FOUND";
        const message =
          err?.response?.error?.message ||
          ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.en ||
          "Failed to load employee profile.";
        const ur = ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.ur;
        setErrorBanner({ code, message, ur });
      } finally {
        setLoading(false);
      }
    },
    [syncEmployeeToForms]
  );

  // Reset to new draft
  const handleStartNewEmployee = useCallback(() => {
    setEmployee(null);
    setActiveStep(1);
    setSearchEmpIdInput("");
    setStep1Data({
      full_name: "",
      father_or_husband_name: "",
      cnic: "",
      dob: "",
      gender: "",
      mobile: "",
      email: "",
      address: "",
      blood_group: "",
      contract_type: "Permanent",
      staff_category: "Clinical",
      designation: "",
    });
    setStep2Data({
      department_id: "",
      designation: "",
      specialty: "",
      supervisor_id: "",
      base_salary: "0",
      contract_type: "Permanent",
      staff_category: "Clinical",
      is_clinical_staff: true,
      joined_on: new Date().toISOString().slice(0, 10),
    });
    setStep3License({
      license_type: "PMDC",
      license_number: "",
    });
    setErrorBanner(null);
    setSuccessBanner(null);
  }, []);

  // Save Step 1: Demographics
  const handleSaveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);

    const validation = validateStep1Input(step1Data);
    setStep1Errors(validation.errors);
    if (!validation.valid) {
      return;
    }

    setActionLoading(true);
    try {
      if (!employee) {
        // Create new profile via POST /hr/employees
        const payload: EmployeeIn = {
          full_name: step1Data.full_name.trim(),
          father_or_husband_name: step1Data.father_or_husband_name.trim() || null,
          cnic: step1Data.cnic.trim(),
          dob: step1Data.dob || null,
          gender: step1Data.gender || null,
          mobile: step1Data.mobile.trim(),
          email: step1Data.email.trim() || null,
          address: step1Data.address.trim() || null,
          blood_group: step1Data.blood_group || null,
          contract_type: step1Data.contract_type,
          staff_category: step1Data.staff_category,
          designation: step1Data.designation.trim() || null,
        };

        const created = await createHrEmployees(payload);
        syncEmployeeToForms(created);
        setActiveStep(2);
        setSuccessBanner(
          `Staff profile created with Employee Number: ${created.emp_number}. Proceeding to Step 2.`
        );
      } else {
        // Update existing draft via PATCH /hr/employees/{id}/steps/1
        const payload: Step1In = {
          full_name: step1Data.full_name.trim(),
          father_or_husband_name: step1Data.father_or_husband_name.trim() || null,
          cnic: step1Data.cnic.trim(),
          dob: step1Data.dob || null,
          gender: step1Data.gender || null,
          mobile: step1Data.mobile.trim(),
          email: step1Data.email.trim() || null,
          address: step1Data.address.trim() || null,
          blood_group: step1Data.blood_group || null,
          row_version: employee.row_version,
        };

        const updated = await step1(employee.employee_id, payload);
        syncEmployeeToForms(updated);
        setActiveStep(2);
        setSuccessBanner(`Demographics updated for ${updated.emp_number}. Proceeding to Step 2.`);
      }
    } catch (err: any) {
      const code = err?.response?.error?.code || "VALIDATION_ERROR";
      const message =
        err?.response?.error?.message ||
        ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.en ||
        "Failed to save demographics.";
      const ur = ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.ur;
      setErrorBanner({ code, message, ur });
    } finally {
      setActionLoading(false);
    }
  };

  // Save Step 2: Job & Finance
  const handleSaveStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setErrorBanner(null);
    setSuccessBanner(null);

    const validation = validateStep2Input(
      {
        ...step2Data,
        supervisor_id: step2Data.supervisor_id ? Number(step2Data.supervisor_id) : undefined,
      },
      employee.employee_id
    );
    setStep2Errors(validation.errors);
    if (!validation.valid) {
      return;
    }

    setActionLoading(true);
    try {
      const payload: Step2In = {
        department_id: step2Data.department_id ? Number(step2Data.department_id) : null,
        designation: step2Data.designation.trim() || null,
        specialty: step2Data.specialty.trim() || null,
        supervisor_id: step2Data.supervisor_id ? Number(step2Data.supervisor_id) : null,
        base_salary: step2Data.base_salary ? Number(step2Data.base_salary) : 0,
        contract_type: step2Data.contract_type,
        staff_category: step2Data.staff_category,
        is_clinical_staff: step2Data.is_clinical_staff,
        joined_on: step2Data.joined_on || null,
        row_version: employee.row_version,
      };

      const updated = await step2(employee.employee_id, payload);
      syncEmployeeToForms(updated);
      setActiveStep(3);
      setSuccessBanner(`Job taxonomy & compensation updated. Proceeding to Step 3.`);
    } catch (err: any) {
      const code = err?.response?.error?.code || "VALIDATION_ERROR";
      const message =
        err?.response?.error?.message ||
        ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.en ||
        "Failed to save job taxonomy.";
      const ur = ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.ur;
      setErrorBanner({ code, message, ur });
    } finally {
      setActionLoading(false);
    }
  };

  // Save Step 3: Licences
  const handleSaveStep3License = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setErrorBanner(null);
    setSuccessBanner(null);

    const validation = validateStep3Input(step3License, step2Data.is_clinical_staff);
    setStep3LicenseErrors(validation.errors);
    if (!validation.valid) {
      return;
    }

    setActionLoading(true);
    try {
      const payload: Step3In = {
        license_type: step3License.license_type || null,
        license_number: step3License.license_number.trim() || null,
        row_version: employee.row_version,
      };

      const updated = await step3(employee.employee_id, payload);
      syncEmployeeToForms(updated);
      setSuccessBanner(`Licence information updated successfully.`);
    } catch (err: any) {
      const code = err?.response?.error?.code || "VALIDATION_ERROR";
      const message =
        err?.response?.error?.message ||
        ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.en ||
        "Failed to update licence information.";
      const ur = ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.ur;
      setErrorBanner({ code, message, ur });
    } finally {
      setActionLoading(false);
    }
  };

  // Add Qualification
  const handleAddQualification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setErrorBanner(null);

    const validation = validateQualificationInput({
      ...qualFormData,
      year: qualFormData.year ? Number(qualFormData.year) : undefined,
    });
    setQualErrors(validation.errors);
    if (!validation.valid) {
      return;
    }

    setActionLoading(true);
    try {
      const payload: QualificationIn = {
        qualification_type: qualFormData.qualification_type,
        title: qualFormData.title.trim(),
        institution: qualFormData.institution.trim() || null,
        year: qualFormData.year ? Number(qualFormData.year) : null,
        license_number: qualFormData.license_number.trim() || null,
        license_expiry: qualFormData.license_expiry || null,
        notes: qualFormData.notes.trim() || null,
      };

      await addQualification(employee.employee_id, payload);

      // Re-read employee to refresh full list and checklist
      const refreshed = await getHrEmployees(employee.employee_id);
      syncEmployeeToForms(refreshed);

      setIsQualModalOpen(false);
      setQualFormData({
        qualification_type: "Education",
        title: "",
        institution: "",
        year: new Date().getFullYear().toString(),
        license_number: "",
        license_expiry: "",
        notes: "",
      });
      setSuccessBanner(`Added qualification '${payload.title}' with MSDS HRM 142 primary source verification pending.`);
    } catch (err: any) {
      const code = err?.response?.error?.code || "VALIDATION_ERROR";
      const message =
        err?.response?.error?.message ||
        ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.en ||
        "Failed to add qualification.";
      setErrorBanner({ code, message });
    } finally {
      setActionLoading(false);
    }
  };

  // Step 5: Document Upload
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setDocUploadError(null);
    setErrorBanner(null);
    setSuccessBanner(null);

    if (!selectedFile) {
      setDocUploadError("Please choose a file to upload.");
      return;
    }

    // Validate per Rule rule:44d2ead844 and rule:511519d15c
    const validation = validateDocumentFile(selectedFile, uploadDocType);
    if (!validation.valid) {
      setDocUploadError(validation.error || "Invalid file format.");
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("doc_type", uploadDocType);
      if (uploadDocTitle.trim()) {
        formData.append("title", uploadDocTitle.trim());
      }

      await uploadDocumentHrEmployeesDocuments(employee.employee_id, formData);

      // Refresh employee profile
      const refreshed = await getHrEmployees(employee.employee_id);
      syncEmployeeToForms(refreshed);

      setSelectedFile(null);
      setUploadDocTitle("");
      setSuccessBanner(`Document (${uploadDocType}) uploaded successfully to vault.`);
    } catch (err: any) {
      const code = err?.response?.error?.code || "VALIDATION_ERROR";
      const message =
        err?.response?.error?.message ||
        ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.en ||
        "Failed to upload document.";
      const ur = ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.ur;
      setErrorBanner({ code, message, ur });
    } finally {
      setActionLoading(false);
    }
  };

  // Step 6: Submit Profile (Finalize -> Awaiting_IT_Provisioning per Rule rule:adc6619db9)
  const handleFinalSubmit = async () => {
    if (!employee) return;
    setErrorBanner(null);
    setSuccessBanner(null);

    const submissionGate = canSubmitEmployeeProfile(employee);
    if (!submissionGate.canSubmit) {
      setErrorBanner({
        code: "VALIDATION_ERROR",
        message: submissionGate.reasonEn || "Onboarding cannot be submitted.",
        ur: submissionGate.reasonUr,
      });
      setIsSubmitModalOpen(false);
      return;
    }

    setActionLoading(true);
    try {
      const submitted = await submitOnboarding(employee.employee_id);
      syncEmployeeToForms(submitted);
      setIsSubmitModalOpen(false);
      setSuccessBanner(
        `Profile for ${submitted.emp_number} (${submitted.full_name}) successfully finalized! Status updated to 'Awaiting_IT_Provisioning' and handed over to IT Console (Rule rule:adc6619db9).`
      );
    } catch (err: any) {
      const code = err?.response?.error?.code || "EMPLOYEE_STATUS_INVALID";
      const message =
        err?.response?.error?.message ||
        ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.en ||
        "Failed to submit employee onboarding.";
      const ur = ONBOARDING_WIZARD_ERROR_MESSAGES[code]?.ur;
      setErrorBanner({ code, message, ur });
    } finally {
      setActionLoading(false);
    }
  };

  const submissionState = useMemo(() => canSubmitEmployeeProfile(employee), [employee]);

  return (
    <div
      className="p-4 max-w-6xl mx-auto space-y-4"
      style={{ minHeight: "100%" }}
    >
      {/* Capability Warning Banner */}
      {capability.noticeEn && (
        <div
          className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded text-sm flex items-center justify-between"
          role="alert"
        >
          <div>
            <span className="font-semibold">{capability.noticeEn}</span>
            <div className="text-xs text-amber-700 mt-0.5">{capability.noticeUr}</div>
          </div>
          <span className="text-xs font-mono uppercase bg-amber-200 px-2 py-0.5 rounded">
            {capability.mode}
          </span>
        </div>
      )}

      {/* Screen Title & Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>Staff Onboarding & Credentials Wizard</span>
            <span className="text-xs font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
              MSDS HRM 142
            </span>
          </h1>
          <p className="text-sm text-gray-600">
            Multi-step employee registration, statutory CNIC identity verification, professional credential vault,
            and IT provisioning handover.
          </p>
        </div>

        {/* Load Existing Draft or Start New */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Employee ID..."
            value={searchEmpIdInput}
            onChange={(e) => setSearchEmpIdInput(e.target.value)}
            className="w-32 px-2.5 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500"
            data-help="onboarding_wizard.load_emp_id"
          />
          <button
            type="button"
            onClick={() => loadEmployee(Number(searchEmpIdInput))}
            disabled={loading || !searchEmpIdInput}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 border rounded font-medium disabled:opacity-50"
            data-help="onboarding_wizard.btn_load_emp"
          >
            {loading ? "Loading..." : "Load Profile"}
          </button>
          <button
            type="button"
            onClick={handleStartNewEmployee}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
            data-help="onboarding_wizard.btn_new_emp"
          >
            + New Employee
          </button>
        </div>
      </div>

      {/* Active Employee Banner */}
      {employee && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <span>{employee.full_name}</span>
                <span className="font-mono text-xs bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                  {employee.emp_number}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    employee.employment_status === "Draft"
                      ? "bg-amber-100 text-amber-800"
                      : employee.employment_status === "Awaiting_IT_Provisioning"
                      ? "bg-purple-100 text-purple-800"
                      : employee.employment_status === "Active"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {employee.employment_status}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                CNIC: <span className="font-mono">{employee.cnic}</span> • Dept:{" "}
                {employee.department_name || "Unassigned"} • Designation: {employee.designation || "Pending"} •
                Category: {employee.staff_category}
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-gray-500">
            <div>Step {employee.onboarding_step} of 6</div>
            <div className="text-slate-600">Created: {new Date(employee.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      )}

      {/* Global Alerts */}
      {errorBanner && (
        <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded text-sm" role="alert">
          <div className="font-semibold">{errorBanner.message}</div>
          {errorBanner.ur && <div className="text-xs text-red-700 mt-0.5">{errorBanner.ur}</div>}
          {errorBanner.code && (
            <div className="text-xs font-mono text-red-600 mt-1">Refusal Code: {errorBanner.code}</div>
          )}
        </div>
      )}

      {successBanner && (
        <div className="p-3 bg-green-50 border border-green-300 text-green-900 rounded text-sm" role="status">
          <div className="font-semibold">{successBanner}</div>
        </div>
      )}

      {/* 6-Step Stepper Navigation */}
      <nav className="flex items-center justify-between border rounded bg-white p-2 text-xs md:text-sm overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveStep(1)}
          data-help="onboarding_wizard.step_1_tab"
          className={`flex-1 py-2 px-3 text-center rounded font-medium transition-colors whitespace-nowrap ${
            activeStep === 1
              ? "bg-blue-600 text-white shadow-sm"
              : employee && employee.onboarding_step > 1
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          1. Demographics
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(2)}
          disabled={!employee}
          data-help="onboarding_wizard.step_2_tab"
          className={`flex-1 py-2 px-3 text-center rounded font-medium transition-colors whitespace-nowrap ${
            activeStep === 2
              ? "bg-blue-600 text-white shadow-sm"
              : employee && employee.onboarding_step > 2
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : !employee
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          2. Job & Finance
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(3)}
          disabled={!employee}
          data-help="onboarding_wizard.step_3_tab"
          className={`flex-1 py-2 px-3 text-center rounded font-medium transition-colors whitespace-nowrap ${
            activeStep === 3
              ? "bg-blue-600 text-white shadow-sm"
              : employee && employee.onboarding_step > 3
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : !employee
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          3. Qualifications
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(4)}
          disabled={!employee}
          data-help="onboarding_wizard.step_4_tab"
          className={`flex-1 py-2 px-3 text-center rounded font-medium transition-colors whitespace-nowrap ${
            activeStep === 4
              ? "bg-blue-600 text-white shadow-sm"
              : employee && employee.onboarding_step > 4
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : !employee
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          4. Financial Config
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(5)}
          disabled={!employee}
          data-help="onboarding_wizard.step_5_tab"
          className={`flex-1 py-2 px-3 text-center rounded font-medium transition-colors whitespace-nowrap ${
            activeStep === 5
              ? "bg-blue-600 text-white shadow-sm"
              : employee && employee.onboarding_step > 5
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : !employee
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          5. Document Vault
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(6)}
          disabled={!employee}
          data-help="onboarding_wizard.step_6_tab"
          className={`flex-1 py-2 px-3 text-center rounded font-medium transition-colors whitespace-nowrap ${
            activeStep === 6
              ? "bg-blue-600 text-white shadow-sm"
              : employee && employee.onboarding_step > 6
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : !employee
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          6. Finalize
        </button>
      </nav>

      {/* STEP 1: DEMOGRAPHICS */}
      {activeStep === 1 && (
        <section className="bg-white border rounded p-4 space-y-4" aria-label="Step 1: Demographics">
          <div className="border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-800">Step 1 — Employee Demographics</h2>
            <p className="text-xs text-gray-500">
              CNIC is strictly mandatory for hospital employees per MSDS HRM standard 142.
            </p>
          </div>

          <form onSubmit={handleSaveStep1} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={step1Data.full_name}
                  onChange={(e) => setStep1Data({ ...step1Data, full_name: e.target.value })}
                  placeholder="e.g. Dr. Muhammad Tariq"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step1_full_name"
                />
                {step1Errors.full_name && (
                  <p className="text-xs text-red-600 mt-1">{step1Errors.full_name}</p>
                )}
              </div>

              {/* Father or Husband Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Father / Husband Name
                </label>
                <input
                  type="text"
                  value={step1Data.father_or_husband_name}
                  onChange={(e) => setStep1Data({ ...step1Data, father_or_husband_name: e.target.value })}
                  placeholder="Father or Husband name"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step1_father_name"
                />
              </div>

              {/* CNIC (strictly mandatory) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  CNIC (13 digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  value={step1Data.cnic}
                  onChange={(e) => setStep1Data({ ...step1Data, cnic: formatCnic(e.target.value) })}
                  placeholder="35201-1234567-1"
                  className="w-full px-3 py-2 text-sm font-mono border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step1_cnic"
                />
                {step1Errors.cnic && (
                  <p className="text-xs text-red-600 mt-1">{step1Errors.cnic}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={step1Data.dob}
                  onChange={(e) => setStep1Data({ ...step1Data, dob: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step1_dob"
                />
                {step1Errors.dob && (
                  <p className="text-xs text-red-600 mt-1">{step1Errors.dob}</p>
                )}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Gender</label>
                <select
                  value={step1Data.gender}
                  onChange={(e) =>
                    setStep1Data({
                      ...step1Data,
                      gender: e.target.value as "male" | "female" | "other" | "",
                    })
                  }
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step1_gender"
                >
                  <option value="">Select gender...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={step1Data.mobile}
                  onChange={(e) => setStep1Data({ ...step1Data, mobile: e.target.value })}
                  placeholder="03001234567"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step1_mobile"
                />
                {step1Errors.mobile && (
                  <p className="text-xs text-red-600 mt-1">{step1Errors.mobile}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={step1Data.email}
                  onChange={(e) => setStep1Data({ ...step1Data, email: e.target.value })}
                  placeholder="tariq@example.com"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step1_email"
                />
                {step1Errors.email && (
                  <p className="text-xs text-red-600 mt-1">{step1Errors.email}</p>
                )}
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Blood Group</label>
                <select
                  value={step1Data.blood_group}
                  onChange={(e) =>
                    setStep1Data({
                      ...step1Data,
                      blood_group: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step1_blood_group"
                >
                  <option value="">Select blood group...</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>

              {/* Initial Designation if new */}
              {!employee && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={step1Data.designation}
                    onChange={(e) => setStep1Data({ ...step1Data, designation: e.target.value })}
                    placeholder="e.g. Senior Medical Officer"
                    className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                    data-help="onboarding_wizard.step1_designation"
                  />
                </div>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Residential Address</label>
              <textarea
                rows={2}
                value={step1Data.address}
                onChange={(e) => setStep1Data({ ...step1Data, address: e.target.value })}
                placeholder="Residential street address, city"
                className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                data-help="onboarding_wizard.step1_address"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm flex items-center gap-2"
                data-help="onboarding_wizard.step1_btn_save"
              >
                {actionLoading
                  ? "Saving..."
                  : employee
                  ? "Save Demographics & Proceed"
                  : "Create Employee Profile & Proceed"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* STEP 2: JOB & FINANCE TAXONOMY */}
      {activeStep === 2 && (
        <section className="bg-white border rounded p-4 space-y-4" aria-label="Step 2: Job & Finance">
          <div className="border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-800">Step 2 — Job Taxonomy & Financial Structure</h2>
            <p className="text-xs text-gray-500">
              Assign administrative department, job designation, reporting hierarchy supervisor, and contract type.
            </p>
          </div>

          <form onSubmit={handleSaveStep2} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                <select
                  value={step2Data.department_id}
                  onChange={(e) => setStep2Data({ ...step2Data, department_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step2_department"
                >
                  <option value="">Select department...</option>
                  {departments.map((dept) => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.name} {dept.code ? `(${dept.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={step2Data.designation}
                  onChange={(e) => setStep2Data({ ...step2Data, designation: e.target.value })}
                  placeholder="e.g. Consultant Surgeon / Staff Nurse"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step2_designation"
                />
                {step2Errors.designation && (
                  <p className="text-xs text-red-600 mt-1">{step2Errors.designation}</p>
                )}
              </div>

              {/* Specialty */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Specialty</label>
                <input
                  type="text"
                  value={step2Data.specialty}
                  onChange={(e) => setStep2Data({ ...step2Data, specialty: e.target.value })}
                  placeholder="e.g. Paediatrics, Cardiology, ICU"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step2_specialty"
                />
              </div>

              {/* Supervisor (Reports To) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Supervisor (Reports To)
                </label>
                <select
                  value={step2Data.supervisor_id}
                  onChange={(e) => setStep2Data({ ...step2Data, supervisor_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step2_supervisor"
                >
                  <option value="">No supervisor (Top-level / Self-managed)</option>
                  {supervisors
                    .filter((s) => !employee || s.employee_id !== employee.employee_id)
                    .map((sup) => (
                      <option key={sup.employee_id} value={sup.employee_id}>
                        {sup.full_name} ({sup.designation}) [{sup.emp_number}]
                      </option>
                    ))}
                </select>
                {step2Errors.supervisor_id && (
                  <p className="text-xs text-red-600 mt-1">{step2Errors.supervisor_id}</p>
                )}
              </div>

              {/* Base Salary */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Base Salary (PKR)</label>
                <input
                  type="number"
                  min="0"
                  value={step2Data.base_salary}
                  onChange={(e) => setStep2Data({ ...step2Data, base_salary: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step2_salary"
                />
                {step2Errors.base_salary && (
                  <p className="text-xs text-red-600 mt-1">{step2Errors.base_salary}</p>
                )}
              </div>

              {/* Contract Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contract Type</label>
                <select
                  value={step2Data.contract_type}
                  onChange={(e) =>
                    setStep2Data({
                      ...step2Data,
                      contract_type: e.target.value as "Permanent" | "Contract" | "Visiting",
                    })
                  }
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step2_contract_type"
                >
                  <option value="Permanent">Permanent</option>
                  <option value="Contract">Contract</option>
                  <option value="Visiting">Visiting (Consultant)</option>
                </select>
              </div>

              {/* Staff Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Staff Category</label>
                <select
                  value={step2Data.staff_category}
                  onChange={(e) =>
                    setStep2Data({
                      ...step2Data,
                      staff_category: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step2_category"
                >
                  <option value="Clinical">Clinical</option>
                  <option value="Nursing">Nursing</option>
                  <option value="Administrative">Administrative</option>
                  <option value="Technical">Technical</option>
                  <option value="SupportZeroInterface">Support (Zero Interface)</option>
                  <option value="Visiting">Visiting</option>
                </select>
              </div>

              {/* Joined On Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Joining Date</label>
                <input
                  type="date"
                  value={step2Data.joined_on}
                  onChange={(e) => setStep2Data({ ...step2Data, joined_on: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step2_joined_on"
                />
              </div>

              {/* Is Clinical Staff Checkbox */}
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={step2Data.is_clinical_staff}
                    onChange={(e) =>
                      setStep2Data({ ...step2Data, is_clinical_staff: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    data-help="onboarding_wizard.step2_is_clinical"
                  />
                  <span>Is Clinical Staff (Doctors & Nurses)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
                data-help="onboarding_wizard.step2_btn_back"
              >
                &larr; Back to Demographics
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
                data-help="onboarding_wizard.step2_btn_save"
              >
                {actionLoading ? "Saving..." : "Save Job Details & Proceed"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* STEP 3: LICENCES & QUALIFICATIONS */}
      {activeStep === 3 && (
        <section className="bg-white border rounded p-4 space-y-4" aria-label="Step 3: Licences & Qualifications">
          <div className="border-b pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Step 3 — Licences & Educational Qualifications</h2>
              <p className="text-xs text-gray-500">
                Medical & nursing registration numbers and primary source verified qualifications (MSDS HRM 142).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsQualModalOpen(true)}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-sm font-medium hover:bg-blue-100"
              data-help="onboarding_wizard.step3_btn_add_qual"
            >
              + Add Qualification
            </button>
          </div>

          {/* Professional Licence Form */}
          <form onSubmit={handleSaveStep3License} className="bg-slate-50 border p-3 rounded space-y-3">
            <div className="font-semibold text-sm text-gray-800 flex items-center gap-2">
              <span>Statutory Clinical Practice Licence</span>
              {step2Data.is_clinical_staff && (
                <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-normal">
                  Required for Clinical Staff
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Licence Type</label>
                <select
                  value={step3License.license_type}
                  onChange={(e) =>
                    setStep3License({
                      ...step3License,
                      license_type: e.target.value as "PMDC" | "PNC" | "Other" | "",
                    })
                  }
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step3_lic_type"
                >
                  <option value="">None / Not Applicable</option>
                  <option value="PMDC">PMDC (Pakistan Medical and Dental Council)</option>
                  <option value="PNC">PNC (Pakistan Nursing Council)</option>
                  <option value="Other">Other Regulatory Board</option>
                </select>
                {step3LicenseErrors.license_type && (
                  <p className="text-xs text-red-600 mt-1">{step3LicenseErrors.license_type}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Licence / Registration Number</label>
                <input
                  type="text"
                  value={step3License.license_number}
                  onChange={(e) => setStep3License({ ...step3License, license_number: e.target.value })}
                  placeholder="e.g. 12345-P or 9876-N"
                  className="w-full px-3 py-2 text-sm font-mono border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step3_lic_number"
                />
                {step3LicenseErrors.license_number && (
                  <p className="text-xs text-red-600 mt-1">{step3LicenseErrors.license_number}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium"
                data-help="onboarding_wizard.step3_btn_save_lic"
              >
                {actionLoading ? "Saving..." : "Update Practice Licence"}
              </button>
            </div>
          </form>

          {/* Qualifications Table */}
          <div>
            <div className="text-sm font-semibold text-gray-800 mb-2">Qualifications & Certifications Directory</div>
            {(!employee?.qualifications || employee.qualifications.length === 0) ? (
              <div className="p-4 border rounded text-center text-sm text-gray-500 bg-gray-50">
                No educational degrees or certifications added yet. Click &ldquo;+ Add Qualification&rdquo; above.
              </div>
            ) : (
              <div className="border rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 border-b">
                    <tr>
                      <th className="p-2">Type</th>
                      <th className="p-2">Title / Degree</th>
                      <th className="p-2">Institution</th>
                      <th className="p-2">Year</th>
                      <th className="p-2">Licence / Ref</th>
                      <th className="p-2">Verification (MSDS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employee.qualifications.map((q) => (
                      <tr key={q.qualification_id} className="hover:bg-gray-50">
                        <td className="p-2 font-medium">{q.qualification_type}</td>
                        <td className="p-2 font-semibold text-gray-900">{q.title}</td>
                        <td className="p-2 text-gray-600">{q.institution || "—"}</td>
                        <td className="p-2">{q.year || "—"}</td>
                        <td className="p-2 font-mono">{q.license_number || "—"}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              q.verification_status === "Verified"
                                ? "bg-green-100 text-green-800"
                                : q.verification_status === "Failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {q.verification_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
              data-help="onboarding_wizard.step3_btn_back"
            >
              &larr; Back to Job Details
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(4)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
              data-help="onboarding_wizard.step3_btn_next"
            >
              Proceed to Financial Config &rarr;
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: FINANCIAL CONFIG (RULE rule:cd04ca0d57) */}
      {activeStep === 4 && (
        <section className="bg-white border rounded p-4 space-y-4" aria-label="Step 4: Financial Configuration">
          <div className="border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-800">Step 4 — Financial Configuration & Commission Rules</h2>
            <p className="text-xs text-gray-500">
              Compensation summary and statutory contractual provisions.
            </p>
          </div>

          {/* Statutory Notice for Visiting Consultants per Rule rule:cd04ca0d57 */}
          {employee?.contract_type === "Visiting" ? (
            <div className="p-4 bg-blue-50 border border-blue-300 rounded text-blue-900 space-y-2">
              <div className="font-semibold text-sm flex items-center gap-2">
                <span>Visiting Consultant Contract Protocol (Rule rule:cd04ca0d57)</span>
                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-mono">
                  Billing Admin Authority
                </span>
              </div>
              <p className="text-xs leading-relaxed">
                For visiting consultants, the OT split and clinical fee revenue share commission contracts are
                configured by the <strong>Billing Admin</strong> under <em>Price &amp; Policy Management (billing_admin)</em>.
                Per executive decisions 56, the onboarding wizard does not configure or submit commission percentages;
                this separation prevents financial policy circumvention.
              </p>
              <div className="text-xs font-medium text-blue-800 bg-blue-100 p-2 rounded">
                Status: {employee.contract ? "Commission contract in place" : "Pending contract creation by Billing Admin."}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border rounded space-y-2">
              <div className="font-semibold text-sm text-gray-800">Standard Salary Structure</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Contract Type:</span>{" "}
                  <span className="font-medium text-gray-900">{employee?.contract_type || "Permanent"}</span>
                </div>
                <div>
                  <span className="text-gray-500">Base Monthly Salary:</span>{" "}
                  <span className="font-mono font-medium text-gray-900">
                    PKR {Number(employee?.base_salary || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Standard compensation is automatically accrued during payroll cycles. OT splits do not apply to regular
                salaried staff.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
              data-help="onboarding_wizard.step4_btn_back"
            >
              &larr; Back to Qualifications
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(5)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
              data-help="onboarding_wizard.step4_btn_next"
            >
              Proceed to Document Vault &rarr;
            </button>
          </div>
        </section>
      )}

      {/* STEP 5: DOCUMENT VAULT (RULE rule:44d2ead844 & rule:511519d15c) */}
      {activeStep === 5 && (
        <section className="bg-white border rounded p-4 space-y-4" aria-label="Step 5: Document Vault">
          <div className="border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-800">Step 5 — Document Vault & ID Card Photo</h2>
            <p className="text-xs text-gray-500">
              Upload mandatory identification, degree certificates, licensing records, and ID card photograph.
            </p>
          </div>

          {/* Upload Form */}
          <form onSubmit={handleUploadDocument} className="bg-slate-50 border p-4 rounded space-y-3">
            <div className="font-semibold text-sm text-gray-800 flex items-center justify-between">
              <span>Upload Employee Credential Document</span>
              <span className="text-xs text-gray-500">Multipart form upload (Rule rule:44d2ead844)</span>
            </div>

            {docUploadError && (
              <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {docUploadError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Document Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step5_doc_type"
                >
                  <option value="CNIC">CNIC (National ID Card)</option>
                  <option value="Photo">Photo (Staff ID Badge - JPEG/PNG Only)</option>
                  <option value="Degree">Degree / Diploma Certificate</option>
                  <option value="PMDC">PMDC Registration Certificate</option>
                  <option value="PNC">PNC Registration Certificate</option>
                  <option value="Contract">Signed Employment Contract</option>
                  <option value="Experience">Experience Certificate</option>
                  <option value="Other">Other Supporting Document</option>
                </select>
                {uploadDocType === "Photo" && (
                  <p className="text-xs text-amber-700 mt-1 font-medium">
                    Photo must be JPEG or PNG only (PDF is forbidden; max 16MP / 8MB).
                  </p>
                )}
              </div>

              {/* Document Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Document Title (Optional)</label>
                <input
                  type="text"
                  value={uploadDocTitle}
                  onChange={(e) => setUploadDocTitle(e.target.value)}
                  placeholder="e.g. Scanned CNIC Front & Back"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.step5_doc_title"
                />
              </div>

              {/* File Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select File (PDF, JPEG, PNG) <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept={
                    uploadDocType === "Photo"
                      ? "image/jpeg,image/png"
                      : "application/pdf,image/jpeg,image/png"
                  }
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  data-help="onboarding_wizard.step5_file_input"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={actionLoading || !selectedFile}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50"
                data-help="onboarding_wizard.step5_btn_upload"
              >
                {actionLoading ? "Uploading..." : "Upload Document to Vault"}
              </button>
            </div>
          </form>

          {/* Uploaded Documents List */}
          <div>
            <div className="text-sm font-semibold text-gray-800 mb-2">Vault Stored Documents</div>
            {(!employee?.documents || employee.documents.length === 0) ? (
              <div className="p-4 border rounded text-center text-sm text-gray-500 bg-gray-50">
                No documents uploaded yet. CNIC document and staff ID Photo are mandatory for onboarding submission.
              </div>
            ) : (
              <div className="border rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 border-b">
                    <tr>
                      <th className="p-2">Doc Type</th>
                      <th className="p-2">Title</th>
                      <th className="p-2">MIME Format</th>
                      <th className="p-2">Size</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Uploaded At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employee.documents.map((doc) => (
                      <tr key={doc.document_id} className="hover:bg-gray-50">
                        <td className="p-2 font-medium">{doc.doc_type}</td>
                        <td className="p-2 text-gray-900 font-semibold">{doc.title || "—"}</td>
                        <td className="p-2 font-mono text-gray-600">{doc.content_type}</td>
                        <td className="p-2">
                          {doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : "—"}
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              doc.is_verified
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {doc.is_verified ? "Verified" : "Uploaded"}
                          </span>
                        </td>
                        <td className="p-2 text-gray-500">
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveStep(4)}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
              data-help="onboarding_wizard.step5_btn_back"
            >
              &larr; Back to Financial Config
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(6)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
              data-help="onboarding_wizard.step5_btn_next"
            >
              Proceed to Finalize &rarr;
            </button>
          </div>
        </section>
      )}

      {/* STEP 6: FINALIZE & SUBMIT (RULES rule:adc6619db9 & rule:c1f853fceb) */}
      {activeStep === 6 && (
        <section className="bg-white border rounded p-4 space-y-4" aria-label="Step 6: Finalize">
          <div className="border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-800">Step 6 — Finalize Onboarding & IT Handover</h2>
            <p className="text-xs text-gray-500">
              Verify completion checklist and hand over profile to IT Console for user account provisioning.
            </p>
          </div>

          {/* Statutory Handover Banner per Rule rule:adc6619db9 */}
          <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded text-xs leading-relaxed space-y-1">
            <div className="font-semibold text-sm flex items-center gap-2">
              <span>Rule rule:adc6619db9: Handover to IT Console</span>
              <span className="bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded font-mono">
                No HR Login Creation
              </span>
            </div>
            <p>
              Finalizing onboarding updates the employment status to{" "}
              <span className="font-mono font-semibold">Awaiting_IT_Provisioning</span>. HR operations never create
              system logins; IT Console administers user identity, role privileges, and authentication credentials.
            </p>
          </div>

          {/* Submission Readiness Checklist per Rule rule:c1f853fceb */}
          <div className="border rounded p-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-800">
                Onboarding Readiness Checklist (Rule rule:c1f853fceb)
              </span>
              <span
                className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  employee?.checklist?.ready
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {employee?.checklist?.ready ? "Ready for Submission" : "Missing Requirements"}
              </span>
            </div>

            {employee?.checklist?.missing && employee.checklist.missing.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-red-700 font-medium">Blocking items:</div>
                <ul className="list-disc list-inside text-xs text-red-600 pl-2">
                  {employee.checklist.missing.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-gray-600">
              {employee?.checklist?.ready ? (
                <span className="text-green-700 font-medium">
                  All mandatory demographics, job parameters, and documentation are verified and complete.
                </span>
              ) : (
                <span className="text-gray-500">
                  Please return to the preceding steps to complete the missing items before final submission.
                </span>
              )}
            </div>
          </div>

          {/* Profile Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-white border p-3 rounded">
            <div>
              <span className="text-gray-500">Employee Name:</span>{" "}
              <span className="font-semibold text-gray-900">{employee?.full_name}</span>
            </div>
            <div>
              <span className="text-gray-500">Employee Number:</span>{" "}
              <span className="font-mono font-semibold text-gray-900">{employee?.emp_number}</span>
            </div>
            <div>
              <span className="text-gray-500">CNIC:</span>{" "}
              <span className="font-mono text-gray-900">{employee?.cnic}</span>
            </div>
            <div>
              <span className="text-gray-500">Current Status:</span>{" "}
              <span className="font-semibold text-purple-700">{employee?.employment_status}</span>
            </div>
            <div>
              <span className="text-gray-500">Department:</span>{" "}
              <span className="text-gray-900">{employee?.department_name || "Unassigned"}</span>
            </div>
            <div>
              <span className="text-gray-500">Designation:</span>{" "}
              <span className="text-gray-900">{employee?.designation}</span>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveStep(5)}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
              data-help="onboarding_wizard.step6_btn_back"
            >
              &larr; Back to Document Vault
            </button>

            {/* Submit Button Greyed Out until checklist.ready is true per Rule rule:c1f853fceb */}
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(true)}
              disabled={!submissionState.canSubmit || actionLoading}
              className={`px-6 py-2.5 rounded font-semibold text-sm shadow-sm transition-colors ${
                submissionState.canSubmit
                  ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300"
              }`}
              title={submissionState.reasonEn || "Submit onboarding profile"}
              data-help="onboarding_wizard.step6_btn_submit"
            >
              {actionLoading
                ? "Submitting..."
                : employee?.employment_status === "Awaiting_IT_Provisioning"
                ? "Already Handed Over to IT"
                : "Submit & Handover to IT Console"}
            </button>
          </div>
        </section>
      )}

      {/* ADD QUALIFICATION MODAL */}
      {isQualModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="border-b pb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Add Academic or Professional Qualification</h3>
              <button
                type="button"
                onClick={() => setIsQualModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
                data-help="onboarding_wizard.modal_btn_close_qual"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddQualification} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={qualFormData.qualification_type}
                  onChange={(e) =>
                    setQualFormData({
                      ...qualFormData,
                      qualification_type: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.modal_qual_type"
                >
                  <option value="Education">Education (Degree / Diploma)</option>
                  <option value="Experience">Experience (Hospital / Clinical)</option>
                  <option value="License">Licence</option>
                  <option value="Certification">Professional Certification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Title / Degree Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={qualFormData.title}
                  onChange={(e) => setQualFormData({ ...qualFormData, title: e.target.value })}
                  placeholder="e.g. MBBS, FCPS, BSc Nursing"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.modal_qual_title"
                />
                {qualErrors.title && (
                  <p className="text-xs text-red-600 mt-1">{qualErrors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Institution / Board / University
                </label>
                <input
                  type="text"
                  value={qualFormData.institution}
                  onChange={(e) => setQualFormData({ ...qualFormData, institution: e.target.value })}
                  placeholder="e.g. King Edward Medical University"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.modal_qual_inst"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Year of Graduation</label>
                  <input
                    type="number"
                    min="1950"
                    max={new Date().getFullYear()}
                    value={qualFormData.year}
                    onChange={(e) => setQualFormData({ ...qualFormData, year: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                    data-help="onboarding_wizard.modal_qual_year"
                  />
                  {qualErrors.year && (
                    <p className="text-xs text-red-600 mt-1">{qualErrors.year}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Licence / Reg Number</label>
                  <input
                    type="text"
                    value={qualFormData.license_number}
                    onChange={(e) => setQualFormData({ ...qualFormData, license_number: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-sm font-mono border rounded focus:ring-1 focus:ring-blue-500"
                    data-help="onboarding_wizard.modal_qual_lic_no"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Verification Notes</label>
                <textarea
                  rows={2}
                  value={qualFormData.notes}
                  onChange={(e) => setQualFormData({ ...qualFormData, notes: e.target.value })}
                  placeholder="Notes on document verification or HEC attestation"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                  data-help="onboarding_wizard.modal_qual_notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsQualModalOpen(false)}
                  className="px-3 py-1.5 border rounded text-xs text-gray-700 hover:bg-gray-50"
                  data-help="onboarding_wizard.modal_btn_cancel_qual"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                  data-help="onboarding_wizard.modal_btn_save_qual"
                >
                  {actionLoading ? "Saving..." : "Add to Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINAL SUBMISSION CONFIRMATION MODAL */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 border-b pb-2">
              Confirm Onboarding Submission &amp; IT Handover
            </h3>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to finalize onboarding for{" "}
              <strong>{employee?.full_name}</strong> (<strong>{employee?.emp_number}</strong>)?
            </p>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900">
              <span className="font-semibold block mb-1">Handover to IT Console:</span>
              The employee status will be set to <strong>Awaiting_IT_Provisioning</strong>. IT administration will
              generate the username, credentials, and assign terminal permissions.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-3 py-1.5 border rounded text-xs text-gray-700 hover:bg-gray-50"
                data-help="onboarding_wizard.modal_btn_cancel_submit"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold"
                data-help="onboarding_wizard.modal_btn_confirm_submit"
              >
                {actionLoading ? "Submitting..." : "Confirm & Handover to IT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
