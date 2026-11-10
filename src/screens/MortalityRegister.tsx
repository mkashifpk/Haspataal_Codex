import { useEffect, useState, type FormEvent } from "react";
import { api as request } from "../bridge";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { Empty, Field, LoadState, Modal, useLoad } from "../components";
import * as death from "../generated/death_register";
import { formatHospitalTime } from "../hospital-time";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod, QualityTable } from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

type RegisterId = "mortality_review" | "death_register";
type Document = "certificate" | "autopsy_order";
type PatientDocument = { document_id: number; doc_type: string; title: string | null };
const countTiles: { key: keyof death.MortalityStatisticsOut; label: [string,string]; rate?: boolean }[] = [
  {key:"deaths_total",label:["Deaths","اموات"]},
  {key:"gross_death_rate_pct",label:["Gross death rate","مجموعی شرح اموات"],rate:true},
  {key:"net_death_rate_pct",label:["Net death rate","خالص شرح اموات"],rate:true},
  {key:"inpatient_within_24h",label:["Within 24 hours of admission","داخلے کے ۲۴ گھنٹوں میں"]},
  {key:"inpatient_within_48h",label:["Within 48 hours of admission","داخلے کے ۴۸ گھنٹوں میں"]},
  {key:"postoperative_deaths",label:["Post-operative deaths","آپریشن کے بعد اموات"]},
  {key:"postoperative_death_rate_pct",label:["Post-operative death rate","آپریشن کے بعد شرح اموات"],rate:true},
  {key:"deaths_within_48h_of_operation",label:["Within 48 hours of operation","آپریشن کے ۴۸ گھنٹوں میں"]},
  {key:"maternal",label:["Maternal","زچگی سے متعلق"]},{key:"neonatal",label:["Neonatal","نوزائیدہ"]},
  {key:"infant",label:["Infant","شیرخوار"]},{key:"brought_dead",label:["Brought dead","مردہ لائے گئے"]},
  {key:"medico_legal",label:["Medico-legal","میڈیکو لیگل"]},{key:"unexpected",label:["Unexpected","غیر متوقع"]},
  {key:"uncertified",label:["Uncertified","غیر تصدیق شدہ"]},
  {key:"inpatient_deaths",label:["Inpatient deaths","داخل مریضوں کی اموات"]},
  {key:"discharged_alive",label:["Discharged alive","زندہ ڈسچارج"]},
  {key:"separations",label:["Inpatient separations","داخل مریضوں کا اخراج"]},
  {key:"median_hours_to_certificate",label:["Median hours to certificate","تصدیق تک درمیانی گھنٹے"]},
  {key:"operations",label:["Operations","آپریشن"]},{key:"autopsies_requested",label:["Autopsies requested","آٹوپسی درخواستیں"]},
  {key:"autopsies_reported",label:["Autopsies reported","رپورٹ شدہ آٹوپسی"]},{key:"autopsy_major_discrepancies",label:["Major discrepancies","اہم اختلافات"]},
  {key:"autopsy_rate_pct",label:["Autopsy rate","شرح آٹوپسی"],rate:true},
];
const reasons = {Unexpected:"غیر متوقع",Maternal:"زچگی سے متعلق",Within24HoursOfAdmission:"داخلے کے ۲۴ گھنٹوں میں",Within48HoursOfOperation:"آپریشن کے ۴۸ گھنٹوں میں"} as const;

export function MortalityRegister({screenId,user,connected,readOnly,timeZone,onOpenHelp}:{
  screenId:RegisterId;user:ClinicalUser;connected:boolean;readOnly:boolean;timeZone?:string;onOpenHelp:()=>void;
}) {
  const owner = screenId === "death_register";
  const permitted = user.permissions.includes("death.register.view");
  const authorize = owner && user.permissions.includes("death.autopsy.authorize");
  const [range,setRange] = useState(() => currentMonth(timeZone));
  const [status,setStatus] = useState<"Draft"|"Certified"|"">("");
  const [selected,setSelected] = useState<number>();
  const [document,setDocument] = useState<Document>();
  const [draft,setDraft] = useState<"authorize"|"cancel">();
  const [dirty,setDirty] = useState(false);
  const [revision,setRevision] = useState(0);
  useEffect(() => window.terminal?.subscribe(event => {
    if ((event.type === "stream" && event.resync) || (event.type === "event" &&
      (event.event_type === "death.recorded" || (event.event_type === "notification.created" && ["sentinel_event","autopsy_request"].includes(event.payload.category)))))
      setRevision(n=>n+1);
  }), []);
  const statistics=useLoad(() => permitted && range.date_from ? death.mortalityStatistics(range) : Promise.resolve(undefined),[permitted,range,revision]);
  const rows=useLoad(() => permitted && range.date_from ? death.deathRegister({...range,status:status || undefined,limit:500}) : Promise.resolve([]),[permitted,range,status,revision]);
  const detail=useLoad(() => permitted && selected ? death.getDeath(selected) : Promise.resolve(undefined),[permitted,selected,revision]);
  const current=!detail.loading && !detail.error && detail.data?.death.death_id===selected ? detail.data : undefined;
  const paper=useLoad(() => permitted && selected && document ? death.deathPrint(selected,{document}) : Promise.resolve(undefined),[permitted,selected,document,revision]);
  const canReadDocuments=user.permissions.includes("patient.document.view");
  const patientId=current?.death.patient_id;
  const documents=useLoad(() => draft==="authorize" && patientId && canReadDocuments
    ? request<PatientDocument[]>("GET",`/patients/${patientId}/documents`)
    : Promise.resolve([]),[draft,patientId,canReadDocuments]);
  const refresh=()=>setRevision(n=>n+1);
  const write=useClinicalWrite(user,screenId,async()=>{setDraft(undefined);refresh();});
  const date=(value:string)=>timeZone?formatHospitalTime(value,timeZone):value;
  const stat=!statistics.loading&&!statistics.error?statistics.data:undefined;
  const selectedDeath=current?.death;
  const autopsy=current?.autopsy;
  const canAuthorize=!!selectedDeath && !selectedDeath.mlc_id && selectedDeath.status==="Certified" && autopsy?.status==="Requested" && autopsy.requested_by!==user.user_id;
  const canCancel=autopsy?.status==="Requested" || autopsy?.status==="Authorized";
  const editable=authorize&&connected&&!readOnly&&!write.blocked;
  const open=(id:number)=>{setSelected(id);setDocument(undefined);};
  const form=(kind:typeof draft)=>{setDirty(false);setDraft(kind);write.clearError();};
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!current || !draft || !editable || (draft==="authorize"?!canAuthorize:!canCancel))return;
    const data=new FormData(event.currentTarget);
    const field=(key:string)=>String(data.get(key)??"").trim();
    const id=current.death.death_id;
    const path=`/deaths/${id}`;
    let body: death.AutopsyAuthorizeIn | death.AutopsyCancelIn;
    if(draft==="authorize"){
      const doc=Number(field("document"))||null;
      if(!data.has("certify") || field("name").length<2 || field("relationship").length<2 || field("extent").length<5 || field("prosector").length<2 ||
        (doc && !documents.data?.some(x=>x.document_id===doc&&x.doc_type==="Consent")))return;
      body={certify_not_medico_legal:true,consent_given_by:field("name"),consent_relationship:field("relationship"),consent_id_number:field("identity")||null,
        consent_extent:field("extent"),consent_document_id:doc,prosector_name:field("prosector"),order_note:field("order")||null};
    }else{
      if(field("reason").length<3)return;
      body={reason:field("reason")};
    }
    write.start({method:"POST",path:`${path}/autopsy/${draft}`,body,permission:"death.autopsy.authorize",protection:"reconcile",reconcilePath:path,label:t("Save autopsy decision","آٹوپسی فیصلہ محفوظ کریں")},async()=>{
      const fresh=await death.getDeath(id);
      if(fresh.autopsy?.autopsy_id!==current.autopsy?.autopsy_id || fresh.autopsy?.row_version!==current.autopsy?.row_version ||
        (draft==="authorize"&&(fresh.death.mlc_id || fresh.death.status!=="Certified" || fresh.autopsy?.requested_by===user.user_id))){
        refresh();throw Error(t("The autopsy request changed. Read the current record before deciding.","آٹوپسی درخواست بدل گئی۔ فیصلہ کرنے سے پہلے موجودہ ریکارڈ پڑھیں۔"));
      }
    });
  }
  const group=(title:string,items:death.DeathCountOut[])=><article className="card"><h2>{title}</h2><QualityTable columns={[t("Group","گروہ"),t("Deaths","اموات")]}
    rows={items.map((x,i)=>({key:i,cells:[x.label,x.deaths]}))} empty={t("No deaths in this group.","اس گروہ میں کوئی وفات نہیں۔")}/></article>;
  return <section data-screen={screenId} data-unsaved={!!draft} data-write-pending={write.blocked}>
    <QualityHeading title={owner?t("Death register & mortality","رجسٹر اموات اور شرح اموات"):t("Mortality statistics & death register","اعداد اموات اور رجسٹر اموات")}
      text={t("Patient identities are shown for authorized hospital review.","مریضوں کی شناخت مجاز ہسپتال جائزے کے لیے دکھائی جاتی ہے۔")} onHelp={onOpenHelp}/>
    {!permitted?<Empty>{t("Death register access is required.","رجسٹر اموات تک رسائی درکار ہے۔")}</Empty>:<>
      <QualityPeriod range={range} disabled={!!draft} apply={next=>{setRange(next);setSelected(undefined);setDocument(undefined);}}>
        <Field label={t("Register status","رجسٹر کی حالت")}><select data-help="mort.list" value={status} onChange={e=>setStatus(e.target.value as typeof status)}>
          <option value="">{t("All records","تمام ریکارڈ")}</option><option value="Draft">{t("Draft","مسودہ")}</option><option value="Certified">{t("Certified","تصدیق شدہ")}</option>
        </select></Field>
        <button type="button" data-help="mort.list" onClick={refresh}>{t("Refresh register","رجسٹر تازہ کریں")}</button>
      </QualityPeriod>
      {!range.date_from&&<p role="status">{t("Choose a reporting period.","رپورٹنگ کی مدت چنیں۔")}</p>}
      <LoadState {...statistics} retry={statistics.reload}/>
      {stat&&<>
        <article className="card"><h2>{t("Mortality statistics","اعداد اموات")}</h2>
          <p><bdi>{stat.date_from} – {stat.date_to}</bdi></p>
          <div className="workspace-grid">{countTiles.map(({key,label,rate})=><div className="card" key={key}><strong>{stat[key] == null ? "—" : `${stat[key]}${rate?"%":""}`}</strong><p>{t(...label)}</p></div>)}</div>
        </article>
        <article className="card"><h2>{t("Mortality meeting agenda","اجلاس اموات کا ایجنڈا")}</h2>
          <p>{t("Unexpected and maternal deaths are sentinel events. Record the root-cause review in committee minutes.","غیر متوقع اور زچگی سے متعلق اموات سنگین واقعات ہیں۔ بنیادی وجہ کا جائزہ کمیٹی کی روداد میں درج کریں۔")}</p>
          <QualityTable columns={[t("Death record","ریکارڈ وفات"),"MRN",t("Reason for review","جائزے کی وجہ"),t("Underlying cause","بنیادی وجہ")]}
            rows={stat.review_list.map(x=>({key:x.death_id,cells:[<button data-help="mort.detail" disabled={!!draft} onClick={()=>open(x.death_id)}>{x.death_number}</button>,<bdi>{x.mrn}</bdi>,x.reasons.map(r=>t(r,reasons[r])).join(" · "),x.underlying_term?.title??x.underlying_cause??"—"]}))}
            empty={t("There are no deaths on the agenda for this period.","اس مدت کے ایجنڈے میں کوئی وفات نہیں۔")}/>
        </article>
        {group(t("By setting","جگہ کے لحاظ سے"),stat.by_setting)}
        {group(t("By manner","نوعیت کے لحاظ سے"),stat.by_manner)}
        {group(t("By department","شعبے کے لحاظ سے"),stat.by_department)}
        <article className="card"><h2>{t("Top underlying causes","اہم بنیادی وجوہ")}</h2>
          <QualityTable columns={[t("ICD category","آئی سی ڈی زمرہ"),t("Title","عنوان"),t("Deaths","اموات"),t("Example","مثال")]} rows={stat.top_underlying_causes.map((x,i)=>({key:i,cells:[x.icd_category,x.title??"—",x.deaths,x.example??"—"]}))}
            empty={t("No underlying causes in this period.","اس مدت میں کوئی بنیادی وجہ نہیں۔")}/>
        </article>
      </>}
      <article className="card"><h2>{t("Death register","رجسٹر اموات")}</h2>
        <LoadState {...rows} retry={rows.reload}/>
        {!rows.loading&&!rows.error&&<QualityTable columns={[t("Record","ریکارڈ"),t("Patient","مریض"),t("Time and setting","وقت اور جگہ"),t("Certification","تصدیق"),t("Underlying cause","بنیادی وجہ"),t("Autopsy","آٹوپسی")]}
          rows={(rows.data??[]).map(x=>({key:x.death_id,cells:[<button data-help="mort.detail" disabled={!!draft} onClick={()=>open(x.death_id)}>{x.death_number}</button>,<>{x.patient_name} · <bdi>{x.mrn}</bdi></>,
            <>{date(x.death_at)} · {x.setting}{x.mlc_number&&<> · {x.mlc_number}</>}</>,<>{x.status} {x.status==="Draft"&&Date.now()-Date.parse(x.death_at)>86400000&&<strong className="error">{t("Older than 24 hours. Remind the certifying doctor.","۲۴ گھنٹے سے زائد۔ تصدیق کرنے والے ڈاکٹر کو یاد دہانی کریں۔")}</strong>}</>,
            x.underlying_term?.title??x.underlying_cause??"—",x.autopsy_status??"—"]}))}
          empty={t("No death records match this period and status.","اس مدت اور حالت میں کوئی وفات نہیں ملی۔")}/>}
      </article>
      {selected&&<LoadState {...detail} retry={detail.reload}/>}
      {current&&<article className="card"><h2><bdi>{current.death.death_number}</bdi></h2>
        <p>{current.patient.full_name} · <bdi>{current.patient.mrn}</bdi> · {date(current.death.death_at)} · {current.death.setting} · {current.death.status}</p>
        <p>{current.death.manner} · {current.death.underlying_cause} · {current.death.underlying_term?.code} {current.death.underlying_term?.title}</p>
        <QualityTable columns={[t("Certificate line","تصدیقی سطر"),t("Cause","وجہ"),t("Interval","وقفہ"),"ICD"]}
          rows={(["a","b","c","d"] as const).map(key=>({key,cells:[key,current.death[`cause_${key}`]??"—",current.death[`cause_${key}_interval`]??"—",current.death[`cause_${key}_icd`]??"—"]}))} empty="—"/>
        {current.death.other_conditions&&<p>{t("Contributing conditions","معاون بیماریاں")} · {current.death.other_conditions}</p>}
        {current.death.certifier_name&&<p>{t("Certified by","تصدیق کنندہ")} · {current.death.certifier_name} {current.death.certifier_license}</p>}
        {current.death.body_released_at&&<p>{t("Body released","جسد حوالے کیا گیا")} · {current.death.body_released_to} · {date(current.death.body_released_at)}</p>}
        {current.corrections.map((x,i)=><p key={i}>{x.correction_text}</p>)}
        {autopsy&&<><h3>{t("Clinical autopsy","طبی آٹوپسی")} · {autopsy.status}</h3><p>{autopsy.request_reasons} · {autopsy.requested_by_name}</p>
          {autopsy.prosector_name&&<p>{t("Prosector","آٹوپسی معالج")} · {autopsy.prosector_name} · {autopsy.order_note}</p>}
          {autopsy.findings&&<p>{autopsy.findings} · {autopsy.correlation} · {autopsy.correlation_note}</p>}
          {autopsy.cancel_reason&&<p>{autopsy.cancel_reason}</p>}
          {authorize&&autopsy.status==="Requested"&&autopsy.requested_by===user.user_id&&<p>{t("Another authorized clinician must decide this request.","اس درخواست کا فیصلہ کوئی دوسرا مجاز معالج کرے۔")}</p>}
        </>}
        <div className="toolbar">
          {authorize&&canAuthorize&&<button data-help="mort.autopsy" disabled={!editable||!!draft} onClick={()=>form("authorize")}>{t("Authorize autopsy","آٹوپسی منظور کریں")}</button>}
          {authorize&&canCancel&&<button data-help="mort.autopsy" disabled={!editable||!!draft} onClick={()=>form("cancel")}>{t("Cancel autopsy","آٹوپسی منسوخ کریں")}</button>}
          {current.death.status==="Certified"&&<button data-help="mort.print" disabled={!!draft} onClick={()=>setDocument("certificate")}>{t("Read certificate print details","سرٹیفکیٹ کی پرنٹ تفصیل")}</button>}
          {(autopsy?.status==="Authorized"||autopsy?.status==="Reported")&&<button data-help="mort.print" disabled={!!draft} onClick={()=>setDocument("autopsy_order")}>{t("Read autopsy order print details","آٹوپسی آرڈر کی پرنٹ تفصیل")}</button>}
        </div>
        {document&&<LoadState {...paper} retry={paper.reload}/>}
        {document&&!paper.loading&&!paper.error&&paper.data&&paper.data.fields.death.death_id===selected&&paper.data.document_type===(document==="certificate"?"death_certificate":"autopsy_order")&&<>
          <p>{paper.data.fields.title} · <bdi>{paper.data.fields.certificate_number}</bdi> · {paper.data.fields.hospital.name}</p>
          <QualityPaper disabled={!connected||!!draft} documents={[{label:document==="certificate"?t("certificate PDF","سرٹیفکیٹ پی ڈی ایف"):t("autopsy order PDF","آٹوپسی آرڈر پی ڈی ایف"),path:`/deaths/${selected}/pdf?document=${document}`}]}/>
        </>}
      </article>}
    </>}
    {!draft&&<ClinicalWriteFeedback write={write}/>}
    {draft&&<Modal title={draft==="authorize"?t("Authorize clinical autopsy","طبی آٹوپسی منظور کریں"):t("Cancel clinical autopsy","طبی آٹوپسی منسوخ کریں")} closable={!write.blocked} onClose={()=>{
      if(!write.blocked&&(!dirty||window.confirm(t("Discard the unsent decision?","غیر ارسال شدہ فیصلہ چھوڑ دیں؟"))))setDraft(undefined);
    }}>
      <form className="form" onSubmit={submit} onChange={()=>setDirty(true)}>
        <fieldset disabled={write.blocked}>
          <p><bdi>{selectedDeath?.death_number}</bdi> · {current?.patient.full_name}</p>
          {draft==="authorize"?<>
            <label><input data-help="mort.autopsy" type="checkbox" name="certify" required/> {t("I certify that this death is not medico-legal.","میں تصدیق کرتا ہوں کہ یہ وفات میڈیکو لیگل نہیں۔")}</label>
            <Field label={t("Consenting next of kin","رضامند قریبی رشتہ دار")}><input data-help="mort.autopsy" name="name" minLength={2} maxLength={200} required/></Field>
            <Field label={t("Relationship","رشتہ")}><input data-help="mort.autopsy" name="relationship" minLength={2} maxLength={100} required/></Field>
            <Field label={t("Identity reference (optional)","شناختی حوالہ (اختیاری)")}><input data-help="mort.autopsy" name="identity" maxLength={50}/></Field>
            <Field label={t("What was explained and agreed","کیا بتایا گیا اور کس پر رضامندی ہوئی")}><textarea data-help="mort.autopsy" name="extent" minLength={5} maxLength={2000} required/></Field>
            {canReadDocuments&&<><LoadState {...documents} retry={documents.reload}/><Field label={t("Signed consent document (optional)","دستخط شدہ رضامندی (اختیاری)")}><select name="document" data-help="mort.autopsy" disabled={documents.loading||!!documents.error}><option value="">—</option>{!documents.error&&documents.data?.filter(x=>x.doc_type==="Consent").map(x=><option key={x.document_id} value={x.document_id}>{x.title??x.document_id}</option>)}</select></Field></>}
            <Field label={t("Prosector name","آٹوپسی معالج کا نام")}><input data-help="mort.autopsy" name="prosector" minLength={2} maxLength={200} required/></Field>
            <Field label={t("Order note (optional)","آرڈر نوٹ (اختیاری)")}><textarea data-help="mort.autopsy" name="order" maxLength={2000}/></Field>
          </>:<Field label={t("Cancellation reason","منسوخی کی وجہ")}><textarea data-help="mort.autopsy" name="reason" minLength={3} maxLength={1000} required/></Field>}
        </fieldset>
        <ClinicalWriteFeedback write={write} onReviewed={()=>{setDraft(undefined);refresh();}}/>
        <button type="submit" className="primary" data-help="mort.autopsy" disabled={!editable||!current}>{t("Confirm decision","فیصلے کی تصدیق کریں")}</button>
      </form>
    </Modal>}
  </section>;
}
