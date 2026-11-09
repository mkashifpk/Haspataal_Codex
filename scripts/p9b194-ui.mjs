import assert from "node:assert/strict";
import fs from "node:fs";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";

const journalPath = "artifacts/p9b/194-journey.json";
assert(!fs.existsSync(journalPath), "Reconcile the previous synthetic write journal before a new run.");
const journal = { code: `SYNTH_P9B194_${Date.now()}`, pending: null, checks: [] };
const save = () => fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
save();
const s = await session("p9b194", "demo.quality");

try {
  const title = "Consent policy setup";
  const formTitle = "SYNTHETIC terminal consent practice";
  await s.p.getByRole("navigation").locator('[data-screen-target="consent_policy_setup"]').click();
  const root = s.p.locator('[data-screen="consent_policy_setup"]');
  const button = (name) => root.getByRole("button", { name, exact: true });
  const field = (name) => root.locator(`[name="${name}"]`);
  const read = async () => (await s.native("api", { method: "GET", path: "/consent-forms?include_inactive=true" })).find((form) => form.code === journal.code);
  const submit = async (description) => {
    await field("confirmed").check();
    journal.pending = description;
    save();
    await button("Save policy change").click();
  };
  const confirmed = async (description) => {
    await expect(root.getByRole("heading", { name: "Review policy change" })).toHaveCount(0);
    journal.pending = null;
    journal.checks.push(description);
    save();
  };

  await button("Add a form").click();
  await field("code").fill(journal.code);
  await field("category").selectOption("Other");
  await field("title").fill(formTitle);
  await field("situations").fill("Synthetic DEV verification only. Never use for patient consent.");
  await field("taken_by").selectOption("Doctor");
  await field("requires_witness").check();
  await field("sort_order").fill("9999");
  await field("language").selectOption("English");
  await field("heading").fill("SYNTHETIC consent practice");
  await field("body").fill("This is a synthetic terminal verification form for training only.");
  await help(s, field("body"), title);
  await expect(field("body")).toHaveValue("This is a synthetic terminal verification form for training only.");
  await s.fault({ failPath: "/consent-forms", failMethod: "POST", once: true });
  await submit("Create once. Reconcile by the exact code or use the original frozen request.");
  await expect(button("Retry original request")).toBeVisible();
  await button("Retry original request").click();
  await confirmed("New form committed. The deliberate lost response replayed the original body and key.");
  const created = await read();
  assert.equal(created.taken_by, "Doctor");
  assert.equal(created.requires_witness, true);
  journal.form_id = created.form_id;
  save();

  const languages = root.locator('select[data-help="cps.text"]');
  await languages.selectOption("Urdu");
  await button("Add language text").click();
  await field("heading").fill("فرضی تربیتی رضامندی");
  await field("body").fill("یہ صرف فرضی تربیت اور ٹرمینل کی جانچ کا متن ہے۔");
  await submit("Add Urdu text once. Reconcile by form and language.");
  await confirmed("Added an Urdu text with the server’s right-to-left direction.");
  await expect(root.locator('[dir="rtl"]').getByRole("heading", { name: "فرضی تربیتی رضامندی" })).toBeVisible();
  const text = (await read()).texts.find((entry) => entry.language === "Urdu");
  assert.equal(text.direction, "rtl");

  await button("Edit form details").click();
  await field("sort_order").fill("9998");
  await submit("Change only the synthetic form’s display order with its loaded version.");
  await confirmed("Changed the synthetic form metadata.");
  assert.equal((await read()).sort_order, 9998);
  await button("Retire form").click();
  await submit("Retire the synthetic form once with its current version.");
  await confirmed("Retired the synthetic form and removed it from the default list.");
  assert.equal((await read()).is_active, false);
  const forms = root.locator('select[data-help="cps.forms"]');
  await expect(forms.locator(`option[value="${created.form_id}"]`)).toHaveCount(0);
  await root.getByRole("checkbox", { name: "Include retired forms" }).check();
  await forms.selectOption(String(created.form_id));
  await expect(root).toContainText(formTitle);

  const maker = root.getByRole("button", { name: "Edit Guardian", exact: true });
  await maker.click();
  await help(s, field("minor_priority"), title);
  await button("Cancel draft").click();
  journal.checks.push("Read adult and minor priorities, opened a decision-maker draft and cancelled it without changing shared policy.");

  const preview = button("Preview consent policy");
  await preview.click();
  await expect(root).toContainText("PDF opened.");
  for (const page of s.app.windows()) if (page !== s.p && page.url().startsWith("data:application/pdf")) await page.close();
  await capture(s, "consent_policy_setup", () => expect(root).toBeVisible());

  const trace = await s.trace();
  const operations = trace.requests.filter((row) => /\/consent-(?:forms|decision-makers|policy)(?:[/?]|$)/.test(row.path));
  const posts = operations.filter((row) => row.method === "POST");
  assert.equal(posts.length, 2);
  assert(posts[0].reply_lost);
  assert.equal(posts[0].key, posts[1].key);
  assert.deepEqual(posts[0].body, posts[1].body);
  assert.equal(posts[0].result.data.form_id, posts[1].result.data.form_id);
  assert.equal(operations.filter((row) => row.method === "PUT").length, 1);
  assert.equal(operations.filter((row) => row.method === "PATCH").length, 2);
  assert(operations.some((row) => row.path.endsWith("/consent-policy/pdf") && row.status === 200));
  journal.checks.push("Server PDF preview and bilingual 250% layout in both themes passed.");
  journal.operations = operations.map((row) => ({
    method: row.method, path: row.path, status: row.status, request_id: row.result?.request_id,
    key: row.key, body: row.body, reply_lost: row.reply_lost, replay: row.replay,
  }));
  journal.renderer = s.j.renderer;
  journal.passed = true;
  save();
  s.j.passed = true;
  s.pass("Consent policy create, original-key replay, translation, metadata, retire, decision-maker read, PDF, F1 and bilingual layout.");
} catch (error) {
  journal.error = error.stack;
  s.j.error = error.stack;
  save();
  throw error;
} finally {
  await s.close();
}
