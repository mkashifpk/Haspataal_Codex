import assert from "node:assert/strict";
import fs from "node:fs";
import {capture,expect,help,session} from "./clinical-test-kit.mjs";
const dir="docs/phase-p9b-211-213-2026-11-10";
async function run(owner){
 const s=await session(owner?"p9b213-er":"p9b211-212-er",owner?"demo.owner":"demo.quality");
 try{
  const p=s.p,nav=id=>p.locator(`[data-screen-target="${id}"]`);
  if(owner&&!await nav("er_statistics_owner").isVisible()){
   const card=p.locator(".workspace-card").filter({has:p.getByRole("heading",{name:"Owner / Hospital Admin",exact:true})});
   if(!await card.isVisible())await p.getByRole("navigation").getByRole("button",{name:"Workspaces",exact:true}).click();
   await card.getByRole("button",{name:"Open workspace →",exact:true}).click();
  }
  const save=async (position)=> {
   const trace=(await s.trace()).requests.filter(r=>r.path.includes("/er/"));
   assert(trace.every(r=>r.method==="GET"));
   fs.writeFileSync(`${dir}/${position}-journey.json`,JSON.stringify({passed:true,renderer:s.j.renderer,requests:trace.map(r=>({path:r.path,status:r.status,request_id:r.result?.request_id}))},null,2)+"\n");
  };
  if(!owner){
   await nav("er_register").click();
   const root=p.locator('[data-screen="er_register"]');
   const row=root.getByRole("button",{name:"ER-2026-000001",exact:true});
   await row.click();
   await expect(root.getByRole("heading",{name:"ER-2026-000001",exact:true})).toBeVisible();
   await expect(root.getByRole("heading",{name:"Stage history",exact:true})).toBeVisible();
   await help(s,row,"ER register (emergency log book)");
   await root.getByRole("checkbox",{name:"Still open only",exact:true}).check();
   await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.includes("open_only=true")&&r.status===200)).toBe(true);
   await root.getByRole("checkbox",{name:"Still open only",exact:true}).uncheck();
   await capture(s,"er_register",()=>expect(root).toBeVisible());
   await save(211);
  }
  const id=owner?"er_statistics_owner":"er_statistics";
  await nav(id).click();
  const root=p.locator(`[data-screen="${id}"]`);
  for(const name of ["Triage levels","Waiting times","Dispositions"])await expect(root.getByRole("heading",{name,exact:true})).toBeVisible();
  await root.getByRole("button",{name:"Read period",exact:true}).click();
  await help(s,root.getByLabel("From",{exact:true}),"Emergency department statistics");
  await capture(s,id,()=>expect(root).toBeVisible());
  await save(owner?213:212);
  s.j.passed=true;s.pass(`ER ${owner?213:"211/212"} live register/statistics, F1, both languages and themes at 250%.`);
 }catch(e){s.j.error=e.stack;throw e;}finally{await s.close();}
}
const roles=process.argv.includes("--owner")?[true]:process.argv.includes("--quality")?[false]:[false,true];
for(const owner of roles){try{await run(owner);}catch(e){console.error(e);process.exitCode=1;}}
