# Queue management: manual review checkpoint

2026-10-23 Codex/implementation1, developer mkashif. Next single Phase2 screen, roadmap15. Current implementation checkpoint ready for manual testing; full MCP acceptance remains pending. main467f416 with all earlier/user changes uncommitted and preserved; no new branch/commit/reset. No subsequent screen started.

## Implementation

Reception follows live doctor/department queues, opens the exact slip, and defers or reactivates permitted valid tickets without issuing another slip or collecting again. Existing actual dashboard/detail/history, unpaid cancellation, expiry/service/permission gates and shared unknown-write recovery remain.

QueueManagement.tsx now builds unique doctor options from actual dashboard and selected-ticket identifiers, retaining the selected doctor if its queue empties. Reviews capture original ticket id/row_version/token; a second session's change blocks confirmation and requires closing/reviewing current status. Closing a typed reason asks before discard. foundation-help.ts and i18n.ts describe this in English/Urdu. Actual handbook images were refreshed. Shared TicketDesk/write-attempt behavior is reused: deferral is state guarded and never replayed; reactivation retries only with the retained original key/body within24hours. Reads refresh from events/reconnect; the30second local display clock does not poll the backend.

MCP session overview/progress/proposals/connecting guide/issues, roadmap/full bundle/quality/design, reception handbook, by-doctor/defer/reactivate contracts, generated types, workflow recipe and actual defer request validation read. Current bundle contracts/queue-step-refresh-2026-10-23.json. Server build2026-10-23T01:28:16.037092+00:00, contract57d137222f1ca637655d, rubricd81d43f195f8.

## Actual verification

- Final renderer index-D0ortBBA.js SHA256c71aae3f736be9e62bf78840f4a9853754f380ef38c8a7d6da1156fd0f8982e7. Exact source/native/build/media/report manifest docs/queue-step-build-2026-10-23.json. Final packaging ran after runtime ended and kept the same renderer identity.
- npm run build PASS (17screens268controls77groups33FAQseeds30workspaceguides/help/media/TypeScript/Vite); npm test49PASS. Existing Vite size warning remains. No broad foundation rerun in this checkpoint; its previous dated results remain historical.
- node scripts/queue-step-check.mjs PASS3 real DEV Electron, runDEMO-QUEUE-1792728679614. New synthetic patient15/MRN-2026-000013, ticket11/OPD-2026-000011, DEV Card collection payment4 amount1500, token1. This is a real DEV recorded synthetic payment, retained for audit; no physical cash/external processor claimed. Real doctor10 queue read contained ticket11/token1.
- Initial doubleclick ONE deferPOST200; committed response deliberately lost. No auto repeat/no deferral retry button; Check latest slip read original status/history before explicit reviewed closure. Doctor selection stayed intact in the empty/deferred state; F1 and rejected reason discard preserved draft/focus.
- ReactivatePOST200 committed reply deliberately lost; explicit retry doubleclick ONE retry with IDENTICAL original key/body and actual Idempotent-Replay=true. Original token1 retained, invoice amount_paid1500/Paid unchanged; no new payment on reactivation.
- Another real backend session deferred ticket11 while the dialog was open. Actual ticket11 events458–467 caused selected detail/history refresh, changed-slip warning, retained reason and disabled confirmation, with exactly3 total app transition POSTs (defer,reactivate,reactivate replay). Native journal reads include actual dashboard/by-doctor/detail/history. Both live event types verified; no fake event/response.
- demo.doctor reactivate11 actual403 FORBIDDEN, request4eebb62103124446b00210b8002ffea7; docs/queue-step-access-2026-10-23.json. This is one denied role, not the full matrix. Actual EN/UR Light/DarkHighContrast250 screenshots public/handbook/queue_management-{en,ur}.png and ignored artifacts/queue_management-*-250.png.

## Retained state and cleanup

Ticket11 is **Deferred/Paid**, outside the active doctor queue, with original token1 and amount_paid1500. Payment4/patient15/ticket11 remain synthetic audit records. No refund, cancellation, financial close, clinical encounter, approval decision or physical handover was invented for cleanup. Owned user34 exact codex.foundation.1792584106665/employee36 inactive; original preferences restored; every admin/native attempt finished. No running command/uncertain write. Ignored immutable journals artifacts/queue-step-passed-20261023.json and queue-step-native-passed-20261023.json. Before rerun verify original IDs/keys, paid fixture state and owned-account inactivity; never create another paid registration because a previous response is missing.

## Your manual test

1. Reception → Queue management. Use a fresh synthetic paid DEV ticket from Registration and record its patient, number, token, paid amount, build and reviewer in the reception worksheet. Existing seeded/agent records alone do not satisfy the named human fresh-data review.
2. Scan/type its full OPD number and open it. Verify exact patient/MRN, doctor, token, paid amount/validity and history. Select its Doctor queue; compare calling order with All queues and department groups on suitable fixtures.
3. Defer with a reason; confirm it leaves the active queue and appears under Deferred slips. Reactivate while valid; confirm the same original token returns with no new payment. Test F1 and cancelling/rejecting discard from the reason dialog.
4. Open a confirmation in one session, change that ticket from another authorized session, and verify confirmation becomes disabled without losing the typed reason. Close and review the real latest status before another action.
5. Review controlled connection/lost-reply recovery: deferral must only be reconciled by original status/history; reactivation's explicit original retry must retain its identity. Never use a new registration/payment to recover the queue. Test permitted/denied roles, records-only views, expiry/refusal and actual physical scanner using appropriate DEV fixtures.
6. Check English/Urdu, both themes,100–250% shared keyboard/Settings zoom/reset and contextual/offline help. Named human records results/signs the worksheet; native language/editor/full role FAQ review remains pending.

Proposal **#63** saved and read back pending for new by-doctor/defer/reactivate endpoints, opd.queue.updated/opd.ticket.status_changed and token-retention rule:28af882c64: **awaiting human review on /docs -> My progress**. Exact payload docs/codex-queue-defer-reactivate-20261023-v1.json. Previously accepted reads/cancellation/expiry not duplicated.61/62 also pending at closeout, baseline495acceptedpoints/0complete screens. No whole-screen/q:tested/full-human claim.

Remaining: actual ticket.forfeited path, complete multiple-doctor/department/calling-order/role/refusal matrices, expired reactivation refusal and physical scanner, named human fresh-data/role FAQ/native Urdu/editor. No new backend defect reproduced; **#13 New/no response** still tracks shared demo.reception restoration on closeout2026-10-23. No repeated shared login/reset/reseed. Trusted ignored local cloud/CA configuration unchanged. Next screen after this review is Refund / waiver / credit, but no work there started in this checkpoint.
