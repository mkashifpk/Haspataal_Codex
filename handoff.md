# Haspataal checkpoint
Last updated: 30 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active new screen request
Completed Screen 74 `blood_request` ("Clinical blood requests" for Doctor workspace `doctor`, Phase 4 Inpatient Journey).
Next screen: Position 75 `blood_bank` ("Blood bank stock, crossmatch, issue & discard", Points: 102).

- Current status: Screen 74 completed, verified live, and submitted for review (Proposal #226).
- Completed checkpoints:
  1. Saved contract bundle in `contracts/blood_request.json` with all 7 endpoints and definitions.
  2. Generated typed API contracts in `src/generated/blood_request.ts`.
  3. Implemented domain policy in `src/blood-request-policy.ts`:
     - Access gating by view, capability (`establishment.active.includes('blood_transfusion')`), and permissions (`blood.view`, `blood.request`, `blood.bank.operate`).
     - Request validation: component, units (1–20), urgency (`Routine`, `Urgent`, `Emergency`), indication, stay context, and mandatory Given transfusion consent (`rule:c5f6768a50`).
     - Emergency uncrossmatched note authorisation (`rule:8da78caf6b`).
     - Close vs Cancel state lifecycle checks (`rule:d7b145b677`).
  4. Implemented full screen in `src/screens/BloodRequest.tsx`:
     - Real-time `blood.unit.issued` and `establishment.changed` event listeners.
     - Status filtering (`Open`, `Closed`, `Cancelled`, `All`) and patient/request search.
     - Worklist displaying request number, patient MRN, blood group, component, units issued/requested ratio, urgency, and status badges.
     - Detailed request inspection drawer displaying patient context, clinical indication, uncrossmatched authorization note, crossmatch test records (ABO/Rh, compatibility, method), and transfusion events.
     - Transfusion consent selection: queries Given transfusion consents (`category="Transfusion"`, `status="Given"`); never pre-selects consent (`rule:c5f6768a50`). If absent, provides direct link to Doctor Consents (`consents_doctor`).
     - Close request modal with clinical closing note (`POST /blood/requests/{id}/close`).
     - Cancel request modal with documented reason (`POST /blood/requests/{id}/cancel`), blocked if blood was issued or transfused.
     - Safe write execution with `useClinicalWrite` sending `Idempotency-Key` (`rule:264737f664`).
  5. Wired routing, screen labels, view filters, and navigation in `src/App.tsx`.
  6. Registered 7 tasks in `src/foundation-catalogue.json` (73 screens) and mapped in `src/foundation-task-map.json`.
  7. Updated 21 `blood_request.*` control guides and added `"blood_request"` to `deliveredHelpScreens` in `src/foundation-help.ts`.
  8. Authored bilingual English/Urdu screen help, 8 steps, and 7 role FAQs in `src/help.ts`.
  9. Added reference screenshots `public/handbook/blood_request-en.png` and `public/handbook/blood_request-ur.png`.
  10. Authored unit tests in `tests/blood-request.test.mjs` (3 test suites) and updated `tests/help-coverage.test.mjs` (73 screens).
  11. Verified live DEV endpoints with real auth (`POST /auth/login` as `demo.doctor`, `GET /blood/requests` -> 200 OK, `GET /blood/units` -> 200 OK, `GET /consents?category=Transfusion` -> 200 OK, `GET /establishment` -> 200 OK with active `blood_transfusion`).
  12. Full verification suite:
      - `npm run check:help`: PASS (73 screens, 1467 controls, 614 groups, 69 FAQ seeds, 30 workspace guides).
      - `npm run build`: PASS (`index-CRenqmj7.js`, tsc + Vite production bundle).
      - `npm test`: PASS (268/268 tests passing).
  13. Committed working tree in `b6cf9a4`.
  14. Submitted proposal via MCP `propose_progress` (Proposal #226) claiming 21 items (`ep:POST /blood/requests`, `ep:GET /blood/requests`, `ep:GET /blood/requests/{request_id}`, `ep:POST /blood/requests/{request_id}/close`, `ep:POST /blood/requests/{request_id}/cancel`, `ep:GET /consents`, `ep:GET /blood/units`, `ev:blood.unit.issued`, `rule:c5f6768a50`, `rule:8da78caf6b`, `rule:d7b145b677`, `rule:264737f664`, `rule:a79028f126`, `rule:90effa2802`, `q:states`, `q:permissions`, `q:writes`, `q:handbook`, `q:f1_help`, `q:role_faq`, `q:zoom`).
  15. Verified proposal #226 via `progress_proposals` (confirmed status: `pending`).

- Files involved:
  - `contracts/blood_request.json`
  - `src/generated/blood_request.ts`
  - `src/blood-request-policy.ts`
  - `src/screens/BloodRequest.tsx`
  - `src/App.tsx`
  - `scripts/check-help.mjs`
  - `src/foundation-catalogue.json`
  - `src/foundation-help.ts`
  - `src/foundation-task-map.json`
  - `src/help.ts`
  - `public/handbook/blood_request-*.png`
  - `tests/blood-request.test.mjs`
  - `tests/help-coverage.test.mjs`
  - `handoff.md`

- Next concrete step: Fetch bundle for Position 75 `blood_bank` (`get_screen_bundle('blood_bank')`) and begin implementation.

## Prior task and Git
- Clean working tree on branch `main` at commit `b6cf9a40b7bc766452c4bf78316ea8212360d789` (19 commits ahead of `origin/main`).
- Proposal #226 (`blood_request`) awaiting human review on /docs -> My progress.
- Proposals awaiting human review on /docs -> My progress: #208–#226.

## Backend gaps
#50 New: employment status activation omits its EMPLOYEE_DOCUMENT_REQUIRED refusal.
#51 New High: own waiting CodeRed admission 4 never emits vitals.due.
