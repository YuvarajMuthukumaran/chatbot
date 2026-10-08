import { Router, raw } from "express";
import OpenAI, { toFile } from "openai";
import { limiters, limitByIp } from "../lib/rateLimit.js";

// Voice-to-text for the chat's mic button. The recording is sent straight
// to Groq's Whisper and never stored. It uses its own key (GROQ_STT_API_KEY),
// so voice notes never eat into the chat model's limits, or the other way
// round.

const router = Router();

// The full model handles Hindi, Tamil, Telugu and Hinglish best; turbo is the
// fallback when it's busy.
const MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];

// About 60 seconds of compressed speech is well under this.
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

// Steers spelling toward how people here write (Hinglish in Roman letters,
// clinic names) without forcing a language.
const PROMPT = "Tulasi Health Care, Gurugram. Conversation about feelings, stress, anxiety, appointments. Hinglish in Roman letters is common.";

const EXTENSIONS = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a", "audio/aac": "aac" };

let client = null;
function getClient() {
  const apiKey = process.env.GROQ_STT_API_KEY;
  if (!apiKey) return null;
  client ??= new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1", timeout: 30000, maxRetries: 0 });
  return client;
}

// POST /api/transcribe with the recording as the raw body. No session is
// required: the free host restarts when idle and forgets sessions, and the
// mic should still work on the first try. The per-IP limit guards the quota.
router.post(
  "/transcribe",
  limitByIp(limiters.transcribe, "That's a lot of voice notes in a short time. Please wait a minute, or type instead."),
  raw({ type: "audio/*", limit: MAX_AUDIO_BYTES }),
  async (req, res) => {
    const audio = req.body;
    if (!Buffer.isBuffer(audio) || audio.length < 1000) {
      return res.status(400).json({ error: "I couldn't hear anything. Please try again." });
    }
    const groq = getClient();
    if (!groq) return res.status(503).json({ error: "Voice input isn't set up yet. Please type instead." });

    const type = String(req.headers["content-type"] || "audio/webm").split(";")[0];
    const file = await toFile(audio, `voice.${EXTENSIONS[type] || "webm"}`, { type });

    for (const model of MODELS) {
      try {
        const result = await groq.audio.transcriptions.create({ file, model, prompt: PROMPT, response_format: "json", temperature: 0 });
        const text = String(result.text || "").trim();
        return res.json({ text });
      } catch (err) {
        const status = err?.status;
        if ((status === 429 || status >= 500 || !status) && model !== MODELS[MODELS.length - 1]) continue;
        console.error("Transcription failed:", status, err?.message);
        return res
          .status(status === 429 ? 429 : 502)
          .json({ error: status === 429 ? "Voice input is busy right now. Please try again in a minute, or type instead." : "I couldn't make that out. Please try again, or type instead." });
      }
    }
  }
);

export default router;
