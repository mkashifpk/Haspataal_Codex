# General consent at admission — Phase 4, screen 54

Implemented against DEV build 2026-10-27T21:34:51.340676+00:00, contract 58db76bf7d59ef6d9870, rubric 378ea8e0f42b. Baseline 384b1a4. This is a partial screen delivery pending human acceptance and backend issue #39.

## Delivered

The worklist opens existing drafts and shows overdue work. Admissions staff can prepare a General form in one of its supplied languages, edit the explanation, review a frozen decision, sign or record a witnessed verbal refusal, cancel a draft, and withdraw a given consent. Other clinical consent work is handed to its clinical workspace. Patient identity, permission, current record/version, and runtime service views guard writes. The emergency picker uses actual PMDC staff rows and employee_id, showing names and registrations; no typed doctor ID.

Document upload, attaching the signed paper, printing and downloading are separate operations. Upload/print failures cannot repeat the decision. Exact consent-number scanner matching uses a fresh authorized General register, bounded to the latest 1000 rows; older records need the known reference. No numeric ID is inferred from a barcode. Realtime consent.updated refreshes data and invalidates stale reviews while preserving typed work. Unknown writes retain their original request; no automatic business retry.

Files: src/screens/ConsentsAdmissions.tsx, ConsentScanUpload.tsx, src/consent-policy.ts, PMDCStaffPicker.tsx, generated/consents_admissions.ts, electron/consent-print.cjs and main.cjs; saved contracts, bilingual help, role FAQs, task/control mappings, real synthetic screenshots and tests.

## Writes and refusals

All listed endpoint contracts were read individually. Shared authentication, validation, idempotency and transport errors remain visible and code based. State refusals reread the exact consent; typed inputs survive. Retry is explicit, uses the retained original request where supported, and observes server retryability/retention. Versioned decisions require inspection after an unknown answer.

| Endpoint | Documented codes | Handling / evidence |
|---|---|---|
| POST /consents | CONSENT_TEXT_MISSING, OT_BOOKING_STATE_INVALID, REFERENCE_NOT_FOUND, VALIDATION_ERROR | Show actual supplied languages/field errors; refresh stale references. Only General admission preparation offered; no invented OT booking. Actual 201/lost reply/same-key replay and missing-language 422. |
| PATCH /consents/{id} | CONSENT_STATE_INVALID | Exact record reread; expected_version; preserve explanation. Actual lost 200 reconciled without replay, concurrent event/rebase, decided-state 409. |
| POST /consents/{id}/sign | CONSENT_INCOMPLETE, CONSENT_SIGNER_INVALID, CONSENT_STATE_INVALID, CONSENT_TAKER_NOT_AUTHORIZED, FORBIDDEN, VALIDATION_ERROR | Highlight missing fields, preserve decision, show code guidance and reread state. Actual thumb/witness sign, incomplete 422, taker 403, nurse-second-doctor 422, actual PMDC second-doctor success. |
| POST /consents/{id}/refuse | CONSENT_INCOMPLETE, CONSENT_SIGNER_INVALID, CONSENT_STATE_INVALID, CONSENT_TAKER_NOT_AUTHORIZED | Deliberate signer, reason and witnessed verbal refusal; same refusal recovery. Actual UI 200. |
| POST /consents/{id}/withdraw | BLOOD_CONSENT_REQUIRED, CONSENT_STATE_INVALID | Keep reason, show server refusal and reread state; General scope prevents blood workflow guesses. Actual UI lost 200/read/identical-key replay. |
| POST /consents/{id}/cancel | CONSENT_STATE_INVALID | Draft only, frozen review, exact reread, explicit original-key recovery. Actual UI 200. |
| POST /consents/{id}/scan | CONSENT_STATE_INVALID, REFERENCE_NOT_FOUND, VALIDATION_ERROR | Only returned Consent document rows belonging to this patient; preserve selection and reread final state. Actual UI 200 after separate upload. |
| POST /patients/{id}/documents | FORBIDDEN, IDEMPOTENCY_CONFLICT, NOT_FOUND, PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, VALIDATION_ERROR | Original File/key retained independently; visible refusal, bounded explicit retry, navigation hold for unknown outcome. Actual synthetic PNG upload 201. |

The seven GET operations (worklist, register, forms, decision-makers, detail, print-payload, PDF) were exercised. English server PDF succeeds; Urdu returns CONSENT_PDF_UNAVAILABLE and uses the terminal renderer. Native image download now explicitly saves PNG/JPEG without changing existing preview callers.

## Verification

- npm test: **204/204 passed**, artifacts/consents-post-print-tests.log. npm run build passed, artifacts/consents-image-save-build.log: 54 screens, 1114 controls, 457 groups, 69 FAQ seeds, 30 guides. Existing bundle-size warning remains.
- npm run test:live: **32 requests passed**; npm run test:ui passed (consents-live-regression.log / consents-ui-regression.log). These ran before the final native print/image-save polish.
- Actual business Electron journeys: consents-ui-resume-stable and consents-worklist-current-check passed on index-D4gSuH4p.js; consents-final-current-check passed on index-Cm5bqJAK.js. These cover duplicate/lost answers, actual sign/upload/scan, concurrent edit/event/rebase, cancel, prepare, refusal, emergency doctor preview, withdrawal, read recovery and paper actions.
- Final readonly consents-delivery-final-read-check passed on index-BPVAzRUo.js: exact barcode lookup/unmatched refusal, empty filtering, contextual F1/focus, actual saved synthetic PNG, EN/UR terminal PDF, English/Urdu screenshots and Light/DarkHighContrast at 250%; zero business writes.
- Final print continuation: compact patient/MRN/consent header fixes omitted continuation-page identity. scripts/consents-print-layout-check.cjs renders three real fresh DEV payload snapshots without backend calls; English, decided Urdu and draft Urdu PDFs each have two pages and identity on every page. Urdu continuation was raster inspected. Focused print tests pass after this adjustment. The first standalone layout runner failed because Electron auto-quit after its first window; window-all-closed handling corrected the runner, not the product.
- Original failed runner results remain in docs/consents-ui-evidence-2026-10-28.json alongside passing continuations. They are not represented as passing runs. See frontend tracker for fixes and harness failures. No full screen_test_plan, native human Urdu review or compulsory human gate is claimed.

## Synthetic fixtures and cleanup

Run DEMO-CONSENTS-1793185429693: scenarios 81479f / c80d26, patients/tickets/admissions 10 and 11. Consent3 Withdrawn with synthetic document3 attached; 4 Cancelled; emergency5 Withdrawn; 6 Refused; picker-preview7 Cancelled. Both admissions Cancelled; bed38 Available/unoccupied; ward7 DCON793186456117 inactive. Histories remain intentionally. No real care, admission arrival, exposure, medication, money or patient signature was generated. Exact requests, keys, statuses and request IDs are in consents-live-2026-10-28.json. All sandbox requests returned; no uncertain business writes.

All later UI actors restored preferences and signed out. An earlier decision-runner transport reset prevented its cleanup/logout (recorded in its artifact); its browser closed, and later runs restored demo.admissions to the recorded English/Light/100% preferences. Do not claim that failed logout succeeded.

## Limits and human checklist

Backend issue **#39 New**: public decision-maker policy has adult/minor priority columns but no effective configured age threshold or patient-specific eligibility group accessible to Admissions. No age-18 guess is made: both server columns are shown, server validation remains authoritative, and full eligibility rule b7bacc1ffb is not proposed. Public emergency-second-doctor setting is also absent. Issue payload/receipt contain the reproduced request IDs. Issues35–38 remain New. Successful PACS linking remains the earlier decision54 DEV limitation, unrelated to this screen.

Human review remains required on /docs -> My progress. Use newly created synthetic records through the app:

1. Open Admissions → General consent. Check waiting work, patient identity, missing fields, supplied form languages and known-reference scanning.
2. Prepare, edit and review the General declaration; verify witness/refusal/withdrawal behavior and a concurrent change from another terminal. Confirm no repeated write after upload or print failure.
3. Check English and Urdu text with the hospital's clinical/translation reviewer, F1 from fields/dialogs, role FAQs and keyboard/Settings zoom.
4. Print actual A4 stock: all declaration paragraphs, signature writing space, patient/MRN/consent identity on every page, and physical barcode scanning. Terminal PDF rendering is tested; physical printer/scanner fit is pending.
5. Have a clinician verify emergency consent authority and the actual PMDC second-doctor choice. Full patient-specific representative eligibility waits for #39. Other informed/anaesthesia workflows, all-role/service-transition and busiest-hour review are not claimed here.

No Review code was entered by the agent. No human worksheet, acceptance or signature was fabricated. Next catalogue screen after this delivery is cost_estimates_admissions, Phase 4 screen55; refresh its roadmap/contracts first.
