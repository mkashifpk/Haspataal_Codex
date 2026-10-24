# Frontend continuation review — 24 October 2026

These are frontend findings; they were not filed as backend defects.

## Patient Search: retained merged profile displayed as current

The checkpoint's failed live merge check was valid: `GET /patients/{source}` retains the audited source and identifies its master. The screen displayed that source directly. Commit `a4079bb` follows the authoritative master, updates selected identity/financial context, guards late responses, and preserves an open source draft with Save blocked until explicit reconciliation. Real merge event118 (new scenario8fe222,10→11) verified this behavior. Lost PATCH/current-master replies and actual socket resync were also tested; the synthetic address was restored. Four resolver unit tests cover master traversal, stale selection, cycles/unresolved identity, and failed master reads.

Backend issues17(name queries with digits) and18(old merged MRN search) are separate reproduced API failures. Neither is hidden by manufactured results. The complete merge-rule/test-plan acceptance remains pending.

## Workspace launcher: reopening current workspace hides daily menus

`selectWorkspace` cleared the handbook outline on every selection. Selecting the already-current code does not change React state, so the workspace effect never reloaded the cleared outline. This removed implemented screens whose navigation follows the permitted handbook. The fix preserves the current outline and explicitly refreshes server data on a same-code reopen; a different code retains its existing clear-and-load path. Bilingual launcher instructions were updated.

The old smoke harness also had independent faults: cached navigation indexes drifted as authorized menus loaded, Settings uses h2, and initial single-workspace auto-opening could detach the picker card. The corrected smoke waits startup, selects a real workspace, locates fresh accessible labels, verifies active buttons and required screen inventory, and makes no business writes. These harness failures were not reported as backend bugs or counted as successful screen coverage.

Full human role journeys, native Urdu wording, editor review and physical printing remain pending. Automated navigation is not equivalent to acceptance of every endpoint/event/rule.

## My cash shift continuation — 24 October
Frontend fixes: reviewed-shift read failure now invalidates closure eligibility until a successful retry; new open/close checks fresh permission/counter/drawer rather than stale loaded context. A success notice captured in English is now translated on rendering after a language change. Evidence: docs/my-cash-shift-completion-evidence-2026-10-24.json (index-CM-4TamT.js,74unit/buildPASS, real zero-cash workflow and denied UI PASS). Backend17/18 unchanged; these defects do not require backend reports. Human role/Urdu/editor review remains pending.

## Outstanding dues continuation —25 October

Frontend findings fixed: partial write-off result lacked remaining balance; empty invoice filters showed a blank table without recovery guidance; Actions/View labels remained English in Urdu. Receipt balance, EN/UR empty-state guidance and missing labels added. Real Owner partial/full write-off and same-key lost-reply recovery passed on isolated AR3, followed by invoice read-failure/empty/detail/F1/layout checks and final translation check. See docs/RECEIVABLES_REVIEW_2026-10-25.md. Test harness lookup/translated locator/alert ambiguity failures and explicit test-profile restoration are retained separately; no new backend defect. Backend19 opening-float contract remains New/unanswered.
