// Read-only business data: procedure-assistant staff lookup errors/recovery, discard unsent draft.
import {session,expect,help} from './clinical-test-kit.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=await session('phase2-consultation-staff-check','demo.doctor'),p=s.p;
try{
 await s.nav('Consultation (EMR)');await p.getByLabel('OPD slip number',{exact:true}).fill('OPD-2026-000015');await p.getByRole('button',{name:'Open slip',exact:true}).click();await p.getByLabel('Note type',{exact:true}).selectOption('Procedure');
 const picker=p.locator('.staff-picker').filter({has:p.getByLabel('Procedure assistant',{exact:true})});await picker.getByLabel('Procedure assistant',{exact:true}).fill('Sara');
 await s.fault({failPath:'/staff/lookup',failMethod:'GET',once:false});await picker.getByRole('button',{name:'Find staff member',exact:true}).click();await expect(picker.getByRole('alert')).toBeVisible();await expect(picker.getByLabel('Select staff member',{exact:true})).toHaveCount(0);
 await s.fault({failPath:null});await picker.getByRole('button',{name:'Find staff member',exact:true}).click();await expect(picker.getByLabel('Select staff member',{exact:true})).toBeVisible();
 const select=picker.getByLabel('Select staff member',{exact:true}),option=await select.locator('option').nth(1).getAttribute('value');assert(option);await select.selectOption(option);await help(s,picker.getByLabel('Procedure assistant',{exact:true}),'Consultation (EMR)');await expect(select).toHaveValue(option);
 s.j.trace=await s.trace();assert(s.j.trace.requests.some(r=>r.path.startsWith('/api/v1/staff/lookup?')&&r.status===200&&!r.reply_lost));assert.equal(s.j.trace.requests.filter(r=>r.method!=='GET').length,0);
 s.pass('Procedure assistant actual staff lookup: lost GET retries -> visible error/no stale selectable staff; deliberate retry200/real employee selection; F1 preserves input, ZERO businessPOST');p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'New note',exact:true}).click();s.j.passed=true;s.save();
}catch(e){s.j.error=e.stack;s.save();console.error(e.stack);process.exitCode=1}finally{await s.close();fs.copyFileSync('artifacts/phase2-consultation-staff-check.json','docs/phase2-consultation-staff-check-2026-10-24.json')}
