import fs from 'node:fs';
import {parse} from '@babel/parser';
const dir='contracts/refresh-20261105/';
const bundles=fs.readdirSync(dir).filter(n=>!n.includes('-')&&n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(dir+n,'utf8'))).filter(b=>b.screen_id);
const changes=[];
const normalized=code=>JSON.stringify(parse(code,{sourceType:'module',plugins:['typescript']}), (k,v)=>['start','end','loc','extra','comments','leadingComments','trailingComments','innerComments','tokens'].includes(k)?undefined:v);
for(const b of bundles){
 const file='src/generated/'+b.screen_id+'.ts';
 if(!fs.existsSync(file))continue;
 const g=JSON.parse(fs.readFileSync(dir+b.screen_id+'-types.json','utf8'));
 if(!g.code)throw Error(JSON.stringify(g));
 const old=fs.readFileSync(file,'utf8');
 changes.push({screen:b.screen_id,structural:normalized(old)!==normalized(g.code)});
 fs.writeFileSync(file,g.code+'\n');
 // The Electron bridge reads root bundles; replace existing screen contract there too.
 fs.writeFileSync('contracts/'+b.screen_id+'.json',JSON.stringify(b,null,2)+'\n');
}
const byKey=new Map(),schemas={};
for(const b of bundles){for(const e of b.endpoints||[])byKey.set(e.endpoint,e);Object.assign(schemas,b.schemas);}
// First matching operation wins in the native bridge. Refresh all root copies, including the old aggregate.
for(const file of fs.readdirSync('contracts').filter(n=>n.endsWith('.json'))){
 const path='contracts/'+file,b=JSON.parse(fs.readFileSync(path,'utf8'));let updated=false;
 if(Array.isArray(b.endpoints)){b.endpoints=b.endpoints.map(e=>{const fresh=byKey.get(e.endpoint);if(fresh){updated=true;return fresh;}return e;});}
 if(b.schemas){for(const key of Object.keys(b.schemas))if(schemas[key]){b.schemas[key]=schemas[key];updated=true;}}
 if(updated)fs.writeFileSync(path,JSON.stringify(b,null,2)+'\n');
}
fs.writeFileSync('contracts/00-refresh-20261105.json',JSON.stringify({contract_fingerprint:bundles[0].contract_fingerprint,endpoints:[...byKey.values()],schemas},null,2)+'\n');
fs.writeFileSync('docs/backend-refresh-2026-11-05/types-comparison.json',JSON.stringify(changes,null,2)+'\n');
console.log(JSON.stringify({screens:bundles.length,structural:changes.filter(x=>x.structural),operations:byKey.size}));
