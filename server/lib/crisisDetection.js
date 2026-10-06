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
// Patterns are only ever added to, never narrowed: a false alarm costs a
// gentle template, a miss can cost far more.
//
// Each language's patterns here are its OWN distinctive phrases only —
// "aatmahatya" (a Sanskrit-derived word for "suicide" used identically in
// romanized Hindi and Telugu) is deliberately kept out of both and handled
// separately below, so a Telugu message using only that shared word isn't
// mis-detected as Hindi just because Hindi happens to be checked first.

// Devanagari has two spellings for letters like ज़/ज and ख़/ख (with and
// without the nukta dot), and which one arrives depends on the keyboard.
// Hindi patterns and input are both compared with the nukta stripped, so
// "ज़िंदगी" and "जिंदगी" match the same pattern. Only Devanagari runs are
// normalized: NFD elsewhere would decompose Tamil vowel signs (கொ -> க+ெ+ா)
// and stop the Tamil patterns from matching at all.
const NUKTA = new RegExp(String.fromCodePoint(0x093c), "g");
const stripNukta = (text) =>
  text.replace(/\p{Script=Devanagari}+/gu, (run) => run.normalize("NFD").replace(NUKTA, ""));
const hindiNative = (source) => new RegExp(stripNukta(source));

const CRISIS_PATTERNS = {
  en: [
    /\b(kill myself|end my life|end it all|suicid\w*|take my own life|no reason to live|better off dead|don'?t want to (be alive|live anymore))\b/i,
    /\b(hurt myself|harm myself|self[\s-]?harm|cutting myself|cut myself)\b/i,
    /\b(overdose|od'?ing|jump off|hang myself|can'?t go on|want to die|wish i (was|were) dead|planning to die)\b/i,
    // Common variants the phrases above miss.
    /\b(killing myself|kill my ?self|unalive|ending (it all|my life)|end my own life|take my life|taking my (own )?life|nothing (left )?to live for|not worth living|no point (in )?(living|going on)|better off without me|don'?t want to exist|wish i (had )?never (been )?born|wish i (was|were) never born|wanna die|want to be dead|hurting myself|harming myself|slit(ting)? my wrists?|hanging myself)\b/i,
    /\b(?:and|to) never wake up\b/i,
    // "easier if I just went to sleep and never woke up", "wish I wouldn't wake up".
    /\b(?:never|not|wouldn'?t) (?:wake|woke|waking) up\b(?!\s+(?:early|late|on time|before|till|until|in time))/i,
    /\b(?:went|go|going) to sleep (?:and|&) (?:never|not) (?:woke|wake)\b/i,
    /\bwant to end it\b(?!\s+with)/i,
    /\b(?:took|take|taking|swallow(?:ed|ing)?)\s+(?:all|a bunch of|too many|a lot of|lots of|an entire bottle of|the whole bottle of)\s+(?:of\s+)?(?:my |the )?(?:pills|tablets|meds|medicines?|sleeping pills)\b/i,
    // "kms" is internet shorthand for "kill myself" — but not "5 kms away".
    /(?<!\d\s?)\bkms\b/i,
  ],
  hi: [
    // Devanagari script
    hindiNative("खुदकुशी|खुद\\s*को\\s*(मार|ख़त्म|नुकसान)|मरना\\s*चाहता|मरना\\s*चाहती|जीना\\s*नहीं\\s*चाहता|जीने\\s*का\\s*मन\\s*नहीं|ज़िंदगी\\s*ख़त्म|जान\\s*देना\\s*चाहता"),
    hindiNative("मर\\s*जाना\\s*(चाहता|चाहती|है)|मुझे\\s*मरना\\s*है|जीना\\s*नहीं\\s*चाहती|जीने\\s*की\\s*इच्छा\\s*नहीं|ज़िंदा\\s*नहीं\\s*रहना|जान\\s*देना\\s*चाहती"),
    // "I feel like dying", "should I just die", "no point in living".
    hindiNative("मरने\\s*का\\s*(मन|दिल)|मर\\s*जाऊं|मर\\s*जाऊँ|जीने\\s*का\\s*कोई\\s*(मतलब|फायदा|फ़ायदा)\\s*नहीं|खुद\\s*को\\s*खत्म\\s*कर"),
    // Romanized (Hinglish)
    /\b(khudkushi|khud\s*ko\s*(mar|khatam|nuksan)|marna\s*chahta|marna\s*chahti|jeena\s*nahi\s*chahta|jeene\s*ka\s*man\s*nahi|zindagi\s*khatam|jaan\s*dena\s*chahta)\b/i,
    /\b(khud\s*k?hushi|khud\s*ko\s*(maar|khatm|khtm|nuksaan)|mar\s*ja+na\s*(chahta|chahti|hai)|mujhe\s*marna\s*hai|j(ee|i)n(a|e)\s*nahi?n?\s*chaht(a|i)|j(ee|i)ne\s*ka\s*mann?\s*nahi?n?|j(ee|i)ne\s*ki\s*(ichh?c?ha|iccha)\s*nahi?n?|zinda\s*nahi\s*rehna|zindagi\s*khatm|jaan\s*dena\s*chahti|suicide\s*kar)\b/i,
    // "marne ka mann kar raha hai" (I feel like dying), "mar jaun?" (should I
    // just die), "jeene ka koi matlab nahi" (no point living). Not "mar
    // jaunga" (as in "I'll die laughing"): the \b stops "jaun" there.
    /\b(marne\s*ka\s*(mann?|dil)\s*(kar|ho|karta)|mar\s*ja(u|un|oon|aun)n?\b|mar\s*jana\s*chahiye|j(ee|i)ne\s*ka\s*koi\s*(matlab|fayda|faida)\s*nahi?n?|khud\s*ko\s*khatam\s*kar)/i,
  ],
  ta: [
    // Tamil script
    /தற்கொலை|செத்து\s*விட(வேண்டும்)?|இறந்து\s*விட(வேண்டும்)?|உயிரை\s*மாய்|சாக(வேண்டும்|\s*போ)|உயிரை\s*விட/,
    /சாகணும்|சாகப்\s*போ|செத்துட(லாம்|ணும்)|செத்துருவேன்|செத்துப்\s*போக|தூக்கு\s*போட்டு/,
    // Romanized (Tanglish)
    /\b(tharkolai|saga\s*vendum|saaganum|saaga\s*poren|sethuvida(num)?|sethidanum|uyirai\s*mudi|uyirai\s*vida)\b/i,
    /\b(sethudalam|setthudalam|sethu\s*poga(num|num)|saaga\s*ponum|naan\s*saaga|thoo?kku\s*pot(tu|tukka)\w*)\b/i,
  ],
  te: [
    // Telugu script
    /చనిపో\s*వాలి|చచ్చిపో(వాలి)?|ప్రాణం\s*తీసుకో|నన్ను\s*నేను\s*గాయపరచుకో/,
    // "చనిపోవాలని ఉంది" ("I feel like dying") — the stem, since the ending
    // changes (చనిపోవాలి / చనిపోవాలని).
    /చనిపోవాల|చావాలని|ఉరి\s*వేసుకో|బ్రతకాలని\s*లేదు|బతకాలని\s*లేదు/,
    // Romanized (Tenglish)
    /\b(chanipovali|chanipoyali|chachipoyali|prananni\s*theesukovali|pranam\s*teesukovali)\b/i,
    /\b(chanipov(a|aa)l\w*|chachipo(v|y)a?l\w*|chaavaalani|chavalani|b(r)?at(h)?akalani\s*ledu|uri\s*vesukov\w*|pran(am|anni)\s*th?ee?sukov\w*)\b/i,
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
  const normalized = stripNukta(text);
  for (const [lang, patterns] of Object.entries(CRISIS_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(normalized))) return lang;
  }
  if (SHARED_AATMAHATYA.pattern.test(normalized)) return SHARED_AATMAHATYA.lang;
  return null;
}
