> Historical pre-reset evidence. Backend7429acf supersedes the examples and limitations below; see [current audit](backend-refresh-2026-11-05/AUDIT.md). Never replay old record IDs or keys.

# Screen160 — compliance register

Codex,2026-11-04. Base `main` at `6cd3b4d`; previous audit and equipment work preserved, no commit/reset/deployment. Screen160 `compliance_register_ops` is implemented and tested for Facility Operations; named human acceptance remains pending.

## Staff context and scope

Operations staff open the register at shift start or before inspection. Done means the actual document, responsible official, dates and separate scan are current, with readable renewal/withdrawal history. The design reuses the established app shell, controls, native file viewers, shared write recovery, help and100–250% native zoom. State groups and a selected-record pane support review without a generic dashboard. Urdu is an explicitly marked draft. No new clinical/presentation thresholds or service/profile branching.

MCP contract `f253171154eef6044fa2`, knowledge `bbf3ad4e2e48dc00`, rubric `4e7cb2e8c7b8`, UI standard `7795bdfe5246755d`, server `2026-10-31T00:19:38.433994+00:00`. Read full bundle, quality/design/workspace briefs, handbook outline, connecting/handbook guides and facility-compliance workflow recipe. No bundle sections omitted. Supporting equipment and department lookup contracts are saved in `docs/screen160-2026-11-04/supporting-contracts.json`.

## Implementation

- `src/screens/ComplianceRegister.tsx`: server-state groups, filters/search, selected detail, official/equipment/department links, versioned corrections, application receipt, renewal chain, reasoned withdrawal and separate scan attachment. Closed entries stay readable and have no edit/renew/upload controls. The server owns expiry/days/state; an application does not extend validity.
- `src/compliance-register-policy.ts`: explicit permission/runtime-view access, constraints, payloads and changed-fields-only corrections retaining original row version. Official choices use actual returned `user_id`, not `employee_id`; no guessed IDs. Staff search can narrow the server’s500-match picker; equipment uses authorized `medical_only=false`, departments the existing authenticated directory.
- Generated types/full contract, App authorized route, catalogue/task inventory,29 authored control-guide groups, bilingual14-step handbook and6 detailed role FAQs. Actual EN/UR screenshots bundled. Existing global `useClinicalWrite` retained: frozen request identity/body, idempotent original retry under24hours; corrections require read/review, not automatic replay. Drafts remain in memory, with visible pending/refusal states and navigation guards.
- `electron/compliance-files.cjs` and allowlisted native actions: authenticated stored PDF/PNG/JPEG preview/save, MIME/signature checks, session/permission checks before transfer/save, sandboxed viewers tracked for session cleanup. Register PDF uses existing native preview and separate Save. No ZIP or renderer-relative URL; printing does not repeat a write.
- Screenshot review corrected notices that remained English after language changes; confirmation/cancellation now retranslate on render. Date-only values follow `dd-MMM-yyyy`. Shared hook behavior was not rewritten.

## Real DEV tests and synthetic records

All records are visibly synthetic, not actual licences or care. No patient/payment/medication registration in this work.

1. Entry18 `SCN160-mw2chwky SYNTHETIC ONLY - NO ACTUAL LICENCE`: UI required licence expiry before HTTP; actual staff user/equipment/department choices persisted. Real committed create reply was intentionally lost; fields/navigation locked, same-key/body UI replay returned one entry. Initially Expired.
2. Separate614-byte synthetic PDF upload committed; original key `438919b4-aed5-400b-abc4-fde8bdaab467`. UI original Retry was sent, but the harness read its trace before the reply finished. Reconciled actual entry/version2, then explicitly replayed the exact original key/filename/bytes; confirmed server replay, no duplicate registration/upload effect. Native preview/exact-byte Save/cancel passed.
3. Real concurrent correction made the UI version stale:409 with draft retained. Explicit latest comparison, Cancel/reopen and reviewed edit preserved the concurrent note. Application date/reference persisted while state remained Expired. Another real correction reply was intentionally lost: the UI offered read/review only, reconciled without resending PUT.
4. Renewal created entry19 once, linking18 and its history;18 became Renewed.19 did not inherit a scan. An invalid synthetic PNG fixture correctly returned422 `VALIDATION_ERROR` (request `261efdeb10e94fbca5db5a772593f6d6`) and left19/version1 without a scan. A valid CRC PNG was then a new deliberate upload. Native image preview/exact-byte Save passed.19 was withdrawn with an audited reason, including real lost-reply/original-key replay. Both historical scans remain readable.
5. Distinct Law20 `SCN160-LAW-mw2cwgfs SYNTHETIC LANGUAGE TEST ONLY`: UI creation with null dates returned NoExpiry; actual confirmation and cancellation notices switched EN→UR in place. Urdu F1 field instructions/focus and EN/UR Light/DarkHighContrast100/250 layout checks passed.20 then withdrawn. Actual closed correction returned409 `COMPLIANCE_DOCUMENT_CLOSED`, with no rewrite.
6. Reception has no route; native scan/register preview/Save denied before HTTP. Independent backend list check returned403 `FORBIDDEN`, request `08312d7afb2d4e9d8c9acdbf3e74a12b`.
7. Quality can read the actual new records through its permitted API. Its only workspace is `quality`, whose scoped handbook excludes Operations screen160 (request `40fef338c9e240d0a8c34134e04733af`); no unsupported menu is added. Its separate catalogue counterpart remains future work.

All18/19/20 are closed; no uncertain write remains. Immutable synthetic history and scans remain on shared DEV. Do not rerun creation just because an old test failed. Local ignored journals preserve exact intents, keys, responses and initial failures.

## Checks and limitations

Final `npm.cmd test`: **856/856**,19 suites. Five new meaningful tests cover permission/view boundaries, versioned changed-field payloads/clearing, required dates/limits, server-state grouping and native signature rejection. Help coverage guard now159 screens,4227 controls,3166 groups; mandatory build includes TypeScript and Vite. Final build identification/release result is recorded in `docs/screen160-2026-11-04/delivery-build.json`.

Real Electron harnesses: `scripts/compliance-check.mjs` with explicit journalled resumes `--resume-upload` then `--resume-replacement`; `scripts/compliance-final-check.mjs` with `--resume-law` then `--finish-access`. The initial F1 assertion expected a field title as screen h1 and failed before any write; corrected to assert the screen title plus field instructions. A later English Close selector failed in Urdu; fixed locale-independent selector and resumed Law20. A Quality Ops-route assertion was corrected after verifying the actual server-scoped handbook. These are retained harness failures, not fabricated passes or backend bugs. Public screenshots are actual app captures; corrected Urdu layout was visually inspected.

No physical printer/scanner test, signed fresh-data human journey, translation/design/editor approval, entire test-plan or catalogue completion is claimed. No human Review code entered, no self-approval. Four compulsory human acceptance items remain pending. Existing bundle-size warning remains; no signed installer or deployment.

No new runtime backend/MCP bug was confirmed here. Existing documentation issue52 remains tracked separately; do not report client/harness defects to the backend team. New proposal payload/receipt/verification is stored under `docs/progress-proposals/` and the saved ID/status is recorded in `handoff.md`.

Final DEV `index-CwxqwUHH.js`, SHA256 `dbca5d97f9635da34046d1df2b5455dc82a23ed257e41f7c48c05fec35c9d78e`; CSS `index-Cebn6jxB.css`, SHA256 `26cd3b240cca57b92d93440eb93019a71a2520d95d949c038b46fae577fbe51c`. Release build passed DEV field/header exclusion; restored DEV build/hash verified. Proposal **321** saved and verified pending: **awaiting human review on /docs -> My progress**. Only16 tested items proposed; no compulsory human review or full matrix/printing claim.
