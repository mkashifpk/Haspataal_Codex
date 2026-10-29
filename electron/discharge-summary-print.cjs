const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function assertSummary(payload, admissionId, patientId, mrn, version) {
  const f = payload?.fields,
    s = f?.summary,
    a = f?.admission;
  if (
    !["discharge_summary", "referral_slip"].includes(payload?.document_type) ||
    payload.printer_role !== "document" ||
    payload.paper_width_mm !== 210 ||
    !f?.hospital ||
    !a ||
    !s ||
    s.status !== "Final" ||
    a.admission_id !== admissionId ||
    s.admission_id !== admissionId ||
    a.patient_id !== patientId ||
    s.patient_id !== patientId ||
    a.mrn !== mrn ||
    s.row_version !== version ||
    !s.signed_at
  )
    throw Error(
      "Signed summary identity, version or state changed. Read it before printing.",
    );
  return f;
}
function summaryHtml(payload, font, language = "en") {
  const f = assertSummary(
      payload,
      payload.fields?.admission?.admission_id,
      payload.fields?.admission?.patient_id,
      payload.fields?.admission?.mrn,
      payload.fields?.summary?.row_version,
    ),
    s = f.summary,
    a = f.admission,
    h = f.hospital,
    ur = language === "ur",
    t = (e, u) => (ur ? u : e);
  const section = (label, value) =>
    value
      ? `<section><h3>${escape(label)}</h3><p dir="auto">${escape(value)}</p></section>`
      : "";
  return `<!doctype html><html lang="${ur ? "ur" : "en"}" dir="${ur ? "rtl" : "ltr"}"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><style>@font-face{font-family:Urdu;src:url(data:font/woff2;base64,${font})}@page{size:A4;margin:14mm}body{font:11pt ${ur ? "Urdu,Arial" : "Arial,Urdu"};line-height:${ur ? 2.4 : 1.5};color:#000}header{text-align:center}h1{font-size:17pt}h2{font-size:14pt}h3{font-size:11pt}p{white-space:pre-wrap;overflow-wrap:anywhere}section{break-inside:avoid}.correction{border-inline-start:3px solid #333;padding-inline-start:3mm}bdi{unicode-bidi:isolate}</style><header><h1>${escape(h.name)}</h1><p>${escape(h.address)} · ${escape(h.phone)} · <bdi>${escape(h.phc_number)}</bdi></p><p>${escape(h.issue_line)}</p><h2>${escape(f.title)}</h2></header><p dir="auto">${escape(a.patient_name)} · <bdi>${escape(a.mrn)} · ${escape(a.admission_number)}</bdi> · ${escape(a.dob ?? a.age_years)} · ${escape(a.gender)}</p><p>${escape(a.ward_name)} · ${escape(a.bed_label)} · ${escape(a.primary_doctor_name)} · ${escape(s.outcome)} · ${escape(s.condition_at_discharge)}</p>${section(t("Reason for admission", "داخلے کی وجہ"), s.reason_for_admission)}${section(t("Final diagnosis", "حتمی تشخیص"), s.final_diagnosis)}${(s.icd_terms || []).map((c) => section(c.code, c.title + (c.uri ? " · " + c.uri : ""))).join("")}${section(t("Findings", "نتائج"), s.significant_findings)}${section(t("Procedures and treatment", "طریقہ کار و علاج"), s.procedures_and_treatment)}${section(t("Response to treatment", "علاج کا نتیجہ"), s.response_to_treatment)}${section(t("Discharge medicines", "ڈسچارج کی دوائیں"), s.discharge_medications)}${section(t("Follow-up instructions", "دوبارہ معائنے کی ہدایات"), s.follow_up_instructions)}${section(t("Follow-up date", "دوبارہ معائنے کی تاریخ"), s.follow_up_date)}${section(t("Receiving hospital / transfer", "منتقل ادارہ و وجہ"), [s.receiving_hospital, s.transfer_reason, s.transfer_arrangements].filter(Boolean).join("\n"))}${section(t("Outcome note", "نتیجے کا نوٹ"), s.outcome_note)}${f.corrections.length ? "<h2>" + escape(t("Corrections to the original signed record", "اصل دستخط شدہ ریکارڈ کی تصحیحات")) + "</h2>" : ""}${f.corrections.map((c) => `<section class="correction"><h3>${escape(c.field)}</h3><p dir="auto">${escape(c.correction_text)}</p><p>${escape(c.correction_reason)} · ${escape(c.corrected_by_name)} · ${escape(c.created_at)}</p></section>`).join("")}<section><p>${escape(s.signer_name)} · ${escape(s.signer_designation)} · ${escape(s.signer_license)} · ${escape(s.signed_at)}</p></section></html>`;
}
const printSummary = (payload, terminal, options) =>
  require("./clinical-print.cjs").printA4(
    payload,
    terminal,
    options,
    summaryHtml,
  );
module.exports = { assertSummary, summaryHtml, printSummary };
