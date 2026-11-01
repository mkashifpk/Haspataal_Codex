# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 6 Screen 114 `ot_scheduling` (Operating theatre scheduling)
Executing the Phase 6 Roadmap ("Theatre and sterile supply") in dependency order along with all tests and MCP progress reporting:
- Screen 108: **`transfusion_bedside_er`** ("Bedside transfusion observation - ER", Position 108, 74 points) — **COMPLETED** (commit `2803cf0`, Proposal **261** awaiting human review on `/docs -> My progress`). Marks Phase 5 100% complete!
- Screen 109: **`clinical_privileges`** ("Clinical privileges", Position 109, 55 points) — **COMPLETED** (commit `5ddbd89`, Proposal **262** awaiting human review on `/docs -> My progress`). First screen of Phase 6!
- Screen 110: **`theatre_checklist_setup`** ("Surgical safety checklist configuration", Position 110, 52 points) — **COMPLETED** (commit `5a0e80c`, Proposal **263** awaiting human review on `/docs -> My progress`).
- Screen 111: **`cssd_setup`** ("Sterile supply: sets, sterilizers, recalls", Position 111, 75 points) — **COMPLETED** (commit `5466f90`, Proposal **264** awaiting human review on `/docs -> My progress`).
- Screen 112: **`cssd_board`** ("Sterilization board", Position 112, 67 points) — **COMPLETED** (commit `348ec1e`, Proposal **265** awaiting human review on `/docs -> My progress`).
- Screen 113: **`cssd_stock`** ("Sterile stock and issue", Position 113, 56 points) — **COMPLETED** (commit `1fb7878`, Proposal **266** awaiting human review on `/docs -> My progress`). Completes the entire `cssd` workspace (both `cssd_board` and `cssd_stock` delivered and proposed)!
- Screen 114: **`ot_scheduling`** ("Operating theatre scheduling", Position 114, 63 points, workspace `theatre`) — **NEXT**.

---

### Completed Screen 113 (`cssd_stock`) Checkpoint
- **Workflow & Standards**: Sterile instrument pack inventory management, FIFO stock issuing with soonest expiry prioritization, handheld barcode scanning into an issue dispatch basket, destination assignment to inpatient wards or operating theatres without patient names, single pack lifecycle history lookup, and hourly expired pack reprocessing under MSDS IPC 91 & 92; Position 113 (56 points), Workspace `cssd`.
- **Contracts**:
  - `contracts/cssd_stock.json`: Real MCP screen bundle covering 5 endpoints (`GET /cssd/packs`, `POST /cssd/packs/issue`, `GET /cssd/packs/{pack_code}`, `GET /beds/matrix`, `GET /ot/theaters`), 1 event (`cssd.cycle.updated`), and 5 statutory rules (`rule:613c123950`, `rule:3834d11044`, `rule:30768e8506`, `rule:5298373f7d`, `rule:56077b4ba3`).
  - `src/generated/cssd_stock.ts`: Generated TypeScript contracts for all 5 operations and data models.
- **Domain Policies & Statutory Rules (`src/cssd-stock-policy.ts`)**:
  - Runtime service capability evaluation (`rule:56077b4ba3`): `cssd` capability (`full`, `open_work` with banner, `records`, `setup`, `hidden`).
  - FIFO stock management and soonest expiry priority (`rule:613c123950`): packs sorted by soonest expiration date; items expiring soon flagged with amber badge and prioritized for issue.
  - Barcode basket issue and atomic dispatch (`rule:3834d11044`): packs added or scanned into dispatch basket; batch submitted via `POST /cssd/packs/issue`. Atomic rejection with `CSSD_PACK_UNUSABLE` naming the pack if any pack is unusable.
  - Server destination lists only (`rule:5298373f7d`): dispatch destination chosen from `GET /beds/matrix` (ward names only, zero patient names visible to CSSD) or `GET /ot/theaters`; prohibits dual or freehand destinations.
  - Hourly expired pack reprocessing queue (`rule:30768e8506`): expired packs flagged for physical retrieval from storage racks and return to decontamination.
  - Bilingual error explanations for `CSSD_PACK_UNUSABLE`, `REFERENCE_NOT_FOUND`, `FORBIDDEN`, `CAPABILITY_INACTIVE`, etc.
- **UI Architecture (`src/screens/CSSDStock.tsx`)**:
  - Sterile Available Stock view: list of available sterile packs with search, soonest expiry ordering, and amber expiring-soon indicators.
  - Issue Basket & Barcode Scanner panel: handheld barcode reader support, scanned items list, destination ward vs theatre selector, and batch dispatch button.
  - Pack Detail modal: `GET /cssd/packs/{pack_code}` lifecycle inspection showing cycle ID, sterilizer, packaging time, and operator.
  - Expired Packs tab: hourly expired pack monitoring and decontamination return workflow.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (5 tasks), `src/foundation-task-map.json` (5 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `cssd_stock` to `deliveredHelpScreens` and all 21 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 10 operational steps, and 6 role FAQs for CSSD technician.
  - Bundled screenshots: `public/handbook/cssd_stock-en.png` and `public/handbook/cssd_stock-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/cssd-stock.test.mjs` (7/7 passing).
  - Full test suite: `npm test` passed (494/494 passing across all suites).
  - Help check: `npm run check:help` passed (112 screens, 2603 controls, 1665 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-CiUIW9zT.js`).
- **Commit & Proposal**:
  - Implementation commit: `1fb7878`.
  - Proposal ID: **266** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 112 (`cssd_board`) Checkpoint
- **Workflow & Standards**: Daily sterilization board and load tracking under MSDS IPC 90–92 (daily Bowie-Dick morning test, load start with packs & counts, pack labels printing, physical parameters recording, chemical & biological indicator verification, load quarantine/release); Position 112 (67 points), Workspace `cssd`.
- **Contracts**: `contracts/cssd_board.json` (8 endpoints, 1 event, 6 rules); `src/generated/cssd_board.ts`.
- **Verification**: `tests/cssd-board.test.mjs` (8/8 passing). Proposal ID: **265** (status: `pending`).

---

### Completed Screen 111 (`cssd_setup`) Checkpoint
- **Workflow & Standards**: Sterile supply sets, sterilizers, packaging shelf life presets, biological breakdown recalls under MSDS IPC 90–92 with exposed patient tracking, and committee audit reports; Position 111 (75 points), Workspace `infection_control`.
- **Contracts**: `contracts/cssd_setup.json`: 12 endpoints, 1 event, 4 rules.
- **Verification**: `tests/cssd-setup.test.mjs` (6/6 passing). Proposal ID: **264** (status: `pending`).

---

### Completed Screen 110 (`theatre_checklist_setup`) Checkpoint
- **Workflow & Standards**: Surgical safety checklist setup & configuration across WHO surgical safety checklist phases (Sign In, Time Out, Sign Out) and post-anaesthesia recovery criteria under MSDS COP 31, 39, 41, and 44; Position 110 (52 points), Workspace `quality` / `owner_dashboard`.
- **Contracts**: `contracts/theatre_checklist_setup.json`: 5 endpoints, 4 rules.
- **Verification**: `tests/theatre-checklist-setup.test.mjs` (6/6 passing). Proposal ID: **263** (status: `pending`).

---

## Plan for Screen 114 (`ot_scheduling`)
- **Workflow & Standards**: Operating theatre elective & emergency booking and scheduling, surgeon privileges verification, anaesthesia readiness, and room slot allocation under MSDS COP 31-33; Position 114 (63 points), Workspace `theatre`.
- **Bundle & Contracts**:
  - Retrieve real screen bundle via `get_screen_bundle("ot_scheduling")`.
  - Quality brief via `get_ui_quality_brief(screen_id="ot_scheduling")`.
  - Generate TypeScript contracts (`src/generated/ot_scheduling.ts`).
  - Examine endpoints, rules, and rubric items.
- **Domain Policies & Statutory Rules (`src/ot-scheduling-policy.ts`)**:
  - Theatre capability view evaluation (`theatre` service).
  - Slot overlap and room availability validation.
  - Surgeon clinical privileges check for scheduled procedure.
  - Emergency vs elective prioritization.
  - Bilingual error explanations.
- **UI Architecture (`src/screens/OTScheduling.tsx`)**:
  - Theatre schedule calendar / grid view across active OR suites.
  - New surgical booking modal with patient, surgeon, procedure, anaesthesia type, and slot duration.
  - Schedule conflicts, pre-op readiness, and booking status controls.
- **Help, Handbook & Navigation**:
  - Contextual F1 help with all controls mapped in `src/foundation-help.ts`.
  - Task mapping in `src/foundation-catalogue.json` and `src/foundation-task-map.json`.
  - Handbook entry in `src/help.ts` with role FAQs for Theatre Coordinator / Surgeon.
  - Bundled screenshots: `public/handbook/ot_scheduling-en.png` and `ot_scheduling-ur.png`.
- **Automated Verification**:
  - `tests/ot-scheduling.test.mjs`.
  - `npm test`, `npm run check:help`, `npx tsc --noEmit`, `npm run build`.
  - Commit and submit `propose_progress` (Proposal 267).

---

## Completed Screens Checkpoint
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237** through **266** are awaiting human review on `/docs -> My progress`.
- Completed screens in Phase 6 so far:
  - Screen 109: `clinical_privileges` (Proposal 262)
  - Screen 110: `theatre_checklist_setup` (Proposal 263)
  - Screen 111: `cssd_setup` (Proposal 264)
  - Screen 112: `cssd_board` (Proposal 265)
  - Screen 113: `cssd_stock` (Proposal 266)
