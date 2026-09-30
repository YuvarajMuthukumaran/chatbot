// Safety net for the deterministic multi-turn flows (HMS, booking): once a
// session is mid-flow (e.g. "awaiting_search"), every message it sends gets
// captured by that flow's handler — including messages that have nothing to
// do with it. Without this, someone whose doctor search didn't resolve
// could say "I feel very sad today" and get "I couldn't find a matching
// doctor" back instead of an actual supportive reply, which is a real harm
// in a mental-health companion, not just a UX rough edge. Crisis language is
// already safe (crisis detection runs before either flow, unconditionally) —
// this covers ordinary emotional/conversational messages that aren't
// crisis-level but also clearly aren't an attempt to answer the flow's
// current question.

// Checked first: an emotional disclosure always wins, even if it happens to
// contain a word like "stop" ("I can't stop crying").
const EMOTION_LANGUAGE = [
  /\bi feel\b|\bi'?m feeling\b|\bi am feeling\b|\bi'?m (so |really |very )?(sad|anxious|depressed|angry|upset|scared|afraid|lonely|hopeless|overwhelmed|stressed|exhausted|tired|worried)\b|\bhaving a (hard|tough|rough) time\b|\bstruggling\b|\bcan'?t (cope|handle|take) (this|it)\b|\bcan'?t stop (crying|thinking|worrying|shaking|panicking|overthinking)\b|\bpanic attack\b/i,
  // Hindi / Tamil / Telugu, native script and romanized — the sad/anxious/
  // angry cues from the client's mood detection (never the positive ones:
  // "Anand" is a name as often as it's a feeling).
  /उदास|दुखी|अकेला|अकेली|घबराहट|बेचैनी|चिंता|गुस्सा|சோக|துக்க|தனிமை|பதற்ற|கவலை|கோப|బాధగా|దుఃఖం|ఒంటరిగా|ఆందోళన|కంగారు|కోపం/,
  /\b(udaas|udas|dukhi|akela|akeli|pareshan|ghabrahat|bechaini|chinta|gussa|sogam|thukkam|thanimai|kavalai|kobam|badhaga|dukham|ontariga|andolana|kangaru|kopam)\b/i,
];

// An explicit "stop this", recognized only at the start of the message, so an
// answer that merely contains "stop" or "cancel" somewhere isn't mistaken
// for walking away from the flow.
const CANCEL_PHRASES =
  /^\s*(?:no,?\s+)?(?:please\s+)?(?:cancel|stop|quit|exit|never\s*mind|nevermind|nvm|forget\s+(?:it|about\s+it)|not\s+now|leave\s+it|skip\s+it|no\s+thanks?|i\s+changed\s+my\s+mind|i\s+don'?t\s+want\s+to\s+(?:continue|do\s+this))\b/i;

// Inside the cancellation flow itself, "cancel" is the answer, not an exit:
// "yes, cancel it" at "Cancel this appointment? (yes/no)" must go through.
const CANCEL_AS_ANSWER = /^\s*(?:no,?\s+)?(?:please\s+)?cancel\b/i;

/**
 * @param {string} text
 * @param {{flow?: string}} [context] - the flow currently collecting input
 *   ("book", "view", "cancel", "reschedule", or "hms")
 * @returns {"emotional" | "cancel" | null} "emotional" hands the message to
 *   the conversation (LLM) instead; "cancel" stops the flow with a plain
 *   acknowledgement; null means it's probably an answer to the flow.
 */
export function classifyEscape(text, { flow } = {}) {
  if (!text) return null;
  if (EMOTION_LANGUAGE.some((p) => p.test(text))) return "emotional";
  if (CANCEL_PHRASES.test(text)) {
    if (flow === "cancel" && CANCEL_AS_ANSWER.test(text)) return null;
    return "cancel";
  }
  return null;
}

/**
 * @param {string} text
 * @param {{flow?: string}} [context]
 * @returns {boolean} true if the message looks like it's abandoning the
 * current data-collection step rather than answering it.
 */
export function looksLikeAbandonment(text, context) {
  return classifyEscape(text, context) !== null;
}
