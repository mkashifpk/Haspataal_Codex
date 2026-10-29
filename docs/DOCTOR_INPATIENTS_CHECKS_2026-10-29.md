# Doctor inpatient screen58: additional checks

Scope: finish the current screen's checks. No discharge-summary, Doctor-consent, death-record editor or screen59 was built. Baseline c7ce6e9; source implementation c4bc177. Backend last confirmed build 2026-10-28T21:29:45.848402+00:00, contract e90ba541e495d6487532, rubric 6b013592c628, implementation1.

## Changes

- `DoctorInpatients.tsx`: remount feedback when the frozen review closes so actual server field-validation hints attach to the editable form. The write hook and its replay protection remain outside that remount.
- Selecting the same admission explicitly now increments the read revision. Previously a second selection cleared the panel without changing the read dependencies. The failed reproduction and successful final-build read-only retest are retained.
- Refreshed bilingual handbook images with this session's populated synthetic records. Existing contextual F1, role FAQs and shared zoom remain implemented; no human translation/journey approval is claimed.
- Added guarded DEV runners for populated records, event audiences, document fixtures, concurrent refusal, repeated selection and final read-only review. They are evidence tools, not fixtures to replay after a reset. Runner defaults refuse an existing result journal.

## Verification

| Check | Result / evidence |
|---|---|
| Mandatory build/help/TypeScript | PASS; `artifacts/inpatients58-checks-final-build.log`, asset `index-DJUbSSN8.js`; existing chunk-size warning |
| Automated tests | 217/217 PASS; `artifacts/inpatients58-checks-final-tests.log` |
| Populated clinical records | PASS: actual original/corrected vitals and nursing notes, zero pain, author stamps, Held/Refused MAR correction; no administered medicine |
| Field-validation recovery | Original run FAILED; fixed rerun PASS: real422 `53c36d86d96949afa77129353aa4492a`, inline hint and aria-invalid, typed1001 retained |
| Missing consent | PASS: real409 `e50499a1a6b14039b68519813b25373c`, note retained, no replay, admission still Admitted at that checkpoint |
| F1, EN/UR, themes, 250% layout | PASS in populated fixed run, asset `index-Io8EfAra.js`; focus restored after F1; no horizontal overflow |
| Same-admission explicit reread | Original reproduction FAILED; final `index-DJUbSSN8.js` GET-only rerun PASS: GET200 `5a22648c7ab24d0bad46a985d4d961a1` then `19f38c9a927349cc9f99ebb5b302c651`; corrected notes visible |
| Permission gates | 9 actual denied endpoint cases all403; 14 clinician reads across Doctor2/Surgeon all200. Accountant screen absent, native read locally PERMISSION_REQUIRED with no transport or patient exposure |
| Overflow event | PASS: Doctor and Nurse received real event241, selected Doctor panel refreshed to Admitted with actual follow-up reads |
| Due-vitals event | BLOCKED by backend43: Nurse received243, Doctor did not despite receiving241; no fake alert/polling workaround |
| Concurrent discharge | Server results verified: second terminal200 `ce17d8453051488b8decfafcdc5db140`, primary409 `f0406c0012ee4b9fb5498d2746bcc2a5`, one POST each. UI assertion timed out during delayed recovery reads; full UI race PASS is NOT claimed |
| Final broader read-only review | BLOCKED at bootstrap: sign-in TERMINAL_ERROR / server connection timed out, before screen checks. Original result retained; do not represent it as PASS. Actor confirmed signed out |

Compact portable evidence is in `docs/inpatients58-checks/{ui-evidence,event-evidence,permission-denials,clinician-read-matrix,reread-evidence,cleanup-evidence}.json`. Full local journals are in ignored `artifacts/`; failed runs remain intact. New successful fixture request bodies were validated before their writes and intent/results were saved. The deliberately oversized negative UI note is expected to fail validation, not a normal app payload. Source/checks committed as `2a7b234`.

## Backend and remaining gates

New report **43**, confirmed receipt in `docs/inpatients58-checks/vitals-audience-issue-receipt.json`, is New at the final confirmed read, as are41/42; see `backend-status.json`. Doctor's `ipd.flowsheet.view` does not satisfy `vitals.due` audience `ipd.flowsheet.record`. An intermediate status read stalled/cancelled; subsequent reads succeeded. Proposal **199** for ONLY `ev:admission.overflow_assigned` and `q:permissions` was confirmed and verified with `progress_proposals`, pending human review on /docs -> My progress. No unchanged197/198 items resubmitted. Exact payload, receipt and verification saved alongside the evidence; no human reviews recorded.

When MCP responded again, one broader final GET-only retry was attempted with a new journal. It also failed at bootstrap, before screen entry; `final-read-blocker.json` records the actual startup text. All13 terminal actors, including that retry, were confirmed cleaned/restored/signed out. No business action was retried. The earlier passed populated bilingual/layout/F1 checks and final-build same-reference check remain valid within their stated limits.

Full `q:tested` remains unclaimed. Backend43, concurrent refusal UI completion, final broader regression after connection recovers, runtime shared-service transitions, named fresh-data journey/native Urdu review and physical-device checks remain pending. No Review code entered, human review signed or proposal self-approved. Successful PACS linking remains the earlier DEV limitation54.

## Fresh synthetic state / no replay

Scenario b6c881: patient9/MRN-2026-000009, ticket8, admission10; own ward10, beds40 D58C-A/41 D58C-B. Admission10 is now DischargeInProgress, ClinicalDischarge cleared by Dr Ahmed, PharmacyClearance pending. No downstream clearance or physical cleaning was fabricated. Invoice11 Draft/zero; summary2 Final and consent4 Given are upstream software fixtures, not delivered editor workflows. Photo3/outside PDF4. Vitals1/2 and nursing notes1/2 are original/corrections; ExternalMarket prescription1 is explicitly NON-MEDICINE, MAR1 Held/MAR2 Refused; no stock, dose or payment. Original240-minute vitals interval restored via200 `5be831f247f74d06b598f6b6d8d39dec`.

All fixture IDs were obtained from fresh responses. Never replay the create/sign/discharge scripts or saved keys to obtain missing evidence. If a result is uncertain, inspect its journal and read the server first. Credentials/configuration stay in ignored local files.

Manual follow-up: after connectivity and43 recover, create a new synthetic admission through the app, review populated clinical history and corrections, optional photo/outside reports, F1 from fields/review, Urdu/RTL/250% layout, retained notes on a concurrent refusal, estimate return and clearance/bed lock. The human alone completes the portal review.
