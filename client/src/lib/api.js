const SESSION_KEY = "yuvaraj.sessionId";
const PROFILE_KEY = "yuvaraj.profile";

export async function startSession(profile) {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile || {}),
  });
  if (!res.ok) throw new Error("Could not start a session");
  const data = await res.json();
  localStorage.setItem(SESSION_KEY, data.sessionId);
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return data;
}

export function getStoredSessionId() {
  return localStorage.getItem(SESSION_KEY);
}

export function getStoredProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearLocalSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

/**
 * Streams a chat reply via SSE-over-POST.
 * @param {{sessionId: string, message: string, onChunk: (text: string) => void, onDone: (info: {crisis?: boolean, error?: boolean}) => void, onError: (err: Error) => void}} args
 */
export async function sendMessageStream({ sessionId, message, onChunk, onDone, onError }) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    });

    if (res.status === 404) {
      // The in-memory session store doesn't survive a server restart, so a
      // sessionId cached in localStorage from before one can go stale.
      const err = new Error("Session expired");
      err.sessionExpired = true;
      throw err;
    }

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "The chat request failed.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let meta = {};

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
          if (parsed.text) onChunk(parsed.text);
          if (parsed.crisis) meta.crisis = true;
          if (parsed.error) meta.error = true;
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
