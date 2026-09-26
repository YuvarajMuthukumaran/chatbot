// Lightweight, deterministic mood detection from a single message — mirrors
// the regex-based approach already used for specialty matching server-side
// rather than pulling in a sentiment-analysis dependency for a purely
// cosmetic mascot expression. Checked in priority order so a message
// touching multiple cues (e.g. "good doctors for anxious") resolves to the
// stronger/more specific emotion rather than a milder incidental word.
const MOOD_PATTERNS = {
  angry: /\b(angry|furious|pissed(?: off)?|mad|enraged|irritated|frustrated|annoyed)\b/i,
  sad: /\b(sad|down|depressed|unhappy|miserable|heartbroken|crying|tearful|lonely|hopeless|upset)\b/i,
  anxious: /\b(anxious|anxiety|nervous|worried|panic(?:k?ing)?|stressed|overwhelmed|scared|afraid|on edge|uneasy)\b/i,
  tired: /\b(tired|exhausted|drained|worn out|sleepy|fatigued|burnt out|burned out|no energy)\b/i,
  excited: /\b(excited|thrilled|can'?t wait|pumped|stoked|hyped)\b/i,
  happy: /\b(happy|glad|joyful|grateful|relieved|content|great|wonderful|awesome|feeling (?:good|better)|much better)\b/i,
  neutral: /\b(calm|relaxed|okay|alright|fine|peaceful)\b/i,
};

// Order matters: earlier entries win when a message matches more than one.
const MOOD_PRIORITY = ["angry", "sad", "anxious", "tired", "excited", "happy", "neutral"];

export function detectMood(text) {
  if (!text) return null;
  for (const mood of MOOD_PRIORITY) {
    if (MOOD_PATTERNS[mood].test(text)) return mood;
  }
  return null;
}
