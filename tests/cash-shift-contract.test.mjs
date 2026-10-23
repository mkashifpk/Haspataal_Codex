import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { matchOperation, validate } = createRequire(import.meta.url)(
  "../electron/contract.cjs",
);
const bundles = fs
  .readdirSync("contracts")
  .filter(
    (n) =>
      n.endsWith(".json") &&
      !n.startsWith("meta-") &&
      !n.startsWith("handbook-"),
  )
  .map((n) => JSON.parse(fs.readFileSync("contracts/" + n)));
const operations = bundles.flatMap((b) => b.endpoints || []);
const schemas = Object.assign({}, ...bundles.map((b) => b.schemas || {}));
test("cash-shift empty-state uses mine contract rather than shift-id recovery contract", () => {
  const mine = matchOperation(
    operations,
    "GET",
    "/finance/cash-shifts/mine?unused=1",
  );
  assert.equal(mine.endpoint, "GET /finance/cash-shifts/mine");
  const schema = Object.values(mine.responses["200"].content)[0].schema;
  assert.deepEqual(
    validate(
      {
        data: null,
        meta: { server_time: "2026-10-23T00:00:00Z" },
        request_id: "test",
      },
      schema,
      schemas,
    ),
    [],
  );
  const detail = matchOperation(operations, "GET", "/finance/cash-shifts/12");
  assert.equal(detail.endpoint, "GET /finance/cash-shifts/{shift_id}");
  assert(
    validate(
      {
        data: null,
        meta: { server_time: "2026-10-23T00:00:00Z" },
        request_id: "test",
      },
      Object.values(detail.responses["200"].content)[0].schema,
      schemas,
    ).length > 0,
  );
  assert.equal(
    matchOperation(operations, "DELETE", "/finance/cash-shifts/mine"),
    undefined,
  );
  assert.equal(
    matchOperation(operations, "GET", "/finance/cash-shifts/12/unrecognized"),
    undefined,
  );
});
