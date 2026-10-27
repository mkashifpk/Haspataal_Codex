# Phase 4 screen 1 — Nursing duty roster

Implemented27October2026, Head Nurse workspace only (catalogue position49). Roll Call and Pending Admissions were not started. Automated verification passed for the working paths below. Existing-duty bed reassignment is blocked by backend report34; full screen/workspace acceptance is not claimed.

## Delivered workflow

- Server-aligned weekly grid, one row per actual shift and every weekday including Sunday; scoped staff column beside the bounded scrolling grid, with responsive English/Urdu layouts. Real HTML dragging and the equivalent keyboard/touch Add duty form.
- Actual ward/department choices, zones, on-call, notes and ward-specific bed labels. Staff scope, active shifts, approved leave and past-day guards; fixed weekly-off hints and public holiday columns from server metadata. No guessed staff/ward/bed IDs.
- In-memory batch, remove-unsent controls, human-readable frozen review, atomic POST and indexed error highlighting. Actual original UUID/body retained for explicit bounded retry; no partial local success.
- Existing-duty delta PATCH with expected_version, fresh original snapshot/actor/permission checks, read-only past days without HR management, reasoned cancellation preserving history.
- Period copy and rotating pattern, explicit whole-scope review, actual created and skipped results/reasons. Week check uses the server's rest/extra-duty results and per-day/per-shift counts; no payroll calculation.
- Open/history swaps, independent accepted-request approval/rejection, immediate agreed cover or two-way swap with optional return duty. Actual employee IDs prevent self-decisions; fresh source/return snapshots and start-time checks. Original/new duties retain swap IDs.
- Debounced roster.changed, roster.swap.updated and reconnect refresh actual reads while preserving drafts. Failed reads hide stale grid/actions. Unknown batch/copy/recorded-swap list reads cannot unlock a replacement; exact-key retry or IT is required. Edit/cancel/swap decisions require exact original IDs, including cancelled/decided history, never absence/name matching. No automatic clinical/state-guard replay.
- Contextual F1, authored English/Urdu screen instructions, task/control mappings and detailed Head Nurse guide/FAQs; native/Settings100–250% shared zoom. No official roster PDF endpoint exists in the screen contract; Help printing remains available. No attendance, payroll, patient care or physical staff commitment is recorded by this screen.

Files: src/screens/DutyRoster.tsx, src/roster-policy.ts, src/generated/duty_roster.ts, contracts/duty_roster.json and meta-duty_roster-support.json; scoped App route, style and bilingual help/catalogue/task maps, policy/coverage tests, real media and guarded regression scripts.

## Contracts / verification

DEV https://hms-dev.netbird.cloud; developer mkashif, implementation1. Server build2026-10-27T06:11:24.313207+00:00, contract8ad8456c41b87dd0031e, knowledge506a43401a2cda4a, rubricf18448c114ef. Required startup, roadmap, full bundle/schemas/examples, quality/design/workspace outline,13endpoint contracts/types/validation, roster recipe/events and screen_test_plan read. Current screen fingerprint rechecked before proposal.

- npm test **173/173 PASS**. Mandatory npm run build **PASS**, including TypeScript and handbook coverage49screens/972controls/391groups/50FAQseeds/30workspaceguides. Existing bundle-size warning only. Final renderer **index-Coauc5RX.js**; final media copy/build keeps that hash.
- Real core batch9duties201 lost after commit, duplicate-click one flight, identical original-key replay SAME9; actual conflict409 index1 rolls back its earlier valid row. Week check NoRestDay/extra-duty1. Concurrent zone edit200 leaves unsent review intact and blocks stale UI PATCH before transport; actual stale expected_version409 also verified.
- Fresh zone-only edit200/version3. Rotated week copy9created; deliberate second copy0created/9skipped, reasons retained; Sunday wraps to Monday. Cancel lost200 reads exact original ID with Cancelled status, one POST/no replay.
- Agreed cover1 immediatelyApproved; accepted request2 independentlyApproved with lost200/exact-ID all-status recovery, one POST. Request3Rejected with required reason and identical-key replay after a lost answer; one decision. Own accepted swap4 has disabled UI decisions and actual403SWAP_SELF_APPROVAL; independent HR rejected it for cleanup. Two-way agreed swap5 cancels both original duties and creates both replacement duties with real IDs/swap linkage.
- Ambiguous single-day copy lost201: a read of matching existing duties cannot enable a replacement; same-key replay confirms0created/1skipped, unchanged target IDs. Past copy rejected before POST. Actual API past-date409, out-of-scope403, stale-version409; Cashier read/write denials403. Non-manager Pharmacy/Nurse UI routes absent.
- In a visible isolated Electron window, actual native HTML drag selected IPC nurse30/Evening2/Nov9. F1 preserved draft/focus; real independent swap event refreshed the screen without losing that draft. Native Electron keys verified250upper/100lower/reset100; English/Urdu and both themes250% layouts pass. Actual socket reconnect rereads roster/staff/week/swaps/beds. Failed real list read hides stale actions; manual refresh recovers.
- Final display verifies actual frozen person/date/shift summary, updated F1 uncertain-write guidance, staff-search no-match feedback, actual empty week, compact controls and final bilingual media with ZERO business writes. PNGs visually inspected during implementation; named editor/translation acceptance remains pending.
- A NEW current Night duty47 assigned own synthetic admission1/bed1 reached demo.nurse's actual GET /ipd/my-beds. Duty47 immediately cancelled; seeded Morning duty1 was not changed. This is API handover evidence, not a claim that the later My beds screen is implemented.

Evidence: duty-roster-evidence-2026-10-27.json, duty-roster-access-evidence-2026-10-27.json, duty-roster-final-display-evidence-2026-10-27.json and duty-roster-cleanup-evidence-2026-10-27.json. Original keys/bodies/receipts and failed test journals stay ignored under artifacts/.

## Backend34 and honest limits

Actual PATCH /rosters/24 expected_version2/zone/bed_ids[2] returned500 INTERNAL_ERROR: Database permission denied (deployment grants are wrong). Exact original reread confirmed version2/old zone/bed1; no partial change or replay. A separate new zone-only edit succeeded; the bed editor stays implemented and displays the real error, with safe recovery. Report34New/Medium is confirmed; saved payload/receipt duty-roster-bed-edit-{issue,receipt}-2026-10-27.json. Retest on a NEW owned duty after fixed_in is deployed; original24 is now Cancelled and must not be reused. No SQL-grant root cause or client-side workaround invented.

The first pointer test ran in hidden Electron and emitted no dragstart events. Its later visible native test passed. An initial selector matched bed1and10 before any write, then was corrected. Supporting endpoint metadata naming initially broke inventory and was fixed without weakening tests. Failed journals remain; completed business scripts were never blindly rerun. Frontend audit additionally closed ambiguous-list recovery and stale form-context gaps. No other backend issue was found by these checks.

Do not claim the full test plan, live approved-leave/fixed-default-off/public-holiday/inactive-staff matrix, HR-only conditional shift-pattern API branch, busy-hour/device/editor/Urdu or signed human gates. Those remain explicit review work. No Review code entered, portal review signed or own proposal approved.

## Cleanup

Owned run DEMO-ROSTER-1793121040141 used an initially empty future scope. All22owned future duties (originals/copies/replacements) are now Cancelled; own current handover47Cancelled. All five own swaps are terminal, none pending. Seed Morning1 remains Active/version1/beds11–14. Every cleanup followed an exact own-note/ID/status read and original journaled request; no uncertain writes or running business commands remain. No actual medicine, patient care, attendance, money, paper or real staff schedule. Earlier Phase3 synthetic clinical fixtures are unchanged.

## Manual test

1. Restart the DEV app and sign in as demo.headnurse. Open Nursing duty roster; choose a current/future week. On actual permitted staff, try both selecting/Add and dragging onto a day/shift. Sunday is a regular column.
2. Add NEW synthetic duties with clear test notes, ward/zone/beds and a night shift. They remain unsent until batch review/confirmation. Verify saved IDs and the week check. Try an overlap and confirm nothing partially saves.
3. Edit a zone/note; try simultaneous edits from another session, then refresh/review. Cancel with a reason and Show cancelled duties to inspect history. Existing-bed change currently has known backend34.
4. Copy only your intended scope, then rotate by1 and inspect both created and skipped lists. Swaps: ask/accept via the appropriate colleague, independently approve/reject; for agreed swaps verify both people's actual duties before confirming. Never invent another real person's agreement.
5. Check F1 from a field/dialog, role FAQs, Urdu, both themes, keyboard/Settings100–250zoom, reconnect and preserved drafts. Use new review records, not the cancelled automated fixtures. Only you may enter a portal Review code or sign a review when you choose to perform acceptance.

Next separate Phase4 screen: Roll Call (position50), after you test this screen or explicitly ask to continue.
