# Haspataal checkpoint — 26 October 2026

Codex/functions, Asia/Karachi. Latest source187eeff (DEV bootstrap index-BEf7ZcTK.js). Previous backend UI source3042fec, Charity8e8c070, documentationf71b15c. Following commit only saves proposal155 and this checkpoint. Full previous history: docs/HANDOFF_LAB_WALKIN_DEVELOPMENT_2026-10-26.md, HANDOFF_BACKEND_UI_DEVELOPMENT_2026-10-26.md and earlier archives. No unrelated changes discarded.

## Current request / result

User authorises further work one screen at a time while maintenance blocks verification and asks to be reminded later. Selected current roadmap P3 position36 Lab-only walk-in (Reception); Pharmacy own-medicines is P4 and was not started.
Lab-only implementation checkpoint complete, locally tested; live acceptance pending. Do NOT claim a fully completed screen/workspace/phase. Last /health200 at2026-10-26T04:56:28Z has database/realtime up BUT maintenance_mode=true, exact message "Maintenance underway .... Please wait." Report26 still New/no answer at closing. No maintenance switch/bypass, login or business write attempted.

## Reminder — confirmed

Hourly thread heartbeat ACTIVE, automation ID: resume-blocked-haspataal-checks.
It watches health/handoff without business writes or Review codes, stays quiet while unchanged, reminds when maintenance clears, and reminds once on the next day after26Oct if still blocked. Includes21–25 UI retests, Charity, Lab-only, actual ENUR media and mandatory build. User can manage the automation card in this chat.

## Implemented checkpoints

-187eeff: src/screens/LabOnlyWalkIn.tsx, lab-walkin-policy.ts, generated/lab_only_walkin.ts, contracts/lab_only_walkin*.json, App scoped route/menu; bilingual page/control/task/Reception guidance and coverage.
Name/mobile only required; optional tests/priority/referrer/notes; zero-test identity does not depend on catalogue availability. InHouse/SendOut independently follow Active laboratory/outsourced_diagnostics. Partner shown; no local final-price total, OPD ticket or doctor queue.
Separate reviewed original-key registration and invoice collection. Current actor/permissions/service/catalogue or exact invoice/patient/version/lock/balance rechecked. Explicit same-key replay after unknown result, never replacement/re-registration; cash needs caller own mapped open drawer. No credit/permission bypass.
Actual master patient/flags, bounded1–200 requisitions, exact Lab bill/receipt/server balance, verified partial/complete report with stamps/partner/corrections. Existing native diagnostic A4/renderedPDF/serverPDF bridge reused; failed/cancelled printing never repeats registration/payment. No unsupported edit/delete/unsigned release.
-3042fec: resolved23 Dispense limited discharge-status identity/stage/clearer/time and lost-result reconciliation; no full admission permission or automatic replay.24 OTC/Dispense own Open PharmacyCounter filtered read before Cash +fresh preflight; Card preserved and actual other-counter drawer explanation.25 CashShift Pharmacy opening guard from active workspace +fresh mapping check, no picker/remap.21/22 scoped menu/independent permissions already compatible; Doctor read-only PatientSearch/PharmacyAdmin queue-only guides refreshed. Live retests pending.
-8e8c070 Charity queue/counter co-sign/exact approved handoff; password clearing/original-officer re-entry and original-key uncertainty safeguards. Live workflows pending.

## Checks / limits

Final npm test109/109PASS, TypeScriptPASS, git diff --checkPASS. Four new Lab-only policy tests cover minimal name/mobile/no-test identity, independent service/catalogue gates, permissions/full-versus-records and exact eligible invoice/payment/stale reviews. Negative confirmation help mapping test passes. Existing104 tests retained.
Bootstrap Vite index-BEf7ZcTK.js PASS; existing chunk-size warning. Mandatory npm run build STOPPED at missing actual Lab-only EN screenshot; UR and prior Charity media also pending. No gate disabled or fake image.
MCP startup progress/proposals/issues/overview/guide/roadmap, full bundle including omitted handbook/decisions/examples/schemas, generated types/endpoint contracts, quality/design/Receptionoutline/recipe/testplan read LIVE. Initial read-only MCP transport failures recovered on retry, no write uncertainty. validate_request minimal zero-test registration PASS; no real registration executed.
No authenticated browser/API journey, live events/reconnect, replay, cash/payment/report/print, F1/zoom/layout/Urdu or named human/translation/editor acceptance claimed. No new synthetic business IDs, active account, shared service mutation or Review code/portal signature.
Manual/fresh journey docs/LAB_ONLY_WALKIN_REVIEW_2026-10-26.md; earlier docs/CHARITY_REVIEW_2026-10-26.md and BACKEND_UI_FIXES_2026-10-26.md.

## Progress / backend

DEV https://hms-dev.netbird.cloud; server_build2026-10-26T01:17:08.510356+00:00, contract90f7a429e5aa519d440f, knowledgef2f42e3079bc34a3, rubric1f3d8a4d9746; implementation1/mkashif.
Proposal155 Lab-only confirmed PENDING by progress_proposals: awaiting human review on /docs -> My progress. ONLY locally unit-tested name/mobile and independent InHouse/SendOut Active-gate rules proposed, not endpoints/events/full UI/testplan/human completion. Payload docs/lab-only-proposal-187eeff.json, requestcodex-lab-only-policies-187eeff-20261026-v1; receipt docs/lab-only-proposal-receipt-2026-10-26.json. No prior Lab-only proposal existed. No unchanged accepted/pending claims resubmitted.
151Charity,152Dispense,153OTC,154MyCashShift prior partial local-policy proposals pending;109CashShift/133Settings previously pending.150OTC149Dispense148OrderQueries selected older items accepted. These are not full screen approvals.
Reports20–25 Fixed on deployed server, answers in docs/backend-answers-2026-10-26.json. Frontend21–25 live retests remain pending.20 requires no terminal transport change; MCP reads/proposals work, no lost-write retest claimed.
26 maintenance operational follow-up New/no answer; requestcodex-dev-maintenance-still-enabled-20261026-v1, payload docs/maintenance-blocker-2026-10-26.json. No additional backend defect reproduced/reported during Lab-only work.

## Next3 / reconciliation

No running command, test account or uncertain write. Current artifacts/charity-check.json DEMO-CHARITY-1792986301658 finished before any write: writes={} and prescriptions/approvals/dispensations empty; charity-pharmacist signed_out/preferences_restored. cleaned flag still unset.
1. Once /health maintenance_mode=false, read26/what_changed and reconcile prior journal/profile. Only if finished and ALL write/record arrays empty mark startup-only journal cleaned. Run scoped Doctor PatientSearch/PharmacyAdmin queue/Pharmacy MyCashShift and updated Dispense/OTC reads/F1 smoke tests.
2. Run Charity original-key journaled fresh workflow, then fresh Lab-only registration/separate collection/report journey from review docs. Verify own patient5/ticket5 identity before reuse or create fresh authorised records if reset; never guess IDs or repeat unfinished writes. No Lab-only test script/business IDs exist yet. Journal before every new business write. Actual report publication requires authorised lab workflow; no invented signed result.
3. Test23 fresh owned discharge and24/25 positive Cash on a separately authorised PharmacyCounter test terminal, capture/inspect actual ENUR media, mandatory build/tests, commit and propose only additional verified changes. Human enters Review code/signs acceptance; never agent.

## Preserved state / setup

Terminal4 "DEV Reception laptop (Codex)" Active/MainReception deliberately retained: never recreate/deactivate/remap. Positive Pharmacy Cash needs backend-team-authorised separate PharmacyCounter test terminal. No open owned drawer.
Own shifts10/11 user19terminal4 CLOSED PendingCollection expected/declared1500 variance0, not accountant drops. Prior virtual OTC D4 invoice12/payment13/total3 andD8 invoice13/payment14/total25 retained. No real care/money/card processing/supply.
Prior RX7/8Cancelled; queries2/4Answered3Withdrawn; RX1/3Cancelled,4/5/6FullyDispensed, admission1Cancelled. Own patient5/ticket5 starts DEMO-FINANCIAL with no actual care; verify current identity first. Exact old keys/IDs in archives; never repeat terminal actions.
Home/preventive Active revision9 user-authorised, unchanged. Ignored .dev-terminal.json/CA/MCP config supplies setup; no secrets/passwords/Review codes/private CA or local profiles in Git.
Source187eeff committed; following documentation-only commit saves this checkpoint/proposal receipt. Expected clean tree afterward; no PR/push/installer/worktree/subagent.
