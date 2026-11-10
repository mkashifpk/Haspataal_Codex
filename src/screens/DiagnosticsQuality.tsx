import { useState, type ReactNode } from "react";
import { call } from "../bridge";
import type { ClinicalUser } from "../clinical-context";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import * as diag from "../generated/diagnostics_quality";
import { formatHospitalTime } from "../hospital-time";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod, QualityTable } from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

type Screen="lab_quality"|"radiology_quality"|"diagnostics_quality"|"owner_diagnostics";
type View="full"|"open_work"|"records"|"setup"|"hidden";
type Service="Lab"|"Imaging";
const percent=(n:number|null)=>n===null?"—":`${n}%`;
const rate=(n:number|null,target:number)=><strong className={n!==null&&n<target?"error":undefined}>{percent(n)}</strong>;
const value=(x:string|number|null|undefined)=>x??"—";
function block(title:string,columns:string[],rows:ReactNode[][]){
 return <article className="card"><h2>{title}</h2>
  <QualityTable columns={columns} rows={rows.map((cells,key)=>({key,cells}))} empty={t("No entries for this selection.","اس انتخاب میں کوئی اندراج نہیں۔")}/>
 </article>;
}
export function DiagnosticsQuality({screenId,user,view,connected,combined,timeZone,revision,onOpenHelp}:{
 screenId:Screen;user:ClinicalUser;view?:View;connected:boolean;combined:boolean;timeZone?:string;revision:number;onOpenHelp:()=>void;
}){
 const visible=["full","open_work","records"].includes(view??"");
 const can=(...permissions:string[])=>visible&&permissions.some(p=>user.permissions.includes(p));
 const quality=can("diagnostics.quality.view");
 const [range,setRange]=useState(()=>currentMonth(timeZone));
 const [service,setService]=useState<Service>(screenId==="radiology_quality"?"Imaging":"Lab");
 const [selected,setSelected]=useState<number>();
 const [partner,setPartner]=useState<number>();
 const [outstanding,setOutstanding]=useState(false);
 const [criticalStatus,setCriticalStatus]=useState<diag.CriticalResultOut["status"]|"">("");
 const [documentError,setDocumentError]=useState<unknown>();
 const [documentNotice,setDocumentNotice]=useState("");
 const [packing,setPacking]=useState(false);
 const [refreshCount,setRefreshCount]=useState(0);
 const period=Boolean(range.date_from&&range.date_to);
 const sendAccess=can("lab.sendout.manage","diagnostics.quality.view");
 const criticalAccess=can("diagnostics.critical.view");
 const workAccess=can("diagnostics.critical.view","diagnostics.quality.view");
 const repeatAccess=can("imaging.order.update","diagnostics.quality.view");
 const partnerAccess=can("diagnostics.setup.manage","diagnostics.quality.view","lab.sendout.manage","imaging.order.update","lab.test.manage");
 const turn=useLoad(()=>quality&&period?diag.turnaroundReport({...range,service}):Promise.resolve(undefined),[quality,period,range,service,revision,refreshCount]);
 const stats=useLoad(()=>quality&&period?diag.diagnosticsStatistics(range):Promise.resolve(undefined),[quality,period,range,revision,refreshCount]);
 const work=useLoad(()=>workAccess?diag.diagnosticsWorklist({area:service}):Promise.resolve([]),[workAccess,service,revision,refreshCount]);
 const repeats=useLoad(()=>repeatAccess&&period?diag.listRepeats(range):Promise.resolve([]),[repeatAccess,period,range,revision,refreshCount]);
 const send=useLoad(()=>sendAccess?diag.listSendOuts({partner_id:partner,outstanding:outstanding||undefined,limit:500}):Promise.resolve([]),[sendAccess,partner,outstanding,revision,refreshCount]);
 const detail=useLoad(()=>sendAccess&&selected?diag.getSendOut(selected):Promise.resolve(undefined),[sendAccess,selected,revision,refreshCount]);
 const critical=useLoad(()=>criticalAccess&&period?diag.listCritical({...range,source:service,status:criticalStatus||undefined,limit:500}):Promise.resolve([]),[criticalAccess,period,range,service,criticalStatus,revision,refreshCount]);
 const partners=useLoad(()=>partnerAccess?diag.listPartners({active_only:false}):Promise.resolve([]),[partnerAccess,revision,refreshCount]);
 const turnaround=!turn.loading&&!turn.error&&turn.data?.service===service?turn.data:undefined;
 const data=!stats.loading&&!stats.error?stats.data:undefined;
 const current=!detail.loading&&!detail.error&&detail.data?.send_out_id===selected?detail.data:undefined;
 const date=(x:string|null|undefined)=>x?(timeZone?formatHospitalTime(x,timeZone):x):"—";
 const query=period?`?date_from=${range.date_from}&date_to=${range.date_to}`:"";
 const papers=[
  ...(quality&&period?[{path:"/diagnostics/turnaround/pdf"+query,label:t("turnaround report","بروقت نتائج رپورٹ")},{path:"/critical-results/register/pdf"+query,label:t("critical results register","اہم نتائج رجسٹر")}]:[]),
  ...(can("diagnostics.quality.view","lab.test.manage","lab.result.verify")?[{path:"/diagnostics/lab-policy/pdf",label:t("laboratory policy","لیبارٹری پالیسی")}]:[]),
  ...(can("diagnostics.quality.view","imaging.order.update")?[{path:"/diagnostics/imaging-policy/pdf",label:t("imaging policy and QA","امیجنگ پالیسی اور کوالٹی")}]:[]),
  ...(can("diagnostics.quality.view","lab.requisition.create","imaging.order.create","lab.requisition.view")?[{path:"/diagnostics/services/pdf",label:t("diagnostic services list","تشخیصی خدمات فہرست")}]:[]),
 ];
 async function pack(){
  if(!connected||packing||!papers.length)return;
  setPacking(true);setDocumentError(undefined);setDocumentNotice("");
  try{const response=await call("diagnostic-pdf-pack",{paths:papers.map(x=>x.path)});
   setDocumentNotice(response.saved?t("Combined PDF saved.","مشترکہ پی ڈی ایف محفوظ ہوئی۔"):t("PDF save cancelled.","پی ڈی ایف محفوظ کرنا منسوخ۔"));
  }catch(error){setDocumentError(error);}finally{setPacking(false);}
 }
 const choose=(id:number)=>setSelected(id);
 const reasons=(title:string,rows:diag.DiagnosticsCountOut[])=>block(title,[t("Reason or group","وجہ یا گروہ"),t("Count","تعداد")],rows.map(x=>[x.value,x.count]));
 return <section data-screen={screenId}>
  <QualityHeading title={t("Diagnostic services quality (MSDS)","تشخیصی خدمات کا معیار (ایم ایس ڈی ایس)")} text={t("Review timeliness, quality measures and evidence for the selected period.","منتخب مدت میں بروقت نتائج، معیار اور شواہد دیکھیں۔")} onHelp={onOpenHelp}/>
  {view==="open_work"&&<p className="notice" role="status">{t("No new work for the retiring service. Review the existing records here.","بند ہوتی سروس کے لیے نیا کام نہیں۔ موجودہ ریکارڈ یہاں دیکھیں۔")}</p>}
  {view==="records"&&<p className="notice" role="status">{t("Diagnostic records and history.","تشخیصی ریکارڈ اور تاریخ۔")}</p>}
  {!visible?<Empty>{t("Diagnostic quality is unavailable in this service view.","اس سروس منظر میں تشخیصی معیار دستیاب نہیں۔")}</Empty>:<>
   <QualityPeriod range={range} apply={setRange}>
    <Field label={t("Diagnostic service","تشخیصی خدمت")}><select data-help="dq.service" value={service} onChange={e=>setService(e.target.value as Service)}><option value="Lab">{t("Laboratory","لیبارٹری")}</option><option value="Imaging">{t("Imaging","امیجنگ")}</option></select></Field>
    <button type="button" data-help="dq.service" onClick={()=>setRefreshCount(n=>n+1)}>{t("Refresh diagnostics","تشخیص تازہ کریں")}</button>
   </QualityPeriod>
   {quality&&<>
    <LoadState {...turn} retry={turn.reload}/><LoadState {...stats} retry={stats.reload}/>
    {turnaround&&<>
     <article className="card"><h2>{t("Turnaround score","بروقت نتائج کا معیار")} · {turnaround.score}</h2><p><bdi>{turnaround.date_from} – {turnaround.date_to}</bdi> · {turnaround.service}</p></article>
     {block(t("Results by turnaround class","نتائج حسب درجۂ وقت"),[t("Class","درجہ"),t("On time / due","بروقت / واجب"),t("Measured / target","پیمائش / ہدف"),t("Median / p90 min","درمیانی / نوے فیصدی منٹ"),t("Wait min / within target","انتظار منٹ / ہدف میں")],turnaround.classes.map(x=>[x.turnaround_class,`${x.on_time} / ${x.total}`,<>{rate(x.pct,x.target_pct)} / {x.target_pct}%</>,`${value(x.median_minutes)} / ${value(x.p90_minutes)}`,`${value(x.median_wait_minutes)} / ${percent(x.wait_pct)}`]))}
     {block(t("By test or modality","ٹیسٹ یا طریقہ"),[t("Item","آئٹم"),t("Class","درجہ"),t("On time / total","بروقت / کل"),t("On time","بروقت"),t("Median / target min","درمیانی / ہدف منٹ")],turnaround.by_item.map(x=>[`${x.item_key} · ${x.item_name}`,x.turnaround_class,`${x.on_time} / ${x.total}`,percent(x.pct),`${value(x.median_minutes)} / ${value(x.target_minutes)}`]))}
     {block(t("Late diagnostic results","تاخیر شدہ تشخیصی نتائج"),[t("Reference / patient","حوالہ / مریض"),t("Item","آئٹم"),t("Started / due / done","آغاز / واجب / مکمل"),t("Elapsed / target min","گزرے / ہدف منٹ"),t("Reason / partner","وجہ / شراکت دار")],turnaround.late.map(x=>[<><bdi>{x.reference} · {x.mrn}</bdi> · {x.patient_name}</>,`${x.item_name} · ${x.turnaround_class}`,<>{date(x.started_at)}<br/>{date(x.due_at)}<br/>{date(x.done_at)}</>,`${value(x.minutes_taken)} / ${value(x.target_minutes)}`,<>{x.delay_reason??"—"} · {x.partner_name??"—"}</>]))}
    </>}
    {data&&<>
     <article className="card"><h2>{t("Diagnostic statistics","تشخیصی اعداد")}</h2>
      <p>{t("Lab / Imaging scores","لیبارٹری / امیجنگ معیار")} · {data.lab_score} / {data.imaging_score}</p>
      <p>{t("Samples collected / rejected","نمونے جمع / مسترد")} · {data.samples_collected} / {data.samples_rejected} · {percent(data.rejection_rate_pct)}</p>
      <p>{t("Examinations / repeats","معائنے / دہرائے گئے")} · {data.exams_performed} / {data.repeated_exposures} · {percent(data.repeat_rate_pct)}</p>
      <p>{t("Critical results","اہم نتائج")} · {data.critical_results}</p>
     </article>
     {block(t("MSDS measures","ایم ایس ڈی ایس پیمائش"),[t("Measure","پیمائش"),"MSDS",t("Numerator / denominator","شمار کنندہ / مخرج"),t("Percent","فیصد")],data.measures.map(x=>[x.title,x.msds,`${x.numerator} / ${x.denominator}`,rate(x.pct,100)]))}
     {reasons(t("Sample rejections by reason","وجہ کے لحاظ سے مسترد نمونے"),data.rejections_by_reason)}
     {reasons(t("Repeats by reason","وجہ کے لحاظ سے دہرائے گئے"),data.repeats_by_reason)}
     {reasons(t("Repeats by modality","طریقے کے لحاظ سے دہرائے گئے"),data.repeats_by_modality)}
     {reasons(t("Critical results by test","ٹیسٹ کے لحاظ سے اہم نتائج"),data.critical_by_test)}
     {block(t("Partner timeliness","شراکت دار کی بروقت کارکردگی"),[t("Partner","شراکت دار"),t("Service","خدمت"),t("Sent / returned / on time","بھیجے / واپس / بروقت"),t("Percent","فیصد"),t("Rejected","مسترد")],data.partners.map(x=>[x.name,x.services,`${x.sent} / ${x.returned} / ${x.on_time}`,percent(x.pct),x.rejected]))}
    </>}
   </>}
   {papers.length>0&&<article className="card"><h2>{t("Documents for the surveyor","معائنہ کار کے لیے دستاویزات")}</h2>
    {combined?<button data-help="dq.pack" disabled={!connected||packing} onClick={()=>void pack()}>{t("Save combined diagnostic PDF","مشترکہ تشخیصی پی ڈی ایف محفوظ کریں")}</button>:<QualityPaper documents={papers} disabled={!connected}/>}
    <ErrorBox error={documentError}/>{documentNotice&&<p role="status">{documentNotice}</p>}
   </article>}
   {workAccess&&<><LoadState {...work} retry={work.reload}/>
    {!work.loading&&!work.error&&block(t("Diagnostics worklist","تشخیصی کام کی فہرست"),[t("Task","کام"),t("Patient","مریض"),t("Due","واجب"),t("Details","تفصیل")],(work.data??[]).map(x=>[
     <>{x.title}{x.is_overdue&&<strong className="error"> · {t("Overdue","تاخیر شدہ")}</strong>}</>,<>{x.patient_name} · <bdi>{x.mrn}</bdi></>,date(x.due_at),
     <>{x.detail}{sendAccess&&x.send_out_id&&<button data-help="dq.send" onClick={()=>choose(x.send_out_id!)}>{t("Read dispatch","روانگی پڑھیں")}</button>}</>]))}</>}
   {repeatAccess&&<><LoadState {...repeats} retry={repeats.reload}/>
    {!repeats.loading&&!repeats.error&&block(t("Repeated imaging exposures","دہرائی گئی امیجنگ"),[t("Order and patient","آرڈر اور مریض"),t("Modality / body part","طریقہ / جسم کا حصہ"),t("Reason / count","وجہ / تعداد"),t("Recorded","درج")],(repeats.data??[]).map(x=>[
     <><bdi>{x.order_number} · {x.mrn}</bdi> · {x.patient_name}</>,`${x.modality} · ${value(x.body_part)}`,<>{x.reason} · {x.exposures} · {x.note}</>,`${date(x.recorded_at)} · ${x.recorded_by_name}`]))}</>}
   {sendAccess&&<article className="card"><h2>{t("External laboratory dispatches","بیرونی لیبارٹری روانگی")}</h2>
    <div className="toolbar"><Field label={t("Dispatch partner","روانگی شراکت دار")}><select data-help="dq.send" value={partner??""} disabled={partners.loading||!!partners.error} onChange={e=>setPartner(Number(e.target.value)||undefined)}>
      <option value="">{t("All partners","تمام شراکت دار")}</option>{partners.data?.filter(x=>x.services!=="Imaging").map(x=><option key={x.partner_id} value={x.partner_id}>{x.name}</option>)}
     </select></Field><label><input data-help="dq.send" type="checkbox" checked={outstanding} onChange={e=>setOutstanding(e.target.checked)}/> {t("Outstanding only","صرف باقی")}</label></div>
    <LoadState {...send} retry={send.reload}/>
    {!send.loading&&!send.error&&<QualityTable columns={[t("Manifest","روانگی فہرست"),t("Partner","شراکت دار"),t("Dispatched / due","روانہ / واجب"),t("Samples / returned / rejected / outstanding","نمونے / واپس / مسترد / باقی")]}
     rows={(send.data??[]).map(x=>({key:x.send_out_id,cells:[<button data-help="dq.send" onClick={()=>choose(x.send_out_id)}>{x.manifest_number}</button>,x.partner_name,`${date(x.dispatched_at)} / ${date(x.due_at)}`,`${x.samples} / ${x.returned} / ${x.rejected} / ${x.outstanding}`]}))}
     empty={t("No external dispatches match these filters.","ان فلٹرز سے کوئی بیرونی روانگی نہیں ملی۔")}/>}
    {selected&&<LoadState {...detail} retry={detail.reload}/>}
    {current&&<><h3><bdi>{current.manifest_number}</bdi> · {current.partner_name}</h3><p>{current.dispatched_by_name} · {current.courier} · {current.note}</p>
     <QualityTable columns={[t("Sample and patient","نمونہ اور مریض"),t("Test","ٹیسٹ"),t("Status","حالت"),t("Partner result","شراکت دار نتیجہ")]}
      rows={current.items.map((x,i)=>({key:i,cells:[<><bdi>{x.barcode} · {x.mrn}</bdi> · {x.patient_name}</>,`${x.code} · ${x.test_name}`,`${x.sample_status} · ${x.item_status} · ${value(x.rejection_code)}`,<>{date(x.partner_reported_at)} · {x.partner_report_ref}</>]}))} empty="—"/></>}
   </article>}
   {criticalAccess&&<><Field label={t("Critical result status","اہم نتیجے کی حالت")}><select data-help="dq.critical" value={criticalStatus} onChange={e=>setCriticalStatus(e.target.value as typeof criticalStatus)}>
    <option value="">{t("All statuses","تمام حالتیں")}</option>{["Open","Communicated","Acknowledged"].map(x=><option key={x}>{x}</option>)}
    </select></Field><LoadState {...critical} retry={critical.reload}/>
    {!critical.loading&&!critical.error&&block(t("Critical result register","اہم نتائج رجسٹر"),[t("Reference and patient","حوالہ اور مریض"),t("Test and finding","ٹیسٹ اور نتیجہ"),t("Reported / due","رپورٹ / واجب"),t("Status and action","حالت اور عمل")],(critical.data??[]).map(x=>[
      <><bdi>{x.critical_number} · {x.mrn}</bdi> · {x.patient_name}</>,<>{x.test_name} · {x.finding} · {x.notifiable_disease}</>,`${date(x.reported_at)} / ${date(x.communicate_due_at)}`,<>{x.status} · {x.action_taken}{x.is_overdue&&<strong className="error"> · {t("Overdue","تاخیر شدہ")}</strong>}</>]))}</>}
   {partnerAccess&&<><LoadState {...partners} retry={partners.reload}/>
    {!partners.loading&&!partners.error&&block(t("Diagnostic partners","تشخیصی شراکت دار"),[t("Partner and services","شراکت دار اور خدمات"),t("Registration and licence","رجسٹریشن اور لائسنس"),t("MOU and turnaround","معاہدہ اور وقت"),t("Contact and status","رابطہ اور حالت")],(partners.data??[]).map(x=>[
     `${x.name} · ${x.services}`,<>{x.phc_registration} · {x.accreditation} · {x.pnra_licence}</>,<>{x.mou_reference} · {x.mou_valid_until} · {x.turnaround_hours} {t("hours","گھنٹے")}</>,<>{x.contact} · {x.is_active?t("Active","فعال"):t("Inactive","غیر فعال")}{x.mou_expired&&<strong className="error"> · {t("MOU expired","معاہدہ ختم")}</strong>}</>]))}</>}
  </>}
 </section>;
}
