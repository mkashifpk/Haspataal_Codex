# Radiology frontend implementation notes

## Doctor lookup clarification after report30

Initial discovery reported a missing clinical-doctor picker and cautiously treated employee_id and doctor_id as distinct. Subsequent exact contract reading shows `RegistrationIn.doctor_id` explicitly means the doctor's **employee ID**. Current DEV service catalogue doctor10 and actual staff lookup employee10 both identify Dr. Ahmed Khan; demo.doctor auth/me employee10 independently confirms the relation. No guessed ID is needed.

The frontend now searches actual active staff with GET /staff/lookup, selects the real badge entry and sends its actual employee_id as contrast_doctor_id. The server remains authoritative for PMDC/doctor eligibility; job title/name is never client authorization. Numeric ID entry and the incorrect 'employee ID is different' wording were removed before testing.

Report30's initial ID-mismatch wording was too broad. The remaining backend documentation/enrichment question is whether the lookup should expose clinical eligibility; it is no longer a UI blocker. MCP offers report creation/read but no comment/edit/withdraw operation, so this correction is recorded explicitly for the backend/human rather than creating a duplicate report. Read its answer on the next session and reconcile any changed contracts.

No external call, clinical exposure, real contrast or real money is performed. Later Radiology critical-results communication, outsourcing, repeats and quality screens remain separate next-screen work. This page offers factual phone-now handover instructions and never claims that saving/printing made a clinical communication.
