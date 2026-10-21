import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  parsePolicy,
  selectConfiguration,
  serverAddresses,
  discoveryPort,
} = require("../electron/provisioning.cjs");

test("policy, machine file, saved choice and first-run fallback have strict precedence", async () => {
  const managed = { source: "policy", server_urls: ["https://policy.example"] };
  const saved = { source: "user", urls: ["https://saved.example"] };
  const file = {
    schema: "haspataal.terminal/1",
    server_urls: ["https://file.example"],
  };
  const options = { programData: "MACHINE", savedPath: "SAVED" };
  assert.equal(
    await selectConfiguration({
      ...options,
      policy: async () => managed,
      read: () => assert.fail("a lower priority source was read"),
    }),
    managed,
  );
  const paths = [];
  assert.deepEqual(
    await selectConfiguration({
      ...options,
      policy: async () => null,
      read: (name) => {
        paths.push(name);
        return file;
      },
    }),
    { ...file, source: "file" },
  );
  assert.equal(paths.length, 1);
  assert.equal(
    await selectConfiguration({
      ...options,
      policy: async () => null,
      read: (name) => (name === "SAVED" ? saved : null),
    }),
    saved,
  );
  assert.equal(
    await selectConfiguration({
      ...options,
      policy: async () => null,
      read: () => null,
    }),
    null,
  );
});

test("broken managed configuration is not silently replaced with a saved hospital", async () => {
  await assert.rejects(
    selectConfiguration({
      policy: async () => {
        throw new Error("registry access denied");
      },
      read: () => assert.fail("policy bypass"),
    }),
    /registry access denied/,
  );
  await assert.rejects(
    selectConfiguration({
      policy: async () => null,
      read: () => ({ schema: "unknown" }),
    }),
    /Unsupported terminal/,
  );
});

test("registry parsing retains every address, pin and custom discovery port", () => {
  const policy = parsePolicy(
    "    ServerUrls    REG_SZ    https://a.example; https://b.example\n" +
      "    CaFingerprintSha256    REG_SZ    AA:BB\n    DiscoveryPort    REG_DWORD    0xba10\n",
  );
  assert.deepEqual(policy.server_urls, [
    "https://a.example",
    "https://b.example",
  ]);
  assert.equal(policy.ca_fingerprint_sha256, "AA:BB");
  assert.equal(discoveryPort(policy.discovery_port), 47632);
  assert.equal(parsePolicy("HKEY_LOCAL_MACHINE"), null);
});

test("alternate addresses cannot smuggle credentials, paths or a downgraded protocol", () => {
  assert.deepEqual(
    serverAddresses(["https://A.example/", "https://a.example"]),
    ["https://a.example"],
  );
  for (const invalid of [
    [],
    ["http://hospital"],
    ["https://u:p@hospital"],
    ["https://hospital/api"],
    ["https://hospital/?x=1"],
    ["https://hospital/#x"],
    ["file:///tmp"],
  ])
    assert.throws(() => serverAddresses(invalid));
  assert.equal(discoveryPort(), 47632);
  for (const value of [0, -1, 65536, 12.2, "47632"])
    assert.throws(() => discoveryPort(value));
});
