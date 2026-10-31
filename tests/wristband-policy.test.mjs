import test from 'node:test';import assert from 'node:assert/strict';
import {bandAccess,bandBody,bandScanCode,bandHistoryKey} from '../src/wristband-policy.ts';
const s={kind:'admission',id:101,patient_id:201,name:'POLICY ONLY',mrn:'POLICY-ONLY',number:'POLICY-ONLY',status:'Admitted'};
test('a band is for exactly the selected actual stay, with explicit patient check',()=>{
 assert.deepEqual(bandBody(s,[],'',true),{admission_id:101});assert.throws(()=>bandBody(s,[],'',false),/Confirm/);assert.throws(()=>bandBody({...s,id:0},[],'',true),/actual patient stay/);assert.deepEqual(bandBody({...s,kind:'er'},[],'',true),{er_visit_id:101});
});
test('current band across another stay requires a replacement reason; no typed request patient/user IDs',()=>{
 const current={patient_id:s.patient_id,is_current:true,wristband_id:301,admission_id:999,row_version:1};
 assert.throws(()=>bandBody(s,[current],' ',true),/current band/);assert.deepEqual(bandBody(s,[current],' damaged ',true),{admission_id:101,replacement_reason:'damaged'});assert.throws(()=>bandBody(s,[{...current,patient_id:999}],'damaged',true),/another patient/);assert.throws(()=>bandBody(s,[current],'x'.repeat(301),true),/300/);assert.notEqual(bandHistoryKey([current]),bandHistoryKey([{...current,row_version:2,is_current:false}]));
});
test('records view can reprint but cannot issue, hidden/setup have no work; only permissions decide',()=>{
 const p=['patient.view','patient.wristband.print','medication.safety.view'];assert.equal(bandAccess('full',p).issue,true);assert.equal(bandAccess('open_work',p).issue,true);assert.equal(bandAccess('records',p).print,true);assert.equal(bandAccess('records',p).issue,false);for(const v of ['hidden','setup',undefined])assert.equal(bandAccess(v,p).read,false);assert.equal(bandAccess('full',['patient.view']).issue,false);assert.equal(bandAccess('full',['patient.view']).worklist,false);
});
test('scanner input accepts patient code only within declared bounds; no global keystroke interception',()=>{
 assert.equal(bandScanCode(' HMS:PT:policy-only '),'HMS:PT:policy-only');assert.throws(()=>bandScanCode('x'),/3–80/);assert.throws(()=>bandScanCode('x'.repeat(81)),/3–80/);
});
test('admissions wristband permission opens its missing-band worklist without medication safety access',()=>{
 assert.equal(bandAccess('full',['patient.view','patient.wristband.print']).worklist,true);
 assert.equal(bandAccess('hidden',['patient.wristband.print']).worklist,false);
});
test('ward nurse role access and view policy for wristbands_ward', () => {
  const wardNursePerms = ['patient.view', 'patient.wristband.print'];
  assert.equal(bandAccess('full', wardNursePerms).issue, true);
  assert.equal(bandAccess('full', wardNursePerms).print, true);
  assert.equal(bandAccess('full', wardNursePerms).worklist, true);
  assert.equal(bandAccess('open_work', wardNursePerms).issue, true);
  assert.equal(bandAccess('records', wardNursePerms).issue, false);
  assert.equal(bandAccess('records', wardNursePerms).print, true);
  assert.equal(bandAccess('hidden', wardNursePerms).read, false);
});

test('triage nurse role access, ER stay formatting and view policy for wristbands_er', () => {
  const triageNursePerms = ['patient.view', 'patient.wristband.print', 'er.visit.view'];
  assert.equal(bandAccess('full', triageNursePerms).issue, true);
  assert.equal(bandAccess('full', triageNursePerms).print, true);
  assert.equal(bandAccess('full', triageNursePerms).worklist, true);
  assert.equal(bandAccess('open_work', triageNursePerms).issue, true);
  assert.equal(bandAccess('records', triageNursePerms).issue, false);
  assert.equal(bandAccess('records', triageNursePerms).print, true);
  assert.equal(bandAccess('hidden', triageNursePerms).read, false);

  const erStay = {
    kind: 'er',
    id: 505,
    patient_id: 202,
    name: 'ER Trauma Patient',
    mrn: 'MRN-ER-505',
    number: 'ER-2026-001',
    status: 'TriageLevel1',
  };
  assert.deepEqual(bandBody(erStay, [], '', true), { er_visit_id: 505 });
  const existingBand = {
    patient_id: erStay.patient_id,
    is_current: true,
    wristband_id: 888,
    er_visit_id: 505,
    row_version: 1,
  };
  assert.throws(() => bandBody(erStay, [existingBand], '', true), /current band/);
  assert.deepEqual(
    bandBody(erStay, [existingBand], 'band removed for trauma resuscitation', true),
    { er_visit_id: 505, replacement_reason: 'band removed for trauma resuscitation' }
  );
});
