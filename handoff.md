# Haspataal checkpoint
Last updated: 01 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 5 Screen 105 `body_release_ward` (Bodies awaiting handover - Ward)
Building screens in Phase 5 Roadmap (Emergency, deaths and medico-legal cases) along with all tests, reporting backend issues if found:
- Screen 104: **`death_record`** ("Death record & certificate", Position 104, 90 points) — **COMPLETED** (commit `2d501bf`, Proposal **257** awaiting human review on `/docs -> My progress`).
- Screen 105: **`body_release_ward`** ("Bodies awaiting handover - Ward", Position 105, 54 points) — **IN PROGRESS**.

### Implementation Plan for Screen 105 (`body_release_ward`) & Screen 106 (`body_release_er`)
- **Workflow & Standards**: Deceased patient body handover to next of kin or police; Punjab MSDS indicators 106, 154; Position 105 (54 points), Workspace `ward` / `nurse`; Position 106 (54 points), Workspace `triage` / `er`.
- **Contracts**:
  - `contracts/body_release_ward.json` & `contracts/body_release_er.json`: Real MCP screen bundles covering 5 endpoints (`GET /deaths`, `GET /deaths/{death_id}`, `POST /deaths/{death_id}/body-release`, `GET /deaths/{death_id}/print-payload`, `GET /deaths/{death_id}/pdf`), realtime event `death.recorded`, and domain rules (`rule:cd68894ad3`, `rule:60aea191e4`, `rule:15e617c197`, `rule:20c304a0c8`).
  - `src/generated/body_release.ts`: Generated TypeScript contracts for the 5 endpoints.
- **Domain Policies (`src/body-release-policy.ts`)**:
  - Service view capability evaluation:
    - For `body_release_ward`: service `inpatient_wards` (`full`, `open_work` with banner 'No new body handovers from now on. Completing existing body releases and certificate printing continue.', `records`, `hidden`).
    - For `body_release_er`: service `emergency_department`.
  - Role permissions check: `death.body.release` authorized for `ward_nurse`, `head_nurse`, `triage_nurse`, `doctor`, `clinical_specialist`, `surgeon`, `anaesthetist`.
  - Certification lock verification (`rule:cd68894ad3`): body release is strictly refused (`DEATH_RECORD_NOT_CERTIFIED`) if `status === "Draft"`. Draft records are displayed in the queue with a disabled, greyed handover button and warning tooltip informing nursing staff that the doctor must certify first.
  - Recipient identity verification (`rule:60aea191e4`):
    - Non-MLC release (to next of kin): receiver name, relationship (e.g. Spouse, Son, Daughter, Father, Mother, Brother, Sister, Legal Guardian), CNIC or verified national ID number, contact telephone number, and signed acknowledgment.
    - MLC release (to police or forensic escort): prominent red MEDICO-LEGAL banner, police daily diary (roznamcha) or dispatch letter reference, police station name, and officer identity (name, rank, belt #).
  - Printable certificate with handover audit (`rule:15e617c197`): fetches print payload (`GET /deaths/{id}/print-payload`) and PDF url (`GET /deaths/{id}/pdf`) carrying receiver credentials, time of release, and nurse signature block.
  - Domain error explanations for `DEATH_RECORD_NOT_CERTIFIED`, `BODY_ALREADY_RELEASED`, `VALIDATION_ERROR`, `FORBIDDEN`.
- **UI Architecture (`src/screens/BodyRelease.tsx`)**:
  - Reusable clinical screen parameterized with `screenId: "body_release_ward" | "body_release_er"`, filterable pending body handover queue, status indicators (`Certified - Ready for Handover`, `Draft - Pending Doctor Certification`, `Released`), KPI cards, search by MRN/Name/Death #.
  - Modal dialog for Body Handover to Next of Kin or Police Escort.
  - A4 Handover & Certificate print preview modal.
  - Bounded 100–250% zoom, Light/DarkHighContrast themes, and bilingual English/Urdu interface.
- **Help, Handbook & Navigation**:
  - Wire into `src/App.tsx`, task catalogue, task map, `foundation-help.ts`, handbook in `src/help.ts`, and bundle screenshots.
- **Verification**:
  - Unit tests in `tests/body-release.test.mjs`.
  - `npm.cmd run check:help`, `npx.cmd tsc --noEmit`, `npm.cmd test`, `npm.cmd run build`.
- **Progress Submission**:
  - Commit implementation, submit `propose_progress` for `body_release_ward`, and update `handoff.md`.

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
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237**, **238**, **239**, **240**, **241**, **242**, **243**, **244**, **245**, **246**, **247**, **248**, **249**, **250**, **251**, **252**, **253**, **254**, **255**, **256**, and **257** are awaiting human review on `/docs -> My progress`.
