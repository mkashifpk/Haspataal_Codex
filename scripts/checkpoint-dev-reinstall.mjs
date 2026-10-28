// Local-only inventory; never calls DEV. Values are historical, never replay inputs.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files','docs/*.json'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const entries=[];
for(const file of files){
 const found=new Map();
 function add(field,value){if(value===null||value===undefined||typeof value==='object')return;const values=found.get(field)||new Set();values.add(value);found.set(field,values);}
 function walk(value){if(!value||typeof value!=='object')return;for(const[field,item]of Object.entries(value)){
  if(/^(id|patient_id|patient_ids|ticket_id|ticket_ids|admission_id|admission_ids|ward_id|ward_ids|bed_id|bed_ids|consent_id|document_id|wristband_id|er_id|encounter_id|order_id|order_ids|invoice_id|payment_id|roster_id|duty_id|approval_id|employee_id|staff_id|scenario_id|scenario|run|idempotency_key|Idempotency-Key|cursor|next_cursor|last_event_id|event_id|since_id|after_id)$/i.test(field))for(const v of Array.isArray(item)?item:[item])add(field,v);
  if((field==='path'||field==='url')&&typeof item==='string')for(const m of item.matchAll(/\/(patients|tickets|admissions|wards|beds|consents|documents|wristbands|orders|invoices|payments|rosters|encounters)\/(\d+)(?=[/?#]|$)/g))add('path:'+m[1],Number(m[2]));
  walk(item);
 }}
 try{walk(JSON.parse(fs.readFileSync(file,'utf8')));}catch(e){throw Error(file+': '+e.message);}
 if(found.size)entries.push({file,values:Object.fromEntries([...found].map(([k,v])=>[k,[...v].sort((a,b)=>String(a).localeCompare(String(b)))]))});
}
fs.writeFileSync('docs/dev-reinstall-invalidated-refs-2026-10-28.json',JSON.stringify({date:'2026-10-28',state:'Historical pre-reinstall references only. ALL business IDs, scenario IDs, idempotency keys and event cursors expire on reinstall. Never replay. Developer/account/implementation/progress identities are retained by the server; generic id values in proposal evidence are not business fixtures.',sources:entries},null,2)+'\n');
console.log('Saved historical reference inventory from '+entries.length+' tracked evidence files.');
