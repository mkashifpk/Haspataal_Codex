import test from "node:test";
import assert from "node:assert/strict";
import {
  sortVerificationQueue,
  canVerifyResult,
  validateVerification,
  verificationWritable,
  verificationSnapshot,
  verificationRecovery,
} from "../src/lab-verification-policy.ts";

test('lost decisions use frozen order/patient/result/item IDs, never queue absence or names',()=>{
 const item={requisition_id:20,patient_id:30,result_id:40,lab_requisition_item_id:50};
 const result={result_id:40,lab_requisition_item_id:50,status:'Published',verified_stamp:{user_id:22}};
 const order={requisition_id:20,patient_id:30,results:[result]};
 assert.equal(verificationRecovery(item,order).decided,true);
 assert.equal(verificationRecovery(item,{...order,results:[{...result,status:'Rejected'}]}).decided,true);
 assert.equal(verificationRecovery(item,{...order,results:[{...result,status:'PendingVerification'}]}).pending,true);
 for(const changed of [{...order,requisition_id:21},{...order,patient_id:31},{...order,results:[]},{...order,results:[{...result,result_id:41}]},{...order,results:[{...result,lab_requisition_item_id:51}]}]){
   const r=verificationRecovery(item,changed);assert.equal(r.result,undefined);assert.equal(r.decided,false);assert.equal(r.pending,false);
 }
});

test("sortVerificationQueue prioritizes critical values first, then STAT, then FIFO by entered_at", () => {
  const items = [
    { result_id: 1, has_critical_value: false, priority: "Routine", entered_at: "2026-10-26T10:00:00Z" },
    { result_id: 2, has_critical_value: true, priority: "Routine", entered_at: "2026-10-26T10:05:00Z" },
    { result_id: 3, has_critical_value: false, priority: "STAT", entered_at: "2026-10-26T10:02:00Z" },
    { result_id: 4, has_critical_value: false, priority: "Urgent", entered_at: "2026-10-26T09:50:00Z" },
    { result_id: 5, has_critical_value: true, priority: "STAT", entered_at: "2026-10-26T10:01:00Z" },
  ];

  const sorted = sortVerificationQueue(items);
  // Item 5: Critical + STAT
  // Item 2: Critical + Routine
  // Item 3: Non-critical + STAT
  // Item 4: Non-critical + Urgent
  // Item 1: Non-critical + Routine
  assert.deepEqual(
    sorted.map((x) => x.result_id),
    [5, 2, 3, 4, 1]
  );
});

test("canVerifyResult enforces separation of duties (LAB_VERIFIER_MUST_DIFFER)", () => {
  const verifier = { id: 22, name: "Dr. Pathologist Amna", username: "demo.labverifier" };
  const technician = { id: 21, name: "Lab Tech Zain", username: "demo.labtech" };

  // Different user allowed
  const diffCheck = canVerifyResult(verifier, { entered_by:21, entered_by_name: "Lab Tech Zain" });
  assert.equal(diffCheck.allowed, true);

  // Same user disallowed
  const sameCheck = canVerifyResult(technician, { entered_by:21, entered_by_name: "Lab Tech Zain" });
  assert.equal(sameCheck.allowed, false);
  assert.match(sameCheck.reason, /LAB_VERIFIER_MUST_DIFFER/);

  // Duplicate/changed display names never establish identity.
  assert.equal(canVerifyResult(technician, {entered_by:22, entered_by_name:"Lab Tech Zain"}).allowed,true);
  assert.equal(canVerifyResult(technician, {entered_by_name:" lab tech zain "}).allowed,true);
});

test("validateVerification enforces mandatory note on rejection and bounds", () => {
  // Rejection without note is refused
  const emptyReject = validateVerification("Rejected", "   ", false, "");
  assert.equal(emptyReject.valid, false);
  assert.match(emptyReject.error, /Rejection requires an explanatory note/);

  // Rejection with note succeeds
  const goodReject = validateVerification("Rejected", "Sample haemolysed, please re-draw", false, "");
  assert.equal(goodReject.valid, true);
  assert.equal(goodReject.body.decision, "Rejected");
  assert.equal(goodReject.body.note, "Sample haemolysed, please re-draw");

  // Verified without delay reason when on time
  const normalVerify = validateVerification("Verified", "", false, "");
  assert.equal(normalVerify.valid, true);
  assert.equal(normalVerify.body.decision, "Verified");
  assert.equal(normalVerify.body.delay_reason, null);

  // Verified with delay reason when late
  const lateVerify = validateVerification("Verified", "", true, "Reagent calibration required");
  assert.equal(lateVerify.valid, true);
  assert.equal(lateVerify.body.delay_reason, "Reagent calibration required");

  // Exceeding note bounds (> 1000 chars)
  const longNote = "x".repeat(1001);
  const rejectLong = validateVerification("Rejected", longNote, false, "");
  assert.equal(rejectLong.valid, false);

  // Exceeding delay bounds (> 500 chars)
  const longDelay = "y".repeat(501);
  const verifyLong = validateVerification("Verified", "", true, longDelay);
  assert.equal(verifyLong.valid, false);
});

test("verificationWritable governs permissions and service lifecycle views", () => {
  // Missing permissions
  const noPerm = verificationWritable({ mode: "full" }, ["patient.view"]);
  assert.equal(noPerm.readable, false);
  assert.equal(noPerm.writable, false);

  // Read-only with lab.result.view
  const viewOnly = verificationWritable({ mode: "full" }, ["lab.result.view"]);
  assert.equal(viewOnly.readable, false);
  assert.equal(viewOnly.writable, false);

  // Full verifier
  const full = verificationWritable({ mode: "full" }, ["lab.result.verify"]);
  assert.equal(full.readable, true);
  assert.equal(full.writable, true);

  // Open work (retiring)
  const openWork = verificationWritable({ mode: "open_work" }, ["lab.result.verify"]);
  assert.equal(openWork.readable, true);
  assert.equal(openWork.writable, true);
  assert.match(openWork.banner, /Retiring service/);

  // Records only
  const records = verificationWritable({ mode: "records" }, ["lab.result.verify"]);
  assert.equal(records.readable, false);
  assert.equal(records.writable, false);
  assert.match(records.banner, /Records only/);

  // Hidden
  const hidden = verificationWritable({ mode: "hidden" }, ["lab.result.verify"]);
  assert.equal(hidden.readable, false);
  assert.equal(hidden.writable, false);
  assert.equal(verificationWritable(undefined,["lab.result.verify"]).writable,false);
  assert.equal(verificationWritable({mode:"unexpected"},["lab.result.verify"]).readable,false);
});

test("verification review binds exact patient/result/measurements and refuses concurrent changed context",()=>{
 const a={result_id:1,lab_requisition_item_id:9,mrn:"DEMO-1",patient_name:"Synthetic",code:"RBS",test_name:"RBS",metrics_jsonb:{glucose:100},flags_jsonb:{glucose:"N"},has_critical_value:false,interpretation:null,entered_at:"2026-10-26T10:00:00Z",entered_by_name:"Staff",is_correction:false,priority:"Routine"};
 assert.equal(verificationSnapshot(a),verificationSnapshot(structuredClone(a)));
 for(const change of [{requisition_id:90},{requisition_number:"LR-OTHER"},{patient_id:91},{barcode:"OTHER"},{entered_by:92},{due_at:"2026-11-01T00:00:00Z"},{is_overdue:true},{result_id:2},{mrn:"DEMO-2"},{metrics_jsonb:{glucose:900}},{flags_jsonb:{glucose:"CH"}},{is_correction:true}])assert.notEqual(verificationSnapshot(a),verificationSnapshot({...a,...change}));
});
