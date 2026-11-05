import {useCallback, useEffect, useState} from 'react';
import * as api from './generated/waste_log_ops';
import type {ClinicalUser} from './clinical-context';
import {useClinicalWrite, ClinicalWriteFeedback} from './clinical-write';
import {ErrorBox, Field} from './components';
import {ApiError} from './bridge';
import {bilingual as t} from './i18n';

export function WasteHandover({user,connected,onSaved,onPending,onActive}:{user:ClinicalUser;connected:boolean;onSaved:()=>Promise<void>;onPending:(v:boolean)=>void;onActive:(v:boolean)=>void}) {
 const [open,setOpen]=useState(false),[rows,setRows]=useState<api.WasteRecordOut[]>([]),[vendors,setVendors]=useState<api.VendorOut[]>([]),[ids,setIds]=useState<number[]>([]),[vendor,setVendor]=useState(''),[manifest,setManifest]=useState(''),[disposal,setDisposal]=useState<api.WasteHandoverIn['disposal']>('Other'),[day,setDay]=useState(''),[error,setError]=useState<unknown>(),[loading,setLoading]=useState(false),[conflict,setConflict]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError(undefined);
  try {const [log,v]=await Promise.all([api.listWaste({awaiting_handover:true,limit:5000}),api.vendors({vendor_type:'Contractor'})]);setRows(log.records);setVendors(v.filter(r=>r.is_active));setIds(old=>old.filter(id=>log.records.some(r=>r.waste_id===id)));}
  catch(e){setError(e);setRows([]);setVendors([]);}finally{setLoading(false);}
 },[]);
 const write=useClinicalWrite(user,'waste_log_ops:handover',async()=>{setIds([]);setManifest('');setDay('');setOpen(false);await onSaved();});
 useEffect(()=>{if(open)void load();},[open,load]);
 useEffect(()=>{
  if(!(write.error instanceof ApiError))return;
  const refusal=write.error.response.error;
  if(refusal?.code==='WASTE_HANDED_OVER'){
   const d=refusal.details;setConflict(t(`Collection ${d?.waste_id} already has final note ${d?.manifest_number} dated ${d?.handed_over_on}. The write will not be retried.`,`جمع شدہ فضلے ${d?.waste_id} کی حتمی رسید ${d?.manifest_number} تاریخ ${d?.handed_over_on} موجود ہے۔ دوبارہ ارسال نہیں ہوگا۔`));void load();void onSaved();
  } else if(refusal?.code==='REFERENCE_NOT_FOUND'&&refusal.details?.field==='waste_ids')void load();
 },[write.error,load,onSaved]);
 const blocked=write.blocked;
 useEffect(()=>onPending(blocked),[blocked,onPending]);
 useEffect(()=>onActive(open),[open,onActive]);
 return <section data-write-pending={blocked} data-unsaved={open&&(ids.length>0||!!manifest)}>
  <button data-help="wl.handover" disabled={blocked||!connected} onClick={()=>{if(open){setIds([]);setManifest('');setDay('');}setOpen(v=>!v);setConflict('');}}>{open?t('Cancel unsent handover','غیر ارسال حوالگی منسوخ'):t('Hand over waiting collections','منتظر جمع شدہ فضلہ حوالے کریں')}</button>
  {conflict&&<p role="alert">{conflict}</p>}
  <ClinicalWriteFeedback write={write}/>
  {open&&<form onSubmit={e=>{e.preventDefault();setConflict('');if(!ids.length||!vendor||!manifest.trim())return;write.start({method:'POST',path:'/infection/waste/handover',permission:'infection.waste.record',protection:'idempotent',label:t('Hand over selected collections','منتخب فضلہ حوالے کریں'),body:{waste_ids:ids,vendor_id:Number(vendor),manifest_number:manifest.trim(),disposal,handed_over_on:day||null},reconcilePath:'/infection/waste'});}}>
   <h2>{t('One consignment note at pickup','وصولی پر ایک حوالگی رسید')}</h2>
   <p>{t('Select the whole collections covered by this note. Their weights are already recorded; never enter them again. The note becomes final.','رسید میں شامل مکمل اندراج چنیں۔ ان کا وزن پہلے درج ہے؛ دوبارہ نہ لکھیں۔ رسید حتمی ہو جاتی ہے۔')}</p>
   <ErrorBox error={error}/>
   <fieldset disabled={blocked||!connected||loading}>
    <button type="button" data-help="wl.refresh" onClick={()=>void load()}>{t('Refresh waiting collections','منتظر فہرست تازہ کریں')}</button>
    {rows.length===5000&&<p role="alert">{t('The list reached its limit. Reconcile older collections before continuing.','فہرست حد تک پہنچ گئی۔ آگے بڑھنے سے پہلے پرانے اندراج چیک کریں۔')}</p>}
    {!loading&&!rows.length&&<p>{t('No collections are waiting.','کوئی جمع شدہ فضلہ منتظر نہیں۔')}</p>}
    {rows.map(r=><label key={r.waste_id}><input type="checkbox" data-help="wl.handover" checked={ids.includes(r.waste_id)} onChange={e=>setIds(old=>e.target.checked?[...old,r.waste_id]:old.filter(id=>id!==r.waste_id))}/>{r.recorded_on} · {r.category} · {[r.ward_name,r.department_name,r.location].filter(Boolean).join(' · ')} · {r.weight_kg} kg</label>)}
    <Field label={t('Contractor','ٹھیکیدار')}><select data-help="wl.vendor" required value={vendor} onChange={e=>setVendor(e.target.value)}><option value="">{t('Choose by name','نام سے چنیں')}</option>{vendors.map(v=><option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}</select></Field>
    {!loading&&!vendors.length&&<p>{t('Finance adds the missing contractor.','غائب ٹھیکیدار مالیات درج کرتا ہے۔')}</p>}
    <Field label={t('Consignment note','حوالگی رسید')}><input data-help="wl.manifest" required maxLength={100} value={manifest} onChange={e=>setManifest(e.target.value)}/></Field>
    <Field label={t('Disposal','تلفی')}><select data-help="wl.disposal" value={disposal} onChange={e=>setDisposal(e.target.value as typeof disposal)}>{['Incineration','Autoclave','Encapsulation','Landfill','Recycling','Other'].map(v=><option key={v}>{v}</option>)}</select></Field>
    <Field label={t('Handover date (blank means today)','حوالگی کی تاریخ (خالی یعنی آج)')}><input name="handed_over_on" data-help="wl.date" type="date" value={day} onChange={e=>setDay(e.target.value)}/>{write.error instanceof ApiError&&write.error.response.error?.code==='VALIDATION_ERROR'&&<small role="alert">{write.error.message}</small>}</Field>
    <p>{t('Selected weight','منتخب وزن')}: {rows.filter(r=>ids.includes(r.waste_id)).reduce((n,r)=>n+r.weight_kg,0)} kg</p>
    <button data-help="wl.save" disabled={!ids.length||!vendor||!manifest.trim()||rows.length===5000}>{t('Confirm handover','حوالگی کی تصدیق')}</button>
   </fieldset>
  </form>}
 </section>;
}
