import { test } from "node:test";
import assert from "node:assert";
import { localIsoDate, addDaysIso, cleanPhoneInput, tenDigitPhone, formatSlot, formatDay } from "../src/lib/format.js";
import { specialtyLabel } from "../src/lib/specialties.js";

test("localIsoDate uses the local calendar date, not UTC", () => {
  // 1am local on 1 Oct: toISOString() would give 30 Sep in any timezone ahead of UTC (like IST).
  assert.equal(localIsoDate(new Date(2026, 9, 1, 1, 0)), "2026-10-01");
});

test("addDaysIso crosses month and year ends", () => {
  assert.equal(addDaysIso("2026-09-30", 1), "2026-10-01");
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
});

test("phone fields accept a country code whether it's pasted or typed key by key", () => {
  // Typed one key at a time, each intermediate value passes through cleanPhoneInput.
  let typed = "";
  for (const key of "+91 98765 43210") typed = cleanPhoneInput(typed + key);
  assert.equal(tenDigitPhone(typed), "9876543210");

  assert.equal(tenDigitPhone(cleanPhoneInput("+91 98765 43210")), "9876543210");
  assert.equal(tenDigitPhone(cleanPhoneInput("098765-43210")), "9876543210");
  assert.equal(tenDigitPhone(cleanPhoneInput("98765")), null); // still typing
  assert.equal(tenDigitPhone("98765432101"), null); // 11 digits not starting with 0
});

test("formatSlot", () => {
  assert.equal(formatSlot("09:00"), "9:00 AM");
  assert.equal(formatSlot("12:30"), "12:30 PM");
  assert.equal(formatSlot("14:00"), "2:00 PM");
});

test("formatDay shows the year only when it isn't this year", () => {
  const now = new Date(2026, 8, 30);
  assert.match(formatDay("2026-10-05", now), /5 Oct/);
  assert.doesNotMatch(formatDay("2026-10-05", now), /2026/);
  assert.match(formatDay("2027-01-04", now), /2027/);
});

test("specialty labels", () => {
  assert.equal(specialtyLabel("geriatric_dementia"), "Dementia & elderly care");
  assert.equal(specialtyLabel("ocd"), "OCD");
  assert.equal(specialtyLabel("some_new_tag"), "some new tag");
});
