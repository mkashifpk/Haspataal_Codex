# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Next screen — Screen 84 `newborn_registration`
Building Screen 84 in Phase 4 Roadmap (Position 84, 56 points) along with all tests, reporting backend issues if found:
- Screen 82: **`maternity_policy`** ("High-risk pregnancy: our policy", Position 82, 60 points) — **COMPLETED & PROPOSED** (commit `adb0c9a`, Proposal **235**).
- Screen 83: **`obstetric_assessment`** ("Obstetric assessment and partograph", Position 83, 58 points) — **COMPLETED & PROPOSED** (commit `e5cda36`, Proposal **236**).
- Screen 84: **`newborn_registration`** ("Newborn registration and identification", Position 84, 56 points) — **READY TO COMMENCE**.

### Completed Screen 83 Checkpoint
- Implemented full `obstetric_assessment` screen for Doctor / Maternity workspaces (`doctor`, `clinical_specialist`, `surgeon`, `head_nurse`, `ward_nurse`):
  1. *Deliberate High-Risk Choice* (rule `064bedf875`): Two prominent buttons ("Standard Risk" vs "High Risk Pregnancy"), neither pre-selected.
  2. *High-Risk Conditions Tagging* (rule `064bedf875`): Multi-select from active catalog, displaying "Managed Here" or "Referred" policy status. Selecting a Referred condition prompts external referral recommendation.
  3. *Mandatory Risk Counselling* (rule `064bedf875`): Attendant counselling confirmation and mandatory clinical counselling note documenting discussion of danger signs and emergency action.
  4. *Maternal Nutritional Assessment* (rule `272b13a3e0`): Evaluates `rules_in_force` and facility profile; in Category I and Category II A hospitals, nutritional findings and corrective dietary advice are mandatory (`MATERNAL_NUTRITION_REQUIRED`, MSDS Indicator 28).
  5. *External Referral Issuance & Linking* (rule `064bedf875`): Generates external referral letter via `POST /referrals` capturing destination hospital, reason, urgency, clinical summary, and transport (including staff escort name for `WithStaff`), and links returned `referral_id` into the assessment.
  6. *Append-Only History Register* (rule `962fcab00e`): Chronological view of past visits for the selected patient with author stamps (`AuthorStampOut`), identified conditions, counselling notes, and linked referrals.
  7. *Maternity Capability & View Gates* (rules `b8c60b1609`, `e6bd3426e5`, `b46e6c48cc`): Full mode when active; `open_work` banner ("No new obstetric assessments from now on (Maternity service is Retiring)"); `records` mode is read-only.
- Real-time updates via `establishment.changed`.
- Authored bilingual English/Urdu F1 contextual help, 34 control guides, 8 steps, and 7 role FAQs in `src/help.ts`.
- Bounded zoom 100–250% (reset 100%).
- Full verification passed:
  - `npm run check:help`: PASS (82 screens, 1842 controls, 982 groups, 69 FAQ seeds, 30 workspace guides).
  - `npx tsc --noEmit`: PASS (0 errors).
  - `node --test tests/obstetric-assessment.test.mjs`: PASS (5/5 unit tests).
  - `node --test tests/help-coverage.test.mjs`: PASS (28/28 tests).
  - `npm test`: PASS (317/317 tests across repo).
  - `npm run build`: PASS (`index-OZN9hVhc.js`).
  - Live DEV server reads: Verified `/maternity/assessments` (200 OK) as `demo.doctor`.
- Proposal ID: **236** submitted via `propose_progress` and confirmed awaiting human review on `/docs -> My progress`.
- Working tree commit: `e5cda36`.

### Proposals Status
Proposals **231**, **232**, **233**, **234**, **235**, and **236** are awaiting human review on `/docs -> My progress`.

### Next Concrete Actions for Screen 84 (`newborn_registration`)
1. Call `get_screen_bundle("newborn_registration")` and save contract into `contracts/newborn_registration.json`.
2. Inspect `get_ui_quality_brief("newborn_registration")` and domain rules.
3. Call `generate_typescript` for endpoints and generate typed contracts in `src/generated/newborn_registration.ts`.
4. Implement domain policies in `src/newborn-registration-policy.ts`.
5. Author UI in `src/screens/NewbornRegistration.tsx`.
