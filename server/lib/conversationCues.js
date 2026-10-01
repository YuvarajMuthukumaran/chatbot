// Small, deterministic nudges for the model about the message in front of it.

// Just a greeting, nothing else: "sup", "hey there", "hiii", "what's up?",
// "namaste" — in any case, with or without punctuation.
const GREETING_ONLY =
  /^\s*(?:hi+|hey+|hello+|hel+o+|yo+|sup+|wa+s+u+p+|what'?s\s*up|whats\s*up|heya|hiya|namaste|vanakkam|namaskaram)(?:\s+(?:there|again|tulasi))?\s*[!.?]*\s*$/i;

/**
 * A greeting sent mid-conversation reads to the model like the start of a
 * new chat, and it would reply "Hey there! How's your day going?" as if it
 * had forgotten everything. When that's the situation, this returns a note
 * pointing it back at what the person last said; otherwise null.
 * @param {Array<{role: string, text: string, private?: boolean}>} history
 * @param {string} message
 */
export function greetingFollowUpNote(history, message) {
  if (!GREETING_ONLY.test(message)) return null;
  const lastShared = [...history].reverse().find((t) => t.role === "user" && !t.private && !GREETING_ONLY.test(t.text));
  if (!lastShared) return null;
  return (
    `The person just sent a quick greeting ("${message.trim()}") in the middle of an ongoing conversation — not a new one. ` +
    `Don't greet them as if starting over, and don't ask a generic "how's your day?" or "how are you feeling?". ` +
    `Greet back in a few words and pick the thread up from what they last shared: "${lastShared.text.slice(0, 300)}"`
  );
}
