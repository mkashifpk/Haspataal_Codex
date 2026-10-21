> Superseding shutdown checkpoint (2026-10-21): current build index-BPLOEbxs.js / v3 manifest;373 accepted points,0/268 complete screens. Proposals29–45 accepted;46 (Settings) and47 (partial IT endpoints) confirmed pending, awaiting human review on /docs -> My progress. Settings-linked IT panels are now implemented, with technical and human acceptance still incomplete. See handoff.md and docs/SETTINGS_IT_REVIEW_2026-10-21.md for current facts and remaining frontend gaps. The snapshot/build/item matrix below is historical and must be refreshed from MCP before further work.

# Foundation remaining acceptance items — 21 October 2026

Snapshot: implementation1, rubric d81d43f195f8,335 accepted points,0/268 complete screens. Proposals29–35 accepted;36–45 saved and awaiting human review on /docs -> My progress. Pending claims earn no points.

Connect has **no remaining endpoint/event/technical rubric claim**: its four remaining gates are role FAQ review, named human fresh-data review, design review and editor review. That does not establish human completion. Other screens retain the technical evidence/implementation items below.

For each screen, pending submitted items are separated from unsubmitted requirements. An unsubmitted item can mean missing implementation, missing verification or missing sufficient evidence; it is not automatically a proven code defect.

## Connect to server (first run / server unreachable) (`connect_server`)

Pending proposals: none.

Technical implementation/verification still unclaimed:

None.

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Login (`login`)

Pending proposals: #36 (q:zoom).

Technical implementation/verification still unclaimed:

- `ev:system.license` — system.license
- `rule:66a4630670` — License banner: GET /meta/license on this screen (and data.license after login, the system.license event, every 10 min). state grace = persistent banner with message, days_left and the vendor contact on EVERY screen, work continues; state locked = only the Super Admin can log in, others get LICENSE_INVALID at login and token refresh (show message + details.vendor).
- `q:states` — Loading, empty and error states
- `q:writes` — Safe writes
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## App shell (every workspace) (`app_shell`)

Pending proposals: #37 (q:zoom).

Technical implementation/verification still unclaimed:

- `ev:system.maintenance` — system.maintenance
- `ev:system.license` — system.license
- `rule:0d0aefc3fe` — Load the catalogues once after login and after an upgrade: dropdowns from GET /meta/enums, labels and policy switches from GET /meta/settings; never hard-code status values.
- `rule:08c548437f` — Log out with POST /auth/logout (all_sessions: true ends every session of the user, e.g. a lost laptop).
- `rule:71c59cc220` — system.maintenance: show the message as a full-screen banner; non-admins get MAINTENANCE until it ends.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Settings (avatar or Ctrl+,) (`settings`)

Pending proposals: #38 (ep:PUT /admin/settings/{key}, q:zoom).

Technical implementation/verification still unclaimed:

- `rule:2a192ba046` — Open it from the avatar menu or Ctrl+, (Cmd+, on macOS) in every workspace; build its navigation from GET /settings/sections, never from role names: the facility tier opens facility_profile and the policy settings, the system tier opens the IT console's parts.
- `rule:dd268dd791` — Before login the same window opens from the login screen with the This terminal tier only (signed_in false): Server connection and LAN diagnostics (GET /health, GET /meta/server-info: the addresses and the CA fingerprint, GET /meta/license), This terminal (GET /terminals/whoami: location, printers, cash node, the MAC sent as X-Terminal-Mac), and the login screen's language and zoom, kept on this terminal until a user logs in (then GET /settings/me decides). After login the tier stays, last.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Notification bell (`notifications`)

Pending proposals: #39 (ep:POST /notifications/{notification_id}/read, q:zoom).

Technical implementation/verification still unclaimed:

- `ep:POST /notifications/read-all` — POST /notifications/read-all
- `ev:notification.created` — notification.created
- `rule:1edec8d9e4` — Refresh the badge on notification.created and after WebSocket reconnect.
- `rule:699233ff93` — Severity critical → toast that stays until dismissed.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Help: the end-user handbook (`help_center`)

Pending proposals: #40 (rule:4eb701e893, rule:8f5a026ae7).

Technical implementation/verification still unclaimed:

- `rule:164bde45b9` — Build the handbook as the developer guide 'The end-user handbook' (get_guide('end-user-handbook')) says: one page per screen (screens/<screen id>) and one per workspace (workspaces/<code>), written for the hospital's staff (where to click, what happens, what the system refuses and why, what to do on each error message), in English and Urdu (the user's language preference, GET /settings/me), with screenshots of YOUR UI.
- `rule:b676be655f` — Keep it current: the page ids are the screen ids of the catalogue; what_changed in the MCP server lists screens added or changed since the last build, so the pages are revised with the UI.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Approval queue (`approval_queue`)

Pending proposals: #41 (q:zoom).

Technical implementation/verification still unclaimed:

- `ev:approval.requested` — approval.requested
- `ev:approval.resolved` — approval.resolved
- `q:states` — Loading, empty and error states
- `q:writes` — Safe writes
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Charity approvals (`charity_approvals`)

Pending proposals: #42 (q:zoom, rule:20bd1ddd69).

Technical implementation/verification still unclaimed:

- `ep:POST /approvals/{request_id}/approve` — POST /approvals/{request_id}/approve
- `ep:POST /approvals/{request_id}/reject` — POST /approvals/{request_id}/reject
- `ev:approval.requested` — approval.requested
- `ev:approval.resolved` — approval.resolved
- `rule:2a188dbe97` — You can never approve your own request (SELF_APPROVAL_FORBIDDEN).
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Report an incident (`report_incident`)

Pending proposals: #43 (ep:GET /incidents/sentinel-list/pdf, q:zoom, rule:b7217a4ed6).

Technical implementation/verification still unclaimed:

- `rule:efef10e8e1` — A button on every workspace's toolbar. Form: the type (GET /incident-types, grouped by area, sentinel types marked), incident or near miss, harm, when (now by default) and where (department, ward, place), who was affected (a patient: search by MRN; staff: GET /staff/lookup, any reporter may use it), what happened (facts, not blame) and what was done at once; 'Keep my name confidential' (reporter_confidential).
- `rule:02468e1c7f` — Medication errors: the stage and the medicine; theatre events: the operation and the phase (INCIDENT_DETAILS_REQUIRED). Send an Idempotency-Key: a double click must not report twice.
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:writes` — Safe writes
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Facility settings: PHC profile and services (`facility_profile`)

Pending proposals: #44 (ep:GET /establishment/changes/{change_id}, q:zoom).

Technical implementation/verification still unclaimed:

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

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.

## Workspace launcher (`workspace_picker`)

Pending proposals: #45 (q:zoom).

Technical implementation/verification still unclaimed:

- `ev:session.revoked` — session.revoked
- `ev:establishment.changed` — establishment.changed
- `rule:be337cde67` — One build of the frontend serves every profile (Clinic, II C, II B, II A, I) and every change of it: nothing is downloaded or switched by a flag. Read GET /establishment after login and again on establishment.changed, then list each workspace as views.workspaces says (hidden: not listed; records: marked Records; open_work: with the banner) and each screen as views.screens says; a workspace or screen it does not list is core and always shown (to the users with its permissions). Inside a screen hide an operation of x-capability-gates (or only the choice its `when` names) while its service is not in `active` (the server refuses it anyway: CAPABILITY_INACTIVE). What is shown follows the services, never the profile's category: the category picks the inspection framework, the letterhead and the few rules a screen names (the clinic's complete consultation).
- `q:states` — Loading, empty and error states
- `q:permissions` — Actions by permission
- `q:tested` — Test plan passed

Human/review gates: `q:role_faq`, `q:fresh_data`, `q:character`, `q:editor`. See `docs/FOUNDATION_HUMAN_REVIEW_2026-10-21.md`; results remain unfilled.
