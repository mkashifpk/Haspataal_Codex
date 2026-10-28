# Roll Call — Phase 4 screen 50

The Head Nurse marks staff actually present at a shift start where there is no badge station. Success means server-confirmed attendance for the correct person, original duty date and actual arrival time.

## Delivered

- Server-scoped Head Nurse navigation; real roll-call sheet, today plus running overnight duties, explicit date read, duty-date grouping, ward/shift/name filters and visible hidden-selection count.
- Actual hospital-local arrival required per selected person; valid within the overnight shift, never future. Already-arrived rows display server first_in/source and are disabled. Earlier closed shifts require roster.manage.all; the backend remains authoritative.
- Frozen people/date/time confirmation, acknowledgement, fresh duty-version/arrival/permission/clock checks before submission; permanent records and skipped reasons shown from the answer. No punch edit/delete, fake absence, scanner or print action.
- One original key/body; explicit identical retry within24hours after a lost answer. Read original date is inspection only, cannot unlock replacement attendance. Unknown write/navigation locked; no automatic POST retry or offline queue.
- Debounced roster.changed and actual reconnect resync reread the sheet without erasing unsent selections. Read failures hide stale rows. Compact shared controls, bilingual F1/handbook/control help, expanded Head Nurse role guidance, actual EN/Urdu media and shared native100–250% zoom.

Files: src/screens/RollCall.tsx, src/roll-call-policy.ts, src/generated/roll_call.ts, contracts/roll_call.json and meta support, App/help/catalogue/task-map/i18n/style, policy/help tests and guarded scripts/rollcall-*.mjs.

## Verification and honest limits

Backend build2026-10-27T21:34:51.340676+00:00; contract58db76bf7d59ef6d9870; knowledge51c8fe699d47d046; rubric378ea8e0f42b; implementation1/mkashif. Read current bundle/endpoints/types/validation/events/recipe/screen_test_plan/quality/design/Head Nurse outline before implementation.

- npm test: **178/178 PASS**, artifacts/rollcall-final-tests.log. Includes four meaningful boundary/concurrency policy tests and missing-confirmation-help regression.
- Mandatory npm run build: **PASS**, TypeScript plus handbook coverage50screens/988controls/401groups/50FAQseeds/30workspaceguides. Existing bundle-size warning. Renderer **index-Bh_FNeci.js**.
- Actual main Electron run DEMO-ROLLCALL-1793149517009: overnight row keeps27Oct after midnight28Oct; required late time/F1/focus/hidden selections; independent roster event; original POST201 committed with its real reply discarded; explicit identical-key replay returns SAME attendance ID1; separate intentional duplicate returns skipped, no extra punch. Exact preflight version change refuses before POST.
- Real refusals: ROSTER_DATE_CLOSED, ROLL_CALL_NOT_ROSTERED, ROSTER_OUT_OF_SCOPE, VALIDATION_ERROR; HR actual earlier-shift success attendance2. Separate MCP Cashier GET/POST403 with actual request IDs saved in permission evidence.
- Final renderer followup: actual roster event and terminated/reconnected real socket reread sheet and preserve draft; empty2099date; held failed GET hides rows, actual Try again recovers; native upper250/lower100/reset; both languages/themes250 no root overflow; ZERO Head Nurse business writes. Final media visually inspected.
- Original scripts retain their failures: initial setup attempted HR bed read (correctly denied, zero writes), Playwright normalized datetime seconds, main runner expected Retry instead of Try again after its business checks passed. Final runner expected Roll Call in HR's active workspace; actual server outline places HR's calls inside its separate Attendance screen. Keep runtime workspace scoping; do not add an unauthorized navigation entry. These are runner corrections, not backend product defects or hidden passes.
- During final runner cleanup the HR terminal timed out after cancel32 committed. Exact MCP read confirmed32Cancelled; never repeated its original key. Separate new cancellations33/34 succeeded and exact reread confirms ALL11 owned duties24–34Cancelled. No real staff schedule, patient, cash, clinical care, badge, master data or payroll changed. Two synthetic demo punches remain as audit history; never delete or replay them.
- Fresh bed test also confirms deployed backend34 fix: owned duty31 create with one bed→zone PATCH→replace bed→exact GET→bed_ids[] all succeed (as HR). No frontend workaround needed, no unchanged Duty Roster proposal resubmitted.

No full human review, signed portal worksheet, clinical/Urdu approval, named editor,20-run busiest-hour check or physical badge-station journey is claimed. Actual Badge-source display uses the same first_in guard as live RollCall/HR arrivals and is boundary-tested with all sources; a fresh physical badge test remains a human/integration task. HR Attendance and Operations Support Roster are separate later screens, not delivered by this screen.

## Manual test

1. Sign in as demo.headnurse and open Head Nurse → Roll call. Use a newly created synthetic duty from Nursing duty roster for the shift actually running; HR can prepare a previous-day night duty if necessary. Do not mark real staff present.
2. Check name/employee number, date, shift and ward. Tick Present and enter Actual arrival time in the hospital timezone. Try missing/out-of-shift/future time; nothing should save.
3. Review arrivals, check all selected people (including hidden rows), acknowledge and Confirm arrivals once. Verify the actual attendance number/time and disabled Already arrived row. Refresh and reopen to confirm persistence.
4. After midnight, choose yesterday's original Duty date to record for its running night shift. Today's entries must be a separate confirmation. Closed earlier shifts are read-only for Head Nurse; refer corrections to HR.
5. Test filters, unsaved-selection warning, F1 from a time field and confirmation, English/Urdu and keyboard/Settings zoom100–250%. Ask another authorized terminal to change an unsent duty and verify stale confirmation refuses.
6. Complete and sign the human Head Nurse workspace review on the DEV portal. Only the human enters a Review code; automated runs never enter one.

Next separate Phase4 screen: Pending admissions & allocation (position51). Backend30/31 Radiology UI/type/picker/PACS alignment and33 discharge retest remain a separate fresh-data followup after the reset; do not reuse prior patient/admission/order IDs.
