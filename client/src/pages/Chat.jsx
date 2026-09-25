import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import ChatBubble from "../components/ChatBubble.jsx";
import TypingIndicator from "../components/TypingIndicator.jsx";
import PresenceOrb from "../components/PresenceOrb.jsx";
import {
  startSession,
  getStoredSessionId,
  getStoredProfile,
  sendMessageStream,
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

  const runSend = async (text, activeSessionId = sessionId, isRetry = false) => {
    setStreaming(true);
    setConnectionError(false);

    let accumulated = "";
    setMessages((prev) => [...prev, { role: "model", text: "", pending: true }]);

    await sendMessageStream({
      sessionId: activeSessionId,
      message: text,
      onChunk: (chunk) => {
        accumulated += chunk;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "model", text: accumulated, pending: true };
          return next;
        });
      },
      onDone: (meta) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "model", text: accumulated, crisis: meta.crisis };
          return next;
        });
        setStreaming(false);
      },
      onError: async (err) => {
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
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
          <PresenceOrb active={streaming} className="h-9 w-9 shrink-0 sm:h-12 sm:w-12" />
          <div>
            <div className="font-semibold text-white">YUVARAJ</div>
            <div className="text-xs text-teal-200/70">
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
            <p className="text-sm text-red-300">
              I'm having trouble connecting. If this keeps happening, Tulasi Health Care's team is
              reachable directly too.
            </p>
            {lastFailedText && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={streaming}
                className="shrink-0 rounded-full border border-red-400/40 px-3 py-1 text-sm font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="flex shrink-0 items-end gap-2 border-t border-white/10 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:p-4"
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
            className="min-w-0 flex-1 resize-none rounded-2xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-base text-slate-100 placeholder:text-slate-400 focus:border-teal-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400/30 sm:text-[0.95em]"
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || streaming || !sessionId}
            whileHover={input.trim() && !streaming ? { scale: 1.05 } : {}}
            whileTap={{ scale: 0.94 }}
            animate={!streaming && input.trim() ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="shrink-0 rounded-full bg-gradient-to-br from-teal-400 to-lavender-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-teal-900/40 transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
            aria-label="Send message"
          >
            Send
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
