# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 6 Screen 121 `ot_consumables_nurse` (OT consumables & implants - OT Nurse workspace)
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
- Screen 117: **`consents_anaesthesia`** ("Anaesthesia consent", Position 117, 92 points, workspace `anaesthesia` / `doctor`) — **COMPLETED** (commit `e85395b`, Proposal **270** awaiting human review on `/docs -> My progress`).
- Screen 118: **`safety_checklist`** ("Surgical safety checklist - Sign In / Time Out / Sign Out", Position 118, 79 points, workspace `ot_nurse` / `theatre`) — **COMPLETED** (commit `57bda5f`, Proposal **271** awaiting human review on `/docs -> My progress`).
- Screen 119: **`safety_checklist_admin`** ("Surgical safety checklist - OT Admin workspace", Position 119, 79 points, workspace `ot_admin`) — **COMPLETED** (commit `6660458`, Proposal **272** awaiting human review on `/docs -> My progress`).
- Screen 120: **`safety_checklist_anaesthesia`** ("Surgical safety checklist - Anaesthesia workspace", Position 120, 79 points, workspace `anaesthesia`) — **COMPLETED** (commit `b1b524e`, Proposal **273** awaiting human review on `/docs -> My progress`).
- Screen 121: **`ot_consumables_nurse`** ("OT consumables & implants", Position 121, 47 points, workspace `ot_nurse`) — **NEXT**.

---

### Completed Screen 120 (`safety_checklist_anaesthesia`) Checkpoint
- **Workflow & Standards**: WHO Surgical Safety Checklist (MSDS COP 37, 44) tailored to the anaesthesia clinical journey: pre-induction Sign In airway and allergy assessment, pre-incision Time Out multidisciplinary pause with operating surgeon verified from active PMDC clinical privileges, and post-procedure Sign Out review of emergence, airway stability, and recovery placement under Rule cafa8b3761, Rule b410c48dc4, Rule a90b6173b4, Rule c4919df195, Rule 45c2bd9ac6, Rule 9e9cb593cb, and Rule 02fc9c5710; Position 120 (79 points), Workspace `anaesthesia`.
- **Contracts**:
  - `contracts/safety_checklist_anaesthesia.json`: Saved real MCP screen bundle (10 endpoints, 2 realtime events, 8 statutory rules, 30 rubric items).
- **Domain Policies & Statutory Rules (`src/safety-checklist-policy.ts`)**:
  - Runtime service capability gating (`rule:02fc9c5710`): evaluates `GET /establishment` views for `safety_checklist_anaesthesia` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Role permissions: `canOperateChecklist` checks `ot.clinical.anaesthesia`, `ot.checklist.manage`, `ot.checklist.record`, `doctor.view`, and `anaesthetist` role.
- **Verification**:
  - Automated unit tests: `tests/safety-checklist-anaesthesia.test.mjs` (7/7 passing).
  - Full test suite: `npm test` passed (547/547 passing across all suites).
  - Help check: `npm run check:help` passed (119 screens, 2793 controls, 1832 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-D_-2_Lal.js`).
- **Commit & Proposal**:
  - Implementation commit: `b1b524e`.
  - Proposal ID: **273** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 119 (`safety_checklist_admin`) Checkpoint
- **Workflow & Standards**: WHO Surgical Safety Checklist (MSDS COP 37, 44) administrative oversight in `ot_admin`: multi-suite theatre pause audit, statutory prerequisite compliance verification (surgeon's pre-op note, PAC clearance, given consents), physical presence verification for operating surgeons and anaesthetists with active clinical privileges, intra-operative adverse incident and swab/instrument count discrepancy tracking, and post-finality correction addenda audit under Rule cafa8b3761, Rule b410c48dc4, Rule a90b6173b4, Rule c4919df195, Rule 45c2bd9ac6, Rule 9e9cb593cb, and Rule 3028300996; Position 119 (79 points), Workspace `ot_admin`.
- **Contracts**:
  - `contracts/safety_checklist_admin.json`: Saved real MCP screen bundle (10 endpoints, 2 realtime events, 8 statutory rules, 30 rubric items).
- **Domain Policies & Statutory Rules (`src/safety-checklist-policy.ts`)**:
  - Runtime service capability gating (`rule:3028300996`): evaluates `GET /establishment` views for `safety_checklist_admin` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Role permissions: `canOperateChecklist` checks `ot_admin` role and `ot.checklist.manage`.
- **Verification**:
  - Automated unit tests: `tests/safety-checklist-admin.test.mjs` (7/7 passing).
  - Proposal ID: **272** (status: `pending` on `/docs -> My progress`). Commit: `6660458`.

---

### Completed Screen 118 (`safety_checklist`) Checkpoint
- **Workflow & Standards**: WHO Surgical Safety Checklist (MSDS COP 39, 41) spanning three chronological operative pauses:
  1. **Sign In**: Before anaesthesia induction (verifies patient identity, marked site, consent, anaesthesia safety check, pulse oximeter, allergies, difficult airway, blood loss risk >= 500ml). Prerequisite gate strictly blocks sign-in if PreOpNote is missing (`OT_PRE_OP_NOTE_REQUIRED`), PAC assessment finding fit is missing (`OT_PRE_ANAESTHESIA_REQUIRED`), or surgical/anaesthesia consents are not `Given` (`CONSENT_REQUIRED`).
  2. **Time Out**: Before skin incision (introduction of all team members by name and role, verbal confirmation of patient identity, procedure, site, critical events, antibiotic prophylaxis within 60 mins, essential imaging displayed). Mandates operating surgeon and anaesthetist physically present in theatre, verified from active clinical privileges (`GET /ot/privileges`, Rule c4919df195, Rule db3a19e806).
  3. **Sign Out**: Before patient leaves theatre (nurse verbally confirms procedure name, instrument, sponge and needle counts correct, specimen labelled, equipment issues, recovery plan). Operation cannot be completed before Sign Out (Rule 45c2bd9ac6).
- **Contracts**:
  - `contracts/safety_checklist.json`: Saved real MCP screen bundle (10 endpoints, 2 realtime events, 8 statutory rules, 30 rubric items).
  - `src/generated/safety_checklist.ts`: Generated TypeScript contracts for all 10 operations and data models.
- **Domain Policies & Statutory Rules (`src/safety-checklist-policy.ts`)**:
  - Runtime service capability gating (`rule:63f7754901`): evaluates `GET /establishment` views for `safety_checklist` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Active surgery check (`isSurgeryActive`).
  - Role permissions (`canOperateChecklist`: `ot.checklist.manage`, `ot.clinical.record`, `ot.clinical.view`, `doctor.view`).
  - Strict pause order (`determineNextPhase`, `rule:cafa8b3761`): Sign In -> Time Out -> Sign Out.
  - Prerequisite validation (`checkPhasePrerequisites`, `rule:a90b6173b4`): PreOpNote, Fit PAC assessment, and Given consents required.
  - Answer verification (`validateChecklistAnswers`, `rule:b410c48dc4`): Yes on confirmations, notes on `note_when`.
  - Team attendance validation (`validateTimeOutTeam`, `rule:c4919df195`): requires PrimarySurgeon and Anesthetist.
  - Bilingual error explanations (`explainSafetyChecklistError`).
- **UI Architecture (`src/screens/SafetyChecklist.tsx`)**:
  - Surgical case worklist (`GET /ot/clinical-worklist`) with 1, 3, 7, 14 days and `mine` filter (`rule:cafa8b3761`).
  - 3-phase stepper tabs with visual completion badges.
  - Prerequisite alert banner with dynamic blocker itemization (`rule:a90b6173b4`).
  - Interactive checklist form with Confirm and Question controls, notes, and verbal pause certification.
  - Time Out team selector for Primary Surgeon and Anaesthetist from active privileges (`GET /ot/privileges`).
  - Immutable completed pause display (`OT_RECORD_FINAL`, `rule:9e9cb593cb`).
  - Post-finality addendum correction modal (`POST /ot/bookings/{id}/corrections`).
  - In-theatre adverse event and near-miss reporting modal (`POST /incidents`, `GET /incident-types`).
  - Realtime synchronization: auto-refreshes on `ot.clinical.updated` and `ot.booking.updated` events.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (10 tasks), `src/foundation-task-map.json` (10 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `safety_checklist` to `deliveredHelpScreens` and all 29 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 10 operational steps, and 6 role FAQs.
  - Bundled screenshots: `public/handbook/safety_checklist-en.png` and `safety_checklist-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/safety-checklist.test.mjs` (8/8 passing).
  - Full test suite: `npm test` passed (533/533 passing across all suites).
  - Help check: `npm run check:help` passed (117 screens, 2793 controls, 1832 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-D0q1mpP3.js`).
- **Commit & Proposal**:
  - Implementation commit: `57bda5f`.
  - Proposal ID: **271** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 117 (`consents_anaesthesia`) Checkpoint
- **Workflow & Standards**: Pre-operative and surgical informed consent management, statutory risk-benefit counseling in patient's vernacular, legal decision-maker verification against server's `who_decides` policy (minors prohibited from self-consent, priority-ranked decision-maker relationships), questions-and-answers clinical dialogue audit, signature/thumb-impression capture with mandatory staff witness, verbal refusal documentation, emergency notes with concurring second PMDC-registered doctor, bilingual A4 printable consent document (RTL Nastaliq Urdu layout), and signed paper scan attachment under Rule e9d9f576df, Rule d84307d9b2, Rule fea5622fc5, Rule b7bacc1ffb, Rule cb2f327ee7, Rule 8b7301ca0f, Rule f811c03843, Rule a52becc623, and MSDS COP 31, 32; Position 117 (92 points), Workspace `anaesthesia` / `doctor`.
- **Contracts**:
  - `contracts/consents_anaesthesia.json`: Saved real MCP screen bundle (15 endpoints, 1 realtime event, 8 statutory rules).
  - `src/generated/consents_anaesthesia.ts`: Generated TypeScript contracts for all 15 operations and data models.
- **Domain Policies & Statutory Rules (`src/consents-anaesthesia-policy.ts`)**:
  - Runtime service capability gating (`rule:a52becc623`): `surgery` capability view evaluation (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Active surgery check (`isSurgeryActive`).
  - Role permissions (`canManageConsents`: `consent.record`, `consent.configure`, `consent.view`, `ot.clinical.anaesthesia`, `doctor.view`).
  - Clinical credential verification (`isAuthorizedConsentTaker`, `rule:f811c03843`): anaesthesia consent requires a registered doctor of the anaesthesia team (`CONSENT_TAKER_NOT_AUTHORIZED`).
  - Draft validation (`validateConsentDraft`, `rule:d84307d9b2`): verifies form code, language, procedure name.
  - Decision & signature validation (`validateConsentSign`, `rule:b7bacc1ffb`, `rule:cb2f327ee7`): enforces server `who_decides` rules, prohibits minor self-signing, validates relationship against authorized priority list, mandates CNIC, phone, incapacity reason, questions/answers, understanding confirmation, witness for thumb impression, and second doctor for emergency note.
  - Refusal validation (`validateConsentRefuse`, `rule:b7bacc1ffb`): mandates clinical reason in patient's words, witness for verbal refusal.
  - Bilingual error explanations (`explainConsentError`): translates `CONSENT_TAKER_NOT_AUTHORIZED`, `CONSENT_SIGNER_INVALID`, `CONSENT_TEXT_MISSING`, `CONSENT_INCOMPLETE`, `CONSENT_DECIDED_FINAL`, etc.
- **UI Architecture (`src/screens/ConsentsAnaesthesia.tsx`)**:
  - Tab 1: Consent Worklist (`GET /consent-worklist`) with timeframe filter (1, 3, 7, 14 days), `mine` filter, type filter, search, and red overdue indicators (`rule:e9d9f576df`). Quick routing to open existing drafts or prepare fresh consent.
  - Tab 2: Consent Register (`GET /consents`) with status filter and search.
  - Detail / Preparation Panel: Form template select, language select, procedure name, performer name, risks, benefits, alternatives, 'Read aloud to patient' toggle, and interpreter name (`rule:fea5622fc5`).
  - Missing field warnings (`consent.missing`).
  - Formal Sign Modal: supports Signed and EmergencyNote modes; Patient vs DecisionMaker; legal relationship dropdown strictly populated from `who_decides.decision_makers`; signature or thumb impression with witness; questions & answers text; understanding confirmed checkbox; emergency second doctor select (`rule:cb2f327ee7`).
  - Formal Refusal Modal: Signed vs VerbalRefusal with witness and refusal reason.
  - Withdrawal Modal: formal withdrawal reason for finalized consents (`rule:8b7301ca0f`).
  - Scan Attachment Modal: file upload to patient documents (`POST /patients/{id}/documents`) and attachment to consent (`POST /consents/{id}/scan`).
  - Print Preview Modal: A4 formatted print payload preview with hospital header, PHC number, issue line, and RTL Nastaliq Urdu styling (`rule:fea5622fc5`).
  - Realtime synchronization: auto-refreshes on `consent.updated` events.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (15 tasks), `src/foundation-task-map.json` (15 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `consents_anaesthesia` to `deliveredHelpScreens` and all 59 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 10 operational steps, and 6 role FAQs.
  - Bundled screenshots: `public/handbook/consents_anaesthesia-en.png` and `public/handbook/consents_anaesthesia-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/consents-anaesthesia.test.mjs` (8/8 passing).
  - Full test suite: `npm test` passed (525/525 passing across all suites).
  - Help check: `npm run check:help` passed (116 screens, 2760 controls, 1803 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-GTMq9y85.js`).
- **Commit & Proposal**:
  - Implementation commit: `e85395b`.
  - Proposal ID: **270** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 116 (`pre_anaesthesia_clinic`) Checkpoint
- **Workflow & Standards**: Pre-anaesthesia clinic (PAC) evaluation, pre-operative worklist with days filter and `mine` toggle, multi-parameter clinical assessment (vital signs bounds, organ systems, Mallampati airway classification I-IV, ASA physical status score I-VI with emergency 'E' modifier), multi-tier fitness clearance decision (Fit, FitWithConditions, Deferred, NotFit) with mandatory clinical rationale notes for non-standard clearances, optimistic concurrency draft saves, clinical privileges verification for assessment signing, and integrated informed anaesthesia consent generation under Rule 2e64c4a389, Rule a91aa7215a, Rule d4ca3b3bcc, Rule d5b2105887, Rule 9e9cb593cb, Rule db3a19e806, Rule be026bcee1, and MSDS COP 31, 32, 39; Position 116 (104 points), Workspace `anaesthesia` / `doctor`.
- **Contracts**:
  - `contracts/pre_anaesthesia_clinic.json`: Saved real MCP screen bundle (19 endpoints, 2 realtime events, 7 statutory rules).
  - `src/generated/pre_anaesthesia_clinic.ts`: Generated TypeScript contracts for all 19 operations and domain types.
- **Verification**: `tests/pre-anaesthesia-clinic.test.mjs` (8/8 passing). Full test suite: 517/517 passing. Proposal ID: **269** (status: `pending`). Commit: `c6167d3`.

---

## Plan for Screen 121 (`ot_consumables_nurse`)
- **Workflow & Standards**: Intra-operative consumable usage, surgical implants tracking, sterile batch safety, and implant stickers / barcoding in `ot_nurse` workspace:
  - Consumables and implant recording against active surgical bookings (`GET /ot/bookings/{id}/surgical-record`).
  - Implants serial, LOT/batch number, expiry, manufacturer recording.
  - Safe stock deduction and sterile supply linkage with CSSD.
- **Position & Workspace**: Position 121 (47 points), Workspace `ot_nurse`.
- **Bundle & Contracts**:
  - Retrieve screen bundle via `get_screen_bundle("ot_consumables_nurse")`.
  - Quality brief via `get_ui_quality_brief(screen_id="ot_consumables_nurse")`.
- **Verification**:
  - `tests/ot-consumables-nurse.test.mjs`.
  - `npm test`, `npm run check:help`, `npx tsc --noEmit`, `npm run build`.
  - Submit `propose_progress` (Proposal 274).

---

## Completed Screens Checkpoint
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237** through **273** are awaiting human review on `/docs -> My progress`.
- Completed screens in Phase 6 so far:
  - Screen 109: `clinical_privileges` (Proposal 262)
  - Screen 110: `theatre_checklist_setup` (Proposal 263)
  - Screen 111: `cssd_setup` (Proposal 264)
  - Screen 112: `cssd_board` (Proposal 265)
  - Screen 113: `cssd_stock` (Proposal 266)
  - Screen 114: `ot_scheduling` (Proposal 267)
  - Screen 115: `ot_board` (Proposal 268)
  - Screen 116: `pre_anaesthesia_clinic` (Proposal 269)
  - Screen 117: `consents_anaesthesia` (Proposal 270)
  - Screen 118: `safety_checklist` (Proposal 271)
  - Screen 119: `safety_checklist_admin` (Proposal 272)
  - Screen 120: `safety_checklist_anaesthesia` (Proposal 273)

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
