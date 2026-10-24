# Haspataal checkpoint

Updated **24 October 2026 — Codex/functions, Asia/Karachi**. Current request: complete pending **My cash shift** screen, one screen at a time. Baseline clean1454d36. Implementation and automated verification COMPLETE; preparing source commit and narrow progress proposal. Full screen acceptance remains pending named human/Urdu/role-FAQ/editor review. No agent app/command or uncertain write remains.

## My cash shift checkpoint

- src/screens/CashShift.tsx: new opening/closing re-read actual permission, terminal counter and own current/original drawer before writes. Changed/stale context sends no close; counted input stays. Reviewed-record Refresh now blocks closure during/after failed reads until successful recovery. Original idempotent open replay and state-guarded close reconciliation retained. Success notice now translates at render when language changes, with shift ID separate.
- src/i18n.ts, src/help.ts, src/foundation-help.ts: bilingual errors, detailed control recovery and receptionist/cashier/pharmacist/accountant FAQ handover. Refreshed public handbook EN/UR screenshots; generated types refreshed (access wording, same contract), full MCP bundle/quality/design saved. Recipe finance-and-owner and API test plan read; valid zero-value open/close payloads checked with validate_request.
- npm run build PASS (30screens/556controls, TS/Vite); npm test **74 PASS**; final renderer **index-CM-4TamT.js**. scripts/cash-shift-completion-check.mjs PASS9checks plus live notice EN->UR assertion: missing mapping, negative float, four403 denied API cases, real duplicate-click/lost-open same-key replay, F1 focus/cancel, both themes/languages250%, changed-counter refusal before POST, failed original read/retry, lost-close original-ID reconciliation, second-close SHIFT_NOT_OPEN. scripts/cash-shift-denied-check.mjs PASS on final renderer: unauthorized Admissions nav absent; native PERMISSION_REQUIRED guard; signedout. No cash-shift event exists in its contract; Refresh is explicit.
- Final synthetic fixture: employee41 / user39 codex.cash.1792841483793 / terminal7 / shift7. All business values zero, no payment/patient/clinical write. Confirmed shift7 PendingCollection, user39 inactive, terminal7 inactive, prefs restored. Earlier isolated shifts2–6 also closed zero, accounts/terminals inactive; synthetic HR/financial audit records retained. No existing shared drawer modified. Never replay these opens/closes to inspect evidence.
- Evidence **docs/my-cash-shift-completion-evidence-2026-10-24.json** distinguishes4 failed harness attempts (wrong Electron evaluate argument/read-fault setup and Windows screenshot file issue) from successful core and final runs. Failed-run cleanup confirmed; no false product pass. Test script uses fresh owned fixtures, journal-before-write and identity-checked cleanup; old hardcoded pre-reset workflow script not run.
- Named human checklist prepared but UNFILLED: **docs/MY_CASH_SHIFT_MANUAL_REVIEW_2026-10-24.md**; use current Reception/Cashier/Pharmacy portal worksheet and record reviewer/build/results. q:fresh_data/q:role_faq/q:character/q:editor not claimed; agent cannot perform independent human review. Full Phase2 still pending.
- MCP start progress/proposals/overview/issues/guide/roadmap + full cash bundle/quality/design/handbook/endpoints/types checked; server build/contract unchanged. Backend17/18 stillNew/no answer, unrelated. New defects were frontend-only, no new backend report warranted.107/108 still awaiting human review on /docs -> My progress.

Next: source commit, propose only newly tested counter/state/permission/write-safety/API-plan items and verify saved proposal; update exact IDs/commit below. Human then tests this screen from the prepared checklist before the next screen. No whole-phase completion claim.

## Current startup optimization

- src/App.tsx: initial authoritative access/facility/settings snapshot is passed once in memory to the automatically selected workspace using exact epoch/user/workspace keys; native workspace validation preserved. Single-workspace Reception skips global handbook and reads only scoped handbook. Multi-role picker retains global handbook.
- Reference catalogues and unread badge load after readiness, with separate visible bilingual Retry; required authority/handbook failure still blocks entry. No fake success/records, no persistent permission cache. New src/bootstrap-seed.ts and tests; bilingual src/help.ts/src/foundation-help.ts updated.
- npm run build PASS (30screens556controls; TS/Vite); npm test **74 PASS**; git diff --check PASS. Renderer **index-BKH9BhkL.js**. Normal DEV samples5378/5811ms versus previous8701ms; gap0/all12cards first frame. Timing varies; structural assertions prove no global handbook, no repeated initial auth/me+auth/workspaces+meta/settings, references after scoped handbook.
- Read-only scripts/reception-startup-check.mjs background-verified: lost real reference response leaves home available, visible Retry disappears after successful restored reads, same login, signedout PASS. Required scoped-handbook loss blocks cards until valid Retry PASS. Owner picker->Doctor/reopen/separateOwnerwindow regression PASS; prefs restored. Exact traces/limits docs/workspace-critical-path-evidence-2026-10-24.json. Earlier background-recovery logout failed Server unreachable; isolated app closed, its session revocation unconfirmed. Later full rerun signedout PASS; no business write to reconcile.
- MCP overview/guide/roadmap/what_changed/progress/proposals/issues and both screen bundles/quality/design read; contract unchanged. Proposals105/106 Accepted,99–104 Accepted. New material proposals **107 app_shell / 108 workspace_picker** server-confirmed pending: **awaiting human review on /docs -> My progress**. Exact payloads/request IDs docs/workspace-critical-path-proposals-0648ac0.json. Backend17/18 stillNew; no backend defect inferred merely from network latency.

No implementation/test step remains in progress. Final docs commit includes this checkpoint and proposal payloads; no known running commands. Next human check: restart terminal, sign into Reception, confirm all12permitted cards appear together and reference Retry/help translations. Phase2 overall still pending, see below.

## Standing Phase2 context

Continue unfinished Phase2/checkpoint work, one testable screen at a time, with real MCP contracts/DEV, bilingual/F1/zoom/permission/service gates, immediate tested progress proposals, and backend reports. No Phase3 UI started. **Phase2 is not fully accepted:** backend issues17/18 and full human/remaining API-plan acceptance are pending. Thirty started screens being navigable is not a full endpoint/event/rule acceptance result.

Git checkpoints:

- Previous session implementation `a18726c`, Home evidence `f132463`, atomic registration/payment evidence `edfc9a9`, shutdown checkpoint `0042d57`.
- **`a4079bba21e8d3244c05ff305b1cbd711c569c0e`**: authoritative merged-patient resolution and safe edit recovery.
- **`69453f2b5bef1f38f30308252f61d66be27ca108`**: `src/App.tsx` same-workspace navigation repair, bilingual launcher help, strengthened smoke/startup checks and final evidence.

**All pre-24October-reinstall record IDs/keys are historical and must not be replayed.** Original pause/history is preserved in Git9c3fb8b and `docs/HANDOFF_HISTORY_2026-10-24.md`. Even the NEW IDs below must have their recorded synthetic name verified before a future write. Never repeat a confirmed registration, payment, home visit or merge.

## MCP / backend / progress

This session read overview, connection guide, roadmap, what_changed, progress/proposals/issues; current Patient Search and Workspace Launcher bundles/quality/design/endpoint/handbook sources. Backend contract unchanged: build **2026-10-24T06:32:06.067860+00:00**, contract **992b7799991463f180bc**, knowledge **0266ade0bf511c86**, rubric **66605e3aa343**. Verified mkashif / implementation1. Initial score863points; do not infer accepted points from pending proposals.

Progress proposals99–104 are now **Accepted**, verified at the start of the startup-performance session (reviewer approved the identified builds):

-99 Registration POST/patients,100 Patient Search search/detail/PATCH,101 Home Visit search,102 Registration atomic UPMRN — accepted; do not repeat unchanged evidence.
-**103 Patient Search event `patient.merged` and `q:writes`**, commit a4079bb, accepted in the latest review. Exact payload `docs/patient-search-merge-proposal-a4079bb.json`. No unchanged99–102 items repeated. Whole merge rule/q:tested deliberately omitted because issue18 failed.
-**104 Workspace Launcher**, material same-workspace reopen/metadata consumer fix (`ep:GET /auth/workspaces`), commit69453f2. Accepted in the latest review. Exact payload `docs/workspace-reopen-proposal-69453f2.json`. Earlier accepted endpoint is materially updated; no unchanged rule/help/window claim repeated.

Backend issues last read **09:52:43UTC / 14:52:43PKT on24October**:

-**#17 New/Open, no response/fixed_in**: name queries containing digits return200/[] for matching records. Report/probes in `docs/backend-search-alphanumeric-2026-10-24.json` and receipt. No query rewriting or manufactured results in UI.
-**#18 New/Open, no response/fixed_in**: an old merged MRN returns200/[] instead of finding the master. Reproduced after NEW merge10->11: oldMRN `MRN-2026-000006` returns[], currentmasterMRN `MRN-2026-000007` finds11; GET/patients/10 identifies master11. New report and request references in `docs/backend-merged-mrn-alias*.json`. This is separate from17. Do not mark full merged-identifier rule/test plan passed.
-**#16 Fixed/deployed**: Doctor own-unsampled lab cancellation checklist corrected. Refreshed last session `contracts/lab_orders_results-quality.json` and unfilled `docs/doctor-review-worksheet-reset-2026-10-24.json`; existing bilingual help agrees. Own order before sampling with reason allowed; other doctor's order FORBIDDEN; sampled LAB_ITEM_STATE_INVALID. Human Doctor worksheet still required.
-#15 Fixed: **fresh six-role smoke confirms Owner can open Outstanding Dues**. #14 Fixed: prior runtime retest remains historical, no new refund/approval created this session.

## What changed and what passed

### Patient Search — committed a4079bb

-`src/patient-profile.ts` follows authoritative master pointers with cycle/unresolved/stale-selection checks. `PatientSearch.tsx` renders master identity and financial context, never the retained Merged source as the editable patient.
-A merge during editing preserves the unsent source draft and locks Save. Read current record follows the master; only explicit discard/reload switches the edit identity/version. Failed profile reads during an edit expose in-dialog recovery. No automatic PATCH replay.
-Bilingual control/handbook instructions and Urdu error strings updated. Resolver4unit tests cover traversal, stale selection, cycles/unresolved identity, failed master read.
-NEW scenario8fe222 created source10/currentmaster11. MCP merge **10->11 CONFIRMED200**, key `codex-patient-merge-resume-8fe222-20261024`, actual event118. Payload/receipt `docs/patient-merge-resume-write-2026-10-24.json`. **NEVER repeat it.** Event/master/financial/draft/save-lock/current-read assertions passed; suite then **FAILED old-MRN search**, reported18. That failure remains a failure, not a full test-plan pass. `scripts/patient-merge-live-check.mjs` cannot produce another event for this already merged pair.
-`scripts/patient-edit-recovery-check.mjs` PASS: actual duplicateCNIC refusal remains editable; real PATCH200 reply lost, rapid clicks send once, draft retained and Save blocked until read/reload. Owned syntheticpatient2 address **restored with fresh version and verified**. No new registration/payment/merge.
-`scripts/patient-profile-resync-check.mjs` PASS on rendererBkoOR_7O: actual native socket termination/reconnect/resync; real master/profile-financial200 replies lost; draft retained, in-dialog read+explicitreload+F1 recovery; zero business writes.
-Evidence `docs/patient-search-resume-evidence-2026-10-24.json` distinguishes passed assertions and failed backend18 case. Pending103 claims only tested event/write safety.

### Workspace Launcher — source/test completed this continuation

-REAL frontend defect: `selectWorkspace` cleared outline on same-code reopen; unchanged workspace state did not retrigger metadata loading, hiding authorized implemented menus. `src/App.tsx` now preserves the same workspace's outline and explicitly refreshes server metadata; different-code behavior stays intact. Bilingual launcher instructions updated.
-The old smoke also had harness mistakes (button-index drift, h1-only Settings locator, initial auto-open race). Corrected `scripts/started-screens-reset-smoke.mjs` waits startup, explicitly selects a real workspace, uses current accessible labels/active buttons, checks required menu inventory and permits h2 headings. Quality covers its own Referral Register; Cashier covers financial screens. Frontend findings tracked in `docs/frontend-resume-review-2026-10-24.md`, not filed as backend issues.
-**Final smoke PASS:76 page visits across Reception/Doctor/Owner/Zakat/Cashier/Quality, required menus present, zero runtime errors/5xx, ZERO business writes; all6 sessions restored/logout.** Combined with startup checks, all**30/30 started catalogue screens** opened; no missing screen. This is navigation smoke, not full workflow acceptance.
-`scripts/startup-surfaces-check.mjs` PASS: actual isolated Connect/Login, public F1, EN/UR/both themes250% no overflow, native upper bound250/reset100. No sign-in or business writes; local-only test-profile preferences. Fresh Login screenshots saved.
-`scripts/patient-master-visual-check.mjs` PASS on final renderer: actual currentmaster11, correct Reception context/full menu maintained through EN/UR/themes250%, F1/merged history; fresh two Patient Search screenshots. No business writes. Visually checked profile content/RTL; native Urdu review still pending.
-Complete navigation/startup/current-build evidence: **`docs/started-screens-resume-evidence-2026-10-24.json`** (lists all30IDs, role visits, six renderer IDs and cleanup).

## Verification and next three steps

Historical pre-startup source build **PASS**:30screens554controls180groups33FAQseeds30workspaceguides, TypeScript/Vite; **70unit tests PASS**, renderer **index-CtYF9m4r.js**. Superseded by74tests/BKH9BhkL startup build above. Vite bundle-size warning remains. `git diff --check` before commits. No full `screen_test_plan` pass claimed with17/18 outstanding.

1. At next resume re-read instructions/Git/MCP feedback; check17/18. Retest Fixed only when server_build>=fixed_in and refresh affected contracts/help via what_changed. Use recorded synthetic names/MRNs to verify identity; do not recreate old actions. Old sourceMRN000006 is the known failed18 test, masterMRN000007 is the working current lookup.
2. Finish remaining Registration/Patient Search/Home Visit API-plan variants not yet exercised on the reset database (conditional AR/deceased/MLC/service/refusal/document branches as appropriate); keep17/18 explicitly pending and report new reproduced backend gaps once. Read old test prerequisites: many old scripts hardcode invalid pre-reset IDs and must not be run unchanged. No new payment/approval/clinical record just to inspect existing evidence.
3. Developer performs fresh human journeys, English/Urdu/F1/100–250%/physical printing/editor review and portal approval. Use `docs/MANUAL_REVIEW_RESUME_2026-10-24.md`; no agent may approve proposals or fill a human worksheet. Phase2 completion still needs these gates and backend fixes; no Phase3 UI until scope is agreed.

## Durable record / environment notes

NEW epoch existing evidence: UI-created patients1/2 from identifier tests; patient5/ticket1/queue1/demo payment/shift1 from atomic test; Home1original+2corrective for patient1; prior confirmed merge6->7; this session confirmed merge10->11. Exact records/keys in `docs/*reset*evidence*.json`, `docs/reset-merge-upstream-2026-10-24.json`, and resume-merge write receipt. **No pending/uncertain writes.** patient2 temporary address restored. Community services remain developer-authorized DEV simulation setup (home_visits/preventive_programmes Active revision3, programme1), receipts `docs/dev-reset-community*.json`; do not repeat setup/payment/visit writes.

DEV **https://hms-dev.netbird.cloud**. Ignored `.dev-terminal.json`/CA and local MCP config supply connection; never copy credentials to Git/handoff. Historical IP fallbacks remain in ignored local config; tests used the cloud server. node_modules/dist/artifacts/profiles ignored. No subagents. No agent app/command remains running; user-owned profiles untouched.
