# Tariff — implementation checkpoint

2026-10-23 Codex, implementation1, main467f416 plus preserved uncommitted work. Single Phase2 screen tariff_display, position20. Implementation checkpoint ready for manual review; full MCP screen/human acceptance remains pending.

## Delivered

Reception → Tariff reads GET /tariff and displays the hospital name, server as-of date and currency. Services are grouped by the server's categories, wards show daily charges (null is Price not listed, never zero), and laboratory tests show code/section/price. Local category/search/reset controls do not mutate prices or the downloaded PDF. Refresh and deliberate retry read current values; loading/error hides older prices.

Print / save tariff PDF uses authenticated GET /tariff/pdf through the secure Electron allowlist. It validates PDF media/signature, preserves server errors, handles expired/revoked authentication, and opens the native Save dialog. Only successful saving reports saved; cancellation reports no save. The user opens that saved official PDF in a PDF reader to print; no physical printing is claimed. The PDF is complete regardless of screen filters. Repeated clicks while pending cannot open parallel download/save flows. The original sentinel-list download remains allowlisted with its own fixed filename; arbitrary renderer paths/filenames are refused.

English/Urdu help, actual control instructions, reception task answers, screenshots and existing shared zoom accompany the screen. Shared App startup navigation now preserves an opened working screen when the asynchronous initial workspace selection completes.

## Changed files

src/screens/Tariff.tsx; src/App.tsx; electron/main.cjs; src/generated/tariff_display.ts; contracts/tariff_display.json; src/help.ts; src/i18n.ts; src/foundation-help.ts; src/foundation-catalogue.json; src/foundation-task-map.json; src/style.css; scripts/check-help.mjs; scripts/tariff-check.mjs; tests/help-coverage.test.mjs; public/handbook/tariff_display-{en,ur}.png.

## Evidence

- Final npm run build PASS: handbook19screens/279controls/80groups/33FAQseeds/30workspaceguides, TypeScript and Vite. Existing bundle-size warning remains.
- npm test 52 PASS. No source changes during final live run or final packaging; renderer index-0NhITCnI.js unchanged after media capture.
- Real DEV Electron DEMO-TARIFF-1792737262946, 5 PASS:
  1. Exact current service/ward/lab prices, date/currency/grouping, category/search/no-match/reset, F1 filter/focus preservation, startup context retained, unauthenticated PDF and arbitrary download route refused.
  2. Official PDF200 saved bytes match observed real response hash. Save and cancellation choices automated by harness at native boundary; pending doubleclick issued one download. Complete official PDF unaffected by filters.
  3. Two actual tariff read responses intentionally lost after receipt reached visible tariff error and hid stale tables; explicit retry recovered. EN/UR Light/DarkHighContrast at 250 captured with no page horizontal overflow. Actual tariff unchanged and ZERO business writes observed.
  4. Native Electron keyboard zoom: `Ctrl+=` increments up to 250% upper bound with stable layout, `Ctrl+0` resets to 100%, `Ctrl+-` lower bound clamped to 100%. Opening new reception window inherits confirmed 120% zoom. Sign out and re-login as owned user 34 restores confirmed 120% zoom from server preferences on Tariff screen.
  5. Read-only permission matrix verified: unauthenticated `GET /tariff` and `GET /tariff/pdf` return 401 UNAUTHORIZED; clinical role `demo.doctor` reads 200 OK for both; write attempts (`POST /tariff`) return 405/404 method refusal. Recorded in `docs/tariff-access-checks-2026-10-23.json`.
- Only separately owned user34 test credentials/active state/preferences changed; original preferences restored, account inactive and all admin/read attempts finished. No patient, visit, payment, approval, cash-back or catalogue mutation.
- Source/native/build/media/PDF/journal hashes: `docs/tariff-build-2026-10-23.json`. Local ignored `artifacts/tariff-passed-20261023.json` and `tariff-native-passed-20261023.json` do not travel with Git.

First live run found the asynchronous workspace navigation race, corrected in the frontend. The second stopped because the harness's global alert selector matched both the legitimate shell connection banner and tariff error during fault injection; scoped to the tariff error, final run passed. Cleanup completed after each. No backend defect inferred from either.

## Limits and backend

Server2026-10-23T05:05:34.846311+00:00, contract57d137222f1ca637655d, rubricd81d43f195f8 unchanged. Backend14 refund.ready amount string remains New;13 Fixed and previously retested. No new backend issue reproduced. Proposal66 Patient document vault now ACCEPTED on session-start read, without establishing full-screen acceptance.

Human fresh upstream price review/worksheet, complete role journeys/FAQ, native Urdu/editor review, complete zoom persistence/bounds matrix and physical printing remain pending. No q:tested/full-screen claim. Local screenshots and API tests do not replace human acceptance. Waiting-room automatic category rotation is optional and is not implemented in this checkpoint. No new app_shell checklist item is established by the shared startup guard; no empty or duplicate App-shell proposal.

## Manual test

1. Open Reception → Tariff. Verify hospital/date/currency and published service, ward daily and lab prices. Search/filter, choose a no-match query, then Show all prices and Refresh tariff.
2. Leave a filter active and choose Print / save tariff PDF. Cancel once, then save; the PDF must contain the complete official tariff. Open it in a PDF reader and physically print for the desk. Check legibility and record printer results.
3. Press F1 from the search field, close help and verify focus/filter; try Urdu, both themes and keyboard/Settings zoom100–250%. Verify failures offer retry and do not present old prices as current.
4. For the fresh-data acceptance gate, coordinate a labelled fresh upstream price with authorized setup staff; this read-only checkpoint deliberately did not edit shared catalogues. Record the read-only task and supported-operation N/A reasons in the reception worksheet from /docs/api/review-worksheet/reception. Human reviewer fills results/name/build and reviews the proposal on /docs → My progress.

No later screen has been started.

## Progress submission

Proposal67 PENDING submitted and verified with progress_proposals: awaiting human review on /docs -> My progress. Exact payload docs/codex-tariff-display-20261023-v1.json. Claims only GET /tariff, GET /tariff/pdf and grouping ruledd1fb082cf. No agent approval or human worksheet result asserted.
