import { useEffect, useState } from "react";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import { bilingual as t, tr } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import * as rx from "../generated/rx_queue";
import { prescriptionQueueAccess } from "../prescription-queue-policy";

export function PrescriptionQueue({permissions, connected, stream, timeZone, view}: {
  permissions: string[]; connected: boolean; stream: string; timeZone?: string; view: string;
}) {
  const canQueue = permissions.includes("pharmacy.queue.view"), canDetail = permissions.includes("prescription.view");
  const access = prescriptionQueueAccess(permissions, view), visible = access.visible;
  const [revision, setRevision] = useState(0), [detailRevision, setDetailRevision] = useState(0);
  const [selected, setSelected] = useState<number>();
  const [find, setFind] = useState(""), [lookup, setLookup] = useState("");
  const [error, setError] = useState<unknown>();
  useEffect(() => window.terminal.subscribe(e => {
    if (e.type === "event" && ["pharmacy.prescription.pending", "medication.order.updated"].includes(e.event_type)) {
      setRevision(n => n + 1);
      if (selected && e.payload?.prescription_id === selected) setDetailRevision(n => n + 1);
    }
    if (e.type === "stream" && e.status === "Live" && e.resync) {setRevision(n => n + 1); setDetailRevision(n => n + 1);}
  }), [selected]);
  const listAllowed = access.list, detailAllowed = access.detail;
  const rows = useLoad(() => listAllowed ? rx.pending() : Promise.resolve([]), [listAllowed, revision]);
  const detail = useLoad(() => detailAllowed && selected ? rx.getPrescription(selected) : Promise.resolve(undefined), [selected, detailAllowed, detailRevision]);
  const record = !detail.loading && !detail.error && detail.data?.prescription_id === selected ? detail.data : undefined;
  const entries = !rows.loading && !rows.error ? (rows.data || []).filter(r => `${r.prescription_number} ${r.patient_name} ${r.mrn} ${r.prescriber_name}`.toLowerCase().includes(find.trim().toLowerCase())) : [];
  const time = (value: string) => timeZone ? formatHospitalTime(value, timeZone) : value;
  const open = (id: number) => {setSelected(id);setDetailRevision(n => n + 1);setError(undefined);};
  if (!visible || (!canQueue && !canDetail)) return <Empty>{t("Prescription queue is unavailable with your current permissions and services.", "موجودہ اجازت اور خدمات میں نسخوں کی قطار دستیاب نہیں۔")}</Empty>;
  return <section data-help-screen="rx_queue">
    <div className="section-heading"><div><span className="eyebrow">{t("PHARMACY COUNTER", "فارمیسی کاؤنٹر")}</span><h1>{t("Prescription queue", "نسخوں کی قطار")}</h1><p>{t("Verify the patient, prescription and safety flags before dispensing.", "دوا دینے سے پہلے مریض، نسخہ اور حفاظتی نشان چیک کریں۔")}</p></div>
      <button data-help="rxqueue.refresh" onClick={() => {setRevision(n => n + 1);setDetailRevision(n => n + 1);}} disabled={rows.loading || detail.loading}>{t("Refresh prescriptions", "نسخے تازہ کریں")}</button></div>
    <p role="status">{tr(connected ? stream : "Offline")} · {t("Code Red first, then oldest first. Opening a prescription records no dispensing or payment.", "پہلے کوڈ ریڈ، پھر قدیم ترین نسخہ۔ نسخہ کھولنے سے دوا یا ادائیگی درج نہیں ہوتی۔")}</p>
    {(!connected || stream !== "Live") && <p className="notice">{t("Live updates are unavailable. Refresh after reconnection before relying on this queue.", "براہ راست تازہ اطلاعات دستیاب نہیں۔ قطار استعمال کرنے سے پہلے رابطہ بحال کرکے تازہ کریں۔")}</p>}
    {view === "open_work" && <p className="notice">{t("No new dispensing work from now on. Review existing work only.", "اب سے دوا کی فراہمی کا نیا کام نہیں۔ پہلے سے موجود کام دیکھیں۔")}</p>}
    {view === "records" && <p className="notice">{t("Records only. Open an existing prescription by its ID; the pending work queue is hidden.", "صرف ریکارڈ۔ اصل شناختی نمبر سے پرانا نسخہ کھولیں؛ باقی کام کی قطار پوشیدہ ہے۔")}</p>}
    {listAllowed && <section className="card" data-testid="rxqueue-list">
      <Field label={t("Find in this queue", "اس قطار میں تلاش")} hint={t("Patient, MRN, prescription or prescriber; filters this returned queue only.", "مریض، ایم آر این، نسخہ یا معالج؛ صرف موصولہ قطار چھانٹتا ہے۔")}><input data-help="rxqueue.find" value={find} onChange={e => setFind(e.target.value)} type="search" /></Field>
      <LoadState {...rows} retry={rows.reload} />
      {!rows.loading && !rows.error && !entries.length && <Empty>{find.trim() ? t("No matching prescriptions. Clear the search to see the full queue.", "کوئی نسخہ تلاش سے نہیں ملا۔ پوری قطار دیکھنے کے لیے تلاش صاف کریں۔") : t("No pending hospital-pharmacy prescriptions. New hospital prescriptions appear automatically; external-market slips do not enter this queue.", "ہسپتال کی فارمیسی کا کوئی منتظر نسخہ نہیں۔ نیا ہسپتال نسخہ خود ظاہر ہوگا؛ بیرونی بازار کے نسخے اس قطار میں نہیں آتے۔")}</Empty>}
      {entries.map(row => <article className="card" key={row.prescription_id} data-testid="rxqueue-row">
        <strong><bdi>{row.prescription_number}</bdi> · <bdi>{row.patient_name}</bdi></strong><p><bdi>{row.mrn}</bdi> · <bdi>{row.prescriber_name}</bdi> · <bdi>{time(row.created_at)}</bdi></p>
        <p>{tr(row.source)} · {tr(row.status)} · {t("Open medicine lines", "باقی دوا کی سطریں")}: {row.open_items} · {t("Order mode", "حکم کا طریقہ")}: {tr(row.order_mode)}</p>
        {row.source === "CodeRed" && <p className="notice">{t("Code Red priority", "کوڈ ریڈ ترجیح")}</p>}
        {row.order_mode !== "Written" && <p className="notice">{t("Verbal / telephone order: review read-back and countersignature.", "زبانی یا ٹیلی فون حکم: دہرانے کی تصدیق اور معالج کے دستخط چیک کریں۔")}</p>}
        {!!row.high_alert_items && <p className="notice">{t("High-alert lines — second-person check at the counter", "زیادہ خطرے والی سطریں — کاؤنٹر پر دوسرے فرد کی جانچ")}: {row.high_alert_items}</p>}
        {!!row.open_queries && <p className="notice">{t("Open queries — queried lines wait for the doctor's answer", "کھلے سوالات — متعلقہ سطریں معالج کے جواب تک رکیں گی")}: {row.open_queries}</p>}
        {canDetail ? <button data-help="rxqueue.open" onClick={() => open(row.prescription_id)} aria-pressed={selected === row.prescription_id}>{t("Review prescription", "نسخہ دیکھیں")} <bdi>{row.prescription_number}</bdi></button> : <p>{t("Your role can view the queue but cannot open prescription details.", "آپ کا کردار قطار دیکھ سکتا ہے مگر نسخے کی تفصیل نہیں کھول سکتا۔")}</p>}
      </article>)}
    </section>}
    {canDetail && <section className="card" data-testid="rxqueue-reader">
      <form className="actions" onSubmit={e => {e.preventDefault();if (!/^[1-9]\d*$/.test(lookup) || !Number.isSafeInteger(Number(lookup))) {setError(new Error(t("Enter a positive prescription ID from an existing record.", "پہلے سے موجود ریکارڈ کا مثبت نسخہ شناختی نمبر درج کریں۔")));return;}open(Number(lookup));}}>
        <Field label={t("Existing prescription ID", "پہلے سے موجود نسخے کا شناختی نمبر")}><input data-help="rxqueue.lookup" value={lookup} onChange={e => setLookup(e.target.value)} inputMode="numeric" /></Field><button data-help="rxqueue.lookup">{t("Open prescription ID", "نسخہ شناختی نمبر کھولیں")}</button>
      </form><ErrorBox error={error} />
      {selected ? <><p>{t("Selected prescription ID", "منتخب نسخے کا شناختی نمبر")}: <bdi>{selected}</bdi></p><LoadState {...detail} retry={detail.reload} /><button data-help="rxqueue.close" onClick={() => {setSelected(undefined);setError(undefined);}}>{t("Close prescription details", "نسخے کی تفصیل بند کریں")}</button></> : <Empty>{t("Select a prescription to review its current details.", "تازہ تفصیل کے لیے نسخہ چنیں۔")}</Empty>}
      {record && <div data-testid="rxqueue-detail">
        <h2><bdi>{record.prescription_number}</bdi> · <bdi>{record.patient_name}</bdi></h2><p><bdi>{record.mrn}</bdi> · {t("Patient ID", "مریض شناختی نمبر")}: {record.patient_id} · {tr(record.source)} · {tr(record.destination)} · {tr(record.status)}</p>
        <p>{t("Ticket / admission / encounter", "پرچی / داخلہ / معائنہ")}: {record.ticket_id ?? "—"} / {record.admission_id ?? "—"} / {record.encounter_id ?? "—"}</p>
        <p>{t("Order mode / read back", "حکم کا طریقہ / دہرانے کی تصدیق")}: {tr(record.order_mode)} / {tr(record.read_back ? "Yes" : "No")}</p>
        {record.order_mode !== "Written" && <p>{t("Received by / countersigned", "وصول کنندہ / معالج کے تصدیقی دستخط")}: <bdi>{record.received_by_name || "—"}</bdi> / {record.countersigned_at ? time(record.countersigned_at) : t("Pending", "منتظر")}</p>}
        {record.is_content_locked && <p className="notice">{t("Prescription content is locked.", "نسخے کا مواد مقفل ہے۔")}</p>}
        {record.replaced_by_id && <p>{t("Replaced by prescription ID", "متبادل نسخے کا شناختی نمبر")}: {record.replaced_by_id}</p>}
        {record.cancel_reason && <p>{tr("Cancellation reason")}: <bdi>{record.cancel_reason}</bdi></p>}<p><bdi>{record.notes}</bdi></p><p className="signature"><bdi>{record.prescriber_stamp.text}</bdi></p>
        <h3>{t("Medicine lines", "دوا کی سطریں")}</h3>
        {record.items.map(item => <article className="card" key={item.prescription_item_id}>
          <strong><bdi>{item.drug_name || item.external_drug_name || "—"} · {item.strength || item.external_strength} · {item.form || item.external_form}</bdi></strong>
          <p>{t("Line ID", "سطر شناختی نمبر")}: {item.prescription_item_id} · {tr(item.item_status)} · {t("Prescribed / dispensed / remaining", "تجویز / فراہم / باقی")}: {item.qty_prescribed} / {item.qty_dispensed} / {item.qty_remaining} <bdi>{item.unit}</bdi></p>
          <p><bdi>{item.dose_text || "—"}</bdi> · {tr(item.route || "Not recorded")} · <bdi>{item.frequency_code || "—"}</bdi> · {t("Days / interval hours", "دن / وقفہ گھنٹے")}: {item.duration_days ?? "—"} / {item.interval_hours ?? "—"}</p><p><bdi>{item.instructions}</bdi></p>
          <p>{t("Starts / ends", "شروع / اختتام")}: <bdi>{item.start_at ? time(item.start_at) : "—"} / {item.end_at ? time(item.end_at) : "—"}</bdi></p>
          <p>{t("Available stock", "دستیاب اسٹاک")}: {item.qty_available ?? "—"} · {tr(item.stock_status || "Not recorded")}</p>
          {item.high_alert_category && <p className="notice">{t("High-alert: second-person check required", "زیادہ خطرہ: دوسرے فرد کی جانچ لازم")}: {item.high_alert_category}</p>}
          {!!item.lasa_with.length && <p className="notice">{t("Looks or sounds like", "ملتا جلتا نام یا شکل")}: <bdi>{item.lasa_with.join(", ")}</bdi></p>}
          {item.is_restricted && <p className="notice">{t("Restricted medicine", "محدود اجازت کی دوا")}</p>}{item.stop_reason && <p>{t("Stop reason", "بند کرنے کی وجہ")}: <bdi>{item.stop_reason}</bdi></p>}
          {record.queries.some(q => q.status === "Open" && (q.prescription_item_id === null || q.prescription_item_id === item.prescription_item_id)) && <p className="notice">{t("This line cannot be dispensed until the doctor's query is resolved.", "معالج سے سوال حل ہونے تک یہ سطر فراہم نہیں ہو سکتی۔")}</p>}
        </article>)}
        <h3>{t("Order queries", "حکم کے سوالات")}</h3>{!record.queries.length && <p>{t("No queries recorded.", "کوئی سوال درج نہیں۔")}</p>}
        {record.queries.map(q => <article className="card" key={q.query_id}><strong>#{q.query_id} · {tr(q.status)} · {tr(q.reason)}</strong><p>{t("Line ID", "سطر شناختی نمبر")}: {q.prescription_item_id ?? t("Whole prescription", "پورا نسخہ")}</p><p><bdi>{q.question}</bdi></p><p><bdi>{q.raised_by_name} · {time(q.raised_at)}</bdi></p>{q.answer && <p><bdi>{q.answer}</bdi> · {tr(q.outcome || "Not recorded")}</p>}{q.answer_stamp && <p><bdi>{q.answer_stamp.text}</bdi></p>}{q.withdraw_reason && <p><bdi>{q.withdraw_reason}</bdi></p>}</article>)}
      </div>}
    </section>}
  </section>;
}
