// Read-only rendering of actual fresh DEV payload snapshots; no backend calls.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{try{
 const rows=JSON.parse(fs.readFileSync('docs/consents-ui-evidence-2026-10-28.json')).runs.flatMap(r=>r.requests||[]).filter(r=>r.path.endsWith('/print-payload')&&r.status===200).map(r=>r.result.data);
 const cases=[['english',rows.findLast(p=>p.fields.consent.direction==='ltr')],['urdu',rows.findLast(p=>p.fields.consent.direction==='rtl'&&p.fields.consent.status==='Refused')],['draft',rows.find(p=>p.fields.consent.direction==='rtl'&&p.fields.consent.status==='Draft')]];
 for(const[name,p]of cases){if(!p)throw Error('Missing actual payload '+name);const {bytes}=await require('../electron/consent-print.cjs').printConsent(p,{}, {pdf:true});fs.writeFileSync(path.resolve('artifacts/consent-layout-final-'+name+'.pdf'),bytes);console.log('Rendered '+name+' '+p.fields.consent.consent_number);}
 }catch(e){console.error(e);process.exitCode=1;}finally{app.quit();}});
