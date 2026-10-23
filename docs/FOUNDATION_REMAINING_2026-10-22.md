# Foundation acceptance remaining — 22 October 2026

Verified implementation1/Codex:434 accepted points,0/268 complete screens; rubric d81d43f195f8. Proposals29–47 accepted. Proposals48 (IT emergency control) and49 (updated Settings system parts) saved/read-back pending: awaiting human review on /docs -> My progress. Pending proposals earn no points. This replaces the21 October snapshot; unclaimed items may require implementation, verification, evidence or human review, not necessarily a proven defect.

Current build CrDVvVIL; see SETTINGS_IT_CONTINUATION_2026-10-22.md and settings-it-build-2026-10-22.json. Full IT workspace and catalogue remain incomplete. Do not change shared licence/maintenance/service state merely to generate test evidence without coordinating the hospital session.

## Connect to server (first run / server unreachable) (`connect_server`)

- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Login (`login`)

- `ev:system.license` — system.license
- `rule:66a4630670` — License banner: GET /meta/license on this screen (and data.license after login, the system.license event, every 10 min). state grace = persistent banner with message, days_left and the vendor contact on EVERY screen, work continues; state locked = only the Super Admin can log in, others get LICENSE_INVALID at login and token refresh (show message + details.vendor).
- `q:states` — Loading, empty and error states
- `q:writes` — Safe writes
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## App shell (every workspace) (`app_shell`)

- `ev:system.maintenance` — system.maintenance
- `ev:system.license` — system.license
- `rule:0d0aefc3fe` — Load the catalogues once after login and after an upgrade: dropdowns from GET /meta/enums, labels and policy switches from GET /meta/settings; never hard-code status values.
- `rule:08c548437f` — Log out with POST /auth/logout (all_sessions: true ends every session of the user, e.g. a lost laptop).
- `rule:71c59cc220` — system.maintenance: show the message as a full-screen banner; non-admins get MAINTENANCE until it ends.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Settings (avatar or Ctrl+,) (`settings`)

- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Notification bell (`notifications`)

- `ep:POST /notifications/read-all` — POST /notifications/read-all
- `ev:notification.created` — notification.created
- `rule:1edec8d9e4` — Refresh the badge on notification.created and after WebSocket reconnect.
- `rule:699233ff93` — Severity critical → toast that stays until dismissed.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Help: the end-user handbook (`help_center`)

- `rule:164bde45b9` — Build the handbook as the developer guide 'The end-user handbook' (get_guide('end-user-handbook')) says: one page per screen (screens/<screen id>) and one per workspace (workspaces/<code>), written for the hospital's staff (where to click, what happens, what the system refuses and why, what to do on each error message), in English and Urdu (the user's language preference, GET /settings/me), with screenshots of YOUR UI.
- `rule:b676be655f` — Keep it current: the page ids are the screen ids of the catalogue; what_changed in the MCP server lists screens added or changed since the last build, so the pages are revised with the UI.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Approval queue (`approval_queue`)

- `ev:approval.requested` — approval.requested
- `ev:approval.resolved` — approval.resolved
- `q:states` — Loading, empty and error states
- `q:writes` — Safe writes
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Charity approvals (`charity_approvals`)

- `ep:POST /approvals/{request_id}/approve` — POST /approvals/{request_id}/approve
- `ep:POST /approvals/{request_id}/reject` — POST /approvals/{request_id}/reject
- `ev:approval.requested` — approval.requested
- `ev:approval.resolved` — approval.resolved
- `rule:2a188dbe97` — You can never approve your own request (SELF_APPROVAL_FORBIDDEN).
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Report an incident (`report_incident`)

- `rule:efef10e8e1` — A button on every workspace's toolbar. Form: the type (GET /incident-types, grouped by area, sentinel types marked), incident or near miss, harm, when (now by default) and where (department, ward, place), who was affected (a patient: search by MRN; staff: GET /staff/lookup, any reporter may use it), what happened (facts, not blame) and what was done at once; 'Keep my name confidential' (reporter_confidential).
- `rule:02468e1c7f` — Medication errors: the stage and the medicine; theatre events: the operation and the phase (INCIDENT_DETAILS_REQUIRED). Send an Idempotency-Key: a double click must not report twice.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Workspace launcher (`workspace_picker`)

- `ev:session.revoked` — session.revoked
- `ev:establishment.changed` — establishment.changed
- `rule:be337cde67` — One build of the frontend serves every profile (Clinic, II C, II B, II A, I) and every change of it: nothing is downloaded or switched by a flag. Read GET /establishment after login and again on establishment.changed, then list each workspace as views.workspaces says (hidden: not listed; records: marked Records; open_work: with the banner) and each screen as views.screens says; a workspace or screen it does not list is core and always shown (to the users with its permissions). Inside a screen hide an operation of x-capability-gates (or only the choice its `when` names) while its service is not in `active` (the server refuses it anyway: CAPABILITY_INACTIVE). What is shown follows the services, never the profile's category: the category picks the inspection framework, the letterhead and the few rules a screen names (the clinic's complete consultation).
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Facility settings: PHC profile and services (`facility_profile`)

- `ep:POST /establishment/changes` — POST /establishment/changes
- `ev:establishment.changed` — establishment.changed
- `ev:notification.created` — notification.created
- `rule:fb5d58927a` — Facility-wide, not a personal preference: open it from the admin's Settings entry (establishment.manage), never from the avatar's Settings modal.
- `rule:439b25f03d` — A 'Staff and duties' tab: GET /establishment/staffing after every applied change (and on opening). Show NobodyHolds and NeedsSecondPerson in amber with the message and solo_alternative; never offer to weaken a rule. NotApplicable rows are greyed (the service is not running).
- `rule:2186908367` — Top: the profile (label, PHC number, effective date, framework and its indicators) and, from GET /msds/profile, what the beds suggest (`note`) with the wards table (emergency wards are not counted). needs_confirmation true: a banner 'Record the category on your PHC licence'. Never change it by yourself: the licence decides, not the bed count.
- `rule:41ad66d2e2` — Services: one row per capability with its state (Available / Preparing / Active / Retiring / Retired), what it needs (`requires`) and its open work (`outstanding`); a service with `implemented` false (none in this release) gets no button.
- `rule:5f2ff80ae5` — First setup and every later change are one form: the profile (category from GET /establishment/profiles, pre-tick its `preset`; the person decides each service), the number, the licence from the compliance register (GET /facility/compliance-documents?category=Hospital), the date it took effect, the reason.
- `rule:e7d506358d` — Always preview first (POST /establishment/changes/preview) and show it in full: each move in order, its prerequisites (met or missing), the open work of each service being retired, the framework change, the warnings and every `problems` line. Apply is disabled while `allowed` is false.
- `rule:6e415061c3` — Apply (POST /establishment/changes) sends the previewed `revision` as expected_revision and the codes of every acknowledgement the person ticked (each shown as a checkbox with its message). VERSION_CONFLICT: someone else changed it; preview again. CONFIRMATION_REQUIRED: tick what details.acknowledgements lists.
- `rule:6e65a8d8d4` — Retiring a service with open work: say it plainly ('No new admissions from now on; the 3 admitted patients continue to discharge; their records stay'). Retired only when nothing is open.
- `rule:860944dc27` — Becoming a clinic: inpatient care, the emergency department and the theatre cannot stay Active; the preview says so. Going back to a hospital rechecks every prerequisite (an earlier activation proves nothing).
- `rule:fd4552dd74` — History: GET /establishment/changes (who, when, why, before and after, the open work at that moment) and GET /msds/category-confirmations (each recorded category with its date). A reversal is a new change.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed
- `q:role_faq` — Complete role-specific FAQs
- `q:fresh_data` — Human review with newly created data
- `q:character` — Design principles applied
- `q:editor` — Editor's pass

## Next testable steps

Connect has only its four review gates remaining; agent tests cannot fill a missing named-human review. Login next needs licence/grace/locked/event cases on an appropriately coordinated DEV environment, refusal/cooldown and full error/safe-login matrix. App shell needs maintenance/licence events and isolated all-session logout evidence; no shared seed-user logout-all. Settings retains full permission/refusal/safe-write matrices despite all endpoint claims accepted. Notifications needs isolated read-all and genuine upstream realtime/critical-notice evidence. Approvals/charity require actual permitted upstream requests and distinct actors; never create mock financial data or weaken eligibility. Incident conditional type journeys and Facility shared service-transition tests remain unverified. For each screen refresh full bundle, help and test plan before choosing implementation; submit newly tested claims immediately and keep human gates pending.
