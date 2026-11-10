import assert from "node:assert/strict";
import fs from "node:fs";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";

const dir = "docs/phase-p9b-200-201-2026-11-10";
const read = name => JSON.parse(fs.readFileSync(`${dir}/${name}.json`, "utf8").replace(/^\uFEFF/, ""));
const save = (name, value) => fs.writeFileSync(`${dir}/${name}.json`, JSON.stringify(value, null, 2) + "\n");
const item = read("fixture-cycle-start-result").data.items[0];
const resume = process.argv.includes("--resume");
const roleCases = [
  [200, "record_deficiencies_doctor", "demo.doctor", "Plan of care documented", "fixture-medical-correction", true],
  [201, "record_deficiencies_nursing", "demo.headnurse", "Nursing care plan documented", "fixture-nursing-correction", false],
];

async function journey([position, screen, actor, criterion, correction, lostReply]) {
  const intent = `${position}-resolve-intent`;
  assert(!fs.existsSync(`${dir}/${intent}.json`), "Reconcile the prior resolution before running again.");
  const s = await session(`p9b${position}`, actor);
  try {
    const nav = s.p.locator(`[data-screen-target="${screen}"]`);
    const badge = nav.locator("b");
    await nav.click();
    const root = s.p.locator(`[data-screen="${screen}"]`);
    let prior;
    if (resume) {
      const evidence = read(`${position}-notification`);
      assert(evidence.open_counts.includes(0) && evidence.open_counts.some(count => count > 0));
    } else {
      await expect(root).toContainText("There are no open deficiencies in your worklist.");
      await expect(badge).toHaveText("0");
      await root.getByRole("button", { name: "Refresh deficiencies", exact: true }).click();
      await expect(root).toContainText("There are no open deficiencies in your worklist.");
      prior = (await s.trace()).requests.filter(r => r.path.includes("status=Open") && r.status === 200).length;
      save(`${position}-ready`, { actor, screen, open: 0, reads_before_review: prior, renderer: s.j.renderer });
    }

    const row = root.locator("article[data-deficiency]").filter({ has: s.p.getByRole("heading", { name: criterion, exact: true }) });
    await expect(row).toBeVisible({ timeout: 240000 });
    await expect(row).toContainText(item[2]);
    await expect(badge).not.toHaveText("0");
    const openCount = Number(await badge.innerText());
    assert(openCount > 0);
    const readsAfterReview = (await s.trace()).requests.filter(r => r.path.includes("status=Open") && r.status === 200).length;
    if (!resume) assert(readsAfterReview > prior, "The notification should cause an automatic open-list refresh.");
    const id = Number(await row.getAttribute("data-deficiency"));
    assert(Number.isSafeInteger(id) && id > 0);
    await capture(s, screen, () => expect(row).toBeVisible());
    const mark = row.getByRole("button", { name: "Mark corrected", exact: true });
    await expect(mark).toBeEnabled();
    await mark.click();
    const dialog = s.p.getByRole("dialog").filter({ has: s.p.getByRole("heading", { name: "Mark corrected", exact: true }) });
    const note = dialog.getByLabel("What was corrected?", { exact: true });
    const confirm = dialog.getByRole("button", { name: "Confirm correction", exact: true });
    await expect(confirm).toBeDisabled();
    await note.fill("SYNTHETIC DEV unsent note for F1 focus test");
    await help(s, note, "Record deficiencies to fix");
    await expect(note).toHaveValue("SYNTHETIC DEV unsent note for F1 focus test");
    save(`${position}-finding`, { id, criterion, record: item[2], openCount, renderer: s.j.renderer });

    await expect.poll(() => {
      if (!fs.existsSync(`${dir}/${correction}-result.json`)) return false;
      const r = read(`${correction}-result`);
      return r.status >= 200 && r.status < 300;
    }, { timeout: 240000, intervals: [500, 1000, 2000] }).toBe(true);
    const source = read(`${correction}-result`);
    const resolution = `SYNTHETIC DEV source correction confirmed by ${source.request_id}.`;
    await note.fill(resolution);
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "I already added the correction to the source record." }).check();
    const endpoint = `/quality/record-review-deficiencies/${id}/resolve`;
    if (lostReply) await s.fault({ failPath: endpoint, failMethod: "POST", once: true });
    save(intent, { actor, endpoint, id, source_request_id: source.request_id, body: { status: "Corrected", note: resolution }, lostReply });
    await confirm.click();
    if (lostReply) {
      await expect(dialog).toContainText("The result is unknown.");
      await expect(dialog.getByRole("button", { name: "Retry original request" })).toHaveCount(0);
      await dialog.getByRole("button", { name: "Read current result" }).click();
      await expect(dialog).toContainText(resolution);
      await dialog.getByRole("button", { name: "Result reviewed; return to draft" }).click();
    }
    await expect(dialog).toHaveCount(0);
    await expect(badge).toHaveText(String(openCount - 1));
    await expect(row).toHaveCount(0);
    await root.getByLabel("Deficiency status", { exact: true }).selectOption("Corrected");
    await expect(row).toContainText(resolution);
    await expect(row.getByRole("button", { name: "Mark corrected", exact: true })).toHaveCount(0);
    const trace = (await s.trace()).requests.filter(r => r.path.includes("/quality/record-review-deficiencies"));
    const writes = trace.filter(r => r.method === "POST");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].status, 200);
    assert.equal(writes[0].result?.data?.deficiency_id, id);
    assert.equal(writes[0].result?.data?.status, "Corrected");
    save(`${position}-journey`, {
      passed: true, actor, screen, id, renderer: s.j.renderer, open_before: openCount, open_after: openCount - 1,
      notification_read: resume ? `${position}-notification.json` : readsAfterReview > prior, lost_reply_reconciled: lostReply,
      requests: trace.map(r => ({ method: r.method, path: r.path, status: r.status, request_id: r.result?.request_id, reply_lost: r.reply_lost })),
    });
    s.j.passed = true;
    s.pass(`${actor} saw the notification, used contextual help and marked the source correction exactly once.`);
  } catch (error) {
    s.j.error = error.stack;
    throw error;
  } finally {
    await s.close();
  }
}

const outcomes = await Promise.allSettled(roleCases.map(journey));
for (const outcome of outcomes) {
  if (outcome.status === "rejected") {
    console.error(outcome.reason);
    process.exitCode = 1;
  }
}
