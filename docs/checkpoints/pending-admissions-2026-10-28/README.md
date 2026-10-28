# Pending Admissions continuation draft — 28 October 2026

This is an unfinished source draft, excluded from the enabled screen catalogue and TypeScript source tree. It is not delivered, tested against fresh admissions journeys, or proposed for progress. The reviewed app remains at source commit 19442b4 (50 screens).

## Preserved work

- Full current screen, quality, design and workspace handbook contracts: contracts/pending-admissions-{full,quality,design,handbook}.json; generator response contracts/ts-pending-admissions.json. All bundle sections were read.
- Source drafts under this directory retain their original repository paths, with a .draft suffix. Seven new source files include generated admission list/detail/bed/panel calls, action policy and the screen.
- integration.patch.json (patch field) preserves the exact proposed App route, layout, shared clinical-write opt-in and optional-document marker changes. These were removed from enabled source after preserving them here, because the new screen has not passed its own help/live/UI gate. No existing/user changes were discarded.
- The initial draft passed npx tsc --noEmit before the final App/style integration. That is not a screen verification or acceptance result.
- No business writes were made for this next-screen draft, and there is no uncertain write or running command.

## Exact next actions

1. Read handoff.md, status/diff/recent commits and current MCP progress/feedback. Refresh server contracts if changed. Review these drafts before copying back; apply integration.patch.json (patch field) only after confirming current source context.
2. Complete bilingual screen handbook, role FAQs, every data-help control/task mapping and actual EN/UR screenshots. Extend shared state-refusal metadata for admissions from current get_endpoint contracts.
3. Test the opt-in independent-upload single-flight change: only the same fixed patient's optional upload may coexist; other writes and patient navigation remain blocked. Test action guards, fresh-record preflight, preserved drafts and exact admission reconciliation.
4. Create NEW tagged synthetic data and keys through sandbox_call/scenario; exercise waitlist, allocate/reserve/admit/cancel/overflow, Code Red temporary identity and billing, final bill and BillingSettlement. No real care, medicine or physical money. Retained admission1 from the earlier evidence remains DischargeInProgress/BillingSettlement with Draft invoice2; read it before any intentional continuation and do not guess/pay its balance.
5. Investigate a possible documentation gap: allocate/overflow/waitlist screen rules/write semantics mention ADMISSION_STATE_INVALID, but endpoint error arrays did not list it. This is not reproduced or reported yet. Reproduce on fresh owned records, check existing issues, then report one actual finding with request IDs if still present.
6. Exercise screen_test_plan and actual Electron workflows, failure/unknown-result recovery, events/reconnect, permissions/service views, F1/focus, EN/UR, themes and native Settings/keyboard zoom100–250. Run mandatory checks and commit. Propose only newly implemented/tested items with exact evidence, verify saved proposal. Human review remains required.

## Decisions to retain

Optional photos/documents never delay bed allocation or repeat admission writes; upload separately. Code Red defers charges rather than waiving them. Confirm billing only after temporary identity is resolved. BillingSettlement can also be refused for an unsettled final bill; do not replace that with generic 'discharge not started' guidance. Bed races require actual matrix refresh and choice; preserve reason/draft. No frontend mock success, guessed record IDs or automatic state-guard replay.
