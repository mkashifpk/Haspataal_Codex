# Outstanding Dues verification — 25 October 2026

Owner/Hospital Admin review uncollectible debt after an authorised decision; Cashiers collect and settle. The screen must keep patient, invoice and remaining debt clear, including after partial write-off or a lost reply. Existing shared controls/layout are retained.

## Implementation

- `src/screens/Receivables.tsx`: confirmed write-off result includes remaining balance alongside cumulative write-off and status. An empty invoice filter now explains how to recover instead of showing an empty table.
- `src/receivables-i18n.ts`, `src/foundation-help.ts`, `src/help.ts`: English/Urdu message and guidance. Urdu remains draft pending named language review.
- Generated Receivables TypeScript compared with the current MCP after formatting: matches; no guessed contract changes.
- Contract `a9063847cb6fd629bfa0`, knowledge `85970bc300a07875`, rubric `d23b880e906d`, server build `2026-10-24T11:22:17.357549+00:00`.

## Confirmed financial workflow

`scripts/receivables-owner-active-check.mjs` passed on `index-DvSn1Yo3.js`. Fresh unpaid registration was created through Reception UI, then zero-immediate-payment Card credit and an eligible Owner approval created the debt. No cash, shift, payment or administrative mutation was used.

Synthetic identity: `DEMO-AR-WRITEOFF-1792873698881`, patient18, MRN `MRN-2026-000014`, ticket8, invoice11, approval6, creditrequest3, AR3. Partial10 write-off returned200 then its reply was dropped. Double-click sent one original request; explicit retry reused identical key/body and returned the same10 with `Idempotent-Replay: true`. Draft/dismissal stayed locked while uncertain. Final remaining1490 write-off produced cumulative1500/paid0/statusWrittenOff, removed the queue row and cleared the patient's outstanding flag. **Do not repeat those writes.**

Actual Cashier write-off returned403; Owner short reason422. UI rejected zero without a POST; F1 retained financial input/focus. Delayed queue read hid stale rows; persistent loss of actual queue/aging200 replies showed errors and successful read-only retry. Native upper250/reset100/lower100/persisted `/auth/me` preferences and English/Urdu both themes250% preserved the financial draft. Preferences restored and signed out.

Journal: `docs/receivables-owner-active-evidence-2026-10-25.json`. Original keys/bodies/results are retained. Initial nested-invoice lookup and English-only Urdu-dialog locator failures were harness errors; continuation reused the original records and never duplicated registration, approval or partial write-off.

## Final read-only verification

The state-test renderer `index-DNj70sFX.js` includes the additional invoice empty-state message. `scripts/receivables-invoice-states-check.mjs` verifies actual invoice list loading/error/Retry, a real empty Draft filter in English/Urdu, invoice detail failure/re-open, F1 focus and both themes/languages250%. **Passed; preferences restored and signed out.** Result is recorded separately in `docs/receivables-invoice-states-evidence-2026-10-25.json`; do not infer a pass until its `passed`, cleanup and sign-out fields confirm it.

The first read-only run's ambiguous alert locator matched the offline banner and detail error. Its injected fault also blocked cleanup. That failure is retained in `docs/receivables-invoice-states-harness-2026-10-25.json`. The original owned profile was reopened without the fault, original preferences verified against real `/auth/me`, and signed out: `docs/receivables-invoice-profile-reconciliation-2026-10-25.json`. The corrected script clears faults and waits for real connectivity before cleanup. No backend defect or business write resulted.

Build/help/TypeScript/Vite passed on DNj70sFX. All76 unit tests passed on the receipt implementation DvSn1Yo3, before the final invoice empty-message addition. Existing Vite large bundle warning remains.

## Manual review

1. Sign in as an authorised Owner or Hospital Admin; open your workspace → Outstanding dues. Inspect invoices and invoice11's lines. AR3 is already fully written off and correctly absent from the outstanding queue; do not try to pay that original invoice.
2. In Invoices & direct payments choose Draft. When there are no matching bills, check the English/Urdu explanation, then return to All statuses/All types. Check F1 from the filter, focus restoration and layouts at250%.
3. For a new write-off journey, the named reviewer must create a distinct synthetic unpaid registration through Reception UI, request zero-immediate-payment credit, obtain the eligible separate approval, then inspect/write off only that new AR with an explicit synthetic-test reason. Record new IDs/results on the portal's actual review worksheet. Partial write-off must retain the remaining debt; full write-off must remove it. This document is agent evidence/instructions, not a completed human worksheet.

Only newly verified states/zoom items are candidates for a proposal. Already accepted endpoints/write-off rule/safe-write/help/permissions claims are not resubmitted. Full API refusal matrix, role FAQ review, human fresh-data journey, Urdu/editor/design acceptance and physical handovers remain pending. Backend issue19 and the original ticket2 pending cash-back are independent; this workflow does not resolve or work around them.

Final label-only renderer index-D21_PzNk.js: Actions/View translated in Urdu, actual detail open, empty-result guidance and English/Urdu both themes250% screenshots passed. Evidence docs/receivables-final-language-evidence-2026-10-25.json; zero business writes/restored/signedout. Final build/help/TypeScript/Vite passed.

Source2144510 committed. Proposal132 saved/verified Pending for q:states/q:zoom only: awaiting human review on /docs -> My progress. Exact payload docs/receivables-states-zoom-proposal-2144510.json. No business or test command remains running.
