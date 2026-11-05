import fs from 'node:fs';import {parse}from '@babel/parser';
const read=p=>fs.readFileSync(p,'utf8'),write=(p,v)=>fs.writeFileSync(p,v);
const root='contracts/refresh-20261105/';
const bundles=fs.readdirSync(root).filter(f=>!f.includes('-')&&f.endsWith('.json')).map(f=>JSON.parse(read(root+f))).filter(b=>b.screen_id);
const sourceNames={
 '/admin/departments':['Departments (active only); IT adds missing departments','فعال شعبے؛ آئی ٹی غائب شعبہ درج کرتا ہے'],
 '/beds/matrix':['Wards; IT adds missing wards. Bed selection loads the beds too','وارڈ؛ آئی ٹی غائب وارڈ درج کرتا ہے۔ بستر چننے پر بستروں کی فہرست بھی کھلتی ہے'],
 '/staff/lookup':['Staff search: type at least two letters. Doctors use the PMDC list. A staff choice uses its employee link; a user choice offers only staff with a login. Type more of the name if none match; HR adds staff and IT provides logins','عملہ: کم از کم دو حروف سے تلاش کریں۔ ڈاکٹر پی ایم ڈی سی فہرست سے چنیں۔ عملے کے لیے ملازم اور صارف کے لیے لاگ ان والا فرد چنیں۔ نہ ملے تو مزید نام؛ عملہ ایچ آر اور لاگ ان آئی ٹی دیتا ہے'],
 '/patients/search':['Patient search by name; Reception registers a missing patient first','مریض کا نام تلاش کریں؛ استقبالیہ غائب مریض پہلے درج کرتا ہے'],
 '/drugs/search':['Medicine search by name; Pharmacy adds a missing medicine to the formulary','دوا نام سے تلاش کریں؛ فارمیسی غائب دوا فہرست میں درج کرتی ہے'],
 '/finance/vendors':['Active suppliers or contractors by name. Finance adds a missing vendor. Equipment suppliers, contractors and utility providers use their own filtered lists','فعال فراہم کنندہ یا ٹھیکیدار نام سے چنیں۔ مالیات غائب فراہم کنندہ درج کرتا ہے۔ آلات، ٹھیکیدار اور یوٹیلیٹی کی متعلقہ الگ فہرستیں ہیں'],
 '/finance/panels':['Panels by name','پینل نام سے'],
 '/finance/service-catalog':['Services by name, filtered to the required Imaging, OT or RoomCharge category','خدمت نام سے؛ مطلوبہ عکس نگاری، تھیٹر یا کمرے کے نرخ کی قسم سے'],
 '/admissions':['Current admitted stays by patient name','داخل مریضوں کے موجودہ قیام نام سے'],
 '/ot/bookings':['Operations by patient and procedure name, only with lookup permission','مریض اور عمل کے نام سے آپریشن؛ صرف مجاز فہرست'],
 '/deaths':['Death register by patient name, only with lookup permission','مریض نام سے وفات رجسٹر؛ صرف مجاز فہرست'],
 '/facility/equipment':['Equipment by name; Maintenance adds a missing asset','آلات نام سے؛ دیکھ بھال شعبہ غائب اثاثہ درج کرتا ہے'],
 '/ops/assets':['Assets by name; Maintenance adds a missing asset. A hidden purchase date or cost is absent, never zero','اثاثے نام سے؛ دیکھ بھال شعبہ غائب اثاثہ درج کرتا ہے۔ پوشیدہ خرید تاریخ یا قیمت غائب ہے، صفر نہیں'],
 '/ot/theaters':['Theatres by name; ask Maintenance when one is missing','تھیٹر نام سے؛ غائب ہو تو دیکھ بھال شعبے سے پوچھیں'],
 '/ops/work-orders':['Work orders by description for the breakdown being repaired','مرمت ہونے والی خرابی کا کام تفصیل سے'],
 '/lab/reagents/':['Choose the reagent, then its batches in expiry order; expired batches are marked. No stock: ask the lab administrator','ری ایجنٹ چن کر میعاد کی ترتیب میں بیچ چنیں؛ ختم شدہ نشان زد ہے۔ اسٹاک نہ ہو تو لیب ایڈمن سے پوچھیں'],
 '/pharmacy-admin/vendor-invoices':['Supplier invoices, filtered to Lab for reagent intake','فراہم کنندہ رسیدیں؛ ری ایجنٹ وصولی میں صرف لیب'],
 '/diagnostic-partners':['Active diagnostic partners offering the required service','مطلوبہ خدمت دینے والے فعال تشخیصی شراکت دار'],
 '/mlc/contacts':['Police station or referral destination by name','پولیس اسٹیشن یا حوالہ کی منزل نام سے'],
 '/mlc/case-types':['Medico-legal case types by name','میڈیکو لیگل کیس کی قسم نام سے'],
 '/opd-queues/reception-dashboard':['Reception visits by patient name','استقبالیہ پر مریض نام سے پرچیاں'],
 '/hr/shift-patterns':['Fixed shift patterns by name','مقررہ شفٹ کے اوقات نام سے'],
 '/ot/clinical-worklist':['Clinical operations worklist by patient and procedure','مریض اور عمل سے طبی آپریشن فہرست'],
 '/ipd/my-beds':['Your rostered ward beds and admitted patients','آپ کی ڈیوٹی کے وارڈ بستر اور داخل مریض'],
 '/admin/users':['User directory by name for the role change','کردار بدلنے کے لیے صارف نام سے'],
 '/patients/':['Upload the patient scan first, then attach that confirmed document. Upload or print failure never repeats the main record','پہلے مریض کا اسکین اپ لوڈ، پھر تصدیق شدہ دستاویز منسلک کریں۔ اپ لوڈ یا پرنٹ ناکامی اصل اندراج نہیں دہراتی'],
 '/consents':['This patient’s consents by type and status','اسی مریض کی رضامندی قسم اور حالت سے'],
 '/drug-recalls':['Drug recalls by medicine and notice','دوا اور نوٹس سے واپسی'],
 '/critical-imaging-findings':['Critical imaging findings by patient and examination','مریض اور معائنے سے اہم عکس نگاری نتیجہ'],
 '/prescriptions/':['Open the selected prescription and choose its actual remaining lines; never type a line reference or dispense a guessed item','منتخب نسخہ کھول کر اسی کی باقی سطور چنیں؛ سطر کا نمبر یا فرضی دوا نہ لکھیں'],
};
const catalogue=JSON.parse(read('src/foundation-catalogue.json')),tasks=JSON.parse(read('src/foundation-task-map.json')),directoryHelp={};
let code=read('src/help.ts');
const oldMap=fs.existsSync('docs/backend-refresh-2026-11-05/directory-field-map.json')?JSON.parse(read('docs/backend-refresh-2026-11-05/directory-field-map.json')):{};
for(const value of Object.values(oldMap))for(const text of [...value.fields.flatMap(f=>[f.en,f.ur]),JSON.stringify(['How do I find a record, and who adds it if missing?',value.body[0]]),JSON.stringify(['ریکارڈ کیسے ملے اور غائب ہو تو کون درج کرے؟',value.body[1]])]){
 const token=text.startsWith('[')?text:JSON.stringify(text);code=code.replace(new RegExp(',\\s*'+token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'');
}
let ast=parse(code,{sourceType:'module',plugins:['typescript']}),edits=[],guides=[];
const obj=ast.program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.declarations?.[0]?.id.name==='help').declaration.declarations[0].init;
for(const b of bundles){
 const id=b.screen_id,page=obj.properties.find(p=>(p.key.name??p.key.value)===id);if(!page)continue;
 const fields=[];for(const e of b.endpoints.filter(e=>!e.endpoint.startsWith('GET '))){
  const model=e.request_body?.content?.['application/json']?.schema??e.request_body;
  const resolved=model?.$ref?b.schemas?.[model.$ref.split('/').at(-1)]:model;
  for(const [field,v]of Object.entries(resolved?.properties??{})){
   const description=v.description??'';if(!description.includes('GET /')&&!description.includes('POST /patients/'))continue;
   const entry=Object.entries(sourceNames).find(([path])=>description.includes(path));if(!entry)continue;
   const label=(v.title??field).replace(/ Id$/,'').replaceAll('_',' '),key=field+':'+entry[0];
   if(!fields.some(f=>f.key===key))fields.push({key,field,label,path:entry[0],en:`${label}: ${entry[1][0]}.`,ur:`${label}: ${entry[1][1]}۔`});
  }
 }
 for(const e of b.endpoints.filter(e=>e.endpoint.startsWith('GET ')&&(!tasks[id]?.[e.endpoint]||tasks[id][e.endpoint].startsWith('directory.')))){
  const entry=Object.entries(sourceNames).find(([path])=>e.endpoint.slice(4).startsWith(path));
  if(entry&&!fields.some(f=>f.path===entry[0]))fields.push({key:e.endpoint,field:null,label:e.summary,path:entry[0],en:entry[1][0]+'.',ur:entry[1][1]+'۔'});
 }
 const en=fields.map(f=>f.en),ur=fields.map(f=>f.ur);
 if(en.length){
  const body=[en.join(' '),ur.join(' ')];directoryHelp[id]={fields,body};
  const title=['Find records by name','ریکارڈ نام سے چنیں'];const guide='directory.'+id;
  for(const e of b.endpoints){if(!tasks[id]?.[e.endpoint]){(tasks[id]??={})[e.endpoint]=e.endpoint==='POST /infection/waste/handover'?'wl.handover':guide;}}
  if(Object.values(tasks[id]||{}).includes(guide))guides.push(`${JSON.stringify(guide)}: g([${JSON.stringify(id)}],${JSON.stringify(title)},${JSON.stringify(body)}),`);
  for(const [name,values]of [['steps',en],['stepsUr',ur]]){const n=page.value.properties?.find(p=>p.key.name===name)?.value;if(n)edits.push({start:n.end-1,end:n.end-1,text:',\n'+values.map(v=>JSON.stringify(v)).join(',\n')});}
  for(const [name,question,answer]of [['faq','How do I find a record, and who adds it if missing?',body[0]],['faqUr','ریکارڈ کیسے ملے اور غائب ہو تو کون درج کرے؟',body[1]]]){const n=page.value.properties?.find(p=>p.key.name===name)?.value;if(n)edits.push({start:n.end-1,end:n.end-1,text:',\n'+JSON.stringify([question,answer])});}
 }
 if(catalogue.screens[id])catalogue.screens[id].taskCalls=b.endpoints.map(e=>e.endpoint);
}
for(const e of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,e.start)+e.text+code.slice(e.end);write('src/help.ts',code.replace(/,\s*\n\s*,/g,','));
let foundation=read('src/foundation-help.ts').replace(/^"directory\.[^\n]+\n/gm,'');const marker='export const controlGuides: Record<string, ControlGuide> = {';foundation=foundation.replace(marker,marker+'\n'+guides.join('\n'));write('src/foundation-help.ts',foundation);
catalogue.fingerprint=bundles[0].contract_fingerprint;catalogue.revision=bundles[0].knowledge_revision;
write('src/foundation-catalogue.json',JSON.stringify(catalogue,null,2)+'\n');write('src/foundation-task-map.json',JSON.stringify(tasks,null,2)+'\n');write('docs/backend-refresh-2026-11-05/directory-field-map.json',JSON.stringify(directoryHelp,null,2)+'\n');
console.log({screenGuides:guides.length,translatedFields:Object.values(directoryHelp).reduce((n,v)=>n+v.fields.length,0)});
