# Haspataal pause checkpoint

Last update: **2026-10-24 12:00 Asia/Karachi — Codex / functions**.

## Stop condition

**PAUSED at the user's explicit request for the backend update. Make NO Haspataal HTTP, WebSocket, sandbox or MCP calls until the user explicitly says the server is back. The estimated 30–45 minutes is not authorization to resume.** Local checks and commits only during this pause. The user says their account, keys and progress will survive; do not reconnect, rotate keys, reseed or reset records speculatively.

All agent test apps have finished, restored their original preferences and logged out before this pause; no agent command, pending business write or uncertain response remains. A normal interactive terminal using the standard user profile may still be open (user-owned, not an agent test); do not kill it or discard its draft. No new server call was made after the pause instruction. No merge was submitted. The planned Registration queue-event follow-on was not started; ticket15 was NOT completed by that plan.

Git baseline: main `13b2fefe1f655b80c93ba4267b64cea7a9acdc47`. User authorized committing everything now, including the preserved earlier user/Antigravity work. Implementation commit and final local verification will be recorded below after the freeze commit. Ignored credentials, test profiles, node_modules and dist stay out of Git. Historical details/original recovery keys are preserved in `docs/HANDOFF_HISTORY_2026-10-24.md` and the exact evidence/proposal JSON files; that archive is historical, not an executable task list.

## What is complete

All19 Phase2 screen sources are present, but **Phase2 is NOT fully verified or accepted**. No Phase3 UI started. This continuation fixed and tested:

- `ICDPicker.tsx`: clear stale chosen diagnosis after query/navigation/classification changes. Real residual ordering/warnings, configured system, lost-read recovery, code-only persistence/titled readback.
- `Consultation.tsx`: show actual admission/approval handover identifiers and next steps after confirmed writes; clear stale validation on new/valid actions. Actual admission and post-consult waiver201/lost reply/same-key replay, document list/download and staff-lookup failure/retry.
- `EPrescription.tsx`: already-added draft medicines now refresh their actual stock after events/reconnect, hide stale stock/block submission on read failure, retain authored fields and invalidate changed safety acknowledgement. Actual stock300→301→300 events/error/recovery tested using ONLY a new synthetic batch; original stock untouched.
- `Registration.tsx`: visible server ceiling and explicit unpaid-slip/VIP handoff preparation; optional max_amount:null safely offers zero-discount preparation without computing a ceiling. Preparation sends no write. Actual atomic403/no patient, unpaid201, separate20% waiver, own cancellation and void verified. Actual server dues banner is rendered, but the full AR/emergency rule remains unclaimed.
- Bilingual control help updated in `src/foundation-help.ts`; new Registration preparation control covered. Current renderer **index-Cvmo-ke9.js**, coverage30screens551controls180groups33FAQseeds30workspaceguides.
- Real diagnostics: actual lab publication,15-minute worker provisional critical release and verifier withdrawal; published-only partial report/stamps/native+official PDFs. Actual imaging.report.ready/report stamp/both PDF paths. No fabricated results/events/PACS IDs/URLs.
- Actual queue socket termination/reconnect/replay/resync and own-queue reread; no queue polling.
- Actual new refund.ready/waiver.refund_order.ready numeric amounts/current-ticket blocking prompts, with NO physical cash confirmation.
- One separately uploaded synthetic outside attachment15, provenance retained; Reception/Doctor downloads only after explicit user action, separate from hospital results.

Existing accepted community work remains: home_visits and preventive_programmes Active at establishment revision4/change4, original IIB profile/other services preserved. Programme1 remains offered for DEV tests. Don't reset these user-authorized settings.

## Progress reporting / review

**Proposals86–98 were saved and independently verified Pending before the pause: awaiting human review on /docs -> My progress.** They cover37 tested items:13endpoint,9event,14rule,1quality-state. Exact immutable payload/request_id/build/evidence files are `docs/codex-*-20261024-v1.json`. Do not rewrite an already posted payload under its existing request_id or duplicate unchanged pending work.

86 ICD residual/classification/states;87 Consultation handovers/ICD endpoints;88 ICD persistence;89 refund.ready/backend14;90 Rx selected live stock;91 queue reconnect;92 refund/waiver event and Waivered payment state;93 Cash-back waiver event;94 lab/imaging reports/events/rules;95 Registration ceiling recovery;96 Consultation document reads;97 explicit document download;98 Consultation staff lookup.

There is no new completed rubric item ready but unsubmitted after98: the later merge test failed before merge, and the lab replacement was upstream fixture cleanup for already-proposed94. Do not invent an empty proposal. The user's no-server-call instruction prevents any fresh submission or verification during the outage. Already posted builds will be mapped to the frozen commit locally; don't resubmit them just to attach a hash. Any genuinely new claim after resumption must use the actual tested commit and a new request_id.

Last pre-pause MCP summary:776points,0/268 fully complete. P2 unaccepted technical items18endpoint/16event/61rule; pending proposals cover13/9/14 respectively, leaving **5endpoint/7event/47rule items not yet proposed**. Counts are a review snapshot, not proof all absent code needs building. Native human fresh-data/role/Urdu/editor/device gates remain pending for all19.

## Current unfinished step — safely stopped

`scripts/phase2-patient-merge-check.mjs` created ONLY two NEW patient-only records via Reception UI:

- master patient27 / MRN-2026-000022, `DEMO-P2-MERGE-1792824958408 master`;
- duplicate patient28 / MRN-2026-000023, `DEMO-P2-MERGE-1792824958408 duplicate`.

Both201 responses/original keys are in `docs/phase2-patient-merge-check-2026-10-24.json`. No visit, invoice, payment or merge. The test stopped because searching the common run string returned0 results rather than2; it is NOT a merge pass and is not yet classified as a frontend/backend defect. The test app finished at06:57UTC with preferences restored/logout; no cleanup error. Don't rerun its create loop or replace these records. No controller/merge POST exists. After the server is back, read IDs27/28, verify exact/alias queries and endpoint semantics, then resume ONLY these originals or report a reproduced backend issue. No issue report was made during the pause.

## Next3 steps — only AFTER the user says the server is back

1. Read this checkpoint/Git first. Refresh overview, what_changed from contract77fa54d69ee6f7aa6a6d, my_progress, progress_proposals and my_backend_issues. Verify developer mkashif / implementation1 and deployed fixes; refresh affected bundles/contracts/help. Reconcile all original writes by their saved IDs/keys; don't repeat payments/registrations.
2. Investigate the exact search failure for patient27/28; no recreating or merging unrelated/manual/financial patients. Verify the two profiles and query behavior, fix frontend only if evidenced, or report one reproduced backend issue once calls are allowed. Complete actual patient.merged/dedup/master resolution and read-only AR banner tests, then submit newly tested items with the frozen commit/new build. Registration queue-event follow-on is still only a plan.
3. Work through the remaining P2 evidence gaps in dependency order, screen by screen; submit every tested item immediately. Prepare named human worksheets/manual review, not invented approval. Remaining technical coverage includes physical cash/Rx/referral handovers, patient merge/forfeiture/clinical-lockout events, Clinic/service-state journeys, procedure/signed-consent linkage, inpatient MAR/safety privileges, and PACS. Preserve permissions and real runtime views/gates. Full P2 completion is still pending.

## Backend status / open questions

Last verified before pause: server2026-10-23T11:39:48.766011+00:00, contract77fa54d69ee6f7aa6a6d, knowledge219ae4be14f95d1b, rubricd81d43f195f8.

- #16 New/Low Documentation: Doctor checklist wrongly says only LabAdmin cancels tests; actual own-unsampled permission works. Await backend answer; don't refile unchanged.
- #14 Fixed and independently RETESTED this continuation using new refund and waiver events: numeric10/1500 confirmed. Historical string event529 stays historical; UI rereads current ticket. No new contract/code workaround needed.
- #15 Fixed/retested Owner scoped Receivables; #13 Fixed/retested demo login restoration. Refresh after update; never reset protected demo accounts.
- PACS viewer not configured on DEV; viewer_url=null is correctly handled, not a new runtime defect. Need actual IT viewer/study setup before positive PACS checks.
- Outstanding choices/review: genuine physical handover/device evidence, named language/clinical/editor review, controlled Clinic/Retired-service scenarios and signed-consent journeys. Don't change shared facility/service settings just to force a pass.

## Synthetic originals / no duplicate writes

Exact keys/bodies/responses are in `docs/phase2-*-2026-10-24.json` and old proposal/history files; these are real DEV software simulations, not care.

- patient21/MRN000018, ticket15/invoice16/payment10/Card1500 once, Finalnote4; admission1 ADM-2026-00001 AdmissionPending/no bed. Ticket15 last verified Examined. No actual admission/care.
- patient22/MRN000019, ticket16/invoice17/payment11/Card1500 once, Finalnote5; waiver3/approval13 Approved. Clinical statusExamined, payment_statusWaivered; WaiverRefund1 amount1500 UND​​ISPENSED. Approval200requestfe82d84c0cc841368baa703f013f02a3. Never confirm cash without handover.
- patient23, ticket17/invoice19/payment13/Card1500 once; refund10/approval14 Approved (200request941c690fe5664a8d9cce045afcbe17bc), ticketRefunded, cash UND​​ISPENSED. Earlier ticket13/refund1amount10 also stays UND​​ISPENSED.
- Lab requisition2 forpatient21/ticket15, items2CBC/sample2 and3RBS/sample3; invoice18/payment12/Card1050 ONCE/keye263d61a-3027-4e2a-b94d-105018000001. Actual criticalCBCresult1 provisionally released06:27:14UTC and then Rejected; normalRBS2 Published. Later legitimate re-entry on SAMEitem2 gives noncriticalCBC3 Published; final requisitionCompleted. Rejected1 retained historically. No further result/rejection/payment needed.
- Imaging2 IMG-2026-00002/accessionA161C26C07427/service10 forpatient21/ticket15: Reported with synthetic text, actual radiologist stamp; no PACS study/URL invented. Outside document15 attached separately to samepatient21.
- ORSdrug4 baseline/final300. Only new zero-cost1unit syntheticbatch12 DEMO-P2-STOCK-20261024-1 created and its own1unit removed/movement13. Original batches untouched; own batch is empty. Keys12e78d94-6e60-4503-a4d0-002410240001 and...0002. No medicine dispensed or Rx created in stock test.
- patient26/ticket18: one unpaid slip after confirmed403; waiver4/approval15 Cancelled by original requester; ticket18 Void, no money/token. Don't recreate it.
- Prior patient18/ticket14/invoice14/Card1500 once/queue8 remain Completed; Finalencounter1/v5/correction1. Rx1/2, lab1 and imaging1, referral1 Cancelled; education1/2 append-only. Don't run older scripts requiring ticket14 Examined.
- Prior AR patient16/MRN000014/invoice12/AR1: due1440/paid10/written_off10/balance1420 last verified; don't repeat financial actions. Owned user34 remains inactive/original roles/preferences restored.
- Earlier community patient18: programme1 with closed enrolments1TransferredOut/2Completed/3Discontinued, entries1/2 retained; immutable Home1original+2corrective unchanged. See history for exact keys; never recreate.

## Local verification / environment

Final OFFLINE pause checks: `npm run build` PASS30screens551controls180groups33FAQseeds30workspaceguides+TypeScript/Vite, rendererindex-Cvmo-ke9.js; `npm test`64PASS; `git diff --check`PASS. No DEV/live check was run after the pause instruction. Vite size warning remains. Live integration checks listed above predate the pause and MUST NOT rerun while backend is down. Foundation/live baseline checks were historical, not rerun this continuation. Failed merge test is explicitly pending, not hidden by passing unit/build checks.

Cloud DEV https://hms-dev.netbird.cloud (never old192.168.10.4); authorized ignored `.dev-terminal.json`/CA and project-local MCP configuration supply connection details. No credentials in this file. node_modules/dist/artifacts/test profiles stay ignored. No subagents used. No app source edit or business write is half-applied; remaining work is verification/investigation, human acceptance and backend setup.
