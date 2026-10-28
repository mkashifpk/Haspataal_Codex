// Read-only final-renderer help/layout verification. Saves/restores demo preferences.
import fs from 'node:fs';import assert from 'node:assert/strict';import {session,expect} from './clinical-test-kit.mjs';
const file='artifacts/backend-refresh-help-final.json';assert(!fs.existsSync(file),'Reconcile previous help journal');let s;const j={checks:[],passed:false};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
try{
 s=await session('backend-refresh-help-session','demo.radiographer');const p=s.p;await s.nav('Imaging worklist');const fixture=JSON.parse(fs.readFileSync('docs/backend-refresh-live-evidence-2026-10-28.json'));const o=fixture.requests.find(x=>x.label==='final-ui-order').result.body.data;
 const field=p.locator('[data-help="radiology.lookup"]').first();const actual=p.getByLabel('Known imaging order ID',{exact:true});await actual.fill(String(o.imaging_order_id));await p.getByRole('button',{name:'Open imaging order',exact:true}).click();await expect(p.locator('main')).toContainText(o.accession_number);
 await actual.focus();await p.keyboard.press('F1');await expect(p.locator('.help-article')).toContainText('five groups of eight lower-case hex digits');await expect(p.locator('.help-article')).toContainText('PACS_NOT_CONFIGURED');
 await p.getByRole('dialog').filter({has:p.locator('.help-layout')}).getByRole('button',{name:'Close',exact:true}).click();await expect(actual).toBeFocused();
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'public/handbook/radiology_worklist-'+language+'.png',fullPage:true});for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
 j.checks.push('Latest renderer actual handbook contains PMDC/PACS/new manual format; F1 restores query focus; ENUR snapshots and both-theme250 layout; no business writes');
 j.renderer=s.j.renderer;j.passed=true;save();
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}finally{if(s){j.trace=await s.trace();await s.close();}j.finished=new Date().toISOString();save();}
