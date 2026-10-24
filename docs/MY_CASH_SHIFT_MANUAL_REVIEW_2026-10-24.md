# My cash shift — human acceptance checklist

Status: **unfilled; human review pending**. Agent tests are separate evidence. This file is not a signed review or approval.

Start with the portal's current Reception worksheet: `/docs/api/review-worksheet/reception` (and the Cashier/Pharmacy worksheet when reviewing those roles). Record its completed path/link and tested build in the portal's Review worksheet field. Keep this screen-specific checklist with it.

## Review identity (reviewer fills)

- Named reviewer / independent editor / Urdu reviewer:
- Date, source commit, renderer build, backend build:
- Account, terminal counter, device, languages, themes:
- Newly created shift IDs and upstream transaction IDs, if any:
- Expected / actual result and pass/fail for each row:

## Journey

1. Use your own authorized DEV test operator and correctly mapped test counter. Check My cash shift's terminal counter, cashier, shift number and business date. Do not close a colleague's existing drawer to obtain a test fixture. Opening/closing require finance.shift.operate; the accountant verifies the eventual cash drop separately.
2. With no open shift, check empty/negative/incomplete Opening float is blocked. Missing terminal counter requires IT mapping, not an editable substitute. Enter the actual synthetic opening float, click Open cash shift once and record the confirmed number. Check reloading and signing back in retrieve it.
3. Read totals and Drawer ledger of a shift. Compare cash and non-cash collections to any fresh upstream transactions in this review. Empty collections are explicit. Use Refresh; the cash-shift contract specifies no update event. Verify dates/times use the hospital timezone.
4. Enter Counted cash in drawer, excluding opening float. Press F1 and close Help: draft and focus must remain. Open Close shift, compare the frozen shift/counter/expected/count amounts. Go back must keep the counted amount and leave the shift Open. Check F1 from the confirmation too.
5. With IT/test supervision, change only the test terminal mapping after opening confirmation. Confirm must stop before a close write. Restore the mapping, Go back and Refresh successfully. A failed reviewed-record read keeps the old display labelled stale and disables closing until Refresh succeeds; input is retained.
6. Confirm the actual counted amount once. Pending collection confirms closure, not accountant approval. Read the original shift and arrange the accountant handover; no delete, undo or accountant verification is provided here. Show my current shift returns to the current drawer. The API provides no demographic-style update or delete: record those as not applicable with this contract reason.
7. Check lost replies with the test harness or supervised transport fault. Original opening retry retains its original identity and amount within24hours. Closing has no blind retry; Check original shift reads that exact drawer. A new action must not replace an uncertain one. Closing a reviewed recovery hold requires deliberate supervisor reconciliation, and is not a claim of success.
8. Check unavailable/forbidden operations with a non-cash role; new actions follow permission and counter checks, not the role's label. An unauthorized account must have no operating controls.
9. Follow the screen's role FAQs and workspace guide using only the authored instructions. Check English/Urdu, both themes, 100/150/200/250% zoom, upper/lower clamp, reset100, settings/shortcut consistency and persistence. Verify fields/dialogs/ledger remain reachable. Urdu wording is a draft until reviewed.
10. Independent editor: review the full role journey and record corrections, busiest-counter usability observations and final decision. Screen-only acceptance does not certify every Reception/Cashier/Pharmacy task.

## Results (named human fills; no agent results here)

| Task | New record IDs | Steps / expected / actual | Result and evidence |
|---|---|---|---|
| Open and validate | | | |
| Read / retrieve / ledger | | | |
| Count / cancel unsent confirmation | | | |
| Permission / mapping / stale-read refusal | | | |
| Close / PendingCollection / accountant handover | | | |
| Uncertain write reconciliation | | | |
| F1 / FAQ / Urdu / zoom / editor | | | |

Human decision/signature: **pending**. Approve only reviewed evidence under `/docs -> My progress`; agents cannot fill or sign these results.
