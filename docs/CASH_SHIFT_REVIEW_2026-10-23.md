# My cash shift — Phase 2 screen 1

2026-10-23, Codex; implementation 1 / mkashif. Scope is only `my_cash_shift` (P2 position12). Main baseline467f416 plus preserved earlier uncommitted work. Full screen acceptance remains pending.

## Staff task and implementation

Reception/counter staff open their mapped drawer before handling cash, inspect their own shift/ledger, and record counted cash for the accountant to verify. The existing shared components and English/Urdu help are retained; H09 design ownership and native Urdu/editor approval remain human decisions.

- Real mapped counter, opening float, own shift, ledger, separate cash/non-cash totals, counted-cash confirmation and accountant handover state were already partly implemented. Accepted proposal28 covers the earlier reads/help/zoom; those unchanged items are not submitted again.
- Closure now freezes the reviewed shift ID, counter, expected cash and declared amount. A refresh cannot silently substitute a different drawer or changed totals; changed context blocks confirmation and asks staff to return, refresh and review. A focused unit test exercises changed identity/counter/totals/status and missing records. Open recovery also checks the original counter.
- Corrected wording: closure records counted cash for verification; it does not itself verify or record physical collection. Authored EN/UR screen/control help describes the retained confirmation and changed-context recovery.
- Fixed a frontend contract matcher defect discovered by the real empty-state test. The generic recovery route `/finance/cash-shifts/{shift_id}` previously shadowed literal `/finance/cash-shifts/mine`, falsely rejecting valid `data:null`. Exact literal endpoints now take precedence; actual saved-contract tests prove nullable mine and non-null detail stay distinct. This is a frontend defect, not a backend issue.

## Exact verification

`npm run build` PASS, including mandatory handbook/media check (15screens/186controls/71groups/33FAQ seeds/30workspace guides), TypeScript and Vite. Existing bundle-size warning remains. `npm test`:47 PASS.

Real DEV Electron `node scripts/cash-shift-workflow-check.mjs`:4 PASS, runDEMO-CASH-SHIFT-1792698370999, renderer`index-Cm1URDX5.js`. Exact source/native/report/build hashes: `docs/cash-shift-build-2026-10-23.json`.

1. Real zero-float opening: rapid double-click sends one initial POST. Real server201 reply is deliberately dropped after commit. Explicit retry uses identical frozen original key/body; real201 Idempotent-Replay:true returns the same shift.
2. Counted zero/F1 preserves draft and focus; cancelling close confirmation leaves the actual shift Open.
3. Actual open-shift/empty ledger and collection states; EN/UR screenshots and both Light/DarkHighContrast at250% have no horizontal overflow. Public handbook screenshots refreshed from the real UI. This is no substitute for human translation/design acceptance.
4. Actual zero-count closure200 deliberately loses its reply. Exactly one close POST; check reads the original shift3, observes PendingCollection/declared0/expected0/cash_drop:null, then explicitly clears the reviewed hold. No automatic/non-idempotent closure replay or accountant verification. Returning to current shift shows no open drawer.

MCP demo.owner GET mine, POST open and POST close are all403 FORBIDDEN (finance.shift.operate required); no state change. Current full permission/role matrix is not claimed.

The laptop has no mapped cash_node. The production UI correctly refuses opening there. Testing used a separately API-registered synthetic terminal3 with a locally administered MAC, supplied by the test harness as emulated hardware identity; real server responses and records were used. No production-code shortcut, fabricated backend response, modification to the laptop's actual mapping, TLS/authentication bypass or local configuration change. Physical terminal acceptance remains pending.

## Records, cleanup and limits

User34 / employee36 was verified as the existing owned inactive DEMO fixture before activation. Shift3 remains an auditable zero-value PendingCollection record; opening_float0, expected_cash0, declared_cash0, no transactions and no cash_drop. No payment, registration, patient, approval decision or physical cash handover. Synthetic terminals2 (earlier harness failure) and3 are inactive; user34 inactive; preferences restored; all journal writes confirmed. Original keys and outcomes stay in ignored `artifacts/cash-shift-workflow-passed-20261023.json` / `cash-shift-native-passed-20261023.json` without credentials.

Earlier attempts stopped before cash writes: route matcher defect, missing real laptop mapping, then a harness Electron callback-argument error. Each account/mapping cleanup was confirmed before the successful run. Never treat their missing results as permission to repeat unknown writes.

Backend10/11/12 still New on session read2026-10-22T19:37:04Z; no new backend defect reproduced. Serverbuild2026-10-22T03:00:52.677157+00:00; contract61186bb3306515cae1c9, knowledgerevisioneb7204298b390985, rubricd81d43f195f8, UIstandard3f27760c7bc06e2d. Current bundle/open/close/request validations saved in `contracts/cash-shift-refresh-2026-10-23.json`; MCP-generated TypeScript inspected, request/response shapes remain compatible.

Not claimed: whole-screen test-plan/permissions/safe-write matrix, nonzero money/collections, all cash-consuming workflows/counters, real hardware mapping/drawer, accountant verification, named human fresh-data worksheet, complete reviewed role FAQs, native Urdu/design/editor acceptance. Only newly exercised open/close endpoints and counted-cash-to-accountant rule are proposed. No other Phase2 screen was built in this task.

Final shared regression: npm run test:foundation PASS14 on the unchanged renderer/native source. Real health/avatar/native zoom bounds/reset/shared windows/persistence, draft/F1/UNSENT Facility recovery, hospital timezone and scoped/offline bilingual help passed. Preferences restored; no financial/clinical business writes. Immutable result artifacts/cash-shift-foundation-passed-20261023.json, supplemental hash docs/cash-shift-foundation-2026-10-23.json. All submitted source/build/report hashes reverified after regression.

Proposal **57**, request_id codex-cashshift-openclose-20261023-v2, saved and verified via progress_proposals: **awaiting human review on /docs -> My progress**. Items: POST open, POST close, rule:a38ea1222b. Exact payload docs/codex-cashshift-openclose-20261023-v2.json. v1 never saved because input build exceeded200characters; retain its failed payload for history, never retry it. No approval/points granted by agent. Prior54–56 are now accepted;481 accepted points/0 complete screens at session read. No commands or uncertain writes remain. Changes uncommitted; baseline and prior user/agent work preserved.
