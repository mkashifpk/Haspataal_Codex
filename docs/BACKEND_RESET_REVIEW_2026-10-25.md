# Backend refresh verification —25 October 2026

Baseline `ccd69e7` had recorded uncommitted Review-code and partial cash/maintenance work. It was preserved and reconciled before continuing. DEV build `2026-10-24T21:23:38.916290+00:00`, contract `a48efc9c8254ac5137e2`, knowledge `5d997abd8847f89d`, rubric `a400860f309d`. Implementation1/mkashif. The database was reset: historical IDs are not test prerequisites and must never be replayed.

## Issue19 and UI changes

Issue19 is Fixed and freshly reproduced as corrected: opening float is issued from the vault as `OpeningFloat`; `expected_cash` is the whole drawer. My cash shift renders server `expected_cash`/`declared_variance`, labels Opening float in ledger/totals, and asks staff to count everything including the float. It never computes a drawer balance or subtracts the float. Current MCP screen/endpoint/schema types were regenerated, including CashShiftOut, CashShiftSummaryOut and ShiftTransactionOut. English/Urdu help and fresh screenshots were updated.

Original owned reset fixture: run `DEMO-RESET-CASH-1792903058875`, employee36/user34/terminal2. Fresh shift1 opened1500, cash sale1500 brought it to3000, approved refund/cash-back returned1500; cleanup closed declaring1500/variance0. New shift2 received Cash AR collection1500 and closed whole3000/variance0. Original AR1 was settled once; invoice stays credit-authorised with zero remaining balance. Separate shift4 float1000/Card sale left1000; actual409 INSUFFICIENT_DRAWER_CASH retained the prompt/balance; separately keyed synthetic cash sale brought2500, cash-back returned1000, whole close1000/variance0. Shift6 verified original-open-key replay/one shift, different-key SHIFT_ALREADY_OPEN, foreign actor SHIFT_NOT_OWNED on our owned synthetic drawer, whole1500 close/variance0, then SHIFT_NOT_OPEN. No other person's drawer or real funds were used.

Fresh separate employee37/user35/terminal3/shift5 (verify actual evidence identifiers before use) exercised a cash sale, Final NotExamined software-only note, post-consult waiver, lost201 identical-key/body replay, eligible Owner approval, actual waiver-ready event and exact blocking cash-back. It ended Waivered, not Refunded, and closed whole1500/variance0. All owned accounts/terminals inactive and drawers PendingCollection; preferences restored. These financial records are complete: **never recreate/repeat them**.

Evidence: `reset-cash-cycle-evidence-2026-10-25.json`, `reset-postconsult-waiver-evidence-2026-10-25.json`, `reset-cash-reconciliation-2026-10-25.json`. Original keys/bodies/receipts and failures are retained; original local full traces are ignored artifacts.

## Maintenance

Login and the app shell show the exact server maintenance message, including Unicode and line breaks, from health polling, system.maintenance and MAINTENANCE errors. No hard-coded replacement remains. ErrorBox bypasses local translation for MAINTENANCE; the shared bridge dispatches its actual message and authenticated health polling keeps the banner current.

The user explicitly authorised a brief shared DEV maintenance window. Actual IT PUT set a clearly marked bilingual multiline message; prelogin Urdu polling, authenticated live event/full-screen banner and a frontend read's actual503 MAINTENANCE error matched it word for word. Original mode=false/message="" restored and re-read; apps closed and preferences restored. A timed restore guard and finally protected the shared state. Evidence: `maintenance-live-evidence-2026-10-25.json`.

## Six requested screen plans

Current screen_test_plan and full bundles/quality/design were read for all six screens. Automated execution covers:

| Screen | Current DEV checks | Limits outside this refresh pass |
|---|---|---|
| My cash shift | New own nonzero floats, mine/ledger/summary/close, server variance, same-key opening replay, already-open/not-owned/not-open refusals; denied-role requests | Named physical count/Accountant handover review; pending109 is not duplicated |
| Cash-back prompts | New refund and waiver prompts, exact blocking amount/acknowledgement, insufficient cash/no movement/recovery, eligible approval handover, denied roles | Not every already-dispensed/same-key payout/missing-shift variant rerun; real physical handover/human review pending |
| Registration | Fresh atomic Cash and Card/unpaid UI intake, queue/live handover, printing payload read, catalogue/staff/queues and forbidden-role requests | Photo/camera/file matrix, inactive capability, full discount/duplicate/concurrent intake variants not all rerun; no hardware acceptance |
| Receivables | Original fresh credit approval/Cash collection receipt, actual zero balance, current aging/invoice reads, denied settlement/write-off/payment/read roles | Fresh positive write-off/direct-invoice collection and complete refusal matrix not rerun after reset |
| Login | Real disabled/invalid/locked/countdown, lost200/no auto-retry, double submit, forced password/policy/wrong-current refusal/lost change reply recovery; health/terminal/licence reads and actual maintenance | Controlled expired/rate-limited/licence grace/locked/degraded DB conditions and hardware/network modes not all rerun |
| App shell | Actual metadata, two-window logout once/all own sessions revoked, token rotation/reused-token family revocation/TOKEN_REVOKED, actual maintenance event/error/poll/recovery | Automatic near-expiry timing and controlled licence transitions need dedicated current-server/human coverage |

`reset-six-screen-api-check.mjs` passed current reads and21 actual403 FORBIDDEN checks with known reset records; no successful business write. `reset-login-refusal-check.mjs` dynamically uses only our verified synthetic user and passed real UI/session recovery; account inactive afterwards. `reset-refresh-token-check.mjs` used independent test session families only, never revoked another person's sessions. Relevant evidence is the matching dated JSON. Full q:tested/human/physical acceptance is **not** inferred from selected regressions.

All encountered failures were corrected or reconciled: missing amount/reference in a harness prevented any settlement/Card registration POST; a transient DEV timeout prevented the next drawer open, after which owned state was read and cleanup completed; the old degraded-health unit fixture lacked newly required maintenance_message and was corrected to null. These are not fabricated successes or new backend defects. No new functional backend issue remained reproduced at completion of this pass.

## DEV Review code and build verification

One app-wide initially empty field lives in Settings → This terminal, also before login. It is process-memory only, survives account/workspace/window switches and clears on app exit. Shared native requests add optional X-Haspataal-Review beside verified developer/implementation headers only in DEV. Public CA bootstrap adds only DEV attribution; signed-in/provisioned server-inspection guards were verified to refuse before HTTP. No token or code is logged. **No agent/test entered any review code**, including a synthetic one.

Final DEV renderer `index-xY4otd9s.js`: build/help/TypeScript passed30screens557controls181groups. All77 unit tests passed after the health fixture refresh; final unused-text removal is covered by the build. Release renderer `index-Bt4DfijM.js` and bundled main passed executable omission checks and actual release HTTP tests: no field, no IPC and none of all three DEV headers, even unpackaged with DEV provisioning. Source main SHA256 `e3f7537918529c1bce13098f16893124e7814ae3601b3cdafa8cc0f02a153911`. Existing large bundle warning remains. No signed installer was produced; package the staged `artifacts/release-terminal`, not DEV source.

Final DEV check passed empty field/public F1/focus/English-Urdu both themes250% and actual attribution with Review header absent. Final release check passed actual absence. Nonempty-code association is intentionally human-only. Existing proposal133 is pending for the new control's F1 and is not duplicated.

## Human checks

1. Start/resume the appropriate review on the portal for the identified build. Type your own Review code into DEV Settings → This terminal and Apply. Check role/window requests and portal association; clear/apply when done. Agents have not performed this step or filled/signed a review.
2. Use a fresh synthetic own drawer: verify Opening float and whole-drawer amounts, a permitted cash collection/payout and counted close, then read server Declared variance. Never pay/register again to reproduce an old receipt.
3. Review English/Urdu wording, F1/focus/zoom and actual hardware/physical workflows. Maintenance was restored; another shared outage requires coordination. Human fresh-data/role FAQ/editor/design acceptance remains pending; Phase2 is not declared fully accepted.
