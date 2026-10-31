# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 96 `wristbands_er` Complete -> Starting Screen 97 `verbal_orders_er`
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 91: **`triage_scale`** ("Emergency triage scale and assessment", Position 91, 55 points) — **COMPLETED** (commit `fb479e0`, Proposal **244** awaiting human review on `/docs -> My progress`).
- Screen 92: **`er_board`** ("Emergency room tracking board", Position 92, 62 points) — **COMPLETED** (commit `5eb27cf`, Proposal **245** awaiting human review on `/docs -> My progress`).
- Screen 93: **`er_visit`** ("ER visit: triage, stages & departure", Position 93, 84 points) — **COMPLETED** (commit `685b317`, Proposal **246** awaiting human review on `/docs -> My progress`).
- Screen 94: **`code_red`** ("Emergency Code Red resuscitation intake and alerts", Position 94, 60 points) — **COMPLETED** (commit `cd09192`, Proposal **247** awaiting human review on `/docs -> My progress`).
- Screen 95: **`trauma_merge`** ("Trauma profile merge", Position 95, 45 points) — **COMPLETED** (commit `ad67ac1`, Proposal **248** awaiting human review on `/docs -> My progress`).
- Screen 96: **`wristbands_er`** ("Emergency Department Patient Identification Wristbands", Position 96, 54 points) — **COMPLETED** (commit `d917901`, Proposal **249** awaiting human review on `/docs -> My progress`).
- Screen 97: **`verbal_orders_er`** ("Emergency Department Verbal and Telephone Orders", Position 97, 52 points) — **NEXT UP**.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, **247**, **248**, and **249** are awaiting human review on `/docs -> My progress`.

### Verification for Screen 96 (`wristbands_er`)
- `contracts/wristbands_er.json`: Screen contract bundle with endpoints (`POST /wristbands`, `GET /wristbands`, `GET /wristbands/{wristband_id}/print-payload`, `GET /wristbands/verify`, `GET /medication-safety/worklist`) and domain rules.
- `src/wristband-policy.ts`: Gated triage nurse role access, ER stay formatting, and emergency department service view mode evaluation (`rule:0176961416`).
- `src/screens/Wristbands.tsx`: Parameterized for `screenId="wristbands_er"` defaulting to emergency visits mode (`mode="er"`), live visit list, NoWristband worklist banner (`rule:c5c48e21ec`), two-identifier verification, replacement reason gating (`rule:70f62daec7`), reprint isolation, and barcode/QR bedside scan check (`rule:df7060a63b`).
- `tests/wristband-policy.test.mjs`: 7/7 unit tests passing (added ER stay and triage nurse tests).
- `tests/help-coverage.test.mjs`: Updated to 95 delivered screens.
- `npm run check:help`: Passed (95 screens, 2206 controls, 1336 groups, 69 FAQ seeds, 30 workspace guides).
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm test`: Passed (384/384 tests passing).
- `npm run build`: Passed cleanly (`dist/assets/index-CzUcIfL9.js`).
- Proposal ID **249** submitted and confirmed pending review on `/docs -> My progress`.

### Next Concrete Actions for Screen 97 (`verbal_orders_er`)
1. Call `get_screen_bundle("verbal_orders_er", max_chars: 180000)` and inspect endpoints, rules, and rubric items.
2. Generate TypeScript contracts if needed (`src/generated/verbal_orders_er.ts`).
3. Implement domain policies in `src/verbal-orders-er-policy.ts` (or extend existing verbal orders component/policy).
4. Build/wire screen UI in `src/screens/VerbalOrders.tsx` or new screen module.
5. Wire into `src/App.tsx`, task catalogue, help catalogue, and check help.
6. Author unit tests in `tests/verbal-orders-er.test.mjs`.
7. Verify via `npm run check:help`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
8. Commit Screen 97 and submit `propose_progress`.
