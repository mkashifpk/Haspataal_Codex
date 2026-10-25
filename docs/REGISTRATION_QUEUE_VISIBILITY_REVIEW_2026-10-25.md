# Reception queue visibility — 25 October 2026

Reception staff need to confirm a settled visit reached the selected doctor by matching the issued slip and token. The previous Registration panel rendered only queue counts, although its actual server response included patient rows. Real DEV Electron reproduction confirmed that omission. This is a frontend visibility defect; it is separate from whether an individual unpaid visit is eligible to queue.

Registration now displays each server-provided patient name, slip, token, ticket status and payment status grouped under the returned doctor/department. Refresh queues is read-only and preserves the intake draft. Pending/failed reads hide old rows and show loading/error with retry rather than a false empty list. Confirmed local intake and ticket reloads also trigger a board read, preserving existing event/reconnect refresh without polling. The unpaid draft explains payment/billing authorisation and that patient-only intake creates no visit. No default payment or queue transition was changed.

Files: src/screens/Registration.tsx, src/registration-i18n.ts, src/foundation-help.ts; reproducible read-only check scripts/registration-queue-visibility-check.mjs. Bilingual contextual queue guidance is bundled with the control inventory and Reception help. Urdu remains subject to named language review.

Current MCP registration bundle (including omitted sections), quality/design/workspace brief/handbook, endpoint and generated response types were read. Contract a48efc9c8254ac5137e2 is unchanged; the existing generated QueueBoardOut/QueueBoardEntryOut fields already match. No request contract changed.

Verification:

- Baseline `node scripts/registration-queue-visibility-check.mjs --baseline`: confirmed real queue entries missing from Registration rows; zero business writes.
- `npm run build`: PASS, 30 screens/559 controls/182 groups plus TypeScript/Vite; DEV DgWAosqu. Existing bundle-size warning remains.
- `npm test`: 79 PASS.
- `node scripts/registration-queue-visibility-check.mjs`: PASS real returned rows, read failure/stale hiding, explicit recovery, preserved intake draft, F1 queue help, Urdu/high contrast at250 with no document overflow; zero business writes, preferences restored and signed out. Evidence: registration-queue-visibility-evidence-2026-10-25.json. Native screenshot under ignored artifacts; Playwright clipping under native zoom was unsuitable, replaced by native capture.

The user supplied a missing registration identifier. Read-only patient lookup → patient-filtered invoice list → returned ticket confirmed correct doctor assignment but Issued/Unpaid and queue=null. No registration, payment, authorisation or queue change was submitted on that record. Identifiers and personal/financial particulars are deliberately omitted here. No backend failure was reproduced or reported for this finding; existing reports20/21 remain New.

Limits: no fresh registration/payment/WebSocket handover was repeated in this run; the current endpoint/queue visibility change alone is proposed. This is not full Registration/Phase2 acceptance, human review, translation approval or hardware acceptance.

Manual check: restart the DEV app, open New registration + OPD slip and inspect Live OPD queues below the intake/documents. Match a queued slip/token to its patient and doctor; Refresh queues should retain any draft. For an existing unpaid visit, open its original OPD slip and complete the permitted payment or billing-authorisation workflow once; then verify its returned token and the assigned doctor's My live queue. Never repeat registration/payment merely to refresh a queue.
