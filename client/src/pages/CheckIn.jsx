import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import PageShell from "../components/PageShell.jsx";
import { SCREENINGS, scoreScreening, nextQuestion, previousQuestion, askedCount, isAsked } from "../lib/screenings.js";
import { saveResult } from "../lib/guideApi.js";
import { fetchDoctors } from "../lib/bookingApi.js";
import { getCrisisResources } from "../lib/crisisResources.js";
import { toneOf } from "../lib/tones.js";

function Intro({ screening, onStart }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-6 text-center">
      <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-50 to-lavender-100 text-4xl shadow-inner">
        {screening.icon}
      </span>
      <h2 className="mt-4 text-xl font-bold text-blue-900">{screening.title}</h2>
      <p className="mt-2 text-slate-600">{screening.blurb}</p>
      <ul className="mt-6 w-full space-y-2 text-left text-sm text-slate-700">
        {[
          ["⏱️", `${screening.questions.length} short questions, about ${screening.minutes} minutes`],
          ["🔒", "Your answers stay on this device. Nothing is sent or saved online."],
          ["🩺", "It's a screening, not a diagnosis. It helps you decide whether to talk to someone."],
          ["💬", "Answer for how things have actually been, not how you think they should be."],
        ].map(([icon, text]) => (
          <li key={text} className="flex items-start gap-3 rounded-xl bg-white/70 px-4 py-3 ring-1 ring-slate-100">
            <span aria-hidden="true">{icon}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-full bg-blue-700 px-6 py-3 font-semibold text-white shadow-md shadow-blue-900/20 transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 sm:w-auto"
      >
        Begin
      </button>
      <p className="mt-4 text-[11px] text-slate-400">{screening.source}</p>
    </div>
  );
}

function Question({ screening, index, answers, onAnswer, onBack }) {
  const reduceMotion = useReducedMotion();
  const headingRef = useRef(null);
  const question = screening.questions[index];
  const total = askedCount(screening, answers);
  const position = screening.questions.slice(0, index + 1).filter((_, i) => isAsked(screening, answers, i)).length;
  const selected = answers[index];

  // Each new question is announced and keyboard focus starts at it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  // 1–5 on a keyboard picks an answer.
  useEffect(() => {
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= question.options.length && !e.metaKey && !e.ctrlKey) onAnswer(question.options[n - 1].value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, onAnswer]);

  return (
    <div className="mx-auto max-w-xl py-2">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
          <button type="button" onClick={onBack} className="rounded-full px-2 py-1 text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
            ← Back
          </button>
          <span aria-live="polite">
            Question {position} of {total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={position - 1} aria-label="Progress">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-lavender-500"
            initial={false}
            animate={{ width: `${((position - 1) / total) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <p className="text-sm text-slate-500">{screening.timeframe}</p>
          <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-lg font-semibold leading-snug text-blue-900 focus:outline-none sm:text-xl">
            {question.text}
          </h2>
          {index === 0 && screening.note && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{screening.note}</p>}

          <div className="mt-5 space-y-2.5" role="radiogroup" aria-label={question.text}>
            {question.options.map((option, i) => {
              const isSelected = selected === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onAnswer(option.value)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[15px] transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm"
                      : "border-slate-200 bg-white/80 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? "border-blue-600" : "border-slate-300 group-hover:border-blue-400"}`}
                  >
                    {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                  </span>
                  <span className="flex-1">{option.label}</span>
                  <span aria-hidden="true" className="hidden text-xs text-slate-300 sm:inline">
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BandMeter({ screening, score }) {
  // Segments sized by each band's share of the score range, marker at the score.
  const max = screening.bands[screening.bands.length - 1].max;
  let from = 0;
  const segments = screening.bands.map((b) => {
    const seg = { ...b, from, width: ((b.max - from + 1) / (max + 1)) * 100 };
    from = b.max + 1;
    return seg;
  });
  const markerLeft = ((score + 0.5) / (max + 1)) * 100;
  return (
    <div className="mt-5" aria-hidden="true">
      <div className="relative">
        <div className="flex h-3 overflow-hidden rounded-full">
          {segments.map((s) => (
            <div key={s.label} className={`${toneOf(s.tone).bar} opacity-70`} style={{ width: `${s.width}%` }} />
          ))}
        </div>
        <motion.div
          className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded-full bg-slate-800 ring-2 ring-white"
          initial={{ left: "0%" }}
          animate={{ left: `${markerLeft}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      {/* A legend rather than labels under each segment: narrow bands
          ("Higher risk" spans 4 of AUDIT's 40 points) can't fit a label. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
        {segments.map((s) => {
          const current = score >= s.from && score <= s.max;
          return (
            <li key={s.label} className={`flex items-center gap-1.5 ${current ? "font-semibold text-slate-900" : ""}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${toneOf(s.tone).bar}`} />
              {s.label}
              <span className="text-slate-400">
                {s.from}–{s.max}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CrisisCard() {
  const resources = getCrisisResources();
  return (
    <div role="alert" className="mb-5 rounded-2xl border border-crisis/25 bg-crisis/5 p-4 sm:p-5">
      <p className="font-semibold text-crisis-dark">You mentioned thoughts of being better off dead or of hurting yourself.</p>
      <p className="mt-1 text-sm text-slate-700">
        Thank you for being honest. That takes courage. You deserve support right now, not later. Please reach out to one of these, or to someone you trust:
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {resources.lines.map((line) => (
          <li key={line.name}>
            <a
              href={`tel:${line.phone.replace(/\s/g, "")}`}
              className="flex flex-col rounded-xl bg-white px-3 py-2.5 ring-1 ring-crisis/20 transition-colors hover:bg-crisis/5"
            >
              <span className="text-xs text-slate-600">{line.name}</span>
              <span className="text-lg font-bold text-crisis-dark">{line.phone}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Result({ screening, answers, onRetake }) {
  const navigate = useNavigate();
  const result = useMemo(() => scoreScreening(screening, answers), [screening, answers]);
  const tone = toneOf(result.band.tone);
  const [doctors, setDoctors] = useState(null);

  useEffect(() => {
    saveResult(screening.id, { score: result.score, max: result.max, label: result.band.label, tone: result.band.tone });
  }, [screening.id, result]);

  // Specialists only once the result suggests talking to someone.
  const suggestDoctors = result.band.tone !== "calm" || result.crisis;
  useEffect(() => {
    if (!suggestDoctors) return;
    fetchDoctors({ specialty: screening.specialty })
      .then((data) => setDoctors((data.doctors || []).slice(0, 3)))
      .catch(() => setDoctors([]));
  }, [screening.specialty, suggestDoctors]);

  const talkItThrough = () =>
    navigate("/", {
      state: { prefill: `I just did the ${screening.title.toLowerCase()} and my result was "${result.band.label}". Can we talk about it?` },
    });

  return (
    <div className="mx-auto max-w-2xl py-2">
      {result.crisis && <CrisisCard />}

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`rounded-3xl border p-5 sm:p-6 ${tone.soft}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Your {screening.measure} result
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${tone.badge}`}>{result.band.label}</span>
          <span className="text-sm text-slate-600">
            Score <span className="font-semibold text-slate-800">{result.score}</span> of {result.max}
          </span>
        </div>
        <p className={`mt-3 text-lg font-semibold leading-snug ${tone.text}`}>{result.band.summary}</p>
        <BandMeter screening={screening} score={result.score} />
      </motion.div>

      <section className="mt-5 rounded-2xl bg-white/80 p-5 ring-1 ring-slate-100">
        <h3 className="font-semibold text-blue-900">What you could do next</h3>
        <ul className="mt-3 space-y-2.5">
          {result.band.next.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-slate-700">
              <span aria-hidden="true" className="mt-0.5 text-blue-500">✦</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={talkItThrough}
            className="rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          >
            💬 Talk it through with Tulasi
          </button>
          <button
            type="button"
            onClick={onRetake}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            Retake
          </button>
          <Link to="/check-in" className="rounded-full px-5 py-2.5 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50">
            All check-ins
          </Link>
        </div>
      </section>

      {suggestDoctors && doctors?.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-3 font-semibold text-blue-900">Tulasi specialists who can help</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {doctors.map((d) => (
              <Link
                key={d._id}
                to={`/doctors/${d._id}`}
                className="group flex items-center gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-col sm:text-center"
              >
                {d.photo ? (
                  <img src={d.photo} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-blue-100 sm:h-16 sm:w-16" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 sm:h-16 sm:w-16">
                    {d.name.replace(/^(Dr\.|Ms\.|Mr\.)\s*(\([^)]*\)\s*)?/i, "").charAt(0)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold leading-snug text-blue-900">{d.name}</span>
                  <span className="block text-xs text-slate-500">{d.role}</span>
                  <span className="mt-1 block text-xs font-semibold text-blue-700 group-hover:underline">Book →</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        This is a screening tool, not a diagnosis. Many things, including stress, physical health and life events, can affect a score. Only a qualified
        professional can assess what's going on. <br />
        <span className="text-slate-400">{screening.source}</span>
      </p>
    </div>
  );
}

export default function CheckIn() {
  const { id } = useParams();
  const screening = SCREENINGS[id];
  const [stage, setStage] = useState("intro"); // intro | question | result
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  // Set during the short pause after an answer, so a double tap can't answer
  // the next question too.
  const advancingRef = useRef(false);

  if (!screening) return <Navigate to="/check-in" replace />;

  const start = () => {
    setAnswers([]);
    setIndex(0);
    setStage("question");
  };

  const answer = (value) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const next = [...answers];
    next[index] = value;
    setAnswers(next);
    // A short pause so the chosen answer visibly registers before moving on.
    setTimeout(() => {
      advancingRef.current = false;
      const following = nextQuestion(screening, next, index);
      if (following === -1) setStage("result");
      else setIndex(following);
    }, 220);
  };

  const back = () => {
    const previous = previousQuestion(screening, answers, index);
    if (previous === -1) setStage("intro");
    else setIndex(previous);
  };

  return (
    <PageShell
      header={
        <div className="flex items-center gap-3">
          <Link to="/check-in" className="rounded-full p-1.5 text-blue-700 hover:bg-blue-50" aria-label="All check-ins">
            ←
          </Link>
          <div>
            <h1 className="text-lg font-bold text-blue-900">{screening.title}</h1>
            <p className="text-xs text-blue-600/70">{screening.measure} · private to this device</p>
          </div>
        </div>
      }
    >
      {stage === "intro" && <Intro screening={screening} onStart={start} />}
      {stage === "question" && <Question screening={screening} index={index} answers={answers} onAnswer={answer} onBack={back} />}
      {stage === "result" && <Result screening={screening} answers={answers} onRetake={start} />}
    </PageShell>
  );
}
