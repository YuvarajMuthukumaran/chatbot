// Parsing of the personal details people type into the booking and patient-
// record flows, shared so both flows accept the same things.

/**
 * Pulls a 10-digit Indian mobile number out of free text, tolerating the ways
 * people actually type one: "+91 98765 43210", "098765-43210", "919876543210".
 * A strict 10-digit check rejected all of those, even though they're the
 * same number.
 * @returns {string|null} the bare 10 digits, or null if there isn't exactly one number
 */
export function normalizePhone(text) {
  if (typeof text !== "string") return null;
  let digits = text.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
}

const NAME_PREFIX = /^\s*(?:(?:my|the|patient'?s?|his|her)\s+name\s+is|name\s*[:-]|i\s+am|i'?m|this\s+is|it'?s|its|patient\s+is)\s+/i;
// Letters in any script (Hindi, Tamil, Telugu names typed natively too),
// plus the dots, apostrophes, and hyphens real names use.
const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M}.' -]{0,79}$/u;

/**
 * "my name is Priya Sharma." -> "Priya Sharma". Without this, whatever was
 * typed at the "what's your name?" step — "why do you need that?" included —
 * was stored as the name.
 * @returns {string|null} the cleaned name, or null for anything that isn't a plausible name
 */
/**
 * A name and number given up front in a booking request: "for my mother her
 * name is Sunita Devi and number is 9876501234". Either may be null.
 * @returns {{name: string|null, phone: string|null}}
 */
export function extractPatientDetails(text) {
  const s = String(text || "");
  const phoneMatch = s.match(/(?:\+?91[\s-]?)?0?\d{5}[\s-]?\d{5}/);
  const phone = phoneMatch ? normalizePhone(phoneMatch[0]) : null;
  const nameMatch = s.match(/\b(?:name is|named|called|patient is|naam)\s+([\p{L}][\p{L}\p{M}.' -]{1,60}?)(?=\s+(?:and|number|phone|mobile|contact|ph|no)\b|\s*[,.;]|\s*\d|$)/iu);
  const name = nameMatch ? cleanPersonName(nameMatch[1]) : null;
  return { name, phone };
}

// Replies that are clearly not a name ("yes" was being booked as one).
const NOT_A_NAME = /^(?:yes|yeah|yep|no|nope|ok|okay|sure|fine|haan|ha|nahi|hi|hello|hey|thanks|thank you|please|done|correct|right|same|me|myself|mother|father|mom|dad|never mind|stop|cancel)$/i;

export function cleanPersonName(text) {
  const name = String(text).replace(NAME_PREFIX, "").replace(/[.!]+$/, "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || !PERSON_NAME.test(name) || name.split(" ").length > 5 || NOT_A_NAME.test(name)) return null;
  return name;
}
