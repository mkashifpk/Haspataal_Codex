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
