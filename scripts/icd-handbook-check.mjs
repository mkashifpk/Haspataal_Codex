// Final bilingual authored Refresh instructions and F1 focus, no business writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {session,expect} from './clinical-test-kit.mjs';
const s=await session('icd-handbook-final','demo.doctor'),p=s.p;
try{
 await s.nav('ICD code picker');
 for(const language of ['en','ur']){
  await s.prefs({language});const input=p.locator('main input[data-help="icd.search"]');await input.fill('CA40');await input.focus();await p.keyboard.press('F1');await expect(p.locator('.help-article')).toContainText(language==='en'?'Refresh classification reloads the visible list':'درجہ بندی تازہ کرنے پر فہرست دوبارہ پڑھی');await expect(p.locator('.help-article')).toContainText(language==='en'?'What does Refresh classification change?':'درجہ بندی تازہ کرنے سے کیا بدلتا ہے؟');await p.keyboard.press('Escape');await expect(p.locator('.help-layout')).toHaveCount(0);await expect(input).toBeFocused();await expect(input).toHaveValue('CA40');
 }
 assert.equal((await s.trace()).requests.filter(r=>r.method!=='GET').length,0);s.pass('Final EN/UR Refresh page instructions and FAQ rendered by actual F1; Escape restores input focus/query; no business writes');s.j.passed=true;s.save();
}catch(e){s.j.error=e.stack;s.save();console.error(e.stack);process.exitCode=1;}
finally{await s.close();fs.writeFileSync('docs/icd-handbook-final-evidence-2026-10-25.json',JSON.stringify(s.j,null,2));}
