# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Screen 84 `newborn_registration` ("Newborn registration and identification") -> Screen 85 `labour_register`
Building screens in Phase 4 Roadmap along with all tests, reporting backend issues if found:
- Screen 84: **`newborn_registration`** ("Newborn registration and identification", Position 84, 56 points) — **IMPLEMENTED & TESTED** (Ready to propose).
- Screen 85: **`labour_register`** ("Labour ward register and partograph", Position 85, 70 points) — **NEXT**.

### Completed Screens Checkpoint
- Screen 82: **`maternity_policy`** (commit `adb0c9a`, Proposal **235**).
- Screen 83: **`obstetric_assessment`** (commit `e5cda36`, Proposal **236**).
- Screen 84: **`newborn_registration`** (commit pending, all tests passing).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 84 (`newborn_registration`)
- `contracts/newborn_registration.json`: Screen bundle with 5 endpoints and 6 domain rules.
- `src/generated/newborn_registration.ts`: Typed contracts for newborn endpoints and wristband operations.
- `src/newborn-registration-policy.ts`: Bedside registration validation, sex enum, replacement wristband validation, Decision 61 mother merge handling, domain error mapping.
- `src/screens/NewbornRegistration.tsx`: Complete bedside UI, mother admission lookup, immediate wristband print notice, replacement band dialog, barcode verification scanner, handoff shortcut to `labour_register`.
- `tests/newborn-registration.test.mjs`: 5/5 unit tests passing.
- `npm run check:help`: Passed (83 screens, 1872 controls, 1012 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (322/322 unit tests passing).
- `npm run build`: Passed (`dist/assets/index-TJhEtFSo.js`).

### Next Concrete Actions
1. Commit Screen 84 (`newborn_registration`).
2. Submit `propose_progress` for `newborn_registration` (Screen 84) via Haspataal MCP.
3. Verify saved proposal with `progress_proposals`.
4. Proceed to Screen 85: `labour_register` ("Labour ward register and partograph", Position 85, 70 points).
