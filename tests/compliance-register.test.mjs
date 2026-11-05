import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  complianceAccess,
  documentDraft,
  createDocumentPayload,
  editDocumentPayload,
  validateDocument,
  groupedDocuments,
} from "../src/compliance-register-policy.ts";
const { checkedScan } = createRequire(import.meta.url)(
  "../electron/compliance-files.cjs",
);
test("compliance: explicit permissions and loaded establishment govern write/view access", () => {
  const manage = ["facility.compliance.manage"],
    est = { views: { screens: [] } };
  assert.equal(complianceAccess(manage, undefined).canView, false);
  assert.equal(complianceAccess(manage, est).canManage, true);
  assert.equal(
    complianceAccess(["blood.bank.manage"], est).canView,
    false,
    "list-only bank permission does not grant detail/scan workspace",
  );
  assert.equal(complianceAccess(["facility.view"], est).canManage, false);
  for (const view of ["hidden", "records"])
    assert.equal(
      complianceAccess(manage, {
        views: { screens: [{ screen_id: "compliance_register_ops", view }] },
      }).canManage,
      false,
    );
});
test("compliance: correction sends only changed values plus original version, including deliberate clearing", () => {
  const original = {
    ...createDocumentPayload({
      ...documentDraft(),
      title: "Synthetic licence",
      kind: "Licence",
      category: "Other",
      valid_until: "2027-11-04",
    }),
    document_id: 42,
    row_version: 8,
    renewal_applied_on: null,
    renewal_reference: "Old receipt",
    authority: "Authority",
    responsible_user_id: 7,
  };
  const d = documentDraft(original);
  d.authority = "";
  d.renewal_reference = "";
  d.renewal_applied_on = "2026-11-04";
  assert.deepEqual(editDocumentPayload(d, original), {
    expected_version: 8,
    authority: null,
    renewal_applied_on: "2026-11-04",
    renewal_reference: null,
  });
  assert.equal(
    createDocumentPayload({ ...d, responsible_user_id: "17" })
      .responsible_user_id,
    17,
  );
});
test("compliance: dates/lead/title constraints do not invent an expiry for a law", () => {
  const d = {
    ...documentDraft(),
    title: "Synthetic law",
    kind: "Law",
    category: "Other",
  };
  assert.deepEqual(validateDocument(d, "create"), []);
  assert(
    validateDocument({ ...d, kind: "Licence" }, "create").includes(
      "valid_until",
    ),
  );
  assert(
    validateDocument({ ...d, kind: "Plan" }, "create").includes("valid_until"),
  );
  assert(
    validateDocument(
      { ...d, issued_on: "2027-01-02", valid_until: "2027-01-01" },
      "create",
    ).includes("date_order"),
  );
  assert(
    validateDocument({ ...d, renewal_lead_days: "366" }, "edit").includes(
      "renewal_lead_days",
    ),
  );
  assert(validateDocument(d, "renew").includes("issued_on"));
});
test("compliance: groups use server state and search preserves renewal/withdrawal history", () => {
  const rows = [
    {
      title: "Synthetic record",
      state: "Valid",
      valid_until: "2000-01-01",
      reference_no: "REF1",
    },
    { title: "Older copy", state: "Renewed", reference_no: "REF2" },
  ];
  const all = groupedDocuments(rows, "");
  assert.equal(all.find((g) => g.state === "Valid").rows.length, 1);
  assert.equal(all.find((g) => g.state === "Expired").rows.length, 0);
  assert.equal(
    groupedDocuments(rows, "ref2").find((g) => g.state === "Renewed").rows
      .length,
    1,
  );
});
test("compliance: native scan rejects mislabeled/active content and accepts only matching signatures", () => {
  assert.equal(
    checkedScan(
      Buffer.from("%PDF-1.7 synthetic"),
      "application/pdf; charset=binary",
    ).extension,
    "pdf",
  );
  assert.equal(
    checkedScan(Buffer.from("89504e470d0a1a0a", "hex"), "image/png").extension,
    "png",
  );
  assert.equal(
    checkedScan(Buffer.from([255, 216, 255, 217]), "image/jpeg").extension,
    "jpg",
  );
  for (const [bytes, mime] of [
    [Buffer.from("<script>bad</script>"), "application/pdf"],
    [Buffer.from("%PDF-1.7"), "image/png"],
    [Buffer.from("89504e470d0a1a0a", "hex"), "text/html"],
    [Buffer.alloc(0), "image/jpeg"],
  ])
    assert.throws(() => checkedScan(bytes, mime), /does not match/);
});
