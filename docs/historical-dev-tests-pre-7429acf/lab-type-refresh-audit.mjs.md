# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
const clean=x=>Array.isArray(x)?x.map(clean):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['loc','start','end','extra','leadingComments','trailingComments','innerComments','comments','tokens'].includes(k)).map(([k,v])=>[k,clean(v)])):x;
const nodes=s=>parse(s,{sourceType:'module',plugins:['typescript']}).program.body;
const report={baseline:'42dbbf8',screens:{}};
for(const screen of ['lab_bench','lab_only_walkin','lab_verification']){
 const file=`src/generated/${screen}.ts`;
 const before=nodes(execFileSync('git',['show',`42dbbf8:${file}`],{encoding:'utf8'})),after=nodes(fs.readFileSync(file,'utf8'));
 assert.equal(before.length,after.length);
 const changes=[];
 for(let i=0;i<before.length;i++){
   if(JSON.stringify(clean(before[i]))===JSON.stringify(clean(after[i])))continue;
   const a=before[i].declaration,b=after[i].declaration;
   assert.equal(a?.id?.name,'VerificationItemOut');assert.equal(b?.id?.name,'VerificationItemOut');
   const old=new Map(a.body.body.map(x=>[x.key.name,clean(x)])),now=new Map(b.body.body.map(x=>[x.key.name,clean(x)]));
   for(const [name,value] of old)assert.deepEqual(now.get(name),value);
   const added=[...now.keys()].filter(k=>!old.has(k));
   assert.deepEqual([...added].sort(),['requisition_id','requisition_number','patient_id','barcode','entered_by','due_at','is_overdue'].sort());
   changes.push({interface:'VerificationItemOut',added});
 }
 report.screens[screen]={structural_changes:changes,all_other_declarations_unchanged:true};
}
fs.writeFileSync('docs/lab-type-refresh-audit-2026-10-27.json',JSON.stringify(report,null,2));
console.log('PASS only VerificationItemOut adds the seven announced fields; every other declaration/function is structurally unchanged');

```
