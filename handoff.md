# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 93 `er_visit` Complete -> Starting Screen 94 `code_red`
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 91: **`triage_scale`** ("Emergency triage scale and assessment", Position 91, 55 points) — **COMPLETED** (commit `fb479e0`, Proposal **244** awaiting human review on `/docs -> My progress`).
- Screen 92: **`er_board`** ("Emergency room tracking board", Position 92, 62 points) — **COMPLETED** (commit `5eb27cf`, Proposal **245** awaiting human review on `/docs -> My progress`).
- Screen 93: **`er_visit`** ("ER visit: triage, stages & departure", Position 93, 84 points) — **COMPLETED** (commit `685b317`, Proposal **246** awaiting human review on `/docs -> My progress`).
- Screen 94: **`code_red`** ("Emergency Code Red resuscitation intake and alerts", Position 94, 60 points) — **NEXT UP**.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, and **246** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 93 (`er_visit`)
- `contracts/er_visit.json`: Screen contract bundle with 11 endpoints and domain rules.
- `src/generated/er_visit.ts`: TypeScript contracts for `getVisit`, `getScale`, `triageVisit`, `medicoLegal`, `setStage`, `depart`, `caseTypes`, `openCaseMlcCases`, `listDocumentsPatients`, `uploadDocumentPatientsDocuments`, `downloadDocumentPatientDocuments`.
- `src/er-visit-policy.ts`: Emergency visit view evaluation (rule:cbd04d6c73), live triage priority calculation against age-specific pediatric vs adult thresholds (rule:b985ad38dc), clinical override justification validation (rule:bd91e95b22), mandatory medico-legal checklist rules (rule:50175606cd), stage transition constraints (rule:436225bf5c), MSDS 20 departure recording and immutable closure (rule:1c52f88e02, rule:231e22e6bd), outside reports upload validation (rule:7571033b1d, rule:794ff452da, rule:abab0015cb), and actionable error explanations.
- `src/screens/ERVisit.tsx`: Complete emergency visit chart UI with active visit lookup, KPI overview tiles, triage assessment modal with live suggested level feedback, care stage transition modal, MSDS 20 departure modal, MLC registration modal, outside clinical document upload and download, and care history timeline with nurse author stamps.
- `tests/er-visit.test.mjs`: 8/8 unit tests passing.
- `tests/help-coverage.test.mjs`: Updated to 92 delivered screens.
- `npm run check:help`: Passed (92 screens, 2160 controls, 1291 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (373/373 unit and contract tests passing).
- `npm run build`: Passed cleanly (`dist/assets/index-BWKxfuOv.js`).
- Proposal ID **246** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 94 (`code_red`)
1. Call `get_screen_bundle("code_red", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Generate TypeScript contracts with `generate_typescript` (`src/generated/code_red.ts`).
3. Implement domain policies in `src/code-red-policy.ts`.
4. Build screen UI in `src/screens/CodeRed.tsx`.
5. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
6. Author unit tests in `tests/code-red.test.mjs`.
7. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
8. Commit Screen 94 and submit `propose_progress`.
