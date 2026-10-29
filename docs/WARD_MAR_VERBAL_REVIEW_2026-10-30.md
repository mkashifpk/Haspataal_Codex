# Ward Nursing: MAR63 and verbal orders64

30 October2026, Codex implementation1. Baseline3794971; source commit/build recorded in each proposal. Backend build2026-10-28T21:29:45.848402+00:00, contracte90ba541e495d6487532, knowledgee9e3dbb61b873e01, rubric6b013592c628. All screen bundles, omitted sections/decisions, endpoint contracts, generated types, workflow recipes, screen test plans, design principles and Ward Nursing quality/handbook requirements were read. No human Review code or acceptance signature was entered.

## Delivered behaviour

**Medication administration record** uses the shared verified admission context and My beds handover. The chart shows actual schedules, overdue status, authors, identity/medicine checks, high-alert/look-alike flags, self-administration, preparation and correction history. Nurse actions are charting, reasoned append-only correction, PRN/ad-hoc doses, generating missing schedules, preparing a label and Nursing discharge verification. Only actual returned identifiers are used.

The first PRN order is found through the authorised patient master-summary, a returned prescription number, and the prescription detail. Patient/admission identity and active line state are checked before showing or submitting it. This avoids inventing a MAR placeholder or typing a prescription-item ID. These supporting APIs already exist, but the MAR bundle omitted them; report45 asks that they be included.

Administered doses require actual patient identity and medicine checks; overrides are limited to emergency/Code Red with an explanation. Changed dose/route/time can require a variance reason. High-alert co-signature uses an independent nurse/doctor's transient credentials, cleared on submit/close and excluded from retained commands and logs. A scheduled chart is state guarded and never replayed after a lost answer. PRN/corrections/preparation use the original key; high-alert PRN uses read-only reconciliation because credentials are not retained. Ward stock uses actual batch IDs, quantities and expiry/recall flags. Originals remain visible after correction. Discharge clearance rereads the stage; immutable means already cleared, with officer/time, not out of order.

The native bridge caches only authenticated backend dose-label responses for the current window/actor and rechecks permission before printing. Renderer-supplied label content is never trusted. Printing/reprinting is separate from preparation or administration. A missing original label is an explicit error; no invented label or repeated preparation is offered. Actual physical-printer delivery is not certified.

**Verbal and telephone orders** records an exceptional inpatient order with the selected active PMDC doctor, up to40lines, explicit dose/route/frequency/start time, optional duration/interval/end/instructions, high-alert/look-alike/restricted warnings, destination gates and ordered self-administration. Outside medicines are allowed only on an external destination. Chemotherapy is excluded. Changing the order clears read-back and acknowledgement. A saved order tracks the actual prescriber, receiving nurse, deadline, overdue and countersignature. No clinical edit/delete or nurse countersignature is invented. The Ward screen uses admissions; the later separate ER screen is not built here.

Both screens have contextual F1, English/draft Urdu screen guidance, detailed role task FAQs, Ward Nursing journey updates, Light/DarkHighContrast and the existing bounded keyboard/Settings zoom. Runtime server service views and permissions gate actions; no facility-category branch or polling workaround.

## Fresh synthetic records

Runea3cb9: patient17/MRN-2026-000017, ticket16, admission18, own new ward15/bed48. Own inert software-only drug masters12 normal and13 high-alert Other have no real medicine. Doctor prescriptions: Rx4 external with items10scheduled/11high/12PRN; Rx5 hospital with item13 allowed self-administration; Nurse Telephone Rx6 countersigned by its actual doctor. No stock, real medicine, care, exposure or money was used.

Actual MAR results:5Held,29correction of5Refused,12high-alert Administered with independent doctor,38self-administered,59first PRN for item12. Preparations6,7,8 are software label records only. Future scheduled rows remain synthetic active orders. No repeated prepare/administration was used to recover printing.

Runede53e: patient18/MRN-2026-000018, ticket17, admission19, own bed49. Its own policy-allowed general consent and software-only signed discharge summary enabled clinical discharge and Pharmacy clearance; Nurse cleared NursingMARVerification. It remains DischargeInProgress waiting for BillingSettlement; no payment or physical cleaning was recorded. IDs expire on a future reinstall.

## Verification

`npm run build` passed with `index-BIyaxkZ1.js`; `npm test`235/235 passed. Main clinical UI writes were verified on the preceding bootstrap build; subsequent changes added only the recorded-preparation reprint control, print permission recheck and help wording, then received final GET-only UI regression on the final build. See exact builds in `ward6364/ui-evidence.json`.

| Screen / endpoint | Actual outcome |
|---|---|
| MAR GET /admissions/{id}/mar | Real Nurse empty/populated schedules and retained correction/author/check history |
| POST /mar/{id}/chart | Held200 with real reply deliberately lost; GET-only reconciliation, no replay. High-alert200 with actual scanned patient/medicine and second demo clinician; self-administered200 |
| POST /mar/{id}/correction | Actual201 separate Refused correction of Held5; original remains struck and reason retained |
| POST /admissions/{id}/mar/prn | First true PRN discovered safely from history/current-stay Rx; actual201 lost reply and same-key replay return59 once |
| POST /admissions/{id}/mar/generate | Deliberate actual200, missing-only generation; separate from other writes |
| POST /mar/{id}/prepare | Actual200 authoritative label. Separate client device-failure injection preserved preparation without another write; restarted-session unavailability tested honestly |
| GET /wards/{id}/inventory | Authorised empty stock read; stocked batch/expiry/recall journeys remain untested |
| POST discharge/NursingMARVerification/clear | Actual Nurse UI200 lost reply, GET-only reconciliation, retained note, Cleared/actor/time; repeated API request409IMMUTABLE with stage/cleared_at |
| Verbal POST /prescriptions/verbal | Actual Telephone201 after PMDC picker/read-back, real lost reply and original-key replay one Rx6 |
| GET /verbal-orders | Actual pending/all filters, real Doctor countersign200 then server-signed state on manual refresh |
| GET /drugs/search and supporting staff/history/Rx | Actual returned rows/registrations, stock/safety and identity checks; no guessed identifier |
| Permissions | Accountant403 for all7write types and MAR/inventory/verbal/formulary reads |
| Refusals | Actual MAR_STATE_INVALID, PATIENT_IDENTITY_MISMATCH, DRUG_MISMATCH, PATIENT_IDENTITY_REQUIRED, DISCHARGE_STAGE_IMMUTABLE and read_back422 field validation |

Actual built request bodies pass validate_request. Final GET-only UI passed field/dialog F1 and focus, retained drafts across refresh, authored Ward FAQs, keyboard zoom minimum100/maximum250/clamp/reset100 and both languages/themes at250without document overflow. Screenshots are `public/handbook/{mar,verbal_orders_ward}-{en,ur}.png`. Actor preferences were restored and sessions signed out. Test harness mistakes/interrupted printer attempts were reconciled from original traces and server reads; completed writes were never rerun under new keys. Co-signer fields are redacted before trace persistence.

Scripts: `mar63-check.mjs`, `mar63-resume.mjs`, `mar63-clear-check.mjs`, `verbal64-check.mjs`, `ward6364-final-read.mjs`. Journals remain ignored in artifacts; curated evidence, validation, permission denials, exact refusal requests/results and issue receipts are in `docs/ward6364/`. Never blindly rerun a write journal or reuse these IDs after reinstall.

## Backend reports and acceptance limits

- **45 New:** MAR bundle omits the existing authorised history/prescription reads necessary to discover the first PRN line. Implemented using those documented APIs with identity checks.
- **46 New:** ExternalMarket inpatient oral/non-high-alert self-administration is refused, while equivalent HospitalPharmacy self-administration succeeds; destination restriction is undocumented. Server refusal retained.
- **47 New:** receiving Nurse cannot receive the advertised medication.order.updated event. Actual Doctor countersign20000cab7a0189e4ccaa8f9073ea45f4de3 did not refresh Nurse; the same live Nurse received medication.due357. Manual refresh reads signed state. No polling or extra permissions added.
- **48 New:** PRN error list omits actual PATIENT_IDENTITY_REQUIRED (e5d9d6b9c1994444b20f62860d37ff88).
- **49 New:** no authorised read-only prepared-dose label retrieval after session restart; a missing original label remains unavailable, without guessed content or re-preparation.

Older41–44 remain New. No whole-screen/workspace human acceptance or full test-plan claim. Shared service transitions, stocked/expired/recalled batch journeys, unidentified-emergency override, full co-signer failure matrix, true late countersignature, physical scanner/printer, full role journey, native Urdu and named editor/human review remain pending. Verbal event refresh is blocked by47; reprint-after-session recovery awaits49. Later ER verbal screen is separate. Prior vitals postoperative signed-plan limitation and PACS54 remain in earlier handoff/reviews.

The human should follow new app-created ward records through identity checks, actual outcomes and reasons, independent co-signature, PRN/current-order selection, labels and print cancellation, correction history, Nursing discharge clearance, then a verbal order to its Doctor countersignature. Review F1, Urdu/RTL, themes and zoom. Only the human signs acceptance on DEV /docs → My progress.
