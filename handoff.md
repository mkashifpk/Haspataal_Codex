# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Screen 85 `labour_register` ("Labour ward register and partograph") -> Screen 86 `postnatal_ward`
Building screens in Phase 4 Roadmap along with all tests, reporting backend issues if found:
- Screen 84: **`newborn_registration`** ("Newborn registration and identification", Position 84, 56 points) — **COMPLETED** (commit `00e120f`, Proposal **237** awaiting human review on `/docs -> My progress`).
- Screen 85: **`labour_register`** ("Labour ward register and partograph", Position 85, 70 points) — **IMPLEMENTED & TESTED** (Ready to propose).
- Screen 86: **`postnatal_ward`** ("Postnatal ward care and observations", Position 86, 60 points) — **NEXT**.

### Completed Screens Checkpoint
- Screen 82: **`maternity_policy`** (commit `adb0c9a`, Proposal **235** accepted).
- Screen 83: **`obstetric_assessment`** (commit `e5cda36`, Proposal **236** accepted).
- Screen 84: **`newborn_registration`** (commit `00e120f`, Proposal **237** awaiting human review on `/docs -> My progress`).
- Screen 85: **`labour_register`** (commit pending, all tests passing).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposal **237** is awaiting human review on `/docs -> My progress`.

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
1. Commit Screen 85 (`labour_register`).
2. Submit `propose_progress` for `labour_register` via Haspataal MCP.
3. Verify saved proposal with `progress_proposals`.
4. Proceed to Screen 86: `postnatal_ward` ("Postnatal ward care and observations", Position 86, 60 points).
