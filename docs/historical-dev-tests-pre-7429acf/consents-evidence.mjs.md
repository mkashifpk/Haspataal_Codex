# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';const names=['consents-ui-check','consents-ui-continuation','consents-ui-decision-continuation','consents-ui-resume-stable','consents-worklist-check','consents-worklist-current-check','consents-final-check','consents-final-current-check','consents-delivery-read-check','consents-delivery-current-read-check','consents-delivery-final-read-check'];
const runs=names.filter(n=>fs.existsSync('artifacts/'+n+'.json')).map(name=>{const r=JSON.parse(fs.readFileSync('artifacts/'+name+'.json'));return {name,run:r.run,passed:r.passed,renderer:r.renderer,intents:r.intents,checks:r.checks,error:r.error,finished:r.finished,consent:r.consent,final:r.final,concurrent:r.concurrent,withdrawn:r.withdrawn,requests:r.trace?.requests.filter(t=>/\/consent|\/patients\/\d+\/documents|\/staff\/lookup/.test(t.path)),otherRequests:r.otherTrace?.requests.filter(t=>/\/consent/.test(t.path))};});
const out={date:'2026-10-28',baseline:'384b1a4',runs};function audit(v){if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if(/^(password|access_token|refresh_token|authorization|review_code)$/i.test(k)&&typeof x==='string'&&x&&x!=='[REDACTED]')throw Error('Credential value in evidence');audit(x);}}audit(out);fs.writeFileSync('docs/consents-ui-evidence-2026-10-28.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(runs.map(({name,passed,renderer})=>({name,passed,renderer}))));

```
