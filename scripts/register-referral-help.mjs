import fs from 'node:fs';
const bundle=JSON.parse(fs.readFileSync('contracts/external_referral.json'));
const groups=['referral.issue','referral.record','referral.ack','referral.cancel','referral.print','referral.destination'];
for(const file of ['src/foundation-catalogue.json','src/foundation-task-map.json']){
 const value=JSON.parse(fs.readFileSync(file));
 if(file.includes('catalogue'))value.screens.external_referral={taskCalls:bundle.endpoints.map(e=>e.endpoint)};
 else value.external_referral=Object.fromEntries(bundle.endpoints.map((e,i)=>[e.endpoint,groups[i]]));
 fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
}
const file='src/foundation-help.ts';let h=fs.readFileSync(file,'utf8');
h=h.replaceAll('["consultation","eprescription","lab_orders_results"]','["consultation","eprescription","lab_orders_results","external_referral"]').replace('["lab_orders_results", "eprescription", "consultation", "queue_management"','["external_referral", "lab_orders_results", "eprescription", "consultation", "queue_management"');
fs.writeFileSync(file,h);
