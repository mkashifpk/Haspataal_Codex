import assert from 'node:assert/strict';
import {session,expect,help,capture} from './clinical-test-kit.mjs';

const s=await session('p9a186-ui','demo.owner','Owner / Hospital Admin');
try {
  await s.p.getByRole('navigation').locator('[data-screen-target="home_visit_policy"]').click();
  const root=s.p.locator('[data-screen="home_visit_policy"]');
  const policy=await s.native('api',{method:'GET',path:'/home-visits/policy'});
  const actual=policy.provided?'Home visits are provided':'Home visits are not provided';
  await expect(root.getByRole('heading',{name:actual,exact:true})).toBeVisible();
  const preview=root.getByRole('button',{name:'Preview home visit notice',exact:true});
  await help(s,preview,'Home visits: our policy and its notice');
  await preview.click();await expect(root).toContainText('PDF opened.');
  for(const p of s.app.windows())if(p!==s.p&&p.url().startsWith('data:application/pdf'))await p.close();
  const edit=root.getByRole('button',{name:'Edit arrangements',exact:true});
  if(await edit.count()){
    await edit.click();
    const draft=root.locator('textarea[name="arrangements"]');
    await draft.fill('SYNTHETIC unsent policy draft for focus and cancellation testing.');
    await help(s,draft,'Home visits: our policy and its notice');
    await expect(draft).toHaveValue('SYNTHETIC unsent policy draft for focus and cancellation testing.');
    await root.getByRole('button',{name:'Cancel unsent changes',exact:true}).click();
    await expect(draft).toHaveCount(0);
  }
  await capture(s,'home_visit_policy');
  const facility=root.getByRole('button',{name:'Open Facility settings',exact:true});
  if(await facility.count()){
    await facility.click();
    await expect(s.p.getByRole('heading',{name:/facility|services/i}).first()).toBeVisible();
    await expect(root).toHaveCount(0);
    s.j.facilityHandoff=true;
  }
  assert(!(await s.trace()).requests.some(r=>['POST','PUT','PATCH','DELETE'].includes(r.method)));
  s.j.policy=policy;s.j.passed=true;
  s.pass('Actual Owner policy and official PDF, F1 and bilingual layout at 250%. No arrangements or service changes.');
} catch(e){s.j.error=e.stack;throw e;} finally{await s.close();}
