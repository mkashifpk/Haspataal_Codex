import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';

const owner=await session('p9a-final-owner','demo.owner','Owner / Hospital Admin');
try {
  await owner.p.getByRole('navigation').locator('[data-screen-target="facility_profile"]').click();
  const setup=owner.p.getByRole('button',{name:'Preventive programmes offered',exact:true});
  await expect(setup).toHaveAttribute('data-help','facility.service-setup');
  await setup.click();
  const root=owner.p.locator('[data-screen="preventive_programmes_setup"]');
  const retired=root.getByRole('checkbox',{name:'Include programmes no longer offered'});
  await retired.check();
  await expect(root).toContainText('SYNTHETIC P9A188 programme');
  await help(owner,retired,'Preventive programmes offered');
  assert(!(await owner.trace()).requests.some(r=>r.method!=='GET'));
  owner.j.passed=true;
  owner.pass('Final renderer opens permitted setup from Facility with scoped help and reads the already stopped programme. No business writes.');
}catch(error){owner.j.error=error.stack;throw error;}
finally{await owner.close();}

const ops=await session('p9a-final-ops','demo.ops');
try {
  await ops.p.getByRole('navigation').locator('[data-screen-target="my_complaint_investigations"]').click();
  const root=ops.p.locator('[data-screen="my_complaint_investigations"]');
  await expect(root).toContainText('CMP-2026-00002');
  const directory=await ops.native('api',{method:'GET',path:'/quality/record-review/people'});
  assert(directory.some(p=>p.display_name==='Nurse Hina' && p.can_review===false));
  assert(directory.some(p=>p.display_name==='Ops Admin'));
  assert(!directory.some(p=>/Inspector/i.test(p.display_name)));
  assert(!(await ops.trace()).requests.some(r=>r.method!=='GET'));
  ops.j.passed=true;
  ops.pass('Final native Ops assignment list finds its synthetic complaint. Staff directory permissions admit the actual active logins. No business writes.');
}catch(error){ops.j.error=error.stack;throw error;}
finally{await ops.close();}
