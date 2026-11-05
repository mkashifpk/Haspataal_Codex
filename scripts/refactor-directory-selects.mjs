import fs from 'node:fs';import {parse}from '@babel/parser';
const map={
 'em-onboard-supplier':['/finance/vendors?vendor_type=EquipmentSupplier','vendor_id'],
 'em-edit-supplier':['/finance/vendors?vendor_type=EquipmentSupplier','vendor_id'],
 'em-onboard-service-vendor':['/finance/vendors?vendor_type=Contractor','vendor_id'],
 'em-edit-service-vendor':['/finance/vendors?vendor_type=Contractor','vendor_id'],
 'em-onboard-plan-vendor':['/finance/vendors?vendor_type=Contractor','vendor_id'],
 'em-visit-vendor':['/finance/vendors?vendor_type=Contractor','vendor_id'],
 'em-visit-vendor-id':['/finance/vendors?vendor_type=Contractor','vendor_id'],
 'em-plan-vendor':['/finance/vendors?vendor_type=Contractor','vendor_id'],
 'onboarding_wizard.step2_supervisor':['/staff/lookup','employee_id',true],
 'onboarding_wizard.step2_department':['/admin/departments','department_id'],
};
const log=[];
for(const file of ['EquipmentMaintenance.tsx','OnboardingWizard.tsx']){
 let c=fs.readFileSync('src/screens/'+file,'utf8');const ast=parse(c,{sourceType:'module',plugins:['typescript','jsx']}),edits=[];
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='JSXElement'&&n.openingElement.name?.name==='select'){
 const a=n.openingElement,help=a.attributes.find(a=>a.name?.name==='data-help')?.value?.value,m=map[help];if(m){let s=c.slice(a.start,a.end).replace('<select','<DirectoryPicker').replace(/>$/,` path=${JSON.stringify(m[0])} idField=${JSON.stringify(m[1])}${m[2]?' search':''} />`);edits.push({start:n.start,end:n.end,text:s});log.push({file,help,path:m[0]});return;}}
 for(const[k,v]of Object.entries(n)){if(['loc','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}
 walk(ast);for(const e of edits.sort((a,b)=>b.start-a.start))c=c.slice(0,e.start)+e.text+c.slice(e.end);
 if(edits.length){if(!c.includes('import {DirectoryPicker}'))c='import {DirectoryPicker} from "../DirectoryPicker";\n'+c;fs.writeFileSync('src/screens/'+file,c);}
}
fs.writeFileSync('docs/backend-refresh-2026-11-05/replaced-selects.json',JSON.stringify(log,null,2));console.log(log);
