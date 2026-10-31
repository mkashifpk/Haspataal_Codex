# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Screen 88 `ward_transfer_head_nurse` & Screen 89 `ward_indent` -> Screen 90 `discharge_summary`
Building screens in Phase 4 Roadmap along with all tests, reporting backend issues if found:
- Screen 84: **`newborn_registration`** ("Newborn registration and identification", Position 84, 56 points) — **COMPLETED** (commit `00e120f`, Proposal **237** awaiting human review on `/docs -> My progress`).
- Screen 85: **`labour_register`** ("Labour ward register and partograph", Position 85, 70 points) — **COMPLETED** (commit `91e0bbd`, Proposal **238** awaiting human review on `/docs -> My progress`).
- Screen 86: **`medication_safety_ward`** ("Medication safety board", Position 86, 49 points) — **COMPLETED** (commit `ff51508`, Proposal **239** awaiting human review on `/docs -> My progress`).
- Screen 87: **`ward_transfer`** ("Ward patient transfer", Position 87, 48 points) — **COMPLETED** (commit `07a2db0`, Proposal **240** awaiting human review on `/docs -> My progress`).
- Screen 88: **`ward_transfer_head_nurse`** ("Accept or dispute a ward transfer", Position 88, 44 points) — **COMPLETED** (commit `79efd60`, Proposal **241** awaiting human review on `/docs -> My progress`).
- Screen 89: **`ward_indent`** ("Ward supply indent & inventory", Position 89, 52 points) — **COMPLETED** (commit `0749c48`, Proposal **242** awaiting human review on `/docs -> My progress`).
- Screen 90: **`discharge_summary`** ("Doctor: discharge summary & take-home prescription", Position 90, 73 points) — **NEXT (Final Screen of Phase 4)**.

### Completed Screens Checkpoint
- Screen 82: **`maternity_policy`** (commit `adb0c9a`, Proposal **235** accepted).
- Screen 83: **`obstetric_assessment`** (commit `e5cda36`, Proposal **236** accepted).
- Screen 84: **`newborn_registration`** (commit `00e120f`, Proposal **237** awaiting human review on `/docs -> My progress`).
- Screen 85: **`labour_register`** (commit `91e0bbd`, Proposal **238** awaiting human review on `/docs -> My progress`).
- Screen 86: **`medication_safety_ward`** (commit `ff51508`, Proposal **239** awaiting human review on `/docs -> My progress`).
- Screen 87: **`ward_transfer`** (commit `07a2db0`, Proposal **240** awaiting human review on `/docs -> My progress`).
- Screen 88: **`ward_transfer_head_nurse`** (commit `79efd60`, Proposal **241** awaiting human review on `/docs -> My progress`).
- Screen 89: **`ward_indent`** (commit `0749c48`, Proposal **242** awaiting human review on `/docs -> My progress`).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, and **242** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 88 (`ward_transfer_head_nurse`)
- `contracts/ward_transfer_head_nurse.json`: Screen bundle with 3 endpoints and 2 domain rules.
- `src/generated/ward_transfer_head_nurse.ts`: Typed contracts for `transfer`, `listTransfers`, `bedMatrix`, `TransferIn`, `AdmissionTransferOut`, and `BedMatrixOut`.
- `src/ward-transfer-head-nurse-policy.ts`: Bed matrix selection rules (rule:cbaa60994a), destination available bed filtering, rate change difference formatting (MSDS PRE 79, rule:cbaa60994a), form validation, and error guidance.
- `src/screens/WardTransferHeadNurse.tsx`: Complete 3-tab UI with live bed matrix grid, destination bed selection, quick clinical reason templates, SBAR handover safety checklist, rate change alert banners, and transfer history.
- `tests/ward-transfer-head-nurse.test.mjs`: 5/5 unit tests passing.
- `npm run check:help`: Passed.
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (341/341 tests passing).
- `npm run build`: Passed (`dist/assets/index-Cn6L35np.js`).
- Proposal ID **241** submitted and confirmed pending review on `/docs -> My progress`.

### Verification for Screen 89 (`ward_indent`)
- `contracts/ward_indent.json`: Screen bundle with 5 endpoints, 2 realtime events, and 2 domain rules.
- `src/generated/ward_indent.ts`: Typed contracts for `createIndent`, `getIndent`, `wardInventory`, `searchDrugs`, `removeWardStock`, `IndentIn`, `WardIndentOut`, `WardStockOut`, `DrugStockOut`, and `WardStockRemoveIn`.
- `src/ward-indent-policy.ts`: Gating on service `inpatient` view and `ward.indent.create` / `pharmacy.stock.adjust`, inventory inspection with RED hazard flagging for expired and recalled stock (rule:6c0ce3ff85, MSDS 59, 60), stock removal validation (`Expiry`, `Damage`, `ReturnToPharmacy`), and indent draft validation.
- `src/screens/WardIndent.tsx`: Complete 3-tab UI with live medicine cabinet inventory and safety inspection, formulary drug search with real-time stock levels and high-alert/LASA warnings, requisition drafting and submission, and requisition tracking with real-time `approval.resolved` and `pharmacy.recall.updated` synchronization.
- `tests/ward-indent.test.mjs`: 6/6 unit tests passing.
- `tests/help-coverage.test.mjs`: 28/28 tests passing (updated to 88 delivered screens).
- `npm run check:help`: Passed (88 screens, 1985 controls, 1123 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (347/347 tests passing).
- `npm run build`: Passed (`dist/assets/index-iA8V4v7s.js`).
- Proposal ID **242** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 90 (`discharge_summary`)
1. Call `get_screen_bundle("discharge_summary", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Generate TypeScript contracts with `generate_typescript` (`src/generated/discharge_summary.ts`).
3. Implement domain policies in `src/discharge-summary-policy.ts`.
4. Build screen UI in `src/screens/DischargeSummary.tsx`.
5. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
6. Author unit tests in `tests/discharge-summary.test.mjs`.
7. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
8. Commit Screen 90 and submit `propose_progress`.
