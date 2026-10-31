# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 94 `code_red` Complete -> Starting Screen 95 `trauma_merge`
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 91: **`triage_scale`** ("Emergency triage scale and assessment", Position 91, 55 points) — **COMPLETED** (commit `fb479e0`, Proposal **244** awaiting human review on `/docs -> My progress`).
- Screen 92: **`er_board`** ("Emergency room tracking board", Position 92, 62 points) — **COMPLETED** (commit `5eb27cf`, Proposal **245** awaiting human review on `/docs -> My progress`).
- Screen 93: **`er_visit`** ("ER visit: triage, stages & departure", Position 93, 84 points) — **COMPLETED** (commit `685b317`, Proposal **246** awaiting human review on `/docs -> My progress`).
- Screen 94: **`code_red`** ("Emergency Code Red resuscitation intake and alerts", Position 94, 60 points) — **COMPLETED** (commit `cd09192`, Proposal **247** awaiting human review on `/docs -> My progress`).
- Screen 95: **`trauma_merge`** ("Merge temporary trauma profile into permanent patient record", Position 95, 45 points) — **NEXT UP**.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, and **247** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 94 (`code_red`)
- `contracts/code_red.json`: Screen contract bundle with 3 endpoints and domain rules.
- `src/generated/code_red.ts`: TypeScript contracts for `codeRed`, `arrived`, `trauma`.
- `src/code-red-policy.ts`: Inpatient view evaluation (rule:97aab11043, rule:e67eb016d9), zero-block emergency admission validation without delays for billing or photo (rule:79df75a537, rule:ddc33f8c02), ER visit linking (rule:2d008ab65a), full-screen broadcast strobe and audio chimes across receiving wards, OT, and pharmacy (rule:77b021933d, rule:3eafe672a6), surgical capability gating for theatre holds (rule:45f4e0ca60), doctor attribution rules (rule:0bf43fe61a), trauma profile creation, and actionable error guidance.
- `src/screens/CodeRed.tsx`: Complete Code Red console UI featuring one-click level 1 activation, temporary trauma intake with custom identifier/gender/age, destination ward/ICU selection, emergency OT hold switch, handover message textarea, live active resuscitation admissions list, patient arrival confirmation, and full-screen audio-visual broadcast alert banner.
- `tests/code-red.test.mjs`: 5/5 unit tests passing.
- `tests/help-coverage.test.mjs`: Updated to 93 delivered screens.
- `npm run check:help`: Passed (93 screens, 2187 controls, 1317 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (378/378 unit and contract tests passing).
- `npm run build`: Passed cleanly (`dist/assets/index-sMHtkAOI.js`).
- Proposal ID **247** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 95 (`trauma_merge`)
1. Call `get_screen_bundle("trauma_merge", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Generate TypeScript contracts with `generate_typescript` (`src/generated/trauma_merge.ts`).
3. Implement domain policies in `src/trauma-merge-policy.ts`.
4. Build screen UI in `src/screens/TraumaMerge.tsx`.
5. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
6. Author unit tests in `tests/trauma-merge.test.mjs`.
7. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
8. Commit Screen 95 and submit `propose_progress`.
