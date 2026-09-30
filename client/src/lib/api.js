import { readJson, writeJson, remove } from "./storage.js";
import { API_BASE } from "./apiBase.js";

// Kept on the device (localStorage) along with the saved conversation, so
// someone can come back to it later — see transcript.js.
const SESSION_KEY = "tulasi.sessionId";
const PROFILE_KEY = "tulasi.profile";

// Earlier versions stored a session id under these keys without ever saving
// the conversation it belonged to — nothing to carry over, so tidy them away.
remove("yuvaraj.sessionId");
remove("yuvaraj.profile");

async function errorFrom(res, fallback) {
  const data = await res.json().catch(() => ({}));
  const err = new Error(data.error || fallback);
  err.status = res.status;
  return err;
}

/**
 * @param {object} [profile]
 * @param {{history?: Array<{role: string, text: string}>}} [options] - the
 *   visible conversation, to restore context when the server lost the old
 *   session (a restart, or the host spinning down while idle).
 */
export async function startSession(profile, { history } = {}) {
  const res = await fetch(`${API_BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(profile || {}), ...(history?.length ? { history } : {}) }),
  });
  if (!res.ok) throw await errorFrom(res, "Could not start a session");
  const data = await res.json();
  writeJson(SESSION_KEY, data.sessionId);
  if (profile) writeJson(PROFILE_KEY, profile);
  return data;
}

export function getStoredSessionId() {
  return readJson(SESSION_KEY);
}

export function getStoredProfile() {
  return readJson(PROFILE_KEY);
}

export async function fetchCrisisResources() {
  const res = await fetch(`${API_BASE}/api/crisis-resources`);
  if (!res.ok) throw new Error("Could not load crisis resources");
  return res.json();
}

/** Forgets the conversation on the server too (best-effort). */
export async function endSession(sessionId) {
  remove(SESSION_KEY);
  if (!sessionId) return;
  try {
    await fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  } catch {
    // the server forgets idle sessions on its own anyway
  }
}

/**
 * Streams a chat reply via SSE-over-POST.
 * @param {object} args
 * @param {string} args.sessionId
 * @param {string} args.message
 * @param {(text: string, event: object) => void} args.onChunk - `event` is
 *   the whole server event, so flags like `crisis` are known the moment the
 *   text arrives (a crisis reply is shown at once, not typed out).
 * @param {(info: {crisis?: boolean, error?: boolean, functional?: boolean, sensitive?: boolean, doctors?: object[], quickReplies?: string[]}) => void} args.onDone
 * @param {(err: Error) => void} args.onError
 */
export async function sendMessageStream({ sessionId, message, onChunk, onDone, onError }) {
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    });

    if (res.status === 404) {
      // The in-memory session store doesn't survive a server restart, so a
      // stored sessionId can go stale.
      const err = new Error("Session expired");
      err.sessionExpired = true;
      throw err;
    }

    if (!res.ok || !res.body) throw await errorFrom(res, "The chat request failed.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const meta = {};

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.crisis) meta.crisis = true;
          if (parsed.error) meta.error = true;
          if (parsed.functional) meta.functional = true;
          if (parsed.sensitive) meta.sensitive = true;
          if (parsed.doctors) meta.doctors = parsed.doctors;
          if (parsed.quickReplies) meta.quickReplies = parsed.quickReplies;
          if (parsed.text) onChunk(parsed.text, parsed);
        } catch {
          // ignore malformed chunk
        }
      }
    }

    onDone(meta);
  } catch (err) {
    onError(err);
  }
}
