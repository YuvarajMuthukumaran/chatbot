// Lightweight, deterministic mood detection from a single message — mirrors
// the regex-based approach already used for specialty matching server-side
// rather than pulling in a sentiment-analysis dependency for a purely
// cosmetic mascot expression. Checked in priority order so a message
// touching multiple cues (e.g. "good doctors for anxious") resolves to the
// stronger/more specific emotion rather than a milder incidental word.
//
// Each mood also recognizes common Hindi/Tamil/Telugu words (native script)
// so the mascot keeps reacting when the conversation isn't in English.
const MOOD_PATTERNS = {
  angry: [
    /\b(angry|furious|pissed(?: off)?|mad|enraged|irritated|frustrated|annoyed)\b/i,
    /गुस्सा|नाराज़|चिढ़/, // Hindi
    /கோப|எரிச்சல்/, // Tamil — stem: கோபம் becomes கோபத்தில் etc. under case suffixes
    /కోపం|చిరాకు/, // Telugu
  ],
  sad: [
    /\b(sad|down|depressed|unhappy|miserable|heartbroken|crying|tearful|lonely|hopeless|upset)\b/i,
    /उदास|दुखी|अकेला/, // Hindi
    /சோக|துக்க|தனிமை/, // Tamil — stems (சோகம்/துக்கம் mutate under case suffixes)
    /బాధగా|దుఃఖం|ఒంటరిగా/, // Telugu
  ],
  anxious: [
    /\b(anxious|anxiety|nervous|worried|panic(?:k?ing)?|stressed|overwhelmed|scared|afraid|on edge|uneasy)\b/i,
    /चिंता|घबराहट|बेचैनी/, // Hindi
    /பதற்ற|கவலை|பயம்|பயமா|பயத்/, // Tamil — பதற்ற is a safe stem; பயம் (fear) is too short to stem (collides with பயன்/பயணம்), so its inflected/colloquial forms are spelled out instead
    /ఆందోళన|కంగారు|భయం/, // Telugu
  ],
  tired: [
    /\b(tired|exhausted|drained|worn out|sleepy|fatigued|burnt out|burned out|no energy)\b/i,
    /थका|थकान|सुस्त/, // Hindi
    /சோர்வு|களைப்பு/, // Tamil
    /అలసట|నీరసం/, // Telugu
  ],
  excited: [
    /\b(excited|thrilled|can'?t wait|pumped|stoked|hyped)\b/i,
    /उत्साहित|उत्साह/, // Hindi
    /உற்சாக|ஆர்வ/, // Tamil — stems (உற்சாகம்/ஆர்வம் mutate under case suffixes)
    /ఉత్సాహం|ఉత్సాహంగా/, // Telugu
  ],
  happy: [
    /\b(happy|glad|joyful|grateful|relieved|content|great|wonderful|awesome|feeling (?:good|better)|much better)\b/i,
    /खुश|खुशी|आनंद/, // Hindi
    /மகிழ்ச்சி|சந்தோஷ/, // Tamil — சந்தோஷம் stem (மகிழ்ச்சி doesn't have this issue)
    /సంతోషం|ఆనందం/, // Telugu
  ],
  neutral: [
    /\b(calm|relaxed|okay|alright|fine|peaceful)\b/i,
    /शांत/, // Hindi
    /அமைதி/, // Tamil
    /ప్రశాంతం/, // Telugu
  ],
};

// Order matters: earlier entries win when a message matches more than one.
const MOOD_PRIORITY = ["angry", "sad", "anxious", "tired", "excited", "happy", "neutral"];

export function detectMood(text) {
  if (!text) return null;
  for (const mood of MOOD_PRIORITY) {
    if (MOOD_PATTERNS[mood].some((pattern) => pattern.test(text))) return mood;
  }
  return null;
}
