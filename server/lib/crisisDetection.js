// Hard-coded crisis detection. This is intentionally NOT delegated to the
// model's judgment — it's a deterministic keyword/phrase gate that runs on
// every incoming message before the message ever reaches Gemini. If it
// fires, the fixed safe-response template is returned instead of (or
// alongside) any model call.

const CRISIS_PATTERNS = [
  // Suicidal ideation
  /\b(kill myself|end my life|end it all|suicid\w*|take my own life|no reason to live|better off dead|don'?t want to (be alive|live anymore))\b/i,
  // Self-harm
  /\b(hurt myself|harm myself|self[\s-]?harm|cutting myself|cut myself)\b/i,
  // Immediate danger / means
  /\b(overdose|od'?ing|jump off|hang myself|can'?t go on|want to die|wish i (was|were) dead|planning to die)\b/i,
];

/**
 * @param {string} text
 * @returns {boolean}
 */
export function detectCrisis(text) {
  if (!text || typeof text !== "string") return false;
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}
