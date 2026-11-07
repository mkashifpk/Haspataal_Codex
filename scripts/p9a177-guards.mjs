import fs from'node:fs';let p='src/screens/IncidentScreening.tsx';let s=fs.readFileSync(p,'utf8');s=s.replace(/^ async function fresh\(\).*\r?\n/m,'').replaceAll('},fresh);','});');fs.writeFileSync(p,s);p='scripts/check-help.mjs';s=fs.readFileSync(p,'utf8').replace('      "IncidentRegister",','      "IncidentRegister",\n      "IncidentScreening",');fs.writeFileSync(p,s);

