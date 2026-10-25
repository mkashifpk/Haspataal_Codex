// Read-only real DEV reproduction/regression. No registration, payment or queue mutation.
import {session, expect} from './clinical-test-kit.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const baseline=process.argv.includes('--baseline');
const s=await session(`registration-queue-visibility-${baseline?'baseline':'fixed'}`, 'demo.reception');
try {
  await s.nav('New registration + OPD slip');
  const board=await s.native('api',{method:'GET',path:'/opd-queues/reception-dashboard'});
  const entries=board.queues.flatMap(q=>q.entries);
  assert(entries.length>0,'Needs an existing DEV queue; never fabricate one');
  await expect(s.p.getByRole('heading',{name:'Live OPD queues',exact:true})).toBeVisible();
  const panel=s.p.locator('section').filter({has:s.p.getByRole('heading',{name:'Live OPD queues',exact:true})});
  if(baseline){
    for(const e of entries) assert(!(await panel.innerText()).includes(e.ticket_number),'Baseline should reproduce hidden slips');
    s.pass('Real queue has entries but registration panel shows no patient/slip rows (reproduced)');
  } else {
    for(const e of entries){
      const row=panel.getByTestId('registration-queue-entry').filter({hasText:e.ticket_number});
      await expect(row).toContainText(e.patient_name);
      await expect(row).toContainText(String(e.token_no));
      await expect(row).toContainText(e.status);
    }
    s.pass('Each real server queue entry displays patient, slip, token and status');
    await s.p.getByLabel('Full name',{exact:true}).fill('DEMO UNSAVED QUEUE CHECK - never submitted');
    await s.fault({failPath:'/api/v1/opd-queues/reception-dashboard',failMethod:'GET',once:false});
    await panel.getByRole('button',{name:'Refresh queues',exact:true}).click();
    await expect(panel.locator('.error[role="alert"]')).toBeVisible({timeout:60000});
    await expect(panel.getByTestId('registration-queue-entry')).toHaveCount(0);
    s.pass('Failed refresh shows error, hides stale patient rows, never claims empty queue');
    await s.fault({failPath:null,delayPath:null});
    await panel.getByRole('button',{name:'Refresh queues',exact:true}).click();
    await expect(panel.getByTestId('registration-queue-entry')).toHaveCount(entries.length);
    await expect(s.p.getByLabel('Full name',{exact:true})).toHaveValue('DEMO UNSAVED QUEUE CHECK - never submitted');
    s.pass('Explicit read retry restores server queue without clearing intake draft');
    await panel.getByRole('button',{name:'Refresh queues',exact:true}).focus();
    await s.p.keyboard.press('F1');
    await expect(s.p.getByRole('dialog')).toContainText('Refresh queues');
    await s.p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
    await s.prefs({language:'ur',theme:'DarkHighContrast',ui_scale_pct:250});
    await expect(s.p.getByTestId('registration-live-queues')).toContainText('قطاریں تازہ کریں');
    await expect.poll(()=>s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
    await s.p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await s.p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    // Native capture avoids Playwright clip coordinates drifting under Electron zoom.
    const png=await s.app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html')).webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync('artifacts/registration-queue-urdu-panel-250.png',Buffer.from(png,'base64'));
    s.pass('F1 explains queue controls; Urdu/high contrast/250% queue reachable');
  }
  const trace=await s.trace();
  assert(!trace.requests.some(r=>r.method!=='GET'),'Read-only test must send no business writes');
  s.pass('Zero business writes; original patient/payment records untouched');
  s.j.passed=true;
  // Persist only synthetic summary; raw transport remains ignored.
  if(!baseline)fs.writeFileSync('docs/registration-queue-visibility-evidence-2026-10-25.json',JSON.stringify({date:new Date().toISOString(),checks:s.j.checks,queueGroups:board.queues.map(q=>q.queue_group),entries:entries.length,businessWrites:0,limits:'Existing DEV queue read only; no fresh registration/payment/event handover claimed.'},null,2));
} finally {
  await s.fault({failPath:null,delayPath:null});
  await s.close();
}
