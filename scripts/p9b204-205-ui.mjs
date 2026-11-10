import assert from "node:assert/strict";
import fs from "node:fs";
import {capture,expect,help,session} from "./clinical-test-kit.mjs";
const dir="docs/phase-p9b-204-205-2026-11-10";
const put=(name,obj)=>fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify(obj,null,2)+"\n");
const fixture=JSON.parse(fs.readFileSync(`${dir}/autopsy-request-result.json`,"utf8").replace(/^\uFEFF/,""));
assert.equal(fixture.death_id,6);
async function run(owner){
 const screen=owner?"death_register":"mortality_review",position=owner?205:204;
 const s=await session(`p9b${position}-mortality`,owner?"demo.owner":"demo.quality");
 try{
  const p=s.p, nav=p.locator(`[data-screen-target="${screen}"]`);
  if(owner&&!await nav.isVisible()){
   const card=p.locator(".workspace-card").filter({has:p.getByRole("heading",{name:"Owner / Hospital Admin",exact:true})});
   if(!await card.isVisible())await p.getByRole("navigation").getByRole("button",{name:"Workspaces",exact:true}).click();
   await card.getByRole("button",{name:"Open workspace →",exact:true}).click();
  }
  await nav.click();
  const root=p.locator(`[data-screen="${screen}"]`), record=root.getByRole("button",{name:"DTH-2026-00006",exact:true}).last();
  await expect(root.getByRole("heading",{name:"Mortality statistics",exact:true})).toBeVisible();
  await expect(root).toContainText("Gross death rate");
  await root.getByLabel("Register status",{exact:true}).selectOption("Draft");
  await expect.poll(async()=> (await s.trace()).requests.some(r=>r.path.includes("status=Draft")&&r.status===200)).toBe(true);
  await root.getByLabel("Register status",{exact:true}).selectOption("Certified");
  await record.click();
  await expect(root.getByRole("heading",{name:"DTH-2026-00006",exact:true})).toBeVisible();
  await help(s,record,owner?"Death register & mortality":"Mortality statistics & death register");
  await s.app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
  await root.getByRole("button",{name:"Read certificate print details",exact:true}).click();
  await root.getByRole("button",{name:"Save certificate PDF",exact:true}).click();
  await expect(root).toContainText("PDF save cancelled.");
  await capture(s,screen,()=>expect(root).toBeVisible());
  const mutate=owner&&process.argv.includes("--writes");
  if(mutate){
   const modal=p.locator("dialog[open]");
   async function confirm(step,payload){
    const file=`${dir}/${step}-intent.json`;
    assert(!fs.existsSync(file),"Existing intent requires exact server reconciliation.");
    put(step+"-intent",{death_id:fixture.death_id,autopsy_id:fixture.autopsy_id,...payload});
    const start=(await s.trace()).requests.length;
    await modal.getByRole("button",{name:"Confirm decision",exact:true}).click();
    await expect(modal).toHaveCount(0);
    const writes=(await s.trace()).requests.slice(start).filter(r=>r.method==="POST");
    assert.equal(writes.length,1);
    const r=writes[0];assert.equal(r.status,200);
    put(step+"-result",{status:r.status,path:r.path,request_id:r.result.request_id,body:r.body,autopsy:r.result.data.autopsy.status});
   }
   await root.getByRole("button",{name:"Authorize autopsy",exact:true}).click();
   await modal.getByRole("checkbox",{name:"I certify that this death is not medico-legal."}).check();
   await modal.getByLabel("Consenting next of kin",{exact:true}).fill("SYNTHETIC DEV Relative");
   await modal.getByLabel("Relationship",{exact:true}).fill("Synthetic next of kin");
   const extent="SYNTHETIC DEV limited demonstration only; no physical procedure.";
   await modal.getByLabel("What was explained and agreed",{exact:true}).fill(extent);
   await modal.getByLabel("Prosector name",{exact:true}).fill("SYNTHETIC DEV Prosector");
   await confirm("authorize",{extent,prosector:"SYNTHETIC DEV Prosector"});
   await root.getByRole("button",{name:"Read autopsy order print details",exact:true}).click();
   await root.getByRole("button",{name:"Save autopsy order PDF",exact:true}).click();
   await expect.poll(async()=> (await s.trace()).requests.some(r=>r.path.includes("/pdf?document=autopsy_order")&&r.status===200)).toBe(true);
   await root.getByRole("button",{name:"Cancel autopsy",exact:true}).click();
   const reason="SYNTHETIC DEV test completed; no clinical procedure was performed.";
   await modal.getByLabel("Cancellation reason",{exact:true}).fill(reason);
   await confirm("cancel",{reason});
   await expect(root.getByRole("heading",{name:/Clinical autopsy.*Cancelled/})).toBeVisible();
  } else if(!owner){
   await expect(root.getByRole("button",{name:"Authorize autopsy",exact:true})).toHaveCount(0);
  }
  const trace=(await s.trace()).requests.filter(r=>r.path.includes("/deaths"));
  put(`${position}-journey`,{passed:true,renderer:s.j.renderer,writes:mutate,requests:trace.map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}))});
  s.j.passed=true;s.pass(`Mortality ${position}, register, detail, PDF and both languages.`);
 }catch(e){s.j.error=e.stack;throw e;}finally{await s.close();}
}
const args=process.argv.slice(2);
for(const owner of args.includes("--owner")?[true]:args.includes("--quality")?[false]:[false,true]){
 try{await run(owner);}catch(e){console.error(e);process.exitCode=1;}
}
