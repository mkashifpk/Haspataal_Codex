# Diagnostic services list — implementation review

Codex/functions,27October2026. Phase3 position43, Reception. Baseline `250478b`; source `5241b4195025163e654e65f6f97be63afe4007a3`, renderer `index-DE73MAgP.js`. Proposal **166** submitted and verified Pending for five tested items: **awaiting human review on /docs -> My progress**. Exact payload/receipt in `docs/diagnostic-services-progress-{payload,receipt}-2026-10-27.json`. This is agent evidence, not named human acceptance.

## Purpose and implementation

Reception staff explain where a test is performed and obtain the current official list to display for patients. Existing card/field/table/error/Help/native-PDF patterns are reused; H09 design-system ownership and H08 Urdu review remain human decisions.

- `src/screens/DiagnosticServicesList.tsx`: official server PDF preview and native Save PDF to print. Every action fetches fresh bytes with NO invented date filters or rewritten/local document. Cancel/error/opened/saved/pending states are distinct; a synchronous single-flight guard prevents repeated clicks. The PDF remains usable for accounts without separate test-catalogue permission.
- Actual permitted `GET /lab/tests` provides local search by test/code/section/partner, InHouse/SendOut filters, reset and refresh. Actual `send_out_partner_name` and `available_24h` are shown. Missing partner asks Lab Admin; false24h asks the department about working hours, never invents closure. No prices or patient data are rendered. Empty/no-match/loading/error/disconnected states avoid stale rows. Actual reconnect rereads; no dedicated catalogue-change event/polling is invented.
- `src/App.tsx`: menu/Help use the actual active workspace handbook and permissions; server hidden view removes the entry. No category branch or new service gate is invented for this ungated document screen.
- `electron/main.cjs`: extends existing strict server-PDF path allowlist for exactly `/diagnostics/services/pdf`, preserving operation-based permission/authentication, session-change and PDF-content checks, protected viewer and separate single-PDF native Save. Friendly default filename. Print is explicitly through the saved PDF reader; cancellation/failure never submits an order/payment or implies physical paper success.
- Exact `contracts/diagnostic_services_list.json`, endpoint snapshot and MCP-generated `src/generated/diagnostic_services_list.ts`. Generator returns unknown for file responses; actual binary delivery deliberately uses the secure existing native PDF transport rather than JSON `api`.
- English/Urdu screen steps, five detailed role FAQs and five control groups, Reception journey, control/task inventory, checker and actual bilingual screenshots. Shared F1/focus/filter preservation and native100–250%zoom retained.

## Verification

See `docs/diagnostic-services-list-evidence-2026-10-27.json` for final live build/outcomes and `scripts/diagnostic-services-list-check.mjs` for reproducible read-only checks. Isolated profiles restore preferences and sign out. No catalogue/partner/patient/order/payment/clinical writes, Review code entry, human signatures or shared master mutations.

Final **143/143 npm tests PASS** and mandatory **npm run build PASS** (TypeScript/43screens/815controls/311controlgroups/40FAQseeds/30workspaceguides). Actual live and final media checks PASS on **index-DE73MAgP.js**; final mandatory rebuild copies corrected full-page media. Syntax and Git diff checks PASS; existing bundle-size warning remains. Actual full-page English/Urdu screenshots visually inspected with title/actions/partner table visible, no overlap or clipping. No source behaviour changed after the successful live run.

Harness history: first one-shot lost GET reply recovered through transport, so error expectation failed. Persistent loss then exercised app-wide failover and timed out; original interrupted profile was reconciled using its encrypted saved session, original preferences PUT/readback and logout/cache removal without token output. Final injected503-after-actual200 tests isolate screen failure (these are NOT real backend503s), then actual retry succeeds. A third harness selected Retry instead of the shared Try again label; corrected. All failed profiles now restored/logged out. Successful suite covers actual catalogue/partner/filter/no-match/F1, actual server-PDF save/cancel/doubleclick/protected preview, instrumented error/no-stale/read-only retry, English/Urdu/both themes250 and native100–250bounds/reset, scoped/native cashier denial. Separate targeted media run corrected retained scroll by capturing full pages from top; all profiles restored/logged out, ZERO business writes. Rerun requires restored/finished prior journal; only this script's own ignored PDF is replaced, never a business journal.

Server API plan: actual Reception download200 PDF; cashier sandbox403FORBIDDEN, request `d63a7da12a454b07a1fb6b5f383d14f3`. Actual original server PDF inspected as one-pageA4 and rendered/visually reviewed; no clipping/overlap. Optional Poppler font warnings did not impair the inspected render; pdftotext was unavailable. No server PDF editing/authoring performed.

## Acceptance limits and backend status

No new backend defect reproduced.27–29 still New/no response on connected build2026-10-26T01:17:08.510356+00:00; contract90f7a429e5aa519d440f/rubric1f3d8a4d9746. Existing reports retained separately. No business write is supported by this screen, so create/update/cancel/concurrency-write cases are not applicable. No backend date filter exists despite dated recorded example; none is sent.

Human checks remain: fresh authorised upstream catalogue/partner changes followed by new PDF/display replacement, actual paper/printer/PDF-reader workflow, complete Reception role-FAQ journey, native Urdu approval, busy-hour/editor/device review and signed portal acceptance. No shared masters changed merely to claim a human review. No full screen/workspace/phase completion claimed.

## Manual testing

1. Reception → **Diagnostic services list**. Confirm actual test/code, In-house/Sent to partner, partner name and24h flag. Search a partner and a nonexistent value; filter/reset/refresh. Explain to a synthetic patient where the actual test is done.
2. **Preview official PDF**: inspect the complete service scope, then close viewer. **Save PDF to print**: first cancel and check no saved claim, then save/open in your PDF reader. Choose your printer and verify paper/legibility before replacing the displayed notice. Search filters must not trim this full document.
3. After an authorised Lab Admin changes the catalogue or partners, obtain a new PDF and replace old notices. Refresh the on-screen lab list; absence of an automatic catalogue notification is expected.
4. Press F1 while search/filter/button has focus; close Help and check focus/search preserved. Test both languages/themes and shared keyboard/Settings100–250%zoom, reset100%. Offline Help works; fresh document/catalogue reads need connection.
5. Human alone starts/signs DEV portal review and supplies any Review code. Agent proposals alone award no points.
