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
export function cleanPersonName(text) {
  const name = String(text).replace(NAME_PREFIX, "").replace(/[.!]+$/, "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || !PERSON_NAME.test(name) || name.split(" ").length > 5) return null;
  return name;
}
