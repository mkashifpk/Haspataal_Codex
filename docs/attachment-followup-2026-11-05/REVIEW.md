# Attachment and older-collection follow-up

These are real DEV Electron journeys using fresh, explicitly synthetic records from the 7429acf reset. No real care, physical waste, supplier payment, death certification or human acceptance signature was performed.

## Verified changes

- Prescription: patient3/prescription1, separate Prescription scan document2; a lost upload answer replays the original key/body, then a separate Scan handover attaches the returned document. No repeat prescribing, registration or payment. Choices show the actual title/date rather than requesting a document number.
- Death register: synthetic patient2/death1, separate AutopsyReport scan document3. The actual report time and correlation start blank. The hospital-local time is converted to UTC. A deliberately lost final-report answer is reconciled by reading the death, with exactly one report POST and no replay: that endpoint has a final-state guard, not idempotency protection. The confirmed scan, author and time remain visible.
- A second synthetic context (patient4/death2, Authorized and never reported) proves a delayed real response cannot overwrite another selected death. Switching contexts clears unsent findings/time/correlation. Unsaved input protects navigation. No role-name permission fallback remains.
- Waste: optional collection-date filters include earlier collections. A failed read clears stale selection and does not claim an empty list; a late answer cannot overwrite a later picker read. Requests select at most500 collections. The5000-row list limit warns without disabling a valid selected handover. Reconciliation uses the selected collections' actual date range; the confirmed server response displays the final note even outside the current-month ledger.
- October collections5/6 were handed over once (sum0.03); the harness stopped after the committed response was deliberately hidden. Its saved original key/body replay confirmed the same result. They were never recreated. Distinct collections7/8, with different test weights/markers, passed the complete UI recovery journey (sum0.09). All eight test collections are final.
- Directory choices include real distinguishing name/badge/department/registration/asset/operation context. Active-only filtering applies to departments and vendors. Purchase information is excluded from labels. The Onboarding Draft and four-actor maintenance/lab/incident regressions passed after this change.

The adjacent journey JSON files contain the actual outcomes, request IDs and synthetic record provenance. Failed harness assumptions (a safely retried GET, and an assertion before an asynchronous reconciliation read completed) remain recorded in the handoff/history; neither was represented as a backend defect. No uncertain business write remains.

## Limits

The500/5000 bounds were checked against the schema and implementation; thousands of waste records were not fabricated. These targeted journeys do not constitute every historical CRUD/screen_test_plan case, native Urdu editorial acceptance, physical printer acceptance or a named human's fresh-data workspace review. Those reviews remain human-owned on `/docs -> My progress`.
