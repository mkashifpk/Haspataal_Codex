# Referral Register —25 October 2026

Quality reviews the establishment's outgoing referrals over a defined period. Success means finding the correct patient/letter, distinguishing pending acknowledgement from an actual receipt and reading the original issued or cancelled PDF. The register is read-only; the referring clinician owns issue/cancel/actual acknowledgement.

Current MCP bundle, omitted schemas, Quality brief/design/handbook outline, workflow, test plan and endpoint contracts were read. Generated Referral Register TypeScript matches current MCP after formatting. Contract a48efc9c8254ac5137e2/rubrica400860f309d. MCP prescribes no referral event: explicit reset/re-read is supported, not an invented event or polling.

## Fresh journey

`scripts/reset-referral-register-check.mjs` passed on backend-refresh build xY4otd9s. It verified current synthetic patient5/ticket5/FinalNotExamined note1 from the new waiver journal, then Doctor issued one new `DEMO-REGISTER-*` letter through the UI: actual referral1/REF-2026-00001, WithStaff/DEMO escort/patient-chosen DEMO facility. No actual care, transfer, receiving acknowledgement or payment occurred.

Quality verified explicit re-read, logged-record-access notice, date/status/pending filters, client reversed-date validation retaining the prior view/no reversed GET, actual server422 VALIDATION_ERROR, current-page find/no-match, actual Older/Newer cursor, list/detail loading and exhausted real-GET-loss errors/retry. PDF Save cancellation retained the record; actual server PDF saved with `%PDF-` bytes. F1 returned to the filter/PDF control without losing input. Quality had no cancel/acknowledgement controls and made zero business writes. Cashier had no register menu and actual403 list/detail/PDF.

Doctor cancelled that exact new letter once; Quality's subsequent reads/Cancelled/pending filters reflected it. Final referral is Cancelled with acknowledged_at null. Original create/cancel keys/bodies/results retained in `reset-referral-register-evidence-2026-10-25.json`; never recreate/repeat them. All three sessions restored preferences and signed out.

Native Electron Ctrl= from245 clamps250/repeated upper remains2.5, actual auth/me persisted250, Ctrl0 resets100/Ctrl- remains1. English/Urdu Light/DarkHighContrast250% had no horizontal page overflow; fresh full-page handbook screenshots were captured. Human language/accessibility/design review remains pending.

## PDF interaction fix

Baseline real delayed PDF read demonstrated enabled controls and two actual GETs on double-click (`referral-pdf-progress-baseline-2026-10-25.json`). Shared `src/referral-record.tsx` now shows Preparing referral PDF in English/Urdu, disables both PDF controls and synchronously guards duplicate clicks. Finally releases controls after save, cancel or failure; existing notices/errors remain honest. `src/foundation-help.ts` describes pending/cancel/retry without issuing another letter.

`scripts/referral-pdf-progress-check.mjs` and `--doctor` passed on CyGQqxCF: delayed actual PDF/double-click makes one read, both buttons disabled, visible preparing state, native Save cancellation, exhausted real read loss/error, successful read-only recovery, F1/focus and Urdu preparing/cancel text. Zero business writes; both sessions restored preferences/signed out. The same fix serves Quality Register and Doctor Refer out. No independent full External Referral quality item is claimed because its wider contact/history/refusal matrix was not re-exercised; accepted unchanged help/endpoint claims are not duplicated.

DEV build/help/TS passed30screens557controls181groups. Release rebuilt as B3NEUiIq and verified compiled exclusion of Review-code field/IPC/allthreeDEVheaders. DEV remains CyGQqxCF. The prior77 unit pass belongs to backend-refresh core; targeted real UI checks verify this subsequent PDF interaction change. Existing large bundle warning remains.

## Human checks

Open Quality & Medical Records → Referral register. Find REF-2026-00001 and verify Cancelled, source patient/MRN, cancellation reason and original PDF. It is completed synthetic evidence: do not cancel it again or record a fictional receiving acknowledgement. Check date/pending/search filters, F1, PDF preparing/cancel/error recovery, Urdu and250% layouts. For portal fresh-data acceptance, the named human must create their own new synthetic upstream referral and walk the permitted role handover. Only that human enters their Review code and completes/signs portal review. No agent worksheet, physical printing or receiving acknowledgement is asserted.

Source2115db3 committed. Proposal138 saved/verified Pending for q:states/permissions/tested/handbook/F1/zoom; awaiting human review on /docs -> My progress. Exact payload referral-register-proposal-2115db3.json. No unchanged approved endpoint/rule or pending claim duplicated.
