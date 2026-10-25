# DEV Review code

The human tester opens **Settings → This terminal**, before or after sign-in, and enters the code from a review they started on the portal. **Apply review code** activates it. Empty the field and apply again when finished. It starts empty on each application launch and lives only in the Electron process; changing accounts, workspaces or windows does not clear it. It is separate from personal preferences and is never read from configuration, environment variables or a file.

The shared native request headers include the verified `mkashif` developer and implementation `1`, plus `X-Haspataal-Review` only while a code is active. This applies to normal JSON requests, login/refresh, uploads, downloads, health/address checks and new WebSocket handshakes. The code does not authenticate the tester. No code is logged by this feature.

Agents and scripts must **never enter a code**, including a synthetic test code. Nonempty-code transmission and review-attributed writes are deliberately left for the human portal review. Automated checks only read or clear an empty setting.

## Build boundary

- `npm run build` (or `npm run build:dev`), then `npm start`: DEV renderer and source Electron terminal, with the field and attribution enabled.
- `npm run build:release`: production renderer and bundled Electron main with the compile-time `__BUILD_IS_DEV__` flag set to false. Stages packaging inputs in ignored `artifacts/release-terminal`. Package that staged application, rather than the development source tree. This is not a signed Windows installer.
- The release build verifies that executable renderer/main output contains neither the field labels, review IPC/module nor any of the three header names. No runtime environment variable can turn them back on in that compiled output.

## Verification — 25 October 2026

`npm test`:77 passed. `npm run build` and `npm run build:release`: help coverage (30 screens,557 controls,181 groups), TypeScript and bundle checks passed; existing large chunk warning remains.

`node scripts/review-code-check.mjs`: real DEV reads, exactly one empty field in Settings before login, no field on login or terminal-information dialog, disabled Apply while unchanged, empty clear IPC, English/Urdu public F1 and restored focus, both themes at250%, local display preferences reset. Actual health/settings/terminal requests carry developer/implementation and omit review header. No business writes. First harness attempt failed because `require` was unavailable in the Electron evaluator; corrected to `process.getBuiltinModule`. That attempt also closed its app in finally.

`node scripts/review-code-check.mjs --release`: compiled release runs against real DEV with no field, unsupported review IPC and none of the three DEV headers on actual health/settings/terminal HTTP requests, even when launched unpackaged with local DEV provisioning. Evidence is in ignored `artifacts/review-code-{dev,release}-check.json`.

Human testing remains required: enter your own portal review code, switch roles/windows, perform your review, confirm the portal associates the writes, then clear/apply and confirm subsequent requests are not associated. Automated tests have not performed or claimed this step. Urdu wording awaits human language review.

Backend-reset follow-up25Oct: final DEV xY4otd9s and release Bt4DfijM builds/real HTTP checks passed; empty-code-only policy retained. Source main SHA256 e3f7537918529c1bce13098f16893124e7814ae3601b3cdafa8cc0f02a153911. Public CA calls receive DEV attribution without access tokens; signed-in/provisioned inspection guards refused before HTTP (initial harness assumptions corrected and retained). All tests used no review code. Full backend-refresh details: BACKEND_RESET_REVIEW_2026-10-25.md.
