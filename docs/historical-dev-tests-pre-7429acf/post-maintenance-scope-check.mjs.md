# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Read-only business checks for backend reports21/22/24/25; restores test preferences.
import {session,expect,help} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const result={date:new Date().toISOString(),checks:[],passed:false};
const actors=[];
const launch=async(n,u)=>{const s=await session(n,u);actors.push(s);s.p.on('dialog',d=>d.accept());return s;};
const pass=m=>{result.checks.push(m);console.log('PASS '+m);};
try{
 const d=await launch('scope-doctor','demo.doctor');
 await d.nav('Patient search');
 await help(d,d.p.getByLabel('Patient search query',{exact:true}),'Patient search');
 await d.p.getByLabel('Patient search query',{exact:true}).fill('MRN-2026-000005');
 await d.p.getByRole('button',{name:'Search',exact:true}).click();
 await expect(d.p.locator('main')).toContainText('DEMO-FINANCIAL-');
 await expect(d.p.getByRole('button',{name:'Edit demographics',exact:true})).toHaveCount(0);
 const me=await d.native('api',{method:'GET',path:'/auth/me'});assert(me.permissions.includes('patient.view'));assert(!me.permissions.includes('patient.update'));
 pass('21 Doctor scoped Patient search and contextual F1 reachable; own synthetic lookup actual API; no demographic edit permission/button');
 await d.close();actors.pop();
 const a=await launch('scope-pharmadmin','demo.pharmadmin');
 await a.nav('Prescription queue');
 await expect(a.p.locator('h1')).toHaveText('Prescription queue');
 await expect(a.p.getByTestId('rxqueue-reader')).toHaveCount(0);
 await expect(a.p.getByRole('button',{name:'Review prescription',exact:false})).toHaveCount(0);
 const am=await a.native('api',{method:'GET',path:'/auth/me'});assert(am.permissions.includes('pharmacy.queue.view'));assert(!am.permissions.includes('prescription.view'));
 await help(a,a.p.getByLabel('Find in this queue',{exact:true}),'Prescription queue');
 pass('22 Pharmacy Admin scoped queue/F1 reachable with independent queue-only permission; no detail reader or known-ID bypass');
 await a.close();actors.pop();
 const p=await launch('scope-pharmacist','demo.pharmacist');
 const term=await p.native('api',{method:'GET',path:'/terminals/whoami'});assert.equal(term.registered,true);assert.equal(term.location_label,'DEV Reception laptop (Codex)');assert.equal(term.cash_node,'MainReception');
 assert.equal(await p.native('api',{method:'GET',path:'/finance/cash-shifts/mine?node=PharmacyCounter'}),null);
 await p.nav('My cash shift');
 await expect(p.p.locator('main')).toContainText('This PC is not set up for pharmacy cash.');
 await p.p.getByLabel('Opening float',{exact:true}).fill('1500');
 await expect(p.p.getByRole('button',{name:'Open cash shift',exact:true})).toBeDisabled();
 await help(p,p.p.getByLabel('Opening float',{exact:true}),'My cash shift');
 pass('25 Pharmacy scoped My cash shift/F1; actual terminal4 MainReception explained, opening disabled even with valid float; no mapping changed');
 await p.nav('OTC mode');
 await expect(p.p.locator('main')).toContainText('Cash needs your own open Pharmacy Counter shift.');
 const method=p.p.getByLabel('OTC payment method',{exact:true});
 await expect(method.locator('option[value="Cash"]')).toHaveAttribute('disabled','');
 await expect(method.locator('option[value="Card"]')).not.toHaveAttribute('disabled');
 pass('24 Actual node-filtered own drawer null disables OTC Cash; Card remains available; no sale/payment');
 const writes=(await p.trace()).requests.filter(x=>x.method!=='GET');assert.equal(writes.length,0);
 result.passed=true;
}catch(e){result.error=e.stack;console.error(e.stack);process.exitCode=1;}
finally{for(const s of actors.reverse())await s.close();fs.writeFileSync('docs/post-maintenance-scope-evidence-2026-10-26.json',JSON.stringify(result,null,2));}

```
