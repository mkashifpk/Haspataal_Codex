# Manual checks after restarting the updated terminal

Build: `index-5oYMD73N.js` (24 October 2026). Restart the app to load the new build if an earlier terminal window remains open. Automated checks do not replace your review.

1. Sign in as Reception, open Workspaces, then reopen Reception. Confirm Patient document vault, Tariff, New registration, Queue management, Refund/waiver/credit and Cash-back remain available. Repeat reopening Clinical OPD/IPD as Doctor and check its clinical menu. This is the workspace-navigation fix.
2. In Patient Search use the existing synthetic master **MRN-2026-000007**, `SCN 8fe222 Identified`. Confirm the profile shows the master identity and lists old **MRN-2026-000006** in its merged history. Open Edit demographics, change an unsent field, press F1, close help and confirm the draft/focus remain. Cancel deliberately; do not register, pay or merge again to check this existing record.
3. Test optional UPMRN and duplicate identifier guidance with newly created, clearly labelled synthetic DEV data through Reception. A duplicate CNIC/UPMRN must direct you to search the existing patient, not create another. Check Patient Search can display, deliberately edit and clear the optional value. Never use real patient identifiers for this software review.
4. Repeat the relevant tasks in Urdu, both themes, zoom100–250% and reset100%. Review wording with a named native reader. Check the actual printer/PDF output for the workflow you accept. Fill the current role worksheet and approve only the items you reviewed in `/docs -> My progress`.

Backend issues **#17 and #18 are fixed and UI-retested** on 24 October. Names containing digits and old merged MRN000006 now find the correct master once; an English/Urdu note explains the old identifier match. #14 refund workflow and #15 Owner/cashier permissions were freshly exercised; #16 own-unsampled lab cancellation passed. Other-doctor/sampled refusal variants remain separate checks.

Fresh software-only fixtures available for inspection: patient13/MRN000009/ticket2, note1, Rx1, cancelled lab requisition1, document1Photo/document2outside report, education1 plus corrective entry2. Do not recreate or repay existing records. Synthetic Cash ticket3 is fully refunded; synthetic credit ticket4/AR1 is settled. Invoice5 deliberately remains CreditAuthorized with zero balance because AR collections are separate payments. Do not collect it again.

Phase2 is not fully accepted. Missing full API variants and named human journeys/Urdu/printing/editor reviews remain pending. See handoff.md and current per-screen proposals on /docs -> My progress; approve only reviewed items using the portal role worksheet.
