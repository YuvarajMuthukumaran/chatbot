import { Router } from "express";
import { getSession, appendTurn } from "../lib/sessionStore.js";
import { streamReply } from "../lib/llmClient.js";
import {
  matchSpecialties,
  getDoctorsForSpecialties,
  getGeneralistDoctor,
  buildDoctorContextNote,
  wantsDoctorHelp,
} from "../lib/doctors.js";
import { handleDeterministicTurn } from "../lib/turnRouter.js";
import { greetingFollowUpNote } from "../lib/conversationCues.js";
import { limiters, limitByIp } from "../lib/rateLimit.js";

const router = Router();

// Long enough for anyone pouring their heart out; short enough that one
// request can't be used to stuff thousands of tokens into the model.
export const MAX_MESSAGE_CHARS = 2000;

const RECENT_BOOKING_MS = 30 * 60 * 1000;

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
      });
      return finish();
    }

    // Best-effort doctor recommendation — gated on wantsDoctorHelp: merely
    // naming a feeling ("I feel anxious") shouldn't trigger a referral; only
    // explicit help-seeking or real distress/severity should. That gate looks
    // at the current message only (the concern has to be happening now), but
    // which specialty it matches is looked up across the person's recent
    // messages too — someone saying "I don't know what to do anymore" without
    // repeating "anxiety" should still surface an anxiety specialist if
    // that's what they named a couple turns earlier. (Only their own words
    // count: the bot's replies mention conditions too, and private booking
    // turns are full of doctor names.) Deliberately NOT deduped by specialty
    // across the session: if someone explicitly asks again later ("best
    // doctor for ocd"), they get the cards again too — suppressing a repeat
    // ask read as broken, not considerate.
    const recentContext = session.history
      .slice(-8)
      .filter((turn) => turn.role === "user" && !turn.private)
      .map((turn) => turn.text)
      .join(" ");
    const wantsHelp = wantsDoctorHelp(message);
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
    const extraContext = matchedDoctors.length ? buildDoctorContextNote(matchedDoctors) : undefined;

    const result = await streamReply({
      history: session.history,
      message,
      onChunk: (text) => send({ text }),
      abortSignal: controller.signal,
      extraContext,
      // "sup" mid-conversation: keep the thread instead of starting over.
      turnNote: greetingFollowUpNote(session.history, message),
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
      send({ doctors: matchedDoctors.map((d) => ({ name: d.name, role: d.role, photo: d.photo || null })) });
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
