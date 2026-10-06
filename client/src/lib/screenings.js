// Self check-ins: standard, validated screening questionnaires, scored here
// on the device. Answers are never sent to the server or the model.
//
//   PHQ-9 (depression) and GAD-7 (anxiety): developed by Drs. Spitzer,
//   Williams, Kroenke and colleagues with an educational grant from Pfizer.
//   No permission is required to reproduce, translate, display or distribute.
//   AUDIT (alcohol use): World Health Organization, free to use.
//
// Scores and cut-offs follow the published scoring guides. These are
// screening tools, not diagnoses, and the results page says so.

const FREQUENCY = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

const AUDIT_FREQUENCY = [
  { label: "Never", value: 0 },
  { label: "Less than monthly", value: 1 },
  { label: "Monthly", value: 2 },
  { label: "Weekly", value: 3 },
  { label: "Daily or almost daily", value: 4 },
];

const AUDIT_HARM = [
  { label: "No", value: 0 },
  { label: "Yes, but not in the last year", value: 2 },
  { label: "Yes, during the last year", value: 4 },
];

// tone -> colours on the results page: calm, mild, moderate, high.
export const SCREENINGS = {
  depression: {
    id: "depression",
    title: "Depression check-in",
    measure: "PHQ-9",
    icon: "🌧️",
    blurb: "Nine questions about mood, sleep, energy and interest in things.",
    minutes: 2,
    timeframe: "Over the last 2 weeks, how often have you been bothered by…",
    specialty: "depression",
    source: "PHQ-9 (Kroenke, Spitzer & Williams). Free to use.",
    // Item 9 asks about thoughts of death or self-harm: any answer above
    // "Not at all" shows crisis support, whatever the total.
    crisisItem: 8,
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself, or that you are a failure or have let yourself or your family down",
      "Trouble concentrating on things, such as reading the newspaper or watching television",
      "Moving or speaking so slowly that other people could have noticed, or the opposite: being so fidgety or restless that you have been moving around a lot more than usual",
      "Thoughts that you would be better off dead, or of hurting yourself in some way",
    ].map((text) => ({ text, options: FREQUENCY })),
    bands: [
      {
        max: 4,
        label: "Minimal",
        tone: "calm",
        summary: "Your answers suggest few or no signs of depression right now.",
        next: ["Keep doing the things that help you feel well.", "If things change, you can check in again any time."],
      },
      {
        max: 9,
        label: "Mild",
        tone: "mild",
        summary: "Your answers suggest some mild signs of depression.",
        next: [
          "Talking it through can help: with someone you trust, with Tulasi in the chat, or with a counsellor.",
          "Small routines like sleep, daylight, movement and time with people make a real difference.",
          "Check in again in a couple of weeks to see how things are going.",
        ],
      },
      {
        max: 14,
        label: "Moderate",
        tone: "moderate",
        summary: "Your answers suggest moderate signs of depression.",
        next: [
          "We'd recommend speaking with a mental-health professional, who can understand what's going on and talk you through options.",
          "Depression is very treatable, and getting support early helps.",
        ],
      },
      {
        max: 19,
        label: "Moderately severe",
        tone: "high",
        summary: "Your answers suggest moderately severe signs of depression.",
        next: [
          "Please consider seeing a psychiatrist or psychologist soon.",
          "Treatment for depression works well, and you don't have to manage this on your own.",
        ],
      },
      {
        max: 27,
        label: "Severe",
        tone: "high",
        summary: "Your answers suggest severe signs of depression.",
        next: [
          "Please reach out to a mental-health professional as soon as you can, ideally in the next few days.",
          "If you ever feel unsafe, use the help numbers on this page right away.",
        ],
      },
    ],
  },

  anxiety: {
    id: "anxiety",
    title: "Anxiety check-in",
    measure: "GAD-7",
    icon: "🌀",
    blurb: "Seven questions about worry, tension and feeling on edge.",
    minutes: 2,
    timeframe: "Over the last 2 weeks, how often have you been bothered by…",
    specialty: "anxiety",
    source: "GAD-7 (Spitzer, Kroenke, Williams & Löwe). Free to use.",
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless that it is hard to sit still",
      "Becoming easily annoyed or irritable",
      "Feeling afraid, as if something awful might happen",
    ].map((text) => ({ text, options: FREQUENCY })),
    bands: [
      {
        max: 4,
        label: "Minimal",
        tone: "calm",
        summary: "Your answers suggest little or no anxiety right now.",
        next: ["Keep doing what helps you feel settled.", "If things change, you can check in again any time."],
      },
      {
        max: 9,
        label: "Mild",
        tone: "mild",
        summary: "Your answers suggest some mild anxiety.",
        next: [
          "Slow breathing, grounding and regular movement can take the edge off. Tulasi can walk you through one in the chat.",
          "Check in again in a couple of weeks to see how things are going.",
        ],
      },
      {
        max: 14,
        label: "Moderate",
        tone: "moderate",
        summary: "Your answers suggest moderate anxiety.",
        next: [
          "Speaking with a mental-health professional could really help. Therapies like CBT work well for anxiety.",
          "You don't have to wait until it gets worse to ask for support.",
        ],
      },
      {
        max: 21,
        label: "Severe",
        tone: "high",
        summary: "Your answers suggest severe anxiety.",
        next: [
          "Please consider seeing a psychiatrist or psychologist soon. Anxiety this strong is very treatable.",
          "If it ever feels overwhelming or unsafe, use the help numbers on this page.",
        ],
      },
    ],
  },

  alcohol: {
    id: "alcohol",
    title: "Alcohol use check-in",
    measure: "AUDIT",
    icon: "🌱",
    blurb: "Ten questions about how much and how often you drink, and how it affects you.",
    minutes: 3,
    timeframe: "Thinking about the past year…",
    note: "One drink = one small peg (30 ml) of whisky or rum, one glass of wine, or one regular (330 ml) can of beer. A large (650 ml) bottle of beer is about two drinks.",
    specialty: "addiction",
    source: "AUDIT, World Health Organization. Free to use.",
    questions: [
      {
        text: "How often do you have a drink containing alcohol?",
        options: [
          { label: "Never", value: 0 },
          { label: "Monthly or less", value: 1 },
          { label: "2–4 times a month", value: 2 },
          { label: "2–3 times a week", value: 3 },
          { label: "4 or more times a week", value: 4 },
        ],
      },
      {
        text: "How many drinks do you have on a typical day when you are drinking?",
        options: [
          { label: "1 or 2", value: 0 },
          { label: "3 or 4", value: 1 },
          { label: "5 or 6", value: 2 },
          { label: "7 to 9", value: 3 },
          { label: "10 or more", value: 4 },
        ],
      },
      { text: "How often do you have six or more drinks on one occasion?", options: AUDIT_FREQUENCY },
      { text: "How often during the last year have you found that you were not able to stop drinking once you had started?", options: AUDIT_FREQUENCY },
      { text: "How often during the last year have you failed to do what was normally expected of you because of drinking?", options: AUDIT_FREQUENCY },
      {
        text: "How often during the last year have you needed a first drink in the morning to get yourself going after a heavy drinking session?",
        options: AUDIT_FREQUENCY,
      },
      { text: "How often during the last year have you had a feeling of guilt or remorse after drinking?", options: AUDIT_FREQUENCY },
      {
        text: "How often during the last year have you been unable to remember what happened the night before because of your drinking?",
        options: AUDIT_FREQUENCY,
      },
      { text: "Have you or someone else been injured because of your drinking?", options: AUDIT_HARM },
      {
        text: "Has a relative, friend, doctor or other health worker been concerned about your drinking or suggested you cut down?",
        options: AUDIT_HARM,
      },
    ],
    // WHO scoring guide: no drinking at all ends the questionnaire; if
    // questions 2 and 3 both score 0, skip to questions 9 and 10.
    // Until a deciding answer is in, assume the question will be asked, so
    // the "Question 1 of 10" count only ever shrinks, never jumps up.
    isAsked: (answers, index) => {
      if (index === 0) return true;
      if (answers[0] === 0) return false;
      if (index >= 3 && index <= 7) {
        if (answers[1] === undefined || answers[2] === undefined) return true;
        return answers[1] + answers[2] > 0;
      }
      return true;
    },
    bands: [
      {
        max: 7,
        label: "Lower risk",
        tone: "calm",
        summary: "Your answers suggest your drinking is at a lower-risk level.",
        next: ["Lower risk isn't no risk. Keeping drinking light and having alcohol-free days helps.", "You can check in again any time."],
      },
      {
        max: 15,
        label: "Increasing risk",
        tone: "mild",
        summary: "Your answers suggest your drinking may be starting to put your health at risk.",
        next: [
          "Cutting down now can make a real difference to sleep, mood, health and relationships.",
          "Setting alcohol-free days and tracking what you drink are good first steps. A counsellor can help you make a plan.",
        ],
      },
      {
        max: 19,
        label: "Higher risk",
        tone: "moderate",
        summary: "Your answers suggest your drinking is likely already causing harm.",
        next: [
          "We'd recommend talking to a doctor or de-addiction specialist about cutting down or stopping.",
          "Support works: counselling, and sometimes medicines that reduce cravings.",
        ],
      },
      {
        max: 40,
        label: "Possible dependence",
        tone: "high",
        summary: "Your answers suggest your drinking may have become a dependence.",
        next: [
          "Please speak to a doctor before cutting down or stopping. After heavy daily drinking, stopping suddenly can be dangerous. Medically supervised detox makes it safe.",
          "Tulasi Health Care runs a dedicated de-addiction programme. Recovery is very possible with the right support.",
        ],
      },
    ],
  },
};

export const SCREENING_LIST = Object.values(SCREENINGS);

/** Whether question `index` is part of the questionnaire, given the answers so far. */
export function isAsked(screening, answers, index) {
  return screening.isAsked ? screening.isAsked(answers, index) : true;
}

/** The next question to ask after `index`, or -1 when the questionnaire is done. */
export function nextQuestion(screening, answers, index) {
  for (let i = index + 1; i < screening.questions.length; i++) {
    if (isAsked(screening, answers, i)) return i;
  }
  return -1;
}

/** The previous question that was asked before `index`, or -1. */
export function previousQuestion(screening, answers, index) {
  for (let i = index - 1; i >= 0; i--) {
    if (isAsked(screening, answers, i)) return i;
  }
  return -1;
}

/** How many questions will be asked, given the answers so far (for the progress bar). */
export function askedCount(screening, answers) {
  return screening.questions.filter((_, i) => isAsked(screening, answers, i)).length;
}

export function maxScore(screening) {
  return screening.questions.reduce((sum, q) => sum + Math.max(...q.options.map((o) => o.value)), 0);
}

/**
 * @param {object} screening - one of SCREENINGS
 * @param {number[]} answers - option values by question index (skipped questions count 0)
 */
export function scoreScreening(screening, answers) {
  const score = screening.questions.reduce((sum, _, i) => sum + (isAsked(screening, answers, i) ? answers[i] || 0 : 0), 0);
  const band = screening.bands.find((b) => score <= b.max) || screening.bands[screening.bands.length - 1];
  const crisis = screening.crisisItem !== undefined && (answers[screening.crisisItem] || 0) > 0;
  return { score, max: maxScore(screening), band, crisis };
}
