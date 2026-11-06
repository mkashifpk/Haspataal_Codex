import fs from'node:fs';
const p='src/foundation-help.ts';let s=fs.readFileSync(p,'utf8');s=s.replaceAll('["complaint_statistics","complaint_statistics_owner"]','["complaint_statistics"]');fs.writeFileSync(p,s);
