# Order Queries — Phase 3 screen 3

Codex, 25 October 2026. This is implementation and agent DEV evidence, **not a signed human review or full Pharmacy acceptance**. Source/build and final proposal IDs are recorded in root `handoff.md`.

## Delivered

- Pharmacy Order queries: server-ordered query register, applied status/prescription/mine/limit filters, local find, explicit bounded-result warning, known-prescription lookup and fresh patient/MRN/visit/order/stamp context.
- Dispense → Query line or Query whole prescription transfers the exact prescription and target. The selected order/question form precedes the register, so unrelated questions do not obstruct the handoff. Unsaved drafts and pending outcomes retain their guards.
- Explicit target, all nine server reason values, bounded question, reviewed submission, exact-target duplicate prevention and visible backend refusals. Query creation notifies the Doctor and holds affected lines through the existing server/Dispense rules.
- Open, Answered and Withdrawn history; actual signed ConfirmedAsWritten/Changed responses and original withdrawal explanation/time. Changed tells staff to review the stopped line and replacement; it never resumes the old line. Doctor **answer authoring** belongs to the separate medication-order Doctor screen, outside this screen's four-endpoint bundle.
- Reviewed withdrawal with a required explanation, fresh actor/permissions/service/order/query state checks and a single retained original UUID/body. Unknown outcomes lock context; read reconciliation or same-request retry remains inside the dialog. No offline writes, local success, replacement query after an unknown outcome, medicine supply or payment.
- Real medication.order.updated refreshes the register and matching selected prescription; actual Live/resync rereads both. Independent read errors hide stale records. Permission and establishment views govern access; no facility-category branch.
- Contextual F1, bilingual authored page/control/task/FAQ/Pharmacy guidance, shared native keyboard/Settings zoom and actual EN/UR handbook screenshots. Urdu and full role journeys remain drafts for named human review.

## Evidence

`npm run build`: full handbook coverage (33 screens, 605 controls, 206 groups, 33 FAQ seeds, 30 workspace guides), TypeScript and DEV Vite bundle passed. `npm test`: 90/90 passed, including meaningful target/duplicate/concurrency/service safety tests and a negative check refusing an unmapped OrderQueries confirmation control.

`scripts/order-queries-check.mjs` used a NEW own synthetic RX7, line query2, whole query3 and line query4. Real UI lost201/double-click/original-key replay produced one query; duplicate was refused locally and by the backend. Query3 withdrawal lost200 then identical-key/body replay retained one withdrawal. Doctor ConfirmedAsWritten arrived live with its stamp. Premature Changed returned409/PRESCRIPTION_QUERY_STATE_INVALID; stopping original line7 and writing replacement RX8 allowed the real signed Changed response. Stale withdrawal preflight refused before any POST. Real notifications89/91 reached the Doctor. Cashier received actual403 for all four screen endpoints (separate server evidence JSON).

The write harness needed corrections for its old literal Doctor name, variable scope, browser-confirm acceptance and a list-URL predicate that omitted query parameters. Those were harness failures; confirmed actions were read/reconciled by their original keys/IDs, never recreated. `scripts/order-queries-final-check.mjs` independently rereads the exact records on the final build, exercises filters/errors/reconnect/help/zoom/handoffs/role refusals and ends only the owned zero-supply test orders. Its final result is in `docs/order-queries-evidence-2026-10-25.json`; ignored journals retain original write identities and transport receipts. Do not rerun a business-data script while its journal is unfinished.

## Manual check

1. Use a fresh **software-only** prescription created for this review. As Pharmacist, open Pharmacy → Prescription queue → Dispense. Verify patient/MRN/prescription before choosing Query line. Confirm the exact target transfers.
2. Try a blank reason/question, then choose a reason and enter a factual test question. F1 from the field and confirmation must show Order queries guidance, preserve the draft and return focus. Confirm once.
3. Verify Open history, the Doctor notification and the affected Dispense quantity being unavailable. A second question on the same target must refuse. Test the whole-prescription handoff separately.
4. Withdraw a mistaken Open query with a reason. Verify the reason/time and status. The server remains the authority; do not supply a medicine to prove a test passed.
5. When the prescriber answers through their authorized workflow, verify the signed response arrives live. For Changed, verify the stopped original and actual replacement rather than using the old line. This change does not add Doctor answer-entry controls.
6. Check status/mine/prescription/limit filters and local search. Mine means **orders prescribed by the caller**, not questions raised by this Pharmacist. Check English/Urdu, Light/high-contrast, F1 and Settings/native keyboard zoom at100/250/reset.
7. Record the named review and translation/editor outcomes in the human portal worksheet. Only the human enters a Review code and signs/accepts claims.

## Limits and backend status

No real care, medicine supply or payment. No shared service lifecycle was mutated; full/open_work versus records/setup/hidden policy boundaries are unit tested, while the actual DEV flow used Active/full. No physical printer, comprehensive role journey, named translation/editor review, signed fresh-data review, complete test-plan or whole-workspace claim. Query creation/withdrawal do not have a print contract in this bundle.

Issues20–23 remain New without backend answers at the closing read: transport uncertainty20, Doctor scoped PatientSearch21, partial PharmacyAdmin scope/detail22 and Pharmacist discharge-stage read23. No new backend defect was reproduced for the tested full-Pharmacist OrderQueries flow. Existing limitations remain visible; no duplicate backend reports or invented workarounds.
