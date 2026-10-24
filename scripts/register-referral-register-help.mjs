import fs from 'node:fs';
const bundle=JSON.parse(fs.readFileSync('contracts/referral_register.json'));
const catalogueFile='src/foundation-catalogue.json',catalogue=JSON.parse(fs.readFileSync(catalogueFile));catalogue.screens.referral_register={taskCalls:bundle.endpoints.map(e=>e.endpoint)};fs.writeFileSync(catalogueFile,JSON.stringify(catalogue,null,2)+'\n');
const mapFile='src/foundation-task-map.json',map=JSON.parse(fs.readFileSync(mapFile));map.referral_register={'GET /referrals':'register.filters','GET /referrals/{referral_id}':'register.open','GET /referrals/{referral_id}/pdf':'referral.print'};fs.writeFileSync(mapFile,JSON.stringify(map,null,2)+'\n');
const file='src/foundation-help.ts';let help=fs.readFileSync(file,'utf8');for(const key of ['referral.record','referral.print'])help=help.replace(`"${key}": g(["external_referral"]`,`"${key}": g(["external_referral","referral_register"]`);fs.writeFileSync(file,help);
const component='src/screens/ReferralRegister.tsx';fs.writeFileSync(component,fs.readFileSync(component,'utf8').replace('className="table-scroll"','className="table-wrap"'));
