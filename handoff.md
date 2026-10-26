# Haspataal checkpoint — 26 October 2026

Codex/functions, Asia/Karachi. Source baseline c748132; Charity checkpoint committed as 8e8c070. Following commit contains only the proposal payload/receipt and this checkpoint. Previous full OTC state is preserved in docs/HANDOFF_CHARITY_DEVELOPMENT_2026-10-26.md and earlier archives. No unrelated changes discarded.

## Current task and status

User asks to finish Phase3 screen5 Zakat/Charity Override and report reproduced backend gaps. Implementation is present; real DEV acceptance remains BLOCKED by server maintenance. No other new screen started. Do not say Charity/Pharmacy/Phase3 is complete.

GET /health200 at 2026-10-26T03:47:39Z reports maintenance_mode=true, message exactly "Maintenance underway .... Please wait." User was asked asynchronously whether backend work still continues; no reply yet. Do not disable maintenance or bypass authentication. No new backend defect established; planned maintenance itself is not a defect.

## Completed source checkpoints

- src/screens/CharityOverride.tsx, charity-policy.ts, charity-write.ts, generated/charity_override.ts; contracts/charity_override*.json: actual RX-bound Zakat/SocialWelfare, queued request or independent counter co-sign, bounded own/decision status registers, current decision reads/events/resync, exact approved assistance handoff.
- App/scoped navigation and Dispense request link plus exact RX/patient/fund/approval recheck. Approved handoff prefills fund/ID, never quantity; separate supply confirmation. IPD billing preserved.
- Password is not retained in original request state or logs. Ephemeral salted verifier requires original officer to re-enter identical secret for explicit original-key replay after uncertainty. Clears field after each attempt; no automatic retry/replacement. Recorder redacts approver fields.
- Bilingual screen/control/task/help/Pharmacy text and mapped inventory; shared F1/zoom integrated. Actual new EN/UR screenshots and live help/layout verification PENDING.
- scripts/charity-check.mjs journals original writes and plans synthetic queue/counter/refusal/replay/decision/handoff checks, virtual dispensing and owned cleanup. Four policy tests and negative help mapping test added.
- docs/CHARITY_REVIEW_2026-10-26.md: manual checks, actual verification limits. Backend fixed answers saved docs/backend-answers-2026-10-26.json.

## Tests and strict limits

26Oct npm test99/99PASS, npx tsc --noEmit PASS, git diff --check PASS. Bootstrap npx vite build --mode development PASS index-CDbFS4j1.js. Script formatted afterward without semantic source changes; TS rerun PASS.
Mandatory npm run build STOPPED at help check: charity_override missing EN screenshot; UR also not captured. Check remains enabled, no fabricated screenshot. Not a full build pass.
MCP overview/progress/proposals/issues/roadmap/connecting-guide/current Charity bundle including omitted schemas/types/quality/design/Pharmacy outline/testplan and endpoint validation read/refreshed. Generated Charity types unchanged; bundle saved with current metadata.
No live Charity endpoint/event/replay/approval/dispensing evidence, no human/translation/editor acceptance. ACCOUNT_LOCKED countdown only unit-tested; never deliberately lock shared demo officer accounts. Runtime service lifecycle mutations not tested; policy tests cover permission + full/open_work versus records/setup/hidden.

## Reconciliation and exact next actions

Both artifacts/charity-check.json runs stopped before login/business writes:
- DEMO-CHARITY-1792952630403: connection timeout; empty writes/records; reconciled and archived before retry.
- Current DEMO-CHARITY-1792986301658: connected but maintenance; finished, writes={}, prescriptions/approvals/dispensations empty. charity-pharmacist.json confirms preferences_restored and signed_out. No uncertain business write, active test command or active test account.
Current journal cleaned flag is not set. Before retry: verify finished plus all empty write/record arrays, then mark cleaned with reconciliation reason; never use this shortcut on a nonempty journal. Existing session profile is finished/restored, test kit archives it.
Next3:
1. Once /health maintenance_mode=false, run node scripts/charity-check.mjs. First read its journal/profile/transport and test effects. Verify synthetic patient5/ticket5 identity before RX creation; if absent/reset, create fresh authorised synthetic records using current contracts, never guess IDs.
2. Reconcile every actual request/supply by original key/read, fix frontend findings, deduplicate/report only reproduced backend findings. Capture/visually inspect real EN/UR screenshots, run npm run build + npm test.
3. Commit verified changes, submit only newly changed/tested rubric items per screen with current fingerprint and commit, verify progress_proposals. Named human performs manual review from CHARITY_REVIEW. Then retest newly Fixed20–25 affected paths/refresh contracts as below.

## MCP/backend/progress

DEV https://hms-dev.netbird.cloud; server_build2026-10-26T01:17:08.510356+00:00, contract90f7a429e5aa519d440f, knowledgef2f42e3079bc34a3, rubric1f3d8a4d9746; implementation1/mkashif.
Startup progress:150OTC/149Dispense/148OrderQueries selected claims accepted;109CashShift/133Settings pending. New Charity proposal151 confirmed pending by progress_proposals: awaiting human review on /docs -> My progress. ONLY the independently unit-tested service-view policy rule4b6a177fcd is proposed, with explicit runtime/maintenance limits; no full rule-journey or screen completion claim. Payload docs/charity-proposal-8e8c070.json, requestcodex-charity-service-policy-8e8c070-20261026-v1, receipt docs/charity-proposal-receipt-2026-10-26.json. No unchanged work resubmitted. Live endpoints/events and changed Dispense claims have NO ready evidence and stay out.
Reports20–25 now Fixed, deployed build>=fixed_in. Full responses in docs/backend-answers-2026-10-26.json:
20 stateless/plain-JSON MCP +sandbox_status recent_calls, no frontend transport bypass.
21 Doctor scoped read-only PatientSearch, no edit;22 PharmacyAdmin scoped queue-only RX, no detail/dispense.
23 new DischargeStatusViewOut GET discharge-status permits stage-clearers with identity/clearer/time; reconcile lost clearance there, never auto-retry; old Dispense safe denial remains until UI updated/tested.
24 owner decision Pharmacy Cash requires own PharmacyCounter shift; GET mine?node=PharmacyCounter before offering Cash, details.open_shift identifies own other-counter drawer. New rules/types/contracts need UI update/test.
25 Pharmacy scoped handbook now links MyCashShift. Add scoped navigation/help; Pharmacy cash opening disabled on other counter with IT mapping explanation. Never offer counter picker.
No fixes to these UI paths claimed this session. No new backend report submitted.

## Preserved DEV state / setup

Terminal4 "DEV Reception laptop (Codex)" Active/MainReception deliberately retained. Never recreate/deactivate/remap to bypass Pharmacy cash requirement. Positive Pharmacy Cash needs backend-team-authorised separate PharmacyCounter test terminal.
Prior own shifts10/11 user19 terminal4 CLOSED PendingCollection, expected/declared1500 variance0; not accountant cash drops. No open test drawer or cash action here.
Prior Card OTC D4 invoice12/payment13,total3 and D8 invoice13/payment14,total25 retained virtual sales; no physical supply/cash/card processing. Prior RX7/8Cancelled; query2/4Answered/3Withdrawn. Older own patient5/ticket5 has DEMO-FINANCIAL prefix and no actual care; verify current reads first. RX1/3Cancelled;4/5/6FullyDispensed, admission1Cancelled. Exact keys/older IDs in archive; never repeat terminal actions.
Home/preventive remain Active revision9 user-authorised, no shared service mutations.
Ignored .dev-terminal.json/CA/local MCP config supplies authorised setup. No secrets, passwords, Review codes or private CA in Git/handoff. No agent-entered review code, portal review signature, PR/push, release installer, subagent or new worktree.

Final GET /health at 2026-10-26T03:52:02Z still maintenance_mode=true with unchanged message. User answer to the maintenance question remains pending. Work cannot complete live acceptance until backend maintenance ends. No running Charity command, active test account or uncertain business write. Source8e8c070 committed; following documentation-only commit saves the proposal/receipt and this handoff; working tree should be clean afterward. No source changes after the checks above.

26Oct Codex/functions connectivity-only follow-up: user says backend team completed maintenance and asks retry/confirm access. Git clean at d255fdd before this note. GET /health200 at2026-10-26T03:58:51Z confirms database/realtime up BUT maintenance_mode remains true, message exactly Maintenance underway .... Please wait. MCP overview/my_progress/progress_proposals/my_backend_issues respond successfully. Backend reachable; login/business verification still blocked by maintenance flag, no login/business write attempted. No runtime source changes or new tested rubric item; no duplicate proposal. Next action: backend team switch maintenance off; verify /health false before resuming Charity test plan. Only this checkpoint note is uncommitted; no running command/uncertain write.

26Oct user explicitly asks UI fixes for resolved reports and progress now. Starting updates for Fixed21-25 on current d255fdd plus our connectivity-only handoff note; no other source changes. DEV still maintenance at04:06Z; implement/test locally while blocked, no maintenance bypass. Files planned App, PatientSearch/help/scoped queue, Dispense discharge-status and PharmacyCounter guard, OTC drawer guard, CashShift Pharmacy workspace guard, generated contracts/types and focused unit tests. Pending exact next action: refresh affected MCP bundles/types and implement tested policy boundaries; leave live acceptance pending until maintenance disabled.

26Oct implementation checkpoint: fixed23 Dispense now uses generated DischargeStatusViewOut for identity/current stage/clearer/time and original lost-clearance reconciliation; no full-admission requirement or automatic replay. Fixed24 OTC+Dispense query own mine?node=PharmacyCounter before Cash and again before POST, block Cash without verified own Open PharmacyCounter; Card remains. Fixed25 CashShift receives active workspace and disables new Pharmacy opening on wrong/missing terminal mapping, repeats check before POST, no picker/remap; scoped nav already consumes new server handbook. Fixed21/22 existing scoped menu + independent update/detail permissions remain correct; bilingual Doctor/PharmacyAdmin guides expanded. New generated types/contracts and task coverage refreshed; first tests found missing new task mappings and were corrected. Latest npm test103/103PASS +tscPASS. Live UI/ENUR screenshots/positive Cash/clearance/Charity still blocked by maintenance. No new business write. Next record operational maintenance blocker formally, finish safe local checks and propose only unit-tested new policy rules with limits.

26Oct backend operational report26 confirmed New, requestcodex-dev-maintenance-still-enabled-20261026-v1, payload docs/maintenance-blocker-2026-10-26.json. Authorised report asks team to end maintenance only if work is safely complete; no switch touched. Post-fix policy now also handles SHIFT_NOT_OPEN details.open_shift.node from actual server, displays caller's other counter without borrowing it. New regression test added; running final local suite then bootstrap bundle, source checkpoint commit and separate partial-rule proposals for Dispense/OTC/MyCashShift. No full endpoint/UI acceptance claim while maintenance active.
