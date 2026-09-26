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
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-blue-400 underline-offset-2">
      {children}
    </a>
  ),
  h1: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
  h2: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
  h3: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
  hr: () => <hr className="my-2 border-current/10" />,
  code: ({ children }) => <code className="rounded bg-black/5 px-1 py-0.5 text-[0.9em]">{children}</code>,
};

export default function ChatBubble({ role, text, crisis, doctors }) {
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
            ? "whitespace-pre-wrap bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/15"
            : crisis
              ? "border border-crisis/30 bg-crisis/5 text-red-900 shadow-sm"
              : "border border-blue-100 bg-blue-50 text-slate-800 shadow-sm"
        }`}
      >
        {isUser ? (
          text
        ) : (
          <>
            <ReactMarkdown components={markdownComponents}>{normalizeMarkdown(text)}</ReactMarkdown>
            {doctors?.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 border-t border-blue-100 pt-2">
                {doctors.map((d) => (
                  <div key={d.name} className="flex items-center gap-3 rounded-xl bg-white/70 p-2">
                    {d.photo ? (
                      <img
                        src={d.photo}
                        alt={d.name}
                        className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-blue-100"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700 ring-1 ring-blue-100">
                        {d.name.replace(/^(Dr\.|Ms\.|Mr\.)\s*/i, "").charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 truncate text-sm font-semibold text-blue-900">{d.name}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
