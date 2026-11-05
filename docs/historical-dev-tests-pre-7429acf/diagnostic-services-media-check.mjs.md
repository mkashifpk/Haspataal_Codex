# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Targeted final screenshot correction only: capture complete pages from top; no business writes.
import {session,expect} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const s=await session('diagnostic-services-media','demo.reception');
try{
 await s.nav('Diagnostic services list');await expect(s.p.getByTestId('diagnostic-service-row')).toHaveCount(5);
 for(const language of ['en','ur']){
  await s.prefs({language,theme:'Light',ui_scale_pct:100});await expect(s.p.locator('html')).toHaveAttribute('lang',language);await s.p.evaluate(()=>scrollTo(0,0));
  await s.p.screenshot({path:`public/handbook/diagnostic_services_list-${language}.png`,fullPage:true});
 }
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));s.pass('Final full-page ENUR media from top includes title, document actions and actual partner table; ZERO business writes');s.j.passed=true;
 fs.writeFileSync('docs/diagnostic-services-media-evidence-2026-10-27.json',JSON.stringify({date:new Date().toISOString(),build:s.j.renderer,passed:true,checks:s.j.checks,businessWrites:0},null,2));
}finally{await s.close();}

```
