import fs from 'node:fs';
import {parse} from '@babel/parser';
const staff=['/staff/lookup','employee_id',true],patient=['/patients/search','patient_id',true],drug=['/drugs/search','drug_id',true],ward=['/beds/matrix?include_beds=false','ward_id',false,'wards'];
const mappings={
 'attendance.modal_punch_emp':staff,'attendance.shift_modal_emp':staff,'attendance.shift_modal_pattern_id':['/hr/shift-patterns','shift_pattern_id'],
 'billing_admin.contract_employee_filter':staff,'billing_admin.policy_user_id_input':['/staff/lookup','user_id',true,null,true],
 'code_red.input_patient_id':patient,'code_red.input_ot_id':['/ot/theaters','ot_id'],'code_red.input_mlc_type':['/mlc/case-types','case_type_id'],
 'consents_anaesthesia.select_second_doctor':['/staff/lookup?license_type=PMDC','employee_id',true],
 'death_record.input_patient_id':patient,'drug_recalls.lookup_drug_id_input':drug,
 'er_board.arrival_patient_id_input':patient,
 'lab_admin.input_batch_vendor_invoice':['/pharmacy-admin/vendor-invoices?module=Lab','vendor_invoice_id'],
 'mlc_cases.input_patient_id':patient,
 'onboarding_wizard.load_emp_id':staff,
 'ops_console.input_assign_emp_id':staff,'ops_console.input_assign_vendor_id':['/finance/vendors?vendor_type=Contractor','vendor_id'],
 'ops_console.input_util_vendor':['/finance/vendors?vendor_type=UtilityProvider','vendor_id'],
 'ops_console.input_clean_emp_id':staff,
 'ot_scheduling.patient_id_input':patient,'ot_settlement.contracts_filter':staff,
 'pharmacy_admin.batch_drug_id_input':drug,'pharmacy_admin.return_recall_id_input':['/drug-recalls','recall_id'],
 'pharmacy_storage_log.ward_id_input':ward,
};
const log=[];
for(const file of fs.readdirSync('src/screens').filter(f=>f.endsWith('.tsx'))){
 let code=fs.readFileSync('src/screens/'+file,'utf8');const ast=parse(code,{sourceType:'module',plugins:['typescript','jsx']});const replacements=[];
 function walk(n){if(!n||typeof n!=='object')return;
  if(n.type==='JSXOpeningElement'&&n.name?.name==='input'){
   const help=n.attributes.find(a=>a.name?.name==='data-help')?.value?.value,m=mappings[help];
   if(m){const [path,idField,search,list,userId]=m;
    let text=code.slice(n.start,n.end).replace('<input','<DirectoryPicker').replace(/\s+(type|placeholder|min|max|inputMode)=("[^"]*"|'[^']*')/g,'');
    text=text.replace(/\/>$/,` path=${JSON.stringify(path)} idField=${JSON.stringify(idField)}${search?' search':''}${list?' list='+JSON.stringify(list):''}${userId?' userId':''} />`);
    replacements.push({start:n.start,end:n.end,text});log.push({file,help,path,idField});
   }
  }
  for(const [k,v]of Object.entries(n)){if(['loc','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
 }walk(ast);
 if(replacements.length){for(const r of replacements.sort((a,b)=>b.start-a.start))code=code.slice(0,r.start)+r.text+code.slice(r.end);code='import {DirectoryPicker} from "../DirectoryPicker";\n'+code;fs.writeFileSync('src/screens/'+file,code);}
}
fs.writeFileSync('docs/backend-refresh-2026-11-05/replaced-controls.json',JSON.stringify(log,null,2)+'\n');console.log(log);
