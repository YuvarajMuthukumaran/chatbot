// Deterministic intent detection for the appointment-booking chat flow.
// "visit history"/"my last visit" phrasing belongs to the HMS flow (real
// past-visit data from the hospital's actual system) — this uses distinct
// wording ("my bookings", "upcoming appointments") for appointments
// scheduled through this newer, separate booking system, so the two
// features don't collide on the same phrase. A bare "my appointments" could
// mean either, so it gets a clarifying question (clarifyAppointments) rather
// than a guess.
// Order matters: "reschedule my booking" and "cancel my booking" also
// contain the phrase "my booking", which myBookings' pattern would
// otherwise match first — so the more specific action-verb patterns are
// checked before the generic "view my bookings" one.
const INTENT_PATTERNS = {
  cancelBooking: /\bcancel (?:my |the |an |this |that )?(?:appointment|booking)s?\b/i,
  reschedule:
    /\breschedule (?:my |the |an |this |that )?(?:appointment|booking)s?\b|\bchange my (?:appointment|booking) (?:time|date)\b|\bmove my (?:appointment|booking)\b/i,
  // "book" + "appointment" tolerates up to two filler words in between
  // ("book an appointment", "book a therapy session", or a typo like "book
  // and appointment") instead of silently falling through to the LLM. "boom"
  // is recognized alongside "book" too — a common voice-to-text mishearing
  // on mobile ("Boom an appointment for dr anu"). "fix an appointment" is
  // everyday Indian English for booking one.
  book: /\b(?:book|boom|make|fix|get|need|want|schedule|arrange)\s+(?:\w+\s+){0,2}(?:appointment|consultation|session)\b|\bi want to (?:see|book|meet|consult) a (?:doctor|psychiatrist|psychologist|therapist|counsell?or)\b|\b(?:book|boom) with\b|\b(?:book|boom) (?:an? )?(?:dr|ms|mr)\.?\s/i,
  myBookings:
    /\bmy bookings?\b|\bupcoming appointments?\b|\bscheduled appointments?\b|\bappointments? i(?:'ve| have)? booked\b|\bmy next appointment\b|\bwhen is my appointment\b/i,
  clarifyAppointments: /\bmy appointments?\b/i,
};

// "I don't need an appointment" mentions booking without asking for it.
const NEGATED_BOOKING = /\b(?:don'?t|do not|no need to|not)\s+(?:\w+\s+)?(?:want|need|book|make|fix|get)\b/i;

export function detectBookingIntent(text) {
  if (!text) return null;
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(text)) {
      if (intent === "book" && NEGATED_BOOKING.test(text)) return null;
      return intent;
    }
  }
  return null;
}
