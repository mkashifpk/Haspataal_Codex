import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkHelp } from "../scripts/check-help.mjs";
const read = (file) => fs.readFileSync(file, "utf8");
test("all delivered controls, tasks, role guides and FAQ seeds have bilingual help", () => {
  const result = checkHelp({ media: false });
  assert.equal(result.screens, 12);
  assert(result.controls > 90);
  assert.equal(result.workspaceGuides, 30);
});
test("the first Phase 2 screen cannot add an uncovered cash control", () => {
  assert.throws(
    () =>
      checkHelp({
        media: false,
        read: (file) =>
          file === "src/screens/CashShift.tsx"
            ? read(file).replace('data-help="cash.open"', "")
            : read(file),
      }),
    /missing\/broken control help mapping/,
  );
});
test("a new unmapped interactive control fails the delivery check", () => {
  assert.throws(
    () =>
      checkHelp({
        media: false,
        read: (file) =>
          file === "src/screens/Facility.tsx"
            ? read(file).replace('data-help="facility.tabs"', "")
            : read(file),
      }),
    /missing\/broken control help mapping/,
  );
});
test("a newly exposed backend task without handbook guidance fails coverage", () => {
  assert.throws(
    () =>
      checkHelp({
        media: false,
        read: (file) => {
          if (file !== "src/foundation-catalogue.json") return read(file);
          const j = JSON.parse(read(file));
          j.screens.settings.taskCalls.push("POST /settings/new-task");
          return JSON.stringify(j);
        },
      }),
    /uncovered backend task/,
  );
});
test("missing translated screen steps fail coverage", () => {
  assert.throws(
    () =>
      checkHelp({
        media: false,
        read: (file) =>
          file === "src/help.ts"
            ? read(file).replace(/stepsUr: \[[\s\S]*?\n    \],/, "stepsUr: [],")
            : read(file),
      }),
    /empty stepsUr/,
  );
});
