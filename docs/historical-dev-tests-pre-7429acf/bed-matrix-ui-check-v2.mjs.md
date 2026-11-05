# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Fresh owned DEV ward/beds only; never rerun after a partial write without reconciliation.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const file='artifacts/bed-matrix-ui-check-v2.json';assert(!fs.existsSync(file),'Reconcile original bed UI journal first');
const f=JSON.parse(fs.readFileSync('docs/bed-matrix-live-2026-10-28.json')),get=n=>f.requests.find(x=>x.label===n).result.body.data;
const ward=get('create-demo-ward'),rows=get('create-demo-beds'),a=rows[0],c=rows[2],ad=f.requests.find(x=>x.label==='fresh-admission-scenario').result.saved;
const j={run:f.run,intents:[],checks:[],passed:false},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m)};let s,other;
try{
 s=await session('bed-matrix-ui-actor-v2','demo.admissions');const p=s.p;p.on('dialog',d=>d.accept());await s.nav('Live bed matrix');
 await p.getByLabel('Ward to show',{exact:true}).selectOption(String(ward.ward_id));await expect(p.getByTestId('bed-tile-'+a.bed_id)).toContainText('Available');await expect(p.getByTestId('bed-counts-'+ward.ward_id)).toContainText('Reserved 1');
 await p.getByTestId('bed-tile-'+c.bed_id).click();await expect(p.locator('.bed-context')).toContainText(ad.mrn);await expect(p.getByRole('button',{name:'Take bed out of service',exact:true})).toHaveCount(0);
 await p.getByRole('button',{name:'Open this admission',exact:true}).click();await expect(p.getByTestId('admission-detail')).toContainText(ad.mrn);await expect(p.getByTestId('admission-detail')).toContainText('BedReserved');
 await s.nav('Live bed matrix');await p.getByLabel('Ward to show',{exact:true}).selectOption(String(ward.ward_id));
 await p.getByLabel('Find a bed or returned patient',{exact:true}).fill('NO-MATCH-DEMO');await expect(p.getByText('No beds match these filters in this ward.',{exact:true})).toBeVisible();await expect(p.getByTestId('bed-counts-'+ward.ward_id)).toContainText('Reserved 1');await p.getByLabel('Find a bed or returned patient',{exact:true}).fill('');
 await help(s,p.getByLabel('Ward to show',{exact:true}),'Live bed matrix');pass('Fresh ward/count/empty filters, reserved bed guard, actual patient identity and exact admission handover; F1/focus');
 await p.getByTestId('bed-tile-'+a.bed_id).click();await p.getByRole('button',{name:'Take bed out of service',exact:true}).click();let m=p.getByRole('dialog');
 await m.getByLabel('Bed service reason',{exact:true}).fill('x');await m.getByLabel('I checked the actual bed, ward and readiness for this service change.',{exact:true}).check();await m.getByRole('button',{name:'Review bed change',exact:true}).click();await expect(m).toContainText('3–300');
 assert.equal((await s.trace()).requests.filter(x=>x.method==='POST'&&x.path.includes('/beds/')).length,0);
 await m.getByLabel('Bed service reason',{exact:true}).fill('DEMO UI readiness test; no real bed or cleaning');await help(s,m.getByLabel('Bed service reason',{exact:true}),'Live bed matrix');await m.getByLabel('I checked the actual bed, ward and readiness for this service change.',{exact:true}).check();await m.getByRole('button',{name:'Review bed change',exact:true}).click();
 await s.fault({failPath:'/beds/'+a.bed_id+'/state',failMethod:'POST',once:true});j.intents.push({kind:'out-service-lost-real-response',bed_id:a.bed_id});save();
 await m.getByRole('button',{name:'Confirm bed change',exact:true}).evaluate(el=>{el.click();el.click()});await expect(m).toContainText('The result is unknown.');
 let writes=(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path.endsWith('/beds/'+a.bed_id+'/state'));assert.equal(writes.length,1);assert.equal(writes[0].status,200);
 await m.getByRole('button',{name:'Read original bed result',exact:true}).click();await expect(m).toContainText('Out of service');await expect(m.getByLabel('Bed service reason',{exact:true})).toHaveValue('DEMO UI readiness test; no real bed or cleaning');
 j.intents.push({kind:'explicit-identical-retry',bed_id:a.bed_id,key:writes[0].key});save();await m.getByRole('button',{name:'Retry original request',exact:true}).click();await expect(m).toHaveCount(0);
 writes=(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path.endsWith('/beds/'+a.bed_id+'/state'));assert.equal(writes.length,2);assert.equal(writes[0].key,writes[1].key);assert.deepEqual(writes[0].body,writes[1].body);assert.equal(String(writes[1].replay),'true');await expect(p.getByTestId('bed-tile-'+a.bed_id)).toContainText('Out of service');
 pass('Invalid reason blocked beforePOST; double click one effect; actual lost200 retains original draft/key; exact-bed read and explicit same-key replay200');
 const restore=async()=>{await p.getByTestId('bed-tile-'+a.bed_id).click();await p.getByRole('button',{name:'Return bed to service',exact:true}).click();const d=p.getByRole('dialog');await d.getByLabel('Bed service reason',{exact:true}).fill('DEMO synthetic fixture ready; no physical cleaning claim');await d.getByLabel('I checked the actual bed, ward and readiness for this service change.',{exact:true}).check();await d.getByRole('button',{name:'Review bed change',exact:true}).click();j.intents.push({kind:'restore-service',bed_id:a.bed_id});save();await d.getByRole('button',{name:'Confirm bed change',exact:true}).click();await expect(d).toHaveCount(0);await expect(p.getByTestId('bed-tile-'+a.bed_id)).toContainText('Available');};
 await restore();
 await p.getByTestId('bed-tile-'+a.bed_id).click();await p.getByRole('button',{name:'Take bed out of service',exact:true}).click();m=p.getByRole('dialog');await m.getByLabel('Bed service reason',{exact:true}).fill('DEMO reason survives another terminal');await m.getByLabel('I checked the actual bed, ward and readiness for this service change.',{exact:true}).check();await m.getByRole('button',{name:'Review bed change',exact:true}).click();
 other=await session('bed-matrix-other-actor-v2','demo.admissions');const key='bed-concurrent-'+Date.now();j.intents.push({kind:'other-terminal-state-change',bed_id:a.bed_id,key});save();await s.fault({delayPath:'/beds/matrix',delayMs:5000});
 await other.native('api',{method:'POST',path:'/beds/'+a.bed_id+'/state',key,body:{state:'OutOfService',reason:'DEMO other-terminal readiness change'}});
 await expect(p.getByTestId('bed-tile-'+a.bed_id)).toContainText('Out of service');await expect(m).toContainText('This bed changed on the server.');await expect(m.getByRole('button',{name:'Confirm bed change',exact:true})).toBeDisabled();await expect(m.getByLabel('Bed service reason',{exact:true})).toHaveValue('DEMO reason survives another terminal');
 await expect(p.getByTestId('bed-counts-'+ward.ward_id)).toContainText('Out of service 1');await s.fault({delayPath:null,delayMs:0});await expect(p.getByText('Refreshing bed details',{exact:false})).toHaveCount(0);
 await m.getByRole('button',{name:'Read current bed and keep reason',exact:true}).click();await expect(m.getByLabel('Bed service reason',{exact:true})).toHaveValue('DEMO reason survives another terminal');await m.getByRole('button',{name:'Close bed draft',exact:true}).click();await expect(m).toHaveCount(0);await restore();
 pass('Actual other-terminal bed event updates tile/count incrementally then rereads; stale review disabled and reason preserved; explicit restore200');
 // Lose one real matrix GET response; no fabricated business response.
 await s.fault({failPath:'/beds/matrix',failMethod:'GET',once:true});await p.getByRole('button',{name:'Refresh bed matrix',exact:true}).click();await expect(p.locator('.bed-matrix').getByRole('alert')).toBeVisible();await expect(p.getByTestId('bed-ward-'+ward.ward_id)).toHaveCount(0);await p.getByRole('button',{name:'Try again',exact:true}).click();await expect(p.getByTestId('bed-tile-'+a.bed_id)).toBeVisible();
 pass('Failed actual matrix read hides stale ward actions and offers read-only recovery');
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'public/handbook/bed_matrix-'+language+'.png'});for(const theme of ['Light','DarkHighContrast']){await s.prefs({theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});const win=await s.app.browserWindow(p),press=async(key)=>win.evaluate((w,key)=>{for(const type of ['keyDown','keyUp'])w.webContents.sendInputEvent({type,keyCode:key,modifiers:['control']})},key);
 await press('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await press('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBeGreaterThan(100);await s.prefs({ui_scale_pct:250});await press('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await press('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 pass('Actual English/Urdu handbook media, both themes250 root layout and native Settings/keyboard zoom bounds/reset');j.trace=await s.trace();j.otherTrace=await other.trace();j.renderer=s.j.renderer;j.passed=true;save();
}catch(e){j.error=e.stack;try{j.ui=await s.p.locator('body').innerText();j.trace=await s.trace()}catch{}save();console.error(e.stack);process.exitCode=1;}
finally{if(other)await other.close();if(s)await s.close();j.finished=new Date().toISOString();save();}

```
