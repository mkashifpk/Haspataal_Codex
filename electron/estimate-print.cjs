const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function assertEstimate(p, id) {
  if (
    p?.document_type !== "cost_estimate" ||
    p.printer_role !== "document" ||
    p.fields?.estimate?.estimate_id !== id ||
    !p.fields.estimate.mrn ||
    !p.fields.hospital?.name ||
    !Array.isArray(p.fields.urdu) ||
    !Array.isArray(p.fields.english) ||
    !Array.isArray(p.fields.signature_lines)
  )
    throw Error("The estimate print identity or content is incomplete.");
  return p.fields;
}
function estimateHtml(p, font, language = "en") {
  const row = (v) => `<tr><td colspan="4">${v}</td></tr>`;
  const f = assertEstimate(p, p.fields?.estimate?.estimate_id),
    e = f.estimate,
    h = f.hospital,
    ur = language === "ur",
    label = (en, u) => (ur ? u : en),
    cell = (v) => `<td dir="auto">${escape(v)}</td>`;
  return `<!doctype html><html lang="${ur ? "ur" : "en"}" dir="${ur ? "rtl" : "ltr"}"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><style>@font-face{font-family:Urdu;src:url(data:font/woff2;base64,${font})}@page{size:A4;margin:14mm}body{font:11pt ${ur ? "Urdu,Arial" : "Arial,Urdu"};line-height:${ur ? 2.3 : 1.5};color:#000}h1{font-size:17pt}h2{font-size:13pt}header{text-align:center}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #aaa;text-align:start;padding:2mm;overflow-wrap:anywhere}thead{display:table-header-group}p{overflow-wrap:anywhere;white-space:pre-wrap}bdi{unicode-bidi:isolate}tr,.signature,.signatures{break-inside:avoid}.identity{font:9pt Arial,Urdu;margin-bottom:3mm}.signature{border-bottom:1px solid #777;padding-block:3mm}</style><header><h1>${escape(h.name)}</h1><p>${escape(h.address)} · ${escape(h.phone)} · <bdi>${escape(h.phc_number)}</bdi></p><p>${escape(h.issue_line)}</p></header><h2>${escape(label("Cost estimate", "متوقع اخراجات"))}</h2><table><thead><tr><th colspan="4"><bdi>${escape(e.estimate_number)} · ${escape(e.mrn)}</bdi> · ${escape(e.patient_name)} · ${escape(e.status)}</th></tr><tr>${[label("Description", "تفصیل"), label("Quantity", "مقدار"), label("Unit price", "فی اکائی"), label("Amount", "رقم") + " " + (p.currency || "")].map((v) => `<th>${escape(v)}</th>`).join("")}</tr></thead><tbody>${e.lines.map((l) => `<tr>${[l.description, l.quantity, l.unit_price, l.amount].map(cell).join("")}</tr>`).join("")}<tr><td colspan="4"><p>${escape(label("Ward / days", "وارڈ / دن"))}: ${escape(e.ward_name)} · ${escape(e.expected_days)}</p><p>${escape(label("Total / deposit / billed so far", "کل / پیشگی رقم / اب تک بل"))}: <bdi>${e.total} / ${e.deposit} / ${e.billed_so_far}</bdi></p><p>${escape(e.payment_terms)}</p><p>${escape(e.note)}</p></td></tr>${(ur ? f.urdu : f.english).map((v) => row(`<p>${escape(v)}</p>`)).join("")}${f.signature_lines.length ? row(`<section class="signatures"><p class="identity" dir="auto">${escape(e.estimate_number)} · ${escape(e.mrn)} · ${escape(e.patient_name)}</p>${f.signature_lines.map((v) => `<p class="signature" dir="auto">${escape(v)}</p>`).join("")}</section>`) : ""}${e.explain_stamp ? row(`<p dir="auto">${escape(e.explain_stamp.text)}</p>`) : ""}</tbody></table></html>`;
}
const printEstimate = (payload, terminal, options) =>
  require("./clinical-print.cjs").printA4(
    payload,
    terminal,
    options,
    estimateHtml,
  );
module.exports = { assertEstimate, estimateHtml, printEstimate };
