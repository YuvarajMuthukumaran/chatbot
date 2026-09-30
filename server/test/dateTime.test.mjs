import { test } from "node:test";
import assert from "node:assert";
import { parseDate, parseTime, isDateWord } from "../lib/dateParse.js";
import { clinicToday, clinicMinutesNow, addDays, formatDate, formatTime, formatDateTime } from "../lib/clinicTime.js";
import { availableSlots, checkBookableDate, BOOKING_WINDOW_DAYS } from "../lib/slots.js";

// Wednesday 30 Sep 2026, 10:00 IST (04:30 UTC).
const now = new Date("2026-09-30T04:30:00Z");

test("clinic time is IST, not the server's timezone", () => {
  // 20:00 UTC on the 30th is already 1:30am on the 1st in India.
  assert.equal(clinicToday(new Date("2026-09-30T20:00:00Z")), "2026-10-01");
  assert.equal(clinicToday(now), "2026-09-30");
  assert.equal(clinicMinutesNow(now), 10 * 60);
});

test("calendar arithmetic crosses month and year ends", () => {
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("parseDate — relative days, including regional words", () => {
  const cases = {
    today: "2026-09-30",
    "tomorrow please": "2026-10-01",
    tmrw: "2026-10-01",
    "day after tomorrow": "2026-10-02",
    kal: "2026-10-01",
    repu: "2026-10-01",
    naalai: "2026-10-01",
    aaj: "2026-09-30",
  };
  for (const [input, want] of Object.entries(cases)) assert.equal(parseDate(input, { now }), want, input);
});

test("parseDate — written and numeric dates (day first, as in India)", () => {
  const cases = {
    "2026-10-05": "2026-10-05",
    "5 oct": "2026-10-05",
    "5th of October": "2026-10-05",
    "oct 5": "2026-10-05",
    "October 5th, 2027": "2027-10-05",
    "05/10/2026": "2026-10-05",
    "5-10-26": "2026-10-05",
    "5/10": "2026-10-05",
    "5.10.2026": "2026-10-05",
    "1 jan": "2027-01-01", // already passed this year -> next year
    "Thu, 2 Oct": "2026-10-02", // the date quick-reply chips' own format
  };
  for (const [input, want] of Object.entries(cases)) assert.equal(parseDate(input, { now }), want, input);
});

test("parseDate — weekdays and ordinals", () => {
  assert.equal(parseDate("friday", { now }), "2026-10-02");
  assert.equal(parseDate("next friday", { now }), "2026-10-02");
  assert.equal(parseDate("wednesday", { now }), "2026-10-07", "a bare weekday means the next one, not today");
  assert.equal(parseDate("this wednesday", { now }), "2026-09-30");
  assert.equal(parseDate("the 5th", { now }), "2026-10-05");
  assert.equal(parseDate("on 29th", { now }), "2026-10-29");
});

test("parseDate — no false dates", () => {
  for (const input of ["10.30", "9876543210", "whenever works", "2", ""]) assert.equal(parseDate(input, { now }), null, input);
  // Strict mode (scanning a whole request) ignores abbreviations inside ordinary words.
  assert.equal(parseDate("I sat with dr anu last time", { now, strict: true }), null);
  assert.equal(parseDate("book dr anu on sat", { now, strict: true }), "2026-10-03");
});

test("parseTime — the ways people write a time", () => {
  const cases = {
    "10:30": "10:30",
    "10.30": "10:30", // used to be booked as 10:00
    "2:30": "14:30", // clinic hours: an afternoon time without am/pm
    2: "14:00",
    10: "10:00",
    "10am": "10:00",
    "10 AM": "10:00",
    "2 pm": "14:00",
    "2.30 p.m.": "14:30",
    "12:30": "12:30",
    noon: "12:00",
    "4 baje": "16:00",
    1030: "10:30",
    930: "09:30",
    "at 3": "15:00",
    "2:00 PM": "14:00", // the time quick-reply chips' own format
  };
  for (const [input, want] of Object.entries(cases)) assert.equal(parseTime(String(input)), want, input);
  assert.equal(parseTime("the 3rd one"), null);
  assert.equal(parseTime("10 amazing"), null);
});

test("parseTime strict mode ignores ambiguous forms inside a whole request", () => {
  assert.equal(parseTime("book dr anu tomorrow at 11", { strict: true }), "11:00");
  assert.equal(parseTime("book at 10:30am", { strict: true }), "10:30");
  assert.equal(parseTime("book dr anu at 10.30", { strict: true }), null);
  assert.equal(parseTime("book for 2 people", { strict: true }), null);
});

test("isDateWord", () => {
  for (const word of ["october", "Friday", "tomorrow", "5th", "kal"]) assert.equal(isDateWord(word), true, word);
  for (const word of ["anu", "pooja", "sharma"]) assert.equal(isDateWord(word), false, word);
});

test("friendly formatting", () => {
  assert.equal(formatDate("2026-10-05", now), "Mon, 5 Oct");
  assert.equal(formatDate("2027-01-04", now), "Mon, 4 Jan 2027");
  assert.equal(formatTime("09:00"), "9:00 AM");
  assert.equal(formatTime("12:30"), "12:30 PM");
  assert.equal(formatTime("14:30:00"), "2:30 PM");
  assert.equal(formatDateTime("2026-09-23 10:30:00", now), "Wed, 23 Sep, 10:30 AM");
  assert.equal(formatDateTime("not a date", now), "not a date");
});

test("same-day slots that have passed (or start within 30 min) aren't offered", () => {
  const slots = availableSlots([], { date: "2026-09-30", now }); // 10:00 now
  assert.equal(slots[0], "10:30");
  assert.ok(!slots.includes("10:00"));
  assert.equal(availableSlots([], { date: "2026-10-01", now })[0], "09:00");
  assert.ok(!availableSlots(["09:00"], { date: "2026-10-01", now }).includes("09:00"));
});

test("checkBookableDate", () => {
  assert.equal(checkBookableDate("2026-09-30", now), "ok");
  assert.equal(checkBookableDate("2026-09-29", now), "past");
  assert.equal(checkBookableDate(addDays("2026-09-30", BOOKING_WINDOW_DAYS + 1), now), "too_far");
  assert.equal(checkBookableDate("2026-02-30", now), "invalid");
  assert.equal(checkBookableDate({ $ne: 1 }, now), "invalid");
});
