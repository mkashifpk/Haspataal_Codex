# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 97 `verbal_orders_er` Complete -> Next Screen 98 `critical_results_er`
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 91: **`triage_scale`** ("Emergency triage scale and assessment", Position 91, 55 points) — **COMPLETED** (commit `fb479e0`, Proposal **244** awaiting human review on `/docs -> My progress`).
- Screen 92: **`er_board`** ("Emergency room tracking board", Position 92, 62 points) — **COMPLETED** (commit `5eb27cf`, Proposal **245** awaiting human review on `/docs -> My progress`).
- Screen 93: **`er_visit`** ("ER visit: triage, stages & departure", Position 93, 84 points) — **COMPLETED** (commit `685b317`, Proposal **246** awaiting human review on `/docs -> My progress`).
- Screen 94: **`code_red`** ("Emergency Code Red resuscitation intake and alerts", Position 94, 60 points) — **COMPLETED** (commit `cd09192`, Proposal **247** awaiting human review on `/docs -> My progress`).
- Screen 95: **`trauma_merge`** ("Trauma profile merge", Position 95, 45 points) — **COMPLETED** (commit `ad67ac1`, Proposal **248** awaiting human review on `/docs -> My progress`).
- Screen 96: **`wristbands_er`** ("Emergency Department Patient Identification Wristbands", Position 96, 54 points) — **COMPLETED** (commit `d917901`, Proposal **249** awaiting human review on `/docs -> My progress`).
- Screen 97: **`verbal_orders_er`** ("Emergency Department Verbal and Telephone Orders", Position 97, 52 points) — **COMPLETED** (commit `d6ac583`, Proposal **250** awaiting human review on `/docs -> My progress`).
- Screen 98: **`critical_results_er`** ("Emergency Department Critical Communication", Position 98, 39 points) — **NEXT UP**.

### Completed Screens Checkpoint
- Screen 84: **`newborn_registration`** (commit `00e120f`, Proposal **237** awaiting human review on `/docs -> My progress`).
- Screen 85: **`labour_register`** (commit `91e0bbd`, Proposal **238** awaiting human review on `/docs -> My progress`).
- Screen 86: **`medication_safety_ward`** (commit `ff51508`, Proposal **239** awaiting human review on `/docs -> My progress`).
- Screen 87: **`ward_transfer`** (commit `07a2db0`, Proposal **240** awaiting human review on `/docs -> My progress`).
- Screen 88: **`ward_transfer_head_nurse`** (commit `79efd60`, Proposal **241** awaiting human review on `/docs -> My progress`).
- Screen 89: **`ward_indent`** (commit `0749c48`, Proposal **242** awaiting human review on `/docs -> My progress`).
- Screen 90: **`discharge_summary`** (commit `0a4d651`, Proposal **243** awaiting human review on `/docs -> My progress`).
- Screen 91: **`triage_scale`** (commit `fb479e0`, Proposal **244** awaiting human review on `/docs -> My progress`).
- Screen 92: **`er_board`** (commit `5eb27cf`, Proposal **245** awaiting human review on `/docs -> My progress`).
- Screen 93: **`er_visit`** (commit `685b317`, Proposal **246** awaiting human review on `/docs -> My progress`).
- Screen 94: **`code_red`** (commit `cd09192`, Proposal **247** awaiting human review on `/docs -> My progress`).
- Screen 95: **`trauma_merge`** (commit `ad67ac1`, Proposal **248** awaiting human review on `/docs -> My progress`).
- Screen 96: **`wristbands_er`** (commit `d917901`, Proposal **249** awaiting human review on `/docs -> My progress`).
- Screen 97: **`verbal_orders_er`** (commit `d6ac583`, Proposal **250** awaiting human review on `/docs -> My progress`).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, **247**, **248**, **249**, and **250** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 97 (`verbal_orders_er`)
- `contracts/verbal_orders_er.json`: Screen contract bundle with endpoints (`POST /prescriptions/verbal`, `GET /verbal-orders`, `GET /drugs/search`), events (`medication.order.updated`, `pharmacy.stock.updated`), and domain rules (`rule:b72c59a315`, `rule:06cf997499`, `rule:21e60a9c9a`, `rule:0f229c1efb`, `rule:7cbb490706`).
- `src/generated/verbal_orders_er.ts`: Generated TypeScript contracts.
- `src/verbal-orders-er-policy.ts`: Permission gating, service view evaluation, dispensing capability checks, target patient validation (emergency ticket or admission required; outpatients and deceased rejected), line safety checks (chemotherapy prohibited), and overdue countersignature calculation.
- `src/screens/VerbalOrders.tsx`: Extended and parameterized `VerbalOrders` with `screenId="verbal_orders_er"`. Supports active ER visits list (`GET /er/board`), patient identity badge (two identifiers, age, sex, ER number, ticket/admission reference), verbal orders history with overdue badges in red, and safe clinical order drafting with doctor search, formulary lookup, chemotherapy prohibition, read-back confirmation, modal review, and idempotent submission.
- `src/App.tsx`: Wired `verbal_orders_er` into navigation, screen titles, frontDeskScreens, service view filters, and component routing.
- `src/foundation-catalogue.json` & `src/foundation-task-map.json`: Added `verbal_orders_er` endpoint bindings and task mapping.
- `src/foundation-help.ts`: Added `verbal_orders_er` to `deliveredHelpScreens` and all 12 `verbal.*` control guides.
- `src/help.ts`: Authored comprehensive handbook entry for `verbal_orders_er` with bilingual title, purpose, 8 numbered steps, and 7 role-specific FAQs for `triage_nurse`.
- `public/handbook/verbal_orders_er-en.png` & `public/handbook/verbal_orders_er-ur.png`: Bundled handbook screenshots.
- `tests/verbal-orders-er.test.mjs`: 7/7 automated unit tests passed in 38ms.
- `tests/help-coverage.test.mjs`: Updated to 96 delivered screens.
- `npm run check:help`: Passed (96 screens, 2239 controls, 1336 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (391/391 tests passed across all suites).
- `npm run build`: Production bundle built cleanly (`dist/assets/index-D8yPCrut.js`).
- Proposal ID **250** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 98 (`critical_results_er`)
1. Call `get_screen_bundle("critical_results_er", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Generate TypeScript contracts if needed (`src/generated/critical_results_er.ts`).
3. Implement domain policies in `src/critical-results-er-policy.ts`.
4. Build/wire screen UI in `src/screens/CriticalResultsBench.tsx` or new screen module.
5. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
6. Author unit tests in `tests/critical-results-er.test.mjs`.
7. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
8. Commit Screen 98 and submit `propose_progress`.
