import test from "node:test";
import assert from "node:assert/strict";
import {
  getHolidayCalendarCapabilityView,
  validateBatchHolidays,
  validateHolidayPatch,
  isPastOrTodayHoliday,
  groupHolidaysByMonth,
  MONTH_NAMES_BILINGUAL,
  HOLIDAY_ERROR_MESSAGES
} from "../src/holiday-calendar-policy.ts";

test("holiday calendar capability view assigns full, records, and hidden modes", () => {
  // Full management permissions
  const full = getHolidayCalendarCapabilityView(
    { views: { screens: ["holiday_calendar"] } },
    ["hr.holiday.manage"]
  );
  assert.equal(full.mode, "full");
  assert.equal(full.canView, true);
  assert.equal(full.canManage, true);

  // View-only records mode for regular staff
  const records = getHolidayCalendarCapabilityView(
    { views: { screens: ["holiday_calendar"] } },
    ["opd.ticket.create"]
  );
  assert.equal(records.mode, "records");
  assert.equal(records.canView, true);
  assert.equal(records.canManage, false);

  // Hidden when establishment explicitly excludes screen
  const hidden = getHolidayCalendarCapabilityView(
    { views: { screens: ["other_screen"] } },
    ["hr.holiday.manage"]
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

  // Valid rename and move patch
  const resValid = validateHolidayPatch({
    expected_version: 3,
    holiday_date: "2026-04-10",
    name: "Eid ul-Fitr Day 1",
    notes: "Subject to moon sighting"
  });
  assert.equal(resValid.valid, true);
});

test("rule:6b35ae8101 - isPastOrTodayHoliday detects today and past holidays requiring attendance recalculation", () => {
  const today = "2026-11-03";
  assert.equal(isPastOrTodayHoliday("2026-11-03", today), true);
  assert.equal(isPastOrTodayHoliday("2026-08-14", today), true);
  assert.equal(isPastOrTodayHoliday("2026-12-25", today), false);
  assert.equal(isPastOrTodayHoliday("2027-01-01", today), false);
});

test("groupHolidaysByMonth organizes holidays into 12 bilingual month buckets in ascending order", () => {
  const sampleHolidays = [
    { holiday_id: 1, holiday_date: "2026-08-14", name: "Independence Day", notes: null, is_active: true, created_by: 1, created_at: "", row_version: 1 },
    { holiday_id: 2, holiday_date: "2026-03-23", name: "Pakistan Day", notes: null, is_active: true, created_by: 1, created_at: "", row_version: 1 },
    { holiday_id: 3, holiday_date: "2026-05-01", name: "Labour Day", notes: null, is_active: true, created_by: 1, created_at: "", row_version: 1 },
    { holiday_id: 4, holiday_date: "2026-12-25", name: "Quaid Day", notes: null, is_active: true, created_by: 1, created_at: "", row_version: 1 },
  ];

  const groups = groupHolidaysByMonth(sampleHolidays);
  assert.equal(groups.length, 12);
  assert.equal(groups[0].monthNameEn, "January");
  assert.equal(groups[0].holidays.length, 0);

  // March (index 2)
  assert.equal(groups[2].monthNameEn, "March");
  assert.equal(groups[2].monthNameUr, "مارچ");
  assert.equal(groups[2].holidays.length, 1);
  assert.equal(groups[2].holidays[0].name, "Pakistan Day");

  // August (index 7)
  assert.equal(groups[7].monthNameEn, "August");
  assert.equal(groups[7].holidays.length, 1);
  assert.equal(groups[7].holidays[0].name, "Independence Day");
});

test("MONTH_NAMES_BILINGUAL provides full bilingual names for all 12 calendar months", () => {
  assert.equal(MONTH_NAMES_BILINGUAL.length, 12);
  assert.equal(MONTH_NAMES_BILINGUAL[0].en, "January");
  assert.equal(MONTH_NAMES_BILINGUAL[0].ur, "جنوری");
  assert.equal(MONTH_NAMES_BILINGUAL[11].en, "December");
  assert.equal(MONTH_NAMES_BILINGUAL[11].ur, "دسمبر");
});

test("HOLIDAY_ERROR_MESSAGES contains complete English and Urdu guidance for all statutory codes", () => {
  const codes = [
    "HOLIDAY_DATE_TAKEN",
    "VERSION_CONFLICT",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "NOT_FOUND",
    "NETWORK_ERROR"
  ];
  for (const c of codes) {
    const entry = HOLIDAY_ERROR_MESSAGES[c];
    assert.ok(entry, `Missing error translation for ${c}`);
    assert.ok(entry.en && entry.en.length > 0);
    assert.ok(entry.ur && entry.ur.length > 0);
  }
});
