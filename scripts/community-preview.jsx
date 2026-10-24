// Isolated test-only presentation entry. Built to ignored artifacts, never an app entry or business-data stub.
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HomeVisitRecord} from '../src/screens/HomeVisitRecord';
import {PatientProgrammes} from '../src/screens/PatientProgrammes';
import {api,call} from '../src/bridge';
import {setLanguage,bilingual as t} from '../src/i18n';
export async function mount(screen='programme'){
 const [user,est,meta,state,ticket]=await Promise.all([api('GET','/auth/me'),api('GET','/establishment'),api('GET','/meta/settings'),call('state'),api('GET','/opd-tickets/14')]);
 if(ticket.patient_id!==18)throw new Error('The retained synthetic patient fixture changed');
 if(est.capabilities.find(c=>c.capability===(screen==='home'?'home_visits':'preventive_programmes'))?.state!=='Available')throw new Error('This preview is only the actual Available service case; no capability answer is stubbed');
 const original=document.getElementById('root');const old=original.style.display;original.style.display='none';
 const element=document.createElement('div');element.id='community-preview';element.className='app';document.body.append(element);const root=createRoot(element);
 function Preview(){const[prefs,setPrefs]=useState(state.prefs);useEffect(()=>window.terminal.subscribe(e=>{if(e.type==='prefs')setPrefs(e.prefs)}),[]);setLanguage(prefs.language);return <main style={{padding:'24px',width:'100%',minWidth:0,maxWidth:1250,margin:'0 auto'}}><aside className="notice">{t('READ-ONLY DEV COMPONENT PREVIEW — actual inactive service state and actual authenticated reads. This is not an enabled daily menu or evidence of enrolment/service delivery. Positive workflows and human review are pending.','صرف پڑھنے کا ڈی وی جزوی منظر — اصل غیر فعال خدمت اور مجاز پڑھائی۔ یہ فعال روزانہ مینو یا اندراج/خدمت کا ثبوت نہیں۔ مثبت کام اور انسانی جائزہ باقی ہیں۔')}</aside>{screen==='home'?<HomeVisitRecord user={user} revision={0} initialTicket={ticket.ticket_id} readOnly={false} connected={state.connected} establishment={est} timeZone={meta.hospital_timezone}/>:<PatientProgrammes user={user} revision={0} initialTicket={ticket.ticket_id} readOnly={false} connected={state.connected} establishment={est} timeZone={meta.hospital_timezone}/>}</main>}
 root.render(<Preview/>);window.__communityPreviewCleanup=()=>{root.unmount();element.remove();original.style.display=old};
}
