# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 91 `triage_scale` ("Emergency triage scale and assessment", Position 91, 55 points)
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 90: **`discharge_summary`** ("Doctor: discharge summary & take-home prescription", Position 90, 73 points) — **COMPLETED (Phase 4 Final Screen)** (commit `0a4d651`, Proposal **243** awaiting human review on `/docs -> My progress`).
- Screen 91: **`triage_scale`** ("Emergency triage scale and assessment", Position 91, 55 points) — **COMPLETED** (commit pending, Proposal ID awaiting submission).
- Screen 92: **`er_board`** ("Emergency room tracking board", Position 92, 62 points) — **NEXT UP**.

### Completed Screens Checkpoint
- Screen 84: **`newborn_registration`** (commit `00e120f`, Proposal **237** awaiting human review on `/docs -> My progress`).
- Screen 85: **`labour_register`** (commit `91e0bbd`, Proposal **238** awaiting human review on `/docs -> My progress`).
- Screen 86: **`medication_safety_ward`** (commit `ff51508`, Proposal **239** awaiting human review on `/docs -> My progress`).
- Screen 87: **`ward_transfer`** (commit `07a2db0`, Proposal **240** awaiting human review on `/docs -> My progress`).
- Screen 88: **`ward_transfer_head_nurse`** (commit `79efd60`, Proposal **241** awaiting human review on `/docs -> My progress`).
- Screen 89: **`ward_indent`** (commit `0749c48`, Proposal **242** awaiting human review on `/docs -> My progress`).
- Screen 90: **`discharge_summary`** (commit `0a4d651`, Proposal **243** awaiting human review on `/docs -> My progress`).
- Screen 91: **`triage_scale`** (commit pending, Proposal awaiting submission).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, and **243** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 91 (`triage_scale`)
- `contracts/triage_scale.json`: Screen bundle with 6 endpoints and 4 domain rules.
- `src/generated/triage_scale.ts`: Typed contracts for `getScale`, `updateLevel`, `addSign`, `updateSign`, `printScale`, and `scalePdf`.
- `src/triage-scale-policy.ts`: Emergency department service view gating (rule:813c874c56), discriminator validation for qualitative Sign vs quantitative VitalSign (rule:023ae1126f), level metadata validation, vital sign comparison formatting, and error explanations.
- `src/screens/TriageScale.tsx`: Complete UI with 5 triage priority tiers, consultant approval banner with annual SOP review tracking (rule:156f8bf375), qualitative danger sign checklist, quantitative vital sign auto-limits, retired discriminator inspection (rule:7e8f4c97ea), level metadata editing modal, discriminator addition/editing modal, and A4 printing/PDF downloads.
- `tests/triage-scale.test.mjs`: 6/6 unit tests passing.
- `tests/help-coverage.test.mjs`: Updated to 90 delivered screens.
- `npm run check:help`: Passed (90 screens, 2060 controls, 1194 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (359/359 tests passing).
- `npm run build`: Passed (`dist/assets/index-DidY0HVM.js`).

### Next Concrete Actions for Screen 92 (`er_board`)
1. Call `get_screen_bundle("er_board", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Generate TypeScript contracts with `generate_typescript` (`src/generated/er_board.ts`).
3. Implement domain policies in `src/er-board-policy.ts`.
4. Build screen UI in `src/screens/ERBoard.tsx`.
5. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
6. Author unit tests in `tests/er-board.test.mjs`.
7. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
8. Commit Screen 92 and submit `propose_progress`.
