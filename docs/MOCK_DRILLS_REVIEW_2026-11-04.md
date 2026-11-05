> Historical pre-reset evidence. Backend7429acf supersedes the examples and limitations below; see [current audit](backend-refresh-2026-11-05/AUDIT.md). Never replay old record IDs or keys.

# Screen161 — Mock drills

Codex,2026-11-04; base `main` at `6cd3b4d`. Earlier audit/equipment/compliance work preserved uncommitted. No commit, reset, discard, deployment or human review performed.

## Staff context and implementation

Operations staff review coverage before planning and report a drill after it was held. Done means actual participants/roles, observations and outcome are recorded, the report is signed, and follow-up has an accountable owner/deadline. Coverage opens first, with a department-by-shift grid rather than a generic dashboard; reports and selected detail share a review layout. Existing app controls, safe-write recovery, native viewers, bilingual help and zoom are reused. Design/editor/translation acceptance remains pending.

Full `mock_drills_ops` bundle, generated types, endpoint contracts, quality/design/workspace briefs, handbook outline, connecting guide and facility-compliance workflow read. Contract `f253171154eef6044fa2`, knowledge `bbf3ad4e2e48dc00`, rubric `4e7cb2e8c7b8`, UI standard `7795bdfe5246755d`, server `2026-10-31T00:19:38.433994+00:00`; no omitted bundle sections.

Principal files: `src/screens/MockDrills.tsx`, `src/mock-drills-policy.ts`, generated `mock_drills_ops.ts`/`drill_wards.ts`, full saved contract, App route, native PDF allowlist/session check, scoped styles, catalogue/task/help coverage and two actual handbook images. Five stage actions remain separate: create Draft, complete draft, sign, follow-up action, PDF. No local success, guessed identifier, prefilled successful findings/outcome, facility-category shortcut, offline business write or invented cancellation.

- Server coverage period, signed totals, morning/evening/night counts, missing departments/shifts and staff-drilled/active-staff counts are authoritative. Drafts do not count. Grid exposes department reports since the server period began. RTL counts/time use bidi isolation.
- Report actual kind, scenario, department/ward/area, shift, hospital time, explicit announced answer, agency, measured minutes, participants/roles, observations and outcome. Staff participants use `employee_id`; action owners use actual returned `user_id` and need a login. Name/badge search supports500matches/query; up to500unique participants, roles2–200characters.
- Authorized department directory reused. Ward choices use bed matrix without bed/patient details where permitted, or permitted MSDS profile alternative. Existing historical selections remain visible. No raw ID entry or broader admin-ward grant.
- Shared hospital-time helper converts actual hospital wall time to UTC, rejects missing/invalid timezone, preserves the exact original instant/seconds when an edit leaves time unchanged. Fresh server clock checked before report submission; future reports do not reach a write.
- Whole-report PUT retains original version and replaces the complete participant list. Conflicts preserve draft and require explicit latest comparison/Cancel/reopen. Lost PUT requires read/review, not automatic replay. Shared write controller freezes original actor/key/body and navigation; only idempotent actions offer original retry under24hours.
- Signature confirmation lists missing required findings/outcome/participants. A signed report is frozen, displays the returned author stamp and affects coverage. Follow-up is separate, with real type/description/owner/deadline and server status/overdue flag. Owner notification/completion is the action-register handoff, not fabricated completion here.
- Native authenticated PDF preview/Save validates signature/MIME and session/permission. Saving rechecks the session after the native dialog. Physical printing is not claimed. Failed files never repeat reporting/signing/actions.
- Integration check found the App pending-navigation notice survived after a hold resolved. It now clears using the existing UI clock once no pending marker remains, with translated EN/UR warning text. No backend polling or genuine error suppression. The final real delayed-PDF-dialog test verifies both guard and cleanup.

## Actual DEV evidence

One visibly synthetic **Drill1, DRL-2026-0001**, scenario prefix `SCN161`, was created once and is **Final**. Its one linked **Action1** is **Open**, assigned to the logged-in demo Operations staff user; it is explicitly a synthetic task. No drill cancellation/delete exists here; immutable history remains. Action completion belongs to its register. No patient, payment, medication, actual emergency or actual clinical work recorded.

`scripts/drills-check.mjs` passed its first business journey:

1. Read actual coverage and staff; selected real participant/department/owner IDs and hospital timezone. F1 preserved the unsent scenario. Incomplete Draft creation intentionally lost a real committed response; UI held input/navigation, original-key/body replay returned one record.
2. Missing signing fields blocked the confirmation. Deliberate native negative signing returned `DRILL_REPORT_INCOMPLETE`; Draft had no coverage effect.
3. A real concurrent full-report correction made the UI stale;409 retained its draft. Latest comparison/Cancel/reopen preserved the concurrent agency. Reviewed full participant/observation/outcome update lost its response; read/review reconciled without replaying PUT.
4. Real sign/reply loss/original-key replay produced Final status and actual author stamp; edit/sign disappeared. Department Night/staff coverage increased and UI cells matched server counts.
5. Real action/reply loss/original-key/body replay left one linked action with actual owner login. Final PUT refused `DRILL_FINAL`. Independent final MCP read `d8e51bd0cd024c1ea2e2dd091a28abdb` confirmed Final/one participant/one action.
6. Native PDF preview/signature/Save/cancel, cancellation language switch, empty-search state and actual EN/UR Light/DarkHighContrast100/250 coverage captures passed.

`scripts/drills-access-check.mjs` passed: unsent form/participant layout at250% in both languages/themes, Urdu field F1/focus with retained draft; authenticated PDF followed by logout while Save dialog pending refused/no file written; exact original display preferences restored before logout; Reception route/native PDF denied before HTTP. Independent backend Reception GET returned403 `FORBIDDEN`, request `4102feda432346eba0aa22f00d806b98`.

`scripts/drills-final-read.mjs` passed on the corrected final renderer: actual delayed PDF Save blocks navigation with translated EN/UR notices; cancelling clears the hold and old notice; RTL counts/date direction and final screenshots verified. No business writes repeated for these display fixes. Corrected Urdu screenshot visually inspected.

## Verification and remaining acceptance

Final **860/860 unit tests**,19suites;4new meaningful cases for permissions/runtime views, exact timezone preservation, missing/duplicate participant constraints and full participant payloads. Initial Node test import resolution failure corrected using the repository's existing roll-call test loader pattern; no application test failure hidden. Mandatory build passes help coverage **160screens/4274controls/3201groups**, TypeScript and Vite.35control groups,14-step bilingual page,6role FAQs and workspace context authored together. Final release/restored DEV build results and source/bundle hashes are in `docs/screen161-2026-11-04/delivery-build.json`.

Portable proof: `verification-summary.json`, `endpoints-observed.json` (all9contracted routes), `supporting-contracts.json` in that directory. Exact intents/keys/responses/logs remain ignored under `artifacts/screen161/` and `artifacts/screen161-*.json`. No uncertain write or running test remains at delivery.

Named human fresh-data, Urdu, design/editor review and physical printer/device checks remain pending. No signed human review, Review code entry, entire catalogue or complete workspace is claimed. Shared foundation/live suites were not rerun in this session; their earlier results remain historical. Existing large-bundle warning; no signed installer/deployment. No new backend defect reproduced; correct incomplete/final/permission refusals are expected. Existing documentation issue52 remains tracked separately.

Final DEV `index-Cm738Jgt.js`, SHA256 `3364f695524f4628be1171f736056f6b7cd8379b5f45544618d7b9ec30e15f81`; CSS `index-DxvX8TlT.css`, SHA256 `64b1895c8ef2c8d289ed33e22ea6fd45f9a64023983199aca683e308118bb186`. Release build passed DEV field/header exclusion; restored DEV/hash verified. Proposal **322** saved and reread pending: **awaiting human review on /docs -> My progress**.14tested items only; whole composite printing rule, full test plan and compulsory human items not claimed.
