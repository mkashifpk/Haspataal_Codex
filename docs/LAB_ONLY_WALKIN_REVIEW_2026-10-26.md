# Lab-only walk-in — Phase3 position36

Status: implementation checkpoint, not accepted or live verified. Read the current handoff before testing. DEV maintenance remains enabled (issue26); no business records were created in this implementation session.

## Delivered

Reception → Lab-only walk-in is filtered by the authenticated server handbook and service view. Name and mobile are the only required identity inputs. Priority, outside referrer, notes and tests are optional; the zero-test path does not depend on the catalogue succeeding. In-house and send-out tests use independent Active service gates; the partner is shown for the patient handover. No OPD ticket or doctor queue call exists in this flow.

Registration and invoice collection are separate reviewed writes with independent retained keys, current actor/context preflight and explicit original-body retry after uncertainty. The screen reads the actual master patient, flags, bounded requisition history, linked Lab invoice and server balance. Existing invoices may be collected only with the appropriate permissions, matching patient/invoice, unlocked payable state and fresh version. Cash requires the user's own open mapped shift; Card/Bank transfer are separate choices. No local balance or price total is calculated.

Signed report reading preserves values, ranges, flags, corrections, partner and performer/verifier stamps. Reports match the selected requisition/MRN. Not-ready remains an actual server error; partial reports are labelled. Existing native diagnostic A4, rendered PDF and server PDF bridges are reused. Printing/download/cancellation cannot repeat registration/payment. No unsupported edit/delete/cancellation or unsigned release is offered.

English/Urdu page, field/dialog/control guidance, Reception guide and task inventory accompany the screen; Urdu remains a draft pending native review. F1/zoom reuse the shared application. Actual visual/keyboard evidence remains pending.

## Checks actually run

- Current MCP roadmap, full bundle including omitted sections, generated types, relevant endpoint contracts, screen/workspace quality/design/handbook, workflow recipe and test plan read live. Request validation for a zero-test name/mobile registration passed; this is not an executed registration.
- npm test109/109PASS; four new policy tests and one negative confirmation-help mapping test. Policies cover minimal identity/optional tests, independent Active gates, permissions/service views, exact bill/patient eligibility and bounded payment/stale review.
- npx tsc --noEmit and git diff --check PASS.
- Development bootstrap Vite bundle index-BEf7ZcTK.js PASS with existing size warning. Mandatory npm run build STOPPED at missing real Lab-only English screenshot; Urdu and previous Charity media are also pending. No check disabled or image invented.

No authenticated browser journey, actual creation/payment/report read, loss/replay, live event, printer/PDF, layout/Urdu/zoom or named human acceptance is claimed. There are no new business IDs, running commands or uncertain writes.

## Fresh manual/automated journey after maintenance

1. Sign in as an authorised receptionist. Open the scoped screen and use fresh synthetic names/mobile. First create with only name/mobile and no tests; verify LabOnly registration and absent requisition/bill, and no doctor-queue entry.
2. Create another synthetic patient with actual selected tests. Verify optional outside doctor/notes/priority, in-house/send-out availability and partner notice. Close review retains the draft. Confirm once; record the actual MRN, patient/requisition and bill IDs.
3. Search the created patient or open the actual requisition. Check name/MRN, flags, item states and exact Lab bill. Verify collection permissions, locked/paid refusal, stale-review refusal, own drawer requirement and separate Card/Bank transfer paths. Any real DEV test collection must be software-only, journaled with original keys and never real money.
4. Fault-inject only the local reply delivery: duplicate clicks and lost creation/collection answers must replay identical original keys/bodies with one effect. Never rerun an unfinished journal or create another patient to repair a later step.
5. Have authorised lab roles produce and verify fresh results as a separate workflow. Before verification, show LAB_REPORT_NOT_READY. After publication, verify live refresh, partial versus complete report, original stamps/corrections/partner and signed A4/native/server PDFs. Cancellation/printer failure creates no second business write.
6. Verify actual reconnect reads, bounded history/no stale patient/report, merged/deceased flags, both languages/themes at250%, native zoom bounds/reset and F1 from fields/dialogs with draft/focus preservation. Capture actual synthetic handbook screenshots and run the mandatory build/tests.

Existing backend21–25 live UI retests and Charity approval/dispensing acceptance remain on the same backlog. Positive Pharmacy Cash needs an authorised PharmacyCounter test terminal; terminal4 MainReception must not be remapped. The hourly thread reminder resume-blocked-haspataal-checks notifies when maintenance clears, or once the following day if still blocked. Only the human enters Review code and signs portal reviews.
