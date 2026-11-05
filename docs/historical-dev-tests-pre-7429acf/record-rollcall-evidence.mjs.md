# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from "node:fs";import assert from "node:assert/strict";
const read=p=>JSON.parse(fs.readFileSync(p));
const main=read("artifacts/rollcall-check.json"),final=read("artifacts/rollcall-final-check.json"),access=read("artifacts/rollcall-access-recovery.json"),cleanup=read("docs/rollcall-cleanup-verified-2026-10-28.json");
assert(main.uiOutcome&&main.checks.some(x=>typeof x==="string"&&x.includes("HR previous-shift")));assert(final.checks.length>=4);assert(access.passed);assert.equal(cleanup.owned.length,11);assert(cleanup.owned.every(r=>r.status==="Cancelled"));
const evidence={date:"2026-10-28",scope:"Roll Call individual verified cases; original runner failures retained, not rewritten as full-script passes",renderer:final.renderer,main:{run:main.run,checks:main.checks,original:main.originalPost,replay:main.uiOutcome,writes:main.writes,cleanup:main.cleanup,runner_error:main.error},final:{run:final.run,checks:final.checks,writes:final.writes,runner_error:final.error,cleanup_error:final.cleanup_error},access,cleanup,unit_tests:{passed:178,total:178,log:"artifacts/rollcall-final-tests.log"},build:{passed:true,log:"artifacts/rollcall-final-build.log",screens:50,controls:988,groups:401,faq_seeds:50,workspace_guides:30},limitations:["No signed human review or Urdu approval","No physical badge tap; Badge/Manual/RollCall first_in guards covered by policy plus live RollCall/HR source","Full screen_test_plan item not claimed; individual executed cases only","No busy-hour or named-editor acceptance","HR Attendance/Operations support roster are separate later screens"]};
fs.writeFileSync("docs/rollcall-evidence-2026-10-28.json",JSON.stringify(evidence,null,2)+"\n");console.log("Saved confirmed individual-case evidence with historical failures and reconciled cleanup");

```
