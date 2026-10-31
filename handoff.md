# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Next screen — Screen 83 `obstetric_assessment`
Building Screen 83 in Phase 4 Roadmap (Position 83, 58 points) along with all tests, reporting backend issues if found:
- Screen 82: **`maternity_policy`** ("High-risk pregnancy: our policy", Position 82, 60 points) — **COMPLETED & PROPOSED** (commit `adb0c9a`, Proposal **235**).
- Screen 83: **`obstetric_assessment`** ("Obstetric assessment and partograph", Position 83, 58 points) — **READY TO COMMENCE**.

### Completed Screen 82 Checkpoint
- Implemented full `maternity_policy` screen with 3 tabs:
  1. *Conditions Catalog* (rule `585417c0ea`): Starts with 12 standard examples from PHC manual (all initially Undecided), decisions to Managed or Referred with mandatory destination `referral_note`, add custom conditions, toggle active status with `expected_version` concurrency control.
  2. *Notice & Display* (rule `b7a7a7f1e6`): Official A4 PDF notice download/preview, capability-aware display (Active lists Managed cases cared for here and referral destinations; Inactive declares hospital cares for none and refers all), display guidance for main entrance and antenatal clinic waiting area.
  3. *Stakeholder Communications* (rule `1e04f5eed7`): Outreach logging for `OwnPatients` and `Referrers`, indicator compliance evaluation (FullyMet, PartiallyMet, NotMet), mandatory recipients for Letters and Meetings.
  4. *Service Activation Gate* (rule `7ac44a354a`): Verification that every condition on the list has a recorded decision before maternity service can be activated in Facility Settings.
- Real-time updates via `establishment.changed`.
- Authored bilingual English/Urdu F1 contextual help, 37 control guides, 8 steps, and 7 role FAQs in `src/help.ts`.
- Bounded zoom 100–250% (reset 100%).
- Full verification passed:
  - `npm run check:help`: PASS (81 screens, 1808 controls, 948 groups, 69 FAQ seeds, 30 workspace guides).
  - `npx tsc --noEmit`: PASS (0 errors).
  - `node --test tests/maternity-policy.test.mjs`: PASS (6/6 unit tests).
  - `node --test tests/help-coverage.test.mjs`: PASS (28/28 tests).
  - `npm test`: PASS (312/312 tests across repo).
  - `npm run build`: PASS (`index-bsp7X0-a.js`).
  - Live DEV server reads: Verified `/maternity/high-risk-conditions` (200 OK) and `/maternity/communications` (200 OK) as `demo.quality`.
- Proposal ID: **235** submitted via `propose_progress` and confirmed awaiting human review on `/docs -> My progress`.
- Working tree commit: `adb0c9a`.

### Proposals Status
Proposals **231**, **232**, **233**, **234**, and **235** are awaiting human review on `/docs -> My progress`.

### Next Concrete Actions for Screen 83 (`obstetric_assessment`)
1. Call `get_screen_bundle("obstetric_assessment")` and save contract into `contracts/obstetric_assessment.json`.
2. Inspect `get_ui_quality_brief("obstetric_assessment")` and domain rules.
3. Call `generate_typescript` for endpoints and generate typed contracts in `src/generated/obstetric_assessment.ts`.
4. Implement domain logic in `src/obstetric-assessment-policy.ts`.
5. Author UI in `src/screens/ObstetricAssessment.tsx`.
