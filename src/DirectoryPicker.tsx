import {createContext,useContext,useEffect,useRef,useState,type InputHTMLAttributes,type ChangeEvent} from 'react';
import {api} from './bridge';
import {ErrorBox} from './components';
import {bilingual as t} from './i18n';
import contracts from './directory-access.json';
export const DirectoryPermissions=createContext<string[]>([]);
export function canReadDirectory(path:string,permissions:string[]) {
 const pathname=path.split('?')[0];
 const entry=Object.entries(contracts).find(([pattern])=>new RegExp('^'+pattern.replace(/\{[^}]+\}/g,'[^/]+')+'$').test(pathname));
 if(!entry)return false;
 const a=entry[1];return a.permissions_mode==='any'?a.permissions.some(p=>permissions.includes(p)):a.permissions.every(p=>permissions.includes(p));
}
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'onChange'> & {path:string;idField:string;list?:string;search?:boolean;userId?:boolean;empty?:string;onChange?:(e:ChangeEvent<HTMLInputElement>)=>void};
export function DirectoryPicker({path,idField,list,search=false,userId=false,empty,value,onChange,disabled,required,...rest}:Props) {
 const permissions=useContext(DirectoryPermissions),allowed=canReadDirectory(path,permissions);
 const [q,setQ]=useState(''),[rows,setRows]=useState<Record<string,any>[]>(),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(),[selected,setSelected]=useState('');
 const generation=useRef(0),identity=useRef(path);
 const change=(v:string)=>{setSelected(v);onChange?.({target:{value:v},currentTarget:{value:v}} as ChangeEvent<HTMLInputElement>);};
 useEffect(()=>{++generation.current;setRows(undefined);setError(undefined);setBusy(false);setQ('');if(identity.current!==path){identity.current=path;change('');}if(!search&&allowed)void load();return()=>{++generation.current};},[path,allowed]);
 async function load(){
  if(!allowed||disabled||(search&&q.trim().length<2))return;
  const n=++generation.current;setBusy(true);setError(undefined);setRows(undefined);
  try{let d:any=await api('GET',path+(search?(path.includes('?')?'&':'?')+'q='+encodeURIComponent(q.trim()):''));
   if(list)for(const part of list.split('.'))d=d?.[part];
   if(!Array.isArray(d))throw Error(t('The directory response is not a list. Contact IT.','فہرست کا جواب درست نہیں۔ آئی ٹی سے رابطہ کریں۔'));
   const found=d.filter(r=>r[idField]!=null&&r.is_active!==false&&(!userId||r.user_id!=null));
   if(n===generation.current){setRows(found);if(value&&!found.some(r=>String(r[idField])===String(value)))change('');}
  }catch(e){if(n===generation.current)setError(e);}finally{if(n===generation.current)setBusy(false);}
 }
 if(!allowed)return null;
 const help=rest['data-help' as keyof typeof rest];
 return <span className="directory-picker">
  {search&&<input data-help={help} aria-label={t('Search directory by name','نام سے فہرست تلاش کریں')} value={q} disabled={disabled||busy} onChange={e=>{++generation.current;setQ(e.target.value);setRows(undefined);setError(undefined);change('');}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void load();}}}/>}
  <button type="button" data-help={help} disabled={disabled||busy||(search&&q.trim().length<2)} onClick={()=>void load()}>{busy?t('Loading…','فہرست کھل رہی ہے…'):search?t('Find by name','نام سے تلاش کریں'):t('Load choices','فہرست کھولیں')}</button>
  <ErrorBox error={error}/>
  <select data-help={help} data-field={rest['data-field' as keyof typeof rest]} id={rest.id} name={rest.name} className={rest.className} required={required} disabled={disabled||busy||!rows} value={rows?String(value??selected):''} onChange={e=>change(e.target.value)}>
   <option value="">{t('Choose from the directory','فہرست سے چنیں')}</option>
   {rows?.map(r=><option key={r[idField]} value={r[idField]}>{[r.full_name??r.name??r.patient_name??r.batch_no??r.title??r.description??r.procedure_name??r.ward_name??r.label??r.booking_number??r.invoice_number??r.admission_number??r.work_order_number??r.emp_number??r.code, r.mrn,r.bed_label,r.expiry_date,r.qty_available!=null?`${r.qty_available} ${r.unit??''}`:null,r.is_expired?t('Expired','میعاد ختم'):null].filter(v=>v!=null&&v!=='').join(' · ')}</option>)}
  </select>
  {rows?.length===0&&<small role="status">{empty??directoryEmpty(path,userId)}</small>}
 </span>;
}
function directoryEmpty(path:string,userId:boolean){
 if(path.startsWith('/admin/departments'))return t('No active departments. IT adds departments.','فعال شعبہ نہیں۔ آئی ٹی شعبے درج کرتا ہے۔');
 if(path.startsWith('/beds/matrix'))return t('No wards or beds. IT adds wards.','وارڈ یا بستر نہیں۔ آئی ٹی وارڈ درج کرتا ہے۔');
 if(path.startsWith('/finance/vendors'))return t('No active matching vendors. Finance adds the supplier or contractor.','متعلقہ فعال فراہم کنندہ نہیں۔ مالیات فراہم کنندہ یا ٹھیکیدار درج کرتا ہے۔');
 if(path.startsWith('/staff/lookup'))return t(userId?'No staff with a login found. Type more of the name; IT provides logins, HR adds staff.':'Nobody found. Type more of the name; HR adds staff.',userId?'لاگ ان والا عملہ نہیں ملا۔ مزید نام لکھیں؛ آئی ٹی لاگ ان اور ایچ آر عملہ درج کرتے ہیں۔':'عملہ نہیں ملا۔ مزید نام لکھیں؛ ایچ آر عملہ درج کرتا ہے۔');
 if(path.startsWith('/patients/search'))return t('Patient not found. Reception registers the patient first.','مریض نہیں ملا۔ استقبالیہ پہلے مریض درج کرتا ہے۔');
 if(path.startsWith('/drugs/search'))return t('Medicine not found. Pharmacy adds it to the formulary.','دوا نہیں ملی۔ فارمیسی دوا فہرست میں درج کرتی ہے۔');
 if(path.includes('/lab/reagents/'))return t('Nothing of this reagent is in stock. Ask the lab administrator.','یہ ری ایجنٹ اسٹاک میں نہیں۔ لیب ایڈمن سے رابطہ کریں۔');
 if(path.startsWith('/ops/assets')||path.startsWith('/facility/equipment')||path.startsWith('/ot/theaters'))return t('No matching asset or theatre. Ask Maintenance.','متعلقہ اثاثہ یا تھیٹر نہیں۔ دیکھ بھال شعبے سے پوچھیں۔');
 return t('No matching records. Ask the responsible department to add the record.','متعلقہ ریکارڈ نہیں۔ متعلقہ شعبے سے اندراج کرائیں۔');
}
