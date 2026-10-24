const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function diagnosticHtml(payload, font, language = "en") {
  const ur = language === "ur",
    t = (en, u) => (ur ? u : en),
    f = payload.fields,
    h = f?.hospital;
  if (
    !h ||
    !["lab_report", "imaging_report"].includes(payload.document_type) ||
    payload.printer_role !== "document"
  )
    throw new Error("Invalid diagnostic report");
  let body = "";
  const p = (label, value) =>
    `<p dir="auto"><b>${escape(label)}</b> ${escape(value)}</p>`;
  if (payload.document_type === "lab_report") {
    if (!f.results?.length || f.results.some((r) => !r.verified_stamp?.text))
      throw new Error("An unverified result cannot be printed");
    body = `<h2>${escape(t("Laboratory report", "لیبارٹری رپورٹ"))}</h2>${p(t("Patient", "مریض"), f.patient_name)}${p("MRN", f.mrn)}${p(t("Order", "آرڈر"), f.requisition_number)}${p(t("Age / gender", "عمر / جنس"), `${f.age_years ?? ""} / ${f.gender ?? ""}`)}${p(t("Doctor", "ڈاکٹر"), f.doctor_name)}${p(t("Ordered", "درج ہونے کا وقت"), f.ordered_at)}${!f.complete ? `<h3>${escape(t("PARTIAL REPORT — other tests are still pending", "جزوی رپورٹ — دیگر ٹیسٹ ابھی باقی ہیں"))}</h3>` : ""}`;
    for (const r of f.results)
      body += `<section><h3>${escape(r.code)} · ${escape(r.test_name)}</h3>${r.has_critical_value ? p(t("Critical value", "انتہائی اہم نتیجہ"), t("Contact the clinical team immediately", "فوراً طبی عملے سے رابطہ کریں")) : ""}${r.performed_by_partner ? p(t("Partner laboratory", "شراکت دار لیب"), r.performed_by_partner) : ""}<table><thead><tr>${[t("Test / metric", "ٹیسٹ / پیمائش"), t("Result", "نتیجہ"), t("Unit", "اکائی"), t("Reference range", "حوالہ حد"), t("Flag", "نشان")].map((x) => `<th>${escape(x)}</th>`).join("")}</tr></thead><tbody>${r.rows.map((row) => `<tr>${[row.label, typeof row.value === "object" ? JSON.stringify(row.value) : row.value, row.unit, row.reference, row.flag].map((x) => `<td dir="auto">${escape(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>${p(t("Interpretation", "تشریح"), r.interpretation)}${r.is_correction ? p(t("Amended result; reason", "تصحیح شدہ نتیجہ؛ وجہ"), r.correction_reason) : ""}${p(t("Performed", "کرنے والا"), r.performed_stamp?.text)}${p(t("Verified", "تصدیق کرنے والا"), r.verified_stamp.text)}</section>`;
  } else {
    const o = f.order;
    if (o?.status !== "Reported" || !o.reported_stamp?.text)
      throw new Error("Only a reported imaging examination can be printed");
    body = `<h2>${escape(t("Radiology report", "شعاعی رپورٹ"))}</h2>${p(t("Patient", "مریض"), o.patient_name)}${p("MRN", o.mrn)}${p(t("Order / accession", "آرڈر / ایکسیشن"), `${o.order_number} / ${o.accession_number}`)}${p(t("Study", "معائنہ"), `${o.modality} · ${o.body_part || ""} · ${o.laterality || ""}`)}${p(t("Clinical indication", "طبی وجہ"), o.clinical_indication)}${o.partner_name ? p(t("Outside partner centre", "بیرونی شراکت دار مرکز"), o.partner_name) : ""}${p(t("Report", "رپورٹ"), o.report_text)}${o.external_reporter ? p(t("Partner reporter", "بیرونی رپورٹ کرنے والا"), o.external_reporter) : ""}${p(t("Reported by", "رپورٹ کرنے والا"), o.reported_stamp.text)}`;
  }
  return `<!doctype html><html lang="${ur ? "ur" : "en"}" dir="${ur ? "rtl" : "ltr"}"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><style>@font-face{font-family:Urdu;src:url(data:font/woff2;base64,${font})}@page{size:A4;margin:15mm}body{font-family:Arial,Urdu,sans-serif;font-size:11pt;line-height:${ur ? 2.2 : 1.5};color:black;background:white}header{text-align:center;border-bottom:1px solid}p{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:2mm;text-align:start;overflow-wrap:anywhere}section{break-inside:avoid}</style><header><h1>${escape(h.name)}</h1><p>${escape(h.address)} · ${escape(h.phone)}</p><p>${escape(h.phc_number)} · ${escape(h.issue_line)}</p></header>${body}</html>`;
}
const printDiagnostic = (payload, terminal, options) =>
  require("./clinical-print.cjs").printA4(
    payload,
    terminal,
    options,
    diagnosticHtml,
  );
module.exports = { diagnosticHtml, printDiagnostic };
