import fs from 'node:fs';
const root='contracts/refresh-20261030/generated/';
for(const file of fs.readdirSync(root)){
 const dest='src/generated/'+file;
 if(!fs.existsSync(dest))continue;
 let source=fs.readFileSync(root+file,'utf8');
 source=source.replace('from "./api"','from "../bridge"');
 fs.writeFileSync(dest,source.trimEnd()+'\n');
}
