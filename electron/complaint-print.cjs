const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function assertComplaintPaper(p, number, letter) {
  const f = p?.fields;
  if (
    p?.printer_role !== "document" ||
    !f?.hospital?.name ||
    !Array.isArray(f.english) ||
    !Array.isArray(f.urdu) ||
    !f.english.length ||
    !f.urdu.length ||
    !f.english.every((x) => typeof x === "string") ||
    !f.urdu.every((x) => typeof x === "string")
  )
    throw Error("The complaint document is incomplete. Read it again.");
  if (
    number
      ? p.document_type !== "complaint_letter" ||
        f.complaint_number !== number ||
        f.letter !== letter
      : p.document_type !== "complaints_notice"
  )
    throw Error("The complaint document identity changed. Read it again.");
  return f;
}
function complaintHtml(p, font, language = "en") {
  const f = assertComplaintPaper(
      p,
      p.document_type === "complaint_letter"
        ? p.fields?.complaint_number
        : undefined,
      p.fields?.letter,
    ),
    ur = language === "ur",
    h = f.hospital;
  const title =
    p.document_type === "complaints_notice"
      ? ur
        ? f.title_ur
        : f.title_en
      : [
          ur ? "شکایت" : "Complaint",
          f.complaint_number,
          ur
            ? {
                Acknowledgement: "وصولی کا خط",
                Outcome: "نتیجے کا خط",
                AppealOutcome: "اپیل فیصلے کا خط",
              }[f.letter]
            : f.letter,
        ].join(" · ");
  return `<!doctype html><html lang="${ur ? "ur" : "en"}" dir="${ur ? "rtl" : "ltr"}"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><style>@font-face{font-family:Urdu;src:url(data:font/woff2;base64,${font})}@page{size:A4;margin:16mm}body{font-family:${ur ? "Urdu,Arial" : "Arial,Urdu"},sans-serif;font-size:12pt;line-height:${ur ? 2.4 : 1.6};color:#000;background:white}header{text-align:center;border-bottom:1px solid #777}h1{font-size:18pt}p{white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}small{font-size:9pt}footer{border-top:1px solid #777;margin-top:8mm;padding-top:4mm}</style><header><h1>${escape(h.name)}</h1><p>${escape(h.address)}</p><p>${escape(h.phone)} · <bdi>${escape(h.phc_number)}</bdi></p><small>${escape(h.issue_line)}</small></header><h2>${escape(title)}</h2>${f.complainant_name ? `<p dir="auto">${escape(f.complainant_name)}</p>` : ""}${(ur ? f.urdu : f.english).map((x) => `<p>${escape(x)}</p>`).join("")}<footer><p dir="auto">${escape(f.desk)}</p><p dir="auto">${escape(f.phone)}</p>${f.signed ? `<p dir="auto">${escape(typeof f.signed === "string" ? f.signed : f.signed.text)}</p>` : ""}</footer></html>`;
}
const printComplaint = (p, t, o) =>
  require("./clinical-print.cjs").printA4(p, t, o, complaintHtml);
module.exports = { assertComplaintPaper, complaintHtml, printComplaint };
