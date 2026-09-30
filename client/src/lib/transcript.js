// How a conversation is saved on the device and loaded back. The chat is
// kept (localStorage) so people can close the tab and pick up where they
// left off; "New chat" deletes it.

export const TRANSCRIPT_KEY = "tulasi.transcript";

// Plenty for months of check-ins, well within browser storage limits.
export const MAX_SAVED_MESSAGES = 500;

// Hospital records (diagnoses, prescriptions) sit behind an identity check.
// Saved as-is, anyone opening the site later on the same device — a family
// phone, a clinic kiosk — could read them without that check, so they're
// shown in the moment but saved as this note instead.
export const RECORDS_PLACEHOLDER =
  "_Your hospital records were shown here. For your privacy they aren't saved on this device — just ask again to see them._";

// A half-finished booking or records step lives only in the server's memory,
// which doesn't outlast an idle spell (a free-tier host sleeps after about
// 15 minutes). After a gap like that, the last step's buttons would answer a
// question the server has already forgotten, so they're dropped on load.
export const STALE_STEP_MS = 15 * 60 * 1000;

/** The form a conversation is saved in: settled messages only, newest last. */
export function toSaved(sessionId, messages, now = Date.now()) {
  return {
    sessionId,
    savedAt: now,
    messages: messages
      .filter((m) => !m.pending)
      .slice(-MAX_SAVED_MESSAGES)
      .map((m) => (m.sensitive ? { role: m.role, text: RECORDS_PLACEHOLDER, functional: true, sensitive: true } : m)),
  };
}

/** True when two saved forms hold the same conversation (ignoring when each was written). */
export function sameConversation(a, b) {
  return !!a && !!b && a.sessionId === b.sessionId && JSON.stringify(a.messages) === JSON.stringify(b.messages);
}

/** The saved conversation for `sessionId`, ready to show — or null if there isn't one. */
export function fromSaved(saved, sessionId, now = Date.now()) {
  if (!saved || saved.sessionId !== sessionId || !Array.isArray(saved.messages) || !saved.messages.length) return null;
  const messages = saved.messages;
  const last = messages[messages.length - 1];
  if (last.functional && last.quickReplies && now - (saved.savedAt || 0) > STALE_STEP_MS) {
    return [...messages.slice(0, -1), { ...last, quickReplies: undefined }];
  }
  return messages;
}
