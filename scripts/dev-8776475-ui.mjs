import assert from "node:assert/strict";
import fs from "node:fs";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";

const dir = "docs/backend-8776475-2026-11-09";
const read = name => JSON.parse(fs.readFileSync(`${dir}/${name}.json`, "utf8"));
const save = (name, value) => fs.writeFileSync(`${dir}/${name}.json`, JSON.stringify(value, null, 2) + "\n");
const incident = read("62-incident-result").data;
const bloodUnit = read("63-unit-result").data;
const donation = read("64-period").selected;
const open = (s, screen) => s.p.getByRole("navigation").locator(`[data-screen-target="${screen}"]`).click();
const root = (s, screen) => s.p.locator(`[data-screen="${screen}"]`);
const requests = async (s, pattern) => (await s.trace()).requests.filter(r => pattern.test(r.path)).map(r => ({
  method:r.method, path:r.path, status:r.status, request_id:r.result?.request_id, ...(r.method === "GET" ? {} : {key:r.key, body:r.body}),
}));

if (process.argv[2] !== "ward") {
  const s = await session("877-quality", "demo.quality");
  try {
    await open(s, "adr_report");
    const adr = root(s, "adr_report");
    await adr.locator('input[name="date_from"]').fill("2026-11-09");
    await adr.locator('input[name="date_to"]').fill("2026-11-09");
    await adr.locator('input[name="open_only"]').check();
    await adr.getByRole("button", { name: "Apply ADR filters" }).click();
    const chooser = adr.getByLabel("ADR incident");
    await chooser.selectOption(String(incident.incident_id));
    await expect(adr).toContainText("Pre-filled draft");
    await help(s, chooser, "Adverse drug reaction report");
    await adr.getByRole("button", { name: "Edit report details" }).click();
    await adr.locator('select[data-help="adr.batch"]').first().selectOption("stock");
    await expect.poll(async () => (await requests(s, /\/drugs\/\d+\/stock-status/)).some(r => r.status === 200)).toBe(true);
    await adr.getByRole("button", { name: /cancel.*draft|cancel unsent/i }).click();
    await open(s, "incident_register");
    const register = root(s, "incident_register");
    await register.getByRole("row").filter({hasText:incident.incident_number}).getByRole("button",{name:"Open incident"}).click();
    await register.getByRole("button",{name:"ADR report",exact:true}).click();
    await expect(adr).toContainText("Pre-filled draft");
    await expect(chooser).toHaveValue(String(incident.incident_id));
    await capture(s,"adr_report",()=>expect(adr).toBeVisible());
    const adrRequests = await requests(s, /\/incidents|\/drugs\/\d+\/stock-status/);
    assert(adrRequests.some(r => r.status === 200 && r.path.includes("open_only=true") && r.path.includes("type_code=ADVERSE_DRUG_REACTION")));
    save("62-native",{passed:true,renderer:s.j.renderer,requests:adrRequests});

    await open(s, "blood_registers");
    const bank = root(s,"blood_registers");
    const status = bank.getByLabel("Unit status");
    await expect(status).toHaveValue("");
    await bank.getByRole("button",{name:"Read blood units"}).click();
    await expect.poll(async()=> (await requests(s,/\/blood\/units/)).some(r=>r.status===200 && !r.path.includes("status="))).toBe(true);
    await status.selectOption("Discarded");
    await bank.getByRole("button",{name:bloodUnit.unit_number,exact:true}).click();
    await expect(bank.getByRole("heading",{name:bloodUnit.unit_number,exact:true})).toBeVisible();
    await help(s,status,"Blood transfusion: registers and monitoring");
    await capture(s,"blood_registers",()=>expect(bank).toBeVisible());
    const bankRequests=await requests(s,/\/blood\//);
    assert(bankRequests.some(r=>r.status===200 && r.path.includes("status=Discarded")));
    assert(bankRequests.some(r=>r.status===200 && r.path.endsWith(`/units/${bloodUnit.unit_id}`)));
    save("63-native",{passed:true,renderer:s.j.renderer,requests:bankRequests});

    await open(s, "blood_center_registers");
    const center = root(s,"blood_center_registers");
    await center.locator('input[name="date_from"]').fill("2026-11-09");
    await center.locator('input[name="date_to"]').fill("2026-11-09");
    await center.getByRole("button",{name:"Read period",exact:true}).click();
    const openDonation=center.getByRole("button",{name:donation.donation_number,exact:true});
    const donationRow=center.getByRole("row").filter({has:s.p.getByRole("button",{name:donation.donation_number,exact:true})});
    await expect(donationRow.getByRole("cell")).toHaveCount(5);
    await expect(donationRow).toContainText(donation.donor_number);
    await help(s,openDonation,"Blood center: return and registers");
    await openDonation.click();
    await expect(center.getByRole("heading",{name:donation.donation_number,exact:true})).toBeVisible();
    await expect(center).toContainText("Opening a donation is logged");
    await capture(s,"blood_center_registers",()=>expect(center).toBeVisible());
    const centerRequests=await requests(s,/\/blood-center\//);
    assert(centerRequests.some(r=>r.status===200 && r.path.endsWith(`/donations/${donation.donation_id}`)));
    save("64-native",{passed:true,renderer:s.j.renderer,requests:centerRequests});
    assert(!(await s.trace()).requests.some(r=>r.method!=="GET"));
    s.j.passed=true;
    s.pass("ADR menu and handoff, discarded blood unit, and private donation register.");
  } catch (e) {
    s.j.error=e.stack;
    throw e;
  } finally { await s.close(); }
}

if (process.argv[2] === "ward") {
  const intent="artifacts/877-ward-intent.json";
  assert(!fs.existsSync(intent),"Reconcile the earlier UI indent intent before retrying.");
  const s=await session("877-ward","demo.headnurse");
  try {
    await open(s,"ward_indent");
    const ward=root(s,"ward_indent");
    const options=ward.locator('#wardSelect');
    const chosen=read("indent-detail").result;
    await expect(options).toHaveValue("");
    await expect(options.locator(`option[value="${chosen.ward_id}"]`)).toHaveText(chosen.ward_name);
    await help(s,options,"Ward supply indent & inventory");
    await options.selectOption(String(chosen.ward_id));
    await ward.locator('[data-help="ward_indent.tab_create"]').click();
    await ward.locator('[data-help="ward_indent.search_query"]').fill("Paracetamol");
    await ward.locator('[data-help="ward_indent.search_button"]').click();
    await ward.locator('[data-help="ward_indent.add_drug_button"]').first().click();
    const note=`SYNTHETIC DEV native ward directory test ${Date.now()}`;
    await ward.locator('[data-help="ward_indent.indent_note"]').fill(note);
    fs.writeFileSync(intent,JSON.stringify({note,ward_id:chosen.ward_id,pending:true}));
    await ward.locator('[data-help="ward_indent.submit_indent"]').click();
    await expect(ward.locator('[data-help="ward_indent.tracked_card"]')).toContainText(note);
    const trace=(await s.trace()).requests;
    const created=trace.find(r=>r.method==="POST" && r.path.endsWith("/indents") && r.status===201);
    assert(created?.result?.data?.indent_id);
    const id=created.result.data.indent_id;
    assert(trace.some(r=>r.method==="GET" && r.path.endsWith(`/ward-indents/${id}`) && r.status===200));
    fs.writeFileSync(intent,JSON.stringify({note,ward_id:chosen.ward_id,indent_id:id,pending:false}));
    await capture(s,"ward_indent",()=>expect(ward).toBeVisible());
    save("ward-native",{passed:true,renderer:s.j.renderer,indent_id:id,requests:await requests(s,/\/beds\/matrix|\/ward-indents\/|\/wards\/\d+\//)});
    s.j.passed=true;
    s.pass("Named ward directory, one synthetic indent, and automatic exact-result readback.");
  } catch(e) {
    s.j.error=e.stack;
    throw e;
  } finally { await s.close(); }
}
