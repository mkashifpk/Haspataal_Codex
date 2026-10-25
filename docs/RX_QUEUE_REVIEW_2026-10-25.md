# Phase3 screen1 — Prescription queue

At the Pharmacy Counter a pharmacist identifies the next hospital prescription and reviews the current patient, directions and safety conditions before the separate dispensing workflow. This first screen reads only: no medicine supply, payment, batch selection, query mutation or printing action is offered. Dispense is the next requested screen, not implemented by this step.

Implementation: src/screens/PrescriptionQueue.tsx; generated src/generated/rx_queue.ts; current saved contract and schemas; src/prescription-queue-policy.ts. App navigation/notification routes require active scoped handbook, permissions and establishment views. The same build supports full/open_work/records; setup/hidden/unknown views expose no work menu. Records suppress the pending queue and allow permitted known-ID lookup. No facility-category branch exists.

The server's CodeRed-first/chronological response order is retained. Rows show exact identity, time in hospital timezone, source/status/order mode/open lines/high-alert/open-query counts. Detail shows original prescriber stamp, read-back/countersignature, visit links, each line's prescribed/dispensed/remaining server quantities, stock, directions, high-alert/look-alike/restricted warnings and real query history. Pending/failed reads hide cached rows/details; a different patient is never selected by an event. Read-only refresh/search/lookup/close and live/Reconnecting messages are explicit.

GET /prescriptions/pending and GET /prescriptions/{prescription_id} are separate permission checks. pharmacy.prescription.pending refreshes the queue; medication.order.updated refreshes the queue and matching selected prescription; actual replay/resync refreshes both. No queue polling.

Bilingual help, detailed screen FAQs, mapped controls/tasks and Pharmacy role journey were updated in src/help.ts, src/foundation-help.ts and catalogue/task maps. Real synthetic EN/UR screenshots are bundled in public/handbook/rx_queue-*.png. Shared F1/Settings/native keyboard zoom is reused. Urdu and full role/workspace review remain pending. Existing app components/themes and motion defaults were retained; shared design-system ownership and named editor acceptance remain outstanding.

Requirements read: current full bundle including omitted schemas, endpoint contracts and generated TypeScript, screen/workspace quality, design principles, handbook brief/Pharmacy outline, clinical-and-prescriptions workflow/recipe and screen_test_plan. Contracta48efc9c8254ac5137e2, knowledge5d997abd8847f89d, rubrica400860f309d, serverbuild2026-10-24T21:23:38.916290+00:00; implementation1/mkashif.

## Verification

- `npm run build` PASS:31screens/565controls/187groups/33FAQseeds/30workspace guides, TypeScript/Vite; DEV DqAhRua8. Existing bundle-size warning remains.
- `npm test` **81PASS**, including independent read permissions and service-mode boundaries. The legitimate coverage count changed from30 to31; negative coverage checks remain enabled.
- `node scripts/rx-queue-check.mjs` plus guarded continuation produced actual synthetic RX1/RX-2026-000001 and RX3/RX-2026-000002 on verified own software-only patient5/ticket5. Original keys/bodies/refusals/receipts are in ignored artifacts/rx-queue-check.json. Queue started empty. A fresh Doctor POST generated an actual pharmacy.prescription.pending and UI arrival. A real query1 generated medication.order.updated and refreshed list badge plus matching detail. Real high-alert count/chronological order, local filter/no-match/clear, idle-no-poll, lost-GET stale hiding/independent retry, ID validation/lookup/close, F1 focus and real bilingual/both-theme250 layouts passed.
- Original fixture mistakes were kept: missing visit422, invalid CodeRed without admission422, Telephone OPD refused422 after a zero-HTTP native refusal was reconciled with MCP using its exact original key/body. No prescription was fabricated from a refusal. CodeRed and Verbal/Telephone UI branches are implemented but NOT live-tested; no full badge-rule claim.
- Own query1 withdrawn; both exact own RX cancelled, each with zero dispensations. No actual care, medicines, payment or physical handover. Original broad script stopped at its final test expectation of FORBIDDEN, whereas native correctly returns PERMISSION_REQUIRED before HTTP. It was corrected, not treated as a runtime defect. `node scripts/rx-queue-final-check.mjs` then PASS on those exact cancelled records without recreating them: final empty/current details, actual WebSocket terminate/Reconnecting/Live resync and queue/detail reread, actual Electron Ctrl+= upper bound250/repeat, Ctrl0 reset100/lower bound, scoped Doctor menu absence and zero-HTTP denial. All profiles restored/signedout. Combined transparent evidence: rx-queue-evidence-2026-10-25.json.
- MCP screen_test_plan reads: Pharmacist pending/detail200 on real fresh records; PharmacyAdmin queue200/detail403; Cashier pending403. Full/Active DEV view and policy unit matrices tested. Shared dispensing lifecycle was not changed to test other runtime modes; no full-plan/q:tested claim.

## Backend and acceptance limits

Issue **22 New**: PharmacyAdmin partial queue access has no scoped handbook/menu entry. Report payload rx-queue-partial-role-scope-issue-2026-10-25.json; related existing21 concerns another role/screen. Full Pharmacist scope works. Do not bypass scoped help or grant detail permissions. Existing20/21 remain open.

No CodeRed admission or inpatient/ER telephone fixture was created just for this step; no full badge/lifecycle matrix claim. No release installer or new release build shipped. No agent entered a Review code or signed human acceptance. The screen is ready for Pharmacist manual testing, with these acceptance limits recorded; the Pharmacy workspace and Phase3 are not complete.

## Manual test

1. Restart DEV, sign in as demo.pharmacist and open Pharmacy Counter → Prescription queue. The agent's fixtures were cancelled, so an empty pending list is expected unless other test orders exist.
2. As the doctor, create a new synthetic valid prescription through E-prescription builder with destination Hospital pharmacy, then return to the pharmacist window. It should arrive live. External-market orders should not appear.
3. Match name/MRN/RX, use Find in this queue and Review prescription. Verify directions, remaining quantity/stock, safety flags and prescriber stamp. Refresh should read only; F1 from the ID field should restore focus. Try English/Urdu, both themes and shared zoom100–250.
4. To inspect this run's cancelled software records, use Existing prescription ID1 or3. Do not dispense them. Use a new synthetic prescription for an active-row test.
5. Record human results on the portal when ready. Dispensing/payment/labels and query-writing UI are subsequent screens.
