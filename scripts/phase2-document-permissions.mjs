// Actual denied-role menu/native guards; requests cannot leave the terminal.
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const s = await session("phase2-document-permissions", "demo.cashier"),
  p = s.p;
try {
  const me = await s.native("api", { method: "GET", path: "/auth/me" });
  assert(!me.permissions.includes("patient.document.upload"));
  assert(!me.permissions.includes("patient.document.view"));
  await expect(
    p
      .getByRole("navigation")
      .getByRole("button", { name: "Patient document vault", exact: false }),
  ).toHaveCount(0);
  for (const method of ["GET", "POST"]) {
    const r = await p.evaluate((v) => window.terminal.call("api", v), {
      method,
      path: "/patients/5/documents",
      ...(method === "POST"
        ? {
            key: "DEMO-DOC-FORBIDDEN-20261025",
            body: { __multipart: [{ name: "doc_type", value: "Other" }] },
          }
        : {}),
    });
    assert.equal(r.error?.code, "PERMISSION_REQUIRED");
  }
  const file = await p.evaluate(() =>
    window.terminal.call("patient-file", { documentId: 1, save: true }),
  );
  assert.equal(file.ok, false);
  assert.match(file.error.message, /permission/i);
  assert.equal(
    (await s.trace()).requests.filter((x) => x.path.includes("documents"))
      .length,
    0,
  );
  s.pass(
    "Cashier no vault menu; native list/upload/download permission checks refuse before HTTP and expose no file; actual server list/download403 verified separately",
  );
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await s.close();
}
