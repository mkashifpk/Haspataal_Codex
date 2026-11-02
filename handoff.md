# Haspataal checkpoint
Last updated: 02 November 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Phase 7 Screen 142 `risk_dashboard` (Risk & compliance dashboard)
Executing the Haspataal HMS Roadmap in dependency order along with all tests and MCP progress reporting:
- **Phase 6 ("Theatre and sterile supply")**: 100% COMPLETE (Screens 109–132, Proposals 262–285).
- **Phase 7 ("Finance, billing and back offices")**:
  - Screen 133: **`accountant_cockpit`** ("Accountant 3-pane cockpit", Position 133, 83 points, workspace `finance_accountant`) — **COMPLETED** (commit `3f85c2d`, Proposal **286** awaiting human review on `/docs -> My progress`).
  - Screen 134: **`billing_admin`** ("Price & policy management", Position 134, 70 points, workspace `billing_admin`) — **COMPLETED** (commit `d3c8ab8`, Proposal **287** awaiting human review on `/docs -> My progress`).
  - Screen 135: **`pharmacy_admin`** ("Pharmacy inventory, formulary & procurement", Position 135, 76 points, workspace `pharmacy_admin`) — **COMPLETED** (commit `1b7d0e5`, Proposal **288** awaiting human review on `/docs -> My progress`).
  - Screen 136: **`medication_safety_setup`** ("High-alert drugs & look-alike/sound-alike rules", Position 136, 54 points, workspace `pharmacy_admin`) — **COMPLETED** (commit `c7f683b`, Proposal **289** awaiting human review on `/docs -> My progress`).
  - Screen 137: **`drug_recalls`** ("Drug recall campaigns & quarantine management", Position 137, 63 points, workspace `pharmacy_admin`) — **COMPLETED** (commit `ba0b999`, Proposal **290** awaiting human review on `/docs -> My progress`).
  - Screen 138: **`pharmacy_storage_log`** ("Medicine storage log & temperature monitoring", Position 138, 51 points, workspace `pharmacy_admin`) — **COMPLETED** (commit `580e15a`, Proposal **291** awaiting human review on `/docs -> My progress`).
  - Screen 139: **`lab_admin`** ("Lab catalogue, panels, instruments & reagent inventory", Position 139, 76 points, workspace `lab_admin`) — **COMPLETED** (commit `7491e82`, Proposal **292** awaiting human review on `/docs -> My progress`).
  - Screen 140: **`diagnostic_partners`** ("Partner laboratories and imaging centres", Position 140, 44 points, workspace `lab_admin`) — **COMPLETED** (commit `95561ed`, Proposal **293** awaiting human review on `/docs -> My progress`).
  - Screen 141: **`owner_dashboard`** ("Hospital owner dashboard", Position 141, 41 points, workspace `owner_dashboard`) — **COMPLETED** (Proposal **294** awaiting human review on `/docs -> My progress`).
  - Screen 142: **`risk_dashboard`** ("Risk & compliance dashboard", Position 142, 48 points, workspace `owner_dashboard`) — **NEXT** (Final screen of Phase 7!).
    - Scope: Clinical risk assessment, statutory compliance indicators, sentinel events, risk heatmaps, incident mitigation, and executive compliance returns.
    - Next Concrete Actions:
      1. Inspect `get_screen_bundle("risk_dashboard")` and save to `contracts/risk_dashboard.json`.
      2. Generate TypeScript contracts via `generate_typescript`.
      3. Create domain policies in `src/risk-dashboard-policy.ts`.
      4. Implement UI `src/screens/RiskDashboard.tsx`.
      5. Wire into `src/App.tsx`, catalogue, task map, foundation help, authored handbook entry, and unit test suite.
      6. Run full verification suite (`npm run check:help`, `npm test`, `npx tsc --noEmit`, `npm run build`).
      7. Propose progress via `propose_progress`.

---

### Completed Screen 141 (`owner_dashboard`) Checkpoint
- **Workflow & Standards**: Executive governance, real-time financial oversight, and clinical operational conversion monitoring (`owner_dashboard`, Workspace `owner_dashboard`, Position 141, 41 points):
  - **Live Ledger P&L Flash (`GET /reports/pnl-flash`):**
    - High-level executive KPI tiles: Gross Income, Contra Income Deductions, Net Income, Operating Overheads, Daily Accrued Payroll Run-Rate (`payroll_run_rate`), and Net Profit / Loss with profit margin percentage calculation.
    - Cash flow monitoring: Cash Collected at billing counters, refunds/waivers paid back, and net cash flow.
    - Working capital exposure: Receivables outstanding (corporate & panel) and open vendor payables.
    - Income stream breakdown table (stream, account_code, amount, and percentage share).
    - Overheads and operating expenses breakdown table (category, account_code, amount, and share).
  - **Revenue Trend & Trajectory (`GET /reports/pnl-trend`):**
    - Multi-day trend trajectory with configurable horizons (7, 14, 30, 60, 90, up to 92 days max).
    - Day-by-day table and indicators comparing Net Income vs Operating Expenses, computing operational daily margin and surplus/deficit badges.
  - **Patient Volume & Conversion Funnel (`GET /reports/patient-volume`):**
    - Consultation funnel: Visited (settled tickets), Examined (seen by doctor), and Attrition (purchased ticket but left unexamined without care).
    - Conversion metrics: Examined Consultation Rate % and Patient Attrition Rate %.
    - Unpaid tickets tracking (`issued_unpaid`), expired unpaid tickets, refunded/void tickets, and Inpatient Admissions count (`admissions`).
    - Per-doctor performance table with real-time search by doctor name or specialty department.
  - **General Ledger Trial Balance (`GET /finance/gl/trial-balance`):**
    - Gated by `finance.gl.view` permission.
    - Mathematical verification tile confirming ledger debit-credit equilibrium (`Total Debits === Total Credits`, variance = 0).
    - Account type selector (All, Asset, Liability, Equity, Income, Expense, ContraIncome) and account search.
    - Complete chart of accounts line table displaying account code, name, category, debits, credits, and net ending balances.
  - **Statutory 60-Second Auto-Refresh (`rule:8e0811036c`):**
    - Automatically synchronizes ledger figures every 60 seconds while visible without page reload; includes visible countdown indicator and immediate manual "Refresh Now" action.
    - Subscribes to realtime event topics (`session.*`, `system.*`, `notification.created`).
  - **Service Capability Gating:**
    - Resolves `full`, `open_work` (warning banner "Restricted Mode: Hospital administrative services in restricted mode; reviewing live financial records without new operations"), `records`, `setup`, and `hidden` derived from server `GET /establishment views.screens`.
- **Contracts**: `contracts/owner_dashboard.json` (4 endpoints, 1 statutory rule `rule:8e0811036c`, 15 rubric items).
- **Domain Policies & Statutory Rules (`src/owner-dashboard-policy.ts`)**:
  - `getOwnerDashboardCapabilityView`, `calculateOpdConversionMetrics`, `calculateDoctorMetrics`, `summarizePnlFlash`, `summarizeTrialBalance`, `validateDateRange`, `validateTrendDays`.
  - Bilingual error dictionary (`OWNER_DASHBOARD_ERROR_MESSAGES`) covering `FORBIDDEN`, `VALIDATION_ERROR`, and `NETWORK_ERROR`.
- **UI Architecture (`src/screens/OwnerDashboard.tsx`)**:
  - Live 4-tab executive component wired into `src/App.tsx`, `src/foundation-catalogue.json` (4 tasks), `src/foundation-task-map.json` (4 controls), `src/foundation-help.ts` (16 interactive controls mapped), and `scripts/check-help.mjs`.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs explaining live ledger P&L flash, daily payroll run-rate, 60-second auto-refresh, OPD attrition, and trial balance verification. Bundled screenshots in `public/handbook/owner_dashboard-en.png` and `owner_dashboard-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/owner-dashboard.test.mjs` (8/8 passing).
  - Help check: `npm run check:help` passed (140 screens, 3,502 controls, 2,504 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing across 140 screens).
  - Full test suite: `npm test` passed (710/710 passing across all 19 test suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-DplitTGb.js`).
- **Proposal**:
  - Proposal ID: **294** (status: `pending` on `/docs -> My progress`, build `index-DplitTGb.js`, 14 rubric items claimed, `q:fresh_data` left pending human review).

### Completed Screen 140 (`diagnostic_partners`) Checkpoint
- **Workflow & Standards**: Statutory referral partner directory and contract governance workspace (`diagnostic_partners`, MSDS AAC 6, 14):
  - **Directory Worklist (`GET /diagnostic-partners`):**
    - External diagnostic referral partners list with filters for services (All, Lab, Imaging) and Active Only toggle.
    - Real-time search by partner facility title, PHC registration code, or MOU reference letter.
    - Worklist tracks services offered (Lab, Imaging, Both), accreditations (PHC, PNAC ISO 15189, PNRA), agreed turnaround hours, and active tests sent out.
  - **MOU Lifecycle & Expiration Monitoring (`rule:317f71af91`):**
    - Enforces `getMouExpiryStatus`: evaluates contractual timelines against `mou_valid_until`.
    - Proactive warning: highlights partners within 30 days of contract expiration with animated amber badges and warning text ("MOU Expiring Soon: X day(s) remaining. Renew agreement before expiration").
    - Strict dispatch halting: once expired (or `mou_expired: true`), highlights in bold red and backend stops dispatches (`DIAGNOSTIC_PARTNER_INVALID`), ensuring no unauthorised sample referrals.
  - **Partner Onboarding (`POST /diagnostic-partners`):**
    - Modal registering new partner with legal name, services, PHC registration, ISO accreditation, PNRA licence (for imaging), MOU reference, validity period, SLA turnaround hours, contact, and quality note.
    - Double-submit protection via idempotency key.
  - **Contract Renewal & Maintenance (`PATCH /diagnostic-partners/{partner_id}`):**
    - 'Edit / Renew MOU' modal allowing administrators to renew expiring contracts, update validity periods, and adjust agreed turnaround times.
    - Optimistic concurrency control via `expected_version` preventing concurrent overwrites (`VERSION_CONFLICT`).
  - **Lifecycle Retirement (`rule:91092686de`):**
    - Soft retirement deactivating partners (`is_active: false`) while permanently safeguarding all historical requisition audits, patient records, and financial statements.
  - **Service Capability Gating (`rule:5be909080d`):**
    - Resolves `full`, `open_work` (warning banner "No new laboratory or outsourced diagnostics work from now on"), `records`, `setup`, and `hidden` derived from server `GET /establishment views.screens`.
- **Contracts**: `contracts/diagnostic_partners.json` (3 endpoints, 3 statutory rules `rule:317f71af91`, `rule:91092686de`, `rule:5be909080d`, 17 rubric items).
- **Domain Policies & Statutory Rules (`src/diagnostic-partners-policy.ts`)**:
  - `getDiagnosticPartnersCapabilityView`, `getMouExpiryStatus`, `validatePartnerInput`, `validatePartnerUpdateInput`.
  - Bilingual error dictionary (`DIAGNOSTIC_PARTNERS_ERROR_MESSAGES`) covering `FORBIDDEN`, `VALIDATION_ERROR`, `VERSION_CONFLICT`, and `NOT_FOUND`.
- **UI Architecture (`src/screens/DiagnosticPartners.tsx`)**:
  - Live referral partner governance component wired into `src/App.tsx`, `src/foundation-catalogue.json` (3 tasks), `src/foundation-task-map.json` (3 controls), `src/foundation-help.ts` (21 interactive controls mapped), and `scripts/check-help.mjs`.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs answering seed questions, 30-day renewal warnings, and PNRA licensing. Bundled screenshots in `public/handbook/diagnostic_partners-en.png` and `diagnostic_partners-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/diagnostic-partners.test.mjs` (5/5 passing).
  - Help check: `npm run check:help` passed (139 screens, 3486 controls, 2488 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing across 139 screens).
  - Full test suite: `npm test` passed (702/702 passing across all 19 test suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-C9eRsK_W.js`).
- **Proposal**:
  - Proposal ID: **293** (status: `pending` on `/docs -> My progress`, build `index-C9eRsK_W.js`, 16 rubric items claimed, `q:fresh_data` left pending human review).

---

### Completed Screen 139 (`lab_admin`) Checkpoint
- **Workflow & Standards**: Comprehensive diagnostic laboratory master administration and inventory workspace (`lab_admin`, MSDS AAC 1-6):
  - **Test Catalogue Table (`GET /lab/tests`):**
    - Master diagnostic test catalog with real-time search filtering (`q` query parameter).
    - Displays test code, full descriptive name, laboratory section, specimen type, routine and urgent STAT turnaround minutes, availability (InHouse vs SendOut with partner name), 24/7 basic emergency indicator (MSDS AAC 1 v), priority notifiable disease alerts, active status badge, and patient pricing.
  - **Metric Schema Definition (`POST /lab/tests`, `PATCH /lab/tests/{test_id}`):**
    - Enforces statutory Rule `rule:26ecdbf976`: interactive editor defining quantitative numeric and qualitative text parameters, reporting units, physiological reference intervals (default, male, female), and clinical critical panic limits (low/high, or qualitative findings like Positive/Reactive) triggering immediate urgent alerts.
  - **Statutory Rules & Turnarounds (`rule:c8be844050`):**
    - Routine turnaround minutes and urgent/STAT turnaround minutes per MSDS AAC 4.
    - Test availability gating: InHouse (on-site execution) vs SendOut (external partner laboratory requiring active diagnostic partner from `GET /diagnostic-partners` with unexpired MOU).
    - Basic emergency diagnostic tagging: round-the-clock availability (`available_24h`) per MSDS AAC 1 v.
    - Statutory priority notifiable disease linkage reporting to health authority surveillance registers.
  - **Tariff Price Management (`PUT /lab/tests/{test_id}/price`):**
    - Laboratory price schedule updates tracking auditable administrative change justifications.
  - **Reagent Bill of Materials (`GET/PUT /lab/tests/{test_id}/bom`):**
    - Connects tests to registered chemical reagents with quantities per test run; automatically deducts inventory upon patient result submission and computes reagent Cost of Goods Sold (COGS).
  - **Reagents & Batch Inventory (`GET/POST /lab/reagents`, `POST /lab/reagent-batches`, `POST /lab/reagent-adjustments`):**
    - Reagents live inventory table tracking low stock thresholds, near-expiry alerts, and FEFO stock availability.
    - Receive batch modal with lot numbers, expiration dates, unit/total costs, and vendor invoice links.
    - Auditor stock adjustment / write-off modal enforcing reasons (Adjustment, Expiry, Damage) and mandatory audit notes.
  - **Financial Performance & Contractor Share (`GET /lab/dashboard`, `PUT /lab/contractor`, `GET /staff/lookup`):**
    - Date-filtered analytics displaying gross revenue, reagent COGS, net profit, test reruns, and hospital vs contractor splits.
    - Revenue by test category table.
    - Contractor revenue-sharing agreement panel with verified PMDC staff lookup (`GET /staff/lookup`).
  - **Realtime Integration:**
    - Subscribes to `lab.reagent.low_stock` event to auto-refresh tests, reagents, and financial dashboard without polling.
  - **Service Capability Gating (`rule:0f8b607b2c`):**
    - `getLabAdminCapabilityView` derives `full`, `open_work` (warning banner "No new laboratory or outsourced diagnostics work from now on"), `records`, `setup`, and `hidden` from server `GET /establishment views.screens`.
- **Contracts**: `contracts/lab_admin.json` (13 endpoints, 1 realtime event, 3 statutory rules `rule:26ecdbf976`, `rule:c8be844050`, `rule:0f8b607b2c`, 28 rubric items).
- **Domain Policies & Statutory Rules (`src/lab-admin-policy.ts`)**:
  - `getLabAdminCapabilityView`, `validateMetricDef`, `validateMetricSchema`, `createDefaultMetric`, `validateLabTestInput`, `validateLabTestUpdate`, `validateBomInput`, `validateReagentInput`, `validateReagentBatchInput`, `validateReagentAdjustInput`, `validateContractorInput`.
  - Bilingual error dictionary (`LAB_ADMIN_ERROR_MESSAGES`) covering `DIAGNOSTIC_PARTNER_INVALID`, `INSUFFICIENT_STOCK`, `NOT_FOUND`, `VERSION_CONFLICT`, `FORBIDDEN`, `REFERENCE_NOT_FOUND`, `UNAUTHENTICATED`, and `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/LabAdmin.tsx`)**:
  - Live 3-tab laboratory administration component wired into `src/App.tsx`, `src/foundation-catalogue.json` (13 tasks), `src/foundation-task-map.json` (13 controls), `src/foundation-help.ts` (77 interactive controls mapped), and `scripts/check-help.mjs`.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 10 operational steps, and 5 role FAQs answering seed errors `DIAGNOSTIC_PARTNER_INVALID` and `INSUFFICIENT_STOCK`. Bundled screenshots in `public/handbook/lab_admin-en.png` and `lab_admin-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/lab-admin.test.mjs` (7/7 passing).
  - Help check: `npm run check:help` passed (138 screens, 3464 controls, 2467 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing across 138 screens).
  - Full test suite: `npm test` passed (697/697 passing across all 19 test suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-BXP7FYVo.js`).
- **Proposal**:
  - Proposal ID: **292** (status: `pending` on `/docs -> My progress`, build `index-BXP7FYVo.js`, 27 rubric items claimed, `q:fresh_data` left pending human review).

---

### Completed Screen 138 (`pharmacy_storage_log`) Checkpoint
- **Workflow & Standards**: Comprehensive medicine storage temperature & humidity monitoring workspace (`pharmacy_storage_log`, MSDS MOM 58):
  - **Storage Checks Log Table (`GET /pharmacy/storage-checks`):**
    - Chronologically ordered storage check readings with date range filter (`date_from`, `date_to`), storage area filter, and out-of-range deviations toggle (`out_of_range_only`).
    - Rows display timestamp, storage area, kind (Room, Refrigerator, Freezer, ColdChainBox), ward or central pharmacy location, observed temperature, target limits, humidity %, within_range status badge, and recorded remedial action taken.
    - Out-of-range deviations are highlighted in bold red with animated pulse per Rule `rule:e66d8b92db`.
  - **Record Storage Reading Modal (`POST /pharmacy/storage-checks`):**
    - Enforces Rule `rule:09925ecb70`: requires consistent storage area spelling (supported by auto-suggest datalist), storage kind selection, optional ward ID (for ward drug cupboards / refrigerators), observed temperature in °C, and optional humidity percentage (0-100%).
    - Custom limits checkbox allows entering dedicated min and max temperatures for specialized vaccine transport carriers.
    - Live threshold evaluation: if temperature is outside safe storage boundaries (e.g. <2°C or >8°C in a refrigerator), the form highlights the red warning and strictly demands non-empty remedial action taken (`action_taken`) before submission under Rule `rule:e66d8b92db` (`STORAGE_CHECK_ACTION_REQUIRED`).
    - Submits with idempotency key; updates logs and summary immediately.
  - **Surveyor Compliance Summary Cards (`GET /pharmacy/storage-checks/summary`):**
    - Implements Rule `rule:ac70d74fb1`: computes total checks performed against the expected 2x daily routine (`checks_per_day = 2`).
    - Area cards display lowest and highest temperature extremes observed, total out-of-range deviations, and full routine compliance (`days_complete` / `days`). Days with 0 or 1 check are flagged as surveyor compliance audit gaps.
    - Displays standard system target thresholds in force (Room: 15-25°C, Refrigerator: 2-8°C, Freezer: -20 to -10°C).
  - **Surveyor Register PDF Export (`GET /pharmacy/storage-checks/register/pdf`):**
    - Enforces Rule `rule:1b0e847e97`: generates official printable storage register PDF covering the audit date range with timestamps, nurse/pharmacist signatures, out-of-range flags, and remedial actions.
    - Multi-role access: ward nurses and head nurses can record storage checks for their ward refrigerators and emergency cupboards using their ward ID.
  - **Realtime Notifications:**
    - Subscribes to `pharmacy.storage.out_of_range` event to notify pharmacists immediately and auto-refresh without polling.
- **Contracts**: `contracts/pharmacy_storage_log.json` (4 endpoints, 1 realtime event, 4 statutory rules `rule:09925ecb70`, `rule:e66d8b92db`, `rule:ac70d74fb1`, `rule:1b0e847e97`, 20 rubric items).
- **Domain Policies & Statutory Rules (`src/pharmacy-storage-log-policy.ts`)**:
  - Runtime service capability gating via `getPharmacyStorageLogCapabilityView` (`full`, `open_work`, `records`, `setup`, `hidden`) derived from `GET /establishment views.screens`.
  - Storage limit resolution and out-of-range math: `resolveStorageLimits`, `isTemperatureOutOfRange`.
  - Strict input validation: `validateStorageCheckInput` checking non-empty area name, valid kind, numeric temperature, humidity bounds, custom limit pairing, and mandatory remedial action taken for out-of-range temperatures (`STORAGE_CHECK_ACTION_REQUIRED`).
  - Bilingual error dictionary (`STORAGE_LOG_ERROR_MESSAGES`) covering `STORAGE_CHECK_ACTION_REQUIRED`, `FORBIDDEN`, `REFERENCE_NOT_FOUND`, and `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/PharmacyStorageLog.tsx`)**:
  - Live 2-tab storage log component wired into `src/App.tsx`, `src/foundation-catalogue.json` (4 tasks), `src/foundation-task-map.json` (4 controls), `src/foundation-help.ts` (23 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 9 operational steps, and 5 role FAQs answering seed error `STORAGE_CHECK_ACTION_REQUIRED`. Bundled screenshots in `public/handbook/pharmacy_storage_log-en.png` and `pharmacy_storage_log-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/pharmacy-storage-log.test.mjs` (6/6 passing).
  - Help check: `npm run check:help` passed (137 screens, 3380 controls, 2390 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing across 137 screens).
  - Full test suite: `npm test` passed (690/690 passing across all 19 test suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-uTXGzHfR.js`).
- **Proposal**:
  - Proposal ID: **291** (status: `pending` on `/docs -> My progress`, build `index-uTXGzHfR.js`, 19 rubric items claimed, `q:fresh_data` left pending human review).

---

### Completed Screen 137 (`drug_recalls`) Checkpoint
- **Workflow & Standards**: Comprehensive regulatory drug recall campaign and batch quarantine workspace (`drug_recalls`, MSDS MOM 59):
  - **Recalls Register Worklist:**
    - Live register table via `GET /drug-recalls` (`listRecalls`) with status filter (`All`, `Open`, `Closed`, `Cancelled`).
    - Recalls display recall number, medicine name & code, statutory class badges (`ClassI` critical red, `ClassII` warning amber, `ClassIII` info blue), alert source & reference letters, status, quarantined stock left in pharmacy & wards, and uncontacted patients.
  - **Open Recall Campaign Modal (`POST /drug-recalls`):**
    - Enforces statutory Rule `rule:fe2af7a43c`: takes drug ID and checks live active batches in FEFO order via `GET /drugs/{drug_id}/stock-status` (`stockStatus`).
    - Batch selection allows either "Recall all batches" (`all_batches: true`) or specific batch multiselection (`batch_ids: number[]`).
    - Requires valid alert source (`DRAP`, `Manufacturer`, `Supplier`, `Internal`), official letter reference, statutory classification (`ClassI`, `ClassII`, `ClassIII`), non-empty defect explanation, and `contact_patients` boolean.
    - Submits with idempotency key; immediately alerts wards holding stock and blocks dispensing across all counters.
  - **Recall Campaign Details & Holding Wards (`GET /drug-recalls/{recall_id}`):**
    - Comprehensive breakdown under Rule `rule:6e16f97bd1`:
      - Recalled Batches audit: received qty, left in pharmacy, left on wards, dispensed, administered, and theatre consumable usage.
      - Wards Holding Recalled Stock table: displays specific ward names and quantities sitting in ward drug cabinets for immediate quarantine and recovery.
  - **Stock Removal & Disposal Action (`POST /drug-recalls/{recall_id}/remove-stock`):**
    - Enforces Rule `rule:6e16f97bd1`: writes off every remaining unit across pharmacy and hospital wards, recording mandatory disposal / return note (e.g. incinerated per biohazard protocol or returned to vendor under credit note).
  - **Patient Contact Auditing (`PATCH /drug-recalls/{recall_id}/patients/{recall_patient_id}`):**
    - Patient outreach roster with MRN, contact telephone, dispensation source encounter (Dispensed, Administered, Theatre), and contact outcome status (`ToContact`, `Contacted`, `Unreachable`, `NotNeeded`).
    - Enforces Rule `rule:6e16f97bd1`: opens modal to record clinical counsel notes given to patient or explanation of unreachable contact.
  - **Campaign Closure & Mistake Cancellation:**
    - Close recall via `POST /drug-recalls/{recall_id}/close` enforcing Rule `rule:2b020bd53b`: allowed only when `can_close` is true (all stock removed and contacts resolved). Attempts to close prematurely return `RECALL_NOT_COMPLETE`.
    - Cancel recall via `POST /drug-recalls/{recall_id}/cancel` enforcing Rule `rule:2b020bd53b`: cancels recall opened by mistake and immediately releases quarantined batches hospital-wide.
  - **Realtime Updates:**
    - Subscribes to `pharmacy.recall.updated` event to auto-refresh the register list and active detail view without polling.
- **Contracts**: `contracts/drug_recalls.json` (8 endpoints, 1 realtime event, 4 statutory rules `rule:fe2af7a43c`, `rule:6e16f97bd1`, `rule:2b020bd53b`, `rule:0bdb1f574d`, 24 rubric items).
- **Domain Policies & Statutory Rules (`src/drug-recalls-policy.ts`)**:
  - Runtime service capability gating via `getDrugRecallsCapabilityView` (`full`, `open_work`, `records`, `setup`, `hidden`) derived from `GET /establishment views.screens`.
  - Input validation: `validateOpenRecallInput` (Rule `rule:fe2af7a43c`), `validateRemoveStockInput` (Rule `rule:6e16f97bd1`), `validateRecordContactInput` (Rule `rule:6e16f97bd1`), `validateCloseRecallInput` (Rule `rule:2b020bd53b`), `validateCancelRecallInput` (Rule `rule:2b020bd53b`).
  - Bilingual error dictionary (`DRUG_RECALL_ERROR_MESSAGES`) covering `BATCH_RECALLED`, `FORBIDDEN`, `NOT_FOUND`, `RECALL_NOT_COMPLETE`, `RECALL_STATE_INVALID`, `REFERENCE_NOT_FOUND`, `STOCK_BATCH_MISMATCH`, and `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/DrugRecalls.tsx`)**:
  - Live 2-tab batch recall governance component wired into `src/App.tsx`, `src/foundation-catalogue.json` (8 tasks), `src/foundation-task-map.json` (8 controls), `src/foundation-help.ts` (40 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 9 operational steps, and 5 role FAQs answering all 5 seed errors (`BATCH_RECALLED`, `STOCK_BATCH_MISMATCH`, `RECALL_STATE_INVALID`, recall state machine, `RECALL_NOT_COMPLETE`). Bundled screenshots in `public/handbook/drug_recalls-en.png` and `drug_recalls-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/drug-recalls.test.mjs` (7/7 passing).
  - Help check: `npm run check:help` passed (136 screens, 3357 controls, 2367 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing across 136 screens).
  - Full test suite: `npm test` passed (684/684 passing across all 19 test suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-CJgDavry.js`).
- **Proposal**:
  - Proposal ID: **290** (status: `pending` on `/docs -> My progress`, build `index-CJgDavry.js`, 23 rubric items claimed, `q:fresh_data` left pending human review).

---

### Completed Screen 136 (`medication_safety_setup`) Checkpoint
- **Workflow & Standards**: Comprehensive medication safety governance workspace (`medication_safety_setup`):
  - **Tab 1: High-Alert & Restricted Registry:**
    - High-Alert medication categories worklist via `GET /medication-safety/high-alert-list` (`highAlertList`) grouped by clinical class (`ConcentratedElectrolyte`, `Chemotherapy`, `Anticoagulant`, `Insulin`, `Opioid`, `Sedative`, `NeuromuscularBlocker`, `Inotrope`, `Thrombolytic`, `Psychotropic`, `HighCost`, `Other`) with drug count badges and individual edit modal actions.
    - Restricted Prescribing section (MSDS 52) displaying agents that require the clinician `RestrictedPrescribing` clinical privilege.
    - Printable PDF generation via `GET /medication-safety/high-alert-list/pdf` (`highAlertPdf`) enforcing statutory Rule `rule:6da5fd1c68` (replacing physical station printouts across all nursing stations, OT suites, and pharmacy counters whenever classifications are updated).
    - Hospital Medication Safety Policy document download via `GET /medication-safety/policy/pdf` (`policyPdfMedicationSafety`).
  - **Tab 2: Look-Alike / Sound-Alike (LASA) Pairs:**
    - LASA pairs registry table with distinction and differentiation notes.
    - Add Look-Alike Pair modal via `POST /medication-safety/lasa-pairs` (`addPair`) enforcing statutory Rule `rule:a8dc0017ab` with mandatory staff distinction guidance and duplicate pair prevention (`LASA_PAIR_EXISTS`).
    - Edit LASA Pair modal & quick-retire action via `PATCH /medication-safety/lasa-pairs/{pair_id}` (`updatePair`) supporting pair retirement (`is_active: false`) when packaging or names no longer conflict.
  - **Tab 3: Formulary Safety Search & Flagging:**
    - Live formulary drug search via `GET /drugs/search` (`searchDrugs`) displaying live stock status color codes, schedule, current high-alert category, and existing look-alike relationships.
    - Configure Safety Flags modal via `PATCH /medication-safety/drugs/{drug_id}` (`setDrugFlags`) under Rule `rule:a8dc0017ab`: allows selecting a high-alert category or clearing it with `null`, strictly forbidding high-alert designation on OTC medicines, and toggling restricted prescribing status.
- **Contracts**: `contracts/medication_safety_setup.json` (7 endpoints, 2 statutory rules `rule:a8dc0017ab`, `rule:6da5fd1c68`, 20 rubric items).
- **Domain Policies & Statutory Rules (`src/medication-safety-setup-policy.ts`)**:
  - Runtime service capability gating via `getMedicationSafetySetupCapabilityView` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Strict input validation under Rule `rule:a8dc0017ab`: `validateDrugSafetyPatch` (OTC guard and clearing high-alert with null).
  - LASA pair input validation (`validateLasaPairInput`) checking distinct IDs, non-empty distinction notes, and duplicate active pair prevention.
  - LASA pair update validation (`validateLasaPairUpdate`) handling retirement.
  - Comprehensive bilingual error dictionary (`MEDICATION_SAFETY_ERROR_MESSAGES`) covering `FORBIDDEN`, `VALIDATION_ERROR`, `LASA_PAIR_EXISTS`, `NOT_FOUND`, and `VERSION_CONFLICT`.
- **UI Architecture (`src/screens/MedicationSafetySetup.tsx`)**:
  - Live 3-tab medication safety governance component wired into `src/App.tsx`, `src/foundation-catalogue.json` (7 tasks), `src/foundation-task-map.json` (7 controls), `src/foundation-help.ts` (33 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs for `pharmacy_admin`. Bundled screenshots in `public/handbook/medication_safety_setup-en.png` and `medication_safety_setup-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/medication-safety-setup.test.mjs` (12/12 passing).
  - Help check: `npm run check:help` passed (135 screens, 3317 controls, 2327 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing across 135 screens).
  - Full test suite: `npm test` passed (677/677 passing across all 19 test suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-2j2cVa5a.js`).
- **Proposal**:
  - Proposal ID: **289** (status: `pending` on `/docs -> My progress`, build `index-2j2cVa5a.js`, 19 rubric items claimed, `q:fresh_data` left pending human review).

---

### Completed Screen 135 (`pharmacy_admin`) Checkpoint
- **Workflow & Standards**: Comprehensive pharmacy back-office workspace (`pharmacy_admin`):
  - **Tab 1: Dashboards (Low Stock, Near Expiry, Live Profit):**
    - Low-stock replenishment alert table via `GET /pharmacy-admin/low-stock` (`lowStock`) with stock status (`Critical`, `Low`) and quick-intake action.
    - Near-expiry alert widget via `GET /pharmacy-admin/near-expiry` (`nearExpiry`) displaying days left, money at risk in PKR, and quick-return to supplier action.
    - Live profit dashboard via `GET /pharmacy-admin/profit-dashboard` (`profit`) displaying total gross revenue, COGS, and net profit with date range filter, revenue by payment channel (Cash, Card, PanelCredit, IPDBill, etc.), and Top 10 profitable medicines.
    - Subscribes to realtime WebSocket event `pharmacy.low_stock` via `window.terminal.subscribe` to auto-refresh stock and expiry reads without polling.
  - **Tab 2: Formulary & Drugs:**
    - Formulary drugs catalog with schedule and high-alert filters.
    - Add Formulary Drug modal via `POST /pharmacy-admin/drugs` (`addDrug`) enforcing statutory Rule `rule:609bbe13b3`: A new drug may be high-alert or restricted from the start; strictly never both high-alert and OTC.
  - **Tab 3: Batch Intake & Stock Adjustments:**
    - Batch Intake modal via `POST /pharmacy-admin/batches` (`addBatch`) enforcing statutory Rule `rule:b828c195cc`: takes boxes × units per box and total invoice cost; live derived units and unit cost previewed in the UI, with backend ledger deriving and locking unit cost.
    - Stock Adjustment / Write-off modal via `POST /pharmacy-admin/batches/{batch_id}/adjust` (`adjust`) with mandatory justification note and valid reason (`Adjustment`, `Expiry`, `Damage`).
  - **Tab 4: Supplier Invoices & Accounts Payable:**
    - Supplier invoices monitoring table via `GET /pharmacy-admin/vendor-invoices` (`listVendorInvoices`) with module (`Pharmacy`, `Lab`, `Ops`, `OT`, `Other`) and status (`Pending`, `PartiallyPaid`, `Paid`, `Cancelled`) filters.
    - Record Supplier Invoice modal via `POST /pharmacy-admin/vendor-invoices` (`addVendorInvoice`) linked to suppliers via `GET /finance/vendors` (`vendors`), generating matched Accounts Payable in the finance module.
  - **Tab 5: Supplier Returns Ledger & Credit Notes:**
    - Returns ledger via `GET /pharmacy-admin/supplier-returns` (`listReturnsPharmacyAdminSupplier`) with status filter (`Returned`, `Credited`, `Refused`).
    - Return to Supplier modal via `POST /pharmacy-admin/batches/{batch_id}/supplier-returns` (`recordReturn`) enforcing statutory Rule `rule:f65fc1a5a8` and cross-field validation: `recall_id` is required when reason is `Recall`, and forbidden otherwise.
    - Single return detail modal via `GET /pharmacy-admin/supplier-returns/{return_id}` (`getReturn`) showing status transition lifecycle: `Returned` (awaiting credit note), `Credited` (confirmed: credit pays supplier bills), or `Refused` (written off).
    - Return note printable PDF generation via `GET /pharmacy-admin/supplier-returns/{return_id}/pdf` (`returnNote`).
- **Contracts**: `contracts/pharmacy_admin.json` (13 endpoints, 1 realtime event, 3 statutory rules `rule:b828c195cc`, `rule:f65fc1a5a8`, `rule:609bbe13b3`, 28 rubric items).
- **Domain Policies & Statutory Rules (`src/pharmacy-admin-policy.ts`)**:
  - Runtime service capability gating via `getPharmacyAdminCapabilityView` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Formulary input validation with Rule `rule:609bbe13b3` checks (`validateDrugInput`).
  - Batch intake validation and derived unit cost math under Rule `rule:b828c195cc` (`validateBatchInput`).
  - Stock adjustment validation (`validateAdjustInput`).
  - Vendor invoice validation (`validateVendorInvoiceInput`).
  - Supplier return validation with Rule `rule:f65fc1a5a8` recall ID cross-field enforcement (`validateSupplierReturnInput`).
  - Comprehensive bilingual error dictionary (`PHARMACY_ADMIN_ERROR_MESSAGES`) covering `FORBIDDEN`, `INSUFFICIENT_STOCK`, `NOT_FOUND`, `VALIDATION_ERROR`, and `DUPLICATE_RECORD`.
- **UI Architecture (`src/screens/PharmacyAdmin.tsx`)**:
  - Live 5-tab pharmacy back-office component wired into `src/App.tsx`, `src/foundation-catalogue.json` (13 tasks), `src/foundation-task-map.json` (13 controls), `src/foundation-help.ts` (80 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs for `pharmacy_admin`. Bundled screenshots in `public/handbook/pharmacy_admin-en.png` and `pharmacy_admin-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/pharmacy-admin.test.mjs` (16/16 passing).
  - Help check: `npm run check:help` passed (134 screens, 3284 controls, 2294 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing across 134 screens).
  - Full test suite: `npm test` passed (665/665 passing across all 14 test suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-Diix-wW-.js`).
- **Proposal**:
  - Proposal ID: **288** (status: `pending` on `/docs -> My progress`, build `index-Diix-wW-.js`, 27 rubric items claimed, `q:fresh_data` left pending human review).

---

### Completed Screen 134 (`billing_admin`) Checkpoint
- **Workflow & Standards**: Comprehensive price and policy management workspace (`billing_admin`):
  - **Tab 1: Service Catalogue & Prices:**
    - Live service listing with category filter (`OPD`, `IPD`, `OT`, `Imaging`, `RoomCharge`, `Procedure`, `Other`) and text search via `GET /finance/service-catalog` (`listServices`).
    - Add priced service modal via `POST /finance/service-catalog` (`createService`) with code, category, name, and default price in PKR.
    - Edit service price and active status modal via `PATCH /finance/service-catalog/{service_id}` (`patchService`) enforcing statutory Rule `rule:55973e6dbd`: Price changes update the catalogue for future visits; previously issued tickets permanently preserve their snapshotted prices.
  - **Tab 2: Panels & Welfare Discounts:**
    - Panel registry view via `GET /finance/panels` (`listPanels`) detailing panel code, type (`SehatSahulat`, `Zakat`, `GovernmentEmployee`, `Corporate`, `Other`), baseline discount percentage, and credit/receivables permissions (`is_credit_panel`).
    - Register new panel modal via `POST /finance/panels` (`createPanel`).
    - Configure effective-dated discount rule modal via `POST /finance/panel-discounts` (`createPanelDiscount`) supporting specific service or hospital-wide discount percentage, start/end dates, and preventing temporal overlap (`TEMPORAL_OVERLAP`).
  - **Tab 3: Discount Ceilings:**
    - Concession ceiling policies view via `GET /finance/discount-policies` (`getDiscountPolicies`).
    - Set ceiling modal via `PUT /finance/discount-policies` (`setDiscountPolicy`) assigning role-based (`doctor`, `cashier`, `billing_admin`) or user-specific discretionary discount caps and maximum rupee limits.
  - **Tab 4: Consultant Commission Contracts:**
    - Consultant commission contracts worklist via `GET /finance/consultant-contracts` (`listContracts`) filterable by staff employee ID.
    - Add consultant contract modal via `POST /finance/consultant-contracts` (`createContract`) with live staff search via `GET /staff/lookup` (`lookupStaff`).
    - Supports all three commission structures: `FixedFee` (fixed PKR amount per procedure), `PercentGross` (percentage of gross procedure fee), and `PercentNet` (percentage of profit after consumables deduction).
- **Contracts**: `contracts/billing_admin.json` (11 endpoints, 1 statutory rule `rule:55973e6dbd`, 23 rubric items).
- **Domain Policies & Statutory Rules (`src/billing-admin-policy.ts`)**:
  - Runtime service capability gating via `getBillingAdminCapabilityView` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Strict input validation under Rule `rule:55973e6dbd` (`validateServiceInput`, `validateServicePatch`).
  - Panel input validation (`validatePanelInput`) and temporal range validation (`validatePanelDiscountInput`).
  - Discount ceiling validation (`validateDiscountPolicyInput`).
  - Consultant contract validation (`validateContractInput`).
  - Comprehensive bilingual error dictionary (`BILLING_ADMIN_ERROR_MESSAGES`) covering `NOT_FOUND`, `REFERENCE_NOT_FOUND`, `TEMPORAL_OVERLAP`, `UNAUTHENTICATED`, `VALIDATION_ERROR`, and `VERSION_CONFLICT`.
- **UI Architecture (`src/screens/BillingAdmin.tsx`)**:
  - Live 4-tab price and policy management component wired into `src/App.tsx`, `src/foundation-catalogue.json` (11 tasks), `src/foundation-task-map.json` (11 controls), `src/foundation-help.ts` (65 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs for `billing_admin`. Bundled screenshots in `public/handbook/billing_admin-en.png` and `billing_admin-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/billing-admin.test.mjs` (13/13 passing).
  - Help check: `npm run check:help` passed (133 screens, 3203 controls, 2214 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing across 133 screens).
  - Full test suite: `npm test` passed (649/649 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-wHu2EI5q.js`).
- **Proposal**:
  - Proposal ID: **287** (status: `pending` on `/docs -> My progress`, build `index-wHu2EI5q.js`, 22 rubric items claimed, `q:fresh_data` left pending human review).

---

### Completed Screen 133 (`accountant_cockpit`) Checkpoint
- **Workflow & Standards**: 3-pane financial management cockpit for cash drops, approvals, accounts payable, and general ledger reconciliation in `finance_accountant` workspace:
  - **Pane 1: General Ledger & Chart of Accounts / Vendors:**
    - Chart of accounts listing via `GET /finance/gl/accounts`.
    - General ledger query with account code, date from, and date to filters via `GET /finance/gl/ledger`.
    - Add Vendor modal via `POST /finance/vendors` with fields for vendor name, type (`PharmacySupplier`, `ReagentSupplier`, `EquipmentSupplier`, `UtilityProvider`, `Contractor`, `Other`), contact name, phone, address, tax number / NTN, and CNIC.
  - **Pane 2: Cash Shifts & Cash Drops:**
    - Cash shifts monitoring table via `GET /finance/cash-shifts` with status filters (`All`, `PendingCollection`, `Open`, `Verified`).
    - Shift breakdown modal via `GET /finance/cash-shifts/{shift_id}` displaying opening float, expected cash, declared cash, declared variance, collections by transaction type (`ShiftTotalOut`), and non-cash totals.
    - Cash drop verification modal via `POST /finance/cash-shifts/{shift_id}/cash-drop` under `rule:7cc7842e8a` (counting whole drawer including opening float to transfer all cash to the main vault).
    - Variance audit tracking under `rule:1109b23ad9`: live calculation of `counted_cash - expected_cash` and automatic audit item alert on non-zero variance.
    - Dual control authorization under `rule:8c0db74e85`: prompts for `second_approver_username` and `second_approver_password` before initial submission when drop amount reaches or exceeds `large_cash_settlement_threshold` (`GET /meta/settings`, default 100,000 PKR).
  - **Pane 3: Accounts Payable & Supplier Returns:**
    - Accounts Payable queue via `GET /finance/ap/queue` filterable by status (`Approved`, `PartiallySettled`, `PendingApproval`, `Settled`).
    - AP Bill Settlement modal via `POST /finance/ap/{ap_id}/settle` with support for partial/full payment, payment methods (`Cash`, `BankTransfer`, `Cheque`, `SupplierCredit`), cash source (`Vault` vs `Shift`), reference numbers, and dual control co-signature when payable total >= threshold (`rule:8c0db74e85`).
    - Pharmacy supplier returns ledger via `GET /pharmacy-admin/supplier-returns` with status filter (`Returned`, `Credited`, `Refused`).
    - Supplier return note detail and PDF download via `GET /pharmacy-admin/supplier-returns/{return_id}` and `GET /pharmacy-admin/supplier-returns/{return_id}/pdf`.
    - Confirm Supplier Credit Note modal via `POST /finance/supplier-returns/{return_id}/credit` validating credit note number, issue date, and credit amount under `rule:465292d1b4`.
    - Record Supplier Refusal modal via `POST /finance/supplier-returns/{return_id}/refuse` capturing justification notes to write off uncredited return claims under `rule:465292d1b4`.
    - Dual control protection: enforced via `DUAL_CONTROL_SAME_PERSON` so the staff member who returned goods cannot confirm or refuse credit.
    - Supplier credit payables settlement: validated under `rule:465292d1b4` so confirmed returns with available `credit_left` can pay bills for that specific supplier (`SUPPLIER_CREDIT_UNAVAILABLE`).
  - **Approvals Quick Widget:**
    - Filterable approval requests view via `GET /approvals` with type-specific details and elevated indicators.
  - **Realtime Synchronization:**
    - WebSocket subscriptions via `window.terminal.subscribe` for `approval.requested` and `ot.settlement.finalized` triggering automatic background data refresh without polling.
  - **Service Capability Gating:**
    - Governed by server `GET /establishment` views for `screen_id: "accountant_cockpit"` (`full`, `open_work`, `records`, `setup`, `hidden`).
- **Contracts**: `contracts/accountant_cockpit.json` (14 endpoints, 2 realtime events, 4 statutory rules, 31 rubric items).
- **Domain Policies & Statutory Rules (`src/accountant-cockpit-policy.ts`)**:
  - Runtime service capability views under `getAccountantCockpitCapabilityView`.
  - Permissions and roles verified for `accountant`.
  - Dual control evaluation (`rule:8c0db74e85`), drawer counting validation (`rule:7cc7842e8a`), variance auditing (`rule:1109b23ad9`), and supplier credit rules (`rule:465292d1b4`).
  - Complete bilingual statutory error explanations (`ACCOUNTANT_ERROR_MESSAGES`).
- **UI Architecture (`src/screens/AccountantCockpit.tsx`)**:
  - Live 3-pane cockpit component wired into `src/App.tsx`, `src/foundation-catalogue.json` (14 tasks), `src/foundation-task-map.json` (14 controls), `src/foundation-help.ts` (59 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 10 operational steps, and 5 role FAQs for `accountant`. Bundled screenshots in `public/handbook/accountant_cockpit-en.png` and `accountant_cockpit-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/accountant-cockpit.test.mjs` (8/8 passing).
  - Help check: `npm run check:help` passed (132 screens, 3138 controls, 2149 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing).
  - Full test suite: `npm test` passed (636/636 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-BVj7otSf.js`).
- **Proposal**:
  - Proposal ID: **286** (status: `pending` on `/docs -> My progress`, build `index-BVj7otSf.js`, 30 rubric items claimed, `q:fresh_data` left pending human review).

---

### Completed Screen 132 (`ot_settlement`) Checkpoint
- **Workflow & Standards**: Post-operative financial bill settlement, reconciliation, and consultant fee split in `ot_admin` workspace (MSDS COP 31, 33, hospital financial regulations):
  - Theatre room personnel logging (Primary Surgeon, Assistant Surgeon, Anesthetist, Scrub Nurse, Circulating Nurse, Other) via live staff lookup (`GET /staff/lookup`).
  - Mandatory settlement split preview (`rule:5228072102`): Computes gross procedure revenue, intra-operative consumables revenue, gross total, consumable deductions, net procedure profit, and consultant commissions before finalization (`POST /ot/bookings/{id}/settlement-preview`).
  - Commission cap exceeded audit gate (`rule:015f73a404`): When commissions exceed net profit, strictly requires documented hospital policy override justification (`OT_COMMISSION_CAP_EXCEEDED`).
  - Atomic finalization & trigger split (`POST /ot/bookings/{id}/finalize`): Locks financial split and generates audit invoice with Idempotency-Key header protection.
  - Consultant contracts inspector (`GET /finance/consultant-contracts`): Inspects agreed commission rules and terms.
  - Printable settlement summary voucher.
  - Real-time synchronization on `ot.settlement.finalized` WebSocket events.
  - Runtime service capability gating (`rule:7c9fedfb50`): Governed by `GET /establishment` views for `ot_settlement`.
- **Contracts**: `contracts/ot_settlement.json` (4 endpoints, 1 realtime event, 3 statutory rules, 19 rubric items).
- **Domain Policies & Statutory Rules (`src/ot-settlement-policy.ts`)**:
  - Runtime service capability views under `rule:7c9fedfb50` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Permissions and roles verified for `ot_admin`.
  - Preview gate (`rule:5228072102`) and cap override validation (`rule:015f73a404`).
- **UI Architecture (`src/screens/OtSettlement.tsx`)**:
  - Live post-op settlement component wired into `src/App.tsx`, `src/foundation-catalogue.json` (4 tasks), `src/foundation-task-map.json` (4 controls), `src/foundation-help.ts` (all 25 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs for `ot_admin`. Bundled screenshots in `public/handbook/ot_settlement-en.png` and `ot_settlement-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/ot-settlement.test.mjs` (7/7 passing).
  - Help check: `npm run check:help` passed (131 screens, 3072 controls, 2089 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing).
  - Full test suite: `npm test` passed (628/628 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-CgZsWaBJ.js`).
- **Commit & Proposal**:
  - Implementation commit: `90fda83`.
  - Proposal ID: **285** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 131 (`transfusion_bedside_ot`) Checkpoint
- **Workflow & Standards**: Bedside blood transfusion administration and monitoring in `ot_nurse` workspace (MSDS COP 38, 41, PBTA standards):
  - Bedside safety verification protocol (`rule:0a07d57ff8`): Wristband barcode scanning via `GET /wristbands/verify`, 5 mandatory bedside checkboxes, and dual independent sign-off (`STEP_UP_REQUIRED`, `DUAL_CONTROL_SAME_PERSON`).
  - Cold chain countdown (`rule:8e16f20b4a`): 30-minute start timer; units not started within 30 minutes are refused with `BLOOD_UNIT_OUT_TOO_LONG` and routed to Safe Return ledger as 'Not Given' (`OutOfStorageTooLong`).
  - Vital signs flowsheet and 4-hour administration limit (`rule:efcdf1e299`): Baseline and ongoing vitals recorded via `POST /blood/transfusions/{id}/observations`, amber late indicator if administration exceeds 4 hours.
  - Transfusion acute reaction reporting (`rule:a2f80c80d7`): Submits adverse event via `POST /blood/transfusions/{id}/reaction` and automatically creates Section 13 incident report.
  - Consent withdrawal protection (`rule:e1211e09ae`): Real-time lock and immediate cessation upon `blood.consent.withdrawn`.
  - Service capability gating (`rule:4d48db6f97`, `rule:877e58cf09`): Governed by server `GET /establishment` views for `transfusion_bedside_ot`.
- **Contracts**: `contracts/transfusion_bedside_ot.json` (saved with `max_chars: 200000`, 9 endpoints, 2 events, 7 statutory rules, 28 rubric items).
- **UI Architecture (`src/screens/TransfusionBedsideOT.tsx`)**:
  - Reused bedside transfusion component configured for `screenId="transfusion_bedside_ot"`.
  - Registered in `src/App.tsx`, `src/foundation-catalogue.json` (9 tasks), `src/foundation-task-map.json` (9 controls), `src/foundation-help.ts` (all 62 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, operational steps, and 5 role FAQs for `ot_nurse`. Bundled screenshots in `public/handbook/transfusion_bedside_ot-en.png` and `transfusion_bedside_ot-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/transfusion-bedside-ot.test.mjs` (6/6 passing).
  - Help check: `npm run check:help` passed (130 screens, 3047 controls, 2064 groups, 69 FAQ seeds, 30 workspace guides).
  - Full test suite: `npm test` passed (621/621 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-CUPONwKj.js`).
- **Commit & Proposal**:
  - Implementation commit: `0876f7c`.
  - Proposal ID: **284** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 130 (`recovery_board_anaesthesia`) Checkpoint
- **Workflow & Standards**: Live PACU recovery board in `anaesthesia` workspace (MSDS COP 38, 39, 41, 46):
  - PACU Clinical Recovery Worklist & Queue (`rule:f995066a59`, MSDS COP 38): Patient cards sorted longest-in-recovery first (`minutes_in_recovery` descending) for close anaesthetic emergence monitoring.
  - Status & Warning Badges: Alerts anaesthetists with prominent badges (`NoObservation` and `ObservationOverdue` in bold red, `LongStay` in amber, `OperativeNoteUnsigned` and `AnaesthesiaRecordOpen`).
  - PACU Discharge Prerequisite Alert Banner: Identifies holds (unsigned operative note or open anaesthesia record) preventing patient transfer to inpatient wards.
  - Physiological Observation Flowsheet Modal (`rule:08ba1ce134`, MSDS COP 38): Multi-system vital signs charting (pulse, BP systolic/diastolic, respiratory rate, SpO2, airway patency, AVPU consciousness, pain score 0–10 NRS, temperature, nausea/PONV) via `POST /ot/bookings/{id}/recovery/observations`.
  - Modified Aldrete Discharge Scoring & Transfer Out Modal (`rule:99dea44a26`, MSDS COP 39, 41): Destination selector (Ward, ICU, HDU, Home, ReturnedToTheatre, Died), 5 Modified Aldrete signs scored 0–2 against `targets.min_score` (target ≥9), and clinical override rationale field for premature transfers (`OT_RECOVERY_CRITERIA_NOT_MET`).
  - Local Anaesthesia Direct Intake (`rule:1653612103`): Opens PACU recovery stay via `POST /ot/bookings/{id}/recovery`.
  - Post-Finality Corrections & Incident Reporting: Retrospective audit correction addenda via `POST /ot/bookings/{id}/corrections` (`rule:9e9cb593cb`) and adverse event reporting directly to hospital QA via `POST /incidents` (`rule:fe0c435dc9`).
  - Realtime Synchronization: Subscribes to `ot.clinical.updated` WebSocket events to refresh the live board automatically.
  - Runtime service capability gating from `GET /establishment` views for `screen_id: "recovery_board_anaesthesia"` under Rule b919e98af8; Position 130 (65 points), Workspace `anaesthesia`.
- **Contracts**: `contracts/recovery_board_anaesthesia.json` (saved with `max_chars: 200000`, 8 endpoints, 1 realtime event, 5 statutory rules, 25 rubric items).
- **Domain Policies & Statutory Rules (`src/recovery-board-policy.ts`)**:
  - Gated under `rule:b919e98af8` for `recovery_board_anaesthesia`.
  - Permissions and roles verified for `anaesthetist`.
- **UI Architecture (`src/screens/RecoveryBoard.tsx`)**:
  - Reused `RecoveryBoard` component with `screenId="recovery_board_anaesthesia"`.
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (8 tasks), `src/foundation-task-map.json` (8 controls), and `src/foundation-help.ts` (all 43 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs for `anaesthetist`. Bundled screenshots in `public/handbook/recovery_board_anaesthesia-en.png` and `recovery_board_anaesthesia-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/recovery-board-anaesthesia.test.mjs` (7/7 passing).
  - Help check: `npm run check:help` passed (129 screens, 3047 controls, 2064 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing).
  - Full test suite: `npm test` passed (615/615 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-DEyuFJZh.js`).
- **Commit & Proposal**:
  - Implementation commit: `6c9c9da`.
  - Proposal ID: **283** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 129 (`recovery_board_admin`) Checkpoint
- **Workflow & Standards**: Live PACU recovery board in `ot_admin` workspace (MSDS COP 38, 39, 41, 46):
  - PACU Capacity & Occupancy Oversight Queue (`rule:f995066a59`, MSDS COP 38): Patient cards sorted longest-in-recovery first (`minutes_in_recovery` descending) for timely OT bed turnaround.
  - Status & Warning Badges: Prominent badges (`NoObservation` and `ObservationOverdue` in bold red, `LongStay` in amber, `OperativeNoteUnsigned` and `AnaesthesiaRecordOpen`).
  - PACU Discharge Prerequisite Alert Banner: Identifies holds (unsigned operative note or open anaesthesia record) preventing patient transfer to inpatient wards.
  - Physiological Observation Flowsheet Modal (`rule:08ba1ce134`, MSDS COP 38): Multi-system vital signs charting (pulse, BP systolic/diastolic, respiratory rate, SpO2, airway patency, AVPU consciousness, pain score 0–10 NRS, temperature, nausea/PONV) via `POST /ot/bookings/{id}/recovery/observations`.
  - Modified Aldrete Discharge Scoring & Transfer Out Modal (`rule:99dea44a26`, MSDS COP 39, 41): Destination selector (Ward, ICU, HDU, Home, ReturnedToTheatre, Died), 5 Modified Aldrete signs scored 0–2 against `targets.min_score` (target ≥9), and clinical override rationale field for premature transfers (`OT_RECOVERY_CRITERIA_NOT_MET`).
  - Local Anaesthesia Direct Intake (`rule:1653612103`): Opens PACU recovery stay via `POST /ot/bookings/{id}/recovery`.
  - Post-Finality Corrections & Incident Reporting: Retrospective audit correction addenda via `POST /ot/bookings/{id}/corrections` (`rule:9e9cb593cb`) and adverse event reporting directly to hospital QA via `POST /incidents` (`rule:fe0c435dc9`).
  - Realtime Synchronization: Subscribes to `ot.clinical.updated` WebSocket events to refresh the live board automatically.
  - Runtime service capability gating from `GET /establishment` views for `screen_id: "recovery_board_admin"` under Rule 8cb63655de; Position 129 (65 points), Workspace `ot_admin`.
- **Contracts**: `contracts/recovery_board_admin.json` (saved with `max_chars: 200000`, 8 endpoints, 1 realtime event, 5 statutory rules, 25 rubric items).
- **Domain Policies & Statutory Rules (`src/recovery-board-policy.ts`)**:
  - Gated under `rule:8cb63655de` for `recovery_board_admin`.
  - Permissions and roles verified for `ot_admin`.
- **UI Architecture (`src/screens/RecoveryBoard.tsx`)**:
  - Reused `RecoveryBoard` component with `screenId="recovery_board_admin"`.
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (8 tasks), `src/foundation-task-map.json` (8 controls), and `src/foundation-help.ts` (all 43 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs for `ot_admin`. Bundled screenshots in `public/handbook/recovery_board_admin-en.png` and `recovery_board_admin-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/recovery-board-admin.test.mjs` (7/7 passing).
  - Help check: `npm run check:help` passed (128 screens, 3047 controls, 2064 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing).
  - Full test suite: `npm test` passed (608/608 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-DaTXcj64.js`).
- **Commit & Proposal**:
  - Implementation commit: `7cf0069`.
  - Proposal ID: **282** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 128 (`recovery_board`) Checkpoint
- **Workflow & Standards**: Live PACU recovery board in `ot_nurse` workspace (MSDS COP 38, 39, 41, 46):
  - Longest-in-recovery patient cards queue (`rule:f995066a59`): cards sorted by `minutes_in_recovery` descending, last observation vitals, and alert badges (`NoObservation` / `ObservationOverdue` in red, `LongStay` in amber, `OperativeNoteUnsigned` and `AnaesthesiaRecordOpen`).
  - Observation flowsheet form (`rule:08ba1ce134`, MSDS 38): pulse (HR), BP (systolic/diastolic), respiration, SpO2, airway patency (Patent, Supported, Obstructed), AVPU consciousness, pain score (0-10), temperature, and PONV nausea.
  - Discharge form & Modified Aldrete Scoring (`rule:99dea44a26`): destination (Ward, ICU, HDU, Home, ReturnedToTheatre, Died), 5 Aldrete domains scored 0-2 (Activity, Respiration, Circulation, Consciousness, SpO2) evaluated against `targets.min_score` (target ≥9), pain threshold, mandatory clinical override rationale for premature transfers (`OT_RECOVERY_CRITERIA_NOT_MET`), and shifting handover note (MSDS 39).
  - Recovery clinical privileges check (`rule:1653612103`, `OT_PRIVILEGE_REQUIRED`).
  - Opening recovery stay for local anaesthesia arrivals (`POST /ot/bookings/{id}/recovery`, `rule:1653612103`).
  - Read-only finality and retrospective correction addenda (`POST /ot/bookings/{id}/corrections`, `rule:9e9cb593cb`).
  - In-theatre adverse incident reporting (`POST /incidents`, `rule:fe0c435dc9`).
  - Runtime service capability gating from `GET /establishment` views for `screen_id: "recovery_board"` under Rule ba79b41973; Position 128 (65 points), Workspace `ot_nurse`.
- **Contracts**:
  - `contracts/recovery_board.json`: Saved real MCP screen bundle (8 endpoints, 1 realtime event, 5 statutory rules, 25 rubric items).
  - `src/generated/recovery_board.ts`: Generated TypeScript contracts for all 8 operations and models.
- **Domain Policies & Statutory Rules (`src/recovery-board-policy.ts`)**:
  - Runtime service capability gating (`rule:ba79b41973`), role permissions, `validateObservationInput`, `calculateAldreteScore`, `validateDischargeInput`, `validateCorrectionInput`, `validateIncidentInput`, and bilingual error explanations (`explainRecoveryBoardError`).
- **UI Architecture (`src/screens/RecoveryBoard.tsx`)**:
  - PACU occupancy queue, patient cards, vitals banner, PACU discharge prerequisite card, chronological observation flowsheet, observation modal, Aldrete discharge modal, open recovery stay modal, correction modal, and incident modal; all 43 interactive controls tagged with `data-help="recovery_board.*"`.
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (8 tasks), `src/foundation-task-map.json` (8 controls), and `src/foundation-help.ts` (all 43 controls mapped).
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 5 role FAQs for `ot_nurse`. Bundled screenshots in `public/handbook/recovery_board-en.png` and `recovery_board-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/recovery-board.test.mjs` (7/7 passing).
  - Full test suite: `npm test` passed (601/601 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-by1e-xJK.js`).
- **Commit & Proposal**:
  - Implementation commit: `4e8f4db`.
  - Proposal ID: **281** (status: `pending` on `/docs -> My progress`).

---

### Plan for Screen 130 (`recovery_board_anaesthesia`)
- **Workflow & Standards**: Live PACU recovery board in `anaesthesia` workspace (MSDS COP 38, 39, 41, 46):
  - PACU recovery oversight, observation vitals review, discharge readiness evaluation, and anaesthetic sign-off.
  - Gated under Rule `73cebcfe21` (or corresponding rule for `recovery_board_anaesthesia`).
  - Position 130 (65 points), Workspace `anaesthesia`.
  - Reuses component `src/screens/RecoveryBoard.tsx` with `screenId="recovery_board_anaesthesia"`.
- **Next Concrete Step**: Fetch screen bundle `get_screen_bundle("recovery_board_anaesthesia", max_chars=200000)` and save to `contracts/recovery_board_anaesthesia.json`.

---

### Completed Screen 127 (`surgical_record_surgeon`) Checkpoint
- **Workflow & Standards**: Intra-operative surgical clinical record, surgeon's pre-operative clinical evaluation, informed operation consent, and operative note in `doctor` / `surgeon` workspace (MSDS COP 32, 33, 35, 38):
  - Pre-operative clinical evaluation (`rule:8bbdbdc51d`, MSDS COP 32): history & physical exam, provisional diagnosis, ICD-10 term search (`GET /icd/codes`), laterality marking (Left, Right, Bilateral, NotApplicable), and planned procedure. Read-only lock enforced upon WHO Checklist Sign In pause.
  - Operation informed consent gate (`rule:451c4b4945`, MSDS COP 33): form `OPERATION` (`POST /consents` / `PATCH /consents/{id}`), procedure name, performing surgeon, risks, benefits, alternatives, language, read aloud verification; physical/thumbprint/digital signing modal (`POST /consents/{id}/sign`) with surrogate decision maker relation (`GET /consent-decision-makers`), signer CNIC, and clinical witness; refusal modal (`POST /consents/{id}/refuse`). Must be Given prior to Sign In and incision (`CONSENT_REQUIRED`).
  - Comprehensive operative note & post-operative plan (`rule:2b25651d1e`, MSDS COP 35): procedure performed, post-op diagnosis, surgical findings, detailed technique narrative, incision type/location, closure, CDC wound classification, estimated blood loss (EBL), fluid balance, blood transfusion, implants left in situ toggle, surgical drains toggle, specimens to histopathology toggle, and condition at conclusion.
  - Mandatory post-operative care orders with one-click 'Not needed' toggles: monitoring orders, statutory ward monitoring interval (15, 30, 60, 120 min), analgesia/antibiotics, wound care, drains/catheters, nutrition, and specialty referrals.
  - Primary surgeon final signing gate (`POST /ot/bookings/{id}/operative-note/sign`): strictly required before patient can be discharged from PACU recovery (`OT_OPERATIVE_NOTE_REQUIRED`). Automatically establishes the inpatient ward's vitals monitoring interval (`monitoring_interval_minutes`).
  - Parts stepper strip (`rule:3e99378238`): visual status strip (Missing grey, Draft amber, Final green) and `next_step` call to action.
  - Draft missing indicators (`rule:552e1a1764`): highlights required fields for signing.
  - Official A4 printable surgical record (`rule:40d4b7c1c0`): print payload text and PDF download (`GET /ot/bookings/{id}/surgical-record/print-payload`, `GET /ot/bookings/{id}/surgical-record/pdf`).
  - Read-only finality & retrospective corrections (`rule:9e9cb593cb`): post-finality correction addenda (`POST /ot/bookings/{id}/corrections`).
  - In-theatre adverse incident reporting (`rule:fe0c435dc9`): reports incidents to hospital QA (`POST /incidents`).
  - Active clinical privileges check (`rule:db3a19e806`): validates surgeon privileges (`OT_PRIVILEGE_REQUIRED`).
  - Runtime service capability gating from `GET /establishment` views for `screen_id: "surgical_record_surgeon"` under Rule 7bb3ca4e1d; Position 127 (123 points), Workspace `doctor` / `surgeon`.
- **Contracts**:
  - `contracts/surgical_record_surgeon.json`: Saved real MCP screen bundle (24 endpoints, 2 realtime events, 9 statutory rules, 46 rubric items).
  - `src/generated/surgical_record_surgeon.ts`: Generated TypeScript contracts for all 24 operations and models.
- **Domain Policies & Statutory Rules (`src/surgical-record-surgeon-policy.ts`)**:
  - Runtime service capability gating (`rule:7bb3ca4e1d`): evaluates `GET /establishment` views for `surgical_record_surgeon` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Role permissions: `canViewSurgicalRecord`, `canRecordPreOpNote`, `canRecordOperativeNote`, `canManageConsents`, `canCorrectSurgicalRecord`, `canReportIncident`.
  - Input validations: `validatePreOpNote`, `validateOperativeNoteDraft`, `validateOperativeNoteSigning`, `validateCorrectionInput`, `validateIncidentInput`.
  - Bilingual error explanations (`explainSurgicalRecordSurgeonError`): handles `OT_BOOKING_STATE_INVALID`, `OT_CHECKLIST_INCOMPLETE`, `CONSENT_REQUIRED`, `OT_OPERATIVE_NOTE_REQUIRED`, `OT_PRIVILEGE_REQUIRED`, `OT_RECORD_FINAL`, `OT_RECORD_INCOMPLETE`, `OT_RECORD_NOT_SIGNED`, `INCIDENT_DETAILS_REQUIRED`, `INCIDENT_TYPE_INACTIVE`, etc.
- **UI Architecture (`src/screens/SurgicalRecordSurgeon.tsx`)**:
  - Surgical case queue (`GET /ot/clinical-worklist`) with search and full surgical record detail loading (`getSurgicalRecord`).
  - Patient Context & Identity Banner with PACU Discharge Prerequisite alert indicator.
  - Parts Stepper Strip with progress indicators and Next Step action.
  - Tab 1: Pre-Op Note with ICD-10 term search and laterality options.
  - Tab 2: Operation Consent with printable A4 preview, physical/thumbprint signing modal, and refusal modal.
  - Tab 3: Operative Note & Post-Op Orders with one-click "Not needed" toggles and Sign Operative Note action.
  - Tab 4: Record Overview with A4 printable payload preview, PDF download, and audit log.
  - Post-Finality Correction Addendum Modal (`POST /ot/bookings/{id}/corrections`).
  - In-Theatre Adverse Incident Modal (`POST /incidents`).
  - Realtime WebSocket synchronization on `ot.clinical.updated` and `ot.booking.updated`.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (24 tasks), `src/foundation-task-map.json` (24 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `surgical_record_surgeon` to `deliveredHelpScreens` and all 74 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 10 operational steps, and 6 role FAQs for `surgeon`.
  - Bundled screenshots: `public/handbook/surgical_record_surgeon-en.png` and `surgical_record_surgeon-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/surgical-record-surgeon.test.mjs` (7/7 passing).
  - Help check: `npm run check:help` passed (126 screens, 3000 controls, 2021 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing).
  - Full test suite: `npm test` passed (594/594 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-CnLDgiNy.js`).
- **Commit & Proposal**:
  - Implementation commit: `6178963`.
  - Proposal ID: **280** (status: `pending` on `/docs -> My progress`).

---

### Plan for Screen 128 (`recovery_board`)
- **Workflow & Standards**: Live PACU recovery board in `ot_nurse` workspace (MSDS COP 39, 41, 42):
  - Post-anaesthesia recovery room occupancy, bay status, and patient arrival tracking.
  - Modified Aldrete scoring and physiological vitals flowsheet during recovery.
  - Inpatient ward bed assignment and readiness check.
  - Pre-requisites for PACU discharge: signed anaesthesia record (`rule:2fc0c843dc`) and signed operative note with post-op orders (`rule:2b25651d1e`, `OT_OPERATIVE_NOTE_REQUIRED`).
  - PACU discharge / transfer out execution (`POST /ot/bookings/{id}/recovery/discharge`).
  - Position 128 (65 points), Workspace `ot_nurse`.
- **Next Concrete Step**: Fetch screen bundle `get_screen_bundle("recovery_board")` and save to `contracts/recovery_board.json`.

---

### Completed Screen 126 (`anaesthesia_record`) Checkpoint
- **Workflow & Standards**: Intra-operative anaesthesia record, physiological flowsheet, and drug administration in `anaesthesia` workspace (MSDS COP 34, 36, 37, 40):
  - Pre-induction baseline evaluation (`rule:eda7089766`): baseline HR, BP, SpO2, findings since PAC, mandatory plan change clinical rationale.
  - Induction and Incision timestamping: requires WHO Surgical Safety Checklist Sign In and Time Out pauses (`OT_CHECKLIST_INCOMPLETE`).
  - Monitoring flowsheet grid (`rule:c7bd8c2650`, MSDS 36): periodic vitals charting (HR, rhythm, BP, RR, SpO2, EtCO2, Temp, airway patency) with real-time chart gaps detection (`chart_gaps`).
  - Intra-operative events flowsheet (`POST /ot/bookings/{id}/anaesthesia-record/events`): Drugs, Fluids, Blood products, Events.
  - Post-procedure summary and PACU recovery handover notes (`rule:2fc0c843dc`).
  - Final signing gate (`POST /ot/bookings/{id}/anaesthesia-record/sign`, `rule:2fc0c843dc`).
  - Read-only finality and retrospective correction addenda (`POST /ot/bookings/{id}/corrections`, `rule:9e9cb593cb`).
  - In-theatre adverse incident and complication reporting (`POST /incidents`, `rule:fe0c435dc9`).
  - Active clinical privileges verification (`rule:db3a19e806`).
  - Runtime service capability gating from `GET /establishment` views for `screen_id: "anaesthesia_record"` under Rule 2285735141; Position 126 (69 points), Workspace `anaesthesia`.
- **Contracts**:
  - `contracts/anaesthesia_record.json`: Saved real MCP screen bundle (8 endpoints, 1 realtime event, 7 statutory rules, 26 rubric items).
  - `src/generated/anaesthesia_record.ts`: Generated TypeScript contracts for all 8 operations and data models.
- **Domain Policies & Statutory Rules (`src/anaesthesia-record-policy.ts`)**:
  - Runtime service capability gating (`rule:2285735141`): evaluates `GET /establishment` views for `anaesthesia_record` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Role permissions: `canViewAnaesthesiaRecord`, `canRecordAnaesthesia` (`ot.anaesthesia.record`), `canCorrectAnaesthesia`, `canReportIncident`.
  - Input validations: `validatePreInduction`, `validateVitalsEntry`, `validateEventEntry`, `validateRecordSigning`, `validateCorrectionInput`, `validateIncidentInput`.
  - Bilingual error explanations (`explainAnaesthesiaRecordError`): handles `OT_BOOKING_STATE_INVALID`, `OT_CHECKLIST_INCOMPLETE`, `OT_PRIVILEGE_REQUIRED`, `OT_RECORD_FINAL`, `OT_RECORD_INCOMPLETE`, `OT_RECORD_NOT_SIGNED`, `INCIDENT_DETAILS_REQUIRED`, `INCIDENT_TYPE_INACTIVE`, etc.
- **UI Architecture (`src/screens/AnaesthesiaRecord.tsx`)**:
  - Surgical case queue (`clinicalWorklist`) with case search and full surgical record detail loading (`getSurgicalRecord`).
  - Full Patient & Operative Identity Context Card.
  - Pre-Induction Evaluation Panel with baseline physiological bounds and technique/airway device selector.
  - Operative Key Times Actions: Induction, Incision, Surgery End, Anaesthesia End.
  - Periodic Vitals Monitoring Flowsheet with chart gaps alert banner and chronological observations table.
  - Intra-operative Medications, Fluids, Blood, and Events Flowsheet.
  - Post-Procedure Summary & Recovery Handover Panel with Final Sign action.
  - Post-Finality Correction Addendum Modal (`POST /ot/bookings/{id}/corrections`).
  - In-Theatre Adverse Incident Modal (`POST /incidents`).
  - Realtime WebSocket synchronization on `ot.clinical.updated`.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (8 tasks), `src/foundation-task-map.json` (8 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `anaesthesia_record` to `deliveredHelpScreens` and all 50 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 10 operational steps, and 6 role FAQs for `anaesthetist`.
  - Bundled screenshots: `public/handbook/anaesthesia_record-en.png` and `anaesthesia_record-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/anaesthesia-record.test.mjs` (8/8 passing).
  - Help check: `npm run check:help` passed (125 screens, 2918 controls, 1947 groups, 69 FAQ seeds, 30 workspace guides).
  - Help coverage test: `tests/help-coverage.test.mjs` (28/28 passing).
  - Full test suite: `npm test` passed (587/587 passing across all suites).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-B7kgYAFU.js`).
- **Commit & Proposal**:
  - Implementation commit: `7184c76`.
  - Proposal ID: **279** (status: `pending` on `/docs -> My progress`).

---

### Plan for Screen 127 (`surgical_record_surgeon`)
- **Workflow & Standards**: Complete intra-operative surgical record, surgeon's operative note, findings, technique, closure, implant verification, specimen handling, and post-op orders in `doctor` / `surgeon` workspace:
  - Surgical case worklist and operative record detail (`GET /ot/bookings/{booking_id}/surgical-record`).
  - Operative note authoring (`PUT /ot/bookings/{booking_id}/operative-note`).
  - Surgical findings, procedure performed, laterality, incision details, operative technique, blood loss, specimen sent to pathology, swab/instrument count reconciliation, and post-op care orders.
  - Final operative note signing (`POST /ot/bookings/{booking_id}/operative-note/sign`) by primary surgeon holding active surgical clinical privileges (`OT_PRIVILEGE_REQUIRED`).
  - Read-only finality and retrospective corrections (`POST /ot/bookings/{booking_id}/corrections`).
  - Position 127 (123 points), Workspace `doctor` / `surgeon`.
- **Next Concrete Step**: Fetch screen bundle `get_screen_bundle("surgical_record_surgeon")` and save to `contracts/surgical_record_surgeon.json`.

---

### Completed Screen 125 (`sterile_packs_ward`) Checkpoint
- **Workflow & Standards**: Sterile packs barcode scanning when opened for inpatient procedures on the ward (MSDS IPC 92): Point-of-use scan (`POST /cssd/packs/use` with `admission_id`), pack detail lookups (`GET /cssd/packs/{pack_code}`), pack list filtering (`GET /cssd/packs`), expired/recalled pack rejection (`CSSD_PACK_UNUSABLE`, Rule 5eabbbecca), realtime recall alert integration on `cssd.cycle.updated` (Rule 4357be8acb: fetch affected packs with `GET /cssd/packs?status=Recalled&ward_id=...`), and runtime service capability gating from `GET /establishment` views for `screen_id: "sterile_packs_ward"` under Rule b531dda372; Position 125 (48 points), Workspace `ward_nurse`.
- **Contracts**:
  - `contracts/sterile_packs_ward.json`: Saved real MCP screen bundle (3 endpoints, 1 realtime event, 4 statutory rules, 18 rubric items).
- **Domain Policies & Statutory Rules (`src/sterile-packs-policy.ts`)**:
  - Runtime service capability gating (`rule:b531dda372`): evaluates `GET /establishment` views for `sterile_packs_ward` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Role permissions: `canUsePack` permits `ward_nurse`, `head_nurse`, `triage_nurse`, `ot_nurse`, `ot_admin`, and `cssd.pack.use`.
  - Pack usability validation (`isPackUsable`, `rule:5eabbbecca`): enforces that expired, failed, or recalled packs can never be opened (`CSSD_PACK_UNUSABLE`).
  - Point-of-use linkage validation (`validatePackUseInput`, `rule:d8f4d7af47`): requires pack code and at least one of `booking_id` or `admission_id`.
  - Expiry warning check (`isPackExpiringSoon`): displays red warning styling when approaching expiration.
  - Critical recall event detection (`isCssdRecallEvent`, `rule:4357be8acb`): catches `Recalled` cycle updates.
  - Bilingual error explanations (`explainSterilePackError`): covers `CSSD_PACK_UNUSABLE`, `REFERENCE_NOT_FOUND`, and `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/SterilePacksWard.tsx`)**:
  - Inpatient admissions queue (`listAdmissions`) with ward/patient search filter and admission selection.
  - Inpatient Context & Identity Banner: Preserves patient name, MRN, admission number, ward, bed number, and admission status.
  - Point-of-Use Pack Scanner (`POST /cssd/packs/use`): Inspects pack sterilization cycle and expiry, displays clear usability status, and blocks unusable packs.
  - Critical Recall Alert Banner: Displays high-priority warning on cycle recall with one-click filter to isolate affected packs.
  - Sterile Packs Stock & Usage Ledger: Filterable by status (Available, Issued, Used, Recalled, Expired, Failed) and search.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (3 tasks), `src/foundation-task-map.json` (3 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `sterile_packs_ward` to `deliveredHelpScreens` and all 11 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 9 operational steps, and 6 role FAQs for `ward_nurse`.
  - Bundled screenshots: `public/handbook/sterile_packs_ward-en.png` and `sterile_packs_ward-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/sterile-packs-ward.test.mjs` (6/6 passing).
  - Full test suite: `npm test` passed (579/579 passing across all suites).
  - Help check: `npm run check:help` passed (124 screens, 2868 controls, 1897 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-DldrbmRG.js`).
- **Commit & Proposal**:
  - Implementation commit: `994aeb4`.
  - Proposal ID: **278** (status: `pending` on `/docs -> My progress`).
- **Workflow & Standards**: Sterile packs barcode scanning and theatre administrative audit in `ot_admin` (MSDS IPC 92): Point-of-use scan (`POST /cssd/packs/use` with `booking_id`), pack detail lookups (`GET /cssd/packs/{pack_code}`), pack list filtering (`GET /cssd/packs`), expired/recalled pack rejection (`CSSD_PACK_UNUSABLE`, Rule 5eabbbecca), realtime recall alert integration on `cssd.cycle.updated` (Rule 4357be8acb: fetch affected packs with `GET /cssd/packs?status=Recalled`), and runtime service capability gating from `GET /establishment` views for `screen_id: "sterile_packs_ot_admin"` under Rule d897ee980e; Position 124 (48 points), Workspace `ot_admin`.
- **Contracts**:
  - `contracts/sterile_packs_ot_admin.json`: Saved real MCP screen bundle (3 endpoints, 1 realtime event, 4 statutory rules, 18 rubric items).
  - Reused `src/generated/sterile_packs_ot.ts` (3 endpoints) and `src/sterile-packs-policy.ts`.
- **Domain Policies & Statutory Rules (`src/sterile-packs-policy.ts`)**:
  - Runtime service capability gating (`rule:d897ee980e`): evaluates `GET /establishment` views for `sterile_packs_ot_admin` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Role permissions: `canUsePack` permits `ot_admin` and `cssd.pack.use`, `canViewPacks` permits `ot_admin` and `cssd.view` / `cssd.manage`.
  - Pack usability validation (`isPackUsable`, `rule:5eabbbecca`): enforces that expired, failed, or recalled packs can never be opened (`CSSD_PACK_UNUSABLE`).
  - Point-of-use linkage validation (`validatePackUseInput`, `rule:d8f4d7af47`): requires pack code and at least one of `booking_id` or `admission_id`.
  - Expiry warning check (`isPackExpiringSoon`): displays red warning styling when approaching expiration.
  - Critical recall event detection (`isCssdRecallEvent`, `rule:4357be8acb`): catches `Recalled` cycle updates.
  - Bilingual error explanations (`explainSterilePackError`): covers `CSSD_PACK_UNUSABLE`, `REFERENCE_NOT_FOUND`, and `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/SterilePacksOT.tsx`)**:
  - Parameterized `screenId="sterile_packs_ot_admin"` to cleanly evaluate `ot_admin` workspace capability views.
  - Surgical case queue (`listBookings`) with search filter and patient context card.
  - Patient Context & Identity Banner: Preserves name, MRN, theatre room, primary surgeon, and current operative lifecycle state.
  - Point-of-Use Pack Scanner (`POST /cssd/packs/use`): Inspects pack sterilization cycle and expiry, displays clear usability status, and blocks unusable packs.
  - Critical Recall Alert Banner: Displays high-priority warning on cycle recall with one-click filter to isolate affected packs.
  - Sterile Packs Stock & Usage Ledger: Filterable by status (Available, Issued, Used, Recalled, Expired, Failed) and search.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (3 tasks), `src/foundation-task-map.json` (3 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `sterile_packs_ot_admin` to `deliveredHelpScreens` and all 11 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 9 operational steps, and 6 role FAQs for `ot_admin`.
  - Bundled screenshots: `public/handbook/sterile_packs_ot_admin-en.png` and `sterile_packs_ot_admin-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/sterile-packs-ot-admin.test.mjs` (6/6 passing).
  - Full test suite: `npm test` passed (573/573 passing across all suites).
  - Help check: `npm run check:help` passed (123 screens, 2855 controls, 1886 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-Ro0eD5pM.js`).
- **Commit & Proposal**:
  - Implementation commit: `d076dbf`.
  - Proposal ID: **277** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 123 (`sterile_packs_ot`) Checkpoint
- **Workflow & Standards**: Sterile packs barcode scanning when opened in the operating theatre (MSDS IPC 92): Point-of-use scan (`POST /cssd/packs/use` with `booking_id`), pack detail lookups (`GET /cssd/packs/{pack_code}`), pack list filtering (`GET /cssd/packs`), expired/recalled pack rejection (`CSSD_PACK_UNUSABLE`, Rule 5eabbbecca), realtime recall alert integration on `cssd.cycle.updated` (Rule 4357be8acb: fetch affected packs with `GET /cssd/packs?status=Recalled`), and runtime service capability gating from `GET /establishment` views for `screen_id: "sterile_packs_ot"` under Rule 26e45f89a1; Position 123 (48 points), Workspace `ot_nurse`.
- **Contracts**:
  - `contracts/sterile_packs_ot.json`: Saved real MCP screen bundle (3 endpoints, 1 realtime event, 4 statutory rules, 18 rubric items).
  - `src/generated/sterile_packs_ot.ts`: Generated TypeScript contracts for all 3 operations and data models.
- **Domain Policies & Statutory Rules (`src/sterile-packs-policy.ts`)**:
  - Runtime service capability gating (`rule:26e45f89a1`): evaluates `GET /establishment` views for `sterile_packs_ot` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Role permissions: `canUsePack` (`cssd.pack.use`, nursing roles), `canViewPacks` (`cssd.view`, `cssd.operate`, `cssd.manage`, `cssd.pack.use`).
  - Pack usability validation (`isPackUsable`, `rule:5eabbbecca`): enforces that expired, failed, or recalled packs (or packs from failed/recalled cycles) can never be opened (`CSSD_PACK_UNUSABLE`).
  - Point-of-use linkage validation (`validatePackUseInput`, `rule:d8f4d7af47`): requires pack code and at least one of `booking_id` or `admission_id`.
  - Expiry warning check (`isPackExpiringSoon`): displays red warning styling when approaching expiration.
  - Critical recall event detection (`isCssdRecallEvent`, `rule:4357be8acb`): catches `Recalled` cycle updates.
  - Bilingual error explanations (`explainSterilePackError`): covers `CSSD_PACK_UNUSABLE`, `REFERENCE_NOT_FOUND`, and `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/SterilePacksOT.tsx`)**:
  - Surgical case queue (`listBookings`) with search filter and patient context card.
  - Patient Context & Identity Banner: Preserves name, MRN, theatre room, primary surgeon, and current operative lifecycle state.
  - Point-of-Use Pack Scanner (`POST /cssd/packs/use`): Inspects pack sterilization cycle and expiry, displays clear usability status, and blocks unusable packs.
  - Critical Recall Alert Banner: Displays high-priority warning on cycle recall with one-click filter to isolate affected packs.
  - Sterile Packs Stock & Usage Ledger: Filterable by status (Available, Issued, Used, Recalled, Expired, Failed) and search.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (3 tasks), `src/foundation-task-map.json` (3 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `sterile_packs_ot` to `deliveredHelpScreens` and all 11 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 9 operational steps, and 6 role FAQs for `ot_nurse`.
  - Bundled screenshots: `public/handbook/sterile_packs_ot-en.png` and `sterile_packs_ot-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/sterile-packs-ot.test.mjs` (6/6 passing).
  - Full test suite: `npm test` passed (567/567 passing across all suites).
  - Help check: `npm run check:help` passed (122 screens, 2855 controls, 1886 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-B9x0Cc7Q.js`).
- **Commit & Proposal**:
  - Implementation commit: `ab7a6d9`.
  - Proposal ID: **276** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 122 (`ot_intraop`) Checkpoint
- **Workflow & Standards**: Theatre lifecycle and consumables management in `ot_admin`: Starting surgery (`POST /ot/bookings/{id}/start`), intra-operative consumable/implant barcode scanning (`POST /ot/bookings/{id}/consumables`), statutory mistake reversals with mandatory reason (`POST /ot/consumables/{id}/reverse`, Rule f228c617bd), completing surgery with WHO checklist prerequisite verification (`POST /ot/bookings/{id}/complete-surgery`), and completing theatre cleaning / restoring suite to Available (`POST /ot/bookings/{id}/complete-cleaning`), under Rule 23588c8fc8 (runtime capability gating from `GET /establishment` views for `ot_intraop`); Position 122 (53 points), Workspace `ot_admin`.
- **Contracts**:
  - `contracts/ot_intraop.json`: Saved real MCP screen bundle (6 endpoints, 1 realtime event, 2 statutory rules, 19 rubric items).
  - `src/generated/ot_intraop.ts`: Generated TypeScript contracts for all 6 operations and data models.
- **Domain Policies & Statutory Rules (`src/ot-intraop-policy.ts`)**:
  - Runtime service capability gating (`rule:23588c8fc8`): evaluates `GET /establishment` views for `ot_intraop` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Lifecycle state machine: Validates permitted transitions (`Scheduled`/`EmergencyHold` -> `InProgress`, `InProgress` -> `Cleaning`, `Cleaning` -> `Completed`).
  - Role permissions: `canManageBookings` (`ot.booking.manage`), `canRecordConsumables` (`ot.consumable.record`), `canViewBookings` (`ot.booking.view`), `canStartSurgery`, `canCompleteSurgery`, `canCompleteCleaning`, `canAddConsumables`.
  - Scan validation (`validateConsumableScan`): enforces positive quantity and item reference (barcode or non-stock description).
  - Reversal validation (`validateReversalReason`, `canReverseConsumable`, `rule:f228c617bd`): requires mandatory reason (3-1000 characters), prevents reversing already reversed items or reversal rows.
  - Bilingual error explanations (`explainOtIntraopError`): covers `OT_BOOKING_NOT_ACTIVE`, `OT_CHECKLIST_INCOMPLETE`, `OT_CONSUMABLE_REVERSAL_INVALID`, `REFERENCE_NOT_FOUND`, and `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/OTIntraop.tsx`)**:
  - Theatre lifecycle actions: Start Surgery, Complete Surgery, Complete Cleaning with visual room status indicators (In-Surgery 🔴, Cleaning 🟡, Available 🟢).
  - Surgical case queue with status filter tabs (Scheduled, InProgress, Cleaning, Completed, EmergencyHold, All), case search, and patient context cards.
  - Patient Context & Identity Banner: Preserves name, MRN, gender/age, theater room, primary surgeon, anaesthetist, and current lifecycle state.
  - Dual Scan Modes:
    1. Barcode Scan (Pharmacy stock with automated FEFO inventory deduction).
    2. Vendor Implant / Non-stock (specialized custom implants with description, unit cost, and retail price).
  - Statutory Reversal Modal (`POST /ot/consumables/{id}/reverse`, `rule:f228c617bd`): Enforces audit reasons for reversals; hard deletion is prohibited.
  - Realtime synchronization: Subscribes to `ot.booking.updated` WebSocket events to refresh the booking queue and active booking details.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (6 tasks), `src/foundation-task-map.json` (6 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `ot_intraop` to `deliveredHelpScreens` and all 23 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 9 operational steps, and 6 role FAQs for `ot_admin`.
  - Bundled screenshots: `public/handbook/ot_intraop-en.png` and `ot_intraop-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/ot-intraop.test.mjs` (7/7 passing).
  - Full test suite: `npm test` passed (561/561 passing across all suites).
  - Help check: `npm run check:help` passed (121 screens, 2842 controls, 1875 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-B64JnLsa.js`).
- **Commit & Proposal**:
  - Implementation commit: `efb8527`.
  - Proposal ID: **275** (status: `pending` on `/docs -> My progress`).

---

### Completed Screen 121 (`ot_consumables_nurse`) Checkpoint
- **Workflow & Standards**: Intra-operative consumables, implants, and pharmacy stock scanning (FEFO) into surgical bookings under Rule 0a80234be9 (mistaken scans reversed with reason, never deleted) and Rule 77e2100829 (runtime service capability gating from `GET /establishment` views for `ot_consumables_nurse`); Position 121 (47 points), Workspace `ot_nurse`.
- **Contracts**:
  - `contracts/ot_consumables_nurse.json`: Saved real MCP screen bundle (4 endpoints, 1 realtime event, 2 statutory rules, 17 rubric items).
  - `src/generated/ot_consumables_nurse.ts`: Generated TypeScript contracts for all 4 operations and data models.
- **Domain Policies & Statutory Rules (`src/ot-consumables-nurse-policy.ts`)**:
  - Runtime service capability gating (`rule:77e2100829`): evaluates `GET /establishment` views for `ot_consumables_nurse` (`full`, `open_work`, `records`, `setup`, `hidden`).
  - Active surgery validation (`isSurgeryActive`): prevents scan/reversal writes on completed or cancelled cases.
  - Role permissions: `canViewBookings` (`ot.booking.view`, `ot.booking.manage`), `canRecordConsumables` (`ot.consumable.record`).
  - Scan validation (`validateConsumableScan`): enforces positive quantity and item identifier (barcode, drug ID, implant description, or asset ID).
  - Reversal validation (`validateReversalReason`, `canReverseConsumable`, `rule:0a80234be9`): requires mandatory reason (3-1000 characters), prevents reversing already reversed rows or reversal rows themselves.
  - Bilingual error explanations (`explainConsumablesError`): covers `OT_BOOKING_NOT_ACTIVE`, `OT_CONSUMABLE_REVERSAL_INVALID`, `REFERENCE_NOT_FOUND`, and `VALIDATION_ERROR`.
- **UI Architecture (`src/screens/OTConsumablesNurse.tsx`)**:
  - Surgical case queue (`GET /ot/bookings`) with status filter (InProgress, Scheduled, Cleaning, Completed, EmergencyHold, All), `mine` filter, case search, and patient context cards.
  - Patient Context & Identity Banner: Preserves name, MRN, procedure, theater room, primary surgeon, and operative status.
  - Dual Scan Mode:
    1. Barcode Scan (Pharmacy stock with automatic FEFO inventory deduction via `POST /ot/bookings/{id}/consumables`).
    2. Vendor Implant / Non-stock (specialized custom implants with description, unit cost, and retail price).
  - Statutory Reversal Modal (`POST /ot/consumables/{id}/reverse`, `rule:0a80234be9`): Enforces audit reasons for reversals; hard deletion is strictly prohibited.
  - Scanned Items Table with live totals, active consumables count, reversed count, and billing revenue metrics.
  - Realtime synchronization: auto-refreshes on `ot.booking.updated` events without polling.
- **Help, Handbook & Navigation**:
  - Wired into `src/App.tsx`, `src/foundation-catalogue.json` (4 tasks), `src/foundation-task-map.json` (4 controls).
  - Contextual F1 help (`src/foundation-help.ts`): added `ot_consumables_nurse` to `deliveredHelpScreens` and all 20 controls mapped.
  - Authored comprehensive handbook entry (`src/help.ts`) with bilingual title, purpose, 8 operational steps, and 6 role FAQs.
  - Bundled screenshots: `public/handbook/ot_consumables_nurse-en.png` and `ot_consumables_nurse-ur.png`.
- **Verification**:
  - Automated unit tests: `tests/ot-consumables-nurse.test.mjs` (7/7 passing).
  - Full test suite: `npm test` passed (554/554 passing across all suites).
  - Help check: `npm run check:help` passed (120 screens, 2816 controls, 1852 groups, 69 FAQ seeds, 30 workspace guides).
  - TypeScript compiler: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded (`dist/assets/index-DElxGgUI.js`).
- **Commit & Proposal**:
  - Implementation commit: `aae6250`.
  - Proposal ID: **274** (status: `pending` on `/docs -> My progress`).

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

## Plan for Screen 133 (`accountant_cockpit`)
- **Workflow & Standards**: Accountant cockpit, daily financial balance sheet, revenue recognition, cash shift drawer reconciliation, bank deposit audits, refund/credit note approvals, and trial balance generation in `accountant` workspace; Position 133 (83 points), Workspace `accountant`.
- **Bundle & Contracts**:
  - Fetch bundle via `get_screen_bundle("accountant_cockpit", max_chars=200000)`.
  - Save to `contracts/accountant_cockpit.json`.
  - Quality brief via `get_ui_quality_brief(screen_id="accountant_cockpit")`.
  - Generate TypeScript contracts: `src/generated/accountant_cockpit.ts`.
- **Domain Policies & Statutory Rules (`src/accountant-cockpit-policy.ts`)**:
  - Accountant role permissions and double-entry reconciliation guards.
  - Runtime service capability gating.
  - Bilingual error explanations.
- **UI Architecture (`src/screens/AccountantCockpit.tsx`)**:
  - Financial dashboard, cash shifts auditing, bank deposit batches, general ledger trial balance.
- **Help, Handbook & Navigation**:
  - Contextual F1 help with controls mapped in `src/foundation-help.ts`.
  - Task mapping in `src/foundation-catalogue.json` and `src/foundation-task-map.json`.
  - Handbook entry in `src/help.ts` with 5 role FAQs for `accountant`.
  - Bundled screenshots: `public/handbook/accountant_cockpit-en.png` and `accountant_cockpit-ur.png`.
- **Automated Verification**:
  - `tests/accountant-cockpit.test.mjs`.
  - `npm test`, `npm run check:help`, `npx tsc --noEmit`, `npm run build`.
  - Commit and submit `propose_progress` (Proposal 286).

---

## Completed Screens Checkpoint
- Proposals **231**, **232**, **233**, **234**, **235**, and **236** are accepted.
- Proposals **237** through **285** are awaiting human review on `/docs -> My progress` (latest: 285 for `ot_settlement`).
- Phase 6 ("Theatre and sterile supply") is **100% COMPLETE** (Screens 109–132, Proposals 262–285):
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
  - Screen 121: `ot_consumables_nurse` (Proposal 274)
  - Screen 122: `ot_intraop` (Proposal 275)
  - Screen 123: `sterile_packs_ot` (Proposal 276)
  - Screen 124: `sterile_packs_ot_admin` (Proposal 277)
  - Screen 125: `sterile_packs_ward` (Proposal 278)
  - Screen 126: `anaesthesia_record` (Proposal 279)
  - Screen 127: `surgical_record_surgeon` (Proposal 280)
  - Screen 128: `recovery_board` (Proposal 281)
  - Screen 129: `recovery_board_admin` (Proposal 282)
  - Screen 130: `recovery_board_anaesthesia` (Proposal 283)
  - Screen 131: `transfusion_bedside_ot` (Proposal 284)
  - Screen 132: `ot_settlement` (Proposal 285)
  - Screen 116: `pre_anaesthesia_clinic` (Proposal 269)
  - Screen 117: `consents_anaesthesia` (Proposal 270)
  - Screen 118: `safety_checklist` (Proposal 271)
  - Screen 119: `safety_checklist_admin` (Proposal 272)
  - Screen 120: `safety_checklist_anaesthesia` (Proposal 273)
  - Screen 121: `ot_consumables_nurse` (Proposal 274)
  - Screen 122: `ot_intraop` (Proposal 275)
  - Screen 123: `sterile_packs_ot` (Proposal 276)
  - Screen 124: `sterile_packs_ot_admin` (Proposal 277)
  - Screen 125: `sterile_packs_ward` (Proposal 278)
  - Screen 126: `anaesthesia_record` (Proposal 279)
  - Screen 127: `surgical_record_surgeon` (Proposal 280)
  - Screen 128: `recovery_board` (Proposal 281)
  - Screen 129: `recovery_board_admin` (Proposal 282)
  - Screen 130: `recovery_board_anaesthesia` (Proposal 283)
  - Screen 131: `transfusion_bedside_ot` (Proposal 284)
