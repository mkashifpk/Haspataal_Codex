import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help,capture} from './clinical-test-kit.mjs';

const directory='docs/phase-p9a-2026-11-06/';
const source=JSON.parse(fs.readFileSync(directory+'nov9-57-outcome-result.json')).body.data;
assert(source.description.includes('SYNTHETIC P9A cross-desk'));
const file='artifacts/p9a57-corrected-journey.json';
assert(!fs.existsSync(file),'Reconcile the original appeal. Do not rerun the guarded test.');
const j={pending:null,number:source.complaint_number,complaint_id:source.complaint_id,desks:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const configs=[['demo.reception','record_complaint_reception'],['demo.admissions','record_complaint_admissions'],['demo.triage','record_complaint_er'],['demo.nurse','record_complaint_ward']];
for(const [account,id] of configs){
  const s=await session('p9a57-corrected-'+account.slice(5),account);
  try {
    await s.p.getByRole('navigation').locator(`[data-screen-target="${id}"]`).click();
    const root=s.p.locator(`[data-screen="${id}"]`);
    const tracking=root.locator('article.card').filter({has:s.p.getByRole('heading',{name:'Track a complaint',exact:true})});
    const input=tracking.locator('[name="tracking_number"]');
    await help(s,input,'Record a complaint');
    await input.fill('  '+source.complaint_number.toLowerCase().replaceAll('-',' - ')+'  ');
    await tracking.getByRole('button',{name:'Find tracking card',exact:true}).click();
    const card=tracking.getByRole('region',{name:'Complaint tracking card'});
    await expect(card).toContainText(source.complaint_number);
    await expect(card).toContainText('SYNTHETIC P9A Tracking Tester');
    await expect(card).not.toContainText('Nurse Hina');
    await expect(card).not.toContainText(source.description);
    const confirm=()=>card.getByRole('checkbox',{name:'I confirmed the name with the person at the desk.'}).check();
    await confirm();await expect(card).toContainText('Nurse Hina');
    const open=card.getByRole('button',{name:'Open permitted complaint',exact:true});
    const appeal=card.getByRole('button',{name:'Record appeal from tracking card',exact:true});
    if(account==='demo.reception'){
      await expect(card).toContainText('Resolved');
      await expect(open).toHaveCount(0);
      const privacy=JSON.parse(fs.readFileSync(directory+'nov9-57-before-appeal.json'));
      assert.equal(privacy.status,403);assert(privacy.request.endsWith('/complaints/'+source.complaint_id));
      await appeal.click();
      await card.locator('textarea[name="appeal_text"]').fill('SYNTHETIC P9A appeal from another desk for interface verification only.');
      await card.getByRole('checkbox',{name:'I checked the person, appeal window and their words.'}).check();
      const path=`/complaints/${source.complaint_id}/appeal`;
      await s.fault({failPath:path,failMethod:'POST',once:true});
      j.pending='One Reception appeal on fresh Admission complaint. Original key/body retry only.';save();
      await card.getByRole('button',{name:'Save tracking appeal',exact:true}).click();
      const retry=tracking.getByRole('button',{name:'Retry original request',exact:true});
      await expect(retry).toBeEnabled();await retry.click();
      await expect(appeal).toHaveCount(0);
      await expect(card.getByRole('checkbox',{name:'I confirmed the name with the person at the desk.'})).toBeEnabled();
      await confirm();await expect(card).toContainText('Appealed');await expect(open).toBeVisible();
      await open.click();await expect(root).toContainText(source.description);
      const result=await s.native('api',{method:'GET',path:`/complaints/${source.complaint_id}`});
      assert.equal(result.status,'Appealed');
      assert.equal(result.appeal_received_by,(await s.native('state')).user.user_id);
      const posts=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith(path));
      assert.equal(posts.length,2);assert.equal(posts[0].key,posts[1].key);assert.deepEqual(posts[0].body,posts[1].body);assert.equal(posts[1].replay,'true');
      j.pending=null;j.appeal={status:result.status,receivedBy:result.appeal_received_by,requestIds:posts.map(p=>p.result?.request_id)};save();
    }else{
      await expect(card).toContainText('Appealed');await expect(appeal).toHaveCount(0);
      await expect(open).toHaveCount(account==='demo.admissions'?1:0);
      assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
    }
    await capture(s,id);
    await input.fill('CMP-1999-99999');
    await tracking.getByRole('button',{name:'Find tracking card',exact:true}).click();
    await expect(tracking.getByRole('alert')).toContainText('NOT_FOUND');
    await expect(card).toHaveCount(0);
    j.desks.push({id,account,reads:(await s.trace()).requests.filter(r=>r.path.includes('/complaints/by-number/')).map(r=>({path:r.path,status:r.status,id:r.result?.request_id}))});save();
    s.j.passed=true;s.pass('Exact tracking card, identity confirmation, authorized disclosure, missing-number recovery, F1 and bilingual 250%.');
  }catch(error){j.error=error.stack;save();s.j.error=error.stack;throw error;}
  finally{await s.close();}
}

const quality=await session('p9a57-corrected-quality','demo.quality');
try {
  await quality.p.getByRole('navigation').locator('[data-screen-target="incident_screening"]').click();
  const screening=quality.p.locator('[data-screen="incident_screening"]');
  await expect(screening).toContainText('Deaths appear after certification');
  await help(quality,screening.locator('button[data-help="isc.refresh"]'),'Possible sentinel events: screening and reasoned decisions');
  await capture(quality,'incident_screening');
  await quality.p.getByRole('navigation').locator('[data-screen-target="action_register"]').click();
  const actions=quality.p.locator('[data-screen="action_register"]');
  const department=actions.locator('select[data-help="acr.department"]');
  const value=await department.locator('option').filter({hasText:'General Medicine'}).getAttribute('value');
  await department.selectOption(value);
  await actions.getByRole('button',{name:'Apply action filters',exact:true}).click();
  await expect(actions).toContainText('CAPA-2026-0016');
  await expect.poll(async()=>(await quality.trace()).requests.filter(r=>r.path.includes('department_id='+value)&&r.status===200).length).toBeGreaterThan(0);
  assert(!(await quality.trace()).requests.some(r=>r.method!=='GET'));
  j.quality=true;j.passed=true;save();quality.j.passed=true;
  quality.pass('Updated screening prerequisites and current action-register department filter. No business writes.');
}catch(error){j.error=error.stack;save();quality.j.error=error.stack;throw error;}
finally{await quality.close();}
