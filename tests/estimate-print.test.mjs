import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { assertEstimate, estimateHtml } = createRequire(import.meta.url)(
    "../electron/estimate-print.cjs",
  ),
  payload = JSON.parse(
    fs.readFileSync("docs/estimate-fresh-print-payload-2026-10-28.json"),
  );
test("estimate A4 uses the actual server bilingual notes, frozen lines and repeated patient identity", () => {
  for (const lang of ["en", "ur"]) {
    const h = estimateHtml(payload, "font", lang);
    assert(h.includes(payload.fields.estimate.mrn));
    assert(h.includes(payload.fields.estimate.estimate_number));
    assert(h.includes("display:table-header-group"));
    assert(h.includes(payload.fields[lang === "ur" ? "urdu" : "english"][0]));
    assert(h.includes(lang === "ur" ? 'dir="rtl"' : 'dir="ltr"'));
    assert(h.includes(payload.fields.estimate.lines[0].description));
    assert(
      h.indexOf("</table>") >
        h.indexOf(payload.fields[lang === "ur" ? "urdu" : "english"][0]),
    );
  }
});
test("estimate paper refuses wrong reference/printer and escapes patient or note markup", () => {
  assert.throws(() =>
    assertEstimate(payload, payload.fields.estimate.estimate_id + 1),
  );
  assert.throws(() =>
    assertEstimate(
      { ...payload, printer_role: "receipt" },
      payload.fields.estimate.estimate_id,
    ),
  );
  const p = structuredClone(payload);
  p.fields.estimate.patient_name = "<script>unsafe()</script>";
  p.fields.urdu = ["<img src=x>"];
  const h = estimateHtml(p, "font", "ur");
  assert(!h.includes("<script>"));
  assert(h.includes("&lt;script&gt;"));
  assert(h.includes("&lt;img src=x&gt;"));
  assert(h.includes("default-src 'none'"));
});
