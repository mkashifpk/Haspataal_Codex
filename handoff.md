# Haspataal checkpoint — 25 October 2026

Codex/functions, Asia/Karachi. Last update after final DEV verification; source commit and proposal IDs to be appended after the next steps below.

## Current task and status

User requested Phase3 screen3 Order Queries, one screen at a time. Implementation and agent DEV checks complete. No Phase3/full Pharmacy/human completion claim. Baseline711a24b was clean. All current changes are this task; no unexplained/user changes discarded. Tested final DEV bundle index-Dng-PLU2.js; source commit pending. No running command, uncertain backend write or active test account. Next: commit, submit changed tested screen claims and verify saved proposals, then record exact IDs/commit here before final response.

## Delivered/files

- src/screens/OrderQueries.tsx, src/order-query-policy.ts, src/generated/order_queries.ts, contracts/order_queries.json: real register/status/mine/RX/limit/local filters, bounded-result warning, fresh exact patient/order/stamp lookup, line/whole target +9server reasons +bounded question, reviewed raise/withdraw, duplicate refusal, signed Doctor answers/history, and original UUID/body recovery. Fresh actor/service/order/query checks block stale reviews; actual medication.order.updated +Live/resync refresh list/matching detail. Permission and establishment views, no profile branch or mocks/offline writes.
- App +Dispense line/whole exact-ID handoffs and return, guards preserved. Order/question context comes before register. Doctor answer authoring belongs to the separate medication-order screen; this bundle lists/raises/withdraws/reads, never invents Doctor authoring UI.
- Authored bilingual page/control/task/FAQ/Pharmacy help, generated inventory/maps, actual public/handbook/order_queries-en/ur.png. Source/help coverage negative test and query policy tests. scripts/order-queries-check.mjs +order-queries-final-check.mjs; docs/ORDER_QUERIES_REVIEW_2026-10-25.md and two JSON evidence files. Full development history archived in docs/HANDOFF_ORDER_QUERIES_DEVELOPMENT_2026-10-25.md; previous Dispense archive retained.

## Verification

- Mandatory npm run build PASS after final screenshots:33screens605controls206groups33FAQseeds30workspaceguides, TS/Vite. npm test90/90PASS on final layout/source; git diff --check PASS. Existing large-bundle warning only. No release/installer/physical/human review claimed.
- NEW own RX7/query2 UI lost201/double-click one flight/exact UUID+body replay/one effect; exact-target duplicate locally and backend refused. Line/whole Dispense handoff and F1 field/dialog draft/focus PASS. Doctor ConfirmedAsWritten actual signed answer arrives live; notifications89/91 verified for line/whole.
- Whole query3 withdrawal explanation required; lost200/exact-key replay/one effect. Query4 premature Changed409/PRESCRIPTION_QUERY_STATE_INVALID; Doctor stop line7 +actual new replacement RX8 then Changed200; live signed answer +stopped detail. Stale withdrawal preflight refused before POST.
- Final independent check PASS filters/mine semantics/limit/no-match, real lost list +new-ID detail/hide stale/retry, actual native socket Reconnecting/Live resync with BOTH rereads/no idle polling, actual keyboard100–250/reset sharedprefs, ENUR both themes250/no overflow +visually inspected actual100screenshots. Final Dispense ConfirmedAsWritten line enabled/Changed stopped line disabled, new Query button F1, queue opens. Cashier missing nav/native PERMISSION_REQUIRED and separate server403 all4endpoints. Pharmacist final run no business writes. All3final profiles preferences-restored/signedout.
- Original write harness stopped on test-only literal Doctor name, scope/browser-confirm handling; final read harness first forgot URL query parameters in predicate. Corrected, confirmed original actions reconciled and reused, no writes recreated. Final pass docs explain limits. Original journal marked cleaned via final reference; its original failed harness result remains truthful. No full q:tested, shared service transition, complete role/native Urdu/editor/physical/signed human acceptance claim.

## Confirmed own synthetic records — never repeat

- Patient5/ticket5 owned SOFTWARE-only/no actual care context, verified before creation. RX7/RX-2026-000006 createf7b5f1b2-8742-46b2-98e9-3b272f4d5226, line6Paracetamol/line7Amoxicillin. Query2Answered/ConfirmedAsWritten, query3Withdrawn, query4Answered/Changed. Doctor stopped line7 and wrote own replacement RX8/RX-2026-000007. Both RX7/RX8 independently read Cancelled after final owned cleanup; ZERO dispensations/payments. No query remains Open.
- Final cancellation originalkeys RX7 0425eb44-23a2-4a1c-85e0-02a1d54551b5, RX8 6ef00611-6d4a-4bd2-9ec4-a5ea117a0ce3; confirmed receipts in artifacts/order-queries-final-check.json. Full keys/bodies/receipts in ignored artifacts/order-queries-check.json, per-role transport journals and MCP fixture receipts. Do not rerun unfinished business-data tests or use a replacement action after an unknown result.
- Prior RX1/RX3Cancelled/query1Withdrawn; RX4/5/6FullyDispensed (4/6remainderStopped) with virtual D1/D2Card/D3IPDBill retained, own admission1Cancelled. NO physical supply/money. Never repeat their supplies/cleanup. Previous Phase2 synthetic history is in the development/Dispense archives, not fresh IDs to reuse blindly.

## Backend/MCP and environment

DEV https://hms-dev.netbird.cloud; build2026-10-24T21:23:38.916290+00:00, contracta48efc9c8254ac5137e2, knowledge5d997abd8847f89d, rubrica400860f309d; implementation1/mkashif. Startup overview/roadmap/progress/proposals/issues/guide; full OrderQueries bundle/schemas/endpoint contracts/types/validate_request/quality/design/Pharmacy outline/recipe/testplan read.

Closing25Oct reports20–23stillNew/no answers; no new backend defect reproduced in full Pharmacist OrderQueries, so no duplicate report.20intermittent MCP Transport closed after committed writes: reconcile first.21Doctor PatientSearch scope.22partial PharmacyAdmin queue200/detail403 and missing scoped handbook route; do not override metadata.23Pharmacist clearance permission but admission/status403: leave clearance visibly blocked until backend minimum read/status access deployed. Retest Fixed only after serverbuild>=fixed_in. Older1–19Fixed except rejected frontend4; #19 whole drawer server expected_cash/declared_variance, never subtract float.

Terminal4 DEV Reception laptop(Codex) Active/MainReception intentionally retained for user, not disposable; never recreate/deactivate. Oldtestusers34/35+terminals2/3inactive/drawersclosed. Home/preventive Active revision9 by user authorization; don't mutate shared profiles/services for coverage. Ignored .dev-terminal.json/CA/MCP configuration supplies authorized setup; never track keys/passwords/Review codes/privateCA. Agent never entered a Review code or touched the human shared review. Prior145–147 accepted selected items only (F1 excluded; no signed reviews),109CashShift/133Settings remain pending; never resubmit unchanged work.

## Next3 steps

1. Commit tested OrderQueries +changed Dispense handoff, submit only new tested current-rubric items with the commit; verify progress_proposals and append exact IDs here. Human must accept on /docs -> My progress.
2. User manually test fresh own software RX →Dispense Query line/whole →required fields/duplicate/notification/withdrawal/live answer, F1/ENUR/zoom. See docs/ORDER_QUERIES_REVIEW_2026-10-25.md. Named role/translation/editor/portal worksheet/signature remains pending; Doctor answer-entry UI is not added by this screen.
3. After requested review choose the next Phase3 dependency from fresh MCP roadmap/bundle; do not start another screen now. Await20–23 backend answers, refresh affected contracts and retest when deployed. Keep handoff current before any implementation or long command.
