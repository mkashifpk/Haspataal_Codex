import assert from "node:assert/strict";
import fs from "node:fs";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";

const dir="docs/phase-p9c-228-238-2026-11-10";
fs.mkdirSync(dir,{recursive:true});
const put=(name,value)=>fs.writeFileSync(dir+"/"+name+".json",JSON.stringify(value,null,2)+"\n");
const fixture="SYNTHETIC P9C IPC Committee 20261110";
const wasteFixture="SYNTHETIC P9C 228 Waste Training Area";
const writes=process.argv.includes("--writes");
const only=Number(process.argv.find(x=>/^\d+$/.test(x)));
const roles=[
  ["demo.ipc","Infection Control",[
    [228,"waste_log","Healthcare waste log"],
    [229,"infection_statistics_ipc","Infection control statistics"],
    [232,"staff_training_ipc","IPC staff training and health"],
    [238,"committees_ipc","Committees and minutes"],
    [236,"my_committees","My committees"],
  ]],
  ["demo.quality","Quality & Medical Records",[
    [230,"infection_statistics","Infection control statistics"],
    [233,"quality_indicator_targets","Quality indicator benchmarks"],
    [234,"quality_indicators","Clinical quality indicators"],
    [237,"committees_quality","Committees and minutes"],
  ]],
  ["demo.owner","Owner / Hospital Admin",[
    [231,"infection_statistics_owner","Infection control statistics"],
    [235,"quality_indicators_owner","Clinical quality indicators"],
  ]],
];
async function open(s,id,workspace){
  const p=s.p, nav=p.locator('[data-screen-target="'+id+'"]');
  if(!await nav.isVisible()){
    const card=p.locator(".workspace-card").filter({has:p.getByRole("heading",{name:workspace,exact:true})});
    if(!await card.isVisible()&&!(await nav.isVisible())) {
      const back=p.getByRole("navigation").getByRole("button",{name:"Workspaces",exact:true});
      if(await back.isVisible())await back.click();
    }
    if(await card.isVisible())await card.getByRole("button",{name:"Open workspace →",exact:true}).click();
  }
  await nav.click();
  return p.locator('[data-screen="'+id+'"]');
}
async function pdf(s,root,label){
  const notice=root.getByText("PDF save cancelled.",{exact:true});
  await root.getByRole("button",{name:label,exact:true}).click();
  await expect(notice.first()).toBeVisible();
}
async function mutation(s,name,method,path,click){
  assert(!fs.existsSync(dir+"/"+name+"-intent.json"),"Reconcile original intent "+name);
  put(name+"-intent",{account:s.j.account,synthetic:true,method,path});
  const offset=(await s.trace()).requests.length;
  await click();
  const load=async()=>(await s.trace()).requests.slice(offset).filter(x=>x.method===method&&x.path==="/api/v1"+path&&x.finished);
  await expect.poll(async()=>(await load()).length).toBe(1);
  const [r]=await load(),d=r.result?.data;
  put(name+"-result",{status:r.status,path:r.path,request_id:r.result?.request_id,key:r.key,body:r.body,error:r.result?.error?.code,committee_id:d?.committee_id,meeting_id:d?.meeting_id,meeting_number:d?.meeting_number,waste_id:d?.waste_id,waste_ids:d?.records?.map(x=>x.waste_id),action_id:d?.action_id,record_status:d?.status});
  assert(r.status>=200&&r.status<300, name+" failed: "+r.status+" "+r.result?.error?.code);
  return d;
}
async function modalWrite(s,name,method,path){
  const modal=s.p.locator("dialog[open]");
  await modal.getByRole("checkbox",{name:"I checked this entry and confirm submission."}).check();
  const result=await mutation(s,name,method,path,()=>modal.getByRole("button",{name:"Confirm submission",exact:true}).click());
  await expect(modal).toHaveCount(0);
  return result;
}
async function run(account,workspace,screens){
  const s=await session("p9c-next-"+account,account);
  try {
    const p=s.p;
    await s.app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
    for(const [n,id,title] of screens){
      const offset=(await s.trace()).requests.length;
      try{
        const root=await open(s,id,workspace);
        const dialog=p.locator("dialog[open]");
        const head=name=>root.getByRole("heading",{name,exact:true});
        const btn=name=>root.getByRole("button",{name,exact:true});
        if(n===228){
          await expect(head("Hospital waste log")).toBeVisible();
          await help(s,btn("Help / F1"),title);
          const w=x=>root.locator('[data-help="wl.'+x+'"]');
          if(writes){
            await btn("Record collection").click();
            await w("category").selectOption("Infectious");
            await w("location").fill(wasteFixture);
            await w("weight").fill("0.5");
            await w("bags").fill("1");
            await w("note").fill("SYNTHETIC P9C software-only waste handling test.");
            const collection=await mutation(s,"228-collection","POST","/infection/waste",()=>w("save").click());
            assert.equal(collection.location,wasteFixture);
          }
          await btn("Hand over waiting collections").click();
          const waiting=root.getByRole("checkbox",{name:new RegExp(wasteFixture)});
          if(writes){
            await waiting.check();
            const contractor=root.getByLabel("Contractor",{exact:true});
            await expect.poll(()=>contractor.locator("option").count()).toBeGreaterThan(1);
            const options=await contractor.locator("option").allTextContents();
            const demo=options.find(x=>/^Demo\b/i.test(x));
            if(demo){
              await contractor.selectOption({label:demo});
              await root.getByLabel("Consignment note",{exact:true}).fill("SYNTHETIC-P9C-228-20261110");
              await root.getByLabel("Disposal",{exact:true}).selectOption("Autoclave");
              await mutation(s,"228-handover","POST","/infection/waste/handover",()=>btn("Confirm handover").click());
              await expect(head("Confirmed consignment note")).toBeVisible();
            }
          }
          const cancel=btn("Cancel unsent handover");
          if(await cancel.isVisible())await cancel.click();
        } else if(n>=229&&n<=231){
          await expect(head(title)).toBeVisible();
          for(const h of ["Surgical site infection rate","By surgeon","By procedure","By theatre","By wound class","Due and overdue surveillance","Waste by category"]) await expect(head(h)).toBeVisible();
          await help(s,root.getByLabel("From",{exact:true}),title);
          await pdf(s,root,"Save infection control report");
        } else if(n===232){
          await expect(head(title)).toBeVisible();
          for(const h of ["Training requirements","Infection control training sessions","Training compliance","Health checks and doses due"])await expect(head(h)).toBeVisible();
          const training=btn("Record training session");
          await help(s,training,title);
          await training.click();
          await expect.poll(()=>dialog.getByLabel("Add attendee",{exact:true}).locator("option").count()).toBeGreaterThan(1);
          await dialog.getByRole("button",{name:"Close",exact:true}).click();
          const overdue=root.getByRole("checkbox",{name:"Overdue only",exact:true});
          await overdue.check();
          await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.includes("overdue_only=true")&&r.status===200)).toBe(true);
          const who=await s.native("state");
          const current=(await s.trace()).requests.filter(r=>r.path.endsWith("/facility/staff")||r.path.includes("/facility/staff?")).at(-1)?.result?.data?.find(x=>x.user_id===who.user.user_id);
          if(current){
            const self=btn(current.emp_number+" · "+current.full_name);
            if(await self.isVisible()){
              await self.click();
              await expect(head("Health record")).toBeVisible();
              await btn("Record health entry").click();
              await expect(dialog.getByLabel("Dose number")).toBeVisible();
              await dialog.getByRole("button",{name:"Close",exact:true}).click();
            }
          }
        } else if(n===233){
          await expect(head("Benchmark register")).toBeVisible();
          const set=btn("Set benchmark").first();
          if(await set.isVisible()){
            await help(s,set,title);
            await set.click();
            await expect(dialog.getByLabel("Source of benchmark")).toBeVisible();
            await dialog.getByRole("button",{name:"Close",exact:true}).click();
          } else await help(s,btn("Help"),title);
        } else if(n===234||n===235){
          await expect(head(title)).toBeVisible();
          await help(s,btn("Last month"),title);
          await btn("Last month").click();
          const trend=btn("Open trend").first();
          await trend.click();
          await expect(dialog.getByRole("heading",{name:"Indicator trend"})).toBeVisible();
          await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.includes("/trend?")&&r.status===200)).toBe(true);
          await dialog.getByRole("button",{name:"Close",exact:true}).click();
          await pdf(s,root,"Save quality indicators report");
        } else {
          await expect(head("Committee directory")).toBeVisible();
          const active=root.getByRole("checkbox",{name:"Active committees only",exact:true});
          await help(s,active,title);
          if(n===238&&writes){
            await btn("New committee").click();
            await dialog.getByLabel("Committee code",{exact:true}).fill("SYNTH_P9C_238");
            await dialog.getByLabel("Committee name",{exact:true}).fill(fixture);
            await dialog.getByLabel("Terms of reference",{exact:true}).fill("Synthetic terminal test only. No real committee authority.");
            const state=await s.native("state");
            const member=dialog.getByLabel("Staff member",{exact:true}).first();
            await expect.poll(()=>member.locator("option").count()).toBeGreaterThan(1);
            await member.selectOption(String(state.user.user_id));
            await dialog.getByLabel("External name",{exact:true}).fill("Synthetic test secretary");
            const committee=await modalWrite(s,"238-create","POST","/committees");
            await expect(root.getByRole("heading",{name:new RegExp(fixture)})).toBeVisible();
            await btn("Edit committee").click();
            await dialog.getByLabel("Terms of reference",{exact:true}).fill("Synthetic terminal verification only. No real committee authority.");
            await modalWrite(s,"238-edit","PATCH","/committees/"+committee.committee_id);
            await btn("Schedule meeting").click();
            await dialog.getByLabel("Agenda",{exact:true}).fill("Synthetic software verification agenda.");
            const meeting=await modalWrite(s,"238-schedule","POST","/committees/"+committee.committee_id+"/meetings");
            await btn("Write draft minutes").click();
            await dialog.getByRole("button",{name:"Load committee members as attendees",exact:true}).click();
            await dialog.getByLabel("Issues discussed",{exact:true}).fill("Synthetic workflow verification.");
            await dialog.getByLabel("Quality activities reviewed",{exact:true}).fill("Synthetic review of terminal navigation.");
            await dialog.getByLabel("Decisions and outcomes",{exact:true}).fill("No real clinical, staff or facility action.");
            await modalWrite(s,"238-minutes","PUT","/committee-meetings/"+meeting.meeting_id);
            await btn("Approve the minutes").click();
            await modalWrite(s,"238-finalize","POST","/committee-meetings/"+meeting.meeting_id+"/finalize");
            await expect(root.getByRole("heading",{name:new RegExp(meeting.meeting_number+".*Final minutes")})).toBeVisible();
            await btn("Assign an action").click();
            await dialog.getByLabel("Action description",{exact:true}).fill("Synthetic software follow-up. No real work requested.");
            await dialog.getByLabel("Action owner",{exact:true}).selectOption(String(state.user.user_id));
            await dialog.getByLabel("Due date",{exact:true}).fill("2026-11-30");
            await modalWrite(s,"238-action","POST","/committee-meetings/"+meeting.meeting_id+"/actions");
            await pdf(s,root,"Save minutes PDF");
          } else if(await btn(fixture).isVisible()){
            await btn(fixture).click();
            await expect(head("Meetings")).toBeVisible();
            const scheduleFile=dir+"/238-schedule-result.json";
            if(fs.existsSync(scheduleFile)){
              const record=JSON.parse(fs.readFileSync(scheduleFile));
              if(record.meeting_number){
                await btn(record.meeting_number).click();
                await expect(root.getByRole("heading",{name:new RegExp(record.meeting_number)})).toBeVisible();
                await pdf(s,root,"Save minutes PDF");
              }
            }
          } else {
            const first=root.locator("table").first().getByRole("button").first();
            if(await first.isVisible()){
              await first.click();
              await expect(head("Committee members")).toBeVisible();
            }
          }
        }
        await capture(s,id,()=>expect(root).toBeVisible());
        const requests=(await s.trace()).requests.slice(offset).filter(r=>/\/infection|\/personnel|\/facility\/staff|\/quality\/indicator|\/committee|\/finance\/vendors|\/beds\/matrix|\/admin\/departments|\/quality\/record-review\/people/.test(r.path));
        put(n+"-journey",{passed:true,renderer:s.j.renderer,requests:requests.map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}))});
        s.pass(n+" DEV journey and bilingual F1/250%");
      }catch(e){
        put(n+"-harness-error",{name:e.name,message:e.message.slice(0,1600)});
        console.error(n,e);
        process.exitCode=1;
        const close=p.locator("dialog[open]").getByRole("button",{name:"Close",exact:true});
        if(await close.isEnabled().catch(()=>false))await close.click().catch(()=>{});
        if(await p.locator('[data-write-pending="true"]').count())throw e;
      }
    }
    s.j.passed=!process.exitCode;
  } finally {await s.close();}
}
for(const [account,workspace,screens] of roles){
  const selected=screens.filter(([n])=>!only||only===n);
  if(selected.length)try{await run(account,workspace,selected);}catch(e){console.error(e);process.exitCode=1;}
}
