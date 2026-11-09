import {useState, type FormEvent} from "react";
import * as home from "../generated/home_visit_policy";
import {Field, LoadState} from "../components";
import {useLoad} from "../components";
import {ClinicalWriteFeedback, useClinicalWrite} from "../clinical-write";
import type {ClinicalUser} from "../clinical-context";
import {bilingual as t} from "../i18n";
import {QualityHeading} from "./QualityRegister";
import {QualityPaper} from "./QualityPaper";

export function HomeVisitPolicy({user, connected, readOnly, revision, onOpenHelp, openFacility}: {
  user:ClinicalUser; connected:boolean; readOnly:boolean; noNewWork:boolean; timeZone?:string; revision:number;
  onOpenHelp:()=>void; openFacility:()=>void;
}) {
  const [draft,setDraft] = useState<string>();
  const [checked,setChecked] = useState(false);
  const [baseline,setBaseline] = useState<string | null>();
  const policy = useLoad(home.policy,[revision]);
  const facility = useLoad(home.getEstablishment,[revision]);
  const write = useClinicalWrite(user,"home_visit_policy",async()=>{setDraft(undefined);await policy.reload();});
  const current = !policy.loading && !policy.error ? policy.data : undefined;
  const service = !facility.loading && !facility.error ? facility.data?.capabilities.find(c=>c.capability==="home_visits") : undefined;
  const canEdit = connected && !readOnly && !!current && user.permissions.includes("admin.settings.manage") && !write.blocked;
  const changed = draft !== undefined && current && current.arrangements !== baseline;
  function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!canEdit || !checked || draft===undefined || !draft.trim() || changed) return;
    write.start({method:"PUT",path:"/admin/settings/home_visit_arrangements",body:{value:draft.trim()},permission:"admin.settings.manage",protection:"reconcile",reconcilePath:"/home-visits/policy",label:t("Save home visit arrangements","گھریلو دورہ انتظام محفوظ")},async()=>{
      if ((await home.policy()).arrangements !== baseline) {await policy.reload();throw Error(t("The arrangements changed. Review the current policy before editing again.","انتظام بدل گیا۔ نئی ترمیم سے پہلے موجودہ پالیسی دیکھیں۔"));}
    });
  }
  return <section data-screen="home_visit_policy" data-unsaved={draft!==undefined} data-write-pending={write.blocked}>
    <QualityHeading title={t("Home visits: our policy and its notice","گھریلو دورے: پالیسی اور نوٹس")} text={t("Read the current service policy and print the notice for patients.","موجودہ خدمت پالیسی پڑھیں اور مریضوں کے لیے نوٹس پرنٹ کریں۔")} onHelp={onOpenHelp}/>
    <LoadState {...policy} retry={()=>void policy.reload()}/><LoadState {...facility} retry={()=>void facility.reload()}/>
    {current && <article className="card"><h2>{current.provided?t("Home visits are provided","گھریلو دورے فراہم کیے جاتے ہیں"):t("Home visits are not provided","گھریلو دورے فراہم نہیں کیے جاتے")}</h2>
      {current.arrangements && <p style={{whiteSpace:"pre-wrap"}}>{current.arrangements}</p>}
      <p>{t("Display the current notice where patients can see it. Replace it after a change.","موجودہ نوٹس مریضوں کی نظر کے سامنے لگائیں۔ تبدیلی پر نیا لگائیں۔")}</p>
      {(user.permissions.includes("homevisit.view") || user.permissions.includes("msds.view")) && <QualityPaper disabled={!connected || write.blocked} documents={[{label:t("home visit notice","گھریلو دورہ نوٹس"),path:"/home-visits/notice/pdf"}]}/>}
      {canEdit && draft===undefined && <button data-help="hvp.edit" onClick={()=>{setBaseline(current.arrangements);setDraft(current.arrangements??"");setChecked(false);write.clearError();}}>{t("Edit arrangements","انتظام بدلیں")}</button>}
    </article>}
    <ClinicalWriteFeedback write={write} onReviewed={()=>{setDraft(undefined);void policy.reload();}}/>
    {draft!==undefined && <form className="card" onSubmit={save}>
      <h2>{t("Home visit arrangements","گھریلو دورہ انتظام")}</h2>
      <p>{t("Describe the hours, service area, how to ask, who goes and the kit. Facility settings checks that arrangements are ready before activating the service.","اوقات، علاقہ، درخواست طریقہ، جانے والا عملہ اور کٹ لکھیں۔ خدمت شروع کرنے سے پہلے سہولت ترتیبات انتظام چیک کرتی ہیں۔")}</p>
      {changed && <p role="alert">{t("The policy changed. Compare it, cancel this draft and open it again.","پالیسی بدل گئی۔ موازنہ، مسودہ منسوخ اور دوبارہ کھولیں۔")}</p>}
      <fieldset disabled={!canEdit || !!changed}>
        <Field label={t("Arrangements","انتظام")}><textarea data-help="hvp.edit" name="arrangements" required value={draft} onChange={e=>{setDraft(e.target.value);setChecked(false);}}/></Field>
        <label className="check"><input data-help="hvp.save" type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>{t("I checked the arrangements for the patient notice.","مریض نوٹس کا انتظام چیک کیا۔")}</label>
        <button type="submit" data-help="hvp.save" disabled={!checked || !draft.trim()}>{t("Save arrangements","انتظام محفوظ کریں")}</button>
      </fieldset><button data-help="hvp.cancel" type="button" disabled={write.blocked} onClick={()=>{setDraft(undefined);write.clearError();}}>{t("Cancel unsent changes","غیر ارسال تبدیلی منسوخ")}</button>
    </form>}
    {service && <article className="card"><h2>{t("Service settings","خدمت ترتیبات")}</h2><p>{t("Activation and retirement are managed in Facility settings.","فعال یا سبک دوش کرنا سہولت ترتیبات میں ہے۔")}</p>{user.permissions.includes("establishment.manage") && <button data-help="hvp.facility" disabled={write.blocked} onClick={openFacility}>{t("Open Facility settings","سہولت ترتیبات کھولیں")}</button>}</article>}
  </section>;
}
