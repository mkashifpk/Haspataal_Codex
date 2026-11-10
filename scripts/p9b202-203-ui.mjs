import assert from "node:assert/strict";
import fs from "node:fs";
import {capture, expect, help, session} from "./clinical-test-kit.mjs";
const dir="docs/phase-p9b-202-203-2026-11-10";
const write=(name,data)=>fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify(data,null,2)+"\n");
const read=name=>JSON.parse(fs.readFileSync(`${dir}/${name}.json`));
const {data:fixture}=JSON.parse(fs.readFileSync("docs/phase-p9b-200-201-2026-11-10/fixture-cycle-result.json","utf8").replace(/^\uFEFF/,""));
const target=String(fixture.cycle_id);
const nativeWrites=process.argv.includes("--writes");
const findingWrite=process.argv.includes("--finding");
async function run(owner) {
 const pos=owner?203:202, id=owner?"record_review_overview":"record_review_report";
 const s=await session(`p9b${pos}-${nativeWrites?"writes":findingWrite?"finding":"read"}`,owner?"demo.owner":"demo.quality");
 try {
  const p=s.p;
  if(owner && !await p.locator(`[data-screen-target="${id}"]`).isVisible()) {
   const workspace=p.locator(".workspace-card").filter({has:p.getByRole("heading",{name:"Owner / Hospital Admin",exact:true})});
   if(!await workspace.isVisible()) await p.getByRole("navigation").getByRole("button",{name:"Workspaces",exact:true}).click();
   await workspace.getByRole("button",{name:"Open workspace →",exact:true}).click();
  }
  await p.getByRole("navigation").locator(`[data-screen-target="${id}"]`).click();
  const root=p.locator(`[data-screen="${id}"]`);
  if(owner) {
   await expect(root.getByRole("heading",{name:"Review schedule",exact:true})).toBeVisible();
   await root.getByRole("row").filter({hasText:fixture.cycle_number}).getByRole("button",{name:"Open cycle",exact:true}).click();
   await expect(root.getByRole("heading",{name:"Sampling plan",exact:true})).toBeVisible();
   await root.getByRole("button",{name:"Read sampled record",exact:true}).click();
   await expect(root.getByRole("heading",{name:"Sampled record",exact:true})).toBeVisible();
   await expect(root.getByRole("button",{name:"Close review",exact:true})).toBeDisabled();
   await p.getByRole("button",{name:"Survey report and findings",exact:true}).click();
  }
  const cycle=root.getByLabel("Review cycle",{exact:true});
  await cycle.selectOption(target);
  await expect(root.getByRole("heading",{name:/MSDS 156–162/})).toContainText(fixture.cycle_number);
  await expect(root.getByRole("heading",{name:"Deficiencies",exact:true})).toBeVisible();
  for(let indicator=156;indicator<=162;indicator++) await expect(root.getByRole("cell",{name:new RegExp(`^${indicator} ·`)})).toHaveCount(1);
  const title=owner?"Medical record review (MSDS)":"Review report, deficiencies & actions";
  await help(s,cycle,title);
  await s.app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
  await root.getByRole("button",{name:"Save survey report PDF",exact:true}).click();
  await expect(root).toContainText("PDF save cancelled.");
  await capture(s,id,()=>expect(root.getByRole("heading",{name:/MSDS 156–162/})).toBeVisible());
  if(findingWrite && !owner) {
   const row=root.getByRole("row").filter({hasText:"Identity wristband worn"}).filter({has:p.getByRole("button",{name:"Review finding",exact:true})});
   await row.getByRole("button",{name:"Review finding",exact:true}).click();
   const dialog=p.locator("dialog[open]");
   const note="SYNTHETIC DEV: the historical wristband omission at sampling was real for this simulated record and cannot be undone retrospectively.";
   await dialog.getByLabel("Reason or evidence",{exact:true}).fill(note);
   await dialog.getByRole("checkbox",{name:"I checked the selected record and this change."}).check();
   assert(!fs.existsSync(`${dir}/finding-intent.json`));
   write("finding-intent",{cycle:target,criterion:"ADM_WRISTBAND",status:"Acknowledged",note});
   await dialog.getByRole("button",{name:"Confirm change",exact:true}).click();
   await expect(dialog).toHaveCount(0);
   const result=(await s.trace()).requests.find(r=>r.method==="POST"&&r.path.endsWith("/resolve"));
   assert.equal(result.status,200);
   assert.equal(result.result.data.status,"Acknowledged");
   write("finding-result",{id:result.result.data.deficiency_id,status:result.status,request_id:result.result.request_id});
  }
  if(nativeWrites && !owner) {
   const dialog=p.locator("dialog[open]").filter({has:p.getByRole("heading",{name:"Review change",exact:true})});
   const stamp=Date.now();
   async function confirm(step, body) {
    const file=`${dir}/${step}-intent.json`;
    assert(!fs.existsSync(file),"Reconcile the prior DEV write before re-running.");
    await dialog.getByRole("checkbox",{name:"I checked the selected record and this change."}).check();
    write(step+"-intent",{cycle:target,...body});
    const start=(await s.trace()).requests.length;
    await dialog.getByRole("button",{name:"Confirm change",exact:true}).click();
    await expect(dialog).toHaveCount(0);
    const writes=(await s.trace()).requests.slice(start).filter(r=>r.method!=="GET");
    assert.equal(writes.length,1);
    const r=writes[0];
    assert(r.status>=200 && r.status<300);
    const d=r.result.data;
    write(step+"-result",{method:r.method,path:r.path,status:r.status,request_id:r.result.request_id,key:r.key,body:r.body,
      id:d.action_id??d.criterion_id??d.deficiency_id,version:d.row_version,state:d.status??d.is_active});
    return d;
   }
   const code=`SYNTH_RR_${stamp}`;
   await root.getByRole("button",{name:"Add checklist item",exact:true}).click();
   await dialog.getByLabel("Code",{exact:true}).fill(code);
   await dialog.getByLabel("Title",{exact:true}).fill("Synthetic DEV review test checklist");
   await confirm("criterion-create",{code});
   const item=root.getByRole("row").filter({hasText:code});
   await item.getByRole("button",{name:"Edit checklist item",exact:true}).click();
   await dialog.getByLabel("Title",{exact:true}).fill("Synthetic DEV review test checklist retired");
   await dialog.getByRole("checkbox",{name:"Active",exact:true}).uncheck();
   await confirm("criterion-retire",{code});
   await expect(item).toContainText("Retired");
   await root.getByRole("button",{name:"Add action",exact:true}).click();
   const description=`SYNTHETIC DEV checked the report controls ${stamp}`;
   await dialog.getByLabel("Description",{exact:true}).fill(description);
   const ownerSelect=dialog.getByLabel("Owner",{exact:true});
   const option=ownerSelect.locator("option").filter({hasText:"Quality Officer"});
   await ownerSelect.selectOption(await option.getAttribute("value"));
   const date=new Date();date.setUTCDate(date.getUTCDate()+7);
   await dialog.getByLabel("Due date",{exact:true}).fill(date.toISOString().slice(0,10));
   const action=await confirm("action-create",{description});
   const row=root.getByRole("row").filter({hasText:action.action_number});
   await row.getByRole("button",{name:"Close action",exact:true}).click();
   await dialog.getByLabel("Reason or evidence",{exact:true}).fill("Synthetic DEV: verified the reporting controls in Electron.");
   await confirm("action-complete",{action_id:action.action_id});
   await expect(row).toContainText("Done");
  }
  const trace=(await s.trace()).requests.filter(r=>/record-review|quality\/actions|admin\/departments/.test(r.path));
  write(`${pos}-${findingWrite?"finding-journey":"journey"}`,{renderer:s.j.renderer,passed:true,writes:(nativeWrites||findingWrite)&&!owner,requests:trace.map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}))});
  s.j.passed=true;
  s.pass(`P9B ${pos}: live survey evidence, PDF, F1 and both languages at 250%.`);
 } catch(e){s.j.error=e.stack;throw e;} finally {await s.close();}
}
const runs=await Promise.allSettled(process.argv.includes("--owner")?[run(true)]:findingWrite?[run(false)]:[run(false),run(true)]);
for(const r of runs)if(r.status==="rejected"){console.error(r.reason);process.exitCode=1;}
