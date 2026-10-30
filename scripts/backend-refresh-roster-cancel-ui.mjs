import fs from 'node:fs';import assert from 'node:assert/strict';import {session,expect,help} from './clinical-test-kit.mjs';
const root='docs/backend-refresh-2026-10-30/dev/',duty=JSON.parse(fs.readFileSync(root+'roster-create-duty-result.json')).body.data[0];
const file='artifacts/backend-refresh-roster-cancel-ui'+(process.argv.includes('--retry-selector')?'-retry':'')+'.json';assert(!fs.existsSync(file),'Reconcile original cancellation before repeating');const j={started:new Date().toISOString(),duty,checks:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));let s;save();
try{s=await session('refresh1030-departed-duty','demo.headnurse');s.p.on('dialog',d=>d.accept());await s.nav('Nursing duty roster');await s.p.getByLabel('Any date in roster week',{exact:true}).fill(duty.roster_date);await s.p.getByRole('button',{name:'Open week',exact:true}).click();
 const cancel=s.p.getByRole('button',{name:'Cancel duty #'+duty.roster_id,exact:true});await expect(cancel).toBeEnabled();await cancel.click();
 await s.p.getByLabel('Decision reason / note',{exact:true}).fill('DEMO own synthetic departed colleague; cancel their future duty');
 await help(s,s.p.getByLabel('Decision reason / note',{exact:true}),'Nursing duty roster');
 j.pending={action:'cancel own departed employee future duty',roster_id:duty.roster_id};save();
 await s.p.getByRole('dialog').getByRole('button',{name:'Review decision',exact:true}).click();
 await s.p.getByLabel('I checked the people, dates and action.',{exact:true}).check();
 await s.p.getByRole('button',{name:'Confirm roster action',exact:true}).click();
 await expect.poll(async()=>{const t=await s.trace();return t.requests.some(r=>r.method==='POST'&&r.path.endsWith(`/rosters/${duty.roster_id}/cancel`)&&r.status===200);}).toBe(true);
 const result=await s.native('api',{method:'GET',path:`/rosters?date_from=${duty.roster_date}&date_to=${duty.roster_date}&employee_id=${duty.employee_id}&include_cancelled=true`});const saved=result.entries.find(r=>r.roster_id===duty.roster_id);assert(saved&&saved.status==='Cancelled');j.result=saved;delete j.pending;j.checks.push('Nursing planner cancels an actual future duty after own synthetic employee resigns; exact cancelled row verified, no active-staff prerequisite');j.passed=true;
}catch(e){j.error=e.stack;try{j.ui=await s?.p.locator('body').innerText();j.trace=await s?.trace();}catch{}console.error(e.stack);process.exitCode=1;}finally{if(s)await s.close();j.finished=new Date().toISOString();save();}
