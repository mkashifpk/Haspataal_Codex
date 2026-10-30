# Haspataal checkpoint
Last updated: 30 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active new screen request
Implementing Screen 70 `critical_results_ward` ("Critical results of my patients" for Ward Nursing workspace, Phase 4 Inpatient Journey).
- Current status: Implementation starting.
- What we are about to do:
  1. Author domain policies in `src/critical-results-ward-policy.ts` (access checks, filter helpers, status display, overdue and escalation indicators).
  2. Implement `src/screens/CriticalResultsWard.tsx` (critical results list, unit open-only toggle, admission chart filter, detailed communications modal/pane via `GET /critical-results/{id}`, overdue highlights, realtime listener for `critical_result.updated`).
  3. App routing and workspace navigation in `src/App.tsx`.
  4. Register in `src/foundation-catalogue.json` (69 screens) and `src/foundation-task-map.json`.
  5. Add bilingual help, 8 steps, and 7 role FAQs in `src/help.ts`.
  6. Author control guides and update `deliveredHelpScreens` in `src/foundation-help.ts`.
  7. Add `CriticalResultsWard` to `scripts/check-help.mjs`.
  8. Create bundled screenshots `public/handbook/critical_results_ward-en.png` and `public/handbook/critical_results_ward-ur.png`.
  9. Author unit tests in `tests/critical-results-ward.test.mjs` and update `tests/help-coverage.test.mjs` (69 screens).
  10. Integration tests: DEV live reads and event listener verification.
  11. Run `npm run check:help`, `npm run build`, `npm test`.
  12. Submit progress proposal via MCP `propose_progress` and verify with `progress_proposals`.
- Files involved:
  - `contracts/critical_results_ward.json`
  - `src/generated/critical_results_ward.ts`
  - `src/critical-results-ward-policy.ts`
  - `src/screens/CriticalResultsWard.tsx`
  - `src/App.tsx`
  - `src/foundation-catalogue.json`
  - `src/foundation-task-map.json`
  - `src/help.ts`
  - `src/foundation-help.ts`
  - `scripts/check-help.mjs`
  - `public/handbook/critical_results_ward-*.png`
  - `tests/critical-results-ward.test.mjs`
  - `tests/help-coverage.test.mjs`
  - `handoff.md`
- Next concrete step: Author `src/critical-results-ward-policy.ts`.

## Prior task and Git
Screen 69 `own_medicines_pharmacy` (Hospital Pharmacy) completed, tested (253 tests passing), verified live, committed (844f65c & 43e3e46), and proposed (Proposal #221 pending human review).
Pending proposals awaiting human review on /docs -> My progress: #208–#221.

## Backend gaps
#50 New: employee activation returns unlisted 409 EMPLOYEE_DOCUMENT_REQUIRED.
#51 New High: own waiting CodeRed admission 4 never emits vitals.due.
