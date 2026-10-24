type Rule = { code: string; applies: boolean };

/** These are server-selected rules, not a locally inferred facility category. */
export function consultationRequirements(kind: string, rules: readonly Rule[] = []) {
  const outpatient = kind === "OPD" || kind === "FollowUp";
  const active = (code: string) => outpatient && rules.some(r => r.code === code && r.applies === true);
  return {
    consent: active("consultation_requires_vco"),
    completeRecord: active("consultation_complete_record"),
  };
}

/** Keep the server's message; only map known missing-field names to controls. */
export function consultationFieldMissing(field: string, missing: readonly string[]) {
  const tokens = missing.flatMap(value => value.toLowerCase().split(/[^a-z_]+/));
  return tokens.includes(field) ||
    ((field === "chief_complaint" || field === "history") &&
      tokens.some(value => value === "complaint_or_history" || value === "chief_complaint_or_history"));
}
