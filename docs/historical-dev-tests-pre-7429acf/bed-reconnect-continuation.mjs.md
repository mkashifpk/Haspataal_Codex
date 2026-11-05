# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';import assert from 'node:assert/strict';
const file='artifacts/bed-matrix-reconnect-check.json',j=JSON.parse(fs.readFileSync(file)),actor=JSON.parse(fs.readFileSync('artifacts/bed-matrix-reconnect-actor.json'));assert(j.finished&&actor.preferences_restored&&actor.signed_out);assert(!j.passed);fs.renameSync(file,'artifacts/bed-matrix-reconnect-initial-failure.json');
let s=fs.readFileSync('scripts/bed-matrix-reconnect-check.mjs','utf8');s=s.replace("const u=process.getBuiltinModule('url').pathToFileURL(process.cwd()+'/node_modules/ws/wrapper.mjs').href;const m=await import(u),W=m.default,old=W.prototype.emit;","const taskRequire=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json');const W=taskRequire('ws'),old=W.prototype.emit;");fs.writeFileSync('scripts/bed-matrix-reconnect-check.mjs',s);

```
