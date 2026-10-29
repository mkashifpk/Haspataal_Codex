# My beds this shift — screen59

The ward nurse begins a round by checking the actual duty and patient, prioritising server-confirmed due work, reading signed discharge instructions and confirming completed bed cleaning. The screen uses the existing terminal components and shared bilingual/help/zoom patterns. No new decorative alert, clinical threshold or facility-category branch was introduced. H09 shared design ownership and H08 native Urdu approval remain open; the established local components and draft Urdu apply meanwhile.

## Implementation

`src/screens/MyBeds.tsx`, `src/my-beds-policy.ts`, generated `my_beds.ts` and saved `contracts/my_beds*.json` implement the real six endpoint contracts plus documented admission/patient/flowsheet reads. `App.tsx` adds permission-filtered, establishment-view-controlled navigation. No bedside medication or observation editor is fabricated; those are later ward screens.

- Nurse's returned duties/beds include roster ID, actual shift times, ward/zone, bed state and patient name/MRN. My duties retains the backend's default overnight behaviour; no client midnight cutoff. Search is local and preserves selected patient context. Selecting the same bed triggers a fresh read.
- Server flowsheet `is_overdue` and `next_vitals_due_at` supply due status because MyBedOut carries only last vitals. Overdue first, then beds with doses due next hour. Failed reads remain visible; no local interval or alert threshold is guessed. Vitals/medication/roster/bed/identity events and reconnect refresh without polling. Patient flags and outstanding/linked identity remain readable with two identifiers and age/date of birth. A patient change clears the former summary.
- Signed summary displays medicines, follow-up, signer and all corrections. Draft summaries show the server's refusal. Separate server-PDF save and native A4 printing are read-only. `electron/discharge-summary-print.cjs` escapes content and retains originals/corrections, codes/titles/URIs, header/issue line, signature and transfer details. The secure print handler rechecks the current duty/bed/admission/patient/version/service/session and routes through the shared document-printer path. PDF download adds only the exact admission summary route to the existing permission-checked binary allowlist.
- Only Dirty/Cleaning rostered beds, a permitted full/open-work view and Live connection offer Bed cleaned. The optional cleaner comes from actual staff lookup, never typed IDs. Review freezes bed/cleaner, and fresh roster/actor/service checks precede the write. Outcomes BedCleaned, BedCleaningRecorded and NoAction stay distinct. State refusals keep input and re-read. A lost reply locks exact key/body/actor/navigation; explicit same-key retry only within retention. A read alone cannot unlock a replacement cleaning request. No automatic business retry or offline queue.

## Checks

| Case | Result |
|---|---|
| GET my beds / self roster | PASS real Nurse night roster24, own ward11/beds42–43, actual dates/times/identity. Head Nurse and Triage also200 with empty lists |
| GET signed print payload / server PDF | PASS real signed summary3 of own admission11; actual PDF saved/header checked. Draft summary of new admission12 refused with DISCHARGE_SUMMARY_NOT_FINAL and shown in UI |
| Native A4 | Secure renderer identity/version/draft/channel/escaping/corrections tests PASS. Actual native action exercised with simulated printer cancellation, no physical output and no clinical write. Physical printer/layout acceptance remains pending |
| Staff lookup / cleaning | PASS actual Janitor Karim employee33 picked. One successful mark-cleaned200 `16bdd921a14e4e339ba5a2e625606073`, reply deliberately lost, explicit identical key/body replay200 `1ac1e4957f4e44e196c0018de4aac556`, Idempotent-Replay true. BedCleaningRecorded; admission11 still DischargeInProgress, Pharmacy blocked, bed not released |
| Vitals urgency / live event | PASS actual vitals.due273 on own admission12, nurse UI reread and moved overdue D59-B first; no polling or clock simulation. Original240-minute schedule restored |
| Medication event | Handler implemented; no new actual medication.due event produced. Not proposed as tested |
| Refusal / identity / safe read | PASS occupied D59-B has no cleaning button, unsigned summary refusal visible; no-match preserves selected patient, field/dialog F1 restores focus, EN/UR both themes250 no horizontal overflow in main run |
| Permissions | Actual Accountant my-beds and cleaning403, Billing summary/PDF403. Shared policy tests cover readable history and action gates by independent permission/view/state |
| Request validation | Actual app body `{cleaned_by_employee_id:33}` valid; empty-body and nullable variants valid. Fixture bed-create typo was rejected by validate_request BEFORE transport and corrected to is_overflow_allowed; no ignored field reached a fixture create or the app |
| Build / tests | Mandatory build/help/TypeScript PASS; 59 screens,1220 controls,489 groups,69 FAQ seeds,30 workspace guides. 221/221 automated tests PASS. Initial test run failed only the old58-screen assertion; updated to59 and added a negative new-control mapping check. Existing bundle-size warning |

Actual test journals remain in ignored `artifacts/mybeds59-*`; portable request IDs, writes, event273, validation, permissions and cleanup are in `docs/mybeds59/`. Failed earlier58 checks are retained as history. The later58 final read and new two-terminal race now PASS; backend43 still blocks Doctor due-vitals delivery. Proposal200 covers only new58 states evidence, not unchanged claims. Screen59 source/evidence committed `f88b838`; proposal **201** for twelve tested items was confirmed and verified pending with progress_proposals. Both are awaiting human review on /docs -> My progress; exact payloads/receipts/verification saved, no human reviews recorded. Final issue read confirms41/42/43stillNew.

## Help and remaining acceptance

Screen page, detailed seven task/recovery FAQs, Ward Nursing guide, bilingual control/task inventory and actual screenshots ship with this screen. F1 works from search, cleaner field and frozen review. The existing shared100–250% keyboard/Settings zoom is used. Native Urdu, full role journey, shared-service runtime flips, true midnight rollover, positive medication-due event, physical printing, named editor and named human fresh-data review remain pending. No q:tested, human gate, successful physical print or workspace-complete claim. Never enter a Review code or sign the portal review as an agent.

No new backend defect was reproduced for59. Existing reports41/42/43 remain New at the last read. No guessed overdue logic or expanded Doctor recording permission was added to hide43.

## Fresh synthetic records and continuation

Scenario17bbea patient10/MRN-2026-000010/ticket9/admission11, own ward11, beds42 D59-A/43 D59-B; Night shift3/roster24 for actual Nurse Hina employee17. Admission11 nowDischargeInProgress, ClinicalDischarge Cleared, Pharmacy pending. Cleaning of synthetic bed42 recorded by software test and attributed to selected Janitor Karim33; no actual physical-care claim. Upstream software-only summary3Final/consent5Given; no actual signature/consent. No stock, dose, actual medicine or payment.

Second scenario0a05cb patient11/MRN-2026-000011/ticket10/admission12 is Admitted on43, unsigned summary, one DEMO observation. Its captured240-minute interval was temporarily15 for the real worker alert and restored240 with200 `15e51c3a961d41afaf5a71b604f40a2c`. These are read/test fixtures, not requests to replay. Never repeat the recorded discharge or cleaning under a fresh key.

Manual: use a new app-created synthetic admission and duty; verify correct patient at bedside, overnight duty/date, due work, signed instructions/corrections, F1/Urdu/250%, actual printer and a cleaned bed held behind clearance. Human alone reviews and signs on /docs → My progress. Next development screen follows a fresh roadmap read, rather than expanding this screen into later chart editors.
