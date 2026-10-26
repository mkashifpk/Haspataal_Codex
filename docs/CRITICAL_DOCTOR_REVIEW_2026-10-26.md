# Doctor — Critical results to acknowledge

Phase3 position41, Codex26October2026, clean baseline `24d9e1f`. Source commit and proposal recorded in `handoff.md` after submission. Implementation and agent tests are complete for this step; named human workspace acceptance is pending.

## Purpose and implementation

The treating doctor opens this screen when a released Lab or Imaging critical result arrives for their patient, assesses the patient, opens the actual report, and records the action taken as a final acknowledgement. Reused project queue/detail, reviewed-write, permission/service, F1 and zoom patterns keep identity and finality explicit. The alert stays in the permitted workspace while staff navigate, rather than depending on a filtered history screen. No decoration, clinical deadline, care, acknowledgement or success is invented.

- `src/screens/CriticalResultsDoctor.tsx`: actual mine=true/open_only=true log by default, source/status/date/bounded-limit filters, local returned-record search, exact known-ID detail and mine=true CriticalToAcknowledge worklist. Loading/error/stale/empty states distinguish current data. Known-ID reads are not interpreted as treating eligibility.
- `DoctorCriticalAlert` in `src/App.tsx`: separate unfiltered mine/open read persists across permitted workspace pages and history filters until a fresh read confirms none remain. Failed checks preserve the last alert with a not-current marker and retry. Actual critical events/reconnect refresh without polling; alarm checks server-confirmed mine membership.
- Exact patient/MRN/finding/doctor/ward/bed/release author/time/server deadline/overdue/escalation/authority context, real communications and separate physician acknowledgement author/time/action. Acknowledged is final, no edit/delete/second acknowledgement.
- Reviewed action_taken3–2000characters and original expected_version; fresh actor/permission/service/exact identity/report/version/history preflight. Single flight; stale/final/permission/treating-refusal codes refresh current context. A lost reply locks dialog/Escape/navigation and offers ONLY exact read reconciliation, never replay. No success inferred from a missing queue row. Exact returned identity is required to release a hold.
- Actual Lab requisition/Imaging-order report link, fresh context and permission check; existing secure native server-PDF preview and single-PDF save. Cancellation/failure never repeats or acknowledges clinical work. No ZIP or report fixtures substituted in the UI.
- `src/critical-acknowledgement-policy.ts`, exact generated types/full MCP bundle, `electron/critical-alarm.cjs`/main native mine/source/workspace/actor/view checks for doctor/anaesthesia. Laboratory alarm scope remains Lab-only; unrelated workspaces denied.
- English/Urdu authored screen/control/task/workspace and critical-state/error FAQs, actual screenshots and help inventory/build gate; contextual F1 and shared100–250%zoom. Nine new control groups,39FAQseeds total. Urdu/design-system ownership/editor/device acceptance remain human-owned(H08/H09/H10); no human Review code entered.

## Verification and actual records

`npm test`: **137/137PASS** after final changes. `npm run build`: **PASS**, includes TypeScript + mandatory help coverage41screens/780controls/286groups/39FAQseeds/30workspaceguides. Syntax checks and Git diff checkPASS. Existing bundle-size warning remains. Local early TypeScript/import/help-authoring errors were corrected before these final passes, not backend defects.

Owned real DEV run **DEMO-CRITICAL-DOCTOR-1793033826259**: guarded journal `artifacts/critical-doctor-check.json`, PASS17:02:30UTC. Never overwrite/restart this journal or repeat terminal writes. Existing synthetic patient5/ticket5 ownership/current state verified before reuse. NEW requisition6/invoice25 virtualCard, technician-authored RBSresult11/NS1result12 independently published by verifier, critical5/6. NEW Imagingorder1 independently processed/reported by a radiologist fixture, critical7. All three are now **Acknowledged** by the doctor UI; priority-disease authority_pending=false after a separate verifier communication. No real care/specimen/money/exposure/call/external notification occurred; record text explicitly identifies SOFTWARE SIMULATION ONLY.

Passed through actual DEV:

1. Lab critical Opened events, mine log/worklist and two native alarm dispatches. Sticky alert survives empty history filters and navigation to workspace home/back. It clears only after actual acknowledgements/current reads.
2. Blank action rejected before POST; actual stale expected_version409VERSION_CONFLICT; actual concurrent communication invalidated frozen UI confirmation BEFORE another POST. F1 retained action/draft/focus.
3. Actual linked Lab report PDF preview and cancelled save, no acknowledgement side effect. Lost200/double-click yielded ONE versioned POST; no Retry original request; Escape stayed locked, exact read/history/status/action reconciliation released it. Separate direct acknowledgement before a phone call, actual final-state refusal, and separate authority notification duty after physician acknowledgement.
4. New upstream Imaging critical event with mine alarm, actual linked Imaging PDF preview and final doctor UI acknowledgement. Radiology source steps are test fixtures; no Radiology screen completion claimed. No master records/services/terminals modified.
5. Failed selected reads hide old patient context, exact retry/history filter/known-ID read; real WebSocket reconnect rereads log/worklist/current detail. A handled result cannot sound. Cashier has no scoped page and native acknowledgement is refused before HTTP.

All five isolated profiles preferences-restored/signed-out; raw radiologist fixture logged out. No unknown writes. `docs/critical-doctor-live-evidence-2026-10-26.json` is a credential-free summary; original request keys/bodies remain in ignored journals/transports.

Business/event suite used `index-BASPzTjM.js`. Final **`index-DMFfAUPU.js`** adds translated communication method/role labels only. Final read-only suitePASS exact Doctor F1 purpose/scope, identity/history/finality/no pending alert, actual Urdu labels, both themes250%layout, actual EN/UR media, native100–250%bounds/reset; ZERO business writes. Profile restored/signed-out. Evidence `docs/critical-doctor-readonly-evidence-2026-10-26.json`; actual screenshots inspected and bundled by the final mandatory build. No full business-suite rerun on the later renderer is implied.

## Limits / backend

Server build2026-10-26T01:17:08.510356+00:00; contract90f7a429e5aa519d440f; knowledgef2f42e3079bc34a3; rubric1f3d8a4d9746. Startup guide/overview/roadmap/progress/proposals/feedback/issues, full screen bundle(no omissions), quality/design/workspace outline, exact endpoints/types/validation, event and diagnostic workflow recipe were read.160–163selected reported progress accepted at startup; no signed human workspace review returned.

No new backend defect reproduced.27/28/29 remainNew/no response at startup: label GET side effects/docs, receptionist publication audience, verifier queue/context/recovery. No duplicate reports submitted. Previous23Pharmacy clearance/lost-answer and positive PharmacyCounterCash checks remain separate pending work.

Still pending: actual CRITICAL_RESULT_ACKNOWLEDGER_INVALID fixture (no shared staff eligibility changed to force it), physical alarm audibility (native beep was instrumented), fresh pending-alert layout at250%/busy-hour/device review, real escalation timing, shared service lifecycle mutations, named human fresh-data journey/Urdu/complete role FAQ/editor review. Policy unit cases cover full/open_work/records/hidden/setup/unknown; real full view tested, no shared service mutation. Do not claim full test-plan or screen/workspace/phase acceptance. Compulsory human items and full test-plan remain unproposed; any rule containing an unverified acceptance requirement is left pending.

## Manual review

1. Sign in as the treating doctor and open **Critical results to acknowledge**. For saved software examples turn **Not yet acknowledged only** off and read actual critical IDs5/6(Lab) and7(Imaging). They are final; inspect author/action/history and actual report without trying to acknowledge them again.
2. Create a fresh explicitly synthetic Lab/Imaging journey with independent release. Verify the doctor's sticky alert on other workspace pages and real audible alarm, exact patient/report, action validation and review. Record only an actual labelled software simulation; never real treatment or authority notifications for a test patient. Confirm once and check final author/action/status; physician acknowledgement does not fulfil a separate authority duty.
3. Test draft cancellation/F1/focus, English/Urdu/both themes100–250%zoom including a pending alert, network/read failures and authorised/denied treating accounts. Follow the handbook for lost replies: exact read reconciliation only, no retry. Human alone enters the DEV Review code and starts/signs portal acceptance.

Next sequential screen is expected Phase3 position42 `lab_send_outs`; query the current roadmap/bundle before starting. No next screen started here.
