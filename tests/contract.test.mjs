import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const {
  validate,
  permissionAllows,
  workspaceView,
  screenView,
} = require("../electron/contract.cjs");
const { checkedRoot } = require("../electron/transport.cjs");
const login = JSON.parse(fs.readFileSync("contracts/login.json", "utf8"));
test("token contract refuses missing access token instead of synthesizing it", () => {
  const e = validate(
    { expires_in: 1800 },
    login.schemas.TokenPair,
    login.schemas,
  );
  assert(e.some((x) => x.includes("access_token")));
  assert(e.some((x) => x.includes("refresh_token")));
});
test("public access and permission any/all are distinct", () => {
  assert(permissionAllows({ access: { authentication: "public" } }, null));
  assert(!permissionAllows({ access: { authentication: "user" } }, null));
  const user = { permissions: ["a"] };
  assert(
    permissionAllows(
      { access: { permissions: ["a", "b"], permissions_mode: "any" } },
      user,
    ),
  );
  assert(
    !permissionAllows(
      { access: { permissions: ["a", "b"], permissions_mode: "all" } },
      user,
    ),
  );
});
test("views follow the server instead of facility category", () => {
  const est = {
    profile: { code: "Clinic" },
    views: {
      workspaces: [{ workspace: "ward_nurse", view: "records" }],
      screens: [{ screen_id: "my_beds", view: "hidden" }],
    },
  };
  assert.equal(workspaceView(est, "ward_nurse"), "records");
  assert.equal(workspaceView(est, "reception"), "full");
  assert.equal(screenView(est, "my_beds"), "hidden");
});
test("invalid hospital certificate is refused", () => {
  assert.throws(() => checkedRoot("not a certificate", "00"));
});
test("delivered screens have a bundle and generated API source without TODOs", () => {
  for (const id of [
    "connect_server",
    "login",
    "app_shell",
    "settings",
    "notifications",
    "help_center",
    "approval_queue",
    "charity_approvals",
    "report_incident",
    "facility_profile",
    "workspace_picker",
    "my_cash_shift",
    "patient_search",
    "registration",
  ]) {
    assert(fs.existsSync(`contracts/${id}.json`));
    const generated = fs.readFileSync(`src/generated/${id}.ts`, "utf8");
    assert(!/\bTODO\b/.test(generated));
  }
});
