# P9B 202–203 DEV evidence

Baseline 3483225. DEV build 2026-11-09T17:10:47.430848+00:00, contract 257cc319fed31b6ed2ac, rubric f5cb9ab955e1. The Quality report and Owner overview share the survey report, scope checks, action register and checklist editor. Owner also uses the existing schedule, cycle, panel, sampling, assignment and closure component. Reports render the MSDS 156–162 block first and use record number and MRN for patient records. The native allowlist accepts only the exact report PDF path with a positive canonical cycle ID.

## Live results

- Quality and Owner read the synthetic cycle MRR-2026-002 and its seven indicators in native Electron. Tested the server PDF via native Save and cancelled the local file dialog. Contextual F1 restored focus. Four English/Urdu handbook images came from DEV, with both themes checked at 250%.
- Quality created and retired one synthetic checklist criterion, created action 17 with a live owner, and completed it with evidence and version 1. DEV read-back shows Done at version 2. The follow-up Quality journey acknowledged synthetic finding 3 with a factual reason. The cycle remains InReview, with 3 Open, 2 Corrected and 1 Acknowledged. Do not replay these writes. Results and request IDs are in the adjacent JSON files.
- The initial Owner run timed out at DEV startup. A read-only retry using the normal shell bootstrap completed. All captured business mutations belong to the Quality demo account.
- Filed backend catalogue issues #67 (missing cycle directory for cycles without findings) and #68 (missing action register as a completion ID source). Both supporting reads already work and supply real identifiers. No business endpoint change was needed.
- Mandatory build passed for 202 handbook screens, TypeScript and bundle. npm test passed 873/873. The expanded native PDF-path security assertions also passed in a targeted rerun.
- Human acceptance and Urdu review remain pending. Physical A4 output, a withdrawal, an overdue action, Owner mutations and a successful final cycle closure were not exercised in these journeys.

Next in P9B are 204 Mortality statistics & death register (Quality) and 205 Death register & mortality (Owner).

The final Owner run opened the synthetic cycle, read its sampling plan and sampled item, and verified Close review was disabled with open findings. It then opened the report and server PDF. Final renderer index-BCpwAFtE.js, SHA-256 009f3a7c8626deef0c5d2e4fff084e065060afef73f0bd466bf8a7e9fb699f95. Quality writes ran on index-CGHWkCww.js; the final renderer adds the workspace guide text. Demo profiles restored preferences and signed out.
