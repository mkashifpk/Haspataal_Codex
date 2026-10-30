# Haspataal checkpoint
Last updated: 30 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active new screen request
Completed Screen 73 `blood_sources` ("Licensed blood sources" for Laboratory & Blood Bank Administration `lab_admin`, Phase 4 Inpatient Journey).
Next screen: Position 74 `blood_request` ("Clinical blood requests", Points: 64).

- Current status: Screen 73 completed, verified live, and submitted for review (Proposal #225).
- Completed checkpoints:
  1. Saved contract bundle in `contracts/blood_sources.json`.
  2. Generated typed API contracts in `src/generated/blood_sources.ts`.
  3. Implemented domain policy in `src/blood-sources-policy.ts` (view states gating, PBTA licence validation, OwnBloodCenter single instance rule, and transfusion service readiness calculation).
  4. Implemented full screen in `src/screens/BloodSources.tsx` supporting:
     - Real-time `establishment.changed` reactive event listener.
     - View state gating (`full`, `open_work` with retiring banner "No new blood sources from now on", `records` read-only mode, `setup` Facility settings mode).
     - Adding licensed blood sources (Regional Blood Center, Partner Hospital Blood Bank, Own Blood Center) with PBTA licence number and optional compliance MOU document linking.
     - Enforcing single instance of `OwnBloodCenter` (`rule:6b54b4330e`).
     - Safe toggle of receiving status (`is_active: false` with `expected_version` concurrency protection, ensuring existing stock units remain usable).
     - Transfusion service readiness indicator (`rule:e20cbf9517`).
     - Client-side idempotency protection via `useClinicalWrite`.
  5. Wired routing, screen labels, view filters, and navigation in `src/App.tsx`.
  6. Registered 5 tasks in `src/foundation-catalogue.json` (72 screens) and mapped in `src/foundation-task-map.json`.
  7. Updated 14 `blood_sources.*` control guides and added `"blood_sources"` to `deliveredHelpScreens` in `src/foundation-help.ts`.
  8. Authored bilingual English/Urdu screen help, 8 steps, and 7 role FAQs in `src/help.ts`.
  9. Added reference screenshots `public/handbook/blood_sources-en.png` and `public/handbook/blood_sources-ur.png`.
  10. Authored unit tests in `tests/blood-sources.test.mjs` (3 test suites) and updated `tests/help-coverage.test.mjs` (72 screens).
  11. Verified live DEV endpoints with real auth (`GET /blood/sources` -> 200 OK returning 2 sources, `GET /facility/compliance-documents` -> 200 OK returning 17 documents, `GET /establishment` -> 200 OK view `full` as `demo.labadmin`).
  12. Full verification suite:
      - `npm run check:help`: PASS (72 screens, 1441 controls, 593 groups, 69 FAQ seeds, 30 workspace guides).
      - `npm run build`: PASS (`index-B6gzOexH.js`, tsc + Vite production bundle).
      - `npm test`: PASS (265/265 tests passing).
  13. Committed working tree in `9e4ec3a`.
  14. Submitted proposal via MCP `propose_progress` (Proposal #225) claiming 18 items (`ep:GET /blood/sources`, `ep:POST /blood/sources`, `ep:PATCH /blood/sources/{source_id}`, `ep:GET /facility/compliance-documents`, `ep:GET /establishment`, `ev:establishment.changed`, `rule:0f1d0cc68d`, `rule:6b54b4330e`, `rule:68fb1eda66`, `rule:e20cbf9517`, `rule:bfedcd1c9e`, `q:states`, `q:permissions`, `q:writes`, `q:handbook`, `q:f1_help`, `q:role_faq`, `q:zoom`).
  15. Verified proposal #225 via `progress_proposals` (confirmed status: `pending`).

- Files involved:
  - `contracts/blood_sources.json`
  - `src/generated/blood_sources.ts`
  - `src/blood-sources-policy.ts`
  - `src/screens/BloodSources.tsx`
  - `src/App.tsx`
  - `scripts/check-help.mjs`
  - `src/foundation-catalogue.json`
  - `src/foundation-help.ts`
  - `src/foundation-task-map.json`
  - `src/help.ts`
  - `public/handbook/blood_sources-*.png`
  - `tests/blood-sources.test.mjs`
  - `tests/help-coverage.test.mjs`
  - `handoff.md`

- Next concrete step: Fetch bundle for Position 74 `blood_request` (`get_screen_bundle('blood_request')`) and begin implementation.

## Prior task and Git
- Clean working tree on branch `main` at commit `9e4ec3af6b29807593710b9cb509f811f40bd954` (17 commits ahead of `origin/main`).
- Proposal #225 (`blood_sources`) awaiting human review on /docs -> My progress.
- Proposals awaiting human review on /docs -> My progress: #208–#225.

## Backend gaps
#50 New: employment status activation omits its EMPLOYEE_DOCUMENT_REQUIRED refusal.
#51 New High: own waiting CodeRed admission 4 never emits vitals.due.
