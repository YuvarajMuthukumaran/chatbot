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
import { detectHmsIntent } from "./hmsIntent.js";
import { detectBookingIntent } from "./bookingIntent.js";
import { handleHmsTurn, abandonHmsCollection } from "./hmsFlow.js";
import { handleBookingTurn, abandonBookingFlow } from "./bookingFlow.js";

const region = process.env.CRISIS_REGION || "IN";

const STOPPED = {
  book: "No problem — I've stopped there, and nothing was booked.",
  cancel: "No problem — I've stopped there, and your appointment is unchanged.",
  reschedule: "No problem — I've stopped there, and your appointment is unchanged.",
  view: "No problem, I've stopped there.",
  hms: "No problem, I've stopped there.",
};

function activeFlow(session) {
  if (session.booking?.flow) return session.booking.flow;
  if (session.hms?.collecting) return "hms";
  return null;
}

function abandonFlows(session) {
  abandonBookingFlow(session);
  abandonHmsCollection(session);
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
    return { handled: true, crisis: true, reply: buildCrisisReply(region, crisisLang) };
  }

  // Safety net: a mid-flow session captures every message it receives,
  // including ones that have nothing to do with it. Genuine distress hands
  // the message to the conversation; an explicit "never mind" gets a plain
  // acknowledgement — a stuck form-fill state must never swallow an
  // emotional disclosure in a mental-health companion.
  const flow = activeFlow(session);
  if (flow) {
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
    // Switching between the two systems mid-flow ("actually, book an
    // appointment" while verifying for records, or vice versa).
    if (flow === "hms" && detectBookingIntent(message)) abandonHmsCollection(session);
    if (flow !== "hms" && detectHmsIntent(message)) abandonBookingFlow(session);
  }

  // Patient self-service (admission/discharge status, prescriptions, patient
  // lookup): fully deterministic, like crisis detection above, so the model
  // never sees or rephrases real medical data.
  const hmsResult = await handleHmsTurn(session, message, ctx);
  if (hmsResult.handled) return { ...hmsResult, functional: true };

  // Appointment booking (search doctors, book/view/cancel/reschedule): a
  // separate, newer system from the HMS flow above — this one manages
  // Tulasi's own booking calendar (MongoDB), not the hospital's real HMS
  // records. Same "fully deterministic, bypasses the LLM" design.
  const bookingResult = await handleBookingTurn(session, message, ctx);
  if (bookingResult.handled) return { ...bookingResult, functional: true };

  return { handled: false };
}
