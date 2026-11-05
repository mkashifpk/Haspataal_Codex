# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const dir='contracts/refresh-20261030/';
const refreshed=JSON.parse(fs.readFileSync(dir+'runtime-endpoints.json','utf8'));
const old=new Map();
for(const file of execFileSync('git',['ls-files','contracts/*.json'],{encoding:'utf8'}).trim().split('\n')){
 try{const b=JSON.parse(execFileSync('git',['show',`758bd34:${file}`],{encoding:'utf8',maxBuffer:20e6}));for(const e of b.endpoints||[])old.set(e.endpoint,e);}catch{}
}
const screens=fs.readdirSync(dir).filter(n=>n.endsWith('.json')&&!n.includes('-')&&n!=='endpoints.json').map(n=>JSON.parse(fs.readFileSync(dir+n,'utf8'))).filter(b=>b.screen_id);
const rows=[];
for(const b of screens)for(const e of b.endpoints||[]){const previous=old.get(e.endpoint);const prior=new Set(previous?.errors?.map(x=>x.code)||[]);const added=e.errors?.map(x=>x.code).filter(x=>!prior.has(x))||[];if(added.length)rows.push({screen:b.screen_id,endpoint:e.endpoint,new_codes:added,handling:'Shared ErrorBox: exact code, request ID, field binding and code-indexed recovery guidance; state refusals perform only the declared reconciliation GET and preserve drafts. Specific clinical list refreshes handled in screen policies.'});}
const guidance=JSON.parse(fs.readFileSync('src/refusal-guidance.json','utf8'));
const states=new Set(JSON.parse(fs.readFileSync('src/refusal-state-codes.json','utf8')));
const recovery=JSON.parse(fs.readFileSync('src/refusal-contracts.json','utf8'));
for(const {key,contract:d} of refreshed){for(const e of d.errors||[]){guidance[e.code]={category:e.category,retryable:e.retryable,action:e.ui_action};if(e.http_status===409)states.add(e.code);}const method=d.method,path=d.path.replace(/^\/api\/v1/,'');const item=recovery.find(x=>x.method===method&&x.path===path);const read=d.write_semantics?.reconcile_with||item?.read||null;const next={method,path,codes:(d.errors||[]).map(x=>x.code),read};if(item)Object.assign(item,next);else recovery.push(next);}
fs.writeFileSync('src/refusal-guidance.json',JSON.stringify(guidance,null,2)+'\n');
fs.writeFileSync('src/refusal-state-codes.json',JSON.stringify([...states].sort(),null,2)+'\n');
fs.writeFileSync('src/refusal-contracts.json',JSON.stringify(recovery,null,2)+'\n');
fs.writeFileSync('docs/backend-refresh-2026-10-30/error-audit.json',JSON.stringify(rows,null,2)+'\n');
fs.writeFileSync('docs/backend-refresh-2026-10-30/error-audit.md','| Screen | Endpoint | Newly listed codes | Handled |\n|---|---|---|---|\n'+rows.map(r=>`| ${r.screen} | ${r.endpoint} | ${r.new_codes.join(', ')} | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |`).join('\n')+'\n');
// Preserve the original bundle shape expected by the secure terminal; prefer refreshed operations.
const endpoints=screens.flatMap(b=>b.endpoints||[]);const schema={};
for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json')&&n!=='endpoints.json')){const b=JSON.parse(fs.readFileSync(dir+name,'utf8'));Object.assign(schema,b.schemas||{});}
const byKey=new Map(endpoints.map(e=>[e.endpoint,e]));
for(const {key,contract:d}of refreshed){
 if(!d.access)throw Error('Unresolved endpoint '+key);
 const existing=byKey.get(key);
 if(existing){existing.errors=d.errors_detail||d.errors;existing.access=d.access;continue;}
 byKey.set(key,{endpoint:key,summary:d.summary,access:d.access,parameters:d.parameters,request_body:d.request_body?{required:true,content:{[d.request_content_type||'application/json']:{schema:d.request_body}}}:null,responses:d.response_schema?Object.fromEntries(['200','201'].map(status=>[status,{content:{'application/json':{schema:d.response_schema}}}])):{},errors:d.errors_detail||d.errors,write:d.write_semantics});
}
fs.writeFileSync('contracts/00-backend-refresh.json',JSON.stringify({contract_fingerprint:'14824af5c60c05148994',endpoints:[...byKey.values()],schemas:schema},null,2)+'\n');
console.log(JSON.stringify({refreshed_endpoints:refreshed.length,error_table_rows:rows.length,code_guidance:Object.keys(guidance).length}));

```
