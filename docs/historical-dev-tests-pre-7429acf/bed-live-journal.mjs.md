# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';
const file='docs/bed-matrix-live-2026-10-28.json';
const input=JSON.parse(fs.readFileSync(process.stdin.fd,'utf8'));
if(input.action==='init'){if(fs.existsSync(file))throw Error('Reconcile original bed test journal before replacing');fs.writeFileSync(file,JSON.stringify({run:input.run,started:new Date().toISOString(),baseline:'354abea',requests:[]},null,2));}
else{const j=JSON.parse(fs.readFileSync(file));if(input.action==='prepare'){if(j.requests.some(x=>x.label===input.label))throw Error('Original request label exists; reconcile before retry');j.requests.push({label:input.label,args:input.args,state:'prepared'});}else{const e=j.requests.find(x=>x.label===input.label);if(!e)throw Error('Original request not recorded');Object.assign(e,{state:input.state,result:input.result});}fs.writeFileSync(file,JSON.stringify(j,null,2));}

```
