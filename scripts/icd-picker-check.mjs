import { session, expect, capture, help } from "./clinical-test-kit.mjs";
import assert from "node:assert/strict";
const s = await session("icd-picker-check");
const p = s.p;
try {
  await s.nav("ICD code picker");
  await expect(p.locator("main h1")).toHaveText("ICD code picker");
  const input = p.getByLabel("Code prefix or diagnosis words", { exact: true });
  await input.fill("C");
  await p.waitForTimeout(400);
  assert.equal(
    (await s.trace()).requests.filter((r) => r.path.includes("/icd/codes?"))
      .length,
    0,
  );
  await input.fill("CA40");
  await expect(p.locator("main .list-row").first()).toBeVisible();
  await expect(p.locator("main .list-row").first()).toContainText("CA40");
  await help(s, input, "ICD code picker");
  await expect(input).toHaveValue("CA40");
  await p.locator("main .list-row").first().click();
  await expect(
    p.getByRole("button", { name: "Choose this diagnosis code", exact: true }),
  ).toBeVisible();
  await p
    .getByRole("button", { name: "Choose this diagnosis code", exact: true })
    .click();
  await expect(
    p.getByText(
      "Chosen for this form; no clinical record has been saved by the picker.",
      { exact: false },
    ),
  ).toBeVisible();
  assert(
    (await s.trace()).requests.some(
      (r) => r.path.includes("/icd/codes/CA40") && r.status === 200,
    ),
  );
  await input.fill("pneumonia bacterial");
  await expect(p.locator("main .list-row").first()).toBeVisible();
  await expect(p.getByText("Chosen for this form; no clinical record has been saved by the picker.", {exact:false})).toHaveCount(0);
  const terms = await s.native("api", {
    method: "GET",
    path: "/icd/codes?q=pneumonia%20bacterial&limit=30",
  });
  s.j.search = terms;
  s.save();
  await p
    .getByRole("button", { name: "Browse classification", exact: true })
    .click();
  await expect(p.locator("main .list-row").first()).toBeVisible();
  await p
    .locator("main [data-help='icd.browse']")
    .filter({ hasText: "Browse children" })
    .first()
    .click();
  await expect(
    p.getByRole("button", { name: "Parent level", exact: true }),
  ).toBeVisible();
  await p.getByRole("button", { name: "All chapters", exact: true }).click();
  await p.getByRole("button", { name: "Search codes", exact: true }).click();
  await input.fill("ZXNOTAREALDIAGNOSIS");
  await expect(
    p.getByText("No matching codes.", { exact: false }),
  ).toBeVisible();
  s.pass(
    "Real releases/search code and words/detail/choice/browse/parent/root; two-character threshold and empty result; F1 preserves input; no business writes",
  );
  await input.fill("CA40");
  await expect(p.locator("main .list-row").first()).toBeVisible();
  const codeRows = await s.native("api", {method:"GET",path:"/icd/codes?q=CA40&limit=30"});
  assert(codeRows.items.some(r=>r.is_residual), "Real classification must supply a residual test case");
  const actualCodes = await p.locator("main .list-row strong").allTextContents();
  const expectedCodes = [...codeRows.items].sort((a,b)=>Number(a.is_residual)-Number(b.is_residual)).map(r=>r.code);
  assert.deepEqual(actualCodes, expectedCodes);
  await expect(p.locator("main")).toContainText("prefer a specific code");
  const residual = codeRows.items.find(r=>r.is_residual);
  await p.locator("main .list-row").filter({has:p.getByText(residual.code,{exact:true})}).click();
  await expect(p.locator("main")).toContainText("This is a residual code.");
  const releases = await s.native("api",{method:"GET",path:"/icd/releases"});
  await expect(p.locator("main")).toContainText(releases.coding_system);
  s.j.classification = {system:releases.coding_system,residual:residual.code,ordered_codes:actualCodes};s.save();
  s.pass("Actual server-selected classification; real residual codes sorted after specific codes with explicit warnings; changing query clears old choice");
  await s.fault({failPath:"/icd/releases",failMethod:"GET",once:false});
  await p.getByRole("button",{name:"Refresh classification",exact:true}).click();
  await expect(p.getByRole("button",{name:"Try again",exact:true})).toBeVisible();
  await expect(p.getByRole("button",{name:"Choose this diagnosis code",exact:true})).toHaveCount(0);
  await s.fault({failPath:null});
  await p.getByRole("button",{name:"Try again",exact:true}).click();
  await expect(input).toBeVisible();
  s.pass("Lost real releases reply produces visible failure with no selectable stale classification; Retry rereads actual server");
  await capture(s, "icd_picker");
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method !== "GET").length,
    0,
  );
  s.pass(
    "English/Urdu both themes250% without overflow; required WHO citation rendered",
  );
  await expect(p.locator("main")).toContainText(
    "Creative Commons Attribution-NoDerivatives",
  );
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.save();
  await p.screenshot({ path: "artifacts/icd-picker-failure.png" });
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await s.close();
}
