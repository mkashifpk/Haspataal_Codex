# Phase 3 remaining verification — 27 October 2026

Phase3 catalogue positions31–48 already have implemented screens. This checkpoint closes the deferred positive Pharmacy cash and discharge-status checks on the deployed backend. It does not certify Phase3 acceptance: the signed workspace reviews, physical printer/translation/editor checks, full service/refusal matrices and positive configured PACS integration are still pending.

## Verified now

Server build2026-10-27T06:11:24.313207+00:00; contract8ad8456c41b87dd0031e; rubricf18448c114ef. Current overview/progress/proposals/issues/connecting guide/roadmap and Dispense, OTC and cash-shift contracts/quality/design/test plans read. Generated discharge-status type matches the existing generated file (only final whitespace differed). No app implementation change was needed for the tested backend fixes.

- Issue23: pharmacist GET discharge-status200 returns identity and not-started empty stages; full admission remains403; unknown admission404; cashier status403. Actual UI shows patient/MRN/admission, disables clearance until the returned-medicine acknowledgement, checks the next stage and reads own medicines.
- Actual UI PharmacyClearance200 intentionally lost after the server committed. Exactly ONE original POST, no retry button/automatic replay. Read current result obtains the exact admission's cleared stage, officer and time even after blocked_on advances to NursingMARVerification. Returning from review refreshes the screen and keeps the completed action disabled. Contextual F1 preserves the acknowledgement. EN/Urdu high-contrast250% layouts pass.
- Fresh RX2 on previously verified owned synthetic ticket1/patient3: Cash partial1 then remainder1, separate intentional UI requests, server FEFO/billing/remaining state, D1/D2, FullyDispensed. Own PharmacyCounter drawer1 starts1500 and ends1506.
- Separate actual synthetic terminal2 mapped PharmacyCounter; test transport emulates only that owned hardware MAC, with real server answers and writes. Existing terminal mapping was never edited. Through My cash shift UI: close drawer1 declaring the whole1506, variance0; open drawer2 with1500, server expected_cash1500 and Opening float ledger/totals; OTC Cash D3 and Card D4 each201. Cash raises server drawer amount to1503; Card is non-cash and leaves it1503. Close drawer2 declaring1503, server variance0, mine null. Pharmacy-scoped F1 passes.
- Both drawers are PendingCollection, not vault-verified; no real cash exists. Synthetic terminal2 deactivated200 after exact actual-list MAC/name verification. Profiles restore preferences and sign out.

Evidence: phase3-pharmacy-evidence-2026-10-27.json. Scripts: phase3-clearance-check.mjs, phase3-pharmacy-cash-check.mjs and guarded mapped continuation phase3-pharmacy-mapped-check.mjs. Original requests/results and failed test journals remain ignored under artifacts/phase3-*. Never rerun completed business journals.

## Test corrections, not product defects

The first cash test correctly found OTC Cash disabled on the reception-mapped laptop; zero OTC POST. Mapped continuation v1 expected a terminal_id field that whoami does not return; corrected to actual registered/MAC/node fields, before writes. V2 read the drawer before asynchronous UI closure completed; actual close200 was independently reconciled before v3, never repeated. V3 passed and closed the new drawer. The source script now waits for the actual close transition. These are recorded limits, not backend defect reports.

A patient-only OPD prescription fixture was refused422 (requires ticket/admission); no record was created. The successful fresh RX2 uses the verified owned synthetic ticket. No mock, guessed clinical ID, local success, patient consent, stock handover, money movement outside DEV, paper print or human review is claimed.

## Backend / acceptance

- #23 Fixed and positive UI recovery retested. A harmless documentation discrepancy is reported separately as #33 New/Low: a repeated completed Pharmacy clearance returns409 DISCHARGE_STAGE_OUT_OF_ORDER instead of the issue23 answer's DISCHARGE_STAGE_IMMUTABLE. Both refuse the repeat; UI prevents it. Exact request30bc84c1a48f4d48b44d7960b0d52a9f. Report payload/confirmed receipt are saved.
- #31 New/no answer: optional PACS disabled; positive real-study link/viewer/linked completion needs a real synthetic Orthanc fixture or a human/backend N/A decision. Never fabricate study IDs or replay the old auto-link.
- #30 New/no answer; original report overstated employee/doctor distinction, corrected in the Radiology frontend tracker. Doctor ID is the documented employee ID. #32 New/Low documentation, not a product blocker.
- Lab fixes27–29 already tested in prior evidence; proposals169–175 accepted. Diagnostic services proposal166 remains awaiting human review on /docs -> My progress.133/109 belong to earlier phases. No signed human reviews returned; shared review in progress is left alone.
- Full screen_test_plan, shared service retirement/recall transitions, held-own-medicine return/destruction, physical printers, clinical role/Urdu/editor/busy-hour acceptance are NOT claimed by this focused run. Earlier screen reviews retain their specific limits. No empty/full-plan claim or duplicate accepted item will be submitted.

## Checks and human next steps

npm test166/166 PASS and mandatory npm run build PASS on27October; existing bundle warning only, unchanged renderer index-CdA5t8jf.js. Syntax and diff checks are recorded in the final handoff. Existing authored bilingual help remains covered by the build.

1. Start the Pharmacy workspace review on the DEV portal yourself; only you enter its Review code in Settings -> This terminal. Create NEW synthetic upstream records through the app.
2. On a workstation actually mapped to PharmacyCounter, open your own drawer with a nonzero float, dispense partially then the remainder, make OTC Cash and Card sales, inspect server cash/non-cash amounts, count the whole drawer including the float and close. Card remains usable where no Pharmacy drawer is available.
3. On a new synthetic discharge, verify identity/returned own medicines, clear Pharmacy once, and inspect the recorded officer/time and next Nursing handover. Existing test admission1 is read-only evidence, not a new review record.
4. Test receipt/label printers, F1 from fields/dialogs, role FAQs, Urdu and100–250% native/Settings zoom, then sign the portal review and return failures.
5. Review diagnostic-services proposal166. Resolve the PACS fixture/N/A decision for31 and remaining role/editor/refusal matrices before calling Phase3 fully accepted. Phase4 has not started.

Own fresh patient4/MRN000004 DEMO-PHASE3-FINISH-20261027, admission1 remains DischargeInProgress blocked NursingMARVerification as an explicit synthetic handover fixture; bed1 remains locked. RX1's unused line stopped once, no dispensation. Do not invent Nursing/Billing/Ops cleaning completion. RX2 is terminal FullyDispensed; drawers1/2 closed. See original keys/journals before any continuation.
