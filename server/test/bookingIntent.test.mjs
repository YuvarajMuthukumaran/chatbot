import { test } from "node:test";
import assert from "node:assert";
import { detectBookingIntent } from "../lib/bookingIntent.js";

test("book intent — standard phrasing", () => {
  assert.equal(detectBookingIntent("book an appointment"), "book");
  assert.equal(detectBookingIntent("schedule an appointment"), "book");
  assert.equal(detectBookingIntent("i want to book a doctor"), "book");
  assert.equal(detectBookingIntent("book with poorva"), "book");
  assert.equal(detectBookingIntent("book dr singh"), "book");
});

test("book intent — real-world typos and voice-to-text artifacts", () => {
  // "and" instead of "an" — a common typo.
  assert.equal(detectBookingIntent("book and appointment"), "book");
  // "Boom" instead of "Book" — a common mobile voice-to-text mishearing.
  assert.equal(detectBookingIntent("Boom an appointment for dr anu"), "book");
});

test("book intent — does not misfire on unrelated text", () => {
  assert.equal(detectBookingIntent("there was a boom outside"), null);
  assert.equal(detectBookingIntent("what's the weather like today"), null);
});

test("other intents", () => {
  assert.equal(detectBookingIntent("cancel my appointment"), "cancelBooking");
  assert.equal(detectBookingIntent("reschedule my booking"), "reschedule");
  assert.equal(detectBookingIntent("my bookings"), "myBookings");
  assert.equal(detectBookingIntent("upcoming appointments"), "myBookings");
});

test("book intent — everyday Indian English, and negation", () => {
  assert.equal(detectBookingIntent("I need to fix an appointment"), "book");
  assert.equal(detectBookingIntent("can I book a therapy session"), "book");
  assert.equal(detectBookingIntent("I don't need an appointment"), null);
  assert.equal(detectBookingIntent("I'm not sure I want to book"), null);
});

test("a bare 'my appointments' is ambiguous; clearly future-facing phrasing isn't", () => {
  assert.equal(detectBookingIntent("show my appointments"), "clarifyAppointments");
  assert.equal(detectBookingIntent("when is my appointment"), "myBookings");
  assert.equal(detectBookingIntent("Show my upcoming appointments"), "myBookings");
});

test("confirmation chips aren't mistaken for new requests", () => {
  assert.equal(detectBookingIntent("Yes, cancel it"), null);
  assert.equal(detectBookingIntent("Yes, book it"), null);
});

test("reschedule/cancel take priority over the generic myBookings pattern", () => {
  // Both of these also contain "my booking", which myBookings' own pattern
  // would otherwise match first.
  assert.equal(detectBookingIntent("cancel my booking"), "cancelBooking");
  assert.equal(detectBookingIntent("reschedule my booking"), "reschedule");
});
