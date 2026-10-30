# Haspataal checkpoint
Last updated: 30 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active new screen request
Completed Screen 76 `blood_donors` ("Blood donors" for Lab & Blood Center workspace `lab_tech` / `blood_bank`, Phase 4 Inpatient Journey).
Previous screen: Position 75 `blood_bank` (Proposal #227 pending).
Next screen: Position 77 in Phase 4 Roadmap.

- Current status: Screen 76 completed, verified live (200 OK), 274/274 tests passing, check:help passing (75 screens), build passing (`index-CH-J_ACq.js`). Committing and proposing progress.
- Completed checkpoints:
  1. Saved contract bundle in `contracts/blood_donors.json` (5 endpoints, realtime events, 58 points).
  2. Generated typed API contracts in `src/generated/blood_donors.ts`.
  3. Implemented domain policy in `src/blood-donors-policy.ts`:
     - Access gating by screen view (`full`, `open_work`, `records`, `setup`, `hidden`), capability (`establishment.active.includes('blood_center')`), and permissions (`blood_center.view`, `blood_center.donor.register`) (`rule:6a58b93e99`, `rule:5850958062`).
     - Search validation rule (`rule:71bc3f69b3`): search first (`q`, min 2 chars: donor number, CNIC, mobile, or name).
     - Registration validation rule (`rule:40349aea7e`): legal full name, sex (Male/Female), date of birth (17-70 years), identity document (CNIC, Passport, Proof of Registration, Other), and at least one contact (phone, email, or address).
     - Lifetime donor rules (`rule:71bc3f69b3`, `rule:40349aea7e`): donor is registered once for life. Duplicate registration intercepted by `BLOOD_DONOR_EXISTS` and automatically opens existing record.
     - Eligibility and deferral evaluation (`rule:d7bf9e8097`): permanently deferred donors must never be bled (never offer 'Donate' action); temporary deferrals display active banner with earliest permitted date (`may_donate_from`). Opening record is logged for audit under PBTA Act s.10.
     - Correction validation rule (`rule:73b2977f2f`): requires mandatory reason (5-500 chars), expected_version concurrency control; immutable donor number cannot be changed.
  4. Implemented full screen in `src/screens/BloodDonors.tsx`:
     - Real-time `establishment.changed` listener.
     - Retiring banner for `open_work` ("No new donor registrations from now on"); records mode for `records`.
     - Search-first interface with min 2 chars validation and audit notice.
     - Search results table with donor number, demographics, identification, blood group, donation count, and eligibility badges.
     - Detailed inspection card with audit logging banner, eligibility alert, deferral history table with author stamps, and donation history table.
     - Register donor modal with client validation and idempotency protection (`useClinicalWrite`).
     - Correct particulars modal with mandatory reason and concurrency versioning.
  5. Wired routing, screen labels, view filters, and navigation in `src/App.tsx`.
  6. Registered 5 tasks in `src/foundation-catalogue.json` (75 screens) and mapped in `src/foundation-task-map.json`.
  7. Added 29 `blood_donors.*` control guides and added `"blood_donors"` to `deliveredHelpScreens` in `src/foundation-help.ts`.
  8. Authored bilingual English/Urdu screen help, 8 steps, and 7 role FAQs in `src/help.ts`.
  9. Bundled reference screenshots `public/handbook/blood_donors-en.png` and `public/handbook/blood_donors-ur.png`.
  10. Authored unit tests in `tests/blood-donors.test.mjs` (3 test suites) and updated `tests/help-coverage.test.mjs` (75 screens).
  11. Verified live DEV endpoints with real auth (`POST /auth/login` as `demo.labtech`, `GET /blood-center/donors?q=Ali` -> 200 OK, `GET /establishment` -> 200 OK with `blood_center` view `full` and active capability).
  12. Full verification suite:
      - `npm run check:help`: PASS (75 screens, 1553 controls, 693 groups, 69 FAQ seeds, 30 workspace guides).
      - `npm run build`: PASS (`index-CH-J_ACq.js`, tsc + Vite production bundle).
      - `npm test`: PASS (274/274 tests passing).
  1. Saved contract bundle in `contracts/blood_bank.json` with 15 endpoints, 5 realtime events, and definitions.
  2. Generated typed API contracts in `src/generated/blood_bank.ts` (15 typed methods).
  3. Implemented domain policy in `src/blood-bank-policy.ts`:
     - Access gating by screen view (`full`, `open_work`, `records`, `setup`, `hidden`), capability (`establishment.active.includes('blood_transfusion')`), and permissions (`blood.view`, `blood.bank.operate`, `blood.bank.manage`).
     - Safe temperature range validation for storage checks (`rule:970c05860c`): Blood Refrigerator (+2°C to +6°C), Plasma Freezer (<= -25°C), Platelet Agitator/Incubator (+20°C to +24°C). Mandates documented `action_taken` when out of range (`STORAGE_CHECK_ACTION_REQUIRED`).
     - TTI screening verification (`rule:82db038331`): `screened` checkbox cannot be pre-ticked; unscreened units are refused.
     - FEFO sorting and expiry flagging (`rule:cdfdb93c8e`): soonest expiry first; expired bags highlighted in red with Discard action. Emergency requests prioritized at the top of worklist.
     - Dual sign-off for issue (`rule:7378206488`): bedside issue requires collecting nurse/doctor credentials (`collector_username`, `collector_password`), enforcing `STEP_UP_REQUIRED` and `ADMINISTRATION_NOT_AUTHORIZED`.
     - 30-minute return window (`rule:0e8d0a52ed`): units returned within 30 minutes with cold chain intact return to stock (`fit_for_use: true`); otherwise marked `NotGiven` with reason and discarded.
     - Input validators for unit intake, crossmatch test, discard, return-to-source, issue, returned unit sign-in, and storage check.
  4. Implemented full screen in `src/screens/BloodBank.tsx`:
     - 4 tabs: `stock` (inventory with FEFO sorting, expiry badges, discard/return actions, filter by ABO/Rh and component), `receive` (intake from licensed source with un-ticked screened checkbox, bag barcode, component, volume, expiry, batch), `worklist` (clinical blood requests with priority emergency sorting, crossmatch modal, issue modal with collector step-up credentialing, close request), `storage` (temperature log table, chart/out-of-range alerts, new check modal with auto-flagging and action taken, A4 PDF download button).
     - Modals: Discard Modal (`POST /blood/units/{id}/discard`), Return to Source Modal (`POST /blood/units/{id}/return-to-source`), Crossmatch Test Modal (`POST /blood/requests/{id}/crossmatches`), Issue Modal (`POST /blood/requests/{id}/issue` with collector co-sign credentials), Return Signing Modal (`POST /blood/transfusions/{id}/return` within 30 min window), Storage Check Modal (`POST /blood/storage-checks`).
     - Real-time reactive listeners for `blood.request.created`, `blood.consent.withdrawn`, `blood.storage.out_of_range`, `blood.reaction.reported`, `blood_center.component.released`, and `establishment.changed`.
     - Retiring mode banner for `open_work` view; read-only mode for `records`.
     - Idempotent safe writes via `useClinicalWrite`.
  5. Wired routing, screen labels, view filters, and navigation in `src/App.tsx`.
  6. Registered 7 tasks in `src/foundation-catalogue.json` (74 screens) and mapped in `src/foundation-task-map.json`.
  7. Added 50 `blood_bank.*` control guides and added `"blood_bank"` to `deliveredHelpScreens` in `src/foundation-help.ts`.
  8. Authored bilingual English/Urdu screen help, 8 steps, and 7 role FAQs in `src/help.ts`.
  9. Bundled reference screenshots `public/handbook/blood_bank-en.png` and `public/handbook/blood_bank-ur.png`.
  10. Authored unit tests in `tests/blood-bank.test.mjs` (3 test suites) and updated `tests/help-coverage.test.mjs` (74 screens).
  11. Verified live DEV endpoints with real auth (`POST /auth/login` as `demo.labtech`, `GET /blood/units` -> 200 OK, `GET /blood/requests` -> 200 OK, `GET /blood/storage-checks` -> 200 OK, `GET /blood/sources` -> 200 OK, `GET /establishment` -> 200 OK).
  12. Full verification suite:
      - `npm run check:help`: PASS (74 screens, 1524 controls, 664 groups, 69 FAQ seeds, 30 workspace guides).
      - `npm run build`: PASS (`index-efr3Zcfn.js`, tsc + Vite production bundle).
      - `npm test`: PASS (271/271 tests passing).

- Files involved:
  - `contracts/blood_request.json`
  - `src/generated/blood_request.ts`
  - `src/blood-request-policy.ts`
  - `src/screens/BloodRequest.tsx`
  - `src/App.tsx`
  - `scripts/check-help.mjs`
  - `src/foundation-catalogue.json`
  - `src/foundation-help.ts`
  - `src/foundation-task-map.json`
  - `src/help.ts`
  - `public/handbook/blood_request-*.png`
  - `tests/blood-request.test.mjs`
  - `tests/help-coverage.test.mjs`
  - `handoff.md`

- Next concrete step: Fetch bundle for Position 75 `blood_bank` (`get_screen_bundle('blood_bank')`) and begin implementation.

## Prior task and Git
- Clean working tree on branch `main` at commit `b7781fe11508309a2e4428c481239e1db55ccefe` (21 commits ahead of `origin/main`).
- Proposal #227 (`blood_bank`) awaiting human review on /docs -> My progress.
- Proposals awaiting human review on /docs -> My progress: #208–#227.

## Backend gaps
#50 New: employment status activation omits its EMPLOYEE_DOCUMENT_REQUIRED refusal.
#51 New High: own waiting CodeRed admission 4 never emits vitals.due.
