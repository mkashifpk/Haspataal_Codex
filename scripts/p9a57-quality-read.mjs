import fs from 'node:fs';import assert from 'node:assert/strict';import{session,expect,help,capture}from'./clinical-test-kit.mjs';const j=JSON.parse(fs.readFileSync('artifacts/p9a57-corrected-journey.json'));delete j.error;const save=()=>fs.writeFileSync('artifacts/p9a57-final-journey.json',JSON.stringify(j,null,2));
const quality=await session('p9a57-final-quality','demo.quality');
try {
  await quality.p.getByRole('navigation').locator('[data-screen-target="incident_screening"]').click();
  const screening=quality.p.locator('[data-screen="incident_screening"]');
  await expect(screening).toContainText('Deaths appear after certification');
  await help(quality,screening.locator('input[data-help="isc.filter"]'),'Possible sentinel events: screening and reasoned decisions');
  await capture(quality,'incident_screening');
  await quality.p.getByRole('navigation').locator('[data-screen-target="action_register"]').click();
  const actions=quality.p.locator('[data-screen="action_register"]');
  const department=actions.locator('select[data-help="acr.department"]');
  const value=await department.locator('option').filter({hasText:'General Medicine'}).getAttribute('value');
  await department.selectOption(value);
  await actions.getByRole('button',{name:'Apply action filters',exact:true}).click();
  await expect(actions).toContainText('CAPA-2026-0016');
  await expect.poll(async()=>(await quality.trace()).requests.filter(r=>r.path.includes('department_id='+value)&&r.status===200).length).toBeGreaterThan(0);
  assert(!(await quality.trace()).requests.some(r=>r.method!=='GET'));
  j.quality=true;j.passed=true;save();quality.j.passed=true;
  quality.pass('Updated screening prerequisites and current action-register department filter. No business writes.');
}catch(error){j.error=error.stack;save();quality.j.error=error.stack;throw error;}
finally{await quality.close();}
