import fs from "node:fs";
import assert from "node:assert/strict";
import {session,expect,help,capture} from "./clinical-test-kit.mjs";

const file="artifacts/p9a188-journey.json";
assert(!fs.existsSync(file),"Reconcile the original programme before any further write.");
const journal={title:`SYNTHETIC P9A188 programme ${Date.now()}`,pending:null};
const save=()=>fs.writeFileSync(file,JSON.stringify(journal,null,2));
save();
const quality=await session("p9a187-ui","demo.quality");
try {
  const est=await quality.native("api",{method:"GET",path:"/establishment"});
  const view=est.views.screens.find(s=>s.screen_id==="home_visit_register");
  assert.equal(view.view,"hidden");
  await expect(quality.p.locator('[data-screen-target="home_visit_register"]')).toHaveCount(0);
  await expect(quality.p.locator('[data-screen-target="preventive_programmes_setup"]')).toHaveCount(0);
  await capture(quality,"home_visit_register");
  const calls=(await quality.trace()).requests;
  assert(!calls.some(r=>r.path.match(/\/home-visits(?:[/?]|$)/)));
  quality.j.view=view;
  quality.j.passed=true;
  quality.pass("Current Quality workspace omits the home visit register and does not call its endpoints while the server view is hidden. Preventive programme setup is also absent from this menu.");
} catch(error){quality.j.error=error.stack;throw error;}
finally{await quality.close();}

let s;
try {
  s=await session("p9a188-ui","demo.owner","Owner / Hospital Admin");
  await s.p.getByRole("navigation").locator('[data-screen-target="facility_profile"]').click();
  await s.p.getByRole("button",{name:"Preventive programmes offered",exact:true}).click();
  const root=s.p.locator('[data-screen="preventive_programmes_setup"]');
  const button=name=>root.getByRole("button",{name,exact:true});
  const own=root.getByRole("row").filter({hasText:journal.title});
  await expect(root).toContainText("does not check the national schedule");
  await button("Add programme").click();
  await root.locator('[name="name"]').fill(journal.title);
  await root.locator('[name="kind"]').selectOption("Other");
  await root.locator('[name="national_programme"]').fill("SYNTHETIC DEV training only");
  await root.locator('[name="guideline"]').fill("SYNTHETIC training card, edition 1, no clinical schedule");
  await root.locator('[name="services"]').fill("Synthetic practice service A\nSynthetic practice service B");
  await help(s,root.locator('[name="guideline"]'),"Preventive programmes offered");
  await root.locator('input[data-help="pp.save"]').check();
  journal.pending="New offered programme, save once.";save();
  await button("Save programme").click();
  await expect(own).toBeVisible();
  const read=async()=> (await s.native("api",{method:"GET",path:"/preventive-programmes?include_inactive=true"})).find(x=>x.name===journal.title);
  journal.created=await read();
  assert(journal.created?.is_offered);
  assert.equal(journal.created.services.length,2);
  journal.pending=null;save();
  await own.getByRole("button",{name:"Read programme register",exact:true}).click();
  await expect(root).toContainText("No services recorded for this period.");
  await button("Preview programme list").click();
  await expect(root).toContainText("PDF opened.");
  for(const p of s.app.windows())if(p!==s.p&&p.url().startsWith("data:application/pdf"))await p.close();
  await own.getByRole("button",{name:"Change programme",exact:true}).click();
  await root.locator('[name="is_offered"]').uncheck();
  await root.locator('input[data-help="pp.save"]').check();
  journal.pending="Stop offering own programme, versioned PATCH. Reconcile by GET.";save();
  await button("Save programme").click();
  await expect(own).toHaveCount(0);
  journal.retired=await read();
  assert.equal(journal.retired.row_version,2);
  assert.equal(journal.retired.is_offered,false);
  journal.pending=null;save();
  await root.getByRole("checkbox",{name:"Include programmes no longer offered"}).check();
  await expect(own).toContainText("No longer offered");
  await capture(s,"preventive_programmes_setup");
  const writes=(await s.trace()).requests.filter(r=>r.method!=="GET");
  assert.equal(writes.length,2);
  assert(writes.every(r=>r.path.includes("/preventive-programmes")));
  journal.writes=writes;journal.passed=true;save();
  s.j.passed=true;
  s.pass("Facility-only setup, named synthetic programme and actual services, versioned stop-offering, empty period register, official list PDF, scoped F1 and bilingual 250%. Service state unchanged.");
}catch(error){journal.error=error.stack;save();if(s){s.j.error=error.stack;s.save();}throw error;}
finally{if(s)await s.close();}
