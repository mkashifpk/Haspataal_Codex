# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 108 `transfusion_bedside_er` (Bedside transfusion observation - ER)
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 104: **`death_record`** ("Death record & certificate", Position 104, 90 points) — **COMPLETED** (commit `2d501bf`, Proposal **257** awaiting human review on `/docs -> My progress`).
- Screen 105: **`body_release_ward`** ("Bodies awaiting handover - Ward", Position 105, 54 points) — **COMPLETED** (commit `65a9ab8`, Proposal **258** awaiting human review on `/docs -> My progress`).
- Screen 106: **`body_release_er`** ("Bodies awaiting handover - ER", Position 106, 54 points) — **COMPLETED** (commit `7e89cdd`, Proposal **259** awaiting human review on `/docs -> My progress`).
- Screen 107: **`patient_programmes_triage`** ("Preventive programmes of a patient - Triage", Position 107, 63 points) — **COMPLETED** (commit `40efb78`, Proposal **260** awaiting human review on `/docs -> My progress`).
- Screen 108: **`transfusion_bedside_er`** ("Bedside transfusion observation - ER", Position 108, 74 points) — **NEXT / IN PROGRESS** (Final screen of Phase 5!).

---

### Completed Screen 106 (`body_release_er`) Checkpoint
- **Workflow & Standards**: Deceased patient handover from Emergency Department (`emergency_department` capability); Position 106 (54 points), Workspace `triage`.
- **Contracts**:
  - `contracts/body_release_er.json`: Real MCP screen bundle covering 5 endpoints (`GET /deaths`, `GET /deaths/{death_id}`, `POST /deaths/{death_id}/body-release`, `GET /deaths/{death_id}/print-payload`, `GET /deaths/{death_id}/pdf`), realtime event `death.recorded`, and domain rules (`rule:cd68894ad3`, `rule:60aea191e4`, `rule:15e617c197`, `rule:d0ca07a547`).
  - `src/generated/body_release_er.ts`: Re-exported from `./body_release_ward`.
- **Domain Policies & Statutory Rules (`src/body-release-policy.ts`)**:
  - Service view capability evaluation (`rule:d0ca07a547`): `emergency_department` service (`full`, `open_work` with banner, `records`, `hidden`).
  - Role permissions gating: `death.body.release` authorized for `triage_nurse`, `doctor`, `clinical_specialist`; `death.register.view` authorized for clinical and administrative roles.
  - Doctor certification prerequisite (`rule:cd68894ad3`): body release strictly refused (`DEATH_RECORD_NOT_CERTIFIED`) if `status === "Draft"`. Draft records displayed greyed out with disabled handover button and warning tooltip.
  - Recipient identity verification (`rule:60aea191e4`): family handover mandates full name, relationship, CNIC/ID, phone; medico-legal casualties require roznamcha daily diary / police letter reference under prominent red MEDICO-LEGAL banner.
  - Printable certificate with handover audit (`rule:15e617c197`): fetches print payload (`GET /deaths/{id}/print-payload`) and PDF link (`GET /deaths/{id}/pdf`) carrying dual signature lines for recipient and ER nurse.
- **UI Architecture (`src/screens/BodyReleaseER.tsx`)**:
  - Reused clinical component architecture (`src/screens/BodyRelease.tsx`) wrapped by `src/screens/BodyReleaseER.tsx` with `screenId="body_release_er"` (`same_component_as: ["body_release_ward"]`).
  - Pending body handover queue with filters, KPI tiles, handover modal, detail drawer, and A4 print preview.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (5 task calls), `src/foundation-task-map.json` (5 control mappings).
  - Contextual F1 help (`src/foundation-help.ts`): added `body_release_er` to `deliveredHelpScreens` and all 23 `body_release.*` controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, clinical purpose, 8 operational steps, and 8 role FAQs for ER triage nurse.
  - Bundled screenshots: `public/handbook/body_release_er-en.png` and `public/handbook/body_release_er-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/body-release-er.test.mjs` (6/6 passing).
  - Help check: `npm run check:help` passed (105 screens).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Full test suite: `npm test` passed (449/449 passing).
  - Production build: `npm run build` succeeded (`dist/assets/index-Bj7mlWgG.js`).
- **Commit & Proposal**:
  - Implementation commit: `7e89cdd`.
  - Proposal ID: **259** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 107 (`patient_programmes_triage`) Checkpoint
- **Workflow & Standards**: Enrol ER walk-in and acute trauma patients in offered preventive programmes (tetanus, rabies, hepatitis prophylaxis, EPI immunization, family planning), record services given from physical card, follow up due patients, and close enrolments; Position 107 (63 points), Workspace `triage`.
- **Contracts**:
  - `contracts/patient_programmes_triage.json`: Real MCP screen bundle covering 6 endpoints (`GET /patients/{id}/programmes`, `POST /patients/{id}/programmes`, `POST /programme-enrolments/{id}/entries`, `POST /programme-enrolments/{id}/close`, `GET /preventive-programmes`, `GET /preventive-programmes/due`) and domain rules (`rule:288e88802f`, `rule:aeeeb885d1`, `rule:d4a008a82a`, `rule:692d8bf9d7`, `rule:4740c21f9f`, `rule:f28dbf9fa4`, `rule:79051b4dae`, `rule:595bd3d226`).
  - `src/generated/patient_programmes_triage.ts`: Re-exported from `./patient_programmes`.
- **Domain Policies & Statutory Rules (`src/programme-rules.ts`)**:
  - Service capability evaluation (`rule:288e88802f`, `rule:79051b4dae`, `rule:595bd3d226`): `preventive_programmes` service. When Active, new enrolments are permitted. When Retiring, new enrolments are blocked with 'No new enrolment from now on', while ongoing dose administration and closure remain enabled for patients enrolled before retirement.
  - Enrolment input validation (`rule:aeeeb885d1`): mandates physical card/register number; duplicate enrolments trigger `PROGRAMME_ENROLLED` with dedicated 'Read and open existing enrolment' action rather than guessing IDs.
  - Service entry validation (`rule:d4a008a82a`): requires selecting an offered service, hospital administration time (no future times), batch number, and next appointment date as stated on physical card. Prevents automated schedule computation or date pre-filling.
  - Closure validation (`rule:692d8bf9d7`): Completed, TransferredOut (destination facility required), and Discontinued (clinical explanation required). Closed enrolments reject further writes with `PROGRAMME_ENROLMENT_CLOSED`.
  - Due list query (`rule:4740c21f9f`): defaults to hospital today with audited patient record access and telephone contact display.
  - Runtime screen view modes (`rule:f28dbf9fa4`): `full`, `open_work` with banner, `records`, `hidden` derived from `GET /establishment`.
- **UI Architecture (`src/screens/PatientProgrammesTriage.tsx`)**:
  - Wrapper component delegating to `src/screens/PatientProgrammes.tsx` with `screenId="patient_programmes_triage"` (`same_component_as: ["patient_programmes"]`).
  - Active programme catalogue, enrolment form with card number input, active enrolments list with status badges, administered service entries list with author stamps, service recording modal, close enrolment dialog, and due list worklist.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (6 task calls), `src/foundation-task-map.json` (6 control mappings).
  - Contextual F1 help (`src/foundation-help.ts`): added `patient_programmes_triage` to `deliveredHelpScreens` and all 7 `programme.*` controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, clinical purpose, 8 operational steps, and 8 role FAQs for ER triage nurse (including error seeds `triage:error:PROGRAMME_ENROLLED`, `triage:error:PROGRAMME_ENROLMENT_CLOSED`, and state seed `triage:state:programme_enrolment`).
  - Bundled screenshots: `public/handbook/patient_programmes_triage-en.png` and `public/handbook/patient_programmes_triage-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/patient-programmes-triage.test.mjs` (5/5 passing).
  - Help check: `npm run check:help` passed (106 screens).
  - Help coverage test: `tests/help-coverage.test.mjs` passed (28/28 tests).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Full test suite: `npm test` passed (454/454 passing across all suites).
  - Production build: `npm run build` produced `dist/assets/index-DdVxxGUY.js`.
- **Commit & Proposal**:
  - Implementation commit: `40efb78`.
  - Proposal ID: **260** (status: `pending` on `/docs -> My progress`).

---

## Plan for Screen 108 (`transfusion_bedside_er`)
- **Workflow & Standards**: Bedside blood transfusion observation, verification and administration in ER; Position 108 (74 points), Workspace `triage` / `er_nurse`. Final screen of Phase 5!
- **Bundle & Contracts**:
  - Fetch contract bundle via `get_screen_bundle("transfusion_bedside_er")`.
  - Inspect `same_component_as` (likely `transfusion_bedside_ward` or `transfusion_bedside`).
  - Check endpoints: blood requests, transfusions, bedside observations, start/end/reaction/return, wristband verification.
  - Generate TypeScript contracts (`src/generated/transfusion_bedside_er.ts`).
- **Domain Policies & Statutory Rules**:
  - Pre-transfusion dual bedside check (two clinicians, patient identity, blood unit label, ABO/Rh compatibility, expiry, integrity).
  - Transfusion vitals monitoring (baseline, 15-minute, periodic, completion vitals).
  - Acute transfusion reaction handling (immediate stop, reaction report, bag return to blood bank).
- **UI Architecture & Help**:
  - Wire into `src/App.tsx`, `src/foundation-catalogue.json`, `src/foundation-task-map.json`.
  - Contextual F1 help and handbook entry in `src/help.ts` with role FAQs.
  - Screenshots in `public/handbook/`.
  - Automated unit tests in `tests/transfusion-bedside-er.test.mjs`.
  - Verify via `check:help`, `tsc`, `npm test`, `npm run build`.
  - Commit Screen 108 and submit `propose_progress`.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, **247**, **248**, **249**, **250**, **251**, **252**, **253**, **254**, **255**, **256**, **257**, **258**, **259**, and **260** are awaiting human review on `/docs -> My progress`.
