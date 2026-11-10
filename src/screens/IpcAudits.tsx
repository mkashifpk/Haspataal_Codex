import { useState, type FormEvent } from "react";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Field, LoadState, Modal, useLoad } from "../components";
import * as ipc from "../generated/ipc_audits";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod } from "./QualityRegister";
import { ConfirmEntry, formText, permission, ReportTable, type P9cProps } from "./P9cShared";

const moments = [
  ["Before touching a patient","مریض کو چھونے سے پہلے"],
  ["Before a clean or aseptic procedure","صاف یا جراثیم سے پاک عمل سے پہلے"],
  ["After body fluid exposure risk","جسمانی رطوبت کے خطرے کے بعد"],
  ["After touching a patient","مریض کو چھونے کے بعد"],
  ["After touching patient surroundings","مریض کے اطراف کو چھونے کے بعد"],
];
const kinds = {HandHygiene:"ہاتھوں کی صفائی",Environment:"ماحول",Isolation:"علیحدگی",PersonalProtection:"ذاتی تحفظ",Sharps:"نوکیلی اشیا",Waste:"فضلہ",Sterilization:"جراثیم کشی",Other:"دیگر"} as const;

export function AuditBreakdown({audit}:{audit:ipc.AuditListOut}) {
  return <>{([[t("Compliance by kind","قسم کے مطابق تعمیل"),audit.by_kind],[t("Compliance by area","علاقے کے مطابق تعمیل"),audit.by_area]] as const).map(([title,rows])=><ReportTable key={title} title={title} columns={[t("Group","گروہ"),t("Audits","آڈٹ"),t("Compliant / observed","تعمیل / مشاہدات"),t("Rate","شرح")]} rows={rows.map((x,index)=>({key:index,cells:[x.key??"—",x.audits,x.compliant+" / "+x.observations,<span><meter min={0} max={100} value={x.compliance_pct}/>{x.compliance_pct}%</span>]}))}/>)}</>;
}

export function IpcAudits({user,connected,timeZone,revision,onOpenHelp}:P9cProps) {
  const canRead=!!permission(user,"infection.control.manage","infection.statistics.view");
  const canWrite=user.permissions.includes("infection.control.manage");
  const [range,setRange]=useState(()=>currentMonth(timeZone));
  const [kind,setKind]=useState<ipc.AuditIn["kind"]>("HandHygiene");
  const [filter,setFilter]=useState<ipc.AuditIn["kind"]|"">("");
  const [ward,setWard]=useState<number>();
  const [lineCount,setLineCount]=useState(1);
  const [draft,setDraft]=useState<"audit"|"action">();
  const [selected,setSelected]=useState<ipc.IpcAuditOut>();
  const list=useLoad(()=>canRead?ipc.listAudits({...range.date_from?range:{},kind:filter||undefined,ward_id:ward,limit:200}):Promise.resolve(undefined),[canRead,range,filter,ward,revision]);
  const wards=useLoad(()=>canWrite?ipc.bedMatrix({include_beds:false}):Promise.resolve(undefined),[canWrite,revision]);
  const departments=useLoad(()=>canWrite?ipc.departments():Promise.resolve([]),[canWrite,revision]);
  const people=useLoad(()=>draft==="action"?ipc.people():Promise.resolve([]),[draft,revision]);
  const write=useClinicalWrite(user,"ipc_audits",async(value,command)=>{
    if(command.path==="/infection/audits")setSelected(value);
    setDraft(undefined);await list.reload();
  });
  function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!canWrite||!connected||write.blocked)return;
    const f=new FormData(e.currentTarget);
    const department_id=departments.data?.find(x=>String(x.department_id)===formText(f,"department"))?.department_id;
    if(draft==="audit"){
      const lines=Array.from({length:kind==="HandHygiene"?moments.length:lineCount},(_,i)=>({
        item:kind==="HandHygiene"?moments[i][0]:formText(f,"item"+i),
        observed:Number(formText(f,"observed"+i)),compliant:Number(formText(f,"compliant"+i)),
      }));
      const invalid=lines.findIndex(x=>!x.item||x.compliant>x.observed);
      if(invalid>=0){
        const field=e.currentTarget.elements.namedItem("compliant"+invalid) as HTMLInputElement;
        field.setCustomValidity(t("Enter the item and keep compliant at or below observed.","آئٹم درج کریں اور تعمیل مشاہدے سے زیادہ نہ ہو۔"));
        field.reportValidity();
        return;
      }
      const body:ipc.AuditIn={kind,ward_id:wards.data?.wards.find(x=>String(x.ward_id)===formText(f,"ward"))?.ward_id,department_id,location:formText(f,"location")||undefined,audited_on:formText(f,"date")||undefined,lines,findings:formText(f,"findings")||undefined};
      write.start({method:"POST",path:"/infection/audits",body,permission:"infection.control.manage",protection:"idempotent",label:t("Record audit","آڈٹ درج کریں")});
    }
    if(draft==="action"&&selected){
      const owner_user_id=people.data?.find(x=>String(x.user_id)===formText(f,"owner"))?.user_id;
      if(!owner_user_id||!formText(f,"description"))return;
      const body:ipc.QualityActionIn={action_type:formText(f,"actionType") as ipc.QualityActionIn["action_type"],description:formText(f,"description"),owner_user_id,due_date:formText(f,"due"),department_id};
      write.start({method:"POST",path:"/infection/audits/"+selected.audit_id+"/actions",body,permission:"infection.control.manage",protection:"idempotent",label:t("Assign audit action","آڈٹ کارروائی تفویض کریں")});
    }
  }
  const audit=!list.loading&&!list.error?list.data:undefined;
  const canStart=canWrite&&connected&&!write.blocked;
  const kindOptions=Object.entries(kinds).map(([code,ur])=><option value={code} key={code}>{t(code,ur)}</option>);
  return <section data-screen="ipc_audits" data-unsaved={!!draft} data-write-pending={write.blocked}>
    <QualityHeading title={t("Infection control audits","انفیکشن کنٹرول آڈٹ")} text={t("Record observed practice and assign follow-up actions.","مشاہدہ شدہ عمل درج کریں اور پیروی تفویض کریں۔")} onHelp={onOpenHelp}/>
    <QualityPeriod range={range} apply={setRange}>
      <Field label={t("Audit kind","آڈٹ قسم")}><select data-help="p9c.read" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="">{t("All kinds","تمام اقسام")}</option>{kindOptions}</select></Field>
      {canWrite&&<Field label={t("Filter ward","وارڈ فلٹر")}><select data-help="p9c.read" value={ward??""} onChange={e=>setWard(wards.data?.wards.find(x=>String(x.ward_id)===e.target.value)?.ward_id)}><option value="">{t("All wards","تمام وارڈ")}</option>{wards.data?.wards.map(x=><option key={x.ward_id} value={x.ward_id}>{x.name}</option>)}</select></Field>}
    </QualityPeriod>
    {canWrite&&<button type="button" data-help="ipc.audit" disabled={!canStart} onClick={()=>{setKind("HandHygiene");setLineCount(1);setDraft("audit");write.clearError();}}>{t("New audit","نیا آڈٹ")}</button>}
    <LoadState {...list} retry={list.reload}/>
    {audit&&<><AuditBreakdown audit={audit}/><ReportTable title={t("Audit register","آڈٹ رجسٹر")} columns={[t("Audit","آڈٹ"),t("Area","علاقہ"),t("Details and findings","تفصیل اور نتائج"),t("Actions","کارروائیاں")]} rows={audit.audits.map(x=>({key:x.audit_id,cells:[
      <>{x.audit_number} · {t(x.kind,kinds[x.kind])}<br/>{x.audited_on} · {x.author_stamp.text}</>,[x.ward_name,x.department_name,x.location].filter(Boolean).join(" · ")||"—",
      <details><summary data-help="ipc.audit">{x.compliant}/{x.observations} · {x.compliance_pct}%</summary><ul>{x.details.map((d,i)=><li key={i}>{d.item} · {d.compliant}/{d.observed}</li>)}</ul><p>{x.findings}</p></details>,x.actions
    ]}))}/></>}
    {selected&&!draft&&canWrite&&<button type="button" data-help="ipc.audit" disabled={!canStart} onClick={()=>{setDraft("action");write.clearError();}}>{t("Assign an action for","کارروائی تفویض کریں")} {selected.audit_number}</button>}
    {!draft&&<ClinicalWriteFeedback write={write}/>}
    {draft&&<Modal title={draft==="audit"?t("New audit","نیا آڈٹ"):t("Assign audit action","آڈٹ کارروائی تفویض کریں")} closable={!write.blocked} onClose={()=>{if(!write.blocked)setDraft(undefined);}}>
      <form className="form" onSubmit={save} onChange={e=>{if(e.target instanceof HTMLInputElement)e.target.setCustomValidity("");}}>
        <fieldset disabled={write.blocked}>
          <LoadState {...departments} retry={departments.reload}/>
          <Field label={t("Department","شعبہ")}><select name="department" data-help="ipc.audit"><option value="">—</option>{departments.data?.map(x=><option key={x.department_id} value={x.department_id}>{x.name}</option>)}</select></Field>
          {draft==="audit"?<>
            <Field label={t("Audit kind","آڈٹ قسم")}><select data-help="ipc.audit" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>{kindOptions}</select></Field>
            <LoadState {...wards} retry={wards.reload}/>
            <Field label={t("Ward","وارڈ")}><select name="ward" data-help="ipc.audit"><option value="">—</option>{wards.data?.wards.map(x=><option key={x.ward_id} value={x.ward_id}>{x.name}</option>)}</select></Field>
            <Field label={t("Location","مقام")}><input data-help="ipc.audit" name="location" maxLength={120}/></Field>
            <Field label={t("Audited on","آڈٹ تاریخ")}><input data-help="ipc.audit" name="date" type="date" max={currentMonth(timeZone).date_to}/></Field>
            <div key={kind}>{Array.from({length:kind==="HandHygiene"?5:lineCount},(_,i)=><fieldset className="card" key={i}>
              <legend>{kind==="HandHygiene"?t(...moments[i] as [string,string]):t("Checklist item","چیک لسٹ آئٹم")+" "+(i+1)}</legend>
              {kind!=="HandHygiene"&&<Field label={t("Item checked","جانچا گیا آئٹم")}><input data-help="ipc.audit" name={"item"+i} required maxLength={120}/></Field>}
              <Field label={t("Opportunities observed","مشاہدہ شدہ مواقع")}><input data-help="ipc.audit" name={"observed"+i} type="number" min={0} max={100000} required defaultValue={0}/></Field>
              <Field label={t("Actions done","کی گئی کارروائیاں")}><input data-help="ipc.audit" name={"compliant"+i} type="number" min={0} max={100000} required defaultValue={0}/></Field>
            </fieldset>)}</div>
            {kind!=="HandHygiene"&&<button data-help="ipc.audit" type="button" disabled={lineCount>=100} onClick={()=>setLineCount(x=>x+1)}>{t("Add checklist line","چیک لسٹ سطر شامل کریں")}</button>}
            <Field label={t("Findings","نتائج")}><textarea data-help="ipc.audit" name="findings" maxLength={2000}/></Field>
          </>:<>
            <p>{selected?.audit_number} · {selected?.findings}</p>
            <LoadState {...people} retry={people.reload}/>
            <Field label={t("Action type","کارروائی قسم")}><select data-help="ipc.audit" name="actionType"><option value="Corrective">{t("Corrective","اصلاحی")}</option><option value="Preventive">{t("Preventive","احتیاطی")}</option></select></Field>
            <Field label={t("Action description","کارروائی تفصیل")}><textarea data-help="ipc.audit" name="description" required maxLength={2000}/></Field>
            <Field label={t("Action owner","کارروائی ذمہ دار")}><select data-help="ipc.audit" name="owner" required><option value="">—</option>{people.data?.map(x=><option key={x.user_id} value={x.user_id}>{x.display_name}</option>)}</select></Field>
            <Field label={t("Due date","مقررہ تاریخ")}><input data-help="ipc.audit" name="due" type="date" required/></Field>
          </>}
          <ConfirmEntry/>
        </fieldset>
        <ClinicalWriteFeedback write={write}/>
        <button className="primary" data-help="p9c.write" disabled={!canStart}>{t("Confirm submission","ارسال کی تصدیق")}</button>
      </form>
    </Modal>}
  </section>;
}
