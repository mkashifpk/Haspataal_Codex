import { useState, type FormEvent, type ReactNode } from "react";
import type { ClinicalUser } from "../clinical-context";
import { mayChangeClinicalContext } from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite, type ClinicalCommand } from "../clinical-write";
import { Empty, Field, LoadState, Modal, useLoad } from "../components";
import { bilingual as t } from "../i18n";
import * as api from "../generated/record_review_report";
import { QualityHeading } from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";
import { RecordReviewCycles } from "./RecordReviewCycles";

type Draft =
  | { kind: "resolve"; row: api.DeficiencyOut }
  | { kind: "action"; cycle: number }
  | { kind: "complete"; row: api.QualityActionOut }
  | { kind: "criterion"; row?: api.CriterionOut };
const base = "/quality/record-reviews";
const findings = "/quality/record-review-deficiencies";
const checklist = "/quality/record-review/criteria";
const actionList = "/quality/actions?source=RecordReview&limit=1000";
const scope = (cycle: number) => `${findings}?cycle_id=${cycle}&limit=1000`;
const categories = ["Timeliness", "Legibility", "Completeness"] as const;
const statuses = { Met: "پورا", PartlyMet: "جزوی", NotMet: "نامکمل", Open: "کھلی", Corrected: "درست شدہ", Acknowledged: "تسلیم شدہ", Withdrawn: "واپس لی گئی", Done: "مکمل", Cancelled: "منسوخ" } as const;
function state(value: keyof typeof statuses) {
  return t(value, statuses[value]);
}
function table(headers: string[], rows: ReactNode[][]) {
  if (!rows.length) return <Empty>{t("No entries in this section.", "اس حصے میں کوئی اندراج نہیں۔")}</Empty>;
  return <div className="table-scroll" style={{overflowX:"auto"}}><table>
    <thead><tr>{headers.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody>
  </table></div>;
}

export function RecordReviewReport({ user, screenId, connected, readOnly, revision, onOpenHelp }: {
  user: ClinicalUser;
  screenId: "record_review_report" | "record_review_overview";
  connected: boolean;
  readOnly: boolean;
  revision: number;
  onOpenHelp: () => void;
}) {
  const manage = user.permissions.includes("quality.review.manage");
  const read = manage || user.permissions.includes("quality.review.view");
  const actionManager = user.permissions.includes("quality.action.manage");
  const [cycle, setCycle] = useState<number>();
  const [cycleStatus, setCycleStatus] = useState<api.CycleListItemOut["status"] | "">("");
  const [filter, setFilter] = useState<api.DeficiencyOut["status"] | "">("");
  const [draft, setDraft] = useState<Draft>();
  const [changed, setChanged] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const cycles = useLoad(() => read ? api.listCyclesQualityRecordReviews({status:cycleStatus || undefined,limit:200}) : Promise.resolve([]), [read, cycleStatus, revision]);
  const report = useLoad(() => read && cycle ? api.reportQualityRecordReviews(cycle) : Promise.resolve(undefined), [read, cycle, revision]);
  const deficiencies = useLoad(async () => manage && cycle
    ? { cycle, filter, rows: await api.deficiencies({cycle_id:cycle,status:filter || undefined,limit:1000}) }
    : undefined, [manage, cycle, filter, revision]);
  const actions = useLoad(() => read ? api.listActions({source:"RecordReview",limit:1000}) : Promise.resolve([]), [read, revision]);
  const criteria = useLoad(() => read ? api.criteria() : Promise.resolve([]), [read, revision]);
  const composingAction = draft?.kind === "action";
  const people = useLoad(() => composingAction ? api.people() : Promise.resolve([]), [composingAction]);
  const departments = useLoad(() => composingAction ? api.departments() : Promise.resolve([]), [composingAction]);
  const active = !report.loading && !report.error && report.data?.cycle.cycle_id === cycle ? report.data : undefined;
  const rows = deficiencies.data;
  const currentFindings = manage && !deficiencies.loading && !deficiencies.error && rows?.cycle === cycle && rows?.filter === filter ? rows?.rows : undefined;
  const visibleActions = !actions.loading && !actions.error ? (actions.data ?? []).filter(row => row.cycle_id === cycle) : [];
  const writable = connected && !readOnly;
  const refresh = () => Promise.all([report.reload(), deficiencies.reload(), actions.reload(), criteria.reload()]);
  const write = useClinicalWrite(user, screenId, async () => {
    setDraft(undefined);
    await refresh();
  });
  function open(next: Draft) {
    setDraft(next);
    setChanged(false);
    setFailure(undefined);
    write.clearError();
  }
  function close() {
    if (write.blocked || (changed && !window.confirm(t("Discard this unsent form?", "یہ غیر ارسال شدہ فارم چھوڑ دیں؟")))) return;
    setDraft(undefined);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !writable || write.blocked) return;
    const values = new FormData(event.currentTarget);
    const value = (key: string) => String(values.get(key) ?? "").trim();
    const note = value("note");
    const versionChanged = () => Error(t("The record changed or is no longer available. Close and refresh before editing again.", "ریکارڈ بدل گیا یا دستیاب نہیں۔ دوبارہ ترمیم سے پہلے بند اور تازہ کریں۔"));
    const command = (path: string, body: unknown, reconcilePath?: string, method: ClinicalCommand["method"] = "POST") => ({
      method, path, body, reconcilePath, protection: reconcilePath ? "reconcile" as const : "idempotent" as const,
      permission: "quality.review.manage", label: t("Save review change", "جائزے کی تبدیلی محفوظ کریں"),
    });
    setFailure(undefined);
    if (draft.kind === "resolve" && manage && draft.row.cycle_id === cycle) {
      const row = draft.row;
      const status = value("status") as "Acknowledged" | "Withdrawn";
      if (note.length < 3 || !["Acknowledged","Withdrawn"].includes(status)) return;
      write.start(command(`${findings}/${row.deficiency_id}/resolve`, {status,note}, scope(row.cycle_id)), async () => {
        const live = await api.deficiencies({cycle_id:row.cycle_id,limit:1000});
        if (!live.some(x => x.deficiency_id === row.deficiency_id && x.status === "Open")) throw versionChanged();
      });
    }
    if (draft.kind === "action" && manage && draft.cycle === cycle && active?.cycle.status === "InReview") {
      const owner = Number(value("owner"));
      const department = Number(value("department")) || null;
      const criterion = value("criterion") || null;
      if (people.loading || people.error || departments.loading || departments.error ||
        !people.data?.some(x => x.user_id === owner) || (department && !departments.data?.some(x => x.department_id === department && x.is_active)) ||
        (criterion && !criteria.data?.some(x => x.code === criterion)) || value("description").length < 5 || !value("date")) return;
      const body: api.RecordReviewActionIn = {action_type:value("type") as api.RecordReviewActionIn["action_type"],
        description:value("description"),owner_user_id:owner,department_id:department,criterion_code:criterion,due_date:value("date")};
      write.start(command(`${base}/${draft.cycle}/actions`,body));
    }
    if (draft.kind === "complete") {
      const row = draft.row;
      if (row.cycle_id !== cycle || (!actionManager && row.owner_user_id !== user.user_id) || note.length < 3) return;
      const status = value("status") as api.ActionDoneIn["status"];
      if (!["Done","Cancelled"].includes(status)) return;
      const recordPath = `/quality/actions/${row.action_id}`;
      write.start({...command(recordPath + "/complete",{status,note,expected_version:row.row_version},actionList),
        permission: actionManager ? "quality.action.manage" : {recordPath,ownerField:"owner_user_id" as const}}, async () => {
        const live = (await api.listActions({source:"RecordReview",limit:1000})).find(x => x.action_id === row.action_id);
        if (!live || live.status !== "Open" || live.row_version !== row.row_version) throw versionChanged();
      });
    }
    if (draft.kind === "criterion" && manage && value("title").length >= 3) {
      const text = {title:value("title"),guidance:value("guidance") || null,sort_order:Number(value("order"))};
      const row = draft.row;
      if (row) {
        write.start(command(`${checklist}/${row.criterion_id}`,{...text,is_active:values.has("active"),expected_version:row.row_version},checklist,"PATCH"), async () => {
          if (!(await api.criteria()).some(x => x.criterion_id === row.criterion_id && x.row_version === row.row_version)) throw versionChanged();
        });
      } else {
        const code = value("code");
        if (!/^[A-Z][A-Z0-9_]{2,39}$/.test(code)) { setFailure(Error(t("Enter a checklist code.", "چیک لسٹ کوڈ درج کریں۔"))); return; }
        write.start(command(checklist,{...text,code,category:value("category"),applies_to:value("applies"),responsible:value("responsible")}));
      }
    }
  }
  function selectResult(data: unknown) {
    const row = Array.isArray(data) && data.find(x => draft?.kind === "resolve" ? x.deficiency_id === draft.row.deficiency_id
      : draft?.kind === "complete" ? x.action_id === draft.row.action_id
      : draft?.kind === "criterion" && x.criterion_id === draft.row?.criterion_id);
    if (!row) throw Error(t("The original record was not returned. Keep the request locked and contact IT.", "اصل ریکارڈ نہیں ملا۔ درخواست مقفل رکھیں اور آئی ٹی سے رجوع کریں۔"));
    return row;
  }
  const allowDraft = writable && !draft && !write.blocked;
  const openReport = !!active;
  return <section data-screen={screenId} data-unsaved={!!draft} data-write-pending={write.blocked}>
    <QualityHeading title={screenId === "record_review_overview" ? t("Medical record review (MSDS)", "طبی ریکارڈ کا جائزہ (ایم ایس ڈی ایس)") : t("Review report, deficiencies & actions","جائزہ رپورٹ، کمیاں اور اقدامات")}
      text={t("Read the survey evidence and follow findings through the hospital action register.","معائنے کے شواہد پڑھیں اور ہسپتال کے اقدامات کے رجسٹر میں نتائج کی پیروی کریں۔")} onHelp={onOpenHelp}/>
    {!read ? <Empty>{t("Record review access is required.","ریکارڈ جائزے کی اجازت درکار ہے۔")}</Empty> : <>
      <div className="toolbar">
        <Field label={t("Cycle status","دور کی حالت")}>
          <select data-help="rrp.cycle" disabled={!!draft} value={cycleStatus} onChange={e => {
            setCycle(undefined);
            setCycleStatus(e.target.value as typeof cycleStatus);
          }}>
            <option value="">{t("All statuses","تمام حالتیں")}</option>
            <option value="Planned">{t("Planned","طے شدہ")}</option>
            <option value="InReview">{t("In review","زیر جائزہ")}</option>
            <option value="Closed">{t("Closed","بند")}</option>
            <option value="Cancelled">{t("Cancelled","منسوخ")}</option>
          </select>
        </Field>
        <Field label={t("Review cycle","جائزے کا دور")}>
          <select data-help="rrp.cycle" disabled={cycles.loading || Boolean(cycles.error) || !!draft} value={cycle ?? ""} onChange={e => setCycle(Number(e.target.value) || undefined)}>
            <option value="">{t("Choose a cycle","دور منتخب کریں")}</option>
            {!cycles.error && cycles.data?.map(row => <option key={row.cycle_id} value={row.cycle_id}>{row.cycle_number} · {row.title}</option>)}
          </select>
        </Field>
        <button data-help="rrp.cycle" disabled={!!draft} onClick={() => { void cycles.reload(); void refresh(); }}>{t("Refresh report","رپورٹ تازہ کریں")}</button>
      </div>
      <LoadState {...cycles} retry={cycles.reload}/>
      {cycle && <LoadState {...report} retry={report.reload}/>}
      {!cycle && !cycles.loading && !cycles.error && <Empty>{t("Choose a cycle to see its evidence.","شواہد دیکھنے کے لیے دور منتخب کریں۔")}</Empty>}
      {active && <>
        <article className="card">
          <h2>MSDS 156–162 · <bdi>{active.cycle.cycle_number}</bdi></h2>
          {table([t("Indicator","اشاریہ"),t("Status","حالت"),t("Evidence","شواہد")],active.msds.map(x => [
            `${x.indicator} · ${x.title}`, <strong style={{color:x.status==="NotMet"?"var(--error,#a22121)":x.status==="PartlyMet"?"var(--warning,#8a5500)":"var(--success,#17634a)"}}>{state(x.status)}</strong>,x.evidence]))}
          <QualityPaper disabled={!connected} documents={[{label:t("survey report PDF","معائنہ رپورٹ پی ڈی ایف"),path:`${base}/${active.cycle.cycle_id}/report/pdf`}]}/>
        </article>
        <article className="card">
          <h2>{t("Cycle and sample","دور اور نمونہ")}</h2>
          <p>{active.cycle.title} · {active.cycle.period_start} – {active.cycle.period_end} · {active.cycle.status}</p>
          {active.cycle.summary && <p>{active.cycle.summary}</p>}
          {active.plan && <p>{active.plan.method} · {active.plan.confidence_level}% · ±{active.plan.margin_pct}% · n={active.plan.planned_sample}/{active.plan.population} · {t("Minimum per group","فی گروہ کم از کم")} {active.plan.min_per_stratum} · {t("Drawn","منتخب")} {active.plan.drawn_records ?? "—"} · {t("Unassigned","غیر مقرر")} {active.plan.unassigned ?? "—"}</p>}
          {active.cycle.sample_seed !== null && <p>{t("Sampling seed","نمونے کا سیڈ")} <bdi>{active.cycle.sample_seed}</bdi></p>}
          {table([t("Reviewer","جائزہ لینے والا"),t("Discipline","شعبہ"),t("Reviewed / assigned","جائزہ شدہ / مقرر")],active.reviewers.map(x => [x.display_name,x.discipline,`${x.reviewed} / ${x.assigned}`]))}
          {table([t("Department","شعبہ"),t("State","حالت"),t("Sampled / reviewed","نمونہ / جائزہ"),t("Average","اوسط")],active.by_stratum.map(x => [x.department_name ?? "—",x.record_state,`${x.sampled} / ${x.reviewed}`,x.average_score_pct === null ? "—" : `${x.average_score_pct}%`]))}
          {table([t("Category","زمرہ"),t("Yes / No","ہاں / نہیں"),t("Compliance","تعمیل")],active.by_category.map(x => [x.category,`${x.yes} / ${x.no}`,x.compliance_pct === null ? "—" : `${x.compliance_pct}%`]))}
          {table([t("Criterion","معیار"),t("Yes / No / NA","ہاں / نہیں / لاگو نہیں"),t("Agreed / checked by system","اتفاق / نظام کی جانچ")],active.by_criterion.map(x => [`${x.code} · ${x.title}`,`${x.yes} / ${x.no} / ${x.na}`,`${x.agreed_with_system} / ${x.checked_by_system}`]))}
        </article>
        <article className="card">
          <h2>{t("Deficiencies","کمیاں")}</h2>
          <Field label={t("Finding status","کمی کی حالت")}><select data-help="rrp.finding" disabled={!!draft} value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
            <option value="">{t("All statuses","تمام حالتیں")}</option>
            {(["Open","Corrected","Acknowledged","Withdrawn"] as const).map(x => <option key={x} value={x}>{state(x)}</option>)}
          </select></Field>
          {manage && <LoadState {...deficiencies} retry={deficiencies.reload}/>}
          {(!manage || currentFindings) && table([t("Record / MRN","ریکارڈ / ایم آر این"),t("Finding","کمی"),t("Owner and status","ذمہ دار اور حالت"),t("Resolution","حل")],
            (manage ? currentFindings ?? [] : active.deficiencies.filter(x => !filter || x.status === filter)).map(x => [
              <bdi>{x.record_number} · {x.mrn}</bdi>,<>{x.criterion_title}<br/>{x.description}</>,<>{x.responsible_name ?? t("Nursing team","نرسنگ ٹیم")} · {state(x.status)}</>,
              <>{x.resolution_note}{manage && x.status === "Open" && <button data-help="rrp.finding" disabled={!allowDraft} onClick={() => open({kind:"resolve",row:x})}>{t("Review finding","کمی کا جائزہ")}</button>}</>]))}
        </article>
        <article className="card">
          <h2>{t("Corrective and preventive actions","اصلاحی اور احتیاطی اقدامات")}</h2>
          {manage && active.cycle.status === "InReview" && <button data-help="rrp.action" disabled={!allowDraft} onClick={() => open({kind:"action",cycle:active.cycle.cycle_id})}>{t("Add action","اقدام شامل کریں")}</button>}
          <LoadState {...actions} retry={actions.reload}/>
          {!actions.loading && !actions.error && table([t("Action","اقدام"),t("Owner / department","ذمہ دار / شعبہ"),t("Due and status","تاریخ اور حالت"),t("Evidence","شواہد")],
            (user.permissions.some(x => ["quality.action.view","quality.action.manage"].includes(x)) ? visibleActions : active.actions).map(x => [
              <>{x.action_number} · {x.action_type}<br/>{x.description}</>,<>{x.owner_name} · {x.department_name ?? "—"}</>,
              <>{x.due_date} · {state(x.status)} {x.is_overdue && <strong className="error">{t("Overdue","تاخیر شدہ")}</strong>}</>,
              <>{x.outcome_note}{x.status === "Open" && (actionManager || x.owner_user_id === user.user_id) && <button data-help="rrp.action" disabled={!allowDraft} onClick={() => open({kind:"complete",row:x})}>{t("Close action","اقدام بند کریں")}</button>}</>]))}
        </article>
      </>}
      <article className="card">
        <h2>{t("Review checklist","جائزے کی چیک لسٹ")}</h2>
        {manage && <button data-help="rrp.criterion" disabled={!allowDraft} onClick={() => open({kind:"criterion"})}>{t("Add checklist item","چیک لسٹ میں شامل کریں")}</button>}
        <LoadState {...criteria} retry={criteria.reload}/>
        {!criteria.loading && !criteria.error && table([t("Code / title","کوڈ / عنوان"),t("Scope / responsibility","دائرہ / ذمہ داری"),t("Check / status","جانچ / حالت"),t("Guidance","رہنمائی")],
          (criteria.data ?? []).map(x => [`${x.code} · ${x.title}`,`${x.category} · ${x.applies_to} · ${x.responsible}`,
            <>{x.auto_check ? t("System check","نظام کی جانچ") : t("Reviewer answers","جائزہ لینے والے کا جواب")} · {x.is_active ? t("Active","فعال") : t("Retired","غیر فعال")}</>,
            <>{x.guidance}{manage && <button data-help="rrp.criterion" disabled={!allowDraft} onClick={() => open({kind:"criterion",row:x})}>{t("Edit checklist item","چیک لسٹ اندراج بدلیں")}</button>}</>]))}
      </article>
    </>}
    {!draft && <ClinicalWriteFeedback write={write}/>}
    {draft && <Modal title={t("Review change","تبدیلی کا جائزہ")} onClose={close} closable={!write.blocked}>
      <form className="form" onSubmit={submit} onChange={() => setChanged(true)}>
        <fieldset disabled={write.blocked}>
          {draft.kind === "resolve" && <>
            <p><bdi>{draft.row.record_number} · {draft.row.mrn}</bdi> · {draft.row.criterion_title}</p>
            <Field label={t("Decision","فیصلہ")}><select data-help="rrp.finding" name="status"><option value="Acknowledged">{t("Acknowledge a true finding","درست کمی تسلیم کریں")}</option><option value="Withdrawn">{t("Withdraw a mistaken finding","غلط کمی واپس لیں")}</option></select></Field>
          </>}
          {draft.kind === "complete" && <>
            <p>{draft.row.action_number} · {draft.row.description}</p>
            <Field label={t("Outcome","نتیجہ")}><select data-help="rrp.action" name="status"><option value="Done">{t("Done","مکمل")}</option><option value="Cancelled">{t("Cancelled","منسوخ")}</option></select></Field>
          </>}
          {(draft.kind === "resolve" || draft.kind === "complete") &&
            <Field label={t("Reason or evidence","وجہ یا شواہد")}><textarea data-help="rrp.save" name="note" required minLength={3} maxLength={draft.kind === "complete" ? 2000 : 1000}/></Field>}
          {draft.kind === "action" && <>
            <LoadState {...people} retry={people.reload}/><LoadState {...departments} retry={departments.reload}/>
            <Field label={t("Action type","اقدام کی قسم")}><select data-help="rrp.action" name="type"><option value="Corrective">{t("Corrective","اصلاحی")}</option><option value="Preventive">{t("Preventive","احتیاطی")}</option></select></Field>
            <Field label={t("Description","تفصیل")}><textarea data-help="rrp.action" name="description" required minLength={5} maxLength={1000}/></Field>
            <Field label={t("Owner","ذمہ دار")}><select data-help="rrp.action" name="owner" required><option value="">{t("Choose staff","عملہ منتخب کریں")}</option>{!people.error && people.data?.map(x => <option key={x.user_id} value={x.user_id}>{x.display_name} · {x.designation}</option>)}</select></Field>
            <Field label={t("Department (optional)","شعبہ (اختیاری)")}><select data-help="rrp.action" name="department"><option value="">—</option>{!departments.error && departments.data?.filter(x=>x.is_active).map(x => <option key={x.department_id} value={x.department_id}>{x.name}</option>)}</select></Field>
            <Field label={t("Criterion (optional)","معیار (اختیاری)")}><select data-help="rrp.action" name="criterion"><option value="">—</option>{!criteria.error && criteria.data?.map(x => <option key={x.criterion_id} value={x.code}>{x.code} · {x.title}</option>)}</select></Field>
            <Field label={t("Due date","آخری تاریخ")}><input data-help="rrp.action" name="date" type="date" required/></Field>
          </>}
          {draft.kind === "criterion" && <>
            {draft.row ? <p>{draft.row.code} · {draft.row.category} · {draft.row.applies_to}</p> : <>
              <Field label={t("Code","کوڈ")}><input data-help="rrp.criterion" name="code" required pattern="[A-Z][A-Z0-9_]{2,39}" maxLength={40}/></Field>
              <Field label={t("Category","زمرہ")}><select data-help="rrp.criterion" name="category">{categories.map(x => <option key={x}>{x}</option>)}</select></Field>
              <Field label={t("Applies to","اطلاق")}><select data-help="rrp.criterion" name="applies"><option value="Both">{t("Both","دونوں")}</option><option value="Admission">{t("Admission","داخلہ")}</option><option value="OpdVisit">{t("OPD visit","او پی ڈی وزٹ")}</option></select></Field>
              <Field label={t("Responsible team","ذمہ دار ٹیم")}><select data-help="rrp.criterion" name="responsible"><option value="Doctor">{t("Doctor","ڈاکٹر")}</option><option value="Nursing">{t("Nursing","نرسنگ")}</option></select></Field>
            </>}
            <Field label={t("Title","عنوان")}><input data-help="rrp.criterion" name="title" required minLength={3} defaultValue={draft.row?.title} maxLength={200}/></Field>
            <Field label={t("Guidance","رہنمائی")}><textarea data-help="rrp.criterion" name="guidance" defaultValue={draft.row?.guidance ?? ""} maxLength={1000}/></Field>
            <Field label={t("Display order","نمائش کی ترتیب")}><input data-help="rrp.criterion" name="order" type="number" required min={0} max={10000} defaultValue={draft.row?.sort_order ?? 0}/></Field>
            {draft.row && <label><input data-help="rrp.criterion" name="active" type="checkbox" defaultChecked={draft.row.is_active}/> {t("Active","فعال")}</label>}
          </>}
          <label><input data-help="rrp.save" type="checkbox" required/> {t("I checked the selected record and this change.","میں نے منتخب ریکارڈ اور یہ تبدیلی چیک کی ہے۔")}</label>
        </fieldset>
        <LoadState loading={false} error={failure} retry={() => setFailure(undefined)}/>
        <ClinicalWriteFeedback write={write} selectResult={selectResult} onReviewed={() => {setDraft(undefined); void refresh();}}/>
        <div className="actions">
          <button data-help="rrp.save" type="submit" className="primary" disabled={!writable || write.blocked || (composingAction && (people.loading || departments.loading || !!people.error || !!departments.error)) || (draft.kind !== "criterion" && !openReport)}>{t("Confirm change","تبدیلی کی تصدیق کریں")}</button>
          <button data-help="rrp.save" type="button" disabled={write.blocked} onClick={close}>{t("Cancel","منسوخ کریں")}</button>
        </div>
      </form>
    </Modal>}
  </section>;
}

export function RecordReviewOverview(props: Omit<Parameters<typeof RecordReviewReport>[0], "screenId">) {
  const [report, setReport] = useState(true);
  return <>
    <div className="toolbar">
      <button data-help="rrp.overview" aria-pressed={!report} onClick={() => {if (report && mayChangeClinicalContext()) setReport(false);}}>{t("Schedule and cycles","شیڈول اور دور")}</button>
      <button data-help="rrp.overview" aria-pressed={report} onClick={() => {if (!report && mayChangeClinicalContext()) setReport(true);}}>{t("Survey report and findings","معائنہ رپورٹ اور کمیاں")}</button>
    </div>
    {report ? <RecordReviewReport {...props} screenId="record_review_overview"/> : <RecordReviewCycles {...props} screenId="record_review_overview"/>}
  </>;
}
