> Historical pre-reset evidence. Backend7429acf supersedes the examples and limitations below; see [current audit](backend-refresh-2026-11-05/AUDIT.md). Never replay old record IDs or keys.

# Equipment continuation review — 2026-11-04

Codex resumed `main` at `6cd3b4d`, preserving the previous audit changes and the seven untracked equipment drafts. Original screen/policy backups remain in ignored `artifacts/continuation-20261104/`; the earlier handoff is archived at `docs/handoff-antigravity-2026-11-04.md`. No commit, reset, deployment or human review was performed.

## Scope and contracts

Completed the shared implementation for roadmap158 `equipment_maintenance` (Maintenance) and159 `equipment_maintenance_ops` (Operations). This is an implementation/testing checkpoint, not completed human acceptance. The next dependency-order screen is160 `compliance_register_ops`; `equipment_write_off` is252.

Full MCP bundles, quality/design principles, workspace quality briefs, handbooks, workflow recipe and test plan were read. Contract `f253171154eef6044fa2`, knowledge `bbf3ad4e2e48dc00`, rubric `4e7cb2e8c7b8`, UI standard `7795bdfe5246755d`; server `2026-10-31T00:19:38.433994+00:00`. The established application controls, theme and native zoom/help infrastructure are reused. Frontend lead design/editor approval and named English/Urdu journey review remain outstanding.

## Verified corrections and implementation

- The draft exported a PDF using a JSON API call and a relative `window.open`. Equipment PDFs now use the existing authenticated native binary paths, with permission/session checks, MIME and PDF-signature verification, sandboxed preview/print handoff, and separate Save. A document failure never repeats equipment writes.
- Integrated both screens into authorized routing, catalogue/task/help coverage. A real HR session reproduced an unrelated handover regression: Payroll was permitted by the server handbook but absent from navigation. Navigation now includes delivered server-authorized pages, retains runtime hidden/records views, and excludes unbuilt/public screens. Payroll opens through the real HR menu; account-isolation regression checks pass.
- Runtime equipment permissions use server permissions and establishment views. Unlisted screens are core/always shown under the actual establishment contract; unknown establishment still denies access. Explicit hidden/records overrides prevail. No role-name administrator bypass or facility-category branching was introduced.
- Preserved four separate onboarding stages: asset, medical specification, actual OEM plan and Commissioning visit. No invented interval, findings, successful result, commission or vendor ID. Each stage advances only on a confirmed server result.
- Plan edits send original row versions; conflicts retain the draft and require reload/review. Confirmed errors are visible. Uncertain writes hold the original request identity and body, freeze editing/navigation, and expose an accessible original Retry. Actual lost committed responses replayed the same key/body and left one record.
- Visits are append-only. In-house staff and contractor vendors come from real authorized directories. Contractor engineer/vendor attribution, Calibration certificates, failure/out-of-service and explicit passing return-to-service were verified. Plans end only through supported versioned updates with reasons.
- Server overdue/on-time values remain authoritative. Date defaults use the hospital timezone; unavailable metadata leaves the date empty. No invented compliance thresholds.
- Bilingual contextual F1, screen/workspace guidance, six role FAQs per equipment page, all control mappings, actual English/Urdu screenshots, theme/zoom layouts, explicit labels, dialog focus containment and unsaved/pending guards were added. Translation and device review remain human work.
- Final screenshot inspection found the shared sidebar `nav button > span` rule applying a22px icon column to the Urdu schedule caption (and hiding it under narrow-width zoom). A scoped equipment-tab override now restores actual label width/visibility. The real read harness checks its rendered width and visibility in both languages/themes at100/250, in addition to page overflow; screenshots and progress evidence are refreshed for this correction.

Principal files: `src/screens/EquipmentMaintenance.tsx`, `src/equipment-maintenance-policy.ts`, `src/equipment-maintenance-copy.ts`, generated equipment/vendor clients, both saved contracts, `src/App.tsx`, `src/screen-navigation.ts`, native PDF paths in `electron/main.cjs`, help/catalogue/task mappings and four handbook images. Previous audit files were preserved.

## Actual DEV verification

Execution journals/logs are in ignored `artifacts/continuation-20261104/`. Portable synthetic summaries and exact progress payloads/receipts are stored alongside this review under `continuation-2026-11-04/` and `progress-proposals/`.

- Maintenance created synthetic asset3, tag `SCN1104EQ-mw24b9qx`, and Operations created asset4 (tag in its fixture journal), using the UI. Four stages persisted. Stale plan edit returned409; reviewed edit succeeded. Late passing maintenance advanced the due date and explicitly restored Active. Test plans were ended with audited reasons.
- The first Maintenance harness failed after a real committed Breakdown response was intentionally lost: it attempted a pointer click behind the editor overlay. The original returned record ID was reconciled by a read, without submitting a replacement. A separate labelled Inspection tested original-key retry/navigation hold successfully. The original failure log is retained.
- Calibration checks on the same assets blocked a missing certificate before HTTP, persisted synthetic certificates and replayed lost replies exactly once: records9/10. No new assets were registered for these tests.
- Contractor checks on the same assets selected the live named biomedical vendor, persisted engineer/vendor attribution with null employee, and created exactly one additional visit each: records11/12. Inspection plans8/9 were ended. No uncertain equipment write remains. Immutable synthetic history remains in DEV; it is not actual maintenance or care.
- Read-only Electron checks cover both actual roles, sections, F1/focus restoration, editor Tab/Escape containment, unsent draft preservation, English/Urdu, Light/DarkHighContrast at100/250 without page overflow, authenticated PDF preview/Save/cancel, restored HR navigation and Reception PDF denial. Demo display preferences are restored.
- Unit suite851/851 passes, including server-view/permission, navigation and hospital-date regressions. Mandatory build includes handbook coverage and TypeScript. Foundation regression passed earlier in this continuation, including real login, native zoom, help and account isolation; it was not rerun after the final vendor/date-only additions.

Physical printer output, all hardware failures, every status/service-profile variation, signed fresh-data role journeys, full Urdu/editor approval and entire catalogue regression are not claimed. No human Review code was entered. No registration/payment/medication workflow was repeated by equipment tests.

## Backend communication and retests

**Issue52**, Low Documentation, was submitted through the official backend MCP report tool and reread as **New** on2026-11-04. Both equipment bundles and screen-generated client omit the existing vendor directory despite requiring contractor vendor IDs. `GET /finance/vendors` works for Maintenance (request `ba4ebebd9dde41a18d026d2d36ae5fac`); contractor journeys now pass using it. This is a catalogue/documentation defect, not a runtime API or permission failure. Exact evidence, reproduction, expected fix and confirmed receipt are in `continuation-2026-11-04/backend-vendor-doc-issue-*.json`.

**Issue50 Fixed**: fresh own employee37 Draft-to-Active correctly returned409 `EMPLOYEE_STATUS_INVALID`, with next step submit; request `2fb76279436540ae9c8d6cf60d581f09`. This retests the original Draft guard, not all finalized/reinstatement/document transitions.

**Issue51 Fixed**: new owned synthetic ward6/bed35/admission4/patient8, CodeRedActive with null primary doctor. Real non-replay `vitals.due` event772 reached both live Doctor and Nurse; flowsheet schedule `last_alerted_at` advanced and `is_overdue` was true. Independent read request `79078582168c46f5b5a1f955d00ce09b`. Initial harness used the wrong flowsheet property after receiving events; source was corrected and saved streams plus fresh server reads verified without repeating writes. Later UI badge assertion was not reached or claimed. Exact synthetic intents/results and verification limits are in `continuation-2026-11-04/due51-*`. Fixture remains CodeRedActive with a15-minute schedule; it is synthetic, no actual care/payment.

Frontend defects stay in this review/audit tracker. No additional runtime backend defect was reproduced in the equipment journeys.

## Final delivery and portal evidence

Final DEV renderer `index-B5I_oOqz.js`, SHA256 `87119485a1357a481b086e990a6728c72eb3068fc958ab6ae951396d651dfa49`; CSS `index-ouLFD8cQ.css`, SHA256 `61b6eb59af8d74aa50256f15a58332501b4cb0f73418fc4730d2ee7389d02cc9`. JavaScript content equals the earlier contractor-tested bundle; only the final scoped tab CSS changed. Final real read/caption/layout/PDF checks passed on this renderer/CSS pair. Release exclusion and restored DEV builds passed again after that correction. Unit851/851 was run before this CSS-only correction; meaningful rendered-layout checks were rerun after it. Existing large bundle warning remains. No deployment/signed installer.

Proposals319 (`equipment_maintenance`) and320 (`equipment_maintenance_ops`) saved and reread pending: **awaiting human review on /docs -> My progress**. They supersede317/318 with corrected caption/screenshot/build evidence. Exact v1/v2 payloads, receipts and verification are in `docs/progress-proposals/`. Prior audit311–316 were accepted on2026-11-04; do not resubmit their unchanged items. No signed human review exists and no screen/workspace completion is claimed.
