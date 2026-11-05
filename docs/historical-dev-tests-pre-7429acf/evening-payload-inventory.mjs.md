# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Local shape audit inputs from actual recorded app/sandbox requests, never replayed.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const contracts=JSON.parse(fs.readFileSync('contracts/evening-write-endpoints-2026-10-28.json'));
const files=[...fs.readdirSync('artifacts').filter(x=>x.endsWith('-transport.json')).map(x=>'artifacts/'+x),...execFileSync('git',['ls-files','docs/*.json'],{encoding:'utf8'}).trim().split('\n').filter(x=>/evidence|live|payload/.test(x)&&!x.includes('progress')&&!x.includes('invalidated'))];
const candidates=new Map();
const match=(template,path)=>{const a=template.split('/'),b=path.replace(/^\/api\/v1/,'').split('?')[0].split('/');return a.length===b.length&&a.every((v,i)=>v===b[i]||/^\{.+\}$/.test(v));};
function visit(v,file){if(!v||typeof v!=='object')return;if(typeof v.method==='string'&&typeof v.path==='string'){
 const c=contracts.find(x=>x.previous.method===v.method&&match(x.previous.path,v.path));if(c&&(v.body!==undefined||c.endpoint.request_body===null)){const key=v.method+' '+c.previous.path;if(!candidates.has(key))candidates.set(key,{method:v.method,path:c.previous.path,body:v.body,source:file,absent_body:v.body===undefined});}}
 for(const item of Object.values(v))if(item&&typeof item==='object')Array.isArray(item)?item.forEach(x=>visit(x,file)):visit(item,file);}
for(const file of files)try{visit(JSON.parse(fs.readFileSync(file)),file);}catch(e){throw Error(file+': '+e.message);}
const out=contracts.map(({previous:x})=>candidates.get(x.method+' '+x.path)||{method:x.method,path:x.path,missing_actual_app_payload:true});
fs.writeFileSync('docs/backend-evening-payload-inventory-2026-10-28.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({count:out.length,missing:out.filter(x=>x.missing_actual_app_payload).map(x=>x.method+' '+x.path)}));

```
