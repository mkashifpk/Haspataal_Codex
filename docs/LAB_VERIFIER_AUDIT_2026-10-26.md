# Lab verifier follow-up audit

Baseline: Antigravity commit1cdd605, reviewed by Codex on26October2026. Its initial queue/inspection/normal decision/report implementation existed and the saved test journal finished. It was not a full acceptance gate. No human review was signed and no human Review code was used.

## Defects corrected

- Entry time was treated as the deadline, marking every entered result delayed. The queue provides no due_at; the screen now states that limitation, asks an optional delay reason without claiming lateness, and uses an actual matching known requisition's due_at when available. Times use the hospital time zone.
- Display names were compared as actor identity. They are not unique or stable. Only an actual performer stamp user ID may establish client-side identity; the server remains authoritative for LAB_VERIFIER_MUST_DIFFER.
- Verify/reject lacked fresh actor/service/permission/exact result snapshot preflight. Concurrent changed or removed rows now refuse before POST.
- Unknown state-guard outcomes had no recovery read and the modal could be closed or submitted again. The decision now stays locked across Escape/navigation and reads the exact known requisition or current queue. An absent row never proves publication; it directs staff to the actual requisition/status/stamp. No decision replay is offered.
- Failed/loading queue, detail and report reads could expose old content. Stale content now hides and report PDF remains disabled until a current successful read. Loading the same report ID now really refreshes it.
- Unknown service views fail closed, records mode hides pending work, and the verification queue requires its actual lab.result.verify permission. Known permitted record/report lookups remain available without a pending row.
- Unstyled summary labels and unrestricted tables now use shared responsive header/table patterns and scoped counters. Flags retain text and themed red/amber presentation.
- The older live test could overwrite its journal and select an unrelated first queue row. It now refuses completed replay/overwrite and filters only its owned item IDs. Do not rerun completed decisions.

## Fresh actual DEV checks

New owned runDEMO-VERIFY-SAFETY-1793024791999: patient13, requisition3, CBCresult5 and RBSresult6. Fixture intake/payment/sample/result writes were separately journaled before sending. These are software-only synthetic values, no specimens, care, physical medicine or money.

1. Independent concurrent rejection of own CBCresult5: the open publication confirmation refused its stale queue snapshot before any second POST.
2. Own RBSresult6 publication: duplicate click plus deliberately lost real200 reply produced one Published decision. Confirm/Cancel/Escape/navigation stayed locked, no replay button appeared, and the actual req3 read showed Published and the verifier stamp. Deliberate reviewed release submitted nothing.
3. Read-only continuation on the same terminal records tested report refresh failure, stale hiding, PDF disablement and recovery. No intake/payment/result/decision repeated. Results5Rejected/6Published; req3 remains partial because rejected CBC needs further bench work. All isolated test sessions signed out and preferences restored.
4. F1 from search and decision field preserved focus; actual English/Urdu handbook captures and both themes250% overflow checks passed. Native-speaking translation, fresh human journey, role FAQ review, physical devices and editor acceptance remain pending.

The safety checks ran on index-kKIqMmzX.js; report refresh recovery ran on index-DlH4VYge.js. Final scoped layout adjustments are in index-p8nDTcqn.js with a read-only capture/recheck. Earlier passing tests do not claim later untested actions. Local suite124/124passed; mandatory handbook/TypeScript/build passed. Existing bundle-size warning remains.

## Backend and evidence limits

Report29New: verification queue lacks deadline/author/requisition linkage and the verify endpoint has reconcile_with:null. Actual queue response reproduced on ownresult6. Payload verifier-context-gap-report-2026-10-26.json. Reports27/28 remain New; no duplicate report filed. Exact known requisition lookup is supported, while direct queue-to-context recovery awaits backend support.

Do not approve proposal160's untested claims solely from its earlier summary: its saved run did not exercise critical-value publication, a self-verification refusal, late-deadline behaviour or lost-decision recovery. New evidence supersedes the corrected safety/state/permission behaviours only. No full test-plan, critical event, human review or phase completion is claimed here.

## Manual test

As an authorised lab verifier, inspect a fresh synthetic result and its actual requisition, then verify or reject with the appropriate note. Confirm the actual deadline is used, optional delay reason is available, a changed queue item requires a new review, and the signed report has the correct performer/verifier. Test F1 in the confirmation and Urdu at250%. Only the human starts/signs portal review and types a Review code.
