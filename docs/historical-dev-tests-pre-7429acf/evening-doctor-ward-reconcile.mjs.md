# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';import assert from 'node:assert/strict';const old=JSON.parse(fs.readFileSync('artifacts/evening-doctor-ward-check.json'));assert.equal(old.trace.requests.filter(x=>x.method!=='GET').length,0);let s=fs.readFileSync('scripts/evening-doctor-ward-check.mjs','utf8').replaceAll('evening-doctor-ward-check.json','evening-doctor-ward-current-check.json').replaceAll('evening-doctor-ward-actor','evening-doctor-ward-current-actor').replace("name:'Read ticket'","name:'Open slip'").replace("help(s,picker,'Clinical note')","help(s,picker,'Consultation (EMR)')");fs.writeFileSync('scripts/evening-doctor-ward-current-check.mjs',s);

```
