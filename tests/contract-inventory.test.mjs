import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { matchOperation } = createRequire(import.meta.url)("../electron/contract.cjs");

test("all saved runtime operations have a valid route and patient profile remains reachable", () => {
  const operations = fs.readdirSync("contracts").filter(n => n.endsWith(".json")).flatMap(n => {
    const bundle = JSON.parse(fs.readFileSync(`contracts/${n}`, "utf8"));
    for (const endpoint of bundle.endpoints || []) assert.match(endpoint.endpoint || "", /^(GET|POST|PUT|PATCH|DELETE) \/\S+$/, `${n}: malformed runtime operation`);
    return bundle.endpoints || [];
  });
  assert.equal(matchOperation(operations, "GET", "/patients/14").endpoint, "GET /patients/{patient_id}");
  assert.equal(matchOperation(operations, "GET", "/patients/14/documents").endpoint, "GET /patients/{patient_id}/documents");
});
