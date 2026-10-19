# Phase 1 implementation gaps

Date: 2026-10-19. Implementation: Codex, ID 1. Scope: the eleven P1 screens in the live MCP roadmap; no Phase 2 feature was added.

## Changes

- Keyboard zoom and Settings saves share `electron/preference-queue.cjs`. Relative changes resolve after the preceding confirmed save. Refusals remain visible; a failed task cannot poison the queue. A session generation prevents pending changes from reaching a later login. Zoom stays within 100–250% and broadcasts the confirmed state to all windows.
- Facility, policy, incident, approval-note and password forms explicitly mark drafts and pending writes. Facility selectors and unnamed controlled fields are covered. Policy section/request navigation and approval request changes warn before discarding drafts. Filters do not masquerade as unsaved forms. Successful Facility apply clears its reason/draft.
- Shared fields expose their exact visible labels to assistive tools. New authenticated windows load their workspace and metadata immediately rather than waiting for an unrelated event.
- The handbook adds bilingual control instructions, recovery answers for every P1 FAQ seed, scoped workspace/role guidance, guided practice, screen links and permission-checked local deep links. Workspace task guidance uses the real handbook's granted tasks. Account/permission changes clear old help state. Urdu remains explicitly a draft.
- `src/foundation-catalogue.json` records the actual MCP task/role/FAQ inventory; `src/foundation-task-map.json` maps those tasks to authored instructions. The source bundle requirements are retained in `docs/phase1-handbook-requirements.json`.
- `npm run check:help` runs as part of every production build. It checks the eleven bilingual screen pages, task mappings against saved contracts, all interactive foundation controls, FAQ recovery coverage, workspace guidance, and referenced bilingual PNGs. Tests prove that missing mappings, newly uncovered backend tasks and missing translations fail the check. Coverage is a structural check, not human approval of wording or journeys.
- Help printing now waits for Electron's completion callback and shows print failures rather than immediately claiming success.

## Verification

Passed on 2026-10-19:

- `npm run build`: help delivery check, TypeScript and production bundle. The existing Vite bundle-size warning remains.
- `npm test`: 18 passing tests, including queue ordering/refusal/session boundaries and negative help-coverage cases.
- `npm run test:live`: 32 real DEV API requests verified.
- `node scripts/foundation-check.mjs --capture-handbook`: real Electron integration checks passed and 22 English/Urdu examples captured in `public/handbook/` (about 1.8 MB total).
- `npm run test:foundation`: final follow-up passed, including native rapid zoom, both bounds/reset, slider agreement, new-window initialization/zoom, persistence across login, Facility selector-only and unnamed-field drafts, incident selections, approval notes, policy section changes, F1 from a field and an approval confirmation, focus restoration, role guides, help search/no-match, local deep links, forbidden-page refusal after account switching, packaged image loading and renderer-offline help. Urdu help at 250% had no document/article horizontal overflow.
- Git whitespace checks passed. All commands are finished; preferences were restored. No uncertain business write remains.

Evidence: `artifacts/foundation-check.json`, `artifacts/foundation-help-urdu-250.png`, the bundled examples and `docs/phase1-control-inventory.json`. English Facility and Urdu handbook/250% captures were visually inspected. Structural coverage is 11 screens, 97 controls, 41 control groups, 33 FAQ seeds and 30 scoped workspace guides.

`node scripts/foundation-check.mjs --capture-handbook` uses real DEV reads and real preference saves, restoring the original preferences. It does not submit an incident, policy change, Facility change, approval decision, payment or registration. The unconfigured-terminal screenshot uses an isolated provisioning search directory, not fabricated server responses. Native Electron input exercises the main-process zoom shortcut hook; CDP keyboard events do not exercise that hook.

Screen examples are synthetic DEV illustrations, not evidence of the reader's own successful action. Screenshots show representative overview/draft states; they do not certify every error, hardware state or role journey.

## Backend gap

Issue **#7**, Documentation / Low / **New**: `get_handbook_outline('*')` still describes an unconditional requester ban for approval/rejection after issue #2 introduced server-computed solo eligibility. The UI uses the actual `can_decide` / `self_decision` response. The outdated prose is reported, not implemented as a client authorization rule.

## Acceptance still pending

### Four follow-ups implemented

A subsequent code/contract comparison identified four follow-ups. All four are now implemented:

1. Login reads full health after a successful liveness check, repeats without overlapping polls and distinguishes a documented degraded/503 envelope from transport or password errors. Sign-in is disabled while checking, unreachable or degraded. Health schema validation still runs.
2. Notification and incident history display use the configured hospital timezone. Incident input labels the hospital timezone and converts that wall time to UTC, independently of workstation settings. Missing/invalid zones, DST gaps/ambiguous times and changed timezone during a draft are refused visibly.
3. Facility apply retains an immutable original payload, idempotency key and preview in durable records scoped to hospital/account. Separate action keys prevent windows from overwriting or deleting one another's records. Recovery survives restarting the app and signing in again. New work is blocked until review; status/history checking only reads, retry reuses the original action within 24 hours, and a definitive refusal requires another preview. A manually reviewed close clears the hold without declaring success or undoing a change.
4. The avatar account menu now opens Settings, preserving draft-discard warnings and pending-action guards. Sidebar and keyboard routes remain available.

These are frontend fixes, not new backend bug reports. Bilingual guidance/translations and screen examples were refreshed; structural coverage is now 102 controls and 42 groups. Build and 24 unit tests passed, including health-503/schema handling, hospital-time conversion/DST refusal, recovery identity/expiry, and separate durable records per account/hospital/action. The live Electron run passed the avatar route, real healthy health, a Los Angeles workstation with real hospital timezone metadata and read-only recovery from an unsent client draft, including closing/reopening the app and signing in again. A captured recovery screen was visually inspected; its fetched history is now expandable so actions are not buried below a long register. No Facility apply is submitted by automation; controlled degraded/uncertain-commit scenarios remain manual tests. See `PHASE1_MANUAL_TEST.md`.

Backend issue #7 remains the separately reported documentation gap; MCP listed one open backend report when this task started.

Phase 1 is not declared complete by this change. A named human must perform fresh-record role journeys and review the Urdu wording. The full exit scenarios still need their recorded outcomes: every demo account's landing, forced password change, licence/maintenance banners, session revocation across windows, actual approval decision/withdrawal and requester handover, and profile/service changes refreshing every window. Broader F1/zoom/layout and physical device checks remain part of acceptance. Agent tests and seeded browsing do not replace this review.

The portal's accepted progress was zero when this work started. No completion claims or human approvals have been fabricated. All changes remain uncommitted.
