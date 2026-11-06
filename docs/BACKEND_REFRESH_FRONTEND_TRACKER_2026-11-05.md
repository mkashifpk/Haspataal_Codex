# Frontend findings during backend7429acf refresh

These are frontend defects, separate from backend reports52–55. Human acceptance remains pending.

| Finding | Status / verification |
|---|---|
| Waste handover draft could lose its original pending context if collection editor/navigation replaced it | Fixed f302364; actual lost committed reply, exact-key replay and navigation/editor locks passed |
| Equipment detail omitted supplier and showed contractor visits as Staff | Fixed f302364; actual supplier_name/vendor_name shown in fresh DEV UI |
| Recovery Board issued unused empty staff query and received422 | Fixed f302364; removed unused call; all three actor variants read successfully |
| Duty Roster HR, donor assessment, CSSD setup and Lab Admin overflowed at250% | Fixed f302364; responsive form/table scrolling; focused ENUR reruns passed |
| HR Staff Directory treated service views as strings and omitted core entries as hidden | Fixed f302364; exact current screen objects/permissions; named fresh Draft resume passed |
| Self-service had old screen-list checks and always-true write permissions | Fixed f302364; exact permission/core-view policy tests passed. Normal UI access passed after backend55 November6; synthetic named-asset issue201, no cost/date; no bypass |
| Raw full contract import brought agent-only delivery instructions into release renderer | Fixed f302364 with schema-only imports; release exclusion verifier passed |
| Composite directory controls lacked their visible Field accessible names | Fixed db216b6; final role-based accessibility lookup for named owner/department passed |
| Investigator mine=true also included reports assigned to others | Fixed db216b6 by actual investigator_user_id filtering; reporter-only menu hidden, assigned investigator menu present |
| Calendar analysis due date was formatted as an invented clock time | Fixed db216b6; actual YYYY-MM-DD preserved and final current-read assertion passed |
| Autopsy report offered idempotent retry although backend uses final-state guard | Fixed in current follow-up source; final lost-reply/reread-only reconciliation passed with exactly one POST. Separate upload alone keeps original-key retry |
| Autopsy time/correlation prefilled and local performed time not converted explicitly | Fixed in current source: blank actual values, hospital timezone conversion and exact permissions; fresh UI time/scan/context-race verification passed |

The initial attachment test harness also used the same filename for its journey and session journal; it refused before launching an app or making requests. The journals are now separate, and the harness-only failure is preserved under ignored artifacts. No patient, prescription or upload was recreated for this test error.
