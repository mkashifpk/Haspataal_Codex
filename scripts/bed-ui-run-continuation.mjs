import fs from 'node:fs';import assert from 'node:assert/strict';
const first=JSON.parse(fs.readFileSync('artifacts/bed-matrix-ui-check.json'));
const actor=JSON.parse(fs.readFileSync('artifacts/bed-matrix-ui-actor.json'));
assert(first.finished&&actor.preferences_restored&&actor.signed_out,'Reconcile/close first actor');
const j=JSON.parse(fs.readFileSync('docs/bed-matrix-live-2026-10-28.json'));
assert.equal(j.requests.find(x=>x.label==='restore-after-first-ui-loss').result.status,200);
let code=fs.readFileSync('scripts/bed-matrix-ui-check.mjs','utf8').replaceAll('bed-matrix-ui-check.json','bed-matrix-ui-check-v2.json').replaceAll("'bed-matrix-ui-actor'","'bed-matrix-ui-actor-v2'").replaceAll("'bed-matrix-other-actor'","'bed-matrix-other-actor-v2'");
assert(!fs.existsSync('scripts/bed-matrix-ui-check-v2.mjs'));fs.writeFileSync('scripts/bed-matrix-ui-check-v2.mjs',code);
