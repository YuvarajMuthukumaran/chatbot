import OpenAI from "openai";
import { SYSTEM_INSTRUCTION } from "./systemInstruction.js";

let clients = null;

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

// The key comes from the environment only (server/.env locally, the host's
// environment settings in production). Never put it in the code: this repo
// is public, and a committed key is a leaked key.
export function getApiKey() {
  return process.env.GROQ_API_KEY?.trim() || "";
}

// The SDK's defaults (10-minute timeout, 2 silent retries) would leave
// someone staring at a typing indicator for minutes. Fail fast instead and
// let the model chain below try the next model.
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 30000;

const openAi = (apiKey, baseURL) => new OpenAI({ apiKey, baseURL, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });

/**
 * Every (model, key) pair to try, best first. OpenRouter leads when
 * OPENROUTER_API_KEY is set; Groq follows, each of its models tried on both
 * keys before dropping to a smaller one.
 */
function getAttempts() {
  if (!clients) {
    const groqKeys = [getApiKey(), process.env.GROQ_API_KEY_2?.trim()].filter(Boolean);
    const routerKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!groqKeys.length && !routerKey) {
      throw new Error("GROQ_API_KEY is not set. Add it to server/.env (or the host's environment settings).");
    }
    const groqApis = groqKeys.map((k) => openAi(k, "https://api.groq.com/openai/v1"));
    const router = routerKey ? openAi(routerKey, "https://openrouter.ai/api/v1") : null;
    clients = [
      ...(router ? OPENROUTER_MODELS.map((model) => ({ model, api: router, label: `openrouter/${model}` })) : []),
      ...MODEL_CHAIN.flatMap((model) => groqApis.map((api, i) => ({ model, api, label: `groq/${model} (key ${i + 1})` }))),
    ];
  }
  return clients;
}

// Primary model first, then fallbacks to try (in order) if the primary is
// unavailable/rate-limited. Configure via GROQ_MODEL / GROQ_MODEL_FALLBACKS
// (comma-separated) so this can be tuned per deployment without a code
// change. Groq's free tier applies rate limits per model, so falling back
// to a different model is usually worth trying before giving up.
// Tried before Groq when OPENROUTER_API_KEY is set. These are large
// reasoning models, so reasoning is turned off below: a chat reply that
// takes ten seconds feels broken.
const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS ?? "nvidia/nemotron-3-ultra-550b-a55b:free")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const MODEL_CHAIN = [
  process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  ...(process.env.GROQ_MODEL_FALLBACKS || "openai/gpt-oss-20b,qwen/qwen3.8-27b")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
];

const MAX_HISTORY_TURNS = Number(process.env.MAX_HISTORY_TURNS) || 20;

// A little below the default of 1: still varied and warm, less prone to
// wandering off-script on facts. The token cap bounds cost and latency (it
// includes reasoning tokens on reasoning models, so it can't be tiny).
const TEMPERATURE = Number(process.env.LLM_TEMPERATURE ?? 0.7);
const MAX_COMPLETION_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 2048;

// Total time a reply may be held while every model is rate-limited.
const MAX_TOTAL_WAIT_MS = 15000;

/** How long a 429 says to wait ("Please try again in 4.83s" / "in 1m2s"), in ms, or null. */
export function retryAfterMs(err) {
  const header = err?.headers?.get?.("retry-after") ?? err?.headers?.["retry-after"];
  if (header && !Number.isNaN(Number(header))) return Number(header) * 1000;
  const m = String(err?.message || "").match(/try again in (?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
  return m ? (Number(m[1] || 0) * 60 + Number(m[2])) * 1000 : null;
}

// Worth trying the next model for: rate limits, overload, and requests that
// never got a response at all (timeouts, connection resets).
// 401/403 too: with two keys, a revoked or mistyped one shouldn't take the
// chat down while the other still works.
function isRetryable(status) {
  return status === undefined || status === 401 || status === 403 || status === 429 || status === 502 || status === 503 || status === 504;
}

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
// `turnNote` (optional) is a system note about this message specifically. It
// goes right before it, where the model weighs it most — `extraContext`
// (background like matching specialists) goes up top with the instructions.
export function toChatMessages(history, message, extraContext, turnNote) {
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

  if (turnNote) messages.push({ role: "system", content: turnNote });
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
export async function streamReply({ history, message, onChunk, abortSignal, extraContext, turnNote }) {
  let ai;
  try {
    ai = getAttempts();
  } catch (err) {
    // A missing key is a deployment misconfiguration, not a reason to take
    // the process down (which would also wipe every in-memory session) —
    // surface it via /api/llm-status and give the user the normal fallback.
    recordError(err, null, null);
    console.error(err.message);
    return { ok: false, rateLimited: false, text: CONNECTION_TROUBLE };
  }
  const messages = toChatMessages(history, message, extraContext, turnNote);

  let lastErr = null;
  let waitedMs = 0;

  // Best model on every key before dropping to a smaller model.
  const attempts = ai;
  for (let i = 0; i < attempts.length; i++) {
    const { model, api, label } = attempts[i];
    const isLastModel = i === attempts.length - 1;

    if (abortSignal?.aborted) return { ok: false, aborted: true, text: "" };

    let full = "";
    try {
      const stream = await api.chat.completions.create(
        {
          model,
          messages,
          stream: true,
          temperature: TEMPERATURE,
          max_completion_tokens: MAX_COMPLETION_TOKENS,
          // OpenRouter-only, ignored by Groq: skip the hidden thinking pass.
          ...(label.startsWith("openrouter/") && { reasoning: { enabled: false } }),
        },
        { signal: abortSignal }
      );

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

      if (full) {
        // Failed mid-stream: the person has already seen part of a reply, so
        // another model's answer would be glued onto it. Stop here instead.
        console.error(`Model "${model}" failed mid-reply:`, err?.message || err);
        return { ok: false, rateLimited: false, text: CONNECTION_TROUBLE };
      }

      if (isRetryable(status) && !isLastModel) {
        console.warn(`${label} unavailable (${status}), trying ${attempts[i + 1].label}`);
        continue;
      }

      // Every model is rate-limited, but the last one says it frees up in a
      // few seconds ("Please try again in 4.8s"): wait and start again from
      // the best model (it may have freed up too), rather than send the
      // person away. Longer waits (a daily cap) aren't worth holding for.
      const waitMs = status === 429 ? retryAfterMs(err) : null;
      if (waitMs !== null && waitedMs + waitMs <= MAX_TOTAL_WAIT_MS) {
        waitedMs += waitMs;
        console.warn(`All models rate-limited; retrying "${model}" in ${Math.ceil(waitMs / 1000)}s`);
        await new Promise((resolve) => setTimeout(resolve, waitMs + 250));
        i = -1;
        continue;
      }

      if (status === 429) {
        return {
          ok: false,
          rateLimited: true,
          text: "A lot of people are talking to me right now, so I couldn't reply. Please send that again in a few seconds.",
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
