import test from "node:test";
import assert from "node:assert/strict";
import {
  getHolidayCalendarAdminCapabilityView,
  validateBatchHolidays,
  validateHolidayPatch,
  isPastOrTodayHoliday,
  groupHolidaysByMonth,
  MONTH_NAMES_BILINGUAL,
  HOLIDAY_ADMIN_ERROR_MESSAGES
} from "../src/holiday-calendar-admin-policy.ts";

test("holiday calendar admin capability view assigns full, records, and hidden modes", () => {
  // Full executive/admin management permissions
  const full = getHolidayCalendarAdminCapabilityView(
    { views: { screens: ["holiday_calendar_admin"] } },
    ["hr.holiday.manage"],
    "hospital_admin"
  );
  assert.equal(full.mode, "full");
  assert.equal(full.canView, true);
  assert.equal(full.canManage, true);

  // Executive role (e.g. owner, clinic_director) automatically has manage capability
  const execFull = getHolidayCalendarAdminCapabilityView(
    { views: { screens: ["holiday_calendar_admin"] } },
    [],
    "owner"
  );
  assert.equal(execFull.mode, "full");
  assert.equal(execFull.canManage, true);

  // View-only records mode for regular staff without hr.holiday.manage
  const records = getHolidayCalendarAdminCapabilityView(
    { views: { screens: ["holiday_calendar_admin"] } },
    ["opd.ticket.create"],
    "receptionist"
  );
  assert.equal(records.mode, "records");
  assert.equal(records.canView, true);
  assert.equal(records.canManage, false);

  // Hidden when establishment explicitly excludes screen
  const hidden = getHolidayCalendarAdminCapabilityView(
    { views: { screens: ["other_screen"] } },
    ["hr.holiday.manage"],
    "hospital_admin"
  );
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canView, false);
});

test("rule:748c506511 - validateBatchHolidays validates all-or-nothing batch entries and detects duplicate dates", () => {
  // Empty batch fails
  const resEmpty = validateBatchHolidays([]);
  assert.equal(resEmpty.valid, false);
  assert.ok(resEmpty.generalError);

  // Missing date & short name
  const resInvalid = validateBatchHolidays([
    { holiday_date: "", name: "A", notes: "" }
  ]);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.rowErrors[0].holiday_date);
  assert.ok(resInvalid.rowErrors[0].name);

  // Duplicate dates within the batch itself fail
  const resDup = validateBatchHolidays([
    { holiday_date: "2026-03-23", name: "Pakistan Day", notes: "" },
    { holiday_date: "2026-03-23", name: "Republic Day", notes: "" }
  ]);
  assert.equal(resDup.valid, false);
  assert.ok(resDup.rowErrors[1].holiday_date);

  // Valid batch with multiple unique holidays
  const resValid = validateBatchHolidays([
    { holiday_date: "2026-03-23", name: "Pakistan Day", notes: "National Holiday" },
    { holiday_date: "2026-05-01", name: "Labour Day", notes: "Workers' Day" },
    { holiday_date: "2026-08-14", name: "Independence Day", notes: "National Holiday" },
    { holiday_date: "2026-12-25", name: "Quaid-e-Azam Day", notes: "National Holiday" }
  ]);
  assert.equal(resValid.valid, true);
  assert.equal(Object.keys(resValid.rowErrors).length, 0);
});

test("rule:6b35ae8101 - validateHolidayPatch mandates expected_version for concurrency and validates changes", () => {
  // Missing expected_version fails
  const resNoVersion = validateHolidayPatch({
    name: "Updated Holiday"
  });
  assert.equal(resNoVersion.valid, false);
  assert.ok(resNoVersion.errors.expected_version);

  // Invalid date format fails
  const resBadDate = validateHolidayPatch({
    expected_version: 1,
    holiday_date: "23-03-2026"
  });
  assert.equal(resBadDate.valid, false);
  assert.ok(resBadDate.errors.holiday_date);

  // Name too short fails
  const resShortName = validateHolidayPatch({
    expected_version: 1,
    name: "X"
  });
  assert.equal(resShortName.valid, false);
  assert.ok(resShortName.errors.name);

  // Valid withdrawal patch (is_active: false)
  const resWithdraw = validateHolidayPatch({
    expected_version: 2,
    is_active: false
  });
  assert.equal(resWithdraw.valid, true);
  assert.equal(Object.keys(resWithdraw.errors).length, 0);

  // Valid date reschedule patch
  const resReschedule = validateHolidayPatch({
    expected_version: 3,
    holiday_date: "2026-03-24",
    name: "Pakistan Day (Observed)",
    notes: "Shifted due to Sunday"
  });
  assert.equal(resReschedule.valid, true);
});

test("rule:6b35ae8101 - isPastOrTodayHoliday distinguishes past dates triggering attendance recalculation", () => {
  const today = new Date().toISOString().split("T")[0];
  assert.equal(isPastOrTodayHoliday(today), true);

  // Past date
  assert.equal(isPastOrTodayHoliday("2020-01-01"), true);

  // Far future date
  assert.equal(isPastOrTodayHoliday("2099-12-31"), false);
});

test("groupHolidaysByMonth organizes holidays into 12 bilingual month groupings", () => {
  const sampleHolidays = [
    { holiday_id: 1, holiday_date: "2026-03-23", name: "Pakistan Day", is_active: true, row_version: 1 },
    { holiday_id: 2, holiday_date: "2026-05-01", name: "Labour Day", is_active: true, row_version: 1 },
    { holiday_id: 3, holiday_date: "2026-08-14", name: "Independence Day", is_active: false, row_version: 2 },
    { holiday_id: 4, holiday_date: "2026-12-25", name: "Quaid-e-Azam Day", is_active: true, row_version: 1 }
  ];

  const groups = groupHolidaysByMonth(sampleHolidays);
  assert.equal(groups.length, 12);
  assert.equal(groups[0].monthNameEn, "January");
  assert.equal(groups[0].holidays.length, 0);

  // March (index 2) should have 1 holiday
  assert.equal(groups[2].monthNameEn, "March");
  assert.equal(groups[2].monthNameUr, "مارچ");
  assert.equal(groups[2].holidays.length, 1);
  assert.equal(groups[2].holidays[0].name, "Pakistan Day");

  // May (index 4) should have 1 holiday
  assert.equal(groups[4].monthNameEn, "May");
  assert.equal(groups[4].holidays.length, 1);
  assert.equal(groups[4].holidays[0].name, "Labour Day");

  // August (index 7) should have 1 inactive holiday
  assert.equal(groups[7].monthNameEn, "August");
  assert.equal(groups[7].holidays.length, 1);
  assert.equal(groups[7].holidays[0].name, "Independence Day");

  // December (index 11) should have 1 holiday
  assert.equal(groups[11].monthNameEn, "December");
  assert.equal(groups[11].holidays.length, 1);
  assert.equal(groups[11].holidays[0].name, "Quaid-e-Azam Day");
});

test("MONTH_NAMES_BILINGUAL contains all 12 English and Urdu month names", () => {
  assert.equal(MONTH_NAMES_BILINGUAL.length, 12);
  assert.equal(MONTH_NAMES_BILINGUAL[0].en, "January");
  assert.equal(MONTH_NAMES_BILINGUAL[0].ur, "جنوری");
  assert.equal(MONTH_NAMES_BILINGUAL[11].en, "December");
  assert.equal(MONTH_NAMES_BILINGUAL[11].ur, "دسمبر");
});

test("HOLIDAY_ADMIN_ERROR_MESSAGES provides bilingual error mappings for all contract codes", () => {
  const codes = [
    "HOLIDAY_DATE_TAKEN",
    "VERSION_CONFLICT",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "NOT_FOUND",
    "NETWORK_ERROR"
  ];
  for (const code of codes) {
    const entry = HOLIDAY_ADMIN_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing error dictionary for ${code}`);
    assert.ok(entry.en.length > 5, `Missing English description for ${code}`);
    assert.ok(entry.ur.length > 5, `Missing Urdu description for ${code}`);
  }
});
