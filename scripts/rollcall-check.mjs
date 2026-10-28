// Real shared DEV. Fresh owned duties and synthetic demo attendance only.
// Never rerun after any partial execution; reconcile the original journal/keys.
import {session,expect,help,capture} from "./clinical-test-kit.mjs";
import fs from "node:fs";import crypto from "node:crypto";import assert from "node:assert/strict";
const file="artifacts/rollcall-check.json";assert(!fs.existsSync(file),"Reconcile existing journal before any new writes");
const j={run:"DEMO-ROLLCALL-"+Date.now(),writes:[],checks:[],passed:false};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
let h,s;
const pass=x=>{j.checks.push(x);save();console.log("PASS "+x)};
const request=async(session,method,path,body)=>{
 const w={method,path,body,key:crypto.randomUUID(),prepared:new Date().toISOString()};j.writes.push(w);save();
 try{w.result=await session.native("api",{method,path,body,key:w.key});w.confirmed=true;save();return w.result}catch(e){w.error=e.message;save();throw e}
};
const raw=(session,method,path,body,key)=>session.p.evaluate(args=>window.terminal.call("api",args),{method,path,body,key});
try{
 h=await session("rollcall-hr","demo.hr");
 const clock=await raw(h,"GET","/auth/me");assert(clock.ok);const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Karachi",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(clock.meta.server_time));
 const add=(d,n)=>new Date(Date.parse(d+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
 j.today=today;j.yesterday=add(today,-1);j.earlier=add(today,-2);j.future=add(today,10);save();
 // This overnight test requires the real running night, never simulated time.
 const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Karachi",hour:"2-digit",hourCycle:"h23"}).format(new Date(clock.meta.server_time)));assert(hour<8,"Run overnight matrix while Night is genuinely running");
 const staff=await h.native("api",{method:"GET",path:"/rosters/staff?date_from="+j.earlier+"&date_to="+j.future});j.staff=staff;save();
 const nurse=name=>{const r=staff.staff.find(x=>x.full_name===name&&x.staff_category==="Nursing");assert(r);return r};
 const a=nurse("Head Nurse Farzana"),b=nurse("IPC Nurse Shazia"),c=nurse("OT Nurse Saima"),d=nurse("Head OT Nurse Rukhsana");
 const night=staff.shift_patterns.find(x=>x.name==="Night"&&x.is_active),morning=staff.shift_patterns.find(x=>x.name==="Morning"&&x.is_active);assert(night&&morning);
 s=await session("rollcall-headnurse","demo.headnurse");
 const matrix=await s.native("api",{method:"GET",path:"/beds/matrix?include_beds=true"}),bed=matrix.beds.find(x=>x.current_state==="Available"),other=matrix.beds.find(x=>x.ward_id===bed.ward_id&&x.bed_id!==bed.bed_id);assert(other);
 const existing=await h.native("api",{method:"GET",path:"/rosters?date_from="+j.earlier+"&date_to="+j.future+"&include_cancelled=true"});j.baseline=existing;save();
 const planned=[{employee_id:a.employee_id,roster_date:j.yesterday,shift_pattern_id:night.shift_pattern_id},{employee_id:b.employee_id,roster_date:j.yesterday,shift_pattern_id:night.shift_pattern_id},{employee_id:c.employee_id,roster_date:j.earlier,shift_pattern_id:morning.shift_pattern_id},{employee_id:d.employee_id,roster_date:j.future,shift_pattern_id:morning.shift_pattern_id}];
 assert(planned.every(p=>!existing.entries.some(r=>r.status==="Active"&&r.employee_id===p.employee_id&&Math.abs(Date.parse(r.roster_date)-Date.parse(p.roster_date))<=86400000)),"No adjacent active duties permitted for owned fixture staff");
 const created=await request(h,"POST","/rosters",{entries:planned.map(p=>({...p,duty_area:"Ward",ward_id:bed.ward_id,zone_label:j.run,notes:j.run+" synthetic attendance only",bed_ids:p.employee_id===d.employee_id?[bed.bed_id]:[]}))});assert.equal(created.length,4);j.created=created;save();
 // Backend34 fresh duty retest; no old IDs/versions.
 const fix=created.find(r=>r.employee_id===d.employee_id);
 let changed=await request(h,"PATCH","/rosters/"+fix.roster_id,{expected_version:fix.row_version,zone_label:j.run+" zone"});
 changed=await request(h,"PATCH","/rosters/"+fix.roster_id,{expected_version:changed.row_version,bed_ids:[other.bed_id]});assert.deepEqual(changed.bed_ids,[other.bed_id]);
 const readFix=await h.native("api",{method:"GET",path:"/rosters?date_from="+j.future+"&date_to="+j.future});assert.deepEqual(readFix.entries.find(r=>r.roster_id===fix.roster_id).bed_ids,[other.bed_id]);
 changed=await request(h,"PATCH","/rosters/"+fix.roster_id,{expected_version:changed.row_version,bed_ids:[]});assert.deepEqual(changed.bed_ids,[]);
 pass("Backend34 deployed: fresh bed create→zone edit→bed replacement→exact reread→remove beds all succeed");
 const p=s.p;p.on("dialog",d=>d.accept());
 await s.nav("Roll call");await expect(p.getByRole("heading",{name:"Roll call",exact:true})).toBeVisible();
 const row=id=>p.locator('[data-roster-id="'+id+'"]'),first=created.find(r=>r.employee_id===a.employee_id),second=created.find(r=>r.employee_id===b.employee_id);
 await expect(row(first.roster_id)).toBeVisible();await expect(p.getByLabel("Duty date to record",{exact:true})).toHaveValue(j.yesterday);
 await row(first.roster_id).getByRole("checkbox").check();
 await p.getByRole("button",{name:"Review arrivals",exact:true}).click();await expect(p.getByRole("alert").filter({hasText:"Enter the actual arrival time"})).toBeVisible();
 const at=j.today+"T05:00";await row(first.roster_id).getByLabel("Actual arrival time",{exact:true}).fill(at);
 await help(s,row(first.roster_id).getByLabel("Actual arrival time",{exact:true}),"Roll call");
 assert(await row(first.roster_id).getByRole("checkbox").isChecked());pass("Real overnight row/date, required actual late time and focused F1 retain selection");
 await p.getByLabel("Find rostered staff",{exact:true}).fill("NO-SUCH-DEMO-STAFF");await expect(p.getByText("No staff match these filters.",{exact:true})).toBeVisible();await expect(p.getByText("Selected (including hidden rows): 1",{exact:true})).toBeVisible();await p.getByLabel("Find rostered staff",{exact:true}).fill("");
 // Independent real roster change must refresh and retain selected time.
 await request(h,"PATCH","/rosters/"+second.roster_id,{expected_version:second.row_version,zone_label:j.run+" live change"});
 await expect(row(second.roster_id)).toContainText("live change");await expect(row(first.roster_id).getByLabel("Actual arrival time",{exact:true})).toHaveValue(at);
 pass("roster.changed independently refreshes actual sheet without erasing arrival draft; no-match and hidden selection honest");
 await p.getByRole("button",{name:"Review arrivals",exact:true}).click();let modal=p.getByRole("dialog").filter({has:p.getByRole("heading",{name:"Confirm actual arrivals",exact:true})});
 await expect(modal).toContainText(j.yesterday);await expect(modal).toContainText(a.full_name);await help(s,modal.getByRole("checkbox"),"Roll call");
 await modal.getByRole("checkbox").check();
 j.uiIntent={person:a.employee_id,roster_id:first.roster_id,date:j.yesterday,at,phase:"original prepared"};save();
 await s.fault({failPath:"/rosters/roll-call",failMethod:"POST",once:true});
 await modal.getByRole("button",{name:"Confirm arrivals",exact:true}).click();
 await expect(p.getByRole("button",{name:"Retry original request",exact:true})).toBeVisible();
 let posts=(await s.trace()).requests.filter(r=>r.method==="POST"&&r.path.endsWith("/rosters/roll-call"));assert.equal(posts.length,1);assert.equal(posts[0].status,201);assert(posts[0].reply_lost);j.originalPost=posts[0];save();
 assert.equal(posts[0].body.roster_date,j.yesterday);assert.equal(posts[0].body.present[0].at,j.today+"T00:00:00.000Z");
 await p.getByRole("button",{name:"Read original duty date",exact:true}).click();await expect(p.getByRole("button",{name:"Retry original request",exact:true})).toBeVisible();assert.equal(await p.getByRole("button",{name:"Result reviewed; return to draft",exact:true}).count(),0);
 await p.getByRole("button",{name:"Retry original request",exact:true}).click();await expect(p.getByRole("heading",{name:"Server-confirmed arrivals",exact:true})).toBeVisible();
 posts=(await s.trace()).requests.filter(r=>r.method==="POST"&&r.path.endsWith("/rosters/roll-call"));assert.equal(posts.length,2);assert.equal(posts[1].key,posts[0].key);assert.deepEqual(posts[1].body,posts[0].body);assert.equal(posts[1].replay,"true");assert.equal(posts[1].result.data.recorded[0].attendance_log_id,posts[0].result.data.recorded[0].attendance_log_id);
 await expect(row(first.roster_id).getByRole("checkbox")).toBeDisabled();await expect(row(first.roster_id)).toContainText("Already arrived");j.uiOutcome=posts[1];save();
 pass("Real committed lost201: original yesterday body/UTC time retained; read cannot unlock; same-key replay same one attendance ID; arrived row disabled");
 // New deliberate duplicate request exercises server's skipped response.
 const duplicate=await request(s,"POST","/rosters/roll-call",posts[0].body);assert.equal(duplicate.recorded.length,0);assert.equal(duplicate.skipped[0].employee_id,a.employee_id);
 pass("New intentional duplicate is skipped by server without a second punch");
 await row(second.roster_id).getByRole("checkbox").check();await row(second.roster_id).getByLabel("Actual arrival time",{exact:true}).fill(j.today+"T05:05");
 await p.getByRole("button",{name:"Review arrivals",exact:true}).click();modal=p.getByRole("dialog").filter({has:p.getByRole("heading",{name:"Confirm actual arrivals",exact:true})});await modal.getByRole("checkbox").check();
 const freshSecond=(await h.native("api",{method:"GET",path:"/rosters?date_from="+j.yesterday+"&date_to="+j.yesterday})).entries.find(r=>r.roster_id===second.roster_id);
 await request(h,"PATCH","/rosters/"+second.roster_id,{expected_version:freshSecond.row_version,zone_label:j.run+" changed during review"});
 const before=(await s.trace()).requests.filter(r=>r.method==="POST"&&r.path.endsWith("/rosters/roll-call")).length;
 await modal.getByRole("button",{name:"Confirm arrivals",exact:true}).click();await expect(modal).toContainText("A duty or arrival changed.");
 assert.equal((await s.trace()).requests.filter(r=>r.method==="POST"&&r.path.endsWith("/rosters/roll-call")).length,before);
 await modal.getByRole("button",{name:"Close",exact:true}).click();pass("Concurrent version change refuses frozen attendance before POST; no silent overwrite");
 await p.getByRole("button",{name:"Clear unsent selection",exact:true}).click();
 await capture(s,"roll_call");pass("Actual EN/Urdu handbook captures and both themes at250% no root overflow");
 // Refusals never touch seeded duties or real attendance.
 const refuse=async(account,body,code)=>{const r=await raw(account,"POST","/rosters/roll-call",body,crypto.randomUUID());j.checks.push({refusal:r.error?.code,expected:code,request_id:r.request_id});save();assert(!r.ok);assert.equal(r.error.code,code)};
 await refuse(s,{roster_date:j.earlier,present:[{employee_id:c.employee_id,at:j.earlier+"T04:00:00Z"}]},"ROSTER_DATE_CLOSED");
 await refuse(s,{roster_date:today,present:[{employee_id:a.employee_id}]},"ROLL_CALL_NOT_ROSTERED");
 const support=staff.staff.find(r=>r.staff_category==="SupportZeroInterface");assert(support);
 await refuse(s,{roster_date:today,present:[{employee_id:support.employee_id}]},"ROSTER_OUT_OF_SCOPE");
 await refuse(s,{roster_date:j.yesterday,present:[]},"VALIDATION_ERROR");
 const hrPast=await request(h,"POST","/rosters/roll-call",{roster_date:j.earlier,present:[{employee_id:c.employee_id,at:j.earlier+"T04:00:00Z"}]});assert.equal(hrPast.recorded[0].attendance_date,j.earlier);assert.equal(Date.parse(hrPast.recorded[0].punch_time),Date.parse(j.earlier+"T04:00:00Z"));
 pass("Actual date-closed/not-rostered/out-of-scope/validation refusals and HR previous-shift actual-time success");
 await p.getByLabel("Read a roster date",{exact:true}).fill("2099-01-01");await p.getByRole("button",{name:"Open date",exact:true}).click();await expect(p.getByText(/No rostered staff in this sheet/)).toBeVisible();
 await s.fault({failPath:"/rosters/roll-call",failMethod:"GET",once:false});await p.getByRole("button",{name:"Refresh sheet",exact:true}).click();await expect(p.getByRole("button",{name:"Try again",exact:true})).toBeVisible();assert.equal(await p.locator("[data-roster-id]").count(),0);await s.fault({failPath:null});
 pass("Actual empty date and held failed GET hide stale rows/actions honestly");
 await s.close();s=undefined;
 const denied=await session("rollcall-denied","demo.cashier");try{await expect(denied.p.getByRole("navigation").getByRole("button",{name:"Roll call",exact:false})).toHaveCount(0);const r=await raw(denied,"GET","/rosters/roll-call");assert.equal(r.error.code,"PERMISSION_REQUIRED");const w=await raw(denied,"POST","/rosters/roll-call",{roster_date:today,present:[{employee_id:a.employee_id}]},crypto.randomUUID());assert.equal(w.error.code,"PERMISSION_REQUIRED");denied.j.passed=true;denied.save()}finally{await denied.close()}
 pass("Cashier route absent and native GET/POST denied before transport; actual backend403 requires separate MCP check");
 j.passed=true;save();
}catch(e){j.error=e.stack;save();console.error(e);process.exitCode=1}
finally{
 if(s){s.j.passed=j.passed;s.save();await s.close()}
 // Cancel only confirmed owned duties, retaining append-only synthetic punches.
 if(h){
  try{if(j.created){const rows=await h.native("api",{method:"GET",path:"/rosters?date_from="+j.earlier+"&date_to="+j.future+"&include_cancelled=true"});j.cleanup=[];save();for(const own of j.created){const current=rows.entries.find(r=>r.roster_id===own.roster_id);assert(current&&current.notes===j.run+" synthetic attendance only");if(current.status==="Active"){const result=await request(h,"POST","/rosters/"+current.roster_id+"/cancel",{expected_version:current.row_version,reason:j.run+" synthetic test complete"});assert.equal(result.status,"Cancelled");j.cleanup.push({id:current.roster_id,status:result.status});save()}}}}catch(e){j.cleanup_error=e.stack;j.passed=false;save();process.exitCode=1}
  h.j.passed=j.passed;h.save();await h.close()
 }
 j.finished=new Date().toISOString();save();
}
