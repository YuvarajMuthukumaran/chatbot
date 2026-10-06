import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PageShell from "../components/PageShell.jsx";
import { fetchMedicine } from "../lib/guideApi.js";

const ASK_YOUR_DOCTOR = [
  "What is this medicine meant to help with for me?",
  "How long until I notice a difference?",
  "Which side effects should I tell you about?",
  "What if I miss a dose?",
  "Is it safe with my other medicines, alcohol, or pregnancy?",
  "How long will I take it, and how will we stop it?",
];

// "Sexual side effects (lower desire, delayed orgasm)" -> title + detail
function splitDetail(text) {
  const m = text.match(/^(.*?)\s*\((.+)\)\s*$/);
  return m ? { title: m[1], detail: m[2] } : { title: text, detail: null };
}

// The first sentence carries the point; the rest is supporting detail.
function splitSentence(text) {
  const i = text.search(/[.:]\s/);
  return i > 0 ? { lead: text.slice(0, i + 1), rest: text.slice(i + 2) } : { lead: text, rest: "" };
}

function Tile({ icon, label, value, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-900 ring-blue-100",
    slate: "bg-slate-50 text-slate-800 ring-slate-100",
    rose: "bg-rose-50 text-rose-900 ring-rose-100",
  };
  return (
    <div className={`flex flex-col gap-1 rounded-2xl p-3 ring-1 ${tones[tone]}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-70">
        <span aria-hidden="true">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-semibold leading-snug">{value}</span>
    </div>
  );
}

function Benefits({ m }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {m.howItHelps.map((h, i) => (
        <motion.div
          key={h}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-start gap-3 rounded-2xl bg-teal-50/80 p-3.5 ring-1 ring-teal-100"
        >
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
            ✓
          </span>
          <span className="text-sm font-medium text-teal-950">{h}</span>
        </motion.div>
      ))}
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-100 sm:col-span-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">⏳ When it starts working</p>
        <p className="mt-1 text-sm text-slate-700">{m.timeToWork}</p>
      </div>
    </div>
  );
}

function SideEffects({ m }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {m.common.map((c, i) => {
          const { title, detail } = splitDetail(c);
          return (
            <motion.div
              key={c}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl bg-white p-3 ring-1 ring-slate-100"
            >
              <p className="text-sm font-semibold leading-snug text-slate-800">{title}</p>
              {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
            </motion.div>
          );
        })}
      </div>
      {m.commonNote && (
        <p className="flex gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
          <span aria-hidden="true">💬</span>
          {m.commonNote}
        </p>
      )}
    </div>
  );
}

function Warnings({ m }) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold text-rose-800">Get medical help right away if you notice:</p>
      {m.serious.map((s, i) => {
        const { title, detail } = splitDetail(s);
        return (
          <motion.div
            key={s}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3 rounded-2xl bg-rose-50 p-3.5 ring-1 ring-rose-100"
          >
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white">
              !
            </span>
            <div className="text-sm">
              <p className="font-medium text-rose-950">{title}</p>
              {detail && <p className="mt-0.5 text-xs text-rose-800/80">{detail}</p>}
            </div>
          </motion.div>
        );
      })}
      <div className="flex flex-wrap gap-2 pt-1">
        <a href="tel:112" className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700">
          🚑 Emergency 112
        </a>
        <a href="tel:14416" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50">
          📞 Tele-MANAS 14416 (24/7)
        </a>
      </div>
    </div>
  );
}

function Tips({ m }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-2">
      {m.goodToKnow.map((g, i) => {
        const { lead, rest } = splitSentence(g);
        const isOpen = open === i;
        return (
          <div key={g} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              disabled={!rest}
              className="flex w-full items-start gap-3 p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-default"
            >
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-slate-800">{lead}</span>
              {rest && (
                <span aria-hidden="true" className={`mt-0.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ⌄
                </span>
              )}
            </button>
            <AnimatePresence initial={false}>
              {isOpen && rest && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3.5 pb-3.5 pl-[3.25rem] text-sm text-slate-600"
                >
                  {rest}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      <details className="group rounded-2xl bg-lavender-50/70 p-3.5 ring-1 ring-lavender-100">
        <summary className="cursor-pointer list-none text-sm font-semibold text-lavender-800">
          🗒️ Questions to ask your doctor <span className="text-lavender-400 group-open:hidden">(tap to open)</span>
        </summary>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          {ASK_YOUR_DOCTOR.map((q) => (
            <li key={q} className="flex gap-2">
              <span aria-hidden="true" className="text-lavender-500">?</span>
              {q}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

const TABS = [
  { id: "benefits", label: "Benefits", icon: "🌱", Panel: Benefits },
  { id: "side", label: "Side effects", icon: "📋", Panel: SideEffects },
  { id: "warnings", label: "Warnings", icon: "⚠️", Panel: Warnings },
  { id: "tips", label: "Tips", icon: "💡", Panel: Tips },
];

export default function Medicine() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("benefits");

  useEffect(() => {
    setData(null);
    setError(null);
    setTab("benefits");
    fetchMedicine(slug)
      .then(setData)
      .catch((err) => setError(err.status === 404 ? "We don't have a guide for that medicine yet." : "Could not load this guide."));
  }, [slug]);

  const m = data?.medicine;
  const Panel = TABS.find((t) => t.id === tab).Panel;

  return (
    <PageShell bodyClassName="!px-0 !py-0">
      {error && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-600">{error}</p>
          <Link to="/medicines" className="mt-3 inline-block text-sm font-semibold text-blue-700 underline underline-offset-2">
            See all medicines
          </Link>
        </div>
      )}

      {!error && !m && (
        <div className="space-y-4 p-6">
          <div className="h-36 animate-pulse rounded-3xl bg-slate-100" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}

      {m && (
        <div className="pb-6">
          {/* Hero */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-lavender-600 px-4 pb-6 pt-4 text-white sm:px-6">
            <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <Link to="/medicines" className="relative inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25">
              ← All medicines
            </Link>
            <div className="relative mt-4 flex items-center gap-4">
              <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-inner">
                {data.category?.icon || "💊"}
              </span>
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-bold leading-tight">{m.name}</h1>
                <p className="text-sm text-blue-100">{m.kind}</p>
              </div>
            </div>
            <div className="relative mt-4 flex flex-wrap gap-1.5">
              {m.usedFor.map((u) => (
                <span key={u} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
                  {splitDetail(u).title}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4 sm:px-6">
            {/* At a glance */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Tile icon="🌱" label="Helps with" value={`${m.howItHelps.length} key benefits`} />
              <Tile icon="📋" label="Side effects" value={`${m.common.length} common`} tone="slate" />
              <Tile icon="⚠️" label="Watch for" value={`${m.serious.length} warning signs`} tone="rose" />
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
              <span aria-hidden="true">⚠️</span>
              General information only. Never start, stop or change a medicine without your doctor.
            </p>

            {/* Tabs */}
            <div role="tablist" aria-label={`${m.name} guide`} className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`relative rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:text-sm ${
                    tab === t.id ? "text-blue-900" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab === t.id && (
                    <motion.span layoutId="medicine-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                  )}
                  {/* Icon above the label on phones, so all four tabs fit. */}
                  <span className="relative flex flex-col items-center gap-0.5 sm:flex-row sm:justify-center sm:gap-1.5">
                    <span aria-hidden="true" className="text-base sm:text-sm">
                      {t.icon}
                    </span>
                    <span className="whitespace-nowrap">{t.label}</span>
                  </span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                id={`panel-${tab}`}
                role="tabpanel"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <Panel m={m} />
              </motion.div>
            </AnimatePresence>

            {/* CTA */}
            <div className="flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-br from-blue-700 to-lavender-700 p-5 text-white shadow-lg shadow-blue-900/20 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Questions about your own medicine?</p>
                <p className="text-sm text-blue-100">A Tulasi psychiatrist can talk through what's right for you.</p>
              </div>
              <Link to="/doctors" className="shrink-0 rounded-full bg-white px-5 py-2 text-sm font-semibold text-blue-800 shadow-sm transition-colors hover:bg-blue-50">
                Find a psychiatrist
              </Link>
            </div>

            <p className="text-center text-[11px] text-slate-500">
              {data.reviewedBy
                ? `Reviewed by ${data.reviewedBy}${data.reviewedOn ? ` on ${new Date(data.reviewedOn).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}.`
                : "General patient information based on standard prescribing guidance."}{" "}
              It doesn't cover every use, side effect or interaction.
            </p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
