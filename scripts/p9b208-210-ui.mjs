import assert from "node:assert/strict";
import fs from "node:fs";
import {capture,expect,help,session} from "./clinical-test-kit.mjs";
const dir="docs/phase-p9b-208-210-2026-11-10";
const put=(name,obj)=>fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify(obj,null,2)+"\n");
async function run(owner){
 const s=await session(owner?"p9b210-icd":"p9b208-209-icd",owner?"demo.owner":"demo.quality");
 try{
  const p=s.p, nav=id=>p.locator(`[data-screen-target="${id}"]`);
  if(owner&&!await nav("disease_statistics_owner").isVisible()){
   const card=p.locator(".workspace-card").filter({has:p.getByRole("heading",{name:"Owner / Hospital Admin",exact:true})});
   if(!await card.isVisible())await p.getByRole("navigation").getByRole("button",{name:"Workspaces",exact:true}).click();
   await card.getByRole("button",{name:"Open workspace →",exact:true}).click();
  }
  if(!owner){
   await nav("icd_code_lists").click();
   const root=p.locator('[data-screen="icd_code_lists"]');
   await expect(root).toContainText("Classification in use");
   const button=root.getByRole("button",{name:"Load code list",exact:true});
   await help(s,button,"ICD code lists");
   await capture(s,"icd_code_lists",()=>expect(root).toBeVisible());
   await button.click();
   const form=p.locator("dialog[open]");
   await form.getByLabel("Classification",{exact:true}).selectOption("ICD-10");
   await expect(form.getByLabel("Licence note",{exact:true})).toHaveAttribute("required","");
   await expect(form.getByRole("checkbox",{name:"Also make this release active for its classification."})).not.toBeChecked();
   await form.getByLabel("Classification",{exact:true}).selectOption("ICD-11");
   const label=`SYNTH_INVALID_${Date.now()}`;
   await form.getByLabel("Release label",{exact:true}).fill(label);
   await form.getByLabel("Code list file",{exact:true}).setInputFiles({name:"synthetic-invalid.csv",mimeType:"text/csv",buffer:Buffer.from("code,title\nNOT_A_CODE,\n")});
   await form.getByRole("checkbox",{name:"I checked the classification, release and activation choice."}).check();
   const before=await s.native("api",{method:"GET",path:"/icd/releases"});
   assert(!fs.existsSync(`${dir}/invalid-upload-intent.json`),"Reconcile existing invalid upload intent.");
   put("invalid-upload-intent",{label,classification:"ICD-11",file:"synthetic-invalid.csv",activate:false});
   await form.getByRole("button",{name:"Confirm release change",exact:true}).click();
   await expect(form).toContainText("ICD_IMPORT_INVALID");
   const after=await s.native("api",{method:"GET",path:"/icd/releases"});
   assert.deepEqual(after,before);
   const req=(await s.trace()).requests.find(r=>r.method==="POST"&&r.path.endsWith("/icd/releases"));
   assert.equal(req.status,422);
   put("invalid-upload-result",{label,status:req.status,request_id:req.result.request_id,error:req.result.error?.code,unchanged:true});
   await form.getByRole("button",{name:"Close",exact:true}).click();
   const only=(await s.trace()).requests.filter(r=>r.path.includes("/icd/releases"));
   put("208-journey",{passed:true,renderer:s.j.renderer,requests:only.map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}))});
  }
  const id=owner?"disease_statistics_owner":"disease_statistics";
  await nav(id).click();
  const root=p.locator(`[data-screen="${id}"]`);
  await expect(root.getByRole("heading",{name:"Coding completeness",exact:true})).toBeVisible();
  await expect(root.getByRole("heading",{name:"ICD chapters",exact:true})).toBeVisible();
  await expect(root.getByRole("heading",{name:"Top codes",exact:true})).toBeVisible();
  await help(s,root.getByLabel("From",{exact:true}),"Coded diagnosis statistics");
  await root.getByRole("button",{name:"Read period",exact:true}).click();
  await root.getByRole("button",{name:"Prepare statistics for printing",exact:true}).click();
  const paper=p.getByRole("dialog");
  await expect(paper).toContainText("Coding completeness");
  const data=await s.native("api",{method:"GET",path:"/icd/statistics"});
  if(data.citation)await expect(paper).toContainText(data.citation);
  await paper.getByRole("button",{name:"Close",exact:true}).click();
  await capture(s,id,()=>expect(root).toBeVisible());
  const trace=(await s.trace()).requests.filter(r=>r.path.includes("/icd"));
  put(`${owner?210:209}-journey`,{passed:true,renderer:s.j.renderer,requests:trace.map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}))});
  s.j.passed=true;s.pass(`ICD ${owner?210:"208/209"} live reads, F1 and bilingual 250%.`);
 }catch(e){s.j.error=e.stack;throw e;}finally{await s.close();}
}
const roles=process.argv.includes("--owner")?[true]:process.argv.includes("--quality")?[false]:[false,true];
for(const owner of roles){try{await run(owner);}catch(e){console.error(e);process.exitCode=1;}}
