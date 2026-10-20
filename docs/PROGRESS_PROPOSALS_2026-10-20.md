# Progress proposal audit — 2026-10-20

Developer: **mkashif (Muhammad Kashif)**. Implementation **1 / Codex**, Windows, active and nominated. Accepted score at audit: **0 points**, 0 completed screens/workspaces. Shared Screens: **19 screens, 401 unclaimed items, 1,035 available points**. Whole catalogue: 16,073 points / 268 screens / 31 workspaces. Proposals do not award points.

## Build and verification

- Tested source commit: `006c8685bfd7b4a5511a18091d77caa8893ee075`, package `0.1.0`. Starting tree clean; this audit/handoff are documentation-only changes.
- 2026-10-20: `npm run build` passed handbook coverage, TypeScript, Vite. Existing >500kB bundle warning remains. `npm test`: 24/24 passed. `git diff --check` passed.
- Built JS: `dist/assets/index-CO8cW5xq.js`, SHA256 `6edb7d490bc049f518bac9ea8542b0342e4365a9176cf613837908d44db872ea`.
- Built CSS: `dist/assets/index-DU1KjqHt.css`, SHA256 `f52910eee042ef2dba22c1b95c79add24672d909ae6378b6a017e9f6863133cf`.
- First `npm run test:live` attempt timed out. Logged retry passed **32 real DEV requests** on 2026-10-20, including current cash-shift transaction read; `artifacts/live-check.json` now contains this run. `npm run test:foundation` logged retry exited 0, **14 checks**, no renderer errors; real reads/preferences restored, no business writes. Logs: `artifacts/progress-live-20261020.log`, `artifacts/progress-foundation-20261020.log`.
- Historical 2026-10-19 backend reconciliation and 2026-10-18 registration artifacts remain historical and are not independently bound to an earlier commit. Current build/unit/foundation/live passes validate only the stated scopes, not all earlier business paths.
- Handbook structural coverage: 11 screens, 102 controls, 42 groups, 33 FAQ seeds, 30 scoped workspace guides, 22 bilingual screenshot files. Structural coverage does not approve role journeys or Urdu wording.
- Current backend contract `0b5ab90e400dfbb822d3`, knowledge `318d65bdd91cd873`, rubric `d81d43f195f8`; UI standard `955624dcfc85ddb2`. Backend build `2026-10-19T02:19:27.475638+00:00`. Issue #7 remains New/Low (rechecked 2026-10-20); no new backend defect established.

## Review boundary

This is agent-collected implementation evidence for human consideration, not acceptance. No named human review has been performed or claimed. All `q:fresh_data`, `q:role_faq`, `q:tested`, `q:character`, `q:editor` remain pending. Full role FAQ review/Urdu approval, fresh upstream records, lifecycle/refusal/handovers, devices and untested events remain pending. No screen/workspace is declared complete. F1/handbook proposals cover the implemented screen and recorded checks only; historical F1/zoom evidence is labelled. The human must download/fill/sign the portal's Shared review worksheet (`/docs/api/review-worksheet/shared`), keep its results with this build, and supply its reference when accepting compulsory items. This audit is not that completed worksheet.

Frontend gap: Help loads using Electron `loadFile` rather than checklist-mandated localhost HTTP/custom `app://`; `help_center` rule `rule:8f5a026ae7` remains pending. Complete all-profile/service catalogue and IT sections are not delivered. Do not report these frontend gaps as backend defects.

## Submission results

**14 screen proposals, IDs 1–14, all pending, 103 proposed items / 272 candidate points**. Of these, 9 Shared Screens proposals contain 72 items / 183 candidate points; five other implemented screens contain 31 items / 89 candidate points. Accepted score remains 0, and all 401 Shared Screens items remain unclaimed until human acceptance. Exact immutable inputs and returned IDs/digests are in `docs/progress-proposal-inputs-2026-10-20.json` and `docs/progress-proposal-results-2026-10-20.json`.

## Shared Screens unclaimed checklist

Every item below remains unclaimed on the server. “Proposed” identifies evidence submitted for human consideration; “Pending” identifies omitted items. No proposal was submitted for an unimplemented screen.

### Report an incident (`report_incident`)

5 proposed items; 16 pending; 55 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /incident-types` | 3 | GET /incident-types |
| Pending | `ep:POST /incidents` | 3 | POST /incidents |
| Proposed | `ep:GET /incidents` | 3 | GET /incidents |
| Pending | `ep:GET /incidents/{incident_id}` | 3 | GET /incidents/{incident_id} |
| Pending | `ep:GET /incidents/sentinel-list/pdf` | 3 | GET /incidents/sentinel-list/pdf |
| Proposed | `ep:GET /staff/lookup` | 3 | GET /staff/lookup |
| Pending | `rule:efef10e8e1` | 2 | A button on every workspace's toolbar. Form: the type (GET /incident-types, grouped by area, sentinel types marked), incident or near miss, harm, when (now by default) and where (department, ward, place), who was affected (a patient: search by MRN; staff: GET /staff/lookup, any reporter may use it), what happened (facts, not blame) and what was done at once; 'Keep my name confidential' (reporter_confidential). |
| Pending | `rule:02468e1c7f` | 2 | Medication errors: the stage and the medicine; theatre events: the operation and the phase (INCIDENT_DETAILS_REQUIRED). Send an Idempotency-Key: a double click must not report twice. |
| Pending | `rule:376401d443` | 2 | After sending: show the incident number and 'The Quality Officer will review it'. 'My reports' = GET /incidents?mine=true. |
| Pending | `rule:b7217a4ed6` | 2 | Link 'What to report' to GET /incidents/sentinel-list/pdf. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Incidents.tsx; src/StaffPicker.tsx; src/hospital-time.ts; src/generated/report_incident.ts.

Evidence: Incident types/my reports reads were covered by the historical live check. Historical backend-fixes Electron run exercised the real staff picker as reception; foundation exercised incident drafts and hospital timezone. No report was submitted by those tests. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Sign in as demo.reception, open Report an incident, inspect types and My reports, search staff, change a selector, press F1 and close Help.

Limitations: Incident submit, idempotent double-submit, details read on a new report, sentinel PDF, specialty detail errors and post-submit result remain unverified here.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/report_incident-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Incidents I investigate (`my_investigations`)

0 proposed items; 24 pending; 62 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /incidents` | 3 | GET /incidents |
| Pending | `ep:GET /incidents/{incident_id}` | 3 | GET /incidents/{incident_id} |
| Pending | `ep:PUT /incidents/{incident_id}/analysis` | 3 | PUT /incidents/{incident_id}/analysis |
| Pending | `ep:POST /incidents/{incident_id}/analysis/sign` | 3 | POST /incidents/{incident_id}/analysis/sign |
| Pending | `ep:POST /incidents/{incident_id}/actions` | 3 | POST /incidents/{incident_id}/actions |
| Pending | `ep:GET /quality/record-review/people` | 3 | GET /quality/record-review/people |
| Pending | `ep:GET /incidents/{incident_id}/pdf` | 3 | GET /incidents/{incident_id}/pdf |
| Pending | `ev:incident.updated` | 2 | incident.updated |
| Pending | `ev:notification.created` | 2 | notification.created |
| Pending | `rule:abc6e22aea` | 2 | List: GET /incidents?mine=true&status=UnderReview (analysis_overdue in red). Show it only to users who have one (notification category incident when named). |
| Pending | `rule:7f51087df2` | 2 | Analysis form (save as you go with PUT): method (RootCauseAnalysis for a sentinel event), what happened in order, root causes, contributing factors (checkboxes of the fixed list), lessons, whether the patient or the family was told and how, any report made outside (DRAP, PHC). |
| Pending | `rule:55290eb231` | 2 | Sign: INCIDENT_ANALYSIS_INCOMPLETE lists details.missing. A sentinel event needs at least one factor of the system, not only 'Individual' or 'Patient' (MSDS CQI 107: blame alone is not an analysis). |
| Pending | `rule:eb51836d6b` | 2 | Add the corrective and preventive actions with an owner and a due date. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### Complaints I investigate (`my_complaint_investigations`)

0 proposed items; 21 pending; 54 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /complaints` | 3 | GET /complaints |
| Pending | `ep:GET /complaints/{complaint_id}` | 3 | GET /complaints/{complaint_id} |
| Pending | `ep:POST /complaints/{complaint_id}/findings` | 3 | POST /complaints/{complaint_id}/findings |
| Pending | `ep:POST /complaints/{complaint_id}/updates` | 3 | POST /complaints/{complaint_id}/updates |
| Pending | `ep:POST /complaints/{complaint_id}/actions` | 3 | POST /complaints/{complaint_id}/actions |
| Pending | `ev:complaint.updated` | 2 | complaint.updated |
| Pending | `ev:notification.created` | 2 | notification.created |
| Pending | `rule:0e24fdd6ab` | 2 | List: GET /complaints?mine=true&status=Acknowledged, by answer_due (answer_overdue in red). Show the screen only to users who have one (notification category complaint). |
| Pending | `rule:f6c9b1d267` | 2 | Findings: what the investigation found (facts, the people spoken to, the records read). The complaints officer conveys the outcome. |
| Pending | `rule:3bc2a63e5e` | 2 | Tell the complainant how it stands, or that it needs more time and until when (Extension), before answer_due. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### My actions (`my_actions`)

0 proposed items; 17 pending; 44 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /quality/actions` | 3 | GET /quality/actions |
| Pending | `ep:GET /quality/actions/{action_id}` | 3 | GET /quality/actions/{action_id} |
| Pending | `ep:POST /quality/actions/{action_id}/complete` | 3 | POST /quality/actions/{action_id}/complete |
| Pending | `ev:notification.created` | 2 | notification.created |
| Pending | `rule:00e66a7974` | 2 | GET /quality/actions?mine=true&status=Open, soonest due first, is_overdue in red; a badge counts them. Show the screen only when the user owns an action. |
| Pending | `rule:d4ec1cb870` | 2 | Close: Done with what was done (the evidence), or Cancelled with why; final (QUALITY_ACTION_CLOSED). |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### Connect to server (first run / server unreachable) (`connect_server`)

7 proposed items; 11 pending; 45 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /meta/server-info` | 3 | GET /meta/server-info |
| Proposed | `ep:GET /terminals/whoami` | 3 | GET /terminals/whoami |
| Pending | `rule:5b0d1eef31` | 2 | Order: policy registry HKLM\SOFTWARE\Policies\Haspataal\Terminal > %ProgramData%\Haspataal Terminal\terminal.json > the saved choice > this screen. |
| Proposed | `rule:7fa4f922c1` | 2 | This screen: broadcast a LAN discovery request (UDP 47632) and list the servers found; also allow typing an address (https://SERVER-NAME). |
| Proposed | `rule:0c28f497d6` | 2 | Before trusting a server the first time, show its CA fingerprint and require IT to confirm it matches the Control Center (skip the question only when a provisioned fingerprint matches). |
| Proposed | `rule:0a85fe6eb5` | 2 | Pin the hospital CA; never accept a server whose CA fingerprint differs from the trusted one (show 'This is not your hospital server'). |
| Pending | `rule:fcc2cef909` | 2 | After connecting, call GET /meta/server-info and store ALL urls as alternates; if the one in use fails during a shift, try the others before showing 'Server unreachable'. |
| Pending | `rule:7efe038a18` | 2 | While unreachable: keep the current screen and unsaved input, show a banner, retry with back-off (1, 2, 5, 10, 30 s), resume the WebSocket with resume_from when back. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Connection.tsx; electron/discovery.cjs; electron/main.cjs; electron/transport.cjs.

Evidence: Source implements UDP 47632 discovery/manual URL, displayed CA fingerprint matching and pinned checkedRoot TLS. Current unit test refuses invalid hospital certificate. Historical foundation capture shows actual unconfigured connection UI; terminal/server reads are wired in main-process bootstrap and Settings diagnostics. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Use an isolated unconfigured terminal, Find servers or enter URL, Check server identity, compare fingerprint with IT, then open This terminal diagnostics.

Limitations: No fresh LAN discovery, provisioning priority matrix, address failover, disconnect/backoff/replay or physical-terminal acceptance; endpoint proposals include source wiring, not a fresh successful call.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/connect_server-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Login (`login`)

12 proposed items; 13 pending; 63 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:POST /auth/login` | 3 | POST /auth/login |
| Proposed | `ep:GET /terminals/whoami` | 3 | GET /terminals/whoami |
| Pending | `ep:POST /auth/change-password` | 3 | POST /auth/change-password |
| Proposed | `ep:GET /meta/license` | 3 | GET /meta/license |
| Proposed | `ep:GET /health/live` | 3 | GET /health/live |
| Proposed | `ep:GET /health` | 3 | GET /health |
| Pending | `ev:system.license` | 2 | system.license |
| Proposed | `rule:0a37b50feb` | 2 | Before showing the form, ping GET /health/live every 5 s; if it fails show 'LAN / server unreachable' (cable, Wi-Fi, server) instead of hanging. When it answers, GET /health says whether the server is degraded (HTTP 503, its database down: 'The server is starting or has a problem: ask IT'), in maintenance, or licensed (license.state). |
| Pending | `rule:66a4630670` | 2 | License banner: GET /meta/license on this screen (and data.license after login, the system.license event, every 10 min). state grace = persistent banner with message, days_left and the vendor contact on EVERY screen, work continues; state locked = only the Super Admin can log in, others get LICENSE_INVALID at login and token refresh (show message + details.vendor). |
| Proposed | `rule:f787ce1cd4` | 2 | Show the terminal MAC/IP overlay (Ctrl+Shift+I or an info icon) from GET /terminals/whoami for IT support. |
| Proposed | `rule:f0462c4840` | 2 | A Settings button (and Ctrl+,) opens the Settings window before login: GET /settings/sections without a token answers signed_in false and the This terminal tier only (connection and LAN diagnostics, this terminal's location and printers, the login screen's language and zoom). It writes nothing on the server. |
| Pending | `rule:8b4678ddba` | 2 | If user.must_change_password is true, force the change-password form before anything else (other endpoints answer PASSWORD_CHANGE_REQUIRED). |
| Proposed | `rule:d343d623a8` | 2 | ACCOUNT_LOCKED / RATE_LIMITED: show error.message and error.retry_after_seconds; never retry automatically. |
| Proposed | `rule:343a338979` | 2 | Store the refresh token with Electron safeStorage; keep the access token in memory only. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Login.tsx; src/App.tsx; electron/main.cjs; electron/health-response.cjs.

Evidence: Current health tests verify degraded HTTP503 envelope and invalid-envelope refusal; source polls liveness then full health at nonoverlapping 5s intervals, exposes terminal info and pre-login Settings, displays lock/rate retry time, encrypts refresh token with safeStorage and keeps access token in memory. Historical foundation repeatedly signed in and checked healthy full health. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Open configured terminal, inspect health and terminal info, open Settings before login, sign in with a permitted DEV account, press F1 from credentials.

Limitations: Actual degraded database, forced password change, locked/rate-limited account, licence grace/locked transitions and session revocation remain pending; no real password changed.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/login-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Workspace launcher (`workspace_picker`)

9 proposed items; 11 pending; 50 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /auth/workspaces` | 3 | GET /auth/workspaces |
| Proposed | `ep:GET /auth/me` | 3 | GET /auth/me |
| Proposed | `ep:GET /establishment` | 3 | GET /establishment |
| Pending | `ev:session.revoked` | 2 | session.revoked |
| Pending | `ev:establishment.changed` | 2 | establishment.changed |
| Proposed | `rule:ef8faf697b` | 2 | If exactly one workspace: open it directly. |
| Proposed | `rule:48d2320390` | 2 | Allow opening several workspaces in separate windows at once. |
| Proposed | `rule:fdf9aa47f8` | 2 | Every request of a workspace window sends X-Active-Workspace: <its code> (one of GET /auth/workspaces; another answers WORKSPACE_NOT_ALLOWED): the audit trail records the window, and F1 help defaults to it. The launcher sends none. It never changes what the user may do. |
| Proposed | `rule:7264321365` | 2 | Hide menu items whose x-permissions the user lacks (permissions are in /auth/me). |
| Pending | `rule:be337cde67` | 2 | One build of the frontend serves every profile (Clinic, II C, II B, II A, I) and every change of it: nothing is downloaded or switched by a flag. Read GET /establishment after login and again on establishment.changed, then list each workspace as views.workspaces says (hidden: not listed; records: marked Records; open_work: with the banner) and each screen as views.screens says; a workspace or screen it does not list is core and always shown (to the users with its permissions). Inside a screen hide an operation of x-capability-gates (or only the choice its `when` names) while its service is not in `active` (the server refuses it anyway: CAPABILITY_INACTIVE). What is shown follows the services, never the profile's category: the category picks the inspection framework, the letterhead and the few rules a screen names (the clinic's complete consultation). |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/App.tsx; electron/main.cjs; src/bridge.ts.

Evidence: Source reads server auth/workspace/establishment metadata, auto-opens the sole visible workspace, permission-filters menus and sets per-window X-Active-Workspace. Historical foundation opened owner workspace/new window, checked initialization and shared preferences, and switched accounts. Current unit test checks establishment views rather than category branches. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Sign in as demo.owner, choose workspace and Open in new window, check per-window context; compare menus after signing in as reception.

Limitations: No complete all-profile/service catalogue, full single-workspace role matrix or live establishment/session event acceptance; broad one-build completion rule pending.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/workspace_picker-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Settings (avatar or Ctrl+,) (`settings`)

11 proposed items; 16 pending; 70 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /settings/sections` | 3 | GET /settings/sections |
| Proposed | `ep:GET /settings/me` | 3 | GET /settings/me |
| Proposed | `ep:PUT /settings/me` | 3 | PUT /settings/me |
| Pending | `ep:POST /settings/me/change-password` | 3 | POST /settings/me/change-password |
| Proposed | `ep:GET /admin/settings` | 3 | GET /admin/settings |
| Pending | `ep:PUT /admin/settings/{key}` | 3 | PUT /admin/settings/{key} |
| Pending | `ep:POST /admin/change-requests` | 3 | POST /admin/change-requests |
| Proposed | `ep:GET /admin/change-requests` | 3 | GET /admin/change-requests |
| Pending | `ep:GET /admin/change-requests/{change_request_id}` | 3 | GET /admin/change-requests/{change_request_id} |
| Proposed | `rule:7d8ad20153` | 2 | Theme: Light / DarkHighContrast. |
| Proposed | `rule:bf70f7fbcf` | 2 | Language en/ur is per USER (loaded at login), not per machine; bundle Noto Nastaliq Urdu; no bilingual labels in grids. |
| Proposed | `rule:4bb773c484` | 2 | UI scale slider (100–250 %) and Ctrl +/- drive the SAME Electron zoom factor; persist via PUT /settings/me. |
| Proposed | `rule:629688d168` | 2 | 'Documents' section: 'Download a set of documents (the PHC inspection pack) as: separate PDFs, one per click (default) / one combined PDF' → pdf_download Separate \| Combined. Never offer a ZIP. |
| Pending | `rule:2a192ba046` | 2 | Open it from the avatar menu or Ctrl+, (Cmd+, on macOS) in every workspace; build its navigation from GET /settings/sections, never from role names: the facility tier opens facility_profile and the policy settings, the system tier opens the IT console's parts. |
| Pending | `rule:f8e3ead1de` | 2 | Policy settings marked is_control show 'Owner approval': for anyone but an Owner, Save sends POST /admin/change-requests and the row shows 'Waiting for an Owner' until approval.resolved. |
| Pending | `rule:dd268dd791` | 2 | Before login the same window opens from the login screen with the This terminal tier only (signed_in false): Server connection and LAN diagnostics (GET /health, GET /meta/server-info: the addresses and the CA fingerprint, GET /meta/license), This terminal (GET /terminals/whoami: location, printers, cash node, the MAC sent as X-Terminal-Mac), and the login screen's language and zoom, kept on this terminal until a user logs in (then GET /settings/me decides). After login the tier stays, last. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Settings.tsx; src/screens/Login.tsx; src/App.tsx; electron/preference-queue.cjs; electron/main.cjs.

Evidence: Historical foundation saved/restored preferences, tested avatar route, native rapid zoom bounds/reset/persistence/new-window agreement and guarded policy drafts. Current unit tests cover ordering/refusal/session boundaries. Source exposes Light/DarkHighContrast, per-user en/ur, bundled Urdu font and Separate/Combined PDFs; historical live reads covered sections/preferences/admin settings/change requests. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Avatar > Settings, change display preferences/zoom then sign out/in; inspect allowed tiers and policy history; restore original preferences.

Limitations: Policy writes, change-request detail endpoint, password changes and full IT-console tier are unverified or undelivered. Urdu wording remains draft; complete tier navigation rule and broad layout matrix pending.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/settings-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Help: the end-user handbook (`help_center`)

7 proposed items; 11 pending; 45 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /meta/handbook` | 3 | GET /meta/handbook |
| Proposed | `ep:GET /settings/me` | 3 | GET /settings/me |
| Pending | `rule:164bde45b9` | 2 | Build the handbook as the developer guide 'The end-user handbook' (get_guide('end-user-handbook')) says: one page per screen (screens/<screen id>) and one per workspace (workspaces/<code>), written for the hospital's staff (where to click, what happens, what the system refuses and why, what to do on each error message), in English and Urdu (the user's language preference, GET /settings/me), with screenshots of YOUR UI. |
| Proposed | `rule:d6cf6002f7` | 2 | RBAC is the server's: GET /meta/handbook after login (and after a role change) returns the pages this user may read; show only those pages in the help window and in its search index; a page whose screen is not in the answer is never shown, linked or searchable for this user. |
| Pending | `rule:8f5a026ae7` | 2 | Localhost-only searchable site: the pages are a static site generated at the app's build (MkDocs-style with a client-side search index), bundled in the app and served to the help window from an HTTP server bound to 127.0.0.1 on an ephemeral port (or a custom app:// protocol); never on the LAN, never on the hospital server. Works offline. Print-friendly for the training room. |
| Pending | `rule:4eb701e893` | 2 | Entry points: 'Help' in the avatar menu (opens the user's handbook home: their workspaces and a search box) and a '?' button on every screen (opens screens/<id>). The home lists the user's own workspaces first (yours true). |
| Pending | `rule:b676be655f` | 2 | Keep it current: the page ids are the screen ids of the catalogue; what_changed in the MCP server lists screens added or changed since the last build, so the pages are revised with the UI. |
| Proposed | `rule:dd1ce2ac87` | 2 | In a workspace window, call GET /meta/handbook?workspace=<that workspace>; never show another workspace's pages in that window. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Proposed | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Help.tsx; src/help.ts; src/foundation-help.ts; src/foundation-task-map.json; src/foundation-errors.ts; scripts/check-help.mjs; public/handbook/.

Evidence: Current build enforces bilingual pages/control/task/FAQ-seed/screenshot coverage for 11 foundation screens. Historical foundation exercised field/dialog F1, focus/draft restoration, search/no-match, workspace/deep links, permission/account filtering, packaged offline images and Urdu Help at250% without overflow; native shared zoom bounds/reset/persistence also passed historically. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: F1 from field and approval confirmation; close to restore focus; search, use workspace/deep link, switch account and verify forbidden pages disappear; test keyboard bounds and Urdu250%.

Limitations: Local help uses Electron file loading, not mandated localhost HTTP/custom app protocol: rule:8f5a026ae7 pending. Full catalogue pages, complete human-reviewed role FAQs, translation/editor pass and human worksheet are pending. q:zoom is backed by today's successful foundation run; whole-screen/role layout review still pending.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/help_center-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Notification bell (`notifications`)

4 proposed items; 14 pending; 47 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /notifications` | 3 | GET /notifications |
| Proposed | `ep:GET /notifications/unread-count` | 3 | GET /notifications/unread-count |
| Pending | `ep:POST /notifications/{notification_id}/read` | 3 | POST /notifications/{notification_id}/read |
| Pending | `ep:POST /notifications/read-all` | 3 | POST /notifications/read-all |
| Pending | `ev:notification.created` | 2 | notification.created |
| Pending | `rule:1edec8d9e4` | 2 | Refresh the badge on notification.created and after WebSocket reconnect. |
| Pending | `rule:699233ff93` | 2 | Severity critical → toast that stays until dismissed. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Notifications.tsx; src/App.tsx; src/generated/notifications.ts; src/hospital-time.ts.

Evidence: Historical live check read inbox/unread count; historical foundation viewed notifications and verified real hospital timezone independently of emulated workstation timezone. Source wires list/unread badge and F1; no read-state write was performed. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Sign in, open Notifications, inspect unread badge/filter and hospital time, press F1.

Limitations: Mark read/read-all, pagination, incoming critical notifications and reconnect/event-driven badge behavior remain unverified; no fresh upstream notification human journey.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/notifications-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### ICD code picker (component) (`icd_picker`)

0 proposed items; 19 pending; 49 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /icd/codes` | 3 | GET /icd/codes |
| Pending | `ep:GET /icd/browse` | 3 | GET /icd/browse |
| Pending | `ep:GET /icd/codes/{code}` | 3 | GET /icd/codes/{code} |
| Pending | `ep:GET /icd/releases` | 3 | GET /icd/releases |
| Pending | `rule:8f7d69c3d8` | 2 | Search as the doctor types (from 2 characters, debounced): a code prefix (CA40) or words in any order ("pneumonia bacterial"); show code in bold, title, and parent_title in grey to tell similar titles apart. |
| Pending | `rule:3c55bbe648` | 2 | Residual codes (is_residual: "other specified", "unspecified") after the specific ones: nudge toward the most specific code. 'Browse' walks chapters → blocks → codes (GET /icd/browse?parent=…); a code's place in the tree: GET /icd/codes/{code}. |
| Pending | `rule:af092de339` | 2 | The classification is GET /icd/releases → coding_system (ICD-11 unless the hospital switched to its licensed ICD-10); ICD_SYSTEM_NOT_LOADED: no list of that classification yet. |
| Pending | `rule:ff27b50665` | 2 | Show `icd11_citation` in small print at the picker's foot (the ICD-11 licence requires the attribution). |
| Pending | `rule:840c5916c0` | 2 | Store only the code; everywhere codes come back they come with `icd_terms` (code, title, WHO URI): show code + title, never a bare code. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### Approval queue (`approval_queue`)

9 proposed items; 13 pending; 56 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /approvals` | 3 | GET /approvals |
| Proposed | `ep:GET /approvals/{request_id}` | 3 | GET /approvals/{request_id} |
| Pending | `ep:POST /approvals/{request_id}/approve` | 3 | POST /approvals/{request_id}/approve |
| Pending | `ep:POST /approvals/{request_id}/reject` | 3 | POST /approvals/{request_id}/reject |
| Pending | `ep:POST /approvals/{request_id}/cancel` | 3 | POST /approvals/{request_id}/cancel |
| Pending | `ev:approval.requested` | 2 | approval.requested |
| Pending | `ev:approval.resolved` | 2 | approval.resolved |
| Proposed | `rule:2365195ebb` | 2 | Requesters see their own pending items with GET /approvals?mine=true and a visible 'Awaiting approval' state. |
| Proposed | `rule:ae799475da` | 2 | Show Approve and Reject only when the request's can_decide is true; decide_blocked says why not (own_request, missing_permission, decided). You never approve your own request (SELF_APPROVAL_FORBIDDEN): self_decision forbidden shows 'Awaiting another approver'; allowed_with_note (the Owner of a solo practice, solo_practice_mode in GET /meta/settings) asks for the note, and the answer comes back solo_self_approved. |
| Proposed | `rule:44286b431d` | 2 | Reject requires a note. No co-signer is typed in this queue: a large cash drop is simply never approved by the cashier of its shift (DUAL_CONTROL_SAME_PERSON). |
| Proposed | `rule:ef377318b9` | 2 | PolicyChange and PrivilegedAccess requests carry payload.current_value and payload.requested_value: show both and the reason before Approve. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Proposed | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Approvals.tsx; src/approval-policy.ts; src/generated/approval_queue.ts; tests/approval-policy.test.mjs.

Evidence: Current four approval-policy tests cover server eligibility/AP, eligible solo note, cancel eligibility, refused own decisions, completed requests and blank rejection. Historical backend-fixes UI checked requester and eligible owner; foundation opened real detail/confirmation, preserved note draft and tested F1 without deciding. Source renders current/requested payload, Awaiting approval, and refreshed server eligibility. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Open Approvals/My requests, select actual pending request; compare reception/requester vs eligible owner, inspect payload/rejection note and F1 confirmation; cancel dialog without submitting.

Limitations: No approve/reject/cancel submitted; server financial/separation refusal, resolved-event handover and duplicate/concurrent decisions pending. Solo/AP unit cases are not live business transactions. Backend outline documentation #7 remains New/Low.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/approval_queue-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### App shell (every workspace) (`app_shell`)

8 proposed items; 16 pending; 62 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:POST /auth/refresh` | 3 | POST /auth/refresh |
| Proposed | `ep:POST /auth/logout` | 3 | POST /auth/logout |
| Proposed | `ep:GET /meta/enums` | 3 | GET /meta/enums |
| Proposed | `ep:GET /meta/settings` | 3 | GET /meta/settings |
| Proposed | `ep:GET /meta/workspaces` | 3 | GET /meta/workspaces |
| Proposed | `ep:GET /meta/error-codes` | 3 | GET /meta/error-codes |
| Proposed | `ep:GET /meta/events` | 3 | GET /meta/events |
| Pending | `ev:system.maintenance` | 2 | system.maintenance |
| Pending | `ev:system.license` | 2 | system.license |
| Pending | `rule:3bf5c2d4bd` | 2 | Refresh the access token shortly before expires_in with POST /auth/refresh (the refresh token rotates: keep the new one; reusing an old one revokes the whole session family). |
| Pending | `rule:0d0aefc3fe` | 2 | Load the catalogues once after login and after an upgrade: dropdowns from GET /meta/enums, labels and policy switches from GET /meta/settings; never hard-code status values. |
| Pending | `rule:08c548437f` | 2 | Log out with POST /auth/logout (all_sessions: true ends every session of the user, e.g. a lost laptop). |
| Pending | `rule:71c59cc220` | 2 | system.maintenance: show the message as a full-screen banner; non-admins get MAINTENANCE until it ends. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/App.tsx; electron/main.cjs; src/bridge.ts.

Evidence: Historical live check read metadata catalogues and logged out; foundation signed out/in and switched accounts/windows. Source loads catalogues from server after login and exposes global screen Help. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Sign in, open workspace, inspect navigation/help, sign out and back in; compare permissions after account switch.

Limitations: Refresh-token rotation/reuse, all-session logout, licence/maintenance event journeys and broad enum-policy consumption not accepted here.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/app_shell-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Live OT status board (`ot_board`)

0 proposed items; 14 pending; 36 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /ot/status-board` | 3 | GET /ot/status-board |
| Pending | `ev:ot.status.updated` | 2 | ot.status.updated |
| Pending | `rule:01511e9050` | 2 | 🟢 Available / 🔴 In-Surgery / 🟡 Cleaning-Prep / ⚠ Emergency hold; no patient names on this board. |
| Pending | `rule:cc0fcec2de` | 2 | Exists for the service surgery (work): show it as GET /establishment views.screens says for screen_id ot_board (full; open_work: without its new work, with the banner "No new ... from now on"; records: history and corrections only; setup: only from Facility settings; hidden: in no menu), after login and again on establishment.changed. Never decide it from the profile's category. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### My committees (`my_committees`)

0 proposed items; 17 pending; 46 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /committees` | 3 | GET /committees |
| Pending | `ep:GET /committees/{committee_id}` | 3 | GET /committees/{committee_id} |
| Pending | `ep:GET /committee-meetings/{meeting_id}` | 3 | GET /committee-meetings/{meeting_id} |
| Pending | `ep:POST /committee-meetings/{meeting_id}/finalize` | 3 | POST /committee-meetings/{meeting_id}/finalize |
| Pending | `ep:GET /committee-meetings/{meeting_id}/pdf` | 3 | GET /committee-meetings/{meeting_id}/pdf |
| Pending | `rule:d7f2f47fe7` | 2 | Show only when GET /committees is not empty. A chair sees 'Approve the minutes' while can_finalize. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### PHC inspection interview practice (`interview_practice`)

0 proposed items; 31 pending; 79 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /msds/interview-prep/my-deck` | 3 | GET /msds/interview-prep/my-deck |
| Pending | `ep:GET /msds/interview-prep/questions/{key}` | 3 | GET /msds/interview-prep/questions/{key} |
| Pending | `ep:POST /msds/interview-prep/rehearsals` | 3 | POST /msds/interview-prep/rehearsals |
| Pending | `ep:GET /msds/interview-prep/my-progress` | 3 | GET /msds/interview-prep/my-progress |
| Pending | `ep:GET /msds/interview-prep/questions` | 3 | GET /msds/interview-prep/questions |
| Pending | `ep:GET /msds/interview-prep/roles` | 3 | GET /msds/interview-prep/roles |
| Pending | `ep:GET /msds/interview-prep/pocket-guide/pdf` | 3 | GET /msds/interview-prep/pocket-guide/pdf |
| Pending | `ep:GET /msds/interview-prep/pocket-guide` | 3 | GET /msds/interview-prep/pocket-guide |
| Pending | `ep:GET /msds/interview-prep/mock-interviews` | 3 | GET /msds/interview-prep/mock-interviews |
| Pending | `ep:GET /msds/interview-prep/mock-interviews/{mock_interview_id}` | 3 | GET /msds/interview-prep/mock-interviews/{mock_interview_id} |
| Pending | `ev:msds.mock_interview.recorded` | 2 | msds.mock_interview.recorded |
| Pending | `rule:822b1b2a4c` | 2 | Login card (every workspace, msds.interview.practice): `question_of_the_day` from GET .../my-deck with a 'Practise' button; hide it when null. |
| Pending | `rule:9433c2daf8` | 2 | Flashcard: show the question (and, on 'Ask it differently', one of `variants`); the user answers aloud or in their head; 'Show the answer' reveals `model_answer`, then the `key_points` as a checklist; three buttons Knew / Partly / Didn't know → POST .../rehearsals; then the next card of `due`. Show `follow_ups` as 'The surveyor may ask next', `pitfalls` as 'Avoid', `show_me` as 'Be ready to show'. |
| Pending | `rule:31689f4042` | 2 | The aim is that staff can explain what they actually do, as the hospital's SOPs say: never present the model answer as a script to memorise. Show under every answer: 'If a key point is not true on your ward, tell your in-charge: it is a gap to fix, not a line to learn.' (the answer's `notice`, in its language) |
| Pending | `rule:8eaf4f3a70` | 2 | Facts: values from the hospital's settings are already filled in `model_answer`; a fact with `set` false shows as a bracketed prompt: never invent a value. |
| Pending | `rule:2c6098a537` | 2 | Badges: the PHC type (Mandatory red, Operational yellow, always with its word), the indicator number in the hospital's category (`indicators_in_category`), 'Adapted to our SOP' when `adapted`. |
| Pending | `rule:37a6a162fb` | 2 | Progress (GET .../my-progress): ready %, the streak, per chapter knew / partly / not known / not rehearsed; the last mock interview with its score (open it: GET .../mock-interviews/{id}). |
| Pending | `rule:e7e8d9750a` | 2 | Browse all (GET .../questions?mine=true, then any role) and 'Print my pocket guide': in English GET .../pocket-guide/pdf (a PDF: one click, one file); in Urdu GET .../pocket-guide?lang=ur, laid out by the app right to left and printed from the terminal (the server's PDFs are Latin script only). |
| Pending | `rule:4a0279ed53` | 2 | INTERVIEW_QUESTION_NOT_APPLICABLE: the hospital took the question out; drop the card and refresh the deck. |
| Pending | `rule:d62517f7ac` | 2 | Language (the vendor's request of 2026-10-09): send `lang` (en or ur) or rely on the user's preference (PUT /settings/me language); every answer says its `lang`, so offer an English / اردو switch on every card. Urdu (`direction` rtl): lay the texts out right to left in Noto Nastaliq Urdu (bundled in the app); medicine names, test names and the hospital's own records inside stay in English as typed. `text_status` Draft: show 'Draft translation' beside the answer until the vendor's native-speaker review; `question_en` gives the English wording a surveyor may use. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### Mock PHC interviews (`mock_interviews`)

0 proposed items; 26 pending; 67 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /msds/interview-prep/staff` | 3 | GET /msds/interview-prep/staff |
| Pending | `ep:GET /msds/interview-prep/mock-interviews/plan` | 3 | GET /msds/interview-prep/mock-interviews/plan |
| Pending | `ep:POST /msds/interview-prep/mock-interviews` | 3 | POST /msds/interview-prep/mock-interviews |
| Pending | `ep:GET /msds/interview-prep/mock-interviews` | 3 | GET /msds/interview-prep/mock-interviews |
| Pending | `ep:GET /msds/interview-prep/mock-interviews/{mock_interview_id}` | 3 | GET /msds/interview-prep/mock-interviews/{mock_interview_id} |
| Pending | `ep:GET /msds/interview-prep/roles` | 3 | GET /msds/interview-prep/roles |
| Pending | `ep:GET /msds/interview-prep/questions/{key}` | 3 | GET /msds/interview-prep/questions/{key} |
| Pending | `ep:GET /quality/actions` | 3 | GET /quality/actions |
| Pending | `ev:msds.mock_interview.recorded` | 2 | msds.mock_interview.recorded |
| Pending | `rule:cf99be4eab` | 2 | Only for msds.interview.conduct. Pick the member of staff (GET .../staff; staff without a login are listed too, `is_me` greyed) and the role, then 'Plan' → GET .../mock-interviews/plan (count 6): the questions with their `reason`; the examiner may swap any for another of the role (GET .../questions?role=). |
| Pending | `rule:5df569b294` | 2 | During the interview show the examiner one question at a time with its `key_points` (GET .../questions/{key}) and, hidden behind a toggle, the model answer; never show the answer to the person questioned. |
| Pending | `rule:9d0ad34c4c` | 2 | Each answer: Met / PartlyMet / NotMet; a note is required unless Met (VALIDATION_ERROR). When the answer shows a gap in PRACTICE (the SOP is not followed, equipment is missing) offer 'Raise an action': type, description, owner (a user_id from GET .../staff), due date. |
| Pending | `rule:47e19cee10` | 2 | Save once at the end → POST .../mock-interviews with an Idempotency-Key; show the score and the actions (they appear in the action register, GET /quality/actions?source=MockInterview). MOCK_INTERVIEW_SELF: nobody examines themselves. |
| Pending | `rule:4a2a1094dc` | 2 | History: GET .../mock-interviews (filters: employee, role). Staff without conduct see only their own. |
| Pending | `rule:bee150cdf4` | 2 | Language: the plan, the questions and the reasons come in the examiner's language (`lang`); ask in the language the member of staff works in, as the surveyors do. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### My personnel record (`my_personnel_record`)

0 proposed items; 17 pending; 46 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /personnel/me` | 3 | GET /personnel/me |
| Pending | `ep:GET /personnel/appraisals/{appraisal_id}` | 3 | GET /personnel/appraisals/{appraisal_id} |
| Pending | `ep:POST /personnel/appraisals/{appraisal_id}/acknowledge` | 3 | POST /personnel/appraisals/{appraisal_id}/acknowledge |
| Pending | `ep:GET /personnel/appraisals/{appraisal_id}/pdf` | 3 | GET /personnel/appraisals/{appraisal_id}/pdf |
| Pending | `ep:GET /personnel/appraisal-policy/pdf` | 3 | GET /personnel/appraisal-policy/pdf |
| Pending | `rule:e31714fa44` | 2 | A signed appraisal not yet acknowledged shows a button: read it, add your comments, acknowledge. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

### Equipment requisitions (`equipment_requisitions`)

0 proposed items; 22 pending; 59 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:GET /facility/equipment-requisitions` | 3 | GET /facility/equipment-requisitions |
| Pending | `ep:GET /facility/equipment-requisitions/{requisition_id}` | 3 | GET /facility/equipment-requisitions/{requisition_id} |
| Pending | `ep:POST /facility/equipment-requisitions` | 3 | POST /facility/equipment-requisitions |
| Pending | `ep:POST /facility/equipment-requisitions/{requisition_id}/options` | 3 | POST /facility/equipment-requisitions/{requisition_id}/options |
| Pending | `ep:POST /facility/equipment-requisitions/{requisition_id}/evaluations` | 3 | POST /facility/equipment-requisitions/{requisition_id}/evaluations |
| Pending | `ep:POST /facility/equipment-requisitions/{requisition_id}/decide` | 3 | POST /facility/equipment-requisitions/{requisition_id}/decide |
| Pending | `ep:POST /facility/equipment-requisitions/{requisition_id}/purchased` | 3 | POST /facility/equipment-requisitions/{requisition_id}/purchased |
| Pending | `ep:POST /facility/equipment-requisitions/{requisition_id}/cancel` | 3 | POST /facility/equipment-requisitions/{requisition_id}/cancel |
| Pending | `rule:4364cb281f` | 2 | Show each model with its evaluations (score 1-5, remarks, who) and their average. |
| Pending | `rule:28f12beb07` | 2 | The decision names one evaluated model and the reason; the person who asked never decides (SELF_APPROVAL_FORBIDDEN), and the chosen model needs an evaluation by someone other than the decider (EQUIPMENT_EVALUATION_REQUIRED). |
| Pending | `rule:415405e53e` | 2 | What was asked for never changes: cancel and raise a new requisition instead. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

## Other implemented screens

### Facility settings: PHC profile and services (`facility_profile`)

10 proposed items; 23 pending; 83 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /establishment` | 3 | GET /establishment |
| Proposed | `ep:GET /establishment/profiles` | 3 | GET /establishment/profiles |
| Proposed | `ep:POST /establishment/changes/preview` | 3 | POST /establishment/changes/preview |
| Pending | `ep:POST /establishment/changes` | 3 | POST /establishment/changes |
| Proposed | `ep:GET /establishment/changes` | 3 | GET /establishment/changes |
| Pending | `ep:GET /establishment/changes/{change_id}` | 3 | GET /establishment/changes/{change_id} |
| Proposed | `ep:GET /establishment/staffing` | 3 | GET /establishment/staffing |
| Proposed | `ep:GET /msds/profile` | 3 | GET /msds/profile |
| Proposed | `ep:GET /msds/category-confirmations` | 3 | GET /msds/category-confirmations |
| Proposed | `ep:GET /facility/compliance-documents` | 3 | GET /facility/compliance-documents |
| Pending | `ev:establishment.changed` | 2 | establishment.changed |
| Pending | `ev:notification.created` | 2 | notification.created |
| Pending | `rule:fb5d58927a` | 2 | Facility-wide, not a personal preference: open it from the admin's Settings entry (establishment.manage), never from the avatar's Settings modal. |
| Pending | `rule:439b25f03d` | 2 | A 'Staff and duties' tab: GET /establishment/staffing after every applied change (and on opening). Show NobodyHolds and NeedsSecondPerson in amber with the message and solo_alternative; never offer to weaken a rule. NotApplicable rows are greyed (the service is not running). |
| Pending | `rule:2186908367` | 2 | Top: the profile (label, PHC number, effective date, framework and its indicators) and, from GET /msds/profile, what the beds suggest (`note`) with the wards table (emergency wards are not counted). needs_confirmation true: a banner 'Record the category on your PHC licence'. Never change it by yourself: the licence decides, not the bed count. |
| Pending | `rule:41ad66d2e2` | 2 | Services: one row per capability with its state (Available / Preparing / Active / Retiring / Retired), what it needs (`requires`) and its open work (`outstanding`); a service with `implemented` false (none in this release) gets no button. |
| Pending | `rule:5f2ff80ae5` | 2 | First setup and every later change are one form: the profile (category from GET /establishment/profiles, pre-tick its `preset`; the person decides each service), the number, the licence from the compliance register (GET /facility/compliance-documents?category=Hospital), the date it took effect, the reason. |
| Pending | `rule:e7d506358d` | 2 | Always preview first (POST /establishment/changes/preview) and show it in full: each move in order, its prerequisites (met or missing), the open work of each service being retired, the framework change, the warnings and every `problems` line. Apply is disabled while `allowed` is false. |
| Pending | `rule:6e415061c3` | 2 | Apply (POST /establishment/changes) sends the previewed `revision` as expected_revision and the codes of every acknowledgement the person ticked (each shown as a checkbox with its message). VERSION_CONFLICT: someone else changed it; preview again. CONFIRMATION_REQUIRED: tick what details.acknowledgements lists. |
| Pending | `rule:6e65a8d8d4` | 2 | Retiring a service with open work: say it plainly ('No new admissions from now on; the 3 admitted patients continue to discharge; their records stay'). Retired only when nothing is open. |
| Pending | `rule:860944dc27` | 2 | Becoming a clinic: inpatient care, the emergency department and the theatre cannot stay Active; the preview says so. Going back to a hospital rechecks every prerequisite (an earlier activation proves nothing). |
| Pending | `rule:fd4552dd74` | 2 | History: GET /establishment/changes (who, when, why, before and after, the open work at that moment) and GET /msds/category-confirmations (each recorded category with its date). A reversal is a new change. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Facility.tsx; src/facility-recovery.ts; tests/phase1-followups.test.mjs.

Evidence: Historical live reads covered establishment, profiles, staffing, MSDS/profile, confirmation/history and compliance register plus a real preview. Historical foundation stored an UNSENT draft from a real preview, restarted/relogged, read real history and closed the known-unsent attempt without apply. Current tests cover immutable identity/body/expiry/isolation/durable action records. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Owner Settings > Facility, read status/staff/history, preview a draft, inspect F1. Follow PHASE1_MANUAL_TEST.md for coordinated apply/recovery testing.

Limitations: No Facility apply/retry performed; actual committed-lost-reply, profile/service transition, cross-window event and server refusal lifecycle remain pending.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/facility_profile-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Charity approvals (`charity_approvals`)

5 proposed items; 15 pending; 51 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:GET /approvals` | 3 | GET /approvals |
| Proposed | `ep:GET /approvals/{request_id}` | 3 | GET /approvals/{request_id} |
| Pending | `ep:POST /approvals/{request_id}/approve` | 3 | POST /approvals/{request_id}/approve |
| Pending | `ep:POST /approvals/{request_id}/reject` | 3 | POST /approvals/{request_id}/reject |
| Pending | `ev:approval.requested` | 2 | approval.requested |
| Pending | `ev:approval.resolved` | 2 | approval.resolved |
| Pending | `rule:20bd1ddd69` | 2 | The queue holds only the requests this officer may decide (GET /approvals lists by permission): charity and social-welfare overrides. |
| Proposed | `rule:e686c02df0` | 2 | Reject requires a note. |
| Pending | `rule:2a188dbe97` | 2 | You can never approve your own request (SELF_APPROVAL_FORBIDDEN). |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Proposed | `q:handbook` | 3 | Handbook page |
| Proposed | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Approvals.tsx; src/approval-policy.ts; src/generated/charity_approvals.ts.

Evidence: Shared Approvals component calls list/detail and enforces nonblank reject note. Historical foundation captured charity screen and bilingual help; generic approval-policy unit tests pass today. Endpoint evidence is shared component wiring plus historical generic queue execution, not a new charity decision. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: As permitted welfare officer open Charity approvals, inspect permitted queue/details/help and rejection note; cancel confirmation without deciding.

Limitations: No charity approval/rejection, pharmacy handover or own-request live refusal. Full charity-only queue type coverage is not established; broad rules pending.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/charity_approvals-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### New registration + OPD slip (`registration`)

11 proposed items; 19 pending; 77 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Proposed | `ep:POST /patients/{patient_id}/documents` | 3 | POST /patients/{patient_id}/documents |
| Proposed | `ep:GET /patients/{patient_id}/documents` | 3 | GET /patients/{patient_id}/documents |
| Proposed | `ep:GET /patient-documents/{document_id}/download` | 3 | GET /patient-documents/{document_id}/download |
| Proposed | `ep:POST /patients` | 3 | POST /patients |
| Proposed | `ep:POST /opd-tickets/{ticket_id}/pay` | 3 | POST /opd-tickets/{ticket_id}/pay |
| Proposed | `ep:POST /reception/registrations` | 3 | POST /reception/registrations |
| Proposed | `ep:GET /finance/service-catalog` | 3 | GET /finance/service-catalog |
| Proposed | `ep:GET /opd-tickets/{ticket_id}/print-payload` | 3 | GET /opd-tickets/{ticket_id}/print-payload |
| Proposed | `ep:GET /opd-queues/reception-dashboard` | 3 | GET /opd-queues/reception-dashboard |
| Proposed | `ep:GET /staff/lookup` | 3 | GET /staff/lookup |
| Pending | `ev:opd.queue.updated` | 2 | opd.queue.updated |
| Pending | `rule:729d6adf26` | 2 | Always send an Idempotency-Key header: one UUID per registration the user starts, the same one on every retry of it (a second click after a lost answer is a retry), so a retry never double-charges. |
| Proposed | `rule:72363c4772` | 2 | Only name, gender, age/DOB and mobile are required for Regular patients; CNIC optional. |
| Pending | `rule:66ed513e91` | 2 | Patient Photo is OPTIONAL here and everywhere (never a required field, never a blocker): offer 'Take photo' (camera) or 'Choose file' (JPEG or PNG), preview, retake, and 'Skip' needing no reason. Ask first; respect a refusal (purdah, privacy) and never delay an emergency, an injured face or a patient who cannot cooperate. Upload it after the patient exists: POST /patients/{patient_id}/documents doc_type=Photo, its own Idempotency-Key, so a failed upload never repeats a registration, a payment or an admission. Show photo_document_id (patient, admission) through GET /patient-documents/{document_id}/download. |
| Pending | `rule:794ff452da` | 2 | 'Reports brought by the patient' (optional, any number): file (PDF, or a JPEG/PNG scan or photo of the paper), type (LabReport, Imaging, DischargeSummary, Prescription, ReferralLetter, Other), title (the test or report, e.g. 'CBC'), issued by (source_facility, required) and the date on it (document_date) → POST /patients/{patient_id}/documents with is_outside=true. List them labelled 'Outside: <facility>, <date>', apart from this hospital's own results: they are never shown or counted as this hospital's lab or imaging results. |
| Pending | `rule:e19c1ca085` | 2 | Discount above the user's ceiling → DISCOUNT_CEILING_EXCEEDED (details.max_pct): issue the ticket within the ceiling, then offer 'Request VIP waiver' with waiver_pct for the rest (Billing Admin / Owner approve). |
| Pending | `rule:17eacdfd42` | 2 | AR_OUTSTANDING_BLOCK: show the dues banner; Emergency source bypasses the block. |
| Pending | `rule:f7c9c90eea` | 2 | Print print_payload.text on the 80 mm thermal printer mapped to this terminal (GET /terminals/whoami). |
| Pending | `rule:937add537d` | 2 | POST /reception/registrations starts new emergency_department work for an emergency patient (source Emergency) without an open emergency visit: offer that choice only while emergency_department is Active (GET /establishment active); the rest of the action stays. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/Registration.tsx; src/screens/RegistrationDocuments.tsx; src/screens/RegistrationActions.tsx; src/StaffPicker.tsx; src/registration-help.ts; src/registration-i18n.ts; electron/opd-print.cjs.

Evidence: Historical registration-check and registration-review reports record synthetic MRN-2026-000007 / OPD-2026-000007, independent photo/outside-report upload/download, print payload/PDF, Card payment/queue, optional patient-only and panel intake. Historical backend-fixes UI tested reception staff lookup. Current multipart/print-safety unit tests pass. See REGISTRATION_REVIEW.md and local artifacts; no business records created today. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Inspect the synthetic historical registration and its documents/slip; for acceptance follow fresh-record review worksheet through app with separate registration/payment/document actions.

Limitations: Historical artifacts were produced before HEAD commit and not independently bound to an exact earlier commit. Cash/bank, staff-linked creation, emergency/dues/ceiling/refusal/lost-answer paths, physical printer/camera and full bilingual/human review remain pending; broad photo rule not proposed because hardware untested.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/registration-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### Patient search (`patient_search`)

3 proposed items; 17 pending; 51 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:PATCH /patients/{patient_id}` | 3 | PATCH /patients/{patient_id} |
| Proposed | `ep:GET /patients/search` | 3 | GET /patients/search |
| Proposed | `ep:GET /patients/{patient_id}` | 3 | GET /patients/{patient_id} |
| Proposed | `ep:GET /patients/{patient_id}/financial-summary` | 3 | GET /patients/{patient_id}/financial-summary |
| Pending | `ev:patient.merged` | 2 | patient.merged |
| Pending | `rule:5c7aabbadf` | 2 | Search as the user types (debounce 250 ms); a USB scanner types an MRN barcode + Enter. |
| Pending | `rule:30c67b70d7` | 2 | If outstanding.has_outstanding_ar: show outstanding.banner_text in a red banner above the patient card. |
| Pending | `rule:fd66e16ee9` | 2 | Merged records resolve to the master record automatically; never show merged duplicates as separate patients. |
| Pending | `rule:abc016fdd8` | 2 | mlc_numbers not empty: a red MEDICO-LEGAL banner with the numbers (MSDS 154). is_deceased: a DECEASED banner (death_at); never start a new visit for a deceased patient. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/PatientSearch.tsx; src/generated/patient_search.ts; scripts/live-check.mjs; scripts/layout-check.mjs.

Evidence: Historical live-check reads searched patients, selected a real result and loaded patient/financial summary. Source binds asynchronous detail/financial results to latest selection and exposes errors; earlier documented layout check inspected search/detail alignment. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Reception > Patient search, search synthetic Codex/SCN record, select result, open patient and financial summary, verify selected identity.

Limitations: PATCH edit/stale-version, merged/deceased lifecycle, scanner or complete role/help/zoom acceptance. Patient edits are not inferred from source alone.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/patient_search-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

### My cash shift (`my_cash_shift`)

2 proposed items; 15 pending; 45 available points.

| Status | Item | Points | Current checklist |
| --- | --- | ---: | --- |
| Pending | `ep:POST /finance/cash-shifts/open` | 3 | POST /finance/cash-shifts/open |
| Proposed | `ep:GET /finance/cash-shifts/mine` | 3 | GET /finance/cash-shifts/mine |
| Proposed | `ep:GET /finance/cash-shifts/{shift_id}/transactions` | 3 | GET /finance/cash-shifts/{shift_id}/transactions |
| Pending | `ep:POST /finance/cash-shifts/{shift_id}/close` | 3 | POST /finance/cash-shifts/{shift_id}/close |
| Pending | `rule:6d79bd21de` | 2 | Every cash action needs an open shift at this counter (node from GET /terminals/whoami cash_node). |
| Pending | `rule:a38ea1222b` | 2 | Closing asks for the counted cash; the Accountant verifies it later. |
| Pending | `q:states` | 2 | Loading, empty and error states |
| Pending | `q:permissions` | 2 | Actions by permission |
| Pending | `q:writes` | 2 | Safe writes |
| Pending | `q:tested` | 4 | Test plan passed |
| Pending | `q:handbook` | 3 | Handbook page |
| Pending | `q:f1_help` | 2 | F1 contextual help |
| Pending | `q:role_faq` | 3 | Complete role-specific FAQs |
| Pending | `q:zoom` | 2 | Keyboard zoom: 100-250% only |
| Pending | `q:fresh_data` | 4 | Human review with newly created data |
| Pending | `q:character` | 3 | Design principles applied |
| Pending | `q:editor` | 2 | Editor's pass |

Files: src/screens/CashShift.tsx; src/generated/my_cash_shift.ts; scripts/live-check.mjs.

Evidence: Current 2026-10-20 live-check successfully read GET /finance/cash-shifts/mine and /finance/cash-shifts/2/transactions as demo.reception; source exposes current shift and ledger without inventing a terminal/counter. No financial writes performed. Current exact-HEAD verification: build and 24 unit tests passed; foundation passed 14 Electron checks with real DEV reads/preference restores; live retry passed 32 requests. See artifacts/progress-foundation-20261020.log, artifacts/foundation-check.json, artifacts/progress-live-20261020.log and artifacts/live-check.json. These suites do not exercise every endpoint or rule proposed: distinguish source wiring from observed execution as described above. Foundation assertions described as historical above were also repeated successfully today where present in the 14-check report; no new screenshot capture. Registration business-write evidence remains dated 2026-10-18.

Reproduction: Reception > My cash shift, inspect server current-shift state and terminal identity; do not open/close a shared cash drawer merely to inspect progress.

Limitations: No open/close/counted-cash writes, new financial records, accountant verification, complete role/help/zoom or human acceptance.

Handbook: `src/help.ts`; foundation control/task/recovery instructions in `src/foundation-help.ts`, `src/foundation-task-map.json`, `src/foundation-errors.ts`, with `public/handbook/my_cash_shift-{en,ur}.png` for the eleven foundation screens only. Registration uses separate authored help; Patient Search/Cash Shift are outside the eleven-screen structural coverage claim.

