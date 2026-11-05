// Fresh fixtures were created with sandbox_call; never recreate them on a retry.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,capture,help}from './clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('docs/backend-refresh-2026-11-05/ui-run.json'));
const records=['a','b'].map(k=>JSON.parse(fs.readFileSync(`docs/backend-refresh-2026-11-05/ui-collection-${k}-result.json`)).body.data);
const file='artifacts/refresh-7429acf-handover.json';assert(!fs.existsSync(file),'Reconcile original UI handover journal before retrying.');
const j={run:fixture.run,records,checks:[],started:new Date().toISOString(),pending:null};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 s=await session('refresh7429-handover','demo.ops');j.renderer=s.j.renderer;save();
 await s.p.getByRole('navigation').locator('[data-screen-target="waste_log_ops"]').click();const root=s.p.locator('[data-screen="waste_log_ops"]');
 await root.getByRole('button',{name:'Hand over waiting collections',exact:true}).click();
 await expect(root.locator('[data-help="wl.new"]')).toBeDisabled();
 for(const record of records){const row=root.locator('label').filter({hasText:fixture.run}).filter({hasText:record.weight_kg+' kg'});await expect(row).toHaveCount(1);await row.locator('input[type="checkbox"]').check();}
 const select=root.locator('select[data-help="wl.vendor"]');await expect(select.locator('option')).not.toHaveCount(1);const vendor=await select.locator('option:not([value=""])').first().getAttribute('value');await select.selectOption(vendor);
 await root.locator('input[data-help="wl.manifest"]').fill(fixture.run+' SYNTHETIC NOTE - NO PHYSICAL HANDOVER');
 const date=root.locator('input[name="handed_over_on"]');await date.fill('2099-01-01');
 j.pending={action:'Expected date refusal',records:records.map(r=>r.waste_id),date:'2099-01-01'};save();await root.getByRole('button',{name:'Confirm handover',exact:true}).click();
 await expect(root.locator('.field-error,small[role="alert"]').filter({hasText:/future|invalid|date|request/i}).first()).toBeVisible();
 const invalid=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith('/infection/waste/handover')).at(-1);assert.equal(invalid.status,422);j.invalid={status:invalid.status,request_id:invalid.result.request_id};j.pending=null;save();
 await date.fill('');await help(s,date,'Hospital waste log');
 j.pending={action:'UI handover with real committed response dropped',records:records.map(r=>r.waste_id)};save();
 await s.fault({failPath:'/infection/waste/handover',failMethod:'POST',once:true});await root.getByRole('button',{name:'Confirm handover',exact:true}).click();
 const retry=root.getByRole('button',{name:'Retry original request',exact:true});await expect(retry).toBeEnabled();await expect(root.locator('[data-help="wl.new"]')).toBeDisabled();await expect(date).toBeDisabled();
 await s.p.keyboard.press('Control+,');await expect(root).toBeVisible();await retry.click();await expect(root.getByRole('button',{name:'Confirm handover',exact:true})).toHaveCount(0);
 const writes=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith('/infection/waste/handover')&&r.status===200);assert.equal(writes.length,2);assert.equal(writes[0].key,writes[1].key);assert.deepEqual(writes[0].body,writes[1].body);assert.equal(writes[1].replay,'true');assert(Math.abs(writes[0].result.data.weight_kg-0.33)<1e-8);
 j.confirmed=writes[0].result.data;j.requests=writes.map(w=>({status:w.status,key:w.key,body:w.body,replay:w.replay,request_id:w.result.request_id}));j.pending=null;save();
 const log=await s.native('api',{method:'GET',path:'/infection/waste?limit=5000'}),waiting=await s.native('api',{method:'GET',path:'/infection/waste?awaiting_handover=true&limit=5000'});
 for(const record of records){const found=log.records.filter(r=>r.waste_id===record.waste_id);assert.equal(found.length,1);assert.equal(found[0].weight_kg,record.weight_kg);assert(found[0].handed_over_by_name);assert(found[0].handed_over_on);assert(!waiting.records.some(r=>r.waste_id===record.waste_id));}
 j.checks.push('Future date refused beside date without a handover; F1 preserved date focus; pending handover blocks collection editor/navigation; committed real reply lost; exact original-key/body replay200; one note and unchanged collection weights; waiting list excludes both; final names/day/note shown.');
 await capture(s,'waste_log_ops');j.passed=true;s.j.passed=true;save();
}catch(error){j.error=error.stack;save();throw error;}finally{if(s)await s.close();}
console.log('PASS fresh UI handover, date refusal and lost-answer replay');
