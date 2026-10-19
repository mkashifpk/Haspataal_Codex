const { BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function slipHtml(payload, font) {
  if (typeof payload.text !== "string")
    throw new Error("The backend did not provide OPD slip text");
  const width = Number(payload.paper_width_mm);
  if (!Number.isFinite(width) || width < 25 || width > 210)
    throw new Error("Invalid slip paper width");
  const img = (svg) =>
    svg
      ? `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" />`
      : "";
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><style>@font-face{font-family:Urdu;src:url(data:font/woff2;base64,${font})} @page{size:${width}mm auto;margin:3mm}body{margin:0;width:${width - 6}mm;color:#000;background:#fff}pre{font-family:monospace,Urdu;font-size:9px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}img{display:block;max-width:100%;max-height:35mm;margin:3mm auto}</style><pre>${escape(payload.text)}</pre>${img(payload.barcode_svg)}${img(payload.qr_svg)}`;
}
async function printSlip(payload, terminal, { pdf, owner } = {}) {
  const fontPath = path.join(
    __dirname,
    "../node_modules/@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-400-normal.woff2",
  );
  const html = slipHtml(payload, fs.readFileSync(fontPath).toString("base64"));
  const window = new BrowserWindow({
    show: false,
    parent: owner,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await window.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(html),
    );
    await window.webContents.executeJavaScript(
      "document.fonts.ready.then(() => Promise.all(Array.from(document.images).map(i => i.decode())))",
    );
    if (pdf) {
      const bytes = await window.webContents.printToPDF({
        printBackground: true,
        pageSize: { width: payload.paper_width_mm / 25.4, height: 250 / 25.4 },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      return { bytes };
    }
    const deviceName = terminal.receipt_printer_address;
    if (terminal.registered && !deviceName)
      throw new Error(
        "No receipt printer is mapped to this terminal. Ask IT to configure it.",
      );
    const printers = await owner.webContents.getPrintersAsync();
    if (deviceName && !printers.some((p) => p.name === deviceName))
      throw new Error(
        `Mapped printer '${deviceName}' is not installed in Windows. Install it or ask IT to correct the mapping.`,
      );
    await new Promise((resolve, reject) =>
      window.webContents.print(
        {
          silent: !!deviceName,
          deviceName: deviceName || "",
          printBackground: true,
          pageSize: { width: payload.paper_width_mm * 1000, height: 250000 },
          margins: { marginType: "none" },
        },
        (success, reason) =>
          success
            ? resolve()
            : reject(new Error(reason || "Slip printing failed")),
      ),
    );
    return { printed: true };
  } finally {
    window.destroy();
  }
}
module.exports = { slipHtml, printSlip };
