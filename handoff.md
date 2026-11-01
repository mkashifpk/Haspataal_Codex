# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 102 `mlc_cases` Complete -> Next Screen 103 `mlc_cases_doctor`
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
- Screen 100: **`er_board_doctor`** ("Emergency room tracking board (Doctor)", Position 100, 62 points) — **COMPLETED** (commit `676e95f`, Proposal **253** awaiting human review on `/docs -> My progress`).
- Screen 101: **`er_visit_doctor`** ("Emergency visit clinical consultation and orders (Doctor)", Position 101, 84 points) — **COMPLETED** (commit `c371446`, Proposal **254** awaiting human review on `/docs -> My progress`).
- Screen 102: **`mlc_cases`** ("Medico-legal cases register", Position 102, 75 points) — **COMPLETED** (commit `4e60002`, Proposal **255** awaiting human review on `/docs -> My progress`).
- Screen 103: **`mlc_cases_doctor`** ("Medico-legal cases (Doctor)", Position 103, 73 points) — **NEXT UP**.

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
- Screen 100: **`er_board_doctor`** (commit `676e95f`, Proposal **253** awaiting human review on `/docs -> My progress`).
- Screen 101: **`er_visit_doctor`** (commit `c371446`, Proposal **254** awaiting human review on `/docs -> My progress`).
- Screen 102: **`mlc_cases`** (commit `4e60002`, Proposal **255** awaiting human review on `/docs -> My progress`).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, **247**, **248**, **249**, **250**, **251**, **252**, **253**, **254**, and **255** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 102 (`mlc_cases`)
- `contracts/mlc_cases.json`: Screen contract bundle with 10 endpoints, event `notification.created`, and domain rules (`rule:4d698e4d1b`, `rule:5bc7258288`, `rule:280a8e8493`, `rule:2b6e9d023c`, `rule:044cdb5a52`, `rule:ca37655fad`, `rule:81b46f9cf6`).
- `src/generated/mlc_cases.ts`: Generated TypeScript contracts for all 10 endpoints.
- `src/mlc-cases-policy.ts`: Service capability evaluation for `emergency_department`, clinical permissions gating (`mlc.case.manage`, `mlc.register.view`), priority sorting with overdue police intimation placed in red at the top, validation for open, update, police intimation, evidence handover, and case closure readiness, plus domain error explanations.
- `src/screens/MLCCases.tsx`: Clinical register and detail management UI parameterized with `screenId="mlc_cases"` (`same_component_as: ["mlc_cases_doctor"]`), KPI tiles, overdue hazard alert, search across MRN/Name/MLC/FIR, case detail modal with alleged history in narrator's words, physical findings, immutable police intimation, chain of custody evidence table, MLR settlement form, case closure confirmation, and formal A4 police intimation printout.
- `src/App.tsx`: Wired `mlc_cases` into navigation, labels, frontDeskScreens, service view filters, and rendering.
- `src/foundation-catalogue.json` & `src/foundation-task-map.json`: Registered `mlc_cases` task mappings.
- `src/foundation-help.ts`: Added `mlc_cases` to `deliveredHelpScreens` and all 59 `mlc_cases.*` interactive controls.
- `src/help.ts`: Authored comprehensive handbook entry with bilingual title, clinical purpose, 8 operational steps, and 8 role FAQs tailored for `triage_nurse` (including all 5 required error seeds).
- `public/handbook/mlc_cases-en.png` & `public/handbook/mlc_cases-ur.png`: Bundled handbook screenshots.
- `tests/mlc-cases.test.mjs`: 7/7 automated unit tests passed.
- `tests/help-coverage.test.mjs`: Updated to 101 delivered screens.
- `scripts/check-help.mjs`: Added `MLCCases` to scanned components.
- `npm run check:help`: Passed (101 screens, 2303 controls, 1395 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (422/422 tests passed across all suites).
- `npm run build`: Production bundle built cleanly (`dist/assets/index-DVIuDexG.js`).
- Commit: `4e60002`.
- Proposal ID **255** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 103 (`mlc_cases_doctor`)
1. Call `get_screen_bundle("mlc_cases_doctor", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Check `same_component_as: ["mlc_cases"]` compatibility to reuse `MLCCases.tsx` (parameterized with `screenId="mlc_cases_doctor"`).
3. Generate/link TypeScript contracts (`src/generated/mlc_cases_doctor.ts`).
4. Update `src/mlc-cases-policy.ts` to evaluate doctor workspace permissions (`doctor`, `clinical_specialist`, `surgeon`, `anaesthetist`).
5. Create wrapper screen `src/screens/MLCCasesDoctor.tsx` wrapping `MLCCases` with `screenId="mlc_cases_doctor"`.
6. Wire into `src/App.tsx`, task catalogue, task map, `deliveredHelpScreens`, control guides, and author doctor-specific handbook and role FAQs in `src/help.ts`.
7. Author unit tests in `tests/mlc-cases-doctor.test.mjs`.
8. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
9. Commit Screen 103 and submit `propose_progress`.

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

### Verification for Screen 100 (`er_board_doctor`)
- `contracts/er_board_doctor.json`: Screen contract bundle (`same_component_as: ["er_board"]`).
- `src/generated/er_board_doctor.ts`: TypeScript contracts for `GET /er/board`, `GET /er/on-duty`, `POST /er/visits`, `GET /er/visits/{er_visit_id}`, and `POST /patients/trauma`.
- `src/er-board-policy.ts`: Parameterized `evaluateErBoardView(est, screenId)` with `emergency_department` capability active gating, role authorization for `doctor`, `clinical_specialist`, and `surgeon`, and triage acuity sorting.
- `src/screens/ERBoardDoctor.tsx` & `src/screens/ERBoard.tsx`: Reusable clinical ER tracking board component parameterized for `screenId="er_board_doctor"` with acuity ordering (MSDS 18), warning badges (`TriageOverdue`, `DoctorOverdue`, `ObservationTooLong`, `AdmissionWaitTooLong`, `ReferralWaitTooLong`, red `MlcNotOpened`), Code Red alert chime/banner on `er.visit.updated`, arrival intake, quick trauma identity creation, and on-duty roster drawer (`GET /er/on-duty`).
- `src/App.tsx`: Wired `er_board_doctor` into navigation, labels, frontDeskScreens, service view filters, and component routing.
- `src/foundation-catalogue.json` & `src/foundation-task-map.json`: Added `er_board_doctor` task mappings.
- `src/foundation-help.ts`: Added `er_board_doctor` to `deliveredHelpScreens` and all 28 `er_board.*` controls.
- `src/help.ts`: Authored comprehensive handbook entry for `er_board_doctor` with bilingual title, clinical purpose, 8 operational steps, and 8 role FAQs tailored for emergency doctors, clinical specialists, and surgeons.
- `public/handbook/er_board_doctor-en.png` & `public/handbook/er_board_doctor-ur.png`: Bundled handbook screenshots.
- `tests/er-board-doctor.test.mjs`: 6/6 automated unit tests passed in 34ms.
- `tests/help-coverage.test.mjs`: Updated to 99 delivered screens.
- `npm run check:help`: Passed (99 screens, 2239 controls, 1336 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (409/409 tests passed across all suites).
- `npm run build`: Production bundle built cleanly (`dist/assets/index-CPreGZn7.js`).
- Commit: `676e95f`.
- Proposal ID **253** submitted and confirmed pending review on `/docs -> My progress`.

### Verification for Screen 101 (`er_visit_doctor`)
- `contracts/er_visit_doctor.json`: Screen contract bundle with 11 endpoints, event `er.visit.updated`, and domain rules (`rule:b985ad38dc`, `rule:bd91e95b22`, `rule:50175606cd`, `rule:436225bf5c`, `rule:1c52f88e02`, `rule:231e22e6bd`, `rule:7571033b1d`, `rule:794ff452da`, `rule:abab0015cb`, `rule:c8b716e97e`).
- `src/generated/er_visit_doctor.ts`: Re-exported from `src/generated/er_visit.ts`.
- `src/er-visit-policy.ts`: Parameterized `evaluateErVisitView(establishment, screenId)` with service capability gates, role authorization for `doctor`, `clinical_specialist`, `surgeon`, `anaesthetist`, triage vital signs priority calculation, clinical override rationale validation, MLC screening, stage progression, departure disposition enforcement, and outside document attachment.
- `src/screens/ERVisitDoctor.tsx` & `src/screens/ERVisit.tsx`: Parameterized for `screenId="er_visit_doctor"`.
- `src/App.tsx`: Wired `er_visit_doctor` into navigation, labels, frontDeskScreens, service view filters, and rendering.
- `src/foundation-catalogue.json` & `src/foundation-task-map.json`: Added `er_visit_doctor` task mappings.
- `src/foundation-help.ts`: Added `er_visit_doctor` to `deliveredHelpScreens` and all 69 `er_visit.*` controls.
- `src/help.ts`: Authored comprehensive handbook entry with bilingual title, clinical purpose, 8 operational steps, and 8 role FAQs.
- `public/handbook/er_visit_doctor-en.png` & `public/handbook/er_visit_doctor-ur.png`: Bundled handbook screenshots.
- `tests/er-visit-doctor.test.mjs`: 6/6 automated unit tests passed in 16ms.
- `tests/help-coverage.test.mjs`: Updated to 100 delivered screens.
- `npm run check:help`: Passed (100 screens, 2239 controls, 1336 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (415/415 tests passed across all suites).
- `npm run build`: Production bundle built cleanly (`dist/assets/index-DVCWeT4Z.js`).
- Commit: `c371446`.
- Proposal ID **254** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 102 (`mlc_cases`)
1. Saved screen contract bundle `contracts/mlc_cases.json` and generated `src/generated/mlc_cases.ts`.
2. Implement clinical and statutory policy in `src/mlc-cases-policy.ts`:
   - Service view evaluation (`rule:81b46f9cf6`): `emergency_department` capability (`full`, `open_work` with banner 'No new medico-legal cases from now on. Completing existing cases and intimation continue.', `records`, `hidden`).
   - Role authorization: `mlc.case.manage` (`triage_nurse`, `doctor`, `clinical_specialist`, `surgeon`, `anaesthetist`), `mlc.register.view` (clinical roles + directors and admins).
   - Priority sorting: `police_intimation_overdue` cases placed prominently in red at the top (`rule:280a8e8493`).
   - Validation for opening cases (`validateOpenMlc`), updating history/findings (`validateUpdateMlc`), police intimation (`validatePoliceIntimation`), chain of custody evidence handing (`validateEvidence`), and closing requirements (`validateCloseMlc` checking police intimation and settled MLR status per `rule:044cdb5a52`).
   - Domain error mapping (`explainMlcError`) for `MLC_CLOSED`, `MLC_CONTACT_TYPE_INVALID`, `MLC_NOT_READY_TO_CLOSE`, `MLC_POLICE_ALREADY_INFORMED`, `PATIENT_MERGED_CANNOT_TRANSACT`, `REFERENCE_NOT_FOUND`, `VALIDATION_ERROR`.
3. Create clinical UI in `src/screens/MLCCases.tsx` (reusable for `screenId="mlc_cases"` and `same_component_as: ["mlc_cases_doctor"]`).
4. Wire into `src/App.tsx`, `src/foundation-catalogue.json`, `src/foundation-task-map.json`, `src/foundation-help.ts`, `src/help.ts` (with English/Urdu handbook and 8 role FAQs), and bundle screenshots `public/handbook/mlc_cases-*.png`.
5. Write unit tests in `tests/mlc-cases.test.mjs` and update `tests/help-coverage.test.mjs` to 101 screens.
6. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
7. Commit Screen 102 and submit `propose_progress`.
