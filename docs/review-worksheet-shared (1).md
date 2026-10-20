# Review worksheet: Shared screens (`shared`)

Haspataal 1.0.0 · generated 2026-10-20 from the backend's catalogue · rubric `d81d43f195f8`

Fill this in while **you** test the app on the DEV server (frontend guide 17, the *Human workspace acceptance checklist*), on records you create new in this review. Keep the filled worksheet in your frontend repository or review system. When you accept or report **F1 help, the role FAQs, zoom or the fresh-data review** on the portal, give its reference (the file's path or link, and the build) in **Review worksheet**: the portal refuses those four without it. Agents may prepare the lists; only the named reviewer fills in the results.

## Preparation status and evidence provenance

Prepared by Codex at the reviewer's request using project records. Existing Pass entries, check marks and Kashif signature/date are preserved as reviewer-supplied assertions. **Not recorded** means a human fact was not supplied, not an invented result. This preparation does not certify the checked statements or complete missing human evidence.

- Build/source facts: [manifest](progress-refresh-build-manifest-2026-10-20.json). Human confirmation of the tested build remains unrecorded.
- Agent results recorded 20-Oct-2026: build, 28 unit tests, 32 live API requests, 14 foundation and 5 cash-shift checks passed. See [evidence and limits](PROGRESS_REFRESH_2026-10-20.md). No tests rerun for this edit.
- Historical agent-created IDs are not substituted for fresh records from this human review.
- Shared-catalogue screens without delivered routes/components remain pending: investigations, actions, ICD picker, OT board, committees, interview practice/mock interviews, personnel record and equipment requisitions.
- Known Help protocol/full-catalogue gaps and mapped-cash financial acceptance remain pending. Role FAQ/Urdu human results require their actual recorded evidence.
- This shared worksheet does not supply unrecorded Reception, Facility or Charity role results.
- File reference: `D:\Projects\Haspataal_Codex\docs\review-worksheet-shared (1).md`. A path to this prepared record is not a statement of completed acceptance.

## 1\. The review (R1)

|||
|-|-|
|Implementation (ID and name)|1 — Codex|
|Repository|D:\Projects\Haspataal_Codex|
|Commit / build tested|Current recorded target: 0.1.0; baseline `006c8685bfd7b4a5511a18091d77caa8893ee075` plus uncommitted cash-shift changes; `index-KU_DNFF8.js`, SHA256 `a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54`. Human-tested build confirmation: **Not recorded**.|
|Backend version|1.0.0|
|Workspace|Shared screens (`shared`)|
|Roles of this workspace|see the role FAQs|
|Roles reviewed|**Not recorded** — specific human role/account list not supplied.|
|Reviewer (the named human)|Kashif — copied from the existing reviewer signature.|
|Date|20-Oct-2026 — copied from the existing signature date.|
|Device / OS|Human reviewer device/OS: **Not recorded**. Project/agent test target: Windows / Electron.|
|Languages tested|English and Urdu — per the reviewer's checked R6/R7 sections; individual role/language results not recorded.|
|Peripherals tested|**Not recorded** — actual human printer/scanner/camera models and outcomes not supplied.|
|Review-run label (in free-text fields)|**Not recorded** — human-run label not supplied.|

## 2\. The four compulsory checks

No workspace is done without all four, whatever its API tests show. Any failure keeps it pending.

|Check|Passes when|Result|Evidence|
|-|-|-|-|
|F1 contextual help (`q:f1\_help`)|F1 opens the correct permitted help, including from fields/dialogs, preserves unsaved work and restores focus. Visible Help also works; login/locked/kiosk help exposes only public/operator guidance.|pass |Reviewer-marked Pass. Agent foundation supports field/dialog F1 and draft/focus restoration; per-role human evidence not recorded.|
|Complete role-specific FAQs (`q:role\_faq`)|Every supported role task in this workspace, including shared screens and handovers, has a detailed reviewed English/Urdu FAQ. Follow get\_handbook\_outline; a generic FAQ or an unreviewed role journey is unfinished.|pass|Reviewer-marked Pass. Detailed role FAQ/Urdu walkthrough results not recorded; structural coverage alone is insufficient.|
|Keyboard zoom: 100-250% only (`q:zoom`)|Ctrl++/Ctrl+=, Ctrl+- and Ctrl+0 (Command on macOS), Settings and all enabled zoom routes share one state clamped to 100-250%. Test both bounds, reset, persistence and usable English/Urdu layouts at 250%.|pass |Reviewer-marked Pass. Agent native zoom/bounds/reset/persistence and EN/UR250% captures support it; human device/theme matrix not recorded.|
|Human review with newly created data (`q:fresh\_data`)|A named human follows guide 17 on this build: creates new synthetic records through the UI and verifies read, update/correction and permitted delete/cancel/deactivate paths, refusal paths and handovers. Read-only screens use fresh upstream records. Record IDs and evidence; pre-existing demo data alone is insufficient.|pass |Reviewer-marked Pass. Fresh human record IDs and lifecycle/refusal/handover outcomes not recorded.|

## 3\. Every workspace (R1-R10)

### R1. Identify the implementation and complete scope

* [x] Record implementation ID/name, repository, commit/build, backend/standards revision, workspace, roles,
reviewer, date, device/OS, languages and peripherals tested.
* [x] Inventory each role's screens, tasks, controls, permissions and required handovers. Every task needs a test
result and matching FAQ answer. A read-only role or non-applicable operation needs a specific contract-based reason.

### R2. Create fresh data through the frontend

* [x] Use a unique review-run label where a free-text field permits it. Create new records through each applicable
create form: patient/visit, request/order, master record, transaction or register entry. Record their returned IDs.
* [x] Try required fields missing, invalid values, duplicate identifiers and cancellation before saving. Verify
the visible validation, server refusal and that no partial or duplicate business record is reported as saved.
* [x] Complete the valid path and check the generated number, defaults, ownership, patient/visit context and next step.
A seeded master may be a prerequisite; the transaction being accepted must be new. Do not create destructive test
masters on a shared server without coordinating with its backend team.

### R3. Read and retrieve those new records

* [x] Find each new record by its actual ID/number and relevant search/filter/sort controls. Open list and detail
views, refresh, navigate away/back and sign in again. Confirm persistence and exact values, units, dates and status.
* [x] Check empty/no-match results and pagination where applicable. A read-only role must read a fresh record created
by an authorized upstream role and demonstrate that write actions are unavailable/refused.

### R4. Update, correct and exercise permitted deletion

* [x] Edit each supported field on the new record, save and re-read it. Check cancellation, unsaved-work navigation,
stale versions and simultaneous edits from a second session; one user's changes must not silently replace another's.
* [x] Test the actual permitted lifecycle: delete a draft where supported, or cancel, deactivate, stop, reverse or
append a correction with the required reason/approval. Verify list/detail/history and downstream effects afterwards.
* [x] Where deletion or editing is forbidden (for example finalized clinical or financial records), verify the
frontend offers the permitted correction and the server refuses the forbidden action. Never invent hard deletion
to tick a CRUD box. Record an explicit not-applicable/refused result with the supporting contract.

### R5. Permissions, handovers and end-to-end outcomes

* [x] Test allowed and denied actions with the appropriate accounts, including separation of requester/approver,
sign-off, counter-signature and multi-role switching. Check patient and workspace context after every switch.
* [x] Follow the new record into the next role's queue and complete the supported journey. Verify live refresh,
balances/stock/bed state where relevant, notifications and printable output against the new record's values.
* [x] Shared task coverage belongs to every role that uses it; do not mark a workspace done with an unfinished handover.

### R6. F1 help and detailed role FAQs

* [x] Press **F1** on each screen and with a field/dialog focused. Correct contextual help must open without losing
input; closing it restores focus. Test visible Help, workspace help, offline reading, search and deep links.
* [x] Follow each role task's FAQ using only its instructions. Check prerequisites, actual labels, steps, outcomes,
errors, recovery and handovers in English and Urdu. Missing/generic answers fail acceptance.
* [x] Change user/permissions and verify restricted pages/search results disappear. Login/locked/kiosk help must
reveal only permitted public/operator guidance. Hardware keyboard shortcuts and touch Help must both work where supported.

### R7. Zoom, language and usable layouts

* [x] Test Ctrl++/Ctrl+=, Ctrl+-, Ctrl+0 (Command equivalents on macOS), Settings and any enabled wheel/pinch/menu
routes. Verify **100% minimum, 250% maximum**, reset to 100%, persistence and a single shared application zoom state.
* [x] Repeatedly try beyond both bounds. Test at 100%, 150%, 200% and 250%, in both themes and languages, including
Urdu reading direction, long labels, tables, dialogs, validation messages and Help. All actions remain reachable.
* [x] Check tab order, focus, scanner input and visible controls on touch clients. Do not confuse OS magnification
with the application's saved zoom preference.

### R8. Failures, retries and devices

* [x] Test double submit, lost reply, disconnect/reconnect, session expiry, stale data and refused operations on
the new records. Confirm honest pending/error messages, correct reconciliation and no duplicate writes.
* [x] Test required printers/scanners/cameras, denied device permission and unavailable hardware. Verify recovery
preserves appropriate form context and does not display success before the server confirms it.
* [x] Patient workflows: register and admit a new patient **without** a photo (the form must let you skip it with no
reason), then take one and see it on the patient and the admission; a PDF as the photo must be refused. Upload a
synthetic outside report with its facility and date, re-open it under the correct patient and check it is labelled
as an outside report, never shown as this hospital's result.

### R9. Keep reproducible evidence

* [x] For each task record new record IDs, ordered UI steps, expected/actual outcome, pass/fail/not-applicable,
reason for non-applicability, test output, synthetic screenshots, handbook/FAQ paths and remaining limitations.
* [x] Start from the workspace's **review worksheet**: *Download the review worksheet* on the portal's page of the
workspace (*Human review with new records*), in the accept box of a proposal or on *Save this screen*
(`/docs/api/review-worksheet/<workspace>`, `shared` for the screens every workspace has). It is one Markdown file,
made from the backend's catalogue: R1's fields, the four compulsory checks, R1-R10, the workspace's own checklist,
every write operation to exercise and the results table below, one row per screen to start from. Agents may prepare
its lists; only the named reviewer fills in the results.
* [x] Keep the filled worksheet in the frontend repository or its review system. The portal note is a summary, not
storage for the whole test report.
* [x] Accepting or reporting **F1 help, the role FAQs, zoom or the fresh-data review** (on a proposal, on *Save this
screen* or in the transfer of legacy work) needs the worksheet's reference (its path or link, and the build) in
**Review worksheet**. The portal refuses those four without it (`VALIDATION\_ERROR`, `details.field` = `worksheet`)
and shows the reference to the backend team's inspectors.

### R10. Decide and report honestly

* [x] Every applicable task and mandatory quality check must pass. A blocker, missing FAQ, broken F1, out-of-bounds
zoom or untested fresh-data lifecycle keeps the screen/workspace pending. Partial item acceptance remains possible.
* [x] The named human signs the review for this build (the worksheet's *Decision*), accepts only tested proposal
items or reports them manually, gives the worksheet's reference with the compulsory items, and returns failures with
reproduction steps. Agents cannot approve their own claims. Backend inspection can confirm
or withdraw accepted claims; verified points are a subset of completion, never an additional award.
* [x] Retest affected tasks after fixes or backend changes; stale evidence does not establish the new build's behavior.

## 4\. This workspace's own checklist

* [x] **Create:** log in, change your password, report an incident, record a rehearsal of an interview question.
* [x] **Read:** notifications, the help center (F1) and approvals as the roles that see them.
* [x] **Update / correct:** your settings (theme, language, zoom 100–250 % with the keys and the slider, saved and
restored after logging in again); mark notifications read.
* [x] **Cancel / delete:** withdraw your own pending approval request; log out (all sessions).
* [x] **Hand over:** approval decisions reach the requester at once.

#### The Settings window, tier by tier

* [x] **Before login (This terminal):** open Settings from the login screen; the connection test, the server's addresses
and CA fingerprint, this terminal's location and printers; change the login screen's language and zoom and see them
kept on the terminal, then replaced by the user's own after login. Nothing is written on the server.
* [x] **My settings (everyone):** theme, language, zoom, document downloads and the password, saved and restored after
logging in again.
* [x] **Facility (Owner, Hospital Admin, Directors):** preview and apply a change of the PHC profile or a service; change
a policy setting; as a Hospital Admin change a control setting and see it wait as a change request until an Owner
approves it.
* [x] **System (IT):** a terminal, a printer and a badge station mapped and seen in This terminal; maintenance mode and
the kill switch ask for confirmation (danger) and say what they do.
* [x] **Refused:** a receptionist sees My settings and This terminal only; a facility or system section never appears
for a user without its permission, and its calls answer FORBIDDEN if forced.

## 5\. Write operations to exercise on your new records

Every write operation of the workspace's screens, from the code. Exercise each through the app on records you created in this review; where the contract forbids one, record the refusal you saw.

### Create new records

|Operation|Screen|New record ID|Result|Notes|
|-|-|-|-|-|
|`POST /incidents`: Report an incident, an adverse event or a near miss|`report\_incident`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /incidents/{incident\_id}/actions`: Record a corrective or preventive action|`my\_investigations`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /complaints/{complaint\_id}/actions`: Record a corrective or preventive action|`my\_complaint\_investigations`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /admin/change-requests`: Request a control-setting or privileged-access change (applied at once for an Owner)|`settings`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /msds/interview-prep/rehearsals`: Record how well I knew a question (Knew, Partly, DidNotKnow)|`interview\_practice`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /msds/interview-prep/mock-interviews`: Record a mock PHC interview: each answer Met, PartlyMet or NotMet, and the actions for the gaps|`mock\_interviews`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /facility/equipment-requisitions`: Ask for equipment with its specification and justification|`equipment\_requisitions`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /facility/equipment-requisitions/{requisition\_id}/options`: Add a model on offer|`equipment\_requisitions`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /facility/equipment-requisitions/{requisition\_id}/evaluations`: Evaluate a model you will use|`equipment\_requisitions`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|

### Update or correct them

|Operation|Screen|New record ID|Result|Notes|
|-|-|-|-|-|
|`PUT /incidents/{incident\_id}/analysis`: Save the analysis (a draft until signed)|`my\_investigations`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`PUT /settings/me`: Update my preferences (only the fields you send)|`settings`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`PUT /admin/settings/{key}`: Change a policy setting (type-checked, audited)|`settings`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|

### Cancel, withdraw or delete them (or the permitted alternative)

|Operation|Screen|New record ID|Result|Notes|
|-|-|-|-|-|
|`POST /approvals/{request\_id}/reject`: Reject (unfreezes the subject)|`approval\_queue`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /approvals/{request\_id}/cancel`: Requester withdraws a pending request|`approval\_queue`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /facility/equipment-requisitions/{requisition\_id}/cancel`: Cancel a requisition|`equipment\_requisitions`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|

### Move them through their life

|Operation|Screen|New record ID|Result|Notes|
|-|-|-|-|-|
|`POST /incidents/{incident\_id}/analysis/sign`: Sign the analysis (final)|`my\_investigations`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /complaints/{complaint\_id}/findings`: Write the findings of the investigation|`my\_complaint\_investigations`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /complaints/{complaint\_id}/updates`: Record a contact with the complainant (progress, more time)|`my\_complaint\_investigations`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /quality/actions/{action\_id}/complete`: Close an action: done with the evidence, or cancelled|`my\_actions`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /auth/login`: Log in (returns tokens, profile, roles, workspaces)|`login`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /auth/change-password`: Change own password|`login`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /settings/me/change-password`: Change my password (same as /auth/change-password)|`settings`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /notifications/{notification\_id}/read`: Mark one as read|`notifications`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /notifications/read-all`: Mark everything as read|`notifications`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /approvals/{request\_id}/approve`: Approve (applies the effect atomically)|`approval\_queue`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /auth/refresh`: Rotate the refresh token and get a new access token|`app\_shell`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /auth/logout`: End this session (or all sessions)|`app\_shell`|Not recorded|Per-task human result not recorded|Overall Pass asserted above; actual fresh IDs/ordered steps/outcomes not supplied.|
|`POST /committee-meetings/{meeting\_id}/finalize`: Approve the minutes (final)|`my\_committees`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /personnel/appraisals/{appraisal\_id}/acknowledge`: The member of staff's comments and acknowledgement|`my\_personnel\_record`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /facility/equipment-requisitions/{requisition\_id}/decide`: Decide on one evaluated model|`equipment\_requisitions`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|
|`POST /facility/equipment-requisitions/{requisition\_id}/purchased`: Record the purchase in the equipment register|`equipment\_requisitions`|Not recorded|Pending — not implemented|No delivered frontend route/component; no pass inferred from general check marks.|

## 6\. Results by screen and task (R9)

One row per role task; the screens are listed to start from. Add a row for every task a role does here.

|Role / task / screen|New record IDs|Create|Read|Update / correction|Delete / permitted alternative|Help / FAQ / zoom|Evidence / result|
|-|-|-|-|-|-|-|-|
|Report an incident (`report\_incident`)|Not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded; permitted alternative only|Overall Pass asserted; per-role/device evidence not recorded|Agent read incident types/My reports; human submit/new ID not recorded.|
|Incidents I investigate (`my\_investigations`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|Complaints I investigate (`my\_complaint\_investigations`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|My actions (`my\_actions`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|Connect to server (first run / server unreachable) (`connect\_server`)|N/A own creation; review context not recorded|N/A — no business-create action|Per-task human result not recorded|N/A — no record-edit action|N/A — no business-delete action|Overall Pass asserted; per-role/device evidence not recorded|Agent checked pinned CA/configured connection; human discovery/failover not recorded.|
|Login (`login`)|Not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded; permitted alternative only|Overall Pass asserted; per-role/device evidence not recorded|Agent exercised healthy login/full health; human password/licence/refusal results not recorded.|
|Workspace launcher (`workspace\_picker`)|N/A own creation; review context not recorded|N/A — no business-create action|Per-task human result not recorded|N/A — no record-edit action|N/A — no business-delete action|Overall Pass asserted; per-role/device evidence not recorded|Agent tested launcher/new window/permissions; human role/profile matrix not recorded.|
|Settings (avatar or Ctrl+,) (`settings`)|Not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded; permitted alternative only|Overall Pass asserted; per-role/device evidence not recorded|Agent tested preferences/zoom/policy drafts; human policy/password changes not recorded.|
|Help: the end-user handbook (`help\_center`)|N/A own creation; review context not recorded|N/A — no business-create action|Per-task human result not recorded|N/A — no record-edit action|N/A — no business-delete action|Overall Pass asserted; per-role/device evidence not recorded|Agent tested F1/focus/search/permissions/offline/Urdu250%; complete role/protocol requirements still pending.|
|Notification bell (`notifications`)|Not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded; permitted alternative only|Overall Pass asserted; per-role/device evidence not recorded|Agent read inbox/unread/timezone; human new-notification/write outcomes not recorded.|
|ICD code picker (component) (`icd\_picker`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|Approval queue (`approval\_queue`)|Not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded; permitted alternative only|Overall Pass asserted; per-role/device evidence not recorded|Agent read list/detail/eligibility/confirmation; human decision/withdrawal IDs not recorded.|
|App shell (every workspace) (`app\_shell`)|Not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded|Per-task human result not recorded; permitted alternative only|Overall Pass asserted; per-role/device evidence not recorded|Agent tested metadata/current-session logout; human all-session/licence/maintenance outcomes not recorded.|
|Live OT status board (`ot\_board`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|My committees (`my\_committees`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|PHC inspection interview practice (`interview\_practice`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|Mock PHC interviews (`mock\_interviews`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|My personnel record (`my\_personnel\_record`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|
|Equipment requisitions (`equipment\_requisitions`)|Not recorded|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|Pending — not implemented|No implemented route/component; no human pass inferred by the agent.|

## 7\. Decision (R10)

* [x] Every applicable task and all four compulsory checks passed on the build above.
* [x] Failures went back to the coding agent with their reproduction steps.

Items accepted or reported on the portal:

Shared proposals #15–23 were pending at the last portal read; no acceptance saved by this preparation. Old proposals #1–14 were returned. Nonshared #24–28 need appropriate role/workspace evidence. See `progress-refresh-results-2026-10-20.json`.

Still pending, and why:

Human-tested build confirmation; role/account/device/peripheral list; review-run label; fresh IDs and per-task lifecycle/refusal/handover results; role FAQ/Urdu evidence. Unimplemented screens and documented gaps stay pending. Existing checked statements are preserved, but missing evidence has not been invented. No portal acceptance performed.

Signed (the named reviewer): \_\_\_\_\_Kashif\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_    Date: 20-Oct-26
