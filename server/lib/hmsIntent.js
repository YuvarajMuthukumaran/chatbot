// Deterministic intent detection for patient self-service requests
// (admission/discharge status, prescriptions, patient lookup) — deliberately
// narrow so ordinary words don't misfire ("my admission" alone is too
// generic; could mean a college admission, an admission of guilt, etc.).
const INTENT_PATTERNS = {
  // "my hospital admission", not a bare "hospital admission": families ask
  // about getting someone admitted ("hospital admission for my father") far
  // more often than patients ask about their own status.
  admission: /\badmission status\b|\bam i (still )?admitted\b|\bstill admitted\b|\bmy hospital admission\b|\bmy admission status\b/i,
  discharge: /\bdischarge summary\b|\bwhen (was|am|will) i (be )?discharged\b|\bmy discharge\b/i,
  // A bare "my appointments" is NOT claimed here any more: since the booking
  // system arrived it usually means upcoming bookings, so bookingIntent.js
  // asks which one the person means instead of guessing.
  visits:
    /\bmy (?:past |previous |recent )?visits?\b|\b(visit|appointment) history\b|\blast \d+ (visits?|appointments?)\b|\bmy last (visit|appointment)\b|\b(?:recent|past|previous) (visits?|appointments?)\b/i,
  prescription:
    /\bmy prescriptions?\b|\bwhat did the doctor prescribe\b|\bmedication history\b|\b(check|show|see|view|find) my medicines?\b|\bwhat medicines? (was i|were you) prescribed\b/i,
  findId: /\b(?:find|what(?:'s| is)|show|tell me) my (?:patient id|uhid)\b/i,
  // Only an explicit request to register — not just "new patient", which
  // also turns up in ordinary booking requests ("I'm a new patient, can I
  // book with...").
  register: /\bregister (?:me|myself|as a (?:new )?patient)\b|\b(?:new )?patient registration\b|\bhow (?:do|can) i register\b/i,
};

// "cancel/book/reschedule my appointment" are booking-system actions (see
// bookingIntent.js), not a request to look at past-visit history — but they
// contain the same word "appointment" the visits pattern matches on. Skip
// the visits check specifically when one of those verbs is present, so
// those phrases fall through to the booking flow instead.
const BOOKING_ACTION_WORDS = /\b(book|cancel|reschedule|schedule)\b/i;

export function detectHmsIntent(text) {
  if (!text) return null;
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (intent === "visits" && BOOKING_ACTION_WORDS.test(text)) continue;
    if (pattern.test(text)) return intent;
  }
  return null;
}
