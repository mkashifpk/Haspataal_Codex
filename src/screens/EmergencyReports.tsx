import { useState } from "react";
import type { ClinicalUser } from "../clinical-context";
import { Empty, Field, LoadState, useLoad } from "../components";
import * as er from "../generated/er_register";
import { erStatistics } from "../generated/er_statistics";
import { formatHospitalTime } from "../hospital-time";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod, QualityTable } from "./QualityRegister";

type View = "full"|"open_work"|"records"|"setup"|"hidden";
const dispositionLabels={Admitted:"داخل",Discharged:"ڈسچارج",Referred:"ریفر",LAMA:"طبی مشورے کے خلاف روانگی",DischargedOnRequest:"درخواست پر ڈسچارج",LeftWithoutBeingSeen:"معائنے کے بغیر روانگی",Died:"وفات",BroughtDead:"مردہ لائے گئے"} as const;
const colours={Red:"#aa2424",Orange:"#9f4008",Yellow:"#806000",Green:"#24683d",Blue:"#2353a0",White:"#68727a",Black:"#303030"} as const;
function Triaged({value}:{value:Pick<er.ErVisitOut,"triage_level"|"triage_level_name"|"triage_colour">}){
 return value.triage_level===null?<>{t("Not triaged","ٹریاج نہیں ہوا")}</>:<span style={{borderInlineStart:`4px solid ${value.triage_colour?colours[value.triage_colour]:"currentColor"}`,paddingInlineStart:8}}>
  {value.triage_level} · {value.triage_level_name??"—"}
 </span>;
}
function HistoryView({view}:{view?:View}){
 if(view==="open_work")return <p className="notice" role="status">{t("No new emergency visits from now on. Existing work remains available.","اب نئے ایمرجنسی وزٹ نہیں۔ موجودہ کام دستیاب ہے۔")}</p>;
 if(view==="records")return <p className="notice" role="status">{t("Emergency records and history.","ایمرجنسی ریکارڈ اور تاریخ۔")}</p>;
 return null;
}
type Common={user:ClinicalUser;view?:View;timeZone?:string;revision:number;onOpenHelp:()=>void};
export function EmergencyRegister({user,view,timeZone,revision,onOpenHelp}:Common){
 const read=user.permissions.includes("er.visit.view")&&["full","open_work","records"].includes(view??"");
 const [range,setRange]=useState(()=>currentMonth(timeZone));
 const [disposition,setDisposition]=useState<keyof typeof dispositionLabels|"">("");
 const [level,setLevel]=useState<number>();
 const [openOnly,setOpenOnly]=useState(false);
 const [selected,setSelected]=useState<number>();
 const list=useLoad(()=>read&&range.date_from?er.listVisitsEr({...range,disposition:disposition||undefined,triage_level:level,open_only:openOnly||undefined,limit:500}):Promise.resolve([]),[read,range,disposition,level,openOnly,revision]);
 const detail=useLoad(()=>read&&selected?er.getVisit(selected):Promise.resolve(undefined),[read,selected,revision]);
 const row=read&&!detail.loading&&!detail.error&&detail.data?.er_visit_id===selected?detail.data:undefined;
 const date=(value:string|null)=>value?(timeZone?formatHospitalTime(value,timeZone):value):"—";
 return <section data-screen="er_register">
  <QualityHeading title={t("ER register (emergency log book)","ایمرجنسی رجسٹر")} text={t("Review arrivals, triage, departure and time still open.","آمد، ٹریاج، روانگی اور کھلا وقت دیکھیں۔")} onHelp={onOpenHelp}/>
  <HistoryView view={view}/>
  {read?<>
   <QualityPeriod range={range} apply={next=>{setRange(next);setSelected(undefined);}}>
    <Field label={t("Disposition","روانگی کی حالت")}><select data-help="err.filter" value={disposition} onChange={e=>setDisposition(e.target.value as typeof disposition)}>
     <option value="">{t("All dispositions","تمام حالتیں")}</option>{Object.entries(dispositionLabels).map(([en,ur])=><option key={en} value={en}>{t(en,ur)}</option>)}
    </select></Field>
    <Field label={t("Triage level","ٹریاج سطح")}><select data-help="err.filter" value={level??""} onChange={e=>setLevel(Number(e.target.value)||undefined)}>
     <option value="">{t("All levels","تمام سطحیں")}</option>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}
    </select></Field>
    <label><input data-help="err.filter" type="checkbox" checked={openOnly} onChange={e=>setOpenOnly(e.target.checked)}/> {t("Still open only","صرف کھلے")}</label>
    <button type="button" data-help="err.filter" onClick={()=>{void list.reload();void detail.reload();}}>{t("Refresh register","رجسٹر تازہ کریں")}</button>
   </QualityPeriod>
   <LoadState {...list} retry={list.reload}/>
   {!list.loading&&!list.error&&<QualityTable columns={[t("ER number","ای آر نمبر"),t("Arrival","آمد"),t("Patient","مریض"),t("Level","سطح"),t("Stage or disposition","مرحلہ یا روانگی"),t("Departure","روانگی"),"MLC"]}
    rows={(list.data??[]).map(x=>({key:x.er_visit_id,cells:[<button data-help="err.detail" onClick={()=>setSelected(x.er_visit_id)}>{x.er_number}</button>,date(x.arrived_at),<>{x.patient_name} · <bdi>{x.mrn}</bdi></>,<Triaged value={x}/>,<>{x.disposition?t(x.disposition,dispositionLabels[x.disposition]):x.stage}
      {!x.departed_at&&<> · {x.minutes_in_er} {t("min open","منٹ کھلا")}{x.flags.length>0&&<strong className="error"> · {x.flags.join(", ")}</strong>}</>}</>,date(x.departed_at),x.mlc_number??"—"]}))}
    empty={t("No emergency visits match this period and filters.","اس مدت اور فلٹر سے کوئی ایمرجنسی وزٹ نہیں ملا۔")}/>}
   {selected&&<LoadState {...detail} retry={detail.reload}/>}
   {row&&<article className="card"><h2><bdi>{row.er_number}</bdi></h2>
    <p>{row.patient_name} · <bdi>{row.mrn}</bdi> · {date(row.arrived_at)} · {row.arrival_mode} · <Triaged value={row}/></p>
    <p>{t("Presenting complaint","بنیادی شکایت")} · {row.presenting_complaint??"—"}</p>
    <p>{t("First seen","پہلا معائنہ")} · {date(row.seen_at)} · {row.seen_by_name??"—"} · {row.mlc_number??"—"}</p>
    <p>{row.stage} · {row.disposition&&t(row.disposition,dispositionLabels[row.disposition])} · {date(row.departed_at)} · {row.condition_at_departure}</p>
    {[row.departure_note,row.follow_up_advice,row.referred_to,row.referral_reason,row.statement_signed_by,row.death_number,row.departure_stamp?.text].filter(Boolean).map((x,i)=><p key={i}>{x}</p>)}
    <h3>{t("Triage assessments","ٹریاج جائزے")}</h3>
    <QualityTable columns={[t("Time","وقت"),t("Complaint","شکایت"),t("Suggested / assigned","تجویز / مقرر"),t("Override / author","تبدیلی / مصنف")]}
     rows={row.triages.map(x=>({key:x.assessment_id,cells:[date(x.assessed_at),x.presenting_complaint,`${x.suggested_level} / ${x.assigned_level} · ${x.assigned_level_name}`,<>{x.override_reason} · {x.author_stamp?.text}</>]}))} empty={t("No triage assessments recorded.","کوئی ٹریاج جائزہ درج نہیں۔")}/>
    <h3>{t("Stage history","مراحل کی تاریخ")}</h3>
    <QualityTable columns={[t("Time","وقت"),t("From / to","سے / تک"),t("Note and author","نوٹ اور مصنف")]}
     rows={row.stages.map((x,i)=>({key:i,cells:[date(x.at),`${x.from_stage??"—"} → ${x.to_stage}`,<>{x.note} · {x.by_name}</>]}))} empty={t("No stage history recorded.","مراحل کی تاریخ درج نہیں۔")}/>
   </article>}
  </>:<Empty>{t("Emergency register access is required.","ایمرجنسی رجسٹر تک رسائی درکار ہے۔")}</Empty>}
 </section>;
}
const pct=(n:number|null)=>n===null?"—":`${n}%`;
export function EmergencyStatistics({screenId,user,view,timeZone,revision,onOpenHelp}:Common&{screenId:"er_statistics"|"er_statistics_owner"}){
 const permitted=user.permissions.includes("er.statistics.view")&&["full","open_work","records"].includes(view??"");
 const [range,setRange]=useState(()=>currentMonth(timeZone));
 const report=useLoad(()=>permitted&&range.date_from?erStatistics(range):Promise.resolve(undefined),[permitted,range,revision]);
 const data=permitted&&!report.loading&&!report.error?report.data:undefined;
 return <section data-screen={screenId}>
  <QualityHeading title={t("Emergency department statistics","ایمرجنسی شعبے کے اعداد")} text={t("Read triage, waits and outcomes for the selected arrival period.","منتخب آمد کی مدت کے لیے ٹریاج، انتظار اور نتائج پڑھیں۔")} onHelp={onOpenHelp}/>
  <HistoryView view={view}/>
  {!permitted?<Empty>{t("Emergency statistics access is required.","ایمرجنسی اعداد تک رسائی درکار ہے۔")}</Empty>:<>
   <QualityPeriod range={range} apply={setRange}/>
   <LoadState {...report} retry={report.reload}/>
   {data&&<>
    <p><bdi>{data.date_from} – {data.date_to}</bdi></p>
    <div className="workspace-grid">{[
      [t("Visits","وزٹ"),data.visits],[t("Still open","کھلے"),data.still_open],[t("Triaged","ٹریاج ہوئے"),data.triaged],
      [t("Triaged within target","ہدف میں ٹریاج"),pct(data.triaged_within_target_pct)],[t("Triage target, min","ٹریاج ہدف، منٹ"),data.triage_target_minutes],
      [t("Median minutes to triage","ٹریاج تک درمیانی منٹ"),data.median_minutes_to_triage??"—"],
      [t("Seen before triage","ٹریاج سے پہلے معائنہ"),data.seen_before_triage],
      [t("Medico-legal opened / classed","کھلے / درجہ بند میڈیکو لیگل"),`${data.medico_legal_cases_opened} / ${data.medico_legal}`],
      [t("Medico-legal undecided","میڈیکو لیگل غیر فیصلہ"),data.medico_legal_undecided],
    ].map(([name,n])=><article className="card" key={name}><strong>{n}</strong><p>{name}</p></article>)}</div>
    {data.seen_before_triage>0&&<p className="notice">{t("Review visits seen before triage for documented resuscitation exceptions.","ٹریاج سے پہلے معائنے میں درج بحالی کے استثنا دیکھیں۔")}</p>}
    <article className="card"><h2>{t("Triage levels","ٹریاج سطحیں")}</h2><QualityTable columns={[t("Level","سطح"),t("Visits / seen","وزٹ / معائنہ"),t("Target minutes","ہدف منٹ"),t("Median minutes to doctor","ڈاکٹر تک درمیانی منٹ"),t("Within target","ہدف میں")]}
      rows={data.by_level.map(x=>({key:x.level,cells:[<Triaged value={{triage_level:x.level,triage_level_name:x.name,triage_colour:x.colour}}/>,`${x.visits} / ${x.seen}`,x.target_minutes,x.median_minutes_to_doctor??"—",pct(x.seen_within_target_pct)]}))} empty={t("No triaged visits in the period.","اس مدت میں کوئی ٹریاج وزٹ نہیں۔")}/>
      <p>{t("Overrides, more / less urgent / triages","تبدیلی، زیادہ / کم فوری / ٹریاج")} · {data.overrides.made_more_urgent} / {data.overrides.made_less_urgent} / {data.overrides.triages}</p>
    </article>
    <article className="card"><h2>{t("Waiting times","انتظار کے اوقات")}</h2><QualityTable columns={[t("Wait","انتظار"),t("Patients","مریض"),t("Median min","درمیانی منٹ"),t("90th percentile min","نوے فیصدی منٹ"),t("Longest min","طویل ترین منٹ")]}
      rows={data.waits.map(x=>({key:x.wait,cells:[x.label,x.patients,x.median_minutes??"—",x.p90_minutes??"—",x.max_minutes??"—"]}))} empty={t("No waits were measured.","کوئی انتظار نہیں ناپا گیا۔")}/></article>
    <article className="card"><h2>{t("Dispositions","روانگی کی حالتیں")}</h2><QualityTable columns={[t("Disposition","حالت"),t("Visits","وزٹ"),t("Share of visits","وزٹ میں حصہ")]}
      rows={data.dispositions.map(x=>({key:x.disposition,cells:[<strong className={x.disposition==="LeftWithoutBeingSeen"&&x.visits>0?"error":undefined}>{t(x.disposition,dispositionLabels[x.disposition])}</strong>,x.visits,data.visits?`${(100*x.visits/data.visits).toFixed(1)}%`:"—"]}))} empty={t("No departures in the period.","اس مدت میں کوئی روانگی نہیں۔")}/></article>
   </>}
  </>}
 </section>;
}
