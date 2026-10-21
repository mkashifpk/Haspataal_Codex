# MCP instruction refresh — 2026-10-21

Read from the connected DEV Haspataal MCP server by Codex: tool descriptions, `my_progress`, `progress_proposals(implementation_id=1)`, `overview`, `get_guide('connecting-your-coding-agent')`, `what_changed(since='0b5ab90e400dfbb822d3')` and `my_backend_issues(implementation_id=1)`.

## Installed repository rules

`AGENTS.md` now contains the exact `my_progress.reporting_requirement.rule` returned by the server, plus the backend implementation workflow. Every session reads accepted claims, pending proposals and human feedback. Each implemented or materially updated screen must immediately submit its tested rubric items through `propose_progress`, then verify the saved record through `progress_proposals`. Report each screen separately, before another workspace or final handoff, without waiting for a user request.

Evidence identifies the current rubric/item IDs, implementation, tested build, changed files, checks/results and limits. Do not duplicate unchanged accepted/pending claims. Retry a lost response with the same request ID and identical payload; changed evidence/build gets a new ID. On failure retain the exact credential-free payload/request ID in the repository and report the blocker for the next session. Never fabricate tests, human reviews, worksheets or approvals.

Completion still requires contextual F1, detailed English/Urdu guidance and role FAQs, shared 100–250% keyboard/Settings zoom, frontend checks and named human fresh-data review. Proposals alone earn no points.

## Current server and tool state

- Verified developer `mkashif`, implementation **1 / Codex**.
- Server build `2026-10-21T05:34:27.930787+00:00`; knowledge revision `a95cfca74fcbe8af`.
- Contract fingerprint remains `0b5ab90e400dfbb822d3`; rubric remains `d81d43f195f8`.
- All **54** Haspataal tools are exposed; no tool names added/removed compared with the saved inventory. Refreshed `docs/mcp-tool-inventory.json`.
- `what_changed` reports no operation/schema/event/error/screen/enum changes, no breaking changes and no affected handbook pages. No generated API clients need regeneration for this instruction update.
- The guide's setup section says fresh setup scripts maintain reporting blocks in `AGENTS.md`/`CLAUDE.md`. This change installs the exact server rule directly in this repository's requested `AGENTS.md`. The existing implementation-scoped connection was verified and left in place; no installer, key rotation or credential-file rewrite was performed.

## Review queue checked

- **#15–23 pending**: awaiting human review on /docs -> My progress.
- **#24–28 accepted**; reviewer `mkashif`; feedback “done”/“Done”.
- **#1–14 returned** historical proposals; feedback read (“working”, “patients searching working correctly”, “registration form is working”).
- Server summary: **96 accepted points; 0 complete screens; 0 complete workspaces**. Accepted items do not imply full screen completion.

No new proposal was submitted: this task changes instructions/documentation, with no newly implemented/tested screen rubric items. Existing unchanged proposals must not be duplicated.

## Portal review improvement

The current guide section 4 documents the native **Agent proposals & human reviews** inbox, grouped by workspace. After testing, the human can use **Approve all reported progress** for the displayed selection, or untick proposals/items for partial approval. New proposals arriving later are excluded. One shared Review worksheet reference covers the selection requiring F1/FAQ/zoom/fresh-data review; individual proposals may override it. The batch is atomic; changed checklist/screen revisions require a reload.

Use this native portal workflow for ongoing human review. The earlier local review-helper bookmarklet remains historical and has not been revalidated against this updated portal. No agent acceptance, nomination or human-review claim was made.

## Backend and verification limits

Issue **#7 remains New / Low**, checked 2026-10-21: handbook approval-access prose conflicts with server-computed eligibility. No new backend defect found. Earlier Fixed reports remain recorded; no new fix response required retesting this session.

Documentation verification: exact reporting-block comparison against the live response, JSON/tool inventory comparison and `git diff --check`. Application build/tests were not rerun because application code/contracts were unchanged; earlier results retain their original dates. No business records or portal approvals written.
