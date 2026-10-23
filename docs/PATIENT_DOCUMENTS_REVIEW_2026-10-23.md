# Patient document vault — implementation checkpoint

2026-10-23, Codex, implementation1, main467f416 plus preserved uncommitted work. One screen only: patient_documents, Phase2 position19. Full screen acceptance is pending; an automated DEV journey is not a human review.

## Delivered behavior

Reception → Patient document vault searches an existing patient by name/mobile/CNIC/MRN. Selection shows name, MRN, age/DOB, allergies, blood group and available flags. Search results and selected patient are separate; changing context asks before discarding unsent files and blocks during an uncertain upload. Profile refresh preserves the upload component and prevents new uploads while the patient read fails or is pending. Changed master identity requires reconciliation.

The existing separate registration upload flow is shared. Optional photo consent, JPEG/PNG preview, camera controls and Skip photo remain available; PDFs cannot be patient photos. Outside reports retain type/title/facility/date and are explicitly labelled outside, never hospital results. Vault drafts can instead select a hospital or ID attachment with its real contract type. Each file owns a separate key and immutable retry context; no registration, payment or admission is resubmitted. Confirmed upload and subsequent reads have separate outcomes. Stored documents refresh deliberately; images open only on request through authenticated download, and PDFs use the existing native Save dialog. New photos refresh the selected patient's actual current-photo pointer.

English/Urdu page, role task answers, F1/control mapping, existing shared zoom and actual synthetic screenshots accompany the screen. Draft Urdu and editor/human gates remain pending.

## Files

- src/screens/PatientDocuments.tsx, RegistrationDocuments.tsx, App.tsx.
- src/generated/patient_documents.ts, contracts/patient_documents.json and patient-documents-refresh-2026-10-23.json.
- src/help.ts, foundation-help.ts, foundation-catalogue.json, foundation-task-map.json, i18n.ts, scripts/check-help.mjs and public/handbook/patient_documents-{en,ur}.png.
- scripts/patient-documents-check.mjs, tests/contract-inventory.test.mjs and updated help screen count in tests/help-coverage.test.mjs.

## Verification and limits

Final source build: index-BA0RprjE.js. npm run build passed handbook18screens/274controls/78groups/33FAQseeds/30workspaceguides, TypeScript and Vite. npm test52PASS. Existing bundle-size warning remains.

Final real DEV run DEMO-DOCUMENTS-1792733949660 uses the previously labelled synthetic patient14/MRN-2026-000012. New outside LabReport12 and hospital CNIC13 were uploaded separately. Original report201 reply was lost AFTER commit; duplicate clicks issued one initial call, explicit original-key replay returned201/Idempotent-Replaytrue and the same document12. Missing facility validation, F1/draft preservation and patient-switch blocking were checked. Report12 was explicitly opened/decoded once; no prefetch. Optional photo was skipped without a write, PDF photo refused, consented synthetic PNG uploaded once as Photo14 and the current-photo button downloaded actual14. Final run3PASS: persisted-list reopen and both themes/languages250/nohorizontaloverflow passed; owned34inactive/preferencesrestored/allattemptsfinished confirmed. Final packaging kept the identical renderer.

Runtime instrumentation observes real HTTPS; it never substitutes server records. Multipart boundaries vary between transmissions; same original key, frozen draft/file and server replay/same IDs establish the retry. Raw transport hashes are retained rather than falsely claimed identical wire bytes. Final artifacts and source hashes: docs/patient-documents-build-2026-10-23.json. Ignored artifacts are local and do not travel with Git.

Earlier runs: preferences timeout before business writes; malformed supplementary snapshot endpoint objects locally blocked patient detail (corrected snapshot key and operation-inventory regression); one repeated-test assertion matched an older report facility label (scoped to current run). Earlier records9/10 and11 are confirmed synthetic attachments retained for audit, not unknown writes. No backend defect inferred from those frontend/harness faults.

No new patient, OPD visit, payment, approval or cash-back transaction was created here. Prior pending ticket13/refund disbursement1 remains untouched. No physical camera, actual PDF Save/cancel, maximum-size/corrupt-content/future-date/full error and role matrix, merge/death concurrent draft, admission/photo propagation, full zoom persistence/bounds or full human/editor/translation worksheet pass claimed. Do not claim whole-screen completion, q:tested or the human gates.

## Backend

Server2026-10-23T05:05:34.846311+00:00; contract57d137222f1ca637655d, rubricd81d43f195f8. what_changed found no contract changes. Backend issue13 Fixed: single sandbox demo.reception GET /staff/lookup?q=DEMO retest200, requestd32a724e987b4c1588226e2a1a2c4bb4; backend-owned login restoration now works. No shared demo password/state edits. Issue14 refund.ready amount serialization remains New. No new backend issue reproduced.

## Human test next

1. In Reception create a fresh synthetic patient through New registration → Patient record only, without photo. Record the returned MRN; no payment is required for this vault test.
2. Open Patient document vault, search that MRN, verify name/MRN. Upload an optional outside PDF/JPEG/PNG with title/type/facility/date, and a hospital ID copy by clearing Outside document. Check persistence, provenance, explicit image opening and native PDF Save/cancel. Do not attach real patient or ID data to DEV.
3. Try missing facility, PDF photo, unsent draft change/cancel, F1 and language/theme/100–250% keyboard zoom. With consent use the real camera, retake/Skip, then upload and verify current photo. A failure must not repeat registration/payment.
4. Complete the reception review worksheet from /docs/api/review-worksheet/reception with your name/build/records/results and native Urdu/device findings. Review the saved progress proposal on /docs → My progress. Stored attachments are append-only here; no invented delete or verification action.

Stop after this screen. Tariff display is the next planned screen after the user's instruction.

## Progress submission

Proposal66 PENDING saved and read back via progress_proposals: awaiting human review on /docs -> My progress. Exact payload docs/codex-patient-documents-vault-20261023-v1.json, only three document endpoints and outside provenance rule794ff452da. Proposal65 now ACCEPTED on closeout read. No agent approval, worksheet result or whole-screen completion asserted.
