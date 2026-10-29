// Real DEV screen test. Only the explicitly journaled synthetic cleaning is written.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const name=process.argv[2]||'mybeds59-check',file=`artifacts/${name}.json`;
assert(!fs.existsSync(file),'Reconcile any prior cleaning result, never replay with a new key');
const f=JSON.parse(fs.readFileSync('docs/mybeds59/scenario-result.json')).saved,beds=JSON.parse(fs.readFileSync('docs/mybeds59/beds-result.json')).body.data;
const j={passed:false,intents:[]};let s;const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
try{
 s=await session(name+'-nurse','demo.nurse');const p=s.p;p.on('dialog',d=>d.accept());
 await s.nav('My beds this shift');await expect(p.getByRole('heading',{name:'My beds this shift',exact:true})).toBeVisible();
 await expect(p.locator('aside.card')).toContainText('D59-A');await expect(p.locator('main')).toContainText('2026-10-29');await expect(p.locator('main')).toContainText('Night');
 await p.locator('aside.card').getByRole('button').filter({hasText:'D59-A'}).click();const card=p.locator('article.card');await expect(card).toContainText(f.mrn);
 await expect.poll(async()=>{const r=await s.native('api',{method:'GET',path:'/admissions/'+f.admission_id});return r.status;},{timeout:120000,intervals:[2000,5000]}).toBe('DischargeInProgress');
 await p.getByRole('button',{name:'Refresh my beds',exact:true}).click();await expect(card).toContainText('Dirty');
 await p.getByRole('button',{name:'Read signed discharge summary',exact:true}).click();await expect(card).toContainText('DEMO software follow-up instructions only');await expect(card).toContainText('DEMO no actual medicine');
 await help(s,p.getByLabel('Find in my beds',{exact:true}),'My beds this shift');
 await p.getByLabel('Find in my beds',{exact:true}).fill('DEMO no match59');await expect(p.locator('aside.card')).toContainText('No beds match this search');await expect(card).toContainText(f.mrn);await p.getByLabel('Find in my beds',{exact:true}).fill('');
 // Only the native save dialog is automated; PDF bytes are from the real server.
 await s.app.evaluate(({dialog},name)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:process.cwd()+`/artifacts/${name}-summary.pdf`});},name);
 await p.getByRole('button',{name:'Save signed summary PDF',exact:true}).click();await expect.poll(()=>fs.existsSync(`artifacts/${name}-summary.pdf`)).toBe(true);assert.equal(fs.readFileSync(`artifacts/${name}-summary.pdf`).subarray(0,5).toString(),'%PDF-');
 // No physical printer is used. A native print failure must not submit cleaning.
 await s.app.evaluate(({app})=>{app.on('browser-window-created',(_,w)=>{w.webContents.print=(_,cb)=>cb(false,'TEST printer cancelled; no physical output');});});
 await p.getByRole('button',{name:'Print signed summary (A4)',exact:true}).click();await expect(p.locator('main [role="alert"]')).toBeVisible();
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:`public/handbook/my_beds-${language}.png`,fullPage:true});for(const theme of ['Light','DarkHighContrast']){await s.prefs({theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});
 await p.getByRole('button',{name:'Bed cleaned',exact:true}).click();const input=p.getByLabel('Find cleaner (optional)',{exact:true});await input.fill('Karim');await p.getByRole('button',{name:'Find staff',exact:true}).click();await p.getByRole('button',{name:/Janitor Karim/}).click();await expect(p.locator('fieldset')).toContainText('Selected cleaner');
 await help(s,input,'My beds this shift');await p.getByLabel('I verified this bed and that cleaning was completed',{exact:true}).check();await p.getByRole('button',{name:'Review cleaning confirmation',exact:true}).click();await help(s,p.getByRole('dialog').getByRole('button',{name:'Confirm this cleaning once',exact:true}),'My beds this shift');
 // Lose the real committed response once; the retry must retain its exact key/body.
 j.intents.push({action:'DEMO software-only cleaning confirmation for own synthetic bed; real reply lost once',bed_id:beds[0].bed_id,cleaner:'Janitor Karim from live lookup'});save();await s.fault({failPath:`/beds/${beds[0].bed_id}/mark-cleaned`,failMethod:'POST',once:true});
 await p.getByRole('dialog').getByRole('button',{name:'Confirm this cleaning once',exact:true}).click();await expect(p.getByRole('button',{name:'Retry original request',exact:true})).toBeVisible();
 await expect(p.locator('main')).toContainText('The result is unknown');await expect(p.getByRole('button',{name:'Refresh my beds',exact:true})).toBeDisabled();await p.getByRole('button',{name:'Read current beds',exact:true}).click();await expect(p.getByRole('button',{name:'Result reviewed; return to draft',exact:true})).toHaveCount(0);
 await p.getByRole('button',{name:'Retry original request',exact:true}).click();await expect(p.locator('main')).toContainText('Cleaning recorded. The bed stays locked');await expect(p.locator('fieldset')).toHaveCount(0);
 j.trace=await s.trace();const posts=j.trace.requests.filter(r=>r.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0].status,200);assert.equal(posts[1].status,200);assert.equal(posts[0].key,posts[1].key);assert.deepEqual(posts[0].body,posts[1].body);assert.equal(posts[1].replay,'true');assert.equal(posts[0].result.data.outcome,'BedCleaningRecorded');
 j.admission=await s.native('api',{method:'GET',path:'/admissions/'+f.admission_id});assert.equal(j.admission.discharge.blocked_on,'PharmacyClearance');assert.equal(j.admission.status,'DischargeInProgress');j.passed=true;save();console.log('PASS real rostered beds/night duty, signed summary/serverPDF, print failure/no write, no-match/F1/ENUR/themes250, selected cleaner, one committed cleaning/replayed same key, bed stays locked');
}catch(e){j.error=e.stack;try{j.trace=await s?.trace();j.ui=await s?.p.locator('body').innerText();}catch{}save();console.error(e.stack);process.exitCode=1;}
finally{if(s)await s.close();j.finished=new Date().toISOString();save();}
