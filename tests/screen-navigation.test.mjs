import test from "node:test";
import assert from "node:assert/strict";
import { screenNavigation, handbookPermits, directWorkspace } from "../src/screen-navigation.ts";
test("employee workspace does not turn a single duty into a launcher; guest and multiple-duty boundaries remain server-owned", () => {
  const reception={code:"reception",every_employee:false},self={code:"self_service",every_employee:true},lab={code:"lab",every_employee:false};
  assert.equal(directWorkspace([reception,self]),reception);
  assert.equal(directWorkspace([reception,lab,self]),undefined);
  assert.equal(directWorkspace([reception]),reception);
  assert.equal(directWorkspace([self]),self);
  assert.equal(directWorkspace([]),undefined);
});
test("navigation restores delivered routes omitted from a legacy list, only within the server permission/view boundary", () => {
  const outline = {
    shared_screens: [{ id: "settings" }],
    workspaces: [
      {
        screens: [
          { id: "payroll" },
          { id: "staff_directory" },
          { id: "not_built" },
          { id: "private_page" },
        ],
      },
    ],
  };
  const est = {
    views: {
      screens: [
        { screen_id: "payroll", view: "records" },
        { screen_id: "private_page", view: "hidden" },
      ],
    },
  };
  assert.deepEqual(
    screenNavigation(
      ["settings", "settings", "foreign_role"],
      outline,
      est,
      [
        "settings",
        "payroll",
        "staff_directory",
        "private_page",
        "foreign_role",
      ],
      true,
    ),
    ["settings", "payroll", "staff_directory"],
  );
  assert.equal(handbookPermits(outline, "foreign_role"), false);
  assert.deepEqual(
    screenNavigation(["settings"], outline, est, ["settings"], false),
    [],
  );
});
test("public pages and facility-owned setup do not become staff navigation entries", () => {
  const ids = [
    "login",
    "badge_station_kiosk",
    "help_center",
    "imaging_quality_setup",
  ];
  const outline = { shared_screens: ids.map((id) => ({ id })), workspaces: [] };
  assert.deepEqual(
    screenNavigation(
      ids,
      outline,
      {
        views: {
          screens: [{ screen_id: "imaging_quality_setup", view: "setup" }],
        },
      },
      ids,
      true,
    ),
    [],
  );
});
