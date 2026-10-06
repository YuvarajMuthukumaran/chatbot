import { motion } from "framer-motion";
import { Link } from "react-router-dom";

// Cards drawn inside a Tulasi chat bubble: screening progress, screening
// results, and compact medicine cards.

/** "OCD screening · 2 of 6" with a thin bar, above a screening question. */
export function ScreeningProgress({ progress }) {
  const pct = Math.round(((progress.current - 1) / progress.total) * 100);
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-blue-700/80">
        <span>{progress.title}</span>
        <span>
          {progress.current} of {progress.total}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-blue-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.current - 1}
        aria-label={`${progress.title} progress`}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-lavender-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// Full class names so Tailwind can see them.
const LIKELIHOOD = {
  low: { card: "from-teal-50 to-white ring-teal-200", badge: "bg-teal-600 text-white", icon: "🌿", dot: 1 },
  possible: { card: "from-amber-50 to-white ring-amber-200", badge: "bg-amber-500 text-white", icon: "🔎", dot: 2 },
  likely: { card: "from-rose-50 to-white ring-rose-200", badge: "bg-rose-600 text-white", icon: "🩺", dot: 3 },
  urgent: { card: "from-red-100 to-white ring-red-300", badge: "bg-red-700 text-white", icon: "🚨", dot: 3 },
};

/** Three dots filling up: Unlikely ●○○, Possible ●●○, Likely ●●●. */
function LikelihoodDots({ level }) {
  const filled = LIKELIHOOD[level]?.dot || 1;
  const colour = level === "low" ? "bg-teal-500" : level === "possible" ? "bg-amber-500" : "bg-rose-600";
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <motion.span
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15 * i, type: "spring", stiffness: 300, damping: 18 }}
          className={`h-2.5 w-2.5 rounded-full ${i <= filled ? colour : "bg-slate-200"}`}
        />
      ))}
    </span>
  );
}

export function AssessmentCard({ card }) {
  const style = LIKELIHOOD[card.likelihood] || LIKELIHOOD.possible;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`mt-3 overflow-hidden rounded-2xl bg-gradient-to-b ring-1 ${style.card}`}
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{card.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${style.badge}`}>{card.label}</span>
            {/* Dots mean "how likely is this condition", which a dizziness
                triage doesn't measure. */}
            {card.likelihood !== "urgent" && card.id !== "dizziness" && <LikelihoodDots level={card.likelihood} />}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3 text-sm text-slate-700">
        <p className="font-semibold leading-snug text-slate-900">{card.headline}</p>

        {card.points?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {card.points.map((p) => (
              <li key={p} className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {p}
              </li>
            ))}
          </ul>
        )}

        {card.crisisLines?.length > 0 && (
          <div className="rounded-xl bg-crisis/10 p-3 ring-1 ring-crisis/20">
            <p className="text-xs font-semibold text-crisis-dark">You mentioned thoughts of being better off dead or of hurting yourself. Please reach out now:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {card.crisisLines.map((line) => (
                <a
                  key={line.name}
                  href={`tel:${line.phone.replace(/\s/g, "")}`}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs ring-1 ring-crisis/20 hover:bg-crisis/5"
                >
                  <span className="text-slate-500">{line.name}</span> <span className="font-bold text-crisis-dark">{line.phone}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {card.next?.length > 0 && (
          <div className="rounded-xl bg-white/80 p-3 ring-1 ring-slate-100">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">What to do next</p>
            <ul className="space-y-1.5">
              {card.next.map((n) => (
                <li key={n} className="flex gap-2">
                  <span aria-hidden="true" className="mt-0.5 text-blue-500">✦</span>
                  {/* "**112**" in the urgent advice stays bold. */}
                  <span>{n.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] leading-snug text-slate-500">
          {card.disclaimer}
          {card.tool && card.likelihood !== "urgent" && <span className="text-slate-400"> · {card.tool}</span>}
        </p>
      </div>
    </motion.div>
  );
}

/** Compact medicine card: uses, common side effects as chips, link to the guide. */
export function MedicineCard({ medicine }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-3 overflow-hidden rounded-2xl bg-white/90 ring-1 ring-blue-100"
    >
      <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-lavender-600 px-4 py-3 text-white">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg">
          💊
        </span>
        <div className="min-w-0">
          <p className="break-words font-semibold leading-tight">{medicine.name}</p>
          <p className="text-xs text-blue-100">{medicine.kind}</p>
        </div>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Used for</p>
          <div className="flex flex-wrap gap-1.5">
            {medicine.usedFor.map((u) => (
              <span key={u} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {u}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Common side effects</p>
          <div className="flex flex-wrap gap-1.5">
            {medicine.common.map((c) => (
              <span key={c} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-rose-700">
            <span aria-hidden="true">⚠️</span> {medicine.warningCount} warning signs to know
          </span>
          <Link
            to={`/medicines/${medicine.slug}`}
            className="rounded-full bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Full guide →
          </Link>
        </div>
        <p className="text-[11px] text-slate-500">Don't start, stop or change a medicine without your doctor.</p>
      </div>
    </motion.div>
  );
}
