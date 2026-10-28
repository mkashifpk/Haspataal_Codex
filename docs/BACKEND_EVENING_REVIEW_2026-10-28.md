# Backend a1f559f refresh — 28 October 2026

Baseline `558a013` was clean and matched the pause checkpoint. DEV build `2026-10-28T15:16:59.584003+00:00` includes reports **35–39**, each Fixed with that same `fixed_in`. Account/implementation1, accepted claims185–187 and existing reviews were retained. No older business records, keys or event cursors were replayed. The fresh run is `EVENING-1793203892043`; coincidentally recurring numeric IDs are taken from NEW responses only.

## Contracts and changes

- **35:** misleading recorded link-study request corrected upstream. Current app sends only `{}` for automatic accession lookup or a validated actual `orthanc_study_id`; no `study_instance_uid`. Historical evidence is retained as history, not a current fixture. Successful PACS linking remains untestable on this DEV server (decision54).
- **36:** repeat refusals and request validation are in endpoint errors. Pending admission state refusals reread the exact admission, preserve choices/reason and do not retry. Only AdmissionPending offers Waitlist. A ward validation refusal refreshes the matrix too.
- **37:** bed errors are listed. Out of service is offered only for Available/Dirty/Cleaning, return only for OutOfService; local reason3–300 and actual422 field messages. State refusals reread without clearing the reason or retrying.
- **38 / decision55:** closed wards leave the matrix with their beds. Removed the former missing-ward badge/fallback; no invented ward rows. One defensive matrix reread retains both request references if an inconsistency persists; no such inconsistency occurred to report. An event for an absent bed triggers a complete reread. Desk forms use matrix wards; consultation now has an optional open-ward picker with a fresh preflight. IT Settings→Hardware lists all wards via GET/admin/wards, fills edits from real data, sends every WardIn field, guards occupied/waitlisted closing and offers Reopen. WARD_IN_USE displays bed labels/count and rereads unchanged server data.
- **39:** Admissions is our only built consent signing screen; other consent aliases were read but are not built. Replaced the former global decision-maker list/both-priority presentation with each consent's `who_decides`: ordered descriptions, no Patient option when prohibited, no terminal age rule, PMDC second-doctor picker when required. CONSENT_SIGNER_INVALID preserves the form. Consultation reads consent summaries but does not sign.

`backend-evening-type-audit-2026-10-28.json` compares TypeScript ASTs to558a013: exactly ConsentOut.who_decides + WhoDecidesOut/DecisionMakerChoiceOut, WardListItemOut/listWards, WARD_IN_USE. No additional structural type change; bed/pending ASTs unchanged. Remaining endpoint edits are descriptions/errors.

The complete per-screen write/error comparison is **[BACKEND_EVENING_WRITE_AUDIT_2026-10-28.md](BACKEND_EVENING_WRITE_AUDIT_2026-10-28.md)**. All130 recovery operations plus consent/wristband creation were reread. Shared recovery uses codes and exact reads, never message text; shared field errors use nonserializing `data-field` aliases and retain FormData behavior. Actual current422 is tested beside its control with ARIA association and retained input. Authentication renews once but replays the refused operation only for explicit retryable=true; expired-token live injection was not performed.

Model validation covered **131 actual built request shapes**:92 captured production shapes,20 isolated actual AdminForm/controller submissions,17 production builder/helper outputs and2 creation requests. All pass `validate_request`. Isolated means real app code with synthetic inputs and zero HTTP writes, not a server-success mock. The generic ICD multipart-import SDK entry is unbuilt and excluded. Actual discoveries fixed: three no-body admin actions no longer send `{}` (reset password, revoke sessions, rotate station key); native preferences strip response-only updated_at. A historical MCP roster fixture's assignment_kind was not in current app code; current app duty_area payload validates. Model fixture mistakes (lab metrics array/invalid incident enum) were corrected as fixture mistakes, not backend defects.

## Fresh DEV evidence — requested10a–d

Every sandbox intent/result is under `evening-retest/`, with actual request references and fresh keys. No real patient, medicine, care, signature or money was used. Paid visit scenarios are synthetic DEV scenarios.

| Case | Observed result |
|---|---|
|10a|demo.it created own ward6 `DEV793203892797`, beds35/36. GET/admin/wards:2beds, empty in-use list,0waiting.|
|10b|Patient1/ticket1/admission1: Waitlist200; repeat409 ADMISSION_STATE_INVALID; reserve35; close409 WARD_IN_USE with label/0waiting; ward unchanged. Repeat allocation and overflow409 ADMISSION_STATE_INVALID; reserved-bed OOS409 BED_STATE_INVALID; other-bed reason x422 VALIDATION_ERROR with fields. Cancel admission1, close ward200; matrix contains neither ward nor its beds, invariant holds.|
|10c|Patient2/ticket2/admission2 requested closed ward: allocate409 BED_NO_LONGER_AVAILABLE/in_service=false; waitlist422 VALIDATION_ERROR/field ward_id. Reopen200; allocation200; admission2 cancelled.|
|10d|Adult consent1: patient_may_sign true/Guardian first. Synthetic child age10 patient3/admission3: false/Parent first/noSpouse. Patient sign422 CONSENT_SIGNER_INVALID (`b7d56e98aa844d89b0ce0580123201dc`); Parent sign200 (`a53f8ea48a124a08912bf1130700f56f`). Actual fresh consent.updated event observed with a cursor begun in this run.|

Additional **60 safe negative DEV HTTP probes** all returned422 VALIDATION_ERROR (`backend-evening-http-validation-2026-10-28.json`). They used invalid integer paths and/or an invalid top-level body, so could not produce business actions. These are validation evidence, not full clinical workflow or permissions-plan passes.

## App verification and honest limits

Final renderer `index-B7-lLeoH.js`: mandatory build PASS; **208/208 unit tests PASS**; live32request check PASS; Electron smoke PASS. Logs `artifacts/evening-final-{build,tests,live,smoke}.log`. Shared field component PASS on actual422, zero backend calls. Final foundation regression PASS (`artifacts/evening-foundation-complete-check.log`), with the empty approval case explicitly unexecuted. The earlier foundation runs are separately recorded because old harness assumed a seeded pending approval and English saved preferences: fresh empty queue/retained Urdu are legitimate. Harness now waits for renderer login, normalizes/restores actual preferences and records the unexecuted approval case rather than inventing a pending request.

Actual Electron journeys:

- IT: real ward list/filled full edit, occupied close guard, own empty ward7 Close200/Reopen200, exact7-field bodies and F1.
- Bed matrix: original-key lost-reply recovery, second-terminal change, reason retention, stale review refusal, state restoration. An initial runner failed its final read-loss assertion because a real event refresh succeeded; business checks had passed. Separate sustained-read-loss continuation passed, no repeated business writes. Reopened previously absent bed37 event caused full matrix reread, then restored Available.
- Pending: actual waitlist/reserve admission4 passed. Harness then used the wrong cancellation label before any cancel; separate continuation submitted one cancellation200, lost reply, exact reread/rebase kept reason and offered no retry. Admission4 is Cancelled.
- Consent: actual adult/child who_decides choices/order/descriptions, no global policy GET, Patient absence, required second-doctor validation, F1. Fresh actual print payloads replace old active fixtures; print regression passes. Fresh EN/Urdu media, both themes250 and no business writes.
- Consultation: actual open-ward picker/admission body201. A failed test hook could not override contextBridge and the original harness expectation failed; this created exactly one owned admission5, which was read then cancelled, not replayed. Subsequent real two-terminal closure race passed: reason retained, picker refreshed and **no admission POST**.

All54 built screen plans were reread (`backend-evening-screen-plans-2026-10-28.json`). The changed-state journeys above plus shared validation regressions were executed on DEV. **Full plans across all54 screens have NOT passed**: all-role/clinical variants, global IT maintenance/logout/credential changes, service transitions, full busy-hour journeys and hardware require further controlled/human testing. No q:tested/full-workspace claim is made. No Review code entered, human worksheet completed or review signed by the agent. Native clinical Urdu, translations/editor, physical A4/scanner/operator acceptance remain pending.

New report **40 New**, documentation: Consultation bundle omits GET/beds/matrix despite needing an open-ward admission choice. Actual Doctor GET200 `b06bec4473274af3884a8e52eff17e4a`; actual admission201 `fbfe16103ac940c194d4ebf1fb7bdd1f`, reread200 and cancelled200. Exact payload/receipt `evening-consultation-ward-lookup-issue-*.json`. No reservation backend bug was inferred.

## Retained synthetic state / manual checks

Admissions1/2/4/5 are Cancelled. Child3 remains **Admitted**, bed35Occupied, invoice3Draft0, consent2Given. Do not fabricate discharge, cleaning or care merely to remove fixtures. Ward6Open/bed36Available. Empty ward7Closed/bed37Available off matrix after closure-race test. No uncertain business writes.

Check by hand with NEW app-created synthetic records: IT edit/close/reopen an empty ward; confirm occupied/reserved/waitlisted guard and labels; desk allocation/waitlist after a second terminal closes a ward; bed service-state reason/refusal retention; adult/child/incapable consent choices from hospital policy and actual PMDC emergency second doctor; F1/English/Urdu/zoom, paper/scanner flows. Use your own portal Review code and sign the workspace review yourself. Successful PACS link remains a limitation.

Next checkpoint screen is cost_estimates_admissions55 after refreshed roadmap. No completion of that screen is implied here.
