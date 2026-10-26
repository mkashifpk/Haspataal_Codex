# Zakat / Charity Override — implementation checkpoint

Status: real DEV automated verification passed 26 October 2026, run DEMO-CHARITY-1793006419214, renderer index-CroqvzrG.js. Human acceptance remains pending. See charity-evidence-2026-10-26.json. RX12/13 fully dispensed virtually (D9/D10); unusedRX14 Cancelled. Approvals6/7 Approved,8 Rejected,9 Cancelled. No pending test approval or uncertain write; all isolated accounts signed out and preferences restored.

Fixed a live-discovered frontend defect: while sending, show a pending message; only show unknown/retry after the request stops without a definite result. This is covered by the actual lost-reply run. Queued and counter co-sign lost201/double-click/replay tests pass; changed original password refused locally, plaintext redacted; actual STEP_UP_REQUIRED and permission denial pass. Independent officer UI decisions, exact assistance-to-Dispense identity/fund handoff and wrong-fund refusal pass. Real socket approval event and reconnect list/detail refresh, bounded/no-match/stale-list states, F1 field/dialog/focus preservation, both languages/themes at250% and native zoom bounds/reset pass. Actual EN/UR handbook screenshots captured and visually inspected. ACCOUNT_LOCKED remains unit-only; no shared account deliberately locked. Named human/translation/editor/physical acceptance remains pending.

Earlier interrupted run DEMO-CHARITY-1793006207568 was reconciled before rerun: actual approval5 Cancelled and RX9/10/11 Cancelled with zero dispensing. The sections below preserve earlier implementation context; maintenance blocker26 is now Fixed and retested OFF. Mandatory full build still needs Lab-only/Bench screenshots, not Charity media.

The screen opens from Pharmacy → Zakat / charity override, or from an existing prescription in Dispense → Request Zakat / charity assistance. It supports Zakat and Social Welfare, a required reason, queued approval or an independent officer's counter co-sign. It reads current decisions, refreshes on approval events and reconnect, and hands matching approved assistance to a separate Dispense review. It never selects a supply quantity automatically or treats approval as cash movement.

Co-sign passwords clear after each attempt and are excluded from retained requests and transport journals. An uncertain result keeps the original key and nonsecret body; the original officer must re-enter the identical password for an explicit retry. No replacement request or automatic retry is sent. These live recovery paths still need verification.

## Verification completed on 26 October

- npm test: 99/99 passed, including four Charity policy/security tests and the negative help-control coverage test.
- npx tsc --noEmit: passed.
- Development bootstrap build: passed, index-CDbFS4j1.js. This does not replace the mandatory build.
- MCP validate_request: queued request and bounded own-request list valid; current contracts/types refreshed.
- git diff --check: passed.

The mandatory npm run build is blocked by missing actual Charity English/Urdu handbook screenshots. The check remains enabled. Both live test attempts stopped before login or any business write: first connectivity timeout, then confirmed maintenance. GET /health on 26 October reports maintenance_mode=true and exactly "Maintenance underway .... Please wait." No maintenance setting was changed and no Review code was entered.

## Next automated verification

Once maintenance ends, reconcile artifacts/charity-check.json and per-role profiles, then run node scripts/charity-check.mjs. Never rerun a nonempty unfinished journal. The planned test creates three owned synthetic prescriptions, verifies queue approval, counter Social Welfare co-sign, actual refusal, lost replies with original-key recovery, separate virtual supplies, rejection/cancellation, live events/reconnect, scope denial, F1 and bilingual zoom/layout. It records original keys before writes. All test business records must be reconciled and terminal; no real care, money or physical medicines.

Capture and visually inspect public/handbook/charity_override-en.png and charity_override-ur.png from that actual app session, then run npm run build and npm test. ACCOUNT_LOCKED is currently unit-tested only; do not deliberately lock shared demo accounts. Service lifecycle tests are currently policy-unit tests; shared lifecycle mutation, named human fresh-data review, translation review and editor acceptance remain pending.

## Human checks after automated verification

1. On a fresh synthetic outpatient prescription, request Zakat assistance without counter co-signing. Confirm Pending is visible and does not authorise supply.
2. Have an independent authorised officer approve it through their approval queue. Confirm the pharmacist's decision updates live.
3. Use approved assistance in Dispense. Verify the exact patient, prescription, fund and approval ID; enter quantities explicitly, review and confirm separately. Check the actual supply receipt.
4. Repeat with counter co-signing and Social Welfare. Have the officer enter their own credentials; confirm the password clears. Check rejection/cancellation and mistaken-fund refusal.
5. Test F1 from fields/dialogs, Urdu, both themes, zoom limits/reset and unsaved-work cancellation.

Workspace reviews are started and signed only by the human in the DEV portal. Only the human enters a Review code in Settings → This terminal. No agent supplies a real or synthetic review code.

## Backend answers

Reports #20–25 are now Fixed in the deployed build; full responses are saved in backend-answers-2026-10-26.json. They cover MCP transport recovery, Doctor patient-search scope, Pharmacy Admin queue scope, discharge-status access and Pharmacy cash counter/scoped drawer access. Their UI retests and any required changes remain pending after Charity verification. Keep terminal 4 mapped to MainReception. Positive Pharmacy Cash requires a separately authorised PharmacyCounter test terminal; never remap terminal 4 or borrow a drawer.
