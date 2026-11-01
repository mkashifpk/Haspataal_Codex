# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 6 Screen 117 `consents_anaesthesia` (Anaesthesia consent)
Executing the Phase 6 Roadmap ("Theatre and sterile supply") in dependency order along with all tests and MCP progress reporting:
- Screen 108: **`transfusion_bedside_er`** ("Bedside transfusion observation - ER", Position 108, 74 points) — **COMPLETED** (commit `2803cf0`, Proposal **261** awaiting human review on `/docs -> My progress`). Marks Phase 5 100% complete!
- Screen 109: **`clinical_privileges`** ("Clinical privileges", Position 109, 55 points) — **COMPLETED** (commit `5ddbd89`, Proposal **262** awaiting human review on `/docs -> My progress`). First screen of Phase 6!
- Screen 110: **`theatre_checklist_setup`** ("Surgical safety checklist configuration", Position 110, 52 points) — **COMPLETED** (commit `5a0e80c`, Proposal **263** awaiting human review on `/docs -> My progress`).
- Screen 111: **`cssd_setup`** ("Sterile supply: sets, sterilizers, recalls", Position 111, 75 points) — **COMPLETED** (commit `5466f90`, Proposal **264** awaiting human review on `/docs -> My progress`).
- Screen 112: **`cssd_board`** ("Sterilization board", Position 112, 67 points) — **COMPLETED** (commit `348ec1e`, Proposal **265** awaiting human review on `/docs -> My progress`).
- Screen 113: **`cssd_stock`** ("Sterile stock and issue", Position 113, 56 points) — **COMPLETED** (commit `1fb7878`, Proposal **266** awaiting human review on `/docs -> My progress`). Completes the entire `cssd` workspace!
- Screen 114: **`ot_scheduling`** ("OT request queue & calendar", Position 114, 63 points) — **COMPLETED** (commit `2671989`, Proposal **267** awaiting human review on `/docs -> My progress`).
- Screen 115: **`ot_board`** ("Live OT status board", Position 115, 36 points) — **COMPLETED** (commit `c559db6`, Proposal **268** awaiting human review on `/docs -> My progress`).
- Screen 116: **`pre_anaesthesia_clinic`** ("Pre-anaesthesia clinic", Position 116, 104 points, workspace `anaesthesia` / `doctor`) — **COMPLETED** (commit `c6167d3`, Proposal **269** awaiting human review on `/docs -> My progress`).
- Screen 117: **`consents_anaesthesia`** ("Anaesthesia consent", Position 117, 92 points, workspace `anaesthesia` / `doctor`) — **NEXT**.

---

### Completed Screen 116 (`pre_anaesthesia_clinic`) Checkpoint
- **Workflow & Standards**: Pre-anaesthesia clinic (PAC) evaluation, pre-operative worklist with days filter and `mine` toggle, multi-parameter clinical assessment (vital signs bounds, organ systems, Mallampati airway classification I-IV, ASA physical status score I-VI with emergency 'E' modifier), multi-tier fitness clearance decision (Fit, FitWithConditions, Deferred, NotFit) with mandatory clinical rationale notes for non-standard clearances, optimistic concurrency draft saves, clinical privileges verification for assessment signing, and integrated informed anaesthesia consent generation under Rule 2e64c4a389, Rule a91aa7215a, Rule d4ca3b3bcc, Rule d5b2105887, Rule 9e9cb593cb, Rule db3a19e806, Rule be026bcee1, and MSDS COP 31, 32, 39; Position 116 (104 points), Workspace `anaesthesia` / `doctor`.
- **Contracts**:
  - `contracts/pre_anaesthesia_clinic.json`: Saved real MCP screen bundle (19 endpoints, 2 realtime events, 7 statutory rules).
  - `src/generated/pre_anaesthesia_clinic.ts`: Generated TypeScript contracts for all 19 operations and domain types.
- **Domain Policies & Statutory Rules (`src/pre-anaesthesia-clinic-policy.ts`)**:
  - Runtime service capability gating (`rule:be026bcee1`): `surgery` capability view evaluation (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Active surgery check (`isSurgeryActive`).
  - Role permissions (`canAssessPreAnaesthesia`: `ot.clinical.assess`, `ot.clinical.anaesthesia`, `ot.booking.manage`, `doctor.view`).
  - Clinical privilege validation (`rule:d4ca3b3bcc`): `hasAnaesthesiaPrivilege` checks active (non-revoked) `PreAnaesthesiaAssessment` or `Anaesthesia` privilege from hospital registry.
  - Physiological bounds validation (`validatePreAnaesthesiaDraft`): checks HR (20–260), systolic BP (40–300), diastolic BP (20–200), SpO2 (50–100%), Mallampati (1–4), ASA (1–6).
  - Signing validation (`validatePreAnaesthesiaSign`, `rule:a91aa7215a`): mandates decision, planned technique, ASA class, and strictly requires non-empty `decision_note` for `FitWithConditions`, `NotFit`, or `Deferred`.
  - Bilingual catalogs: `ASA_CLASSES` (I–VI) and `MALLAMPATI_CLASSES` (I–IV) with English and Urdu explanations.
  - Bilingual error explanations (`explainPreAnaesthesiaError`): `OT_RECORD_FINAL`, `OT_PRIVILEGE_REQUIRED`, `CAPABILITY_INACTIVE`, `VALIDATION_ERROR`, etc.
- **UI Architecture (`src/screens/PreAnaesthesiaClinic.tsx`)**:
  - Worklist view: Candidate surgical cases with filters (days ahead: 1, 3, 7, 14; `mine` toggle), patient search, parts status badges (`PreOpNote`, `OperationConsent`, `PreAnaesthesia`, `AnaesthesiaConsent`), and server-driven `next_step` guidance.
  - 3-Column Clinical Assessment Form:
    - Column 1: Pre-op vitals (HR, BP, SpO2, Weight) & Airway exam (Mallampati select + notes).
    - Column 2: Clinical history & organ systems (past medical/surgical, current meds, allergies, physical exam, lab/ECG investigations).
    - Column 3: ASA classification (I-VI + Emergency E), planned technique (General, Spinal, Epidural, Regional, Sedation, Local), fasting instructions (NPO), plan & monitors, risks, premedication orders, and fitness clearance decision.
  - Draft saving (`PUT /ot/bookings/{id}/pre-anaesthesia`) and Signing (`POST /ot/bookings/{id}/pre-anaesthesia/sign`).
  - Reassessment initiation (`reassess: true`) for updated evaluations after postponement or contraindication resolution.
  - Informed Anaesthesia Consent Modal (`rule:d5b2105887`): generates bilingual consent form (`POST /consents`), signs (`POST /consents/{id}/sign`), refuses with clinical rationale (`POST /consents/{id}/refuse`), prints (`GET /consents/{id}/print-payload`), or cancels.
  - Realtime auto-synchronization: reacts to `ot.clinical.updated` and `ot.booking.updated`.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (19 tasks), `src/foundation-task-map.json` (19 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `pre_anaesthesia_clinic` to `deliveredHelpScreens` and all 38 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 10 operational steps, and 6 role FAQs.
  - Bundled screenshots: `public/handbook/pre_anaesthesia_clinic-en.png` and `public/handbook/pre_anaesthesia_clinic-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/pre-anaesthesia-clinic.test.mjs` (8/8 passing).
  - Full test suite: `npm test` passed (517/517 passing across all suites).
  - Help check: `npm run check:help` passed (115 screens, 2694 controls, 1744 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-Dv3324-N.js`).
- **Commit & Proposal**:
  - Implementation commit: `c6167d3`.
  - Proposal ID: **269** (status: `pending` on `/docs -> My progress`).

---

## Plan for Screen 117 (`consents_anaesthesia`)
- **Workflow & Standards**: Dedicated informed consent interface for surgical and anaesthetic procedures, statutory risks counseling, bilingual patient explanations, legal decision-maker verification (Self, Parent/Guardian, Next of Kin, Court-Appointed), signature capture, refusal documentation, and thermal/A4 consent printing under Rule d5b2105887 and MSDS COP 31, 32; Position 117 (92 points), Workspace `anaesthesia` / `doctor`.
- **Bundle & Contracts**:
  - Retrieve real screen bundle via `get_screen_bundle("consents_anaesthesia", max_chars=200000)`.
  - Quality brief via `get_ui_quality_brief(screen_id="consents_anaesthesia")`.
  - Generate TypeScript contracts (`src/generated/consents_anaesthesia.ts`).
  - Examine endpoints, rules, and rubric items.
- **Domain Policies & Statutory Rules (`src/consents-anaesthesia-policy.ts`)**:
  - Service capability gating and screen view mode evaluation.
  - Legal decision-maker eligibility validation.
  - Consent state transitions (Draft -> Given / Refused / Cancelled / Withdrawn).
  - Bilingual error explanations.
- **UI Architecture (`src/screens/ConsentsAnaesthesia.tsx`)**:
  - Consent queue & worklist: upcoming surgical bookings requiring anaesthesia consent.
  - Informed consent review panel with planned technique, statutory risks, and alternatives.
  - Decision-maker capture & signature recording.
  - Print consent document and scan physical signed paperwork.
- **Help, Handbook & Navigation**:
  - Contextual F1 help with all controls mapped in `src/foundation-help.ts`.
  - Task mapping in `src/foundation-catalogue.json` and `src/foundation-task-map.json`.
  - Handbook entry in `src/help.ts` with role FAQs for Anaesthetist / Doctor / Nurse.
  - Bundled screenshots: `public/handbook/consents_anaesthesia-en.png` and `consents_anaesthesia-ur.png`.
- **Automated Verification**:
  - `tests/consents-anaesthesia.test.mjs`.
  - `npm test`, `npm run check:help`, `npx tsc --noEmit`, `npm run build`.
  - Commit and submit `propose_progress` (Proposal 270).

---

## Completed Screens Checkpoint
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237** through **269** are awaiting human review on `/docs -> My progress`.
- Completed screens in Phase 6 so far:
  - Screen 109: `clinical_privileges` (Proposal 262)
  - Screen 110: `theatre_checklist_setup` (Proposal 263)
  - Screen 111: `cssd_setup` (Proposal 264)
  - Screen 112: `cssd_board` (Proposal 265)
  - Screen 113: `cssd_stock` (Proposal 266)
  - Screen 114: `ot_scheduling` (Proposal 267)
  - Screen 115: `ot_board` (Proposal 268)
  - Screen 116: `pre_anaesthesia_clinic` (Proposal 269)

---

### Completed Screen 115 (`ot_board`) Checkpoint
- **Workflow & Standards**: Airport-style live operating theatre status board visible from any terminal; displays room readiness (🟢 Available / 🔴 In-Surgery / 🟡 Cleaning-Prep / ⚠️ Emergency Hold / ⚪ Out of Service), active surgical procedure and surgeon, timeline (actual start, expected end, elapsed duration), next scheduled procedure, with strictly zero patient names displayed under Rule 01511e9050 and MSDS COP 31-33; Position 115 (36 points), Workspace `*`.
- **Contracts**:
  - `contracts/ot_board.json`: Real MCP screen bundle covering 1 endpoint (`GET /ot/status-board`), 1 realtime event (`ot.status.updated`), and 2 statutory rules (`rule:01511e9050`, `rule:cc0fcec2de`).
  - `src/generated/ot_board.ts`: Generated TypeScript contract for `TheaterBoardOut` and `statusBoard()`.
- **Domain Policies & Statutory Rules (`src/ot-board-policy.ts`)**:
  - Runtime service capability evaluation (`rule:cc0fcec2de`): `surgery` capability (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Status display indicators and icons (`rule:01511e9050`): Available (🟢), InSurgery (🔴), CleaningPrep (🟡), EmergencyHold (⚠️), OutOfService (⚪).
  - Patient privacy enforcement (`rule:01511e9050`): guarantees no patient names appear on this public/terminal status board.
  - Role permissions: `canViewOtStatus` (`ot.status.view`, `ot.booking.view`, `ot.booking.manage`, etc.).
  - Bilingual error explanations for `FORBIDDEN`, `CAPABILITY_INACTIVE`, etc.
- **UI Architecture (`src/screens/OTBoard.tsx`)**:
  - Dual layout options: Grid card view and compact Airport Departure Table view.
  - Room cards with live status badges, active case details (`<procedure> - <surgeon>`), timing indicators, and next scheduled case.
  - Search by room name, suite code, or procedure.
  - Status filter dropdown and room specialty type filter.
  - Room inspection modal with detailed suite timeline and turnover status.
  - Realtime synchronization via `ot.status.updated`.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (1 task), `src/foundation-task-map.json` (1 control).
  - Contextual F1 help (`src/foundation-help.ts`): added `ot_board` to `deliveredHelpScreens` and all 9 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 4 role FAQs.
  - Bundled screenshots: `public/handbook/ot_board-en.png` and `public/handbook/ot_board-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/ot-board.test.mjs` (7/7 passing).
  - Full test suite: `npm test` passed (509/509 passing across all suites).
  - Help check: `npm run check:help` passed (114 screens, 2654 controls, 1706 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-bbPE-QGt.js`).
- **Commit & Proposal**:
  - Implementation commit: `c559db6`.
  - Proposal ID: **268** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 114 (`ot_scheduling`) Checkpoint
- **Workflow & Standards**: Operating theatre elective & emergency booking and scheduling, surgeon privileges verification, anaesthesia readiness, and room slot allocation with double-booking prevention and 20-minute turnover buffers under MSDS COP 31-33; Position 114 (63 points), Workspace `ot_admin`.
- **Contracts**: `contracts/ot_scheduling.json` (8 endpoints, 2 events, 3 rules); `src/generated/ot_scheduling.ts`.
- **Verification**: `tests/ot-scheduling.test.mjs` (8/8 passing). Proposal ID: **267** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 113 (`cssd_stock`) Checkpoint
- **Workflow & Standards**: Sterile instrument pack inventory management, FIFO stock issuing with soonest expiry prioritization, handheld barcode scanning into an issue dispatch basket, destination assignment to inpatient wards or operating theatres without patient names, single pack lifecycle history lookup, and hourly expired pack reprocessing under MSDS IPC 91 & 92; Position 113 (56 points), Workspace `cssd`.
- **Contracts**: `contracts/cssd_stock.json` (5 endpoints, 1 event, 5 rules); `src/generated/cssd_stock.ts`.
- **Verification**: `tests/cssd-stock.test.mjs` (7/7 passing). Proposal ID: **266** (status: `pending` on `/docs -> My progress`).

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

## Plan for Screen 116 (`pre_anaesthesia_clinic`)
- **Workflow & Standards**: Pre-anaesthesia evaluation (PAC), ASA physical status classification (I-VI, E for emergency), airway assessment (Mallampati I-IV, thyromental distance, neck mobility), fasting status verification (NPO guidelines), medical history and cardiac/pulmonary clearance, anaesthesia risk consent readiness under MSDS COP 31, 32, 39; Position 116 (104 points), Workspace `anaesthesia` / `doctor`.
- **Bundle & Contracts**:
  - Retrieve real screen bundle via `get_screen_bundle("pre_anaesthesia_clinic")`.
  - Quality brief via `get_ui_quality_brief(screen_id="pre_anaesthesia_clinic")`.
  - Generate TypeScript contracts (`src/generated/pre_anaesthesia_clinic.ts`).
  - Examine endpoints, rules, and rubric items.
- **Domain Policies & Statutory Rules (`src/pre-anaesthesia-clinic-policy.ts`)**:
  - Anaesthesia / surgery capability view evaluation.
  - ASA physical status score classification rules.
  - Mallampati airway scoring and difficult intubation risk flags.
  - Fasting status bounds (solids vs clear liquids hours).
  - Fitness for surgery clearance decision (Fit, Fit with High Risk, Unfit / Postpone).
  - Bilingual error explanations.
- **UI Architecture (`src/screens/PreAnaesthesiaClinic.tsx`)**:
  - PAC patient assessment worklist and pre-op booking queue.
  - Comprehensive clinical assessment form: ASA score, Airway exam, Organ system review, NPO compliance, Investigations review.
  - Fitness certification & anaesthesia plan selection (General, Spinal, Epidural, Regional, MAC, Local).
- **Help, Handbook & Navigation**:
  - Contextual F1 help with all controls mapped in `src/foundation-help.ts`.
  - Task mapping in `src/foundation-catalogue.json` and `src/foundation-task-map.json`.
  - Handbook entry in `src/help.ts` with role FAQs for Anaesthetist / PAC Nurse.
  - Bundled screenshots: `public/handbook/pre_anaesthesia_clinic-en.png` and `pre_anaesthesia_clinic-ur.png`.
- **Automated Verification**:
  - `tests/pre-anaesthesia-clinic.test.mjs`.
  - `npm test`, `npm run check:help`, `npx tsc --noEmit`, `npm run build`.
  - Commit and submit `propose_progress` (Proposal 269).

---

## Completed Screens Checkpoint
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237** through **268** are awaiting human review on `/docs -> My progress`.
- Completed screens in Phase 6 so far:
  - Screen 109: `clinical_privileges` (Proposal 262)
  - Screen 110: `theatre_checklist_setup` (Proposal 263)
  - Screen 111: `cssd_setup` (Proposal 264)
  - Screen 112: `cssd_board` (Proposal 265)
  - Screen 113: `cssd_stock` (Proposal 266)
  - Screen 114: `ot_scheduling` (Proposal 267)
  - Screen 115: `ot_board` (Proposal 268)
