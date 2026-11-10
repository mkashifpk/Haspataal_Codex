import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { Empty, Field, LoadState, Modal, useLoad } from "../components";
import * as mlc from "../generated/mlc_register";
import { formatHospitalTime } from "../hospital-time";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod, QualityTable } from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

type Screen="mlc_register"|"mlc_register_quality";
type Draft={kind:"type";row?:mlc.MlcCaseTypeOut}|{kind:"contact";row?:mlc.MlcContactOut};
const contactKinds=["PoliceStation","MlrHospital","ReferralHospital","HealthOffice","TraumaCentre","BloodBank","RescueService","FireBrigade","PoliceEmergency","Ambulance","SocialService"] as const;
const typePath="/mlc/case-types",contactPath="/mlc/contacts",history="?include_inactive=true";
const contactFields=[
  ["district","District","ضلع",100],["phone","Phone","فون",30],["alt_phone","Alternate phone","متبادل فون",30],
  ["address","Address","پتہ",500],["notes","Notes","نوٹس",1000],
] as const;
const state=(x:boolean)=>x?t("Active","فعال"):t("Retired","غیر فعال");
export function MedicoLegalRegister({screenId,user,connected,readOnly,timeZone,revision,onOpenHelp}:{
 screenId:Screen;user:ClinicalUser;connected:boolean;readOnly:boolean;timeZone?:string;revision:number;onOpenHelp:()=>void;
}){
 const owner=screenId==="mlc_register";
 const readable=user.permissions.some(p=>p==="mlc.register.view"||p==="mlc.case.manage");
 const canSetup=owner&&user.permissions.includes("mlc.setup.manage");
 const [range,setRange]=useState(()=>currentMonth(timeZone));
 const [status,setStatus]=useState<"Open"|"Closed"|"">(owner?"":"Open");
 const [caseType,setCaseType]=useState<number>();
 const [police,setPolice]=useState<number>();
 const [overdue,setOverdue]=useState(false);
 const [selected,setSelected]=useState<number>();
 const [local,setLocal]=useState(0);
 const [draft,setDraft]=useState<Draft>();
 const [dirty,setDirty]=useState(false);
 const [printing,setPrinting]=useState(false);
 const types=useLoad(()=>readable||canSetup?mlc.caseTypes({include_inactive:true}):Promise.resolve([]),[readable,canSetup,revision,local]);
 const contacts=useLoad(()=>readable||canSetup?mlc.contacts({include_inactive:true}):Promise.resolve([]),[readable,canSetup,revision,local]);
 const cases=useLoad(()=>readable&&range.date_from?mlc.listCasesMlc({...range,status:status||undefined,case_type_id:caseType,police_station_id:police,overdue:overdue||undefined,limit:500}):Promise.resolve([]),[readable,range,status,caseType,police,overdue,revision,local]);
 const detail=useLoad(()=>readable&&selected?mlc.getCase(selected):Promise.resolve(undefined),[readable,selected,revision,local]);
 const print=useLoad(()=>owner&&readable&&selected&&printing?mlc.printCase(selected):Promise.resolve(undefined),[owner,readable,selected,printing]);
 const row=!detail.loading&&!detail.error&&detail.data?.mlc_id===selected?detail.data:undefined;
 const paper=!print.loading&&!print.error&&print.data?.fields.case.mlc_id===selected?print.data:undefined;
 const refresh=()=>setLocal(n=>n+1);
 const write=useClinicalWrite(user,screenId,()=>{setDraft(undefined);refresh();});
 const editable=canSetup&&connected&&!readOnly&&!write.blocked;
 const date=(value:string)=>timeZone?formatHospitalTime(value,timeZone):value;
 function open(next:Draft){setDraft(next);setDirty(false);write.clearError();}
 function close(){if(!write.blocked&&(!dirty||window.confirm(t("Discard the unsent change?","غیر ارسال شدہ تبدیلی چھوڑ دیں؟"))))setDraft(undefined);}
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!draft||!editable)return;
  const data=new FormData(e.currentTarget);
  const value=(key:string)=>String(data.get(key)??"").trim();
  const name=value("name");
  if(name.length<2)return;
  const existing=draft.row;
  const isType=draft.kind==="type";
  const base=isType?typePath:contactPath;
  const id=draft.kind==="type"?draft.row?.case_type_id:draft.row?.contact_id;
  const body=isType?{name,description:value("description")||null,sort_order:Number(value("order")),
   ...(existing?{is_active:data.has("active")}:{code:value("code")})}:
   {name,...Object.fromEntries(contactFields.map(([key])=>[key,value(key)||null])),
    ...(existing?{is_active:data.has("active")}:{contact_type:value("kind")})};
  write.start({method:existing?"PATCH":"POST",path:existing?`${base}/${id}`:base,body,permission:"mlc.setup.manage",
   protection:existing?"reconcile":"idempotent",reconcilePath:existing?base+history:undefined,label:t("Save medico-legal setup","میڈیکو لیگل ترتیبات محفوظ کریں")},
   existing?async()=>{
    const latest=draft.kind==="type"?(await mlc.caseTypes({include_inactive:true})).find(x=>x.case_type_id===id):
     (await mlc.contacts({include_inactive:true})).find(x=>x.contact_id===id);
    if(JSON.stringify(latest)!==JSON.stringify(existing)){refresh();throw Error(t("This entry changed. Read it before editing again.","یہ اندراج بدل گیا۔ دوبارہ ترمیم سے پہلے اسے پڑھیں۔"));}
   }:undefined);
 }
 const selectResult=(data:unknown)=>{
  const current=Array.isArray(data)&&data.find(x=>draft?.kind==="type"?x.case_type_id===draft.row?.case_type_id:x.contact_id===draft?.row?.contact_id);
  if(!current)throw Error(t("The original setup entry was not returned.","اصل ترتیبات اندراج واپس نہیں ملا۔"));
  return current;
 };
 const list=!cases.loading&&!cases.error?[...(cases.data??[])].sort((a,b)=>Number(b.police_intimation_overdue)-Number(a.police_intimation_overdue)||Number(b.status==="Open")-Number(a.status==="Open")):undefined;
 return <section data-screen={screenId} data-unsaved={!!draft} data-write-pending={write.blocked}>
  <QualityHeading title={owner?t("Medico-legal register & setup","میڈیکو لیگل رجسٹر اور ترتیبات"):t("Medico-legal register","میڈیکو لیگل رجسٹر")}
   text={t("Review open cases and overdue police intimations. Open an exact case to read the recorded history.","کھلے مقدمات اور پولیس اطلاع کی تاخیر دیکھیں۔ درج تاریخ کے لیے عین مقدمہ کھولیں۔")} onHelp={onOpenHelp}/>
  {readable?<><QualityPeriod range={range} disabled={!!draft} apply={v=>{setRange(v);setSelected(undefined);}}>
   <Field label={t("Case status","مقدمے کی حالت")}><select data-help="mlr.filters" value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="">{t("All statuses","تمام حالتیں")}</option><option value="Open">{t("Open","کھلا")}</option><option value="Closed">{t("Closed","بند")}</option></select></Field>
   <Field label={t("Case type","مقدمے کی قسم")}><select data-help="mlr.filters" disabled={types.loading||!!types.error} value={caseType??""} onChange={e=>setCaseType(Number(e.target.value)||undefined)}><option value="">{t("All types","تمام اقسام")}</option>{types.data?.map(x=><option key={x.case_type_id} value={x.case_type_id}>{x.name} · {state(x.is_active)}</option>)}</select></Field>
   <Field label={t("Police station","تھانہ")}><select data-help="mlr.filters" disabled={contacts.loading||!!contacts.error} value={police??""} onChange={e=>setPolice(Number(e.target.value)||undefined)}><option value="">{t("All stations","تمام تھانے")}</option>{contacts.data?.filter(x=>x.contact_type==="PoliceStation").map(x=><option key={x.contact_id} value={x.contact_id}>{x.name} · {state(x.is_active)}</option>)}</select></Field>
   <label><input data-help="mlr.filters" type="checkbox" checked={overdue} onChange={e=>setOverdue(e.target.checked)}/> {t("Overdue police intimation only","صرف تاخیر شدہ پولیس اطلاع")}</label>
   <button data-help="mlr.filters" type="button" onClick={refresh}>{t("Refresh","تازہ کریں")}</button>
  </QualityPeriod>
  <LoadState {...cases} retry={cases.reload}/>
  {list&&<QualityTable columns={[t("Case","مقدمہ"),t("Patient","مریض"),t("Arrival","آمد"),t("Police","پولیس"),t("Report and status","رپورٹ اور حالت")]}
   rows={list.map(x=>({key:x.mlc_id,cells:[<button data-help="mlr.detail" disabled={!!draft} onClick={()=>{setSelected(x.mlc_id);setPrinting(false);}}>{x.mlc_number}</button>,<>{x.patient_name} · <bdi>{x.mrn}</bdi></>,<>{date(x.arrived_at)} · {x.case_type_name} · {x.brought_by}</>,
    <>{x.police_station_name??"—"} · {x.police_informed_at?date(x.police_informed_at):"—"} {x.police_intimation_overdue&&<strong className="error">{t("Overdue","تاخیر شدہ")}</strong>}</>,<>{x.mlr_status} · {x.status} {x.death_number}</>]}))}
   empty={t("No cases match the selected filters.","منتخب فلٹر سے کوئی مقدمہ نہیں ملا۔")}/>}
  {selected&&<LoadState {...detail} retry={detail.reload}/>}
  {row&&<article className="card"><h2><bdi>{row.mlc_number}</bdi></h2>
   <p>{row.patient_name} · <bdi>{row.mrn}</bdi> · {row.case_type_name} · {row.status}</p>
   <p>{t("Alleged history","بیان کردہ تاریخ")} · {row.alleged_history} · {row.history_given_by}</p>
   {row.examination_findings&&<p>{t("Examination findings","معائنے کے نتائج")} · {row.examination_findings}</p>}
   <p>{t("Police intimation","پولیس اطلاع")} · {row.police_station_name} · {row.police_informed_at&&date(row.police_informed_at)} · {row.police_informed_how} · {row.police_informed_to} · {row.police_reference} · {row.investigating_officer}</p>
   <p>{t("Medico-legal report","میڈیکو لیگل رپورٹ")} · {row.mlr_status} · {row.mlr_number} · {row.referred_to_name} · {row.mlr_note}</p>
   {row.closure_note&&<p>{row.closure_note} · {row.closed_by_name}</p>}
   {row.evidence.length>0&&<QualityTable columns={[t("Evidence","شواہد"),t("Seal and receipt","مہر اور رسید"),t("Handover","حوالگی")]} rows={row.evidence.map(x=>({key:x.evidence_id,cells:[x.description,<>{x.seal_number} · {x.receipt_reference}</>,<>{x.handed_to} · {x.handed_by_name} · {date(x.handed_at)}</>]}))} empty="—"/>}
   {owner&&<button data-help="mlr.print" disabled={!!draft||printing} onClick={()=>setPrinting(true)}>{t("Read police intimation print details","پولیس اطلاع کی پرنٹ تفصیل")}</button>}
  </article>}
  </>:<Empty>{t("Case register access is required.","مقدمہ رجسٹر تک رسائی درکار ہے۔")}</Empty>}
  {(readable||canSetup)&&<article className="card"><h2>{t("Case types and contact directory","مقدمات کی اقسام اور رابطہ فہرست")}</h2>
   <LoadState {...types} retry={types.reload}/><LoadState {...contacts} retry={contacts.reload}/>
   {owner&&canSetup&&<div className="toolbar">
    <button data-help="mlr.setup" disabled={!editable||!!draft} onClick={()=>open({kind:"type"})}>{t("Add case type","قسم شامل کریں")}</button>
    <button data-help="mlr.setup" disabled={!editable||!!draft} onClick={()=>open({kind:"contact"})}>{t("Add contact","رابطہ شامل کریں")}</button>
   </div>}
   {!types.loading&&!types.error&&<QualityTable columns={[t("Case type","مقدمے کی قسم"),t("Description","تفصیل"),t("Status","حالت")]} rows={(types.data??[]).map(x=>({key:x.case_type_id,cells:[`${x.code} · ${x.name}`,x.description??"—",<>{state(x.is_active)} {canSetup&&<button data-help="mlr.setup" disabled={!editable||!!draft} onClick={()=>open({kind:"type",row:x})}>{t("Edit case type","قسم بدلیں")}</button>}</>]}))} empty={t("No case types.","کوئی قسم نہیں۔")}/>}
   {!contacts.loading&&!contacts.error&&<QualityTable columns={[t("Contact","رابطہ"),t("Location","جگہ"),t("Phones","فون"),t("Status","حالت")]} rows={(contacts.data??[]).map(x=>({key:x.contact_id,cells:[`${x.name} · ${x.contact_type}`,<>{x.district} · {x.address} {x.notes}</>,<bdi>{[x.phone,x.alt_phone].filter(Boolean).join(" · ")}</bdi>,<>{state(x.is_active)} {canSetup&&<button data-help="mlr.setup" disabled={!editable||!!draft} onClick={()=>open({kind:"contact",row:x})}>{t("Edit contact","رابطہ بدلیں")}</button>}</>]}))} empty={t("No contacts.","کوئی رابطہ نہیں۔")}/>}
   {owner&&<QualityPaper disabled={!connected||!!draft} documents={[{path:"/mlc/contacts/pdf",label:t("contact display PDF","نمائش کی رابطہ پی ڈی ایف")}]}/>}
  </article>}
  {!draft&&<ClinicalWriteFeedback write={write}/>}
  {draft&&<Modal title={t("Review directory change","فہرست کی تبدیلی کا جائزہ")} onClose={close} closable={!write.blocked}>
   <form className="form" onSubmit={submit} onChange={()=>setDirty(true)}>
    <fieldset disabled={write.blocked}>
     <Field label={t("Name","نام")}><input data-help="mlr.setup" name="name" defaultValue={draft.row?.name} required minLength={2} maxLength={200}/></Field>
     {draft.kind==="type"?<>
      {!draft.row&&<Field label={t("Code","کوڈ")}><input data-help="mlr.setup" name="code" pattern="[A-Z][A-Z0-9_]{1,29}" required maxLength={30}/></Field>}
      <Field label={t("Description","تفصیل")}><textarea data-help="mlr.setup" name="description" maxLength={1000} defaultValue={draft.row?.description??""}/></Field>
      <Field label={t("Display order","نمائش کی ترتیب")}><input data-help="mlr.setup" name="order" type="number" min={0} max={10000} defaultValue={draft.row?.sort_order??0} required/></Field>
     </>:<>
      {!draft.row&&<Field label={t("Contact type","رابطے کی قسم")}><select data-help="mlr.setup" name="kind">{contactKinds.map(kind=><option key={kind}>{kind}</option>)}</select></Field>}
      {contactFields.map(([key,en,ur,max])=><Field key={key} label={t(en,ur)}><input data-help="mlr.setup" name={key} maxLength={max} defaultValue={draft.row?.[key]??""}/></Field>)}
     </>}
     {draft.row&&<label><input type="checkbox" data-help="mlr.setup" name="active" defaultChecked={draft.row.is_active}/> {t("Active","فعال")}</label>}
     <label><input type="checkbox" data-help="mlr.setup" required/> {t("I checked the directory change.","میں نے فہرست کی تبدیلی چیک کی ہے۔")}</label>
    </fieldset>
    <ClinicalWriteFeedback write={write} selectResult={selectResult} onReviewed={()=>{setDraft(undefined);refresh();}}/>
    <button type="submit" data-help="mlr.setup" className="primary" disabled={!editable}>{t("Confirm directory change","فہرست کی تبدیلی کی تصدیق")}</button>
   </form>
  </Modal>}
  {printing&&createPortal(<Modal title={t("Police intimation printout","پولیس اطلاع کا پرنٹ")} onClose={()=>setPrinting(false)}>
    <LoadState {...print} retry={print.reload}/>
    {paper&&<article className="card"><h2>{paper.fields.hospital.name}</h2>
     <p>{paper.fields.hospital.address} · {paper.fields.hospital.phone}</p>
     <p><bdi>{paper.fields.case.mlc_number} · {paper.fields.case.mrn}</bdi> · {paper.fields.case.patient_name} · {date(paper.fields.case.arrived_at)}</p>
     <p>{paper.fields.case.case_type_name} · {paper.fields.case.police_station_name} · {paper.fields.case.police_reference}</p>
     <p>{paper.fields.case.alleged_history}</p><p>{paper.fields.case.examination_findings}</p>
     <p>{paper.fields.case.created_by_name}</p>
     <button data-help="mlr.print" onClick={()=>window.print()}>{t("Print intimation","اطلاع پرنٹ کریں")}</button>
    </article>}
  </Modal>,document.body)}
 </section>;
}
