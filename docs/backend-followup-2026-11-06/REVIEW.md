# November6 in-place backend follow-up

DEV build2026-11-06T02:06:23.441687+00:00 is at both #54 and #55 fixed_in. Contract15b9937042045e7a0cde → a4772c79e2249316e1a9; rubric da7ddfe1584d. The backend explicitly preserved data: the current7429acf epoch, synthetic records and original retry keys were retained.

The only API schema delta is WorkspaceOut.every_employee (required), plus optional WorkspaceInfoOut.every_employee/guest. Shared generated interfaces and saved auth/workspace operations were refreshed. Login needs no further interaction change. The launcher excludes every_employee entries from its role-workspace count. A sole role workspace opens directly; My Workspace opens from the employee account menu and remains a card in a multiple-duty launcher. Guests have no employee workspace. Existing pending-write and unsaved-input switch guards remain.

## Fresh verification

- #54: the existing synthetic handover's original key/body returned200 with idempotent_replay true. The same body with omit_idempotency_key true returned409 WASTE_HANDED_OVER, retryable false, the actual waste_id/note/day, request key null and idempotency_key_omitted true. Combining a key and omission was refused before sending. No new waste was recorded or handed over.
- #55: Reception's workspace list now contains Reception then My Workspace, roles[] and every_employee true for the latter. Inspector lists only its inspection workspace; scoped self-service handbook403. One Reception scoped-handbook GET timed out; this read had no business effect. The actual app subsequently opened the scoped workspace successfully.
- Real Electron: Reception opened its sole duty directly, account menu/F1 led to My Workspace, and the live asset directory returned null purchase cost/date. One synthetic report on our own synthetic asset3 posted201 with one key. The returned work order and exact original request/key are saved; do not rerun that write harness. No money or real repair was requested.
- Real Electron: Owner's multiple-duty launcher retained the My Workspace card. Inspector had no employee workspace/account-menu entry. All three profiles restored preferences and signed out. English/Urdu and250% page bounds passed; a missing lang prop was corrected so self-service follows the shared language preference.
-864/864 unit tests passed. The first run had one test read a JSON file while contracts were being refreshed; it failed with Unexpected EOF. The stable-file rerun passed, without relaxing the help checker. The first workspace harness omitted the Support tab and stopped before a write; the corrected journey passed.

Foundation/release results and final proposal receipts are recorded in the root handoff and audit. Only changed, actually tested items are proposed; no human review was entered or signed.
