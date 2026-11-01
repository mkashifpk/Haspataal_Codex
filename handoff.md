# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 6 Screen 110 `theatre_checklist_setup` (Surgical safety checklist setup & configuration)
Executing the Phase 6 Roadmap ("Theatre and sterile supply") in dependency order along with all tests and MCP progress reporting:
- Screen 108: **`transfusion_bedside_er`** ("Bedside transfusion observation - ER", Position 108, 74 points) — **COMPLETED** (commit `2803cf0`, Proposal **261** awaiting human review on `/docs -> My progress`). Marks Phase 5 100% complete!
- Screen 109: **`clinical_privileges`** ("Clinical privileges", Position 109, 55 points) — **COMPLETED** (commit `5ddbd89`, Proposal **262** awaiting human review on `/docs -> My progress`). First screen of Phase 6!
- Screen 110: **`theatre_checklist_setup`** ("Surgical safety checklist configuration", Position 110, 52 points) — **NEXT / IN PROGRESS**.

---

### Completed Screen 108 (`transfusion_bedside_er`) Checkpoint
- **Workflow & Standards**: Bedside blood transfusion observation, 2-person bedside identity and unit verification, 30-minute cold chain expiry countdown, vital signs monitoring, acute reaction alerting with Section 13 dispatch, and safe unit return in the Emergency Department; Position 108 (74 points), Workspace `triage`.
- **Contracts**:
  - `contracts/transfusion_bedside_er.json`: Real MCP screen bundle covering 9 endpoints (`GET /blood/requests`, `GET /blood/requests/{request_id}`, `GET /blood/transfusions/{transfusion_id}`, `POST /blood/transfusions/{transfusion_id}/observations`, `POST /blood/transfusions/{transfusion_id}/start`, `POST /blood/transfusions/{transfusion_id}/end`, `POST /blood/transfusions/{transfusion_id}/reaction`, `POST /blood/transfusions/{transfusion_id}/return`, `GET /wristbands/verify`), 2 realtime events (`blood.unit.issued`, `blood.consent.withdrawn`), and domain rules (`rule:e1211e09ae`, `rule:8e16f20b4a`, `rule:0a07d57ff8`, `rule:efcdf1e299`, `rule:a2f80c80d7`, `rule:877e58cf09`, `rule:78e01b2ba4`).
  - `src/generated/transfusion_bedside_er.ts`: Re-exported from `./transfusion_bedside`.
- **Domain Policies & Statutory Rules (`src/transfusion-bedside-policy.ts`)**:
  - Parameterized `getTransfusionBedsideScreenView(establishment, "transfusion_bedside_er")` supporting runtime service view evaluation (`rule:78e01b2ba4`, `rule:877e58cf09`).
  - 30-minute cold chain threshold (`rule:8e16f20b4a`): countdown to `start_by`. Beyond 30 minutes, server enforces `BLOOD_UNIT_OUT_TOO_LONG` and mandatory return as Not Given with `OutOfStorageTooLong`.
  - Bedside dual independent verification (`rule:0a07d57ff8`): wristband scan or two-identifier confirmation, 5 mandatory checkboxes (none pre-ticked), step-up credential verification for second qualified clinician (blocks `DUAL_CONTROL_SAME_PERSON`).
  - Observations & 4-hour limit (`rule:efcdf1e299`): baseline before start, periodic observations, end vitals; flags `ended_late` if exceeding 4 hours.
  - Adverse reaction & Section 13 alerting (`rule:a2f80c80d7`): automatic Section 13 hospital incident dispatch, sentinel event on wrong blood, detailed capture of delayed haemolytic / bacterial reactions.
  - Consent withdrawal (`rule:e1211e09ae`): immediate halt on `blood.consent.withdrawn`, blocking unstarted units (`BLOOD_CONSENT_REQUIRED`).
- **UI Architecture (`src/screens/TransfusionBedsideER.tsx`)**:
  - Dedicated ER wrapper passing `screenId="transfusion_bedside_er"` to `src/screens/TransfusionBedside.tsx`.
  - Active blood transfusion queue, unit verification modal, dual step-up co-signature dialog, bedside vitals recorder, reaction reporting dialog, and bag return workflow.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (9 tasks), `src/foundation-task-map.json` (9 controls), `src/foundation-help.ts` (62 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, clinical purpose, 8 operational steps, and 11 role FAQs for ER triage nurse.
  - Bundled screenshots: `public/handbook/transfusion_bedside_er-en.png` and `public/handbook/transfusion_bedside_er-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/transfusion-bedside-er.test.mjs` (6/6 passing).
  - Full test suite: `npm test` passed (460/460 passing across all suites).
  - Help check: `npm run check:help` passed (107 screens).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-BMBMpaQo.js`).
- **Commit & Proposal**:
  - Implementation commit: `2803cf0`.
  - Proposal ID: **261** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 109 (`clinical_privileges`) Checkpoint
- **Workflow & Standards**: Clinical privileges catalog & staff credentialing register under Punjab MSDS COP 32, 39, and 45. Regulates who may operate in theatre, administer anaesthesia, conduct pre-anaesthesia assessments, and authorize recovery discharges; Position 109 (55 points), Workspace `owner_dashboard`.
- **Contracts**:
  - `contracts/clinical_privileges.json`: Real MCP screen bundle covering 6 endpoints (`GET /ot/privileges`, `POST /ot/privileges`, `PATCH /ot/privileges/{privilege_id}`, `POST /ot/privileges/{privilege_id}/revoke`, `GET /hr/employees`, `GET /ot/theatre-policy/pdf`) and domain rules (`rule:fe3c4d2fab`, `rule:aedb3bf41a`, `rule:fa7737b903`, `rule:caf82033b4`).
  - `src/generated/clinical_privileges.ts`: Typed endpoint call functions and data models.
- **Domain Policies & Statutory Rules (`src/clinical-privileges-policy.ts`)**:
  - Service view capability evaluation (`rule:caf82033b4`): `surgery` service (`full`, `open_work` with banner, `records`, `setup`, `hidden`).
  - One live grant constraint (`rule:fe3c4d2fab`): duplicate grants rejected (`OT_PRIVILEGE_EXISTS`) with clear instructions to extend or revoke prior grant.
  - Revocation audit trail (`rule:aedb3bf41a`): permanent immutable revocation with mandatory reason; signatures requiring the privilege rejected from then on; visible via `include_revoked`.
  - Annual review & 30-day warning (`rule:fa7737b903`): automatically computes and flags grants expiring within 30 days in amber to prompt annual review and committee renewals before surgical signatures are blocked (`OT_PRIVILEGE_REQUIRED`).
  - Dual permission gating: `ot.privilege.manage` for write/update/revoke actions; `ot.status.view` for read-only register viewing.
- **UI Architecture (`src/screens/ClinicalPrivileges.tsx`)**:
  - Privileges register table with KPI metrics (Active, Expiring Soon, Expired, Revoked).
  - Search by clinician name, license number, or scope; filter by category; toggle revoked history.
  - Grant Privilege modal with real-time HR employee search (`GET /hr/employees`) and autocomplete.
  - Edit / Renew modal with `expected_version` concurrency protection.
  - Revoke modal with statutory impact warning and required reason.
  - Detail drawer and Theatre Policy PDF preview/download modal.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (6 tasks), `src/foundation-task-map.json` (6 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `clinical_privileges` to `deliveredHelpScreens` and all 35 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, clinical purpose, 11 operational steps, and 6 role FAQs.
  - Bundled screenshots: `public/handbook/clinical_privileges-en.png` and `public/handbook/clinical_privileges-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/clinical-privileges.test.mjs` (7/7 passing).
  - Full test suite: `npm test` passed (467/467 passing across all suites).
  - Help check: `npm run check:help` passed (108 screens, 2447 controls, 1532 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-BV6tcdKb.js`).
- **Commit & Proposal**:
  - Implementation commit: `5ddbd89`.
  - Proposal ID: **262** (status: `pending` on `/docs -> My progress`).

---

## Plan for Screen 110 (`theatre_checklist_setup`)
- **Workflow & Standards**: Surgical safety checklist setup & configuration (Sign In, Time Out, Sign Out items under WHO surgical safety checklist and MSDS COP standards); Position 110 (52 points), Workspace `owner_dashboard` / `theatre_admin`.
- **Bundle & Contracts**:
  - Fetch contract bundle via `get_screen_bundle("theatre_checklist_setup")`.
  - Fetch quality brief via `get_ui_quality_brief(screen_id="theatre_checklist_setup")`.
  - Generate TypeScript contracts (`src/generated/theatre_checklist_setup.ts`).
  - Save contract bundle to `contracts/theatre_checklist_setup.json`.
- **Domain Policies & Statutory Rules**:
  - WHO surgical safety checklist phases: Sign In (before anaesthesia), Time Out (before skin incision), Sign Out (before leaving operating room).
  - Custom checklist item configuration, mandatory vs optional flags, specialty overrides.
- **UI Architecture & Help**:
  - Create `src/screens/TheatreChecklistSetup.tsx`.
  - Wire into `src/App.tsx`, `src/foundation-catalogue.json`, `src/foundation-task-map.json`.
  - Contextual F1 help and handbook entry in `src/help.ts` with role FAQs.
  - Screenshots in `public/handbook/theatre_checklist_setup-en.png` and `theatre_checklist_setup-ur.png`.
  - Automated unit tests in `tests/theatre-checklist-setup.test.mjs`.
  - Verify via `check:help`, `tsc`, `npm test`, `npm run build`.
  - Commit Screen 110 and submit `propose_progress`.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237** through **262** are awaiting human review on `/docs -> My progress`.
