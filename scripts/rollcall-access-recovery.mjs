// Reopen only the original isolated HR profile to verify preferences/logout.
import {_electron as electron} from "playwright";import {terminalPage} from "./terminal-page.mjs";import {session,expect} from "./clinical-test-kit.mjs";import fs from "node:fs";import path from "node:path";import assert from "node:assert/strict";
const old=JSON.parse(fs.readFileSync("artifacts/rollcall-final-hr.json")),j={checks:[],passed:false};let app,s;
try{
 const env={...process.env,HASPATAAL_TEST:"1",HASPATAAL_DEV_CONFIG:path.resolve(".dev-terminal.json"),HASPATAAL_TEST_DATA:old.profile};delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({args:["."],env});const p=await terminalPage(app);
 const native=async(action,args)=>{const r=await p.evaluate(a=>window.terminal.call(a.action,a.args),{action,args});assert(r.ok,r.error?.code+" "+r.error?.message);return r.data};
 await expect(p.getByText("Hospital server ready.",{exact:true})).toBeVisible({timeout:60000});
 const state=await native("state");assert(!state.user);j.original_profile_signed_out=true;await app.close();app=undefined;
 s=await session("rollcall-access-hr","demo.hr");
 const {updated_at,...actual}=s.original,{updated_at:prior,...expected}=old.original_preferences;assert.deepEqual(actual,expected);
 j.checks.push("Original HR profile reopened; authenticated preferences exactly equal saved original en/Light/100 (no restoration needed)");
 const outline=await s.native("api",{method:"GET",path:"/meta/handbook?workspace=hr"});j.hrScreens=outline.workspaces?.flatMap(w=>w.screens.map(s=>s.id));
 // HR has its own Attendance screen. Do not override the active workspace's server menu.
 j.hrRollCallInScope=!!outline.workspaces?.some(w=>w.screens.some(s=>s.id==="roll_call"))||!!outline.shared_screens?.some(s=>s.id==="roll_call");
 if(j.hrRollCallInScope){await s.p.getByRole("navigation").getByRole("button",{name:"Roll call",exact:false}).click();await expect(s.p.getByRole("heading",{name:"Roll call",exact:true})).toBeVisible()}else{await expect(s.p.getByRole("navigation").getByRole("button",{name:"Roll call",exact:false})).toHaveCount(0);j.checks.push("HR active workspace correctly follows server outline; its separate Attendance screen uses these APIs later")}
 s.j.passed=true;s.save();await s.close();s=undefined;
 s=await session("rollcall-access-cashier","demo.cashier");await expect(s.p.getByRole("navigation").getByRole("button",{name:"Roll call",exact:false})).toHaveCount(0);
 const r=await s.p.evaluate(()=>window.terminal.call("api",{method:"GET",path:"/rosters/roll-call"}));assert(!r.ok);assert.equal(r.error.code,"PERMISSION_REQUIRED");assert.equal((await s.trace()).requests.filter(r=>r.path.includes("/rosters/roll-call")).length,0);j.checks.push("Cashier menu absent; native contract refuses before transport; real backend GET/POST403 checked separately");s.j.passed=true;s.save();j.passed=true;
}catch(e){j.error=e.stack;console.error(e);process.exitCode=1}
finally{if(app)await app.close();if(s)await s.close();j.finished=new Date().toISOString();fs.writeFileSync("artifacts/rollcall-access-recovery.json",JSON.stringify(j,null,2));console.log(JSON.stringify(j))}
