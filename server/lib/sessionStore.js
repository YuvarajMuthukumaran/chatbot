// In-memory per-session store. Good enough for a single-process MVP;
// swap for Postgres/Supabase if sessions need to survive restarts or
// scale across multiple server instances.
const sessions = new Map();

export function createSession() {
  const id = crypto.randomUUID();
  sessions.set(id, { history: [], profile: {}, createdAt: Date.now() });
  return id;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export function appendTurn(id, role, text) {
  const session = sessions.get(id);
  if (!session) return;
  session.history.push({ role, text });
}

export function setProfile(id, profile) {
  const session = sessions.get(id);
  if (!session) return;
  session.profile = { ...session.profile, ...profile };
}

export function deleteSession(id) {
  sessions.delete(id);
}
