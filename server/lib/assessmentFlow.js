// Runs an in-chat screening (lib/assessments.js) one question at a time.
// Same design as the booking flow: deterministic, tappable answers, and the
// turns are kept private (never sent to the model): only a one-line summary
// of the result goes to it, so it can follow up naturally.
import { ASSESSMENTS, detectAssessmentIntent, parseAnswer } from "./assessments.js";
import { getDoctorsForSpecialties } from "./doctors.js";
import { getCrisisResources } from "./crisisResources.js";

const STOP = "Stop";
const region = process.env.CRISIS_REGION || "IN";

function questionReply(def, index, lead = "") {
  const q = def.questions[index];
  const prompt = def.prompt && !q.noPrompt ? `_${def.prompt}_\n\n` : "";
  const hint = q.hint ? ` _(${q.hint})_` : "";
  const list = q.list ? `\n\n${q.list.map((item) => `- ${item}`).join("\n")}` : "";
  return {
    handled: true,
    reply: `${lead}${prompt}**${q.text}**${hint}${list}`,
    quickReplies: [...q.options.map((o) => o.label), STOP],
    progress: { title: def.title, current: index + 1, total: def.questions.length },
  };
}

function finish(session, def, answers) {
  session.assessment = null;
  const r = def.score(answers);
  // "A psychiatrist can confirm it": for a likely result (or any crisis
  // flag), psychiatrists come first, since psychologists can't diagnose or
  // prescribe. For milder results, whoever matches best.
  const wantsPsychiatrist = r.likelihood === "likely" || r.crisis;
  const pool = r.suggestDoctors ? getDoctorsForSpecialties([def.specialty], 10) : [];
  const ranked = wantsPsychiatrist ? [...pool].sort((a, b) => /psychiatrist/i.test(b.role) - /psychiatrist/i.test(a.role)) : pool;
  const doctors = ranked.slice(0, 2);
  if (doctors.length) session.lastRecommendedDoctors = doctors;
  const card = {
    id: def.id,
    title: def.title,
    tool: def.tool,
    likelihood: r.likelihood,
    label: r.label,
    headline: r.headline,
    points: r.points,
    next: r.next,
    score: r.score || null,
    disclaimer: r.disclaimer,
    ...(r.crisis && { crisisLines: getCrisisResources(region).lines }),
  };
  // Plain-text version: what's saved, read aloud, and shown by any client
  // that doesn't draw the card.
  const reply = r.urgent
    ? "**Please get medical help now.** Call **112** or go to the nearest emergency department. Don't drive yourself."
    : `Thank you for answering. Here's what your answers suggest. **${def.title}: ${r.label}.**`;
  return {
    handled: true,
    reply,
    assessment: card,
    doctors,
    crisis: !!(r.crisis || r.urgent),
    quickReplies: r.urgent ? [] : r.suggestDoctors ? ["Book an appointment", "Talk about it"] : ["Talk about it"],
    llmNote: `The person just completed an in-chat ${def.title} (${def.tool}). Result shown to them: "${r.label}" (${r.headline}) This was a screening, not a diagnosis; don't diagnose, and follow up gently if they want to talk about it.`,
  };
}

/**
 * @returns {Promise<{handled: false} | {handled: true, reply: string, quickReplies?: string[], progress?: object, assessment?: object, doctors?: object[], crisis?: boolean, llmNote?: string}>}
 */
export async function handleAssessmentTurn(session, message) {
  const state = session.assessment;
  if (!state) {
    const id = detectAssessmentIntent(message);
    if (!id) return { handled: false };
    const def = ASSESSMENTS[id];
    session.assessment = { id, index: 0, answers: [] };
    return questionReply(def, 0, `${def.intro}\n\n`);
  }

  const def = ASSESSMENTS[state.id];
  const question = def.questions[state.index];
  const option = parseAnswer(question, message);
  if (!option) return questionReply(def, state.index, "Please pick one of the options below (or say **stop**).\n\n");

  state.answers[state.index] = option.value;
  if (def.stopAfter?.(state.answers, state.index) || state.index === def.questions.length - 1) {
    return finish(session, def, state.answers);
  }
  state.index += 1;
  return questionReply(def, state.index);
}

export function abandonAssessment(session) {
  session.assessment = null;
}

export function assessmentActive(session) {
  return !!session.assessment;
}

/** True when the message answers the screening's current question. */
export function answersCurrentQuestion(session, message) {
  const state = session.assessment;
  if (!state) return false;
  return !!parseAnswer(ASSESSMENTS[state.id].questions[state.index], message);
}
