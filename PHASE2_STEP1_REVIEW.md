# Phase 2, step 1: My cash shift

Date: 2026-10-20. Implementation 1 / Codex. Scope: **one existing screen**, `my_cash_shift` (roadmap P2 position 12). No other Phase 2 screen was developed in this step. Phase 1 acceptance remains pending.

## What changed

Counter staff start here before taking cash. The screen verifies the terminal's actual mapped counter, shows the current shift/cashier/business date and cash/non-cash collections, then provides a reviewed counted-cash handover. The screen uses the project's existing cards, fields, dialogs, errors and permission checks; no new design-system approval is claimed.

- Counter identity comes from real `GET /terminals/whoami`; there is no editable substitute or fallback node. A missing/mismatched counter blocks opening/closing and explains the IT prerequisite.
- Amounts reject empty, partial, negative and nonfinite input. Zero is valid. Money uses server currency metadata; timestamps use hospital timezone independently of workstation time.
- An opening retains its immutable counter, float and request key in memory before sending. An uncertain result blocks replacement actions; an explicit retry uses the identical request within 24 hours. A confirmed opening is not repeated if its subsequent read fails.
- Closing is a state-guarded operation, not an idempotent replay. An uncertain/refused close retains the original shift and amount and offers a real read of that exact shift, never an automatic close retry. The operator and supervisor reconcile before explicitly clearing the hold. Clearing it does not invent success, undo or accountant approval.
- Draft navigation and pending-action guards apply, including sign-out and normal window-close attempts while a cash action is unresolved. F1 retains the underlying form; confirmation cancellation does not submit. Saved closed results remain visible, and Show my current shift returns to the current server result. Forced process termination/session revocation can still lose memory-only recovery context.
- Ledger results stay associated with the selected shift. Refresh reads only; the contract promises no cash-shift-specific realtime event.
- Added detailed bilingual controls, screen instructions, reception role-task mappings, recovery FAQs and real DEV examples. Urdu remains a draft. Help coverage now includes this first Phase 2 screen; Phase 1's pending Help protocol gap is unchanged.

## Verification and limits

Current source is HEAD `006c8685bfd7b4a5511a18091d77caa8893ee075` plus the uncommitted step changes; no new commit created. API fingerprint `0b5ab90e400dfbb822d3`, knowledge `318d65bdd91cd873`, UI standard `955624dcfc85ddb2`. Original-record recovery endpoint saved from live MCP in `contracts/cash-shift-recovery.json`; open/close example request bodies passed MCP validation.

- `npm run build`: passed handbook coverage, TypeScript and Vite (existing large-bundle warning). Structural inventory: 12 screens, 113 controls, 46 groups, 33 FAQ seeds and 30 scoped role guides; 24 EN/UR screenshots.
- `npm test`: 28 passing tests, including strict amount handling, immutable opening replay/retention and uncertain-versus-definite outcomes; the coverage gate rejects an uncovered cash-shift control.
- Control inventory: `docs/phase2-step1-control-inventory.json`. Final bundle: `dist/assets/index-KU_DNFF8.js`, SHA256 `a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54`. Runtime suites used `index-QKfcFctZ.js` (SHA256 `4eec408d71f15da5171c68860fe1cb7f4523a7bddc6596e041335937d1127568`); the final rebuild adds only the missing Urdu translation for Invoice, with no control/behavior changes.
- `npm run test:foundation`: final shared regression passed 14 checks, including native zoom, F1 from fields/dialogs, unsaved work, account-filtered Help, restart recovery and sign-out/sign-in; real preferences restored, no business writes. Log: `artifacts/cash-step-foundation.log`.
- `node scripts/cash-shift-check.mjs`: uses existing DEV data and restores preferences. Evidence: `artifacts/cash-shift-check.json`, `artifacts/cash-shift-check.log`, EN/UR handbook PNGs and 250% captures. The environment has an **unmapped terminal**; its blocked-write path is real. No counter was fabricated or remapped. No open/close/payment was submitted.
- English overview and Urdu at 250% were visually inspected. Read-only regression is not human acceptance. Mapped-terminal open/close, editable field/dialog draft journeys, concurrency, uncertain server-commit replies, accountant handover and a new synthetic cash lifecycle remain pending.

The retry attempt is memory-only under the current local-draft policy. Keep its window open while reconciling. After closing/reloading or signing out, do not invent a new key/repeat a financial action merely because local context is gone; ask the supervisor to inspect actual server records. No durable-recovery or full Phase 2 completion claim is made.

## Test this step

1. Open the desktop app as `demo.reception`, then **My cash shift**. Check the shift number/cashier, terminal counter, date, cash totals and ledger. Use **Refresh** and F1. Read errors must remain visible.
2. If **Not mapped — ask IT** appears, confirm opening/closing is blocked. Have authorized IT staff configure the correct real terminal mapping before financial testing; this step does not implement or configure the full IT console.
3. In a coordinated synthetic DEV session, use a dedicated account/counter with no shared active drawer. Open with a known float; verify the returned shift. Do not close the existing shared shift just to tick this checklist.
4. On that new shift, enter counted cash excluding float, open confirmation, press F1, close Help and **Go back**. The draft should remain and no close should occur. Reject a navigation warning to retain input.
5. Close deliberately once, read the returned status and original shift. PendingCollection still requires the accountant's independent verification. Do not claim that verification in this screen.
6. With the backend team coordinating failure scenarios, exercise a lost opening reply (same-key replay only) and lost/refused closure (read original shift; no blind retry). Check the supervisor-reviewed release. Unit cases are not proof of these live scenarios.
7. Review English/Urdu, themes, keyboard zoom bounds/reset/persistence, dense content and Help. Complete the reception human-review worksheet with new record IDs and actual outcomes before accepting relevant items.

Backend issue #7 remains the earlier New/Low approval-outline documentation issue. No new backend defect was demonstrated by this step. This screen and the whole phase remain pending human review. The next screen is chosen only after this testable step is handed back.
