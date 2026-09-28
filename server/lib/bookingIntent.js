// Deterministic intent detection for the appointment-booking chat flow.
// "my appointments"/"visit history" phrasing is already claimed by the HMS
// flow (real past-visit data from the hospital's actual system) — this uses
// distinct wording ("my bookings", "upcoming appointments") for viewing
// appointments scheduled through this newer, separate booking system, so
// the two features don't collide on the same phrase.
// Order matters: "reschedule my booking" and "cancel my booking" also
// contain the phrase "my booking", which myBookings' pattern would
// otherwise match first — so the more specific action-verb patterns are
// checked before the generic "view my bookings" one.
const INTENT_PATTERNS = {
  cancelBooking: /\bcancel my (appointment|booking)\b/i,
  reschedule: /\breschedule my (appointment|booking)\b|\bchange my appointment (time|date)\b/i,
  // "book" + "appointment" tolerates one filler word in between (an/a/my/the,
  // or a typo like "and") so "book and appointment" (a common "an" typo)
  // still matches instead of silently falling through to the LLM.
  book: /\bbook\s+(?:\w+\s+)?appointment\b|\bschedule\s+(?:\w+\s+)?appointment\b|\bi want to (see|book|meet) a doctor\b|\bbook with\b|\bbook (?:an? )?(?:dr|ms|mr)\.?\s/i,
  myBookings: /\bmy bookings?\b|\bupcoming appointments?\b|\bscheduled appointments?\b|\bappointments? i(?:'ve| have)? booked\b/i,
};

export function detectBookingIntent(text) {
  if (!text) return null;
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(text)) return intent;
  }
  return null;
}
