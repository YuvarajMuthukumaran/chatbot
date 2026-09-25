import OpenAI from "openai";
import { SYSTEM_INSTRUCTION } from "./systemInstruction.js";

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set. Add it to server/.env");
    }
    client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  }
  return client;
}

// Primary model first, then fallbacks to try (in order) if the primary is
// unavailable/rate-limited. Configure via GROQ_MODEL / GROQ_MODEL_FALLBACKS
// (comma-separated) so this can be tuned per deployment without a code
// change. Groq's free tier applies rate limits per model, so falling back
// to a different model is usually worth trying before giving up.
const MODEL_CHAIN = [
  process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  ...(process.env.GROQ_MODEL_FALLBACKS || "openai/gpt-oss-20b,qwen/qwen3.8-27b")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
];

const MAX_HISTORY_TURNS = Number(process.env.MAX_HISTORY_TURNS) || 20;

function toChatMessages(history, message) {
  return [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
      role: turn.role === "model" ? "assistant" : "user",
      content: turn.text,
    })),
    { role: "user", content: message },
  ];
}

/** Extracts an HTTP-ish status code from an OpenAI-SDK-style error. */
function getErrorStatus(err) {
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.response?.status === "number") return err.response.status;
  const raw = err?.message;
  if (typeof raw === "string") {
    const match = raw.match(/\b(429|500|502|503|504)\b/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

/** The chat completions endpoint is stateless between requests — we replay
 * the full turn history every call, trimmed to the most recent turns to
 * bound latency/cost as a conversation grows. `history` is
 * [{ role: 'user' | 'model', text }]. */
export async function streamReply({ history, message, onChunk, abortSignal }) {
  const ai = getClient();
  const messages = toChatMessages(history, message);

  let lastErr = null;

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    const isLastModel = i === MODEL_CHAIN.length - 1;

    if (abortSignal?.aborted) return { ok: false, aborted: true, text: "" };

    try {
      const stream = await ai.chat.completions.create(
        { model, messages, stream: true },
        { signal: abortSignal }
      );

      let full = "";
      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) {
          full += text;
          onChunk(text);
        }
      }

      if (!full.trim()) {
        // Occasionally a model returns an empty completion under load
        // instead of a clean error — treat it like an overload and fall
        // back rather than showing the user a blank reply.
        throw Object.assign(new Error("Empty completion"), { status: 503 });
      }

      return { ok: true, text: full, model };
    } catch (err) {
      if (abortSignal?.aborted) return { ok: false, aborted: true, text: "" };

      lastErr = err;
      const status = getErrorStatus(err);

      if ((status === 429 || status === 503 || status === 502 || status === 504) && !isLastModel) {
        console.warn(`Model "${model}" unavailable (${status}), falling back to "${MODEL_CHAIN[i + 1]}"`);
        continue;
      }

      if (status === 429) {
        return {
          ok: false,
          rateLimited: true,
          text: "I need a moment — please try again shortly.",
        };
      }

      console.error("Groq API error:", err?.message || err);
      return {
        ok: false,
        rateLimited: false,
        text: "I'm having a little trouble connecting right now. Please try again in a moment — and if this keeps happening, know that Tulasi Health Care's team is always reachable directly too.",
      };
    }
  }

  console.error("Groq API error (all models exhausted):", lastErr?.message || lastErr);
  return {
    ok: false,
    rateLimited: false,
    text: "I'm having a little trouble connecting right now. Please try again in a moment — and if this keeps happening, know that Tulasi Health Care's team is always reachable directly too.",
  };
}
