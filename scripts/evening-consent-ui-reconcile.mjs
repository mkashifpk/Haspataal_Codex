import fs from 'node:fs';import assert from 'node:assert/strict';
const prior=JSON.parse(fs.readFileSync('artifacts/evening-consent-ui-read-check.json'));assert.equal(prior.trace.requests.filter(x=>x.method!=='GET').length,0);
// A failed pre-review validation stays in the inline editor; no dialog exists yet.
const s=fs.readFileSync('scripts/evening-consent-ui-read-check.mjs','utf8').replaceAll('evening-consent-ui-read-check.json','evening-consent-ui-current-check.json').replaceAll('evening-consent-read-actor','evening-consent-current-actor').replace("p.getByRole('dialog')).toContainText('Choose the second", "p.locator('.consent-editor')).toContainText('Choose the second");fs.writeFileSync('scripts/evening-consent-ui-current-check.mjs',s);
