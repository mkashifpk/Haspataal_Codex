import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkHelp } from "../scripts/check-help.mjs";
const read = (file) => fs.readFileSync(file, "utf8");

test('shared estimate help validates both branches and rejects unknown runtime guides', () => {
  for (const change of [s => s.replace('"explanation.confirm" : "estimates.confirm"', '"missing.confirm" : "estimates.confirm"'), s => s.replace('explanationOnly ? "explanation.confirm" : "estimates.confirm"', 'screenId')])
    assert.throws(() => checkHelp({media:false,read:file => file === 'src/screens/CostEstimates.tsx' ? change(read(file)) : read(file)}), /missing\/broken control help mapping/);
});
test('Duty Roster cannot ship an unmapped scheduling confirmation',()=>{
 assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/DutyRoster.tsx'?read(file).replace('data-help="roster.confirm"',''):read(file)}),/missing\/broken control help mapping/);
});

test('Imaging worklist cannot ship an unmapped clinical confirmation',()=>{
 assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/RadiologyWorklist.tsx'?read(file).replace('data-help="radiology.confirm"',''):read(file)}),/missing\/broken control help mapping/);
});

test('Critical communication cannot ship an unmapped confirmation or a clinical acknowledgement action',()=>{
 assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/CriticalResultsBench.tsx'?read(file).replace('data-help="critical.confirm"',''):read(file)}),/missing\/broken control help mapping/);
 const source=read('src/screens/CriticalResultsBench.tsx');assert(!source.includes('/acknowledge'));assert(!source.includes('/payments'));assert(!source.includes('price_at_order'));
});
test('Lab bench cannot ship an unmapped result/identity confirmation',()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/LabBench.tsx'?read(file).replace('data-help="bench.confirm"',''):read(file)}),/missing\/broken control help mapping/)});
test('Lab technician rendering and reconciliation do not expose invoice/price objects',()=>{const source=read('src/screens/LabBench.tsx');assert(!source.includes('price_at_order'));assert(!source.includes('value={write.observed}'));assert(!source.includes('<Details'));assert(!source.includes('/payments'));});
test('Lab walk-in confirmation cannot lose its bilingual control mapping',()=>{
 assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/LabOnlyWalkIn.tsx'?read(file).replace('data-help="walkin.confirm"',''):read(file)}),/missing\/broken control help mapping/);
});
test('Lab verification confirmation cannot lose its bilingual control mapping',()=>{
 assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/LabVerification.tsx'?read(file).replace('data-help="verification.confirm"',''):read(file)}),/missing\/broken control help mapping/);
});

test("separately authored registration help must retain its Urdu title", () => {
  assert.throws(()=>checkHelp({media:false,read:file=>file === "src/registration-help.ts" ? read(file).replace(/titleUr:\s*"[^"]*",/, "") : read(file)}), /registration: missing titleUr/);
});
test("all delivered controls, tasks, role guides and FAQ seeds have bilingual help", () => {
  const result = checkHelp({ media: false });
  assert.equal(result.screens, 91);
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

test("charity co-sign confirmation must retain mapped bilingual help",()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/CharityOverride.tsx'?read(file).replace('data-help="charity.confirm"',''):read(file)}),/missing\/broken control help mapping/)});
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

test('Doctor acknowledgement cannot ship without its confirmation help',()=>{
 assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/CriticalResultsDoctor.tsx'?read(file).replace('data-help="critical-doctor.confirm"',''):read(file)}),/missing\/broken control help mapping/);
});

test('Send-out confirmation and rejection recovery cannot lose their control help',()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/LabSendOuts.tsx'?read(file).replace('data-help="sendout.confirm"',''):read(file)}),/missing\/broken control help mapping/);});

test('Outsourced imaging cannot ship an unmapped final confirmation',()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/ImagingOutsourced.tsx'?read(file).replace('data-help="outsourced.confirm"',''):read(file)}),/missing\/broken control help mapping/);});

test('Repeat register cannot ship an unmapped clinical confirmation',()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/ImagingRepeats.tsx'?read(file).replace('data-help="repeats.confirm"',''):read(file)}),/missing\/broken control help mapping/);});

test("Roll Call cannot ship an unmapped attendance confirmation",()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==="src/screens/RollCall.tsx"?read(file).replace('data-help="rollcall.confirm"',''):read(file)}),/missing\/broken control help mapping/)});

test("My beds cannot ship an unmapped cleaning review",()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==="src/screens/MyBeds.tsx"?read(file).replace('data-help="mybeds.review"',''):read(file)}),/missing\/broken control help mapping/)});
test('Ward assessment cannot ship an unmapped review control',()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/NursingAssessment.tsx'?read(file).replace('data-help="assessment.review"',''):read(file)}),/missing\/broken control help mapping/)});
test('Ward patient handover cannot ship an unmapped context control',()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==='src/ward-admission.tsx'?read(file).replace('data-help="ward.context"',''):read(file)}),/missing\/broken control help mapping/)});
test('Vitals cannot ship an unmapped correction/review control',()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==='src/screens/VitalsFlowsheet.tsx'?read(file).replace('data-help="vitals.review"',''):read(file)}),/missing\/broken control help mapping/)});
test('MAR and verbal order review controls must retain authored help',()=>{for(const [file,id]of [['src/screens/MedicationAdministration.tsx','mar.review'],['src/screens/VerbalOrders.tsx','verbal.review']])assert.throws(()=>checkHelp({media:false,read:path=>path===file?read(path).replace('data-help="'+id+'"',''):read(path)}),/missing\/broken control help mapping/)});
