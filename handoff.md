# Haspataal agent handoff

Last updated: **2026-10-19, Asia/Karachi** by **Codex**.

## Current task and status

Current request: fix four remaining Phase 1 items; the user will test manually. **All four fixes implemented and verified; manual acceptance pending.** No Phase 2 work started.

- Login reads /health after /health/live, repeats checks without overlapping polls, distinguishes valid degraded/503 data from network/password errors, and disables sign-in while checking or degraded. Electron still validates the health envelope. Files: electron/health-response.cjs, electron/main.cjs, src/App.tsx, src/screens/Login.tsx.
- Notification and incident times use the hospital timezone from real metadata. Incident wall time converts explicitly to UTC; invalid/missing/changed zones and ambiguous/nonexistent DST times are refused. Files: src/hospital-time.ts, Notifications.tsx, Incidents.tsx.
- Facility retains the immutable original apply body, preview and idempotency key in durable local records scoped by hospital CA fingerprint/account, with separate keys for each action. This survives app restart/login and prevents one window overwriting/deleting another attempt. Uncertain results block new work, allow real status/history reads and exact retries within 24 hours; confirmed 4xx refusals (excluding timeout/throttling) require a fresh preview. A reviewed close confirms manual reconciliation and does not invent success or undo. Files: src/facility-recovery.ts, Facility.tsx.
- Avatar account menu now opens Settings with normal draft/pending-action guards. Help/translations and examples were refreshed. Recovery history is expandable to keep its actions visible.

Verification on 2026-10-19: final npm run build passed; npm test passed 24 tests; real DEV Electron capture run and final npm run test:foundation passed. Checks include real healthy health, avatar Settings, hospital timezone with workstation emulated as Los Angeles, durable recovery across closing/reopening the app and a new login, navigation blocking, real preview/history reads, plus the earlier zoom/F1/help/draft checks. Coverage: 11 screens, 102 controls, 42 groups, 33 FAQ seeds, 30 scoped workspace guides, 22 bilingual screen examples. Git whitespace checks passed. Existing Vite size warning remains. Evidence: artifacts/foundation-check.json, artifacts/facility-recovery.png, docs/phase1-control-inventory.json, public/handbook/. A recovery capture was visually inspected.

No business writes were performed: no Facility apply/retry, incident submission, policy change, approval decision, registration or payment. The recovery test stores an UNSENT client draft built from a REAL preview, reads actual history and explicitly closes that known-unsent attempt; it never fabricates server data or success. The retained test record was removed and demo preferences restored. Degraded/503, DST and refusal/identity/expiry/isolation branches are unit-tested; actual degraded database and uncertain committed-reply cases remain controlled manual DEV scenarios.

Next: user follows PHASE1_MANUAL_TEST.md. Broader P1 named human fresh-data/role journeys and Urdu review still required before declaring completion. Details: PHASE1_IMPLEMENTATION_REVIEW.md. Backend documentation issue #7 remains New/Low at the last MCP check; no new backend gap was found. Portal acceptance remains unclaimed. No commands or implementation are in progress; no uncertain business write remains. Changes are uncommitted; preserve the prior backend reconciliation, user's text file and ignored configuration. Git baseline remains 6ab6208.

**Previous backend-reconciliation checkpoint: complete.** Verified backend responses and live behavior, updated affected UI and help, refreshed eight MCP bundles/generated clients, and passed build, 11 tests, 32 live API checks and a read-only Electron integration check. Detailed results: `BACKEND_FIXES_REVIEW.md`. No next-phase feature was started. Changes are uncommitted.

The refusal-only registration probe initially returned MCP `Transport closed`; retrying the SAME key/body confirmed 422 REFERENCE_NOT_FOUND with `details.field=linked_employee_id` (request `a4b5aeedfb7842a1aaaa7d7a96bbfa5b`). A patient search confirmed an empty result for the audit name, so there is no uncertain write outstanding. Earlier invalid doctor/service probes returned 422 VALIDATION_ERROR. No real payments or approval decisions have been performed in this task.

Implementation checkpoint: eight affected MCP bundles/generated clients refreshed to fingerprint `0b5ab90e400dfbb822d3`, knowledge revision `318d65bdd91cd873`. `src/StaffPicker.tsx` uses GET /staff/lookup in registration and incidents, with 2–80 character searches, maximum 20 rows and stale-response protection. `src/approval-policy.ts` and Approvals use server eligibility, require solo notes, permit eligible AP decisions, and refresh before deciding. Health envelopes and obsolete English/Urdu help were reconciled. `docs/mcp-tool-inventory.json` records 54 available tool names; Settings and terminal-installer blueprints were checked. There is no historical tool inventory proving when each tool was introduced.

Current verification: `npm run build`, `npm test` (11), `npm run test:live` (32), `node scripts/backend-fixes-check.mjs` and Git whitespace checks passed. The integration test submits no business decisions or registrations. Evidence is in `artifacts/backend-fixes-check.json`, `incident-staff-fixed.png`, `registration-staff-fixed.png`, `approval-requester-fixed.png`, and `approval-decider-fixed.png`. One initial Electron run timed out during startup; the retry waited for workspace readiness and passed. No commands remain running. The existing Vite bundle-size warning remains.

User requirements that continue to apply:

- Build screen by screen or in testable steps using the real Haspataal MCP contracts and DEV/demo data.
- Never mask backend/MCP gaps with client-side mocks. Report gaps to the backend team and retain their issue IDs.
- Keep this handoff current during work, not only at the end.

## Git and local environment

- Repository: `D:\Projects\Haspataal_Codex`; Windows PowerShell; Electron + React + TypeScript + Vite.
- Last inspected Git baseline: `6ab6208` — `feat: add global styles and layout for the application`.
- On starting this task, untracked files were `AGENTS.md`, `handoff.md`, and the user's `how to handoff work from one agent to another.txt`. Preserve the user's text file. No commit has been created for this task.
- No commands from the current task remain running. The refused registration probe was reconciled; no uncertain backend write remains. No commit was requested or created.
- Haspataal MCP is connected to DEV. Developer username `mkashif`, implementation ID **1**. Recheck current MCP availability and issue status when needed.
- Local configuration files `.haspataal-connection`, `.dev-terminal.json`, `.hospital-ca.pem`, `.codex/config.toml*`, and `.agents/mcp_config.json*` are ignored. They are not transferred by a Git checkout. Obtain/setup them through the authorized environment; do not print or commit credential files.
- `node_modules/`, `dist/`, and `artifacts/` are ignored. Build/test artifacts and synthetic screenshots may exist locally but are not guaranteed in another checkout.

## Application checkpoints already implemented

- Shared foundation screens: server connection, login, application shell/workspace picker, settings, notifications, help, approvals/charity approvals, facility settings and incident reporting. The six reported issues now have terminal backend responses (five Fixed, one Rejected as frontend-only); full workflow/human acceptance is still pending. Their presence does not mean the entire foundation/workspace is complete.
- Antigravity added patient search and cash-shift screens. Codex subsequently fixed patient selection races, unsafe version-conflict retry, hidden financial/terminal lookup errors and the patient-merge event field. See implementation in `src/screens/PatientSearch.tsx` and `src/screens/CashShift.tsx`.
- Registration now supports required and optional intake, returning patient lookup/context, patient-only creation, active OPD service selection, panel billing, discounts, payment, waiver requests, emergency/dues controls, reopening tickets, optional photos and outside reports, slip preview/reprint and PDF export.
- Registration code: `src/screens/Registration.tsx`, `RegistrationDocuments.tsx`, `RegistrationActions.tsx`; help/translations: `src/registration-help.ts`, `src/registration-i18n.ts`. Contract snapshots: `contracts/registration.json`, `contracts/registration-extras.json`.
- Transport supports real multipart uploads; protected patient document retrieval and OPD printing live in `electron/main.cjs`, `electron/transport.cjs`, `electron/opd-print.cjs`, and `src/bridge.ts`.
- **Most recent application change:** aligned the Patient Search results column with the details panel; made returning-patient registration results consistent full-width rows; arranged photo controls and preview in a responsive layout. Files changed at that checkpoint: the three relevant screen components, `src/style.css`, `src/registration-i18n.ts`, and `scripts/layout-check.mjs`. That work is already included in the current Git baseline.

## Earlier verification (before the backend reconciliation above)

- Production build passed after the layout fixes. The existing Vite warning about a bundle larger than 500 kB remains.
- Seven contract/transport/print-safety tests passed during registration development.
- 32 live API checks passed during registration development.
- `scripts/registration-check.mjs` passed: real new patient/ticket, optional photo and outside report uploads, F1 preserving a draft, slip preview, 80 mm PDF, Card payment and queue placement.
- `scripts/registration-review.mjs` passed: stored-photo retrieval, Urdu 250% screenshot, optional intake, panel billing, patient-only registration and VIP waiver request.
- `scripts/layout-check.mjs` passed: search/detail top alignment, equal-width returning-patient rows, photo-section layout, and Urdu at 250% without horizontal overflow. Screenshot inspection confirmed the result.
- Existing test evidence may be in `artifacts/registration-check.json`, `registration-review.json`, `registration-full.png`, `opd-slip.pdf`, `search-layout.png`, `photo-layout.png`, and `photo-layout-urdu-250.png`.

## Acceptance and follow-up still pending

See `REGISTRATION_REVIEW.md` for the complete MCP feature comparison. Registration is **not fully signed off**:

1. Staff lookup issue #5 is resolved and both pickers were verified. Staff-linked patient submission still needs the appropriate fresh-data/human workflow review. Never substitute a manual database ID.
2. Test actual camera capture and physical receipt-printer output on the user's terminal. File photo upload and PDF generation passed, but those do not verify hardware.
3. Review remaining cash/bank, emergency/dues, discount-ceiling and lost-answer recovery/refusal paths with suitable DEV scenarios.
4. Complete native Urdu review and the named human review with fresh synthetic records required by MCP. Agent tests do not satisfy that acceptance gate.

## Backend issues

These were filed through MCP for implementation 1. Statuses below were rechecked on **2026-10-19** against server build `2026-10-19T02:19:27.475638+00:00`; no open reports were returned. Recheck if the backend changes again.

| ID | Issue | Last known status |
| --- | --- | --- |
| 1 | Generated TypeScript public-access comments | Fixed; clients regenerated and public health checked |
| 2 | Read-side approval eligibility/co-signing | Fixed (backend confirmed the concern in part); server now provides can_decide/decide_blocked/self_decision, decision co-signer fields removed, public finance threshold added. UI migrated. Owner/requester checks passed; solo/AP branches unit-tested, not executed on shared financial data |
| 3 | Incident staff lookup | Fixed; real `/staff/lookup` works for reception and the incident picker is enabled |
| 4 | Frontend concurrency/conflict/error/event findings | Rejected as a backend issue; the prior frontend fixes remain implemented. The team asks that frontend-only review findings stay in the frontend tracker |
| 5 | Registration staff/payroll lookup | Fixed; shared badge-facts picker works for reception without HR-directory permission |
| 6 | Missing-reference error metadata | Fixed; live 422 carries details.field=linked_employee_id, rollback verified; examples are labelled with details_from |

## Real DEV data for terminal testing

The user was told to use `demo.reception`. Demo passwords are documented in the MCP guide `demo-data-and-testing`; do not copy passwords here. Other seeded accounts include `demo.owner`, `demo.billing` and `demo.doctor` for their respective workspaces; UI coverage differs by workspace.

- Search patients for `Codex` to find synthetic test records; search `SCN` for scenario-created records.
- `OPD-2026-000007` / `MRN-2026-000007`: photo, outside report, Card payment and queue. Most recently checked on DEV during the prior turn: Paid, token **3**. Re-read before testing because server data is shared and mutable.
- `MRN-2026-000008`: synthetic panel-intake patient with optional demographic fields.
- `OPD-2026-000006`: a VIP waiver request was submitted during testing; do not assume it is still unpaid/unlocked or resubmit blindly.
- Demo panel created through the real finance API: `DEMO-CODEX-20261018`, ID **1**, name `DEMO ONLY - Codex registration test panel`.
- Last verified OPD service prices: Ahmed Khan 1500, Sara Malik 2000, Tariq Aziz 2500, Hospital Owner 3000. These are backend data, not hardcoded UI defaults.

## Next action

Await the user's testing feedback or next task. The reported-issue verification and affected-UI migration are complete; read `BACKEND_FIXES_REVIEW.md` for the results and limits. Preserve all current uncommitted changes and the user's untracked `how to handoff work from one agent to another.txt`. Physical hardware, remaining refusal/recovery scenarios, Urdu approval and named human acceptance still must not be marked complete.
