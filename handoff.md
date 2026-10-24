# Haspataal checkpoint

Updated **24 October2026 — Codex/functions, Asia/Karachi**. Current request: diagnose/optimize staggered Reception cards after sign-in. Read AGENTS/handoff and verified CLEAN main at **ba424a8d94ac8b5316134a5de8084575de0d2cb7** before edits. This task is implemented and tested; no agent app/command remains running. Preserve any user-owned app/profile.

## Latest startup implementation and evidence

- Commit **7488665065cd1b0766ae43d324d7d587c7368425**: src/App.tsx, new src/metadata-flight.ts, bilingual app-shell/control help; new read-only scripts/reception-startup-check.mjs and workspace-bootstrap-check.mjs plus2unit tests.
- Cause reproduced: statically imported Registration/OPD card waited for workspace/metadata, while core cards rendered early; catalogue reads added a waterfall and login/socket events duplicated a six-GET batch. Real baseline firstcards2536ms, Registration4157ms: **1621ms stagger**.
- Fix: single-flight metadata reads per session-epoch/user/workspace (no settled-result cache or business-write reuse); catalogue/critical reads start together; stale contexts ignored; complete permitted home/menu publish once scoped metadata is ready. Visible bilingual Preparing your workspace / Retry loading workspace preserves permission/service gates.
- Current normal checks show **all12 Reception cards on the first frame, gap0ms**. Duplicate six-GET batch removed. **Total sign-in is NOT proven faster**: optimized run5617ms; final normal8701ms with a4268ms global handbook read. Server/network time varies; do not report those runs as a latency speedup.
- **BuildPASS** (30screens555controls, TS/Vite), **72unitPASS**, final renderer **index-Baju9YUA.js**. Persistent loss of actual catalogue200 replies -> visible Retry, same authenticated session, no partial home -> restore transport+explicitRetry -> coherent12cards, one sign-in only: PASS. Native one-reply loss auto-recovered safely; that earlier harness assertion was not counted as a Retry pass. Early5s expect timed out before auth confirmation; isolated diagnostic app closed, no business action or broad session revocation. Do not infer its sign-in outcome.
- Multi-role actual Owner picker->Doctor switch->same-Doctor reopen and separate Owner window while parent remains Doctor: PASS, no Reception privilege leakage. Owner prefs restored/logout; all confirmed normal/recovery sessions signed out; zero patient/payment/clinical/config writes this task.
- Exact credential-free HTTP/DOM traces/results/limits in **docs/reception-startup-evidence-2026-10-24.json**. Unit coverage covers scoped concurrency, independent contexts and retry/no stale success cache. Existing six-role/all30screen navigation result below predates this startup-only change; it was not all rerun.
- New proposals **105 app_shell** (material catalogue consumers) and **106 workspace_picker** (material auth/workspaces consumer): server-confirmed and verified pending, **awaiting human review on /docs -> My progress**, build7488665. Payloads/request IDs **docs/reception-startup-proposals-7488665.json**. No whole-screen/q:tested/human-review claim;99–104 accepted and not repeated unchanged.
- MCP overview/guide/roadmap/what_changed/progress/proposals/issues and app_shell/workspace_picker bundles/quality/design read. Backend contract unchanged;17/18 stillNew/no answer at this session's read. No new backend report: stagger was a frontend sequencing issue; variable HTTP times alone do not prove a backend bug.

Next action: user restarts the terminal and signs into Reception; all permitted cards should appear together after the loading state. Confirm translations/retry UX manually and review105/106. Continue the standing Phase2 work below when requested. No implementation or test step is currently in progress.

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

Latest source build **PASS**:30screens554controls180groups33FAQseeds30workspaceguides, TypeScript/Vite. **70unit tests PASS**. Final renderer **index-CtYF9m4r.js**. Vite bundle-size warning remains. No app source change after this build; subsequent changes are docs/tests/screenshots. `git diff --check` before commits. No full `screen_test_plan` pass claimed with17/18 outstanding.

1. At next resume re-read instructions/Git/MCP feedback; check17/18. Retest Fixed only when server_build>=fixed_in and refresh affected contracts/help via what_changed. Use recorded synthetic names/MRNs to verify identity; do not recreate old actions. Old sourceMRN000006 is the known failed18 test, masterMRN000007 is the working current lookup.
2. Finish remaining Registration/Patient Search/Home Visit API-plan variants not yet exercised on the reset database (conditional AR/deceased/MLC/service/refusal/document branches as appropriate); keep17/18 explicitly pending and report new reproduced backend gaps once. Read old test prerequisites: many old scripts hardcode invalid pre-reset IDs and must not be run unchanged. No new payment/approval/clinical record just to inspect existing evidence.
3. Developer performs fresh human journeys, English/Urdu/F1/100–250%/physical printing/editor review and portal approval. Use `docs/MANUAL_REVIEW_RESUME_2026-10-24.md`; no agent may approve proposals or fill a human worksheet. Phase2 completion still needs these gates and backend fixes; no Phase3 UI until scope is agreed.

## Durable record / environment notes

NEW epoch existing evidence: UI-created patients1/2 from identifier tests; patient5/ticket1/queue1/demo payment/shift1 from atomic test; Home1original+2corrective for patient1; prior confirmed merge6->7; this session confirmed merge10->11. Exact records/keys in `docs/*reset*evidence*.json`, `docs/reset-merge-upstream-2026-10-24.json`, and resume-merge write receipt. **No pending/uncertain writes.** patient2 temporary address restored. Community services remain developer-authorized DEV simulation setup (home_visits/preventive_programmes Active revision3, programme1), receipts `docs/dev-reset-community*.json`; do not repeat setup/payment/visit writes.

DEV **https://hms-dev.netbird.cloud**. Ignored `.dev-terminal.json`/CA and local MCP config supply connection; never copy credentials to Git/handoff. Historical IP fallbacks remain in ignored local config; tests used the cloud server. node_modules/dist/artifacts/profiles ignored. No subagents. No agent app/command remains running; user-owned profiles untouched.
