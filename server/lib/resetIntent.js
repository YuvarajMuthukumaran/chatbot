// "reset chat" / "new chat" typed by the person: they want a clean slate.
// Deliberately narrow — it must name the chat or conversation (or be a bare
// "reset" / "start over"), so "reset my password" or "I want to start over
// with my life" are never mistaken for it.
const LEAD = String.raw`^\s*(?:(?:ok(?:ay)?|hey|hi|so|please|pls|can you|could you|can we|let'?s|i want to|i'?d like to|i wanna)[,.!]?\s+)*`;
const TAIL = String.raw`\s*(?:please|pls|now|again)?\s*[.!]*\s*$`;

const RESET_INTENT = new RegExp(
  LEAD +
    String.raw`(?:` +
    // reset / restart / clear / refresh (the|this|my) chat|conversation
    String.raw`(?:reset|restart|clear|refresh|wipe|delete)\s+(?:the\s+|this\s+|my\s+|our\s+)?(?:chat|conversation)(?:\s+history)?` +
    // start / open / begin / begin a (new|fresh) chat|conversation
    String.raw`|(?:start|open|begin|create)\s+(?:a\s+|an\s+)?(?:new|fresh)\s+(?:chat|conversation)` +
    // new chat / fresh chat / new conversation
    String.raw`|(?:new|fresh)\s+(?:chat|conversation)` +
    // start over / start again / bare reset
    String.raw`|start\s+(?:over|again|afresh)|reset|restart` +
    String.raw`)` +
    TAIL,
  "i"
);

/** @param {string} text @returns {boolean} true if the message is a request to reset the chat. */
export function detectResetIntent(text) {
  return typeof text === "string" && text.length <= 80 && RESET_INTENT.test(text);
}
