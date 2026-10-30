# Haspataal checkpoint
Last updated: 30 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active new screen request
Implementing Screen 71 `consents_ward` ("Inpatient ward procedure consents" / "Consents of my patients" for Ward Nursing workspace `ward_nurse`, Phase 4 Inpatient Journey).
- Current status: Implementation in progress.
- What we are about to do:
  1. Update `src/consent-policy.ts` to support multi-category consent action allowances (allowing ward nurse workflows to scan, decide, and inspect Procedure/Operation/Anaesthesia/General consents).
  2. Author `src/screens/ConsentsWard.tsx` exporting `ConsentsWard` (or parameterizing `ConsentsAdmissions.tsx` with `screenId: "consents_ward"`, distinct header, ward-specific purpose, category filter selector, and retiring banner).
  3. App routing and workspace navigation in `src/App.tsx`.
  4. Register in `src/foundation-catalogue.json` (70 screens) and `src/foundation-task-map.json`.
  5. Add bilingual help, 8 steps, and 7 role FAQs for `consents_ward` in `src/help.ts`.
  6. Add `"consents_ward"` to `deliveredHelpScreens` and include `"consents_ward"` in all 19 `consents.*` control guides in `src/foundation-help.ts`.
  7. Add `ConsentsWard` to `scripts/check-help.mjs` if needed.
  8. Create bundled screenshots `public/handbook/consents_ward-en.png` and `public/handbook/consents_ward-ur.png`.
  9. Author unit tests in `tests/consents-ward.test.mjs` and update `tests/help-coverage.test.mjs` (70 screens).
  10. Run live DEV integration reads (`GET /consent-worklist`, `GET /consents?admission_id=1`).
  11. Run `npm run check:help`, `npm run build`, `npm test`.
  12. Submit progress proposal via MCP `propose_progress` and verify with `progress_proposals`.
- Files involved:
  - `contracts/consents_ward.json`
  - `src/generated/consents_ward.ts`
  - `src/consent-policy.ts`
  - `src/screens/ConsentsAdmissions.tsx`
  - `src/screens/ConsentsWard.tsx`
  - `src/App.tsx`
  - `src/foundation-catalogue.json`
  - `src/foundation-task-map.json`
  - `src/help.ts`
  - `src/foundation-help.ts`
  - `public/handbook/consents_ward-*.png`
  - `tests/consents-ward.test.mjs`
  - `tests/help-coverage.test.mjs`
  - `handoff.md`
- Next concrete step: Update `src/consent-policy.ts` and inspect `ConsentsAdmissions.tsx`.

## Prior task and Git
Screen 70 `critical_results_ward` (Ward Nursing) completed, tested (256 tests passing), verified live, committed (`6eca646`), and proposed (Proposal #222 pending human review).
Pending proposals awaiting human review on /docs -> My progress: #208–#222.

## Backend gaps
#50 New: employee activation returns unlisted 409 EMPLOYEE_DOCUMENT_REQUIRED.
#51 New High: own waiting CodeRed admission 4 never emits vitals.due.
