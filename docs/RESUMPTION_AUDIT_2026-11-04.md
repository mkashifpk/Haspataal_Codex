# Resumption audit — 4 November 2026

## Reconstructed state and scope

Codex resumed at `6cd3b4d` on `main`. The previous Codex checkpoint `73522ca` is followed by 146 commits affecting 649 files (+571636/-3455 lines), largely screens, saved contracts and help. All commits use a shared human Git identity: author metadata cannot establish exactly which agent wrote each change. This is a prioritized audit of that handover, not an exhaustive certification of every screen or database operation.

The original modified handoff is preserved verbatim in `docs/handoff-antigravity-2026-11-04.md`. Its phase-completion and pending-proposal summaries were stale. The connected MCP identity is `mkashif`, implementation **1**, rubric `4e7cb2e8c7b8`, backend build `2026-10-31T00:19:38.433994+00:00`. Portal reads confirmed proposals **229–310 accepted**, 23 older proposals pending, **no signed human workspace reviews**, and zero complete screens/workspaces. Accepted individual claims do not establish workspace acceptance.

Seven untracked equipment-maintenance files were already present, alongside the handoff edit. They have been preserved without modification. The next roadmap screen is **158, equipment_maintenance**; it has not been integrated into navigation/help and is not ready for a completion proposal.

## Verified frontend defects and changes

| Priority | Reproduction and root cause | Remedy / evidence |
|---|---|---|
| High | Give Payroll `roles: ['hr_admin']` and `permissions: []`; the policy grants write actions. Operations similarly trusts `ops_admin`, `maintenance_admin` and `super_admin`. Component fallback props manufacture administrative permissions and user ID 1. | Removed role-based grants and fabricated identity/permission defaults. Explicit empty permissions prevail. Tests exercise role-only denial, permission-only access and server hidden/records views. Backend authentication was never bypassed by these UI defects. |
| High | Operations cleaning staff can see unrelated clearance stages; policy uses nonexistent generic `ipd.discharge.clear`, and role overrides expose pharmacy/billing actions. | Use the four documented stage-specific permissions, disable unauthorized choices and recheck at submission. Gate independent read requests by actual endpoint permissions. Feed failures are visible. |
| High | Disconnect the kiosk: both offline branches call `triggerFlashOutcome('AttendanceIn')` without a response. Actual bridge errors live under `ApiError.response`, so its top-level error checks also miss offline refusals. | Added bilingual amber **Scan awaiting confirmation**, matching secure-bridge error classification, durable enqueue before feedback, serialized replay, original event IDs and visible replay refusals. No synthetic business success. Unit regressions cover queued formatting and HTTP-refusal classification. Actual reconnect/physical-scanner lifecycle remains untested. |
| High | Kiosk is mounted only in the authenticated workspace branch, despite station-key endpoints requiring no employee login. | Added public station entry and restricted public operator help. Real Electron test opens kiosk without login, checks blank credentials, F1 and Urdu RTL; no patient-search help appears. |
| High | Station credentials are stored as plaintext localStorage; empty installations supply hardcoded demo credentials. | Removed defaults; save/load credentials with Electron native `safeStorage`. Legacy plaintext is removed only after confirmed encrypted save. Actual Windows encryption roundtrip and legacy migration are tested in an isolated profile. The scan queue itself remains ordinary local browser storage, now documented honestly. |
| High | Renderer IPC can supply arbitrary headers that overwrite native authentication/terminal/DEV attribution. | Native allowlist accepts only X-Station-Key on exact station routes and rejects malformed values. Unit tests and real Electron IPC prove Authorization injection is rejected before HTTP. TLS failures remain errors, never fabricated offline successes. |
| Medium | Kiosk queue has a destructive Clear Queue action and replay failures are swallowed. `BedCleaningRecorded` claims cleaning started; SecurityPass claims a door opened without hardware confirmation. | Pending scans cannot be cleared; replay retains unconfirmed entries and shows errors. Outcome text now distinguishes recorded cleaning awaiting discharge clearance and an access scan from physical door operation. |
| Medium | `test:live` always uses `server_urls[0]`. The office LAN address times out while both configured VPN addresses return pinned health 200. | Try configured pinned addresses before login, without changing local configuration or TLS trust. Retest passed **31 real DEV requests**. |
| Medium | `build:release` rejects the renderer because generic handbook text contains DEV-only review-code labels. | Removed developer-only review-code instructions from generic hospital-facing help; retained DEV-only Settings instructions and the mandatory exclusion guard. Release build now passes and confirms field/header exclusion. |

Changed application areas: `src/App.tsx`, Payroll/Ops policies and screens, badge-station policy/screen, Help and bilingual help mappings; `electron/main.cjs`, `station-config.cjs`, `station-security.cjs`; regression tests and live-check address selection. Existing architecture, server contracts, idempotent business writes and release guard are retained.

## Backend and database disposition

No new backend defect was reproduced, so **no backend issue was reported and no backend-team notification is claimed**. This repository is a frontend/Electron terminal, not the backend/database checkout; database internals were not inspected. Real API reads exercise the shared DEV database through its supported API.

MCP evidence, all demo data:

- HR payroll list: **200**, request `ca5170bf15744fb0b3a3921bde9777d6`.
- Reception payroll list: **403**, request `c73166a8571d443c90fa8de3457355d8`.
- Operations work-order list: **200**, request `579a00d22ab74fe18f27649346d75ed2`.
- Unconfigured station profile without credentials: **401 BADGE_STATION_UNKNOWN**, request `05b0dcaeb28144e1917a337f54d162ff` (first native run).

Existing backend issues **#50** (HR employment transitions) and **#51** (CodeRedActive overdue events) are server-reported Fixed in the current build. Commit `1fc0a21` contains a prior refresh. This session did not recreate the fresh Code Red worker/two-client event journey or HR activation journey; do not treat reading Fixed as a new live verification. Remaining old issue statuses and original evidence are preserved in the archived handoff/review files. No new payment, patient, medication or station scan was submitted by this audit. Live checks perform login/logout, reads and a non-applying establishment preview; foundation checks change and restore demo display preferences. Synthetic native-storage credentials are isolated and never used for a business write.

## Verification

- Baseline: **840/840** tests; DEV build passed.
- After substantive fixes: **847/847** tests, including seven new regression cases; TypeScript and help/build checks pass.
- Targeted permission/kiosk/security suites: **32/32** passed.
- Real DEV API check: **31 requests** passed after the harness address fix; the original timeout is preserved as a failed attempt.
- Real DEV Electron foundation regression passed: login, settings, native zoom bounds/reset/persistence, multiwindow state, draft protection, public/authorized help, Urdu and account isolation. Empty approval confirmation case explicitly not exercised.
- `build:release`: passed after correcting generic help; release DEV-material exclusion remains enforced.
- Final DEV build and final native/help/foundation regression results are recorded in `handoff.md` and ignored `artifacts/audit/`. Native checks use actual safeStorage and the real terminal; no mocked backend success or human review code.
- Existing approximately **8.4 MB** JS bundle warning remains. Builds and unit tests do not prove every clinical/financial workflow or physical-device acceptance.

## Remaining audit and roadmap work

1. Review similar role-name/fallback policies elsewhere before accepting more feature claims. A text search found many remaining occurrences; these are audit candidates, not automatically verified vulnerabilities.
2. Complete screen 158 from its existing draft after fresh MCP bundle/design/workspace guidance. Its PDF handler currently calls a JSON-style generated client, then opens an unauthenticated relative URL and announces generation before validating any PDF. Correct it through the existing authenticated native PDF/download path; do not wire this draft into production unchanged.
3. Test real station setup, scanner hardware, offline/reconnect replay and downstream attendance/bed handover with authorized new synthetic fixtures. Pending scans currently use browser storage; no encryption or physical-access hardware integration is claimed.
4. Reconcile stale handbook statements about bed release and review other large handover screens against actual contracts. Complete the named human fresh-data, translation and editor reviews; only the human can sign them on the portal.
5. Revisit old pending proposals without duplicating unchanged accepted work. New proposals for this audited build are listed in `handoff.md`; their payloads and receipts are saved without credentials.

Proposals **311–316** were saved and re-read through `progress_proposals`: kiosk, Payroll, Operations, app shell, login and Help respectively. They are **awaiting human review on /docs -> My progress**. Correction-only payloads, receipts and verification are in `docs/progress-proposals/`; no compulsory human acceptance items were claimed. Final delivery renderer is `index-BO_dJrTo.js`, SHA256 `f6f721865ad73286cb122ddbb1ce475d47df53cf26c857b033e1a4e54c2f9bd5`. Final native migration/public-route and foundation regressions passed, with all command sessions completed.

Work remains uncommitted for review. No pre-existing source changes were discarded, no local secret configuration was added to Git, and no application deployment or signed installer was produced.
