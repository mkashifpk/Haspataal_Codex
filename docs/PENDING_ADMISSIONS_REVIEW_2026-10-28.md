# Pending Admissions & Allocation — Phase4 screen51

Built from clean3445cab against server2026-10-27T21:34:51.340676+00:00, contract58db76bf7d59ef6d9870/rubric378ea8e0f42b. Source src/screens/PendingAdmissions.tsx, admissions-policy.ts; generated13calls; shared optional-upload opt-in; bilingual screen/control/workspace help, four error FAQs and actual EN/UR media. Server views/permissions decide access, no facility category branching.

The admissions officer turns the doctor’s request into a verified bed and arrival, then hands the settled final bill to the next discharge stage. Care never waits for an optional photo. Separate uploads/keys remain mounted through action dialogs/reloads. State refusals read exact original admission or discharge status; retain typed fields, no automatic replay.

## Observed test-plan coverage

| Endpoint | Observed result | Pending branches |
|---|---|---|
| POST /patients/{patient_id}/documents | Photo and outside report201 through UI; independent delayed upload cannot block same-patient reservation; original request retained | Negative media/size, duplicate key and camera hardware not rerun in this screen |
| GET /patients/{patient_id}/documents | Actual stored list and provenance through UI | All denied roles not individually repeated |
| GET /patient-documents/{document_id}/download | Authenticated outside report viewed through UI | Missing file/permission changes pending |
| POST /admissions/{admission_id}/discharge/{stage}/clear | Billing200 on settled0bill; lost-response recovery onePOST; repeat409IMMUTABLE details/time, GETofficer; predecessor409OUT_OF_ORDER | Positive nonzero/Panel settlement and OWN_MEDICINES_HELD not exercised |
| POST /admissions/{admission_id}/final-bill | Actual UI200 invoice7Paid0; CodeReddeferred409 | Nonzero discount/NOT_FOUND and changing finalized discount pending |
| GET /admissions | Fresh actual list, filters and second-terminal cancellation refresh | All read refusal roles not repeated |
| POST /admissions/{admission_id}/allocate-bed | UIreserve200 and separatearrival; BED_NO_LONGER_AVAILABLE409actualDirtybed; repeatedstate409; Cashier403 | UI two-terminal simultaneous bed race/Reference errors pending |
| POST /admissions/{admission_id}/overflow-override | Actual crossward200/reason/doctor unchanged; repeat409state; cancelledownedreserve | Full overflow dialog fresh-data journey human pending |
| POST /admissions/{admission_id}/waitlist | Actual UI200/wardpriority; repeat409state | All permission/refusal branches pending |
| GET /wards/{ward_id}/waitlist | Actual UI ward waitlist | Notification/expiry timing pending |
| POST /admissions/{admission_id}/admit | Actual UI reserve→arrival200/Admitted; no cancel action | Same-key replay/expiredreservation branch pending |
| POST /admissions/{admission_id}/cancel | Actual UI lost committed200 recovered/onePOST/reason retained; reserve freed; admittedstate409; secondterminalcancel event | Full denied-role set pending |
| POST /admissions/{admission_id}/confirm-billing | Fresh known-identity CodeRed UI Cash200; repeat409BILLING_NOT_DEFERRED | Temporary identity merge and active Panel positive pending |

186testsPASS, mandatory buildPASS, help51screens/1013controls/417groups/62FAQseeds/30guidesPASS. live32requestsPASS, Electron smokePASS. Main and billing actual UI journals PASS and preferences restored/logout; final read-only renderer/media review recorded separately. Native Ctrl plus/minus/reset matched Settings100–250, EN/UR and both themes250 root overflow checks pass. Screenshot inspection compacted lookup; full named editor/density/busiest-hour review is still pending.

This is not a claim that every plan branch passed. Do not claim q:tested, human fresh-data, signed Urdu/role review or editor acceptance. The positive Billing stage used actual invoice7Paid0: no payment transaction or physical cash. Physical camera, Panel-positive, temporary trauma merge, service transitions, expiry/notification timing and full offline/reconnect remain manual/pending.

Backend documentation issue36New: repeated waitlist/overflow/allocate return409ADMISSION_STATE_INVALID absent from endpoint errors, despite write_semantics. Request IDs and original payloads are saved in pending-admissions-state-errors-{report,receipt}-2026-10-28.json and live journal. Backend guard is correct; no client workaround. Prior issue35New remains radiology-only.

Owned runDEMO-ADMISSIONS-1793166314108: fresh scenarios3bb438(patient3/ticket3/admission2), c74cf6(patient4/ticket4/admission3), e1e608(patient5/ticket5/admission4), and fresh event record6(patient6/ticket6). Admissions2/4/6Cancelled; admission3DischargeInProgress/BillingCleared/waitingOpsCleaning, invoice7Paid0; known-patient CodeRedadmission5patient5confirmedCash/CodeRedActive/reservedERbed29. Synthetic summary2/consent2 and photo/outside documents1/2 are retained. No real patient/photo, emergency, exposure, medicine, physical money or cleaning; no uncertain write remains. Never replay fixture keys.

## Human check

Open Admissions Desk → Pending admissions & allocation. Create NEW synthetic upstream requests through the app. Check identity/flags; waitlist, reserve, actual arrival, overflow reason and pending cancellation/bed release; verify refusal/draft recovery from another terminal. Test declined/denied camera and optional files while bed work continues. Review temporary CodeRed identity/Reception handover, Cash/Panel confirmation, final bill/Cashier settlement and Billing already-cleared officer/time. Exercise F1 from fields/dialogs, keyboard/touch/Urdu/themes/zoom. Only the human starts/records/signs the DEV portal review; the agent never enters a Review code. Other Admissions screens remain unbuilt.
