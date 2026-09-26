import { Router } from "express";
import { getSession, appendTurn, markSpecialtiesSuggested } from "../lib/sessionStore.js";
import { detectCrisis } from "../lib/crisisDetection.js";
import { buildCrisisReply } from "../lib/crisisTemplate.js";
import { streamReply } from "../lib/llmClient.js";
import { matchSpecialties, getDoctorsForSpecialties, buildDoctorContextNote, wantsDoctorHelp } from "../lib/doctors.js";

const router = Router();
const region = process.env.CRISIS_REGION || "IN";

// One in-flight Gemini request per session: if a new message arrives before
// the previous reply finished streaming, abort the stale one instead of
// paying for two concurrent generations.
const activeAborts = new Map();

// Server-Sent Events stream: each chunk is `data: {"text": "..."}\n\n`,
// terminated by `data: [DONE]\n\n`.
router.post("/chat", async (req, res) => {
  const { sessionId, message } = req.body || {};

  if (!sessionId || !message || typeof message !== "string") {
    return res.status(400).json({ error: "sessionId and message are required" });
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

  // Hard rule: crisis detection runs deterministically, before and
  // independent of any model call. It is never left to the model alone.
  if (detectCrisis(message)) {
    const reply = buildCrisisReply(region);
    appendTurn(sessionId, "user", message);
    appendTurn(sessionId, "model", reply);
    send({ text: reply, crisis: true });
    return finish();
  }

  // Best-effort doctor recommendation: only for specialties not already
  // surfaced this session, so it's mentioned once, not every relevant turn.
  // Also gated on wantsDoctorHelp — merely naming a feeling ("I feel
  // anxious") shouldn't trigger a referral; only explicit help-seeking or
  // real distress/severity should. That gate looks at the current message
  // only (the concern has to be happening now), but which specialty it
  // matches is looked up across the recent conversation too — someone
  // saying "I don't know what to do anymore" without repeating "anxiety"
  // should still surface an anxiety specialist if that's what they named
  // a couple turns earlier.
  const recentContext = session.history
    .slice(-8)
    .map((turn) => turn.text)
    .join(" ");
  const matchedTags = wantsDoctorHelp(message)
    ? matchSpecialties(`${recentContext} ${message}`).filter((tag) => !session.suggestedSpecialties.has(tag))
    : [];
  const matchedDoctors = getDoctorsForSpecialties(matchedTags, 2);
  const extraContext = matchedDoctors.length ? buildDoctorContextNote(matchedDoctors) : undefined;

  const result = await streamReply({
    history: session.history,
    message,
    onChunk: (text) => send({ text }),
    abortSignal: controller.signal,
    extraContext,
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
  if (matchedTags.length) markSpecialtiesSuggested(sessionId, matchedTags);
  if (matchedDoctors.length) {
    send({ doctors: matchedDoctors.map((d) => ({ name: d.name, role: d.role, photo: d.photo || null })) });
  }
  finish();
});

export default router;
