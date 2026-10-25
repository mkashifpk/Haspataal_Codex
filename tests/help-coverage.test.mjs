import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkHelp } from "../scripts/check-help.mjs";
const read = (file) => fs.readFileSync(file, "utf8");

test("separately authored registration help must retain its Urdu title", () => {
  assert.throws(()=>checkHelp({media:false,read:file=>file === "src/registration-help.ts" ? read(file).replace(/titleUr:\s*"[^"]*",/, "") : read(file)}), /registration: missing titleUr/);
});
test("all delivered controls, tasks, role guides and FAQ seeds have bilingual help", () => {
  const result = checkHelp({ media: false });
  assert.equal(result.screens, 34);
  assert(result.controls > 90);
  assert.equal(result.workspaceGuides, 30);
});

test("Order Queries cannot ship an unmapped confirmation control", () => {
  assert.throws(() => checkHelp({media:false, read:file =>
    file === "src/screens/OrderQueries.tsx"
      ? read(file).replace('data-help="queries.confirm"', "") : read(file)
  }), /missing\/broken control help mapping/);
});

test("OTC cannot ship an unmapped financial confirmation", () => {
  assert.throws(()=>checkHelp({media:false,read:file=>file === "src/screens/OTCMode.tsx" ? read(file).replace('data-help="otc.confirm"','') : read(file)}),/missing\/broken control help mapping/);
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
test("cash-back handover cannot ship without mapped bilingual control help", () => {
  assert.throws(
    () =>
      checkHelp({
        media: false,
        read: (file) =>
          file === "src/screens/TicketDesk.tsx"
            ? read(file).replace('data-help="cashback.confirm"', "")
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
            ? read(file).replace(/stepsUr: \[[\s\S]*?\n\s*\],/, "stepsUr: [],")
            : read(file),
      }),
    /empty stepsUr/,
  );
});
