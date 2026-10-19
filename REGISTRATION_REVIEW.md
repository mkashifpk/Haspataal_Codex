# Registration contract review

Reviewed against Haspataal MCP `registration`, contract fingerprint `bde3c5f94776075b2abd`, knowledge revision `933cb79d7aa9f9b7` (18 October 2026).

The original Step 1 was incomplete. The screen now includes the following contract features. This is an implementation audit, not human acceptance or a claim that every refusal path has been tested.

| Requirement | Implementation and evidence |
| --- | --- |
| Required intake | Name, gender, mobile and age or DOB; CNIC optional. Atomic new patient + ticket registration is verified on DEV. |
| Optional intake | Father/husband, address, emergency contact, blood group and allergies; Cash/Panel billing, panel and membership selection. Standalone patient creation is available. |
| Returning patient | Live search, master patient detail, name/MRN/age identifiers, allergies, blood group, dues, deceased and medico-legal flags. Patient context refreshes with realtime events. |
| Patient picture | Optional consent, camera or JPEG/PNG file, preview/reselect and Skip without a reason; maximum 16 megapixels. Separate idempotent upload after the patient exists. File upload and protected download verified; physical camera capture awaits terminal testing. |
| Outside reports | Multiple PDF/JPEG/PNG files; type, title, issuing facility and document date. Separate idempotent uploads; stored reports labelled Outside and kept separate from hospital results. Upload verified on DEV. |
| OPD visit | Live active service catalog with doctor/department references; ordinary/return/referred source, emergency source gated by active emergency service. |
| Payment | Collect full payment during atomic registration, or later payment for an issued ticket; Cash/Card/BankTransfer, amount and reference. Card payment and resulting queue placement verified on DEV. Cash requires an open shift; cash/bank/emergency refusal paths still need review. |
| Discounts and waiver | Discount and reason, complete server ceiling errors, and pre-consult VIP waiver request on an unpaid ticket. Approval lock and cash-back prompts are shown from the server. |
| Dues | Actual outstanding banner; override reason only with permission; explicit emergency bypass. No fabricated balance or local success. |
| Queue | Server queue token/status and live reception dashboard. |
| Print/reprint | Reopen by ticket number; fresh server print payload; text + barcode + QR preview, mapped Windows receipt printer, unregistered-terminal print dialog, 80 mm PDF. Printing failure retries printing, not registration/payment. PDF verified; physical paper output awaits terminal testing. |
| Safe writes | Same request key/payload on uncertain retry; registration, payment and upload have separate actions. Forms freeze when outcomes are unknown; navigation cannot discard a pending write. No offline write queue or fake backend data. |
| Help/language/zoom | Expanded English/Urdu draft handbook and reception FAQs; F1 and shared bounded zoom. Native Urdu review and named human acceptance remain pending. |

## Backend gaps reported

- **Issue #5 (Medium):** `linked_employee_id` cannot be selected safely by reception because the employee directory requires `hr.employee.view`. The optional staff lookup is disabled with an explanation for those users; users with the directory permission can select actual employees. No database-ID textbox or fake employee is used.
- **Issue #6 (Low):** registration `REFERENCE_NOT_FOUND` metadata inconsistently names `ward_id` versus `details.field`. The UI displays complete server errors instead of guessing a field.

## Verification

- Production build; seven contract/transport/print-safety tests; 32 live API checks.
- `scripts/registration-check.mjs`: new synthetic patient and unpaid ticket, optional photo/report uploads, F1 draft preservation, print preview and real 80 mm PDF, Card payment and queue. Successful evidence: `MRN-2026-000007`, `OPD-2026-000007`, queue token 3. See `artifacts/registration-check.json`, `artifacts/registration-full.png`, and `artifacts/opd-slip.pdf`.
- `scripts/registration-review.mjs` covers stored-photo retrieval, an Urdu 250% screenshot, optional intake, panel billing, patient-only registration and waiver request. Its result is recorded separately in `artifacts/registration-review.json` after a successful run.
- Demo panel created through the real finance API: `DEMO-CODEX-20261018`, panel ID 1. This is synthetic DEV setup data.

## Still required before declaring the section complete

Resolve issue #5 or agree a backend-supported workflow; test physical camera and receipt printer; review cash/bank, emergency/dues, discount ceilings and lost-answer recovery; review and sign off Urdu; perform the named human fresh-data/CRUD review required by MCP. Do not mark the section complete while these are pending.
