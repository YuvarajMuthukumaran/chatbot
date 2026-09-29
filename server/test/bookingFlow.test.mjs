// Uses node:test's module mocking (Node 22+, --experimental-test-module-mocks)
// to replace the MongoDB-backed bookingData.js with an in-memory fake, so
// these run instantly with no real database.
import { test, mock } from "node:test";
import assert from "node:assert";

const p = (name) => new URL(name, import.meta.url).href;

const MOCK_DOCTORS = [
  { _id: "1", name: "Dr. Anu Yadav", role: "Consultant Psychiatrist", specialties: [] },
  { _id: "2", name: "Dr. Pooja Sharma", role: "Consultant Psychiatrist", specialties: ["anxiety"] },
  { _id: "3", name: "Dr. Poorva Gupta", role: "Consultant Psychiatrist", specialties: ["ocd"] },
];

mock.module(p("../lib/bookingData.js"), {
  namedExports: {
    // Mirrors the real searchDoctors: case-insensitive substring match on
    // name (a MongoDB $regex in production), or an exact specialty-tag
    // match — not an exact-key lookup on either.
    searchDoctors: async ({ search, specialty }) => {
      if (search) {
        const re = new RegExp(search, "i");
        return MOCK_DOCTORS.filter((d) => re.test(d.name));
      }
      if (specialty) {
        return MOCK_DOCTORS.filter((d) => d.specialties.includes(specialty));
      }
      return [];
    },
    getAvailableSlots: async () => ["09:00", "09:30"],
    bookAppointment: async (x) => ({ ...x }),
    listAppointmentsByPhone: async () => [],
    cancelAppointment: async () => true,
    rescheduleAppointment: async () => true,
  },
});

const { handleBookingTurn } = await import(p("../lib/bookingFlow.js"));

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
  const dateResult = await handleBookingTurn({}, "book an appointment for tomorrow");
  assert.match(dateResult.reply, /couldn't find a matching doctor/);

  const specialtyResult = await handleBookingTurn({}, "book an appointment for anxiety");
  assert.match(specialtyResult.reply, /Pooja Sharma/); // fell back to specialty search
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
  assert.doesNotMatch(result.reply, /couldn't find a matching doctor/);
});

test("a vague back-reference with nothing recommended yet fails gracefully", async () => {
  const result = await handleBookingTurn({}, "book an appointment for any one of them");
  assert.match(result.reply, /couldn't find a matching doctor/);
});
