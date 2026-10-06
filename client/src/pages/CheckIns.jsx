import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PageShell from "../components/PageShell.jsx";
import { SCREENING_LIST } from "../lib/screenings.js";
import { getLastResults, forgetResults } from "../lib/guideApi.js";
import { toneOf } from "../lib/tones.js";

const formatDay = (ms) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function CheckIns() {
  const [last, setLast] = useState(getLastResults);
  const hasHistory = Object.keys(last).length > 0;

  return (
    <PageShell title="Self check-ins" subtitle="A few quiet minutes to reflect on how things have really been.">
      <div className="mb-5 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
        <span aria-hidden="true" className="text-xl">🔒</span>
        <div className="space-y-1">
          <p className="font-semibold">Private, and not a diagnosis</p>
          <p className="text-blue-800/80">
            These are standard questionnaires that doctors use for screening. Your answers stay on this device and aren't sent anywhere.
            A result can help you decide whether to talk to someone, but only a professional can diagnose.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCREENING_LIST.map((s, i) => {
          const result = last[s.id];
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
              className="glass depth-shadow flex flex-col gap-3 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-lavender-100 text-2xl">
                  {s.icon}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-slate-600">{s.measure}</span>
              </div>
              <div>
                <h2 className="font-semibold text-blue-900">{s.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{s.blurb}</p>
              </div>
              <p className="text-xs text-slate-500">
                {s.questions.length} questions · about {s.minutes} min
              </p>
              {result && (
                <p className="text-xs text-slate-600">
                  Last time ({formatDay(result.at)}):{" "}
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${toneOf(result.tone).badge}`}>{result.label}</span>
                </p>
              )}
              <Link
                to={`/check-in/${s.id}`}
                className="mt-auto rounded-full bg-blue-700 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm shadow-blue-900/20 transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                {result ? "Check in again" : "Start"}
              </Link>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-slate-500">
        <p>
          Worried about someone else? <Link to="/" className="font-medium text-blue-700 underline underline-offset-2">Talk it through with Tulasi</Link>.
        </p>
        {hasHistory && (
          <button
            type="button"
            onClick={() => {
              forgetResults();
              setLast({});
            }}
            className="text-slate-400 underline underline-offset-2 hover:text-slate-600"
          >
            Forget my past results on this device
          </button>
        )}
      </div>
    </PageShell>
  );
}
