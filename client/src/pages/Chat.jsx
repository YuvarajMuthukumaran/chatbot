import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import ChatBubble from "../components/ChatBubble.jsx";
import TypingIndicator from "../components/TypingIndicator.jsx";
import TulasiMascot from "../components/TulasiMascot.jsx";
import QuickReplies from "../components/QuickReplies.jsx";
import { useChat } from "../lib/chatStore.jsx";

// Server-side limit (routes/chat.js) — enforced here too so nobody types a
// long message only to have it rejected.
const MAX_MESSAGE_CHARS = 2000;

// Shown under the greeting until the first message: a gentle way in, and a
// hint that booking happens right here in the chat.
const STARTERS = ["I've been feeling anxious lately", "I just need someone to talk to", "Book an appointment"];

// Markdown -> plain text, for the screen-reader announcement.
function plainText(markdown) {
  return markdown.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
}

export default function Chat() {
  const { messages, sessionId, streaming, connectionError, lastFailedText, mood, send, retry, newChat } = useChat();
  const [input, setInput] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const seenCountRef = useRef(messages.length);

  const reduceMotion = useReducedMotion();
  const cardRef = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [3, -3]), { stiffness: 120, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-3, 3]), { stiffness: 120, damping: 20 });

  const handlePointerMove = (e) => {
    if (reduceMotion) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handlePointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const last = messages[messages.length - 1];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [messages, streaming, reduceMotion]);

  // Announce each finished reply to screen readers once — not every
  // character of the typing animation, and not old messages on remount.
  useEffect(() => {
    if (messages.length > seenCountRef.current && last?.role === "model" && !last.pending) {
      seenCountRef.current = messages.length;
      setAnnouncement(`Tulasi: ${plainText(last.text)}`);
    }
  }, [messages, last]);

  // Grow the input with its content, up to a few lines. Empty, it keeps its
  // natural one-row height — measuring then is unreliable (the card is still
  // animating in on first render, and a placeholder can wrap).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (input) el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const submit = async (text) => {
    if (!text.trim() || streaming || !sessionId) return;
    setInput("");
    await send(text);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(input);
  };

  const handleKeyDown = (e) => {
    // Enter sends, Shift+Enter is a new line — but not while an input method
    // is composing (Hindi/Tamil/Telugu and other IME keyboards use Enter to
    // pick a word, which would otherwise send a half-typed message).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) handleSubmit(e);
  };

  const handleNewChat = async () => {
    if (messages.length > 1 && !window.confirm("Start a new conversation? This deletes the saved chat from this device.")) return;
    setInput("");
    await newChat();
    inputRef.current?.focus();
  };

  // The mascot switches to "doctor mode" (stethoscope) whenever the latest
  // reply is recommending specialists — reverts once the conversation moves
  // past that. Name label stays "Tulasi"; only the character's look changes.
  const lastModelMessage = [...messages].reverse().find((m) => m.role === "model" && !m.pending);
  const showingDoctors = !!lastModelMessage?.doctors?.length;

  const onlyGreeting = messages.length === 1 && messages[0].greeting;
  const suggestions = !streaming && sessionId && (onlyGreeting ? STARTERS : !last?.pending && last?.quickReplies);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-2 py-2 sm:px-6 sm:py-6">
      <motion.div
        ref={cardRef}
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
        style={reduceMotion ? undefined : { rotateX, rotateY, transformPerspective: 1400 }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass depth-shadow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl"
      >
        {/* pr-16 below lg: the round "Get Immediate Help" button is pinned over
            this corner on narrower screens, and must never be covered. */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 py-3 pl-4 pr-16 sm:py-4 sm:pl-5 lg:pr-5">
          <TulasiMascot
            mood={mood}
            streaming={streaming}
            doctorMode={showingDoctors}
            className="h-11 w-11 shrink-0 sm:h-14 sm:w-14"
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-blue-900">Tulasi</div>
            <div className="text-xs text-blue-600/70">{streaming ? "Thinking with you…" : "Here to listen"}</div>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            disabled={streaming}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:opacity-40 sm:text-sm"
            aria-label="Start a new conversation"
            title="Your chat is saved on this device. Start a new one to delete it."
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span className="hidden sm:inline">New chat</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5" role="log" aria-label="Conversation with Tulasi">
          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              role={m.role}
              text={m.text}
              crisis={m.crisis}
              failed={m.failed}
              doctors={m.doctors}
              onBookDoctor={streaming ? undefined : (name) => submit(`Book an appointment with ${name}`)}
            />
          ))}
          {streaming && last?.text === "" && <TypingIndicator />}
          {suggestions?.length > 0 && <QuickReplies options={suggestions} onPick={submit} />}
          <div ref={bottomRef} />
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {(connectionError || lastFailedText) && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-5" role="alert">
            <p className="text-sm text-crisis-dark">
              {connectionError
                ? "I'm having trouble connecting. If this keeps happening, Tulasi Health Care's team is reachable directly too."
                : "That message didn't go through."}
            </p>
            {lastFailedText && (
              <button
                type="button"
                onClick={retry}
                disabled={streaming}
                className="shrink-0 rounded-full border border-crisis/30 px-3 py-1 text-sm font-semibold text-crisis-dark hover:bg-crisis/5 disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex shrink-0 items-end gap-2 border-t border-slate-100 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:p-4"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message Tulasi
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_MESSAGE_CHARS}
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
