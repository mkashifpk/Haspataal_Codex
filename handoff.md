# Haspataal checkpoint
Last updated: 30 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active new screen request
Implementing Screen 69 `own_medicines_pharmacy` ("Identify patients' own medicines" for Hospital Pharmacy workspace, Phase 4 Inpatient Journey).
- Current status: Implementation starting.
- What we are about to do:
  1. Author domain policies in `src/own-medicines-pharmacy-policy.ts` (access checks, validation for identification, formulary matching, and location updating).
  2. Implement `src/screens/OwnMedicinesPharmacy.tsx` (worklist queue, admission own medicines reader, formulary drug search with live stock, LASA/high-alert warnings, identification form with `useClinicalWrite`, event-driven refresh for `notification.created`, `system.*`, `session.*`).
  3. App routing and workspace wiring in `src/App.tsx`.
  4. Update catalogues: `src/foundation-catalogue.json` (68 screens), `src/foundation-task-map.json`.
  5. Add bilingual help, 8 steps, and 7 role FAQs in `src/help.ts`.
  6. Author control guides and update `deliveredHelpScreens` in `src/foundation-help.ts`.
  7. Add `OwnMedicinesPharmacy` to `scripts/check-help.mjs`.
  8. Create bundled screenshots `public/handbook/own_medicines_pharmacy-en.png` and `public/handbook/own_medicines_pharmacy-ur.png`.
  9. Unit tests in `tests/own-medicines-pharmacy.test.mjs` and update `tests/help-coverage.test.mjs` (68 screens).
  10. Integration tests: DEV live reads and request schema validation.
  11. Run `npm run check:help`, `npm run build`, `npm test`.
  12. Submit progress proposal via MCP `propose_progress` and verify with `progress_proposals`.
- Files involved:
  - `contracts/own_medicines_pharmacy.json`
  - `src/generated/own_medicines_pharmacy.ts`
  - `src/own-medicines-pharmacy-policy.ts`
  - `src/screens/OwnMedicinesPharmacy.tsx`
  - `src/App.tsx`
  - `src/foundation-catalogue.json`
  - `src/foundation-task-map.json`
  - `src/help.ts`
  - `src/foundation-help.ts`
  - `scripts/check-help.mjs`
  - `public/handbook/own_medicines_pharmacy-*.png`
  - `tests/own-medicines-pharmacy.test.mjs`
  - `tests/help-coverage.test.mjs`
  - `handoff.md`
- Next concrete step: Author `src/own-medicines-pharmacy-policy.ts`.

## Prior task and Git
Screen 68 `own_medicines_ward` (Ward Nursing) completed, tested (249 tests passing), verified live, committed (754dc7f & 079028a), and proposed (Proposal #220 pending human review).
Pending proposals awaiting human review on /docs -> My progress: #208–#220.

## Backend gaps
#50 New: employee activation returns unlisted 409 EMPLOYEE_DOCUMENT_REQUIRED.
#51 New: own waiting CodeRed admission 4 never emits vitals.due.
