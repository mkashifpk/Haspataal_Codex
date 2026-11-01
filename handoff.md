# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 6 Screen 113 `cssd_stock` (Sterile stock, pack issues and expiry)
Executing the Phase 6 Roadmap ("Theatre and sterile supply") in dependency order along with all tests and MCP progress reporting:
- Screen 108: **`transfusion_bedside_er`** ("Bedside transfusion observation - ER", Position 108, 74 points) — **COMPLETED** (commit `2803cf0`, Proposal **261** awaiting human review on `/docs -> My progress`). Marks Phase 5 100% complete!
- Screen 109: **`clinical_privileges`** ("Clinical privileges", Position 109, 55 points) — **COMPLETED** (commit `5ddbd89`, Proposal **262** awaiting human review on `/docs -> My progress`). First screen of Phase 6!
- Screen 110: **`theatre_checklist_setup`** ("Surgical safety checklist configuration", Position 110, 52 points) — **COMPLETED** (commit `5a0e80c`, Proposal **263** awaiting human review on `/docs -> My progress`).
- Screen 111: **`cssd_setup`** ("Sterile supply: sets, sterilizers, recalls", Position 111, 75 points) — **COMPLETED** (commit `5466f90`, Proposal **264** awaiting human review on `/docs -> My progress`).
- Screen 112: **`cssd_board`** ("Sterilization board", Position 112, 67 points) — **COMPLETED** (commit `348ec1e`, Proposal **265** awaiting human review on `/docs -> My progress`).
- Screen 113: **`cssd_stock`** ("Sterile stock and issue", Position 113, 56 points) — **NEXT / IN PROGRESS**.

---

### Completed Screen 112 (`cssd_board`) Checkpoint
- **Workflow & Standards**: Daily sterilization board and load tracking under MSDS IPC 90–92 (daily Bowie-Dick morning test, load start with packs & counts, pack labels printing, physical parameters recording, chemical & biological indicator verification, load quarantine/release); Position 112 (67 points), Workspace `cssd`.
- **Contracts**:
  - `contracts/cssd_board.json`: Real MCP screen bundle covering 8 endpoints (`POST /cssd/cycles`, `GET /cssd/cycles`, `GET /cssd/cycles/{cycle_id}`, `POST /cssd/cycles/{cycle_id}/results`, `GET /cssd/cycles/{cycle_id}/labels`, `GET /cssd/set-types`, `GET /cssd/sterilizers`, `GET /cssd/log/pdf`), 1 event (`cssd.cycle.updated`), and statutory rules (`rule:2e3fcc57c7`, `rule:9a5570e2a6`, `rule:4d7517d090`, `rule:b48c7fa7a8`, `rule:dfad4a25d2`, `rule:0bdd7f9ba6`).
  - `src/generated/cssd_board.ts`: Generated TypeScript contracts for all 8 operations and data models.
- **Domain Policies & Statutory Rules (`src/cssd-board-policy.ts`)**:
  - Runtime service capability evaluation (`rule:dfad4a25d2`): `cssd` capability (`full`, `open_work` with banner, `records`, `setup`, `hidden`).
  - Service Active requirement (`rule:0bdd7f9ba6`): `POST /cssd/cycles` offered only while `cssd` is in `establishment.active`.
  - Daily morning Bowie-Dick steam release gate (`rule:2e3fcc57c7`): pre-vacuum steam autoclaves require passing morning air-removal Bowie-Dick cycle before steam loads can be released (`CSSD_DAILY_TEST_REQUIRED`).
  - Load creation & pack labels (`rule:9a5570e2a6`): method-compatible set selection; immediately generates 50mm thermal adhesive barcode labels for each pack in the load manifest.
  - Multi-indicator verification & quarantine rules (`rule:4d7517d090`): temperature, pressure, exposure hold time, mechanical pass, chemical indicator (Pass/Fail), biological indicator (Pass/Fail/Pending/NotUsed). Loads with surgical implants are quarantined until biological spore readout. Any failure rejects load, alerts supervisors, and requires failure note.
  - Priority pinning & recall candidates (`rule:b48c7fa7a8`): Running and Quarantined cycles stay pinned at top of the board table. Failed biological indicator displays recall candidates (loads released since last passed biological test) under MSDS IPC 92.
  - Bilingual error explanations for `CSSD_DAILY_TEST_REQUIRED`, `CSSD_BIOLOGICAL_REQUIRED`, `CSSD_CYCLE_STATE_INVALID`, `CAPABILITY_INACTIVE`, etc.
- **UI Architecture (`src/screens/CSSDBoard.tsx`)**:
  - Sterilizer chambers overview: real-time readiness cards showing chamber methods, locations, active loads, and morning Bowie-Dick test pass/fail indicators.
  - Active cycles board: Running and Quarantined cycles permanently pinned at the top for prioritized monitoring.
  - Start Cycle modal: supports Load, Bowie-Dick, Leak Test, and Biological Test cycles. Enforces method-compatible set selection and empty chamber validation for test cycles.
  - 50mm pack label generation: automatically triggers thermal adhesive label preview upon starting a clinical load with packs (`GET /cssd/cycles/{id}/labels`).
  - Record Results modal: captures physical parameters (temp °C, pressure kPa, exposure minutes), mechanical printout verification, chemical indicator strip color change, and biological indicator spore results (`POST /cssd/cycles/{id}/results`).
  - Biological quarantine & recall candidate tracking: holds implant loads in Quarantined status until biological readout. Highlights potential recall candidates upon biological failure.
  - Cycle inspection drawer: displays comprehensive cycle history, exposed patient MRNs for clinical surveillance, and pack inventory.
  - Audit log PDF export: date-filtered sterilization log document generation via `GET /cssd/log/pdf`.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (8 tasks), `src/foundation-task-map.json` (8 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `cssd_board` to `deliveredHelpScreens` and all 33 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 12 operational steps, and 6 role FAQs for CSSD technician.
  - Bundled screenshots: `public/handbook/cssd_board-en.png` and `public/handbook/cssd_board-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/cssd-board.test.mjs` (8/8 passing).
  - Full test suite: `npm test` passed (487/487 passing across all suites).
  - Help check: `npm run check:help` passed (111 screens, 2578 controls, 1644 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-B5w7Wxo9.js`).
- **Commit & Proposal**:
  - Implementation commit: `348ec1e`.
  - Proposal ID: **265** (status: `pending` on `/docs -> My progress`).

---

## Plan for Screen 113 (`cssd_stock`)
- **Workflow & Standards**: Sterile stock management, FIFO issue to wards and operating theatres with barcode scanning basket, expiring-soon alerts, and hourly expired pack reprocessing under MSDS IPC 91 & 92; Position 113 (56 points), Workspace `cssd`.
- **Bundle & Contracts**:
  - Contract bundle: `get_screen_bundle("cssd_stock")`.
  - Quality brief: `get_ui_quality_brief(screen_id="cssd_stock")`.
  - Generate TypeScript contracts (`src/generated/cssd_stock.ts`).
  - Endpoints (5): `GET /cssd/packs`, `POST /cssd/packs/issue`, `GET /cssd/packs/{pack_code}`, `GET /beds/matrix`, `GET /ot/theaters`.
  - Events (1): `cssd.cycle.updated`.
  - Statutory Rules:
    - `rule:613c123950`: Stock = `GET /cssd/packs?status=Available`, soonest expiry first (`expiring_soon` in amber: issue first).
    - `rule:3834d11044`: Issue: scan labels into a basket, choose the ward or the theatre, `POST /cssd/packs/issue` (all or nothing: `CSSD_PACK_UNUSABLE` names the pack).
    - `rule:30768e8506`: Expired packs are marked by the worker every hour: collect them for reprocessing.
    - `rule:5298373f7d`: Issue to: a ward from `GET /beds/matrix?include_beds=false` (by name; CSSD sees no patient names) or a theatre from `GET /ot/theaters`; never a typed id.
    - `rule:56077b4ba3`: Runtime `cssd` capability gating.
- **Domain Policies & Statutory Rules (`src/cssd-stock-policy.ts`)**:
  - Stock sorting by soonest expiry (FIFO).
  - `expiring_soon` indicator and color badge.
  - Basket scanning validation (unique packs, valid pack code format, non-empty basket).
  - Destination selection from server lists only (`beds/matrix` for wards, `ot/theaters` for OTs; never typed IDs).
  - All-or-nothing issue error handling (`CSSD_PACK_UNUSABLE`).
- **UI Architecture (`src/screens/CSSDStock.tsx`)**:
  - Stock Inventory table: available packs sorted by expiry, expiring-soon amber badges, method filters, set type search.
  - Pack Issue Basket panel: barcode scanner input, scanned pack list, destination selector (Ward vs OT), Issue Confirm button.
  - Single pack details inspection: `GET /cssd/packs/{pack_code}`.
  - Expired / Quarantined packs view: list of expired packs flagged for return to decontamination.
- **Help, Handbook & Navigation**:
  - Contextual F1 help with controls mapped in `src/foundation-help.ts`.
  - Task mapping in `src/foundation-catalogue.json` and `src/foundation-task-map.json`.
  - Handbook entry in `src/help.ts` with role FAQs for CSSD technician.
  - Bundled screenshots: `public/handbook/cssd_stock-en.png` and `cssd_stock-ur.png`.
- **Automated Verification**:
  - `tests/cssd-stock.test.mjs`.
  - `npm test`, `npm run check:help`, `npx tsc --noEmit`, `npm run build`.
  - Commit and submit `propose_progress` (Proposal 266).

---

### Completed Screen 111 (`cssd_setup`) Checkpoint
- **Workflow & Standards**: Sterile supply sets, sterilizers, packaging shelf life presets, biological breakdown recalls under MSDS IPC 90–92 with exposed patient tracking, and committee audit reports; Position 111 (75 points), Workspace `infection_control`.
- **Contracts**:
  - `contracts/cssd_setup.json`: 12 endpoints, 1 event, 4 rules.
  - `src/generated/cssd_setup.ts`: Generated contracts.
- **Domain Policies & Statutory Rules (`src/cssd-setup-policy.ts`)**:
  - Runtime service capability evaluation (`rule:37dd1f7236`).
  - Packaging shelf life standards and implant biological indicator gating (`rule:494306e208`).
  - Load recall & exposed patient tracking (`rule:dc520ffa20`, MSDS IPC 92).
  - Sterilization SOP & Committee Log (`rule:d26b399f0d`).
- **UI Architecture (`src/screens/CSSDSetup.tsx`)**: Sets catalog, autoclaves register, recall management, exposed patient tracking, SOP/Log PDFs.
- **Verification**: `tests/cssd-setup.test.mjs` (6/6 passing). Proposal ID: **264** (status: `pending`).

---

### Completed Screen 110 (`theatre_checklist_setup`) Checkpoint
- **Workflow & Standards**: Surgical safety checklist setup & configuration across WHO surgical safety checklist phases (Sign In, Time Out, Sign Out) and post-anaesthesia recovery criteria under MSDS COP 31, 39, 41, and 44; Position 110 (52 points), Workspace `quality` / `owner_dashboard`.
- **Contracts**: `contracts/theatre_checklist_setup.json`: 5 endpoints, 4 rules.
- **UI Architecture (`src/screens/TheatreChecklistSetup.tsx`)**: Phase tabs, recovery criteria settings, add/edit/retire items, Theatre Policy PDF.
- **Verification**: `tests/theatre-checklist-setup.test.mjs` (6/6 passing). Proposal ID: **263** (status: `pending`).

---

## Completed Screens Checkpoint
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
- Screen 103: **`mlc_cases_doctor`** (commit `b3c34e8`, Proposal **256** awaiting human review on `/docs -> My progress`).
- Screen 104: **`death_record`** (commit `2d501bf`, Proposal **257** awaiting human review on `/docs -> My progress`).
- Screen 105: **`body_release_ward`** (commit `65a9ab8`, Proposal **258** awaiting human review on `/docs -> My progress`).
- Screen 106: **`body_release_er`** (commit `7e89cdd`, Proposal **259** awaiting human review on `/docs -> My progress`).
- Screen 107: **`patient_programmes_triage`** (commit `40efb78`, Proposal **260** awaiting human review on `/docs -> My progress`).
- Screen 108: **`transfusion_bedside_er`** (commit `2803cf0`, Proposal **261** awaiting human review on `/docs -> My progress`).
- Screen 109: **`clinical_privileges`** (commit `5ddbd89`, Proposal **262** awaiting human review on `/docs -> My progress`).
- Screen 110: **`theatre_checklist_setup`** (commit `5a0e80c`, Proposal **263** awaiting human review on `/docs -> My progress`).
- Screen 111: **`cssd_setup`** (commit `5466f90`, Proposal **264** awaiting human review on `/docs -> My progress`).
- Screen 112: **`cssd_board`** (commit `348ec1e`, Proposal **265** awaiting human review on `/docs -> My progress`).
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237** through **265** are awaiting human review on `/docs -> My progress`.
