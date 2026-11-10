import assert from "node:assert/strict";
import fs from "node:fs";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";
const dir="docs/phase-p9c-223-227-2026-11-10";
fs.mkdirSync(dir,{recursive:true});
const patient="QA P9C Synthetic Infection 20261110 A",mrn="MRN-2026-000011";
const put=(name,obj)=>fs.writeFileSync(dir+"/"+name+".json",JSON.stringify(obj,null,2)+"\n");
const mutate=process.argv.includes("--writes");
const handoff=process.argv.includes("--handoff");
const only=Number(process.argv.find(x=>/^\d+$/.test(x)));
async function open(s,id,workspace){
  const nav=s.p.locator('[data-screen-target="'+id+'"]');
  if(!await nav.isVisible()){
    const card=s.p.locator(".workspace-card").filter({has:s.p.getByRole("heading",{name:workspace,exact:true})});
    if(!await card.isVisible())await s.p.getByRole("navigation").getByRole("button",{name:"Workspaces",exact:true}).click();
    await card.getByRole("button",{name:"Open workspace →",exact:true}).click();
  }
  await nav.click();
  return s.p.locator('[data-screen="'+id+'"]');
}
async function save(s,dialog,step,expectedPath,button="Confirm submission"){
  assert(!fs.existsSync(dir+"/"+step+"-intent.json"),"Reconcile the original write before rerunning "+step);
  put(step+"-intent",{synthetic:true,expectedPath,account:s.j.account});
  const offset=(await s.trace()).requests.length;
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button",{name:button,exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const requests=(await s.trace()).requests.slice(offset).filter(r=>r.method==="POST"&&r.path==="/api/v1"+expectedPath);
  assert.equal(requests.length,1);
  const r=requests[0];
  assert(r.status>=200&&r.status<300);
  assert(r.key);
  const d=r.result.data;
  put(step+"-result",{status:r.status,path:r.path,request_id:r.result.request_id,key:r.key,body:r.body,case_id:d.case_id,case_number:d.case_number,case_status:d.status,audit_id:d.audit_id,audit_number:d.audit_number,action_id:d.action_id,action_number:d.action_number});
  return d;
}
async function run(account,workspace,screens){
  const s=await session("p9c-infection-"+account,account);
  try{
    for(const [n,id,title] of screens){
      const p=s.p, root=await open(s,id,workspace), dialog=p.locator("dialog[open]");
      await expect(root.getByRole("heading",{name:title,exact:true})).toBeVisible();
      const offset=(await s.trace()).requests.length;
      if(n===223||n===224){
        await expect(root.getByRole("heading",{name:"Infection case register",exact:true})).toBeVisible();
        const start=root.getByRole("button",{name:"Report suspected infection",exact:true});
        await help(s,start,title);
        if(mutate){
          await start.click();
          await dialog.getByLabel("Patient name or MRN").fill(mrn);
          await dialog.getByRole("button",{name:"Find patient",exact:true}).click();
          await dialog.getByRole("button",{name:new RegExp(patient+".*"+mrn)}).click();
          await expect(dialog).toContainText(patient);
          await expect(dialog).toContainText("Allergies");
          await dialog.getByLabel("Signs and criteria met").fill("SYNTHETIC P9C "+n+" workflow. No clinical care or outbreak.");
          await save(s,dialog,n+"-report","/infection-cases");
          await expect(root).toContainText("SYNTHETIC P9C "+n+" workflow");
        }
      }else if(n===225){
        const filter=root.getByLabel("Case status",{exact:true});
        await help(s,filter,title);
        if(mutate){
          await filter.selectOption("Suspected");
          for(const pos of [223,224]){
            const file=dir+"/"+pos+"-report-result.json";
            if(!fs.existsSync(file))continue;
            const source=JSON.parse(fs.readFileSync(file));
            const row=root.getByRole("row").filter({hasText:source.case_number});
            await expect(row).toContainText(patient);
            await row.getByRole("button",{name:"Decide case",exact:true}).click();
            await expect(dialog).toContainText(patient);
            await dialog.getByLabel("Final outcome").selectOption(pos===223?"Confirmed":"Excluded");
            await dialog.getByLabel("Criteria or exclusion reason").fill("SYNTHETIC P9C decision for "+pos+".");
            const decision=await save(s,dialog,pos+"-decision","/infection-cases/"+source.case_id+"/decision");
            assert.equal(decision.status,pos===223?"Confirmed":"Excluded");
            await expect(row).toHaveCount(0);
          }
          await filter.selectOption("");
        }
        if(handoff){
          await root.getByRole("button",{name:"Report outbreak incident",exact:true}).click();
          await expect(p.locator('select[data-field="type_code"]')).toHaveValue("OUTBREAK");
          await p.locator('[data-screen-target="infection_cases"]').click();
        }
      }else if(n===226){
        await expect(root.getByRole("heading",{name:"Postoperative follow-up"})).toBeVisible();
        await expect(root.getByRole("heading",{name:"Surgical site infection rate"})).toBeVisible();
        const state=root.getByLabel("Follow-up state");
        await help(s,state,title);
        await state.selectOption("Due");
        await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.includes("state=Due")&&r.status===200)).toBe(true);
      }else{
        await expect(root.getByRole("heading",{name:"Audit register"})).toBeVisible();
        const start=root.getByRole("button",{name:"New audit",exact:true});
        await help(s,start,title);
        if(mutate){
          await start.click();
          const observations=dialog.getByLabel("Opportunities observed");
          await expect(observations).toHaveCount(5);
          for(let i=0;i<5;i++){await observations.nth(i).fill("2");await dialog.getByLabel("Actions done").nth(i).fill("1");}
          await dialog.getByLabel("Location",{exact:true}).fill("SYNTHETIC P9C 227 training station");
          await dialog.getByLabel("Findings",{exact:true}).fill("SYNTHETIC P9C audit. No clinical equipment involved.");
          const audit=await save(s,dialog,"227-audit","/infection/audits");
          await expect(root.getByRole("row").filter({hasText:audit.audit_number})).toBeVisible();
          await root.getByRole("button",{name:new RegExp("Assign an action for "+audit.audit_number)}).click();
          await dialog.getByLabel("Action description").fill("SYNTHETIC P9C follow-up. No real action required.");
          const owner=dialog.getByLabel("Action owner");
          const options=owner.locator("option");
          await expect.poll(()=>options.count()).toBeGreaterThan(1);
          const state=await s.native("state");
          await owner.selectOption(String(state.user.user_id));
          await dialog.getByLabel("Due date").fill("2026-11-30");
          await save(s,dialog,"227-action","/infection/audits/"+audit.audit_id+"/actions");
        }
      }
      await capture(s,id,()=>expect(root).toBeVisible());
      const reqs=(await s.trace()).requests.slice(offset).filter(r=>/infection|ssi-checks|record-review\/people|beds\/matrix|departments|patients\/search|patients\/11/.test(r.path));
      put(n+(handoff?"-handoff":"-journey"),{passed:true,renderer:s.j.renderer,requests:reqs.map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}))});
      s.pass(n+" native DEV and bilingual help");
    }
    s.j.passed=true;
  }catch(e){s.j.error=e.stack;throw e;}finally{await s.close();}
}
for(const [account,ws,screens] of [
 ["demo.doctor","Doctor",[[223,"report_infection_doctor","Report infection"]]],
 ["demo.nurse","Ward Nurse",[[224,"report_infection_ward","Report infection"]]],
 ["demo.ipc","Infection Control",[[225,"infection_cases","Infection cases"],[226,"ssi_surveillance","Wound surveillance"],[227,"ipc_audits","Infection control audits"]]],
]){
 const selected=screens.filter(([n])=>!only||only===n);
 if(selected.length)try{await run(account,ws,selected);}catch(e){console.error(e);process.exitCode=1;}
}
