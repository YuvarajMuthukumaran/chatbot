import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { normalizeMarkdown } from "../lib/markdown.js";

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-teal-400 underline-offset-2">
      {children}
    </a>
  ),
  h1: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
  h2: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
  h3: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
  hr: () => <hr className="my-2 border-current/10" />,
  code: ({ children }) => <code className="rounded bg-black/5 px-1 py-0.5 text-[0.9em]">{children}</code>,
};

export default function ChatBubble({ role, text, crisis }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97, rotateX: -4 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 220 }}
      style={{ perspective: 800, transformStyle: "preserve-3d" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[0.95em] leading-relaxed ${
          isUser
            ? "whitespace-pre-wrap bg-gradient-to-br from-teal-500 to-lavender-600 text-white shadow-lg shadow-teal-900/30"
            : crisis
              ? "border border-crisis/40 bg-crisis/10 text-red-50 shadow-lg shadow-crisis/20 backdrop-blur-xl"
              : "glass-light text-slate-800 shadow-lg shadow-black/10"
        }`}
      >
        {isUser ? (
          text
        ) : (
          <ReactMarkdown components={markdownComponents}>{normalizeMarkdown(text)}</ReactMarkdown>
        )}
      </div>
    </motion.div>
  );
}
