# Critical results to tell — Phase3 position39

Implemented one Lab Technician screen, from the current Haspataal MCP bundle and endpoint contracts. Full screen/workspace/human acceptance remains pending; no portal Review code or human signature was supplied by an agent.

## Delivered

`CriticalResultsBench.tsx` shows the actual Lab critical log, default open_only=true (not yet acknowledged), server status/date/mine/limit filters, bounded-results explanation and local returned-record search. The urgent worklist includes only CriticalToCommunicate and PriorityDiseaseToNotify for Lab. Known/returned IDs open the current exact result with patient/MRN, finding, responsible doctor, ward/bed, release/due times, overdue text/red treatment, escalation, health-authority duty, actual communication history and separate doctor acknowledgement/action. Server states remain authoritative; no local deadline or balance is calculated.

Communications support Telephone, InPerson, Written and Electronic and all specified recipient roles, actual name/designation, optional bounded note, explicit already-completed communication and telephone/in-person read-back. Changing recipient/method clears stale assertions. A reviewed write freezes exact patient/result/body, rechecks actor/service/permission/version/history and sends one original UUID. Lost responses retain the original body/key for explicit replay within24hours or actual detail reconciliation; double clicks, navigation and Escape cannot replace an unresolved write. History cannot be edited/deleted. Saving does not make a call, notify an outside authority or acknowledge as a doctor.

The optional recipient_user_id is omitted; the required actual recipient name/designation is supported. No login ID is guessed from an employee ID or display name. The shared staff badge lookup has no login ID and is not used as an invented link.

Real critical_result.updated and reconnect refresh log/worklist/detail. A Lab Opened event on this screen requests a native system alarm only after re-reading the exact current Open Lab record, authenticated user, workspace and service. Handled/mismatched/denied records cannot sound it. The reminder is local; communication/acknowledgement is separate. Explicit Play alarm is available for an Open result. Sound-device audibility still needs human testing; no chosen custom clinical tone/timer or automatic external notification was invented.

App routing respects the current scoped handbook, permissions and runtime service views. Full/open_work supports permitted existing communication; Records reads history without worklist/new communication; hidden/setup/unknown stays unavailable. Contextual F1, bilingual page/control/task/LabTech guide, shared zoom and responsive list/detail layout accompany the screen.

## Verification actually performed

- npm test131/131PASS, including six new critical policy/alarm identity tests and negative help-confirmation/action coverage.
- Mandatory npm run buildPASS: handbook coverage39screens/760controls/277groups, TypeScript and DEV bundle. Native main syntax and git diff check pass. Existing bundle-size warning remains.
- Actual DEV run `DEMO-CRITICAL-BENCH-1793027205041`: own synthetic patient5/ticket5 verified before reuse, new requisition4/invoice23 virtualCard, RBSresult7 numeric critical and NS1result8 text-positive Published by an independent verifier. Critical1/2 created by the server; no guessed IDs.
- Actual Opened events reached the screen, populated Lab log/worklist and dispatched the native alarm twice. The test instruments shell.beep to count dispatch; human audibility is not claimed.
- Missing telephone read-back refused locally before POST and by the real server with CRITICAL_RESULT_READ_BACK_REQUIRED422. Reviewed communication lost201/double-click replay used the same UUID/body and produced exactly one history entry.
- A separate real concurrent communication invalidated a frozen review before another POST. HealthAuthority/Electronic and responsible-doctor/InPerson read-back were recorded separately for the priority disease; authority_pending became false. Written was exercised through an independently authenticated fixture, with no read-back requirement.
- Separate responsible physician acknowledgement with expected_version arrived live. Both criticals now Acknowledged; an acknowledged record could not sound the alarm. Bounded/no-match/history filters and failed-read stale hiding/retry passed. Actual socket reconnect reread all three read paths.
- Actual F1 field/dialog focus/draft checks, English/Urdu media, both themes250% overflow and native zoom upper/lower/reset passed. Final read-only continuation reuses these terminal records with zero business writes, confirms recipient-change assertion reset and recaptures final layout.

Core business/realtime run used `index-DVrH851g.js`. Final layout/notice changes were checked read-only on `index-BpkT08XR.js`; final recipient-reset refinement is in `index-unKuxXUS.js`. Exact journal remains ignored in artifacts/critical-bench-check.json; do not rerun completed writes. All isolated profiles restore preferences and sign out. No real specimen, clinical care, call, external authority notification, money or physical print occurred. Synthetic communication/acknowledgement notes explicitly identify the software simulation.

## Limits and backend status

No new backend defect was reproduced by this screen. Existing reports27/28/29 remain New, no response. No shared service lifecycle mutation, deliberate overdue wait/escalation, production audio/device verification, busiest-hour measurement or human fresh-data/Urdu/FAQ/editor acceptance is claimed. The full test-plan and compulsory human-review items remain pending. This implementation is not Phase3 completion.

## Manual check

1. As a lab technician, open Critical results to tell with a fresh synthetic result released by an independent verifier. Check the exact patient/MRN/finding, responsible clinician, server deadline and alarm on this terminal.
2. Tell the intended person through the hospital procedure. For telephone/in-person, obtain actual read-back; record their name/designation, method and factual note. Confirm once and check history. Never use a real patient for a software test.
3. For a priority disease, notify the designated health authority separately through the hospital procedure, record that communication, and check the returned authority state. Physician acknowledgement remains a separate authorised task.
4. Check F1 in the recipient and confirmation controls, Urdu, both themes and100–250%zoom. Follow the role guide without chat instructions. Review the pending proposal only for what you actually test; only the human enters a Review code and signs the portal review.
