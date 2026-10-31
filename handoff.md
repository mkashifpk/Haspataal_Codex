# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 92 `er_board` Complete -> Starting Screen 93 `er_visit`
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 91: **`triage_scale`** ("Emergency triage scale and assessment", Position 91, 55 points) — **COMPLETED** (commit `fb479e0`, Proposal **244** awaiting human review on `/docs -> My progress`).
- Screen 92: **`er_board`** ("Emergency room tracking board", Position 92, 62 points) — **COMPLETED** (commit `5eb27cf`, Proposal **245** awaiting human review on `/docs -> My progress`).
- Screen 93: **`er_visit`** ("Emergency visit chart and doctor notes", Position 93, 84 points) — **NEXT UP**.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, and **245** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 92 (`er_board`)
- `contracts/er_board.json`: Screen contract bundle with 5 endpoints and domain rules.
- `src/generated/er_board.ts`: TypeScript contracts for `board`, `onDuty`, `registerErVisits`, `getVisit`, and `trauma`.
- `src/er-board-policy.ts`: Emergency tracking board view evaluation (rule:9501947a0e), capability gating (rule:141986b356), priority sorting with untriaged first then triage levels (rule:2422ef9b12, MSDS 18), warning badge evaluation (rule:618704df95), real-time Code Red alert management (rule:bdb901deb2), arrival & trauma validation (rule:74958f2576), and operational error recovery.
- `src/screens/ERBoard.tsx`: Complete emergency room tracking board UI with KPI summary header tiles, audible/visual Code Red notification banner, on-duty staff and on-call consultant side drawer (rule:21a063e488, MSDS 17 iii), arrival intake modal, quick trauma creation modal, and visit detail timeline modal.
- `tests/er-board.test.mjs`: 6/6 unit tests passing.
- `tests/help-coverage.test.mjs`: Updated to 91 delivered screens.
- `npm run check:help`: Passed (91 screens, 2090 controls, 1222 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (365/365 unit and contract tests passing).
- `npm run build`: Passed cleanly (`dist/assets/index-GX9IPSAj.js`).
- Proposal ID **245** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 93 (`er_visit`)
1. Call `get_screen_bundle("er_visit", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Generate TypeScript contracts with `generate_typescript` (`src/generated/er_visit.ts`).
3. Implement domain policies in `src/er-visit-policy.ts`.
4. Build screen UI in `src/screens/ERVisit.tsx`.
5. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
6. Author unit tests in `tests/er-visit.test.mjs`.
7. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
8. Commit Screen 93 and submit `propose_progress`.
