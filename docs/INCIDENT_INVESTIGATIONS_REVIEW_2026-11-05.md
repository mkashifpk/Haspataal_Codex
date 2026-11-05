# Screen163: Incidents I investigate

Implemented against backend7429acf and contract15b9937042045e7a0cde. This is tested partial delivery, pending the human workspace, native Urdu/editor and device reviews.

The assigned investigator can read the exact original report, save an incomplete analysis, sign the saved analysis as final, assign corrective/preventive actions to a named login with an optional active department, and read/print/save the official PDF. There is no original-report edit, deletion or incident closure. The server's `can_analyse` and `can_add_action` flags govern writes alongside actual permissions and runtime views.

`GET /incidents?mine=true&status=UnderReview` also returns reports raised by the caller. Both menu and worklist therefore retain only rows whose `investigator_user_id` is the authenticated user. The menu appears on an assignment; a reporter without an assignment cannot see another investigator's work. Overdue flags use the server value; calendar due dates remain dates without an invented clock time.

Changed files: `src/screens/MyInvestigations.tsx`, `src/generated/my_investigations.ts`, `src/App.tsx`, `src/directory-access.json`, `electron/main.cjs`, bilingual help/catalogue/task map and handbook images, stylesheet and coverage inventory. Composite directory controls now inherit the visible Field label as their accessible name through `FieldLabelContext`; direct native controls keep their existing labels.

## Fresh DEV verification

- Synthetic incident1, `INC-2026-00001`, was created and assigned through sandbox_call, with a clearly labelled synthetic sentinel override and no actual person, injury or equipment failure. Nurse investigator opened it in the app.
- Initial incomplete sign refused409 `INCIDENT_ANALYSIS_INCOMPLETE`. A draft using Review/Individual alone remained unsignable as a sentinel analysis. The final RootCauseAnalysis with Training and actual synthetic chronology/causes/lessons saved and signed successfully. Its author stamp is displayed; final edit is disabled. Subsequent API save/sign attempts refused409 `INCIDENT_STATE_INVALID`.
- A real committed draft PUT reply was deliberately dropped. The app held its input/context and offered reread/reconciliation, with no replay button. The server's advanced version was compared with the retained draft. A separate stale expected_version request refused409 `VERSION_CONFLICT`.
- A fresh action was recorded through the app with a staff lookup's actual `user_id`, active department and due date. Its committed reply was dropped and the original frozen key/body explicitly retried. Both replies were201, the second marked replay, with exactly one action in the incident.
- Official PDF preview opened, Save produced a `%PDF-` file, and Save cancellation remained visible. No business operation repeated for printing.
- Synthetic incident2, `INC-2026-00002`, is assigned to Quality. Its authorised people directory showed actual names; the nurse path uses named staff lookup with nonnull login instead. An external sandbox action caused an event refresh while the Quality investigator's unsaved chronology remained unchanged. No polling or UI write was used in that manager test. A nurse who reported this incident but was not its investigator had no investigation menu.
- An unrelated Cashier's detail/save requests and the nurse's restricted people directory request refused403; inspector list refused403. No role-name bypass was added.
- Contextual F1/focus, current English/Urdu screenshots, both themes and250% bounds passed. Final read verifies accessible owner/department names and exact calendar date. All test profiles restored their preferences and signed out.

Exact fresh intents, responses, request IDs and portable UI evidence are in `docs/screen163-2026-11-05/`. UI journey is `ui-journey-evidence.json`; manager/unassigned and final-read evidence are separate. A later sandbox event snapshot returned no historical packets; the external-write/UI-refresh test is the event evidence.

## Checks and limits

`npm.cmd run build`, handbook coverage (162screens,4346controls,3240groups), TypeScript and Vite passed. `npm.cmd test` passed863/863. `npm.cmd run build:release` passed the DEV review-code/header exclusion verifier; the DEV build was restored. Large bundle warning remains. No installer signed or deployed.

Overdue rendering is implemented from the real server flag but a fresh record cannot be assigned a past due date (the backend correctly refused422). No claim is made for a fresh overdue fixture, every historical test-plan case, independent notification-only refresh, human acceptance, or complete workspace delivery.

## Check by hand

1. As demo.quality, open the remaining synthetic incident2 from Incidents I investigate; inspect its named investigator and synthetic external action. Use a newly created incident for your own signed fresh-data journey.
2. Save partial facts, check a system factor, compare a concurrent edit, then review the saved analysis before final business signing. A signature is final and separate from the portal's human acceptance review.
3. Choose a named owner with login and active department, check due date and follow the action in its authorised downstream register. IT supplies missing login/departments; HR supplies missing staff.
4. Verify F1 from fields/dialogs, native Urdu wording, keyboard/Settings100–250%zoom, official PDF and physical printing. Start/sign only your own human workspace review on the DEV portal; no agent has entered a review code.
