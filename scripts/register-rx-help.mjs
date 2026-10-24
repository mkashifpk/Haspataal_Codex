// Updates the authored help inventory from the saved screen contract; no backend mutations.
import fs from 'node:fs';
const bundle=JSON.parse(fs.readFileSync('contracts/eprescription.json'));
const calls=bundle.endpoints.map(e=>e.endpoint);
const groups=['rx.cancel','rx.search','rx.stock','rx.save','rx.print','rx.handover'];
const catalogue=JSON.parse(fs.readFileSync('src/foundation-catalogue.json'));
catalogue.screens.eprescription={taskCalls:calls};
fs.writeFileSync('src/foundation-catalogue.json',JSON.stringify(catalogue,null,2)+'\n');
const map=JSON.parse(fs.readFileSync('src/foundation-task-map.json'));
map.eprescription=Object.fromEntries(calls.map((c,i)=>[c,groups[i]]));
fs.writeFileSync('src/foundation-task-map.json',JSON.stringify(map,null,2)+'\n');
let help=fs.readFileSync('src/foundation-help.ts','utf8');
help=help.replace('"clinical.context": g(["consultation"]','"clinical.context": g(["consultation","eprescription"]').replace('"clinical.recovery": g(["consultation"]','"clinical.recovery": g(["consultation","eprescription"]').replace('["consultation", "queue_management", "refund_waiver_credit", "cash_back_prompts"]','["eprescription", "consultation", "queue_management", "refund_waiver_credit", "cash_back_prompts"]');
fs.writeFileSync('src/foundation-help.ts',help);
let check=fs.readFileSync('scripts/check-help.mjs','utf8');check=check.replace('"src/screens/Consultation.tsx",','"src/screens/Consultation.tsx",\n    "src/screens/EPrescription.tsx",');fs.writeFileSync('scripts/check-help.mjs',check);
const test=fs.readFileSync('tests/help-coverage.test.mjs','utf8').replace('result.screens, 23','result.screens, 24');fs.writeFileSync('tests/help-coverage.test.mjs',test);
