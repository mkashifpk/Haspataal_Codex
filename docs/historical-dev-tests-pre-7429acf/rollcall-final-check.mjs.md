# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final renderer checks: no attendance submissions; only fresh owned upstream duties.
import {session,expect,help,capture} from "./clinical-test-kit.mjs";
import fs from "node:fs";import crypto from "node:crypto";import assert from "node:assert/strict";
const file="artifacts/rollcall-final-check.json";assert(!fs.existsSync(file),"Reconcile existing final journal first");
const original=JSON.parse(fs.readFileSync("artifacts/rollcall-check.json"));assert(original.finished&&original.cleanup.length===4);assert(original.uiOutcome);
const j={run:"DEMO-ROLLCALL-FINAL-"+Date.now(),writes:[],checks:[],passed:false};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const pass=m=>{j.checks.push(m);save();console.log("PASS "+m)};let h,s;
async function write(method,path,body){const w={method,path,body,key:crypto.randomUUID()};j.writes.push(w);save();w.result=await h.native("api",{method,path,body,key:w.key});w.confirmed=true;save();return w.result}
try{
 h=await session("rollcall-final-hr","demo.hr");s=await session("rollcall-final-headnurse","demo.headnurse");const p=s.p;p.on("dialog",d=>d.accept());j.renderer=s.j.renderer;save();
 const own=original.created.map(r=>({employee_id:r.employee_id,roster_date:r.roster_date,shift_pattern_id:r.shift_pattern_id,duty_area:r.duty_area,ward_id:r.ward_id,bed_ids:[],zone_label:j.run,notes:j.run})).filter((_,i)=>i<3);
 j.created=await write("POST","/rosters",{entries:own});assert.equal(j.created.length,3);
 await s.app.evaluate(()=>{const WS=process.getBuiltinModule("module").createRequire(process.cwd()+"/package.json")("ws"),emit=WS.prototype.emit;WS.prototype.emit=function(e,...a){if(e==="message")globalThis.rollcallSocket=this;return emit.call(this,e,...a)};
 const https=process.getBuiltinModule("https"),request=https.request;globalThis.rollcallBlocked=0;https.request=function(url,options,callback){const object=typeof url==="object"&&!(url instanceof URL),u=object?new URL("https://"+(url.hostname||url.host)+(url.path||"/")):new URL(url),method=(object?url.method:options?.method)||"GET";if(method!=="GET"&&u.pathname.startsWith("/api/v1/rosters")){globalThis.rollcallBlocked++;throw Error("READ_ONLY_FINAL: no roster or attendance writes")};return request.call(this,url,options,callback)};});
 await p.evaluate(()=>{window.rollcallStreams=[];window.rollcallEvents=[];window.terminal.subscribe(e=>{if(e.type==="stream")window.rollcallStreams.push(e);if(e.type==="event")window.rollcallEvents.push(e)})});
 await s.nav("Roll call");await expect(p.getByRole("heading",{name:"Roll call",exact:true})).toBeVisible();
 const a=j.created[0],b=j.created[1],row=id=>p.locator('[data-roster-id="'+id+'"]');
 await expect(row(a.roster_id)).toContainText("Already arrived");await expect(row(a.roster_id).getByRole("checkbox")).toBeDisabled();
 await row(b.roster_id).getByRole("checkbox").check();await row(b.roster_id).getByLabel("Actual arrival time",{exact:true}).fill(original.today+"T05:15");
 await p.getByRole("button",{name:"Review arrivals",exact:true}).click();let modal=p.getByRole("dialog").filter({has:p.getByRole("heading",{name:"Confirm actual arrivals",exact:true})});await help(s,modal.getByRole("checkbox"),"Roll call");await modal.getByRole("button",{name:"Close",exact:true}).click();
 await write("PATCH","/rosters/"+b.roster_id,{expected_version:b.row_version,zone_label:j.run+" live"});
 await expect(row(b.roster_id)).toContainText(j.run+" live");await expect(row(b.roster_id).getByLabel("Actual arrival time",{exact:true})).toHaveValue(original.today+"T05:15");
 await expect.poll(()=>s.app.evaluate(()=>!!globalThis.rollcallSocket),{timeout:45000}).toBe(true);
 const since=Date.now();await s.app.evaluate(()=>globalThis.rollcallSocket.terminate());
 await expect.poll(()=>p.evaluate(()=>window.rollcallStreams.some(e=>e.status==="Live"&&e.resync)),{timeout:45000}).toBe(true);
 await expect.poll(async()=>(await s.trace()).requests.some(r=>r.started>=since&&r.path.split("?")[0]==="/api/v1/rosters/roll-call"&&r.status===200)).toBe(true);
 await expect(row(b.roster_id).getByLabel("Actual arrival time",{exact:true})).toHaveValue(original.today+"T05:15");
 pass("Final renderer: fresh sheet, server first-in disabled, dialog F1/focus, independent live event and real socket resync preserve unsent actual time");
 await p.getByRole("button",{name:"Clear unsent selection",exact:true}).click();await expect(p.locator(".roll-call .error")).toHaveCount(0);
 await p.getByLabel("Read a roster date",{exact:true}).fill("2099-01-01");await p.getByRole("button",{name:"Open date",exact:true}).click();await expect(p.getByText(/No rostered staff in this sheet/)).toBeVisible();
 await s.fault({failPath:"/rosters/roll-call",failMethod:"GET",once:false});await p.getByRole("button",{name:"Refresh sheet",exact:true}).click();await expect(p.getByRole("button",{name:"Try again",exact:true})).toBeVisible();assert.equal(await p.locator("[data-roster-id]").count(),0);await s.fault({failPath:null});await p.getByRole("button",{name:"Try again",exact:true}).click();await expect(p.getByText(/No rostered staff in this sheet/)).toBeVisible();
 pass("Actual empty sheet, held failed read hides stale rows and Try again recovers");
 await p.getByRole("button",{name:"Today and running night shift",exact:true}).click();await expect(row(a.roster_id)).toBeVisible();
 // Native shortcuts share the Settings state; no CDP keyboard substitute.
 const win=await s.app.browserWindow(p);await win.evaluate(w=>{w.show();w.focus()});
 const key=k=>win.evaluate((w,k)=>{for(const type of ["keyDown","keyUp"])w.webContents.sendInputEvent({type,keyCode:k,modifiers:["control"]})},k);
 await s.prefs({ui_scale_pct:250});await key("=");await expect.poll(async()=>(await s.native("state")).prefs.ui_scale_pct).toBe(250);
 await key("0");await expect.poll(async()=>(await s.native("state")).prefs.ui_scale_pct).toBe(100);await key("-");await expect.poll(async()=>(await s.native("state")).prefs.ui_scale_pct).toBe(100);
 await p.evaluate(()=>window.scrollTo(0,0));await capture(s,"roll_call");pass("Native upper250/lower100/reset share preference state; compact final EN/Urdu images and both themes250 have no root overflow");
 assert.equal((await s.trace()).requests.filter(r=>r.method!=="GET").length,0);assert.equal(await s.app.evaluate(()=>globalThis.rollcallBlocked),0);pass("HeadNurse final checks sent ZERO business writes; runtime guard blocked none");
 await s.close();s=undefined;
 // HR's active workspace exposes Attendance, not the Head Nurse's Roll Call page.
 const outline=await h.native("api",{method:"GET",path:"/meta/handbook?workspace=hr"});assert(outline.workspaces.some(w=>w.screens.some(s=>s.id==="attendance")));await expect(h.p.getByRole("navigation").getByRole("button",{name:"Roll call",exact:false})).toHaveCount(0);pass("HR menu respects its actual server outline; Attendance owns HR roll-call API use");
 const denied=await session("rollcall-final-denied","demo.cashier");try{await expect(denied.p.getByRole("navigation").getByRole("button",{name:"Roll call",exact:false})).toHaveCount(0);const r=await denied.p.evaluate(()=>window.terminal.call("api",{method:"GET",path:"/rosters/roll-call"}));assert(!r.ok);assert.equal(r.error.code,"PERMISSION_REQUIRED");assert.equal((await denied.trace()).requests.filter(r=>r.path.includes("/rosters/roll-call")).length,0);denied.j.passed=true;denied.save()}finally{await denied.close()}
 pass("Cashier navigation absent; native contract denies before network (separate MCP GET/POST403 evidence retained)");
 j.passed=true;
}catch(e){j.error=e.stack;console.error(e);process.exitCode=1;try{if(s)await s.p.screenshot({path:"artifacts/rollcall-final-failure.png"})}catch{}}
finally{
 if(s){s.j.passed=j.passed;s.save();await s.close()}
 if(h){try{if(j.created){const data=await h.native("api",{method:"GET",path:"/rosters?date_from="+original.earlier+"&date_to="+original.future+"&include_cancelled=true"});j.cleanup=[];save();for(const r of j.created){const actual=data.entries.find(x=>x.roster_id===r.roster_id);assert(actual&&actual.notes===j.run);if(actual.status==="Active"){const out=await write("POST","/rosters/"+actual.roster_id+"/cancel",{expected_version:actual.row_version,reason:j.run+" final read-only checks complete"});assert.equal(out.status,"Cancelled");j.cleanup.push({id:actual.roster_id,status:out.status});save()}}}}catch(e){j.cleanup_error=e.stack;j.passed=false;process.exitCode=1}
 h.j.passed=j.passed;h.save();await h.close()}
 j.finished=new Date().toISOString();save()
}

```
