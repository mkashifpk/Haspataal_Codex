import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { ErrorBox, Field, LoadState, Modal, useLoad } from "../components";
import * as releases from "../generated/icd_code_lists";
import * as stats from "../generated/disease_statistics";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod, QualityTable } from "./QualityRegister";

const releasePath="/icd/releases";
export function IcdCodeLists({user,connected,readOnly,revision,onOpenHelp,openSettings}:{
 user:ClinicalUser;connected:boolean;readOnly:boolean;revision:number;onOpenHelp:()=>void;openSettings?:()=>void;
}){
 const [draft,setDraft]=useState<"import"|releases.IcdReleaseOut>();
 const [system,setSystem]=useState<"ICD-11"|"ICD-10">("ICD-11");
 const [target,setTarget]=useState<{system:string;label:string;language:string;id?:number}>();
 const [error,setError]=useState<unknown>();
 const [reading,setReading]=useState(false);
 const fileBusy=useRef(false);
 const alive=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const list=useLoad(releases.releases,[revision]);
 const data=!list.loading&&!list.error?list.data:undefined;
 const canManage=user.permissions.includes("icd.release.manage")&&connected&&!readOnly;
 const write=useClinicalWrite(user,"icd_code_lists",async()=>{setDraft(undefined);await list.reload();});
 const blocked=write.blocked||reading;
 const open=(next:typeof draft)=>{setDraft(next);setTarget(undefined);setError(undefined);setSystem("ICD-11");write.clearError();};
 const command=(path:string,body?:unknown)=>({method:"POST" as const,path,body,permission:"icd.release.manage",protection:"reconcile" as const,reconcilePath:releasePath,label:t("Change ICD releases","آئی سی ڈی اجرا کی تبدیلی")});
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!draft||!canManage||blocked||fileBusy.current)return;
  const form=new FormData(event.currentTarget);
  if(draft!=="import"){
   const item=draft;
   setTarget({system:item.code_system,label:item.release_label,language:item.language,id:item.release_id});
   write.start(command(`${releasePath}/${item.release_id}/activate`),async()=>{
    const current=(await releases.releases()).releases.find(x=>x.release_id===item.release_id);
    if(!current||current.is_active||current.row_version!==item.row_version)throw Error(t("The release changed. Refresh the release list.","اجرا بدل گیا۔ فہرست تازہ کریں۔"));
   });
   return;
  }
  const file=form.get("file"),label=String(form.get("label")??"").trim(),language=String(form.get("language")??"").trim(),licence=String(form.get("licence")??"").trim();
  if(!(file instanceof File)||!file.size||label.length<2||!/^[a-z]{2}$/.test(language)||(system==="ICD-10"&&!licence)){
   setError(Error(t("Choose a nonempty file and enter the required release and licence fields.","غیر خالی فائل اور ضروری اجرا و لائسنس معلومات درج کریں۔")));
   return;
  }
  setError(undefined);fileBusy.current=true;setReading(true);
  try{
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(!alive.current)return;
   const metadata=[["code_system",system],["release_label",label],["language",language],["licence_note",licence],["activate",form.has("activate")?"true":"false"]];
   const parts=[...metadata.map(([name,value])=>({name,value})),{name:"file",filename:file.name,type:file.type||"application/octet-stream",bytes}];
   setTarget({system,label,language});
   setReading(false);
   write.start(command(releasePath,{__multipart:parts}));
  }catch(cause){setError(cause);}
  finally{fileBusy.current=false;setReading(false);}
 }
 function selectResult(value:unknown){
  const result=value as releases.IcdReleasesOut;
  const item=result?.releases?.find(x=>target?.id?x.release_id===target.id:x.code_system===target?.system&&x.release_label===target?.label&&x.language===target?.language);
  if(!item)throw Error(t("The original release is not in the returned list. Keep the write locked and ask IT to reconcile.","اصل اجرا واپس موصول فہرست میں نہیں۔ تحریر مقفل رکھیں اور آئی ٹی سے رجوع کریں۔"));
  return item;
 }
 return <section data-screen="icd_code_lists" data-unsaved={!!draft} data-write-pending={write.blocked}>
  <QualityHeading title={t("ICD code lists","آئی سی ڈی کوڈ فہرستیں")} text={t("Review the releases, licences, and active list for each classification.","ہر درجہ بندی کے اجرا، لائسنس اور فعال فہرست دیکھیں۔")} onHelp={onOpenHelp}/>
  <LoadState {...list} retry={list.reload}/>
  {data&&<>
   <p>{t("Classification in use","زیر استعمال درجہ بندی")} · <bdi>{data.coding_system}</bdi></p>
   <p>{t("Super Admin changes the coding classification in System settings. The chosen classification needs an active release.","سپر ایڈمن نظام کی ترتیبات میں کوڈ درجہ بندی بدلتا ہے۔ منتخب درجہ بندی کے لیے فعال اجرا لازم ہے۔")}</p>
   {openSettings&&<button data-help="icdr.list" onClick={openSettings}>{t("Open system settings","نظام کی ترتیبات کھولیں")}</button>}
   <button data-help="icdr.list" onClick={list.reload} disabled={blocked}>{t("Refresh releases","اجرا تازہ کریں")}</button>
   {canManage&&<button data-help="icdr.import" disabled={blocked} onClick={()=>open("import")}>{t("Load code list","کوڈ فہرست لوڈ کریں")}</button>}
   <QualityTable columns={[t("Classification / release","درجہ بندی / اجرا"),t("Source and language","ماخذ اور زبان"),t("Codes","کوڈ"),t("Licence","لائسنس"),t("Status","حالت")]}
    rows={data.releases.map(x=>({key:x.release_id,cells:[<bdi>{x.code_system} · {x.release_label}</bdi>,<>{x.source} · {x.language}<br/>{x.source_file}</>,x.code_count,x.licence_note,
     <>{x.is_active?t("Active","فعال"):t("Inactive","غیر فعال")} {canManage&&!x.is_active&&<button data-help="icdr.activate" disabled={blocked} onClick={()=>open(x)}>{t("Activate release","اجرا فعال کریں")}</button>}</>]}))}
    empty={t("No code releases are loaded.","کوئی کوڈ اجرا لوڈ نہیں۔")}/>
   <p>{data.icd11_citation}</p>
  </>}
  {!draft&&<ClinicalWriteFeedback write={write}/>}
  {draft&&<Modal title={draft==="import"?t("Load code list","کوڈ فہرست لوڈ کریں"):t("Activate release","اجرا فعال کریں")} closable={!blocked} onClose={()=>{if(!blocked)setDraft(undefined);}}>
   <form className="form" onSubmit={submit}>
    <fieldset disabled={blocked}>
     {draft==="import"?<>
      <Field label={t("Classification","درجہ بندی")}><select data-help="icdr.import" value={system} onChange={e=>setSystem(e.target.value as typeof system)}><option>ICD-11</option><option>ICD-10</option></select></Field>
      <Field label={t("Release label","اجرا لیبل")}><input data-help="icdr.import" name="label" minLength={2} maxLength={40} required/></Field>
      <Field label={t("Language code","زبان کا کوڈ")}><input data-help="icdr.import" name="language" pattern="[a-z]{2}" defaultValue="en" required/></Field>
      <Field label={t("Code list file","کوڈ فہرست فائل")}><input data-help="icdr.import" name="file" type="file" accept=".xml,.zip,.txt,.csv,.tsv" required/></Field>
      <Field label={t("Licence note","لائسنس نوٹ")}><textarea data-help="icdr.import" name="licence" maxLength={1000} required={system==="ICD-10"}/></Field>
      <label><input data-help="icdr.activate" name="activate" type="checkbox"/> {t("Also make this release active for its classification.","اس اجرا کو اس کی درجہ بندی کے لیے فعال بھی کریں۔")}</label>
     </>:<p><bdi>{draft.code_system} · {draft.release_label} · {draft.language}</bdi></p>}
     <label><input data-help="icdr.activate" type="checkbox" required/> {t("I checked the classification, release and activation choice.","میں نے درجہ بندی، اجرا اور فعال کرنے کا انتخاب چیک کیا ہے۔")}</label>
    </fieldset>
    <ErrorBox error={error}/>
    <ClinicalWriteFeedback write={write} selectResult={selectResult} onReviewed={()=>{setDraft(undefined);void list.reload();}}/>
    <button type="submit" className="primary" data-help="icdr.activate" disabled={blocked||!canManage}>{t("Confirm release change","اجرا کی تبدیلی کی تصدیق")}</button>
   </form>
  </Modal>}
 </section>;
}

type CodingScreen="disease_statistics"|"disease_statistics_owner";
export function DiseaseStatistics({screenId,timeZone,revision,onOpenHelp}:{
 screenId:CodingScreen;timeZone?:string;revision:number;onOpenHelp:()=>void;
}){
 const [range,setRange]=useState(()=>currentMonth(timeZone));
 const [printing,setPrinting]=useState(false);
 const report=useLoad(()=>range.date_from?stats.codedStatistics(range):Promise.resolve(undefined),[range,revision]);
 const codeList=useLoad(stats.releases,[revision]);
 const data=!report.loading&&!report.error?report.data:undefined;
 const headers=[t("Classification","درجہ بندی"),t("Code or chapter","کوڈ یا باب"),t("Title","عنوان"),"OPD",t("Inpatient","داخل مریض"),t("Deaths","اموات"),t("Total","کل")];
 const content=data&&<div>
  <p><bdi>{data.date_from} – {data.date_to}</bdi></p>
  <article className="card"><h2>{t("Coding completeness","کوڈنگ کی تکمیل")}</h2>
   <QualityTable columns={[t("Source","ماخذ"),t("Coded / records","کوڈ شدہ / ریکارڈ"),t("Completeness","تکمیل")]}
    rows={data.completeness.map(x=>({key:x.source,cells:[x.source,`${x.coded} / ${x.records}`,<strong className={x.coded_pct!==null&&x.coded_pct<100?"error":undefined}>{x.coded_pct===null?"—":`${x.coded_pct}%`}</strong>]}))}
    empty={t("No coding measures were returned.","کوڈنگ پیمائش واپس نہیں ملی۔")}/>
  </article>
  <article className="card"><h2>{t("ICD chapters","آئی سی ڈی ابواب")}</h2>
   <QualityTable columns={headers} rows={data.chapters.map((x,i)=>({key:i,cells:[x.code_system??"—",x.chapter??t("No loaded chapter","لوڈ شدہ باب نہیں"),x.title??"—",x.opd,x.inpatient,x.deaths,x.total]}))} empty={t("No coded chapters in this period.","اس مدت میں کوئی کوڈ شدہ باب نہیں۔")}/>
  </article>
  <article className="card"><h2>{t("Top codes","اہم کوڈ")}</h2>
   <QualityTable columns={headers} rows={data.top_codes.map((x,i)=>({key:i,cells:[x.code_system??"—",<bdi>{x.code}</bdi>,<>{x.title??"—"} {x.uri&&<small><bdi>{x.uri}</bdi></small>}</>,x.opd,x.inpatient,x.deaths,x.total]}))} empty={t("No codes in this period.","اس مدت میں کوئی کوڈ نہیں۔")}/>
  </article>
  {data.citation&&<footer>{data.citation}</footer>}
 </div>;
 return <section data-screen={screenId}>
  <QualityHeading title={t("Coded diagnosis statistics","کوڈ شدہ تشخیص کے اعداد")} text={t("Review completeness and the mix of diagnoses in the selected hospital period.","منتخب ہسپتال مدت میں تکمیل اور تشخیص کی تقسیم دیکھیں۔")} onHelp={onOpenHelp}/>
  <QualityPeriod range={range} apply={setRange}/>
  <LoadState {...codeList} retry={codeList.reload}/>
  {!codeList.loading&&!codeList.error&&codeList.data&&<p>{t("Current coding classification","موجودہ کوڈ درجہ بندی")} · <bdi>{codeList.data.coding_system}</bdi></p>}
  <LoadState {...report} retry={report.reload}/>
  {content}
  {data&&<button data-help="icds.print" onClick={()=>setPrinting(true)}>{t("Prepare statistics for printing","اعداد پرنٹ کے لیے تیار کریں")}</button>}
  {printing&&data&&createPortal(<Modal title={t("Coded diagnosis statistics","کوڈ شدہ تشخیص کے اعداد")} onClose={()=>setPrinting(false)}>
   {content}<button data-help="icds.print" onClick={()=>window.print()}>{t("Print statistics","اعداد پرنٹ کریں")}</button>
  </Modal>,document.body)}
 </section>;
}
