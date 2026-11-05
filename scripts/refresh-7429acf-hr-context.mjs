import fs from 'node:fs';import assert from 'node:assert/strict';
import{session,expect,capture}from'./clinical-test-kit.mjs';
const employee=JSON.parse(fs.readFileSync('docs/backend-refresh-2026-11-05/hr-draft-result.json')).body.data;
let s;try{
 s=await session('refresh7429-hr-context','demo.hr');
 const nav=s.p.getByRole('navigation'),main=s.p.locator('#content');await nav.locator('[data-screen-target="onboarding_wizard"]').click();
 const choose=main.locator('[data-help="onboarding_wizard.load_emp_id"]');await expect(choose).toHaveText(/Choose an existing profile by name/);await choose.click();
 await main.locator('[data-help="staff_directory.search"]').fill(employee.full_name);await main.locator('[data-help="staff_directory.filter.status"]').selectOption('Draft');await main.locator('[data-help="staff_directory.search_button"]').click();
 const row=main.getByRole('row').filter({hasText:employee.full_name});await expect(row).toHaveCount(1);await row.locator('[data-help="staff_directory.view_profile"]').click();await main.locator('[data-help="staff_directory.open_wizard"]').click();
 await expect(main).toContainText(employee.full_name);await expect(main).toContainText(employee.emp_number);
 await main.locator('[data-help="onboarding_wizard.step_2_tab"]').click();
 const dept=main.locator('.directory-picker select[data-help="onboarding_wizard.step2_department"]');await expect(dept.locator('option')).not.toHaveCount(1);await dept.selectOption(await dept.locator('option:not([value=""])').first().getAttribute('value'));
 const supervisor=main.locator('.directory-picker').filter({has: s.p.locator('input[data-help="onboarding_wizard.step2_supervisor"]')});await supervisor.locator('input').fill('Hina');await supervisor.getByRole('button',{name:'Find by name',exact:true}).click();
 await expect(supervisor.locator('option').filter({hasText:'Nurse Hina'})).toHaveCount(1);const option=supervisor.locator('option').filter({hasText:'Nurse Hina'});const id=await option.getAttribute('value');const staff=await s.native('api',{method:'GET',path:'/staff/lookup?q=Hina'});assert.equal(Number(id),staff[0].employee_id);assert.notEqual(Number(id),staff[0].user_id);await supervisor.locator('select').selectOption(id);
 const trace=(await s.trace()).requests;assert(trace.some(r=>r.method==='GET'&&r.path.endsWith('/hr/employees/'+employee.employee_id)));assert(!trace.some(r=>r.method!=='GET'),'No employee save/registration is performed by selecting or resuming a profile');
 await capture(s,'onboarding_wizard');s.j.passed=true;s.pass('Named Draft profile carried from Staff Directory into onboarding; active departments and supervisor employee_id chosen by name; no re-registration/save or typed IDs.');
}finally{if(s)await s.close();}
