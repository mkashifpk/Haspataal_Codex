import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";
const { clinicalHtml } = createRequire(import.meta.url)(
  "../electron/clinical-print.cjs",
);
const payload = () => ({
  document_type: "clinical_note",
  fields: {
    hospital: {
      name: "Synthetic hospital",
      phc_number: "SYNTHETIC PHC",
      issue_line: "Issued synthetic; this copy printed synthetic",
    },
    title: "Clinical note",
    visit_number: "OPD-SYNTHETIC",
    encounter: {
      status: "Final",
      patient_name: '<img src=x onerror="bad">',
      mrn: "SYNTHETIC-MRN",
      examination_consent: "VerbalObtained",
      chief_complaint: "Synthetic complaint",
      diagnosis: "Synthetic diagnosis",
      icd_terms: [
        {
          code: "SYNTHETIC",
          title: "Synthetic term",
          uri: "https://example.invalid/term",
        },
      ],
      author_stamp: { text: "Synthetic author stamp" },
      corrections: [
        {
          field: "general",
          correction_text: "Synthetic correction",
          correction_reason: "Synthetic reason",
          author_stamp: { text: "Synthetic correction author" },
        },
      ],
    },
  },
});
test("clinical paper requires a finalized note; a draft can never reach the printer", () => {
  const p = payload();
  p.fields.encounter.status = "Draft";
  assert.throws(() => clinicalHtml(p, ""), /finalized/);
});
test("clinical paper preserves issued letterhead, identity, VCO, coded title/URI, original author and append-only correction stamp", () => {
  const html = clinicalHtml(payload(), "");
  for (const value of [
    "SYNTHETIC PHC",
    "Issued synthetic",
    "SYNTHETIC-MRN",
    "VCO",
    "Synthetic term",
    "https://example.invalid/term",
    "Synthetic author stamp",
    "Synthetic correction",
    "Synthetic correction author",
  ])
    assert(html.includes(value), value);
  assert(!html.includes("<img src=x"));
  assert(html.includes("&lt;img"));
  assert(html.includes("default-src 'none'"));
});
test("Urdu clinical paper bundles its font and uses RTL without reversing identifiers", () => {
  const html = clinicalHtml(payload(), "SYNTHETICFONT", "ur");
  assert(html.includes('lang="ur" dir="rtl"'));
  assert(html.includes("data:font/woff2;base64,SYNTHETICFONT"));
  assert(html.includes("<bdi>SYNTHETIC-MRN</bdi>"));
  assert(html.includes("size:A4"));
});
