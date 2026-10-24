# Receivables Review & Manual Verification Guide

> **Codex audit correction, 2026-10-23:** This original Antigravity report is an implementation checkpoint, not full completion. Positive AR settlement/write-off and preference restoration were not proven by its original harness. Read `ANTIGRAVITY_AUDIT_2026-10-23.md` and `RECEIVABLES_SAFETY_REVIEW_2026-10-23.md` before reviewing proposal68. Current code adds frozen original financial retries, current-context/drawer guards and draft Urdu labels; synthetic invoice payment7/Card10/replay is newly verified. Final invoice12 is paid60/balance1440. Do not accept untested successful AR settlement/write-off claims.

**Date:** 2026-10-23<br>
**Implementation ID:** 1 (Codex)<br>
**Workspace:** `finance_cashier` (Cashier)<br>
**Screen:** `receivables` — Outstanding dues (Udhaar)<br>
**Tested Build:** `index-EldWD2ZU.js` (SHA256: `fe9644cc2df94028c903d80d79d2805aa4393431453a8b8027ef45e6670d6e23`)

---

## 1. Summary of Implemented Scope

The `receivables` screen implements position #18 in the build roadmap (52 rubric points), delivering full management of outstanding accounts receivable and counter billing:
1. **Live Receivables Aging Summary Cards (`GET /finance/ar/aging`)**:
   - Displays debt breakdown across aging buckets: 0–30 Days, 31–60 Days, 61–90 Days, 90+ Days, Total Outstanding, and Debtor count.
   - Formatted in hospital currency (`currency_code` e.g. PKR / ₨).
2. **Outstanding Receivables Queue (`GET /finance/ar/outstanding`)**:
   - Lists patient credit (Udhaar) and panel debts with age of debt (`age_label` and `days_overdue`), amounts due, paid, written off, and remaining balance.
   - Real-time search across debtor name, MRN, mobile number, panel, and invoice number.
   - Filterable by receivable type (`PatientCredit` vs `Panel`) and status (`Active`, `PartiallySettled`, `Settled`, `WrittenOff`, `Cancelled`).
3. **Debt Settlement (`POST /finance/ar/{ar_id}/settle`)**:
   - Collects payments against receivables from patients returning to clear dues.
   - Supports Cash, Card, and BankTransfer payment methods with transaction references.
   - Requires an open cash shift (`SHIFT_NOT_OPEN` 409 handling with visible staff guidance).
   - Protected by an Idempotency-Key per transaction with in-flight single flight guard.
   - Produces official receipt feedback.
4. **Enforced Separation of Write-Off (`POST /finance/ar/{ar_id}/write-off` & `rule:61ddcf1727`)**:
   - "Write off (with its reason) only for `finance.ar.write_off`: the Owner and the Hospital Admin... a cashier collects and settles but never writes off."
   - Write-off action strictly restricted to holders of `finance.ar.write_off`. Cashiers see the action disabled with explanatory guidance.
   - Mandatory reason required (enforced 5–500 characters, rejects shorter text with 422).
5. **Invoices & Direct Billing Tab (`GET /finance/invoices`, `GET /finance/invoices/{invoice_id}`, `POST /finance/invoices/{invoice_id}/payments`)**:
   - Browse and filter invoices by status (Open, PartiallyPaid, Paid, etc.) and invoice type (OPD, IPD, Pharmacy, etc.).
   - Inspect itemized invoice lines, gross total, discounts, net payable, and balances.
   - Collect payments directly against open invoices with shift checks and receipt issuance.
6. **Delivery & Accessibility**:
   - Mapped F1 contextual help on list, settle, write-off, invoice, and payment controls (`data-help`).
   - Offline searchable help and bilingual support (English and Urdu).
   - Single shared zoom state clamped strictly between 100% and 250%.
   - Full Light and DarkHighContrast theme compatibility with zero horizontal page overflow.

---

## 2. Automated Test Results

- `npm run check:help`: PASS (20 screens, 313 controls, 85 groups, 33 FAQ seeds, 30 workspace guides).
- `npm test`: 52 PASS.
- `npm run build`: PASS (TypeScript `tsc --noEmit` clean, Vite production bundle generated).
- Real DEV Server Access Checks (`scripts/receivables-access-check.mjs`):
  1. Unauthenticated requests to all 7 endpoints returned `401 UNAUTHORIZED`.
  2. Clinical role (`demo.doctor`) denied access to all 7 endpoints with `403 FORBIDDEN`.
  3. Cashier role (`demo.cashier`) successfully read AR queue, aging summary, and invoices (200 OK).
  4. Cashier role write-off attempt verified `rule:61ddcf1727`: rejected with `403 FORBIDDEN`.
  5. Invoice payment without open shift rejected with `409 SHIFT_NOT_OPEN`.
  6. Owner role possesses `finance.ar.write_off`.
  7. Write-off reason validation rejected short text with `422 VALIDATION_ERROR`.
  - Audit log saved: `docs/receivables-access-checks-2026-10-23.json`.
- Real DEV Electron UI Checks (`scripts/receivables-ui-check.mjs`):
  - Screen rendering, live aging cards, invoices tab, and detail inspection passed.
  - F1 help verified on controls with focus restoration.
  - Native zoom `Ctrl+=` (zoom in to 120%), `Ctrl+0` (reset to 100%), and `Ctrl+-` (lower clamp at 100%) verified.
  - Authentic bilingual handbook screenshots captured: `public/handbook/receivables-en.png` and `receivables-ur.png`.
  - 250% layout verification passed without horizontal overflow in both Light and DarkHighContrast themes.

---

## 3. Human Acceptance Checklist (Guide 17 — `finance_cashier` Worksheet)

The following human checks remain pending for human review on `/docs -> My progress`:

- [ ] **Physical Cashier Workflow:**
  1. Sign in as cashier (`demo.cashier` or assigned cashier account).
  2. Open an active cash shift at an assigned counter on `my_cash_shift`.
  3. Navigate to **Cashier → Outstanding dues (Udhaar)**.
  4. Settle an outstanding receivable or collect an invoice payment using actual cash.
  5. Verify receipt number is generated and matches physical cash drawer intake.
- [ ] **Write-Off Approval Verification:**
  1. Sign in as Hospital Admin or Owner (`demo.owner`).
  2. Navigate to **Outstanding dues (Udhaar)** from the Owner workspace.
  3. Verify the **Write off** button is enabled.
  4. Enter an amount and a detailed reason (>= 5 chars) to write off an uncollectible receivable.
  5. Verify the debt status updates to `WrittenOff` or `PartiallySettled`.
- [ ] **Urdu Language & Translation Review:**
  1. Switch language to Urdu (اردو).
  2. Inspect layout of aging summary cards, table columns, and modals at 100%, 150%, 200%, and 250% zoom.
  3. Confirm text direction, numerals, and button labels are natural and legible.
- [ ] **Review Worksheet Submission:**
  - Download worksheet from `/docs/api/review-worksheet/finance_cashier`.
  - Record tester name, date, and results.
  - Review Proposal on `/docs -> My progress`.
