// Real DEV read-only cash readiness; never opens a shift, collects cash or registers a patient.
import {session,expect} from './clinical-test-kit.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=await session('terminal-cash-readiness-20261025','demo.reception');
try {
  const terminal=await s.native('api',{method:'GET',path:'/terminals/whoami'});
  assert(terminal.registered,'Actual laptop is not registered on DEV');
  assert.equal(terminal.cash_node,'MainReception');
  s.pass('Native terminal identity resolves its actual server MainReception mapping');
  const shift=await s.native('api',{method:'GET',path:'/finance/cash-shifts/mine'});
  await s.nav('My cash shift');
  await expect(s.p.getByText('Ask IT to map this terminal to a cash counter before opening a shift.',{exact:true})).toHaveCount(0);
  if(!shift){
    await s.p.getByLabel('Opening float',{exact:true}).fill('1500');
    await expect(s.p.getByRole('button',{name:'Open cash shift',exact:true})).toBeEnabled();
    s.pass('Opening float1500 enables Open cash shift after valid server mapping; not clicked');
  }else{
    assert.equal(shift.node,terminal.cash_node);
    s.pass('Existing own shift belongs to the mapped counter; no replacement shift attempted');
  }
  const trace=await s.trace();assert(!trace.requests.some(x=>x.method!=='GET'));
  s.pass('No shift/payment/registration or other business write submitted');
  s.j.passed=true;
  fs.writeFileSync('docs/terminal-cash-readiness-evidence-2026-10-25.json',JSON.stringify({date:new Date().toISOString(),registered:terminal.registered,cash_node:terminal.cash_node,checks:s.j.checks,businessWrites:0,scope:'Read-only actual DEV laptop identity and shift form; no cash handling or fresh payment claimed'},null,2));
}finally{await s.close();}
