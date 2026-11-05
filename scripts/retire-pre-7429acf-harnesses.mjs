import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=process.cwd(),dest=path.resolve('docs/historical-dev-tests-pre-7429acf');
if(!dest.startsWith(root+path.sep))throw Error('Unsafe archive');
fs.mkdirSync(dest,{recursive:true});
const names=JSON.parse(fs.readFileSync(process.argv[2]??'docs/backend-refresh-2026-11-05/stale-harness-candidates.json')),manifest=fs.existsSync('docs/backend-refresh-2026-11-05/retired-harnesses.json')?JSON.parse(fs.readFileSync('docs/backend-refresh-2026-11-05/retired-harnesses.json')):[];
for(const name of names){
 const source=path.resolve('scripts',name),target=path.resolve(dest,name+'.md');
 if(!source.startsWith(path.resolve('scripts')+path.sep)||!target.startsWith(dest+path.sep))throw Error('Unsafe file path');
 if(!fs.existsSync(source)){if(manifest.some(m=>m.source==='scripts/'+name)&&fs.existsSync(target))continue;throw Error('Missing source without an archive: '+name);}
 if(fs.existsSync(target))throw Error('Archive already exists; reconcile before replacing: '+name);
 const c=fs.readFileSync(source,'utf8');
 manifest.push({source:'scripts/'+name,archive:path.relative(root,target).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(c).digest('hex'),reason:'Consumes a pre-7429acf record snapshot or journal; never replay against the fresh DEV database.'});
 fs.writeFileSync(target,'# Historical DEV test - retired after database reset\n\nThis source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.\n\n```javascript\n'+c+'\n```\n');fs.unlinkSync(source);
}
fs.writeFileSync('docs/backend-refresh-2026-11-05/retired-harnesses.json',JSON.stringify(manifest,null,2)+'\n');
console.log({archived:manifest.length});
