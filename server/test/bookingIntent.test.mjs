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

test("reschedule/cancel take priority over the generic myBookings pattern", () => {
  // Both of these also contain "my booking", which myBookings' own pattern
  // would otherwise match first.
  assert.equal(detectBookingIntent("cancel my booking"), "cancelBooking");
  assert.equal(detectBookingIntent("reschedule my booking"), "reschedule");
});
