# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {parse} from '@babel/parser';
const clean=x=>Array.isArray(x)?x.map(clean):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['loc','start','end','extra','leadingComments','trailingComments','innerComments','comments','tokens'].includes(k)).map(([k,v])=>[k,clean(v)])):x;
const declarations=s=>new Map(parse(s,{sourceType:'module',plugins:['typescript']}).program.body.filter(x=>x.type==='ExportNamedDeclaration').map(x=>[x.declaration?.id?.name,clean(x.declaration)]));
const report={baseline:'558a013',screens:{}};
for(const name of ['bed_matrix','pending_admissions','consents_admissions','it_console']){
 const file='src/generated/'+name+'.ts',before=declarations(execFileSync('git',['show','558a013:'+file],{encoding:'utf8'})),after=declarations(fs.readFileSync(file,'utf8'));
 report.screens[name]={added:[...after.keys()].filter(x=>!before.has(x)),removed:[...before.keys()].filter(x=>!after.has(x)),changed:[...before.keys()].filter(x=>after.has(x)&&JSON.stringify(before.get(x))!==JSON.stringify(after.get(x)))};
}
const codes=s=>new Set([...s.matchAll(/\|\s*"([A-Z0-9_]+)"/g)].map(x=>x[1]));
const oldCodes=codes(execFileSync('git',['show','558a013:src/generated/errors.ts'],{encoding:'utf8'})),newCodes=codes(fs.readFileSync('src/generated/errors.ts','utf8'));
report.errors={added:[...newCodes].filter(x=>!oldCodes.has(x)),removed:[...oldCodes].filter(x=>!newCodes.has(x))};
fs.writeFileSync('docs/backend-evening-type-audit-2026-10-28.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

```
