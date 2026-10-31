# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Screen 85 `labour_register` ("Labour ward register and partograph") -> Screen 86 `postnatal_ward`
Building screens in Phase 4 Roadmap along with all tests, reporting backend issues if found:
- Screen 84: **`newborn_registration`** ("Newborn registration and identification", Position 84, 56 points) — **COMPLETED** (commit `00e120f`, Proposal **237** awaiting human review on `/docs -> My progress`).
- Screen 85: **`labour_register`** ("Labour ward register and partograph", Position 85, 70 points) — **COMPLETED** (commit `91e0bbd`, Proposal **238** awaiting human review on `/docs -> My progress`).
- Screen 86: **`postnatal_ward`** ("Postnatal ward care and observations", Position 86, 60 points) — **NEXT**.

### Completed Screens Checkpoint
- Screen 82: **`maternity_policy`** (commit `adb0c9a`, Proposal **235** accepted).
- Screen 83: **`obstetric_assessment`** (commit `e5cda36`, Proposal **236** accepted).
- Screen 84: **`newborn_registration`** (commit `00e120f`, Proposal **237** awaiting human review on `/docs -> My progress`).
- Screen 85: **`labour_register`** (commit `91e0bbd`, Proposal **238** awaiting human review on `/docs -> My progress`).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237** and **238** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 85 (`labour_register`)
- `contracts/labour_register.json`: Complete screen bundle with 9 endpoints and 7 domain rules.
- `src/generated/labour_register.ts`: Typed contracts for columns, delivery entries, drafts, signing, and birth notification PDF.
- `src/labour-register-policy.ts`: Dynamic column groupers, conditional requirements (`when_code`), validation by column kind, missing columns evaluator for pre-signing, and domain error explanations.
- `src/screens/LabourRegister.tsx`: Dynamic form builder, multi-section layout (Admission, Delivery, Mother, Babies, Discharge), multiples/twins support, draft saves (PATCH), signing freeze (POST sign) with author stamp (MSDS IMS 147), and official Union Council birth notification prints.
- `tests/labour-register.test.mjs`: 5/5 unit tests passing.
- `tests/help-coverage.test.mjs`: 28/28 tests passing (updated to 84 delivered screens).
- `npm run check:help`: Passed (84 screens, 1905 controls, 1045 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (327/327 unit tests passing across repo).
- `npm run build`: Passed (`dist/assets/index-CEik4icH.js`).

### Next Concrete Actions
1. Proceed to Screen 86: `postnatal_ward` ("Postnatal ward care and observations", Position 86, 60 points).
2. Call `get_screen_bundle("postnatal_ward")` and save contract into `contracts/postnatal_ward.json`.
3. Inspect `get_ui_quality_brief("postnatal_ward")` and domain rules.
4. Call `generate_typescript` for endpoints and generate typed contracts in `src/generated/postnatal_ward.ts`.
5. Implement domain policies in `src/postnatal-ward-policy.ts`.
6. Author UI in `src/screens/PostnatalWard.tsx`.
7. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
8. Author unit tests in `tests/postnatal-ward.test.mjs`.
9. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, `npm run build`.
10. Commit and submit `propose_progress`.
