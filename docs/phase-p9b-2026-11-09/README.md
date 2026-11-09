# P9B implementation checkpoint

This pass implements roadmap screens 194–199. The six screens reference 27 distinct API operations across their current bundles. Twenty-one operations were exercised successfully with the actual DEV terminal. Reused operations may already count in the portal.

| Screen | Implemented and verified on DEV | Further verification |
| --- | --- | --- |
| 194 · Consent policy setup | Named forms, idempotent create and original-key replay, Urdu text with server direction, metadata update, retirement, decision-maker read and official PDF. | Shared decision-maker and settings edits, physical printing, legal and human review. |
| 195 · Quality consent register | Period, category, status, unscanned filters, recorded English and Urdu draft details, English server PDF, Urdu terminal PDF and monthly statistics. | Signed outcomes, a nonempty statistics breakdown and an independent realtime event check. |
| 196 · Owner consent register | Same contracts under the separate Owner / Hospital Admin navigation and F1 scope. Both PDFs and statistics verified. | Same data and human coverage as Quality. |
| 197 · Record review cycles | Status, list, planned detail, eligible medical and nursing panel, idempotent planning and original-key replay, panel update, empty server sample and cancellation. | Start, read sampled item, assign and close on a populated synthetic cycle. |
| 198 · Doctor record-review worklist | Own empty list, reviewed filter, active criteria and scoped F1. | Assigned snapshot, auto-answer overrides and final review submission with a fresh sampled record. |
| 199 · Head Nurse record-review worklist | Same reads under Head Nurse scope. Ordinary Nurse got 403 in a separate API check. | A fresh assigned nursing record and final submission. |

The register harness first timed out on an incorrectly scoped test locator after the Quality PDF and statistics responses had arrived. The corrected run passed in both workspaces. F1 and English/Urdu screenshots and 250% layouts were checked on all six screens. No human workspace review or Review code was used.

The final `npm.cmd run build` passed TypeScript and mandatory handbook coverage for 198 screens. `npm.cmd test` passed all 873 tests. The final DEV renderer is `index-Drx8w9Jd.js`, SHA-256 `56c3a102daba7e21c5fdf320f2edf5b24a2db88df2b4d4dae64785f1aadbfc30`. Native evidence records the exact renderer for each run.

## Confirmed synthetic fixtures

- Consent policy form `SYNTH_P9B194_1794242471008`, ID 10, was created once, gained Urdu text, had its display order corrected and is retired. [Terminal evidence](194-journey.json)
- Drafts `CN-2026-000001` (English) and `CN-2026-000002` (Urdu) were created on the explicitly synthetic patient 8. Both are unsigned. The Quality and Owner journeys used business reads only. [Quality evidence](195-journey.json) · [Owner evidence](196-journey.json)
- Review cycle `MRR-2026-001`, ID 1, was created for an isolated 2021 period, its panel updated once and the cycle cancelled. Its sample was empty and no records were drawn. [Terminal evidence](197-journey.json)
- Doctor and Head Nurse had zero assigned records and 28 active criteria. Schema validation passed for the final review body. [Sandbox results](198-199-api.json) · [Doctor evidence](198-journey.json) · [Head Nurse evidence](199-journey.json)

The next catalogue screens are 200 and 201, Record deficiencies to fix for Doctor and Head Nurse. A populated synthetic review cycle is still needed to verify the remaining management and reviewer write paths and generate fresh downstream deficiencies.
