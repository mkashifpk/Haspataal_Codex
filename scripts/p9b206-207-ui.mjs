import assert from "node:assert/strict";
import fs from "node:fs";
import {capture,expect,help,session} from "./clinical-test-kit.mjs";
const dir="docs/phase-p9b-206-207-2026-11-10";
const put=(name,obj)=>fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify(obj,null,2)+"\n");
const mutate=process.argv.includes("--writes");
async function run(owner){
 const screen=owner?"mlc_register":"mlc_register_quality",pos=owner?206:207;
 const s=await session(`p9b${pos}-mlc`,owner?"demo.owner":"demo.quality");
 try{
  const p=s.p,nav=p.locator(`[data-screen-target="${screen}"]`);
  if(owner&&!await nav.isVisible()){
   const card=p.locator(".workspace-card").filter({has:p.getByRole("heading",{name:"Owner / Hospital Admin",exact:true})});
   if(!await card.isVisible())await p.getByRole("navigation").getByRole("button",{name:"Workspaces",exact:true}).click();
   await card.getByRole("button",{name:"Open workspace →",exact:true}).click();
  }
  await nav.click();
  const root=p.locator(`[data-screen="${screen}"]`);
  const target=root.getByRole("button",{name:"MLC-2026-00001",exact:true});
  const over=root.getByRole("checkbox",{name:"Overdue police intimation only"});
  await over.check();
  await target.click();
  await expect(root.getByRole("heading",{name:"MLC-2026-00001",exact:true})).toBeVisible();
  await help(s,target,owner?"Medico-legal register & setup":"Medico-legal register");
  if(owner){
   await root.getByRole("button",{name:"Read police intimation print details",exact:true}).click();
   const paper=p.getByRole("dialog").filter({has:p.getByRole("heading",{name:"Police intimation printout",exact:true})});
   await expect(paper).toContainText("MLC-2026-00001");
   await paper.getByRole("button",{name:"Close",exact:true}).click();
   await s.app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
   await root.getByRole("button",{name:"Save contact display PDF",exact:true}).click();
   await expect(root).toContainText("PDF save cancelled.");
  }else await expect(root.getByRole("button",{name:"Add contact",exact:true})).toHaveCount(0);
  await capture(s,screen,()=>expect(root).toBeVisible());
  if(owner&&mutate){
   const modal=p.locator("dialog[open]");
   const nonce=Date.now();
   async function confirm(step,body){
    assert(!fs.existsSync(`${dir}/${step}-intent.json`),"Reconcile previous write first.");
    put(step+"-intent",body);
    await modal.getByRole("checkbox",{name:"I checked the directory change."}).check();
    const start=(await s.trace()).requests.length;
    await modal.getByRole("button",{name:"Confirm directory change",exact:true}).click();
    await expect(modal).toHaveCount(0);
    const writes=(await s.trace()).requests.slice(start).filter(r=>r.method!=="GET");
    assert.equal(writes.length,1);
    const r=writes[0],d=r.result.data;
    assert(r.status>=200&&r.status<300);
    put(step+"-result",{status:r.status,path:r.path,request_id:r.result.request_id,body:r.body,key:r.key,
     id:d.case_type_id??d.contact_id,active:d.is_active});
    return d;
   }
   const code=`SYNTH_MLC_${nonce}`;
   await root.getByRole("button",{name:"Add case type",exact:true}).click();
   await modal.getByLabel("Code",{exact:true}).fill(code);
   await modal.getByLabel("Name",{exact:true}).fill("Synthetic DEV type");
   const type=await confirm("case-type-create",{code});
   const typeRow=root.getByRole("row").filter({hasText:code});
   await typeRow.getByRole("button",{name:"Edit case type",exact:true}).click();
   await modal.getByRole("checkbox",{name:"Active",exact:true}).uncheck();
   await confirm("case-type-retire",{id:type.case_type_id,active:false});
   await expect(typeRow).toContainText("Retired");
   const name=`SYNTHETIC DEV non-operational contact ${nonce}`;
   await root.getByRole("button",{name:"Add contact",exact:true}).click();
   await modal.getByLabel("Contact type",{exact:true}).selectOption("SocialService");
   await modal.getByLabel("Name",{exact:true}).fill(name);
   const c=await confirm("contact-create",{name,type:"SocialService"});
   const contactRow=root.getByRole("row").filter({hasText:name});
   await contactRow.getByRole("button",{name:"Edit contact",exact:true}).click();
   await modal.getByRole("checkbox",{name:"Active",exact:true}).uncheck();
   await confirm("contact-retire",{id:c.contact_id,active:false});
   await expect(contactRow).toContainText("Retired");
  }
  const trace=(await s.trace()).requests.filter(r=>r.path.includes("/mlc"));
  put(`${pos}-journey`,{passed:true,renderer:s.j.renderer,writes:owner&&mutate,requests:trace.map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}))});
  s.j.passed=true;s.pass(`MLC ${pos} native register, detail, F1 and bilingual layout.`);
 }catch(e){s.j.error=e.stack;throw e;}finally{await s.close();}
}
const roles=process.argv.includes("--owner")?[true]:process.argv.includes("--quality")?[false]:[false,true];
for(const owner of roles){try{await run(owner);}catch(e){console.error(e);process.exitCode=1;}}
