import { motion } from "framer-motion";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Link } from "react-router-dom";
import { normalizeMarkdown } from "../lib/markdown.js";
import { linkPhoneNumbers, isCallLink } from "../lib/callLinks.js";

// react-markdown drops tel: links by default; the Call buttons need them.
const keepTelLinks = (url) => (isCallLink(url) ? url : defaultUrlTransform(url));
import { ScreeningProgress, AssessmentCard, MedicineCard } from "./ChatCards.jsx";

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  // In-app links (e.g. "see everyone" -> /doctors?specialty=...) stay in
  // this tab — the conversation is kept, so coming back loses nothing.
  a: ({ children, href }) =>
    isCallLink(href) ? (
      <a
        href={href}
        title={href.slice(4)}
        className="mx-0.5 my-0.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-700 px-3 py-1 align-middle text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        <span aria-hidden="true">📞</span>
        {children}
      </a>
    ) : href?.startsWith("/") ? (
      <Link to={href} className="underline decoration-blue-400 underline-offset-2">
        {children}
      </Link>
    ) : (
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

export default function ChatBubble({ role, text, crisis, failed, doctors, progress, assessment, medicines, onBookDoctor }) {
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
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[0.95em] leading-relaxed sm:max-w-[80%] ${
          isUser
            ? "whitespace-pre-wrap bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/15"
            : crisis
              ? "border border-crisis/30 bg-crisis/5 text-red-900 shadow-sm"
              : failed
                ? "border border-slate-200 bg-slate-50 text-slate-600 shadow-sm"
                : "border border-blue-100 bg-blue-50 text-slate-800 shadow-sm"
        }`}
      >
        {isUser ? (
          text
        ) : (
          <>
            {progress && <ScreeningProgress progress={progress} />}
            <ReactMarkdown components={markdownComponents} urlTransform={keepTelLinks}>
              {linkPhoneNumbers(normalizeMarkdown(text))}
            </ReactMarkdown>
            {assessment && <AssessmentCard card={assessment} />}
            {medicines?.map((m) => (
              <MedicineCard key={m.slug} medicine={m} />
            ))}
            {doctors?.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 border-t border-blue-100 pt-2">
                {doctors.map((d) => (
                  <div key={d.name} className="flex items-center gap-3 rounded-xl bg-white/70 p-2">
                    {d.photo ? (
                      <img
                        src={d.photo}
                        alt={d.name}
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-blue-100 sm:h-16 sm:w-16"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700 ring-1 ring-blue-100 sm:h-16 sm:w-16">
                        {d.name.replace(/^(Dr\.|Ms\.|Mr\.)\s*(\([^)]*\)\s*)?/i, "").charAt(0)}
                      </div>
                    )}
                    {/* Names wrap rather than truncate: "Dr. (Col.) Pavan Kumar
                        Pardal" cut to "Dr. (Col.) Pa…" is no use to anyone. */}
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-semibold leading-snug text-blue-900">{d.name}</div>
                      {d.role && <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">{d.role}</div>}
                    </div>
                    {onBookDoctor && (
                      <button
                        type="button"
                        onClick={() => onBookDoctor(d.name)}
                        className="shrink-0 rounded-full bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                        aria-label={`Book an appointment with ${d.name}`}
                      >
                        Book
                      </button>
                    )}
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
