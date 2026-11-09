import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const s=await session('p9a57-refresh-focus','demo.quality');
try {
 await s.p.getByRole('navigation').locator('[data-screen-target="incident_screening"]').click();
 const screen=s.p.locator('[data-screen="incident_screening"]');
 await expect(screen).toContainText('Deaths appear after certification');
 const refresh=screen.locator('button[data-help="isc.refresh"]');
 await expect(refresh).toBeEnabled();
 await refresh.focus();
 await expect(refresh).toBeFocused();
 await help(s,refresh,'Possible sentinel events: screening and reasoned decisions');
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
 s.j.passed=true;s.pass('An enabled and focused screening Refresh button restores focus after F1. No writes.');
} catch(error){s.j.error=error.stack;throw error;} finally{await s.close();}
