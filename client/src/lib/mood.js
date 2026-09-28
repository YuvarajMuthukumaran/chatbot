// Lightweight, deterministic mood detection from a single message — mirrors
// the regex-based approach already used for specialty matching server-side
// rather than pulling in a sentiment-analysis dependency for a purely
// cosmetic mascot expression. Checked in priority order so a message
// touching multiple cues (e.g. "good doctors for anxious") resolves to the
// stronger/more specific emotion rather than a milder incidental word.
//
// Each mood also recognizes common Hindi/Tamil/Telugu words, both native
// script AND romanized (Hinglish/Tanglish/Tenglish) — mood words are rarely
// said in English even in an otherwise-romanized sentence (unlike "doctor"/
// "appointment", which get used as English loanwords), so without the
// romanized forms the mascot simply never reacted for romanized input.
const MOOD_PATTERNS = {
  angry: [
    /\b(angry|furious|pissed(?: off)?|mad|enraged|irritated|frustrated|annoyed)\b/i,
    /गुस्सा|नाराज़|चिढ़/, // Hindi (native)
    /\b(gussa|naraz|naraaz|chid+chid\w*)\b/i, // Hindi (romanized)
    /கோப|எரிச்சல்/, // Tamil (native) — stem: கோபம் becomes கோபத்தில் etc. under case suffixes
    /\b(kobam|kobama|erichal)\b/i, // Tamil (romanized)
    /కోపం|చిరాకు/, // Telugu (native)
    /\b(kopam|kopanga|chirunaku)\b/i, // Telugu (romanized)
  ],
  sad: [
    /\b(sad|down|depressed|unhappy|miserable|heartbroken|crying|tearful|lonely|hopeless|upset)\b/i,
    /उदास|दुखी|अकेला/, // Hindi (native)
    /\b(udaas|udas|dukhi|akela|akeli)\b/i, // Hindi (romanized)
    /சோக|துக்க|தனிமை/, // Tamil (native) — stems (சோகம்/துக்கம் mutate under case suffixes)
    /\b(soga|sogam|thukkam|thanimai)\b/i, // Tamil (romanized)
    /బాధగా|దుఃఖం|ఒంటరిగా/, // Telugu (native)
    /\b(badhaga|dukham|ontariga)\b/i, // Telugu (romanized)
  ],
  anxious: [
    /\b(anxious|anxiety|nervous|worried|panic(?:k?ing)?|stressed|overwhelmed|scared|afraid|on edge|uneasy)\b/i,
    /चिंता|घबराहट|बेचैनी/, // Hindi (native)
    /\b(chinta|ghabrahat|bechaini|pareshan)\b/i, // Hindi (romanized)
    /பதற்ற|கவலை|பயம்|பயமா|பயத்/, // Tamil (native) — பதற்ற is a safe stem; பயம் (fear) is too short to stem (collides with பயன்/பயணம்), so its inflected/colloquial forms are spelled out instead
    /\b(pathatra|kavalai|bayam|payam)\b/i, // Tamil (romanized)
    /ఆందోళన|కంగారు|భయం/, // Telugu (native)
    /\b(andolana|kangaru|kangaaru|bhayam)\b/i, // Telugu (romanized)
  ],
  tired: [
    /\b(tired|exhausted|drained|worn out|sleepy|fatigued|burnt out|burned out|no energy)\b/i,
    /थका|थकान|सुस्त/, // Hindi (native)
    /\b(thaka|thake|thaki|thakan|susth)\b/i, // Hindi (romanized)
    /சோர்வு|களைப்பு/, // Tamil (native)
    /\b(sorvu|kalaippu)\b/i, // Tamil (romanized)
    /అలసట|నీరసం/, // Telugu (native)
    /\b(alasata|nirasam)\b/i, // Telugu (romanized)
  ],
  excited: [
    /\b(excited|thrilled|can'?t wait|pumped|stoked|hyped)\b/i,
    /उत्साहित|उत्साह/, // Hindi (native)
    /\b(utsahit|utsah)\b/i, // Hindi (romanized)
    /உற்சாக|ஆர்வ/, // Tamil (native) — stems (உற்சாகம்/ஆர்வம் mutate under case suffixes)
    /\b(urchagam|urchaham|aarvam)\b/i, // Tamil (romanized)
    /ఉత్సాహం|ఉత్సాహంగా/, // Telugu (native)
    /\b(utsaham|utsahamga)\b/i, // Telugu (romanized)
  ],
  happy: [
    /\b(happy|glad|joyful|grateful|relieved|content|great|wonderful|awesome|feeling (?:good|better)|much better)\b/i,
    /खुश|खुशी|आनंद/, // Hindi (native)
    /\b(khush|khushi|anand)\b/i, // Hindi (romanized)
    /மகிழ்ச்சி|சந்தோஷ/, // Tamil (native) — சந்தோஷம் stem (மகிழ்ச்சி doesn't have this issue)
    /\b(magizhchi|santhosham|santhosam)\b/i, // Tamil (romanized)
    /సంతోషం|ఆనందం/, // Telugu (native)
    /\b(santosham|anandam)\b/i, // Telugu (romanized)
  ],
  neutral: [
    /\b(calm|relaxed|okay|alright|fine|peaceful)\b/i,
    /शांत/, // Hindi (native)
    /\b(shant|shaant)\b/i, // Hindi (romanized)
    /அமைதி/, // Tamil (native)
    /\b(amaidhi)\b/i, // Tamil (romanized)
    /ప్రశాంతం/, // Telugu (native)
    /\b(prashantam)\b/i, // Telugu (romanized)
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
