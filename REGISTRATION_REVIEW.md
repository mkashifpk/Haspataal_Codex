# Registration contract review

Reviewed initially on 18 October 2026; reconciled with backend fixes on 19 October 2026. Current MCP contract fingerprint: `0b5ab90e400dfbb822d3`; knowledge revision: `318d65bdd91cd873`. See `BACKEND_FIXES_REVIEW.md` for the live verification and affected UI changes.

The original Step 1 was incomplete. The screen now includes the following contract features. This is an implementation audit, not human acceptance or a claim that every refusal path has been tested.

| Requirement | Implementation and evidence |
| --- | --- |
| Required intake | Name, gender, mobile and age or DOB; CNIC optional. Atomic new patient + ticket registration is verified on DEV. |
| Optional intake | Father/husband, address, emergency contact, blood group and allergies; Cash/Panel billing, panel and membership selection. Standalone patient creation is available. Staff payroll linking now uses the minimal signed-in `/staff/lookup` API, without HR-directory permission. |
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

## Backend gaps reported and subsequently verified

- **Issue #5 (Medium), Fixed:** `/staff/lookup` returns active staff badge facts for signed-in users. Reception can now search and select a real staff record; no manual database ID or HR-directory grant is needed. The picker was verified through Electron on 19 October.
- **Issue #6 (Low), Fixed:** a live invalid-employee registration returned `REFERENCE_NOT_FOUND` with `details.field=linked_employee_id` and rolled back completely. Examples are now labelled with `details_from`, so cross-endpoint example fields are not treated as a registration schema. The UI preserves complete errors and marks the affected selector from the actual response field.

## Verification

- Production build; 11 contract/transport/print-safety/approval-policy tests and 32 live API checks passed after the 19 October backend reconciliation.
- `scripts/registration-check.mjs`: new synthetic patient and unpaid ticket, optional photo/report uploads, F1 draft preservation, print preview and real 80 mm PDF, Card payment and queue. Successful evidence: `MRN-2026-000007`, `OPD-2026-000007`, queue token 3. See `artifacts/registration-check.json`, `artifacts/registration-full.png`, and `artifacts/opd-slip.pdf`.
- `scripts/registration-review.mjs` covers stored-photo retrieval, an Urdu 250% screenshot, optional intake, panel billing, patient-only registration and waiver request. Its result is recorded separately in `artifacts/registration-review.json` after a successful run.
- Demo panel created through the real finance API: `DEMO-CODEX-20261018`, panel ID 1. This is synthetic DEV setup data.

## Still required before declaring the section complete

Test physical camera and receipt printer; review cash/bank, emergency/dues, discount ceilings, staff-linked patient submission and lost-answer recovery; review and sign off Urdu; perform the named human fresh-data/CRUD review required by MCP. Do not mark the section complete while these are pending. The former issue #5 staff-lookup blocker is resolved.
