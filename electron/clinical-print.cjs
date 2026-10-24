const { BrowserWindow } = require("electron");
const fs = require("node:fs"),
  path = require("node:path");
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const labels = {
  chief_complaint: ["Chief complaint", "بنیادی شکایت"],
  history: ["History", "سابقہ معلومات"],
  examination: ["Examination", "معائنہ"],
  diagnosis: ["Diagnosis", "تشخیص"],
  clinical_note: ["Clinical note", "طبی نوٹ"],
  plan: ["Plan", "منصوبہ"],
  procedure_name: ["Procedure", "طریقہ کار"],
  site: ["Site and side", "جگہ اور سمت"],
  indication: ["Indication", "وجہ"],
  anaesthesia: ["Anaesthesia", "بے ہوشی"],
  consent_number: ["Consent number", "رضامندی نمبر"],
  assistant_name: ["Assistant", "معاون"],
  started_at: ["Started", "شروع"],
  ended_at: ["Ended", "ختم"],
  technique: ["Technique", "طریقہ"],
  findings: ["Findings", "نتائج"],
  specimens: ["Specimens", "نمونے"],
  complications: ["Complications", "پیچیدگیاں"],
  condition_at_end: ["Condition at end", "اختتام پر حالت"],
};
function clinicalHtml(payload, font, language = "en") {
  if (
    payload.document_type !== "clinical_note" ||
    payload.fields?.encounter?.status !== "Final"
  )
    throw new Error("Only a finalized clinical note can be printed");
  const ur = language === "ur",
    f = payload.fields,
    n = f.encounter,
    h = f.hospital || {},
    label = (en, urdu) => (ur ? urdu : en);
  const section = (key, value) =>
    value === null || value === undefined || value === ""
      ? ""
      : `<section><h3>${escape(labels[key]?.[ur ? 1 : 0] || key)}</h3><p dir="auto">${escape(value)}</p></section>`;
  const codes = (n.icd_terms || [])
    .map(
      (c) =>
        `<p dir="auto"><bdi>${escape(c.code)}</bdi> · ${escape(c.title || label("Title not recorded", "عنوان درج نہیں"))}${c.uri ? `<br><small dir="ltr">${escape(c.uri)}</small>` : ""}</p>`,
    )
    .join("");
  const notes = [
    "chief_complaint",
    "history",
    "examination",
    "diagnosis",
    "clinical_note",
    "plan",
  ]
    .map((k) => section(k, n[k]))
    .join("");
  const procedure = n.procedure
    ? Object.keys(labels)
        .filter((k) => k in n.procedure)
        .map((k) => section(k, n.procedure[k]))
        .join("")
    : "";
  const corrections = (n.corrections || [])
    .map(
      (c) =>
        `<section><h3>${escape(label("Correction", "تصحیح"))} · ${escape(c.field)}</h3><p dir="auto">${escape(c.correction_text)}</p><p dir="auto">${escape(label("Reason", "وجہ"))}: ${escape(c.correction_reason)}</p><footer dir="auto">${escape(c.author_stamp?.text || "")}</footer></section>`,
    )
    .join("");
  return `<!doctype html><html lang="${ur ? "ur" : "en"}" dir="${ur ? "rtl" : "ltr"}"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><style>@font-face{font-family:Urdu;src:url(data:font/woff2;base64,${font})}@page{size:A4;margin:16mm}body{font-family:Arial,Urdu,sans-serif;color:#000;background:white;font-size:11pt;line-height:${ur ? 2.3 : 1.5}}header{text-align:center;border-bottom:1px solid #333}h1{font-size:18pt}h3{font-size:12pt;margin-bottom:2mm}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:2mm 0}section{break-inside:avoid}small{font-size:9pt}footer{border-top:1px solid #777;padding-top:3mm;margin-top:4mm}</style><header><h1>${escape(h.name || "")}</h1><p>${escape(h.address || "")}</p><p>${escape(h.phone || "")} · ${escape(h.phc_number || "")}</p><small>${escape(h.issue_line || "")}</small></header><h2>${escape(ur ? "طبی نوٹ" : f.title)}</h2><p dir="auto"><strong>${escape(n.patient_name)}</strong> · <bdi>${escape(n.mrn)}</bdi></p><p dir="auto">${escape(label("Visit", "ملاقات"))}: <bdi>${escape(f.visit_number || "")}</bdi></p><p>${escape(label("Examination consent", "معائنے کی رضامندی"))}: ${escape(n.examination_consent === "VerbalObtained" ? "VCO" : n.examination_consent || label("Not recorded", "درج نہیں"))}</p>${notes}${codes}${Object.entries(
    n.vitals_jsonb || {},
  )
    .map(([k, v]) => `<p dir="auto">${escape(k)}: ${escape(v)}</p>`)
    .join(
      "",
    )}${procedure}<footer dir="auto">${escape(n.author_stamp?.text || "")}</footer>${corrections}${n.icd_terms?.some((c) => c.system === "ICD-11") ? `<p><small dir="ltr">${escape(payload.icd11_citation || "")}</small></p>` : ""}</html>`;
}
async function printA4(payload, terminal, { owner, pdf, language }, render) {
  const font = fs
    .readFileSync(
      path.join(
        __dirname,
        "../node_modules/@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-400-normal.woff2",
      ),
    )
    .toString("base64");
  const win = new BrowserWindow({
    show: false,
    parent: owner,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await win.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(render(payload, font, language)),
    );
    await win.webContents.executeJavaScript("document.fonts.ready");
    if (pdf)
      return {
        bytes: await win.webContents.printToPDF({
          pageSize: "A4",
          printBackground: true,
        }),
      };
    const deviceName = terminal.document_printer_address;
    if (terminal.registered && !deviceName)
      throw new Error(
        "No document printer is mapped to this terminal. Ask IT to configure it.",
      );
    const printers = await owner.webContents.getPrintersAsync();
    if (deviceName && !printers.some((p) => p.name === deviceName))
      throw new Error(
        "The mapped document printer is not installed. Ask IT to correct the mapping.",
      );
    await new Promise((resolve, reject) =>
      win.webContents.print(
        {
          silent: !!deviceName,
          deviceName: deviceName || "",
          pageSize: "A4",
          printBackground: true,
        },
        (ok, reason) =>
          ok
            ? resolve()
            : reject(new Error(reason || "Clinical document printing failed")),
      ),
    );
    return { printed: true };
  } finally {
    win.destroy();
  }
}
const printClinical = (payload,terminal,options) => printA4(payload,terminal,options,clinicalHtml);
module.exports = { clinicalHtml, printClinical, printA4 };
