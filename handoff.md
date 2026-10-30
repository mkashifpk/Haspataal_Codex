# Haspataal checkpoint
Last updated: 30 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active new screen request
Implementing Screen 72 `consents_doctor` ("Consents: informed consent and refusal" for Doctor workspace `doctor`, Phase 4 Inpatient Journey).
- Current status: Implementation starting.
- What we are about to do:
  1. Save contract bundle in `contracts/consents_doctor.json` (already saved).
  2. Generated typed client in `src/generated/consents_doctor.ts` (already generated and clean).
  3. Author `src/screens/ConsentsDoctor.tsx` and extend `src/screens/ConsentsAdmissions.tsx` to handle `screenId="consents_doctor"` with doctor clinical title, purpose subtitle, full view default, and category selection.
  4. Wire routing, screen labels, and navigation in `src/App.tsx`.
  5. Register 15 tasks in `src/foundation-catalogue.json` (71 screens) and `src/foundation-task-map.json`.
  6. Add `"consents_doctor"` to `deliveredHelpScreens` and include `"consents_doctor"` in all 19 `consents.*` control guides in `src/foundation-help.ts`.
  7. Authored bilingual English and Urdu screen guidance, 8 steps, and 7 role FAQs for `consents_doctor` in `src/help.ts`.
  8. Reference screenshots: `public/handbook/consents_doctor-en.png` and `public/handbook/consents_doctor-ur.png`.
  9. Authored unit tests in `tests/consents-doctor.test.mjs` and update `tests/help-coverage.test.mjs` (71 screens).
  10. Run live DEV integration checks with doctor credentials.
  11. Verification: `npm run check:help`, `npm run build`, `npm test`.
  12. Submit progress proposal via MCP `propose_progress` and verify with `progress_proposals`.
- Files involved:
  - `contracts/consents_doctor.json`
  - `src/generated/consents_doctor.ts`
  - `src/screens/ConsentsDoctor.tsx`
  - `src/screens/ConsentsAdmissions.tsx`
  - `src/App.tsx`
  - `src/foundation-catalogue.json`
  - `src/foundation-task-map.json`
  - `src/foundation-help.ts`
  - `src/help.ts`
  - `public/handbook/consents_doctor-*.png`
  - `tests/consents-doctor.test.mjs`
  - `tests/help-coverage.test.mjs`
  - `handoff.md`
- Next concrete step: Author `src/screens/ConsentsDoctor.tsx` and update `ConsentsAdmissions.tsx`.

## Prior task and Git
- Screen 71 `consents_ward` (Ward Nursing) completed, tested (259 tests passing), verified live, committed (`edb7350`), and proposed (Proposal #223 pending human review).
- Pending proposals awaiting human review on /docs -> My progress: #208–#223.

## Backend gaps
#50 New: employee activation returns unlisted 409 EMPLOYEE_DOCUMENT_REQUIRED.
#51 New High: own waiting CodeRed admission 4 never emits vitals.due.
