import OpenAI from "openai";
import { SYSTEM_INSTRUCTION } from "./systemInstruction.js";

let client = null;

// Diagnostic only, for the same reason db.js exposes getLastDbError(): the
// generic user-facing fallback text is deliberately vague, but that leaves
// no way to tell rate-limiting apart from an auth/config problem from the
// outside — surface the real status/message here instead.
let lastLlmError = null;

export function getLastLlmError() {
  return lastLlmError;
}

function recordError(err, status, model) {
  lastLlmError = {
    status: status ?? null,
    message: err?.message || String(err),
    model,
    at: new Date().toISOString(),
  };
}

// Test deployment: paste the test Groq key between the quotes below so the
// app runs with no environment setup. GROQ_API_KEY, when set, overrides it
// (an empty GROQ_API_KEY means "no key" — the tests use that). Before
// production, empty this again, rotate the key, and use the environment only.
const TEST_GROQ_API_KEY = "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";

export function getApiKey() {
  return process.env.GROQ_API_KEY ?? TEST_GROQ_API_KEY;
}

function getClient() {
  if (!client) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set. Add it to server/.env (or the host's environment settings).");
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

const CONNECTION_TROUBLE =
  "I'm having a little trouble connecting right now. Please try again in a moment — and if this keeps happening, know that Tulasi Health Care's team is always reachable directly too.";

const PRIVATE_BLOCK_NOTE =
  "Note: at this point the user used Tulasi's appointment or patient-records feature, which a separate system handles. Those details (names, phone numbers, medical records) are deliberately not shown to you — don't guess at them or ask for them.";

// Turns from the deterministic booking/HMS flows are marked private: they
// hold names, phone numbers, and (for HMS) real diagnoses and prescriptions,
// none of which should leave this server for a third-party model. Each run of
// consecutive private turns is replaced by one system note, plus any PII-free
// summary the flow attached (e.g. which doctor and date were booked), so the
// model keeps enough context to follow the conversation.
export function toChatMessages(history, message, extraContext) {
  const messages = [{ role: "system", content: SYSTEM_INSTRUCTION }];
  if (extraContext) messages.push({ role: "system", content: extraContext });

  let privateNotes = null;
  const flushPrivate = () => {
    if (!privateNotes) return;
    messages.push({ role: "system", content: [PRIVATE_BLOCK_NOTE, ...privateNotes].join(" ") });
    privateNotes = null;
  };

  for (const turn of history.slice(-MAX_HISTORY_TURNS)) {
    if (turn.private) {
      privateNotes ??= [];
      if (turn.llmNote) privateNotes.push(turn.llmNote);
      continue;
    }
    flushPrivate();
    messages.push({ role: turn.role === "model" ? "assistant" : "user", content: turn.text });
  }
  flushPrivate();

  messages.push({ role: "user", content: message });
  return messages;
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
export async function streamReply({ history, message, onChunk, abortSignal, extraContext }) {
  let ai;
  try {
    ai = getClient();
  } catch (err) {
    // A missing key is a deployment misconfiguration, not a reason to take
    // the process down (which would also wipe every in-memory session) —
    // surface it via /api/llm-status and give the user the normal fallback.
    recordError(err, null, null);
    console.error(err.message);
    return { ok: false, rateLimited: false, text: CONNECTION_TROUBLE };
  }
  const messages = toChatMessages(history, message, extraContext);

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
      recordError(err, status, model);

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
        text: CONNECTION_TROUBLE,
      };
    }
  }

  console.error("Groq API error (all models exhausted):", lastErr?.message || lastErr);
  return {
    ok: false,
    rateLimited: false,
    text: CONNECTION_TROUBLE,
  };
}
