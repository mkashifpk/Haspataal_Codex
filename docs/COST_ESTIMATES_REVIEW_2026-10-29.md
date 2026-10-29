# Cost estimates (Phase4, screen55) and issue40 continuation

Continued from `d734c77`, which committed the a1f559f refresh. Proposals188–192 remain pending, independently verified on29Oct; no signed human review returned. The new server build `2026-10-28T21:29:45.848402+00:00` includes **40Fixed**; contract e90ba541e495d6487532/knowledge e9e3dbb61b873e01/rubric6b013592c628. what_changed: no cost-estimate change; AdmissionIn description and Consultation's new matrix endpoint/rule. Existing35–39 results and write table remain in BACKEND_EVENING_REVIEW_2026-10-28.md and BACKEND_EVENING_WRITE_AUDIT_2026-10-28.md.

## Implemented

Admissions→Cost estimates has a worklist first, overdue indication, bounded searchable/filterable register, exact known-reference reads and patient/admission context. Prepare for an existing admission: actual tariff ward/day charge, service picker/quantity with no typed unit price, allowances, server-default deposit/terms or explicit values, notes and frozen review. Server-returned total/deposit/billed_so_far appear together. Explanation records recipient/relationship/language/actual paper acknowledgement. Draft and incorrect Explained records can be cancelled with a reason; history/stamps remain. No delete or edit-final action. Revision prepares a new record.

Actual tariff, transfer list, current actor/view/admission/record preflight, preserved drafts, original-key single-flight writes and visible code-based errors. Unknown preparation cannot be released merely because a matching list entry exists; explicit original-key replay or IT reconciliation is required. ESTIMATE_STATE_INVALID rereads exact estimate; ADMISSION_STATE_INVALID rereads admission; VALIDATION_ERROR uses shared field association. Events/reconnect refresh and invalidate stale reviews. Runtime server views/permissions, no facility-category branching or offline business queue.

Native estimate printing fetches the original record+payload, verifies version/patient and session/view/permission, fetches currency from tariff, then renders A4 with server English/Urdu notes and escaped text. PDF saving and original English server PDF are separate read actions. Signature lines remain grouped; identity is present on every page. Final actual Draft render: English1page, Urdu2pages; all pages inspected, no orphan date/signature or clipped data. Native Urdu clinical/label approval and physical paper remain human gates.

Authored bilingual screen, control and Admissions-role FAQs/task mappings, actual ENUR media; shared F1/focus and zoom state. Before-admission patient-only preparation is not offered in this version. Deposit is computed/prefilled by the server in the prepared record; unsent blank means hospital default, not a client-calculated amount. Transfer/rate-change, supersession, full service-transition and all-role journeys are not claimed complete.

## Real synthetic DEV tests

Owned current run EVENING-1793203892043 admission3/patient3 only; no actual care, medicine, signature or money. Estimates1–4 are now Cancelled, verified again on29Oct. Main UI journal and preserved failed runs: docs/continuation29/ui-evidence.json; original ignored artifacts remain available.

- Preparation1:201 deliberately lost, explicit same-key replay201 **same estimate1**; explanation200. Preparation2:201 then cancellation200. Actual allowance123, server deposit62, billed0. No duplicate effect.
- Preparation3 and4: tariff bed-days2×2500 plus service2×1500 =8000, server deposit4000, billed0. Second terminal cancelled3 while explanation review was open; fresh preflight showed Cancelled, retained recipient and sent no explanationPOST. Estimate4 native English/Urdu PDFs and original server PDF saved; cancelled native save reports no file. Explained4 then cancelled through UI, recipient/stamp/history retained.
- Repeated explanation409 ESTIMATE_STATE_INVALID, repeated cancellation409; accountant list403 and cashier prepare403. The initial expectation that an Explained record could not be cancelled was wrong: get_endpoint explicitly permits cancellation with reason, and state machine confirms Explained→Cancelled. UI/help were corrected; no backend bug reported. Historical journal label107 says refused but actual200 is retained honestly.
- First estimate runner failed before business writes because an auxiliary contract snapshot incorrectly used the runtime `endpoints` key. It now uses `operations`; runtime route regression tests pass. Earlier help checks failed because new quoted help keys and screen count needed correct authoring; actual check remains enforced. No test was silenced.
- Final212/212 tests PASS, mandatory build PASS (`index-CO0peyYW.js`,55screens1168controls465groups), live32requests PASS. Final formatting/render-only updates included. Logs artifacts/continuation29-delivery-tests.log, continuation29-final-build.log and continuation29-live.log. Existing bundle-size warning only.
- 11 actual captured request bodies (estimate preparation variants/explanation/cancel and doctor's admission/cancel) all validate_request valid: docs/continuation29/request-validations.json. An initial standalone MCP example used source_ticket_id incorrectly; this was not app code. Correct app body uses ticket_id, and both actual UI admission payloads validate. That malformed fixture caused no admission.

## Issue40: new refusal on current server

Consultation now shows optional ward name, actual available count and gender_restriction, including zero-available wards. On VALIDATION_ERROR identifying requested_ward_id, reread matrix and retain all typed input. Current bundle/types/endpoint requirements reread; no admin-ward lookup or manual ID field.

Fresh scenario527d44 created patient5/ticket4; own empty ward8 DEV40-1793242834253. Raw closed-ward request422 dcb5a4f5026f482096e34c8a16421e72. Actual UI test held a **real** open-matrix response while another terminal closed ward8, then allowed the real POST to reach the server:422 VALIDATION_ERROR/requested_ward_id; matrix reread removed ward, reason stayed beside field error. Explicit none then201 admission6; own pending6 cancelled200. Ward8 remains Closed; no arrival/care. No old business key replay. Exact requests/keys/references in continuation29/ui-evidence.json and sandbox intent/results.

First29Oct IT startup failed with real connection timeout before any business intent; actor restored preferences/signed out. Passing continuation used a new isolated actor; all final actors restored preferences and signed out. No backend defect inferred from a transient transport failure. No uncertain writes remain.

## Manual acceptance / limits

No q:tested/full screen/workspace or signed human acceptance claim. Full plans were read, not every clinical/permission/service case executed. Human review must use NEW app-created synthetic records and its own Review code; agents never enter one or sign a review. Check: tariff ward/services/allowances, explanation and both cancellation states; real ward-transfer estimate and supersession; F1 from fields/review, ENUR/RTL/zoom, physical A4/scanner and printer loss. Native Urdu/editor and busy-hour/all-role gates remain pending. Successful PACS linking is still DEV limitation54.

Next catalogue screen after55 has not been started; refresh roadmap before selecting it. Retain child3Admitted/bed35Occupied and zero bill; never invent discharge or cleaning to remove a software fixture.
