# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 99 `consents_triage` Complete -> Next Screen 100 `er_board_doctor`
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 91: **`triage_scale`** ("Emergency triage scale and assessment", Position 91, 55 points) — **COMPLETED** (commit `fb479e0`, Proposal **244** awaiting human review on `/docs -> My progress`).
- Screen 92: **`er_board`** ("Emergency room tracking board", Position 92, 62 points) — **COMPLETED** (commit `5eb27cf`, Proposal **245** awaiting human review on `/docs -> My progress`).
- Screen 93: **`er_visit`** ("ER visit: triage, stages & departure", Position 93, 84 points) — **COMPLETED** (commit `685b317`, Proposal **246** awaiting human review on `/docs -> My progress`).
- Screen 94: **`code_red`** ("Emergency Code Red resuscitation intake and alerts", Position 94, 60 points) — **COMPLETED** (commit `cd09192`, Proposal **247** awaiting human review on `/docs -> My progress`).
- Screen 95: **`trauma_merge`** ("Trauma profile merge", Position 95, 45 points) — **COMPLETED** (commit `ad67ac1`, Proposal **248** awaiting human review on `/docs -> My progress`).
- Screen 96: **`wristbands_er`** ("Emergency Department Patient Identification Wristbands", Position 96, 54 points) — **COMPLETED** (commit `d917901`, Proposal **249** awaiting human review on `/docs -> My progress`).
- Screen 97: **`verbal_orders_er`** ("Emergency Department Verbal and Telephone Orders", Position 97, 52 points) — **COMPLETED** (commit `d6ac583`, Proposal **250** awaiting human review on `/docs -> My progress`).
- Screen 98: **`critical_results_er`** ("Emergency Department Critical Communication", Position 98, 39 points) — **COMPLETED** (commit `3c9d082`, Proposal **251** awaiting human review on `/docs -> My progress`).
- Screen 99: **`consents_triage`** ("Emergency Department Informed Consents", Position 99, 92 points) — **COMPLETED** (commit `8b18e51`, Proposal **252** awaiting human review on `/docs -> My progress`).
- Screen 100: **`er_board_doctor`** ("Emergency room tracking board (Doctor)", Position 100, 62 points) — **NEXT UP**.

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
- Screen 98: **`critical_results_er`** (commit `3c9d082`, Proposal **251** awaiting human review on `/docs -> My progress`).
- Screen 99: **`consents_triage`** (commit `8b18e51`, Proposal **252** awaiting human review on `/docs -> My progress`).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, **247**, **248**, **249**, **250**, **251**, and **252** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 98 (`critical_results_er`)
- `contracts/critical_results_er.json`: Screen contract bundle with endpoints (`GET /critical-results`, `GET /critical-results/{critical_result_id}`), event `critical_result.updated`, and domain rules (`rule:abc8a2c23d`, `rule:9ef18690f5`).
- `src/generated/critical_results_er.ts`: Generated TypeScript contracts for list and get critical results.
- `src/critical-results-er-policy.ts`: Permission gating (`diagnostics.critical.view`), service view evaluation (`emergency_department` full, open_work with banner, records, hidden), admission/open_only filters, overdue calculation, and nursing read-back protocol guidance.
- `src/screens/CriticalResultsWard.tsx`: Parameterized with `screenId="critical_results_er"` as declared by `same_component_as: ["critical_results_ward"]`.
- `tests/critical-results-er.test.mjs`: 5/5 passing unit tests.
- Proposal ID **251** submitted and confirmed pending review on `/docs -> My progress`.

### Verification for Screen 99 (`consents_triage`)
- `contracts/consents_triage.json`: Screen contract bundle with 15 endpoints (`GET /consent-worklist`, `GET /consents`, `GET /consent-forms`, `GET /consent-decision-makers`, `POST /consents`, `GET /consents/{id}`, `PATCH /consents/{id}`, `GET /consents/{id}/print-payload`, `GET /consents/{id}/pdf`, `POST /consents/{id}/sign`, `POST /consents/{id}/refuse`, `POST /consents/{id}/withdraw`, `POST /consents/{id}/cancel`, `POST /consents/{id}/scan`, `POST /patients/{id}/documents`), event `consent.updated`, and domain rules (`rule:e9d9f576df`, `rule:d84307d9b2`, `rule:fea5622fc5`, `rule:b7bacc1ffb`, `rule:f811c03843`, `rule:8b7301ca0f`, `rule:cb2f327ee7`, `rule:e0a2eac3db`).
- `src/generated/consents_triage.ts`: Generated TypeScript contracts for all 15 endpoints.
- `src/consents-triage-policy.ts`: Service view evaluation (`emergency_department` full, open_work with banner 'No new emergency arrivals from now on. Existing consents and scanning continue.', records, hidden), permissions gating (`consent.view`, `consent.record`, `patient.document.upload`), worklist filtering with overdue counts in red, draft preparation validation (form language check, admission need bounds, stay 0–365, non-negative cost), decision validation (`Signed` mode with `who_decides` restrictions, `EmergencyNote` mode with second PMDC doctor, `VerbalRefusal` mode with witness, Q&A and explanation back), and bilingual error explanation.
- `src/screens/ConsentsTriage.tsx` & `src/screens/ConsentsAdmissions.tsx`: Parameterized for `screenId="consents_triage"` (`same_component_as: ["consents_admissions", "consents_anaesthesia", "consents_doctor", "consents_ward"]`).
- `src/App.tsx`: Wired `consents_triage` into navigation, labels, frontDeskScreens, service view filters, and rendering.
- `src/foundation-catalogue.json` & `src/foundation-task-map.json`: Added `consents_triage` task mappings.
- `src/foundation-help.ts`: Added `consents_triage` to `deliveredHelpScreens` and all 19 `consents.*` controls.
- `src/help.ts`: Authored comprehensive handbook entry for `consents_triage` with bilingual title, purpose, 8 numbered operational steps, and 8 role FAQs for `triage_nurse`.
- `public/handbook/consents_triage-en.png` & `public/handbook/consents_triage-ur.png`: Bundled handbook screenshots.
- `tests/consents-triage.test.mjs`: 7/7 automated unit tests passed in 27ms.
- `tests/help-coverage.test.mjs`: Updated to 98 delivered screens.
- `npm run check:help`: Passed (98 screens, 2239 controls, 1336 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (403/403 tests passed across all suites).
- `npm run build`: Production bundle built cleanly (`dist/assets/index-DVYwbMwN.js`).
- Proposal ID **252** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 100 (`er_board_doctor`)
1. Call `get_screen_bundle("er_board_doctor", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Check `same_component_as` or existing ER board components (`src/screens/ERBoard.tsx`).
3. Generate TypeScript contracts if needed (`src/generated/er_board_doctor.ts`).
4. Implement doctor-specific ER board policies in `src/er-board-doctor-policy.ts`.
5. Adapt/wire screen UI in `src/screens/ERBoardDoctor.tsx` or parameterized `ERBoard.tsx`.
6. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
7. Author unit tests in `tests/er-board-doctor.test.mjs`.
8. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
9. Commit Screen 100 and submit `propose_progress`.
