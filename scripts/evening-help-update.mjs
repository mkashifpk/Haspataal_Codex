import fs from 'node:fs';
let p='src/foundation-help.ts',s=fs.readFileSync(p,'utf8');
s=s.replace(/^.*"consents.policy": g\(.*$/m,'"consents.policy": g(["consents_admissions"],["Who may decide","فیصلہ کون کر سکتا ہے"],["Use only this consent’s who_decides: Patient is offered only when patient_may_sign is true. Ask the listed decision makers in their supplied order; read each description. Do not classify age or add a relationship. For an emergency note, select a different registered PMDC doctor when this consent requires one. CONSENT_SIGNER_INVALID keeps your draft; read and correct the actual refusal.","صرف اسی رضامندی کی who_decides رہنمائی لیں۔ مریض کا انتخاب صرف patient_may_sign درست ہونے پر۔ موصولہ ترتیب میں نمائندے پوچھیں اور وضاحت پڑھیں؛ عمر کی درجہ بندی یا نیا رشتہ شامل نہ کریں۔ ہنگامی نوٹ میں ضرورت پر دوسرا رجسٹرڈ PMDC ڈاکٹر چنیں۔ سرور انکار پر مسودہ باقی؛ اصل وجہ درست کریں۔"]),');
s=s.replace(/^.*"beds.unverified": g\(.*\r?\n/m,'');
const anchor='export const controlGuides';
// Insert alongside existing authored guides, before an existing stable key.
const key='  "settings.it.actions": g(';
if(!s.includes('"settings.it.wards":'))s=s.replace(key,'  "settings.it.wards": g(["settings"],["Open and closed wards","کھلے اور بند وارڈ"],["Settings → Hardware lists all wards from GET /admin/wards. Edit the selected row or review Close/Reopen; every ward field is sent. Close is offered only with no Reserved, Occupied, Dirty or Cleaning beds and nobody waiting. WARD_IN_USE names the blocking beds and waitlist count; nothing changed. Keep the draft, reread, and arrange the real patient/cleaning workflow. Reopen returns its beds to the matrix. Unknown outcomes are inspected, never automatically replayed.","ترتیب کے ہارڈویئر حصے میں تمام کھلے اور بند وارڈ ہیں۔ منتخب وارڈ میں ترمیم یا بند/دوبارہ کھولنے کا جائزہ؛ تمام خانے ارسال ہوتے ہیں۔ بندش تب جب کوئی محفوظ، زیر استعمال یا صفائی والا بستر اور منتظر مریض نہ ہو۔ WARD_IN_USE اصل رکاوٹ و تعداد بتاتا ہے؛ تبدیلی نہیں ہوئی۔ مسودہ رکھ کر تازہ پڑھیں اور اصل مریض یا صفائی کا عمل کریں۔ دوبارہ کھولنے سے بستر واپس؛ غیر واضح نتیجہ خودکار نہ دہرائیں۔"]),\n'+key);
fs.writeFileSync(p,s);
p='src/help.ts';s=fs.readFileSync(p,'utf8');
s=s.replaceAll('Both priorities are shown','Only this consent’s ordered decision makers are shown');
fs.writeFileSync(p,s);
p='src/foundation-task-map.json';const map=JSON.parse(fs.readFileSync(p));map.settings['GET /admin/wards']='settings.it.wards';map.settings['PUT /admin/wards/{ward_id}']='settings.it.wards';fs.writeFileSync(p,JSON.stringify(map,null,2)+'\n');
