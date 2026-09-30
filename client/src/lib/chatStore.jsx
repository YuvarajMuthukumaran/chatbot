// The conversation lives here, above the router, rather than inside the Chat
// page: before, opening "Find a Doctor" (or refreshing) and coming back
// showed an empty chat while the server still remembered everything — so
// the bot could refer to things the person could no longer see.
//
// It's saved on the device, so closing the tab (or the browser) and coming
// back days later picks up the same conversation — and when the server has
// forgotten it by then, the next message quietly restores its context from
// here. "New chat" deletes it. See transcript.js for what's saved and how.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { detectMood } from "./mood.js";
import { startSession, getStoredSessionId, getStoredProfile, sendMessageStream, fetchCrisisResources, endSession } from "./api.js";
import { storeCrisisResources } from "./crisisResources.js";
import { readJson, writeJson, remove } from "./storage.js";
import { TRANSCRIPT_KEY, toSaved, fromSaved, sameConversation } from "./transcript.js";

export const GREETING =
  "Hi, I'm Tulasi — a supportive companion from Tulasi Health Care. I'm here to listen and share " +
  "some gentle tools, but I'm not a therapist or doctor and this isn't an emergency service — if you're " +
  "ever in immediate danger, please use the **Get Immediate Help** button. What's on your mind today?";

const FAILED_REPLY = "I need a moment — please try again shortly.";

const greetingMessage = () => ({ role: "model", text: GREETING, greeting: true });

function loadTranscript(sessionId) {
  return fromSaved(readJson(TRANSCRIPT_KEY), sessionId);
}

/** The conversational part of the transcript, for restoring server context.
 * Booking/records exchanges are left out: the server keeps those private.
 * Bounded (the model only sees the last 20 turns anyway) so a long chat in
 * Hindi, Tamil, or Telugu — 3 bytes a character — stays well within the
 * server's request size limit. */
function restorableHistory(messages) {
  return messages
    .filter((m) => !m.greeting && !m.pending && !m.failed && !m.functional && m.text)
    .slice(-20)
    .map(({ role, text }) => ({ role, text: text.slice(0, 1500) }));
}

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [sessionId, setSessionId] = useState(() => getStoredSessionId());
  const [messages, setMessages] = useState(() => loadTranscript(getStoredSessionId()) || [greetingMessage()]);
  const [streaming, setStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [lastFailedText, setLastFailedText] = useState(null);
  const [mood, setMood] = useState("neutral");
  const startingRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;

  useEffect(() => {
    if (!sessionId) return;
    const next = toSaved(sessionId, messages);
    // Skipped when nothing changed — including right after taking over
    // another tab's copy (below), so two open tabs can't keep rewriting it.
    if (sameConversation(next, readJson(TRANSCRIPT_KEY))) return;
    writeJson(TRANSCRIPT_KEY, next);
  }, [messages, sessionId]);

  // With the chat open in more than one tab, each takes up whatever another
  // one saves, so neither overwrites the other's messages with a stale copy.
  // (Skipped mid-reply; this tab's own save afterwards wins instead.)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== TRANSCRIPT_KEY || streamingRef.current) return;
      let saved = null;
      try {
        saved = e.newValue ? JSON.parse(e.newValue) : null;
      } catch {
        return;
      }
      if (saved?.sessionId && Array.isArray(saved.messages) && saved.messages.length) {
        setSessionId(saved.sessionId);
        setMessages(saved.messages);
      } else {
        // "New chat" in another tab.
        setMessages([greetingMessage()]);
        setSessionId(getStoredSessionId());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Text-first: a session starts silently the moment the app loads, with
  // no form or selection required before the person can start talking.
  useEffect(() => {
    if (sessionId || startingRef.current) return;
    startingRef.current = true;
    startSession(getStoredProfile() || {})
      .then((data) => {
        storeCrisisResources(data.crisisResources);
        setSessionId(data.sessionId);
      })
      .catch(() => setConnectionError(true))
      .finally(() => {
        startingRef.current = false;
      });
  }, [sessionId]);

  // Crisis resources are safety-critical and can change independent of any
  // one user's session — refresh them on every load rather than trusting
  // whatever got cached when a (possibly long-lived) session first started.
  useEffect(() => {
    fetchCrisisResources().then(storeCrisisResources).catch(() => {});
  }, []);

  const runSend = useCallback(async (text, activeSessionId, isRetry = false) => {
    setStreaming(true);
    setConnectionError(false);
    setMessages((prev) => [...prev, { role: "model", text: "", pending: true }]);

    // Groq can generate a whole reply faster than a person reads it, which
    // makes it feel like a computer dumping text rather than someone
    // actually responding. Decouple how fast text ARRIVES from how fast it
    // APPEARS: buffer incoming chunks and reveal them at a steady, readable
    // pace instead of rendering each chunk the instant it lands. The
    // exceptions are shown at once: a crisis reply (safety information must
    // never be held back by an animation) and booking/records replies
    // (forms and lists, not conversation).
    let fullText = "";
    let revealedLength = 0;
    let revealTimer = null;
    let doneMeta = null;
    let revealAll = false;
    let liveCrisis = false;

    const applyReveal = () => {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "model", text: fullText.slice(0, revealedLength), pending: true, crisis: liveCrisis };
        return next;
      });
    };
    const finalizeMessage = () => {
      const failed = !!doneMeta?.error;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "model",
          text: fullText,
          crisis: doneMeta?.crisis,
          doctors: doneMeta?.doctors,
          quickReplies: doneMeta?.quickReplies,
          functional: doneMeta?.functional,
          sensitive: doneMeta?.sensitive,
          failed,
        };
        return next;
      });
      // A functional exchange (booking, HMS lookup) is transactional, not
      // emotional — reset the mascot's mood instead of letting one from
      // several turns ago resurface once doctor-mode/this turns off.
      if (doneMeta?.functional) setMood("neutral");
      // The server said the reply failed (rate limit, model trouble): it
      // didn't record the turn, so offer a one-tap retry.
      if (failed) {
        setConnectionError(true);
        setLastFailedText(text);
      }
      setStreaming(false);
    };
    const checkCompletion = () => {
      if (revealedLength >= fullText.length && doneMeta) {
        if (revealTimer) {
          clearInterval(revealTimer);
          revealTimer = null;
        }
        finalizeMessage();
        return true;
      }
      return false;
    };
    const tick = () => {
      if (revealedLength < fullText.length) {
        revealedLength = Math.min(fullText.length, revealedLength + 2);
        applyReveal();
      }
      checkCompletion();
    };
    // A brief pause before text starts appearing — like someone reading
    // your message before replying — instead of flipping straight from
    // "typing…" to a wall of text the instant the first token arrives.
    const startDelayMs = 350 + Math.random() * 250;
    let started = false;
    let cancelled = false;
    const ensureTimer = () => {
      if (started || revealTimer || revealAll) return;
      started = true;
      setTimeout(() => {
        if (cancelled || revealTimer || revealAll) return;
        revealTimer = setInterval(tick, 25);
      }, startDelayMs);
    };

    await sendMessageStream({
      sessionId: activeSessionId,
      message: text,
      onChunk: (chunk, event) => {
        fullText += chunk;
        if (event?.crisis) liveCrisis = true;
        if (event?.crisis || event?.functional) revealAll = true;
        if (revealAll) {
          if (revealTimer) {
            clearInterval(revealTimer);
            revealTimer = null;
          }
          revealedLength = fullText.length;
          applyReveal();
        } else {
          ensureTimer();
        }
      },
      onDone: (meta) => {
        doneMeta = meta || {};
        if (!checkCompletion()) ensureTimer();
      },
      onError: async (err) => {
        cancelled = true;
        if (revealTimer) {
          clearInterval(revealTimer);
          revealTimer = null;
        }

        if (err?.sessionExpired && !isRetry) {
          // The server lost this session (restart, or an idle instance being
          // spun down) — start a new one seeded with the conversation still
          // on screen, then resend, so nothing looks different to the person.
          try {
            const shown = messagesRef.current;
            const lastUser = shown.map((m) => m.role).lastIndexOf("user");
            const data = await startSession(getStoredProfile() || {}, { history: restorableHistory(shown.slice(0, lastUser)) });
            storeCrisisResources(data.crisisResources);
            setSessionId(data.sessionId);
            setMessages((prev) => prev.slice(0, -1));
            return runSend(text, data.sessionId, true);
          } catch {
            // fall through to the generic failure path below
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "model",
            // Server-written reasons (message too long, too many requests)
            // are shown as-is; anything else gets the gentle default.
            text: err?.status === 413 || err?.status === 429 ? err.message : FAILED_REPLY,
            failed: true,
          };
          return next;
        });
        setStreaming(false);
        // Too long / too many: the bubble already says why, and it isn't a
        // connection problem. Retrying a too-long message would fail again.
        setConnectionError(!(err?.status === 413 || err?.status === 429));
        setLastFailedText(err?.status === 413 ? null : text);
      },
    });
  }, []);

  const send = useCallback(
    async (rawText) => {
      const text = rawText.trim();
      if (!text || streaming || !sessionId) return false;
      const detected = detectMood(text);
      if (detected) setMood(detected);
      setLastFailedText(null);
      setMessages((prev) => [...prev, { role: "user", text }]);
      await runSend(text, sessionId);
      return true;
    },
    [streaming, sessionId, runSend]
  );

  const retry = useCallback(async () => {
    if (!lastFailedText || streaming || !sessionId) return;
    const text = lastFailedText;
    setLastFailedText(null);
    setMessages((prev) => (prev[prev.length - 1]?.failed ? prev.slice(0, -1) : prev));
    await runSend(text, sessionId);
  }, [lastFailedText, streaming, sessionId, runSend]);

  /** Clears the conversation here and on the server, and starts afresh. */
  const newChat = useCallback(async () => {
    if (streaming) return;
    const oldId = sessionId;
    remove(TRANSCRIPT_KEY);
    setMessages([greetingMessage()]);
    setMood("neutral");
    setConnectionError(false);
    setLastFailedText(null);
    setSessionId(null); // triggers a fresh session via the effect above
    await endSession(oldId);
  }, [sessionId, streaming]);

  const value = useMemo(
    () => ({ messages, sessionId, streaming, connectionError, lastFailedText, mood, send, retry, newChat }),
    [messages, sessionId, streaming, connectionError, lastFailedText, mood, send, retry, newChat]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
