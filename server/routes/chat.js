import { Router } from "express";
import { getSession, appendTurn } from "../lib/sessionStore.js";
import { streamReply } from "../lib/llmClient.js";
import {
  matchSpecialties,
  getDoctorsForSpecialties,
  getGeneralistDoctor,
  buildDoctorContextNote,
  doctorHelpReason,
} from "../lib/doctors.js";
import { handleDeterministicTurn } from "../lib/turnRouter.js";
import { greetingFollowUpNote, romanScriptNote, offScopeNote, selfDiagnosisNote } from "../lib/conversationCues.js";
import { findClinicTopics, buildClinicFactsNote } from "../lib/clinicKnowledge.js";
import { findMedicineCards } from "../lib/toolLinks.js";
import { detectAssessmentOffer, OFFER_LABELS } from "../lib/assessments.js";
import { limiters, limitByIp } from "../lib/rateLimit.js";

const router = Router();

// Long enough for anyone pouring their heart out; short enough that one
// request can't be used to stuff thousands of tokens into the model.
export const MAX_MESSAGE_CHARS = 2000;

const RECENT_BOOKING_MS = 30 * 60 * 1000;

// Exchanges between doctor suggestions prompted by distress alone.
const CONCERN_CARD_GAP = 4;

// Extra rules when the chat runs inside the public website widget.
const WEBSITE_NOTE = [
  "You are running in the chat widget on www.tulasihealthcare.com.",
  "Never ask for, or repeat back, the person's name, phone number, age, address, or medical history. If they share them, don't store or restate them.",
  "For appointments, tell them to use the Book Appointment button (the booking form at /book-appointment/). Don't try to book in chat.",
  "Never diagnose, and never suggest or comment on medicines, doses, or stopping medication: say a psychiatrist should advise on that.",
  "Only state facts about Tulasi Healthcare's doctors, services and locations that you have been given; if you don't know, say so and offer the phone number +91 8800000255.",
].join(" ");

// One in-flight model request per session: if a new message arrives before
// the previous reply finished streaming, abort the stale one instead of
// paying for two concurrent generations.
const activeAborts = new Map();

// Server-Sent Events stream: each chunk is `data: {"text": "..."}\n\n`,
// terminated by `data: [DONE]\n\n`.
router.post("/chat", limitByIp(limiters.chat), async (req, res) => {
  const { sessionId, message } = req.body || {};

  if (typeof sessionId !== "string" || !sessionId || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "sessionId and message are required" });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(413).json({
      error: `That message is a little too long for me — could you keep it under ${MAX_MESSAGE_CHARS} characters, or split it into a few messages?`,
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Unknown session. Start a new one." });
  }

  activeAborts.get(sessionId)?.abort();
  const controller = new AbortController();
  activeAborts.set(sessionId, controller);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // `res.on("close")`, not `req.on("close")` — the request stream closes
  // as soon as its body has been read (i.e. almost immediately), which
  // would abort every request before streamReply even starts. The
  // response only closes when the underlying connection actually ends.
  let closed = false;
  res.on("close", () => {
    closed = true;
    controller.abort();
  });

  const send = (payload) => {
    if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const finish = () => {
    if (activeAborts.get(sessionId) === controller) activeAborts.delete(sessionId);
    if (!closed) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  };

  try {
    // Crisis detection, stuck-flow escapes, and the HMS/booking flows —
    // everything decided in plain code before any model call.
    const det = await handleDeterministicTurn(session, message, { ip: req.ip });
    if (det.handled) {
      // Booking/records turns can hold names, numbers, and medical data, so
      // they're stored private: kept for the session, never replayed to the
      // model (it gets at most the flow's PII-free llmNote instead).
      const privacy = det.functional ? { private: true } : {};
      appendTurn(sessionId, "user", message, privacy);
      appendTurn(sessionId, "model", det.reply, { ...privacy, llmNote: det.llmNote });
      send({
        text: det.reply,
        ...(det.crisis && { crisis: true }),
        // `functional: true` tells the client this was a transactional
        // exchange, not part of the emotional conversation — it should reset
        // the mascot's mood rather than let a mood from several turns ago
        // resurface once doctor-mode (or this) turns off.
        ...(det.functional && { functional: true }),
        // Verified patient records: shown now, but not saved on the device.
        ...(det.sensitive && { sensitive: true }),
        ...(det.quickReplies?.length && { quickReplies: det.quickReplies }),
        // Website widget: which secure page to offer ("book" | "portal").
        ...(det.action && { action: det.action }),
        // In-chat screening: question progress, and the result card.
        ...(det.progress && { progress: det.progress }),
        ...(det.assessment && { assessment: det.assessment }),
      });
      if (det.doctors?.length) send({ doctors: det.doctors.map((d) => ({ name: d.name, role: d.role, photo: d.photo || null })) });
      return finish();
    }

    // Best-effort doctor recommendation, gated on doctorHelpReason: merely
    // naming a feeling ("I feel anxious") or having one bad day ("I had a
    // really hard day") shouldn't trigger a referral; only an explicit ask or
    // sustained distress should. Which specialty it matches is looked up
    // across the person's recent messages too — someone saying "I don't know
    // what to do anymore" without repeating "anxiety" should still surface an
    // anxiety specialist if that's what they named a couple turns earlier.
    // (Only their own words count: the bot's replies mention conditions too,
    // and private booking turns are full of doctor names.) An explicit ask is
    // never deduped: if someone asks again later ("best doctor for ocd"),
    // suppressing it read as broken. Distress alone is different: suggesting
    // a doctor on every hard message turns a conversation into a referral
    // loop, so after one such suggestion it waits a few exchanges.
    const recentUserTexts = session.history
      .slice(-8)
      .filter((turn) => turn.role === "user" && !turn.private)
      .map((turn) => turn.text);
    const recentContext = recentUserTexts.join(" ");
    // Counted here rather than from history.length, which stops growing once
    // the stored history hits its cap.
    session.conversationTurns = (session.conversationTurns || 0) + 1;
    const helpReason = doctorHelpReason(message, recentUserTexts);
    const concernCooldown =
      helpReason === "concern" &&
      session.lastConcernCardsAt != null &&
      session.conversationTurns - session.lastConcernCardsAt < CONCERN_CARD_GAP;
    const wantsHelp = helpReason !== null && !concernCooldown;
    const matchedTags = wantsHelp ? matchSpecialties(`${recentContext} ${message}`) : [];
    let matchedDoctors = getDoctorsForSpecialties(matchedTags, 2);
    // Someone is clearly asking for help, but the concern named (e.g.
    // "aggression") doesn't map to any tagged specialty — fall back to the
    // generalist rather than surfacing no one at all. Not right after they've
    // booked, though: "I'm nervous about seeing a psychiatrist" then isn't a
    // request for another doctor, and a fresh card just reads as noise.
    const justBooked = Date.now() - (session.lastBookedAt || 0) < RECENT_BOOKING_MS;
    if (wantsHelp && !matchedDoctors.length && !justBooked) {
      matchedDoctors = getGeneralistDoctor();
    }
    const doctorNote = matchedDoctors.length ? buildDoctorContextNote(matchedDoctors) : undefined;
    // Practical questions (fees, rooms, location, admission, ambulance) get
    // the front desk's verified answers. Without them, the model would either
    // refuse or guess a price.
    const previousUserText = [...session.history].reverse().find((turn) => turn.role === "user" && !turn.private)?.text;
    const clinicNote = buildClinicFactsNote(findClinicTopics(message, previousUserText));
    // Medicine cards. Not on the website widget, which has no guide pages.
    const tools = session.channel === "website" ? { medicines: [] } : findMedicineCards(message);
    // Wondering about a condition ("I don't know if it's depression"): a
    // button under the reply starts the screening.
    const offer = session.channel === "website" ? null : detectAssessmentOffer(message);
    const offerNote = offer
      ? `A button labelled "${OFFER_LABELS[offer]}" is shown under your reply; tapping it starts a short screening in this chat. You can mention it in a few words. Never ask them to type a special phrase, and never say you can't run it.`
      : null;
    const extraContext =
      [session.channel === "website" ? WEBSITE_NOTE : null, clinicNote, doctorNote, tools.note, offerNote].filter(Boolean).join("\n\n") || undefined;

    const result = await streamReply({
      history: session.history,
      message,
      onChunk: (text) => send({ text }),
      abortSignal: controller.signal,
      extraContext,
      // "sup" mid-conversation: keep the thread instead of starting over.
      // Hinglish in, Hinglish (not Devanagari) out.
      // Code/homework requests get a reminder to decline; "do I have
      // bipolar?" a reminder not to invent a quiz.
      turnNote:
        [greetingFollowUpNote(session.history, message), romanScriptNote(message), offScopeNote(message), selfDiagnosisNote(message)]
          .filter(Boolean)
          .join("\n\n") || undefined,
    });

    if (result.aborted) {
      // Superseded by a newer message in this session, or the client
      // disconnected — nothing to send back, and nothing was persisted.
      return finish();
    }

    if (!result.ok) {
      // Fallback message was already generated (429 or otherwise). Deliberately
      // don't persist this turn: leaving an unanswered user message in history
      // would break the required user/model alternation on retry.
      send({ text: result.text, error: true, rateLimited: !!result.rateLimited });
      return finish();
    }

    appendTurn(sessionId, "user", message);
    appendTurn(sessionId, "model", result.text);
    if (matchedDoctors.length) {
      // Remembered so a later vague reference ("book with either of them")
      // can resolve against whoever was actually just shown, instead of
      // requiring a name the booking flow has no way to already know.
      session.lastRecommendedDoctors = matchedDoctors;
      if (helpReason === "concern") session.lastConcernCardsAt = session.conversationTurns;
      send({ doctors: matchedDoctors.map((d) => ({ name: d.name, role: d.role, photo: d.photo || null })) });
    }
    if (tools.medicines.length) send({ medicines: tools.medicines });
    if (offer) {
      session.offeredAssessment = offer;
      send({ quickReplies: [OFFER_LABELS[offer]] });
    }
    finish();
  } catch (err) {
    // Headers are already sent, so the error middleware can't answer this
    // one — report it on the stream instead (and don't persist the turn,
    // so a retry starts clean).
    console.error("Chat turn failed:", err);
    send({ text: "Sorry — something went wrong on my side. Please try that again.", error: true });
    finish();
  }
});

export default router;
