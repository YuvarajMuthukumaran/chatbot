// Hard-coded crisis detection. This is intentionally NOT delegated to the
// model's judgment — it's a deterministic keyword/phrase gate that runs on
// every incoming message before the message ever reaches the LLM. If it
// fires, the fixed safe-response template is returned instead of (or
// alongside) any model call.
//
// Covers English, Hindi, Tamil, and Telugu — both native script and common
// Romanized spellings (Hinglish/Tanglish/Tenglish), since the bot now
// converses in those languages and a crisis message shouldn't slip through
// just because it wasn't typed in English. These phrase lists are a careful
// best-effort pass, not an exhaustive or professionally validated set —
// regional slang varies a lot, so it's worth having a native speaker of
// each language sanity-check these before leaning on them in production.
//
// Each language's patterns here are its OWN distinctive phrases only —
// "aatmahatya" (a Sanskrit-derived word for "suicide" used identically in
// romanized Hindi and Telugu) is deliberately kept out of both and handled
// separately below, so a Telugu message using only that shared word isn't
// mis-detected as Hindi just because Hindi happens to be checked first.
const CRISIS_PATTERNS = {
  en: [
    /\b(kill myself|end my life|end it all|suicid\w*|take my own life|no reason to live|better off dead|don'?t want to (be alive|live anymore))\b/i,
    /\b(hurt myself|harm myself|self[\s-]?harm|cutting myself|cut myself)\b/i,
    /\b(overdose|od'?ing|jump off|hang myself|can'?t go on|want to die|wish i (was|were) dead|planning to die)\b/i,
  ],
  hi: [
    // Devanagari script
    /खुदकुशी|खुद\s*को\s*(मार|ख़त्म|नुकसान)|मरना\s*चाहता|मरना\s*चाहती|जीना\s*नहीं\s*चाहता|जीने\s*का\s*मन\s*नहीं|ज़िंदगी\s*ख़त्म|जान\s*देना\s*चाहता/,
    // Romanized (Hinglish)
    /\b(khudkushi|khud\s*ko\s*(mar|khatam|nuksan)|marna\s*chahta|marna\s*chahti|jeena\s*nahi\s*chahta|jeene\s*ka\s*man\s*nahi|zindagi\s*khatam|jaan\s*dena\s*chahta)\b/i,
  ],
  ta: [
    // Tamil script
    /தற்கொலை|செத்து\s*விட(வேண்டும்)?|இறந்து\s*விட(வேண்டும்)?|உயிரை\s*மாய்|சாக(வேண்டும்|\s*போ)|உயிரை\s*விட/,
    // Romanized (Tanglish)
    /\b(tharkolai|saga\s*vendum|saaganum|saaga\s*poren|sethuvida(num)?|sethidanum|uyirai\s*mudi|uyirai\s*vida)\b/i,
  ],
  te: [
    // Telugu script
    /చనిపో\s*వాలి|చచ్చిపో(వాలి)?|ప్రాణం\s*తీసుకో|నన్ను\s*నేను\s*గాయపరచుకో/,
    // Romanized (Tenglish)
    /\b(chanipovali|chanipoyali|chachipoyali|prananni\s*theesukovali|pranam\s*teesukovali)\b/i,
  ],
};

// "आत्महत्या"/"ఆత్మహత్య"/"aatmahatya" (suicide) — the same Sanskrit-derived
// word, used the same way in Hindi and Telugu. On its own (no other
// language-specific cue in the message) there's no reliable way to tell
// which of the two was intended, so it's checked last as a catch-all and
// defaults to Hindi. Either way the crisis is still caught; only the reply
// template's language is a coin flip in this one ambiguous case.
const SHARED_AATMAHATYA = { lang: "hi", pattern: /आत्महत्या|ఆత్మహత్య|\b(aatmahatya|atmahatya)\b/i };

/**
 * @param {string} text
 * @returns {("en"|"hi"|"ta"|"te")|null} the language a crisis phrase matched
 * in, or null if nothing matched. Truthy/falsy works fine for callers that
 * just want a yes/no.
 */
export function detectCrisis(text) {
  if (!text || typeof text !== "string") return null;
  for (const [lang, patterns] of Object.entries(CRISIS_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) return lang;
  }
  if (SHARED_AATMAHATYA.pattern.test(text)) return SHARED_AATMAHATYA.lang;
  return null;
}
