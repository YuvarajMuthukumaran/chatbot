import { test } from "node:test";
import assert from "node:assert";
import { parseOpd, scheduleSlots, hasSchedule, weekdayOf, normName } from "../lib/schedules.js";
import { availableSlots, isValidSlotTime } from "../lib/slots.js";
import { DOCTORS } from "../lib/doctors.js";
import { createFakeDb } from "../scripts/fakeDb.js";
import { setDb } from "../lib/db.js";
import { getAvailableSlots } from "../lib/bookingData.js";

delete process.env.OPD_SCHEDULES; // these tests are about the schedules themselves

test("parseOpd: day ranges, lists and mixed forms", () => {
  assert.deepEqual(parseOpd("Mon – Sat (1:00 pm – 5:00 pm)"), { days: [1, 2, 3, 4, 5, 6], start: 13 * 60, end: 17 * 60 });
  assert.deepEqual(parseOpd("Mon to Fri & Sun (5pm – 8 pm)").days.sort(), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(parseOpd("Tue, Wed & Fri (10:00 am – 2:00 pm)").days, [2, 3, 5]);
  assert.deepEqual(parseOpd("Mon, Thu & Sat (10:00 am – 2:00 pm)").days, [1, 4, 6]);
  assert.deepEqual(parseOpd("Tue – Sat (10 am – 4 pm)").days, [2, 3, 4, 5, 6]);
  assert.deepEqual(parseOpd("Wed (12:00 pm – 4 pm)"), { days: [3], start: 12 * 60, end: 16 * 60 });
});

test("parseOpd: odd times", () => {
  assert.equal(parseOpd("Wed & Sat (5:00 pm Onwards)").end, 20 * 60); // no stated end: three hours
  assert.equal(parseOpd("Mon to Sat (10:00 am – 06:00 am)").end, 18 * 60); // a typo for 6 pm
  assert.equal(parseOpd("Tue & Sat (9:30 am- 2:00 pm)").start, 9 * 60 + 30);
  assert.equal(parseOpd("nonsense"), null);
});

test("scheduleSlots: only the doctor's own days and hours", () => {
  // Dr. Pooja Sharma: Mon–Sat, 1–5 pm. 2026-10-08 is a Thursday, 2026-10-11 a Sunday.
  assert.equal(weekdayOf("2026-10-08"), 4);
  const thu = scheduleSlots("Dr. Pooja Sharma", "2026-10-08");
  assert.equal(thu[0], "13:00");
  assert.equal(thu.at(-1), "16:30");
  assert.ok(!thu.includes("10:00"));
  assert.deepEqual(scheduleSlots("Dr. Pooja Sharma", "2026-10-11"), []);
});

test("scheduleSlots: an unknown doctor falls back (null), a name matches however it is written", () => {
  assert.equal(scheduleSlots("Dr. Nobody Atall", "2026-10-08"), null);
  assert.equal(normName("Dr. (Col.) Pavan Kumar Pardal"), "pavan kumar pardal");
  assert.ok(hasSchedule("Pooja Sharma"));
});

test("availableSlots with a doctor name uses their hours; without one it keeps the default template", () => {
  const own = availableSlots([], { date: "2026-10-08", doctorName: "Dr. Pooja Sharma", now: new Date("2026-10-01T00:00:00Z") });
  assert.equal(own[0], "13:00");
  const dflt = availableSlots([], { date: "2026-10-08", now: new Date("2026-10-01T00:00:00Z") });
  assert.equal(dflt[0], "09:00");
  const booked = availableSlots(["13:00"], { date: "2026-10-08", doctorName: "Dr. Pooja Sharma", now: new Date("2026-10-01T00:00:00Z") });
  assert.ok(!booked.includes("13:00"));
});

test("evening times are valid slot times, odd ones are not", () => {
  assert.equal(isValidSlotTime("18:30"), true);
  assert.equal(isValidSlotTime("18:15"), false);
  assert.equal(isValidSlotTime("23:00"), false);
});

test("every doctor can be booked on at least one day in the next two weeks", () => {
  const start = new Date("2026-10-05T12:00:00Z");
  const dates = Array.from({ length: 14 }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
  const stuck = DOCTORS.filter((d) => !dates.some((date) => (scheduleSlots(d.name, date) ?? ["x"]).length > 0)).map((d) => d.name);
  assert.deepEqual(stuck, []);
});

test("getAvailableSlots (what the booking page and the chat call) follows the doctor's hours", async () => {
  const db = createFakeDb();
  await setDb(db);
  const { insertedId } = await db.collection("doctors").insertOne({ name: "Dr. Pooja Sharma", role: "Consultant Psychiatrist", specialties: [] });
  // A date far enough ahead that "today" filtering never applies: a Thursday and a Sunday.
  const thursday = "2030-10-10";
  const sunday = "2030-10-13";
  assert.equal(weekdayOf(thursday), 4);
  assert.equal(weekdayOf(sunday), 0);
  const thu = await getAvailableSlots(insertedId, thursday);
  assert.equal(thu[0], "13:00");
  assert.ok(!thu.includes("10:00"));
  assert.deepEqual(await getAvailableSlots(insertedId, sunday), []);
});

test("a doctor we have no timings for keeps the default template", async () => {
  const db = createFakeDb();
  await setDb(db);
  const { insertedId } = await db.collection("doctors").insertOne({ name: "Dr. Brand New", role: "Consultant Psychiatrist", specialties: [] });
  const slots = await getAvailableSlots(insertedId, "2030-10-10");
  assert.equal(slots[0], "09:00");
});
