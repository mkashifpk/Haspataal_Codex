import fs from 'node:fs';import {parse}from '@babel/parser';
const file='src/foundation-help.ts',original=fs.readFileSync(file,'utf8').replace(/^"directory\.[^\n]+\n/gm,''),ast=parse(original,{sourceType:'module',plugins:['typescript']});
const obj=ast.program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.declarations?.[0]?.id.name==='controlGuides').declaration.declarations[0].init;
const map=JSON.parse(fs.readFileSync('src/foundation-task-map.json')),dirs=JSON.parse(fs.readFileSync('docs/backend-refresh-2026-11-05/directory-field-map.json')),append=new Map();
for(const [id,values]of Object.entries(map)){
 const entries=Object.entries(values).filter(([,v])=>v.startsWith('directory.'));if(!entries.length)continue;
 const guide=Object.values(values).find(v=>!v.startsWith('directory.')&&obj.properties.some(p=>(p.key?.name??p.key?.value)===v));if(!guide)throw Error('No control for '+id);
 for(const [call]of entries)values[call]=guide;
 const a=append.get(guide)??[new Set(),new Set()];dirs[id]?.body.forEach((text,i)=>a[i].add(text));append.set(guide,a);
}
const edits=[];for(const [key,values]of append){const p=obj.properties.find(p=>(p.key?.name??p.key?.value)===key),body=p.value.arguments?.[2];if(body?.type!=='ArrayExpression'||body.elements.length!==2)throw Error('Unexpected guide '+key);
 edits.push({start:body.start,end:body.end,text:JSON.stringify(body.elements.map((n,i)=>n.value+' '+[...values[i]].join(' ')))});
}
let code=original;for(const e of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,e.start)+e.text+code.slice(e.end);
fs.writeFileSync(file,code);fs.writeFileSync('src/foundation-task-map.json',JSON.stringify(map,null,2)+'\n');console.log({updatedControlGuides:append.size});
