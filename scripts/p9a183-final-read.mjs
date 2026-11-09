import assert from 'node:assert/strict';
import {session, expect, help, capture} from './clinical-test-kit.mjs';

const s = await session('p9a183-final-read', 'demo.reception');
try {
  await s.p.getByRole('navigation').locator('[data-screen-target="record_feedback_reception"]').click();
  const root = s.p.locator('[data-screen="record_feedback_reception"]');
  await s.app.evaluate(({dialog}) => { dialog.showSaveDialog = async () => ({canceled: true}); });
  await root.getByRole('button', {name: 'Save blank feedback form', exact: true}).click();
  await expect(root).toContainText('PDF save cancelled');
  await root.getByRole('button', {name: 'New feedback response', exact: true}).click();
  await expect(root).not.toContainText('PDF save cancelled');
  const answer = root.locator('select[name="satisfied"]');
  await expect(answer).toHaveValue('');
  await expect(root.locator('select[name="respondent"]')).toHaveValue('Anonymous');
  await answer.selectOption('no');
  await expect(root.locator('input[name="reasons"]')).toHaveCount(13);
  await help(s, answer, 'Patient feedback: listen, record and keep the response');
  await capture(s, 'record_feedback_reception');
  assert.equal((await s.trace()).requests.filter(r => r.method === 'POST').length, 0);
  s.j.passed = true;
  s.pass('Current DEV renderer. Blank PDF cancellation clears before a new anonymous draft. F1 restores focus, bilingual 250% layout passes, no feedback writes.');
} catch (error) {
  s.j.error = error.stack;
  throw error;
} finally {
  await s.close();
}
