# Manual checks after restarting the updated terminal

Build: `index-CtYF9m4r.js` (24 October 2026). Restart the app to load the new build if an earlier terminal window remains open. Automated checks do not replace your review.

1. Sign in as Reception, open Workspaces, then reopen Reception. Confirm Patient document vault, Tariff, New registration, Queue management, Refund/waiver/credit and Cash-back remain available. Repeat reopening Clinical OPD/IPD as Doctor and check its clinical menu. This is the workspace-navigation fix.
2. In Patient Search use the existing synthetic master **MRN-2026-000007**, `SCN 8fe222 Identified`. Confirm the profile shows the master identity and lists old **MRN-2026-000006** in its merged history. Open Edit demographics, change an unsent field, press F1, close help and confirm the draft/focus remain. Cancel deliberately; do not register, pay or merge again to check this existing record.
3. Test optional UPMRN and duplicate identifier guidance with newly created, clearly labelled synthetic DEV data through Reception. A duplicate CNIC/UPMRN must direct you to search the existing patient, not create another. Check Patient Search can display, deliberately edit and clear the optional value. Never use real patient identifiers for this software review.
4. Repeat the relevant tasks in Urdu, both themes, zoom100–250% and reset100%. Review wording with a named native reader. Check the actual printer/PDF output for the workflow you accept. Fill the current role worksheet and approve only the items you reviewed in `/docs -> My progress`.

Known backend failures, still open: **#17** matching names with digits may return no results; **#18** searching the old merged MRN000006 returns no result. The current masterMRN000007 works. These are reported failures, not completed acceptance checks. Phase2 is not yet fully accepted; the remaining full API variants and human journeys still need review.
