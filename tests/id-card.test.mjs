import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getIdCardCapabilityView,
  getCardPrinterStatus,
  validateEmployeeIdInput,
  formatCardSize,
  ID_CARD_ERROR_MESSAGES,
} from "../src/id-card-policy.ts";

test("IdCard capability view evaluates facility profiles and mode gates", () => {
  const full = getIdCardCapabilityView({});
  assert.equal(full.mode, "full");
  assert.equal(full.canViewIdCard, true);
  assert.equal(full.canPrintIdCard, true);

  const records = getIdCardCapabilityView({
    views: { records_only: true, screens: ["id_card"] },
  });
  assert.equal(records.mode, "records");
  assert.equal(records.canViewIdCard, true);
  assert.equal(records.canPrintIdCard, false);
  assert(records.noticeEn?.includes("Records Mode"));

  const openWork = getIdCardCapabilityView({
    views: { open_work_only: true, screens: ["id_card"] },
  });
  assert.equal(openWork.mode, "open_work");
  assert.equal(openWork.canViewIdCard, true);
  assert.equal(openWork.canPrintIdCard, true);

  const setup = getIdCardCapabilityView({
    views: { setup_only: true, screens: ["id_card"] },
  });
  assert.equal(setup.mode, "setup");
  assert.equal(setup.canViewIdCard, true);
  assert.equal(setup.canPrintIdCard, false);
  assert(setup.noticeEn?.includes("Setup Mode"));

  const hidden = getIdCardCapabilityView({
    views: { screens: ["other_screen"] },
  });
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canViewIdCard, false);
  assert.equal(hidden.canPrintIdCard, false);
  assert(hidden.noticeEn?.includes("hidden"));
});

test("Card printer detection distinguishes mapped hardware from fallback and unregistered terminals", () => {
  // Mapped card printer
  const mapped = getCardPrinterStatus({
    registered: true,
    location_label: "HR Desk Station 1",
    card_printer: "Zebra ZXP Series 7",
    card_printer_address: "192.168.10.88:9100",
  });
  assert.equal(mapped.isRegistered, true);
  assert.equal(mapped.hasCardPrinter, true);
  assert.equal(mapped.printerName, "Zebra ZXP Series 7");
  assert.equal(mapped.printerAddress, "192.168.10.88:9100");
  assert.equal(mapped.statusBadgeClass, "bg-success");
  assert(mapped.statusTextEn.includes("Card printer configured"));

  // Registered terminal without mapped card printer (system default fallback)
  const fallback = getCardPrinterStatus({
    registered: true,
    location_label: "Admin Room PC",
    card_printer: null,
    card_printer_address: null,
  });
  assert.equal(fallback.isRegistered, true);
  assert.equal(fallback.hasCardPrinter, false);
  assert.equal(fallback.printerName, "System Default / Fallback");
  assert.equal(fallback.statusBadgeClass, "bg-warning text-dark");
  assert(fallback.statusTextEn.includes("No dedicated card printer mapped"));

  // Unregistered terminal
  const unregistered = getCardPrinterStatus({
    registered: false,
    card_printer: null,
  });
  assert.equal(unregistered.isRegistered, false);
  assert.equal(unregistered.hasCardPrinter, false);
  assert(unregistered.statusTextEn.includes("not registered in IT Console"));

  // Undefined/null identity
  const empty = getCardPrinterStatus(null);
  assert.equal(empty.isRegistered, false);
  assert.equal(empty.hasCardPrinter, false);
  assert.equal(empty.printerName, "Unknown");
});

test("Staff employee ID input validation strictly checks positive integers", () => {
  // Valid positive integers
  assert.equal(validateEmployeeIdInput(4).valid, true);
  assert.equal(validateEmployeeIdInput("42").valid, true);
  assert.equal(validateEmployeeIdInput("42").employeeId, 42);

  // Missing or empty inputs
  assert.equal(validateEmployeeIdInput("").valid, false);
  assert.equal(validateEmployeeIdInput("   ").valid, false);
  assert.equal(validateEmployeeIdInput(undefined).valid, false);
  assert.equal(validateEmployeeIdInput(null).valid, false);

  // Invalid numbers
  assert.equal(validateEmployeeIdInput(0).valid, false);
  assert.equal(validateEmployeeIdInput(-5).valid, false);
  assert.equal(validateEmployeeIdInput(3.14).valid, false);
  assert.equal(validateEmployeeIdInput("abc").valid, false);
});

test("CR80 card size formatter outputs standard dimensions", () => {
  assert.equal(formatCardSize([85.6, 54.0]), "85.6mm × 54.0mm (CR80 Standard)");
  assert.equal(formatCardSize(null), "85.6mm × 54.0mm (CR80 Standard)");
  assert.equal(formatCardSize([]), "85.6mm × 54.0mm (CR80 Standard)");
});

test("Error dictionary provides complete bilingual English and Urdu messages", () => {
  const codes = [
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "NOT_FOUND",
    "PRINTER_OFFLINE",
    "PRINT_FAILED",
    "NETWORK_ERROR",
  ];

  for (const code of codes) {
    const entry = ID_CARD_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing error entry for ${code}`);
    assert.ok(entry.en && entry.en.length > 5, `English message too short for ${code}`);
    assert.ok(entry.ur && entry.ur.length > 5, `Urdu message too short for ${code}`);
  }
});

test("Contracts and generated TypeScript definitions are present and valid", () => {
  assert.ok(fs.existsSync("contracts/id_card.json"), "contracts/id_card.json must exist");
  assert.ok(fs.existsSync("src/generated/id_card.ts"), "src/generated/id_card.ts must exist");
  assert.ok(fs.existsSync("public/handbook/id_card-en.png"), "public/handbook/id_card-en.png must exist");
  assert.ok(fs.existsSync("public/handbook/id_card-ur.png"), "public/handbook/id_card-ur.png must exist");

  const contract = JSON.parse(fs.readFileSync("contracts/id_card.json", "utf8"));
  assert.equal(contract.screen_id, "id_card");
  assert.equal(contract.endpoints.length, 2);
  assert.equal(contract.definition_of_done.items.length, 12);
});
