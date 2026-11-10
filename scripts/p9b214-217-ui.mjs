import assert from "node:assert/strict";
import fs from "node:fs";
import {capture,expect,help,session} from "./clinical-test-kit.mjs";
const dir="docs/phase-p9b-214-217-2026-11-10";
const roles=[
 [214,"lab_quality","demo.labadmin","Lab Admin"],
 [215,"radiology_quality","demo.radiologist","Radiology"],
 [216,"diagnostics_quality","demo.quality","Quality & Medical Records"],
 [217,"owner_diagnostics","demo.owner","Owner / Hospital Admin"],
];
async function run([position,id,account,workspace]){
 const s=await session(`p9b${position}-diag`,account);
 try{
  const p=s.p,nav=p.locator(`[data-screen-target="${id}"]`);
  if(!await nav.isVisible()){
   const card=p.locator(".workspace-card").filter({has:p.getByRole("heading",{name:workspace,exact:true})});
   if(!await card.isVisible())await p.getByRole("navigation").getByRole("button",{name:"Workspaces",exact:true}).click();
   await card.getByRole("button",{name:"Open workspace →",exact:true}).click();
  }
  await s.prefs({pdf_download:"Separate"});
  await nav.click();
  const root=p.locator(`[data-screen="${id}"]`);
  await expect(root.getByRole("heading",{name:"Diagnostic statistics",exact:true})).toBeVisible();
  await expect(root.getByRole("heading",{name:/Turnaround score/})).toBeVisible();
  const select=root.getByLabel("Diagnostic service",{exact:true});
  await help(s,select,"Diagnostic services quality (MSDS)");
  await select.selectOption(position===215?"Lab":"Imaging");
  await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.includes(`service=${position===215?"Lab":"Imaging"}`)&&r.status===200)).toBe(true);
  for(const title of ["Diagnostics worklist","Repeated imaging exposures","External laboratory dispatches","Critical result register","Diagnostic partners"])
   await expect(root.getByRole("heading",{name:title,exact:true})).toBeVisible();
  await s.app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
  await root.getByRole("button",{name:"Save turnaround report",exact:true}).click();
  await expect(root).toContainText("PDF save cancelled.");
  if(position===216){
   await s.prefs({pdf_download:"Combined"});
   const start=(await s.trace()).requests.length;
   await root.getByRole("button",{name:"Save combined diagnostic PDF",exact:true}).click();
   await expect.poll(async()=> (await s.trace()).requests.slice(start).filter(r=>r.path.includes("/pdf")&&r.status===200).length,{timeout:65000}).toBe(5);
   await expect(root).toContainText("PDF save cancelled.");
   await s.prefs({pdf_download:"Separate"});
  }
  await capture(s,id,()=>expect(root).toBeVisible());
  const trace=(await s.trace()).requests.filter(r=>/diagnostic|send-outs|critical-results|imaging\/repeats/.test(r.path));
  assert(trace.every(r=>r.method==="GET"));
  fs.writeFileSync(`${dir}/${position}-journey.json`,JSON.stringify({passed:true,renderer:s.j.renderer,combined:position===216,requests:trace.map(r=>({path:r.path,status:r.status,request_id:r.result?.request_id}))},null,2)+"\n");
  s.j.passed=true;s.pass(`Diagnostics ${position}: period, all available panels, F1, PDF and bilingual 250%.`);
 }catch(e){s.j.error=e.stack;throw e;}finally{await s.close();}
}
const only=Number(process.argv[2]);
for(const role of roles.filter(x=>!only||x[0]===only)){try{await run(role);}catch(e){console.error(e);process.exitCode=1;}}
