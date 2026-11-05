// Reuse the MCP-generated declarations verbatim for shared endpoint clients.
import fs from 'node:fs';import{parse}from'@babel/parser';
const clean=n=>JSON.stringify(n,(k,v)=>['start','end','loc','extra','leadingComments','trailingComments','innerComments','comments'].includes(k)?undefined:v);
const canonical=new Map(),dir='contracts/refresh-20261105/';
for(const f of fs.readdirSync(dir).filter(n=>n.endsWith('-types.json'))){const g=JSON.parse(fs.readFileSync(dir+f));if(!g.code||g.kind==='errors')continue;for(const n of parse(g.code,{sourceType:'module',plugins:['typescript']}).program.body)if(n.type==='ExportNamedDeclaration'&&n.declaration?.type==='TSInterfaceDeclaration')canonical.set(n.declaration.id.name,{node:n,code:g.code.slice(n.start,n.end)});}
const fields=n=>Object.fromEntries(n.declaration.body.body.map(p=>[p.key.name,clean({optional:!!p.optional,type:p.typeAnnotation})]));
const changed=[],unexpected=[];
for(const f of fs.readdirSync('src/generated').filter(n=>n.endsWith('.ts')&&!['api.ts','errors.ts'].includes(n))){const path='src/generated/'+f,c=fs.readFileSync(path,'utf8'),ast=parse(c,{sourceType:'module',plugins:['typescript']}),edits=[];
 for(const n of ast.program.body){if(n.type!=='ExportNamedDeclaration'||n.declaration?.type!=='TSInterfaceDeclaration')continue;const name=n.declaration.id.name,fresh=canonical.get(name);if(!fresh)continue;const a=fields(n),b=fields(fresh.node),delta=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>a[k]!==b[k]);const allowed=delta.every(k=>name==='StaffLookupOut'&&k==='user_id'||name==='WasteRecordOut'&&['handed_over_on','handed_over_by_name'].includes(k));if(delta.length&&!allowed){unexpected.push({file:f,model:name,fields:delta});continue;}if(c.slice(n.start,n.end)!==fresh.code){edits.push({start:n.start,end:n.end,text:fresh.code});changed.push({file:f,model:name,structuralFields:delta});}}
 let result=c;for(const e of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,e.start)+e.text+result.slice(e.end);
 const operations=JSON.parse(fs.readFileSync('contracts/00-refresh-20261105.json')).endpoints;
 result=result.replace(/\/\*\*([^\n]*?GET \/api\/v1\/([^\n]*?) \(who may call: )[^\n]*?\)\. \*\//g,(whole,prefix,route)=>{const op=operations.find(e=>e.endpoint==='GET /'+route);return op?`/**${prefix}${op.access.who}). */`:whole;});
 if(result!==c)fs.writeFileSync(path,result);
}
fs.writeFileSync('docs/backend-refresh-2026-11-05/shared-type-refresh.json',JSON.stringify({changed,unexpected},null,2)+'\n');console.log({updatedDeclarations:changed.length,unexpected});
