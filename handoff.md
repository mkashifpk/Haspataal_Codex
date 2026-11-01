# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 104 `death_record` (Death record & certificate)
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 103: **`mlc_cases_doctor`** ("Medico-legal cases (Doctor)", Position 103, 73 points) — **COMPLETED** (commit `b3c34e8`, Proposal **256** awaiting human review on `/docs -> My progress`).
- Screen 104: **`death_record`** ("Death record & certificate", Position 104, 90 points) — **COMPLETED & VERIFIED**.

### Completed Screen 104 (`death_record`) Checkpoint
- **Workflow & Standards**: WHO International Form of Medical Certificate of Cause of Death, Punjab MSDS indicators 106 and 154; Position 104 (90 points), Workspace `doctor`.
- **Contracts**:
  - `contracts/death_record.json`: Real MCP screen bundle covering 15 endpoints (`POST /patients/{patient_id}/death`, `GET /deaths/{death_id}`, `PUT /deaths/{death_id}`, `POST /deaths/{death_id}/certify`, `POST /deaths/{death_id}/corrections`, `GET /deaths/{death_id}/print-payload`, `GET /deaths/{death_id}/pdf`, `POST /deaths/{death_id}/autopsy`, `POST /deaths/{death_id}/autopsy/report`, `POST /deaths/{death_id}/autopsy/cancel`, `GET /deaths`, `GET /icd/codes`, `GET /icd/browse`, `GET /icd/codes/{code}`, `GET /icd/releases`), event `death.recorded`, and domain rules.
  - `src/generated/death_record.ts`: Generated TypeScript contracts for all 15 endpoints and data structures.
- **Domain Policies & WHO Standards (`src/death-record-policy.ts`)**:
  - Service view capability evaluation (`rule:81b46f9cf6`): `emergency_department` and inpatient views (`full`, `open_work` with banner 'No new death records from now on. Completing existing death certificates and autopsies continue.', `records`, `hidden`).
  - Doctor workspace role permissions gating: `death.record` and `death.certify` restricted strictly to registered PMDC doctors (`doctor`, `clinical_specialist`, `surgeon`, `anaesthetist`); `death.register.view` open to clinical and administrative roles; `death.autopsy.authorize` open to senior medical staff.
  - Initial death declaration validation (`rule:8c2341a2ff`): validates patient identity, past/current death timestamp, setting (`Inpatient`, `Emergency`, `Outpatient`, `BroughtDead`), arrival timestamp for brought dead, and terminal mode of dying.
  - WHO Cause-of-Death Causal Sequence (`rule:4a9cf9f9a8`): Part I lines (a) leading directly to death, due to (b), due to (c), due to (d) with respective onset-to-death intervals and validated ICD codes. The system automatically designates the lowest filled line in Part I as the underlying cause. Part II records other significant contributory conditions.
  - Diagnostic suggestion chips (`rule:9e98e4c3ec`): surfaces active conditions from previous charts as clickable chips to assign to cause lines; never silently populates.
  - Contextual attributes: manner of death (`Disease`, `Accident`, `IntentionalSelfHarm`, `Assault`, `LegalIntervention`, `War`, `PendingInvestigation`, `CouldNotBeDetermined`); mandatory external cause, place of occurrence, and incident date for violent/accidental deaths; surgery within 4 weeks check with indication; pregnancy status for females aged 10-54; perinatal birth weight, gestation weeks, hours survived, and maternal conditions for infants under 1 year.
  - Versioned draft autosave & post-certification immutability (`rule:8c96251e09`): draft saved with `PUT /deaths/{id}` (`expected_version: row_version`). Once certified, editing is locked permanently and corrections must be appended (`POST /deaths/{id}/corrections`) with mandatory factual justification (min 3 chars).
  - Medico-legal death banner & autopsy restriction (`rule:0cf8a9f905`): if `death.mlc_number` or `death.mlc_id` exists, prominent red MEDICO-LEGAL banner is displayed, and clinical autopsy is strictly forbidden (police post-mortem only).
  - Clinical Autopsy workflow (MSDS 154): requisition reasons, macroscopic/histopathology report, clinicopathological correlation (`Confirmed`, `MinorDiscrepancy`, `MajorDiscrepancy`), and cancellation.
  - A4 certificate print preview (`rule:274cc0ed96`): fetches print payload (`GET /deaths/{id}/print-payload`) and PDF link (`GET /deaths/{id}/pdf`) for family bereavement and Union Council registration.
  - Domain error explanations: maps `DEATH_CERTIFIER_NOT_DOCTOR`, `DEATH_ADMISSION_NOT_ACTIVE`, `DEATH_SETTING_INVALID`, `DEATH_TIME_INVALID`, `PATIENT_ALREADY_DECEASED`, `PATIENT_MERGED_CANNOT_TRANSACT`, `DEATH_RECORD_FINAL`, `DEATH_CERTIFICATE_INCOMPLETE`, `DEATH_RECORD_NOT_CERTIFIED`, `AUTOPSY_TRANSITION_INVALID`, `AUTOPSY_MEDICO_LEGAL`, `AUTOPSY_EXISTS`, `ICD_CODE_UNKNOWN`, `VERSION_CONFLICT`, `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/DeathRecord.tsx`)**:
  - Central Death Register with status badges (`Draft`, `Certified`), setting filter, date range, search by MRN/Name/Death #.
  - "Record Death" modal for initial declaration.
  - WHO Cause of Death Certificate editor with causal chain lines (a-d), interval fields, interactive ICD search/picker modal, suggestion chips, Part II conditions, manner dropdown, external cause inputs, surgery section, pregnancy fields, perinatal details, and certifier stamp.
  - Action drawers: Save Draft, Certify confirmation with incomplete requirements check, Append Correction dialog, Request Autopsy dialog, Record Autopsy Report modal, and formal A4 certificate print preview.
  - Bounded 100–250% zoom, Light/DarkHighContrast themes, and bilingual English/Urdu interface.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx` (navigation, labels, frontDeskScreens, service view filters, render routing).
  - Registered in `src/foundation-catalogue.json` (15 taskCalls) and `src/foundation-task-map.json` (15 control mappings).
  - Contextual F1 help (`src/foundation-help.ts`): added `death_record` to `deliveredHelpScreens` and all 79 `death_record.*` interactive controls mapped with bilingual titles and operational descriptions.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, clinical purpose, 8 operational steps, and 14 doctor role FAQs covering all 12 domain error codes and WHO guidelines.
  - Bundled screenshots: `public/handbook/death_record-en.png` and `public/handbook/death_record-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/death-record.test.mjs` (9/9 passing).
  - Help check: `npm run check:help` passed (103 screens, 2382 controls, 1474 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Full test suite: `npm test` passed (437/437 passing across all suites).
  - Production build: `npm run build` produced `dist/assets/index-Daql6nGC.js`.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, **247**, **248**, **249**, **250**, **251**, **252**, **253**, **254**, **255**, and **256** are awaiting human review on `/docs -> My progress`.

---

## Next Concrete Actions
1. Commit Screen 104 (`death_record`): `git add -A` and `git commit -m "Implement Screen 104: death_record (Death record & certificate)"`.
2. Submit `propose_progress` for `death_record` with rubric fingerprint `4e7cb2e8c7b8` and 33 tested items (excluding `q:fresh_data`).
3. Verify via `progress_proposals(implementation_id: 1)`.
4. Update `handoff.md` with proposal ID and commit handoff update.
5. Check next screen in roadmap dependency order via `get_build_roadmap()`.
