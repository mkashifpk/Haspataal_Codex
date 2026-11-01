# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 106 `body_release_er` (Bodies awaiting handover - ER)
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 104: **`death_record`** ("Death record & certificate", Position 104, 90 points) — **COMPLETED** (commit `2d501bf`, Proposal **257** awaiting human review on `/docs -> My progress`).
- Screen 105: **`body_release_ward`** ("Bodies awaiting handover - Ward", Position 105, 54 points) — **COMPLETED** (commit `65a9ab8`, Proposal **258** awaiting human review on `/docs -> My progress`).
- Screen 106: **`body_release_er`** ("Bodies awaiting handover - ER", Position 106, 54 points) — **IN PROGRESS**.

### Completed Screen 105 (`body_release_ward`) Checkpoint
- **Workflow & Standards**: Formal deceased inpatient handover to next of kin or police escort; Punjab MSDS indicators 106 and 154; Position 105 (54 points), Workspace `ward_nurse`.
- **Contracts**:
  - `contracts/body_release_ward.json`: Real MCP screen bundle covering 5 endpoints (`GET /deaths`, `GET /deaths/{death_id}`, `POST /deaths/{death_id}/body-release`, `GET /deaths/{death_id}/print-payload`, `GET /deaths/{death_id}/pdf`), realtime event `death.recorded`, and domain rules (`rule:cd68894ad3`, `rule:60aea191e4`, `rule:15e617c197`, `rule:20c304a0c8`).
  - `src/generated/body_release_ward.ts`: Generated TypeScript contracts for all 5 endpoints and data structures.
- **Domain Policies & Statutory Rules (`src/body-release-policy.ts`)**:
  - Service view capability evaluation (`rule:20c304a0c8`): `inpatient_wards` service (`full`, `open_work` with banner 'No new inpatient admissions from now on. Completing existing body handovers and printing continue.', `records`, `hidden`).
  - Role permissions gating: `death.body.release` authorized for `ward_nurse`, `head_nurse`, `triage_nurse`, `doctor`, `clinical_specialist`, `surgeon`, `anaesthetist`; `death.register.view` authorized for clinical and administrative roles.
  - Doctor certification prerequisite (`rule:cd68894ad3`): body release is strictly refused (`DEATH_RECORD_NOT_CERTIFIED`) if `status === "Draft"`. Draft records are displayed in the queue with a disabled, greyed handover button and warning tooltip informing nursing staff that the attending PMDC doctor must certify first.
  - Recipient identity verification (`rule:60aea191e4`):
    - Non-MLC release (to next of kin): receiver full name (min 3 chars), kinship relationship (Spouse, Son, Daughter, Father, Mother, Brother, Sister, Guardian), verified CNIC or national ID number, contact telephone number, and signed acknowledgment.
    - MLC release (to police escort): prominent red MEDICO-LEGAL banner, mandatory police daily diary (roznamcha) or dispatch letter reference, police station name, and officer identity.
  - Printable certificate with handover audit (`rule:15e617c197`): fetches print payload (`GET /deaths/{id}/print-payload`) and PDF link (`GET /deaths/{id}/pdf`) carrying receiver credentials, release timestamp, and dual signature lines for recipient and nurse.
  - Domain error explanations: maps `DEATH_RECORD_NOT_CERTIFIED`, `BODY_ALREADY_RELEASED`, `BODY_RELEASE_POLICE_REFERENCE_REQUIRED`, `VALIDATION_ERROR`, `FORBIDDEN`, `VERSION_CONFLICT`.
- **UI Architecture (`src/screens/BodyRelease.tsx` & `src/screens/BodyReleaseWard.tsx`)**:
  - Reusable clinical screen parameterized with `screenId: "body_release_ward"` (`same_component_as: ["body_release_er"]`).
  - Pending body handover queue with filters for status (Pending, Certified Ready, Draft, Released) and setting (Inpatient, Emergency, Brought Dead, Outpatient), plus search across MRN/Name/Death #/MLC #.
  - KPI summary tiles: Ready for Handover, Awaiting Certification, Medico-Legal Cases, Released Handover.
  - Handover modal dialog with recipient entity selector, CNIC validation, relationship dropdown, police reference for MLC casualties, and personal belongings inventory note.
  - Death detail drawer showing WHO Part I & II causal chain, underlying cause, and PMDC certifier stamp.
  - Official A4 print preview dialog with dual signature blocks for family receiver and staff nurse.
  - Bounded 100–250% zoom, Light/DarkHighContrast themes, and bilingual English/Urdu interface.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx` (navigation, labels, frontDeskScreens, service view filters, render routing).
  - Registered in `src/foundation-catalogue.json` (5 taskCalls) and `src/foundation-task-map.json` (5 control mappings).
  - Contextual F1 help (`src/foundation-help.ts`): added `body_release_ward` to `deliveredHelpScreens` and all 23 `body_release.*` interactive controls mapped with bilingual titles and operational descriptions.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, clinical purpose, 8 operational steps, and 8 role FAQs tailored for `ward_nurse` (including error seeds `DEATH_RECORD_NOT_CERTIFIED`, `BODY_ALREADY_RELEASED`, `BODY_RELEASE_POLICE_REFERENCE_REQUIRED`).
  - Bundled screenshots: `public/handbook/body_release_ward-en.png` and `public/handbook/body_release_ward-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/body-release.test.mjs` (6/6 passing).
  - Help check: `npm run check:help` passed (104 screens, 2406 controls, 1497 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Full test suite: `npm test` passed (443/443 passing across all suites).
  - Production build: `npm run build` produced `dist/assets/index-DXOtbCYz.js`.
- **Commit & Proposal**:
  - Implementation commit: `65a9ab8`.
  - Proposal ID: **258** (status: `pending` on `/docs -> My progress`).

---

## Plan for Screen 106 (`body_release_er`)
- **Workflow & Standards**: Handover of deceased patients from Emergency Department (`emergency_department` capability); Position 106 (54 points), Workspace `triage` / `er_nurse`.
- **Reusability**: Uses existing `src/screens/BodyRelease.tsx` wrapped in `src/screens/BodyReleaseER.tsx` with `screenId="body_release_er"` (`same_component_as: ["body_release_ward"]`).
- **Endpoints & Contracts**: Reuses `contracts/body_release_er.json` and `src/generated/body_release_er.ts` (5 endpoints: `GET /deaths`, `GET /deaths/{id}`, `POST /deaths/{id}/body-release`, `GET /deaths/{id}/print-payload`, `GET /deaths/{id}/pdf`).
- **Domain Policies**: `src/body-release-policy.ts` already parameterized for `body_release_er` (`emergency_department` capability gate, role permissions for `triage_nurse`, `doctor`, `clinical_specialist`).
- **Wiring & Help**:
  - Wire into `src/App.tsx`, `src/foundation-catalogue.json`, `src/foundation-task-map.json`.
  - Add `"body_release_er"` to `deliveredHelpScreens` in `src/foundation-help.ts` and tag all 23 `body_release.*` controls with `["body_release_ward", "body_release_er"]`.
  - Author ER triage nurse handbook entry and FAQs in `src/help.ts`.
  - Bundle screenshots `public/handbook/body_release_er-*.png`.
  - Add ER-specific unit tests in `tests/body-release-er.test.mjs` and update `tests/help-coverage.test.mjs` to assert 105 screens.
  - Verify via `check:help`, `tsc`, `npm test`, `npm run build`.
  - Commit Screen 106 and submit `propose_progress`.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, **247**, **248**, **249**, **250**, **251**, **252**, **253**, **254**, **255**, **256**, **257**, and **258** are awaiting human review on `/docs -> My progress`.
