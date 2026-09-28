// Safety net for the deterministic multi-turn flows (HMS, booking): once a
// session is mid-flow (e.g. "awaiting_search"), every message it sends gets
// captured by that flow's handler — including messages that have nothing to
// do with it. Without this, someone whose doctor search didn't resolve
// could say "I feel very sad today" and get "I couldn't find a matching
// doctor" back instead of an actual supportive reply, which is a real harm
// in a mental-health companion, not just a UX rough edge. Crisis language is
// already safe (crisis detection runs before either flow, unconditionally,
// in chat.js) — this covers ordinary emotional/conversational messages that
// aren't crisis-level but also clearly aren't an attempt to answer the
// flow's current question.
const EXPLICIT_CANCEL = /\b(cancel|never\s*mind|nevermind|forget it|stop|not now|nvm)\b/i;

const EMOTION_LANGUAGE =
  /\bi feel\b|\bi'?m feeling\b|\bi am feeling\b|\bi'?m (so |really |very )?(sad|anxious|depressed|angry|upset|scared|afraid|lonely|hopeless|overwhelmed|stressed|exhausted|tired|worried)\b|\bhaving a (hard|tough|rough) time\b|\bstruggling\b|\bcan'?t (cope|handle|take) (this|it)\b/i;

/**
 * @param {string} text
 * @returns {boolean} true if the message looks like it's abandoning the
 * current data-collection step rather than answering it.
 */
export function looksLikeAbandonment(text) {
  if (!text) return false;
  return EXPLICIT_CANCEL.test(text) || EMOTION_LANGUAGE.test(text);
}
