// Execute only actual object initializers, in isolation with synthetic form values.
// No API calls, records, sessions or credentials are created. Sentinel IDs are
// model-test inputs only and must NEVER be sent in a DEV business request.
import fs from 'node:fs';import {parse} from '@babel/parser';import {createRequire,stripTypeScriptTypes} from 'node:module';
const cases=[];
function body(method,path,file,keys,variables,exact=false){const source=fs.readFileSync(file,'utf8'),found=[];function walk(n){if(!n||typeof n!=='object')return;if(n.type==='ObjectExpression'){const names=n.properties.filter(p=>p.type==='ObjectProperty').map(p=>p.key.name||p.key.value);if(keys.every(k=>names.includes(k))&&(!exact||names.length===keys.length))found.push(n);}for(const[k,v]of Object.entries(n))if(!['loc','start','end','extra'].includes(k)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(parse(source,{sourceType:'unambiguous',plugins:['typescript','jsx']}));if(!found.length)throw Error('No builder '+path);const node=found[0],expression=source.slice(node.start,node.end),out={};const code=stripTypeScriptTypes('function build('+Object.keys(variables).map(k=>k+':any').join(',')+'){return ('+expression+');}');out.default=new Function(code+';return build;')();const value=out.default(...Object.values(variables));cases.push({method,path,body:value,source:file+':'+node.loc.start.line,initializer:expression,verification:'Actual source object initializer with synthetic form values; model validation only, no HTTP'});return value;}
const reason='DEMO source payload model check only';
body('POST','/auth/refresh','electron/main.cjs',['refresh_token'],{auth:{refresh:'DEMO-STRUCTURE-ONLY-NOT-A-TOKEN'}},true);
body('POST','/auth/logout','electron/main.cjs',['all_sessions'],{args:{all:false}},true);
const pwd={current_password:'Demo-Model-Only-2026!',new_password:'Demo-Next-Model-Only-2026!'};
body('POST','/auth/change-password','electron/main.cjs',['current_password','new_password'],{args:pwd},true);
body('POST','/settings/me/change-password','electron/main.cjs',['current_password','new_password'],{args:pwd},true);
body('POST','/auth/login','src/screens/Login.tsx',['username','password'],{data:new Map([['username','DEMO-MODEL-ONLY'],['password','Demo-Model-Only-2026!']])},true);
body('PATCH','/clinical-encounters/{encounter_id}','src/screens/Consultation.tsx',['expected_version','chief_complaint','icd_codes'],{base:{row_version:1},body:{chief_complaint:reason,history:reason,examination:null,diagnosis:reason,clinical_note:reason,plan:reason,icd_codes:[],examination_consent:'Declined',vitals:{}},procedureDirty:false});
body('POST','/clinical-encounters/{encounter_id}/correction','src/screens/Consultation.tsx',['field','correction_text','correction_reason'],{correctionField:'general',correctionText:reason,reason},true);
body('POST','/prescriptions/{prescription_id}/handover','src/screens/EPrescription.tsx',['handed_to','attendant_name','copy_kept','document_id'],{handed:'Patient',attendant:'',copy:'Electronic',documentId:''},true);
body('POST','/referrals/{referral_id}/acknowledge','src/referral-record.tsx',['acknowledged_by_name','acknowledged_at','note'],{recipient:'DEMO recipient',when:'',timeZone:'Asia/Karachi',note:reason},true);
const snapshot=body('POST','/establishment/changes/preview','src/screens/Facility.tsx',['reason','capabilities'],{reason,moves:{inpatient:'Active'},editing:false,profile:{}},true);
body('POST','/establishment/changes','src/screens/Facility.tsx',['expected_revision','acknowledged'],{snapshot,preview:{revision:1},acks:[]},true);
body('POST','/lab/items/{item_id}/rerun','src/screens/LabBench.tsx',['reason'],{reason},true);
body('POST','/lab/items/{item_id}/corrections','src/screens/LabBench.tsx',['corrects_result_id','reason'],{body:{metrics:{"2147483647":1}},target:{result_id:2147483647},reason},true);
body('POST','/opd-tickets/{ticket_id}/defer','src/screens/QueueManagement.tsx',['reason'],{reason},true);
body('POST','/opd-tickets/{ticket_id}/cancel','src/screens/QueueManagement.tsx',['reason'],{reason},true);
body('POST','/incidents','src/screens/Incidents.tsx',['type_code','affected','occurred_at','reporter_confidential'],{d:new Map([['description',reason],['immediate_action',reason],['location','DEMO model only']]),ids:{},type:'DEMO_MODEL_ONLY',affected:'None',occurred:'2026-10-28T00:00:00Z'},false);
const value={theme:'Light',language:'en',ui_scale_pct:100,pdf_download:'Separate',extra:{},updated_at:null};cases.push({method:'PUT',path:'/settings/me',body:createRequire(import.meta.url)('../electron/preference-body.cjs').preferenceBody(value),source:'electron/preference-body.cjs',verification:'Actual preferenceBody helper, synthetic model input, no HTTP'});
// Dummy model strings are not usable credentials; still keep even those out of evidence.
for(const item of cases)for(const key of ['password','current_password','new_password','refresh_token'])if(item.body?.[key])item.body[key]='[SYNTHETIC-MODEL-VALUE-NOT-A-CREDENTIAL]';
fs.writeFileSync('docs/backend-evening-builder-payloads-2026-10-28.json',JSON.stringify(cases,null,2)+'\n');console.log('Captured '+cases.length+' production object initializers/helpers without backend calls.');
