// In-chat screenings: when someone says "I think I have OCD" or "I feel
// dizzy", the chat asks a few tap-to-answer questions and then shows what the
// answers suggest. Questions and scoring are plain code taken from validated
// screening tools, never the model's judgment, and results say clearly that a
// professional confirms any diagnosis.
//
//   OCD:        OCI-4 (Abramowitz et al., 2010; cut-off 4) plus two DSM-style
//               impact questions (time taken, interference)
//   Depression: PHQ-9 (Kroenke, Spitzer & Williams), free to use
//   Anxiety:    GAD-7 (Spitzer et al.), free to use
//   ADHD:       ASRS v1.1 screener, Part A (WHO), free to use
//   PTSD:       PC-PTSD-5 (US VA National Center for PTSD), public domain;
//               3 = screen-positive cut-off ("Possible"), 4+ "Likely"
//   Alcohol:    AUDIT-C (WHO AUDIT, first three questions)
//   Dizziness:  a triage, not a validated scale: danger signs first, then
//               common triggers. It points to likely causes and how urgently
//               to see a doctor; it never says "it's nothing".

const opts = (labels, values = labels.map((_, i) => i)) => labels.map((label, i) => ({ label, value: values[i] }));

const FREQ = opts(["Not at all", "Several days", "More than half the days", "Nearly every day"]);
const OCI = opts(["Not at all", "A little", "Moderately", "A lot", "Extremely"]);
const ASRS = opts(["Never", "Rarely", "Sometimes", "Often", "Very often"]);
const YES_NO = opts(["Yes", "No"], [1, 0]);

const sum = (answers, from = 0, to = answers.length) => answers.slice(from, to).reduce((a, b) => a + (b || 0), 0);

const NOT_A_DIAGNOSIS = "This is a screening, not a diagnosis. Only a doctor can confirm what's going on.";

// likelihood: "low" | "possible" | "likely" | "urgent" (drives the card's colour)
function result(fields) {
  return { next: [], points: [], disclaimer: NOT_A_DIAGNOSIS, ...fields };
}

export const ASSESSMENTS = {
  ocd: {
    id: "ocd",
    title: "OCD screening",
    tool: "OCI-4",
    specialty: "ocd",
    intro:
      "Let's look into that together. I'll ask **6 quick questions** about common OCD experiences. Just tap an answer. It takes about a minute, and you can say **stop** at any time.",
    prompt: "In the past month, how much has this bothered you?",
    questions: [
      { text: "I check things more often than necessary.", hint: "e.g. locks, switches, the gas", options: OCI },
      { text: "I get upset if objects are not arranged properly.", options: OCI },
      { text: "I feel compelled to count while I am doing things.", options: OCI },
      { text: "I find it difficult to control my own thoughts.", hint: "unwanted thoughts that keep coming back", options: OCI },
      { text: "On a typical day, how much time do these thoughts or habits take up?", options: opts(["Less than an hour", "1–3 hours", "More than 3 hours"]), noPrompt: true },
      { text: "How much do they get in the way of work, studies or family life?", options: opts(["Not much", "Somewhat", "A lot"]), noPrompt: true },
    ],
    score(a) {
      const oci = sum(a, 0, 4);
      const impact = (a[4] || 0) >= 1 || (a[5] || 0) >= 1;
      const points = [];
      if ((a[0] || 0) >= 2) points.push("Checking things more than needed");
      if ((a[1] || 0) >= 2) points.push("Distress when things aren't arranged right");
      if ((a[2] || 0) >= 2) points.push("Urges to count");
      if ((a[3] || 0) >= 2) points.push("Unwanted thoughts that are hard to control");
      if ((a[4] || 0) >= 1) points.push("Takes up an hour or more a day");
      if ((a[5] || 0) >= 1) points.push("Gets in the way of daily life");
      if (oci >= 4 && impact)
        return result({
          likelihood: "likely",
          label: "Likely",
          headline: "Your answers show several signs that are common in OCD, and they're taking real time out of your life.",
          points,
          next: [
            "OCD is very treatable. A therapy called ERP, and sometimes medicine, helps most people a lot.",
            "A psychiatrist can confirm it and plan treatment with you.",
          ],
          score: { value: oci, max: 16 },
          suggestDoctors: true,
        });
      if (oci >= 4 || (impact && oci >= 2))
        return result({
          likelihood: "possible",
          label: "Possible",
          headline: "Your answers show some signs that can be part of OCD.",
          points,
          next: ["It's worth talking to a specialist, especially if it's getting worse or upsetting you."],
          score: { value: oci, max: 16 },
          suggestDoctors: true,
        });
      return result({
        likelihood: "low",
        label: "Unlikely",
        headline: "Your answers don't show the usual pattern of OCD.",
        points,
        next: ["Everyone double-checks or has odd thoughts sometimes. That's normal.", "If something specific is worrying you, I'm happy to talk it through."],
        score: { value: oci, max: 16 },
      });
    },
  },

  depression: {
    id: "depression",
    title: "Depression screening",
    tool: "PHQ-9",
    specialty: "depression",
    intro:
      "Let's check in on that properly. I'll ask **9 quick questions** about the last 2 weeks. Just tap an answer, and you can say **stop** at any time.",
    prompt: "Over the last 2 weeks, how often have you been bothered by…",
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself, or that you are a failure or have let yourself or your family down",
      "Trouble concentrating on things, such as reading or watching TV",
      "Moving or speaking so slowly that others could notice, or being so restless that you move around a lot more than usual",
      "Thoughts that you would be better off dead, or of hurting yourself in some way",
    ].map((text) => ({ text, options: FREQ })),
    score(a) {
      const s = sum(a);
      const crisis = (a[8] || 0) > 0;
      const base = { score: { value: s, max: 27 }, crisis };
      if (s >= 20)
        return result({ ...base, likelihood: "likely", label: "Likely · severe", headline: "Your answers suggest severe depression.", next: ["Please see a psychiatrist as soon as you can, ideally in the next few days.", "Depression is very treatable, and you don't have to manage this on your own."], suggestDoctors: true });
      if (s >= 15)
        return result({ ...base, likelihood: "likely", label: "Likely · moderately severe", headline: "Your answers suggest moderately severe depression.", next: ["Please consider seeing a psychiatrist or psychologist soon.", "Treatment works well, and getting support early helps."], suggestDoctors: true });
      if (s >= 10)
        return result({ ...base, likelihood: "likely", label: "Likely · moderate", headline: "Your answers suggest moderate depression.", next: ["Speaking with a mental-health professional would really help.", "Depression is very treatable."], suggestDoctors: true });
      if (s >= 5)
        return result({ ...base, likelihood: "possible", label: "Possible · mild", headline: "Your answers suggest some mild signs of depression.", next: ["Talking it through, with me, someone you trust or a counsellor, can help.", "Sleep, daylight, movement and time with people make a real difference."], suggestDoctors: crisis });
      return result({ ...base, likelihood: "low", label: "Unlikely", headline: "Your answers suggest few or no signs of depression right now.", next: ["Keep doing what helps you feel well.", "If things change, just tell me and we can check again."], suggestDoctors: crisis });
    },
  },

  anxiety: {
    id: "anxiety",
    title: "Anxiety screening",
    tool: "GAD-7",
    specialty: "anxiety",
    intro: "Let's look at that together. I'll ask **7 quick questions** about the last 2 weeks. Just tap an answer, and you can say **stop** at any time.",
    prompt: "Over the last 2 weeks, how often have you been bothered by…",
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless that it's hard to sit still",
      "Becoming easily annoyed or irritable",
      "Feeling afraid, as if something awful might happen",
    ].map((text) => ({ text, options: FREQ })),
    score(a) {
      const s = sum(a);
      const base = { score: { value: s, max: 21 } };
      if (s >= 15)
        return result({ ...base, likelihood: "likely", label: "Likely · severe", headline: "Your answers suggest severe anxiety.", next: ["Please consider seeing a psychiatrist or psychologist soon. Anxiety this strong is very treatable."], suggestDoctors: true });
      if (s >= 10)
        return result({ ...base, likelihood: "likely", label: "Likely · moderate", headline: "Your answers suggest moderate anxiety.", next: ["Therapies like CBT work really well for anxiety. A specialist can help you get started."], suggestDoctors: true });
      if (s >= 5)
        return result({ ...base, likelihood: "possible", label: "Possible · mild", headline: "Your answers suggest some mild anxiety.", next: ["Slow breathing and grounding can take the edge off. I can walk you through one now if you like."] });
      return result({ ...base, likelihood: "low", label: "Unlikely", headline: "Your answers suggest little or no anxiety right now.", next: ["If something is on your mind, I'm happy to talk."] });
    },
  },

  adhd: {
    id: "adhd",
    title: "ADHD screening",
    tool: "ASRS v1.1",
    specialty: "adhd",
    intro: "Let's explore that. I'll ask **6 quick questions** about the last 6 months. Just tap an answer, and you can say **stop** at any time.",
    prompt: "Over the last 6 months…",
    questions: [
      "How often do you have trouble wrapping up the final details of a project, once the hard parts are done?",
      "How often do you have difficulty getting things in order when a task needs organisation?",
      "How often do you have problems remembering appointments or obligations?",
      "When a task needs a lot of thought, how often do you avoid or delay getting started?",
      "How often do you fidget or squirm with your hands or feet when you have to sit for a long time?",
      "How often do you feel overly active and driven to do things, as if driven by a motor?",
    ].map((text) => ({ text, options: ASRS })),
    score(a) {
      // WHO scoring: the first three count from "Sometimes", the last three from "Often".
      const positives = a.slice(0, 6).filter((v, i) => (i < 3 ? v >= 2 : v >= 3)).length;
      const base = { score: { value: positives, max: 6 } };
      if (positives >= 4)
        return result({ ...base, likelihood: "likely", label: "Likely", headline: "Your answers are very consistent with adult ADHD.", next: ["A psychiatrist can confirm it with a full assessment, including your childhood history.", "ADHD is very manageable with the right support and, sometimes, medicine."], suggestDoctors: true });
      if (positives === 3)
        return result({ ...base, likelihood: "possible", label: "Possible", headline: "Your answers show some signs that can be part of ADHD.", next: ["If focus or organisation is causing real problems, a specialist assessment can help."], suggestDoctors: true });
      return result({ ...base, likelihood: "low", label: "Unlikely", headline: "Your answers don't show the usual pattern of ADHD.", next: ["Stress, poor sleep and anxiety can all affect focus too. Happy to talk about what's going on."] });
    },
  },

  ptsd: {
    id: "ptsd",
    title: "PTSD screening",
    tool: "PC-PTSD-5",
    specialty: "ptsd",
    intro:
      "Thank you for trusting me with that. I'll ask **a few short yes/no questions**. You don't need to describe what happened, and you can say **stop** at any time.",
    questions: [
      {
        text: "Have you ever been through something especially frightening, horrible or traumatic?",
        hint: "for example a serious accident, an assault, abuse, a disaster, war, or the sudden death of someone close",
        options: YES_NO,
        noPrompt: true,
      },
      { text: "Had nightmares about it, or thought about it when you didn't want to?", options: YES_NO },
      { text: "Tried hard not to think about it, or gone out of your way to avoid situations that remind you of it?", options: YES_NO },
      { text: "Been constantly on guard, watchful, or easily startled?", options: YES_NO },
      { text: "Felt numb or detached from people, activities, or your surroundings?", options: YES_NO },
      { text: "Felt guilty or unable to stop blaming yourself or others for it, or for problems it may have caused?", options: YES_NO },
    ],
    prompt: "In the past month, have you…",
    // PTSD follows a traumatic event, so without one the rest doesn't apply.
    stopAfter: (a, index) => index === 0 && a[0] === 0,
    score(a) {
      if (a[0] === 0)
        return result({
          likelihood: "low",
          label: "Not applicable",
          headline: "PTSD follows a traumatic event, so this screening doesn't apply to you.",
          next: ["Stress, anxiety and low mood can still feel very heavy. I'm happy to talk about what's going on, or you can say \"do I have anxiety\" to check that."],
        });
      const yes = sum(a, 1, 6);
      const points = [
        a[1] && "Unwanted memories or nightmares",
        a[2] && "Avoiding reminders",
        a[3] && "Always on guard or easily startled",
        a[4] && "Feeling numb or detached",
        a[5] && "Guilt or blame",
      ].filter(Boolean);
      const base = { score: { value: yes, max: 5 }, points };
      if (yes >= 4)
        return result({ ...base, likelihood: "likely", label: "Likely", headline: "Your answers show several signs that are common in PTSD.", next: ["PTSD is very treatable. Trauma-focused therapies help most people a lot.", "A psychiatrist can confirm it and plan care with you, at your pace."], suggestDoctors: true });
      if (yes === 3)
        return result({ ...base, likelihood: "possible", label: "Possible", headline: "Your answers show some signs that can be part of PTSD.", next: ["It's worth talking to a specialist, especially if these feelings are affecting your daily life."], suggestDoctors: true });
      return result({ ...base, likelihood: "low", label: "Unlikely", headline: "Your answers don't show the usual pattern of PTSD.", next: ["Going through something hard can still leave a mark. If you'd like to talk about it, I'm here."] });
    },
  },

  alcohol: {
    id: "alcohol",
    title: "Alcohol use check",
    tool: "AUDIT-C",
    specialty: "addiction",
    intro: "Let's take an honest look. I'll ask **3 quick questions**. One drink = a small peg (30 ml), a glass of wine, or a regular can of beer. You can say **stop** at any time.",
    questions: [
      { text: "How often do you have a drink containing alcohol?", options: opts(["Never", "Monthly or less", "2–4 times a month", "2–3 times a week", "4+ times a week"]) },
      { text: "How many drinks do you have on a typical day when you drink?", options: opts(["1–2", "3–4", "5–6", "7–9", "10 or more"]) },
      { text: "How often do you have 6 or more drinks on one occasion?", options: opts(["Never", "Less than monthly", "Monthly", "Weekly", "Daily or almost daily"]) },
    ],
    // No drinking at all ends it there.
    stopAfter: (a, index) => index === 0 && a[0] === 0,
    score(a) {
      const s = sum(a);
      const base = { score: { value: s, max: 12 } };
      if (a[0] === 0) return result({ ...base, likelihood: "low", label: "Not drinking", headline: "You told me you don't drink, so there's nothing to flag here." });
      if (s >= 8)
        return result({ ...base, likelihood: "likely", label: "Likely harmful", headline: "Your answers suggest your drinking is likely harming your health.", next: ["If you drink heavily every day, don't stop suddenly on your own. Withdrawal can be dangerous, and a supervised detox keeps you safe.", "Tulasi runs a dedicated de-addiction programme. Recovery is very possible."], suggestDoctors: true });
      if (s >= 4)
        return result({ ...base, likelihood: "possible", label: "Possibly risky", headline: "Your answers suggest your drinking may be at a risky level.", next: ["Cutting down now can make a real difference to sleep, mood and health.", "Alcohol-free days and tracking what you drink are good first steps."], suggestDoctors: true });
      return result({ ...base, likelihood: "low", label: "Lower risk", headline: "Your answers suggest lower-risk drinking.", next: ["Lower risk isn't no risk. Keeping it light and having alcohol-free days helps."] });
    },
  },

  dizziness: {
    id: "dizziness",
    title: "Dizziness check",
    tool: "Symptom triage",
    specialty: "anxiety",
    intro: "Sorry you're feeling that way. Let me ask a few quick questions to understand what might be going on. **Safety first:**",
    questions: [
      {
        text: "Right now, along with the dizziness, do you have any of these?",
        // Shown as a list: the one question that has to be read properly.
        list: [
          "Sudden weakness or numbness on one side",
          "Trouble speaking, or a drooping face",
          "Chest pain",
          "Fainting",
          "A sudden, severe headache",
          "Trouble breathing",
        ],
        options: YES_NO,
      },
      { text: "What does it feel like?", options: opts(["The room is spinning", "Light-headed, like I might faint", "Unsteady on my feet", "Hard to describe"]) },
      { text: "When does it mostly happen?", options: opts(["When I stand up quickly", "When I move my head", "When I'm stressed or anxious", "Randomly or all the time"]) },
      { text: "Have you eaten and had enough water today?", options: opts(["Yes", "Not really"], [0, 1]) },
      { text: "Did you start or change a medicine recently?", options: YES_NO },
      { text: "Along with it, do you get a racing heart, fast breathing, tingling or a sense of panic?", options: YES_NO },
      { text: "How long has this been going on?", options: opts(["Just today", "A few days", "Weeks or longer", "It keeps coming back"]) },
    ],
    // Any danger sign ends it straight away.
    stopAfter: (a, index) => index === 0 && a[0] === 1,
    score(a) {
      if (a[0] === 1)
        return result({
          likelihood: "urgent",
          label: "Get help now",
          headline: "These signs need urgent medical attention.",
          next: ["Call **112** or go to the nearest emergency department now.", "Don't drive yourself. Ask someone to stay with you."],
          urgent: true,
          disclaimer: "If you're unsure, it's always safer to get checked.",
        });
      const [, feel, when, notEaten, newMed, panicky, duration] = a;
      const causes = [];
      if (when === 0 || feel === 1) causes.push("A brief drop in blood pressure when standing up (very common)");
      if (notEaten === 1) causes.push("Not enough food or water (low sugar or dehydration)");
      if (newMed === 1) causes.push("A side effect of a new or changed medicine");
      if (feel === 0 || when === 1) causes.push("An inner-ear balance problem (such as BPPV)");
      if (when === 2 || panicky === 1) causes.push("Anxiety or panic, which can strongly cause dizziness");
      const lasting = duration >= 2;
      const next = [];
      if (newMed === 1) next.push("Tell the doctor who prescribed the medicine. Don't stop it on your own.");
      if (notEaten === 1) next.push("Sit down, drink water and eat something now.");
      if (when === 0) next.push("Stand up slowly, and sit back down if you feel faint.");
      next.push(
        lasting || !causes.length
          ? "As it's been going on for a while, please see a general physician soon to check your blood pressure, sugar, blood count and ears."
          : "If it keeps happening or gets worse, see a general physician."
      );
      if (causes.some((c) => c.startsWith("Anxiety"))) next.push("If anxiety is part of it, Tulasi's specialists can help with that side.");
      next.push("Get urgent help if you faint, or get chest pain, weakness, trouble speaking or a severe headache.");
      return result({
        likelihood: lasting ? "possible" : "low",
        label: lasting ? "See a doctor soon" : causes.length ? "Likely a common cause" : "Worth getting checked",
        headline: causes.length ? "From your answers, it's most likely linked to:" : "Your answers don't point to one clear cause.",
        points: causes.length ? causes : ["Dizziness has many possible causes, and a doctor can check the common ones quickly."],
        next,
        suggestDoctors: causes.some((c) => c.startsWith("Anxiety")),
        disclaimer: "This is guidance to help you decide what to do next, not a diagnosis.",
      });
    },
  },
};

// ---- recognising a request ---------------------------------------------------

const ASKING = String.raw`(?:i think i (?:have|might have|may have|got)|i (?:might|may) have|do i have|could i have|have i got|am i|is (?:this|it)|could (?:this|it) be|test me for|check (?:me |if i have )?(?:for )?)`;
const about = (condition) => new RegExp(String.raw`\b${ASKING}\b[^.?!]{0,30}\b(?:${condition})\b`, "i");

const INTENTS = [
  ["ocd", [about("ocd|obsessive[- ]compulsive"), /\bocd (?:test|check|quiz|screening)\b/i, /\b(?:mujhe|kya mujhe) ocd\b|\bocd hai kya\b/i]],
  ["depression", [about("depress(?:ed|ion)|clinically depressed"), /\bdepression (?:test|check|quiz|screening)\b/i, /\bkya mujhe depression\b|\bdepression hai kya\b/i]],
  ["anxiety", [about("anxiety(?: disorder)?|an anxiety disorder|gad"), /\banxiety (?:test|check|quiz|screening)\b/i, /\banxiety hai kya\b/i]],
  ["adhd", [about("adhd"), /\badhd (?:test|check|quiz|screening)\b/i]],
  ["ptsd", [about("ptsd|post[- ]?traumatic stress(?: disorder)?|trauma"), /\bptsd (?:test|check|quiz|screening)\b/i, /\bptsd hai kya\b/i]],
  ["alcohol", [/\bcheck my drinking\b|\b(?:am i (?:an )?alcoholic|is my drinking (?:a problem|too much|normal|ok(?:ay)?)|do i drink too much|am i drinking too much|alcohol (?:test|check|quiz|screening))\b/i]],
  [
    "dizziness",
    [/\b(?:dizzy|dizziness|light[- ]?headed(?:ness)?|vertigo|head (?:is )?spinning|room (?:is )?spinning|chakk?ar (?:aa|aata|aate|aa raha|aa rahe))\b|चक्कर|தலைசுற்ற|తల తిరుగ/i],
  ],
];

// Emergency signs named in the person's own words, at any point in the
// dizziness check: "my left arm feels numb", "chest pain", "I fainted".
// People in an emergency often play symptoms down when asked directly, so
// what they volunteered counts even if they later answer "no".
const DIZZINESS_DANGER =
  /\b(?:numb(?:ness)?|pins and needles|weak(?:ness)? (?:in|on) (?:one side|my (?:left|right)|one arm|one leg|my face)|face (?:is |feels )?droop\w*|droop\w* face|slurr\w*|can'?t (?:speak|talk|breathe|see)|trouble (?:speaking|breathing|seeing)|short(?:ness)? of breath|chest (?:pain|tight\w*|pressure|hurts)|(?:left )?arm (?:pain|hurts|feels heavy)|fainted|fainting|(?:did|just|almost|nearly) faint|passed out|blacked out|black out|(?:worst|severe|sudden|terrible) headache|seizure|fits?)\b/i;

/** True when a message mentions an emergency sign during a dizziness check. */
export function mentionsDizzinessDanger(text) {
  return DIZZINESS_DANGER.test(String(text || ""));
}

/** Which screening (if any) a message is asking for. */
export function detectAssessmentIntent(text) {
  if (!text) return null;
  for (const [id, patterns] of INTENTS) if (patterns.some((p) => p.test(text))) return id;
  return null;
}

// Wondering aloud rather than asking: "I don't know if it's depression or
// I'm just weak", "maybe I have anxiety". These get a button to start the
// screening under the reply, rather than a quiz out of nowhere.
const WONDERING = /\b(?:if|whether|maybe|might|may be|not sure|don'?t know|dont know|wonder(?:ing)?|could be|probably|kya)\b/i;
const OFFER_TOPICS = [
  ["depression", /\bdepress(?:ed|ion)\b/i],
  ["anxiety", /\banxiety\b|\banxiety disorder\b/i],
  ["ocd", /\bocd\b|\bobsessive\b/i],
  ["adhd", /\badhd\b/i],
  ["ptsd", /\bptsd\b|\btrauma\b/i],
  ["alcohol", /\b(?:drinking|drink) (?:too much|a lot|problem)\b|\balcoholic\b/i],
];

/** Labels for the start button. Each is a phrase detectAssessmentIntent understands. */
export const OFFER_LABELS = {
  depression: "Check for depression",
  anxiety: "Check for anxiety",
  ocd: "Check for OCD",
  adhd: "Check for ADHD",
  ptsd: "Check for PTSD",
  alcohol: "Check my drinking",
};

/** A screening worth offering (not starting) for this message, or null. */
export function detectAssessmentOffer(text) {
  if (!text || detectAssessmentIntent(text) || !WONDERING.test(text)) return null;
  return OFFER_TOPICS.find(([, p]) => p.test(text))?.[0] || null;
}

/** "ok let's do that", "yes", "haan": accepting an offered screening. */
export const ACCEPTS_OFFER =
  /^\s*(?:yes|yeah|yep|yup|ok(?:ay)?|sure|go ahead|alright|please|start|haan|ha|han|chalo|theek hai|thik hai|let'?s (?:do|try|start) (?:it|that|this)|ok(?:ay)?,? let'?s (?:do|try) (?:it|that|this))\b/i;

// ---- reading an answer -------------------------------------------------------

const YES = /^(?:y|yes|yeah|yep|yup|ya|haan|haa|ha|han|ji|ji haan|avunu|aama|aamam|sure|correct)\b/i;
const NO = /^(?:n|no|nope|nah|nahi|nahin|na|illa|illai|ledu|kaadu|not really)\b/i;

/**
 * The option a typed or tapped answer means: its number ("2"), its label, or
 * yes/no in English, Hindi, Tamil or Telugu. Null if it's not an answer.
 */
export function parseAnswer(question, text) {
  const t = String(text || "").trim().toLowerCase().replace(/[.!]+$/, "");
  if (!t) return null;
  const { options } = question;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1];
  const exact = options.find((o) => o.label.toLowerCase() === t);
  if (exact) return exact;
  const labels = options.map((o) => o.label.toLowerCase());
  if (labels.includes("yes") && YES.test(t)) return options[labels.indexOf("yes")];
  if (labels.includes("no") && NO.test(t)) return options[labels.indexOf("no")];
  if (labels.includes("not really") && NO.test(t)) return options[labels.indexOf("not really")];
  // People answer in their own words: "several days i think", "nearly every
  // day honestly", "umm quite a lot?". An answer named inside the reply
  // counts; the longest wins, so "a lot" doesn't beat "a little" wrongly
  // and "not at all" beats "at all".
  const named = options
    .filter((o) => new RegExp(String.raw`(?:^|\W)${o.label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\W|$)`).test(t))
    .sort((a, b) => b.label.length - a.label.length);
  if (named.length) return named[0];
  const partial = options.filter((o) => o.label.toLowerCase().startsWith(t) || (t.length >= 4 && o.label.toLowerCase().includes(t)));
  return partial.length === 1 ? partial[0] : null;
}
