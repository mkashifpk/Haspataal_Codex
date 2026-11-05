# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final staff-wording/media check only; never replays setup writes.
import {session,expect} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const j=JSON.parse(fs.readFileSync('artifacts/imaging-setup-check-newserver-2026-10-27.json'));assert(j.passed&&j.finished&&j.target_restored&&j.finding_retired);
const s=await session('imaging-setup-media','demo.radiologist');
try{
 await s.nav('Imaging turnaround, critical findings and policy');await expect(s.p.getByTestId('imaging-target-row')).toHaveCount(8);await expect(s.p.locator('main')).toContainText('saving replaces all four values');await s.p.getByLabel('Active findings only',{exact:true}).uncheck();await s.p.getByLabel('Find a critical finding',{exact:true}).fill(j.run);await expect(s.p.getByTestId('imaging-finding-row')).toContainText(j.run);
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await expect(s.p.locator('html')).toHaveAttribute('lang',language);await s.p.evaluate(()=>scrollTo(0,0));await s.p.screenshot({path:`public/handbook/imaging_quality_setup-${language}.png`,fullPage:true});for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true)}}assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));s.pass('Final plain staff wording and full-page ENUR/themes250 layouts/media on actual fresh-server retired finding; ZERO business writes');s.j.passed=true;fs.writeFileSync('docs/imaging-setup-media-evidence-2026-10-27.json',JSON.stringify({date:new Date().toISOString(),passed:true,build:s.j.renderer,checks:s.j.checks,businessWrites:0},null,2));
}finally{await s.close()}

```
