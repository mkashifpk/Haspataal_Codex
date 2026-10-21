# Instructions for every agent working in this repository

## Mandatory handoff protocol

`handoff.md` in the repository root is the shared record of current work. Every agent working on this project must read it and keep it updated. This includes agents resuming after another agent stopped, reached a usage limit, or changed tools.

1. **Before starting or taking over work:** read this file and `handoff.md`, then inspect `git status`, the relevant diff, and recent commits. Verify the recorded state against the files; do not assume a previous agent finished a step because it planned or mentioned it.
2. **Before implementation or a long operation:** update `handoff.md` with the current request, what you are about to do, the files involved, and the next concrete step. Record a pending command before launching it when its outcome matters to continuation.
3. **During work:** update the handoff after each meaningful implementation checkpoint, test result, backend issue report, blocker, or change of direction. Do not wait until the end of the conversation or until a usage-limit warning. Unexpected stops may provide no chance to write a final summary.
4. **Before ending or handing over:** record what is complete, what is still in progress, the exact next action, verification results and limits, uncommitted changes, and any running commands. If nothing is in progress, say so explicitly.
5. **On takeover:** reconcile pending commands, partial edits, uncertain backend writes, and the working tree before continuing. Verify uncertain writes using their original key or a server read; never repeat a payment or registration just because a result is missing from the handoff.

Keep the handoff concise and current. Replace stale instructions instead of accumulating conflicting task lists. Preserve unresolved backend issue numbers and material decisions. Use repository-relative file paths, exact commands, commit identifiers, and synthetic record identifiers when useful.

The handoff must contain:

- Last update date and agent/tool identity.
- Current task and status, including the user's scope and constraints.
- Completed checkpoints and files changed.
- Work in progress and the next concrete actions.
- Tests/checks performed, outcomes, and checks still pending.
- Backend/MCP gaps, issue IDs, and their last verified status/date.
- Git baseline, uncommitted work, and known running commands or uncertain writes.
- Environment/setup information needed for continuation, without secrets.

Never put access tokens, refresh tokens, MCP keys, passwords, private certificate material, or real patient information in the handoff. Record where authorized local configuration is obtained, rather than copying its contents. Git does not preserve chat history, process state, ignored files, or backend database state; record the necessary non-secret context explicitly.

## Haspataal: required progress reporting

Use this repository's Haspataal MCP connection (haspataal_project in Codex,
haspataal in other agents). At the start of every session, call my_progress and
progress_proposals for the connected implementation. Read returned review feedback.
Read overview and get_guide('connecting-your-coding-agent') for the full backend
workflow; use get_screen_bundle and get_ui_quality_brief before building each screen.

After implementing or materially updating any screen, submit propose_progress
without waiting for the developer to ask. Do this before moving to another
workspace or giving your final handoff. A workspace needs a separate proposal
for every screen with newly implemented, tested rubric items.

Use the current rubric fingerprint and item IDs from get_screen_bundle/my_progress,
the connected implementation_id, the tested commit or identifiable build, and
readable Markdown evidence: changed files, checks run and results, and limitations.
Report only items actually implemented and tested. Partial work is reportable;
leave untested items out and describe missing human review honestly. Never invent
test results, a human review, a worksheet or approval.

First check accepted claims and progress_proposals: do not resubmit unchanged work
already accepted or awaiting review. Reuse the same request_id and identical payload
when retrying a lost response; use a new request_id for changed evidence or a new build.
Verify the saved proposal with progress_proposals. In your handoff, name the proposal
IDs and say "awaiting human review on /docs -> My progress".

If submission fails, keep the exact payload and request_id in the repository without
credentials, report the blocker, and retry at the next session. Never say progress
was posted until the server confirms it. If no item is ready, explain why; do not
submit empty or invented claims merely to satisfy this rule.

Proposals earn no points. Only the human's authenticated portal review can accept
claims; agents must never approve their own proposals or nominate an implementation.

## Mandatory MCP implementation workflow

- Use `overview` once per session and `get_build_roadmap()` before choosing implementation work; build in dependency order.
- Before each screen, read `get_screen_bundle`, `get_ui_quality_brief` and `get_design_principles`; read omitted bundle sections before finishing. For a workspace journey, use its workspace quality brief and handbook outline too.
- Use `get_endpoint`, `generate_typescript` and `validate_request` for real request contracts; use workflow recipes, real DEV scenarios and `screen_test_plan` for appropriate verification. After backend updates call `what_changed` and refresh affected contracts, rubric items and help.
- One complete app must support every catalogue workspace/screen, facility profile and service. Use server `GET /establishment -> views`, `establishment.changed` and service capability gates at runtime; never branch on facility category or equate one profile with full completion.
- Ship contextual F1, English/Urdu screen and workspace guidance, detailed role FAQs, and shared keyboard/Settings zoom (100–250%, reset 100%) with each screen. Named human fresh-data journey/translation review remains required; missing evidence means pending.
- Read backend issue answers at session start with `my_backend_issues`; retest Fixed reports once `overview.server_build >= fixed_in`. Check existing reports before submitting one reproduced backend finding; keep frontend defects in the frontend tracker.
- Use `open_decisions` for human-owned choices. Preserve permission-based access and `pdf_download` for document sets (separate PDFs or one combined PDF, never ZIP).
- Keep DEV attribution tied to the verified developer and implementation; attribution is not authentication. Keep MCP secrets out of the app. Consult `get_terminal_installer_blueprint` when shipping the signed, self-contained Windows installer.

## Project requirements

- Use the real Haspataal MCP contracts and DEV/demo backend. Do not hide backend bugs, missing fields, broken contracts, missing MCP functionality, or TODOs with client-side mocks, fabricated records, local success states, or guessed identifiers.
- Report discovered backend/MCP gaps through Haspataal's backend issue-reporting tool as authorized by the user. Record issue IDs in `handoff.md`; clearly distinguish frontend defects from backend defects. If reporting is unavailable, record the evidence and pending report.
- Build in testable screens or steps so the user can test along the way. Do not equate implementation, a passing build, seeded-demo browsing, or screenshots with completion of the MCP acceptance gate.
- Preserve permission-based access, server service gates, separate idempotent writes, visible errors, contextual F1 help, English/Urdu support, and the shared 100–250% zoom state.
- Patient photos are optional. Upload photos/documents separately after the patient exists; an upload or print failure must never repeat registration or payment.
- Protect local configuration and credentials. Respect `.gitignore`; do not add ignored secrets or local test-profile data to Git.
- Preserve other agents' and the user's changes. Do not reset, discard, or overwrite unexplained working-tree changes on takeover.

## Project map and verification

- `src/`: React/TypeScript UI; `src/generated/`: MCP-generated API contracts.
- `electron/`: secure terminal bridge, transport, discovery, sessions and printing.
- `contracts/`: saved MCP bundles and supporting endpoint contracts.
- `REGISTRATION_REVIEW.md`: registration feature comparison and acceptance limits.
- `PHASE1_IMPLEMENTATION_REVIEW.md`: foundation implementation, verification and remaining human acceptance.
- `npm run build`: mandatory handbook coverage check, TypeScript check and production bundle.
- `npm run check:help`: foundation screen/task/control mappings, bilingual content and bundled screenshots. Keep `data-help` mappings and authored instructions current when changing controls; do not silence this check to finish a screen.
- `npm test`: contract, transport, print-safety, preference-queue and help-coverage tests.
- `npm run test:foundation`: real DEV Electron regression checks; changes/restores demo preferences, but submits no business records. Native zoom shortcuts use Electron input rather than CDP keyboard events. Add `-- --capture-handbook` only when intentionally refreshing the synthetic examples in `public/handbook/`.
- `npm run test:live`: real DEV API checks.
- `npm run test:ui`: Electron smoke checks against DEV.
- `npm run test:registration`: creates synthetic DEV patients/tickets/documents and records a payment. Run only when that workflow needs verification; it changes shared DEV data.
- `node scripts/registration-review.mjs`: additional DEV intake/waiver checks; read its prerequisites and effects first.
- `node scripts/layout-check.mjs`: layout checks against existing DEV data.

Choose verification appropriate to the change. Document-only changes do not require rebuilding the application. Clearly record when tests were last run instead of implying old results were rerun.
