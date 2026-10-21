# Connect to server — foundation closure checkpoint

Implementation 1 / Codex; 2026-10-21. Baseline `8e3d42f` plus the uncommitted files in `foundation-connect-build-2026-10-21-v2.json`. Renderer `index-DgT4A-8I.js`, SHA256 `05fb5995a452459b6b233be915e53a63be5a55421905b802ae556b534a2dd247`; the manifest also identifies the Electron code actually tested. The earlier v1 manifest/payload are retained as immutable reporting-error evidence. Final timer review prevents overlapping recovery cycles; final build/32 tests/6 focused checks passed again. The 14 shared regression checks passed before this last timer-only guard.

## Staff task and implemented changes

Terminal staff starting a shift must reach their own hospital with an IT-verified identity; a network interruption during work must preserve the current task and never repeat a submission. Retained the existing calm connection card, keyboard form and shared shell; no new visual system or motion. Urdu is draft pending native review (H08); frontend pattern ownership remains open (H09).

- Extracted explicit registry → machine provisioning → saved choice → first-run precedence into `electron/provisioning.cjs`. Registry access errors/invalid machine settings fail visibly rather than bypassing managed settings. The unpackaged test configuration substitutes a machine file; it never supersedes policy. Real registry keys/machine settings were not altered by tests.
- Validate every advertised/saved address as an HTTPS origin, retain all real server URLs, save the working address and honor provisioned discovery ports. CA/root checks remain mandatory; URLs/discovery never replace the pin.
- On network failure, probe other pinned addresses before the offline banner. Only GET can be retried automatically; uncertain writes return their original failure. No automatic payment/registration replay.
- WebSocket network failure now triggers address recovery even on an idle screen; retained per-window cursor resumes the real backend stream. Existing backoff is 1/2/5/10/30 seconds, then 30 seconds. Offline writes remain blocked and draft components stay mounted.
- Prevent address/fingerprint edits and duplicate form actions during identity checks. Clear old confirmation when the address changes; show pending feedback and discovery fingerprints in left-to-right text.
- Updated English/Urdu recovery instructions/FAQs and actual first-run handbook screenshots.

## Verification

- `npm run build`: passed, handbook coverage 12 screens / 113 controls; existing Vite chunk-size warning.
- `npm test`: 32 passed, including new provisioning precedence, managed-error and unsafe-address tests.
- `node scripts/connection-check.mjs --capture-handbook`: passed real DEV trust, endpoint reads, alternate failover, no POST replay, native zoom/restart and draft/realtime recovery. Expanded final checks also exercise real discovery, failed CA download, both languages/themes at 250% without horizontal overflow and explicitly inspect real WebSocket replay cursors/completion. See `artifacts/connection-check.json` for the final saved result.
- `npm run test:foundation`: 14 checks passed, including F1/drafts, shared zoom/windows/persistence, real timezone, recovery history, help search/deep links/offline reading and account permission changes. Reads, an unsent recovery draft and restored preferences only.
- Visually inspected refreshed Urdu first-run image and recovered incident draft. Additional images are under `artifacts/connection-*.png`.

Fault injection redirects selected network attempts to a closed TCP port and terminates the actual WebSocket; it does not fabricate server responses, events or records. The failed POST probe is blocked at the socket before reaching DEV. Real successful calls use the pinned DEV backend. The incident draft is never submitted. Demo preferences are restored.

## Remaining acceptance and limits

This screen is **pending full completion**. Named human fresh-data/terminal journey review, full reviewed role FAQs, native Urdu review, independent editor and design/busiest-hour evidence remain outstanding. No human worksheet/results or approval was created. The live screen plan's two public reads were exercised before login; API test-plan evidence does not replace those frontend/human gates.

Policy precedence is exercised through isolated module inputs and actual file/saved/first-run app runs, without writing HKLM or replacing hospital machine configuration. A real policy-managed terminal still needs IT acceptance. All backoff steps are implemented, but extended physical network outage/long-token-expiry conditions and hardware are not certified. App shell's existing uncertain refresh-token behavior must be audited separately; this checkpoint does not certify every session-expiry case.

Backend issue #7 remains the documented New/Low handbook approval-access issue. New issue #8 (New/Medium) records repeated generic propose_progress failures; progress_proposals read-back confirms no proposal for these request keys. Exact original inputs are retained without credentials. Final conservative scope is six items in `foundation-connect-proposal-2026-10-21-v3.json`: provisioning precedence, advertised alternates, loading/empty/error states, public access, the screen API test plan and zoom. Rule `7efe038a18` is excluded because the existing uncertain token-refresh branch can force logout during an extended outage, even though ordinary outage/draft/replay checks pass. This needs App shell work before claiming that whole rule. No accepted items from proposal #16 are resubmitted. Do not claim posting succeeded without server confirmation.

## Human check

With IT, use an isolated terminal/profile to verify provisioning precedence, address/fingerprint mismatch refusal, correct hospital/terminal identity, unplug/reconnect while keeping an unsent draft, and shared zoom/F1 in both languages. Confirm no action is sent while offline and inspect any uncertain saved result before retrying. Record the actual build, reviewer and outcomes in the portal's real worksheet. Existing shared demo drawers/clinical records must not be changed merely to test connection behavior.
