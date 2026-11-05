# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// No business writes: inspect original handovers and final-build validation/error reset.
import {session,expect,help} from './clinical-test-kit.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const source=JSON.parse(fs.readFileSync('docs/phase2-handover-check-2026-10-24.json'));
const s=await session('phase2-handover-read-check','demo.doctor'),p=s.p;
try{
 await s.nav('Consultation (EMR)');
 const c=source.cases.admission;
 await p.getByLabel('OPD slip number',{exact:true}).fill(c.registration.data.ticket_number);
 await p.getByRole('button',{name:'Open slip',exact:true}).click();
 await p.getByRole('button').filter({hasText:`#${c.note.encounter_id} ·`}).first().click();
 await expect(p.getByRole('heading',{name:`Note #${c.note.encounter_id} · Final`,exact:true})).toBeVisible();
 await expect(p.locator('main')).toContainText(c.note.icd_terms[0].title);
 await p.getByRole('button',{name:'Admit',exact:true}).click();
 let dialog=p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'Confirm clinical action',exact:true})});
 await dialog.getByLabel('Admission reason',{exact:true}).fill('');
 await dialog.getByRole('button',{name:'Confirm clinical action',exact:true}).click();
 await expect(dialog).toContainText('admission reason and provisional diagnosis are required');
 p.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await p.getByRole('button',{name:'Admit',exact:true}).click();
 await expect(dialog).not.toContainText('admission reason and provisional diagnosis are required');
 await help(s,dialog.getByLabel('Admission reason',{exact:true}),'Consultation (EMR)');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 s.pass('Final build shows original Final note4 with titled ICD terms; invalid admission ZEROPOST; reopening clears stale validation and F1 preserves draft');
 await p.getByLabel('OPD slip number',{exact:true}).fill(source.cases.waiver.registration.data.ticket_number);
 await p.getByRole('button',{name:'Open slip',exact:true}).click();
 await expect(p.locator('main')).toContainText('WaiverPending');
 await expect(p.getByRole('button',{name:'Admit',exact:true})).toBeDisabled();
 const notes=await s.native('api',{method:'GET',path:`/opd-tickets/${source.cases.waiver.registration.data.ticket_id}/clinical-encounters`});assert.equal(notes.length,1);
 assert.equal((await s.trace()).requests.filter(x=>x.method!=='GET').length,0);
 s.pass('Pending waiver ticket16 stays locked after reopen; no duplicate note/admission/waiver/payment');
 s.j.passed=true;s.save();
}catch(e){s.j.error=e.stack;s.save();console.error(e.stack);process.exitCode=1}finally{await s.close();fs.copyFileSync('artifacts/phase2-handover-read-check.json','docs/phase2-handover-read-check-2026-10-24.json')}

```
