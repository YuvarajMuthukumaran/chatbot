// In-memory per-session store. Good enough for a single-process MVP;
// swap for Postgres/Supabase if sessions need to survive restarts or
// scale across multiple server instances.
//
// Sessions hold people's mental-health conversations, so they're kept only
// as long as they're useful: an idle session expires, the store has a hard
// size cap (evicting the least recently created first), and each session
// keeps a bounded tail of history — the model only ever sees the last
// MAX_HISTORY_TURNS turns anyway.
const IDLE_TTL_MS = (Number(process.env.SESSION_IDLE_TTL_HOURS) || 24) * 60 * 60 * 1000;
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS) || 10_000;
const MAX_STORED_TURNS = 200;

// Bounds for history a client sends back to restore a session (see
// createSession) — enough for continuity, not a way to stuff the prompt.
const MAX_RESTORED_TURNS = 20;
const MAX_RESTORED_TURN_CHARS = 4000;

const sessions = new Map();

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActiveAt > IDLE_TTL_MS) sessions.delete(id);
  }
}, 10 * 60 * 1000);
sweep.unref?.();

/** Keeps only well-formed {role, text} turns from client-supplied history. */
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((t) => t && (t.role === "user" || t.role === "model") && typeof t.text === "string" && t.text.trim())
    .slice(-MAX_RESTORED_TURNS)
    .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_RESTORED_TURN_CHARS) }));
}

/**
 * @param {{history?: Array<{role: string, text: string}>}} [options] -
 *   `history` restores context when the server lost a session (a restart,
 *   or the host spinning down an idle instance) but the person's browser
 *   still shows the conversation. It only ever affects that person's own
 *   session, and nothing security-relevant (like HMS verification) is
 *   restored from it.
 */
/** @param {{history?: object[], channel?: "website"}} [options] - `channel: "website"`
 * marks a session started from the public website widget (see turnRouter.js). */
export function createSession({ history, channel } = {}) {
  while (sessions.size >= MAX_SESSIONS) {
    sessions.delete(sessions.keys().next().value);
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  sessions.set(id, {
    history: sanitizeHistory(history),
    profile: {},
    channel: channel === "website" ? "website" : undefined,
    createdAt: now,
    lastActiveAt: now,
  });
  return id;
}

export function getSession(id) {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.lastActiveAt > IDLE_TTL_MS) {
    sessions.delete(id);
    return null;
  }
  session.lastActiveAt = Date.now();
  return session;
}

/**
 * @param {object} [options]
 * @param {boolean} [options.private] - the turn belongs to a deterministic
 *   flow (booking, patient records) and may contain identifiers or medical
 *   data; it's kept for the transcript but never replayed to the LLM.
 * @param {string} [options.llmNote] - PII-free summary the LLM may see in
 *   place of a private turn (e.g. "booked Dr. X for Mon, 5 Oct at 10:30 AM").
 */
export function appendTurn(id, role, text, { private: isPrivate = false, llmNote } = {}) {
  const session = sessions.get(id);
  if (!session) return;
  const turn = { role, text };
  if (isPrivate) turn.private = true;
  if (llmNote) turn.llmNote = llmNote;
  session.history.push(turn);
  if (session.history.length > MAX_STORED_TURNS) {
    session.history.splice(0, session.history.length - MAX_STORED_TURNS);
  }
}

export function setProfile(id, profile) {
  const session = sessions.get(id);
  if (!session) return;
  session.profile = { ...session.profile, ...profile };
}

export function deleteSession(id) {
  sessions.delete(id);
}
