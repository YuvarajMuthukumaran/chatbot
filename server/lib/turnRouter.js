// Everything that must be decided in plain code before a message is allowed
// anywhere near the LLM, in priority order:
//   1. crisis detection (always first, unconditionally)
//   2. leaving a stuck form-fill flow ("never mind", or an emotional message)
//   3. the deterministic patient-record (HMS) and booking flows
// Kept separate from the HTTP/SSE plumbing in routes/chat.js so the whole
// pipeline can be exercised directly in tests.
import { detectCrisis } from "./crisisDetection.js";
import { buildCrisisReply } from "./crisisTemplate.js";
import { classifyEscape } from "./conversationEscape.js";
import { GREETING_ONLY } from "./conversationCues.js";
import { detectHmsIntent } from "./hmsIntent.js";
import { detectBookingIntent } from "./bookingIntent.js";
import { handleHmsTurn, abandonHmsCollection } from "./hmsFlow.js";
import { handleBookingTurn, abandonBookingFlow } from "./bookingFlow.js";
import { handleAdmissionGuideTurn } from "./admissionGuide.js";
import { handleAssessmentTurn, abandonAssessment, assessmentActive, answersCurrentQuestion } from "./assessmentFlow.js";

const region = process.env.CRISIS_REGION || "IN";

const STOPPED = {
  book: "No problem — I've stopped there, and nothing was booked.",
  cancel: "No problem — I've stopped there, and your appointment is unchanged.",
  reschedule: "No problem — I've stopped there, and your appointment is unchanged.",
  view: "No problem, I've stopped there.",
  hms: "No problem, I've stopped there.",
  assessment: "No problem, I've stopped the questions.",
};

const WEBSITE_REPLIES = {
  book: "I'd be glad to help you see someone. To keep your details private, appointments are booked on our secure booking form rather than in this chat. Tap **Book Appointment** below; it only takes a minute. If it's urgent, you can also call us.",
  portal: "For your privacy, I can't look up records in this chat. You can sign in to the **patient portal** with your mobile number to see your appointments, or call us and our team will help.",
};

function activeFlow(session) {
  if (assessmentActive(session)) return "assessment";
  if (session.booking?.flow) return session.booking.flow;
  if (session.hms?.collecting) return "hms";
  return null;
}

// What each flow was doing, for a friendly reminder after a mid-step "hi".
const DOING = {
  book: "booking your appointment",
  cancel: "cancelling your appointment",
  reschedule: "moving your appointment",
  view: "finding your appointments",
  hms: "looking up your records",
  assessment: "the quick check-in questions",
};
// Short filler that isn't an answer to anything: "lol", "hmm", "ok?", "what".
const SMALL_TALK = /^\s*(?:lol+|lmao|haha+|hmm+|hm+|huh|what\??|wait|oh+|ah+|hello\?+|u there\??|you there\??)\s*[!?.]*\s*$/i;

function abandonFlows(session) {
  abandonBookingFlow(session);
  abandonHmsCollection(session);
  abandonAssessment(session);
  session.lastFlowPrompt = null;
}

/**
 * @param {object} session - the chat session (from sessionStore.js)
 * @param {string} message
 * @param {{ip?: string}} [ctx]
 * @returns {Promise<{handled: false} | {handled: true, reply: string, crisis?: boolean, functional?: boolean, quickReplies?: string[], llmNote?: string}>}
 *   `functional` marks a booking/records exchange: transactional rather than
 *   emotional, and (since it can hold names, numbers, or medical records)
 *   stored as private history the LLM never sees.
 */
export async function handleDeterministicTurn(session, message, ctx = {}) {
  // Hard rule: crisis detection runs deterministically, before and
  // independent of any model call. It is never left to the model alone.
  // It also ends any half-finished form, so the next message is answered as
  // conversation rather than taken as, say, a phone number.
  const crisisLang = detectCrisis(message);
  if (crisisLang) {
    abandonFlows(session);
    return { handled: true, crisis: true, reply: buildCrisisReply(region, crisisLang, message) };
  }

  // Safety net: a mid-flow session captures every message it receives,
  // including ones that have nothing to do with it. Genuine distress hands
  // the message to the conversation; an explicit "never mind" gets a plain
  // acknowledgement — a stuck form-fill state must never swallow an
  // emotional disclosure in a mental-health companion.
  const flow = activeFlow(session);
  // A screening answer is an answer even when it reads like a feeling
  // ("When I'm stressed or anxious").
  if (flow && !(flow === "assessment" && answersCurrentQuestion(session, message))) {
    const escape = classifyEscape(message, { flow });
    if (escape === "emotional") {
      abandonFlows(session);
      return { handled: false };
    }
    if (escape === "cancel") {
      abandonFlows(session);
      return {
        handled: true,
        functional: true,
        reply: `${STOPPED[flow] || STOPPED.view} I'm here if there's anything else on your mind.`,
      };
    }
    // "yo", "hi" mid-step: not an answer, so don't reply "I didn't catch
    // that". Say hello, remind them where they were, keep the same buttons.
    if (GREETING_ONLY.test(message) || SMALL_TALK.test(message)) {
      return {
        handled: true,
        functional: true,
        reply: `Hey! 👋 We were in the middle of ${DOING[flow] || "something"}. Pick up where we left off, or say **never mind** to stop.`,
        quickReplies: session.lastFlowPrompt?.quickReplies,
      };
    }
    // Switching between the two systems mid-flow ("actually, book an
    // appointment" while verifying for records, or vice versa).
    if (flow === "hms" && detectBookingIntent(message)) abandonHmsCollection(session);
    if (flow !== "hms" && flow !== "assessment" && detectHmsIntent(message)) abandonBookingFlow(session);
    // Asking to book or for records partway through a screening ends it.
    if (flow === "assessment" && (detectBookingIntent(message) || detectHmsIntent(message))) abandonAssessment(session);
  }

  // Website widget: no names, phone numbers or records are collected in chat.
  // Booking goes to the secure booking form and records to the patient portal.
  if (session.channel === "website") {
    if (detectHmsIntent(message)) {
      return { handled: true, functional: true, action: "portal", reply: WEBSITE_REPLIES.portal };
    }
    if (detectBookingIntent(message)) {
      return { handled: true, functional: true, action: "book", reply: WEBSITE_REPLIES.book };
    }
  }

  // Patient self-service (admission/discharge status, prescriptions, patient
  // lookup): fully deterministic, like crisis detection above, so the model
  // never sees or rephrases real medical data.
  // In-chat screenings ("I think I have OCD", "I feel dizzy"). Not on the
  // website widget, which mustn't collect medical history in chat.
  if (session.channel !== "website") {
    const assessmentResult = await handleAssessmentTurn(session, message);
    if (assessmentResult.handled) return guardAgainstLoops(session, { ...assessmentResult, functional: true });
  }

  // Admission enquiry chips ("A doctor advised admission", …).
  if (session.channel !== "website") {
    const admissionResult = handleAdmissionGuideTurn(session, message);
    if (admissionResult.handled) return guardAgainstLoops(session, admissionResult);
  }

  const hmsResult = await handleHmsTurn(session, message, ctx);
  if (hmsResult.handled) return guardAgainstLoops(session, { ...hmsResult, functional: true });

  // Appointment booking (search doctors, book/view/cancel/reschedule): a
  // separate, newer system from the HMS flow above — this one manages
  // Tulasi's own booking calendar (MongoDB), not the hospital's real HMS
  // records. Same "fully deterministic, bypasses the LLM" design.
  const bookingResult = await handleBookingTurn(session, message, ctx);
  if (bookingResult.handled) return guardAgainstLoops(session, { ...bookingResult, functional: true });

  session.lastFlowPrompt = null;
  return { handled: false };
}

// A form that keeps re-asking the same question ("I didn't catch that —
// please reply with a number…") to someone who's answering something else
// is a trap. The third identical prompt in a row stops the flow and says how
// to get help instead.
const MAX_SAME_PROMPT = 3;
const STUCK_REPLY =
  "I don't think I'm understanding you, sorry. I've stopped there so you're not stuck going round in circles, and nothing was changed. You can start again any time (just say \"book an appointment\"), or call Tulasi Health Care on 8800000255 and the team will help.";

function guardAgainstLoops(session, result) {
  if (!activeFlow(session)) {
    session.lastFlowPrompt = null;
    return result;
  }
  const last = session.lastFlowPrompt;
  const count = last?.text === result.reply ? last.count + 1 : 1;
  if (count < MAX_SAME_PROMPT) {
    session.lastFlowPrompt = { text: result.reply, count, quickReplies: result.quickReplies };
    return result;
  }
  session.lastFlowPrompt = null;
  abandonFlows(session);
  return { handled: true, functional: true, reply: STUCK_REPLY };
}
