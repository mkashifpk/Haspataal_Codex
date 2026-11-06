# Screen164: Complaints I investigate

The named investigator opens this during a shift to establish facts, record actual contacts before the promised answer date and assign accountable improvements. The complaints officer conveys the outcome. This is a shared screen, not a role-named dashboard.

## Implementation

MyComplaintInvestigations uses the complete fresh bundle/generated client, own acknowledged assignments, explicit investigator filtering (mine also includes received complaints), answer-date ordering and server overdue flags. It displays the original account, available identity/location/contact, the contact person/investigator, deadlines, findings/author/time, contact timeline, actions and next step. Missing values remain absent. Loading/failed reads do not become empty lists; stale action data is hidden.

Findings, Progress/Extension/Other contacts and actions are separate idempotent requests. The shared write hook now supports an explicit server record/capability authority: a fresh authorised detail read checks the exact can_* flag before a NEW request; an original retry preserves its frozen body/key and lets the backend authorise/replay it. Existing fixed-permission callers remain unchanged. Actor/scope/navigation/pending guards remain. No role or permission is invented.

Staff owners use current name search and returned nonnull user_id, not employee_id; departments use active entries. Optional newly discovered incidents reuse the existing incident form, its own F1 context and its original-key recovery, then carry only the confirmed record back to findings. Existing links are retained. A confirmed report is not undone by cancelling an unsent findings draft. No typed record-number field or extra list lookup was introduced.

F1, bilingual screen/workspace guidance, six role-task FAQs,22control guides,7task mappings and actual synthetic screenshots ship together. Shared zoom/theme/access patterns are reused. The translation/editor/human gate is pending.

## Fresh DEV evidence

- Complaint1: received by demo.reception, acknowledged by demo.quality and assigned to Nurse Hina (user18, employee17, read from the live staff lookup). The nurse's list/detail200 worked; unassigned Doctor detail/findings403 and reporter-only Reception menu denial passed.
- Real UI Progress200 committed reply deliberately lost, exact original-key/body replay200, one contact. Invalid extension422 beside the visible error; corrected distinct Extension200 sets20-Nov-2026, with actual author/means/time. No real person was contacted; notes explicitly mark the simulation.
- Separate UI synthetic near-miss incident3:201 reply lost, original report retry returns the same record; modal/navigation stayed locked. Use this confirmed incident linked its actual returned ID. Findings200 lost reply/original replay and action201 lost reply/original replay each had one effect. Named owner user18 differed from employee17; active department was directory-selected. No duplicate incident, complaint or action was created by retries.
- Actual complaint.updated/notification.created refreshed external contacts/actions while preserving an unsent contact draft. The first event check found a frontend defect: child insertions did not change the parent row_version, so the review checkbox stayed checked. Review now resets on a freshly read detail, and a distinct iteration2 event case passed (events223/224/225). It was not reported as a backend defect or represented as a passing first run.
- Final read on the tested source passed confirmed fields, F1/focus, native Electron Ctrl+=/Ctrl-/Ctrl0 lower/upper bounds/reset, shared preference state, English/Urdu and both themes at250% without page overflow. All UI profiles restored preferences and signed out.
- Missing incident reference negative422REFERENCE_NOT_FOUND and invalid-list422 passed with no effect. Complete artifacts and request IDs are in the adjacent164-*, staff-*, backend-issue-* and UI journals.

## Backend56 and limits

Workflow complaints §3 promises any staff member named as investigator. Fresh complaint2 was assigned to Ops user27: detail200 with all three can_* flags but own mine/Acknowledged list403. Report56 is New; its exact request IDs/payload/receipt are saved. The frontend follows the declared list permissions and does not add a role, invent an ID or bypass authorisation. That broader-role path and the whole assignment-list rule are not proposed as complete.

The1000-row limit and overdue display are implemented; thousands of synthetic records and a real overdue clock transition were not induced. Every error/state combination and full historical complaint lifecycle are not claimed. Human fresh-data role journeys, native Urdu/editor and physical-device acceptance remain pending. No human Review code, worksheet or acceptance signature was entered.

The accepted changes from prior screens are not re-proposed. Screen164 proposes only actually exercised new endpoints/events, findings/contact rules and supported UI checks. The new incident callback reuses existing approved reporting behavior, not a second reporting claim.
