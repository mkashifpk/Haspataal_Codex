import type {
  ConsentOut,
  ConsentFormOut,
  ConsentIn,
  ConsentUpdateIn,
  ConsentSignIn,
  ConsentRefuseIn,
  DecisionMakerOut,
} from "./generated/consents_admissions";
import type { StaffLookupOut } from "./generated/radiology_worklist";
export type ConsentAction =
  "create" | "edit" | "sign" | "refuse" | "withdraw" | "cancel" | "scan";
export const consentAccess = (view: string | undefined, p: string[]) => ({
  read:
    ["full", "open_work", "records"].includes(view || "") &&
    p.includes("consent.view"),
  write:
    ["full", "open_work"].includes(view || "") && p.includes("consent.record"),
  correct:
    ["full", "open_work", "records"].includes(view || "") &&
    p.includes("consent.record"),
});
export const consentSnapshot = (c: ConsentOut) => JSON.stringify(c);
export function consentActionAllowed(c: ConsentOut, action: ConsentAction) {
  return (
    c.category === "General" &&
    ((["edit", "sign", "refuse", "cancel"].includes(action) &&
      c.status === "Draft") ||
      (action === "withdraw" && c.status === "Given") ||
      (action === "scan" &&
        ["Given", "Refused", "Withdrawn"].includes(c.status)))
  );
}
export type Explanation = {
  language: ConsentIn["language"];
  admission_need: string;
  estimated_days: string;
  estimated_cost: string;
};
export const explanation = (c?: ConsentOut): Explanation => ({
  language: c?.language || "English",
  admission_need: c?.admission_need || "",
  estimated_days: c?.estimated_days == null ? "" : String(c.estimated_days),
  estimated_cost: c?.estimated_cost == null ? "" : String(c.estimated_cost),
});
export function explanationBody(
  d: Explanation,
  form: ConsentFormOut,
  version?: number,
): ConsentUpdateIn {
  if (!form.texts.some((t) => t.language === d.language))
    throw Error("Choose a language supplied by this hospital form.");
  if (d.admission_need.length > 2000)
    throw Error("Admission need must be at most 2000 characters.");
  const days = d.estimated_days.trim(),
    cost = d.estimated_cost.trim();
  if (days && (!/^\d+$/.test(days) || Number(days) > 365))
    throw Error("Estimated stay must be a whole number from 0 to 365.");
  if (cost && (!/^\d+(?:\.\d+)?$/.test(cost) || !Number.isFinite(Number(cost))))
    throw Error("Estimated cost must be a non-negative amount.");
  return {
    language: d.language,
    admission_need: d.admission_need.trim() || null,
    estimated_days: days ? Number(days) : null,
    estimated_cost: cost ? Number(cost) : null,
    ...(version === undefined ? {} : { expected_version: version }),
  };
}
export type Decision = {
  mode: "Signed" | "EmergencyNote" | "VerbalRefusal";
  signer: "" | "Patient" | "DecisionMaker";
  signer_name: string;
  signer_relationship: string;
  incapacity_reason: string;
  signer_mark: "Signature" | "ThumbImpression";
  signer_cnic: string;
  signer_phone: string;
  witness_name: string;
  witness_role: string;
  interpreter_name: string;
  read_to_patient: boolean;
  questions_answers: string;
  understanding_confirmed: boolean;
  emergency_note: string;
  refusal_reason: string;
  doctor?: StaffLookupOut;
  ack: boolean;
};
export const emptyDecision = (): Decision => ({
  mode: "Signed",
  signer: "",
  signer_name: "",
  signer_relationship: "",
  incapacity_reason: "",
  signer_mark: "Signature",
  signer_cnic: "",
  signer_phone: "",
  witness_name: "",
  witness_role: "",
  interpreter_name: "",
  read_to_patient: false,
  questions_answers: "",
  understanding_confirmed: false,
  emergency_note: "",
  refusal_reason: "",
  ack: false,
});
// The public API does not expose consent_adult_age: do not invent a fixed age cutoff.
// Show BOTH returned priority columns; never infer the patient's group or claim
// client-side eligibility. The database validates the actual relationship.
export const policyDecisionMakers = (rows: DecisionMakerOut[]) =>
  rows.filter((r) => r.adult_priority !== null || r.minor_priority !== null);
export function decisionBody(
  c: ConsentOut,
  d: Decision,
  kind: "sign" | "refuse",
  policy: DecisionMakerOut[],
  employee?: number | null,
): ConsentSignIn | ConsentRefuseIn {
  if (!consentActionAllowed(c, kind))
    throw Error(
      "This consent is final. Read it; withdraw a given consent and prepare a new one.",
    );
  if (!d.ack)
    throw Error("Confirm the actual decision and paper before recording it.");
  if (c.missing.length)
    throw Error(
      "Complete the missing explanation fields and reprint before recording the decision.",
    );
  if (
    (kind === "sign" && d.mode === "VerbalRefusal") ||
    (kind === "refuse" && d.mode === "EmergencyNote")
  )
    throw Error("Choose the correct decision mode.");
  if (kind === "refuse" && d.refusal_reason.trim().length < 3)
    throw Error(
      "Enter the refusal in the patient’s words (3–2000 characters).",
    );
  if (d.signer_cnic && !/^\d{5}-?\d{7}-?\d$/.test(d.signer_cnic))
    throw Error("Enter a valid signer CNIC, or leave it empty.");
  const common: ConsentSignIn = {
    expected_version: c.row_version,
    interpreter_name: d.interpreter_name.trim() || null,
    read_to_patient: d.read_to_patient,
    questions_answers: d.questions_answers.trim() || null,
    understanding_confirmed: d.understanding_confirmed,
  };
  if (d.mode === "EmergencyNote") {
    if (!d.incapacity_reason || d.emergency_note.trim().length < 3)
      throw Error(
        "Record why the patient cannot decide and why treatment cannot wait.",
      );
    if (
      d.doctor &&
      (d.doctor.license_type !== "PMDC" ||
        !d.doctor.registration ||
        d.doctor.employee_id === employee)
    )
      throw Error(
        "Choose a different registered PMDC doctor from the staff search.",
      );
    return {
      ...common,
      mode: "EmergencyNote",
      incapacity_reason:
        d.incapacity_reason as ConsentSignIn["incapacity_reason"],
      emergency_note: d.emergency_note.trim(),
      second_doctor_id: d.doctor?.employee_id ?? null,
    };
  }
  if (!d.signer) throw Error("Deliberately choose who made the decision.");
  if (d.signer === "DecisionMaker") {
    if (
      !d.incapacity_reason ||
      !d.signer_name.trim() ||
      !policyDecisionMakers(policy).some(
        (r) => r.relationship === d.signer_relationship,
      )
    )
      throw Error(
        "Choose a returned policy relationship, their name and the reason the patient cannot decide. The server checks eligibility.",
      );
  }
  if (
    (c.requires_witness ||
      d.signer_mark === "ThumbImpression" ||
      d.mode === "VerbalRefusal") &&
    !d.witness_name.trim()
  )
    throw Error("A witness is required for this form, mark or verbal refusal.");
  if (
    d.mode === "Signed" &&
    (!d.questions_answers.trim() || !d.understanding_confirmed)
  )
    throw Error(
      "Record the questions and answers and confirm the explanation back.",
    );
  const body = {
    ...common,
    mode: d.mode as "Signed" | "VerbalRefusal",
    signer: d.signer,
    signer_name: d.signer_name.trim() || null,
    signer_relationship:
      d.signer === "DecisionMaker"
        ? (d.signer_relationship as ConsentSignIn["signer_relationship"])
        : null,
    incapacity_reason:
      d.signer === "DecisionMaker"
        ? (d.incapacity_reason as ConsentSignIn["incapacity_reason"])
        : null,
    signer_mark: d.signer_mark,
    signer_cnic: d.signer_cnic || null,
    signer_phone: d.signer_phone || null,
    witness_name: d.witness_name.trim() || null,
    witness_role: d.witness_role.trim() || null,
  };
  return kind === "refuse"
    ? { ...body, refusal_reason: d.refusal_reason.trim() }
    : (body as ConsentSignIn);
}
