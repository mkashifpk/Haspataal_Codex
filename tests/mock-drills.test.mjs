import test from "node:test";
import assert from "node:assert/strict";
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const moduleUrl = source => 'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64');
const time = moduleUrl(fs.readFileSync('src/hospital-time.ts','utf8'));
const {
  drillAccess,
  drillDraft,
  drillPayload,
  validateDrill,
  missingToSign,
} = await import(moduleUrl(fs.readFileSync('src/mock-drills-policy.ts','utf8').replace('"./hospital-time"',JSON.stringify(time))));
test("drills: actual permissions and loaded server view govern access", () => {
  const permissions = ["facility.drill.manage"],
    full = { views: { screens: [] } };
  assert.equal(drillAccess(permissions, undefined).canView, false);
  assert.equal(drillAccess(permissions, full).canManage, true);
  assert.equal(drillAccess(["facility.view"], full).canManage, false);
  assert.equal(drillAccess([], full).canView, false);
  for (const view of ["hidden", "records"])
    assert.equal(
      drillAccess(permissions, {
        views: { screens: [{ screen_id: "mock_drills_ops", view }] },
      }).canManage,
      false,
    );
});
test("drills: actual hospital timezone converts time and unchanged edit preserves exact seconds", () => {
  const row = {
    kind: "Fire",
    scenario: "Synthetic drill",
    shift: "Night",
    announced: false,
    held_at: "2026-11-04T10:13:41.123Z",
    participants: [],
    response_minutes: 0,
    observations: null,
    outcome: null,
  };
  const d = drillDraft(row, "Asia/Karachi");
  assert.equal(d.held_at, "2026-11-04T15:13");
  assert.equal(drillPayload(d, "Asia/Karachi", row).held_at, row.held_at);
  assert.equal(
    drillPayload({ ...d, held_at: "2026-11-04T16:00" }, "Asia/Karachi", row)
      .held_at,
    "2026-11-04T11:00:00.000Z",
  );
  assert.throws(() =>
    drillPayload({ ...d, held_at: "not a time" }, "Asia/Karachi"),
  );
});
test("drills: no fabricated outcome, announcement or timing; validate location and participant roles", () => {
  const empty = drillDraft();
  assert.equal(empty.announced, "");
  assert.equal(empty.outcome, "");
  assert.equal(empty.response_minutes, "");
  const d = {
    ...empty,
    kind: "Fire",
    scenario: "Synthetic drill",
    shift: "Night",
    held_at: "2026-11-04T10:00",
    announced: "no",
    area: "Synthetic area",
  };
  assert.deepEqual(validateDrill(d), []);
  assert(validateDrill({ ...d, area: "" }).includes("place"));
  assert(
    validateDrill({ ...d, response_minutes: "601" }).includes(
      "response_minutes",
    ),
  );
  assert(
    validateDrill({
      ...d,
      participants: [
        { employee_id: "9", drill_role: "Observer" },
        { employee_id: "9", drill_role: "Leader" },
      ],
    }).includes("participants"),
  );
  assert.deepEqual(
    missingToSign({ observations: "", outcome: null, participants: [] }),
    ["observations", "outcome", "participants"],
  );
  assert.deepEqual(
    missingToSign({
      observations: "Synthetic findings",
      outcome: "NeedsImprovement",
      participants: [{ employee_id: 9, drill_role: "Observer" }],
    }),
    [],
  );
});
test("drills: full participant replacement retains real employee IDs and missing values stay null", () => {
  const d = {
    ...drillDraft(),
    kind: "Fire",
    scenario: "Synthetic drill",
    shift: "Morning",
    held_at: "2026-11-04T10:00",
    announced: "no",
    department_id: "7",
    participants: [{ employee_id: "23", drill_role: "  Observer  " }],
    response_minutes: "0",
  };
  const p = drillPayload(d, "Asia/Karachi");
  assert.deepEqual(p.participants, [
    { employee_id: 23, drill_role: "Observer" },
  ]);
  assert.equal(p.department_id, 7);
  assert.equal(p.response_minutes, 0);
  assert.equal(p.evacuation_minutes, null);
  assert.equal(p.outcome, null);
  assert.equal(p.observations, null);
});
