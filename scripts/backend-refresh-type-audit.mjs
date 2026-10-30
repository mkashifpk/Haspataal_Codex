import fs from 'node:fs';
import {parse} from '@babel/parser';
import {execFileSync} from 'node:child_process';
const root='contracts/refresh-20261030/generated/';
const clean=x=>Array.isArray(x)?x.map(clean):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['loc','start','end','extra','leadingComments','trailingComments','innerComments','comments','tokens'].includes(k)).map(([k,v])=>[k,clean(v)])):x;
const nodes=s=>new Map(parse(s,{sourceType:'module',plugins:['typescript']}).program.body.filter(x=>x.type==='ExportNamedDeclaration').map(x=>[x.declaration?.id?.name,clean(x.declaration)]));
const report={baseline:'758bd34',modules:{}};
for(const file of fs.readdirSync(root)){
 const dest='src/generated/'+file;if(!fs.existsSync(dest))continue;
 const before=nodes(execFileSync('git',['show','758bd34:'+dest],{encoding:'utf8',maxBuffer:5e6})),after=nodes(fs.readFileSync(root+file,'utf8'));
 const changes={added:[...after.keys()].filter(k=>!before.has(k)),removed:[...before.keys()].filter(k=>!after.has(k)),changed:[...after.keys()].filter(k=>before.has(k)&&JSON.stringify(before.get(k))!==JSON.stringify(after.get(k)))};
 report.modules[file]=changes;
 for(const key of changes.changed){const a=before.get(key),b=after.get(key);if(a.type==='TSInterfaceDeclaration'&&b.type===a.type){changes.fields??={};changes.fields[key]={before:a.body.body,after:b.body.body};}}
}
fs.writeFileSync('docs/backend-refresh-2026-10-30/type-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.modules).filter(([,v])=>v.added.length||v.removed.length||v.changed.length).map(([k,{fields,...v}])=>[k,v])),null,2));
