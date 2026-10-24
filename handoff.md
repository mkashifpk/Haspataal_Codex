# Haspataal checkpoint

Updated 24 October 2026 — Codex/functions, Asia/Karachi. ACTIVE: finish pending Phase2 implementation before the user tests later. One screen at a time; do not stop for review.

## Current state

- Baseline b13d64b; search UI ebf19a675d125a60c25e7cda7c35fe1563f27d65 and proposal checkpoint5e5601f committed. Receivables fix/test/evidence currently uncommitted, next commit after final build/test. No known running Electron test, no uncertain business write.
- Backend17/18 Fixed/deployed and UI retested. Server2026-10-24T11:22:17.357549+00:00, contracta9063847cb6fd629bfa0, rubricd23b880e906d. Existing merge10->11 must never replay. OldMRN000006 finds master11/currentMRN000007 once; server match note shown EN/UR in Search and four clinical selectors.
- Search proposals110–114 confirmed; 109cashshift pending. All awaiting human review on /docs -> My progress.107/108 accepted. Payloads docs/patient-search-backend-ui-proposals-ebf19a6.json. No human review claimed.
- Fresh OPD journal docs/phase2-fresh-cycle-2026-10-24.json: patient13/MRN000009/ticket2(OPD000002), note1, Rx1, requisition1Cancelled. Original registration reply lost; original key b4924f79-7c2f-47be-b503-2cd82c8d374b replay returned same existing patient/ticket/payment. Receipt docs/phase2-fresh-registration-reconcile-2026-10-24.json. NEVER register/pay this visit again. NotExamined note, full OPD Rx, no empty handover POST, owned unsampled lab cancellation passed. Physical care/handover not claimed.
- Financial software simulation COMPLETE: run DEMO-FINANCIAL-1792855557186, employee42/user40/terminal8/shift8. Cash ticket3(patient14)1500fullyrefunded/cashbackconfirmed; shift closed PendingCollection expected0/declared0; account/terminal inactive. Credit ticket4(patient15)/invoice5/AR1 settled1500Card/payment5. Original invoice correctly stays CreditAuthorized with balance0; never collect it again. Read verifier passed. Journal artifacts/phase2-financial-cycle.json; durable docs/phase2-financial-evidence-2026-10-24.json. Original receipts preserved; harness errors (immediate status read, ambiguous Close, false Paid expectation, unsupported settled-list filter) are not backend defects. No business actions need replay.
- Receivables frontend fix src/screens/Receivables.tsx hides write-off without permission and provides EN/UR guidance; removes impossible settled/writeoff filters from outstanding-only list. Bilingual FAQs/help explain separate AR settlement. Actual active-row cashier flow and final Owner/Cashier readonly invoice/F1/ENUR250% checks passed; final queue empty so positive Owner writeoff not tested. EN/UR handbook screenshots refreshed. Current renderer index-UowogTsn.js. Final build PASS30screens555controls/TS/Vite;74unit tests previouslyPASS, rerun pending now.
- Whole started-screen smoke PASS76visits/28authenticatedIDs across6roles; no runtime errors/5xx/businesswrites; prefs restored/signedout. Navigation only, not full plans. Source docs prior evidence records Connect/Login too.

## Next concrete steps

1. Finish current tests/commit Receivables and fresh-cycle evidence; propose only newly tested items with commit and verify saved proposals. No empty/invented/full-plan claims.
2. Continue Patient Document Vault/optional upload contract review and fresh synthetic UI checks using patient13 after exact identity confirmation. Inspect Skip photo error/file-reset recovery and fix if reproduced; upload separate from registration/payment. Read current bundle/quality/design/endpoints before edits.
3. Remaining Phase2 API/rule/event variants and final manual checklist.19screens implemented but no full acceptance; named human fresh-data/Urdu/FAQ/editor/physicalprinting gates remain. No Phase3.

## Durable environment / history

DEV https://hms-dev.netbird.cloud. Authorized ignored .dev-terminal.json/local MCP config provide connection; never stage credentials or artifacts/profiles. Old pre-reinstall IDs/scripts must not replay. No subagents. Historical checkpoints/fixtures/open decisions in docs/HANDOFF_PRIOR_PHASE2_2026-10-24.md and docs/HANDOFF_HISTORY_2026-10-24.md; latest statements above supersede stale backend states.16Fixed own-unsampled lab cancel allowed; sampled/otherDoctor refusal still fresh-test pending.15Fixed Owner AR permission respected;14Fixed refund retest now successful.
