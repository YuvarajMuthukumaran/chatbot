import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import ChatBubble from "../components/ChatBubble.jsx";
import TypingIndicator from "../components/TypingIndicator.jsx";
import avatar from "../assets/yuvaraj-avatar.webp";
import {
  startSession,
  getStoredSessionId,
  getStoredProfile,
  sendMessageStream,
  fetchCrisisResources,
} from "../lib/api.js";
import { storeCrisisResources } from "../lib/crisisResources.js";

const GREETING =
  "Hi, I'm YUVARAJ — a supportive companion from Tulasi Health Care. I'm here to listen and share " +
  "some gentle tools, but I'm not a therapist or doctor and this isn't an emergency service — if you're " +
  "ever in immediate danger, please use the **Get Immediate Help** button. What's on your mind today?";

export default function Chat() {
  const [sessionId, setSessionId] = useState(getStoredSessionId());
  const [messages, setMessages] = useState([{ role: "model", text: GREETING }]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [lastFailedText, setLastFailedText] = useState(null);
  const bottomRef = useRef(null);
  const startedRef = useRef(false);

  const cardRef = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [3, -3]), { stiffness: 120, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-3, 3]), { stiffness: 120, damping: 20 });

  const handlePointerMove = (e) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handlePointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  // Text-first: a session starts silently the moment the page loads, with
  // no form or selection required before the user can start talking.
  useEffect(() => {
    if (sessionId || startedRef.current) return;
    startedRef.current = true;
    startSession(getStoredProfile() || {})
      .then((data) => {
        storeCrisisResources(data.crisisResources);
        setSessionId(data.sessionId);
      })
      .catch(() => setConnectionError(true));
  }, [sessionId]);

  // Crisis resources are safety-critical and can change independent of any
  // one user's session — refresh them on every load rather than trusting
  // whatever got cached when a (possibly long-lived) session first started.
  useEffect(() => {
    fetchCrisisResources().then(storeCrisisResources).catch(() => {});
  }, []);

  const runSend = async (text, activeSessionId = sessionId, isRetry = false) => {
    setStreaming(true);
    setConnectionError(false);

    setMessages((prev) => [...prev, { role: "model", text: "", pending: true }]);

    // Groq can generate a whole reply faster than a person reads it, which
    // makes it feel like a computer dumping text rather than someone
    // actually responding. Decouple how fast text ARRIVES from how fast it
    // APPEARS: buffer incoming chunks and reveal them at a steady, readable
    // pace instead of rendering each chunk the instant it lands.
    let fullText = "";
    let revealedLength = 0;
    let revealTimer = null;
    let doneMeta = null;

    const applyReveal = () => {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "model", text: fullText.slice(0, revealedLength), pending: true };
        return next;
      });
    };
    const finalizeMessage = () => {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "model", text: fullText, crisis: doneMeta?.crisis };
        return next;
      });
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
      if (started || revealTimer) return;
      started = true;
      setTimeout(() => {
        if (cancelled || revealTimer) return;
        revealTimer = setInterval(tick, 25);
      }, startDelayMs);
    };

    await sendMessageStream({
      sessionId: activeSessionId,
      message: text,
      onChunk: (chunk) => {
        fullText += chunk;
        ensureTimer();
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
          try {
            const data = await startSession(getStoredProfile() || {});
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
            text: "I need a moment — please try again shortly.",
            failed: true,
          };
          return next;
        });
        setStreaming(false);
        setConnectionError(true);
        setLastFailedText(text);
      },
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming || !sessionId) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    await runSend(text);
  };

  const handleRetry = async () => {
    if (!lastFailedText || streaming) return;
    const text = lastFailedText;
    setMessages((prev) => (prev[prev.length - 1]?.failed ? prev.slice(0, -1) : prev));
    await runSend(text);
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-2 py-2 sm:px-6 sm:py-6">
      <motion.div
        ref={cardRef}
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
        style={{ rotateX, rotateY, transformPerspective: 1400 }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass depth-shadow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <motion.img
            src={avatar}
            alt="YUVARAJ"
            animate={streaming ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 1.4, repeat: streaming ? Infinity : 0, ease: "easeInOut" }}
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-blue-100 sm:h-12 sm:w-12"
          />
          <div>
            <div className="font-semibold text-blue-900">YUVARAJ</div>
            <div className="text-xs text-blue-600/70">
              {streaming ? "Thinking with you…" : "Here to listen"}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} text={m.text} crisis={m.crisis} />
          ))}
          {streaming && messages[messages.length - 1]?.text === "" && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {connectionError && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-5" role="alert">
            <p className="text-sm text-crisis-dark">
              I'm having trouble connecting. If this keeps happening, Tulasi Health Care's team is
              reachable directly too.
            </p>
            {lastFailedText && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={streaming}
                className="shrink-0 rounded-full border border-crisis/30 px-3 py-1 text-sm font-semibold text-crisis-dark hover:bg-crisis/5 disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="flex shrink-0 items-end gap-2 border-t border-slate-100 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:p-4"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message YUVARAJ
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSend(e);
            }}
            rows={1}
            placeholder={sessionId ? "Share what's on your mind…" : "Getting things ready…"}
            disabled={!sessionId}
            className="min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:text-[0.95em]"
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || streaming || !sessionId}
            whileHover={input.trim() && !streaming ? { scale: 1.05 } : {}}
            whileTap={{ scale: 0.94 }}
            animate={!streaming && input.trim() ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white shadow-md shadow-blue-900/20 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
