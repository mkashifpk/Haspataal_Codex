import type { PatientSearchHitOut } from "./generated/patient_search";
import { bilingual as t } from "./i18n";

// This is server-provided match context, never a client-side alias or rewrite.
export function PatientSearchMatch({hit}: {hit: Pick<PatientSearchHitOut, "matched_merged_profile">}) {
  const matched = hit.matched_merged_profile;
  if (!matched) return null;
  return <span className="fine muted patient-merge-match" style={{display:"block"}} dir="auto">
    {t("Found by ", "اس شناخت سے ملا: ")}<bdi>{matched.mrn}</bdi>
    {t(", merged into this record", "؛ یہ شناخت اس ریکارڈ میں ضم ہے")}
  </span>;
}
