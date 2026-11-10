import assert from "node:assert/strict";
import fs from "node:fs";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";

const dir = "docs/phase-p9b-218-222-2026-11-10";
fs.mkdirSync(dir, { recursive: true });
const screens = [
  [
    218,
    "diagnostic_correlation",
    "Diagnostic correlation review",
    "/diagnostics/correlations",
  ],
  [
    219,
    "medication_statistics",
    "Medication safety statistics",
    "/medication-safety/",
  ],
  [
    220,
    "estimate_statistics",
    "Cost estimates: statistics and the pricing policy",
    "/cost-estimates/",
  ],
  [
    221,
    "surgical_statistics",
    "Surgical care statistics",
    "/ot/clinical-statistics",
  ],
  [
    222,
    "surgical_statistics_owner",
    "Surgical care statistics",
    "/ot/clinical-statistics",
  ],
];

async function run(account, workspace, selected) {
  const s = await session(`p9b-final-${account}`, account);
  try {
    const p = s.p;
    const card = p
      .locator(".workspace-card")
      .filter({
        has: p.getByRole("heading", { name: workspace, exact: true }),
      });
    if (
      !(await p.locator(`[data-screen-target="${selected[0][1]}"]`).isVisible())
    ) {
      if (!(await card.isVisible()))
        await p
          .getByRole("navigation")
          .getByRole("button", { name: "Workspaces", exact: true })
          .click();
      await card
        .getByRole("button", { name: "Open workspace →", exact: true })
        .click();
    }
    await s.prefs({ pdf_download: "Separate" });
    await s.app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({ canceled: true });
    });
    for (const [position, id, title, path] of selected) {
      const start = (await s.trace()).requests.length;
      const succeeded = async (pattern) =>
        (await s.trace()).requests
          .slice(start)
          .some((r) => pattern.test(r.path) && r.status === 200);
      const root = p.locator(`[data-screen="${id}"]`);
      const heading = (name) =>
        root.getByRole("heading", { name, exact: true });
      const button = (name) => root.getByRole("button", { name, exact: true });
      await p.locator(`[data-screen-target="${id}"]`).click();
      await expect(heading(title)).toBeVisible();
      await expect.poll(() => succeeded(new RegExp(path))).toBe(true);
      let emptyDetail;
      if (position === 218) {
        await expect(heading("Correlation history")).toBeVisible();
        await expect(heading("Unreviewed reports")).toBeVisible();
        const field = root.getByLabel("Report source", { exact: true });
        await help(s, field, title);
        await field.selectOption("Lab");
        await expect
          .poll(() => succeeded(/correlations\/worklist\?.*source=Lab/))
          .toBe(true);
        await root
          .getByLabel("Review outcome", { exact: true })
          .selectOption("NotAssessable");
        await expect
          .poll(() => succeeded(/correlations\?.*outcome=NotAssessable/))
          .toBe(true);
      } else if (position === 219) {
        for (const name of [
          "MSDS measures",
          "Recall durations",
          "Recall register",
          "High-alert medicines",
          "Restricted medicines",
          "Look-alike and sound-alike pairs",
        ])
          await expect(heading(name)).toBeVisible();
        const save = button("Save medication safety policy");
        await help(s, save, title);
        await save.click();
        await expect(root).toContainText("PDF save cancelled.");
        await expect.poll(() => succeeded(/\/drug-recalls(?:\?|$)/)).toBe(true);
        emptyDetail = true;
        // Only a recall explicitly marked synthetic may be opened by this test.
        const synthetic = root
          .getByRole("row")
          .filter({ hasText: /synthetic|QA-FIXTURE/i })
          .getByRole("button");
        if ((await synthetic.count()) === 1) {
          await synthetic.click();
          await expect(heading("Recall batches")).toBeVisible();
          emptyDetail = false;
        }
      } else if (position === 220) {
        for (const name of [
          "Estimate evidence",
          "Estimates by reason",
          "Estimate worklist",
        ])
          await expect(heading(name)).toBeVisible();
        await help(s, button("Save pricing policy"), title);
        for (const name of ["Save pricing policy", "Save tariff PDF"]) {
          await button(name).click();
          await expect(root).toContainText("PDF save cancelled.");
        }
        await s.prefs({ pdf_download: "Combined" });
        await button("Save combined estimate documents").click();
        await expect(root).toContainText("PDF save cancelled.");
        await s.prefs({ pdf_download: "Separate" });
      } else {
        for (const name of [
          "MSDS measures",
          "By surgeon",
          "By theatre",
          "Open adverse events",
        ])
          await expect(heading(name)).toBeVisible();
        const field = root.getByLabel("Open adverse event area", {
          exact: true,
        });
        await help(s, field, title);
        await field.selectOption("Anaesthesia");
        await expect
          .poll(() =>
            succeeded(
              /incidents\?.*area=Anaesthesia.*open_only=true|incidents\?.*open_only=true.*area=Anaesthesia/,
            ),
          )
          .toBe(true);
      }
      await capture(s, id, () => expect(root).toBeVisible());
      const trace = (await s.trace()).requests
        .slice(start)
        .filter((r) =>
          /diagnostics\/correlations|medication-safety|drug-recalls|cost-estimates|tariff\/|ot\/clinical-statistics|\/incidents/.test(
            r.path,
          ),
        );
      assert(trace.every((r) => r.method === "GET"));
      const evidence = {
        passed: true,
        renderer: s.j.renderer,
        emptyDetail,
        requests: trace.map((r) => ({
          path: r.path,
          status: r.status,
          request_id: r.result?.request_id,
        })),
      };
      fs.writeFileSync(
        `${dir}/${position}-journey.json`,
        JSON.stringify(evidence, null, 2) + "\n",
      );
      s.pass(`${position}: DEV reads, F1, English and Urdu at 250%.`);
    }
    s.j.passed = true;
  } catch (e) {
    s.j.error = e.stack;
    throw e;
  } finally {
    await s.close();
  }
}

const only = Number(process.argv[2]);
for (const [account, workspace, positions] of [
  ["demo.quality", "Quality & Medical Records", [218, 219, 221]],
  ["demo.owner", "Owner / Hospital Admin", [220, 222]],
]) {
  const selected = screens.filter(
    ([n]) => positions.includes(n) && (!only || only === n),
  );
  if (selected.length) {
    try {
      await run(account, workspace, selected);
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    }
  }
}
