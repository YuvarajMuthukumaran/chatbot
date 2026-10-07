// Small, deterministic nudges for the model about the message in front of it.
import { ASKING, normalizeForIntent } from "./assessments.js";

// Just a greeting, nothing else: "sup", "hey there", "hiii", "what's up?",
// "namaste" — in any case, with or without punctuation.
const GREETING_ONLY =
  /^\s*(?:hi+|hey+|hello+|hel+o+|yo+|sup+|wa+s+u+p+|what'?s\s*up|whats\s*up|heya|hiya|namaste|vanakkam|namaskaram)(?:\s+(?:there|again|tulasi))?\s*[!.?]*\s*$/i;

// Everyday words that mark a message as Hindi, Tamil, or Telugu typed in
// Roman letters ("mere bhai ko admit karna hai"). None is a common English
// word, so an English message won't trip it.
const ROMANIZED_INDIC =
  /\b(?:hai|hain|kya|kyu|kyun|nahi|nahin|mera|mere|meri|mujhe|humko|hume|kitna|kitne|kaise|kaisa|karna|karu|karun|lagega|chahiye|bhai|behen|papa|aap|aapka|tum|ko|ka|ki|ke|enna|ennachu|epdi|eppadi|irukku|naan|enaku|enakku|romba|evvalavu|evlo|eppo|ela|enti|enta|entha|ekkada|nenu|naaku|naku|undi|untundi|unnaru|ledu|cheppu|cheppandi|chala|kavali)\b/i;
const NATIVE_INDIC_SCRIPT = /[ऀ-ॿ஀-௿ఀ-౿]/;

/**
 * Models tend to answer Hinglish in Devanagari, which many people who type
 * in Roman letters read slowly or not at all. When the message is a regional
 * language in Roman letters, this returns a note asking for Roman letters
 * back; otherwise null.
 * @param {string} message
 */
export function romanScriptNote(message) {
  if (NATIVE_INDIC_SCRIPT.test(message)) return null;
  const words = message.match(/\b[a-z]+\b/gi) || [];
  const hits = words.filter((w) => ROMANIZED_INDIC.test(w)).length;
  // Two marker words, so one stray "ka" or "papa" in English doesn't count.
  if (hits < 2) return null;
  return "The person is writing Hindi, Tamil, or Telugu in Roman (English) letters. Reply in that same language, also in Roman letters (Hinglish, Tanglish, or Tenglish), not in English and not in Devanagari, Tamil, or Telugu script.";
}

// "write me a python script", "do my homework", "solve this equation".
// The smaller fallback models sometimes just comply with these despite the
// system prompt, so the reminder goes right next to the message.
// Anchored to a direct request ("can you write…", "write me…"), so venting
// about it ("I can't do my homework, I'm so stressed") never matches.
const OFF_SCOPE_REQUEST =
  /^\s*(?:hey,?\s+|hi,?\s+)?(?:(?:can|could|will|would) you\s+|please\s+|pls\s+)?(?:write|create|generate|give me|make|fix|debug|solve|do)\b[^.?!]{0,40}\b(?:code|script|program|function|app|website|essay|homework|assignment|equation|sql query|regex)\b/i;

/**
 * A reminder to decline, when the message asks for code, homework, and the
 * like; otherwise null.
 * @param {string} message
 */
export function offScopeNote(message) {
  if (!OFF_SCOPE_REQUEST.test(message)) return null;
  return "This message looks like a request for something outside your scope (code, homework, or similar). Follow the hard scope rule: don't do it, decline warmly in one sentence, and offer what you can help with instead. If they're really venting about the task, respond to that feeling instead.";
}

// "Do I have bipolar?" for a condition with no in-chat screening. Left alone,
// the model tends to invent its own checklist ("answer yes or no to each…"),
// which is unvalidated and unscored. (OCD, depression, anxiety, ADHD, PTSD,
// alcohol and dizziness never reach the model: assessmentFlow.js runs a real
// screening for those first.)
const UNSCREENED_CONDITIONS = String.raw`(?:bipolar|bipoler|manic|mania|schizophreni\w*|skitzo\w*|psychosis|psychotic|eating disorder|anorexi\w*|bulimi\w*|binge eating|insomnia|autis\w*|asperger\w*|personality disorder|bpd|borderline|npd|narcissis\w*|panic disorder|panic attacks?|social anxiety|phobi\w*|dementia|alzheimer\w*|dyslexi\w*|tourette\w*|hoarding|body dysmorphi\w*|dissociati\w*|mental illness|a mental (?:disorder|problem))`;
// Same ways of asking as the screenings use, matched on typo-fixed text.
const SELF_DIAGNOSIS_QUESTION = new RegExp(String.raw`\b${ASKING}\b[^.?!]{0,30}\b${UNSCREENED_CONDITIONS}\b`, "i");

/**
 * A reminder not to improvise a questionnaire, when someone asks whether
 * they have a condition the chat has no screening for; otherwise null.
 * @param {string} message
 */
export function selfDiagnosisNote(message) {
  if (!SELF_DIAGNOSIS_QUESTION.test(normalizeForIntent(message))) return null;
  return (
    "The person is asking whether they have a condition that has no screening in this chat. Do NOT make up a questionnaire or checklist, ask a list of symptom questions, or suggest what they might have. " +
    "Respond warmly and briefly to what they've noticed, say that only a psychiatrist or psychologist can properly assess it, and offer a Tulasi specialist if it fits. No need to ask them anything."
  );
}

// Breathing/grounding exercises and "a specialist could help" in reply after
// reply read as scripted and pushy. The prompt says so, but smaller fallback
// models drift back to it, so recent replies are checked here.
const TECHNIQUE = /\b(?:breath(?:e|es|ing|s)?|stretch(?:es|ing)?|jot (?:down|it)|inhale|exhale|grounding|box breathing|\d (?:things|counts?) you can|notice (?:three|five|\d) things|close your eyes|journal(?:ing)?|try (?:this|a quick))\b/i;
const REFERRAL = /\b(?:specialists?|psychiatrists?|psychologists?|therapists?|counsell?ors?|book (?:an )?appointment|professionals?|professional help)\b/i;

/**
 * Reminders not to repeat a technique (offered in the last reply) or a
 * specialist mention (in the last three); otherwise null.
 * @param {Array<{role: string, text: string, private?: boolean}>} history
 */
export function repetitionNote(history) {
  const replies = history.filter((t) => t.role === "model" && !t.private).slice(-3);
  if (!replies.length) return null;
  const notes = [];
  if (TECHNIQUE.test(replies[replies.length - 1].text)) {
    notes.push("Your last reply already offered an exercise or technique. Don't offer any technique, breathing or grounding exercise in this reply. Just respond to what they said.");
  }
  if (replies.some((t) => REFERRAL.test(t.text))) {
    notes.push("You've recently mentioned a specialist or professional help. Don't mention specialists, doctors, booking or professional help in this reply unless they ask.");
  }
  return notes.length ? notes.join(" ") : null;
}

// Frustration aimed at the bot: "aap pagal ho kya", "you're useless", "wtf".
// Left alone, the model answers with a fresh "How can I support you?" as if
// the conversation had restarted.
const FRUSTRATED_AT_BOT =
  /\b(?:(?:you|u|ur|you'?re|aap|tum|tu)\b[^.?!]{0,20}\b(?:pagal|stupid|dumb|useless|idiot|mad|crazy|bekaar|bekar|faltu|bakwas|not listening|not helping|don'?t understand|no help)|pagal ho|bakwas|bekaar|faltu|wtf|what the (?:hell|fuck)|are you (?:even )?(?:listening|real|serious)|this is (?:useless|pointless|stupid)|not helpful|samajh (?:nahi|nahin|nhi) (?:aata|aa raha)|kuch samajh)\b/i;

/**
 * A note to own the frustration and stay on the thread, when the message is
 * frustration aimed at the bot; otherwise null.
 * @param {Array<{role: string, text: string, private?: boolean}>} history
 * @param {string} message
 */
export function frustrationNote(history, message) {
  if (!FRUSTRATED_AT_BOT.test(message)) return null;
  const lastShared = [...history].reverse().find((t) => t.role === "user" && !t.private && !FRUSTRATED_AT_BOT.test(t.text));
  return (
    "The person sounds frustrated or annoyed with you. Don't change the subject, don't restart with a generic \"how can I help?\", and don't get defensive. " +
    "Reply in 1-2 short sentences: a plain, brief sorry (or a light, good-humoured line), then carry on with that same topic, adding something useful. Don't introduce yourself, don't ask how they feel, and don't end with a question." +
    (lastShared ? ` They were last talking about: "${lastShared.text.slice(0, 300)}"` : "")
  );
}

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
