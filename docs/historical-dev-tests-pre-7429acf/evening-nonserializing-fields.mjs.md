# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Keep existing form serialization byte-for-byte: new error markers must not be names.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {parse} from '@babel/parser';
const clean=x=>Array.isArray(x)?x.map(clean):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['loc','start','end','extra','leadingComments','trailingComments','innerComments'].includes(k)).map(([k,v])=>[k,clean(v)])):x;
function nodes(s){const out=[];function walk(x){if(!x||typeof x!=='object')return;if(x.type==='JSXOpeningElement'&&['input','select','textarea'].includes(x.name.name))out.push(x);for(const[k,v]of Object.entries(x))if(!['loc','start','end','extra'].includes(k)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(parse(s,{sourceType:'module',plugins:['typescript','jsx']}));return out;}
const key=n=>JSON.stringify([n.name.name,...['value','checked','data-help','aria-label'].map(k=>clean(n.attributes.find(x=>x.type==='JSXAttribute'&&x.name.name===k)?.value))]);
const report=[];
function write(file,value){for(let n=0;;n++){try{fs.writeFileSync(file,value);return;}catch(e){if(n>=7||!['UNKNOWN','EBUSY','EPERM'].includes(e.code))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);}}}
for(const file of fs.readdirSync('src/screens').filter(x=>x.endsWith('.tsx')).map(x=>'src/screens/'+x)){
 let baseline;try{baseline=execFileSync('git',['show','558a013:'+file],{encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{continue;}
 let s=fs.readFileSync(file,'utf8');const old=new Map();for(const n of nodes(baseline)){const k=key(n),list=old.get(k)||[];list.push(n.attributes.find(x=>x.type==='JSXAttribute'&&x.name.name==='name'));old.set(k,list);}
 const edits=[];for(const n of nodes(s)){const previous=old.get(key(n));if(!previous?.length)continue;const was=previous.shift(),now=n.attributes.find(x=>x.type==='JSXAttribute'&&x.name.name==='name');if(!was&&now)edits.push({a:now.name.start,b:now.name.end});}
 for(const e of edits.sort((a,b)=>b.a-a.a))s=s.slice(0,e.a)+'data-field'+s.slice(e.b);if(edits.length)write(file,s);const count=nodes(s).filter(n=>n.attributes.some(a=>a.type==='JSXAttribute'&&a.name.name==='data-field')).length;if(count)report.push({file,nonserializing_field_markers:count});
}
fs.writeFileSync('docs/backend-evening-nonserializing-fields-2026-10-28.json',JSON.stringify(report,null,2)+'\n');console.log('Converted '+report.reduce((n,x)=>n+x.nonserializing_field_markers,0)+' new names to nonserializing data-field markers; original names preserved.');

```
