import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import PageShell from "../components/PageShell.jsx";
import { MedicineDisclaimer } from "./Medicines.jsx";
import { fetchMedicine } from "../lib/guideApi.js";

const ASK_YOUR_DOCTOR = [
  "What is this medicine meant to help with for me?",
  "How long until I should notice a difference?",
  "Which side effects should I tell you about?",
  "What should I do if I miss a dose?",
  "Is it safe with my other medicines, alcohol, or if I become pregnant?",
  "How long will I need to take it, and how will we stop it when the time comes?",
];

function Section({ icon, title, children, tone = "default", delay = 0 }) {
  const styles = {
    default: "bg-white/80 ring-slate-100",
    warning: "bg-rose-50/80 ring-rose-200",
    good: "bg-teal-50/70 ring-teal-100",
  }[tone];
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={`rounded-2xl p-4 ring-1 sm:p-5 ${styles}`}
    >
      <h2 className="flex items-center gap-2 font-semibold text-blue-900">
        <span aria-hidden="true">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 text-sm text-slate-700">{children}</div>
    </motion.section>
  );
}

function Bullets({ items, marker = "•", markerClass = "text-blue-500" }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden="true" className={`mt-0.5 shrink-0 ${markerClass}`}>
            {marker}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Medicine() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetchMedicine(slug)
      .then(setData)
      .catch((err) => setError(err.status === 404 ? "We don't have a guide for that medicine yet." : "Could not load this guide."));
  }, [slug]);

  const m = data?.medicine;

  return (
    <PageShell
      header={
        <div className="flex items-start gap-3">
          <Link to="/medicines" className="mt-0.5 rounded-full p-1.5 text-blue-700 hover:bg-blue-50" aria-label="Back to the medicine guide">
            ←
          </Link>
          {m ? (
            <div className="min-w-0">
              <h1 className="break-words text-xl font-bold text-blue-900">{m.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">{m.kind}</span>
                {data.category && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700">
                    <span aria-hidden="true">{data.category.icon}</span> {data.category.label}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <h1 className="text-lg font-bold text-blue-900">Medicine guide</h1>
          )}
        </div>
      }
    >
      {error && (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-600">{error}</p>
          <Link to="/medicines" className="mt-3 inline-block text-sm font-semibold text-blue-700 underline underline-offset-2">
            See all medicines
          </Link>
        </div>
      )}

      {!error && !m && (
        <div className="mx-auto max-w-3xl space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {m && (
        <div className="mx-auto max-w-3xl space-y-4">
          <MedicineDisclaimer />

          <Section icon="🎯" title="Commonly used for">
            <div className="flex flex-wrap gap-2">
              {m.usedFor.map((u) => (
                <span key={u} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800 ring-1 ring-blue-100">
                  {u}
                </span>
              ))}
            </div>
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Section icon="🌱" title="How it may help" tone="good" delay={0.05}>
              <Bullets items={m.howItHelps} marker="✓" markerClass="font-bold text-teal-600" />
            </Section>
            <Section icon="⏳" title="When it starts working" delay={0.1}>
              <p>{m.timeToWork}</p>
            </Section>
          </div>

          <Section icon="📋" title="Common side effects" delay={0.15}>
            <Bullets items={m.common} />
            {m.commonNote && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{m.commonNote}</p>}
          </Section>

          <Section icon="🚨" title="Get medical help right away if you notice" tone="warning" delay={0.2}>
            <Bullets items={m.serious} marker="!" markerClass="font-bold text-rose-600" />
            <p className="mt-3 text-xs font-medium text-rose-800">
              In an emergency, call 112. For thoughts of suicide or self-harm, Tele-MANAS (14416) is free and open 24/7.
            </p>
          </Section>

          <Section icon="💡" title="Good to know" delay={0.25}>
            <Bullets items={m.goodToKnow} />
          </Section>

          <Section icon="🗒️" title="Questions you could ask your doctor" delay={0.3}>
            <Bullets items={ASK_YOUR_DOCTOR} marker="?" markerClass="font-bold text-lavender-600" />
          </Section>

          <div className="flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-br from-blue-700 to-lavender-700 p-5 text-white shadow-lg shadow-blue-900/20 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Questions about your own medicine?</p>
              <p className="text-sm text-blue-100">A Tulasi psychiatrist can talk through what's right for you.</p>
            </div>
            <Link to="/doctors" className="shrink-0 rounded-full bg-white px-5 py-2 text-sm font-semibold text-blue-800 shadow-sm transition-colors hover:bg-blue-50">
              Find a psychiatrist
            </Link>
          </div>

          <p className="pb-2 text-center text-xs text-slate-500">
            {data.reviewedBy
              ? `Reviewed by ${data.reviewedBy}${data.reviewedOn ? ` on ${new Date(data.reviewedOn).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}.`
              : "General patient information based on standard prescribing guidance."}{" "}
            It doesn't cover every use, side effect or interaction.
          </p>
        </div>
      )}
    </PageShell>
  );
}
