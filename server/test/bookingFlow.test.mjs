// Exercises the real booking flow and data layer (bookingFlow.js ->
// bookingData.js) against the in-memory fake database, so the actual query
// building — regex escaping, specialty $in, the double-booking unique index —
// is covered too, not a hand-written mock of it.
import { test, beforeEach } from "node:test";
import assert from "node:assert";
import { createFakeDb } from "../scripts/fakeDb.js";
import { setDb } from "../lib/db.js";
import { handleBookingTurn } from "../lib/bookingFlow.js";
import { handleDeterministicTurn } from "../lib/turnRouter.js";
import { clinicToday, addDays, formatDate } from "../lib/clinicTime.js";
import { BOOKING_WINDOW_DAYS } from "../lib/slots.js";
import { limiters } from "../lib/rateLimit.js";

// Nothing here should reach the hospital's HMS (it creates a patient record
// on every unmatched lookup) — a dead local address makes sure of it.
process.env.HMS_API_BASE = "http://127.0.0.1:9/hms/api";

const DIRECTORY = [
  { name: "Dr. Anu Yadav", role: "Consultant Psychiatrist", specialties: [] },
  { name: "Dr. Pooja Sharma", role: "Consultant Psychiatrist", specialties: ["anxiety"] },
  { name: "Dr. Poorva Gupta", role: "Consultant Psychiatrist", specialties: ["ocd"] },
  { name: "Dr. (Col.) Pavan Kumar Pardal", role: "Senior Consultant Psychiatrist", specialties: ["ocd", "addiction"] },
];

let db;
beforeEach(async () => {
  db = createFakeDb();
  await setDb(db);
  for (const doctor of DIRECTORY) await db.collection("doctors").insertOne({ ...doctor });
  for (const limiter of Object.values(limiters)) limiter.reset();
});

// Test mode (OTP_DEV_ECHO, set in test/setup.mjs) shows the e-mailed code in the reply.
const codeIn = (reply) => reply.match(/the code is (\d{6})/)?.[1];

/** Answers the e-mailed code the last reply asked for. */
async function enterCode(session, lastReply, ctx = {}) {
  const code = codeIn(lastReply);
  assert.ok(code, `expected a code in: ${lastReply}`);
  return converse(session, [code], ctx);
}

const tomorrow = () => addDays(clinicToday(), 1);

/** Sends messages through the full deterministic pipeline, like routes/chat.js does. */
async function converse(session, messages, ctx = {}) {
  let result;
  for (const message of messages) result = await handleDeterministicTurn(session, message, ctx);
  return result;
}

async function bookedAppointments() {
  return db.collection("appointments").find({ status: "booked" }).toArray();
}

async function seedAppointment(fields) {
  const doctor = await db.collection("doctors").findOne({ name: "Dr. Pooja Sharma" });
  await db.collection("appointments").insertOne({
    doctorId: String(doctor._id),
    doctorName: doctor.name,
    patientName: "Priya Sharma",
    patientEmail: "priya@gmail.com",
    date: addDays(clinicToday(), 3),
    time: "10:00",
    status: "booked",
    ...fields,
  });
}

// ---- finding the doctor ----

test("resolves a doctor by bare first name via 'for NAME'", async () => {
  const result = await handleBookingTurn({}, "book an appointment for pooja");
  assert.equal(result.handled, true);
  assert.match(result.reply, /Dr\. Pooja Sharma/);
});

test("'for' doesn't swallow a title into a rejected bare-title match", async () => {
  // Regression: "for dr anu" used to capture "dr anu" as one unit (since
  // "for" appears before "dr" in the sentence) and reject the whole thing
  // because "dr" alone is a non-name word, discarding "anu" along with it.
  const result = await handleBookingTurn({}, "Boom an appointment for dr anu");
  assert.equal(result.handled, true);
  assert.match(result.reply, /Dr\. Anu Yadav/);
});

test("'for' doesn't hijack date words or specialty words", async () => {
  // A date is remembered for later rather than searched for as a name.
  const dateResult = await handleBookingTurn({}, "book an appointment for tomorrow");
  assert.match(dateResult.reply, /who would you like to see on/);
  assert.ok(dateResult.reply.includes(formatDate(tomorrow())));

  const specialtyResult = await handleBookingTurn({}, "book an appointment for anxiety");
  assert.match(specialtyResult.reply, /Pooja Sharma/); // fell back to specialty search
});

test("a request without any doctor asks who they'd like to see, with suggestions", async () => {
  const result = await handleBookingTurn({}, "I want to book an appointment");
  assert.match(result.reply, /who would you like to see/);
  assert.ok(result.quickReplies.includes("Anxiety"));
  assert.ok(result.quickReplies.includes("Never mind"));
});

test("resolves a vague back-reference to doctors just recommended", async () => {
  const session = {
    lastRecommendedDoctors: [
      { name: "Dr. Pooja Sharma", role: "Consultant Psychiatrist" },
      { name: "Dr. Poorva Gupta", role: "Consultant Psychiatrist" },
    ],
  };
  const result = await handleBookingTurn(session, "book appointment fot any one of them");
  assert.equal(result.handled, true);
  assert.match(result.reply, /Dr\. Pooja Sharma/);
  assert.match(result.reply, /Dr\. Poorva Gupta/);
  assert.deepEqual(result.quickReplies.slice(0, 2).sort(), ["Dr. Pooja Sharma", "Dr. Poorva Gupta"]);
});

test("a vague back-reference with nothing recommended yet asks who instead", async () => {
  const result = await handleBookingTurn({}, "book an appointment for any one of them");
  assert.match(result.reply, /who would you like to see/);
});

test("names with regex metacharacters are matched literally", async () => {
  // "Dr. (Col.) Pavan Kumar Pardal" as a raw regex can't even match itself.
  const byName = await handleBookingTurn({}, "Book an appointment with Dr. (Col.) Pavan Kumar Pardal");
  assert.match(byName.reply, /Got it — \*\*Dr\. \(Col\.\) Pavan Kumar Pardal\*\*/);

  const session = { lastRecommendedDoctors: [{ name: "Dr. (Col.) Pavan Kumar Pardal" }] };
  const byReference = await handleBookingTurn(session, "book with that one");
  assert.match(byReference.reply, /Pavan Kumar Pardal/);
});

test("a search that isn't a valid regex doesn't throw", async () => {
  // Regression: this used to reach MongoDB as an invalid $regex, and the
  // unhandled rejection took the whole server down.
  const session = {};
  await handleBookingTurn(session, "book an appointment");
  const result = await handleBookingTurn(session, "[");
  assert.match(result.reply, /couldn't find a doctor matching that/);

  // Escaped, "(" is just a character — one this directory's names contain.
  assert.match((await handleBookingTurn(session, "(")).reply, /Pavan Kumar Pardal/);
});

test("replies read naturally: capitalized after an intro, acronyms kept", async () => {
  const session = {};
  await handleBookingTurn(session, "book an appointment");
  assert.match((await handleBookingTurn(session, "zzz")).reply, /matching that\. Who would you like to see/);
  assert.match((await handleBookingTurn({}, "book an appointment for OCD")).reply, /specialists for OCD:/);
});

test("a concern nobody is tagged for falls back to the generalist", async () => {
  const result = await handleBookingTurn({}, "book an appointment for insomnia");
  assert.match(result.reply, /Dr\. Anu Yadav/);
  assert.match(result.reply, /sleep problems/);
});

// ---- the full booking conversation ----

test("full booking: Indian time formats, name cleanup, an e-mailed code, and a confirmation step", async () => {
  const session = {};
  const sent = await converse(session, ["book an appointment with dr pooja", "Tomorrow", "10.30", "my name is Priya Sharma", " Priya.Sharma@Gmail.com "]);
  assert.match(sent.reply, /emailed a 6-digit code to \*\*p•••@gmail\.com\*\*/);
  assert.ok(sent.quickReplies.includes("Resend code"));

  const result = await enterCode(session, sent.reply);
  assert.match(result.reply, /Please confirm/);
  assert.match(result.reply, /10:30 AM/);
  assert.equal((await bookedAppointments()).length, 0, "nothing is booked before confirming");

  const confirmed = await converse(session, ["Yes, book it"]);
  assert.match(confirmed.reply, /You're booked!/);
  assert.match(confirmed.reply, /confirmation is on its way/);
  assert.ok(confirmed.llmNote && !confirmed.llmNote.includes("@"), "the LLM note carries no email address");
  const [appt] = await bookedAppointments();
  assert.equal(appt.time, "10:30"); // "10.30" used to be booked as 10:00
  assert.equal(appt.date, tomorrow());
  assert.equal(appt.patientName, "Priya Sharma");
  assert.equal(appt.patientEmail, "priya.sharma@gmail.com");
});

test("a wrong code is refused, and a new one can be sent", async () => {
  const session = {};
  const sent = await converse(session, ["book an appointment with dr pooja", "tomorrow", "10:00", "Priya Sharma", "priya@gmail.com"]);
  const wrong = await converse(session, ["000000" === codeIn(sent.reply) ? "111111" : "000000"]);
  assert.match(wrong.reply, /doesn't match/);
  const resent = await converse(session, ["Resend code"]);
  assert.match(resent.reply, /emailed a 6-digit code/);
  assert.notEqual(codeIn(resent.reply), undefined);
  const ok = await enterCode(session, resent.reply);
  assert.match(ok.reply, /Please confirm/);
});

test("an address that isn't an email is asked for again", async () => {
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja", "tomorrow", "10:00", "Priya Sharma", "9876543210"]);
  assert.match(result.reply, /doesn't look like an email/);
});

test("an afternoon time without am/pm ('2:30') means 2:30 PM", async () => {
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja", "tomorrow", "2:30"]);
  assert.match(result.reply, /2:30 PM\*\* it is/);
});

test("a date and time in the first message skip straight to the patient's name", async () => {
  const result = await handleBookingTurn({}, "book dr pooja tomorrow at 11am");
  assert.ok(result.reply.includes(`${formatDate(tomorrow())} at 11:00 AM`));
  assert.match(result.reply, /patient's full name/);
});

test("a time given along with the date ('tomorrow at 3pm') is used too", async () => {
  // Regression (found in live testing): the time was ignored, leaving the
  // person stuck at "which time works for you?".
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja", "tomorrow at 3pm"]);
  assert.ok(result.reply.includes(`${formatDate(tomorrow())} at 3:00 PM`), result.reply);
  assert.match(result.reply, /patient's full name/);
});

test("switching days at the time step works", async () => {
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja", "tomorrow", "actually the day after tomorrow"]);
  assert.ok(result.reply.includes(formatDate(addDays(clinicToday(), 2))));
});

test("past dates and dates beyond the booking window are refused", async () => {
  const session = {};
  await converse(session, ["book an appointment with dr pooja"]);
  const past = await converse(session, [addDays(clinicToday(), -3)]);
  assert.match(past.reply, /already passed/);
  const farOff = await converse(session, [addDays(clinicToday(), BOOKING_WINDOW_DAYS + 5)]);
  assert.match(farOff.reply, /days ahead/);
});

test("declining at the confirmation books nothing", async () => {
  const session = {};
  const sent = await converse(session, ["book an appointment with dr pooja", "tomorrow", "10:00", "Priya Sharma", "priya@gmail.com"]);
  await enterCode(session, sent.reply);
  const result = await converse(session, ["No, don't book"]);
  assert.match(result.reply, /haven't booked anything/);
  assert.equal((await bookedAppointments()).length, 0);
});

test("a slot taken by someone else in the meantime is re-offered, not double-booked", async () => {
  const first = {};
  const second = {};
  const steps = ["book an appointment with dr pooja", "tomorrow", "10:00"];
  await enterCode(first, (await converse(first, [...steps, "Priya Sharma", "priya@gmail.com"])).reply);
  await enterCode(second, (await converse(second, [...steps, "Ravi Kumar", "ravi@gmail.com"])).reply);
  await converse(first, ["yes"]);
  const result = await converse(second, ["yes"]);
  assert.match(result.reply, /that slot was just taken/);
  assert.doesNotMatch(result.quickReplies.join(" "), /^10:00 AM$/m);
  assert.equal((await bookedAppointments()).length, 1);

  // Picking another time goes straight back to confirming: no new code, no re-asking for details.
  const retry = await converse(second, ["10:30"]);
  assert.match(retry.reply, /Please confirm/);
  assert.match(retry.reply, /Ravi Kumar/);
});

// ---- leaving or switching flows ----

test("'never mind' mid-flow stops with a plain acknowledgement", async () => {
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja", "never mind"]);
  assert.match(result.reply, /nothing was booked/);
  assert.equal(session.booking.flow, null);
});

test("an emotional message mid-flow goes to the conversation, not the form", async () => {
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja", "honestly I'm feeling really overwhelmed"]);
  assert.equal(result.handled, false);
  assert.equal(session.booking.flow, null);
});

test("crisis language mid-flow gets the crisis reply and ends the form", async () => {
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja", "tomorrow", "i want to kill myself"]);
  assert.equal(result.crisis, true);
  assert.equal(session.booking.flow, null);
  // ...so the next message is conversation, not a slot choice.
  assert.equal((await converse(session, ["10:00"])).handled, false);
});

test("asking for a different booking action mid-flow switches to it", async () => {
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja", "actually, cancel my appointment"]);
  assert.match(result.reply, /What email address did you book with/);
  assert.equal(session.booking.flow, "cancel");
});

test("a bare 'my appointments' asks which kind the person means", async () => {
  const result = await converse({}, ["show my appointments"]);
  assert.deepEqual(result.quickReplies, ["Show my upcoming appointments", "Show my visit history"]);
});

// ---- viewing, cancelling, rescheduling ----

test("'yes, cancel it' at the cancel confirmation actually cancels", async () => {
  // Regression: "cancel" read as "abandon this flow", so confirming a
  // cancellation silently dropped it and the appointment stayed booked.
  await seedAppointment();
  const session = {};
  const sent = await converse(session, ["cancel my appointment", "priya@gmail.com"]);
  const confirm = await enterCode(session, sent.reply);
  assert.match(confirm.reply, /Cancel your appointment with \*\*Dr\. Pooja Sharma\*\*/);
  const done = await converse(session, ["yes, cancel it"]);
  assert.match(done.reply, /has been cancelled/);
  assert.equal((await bookedAppointments()).length, 0);
});

test("someone else's appointments can't be seen with just their email", async () => {
  await seedAppointment();
  const session = {};
  await converse(session, ["show my bookings", "priya@gmail.com"]);
  const guess = await converse(session, ["123456"]);
  assert.doesNotMatch(guess.reply, /Dr\. Pooja Sharma/);
});

test("the email can come with the request itself", async () => {
  await seedAppointment();
  const session = {};
  const sent = await converse(session, ["show my bookings for priya@gmail.com"]);
  const result = await enterCode(session, sent.reply);
  assert.match(result.reply, /Here are your upcoming appointments/);
});

test("once an email is confirmed in the chat, looking up bookings needs no second code", async () => {
  await seedAppointment();
  const session = {};
  const sent = await converse(session, ["show my bookings", "priya@gmail.com"]);
  await enterCode(session, sent.reply);
  const again = await converse(session, ["show my bookings"]);
  assert.match(again.reply, /Here are your upcoming appointments/);
});

test("'upcoming' appointments leave out past ones", async () => {
  await seedAppointment({ date: addDays(clinicToday(), -10) });
  const session = {};
  const sent = await converse(session, ["show my bookings", "priya@gmail.com"]);
  const result = await enterCode(session, sent.reply);
  assert.match(result.reply, /don't have any upcoming appointments/);
});

test("rescheduling asks for confirmation, then moves the appointment", async () => {
  await seedAppointment();
  const session = {};
  const target = addDays(clinicToday(), 5);
  const sent = await converse(session, ["reschedule my appointment", "priya@gmail.com"]);
  await enterCode(session, sent.reply);
  const confirm = await converse(session, [target, "3pm"]);
  assert.match(confirm.reply, /Move your appointment/);
  const done = await converse(session, ["Yes, move it"]);
  assert.match(done.reply, /is now on/);
  const [appt] = await bookedAppointments();
  assert.equal(appt.date, target);
  assert.equal(appt.time, "15:00");
});

test("e-mailed codes are rate limited per address", async () => {
  let result;
  for (let i = 0; i < 4; i++) result = await converse({}, ["show my bookings for priya@gmail.com"], { ip: `203.0.113.${i}` });
  assert.match(result.reply, /sent quite a few codes/);
});

test("a flow that keeps re-asking the same question lets the person go", async () => {
  const session = {};
  // Answering a different question than the one asked (the date).
  const result = await converse(session, ["book an appointment with dr pooja sharma", "Meena", "9876543210", "purple"]);
  assert.match(result.reply, /so you're not stuck/);
  assert.equal(session.booking?.flow ?? null, null);
});

test("'morning' at the time step narrows the list to morning slots", async () => {
  const session = {};
  const result = await converse(session, ["book an appointment with dr pooja sharma", "tomorrow", "morning"]);
  assert.match(result.reply, /^Morning times/);
  assert.ok(result.quickReplies.every((q) => q === "Never mind" || /AM|12:\d\d PM/.test(q)), result.quickReplies.join());
});

test("a name and email given in the first message aren't asked for again, and 'yes' is never a name", async () => {
  const session = {};
  const sent = await converse(session, [
    "book an appointment with dr pooja sharma tomorrow at 10am for my mother her name is Sunita Devi and email is sunita.devi@gmail.com",
  ]);
  assert.match(sent.reply, /emailed a 6-digit code to \*\*s•••@gmail\.com\*\*/);
  const result = await enterCode(session, sent.reply);
  assert.match(result.reply, /Please confirm/);
  assert.match(result.reply, /Sunita Devi/);

  const noName = {};
  await converse(noName, ["book an appointment with dr pooja sharma", "tomorrow", "10:00 AM"]);
  const yes = await converse(noName, ["yes"]);
  assert.match(yes.reply, /full name/);
});

test("a date given when asked for a doctor is kept, and the doctor is asked again", async () => {
  const session = {};
  await handleBookingTurn(session, "i want to book appointment");
  const r = await handleBookingTurn(session, "tomorrow");
  assert.match(r.reply, /works\. Who would you like to see on/);
  assert.ok(r.quickReplies.includes("Any doctor"));
});
