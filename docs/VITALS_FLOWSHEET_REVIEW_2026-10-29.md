# Vitals flowsheet — screen62

29 October2026. Implementation1 Codex. Baseline6437320. Serverbuild2026-10-28T21:29:45.848402+00:00, contracte90ba541e495d6487532, knowledgee9e3dbb61b873e01, rubric6b013592c628. See proposal JSON for tested source commit/build. Startup roadmap, complete screen bundle (including omitted schemas/examples and decisions), endpoint contracts, design principles, screen/workspace quality, Ward Nursing handbook outline and screen_test_plan were read before implementation.

## Delivered

`src/screens/VitalsFlowsheet.tsx`, `src/vitals-policy.ts`, generated `vitals_tracker.ts` and saved contracts implement the admission-scoped flowsheet. App navigation and My beds handover preserve the returned admission. The verified patient context shows identity, flags and actual ward/bed. Runtime server views and permissions gate reads, new entries, interval changes and records-only corrections.

The chronological grid contains all eight nullable measurements and optional notes, observed/recorded time and the actual author. Zero pain remains zero. Nursing notes display the frozen author stamp including PNC registration. Corrections append separately with a reason and original observation time by default; originals remain struck through. There is no edit/delete of a committed entry. The hospital timezone converts explicitly entered observation times; new entries can use server time.

Interval changes accept15–1440whole minutes. The backend PUT has no expected_version or idempotent replay contract: compare the freshly read schedule before sending, then reconcile an unknown answer by GET. This reduces stale overwrites but cannot provide an atomic version check. Appends retain exact actor/key/body for explicit original-key retry. No automatic write retries or invented local success. Field errors preserve typed values. State/correction refusals reread the admission/flowsheet by code.

The operation selector reads only the selected stay's server worklist, including historical/completed operations, then checks patient/admission identity in the surgical record. Rendering includes monitoring/interval, medications, wound, drains/catheters, positioning, nutrition, fluids, referrals, transfusion instructions, author and operative-note corrections. Draft instructions are marked unsigned. No operation or no operative note is an explicit empty state. A real vitals.due/reconnect refreshes without polling and invalidates a frozen review while retaining input.

Contextual F1, screen help, Ward Nursing journey, detailed task FAQs, English/draft Urdu and shared native100–250% zoom are included. The workspace help now includes its authored ward screen FAQs; it previously showed only the control instructions. No Review code or human signature was entered.

## Fresh DEV evidence

Only own synthetic fixtures and demo accounts were used. No real care, patient, medicine, exposure or billable operation. `vitals62/scenario-result.json`: runcf0456, patient15/MRN-2026-000015, ticket14, admission16. Own ward14, bed46. `second-scenario.json`: run68ef3f, patient16/MRN-2026-000016, ticket15, admission17, own bed47. Each setup request was validated and journalled before submission. These identifiers expire on a future DEV reinstall.

| Endpoint | Actual verification |
|---|---|
| GET /admissions/{admission_id}/flowsheet | Nurse UI empty/populated history, schedule and due state; Doctor API200; Accountant403 |
| POST .../flowsheet/vitals | Actual Nurse UI201 entry4; real reply deliberately lost, same-key replay returns4 once; all8values including pain0; pending17 refusal409 ADMISSION_STATE_INVALID |
| POST .../flowsheet/vitals/{entry_id}/correction | Actual Nurse UI201 entry5, reason and original observed timestamp, original struck; same-key replay; cross-stay422 FLOWSHEET_CORRECTION_INVALID |
| POST .../flowsheet/nursing-notes | Actual Nurse UI201 note3; stamp verified against GET; same-key replay; actual10001-character422 VALIDATION_ERROR with inline aria-invalid and input retained |
| POST .../flowsheet/nursing-notes/{note_id}/correction | Actual Nurse UI201 note4, retained/struck original and frozenPNC stamp; same-key replay; cross-stay422 FLOWSHEET_CORRECTION_INVALID |
| PUT .../flowsheet/vitals-schedule | Actual Nurse UI200 interval60 with lost reply; GET-only reconcile, no duplicate PUT; captured240restored. Independent second stay15min worker test also restored240 |
| GET /ot/clinical-worklist?admission_id=... | Actual Nurse UI200 ownstay operations and empty otherstay; Doctor API200; Accountant403 |
| GET /ot/bookings/{booking_id}/surgical-record | Actual Nurse UI200 own synthetic booking1 and explicit absent operative note; Doctor200; Accountant403 |
| vitals.due | Real Nurse event314 at2026-10-29T17:07:59.415115Z for admission17, not injected/replayed; caused flowsheet GET and server Overdue display |

All five actual write payloads pass validate_request; Accountant is denied all five. Four POST types replay with identical actual keys/bodies and return the same IDs. Negative tests create no entries. Records-only/active-state/schedule-permission guards, range boundaries, null/zero distinctions and schedule snapshot changes have meaningful policy tests. No server-wide service transition was performed on shared DEV.

Evidence: `vitals62/ui-evidence.json`, `write-validations.json`, `permission-denials.json`, `read-denials.json`, `idempotent-replays.json`, `refusals-*.json`, `final-read-evidence.json`; test scripts `scripts/vitals62-{check,event-check,read-check,final-read}.mjs`. Tests refuse rerunning a write journal without reconciliation. Earlier read-only harness attempts had incorrect workspace/selector assumptions; corrected reads passed. Test profiles/preferences were restored and signed out, and monitoring intervals restored. Full journals remain ignored in artifacts.

## Backend issue and limits

**#44 New**: operative-note PUT omits the actual409 OT_BOOKING_STATE_INVALID refusal from get_endpoint.errors. Fresh Requested booking1 received this sensible refusal (requestbd661437707745beb1532fef193e03ec); saved payload/receipt and exact request/response are in vitals62. No guessed start, fabricated operative plan or bypass was introduced. Existing reports41–43 remain New; #43 concerns Doctor event audience, while the actual Nurse event succeeded here.

Postoperative rendering is implemented, but the signed/completed operative plan, surgical correction and signature-driven interval journey is **not verified** on this fresh fixture. Shared service-view transitions, complete lifecycle/refusal matrix, native Urdu/editor review and named human fresh-data acceptance remain pending. Do not claim the whole screen/workspace acceptance gate or q:tested. Successful PACS linking remains the unrelated DEV limitation54.

## Human checks

On a newly app-created admission, use Ward Nursing/My beds, verify patient identity and record synthetic measurements/note. Correct both with reasons and confirm original history, author stamps and times. Test F1 from a field and confirmation, review/back/refresh without lost input, English/Urdu, both themes and native zoom bounds/reset. Follow an actual synthetic completed operation into its signed postoperative plan and confirm its monitoring interval; this is the remaining upstream integration check. Review source/evidence on DEV /docs → My progress; only the human signs the review.
