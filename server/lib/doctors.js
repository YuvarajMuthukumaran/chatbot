// Doctor directory sourced from tulasihealthcare.com/our-team (fetched and
// tagged manually against each doctor's own bio page). Specialties are
// inferred from what each bio actually says it treats, not guessed —
// re-fetch and re-tag if the team page changes meaningfully.
// `generalist: true` marks doctors whose own bio describes broad general practice
// rather than named conditions; guided matching (routes/match.js) uses them to
// fill gaps instead of leaving them invisible.
export const DOCTORS = [
  { name: "Dr. Gorav Gupta", role: "CEO, Senior Consultant Psychiatrist", specialties: ["addiction", "rehabilitation"], focus: "Senior Consultant Psychiatrist of the Indian Continent; pioneering work in psycho-social rehabilitation and de-addiction.", photo: "/doctors/gorav-gupta.webp" },
  { name: "Dr. Ichpreet Singh", role: "Consultant Psychiatrist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "ptsd", "addiction", "sexual_disorder"], focus: "10+ years treating PTSD, depression, anxiety, OCD, schizophrenia, bipolar disorder, and addiction, with a specialisation in sexual disorders.", photo: "/doctors/ichpreet-singh.webp" },
  { name: "Dr. Poorva Gupta", role: "Consultant Psychiatrist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "personality_disorder"], focus: "Comprehensive psychiatric care for children, adolescents, and adults.", photo: "/doctors/poorva-gupta.webp" },
  { name: "Dr. Alisha Nagar", role: "Consultant Psychiatrist", specialties: ["ocd", "bipolar", "schizophrenia", "geriatric_dementia"], focus: "8+ years treating schizophrenia, bipolar disorder, dementia, and OCD; interest in neuropsychiatry and old-age behavioral issues.", photo: "/doctors/alisha-nagar.webp" },
  { name: "Dr. Pooja Sharma", role: "Consultant Psychiatrist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "sexual_disorder"], focus: "Patient-centric, evidence-based care across a wide spectrum of psychiatric disorders and age groups.", photo: "/doctors/pooja-sharma.webp" },
  { name: "Dr. Sameer Guliani", role: "Consultant Child and Adolescent Psychiatrist", specialties: ["ocd", "child_adolescent", "autism", "adhd"], focus: "Specialist in complex psychological, behavioural, and neurodevelopmental conditions in children and adolescents.", photo: "/doctors/sameer-guliani.webp" },
  { name: "Dr. Suravi Das", role: "Consultant Psychiatrist", specialties: ["ocd", "depression", "anxiety", "addiction"], focus: "University topper in psychiatry; general adult psychiatric care.", photo: "/doctors/suravi-das.webp" },
  { name: "Dr. Ram Chander Jiloha", role: "Senior Consultant Psychiatrist", specialties: ["addiction", "child_adolescent", "rehabilitation"], focus: "50 years in mental health; Fellow in Addiction Psychiatry (UCLA) and Child Mental Health (British Columbia).", photo: "/doctors/ram-chander-jiloha.webp" },
  { name: "Dr. (Col.) Pavan Kumar Pardal", role: "Senior Consultant Psychiatrist", specialties: ["ocd", "addiction"], focus: "Four decades as clinician, teacher, and researcher in psychiatry.", photo: "/doctors/pavan-kumar-pardal.webp" },
  { name: "Dr. Rini Maurya", role: "Consultant Psychiatrist", specialties: ["depression", "child_adolescent", "geriatric_dementia", "rehabilitation"], focus: "Clinical experience across AIIMS and NIMHANS.", photo: "/doctors/rini-maurya.webp" },
  { name: "Dr. Ratnarakshit Ingole", role: "Senior Consultant Psychiatrist", specialties: ["depression", "bipolar", "addiction", "schizophrenia", "anxiety", "ocd", "relationship"], focus: "20 years treating mood disorders, addiction, schizophrenia, and anxiety, with a focus on de-addiction, relapse prevention, and relationship counseling.", photo: "/doctors/ratnarakshit-ingole.webp" },
  { name: "Dr. Anil Kumar", role: "Consultant Psychiatrist", specialties: ["child_adolescent"], focus: "18+ years diagnosing a broad range of psychiatric disorders, including developmental challenges in children." },
  { name: "Dr. Anu Yadav", role: "Consultant Psychiatrist", specialties: [], generalist: true, focus: "Holistic treatment approach.", photo: "/doctors/anu-yadav.webp" },
  { name: "Dr. Naseem Akhtar Qureshi", role: "Senior Consultant Psychiatrist", specialties: [], generalist: true, focus: "45+ years of clinical, academic, and administrative experience across India, Saudi Arabia, and the UAE.", photo: "/doctors/naseem-akhtar-qureshi.webp" },
  { name: "Dr. Kritika Soni", role: "Consultant Psychiatrist", specialties: ["addiction", "geriatric_dementia", "child_adolescent"], focus: "De-addiction, neuropsychiatry, geriatric psychiatry, and adolescent mental health, with training in crisis intervention and suicide risk assessment.", photo: "/doctors/kritika-soni.webp" },
  { name: "Dr. Samridhi Sandooja", role: "Consultant Psychiatrist", specialties: ["child_adolescent"], focus: "AIIMS-trained; broad psychiatric, behavioural, and emotional care across all ages, with a certificate in child and adolescent psychiatry.", photo: "/doctors/samridhi-sandooja.webp" },
  { name: "Ms. Kiran Singh", role: "Rehabilitation Psychologist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "addiction", "personality_disorder", "rehabilitation"], focus: "RCI-licensed, 8 years supporting a wide range of mental health and personal goals.", photo: "/doctors/kiran-singh.webp" },
  { name: "Ms. Deliaka Ghanghass", role: "Clinical Rehabilitation Psychologist", specialties: ["depression", "anxiety", "schizophrenia", "personality_disorder", "autism", "rehabilitation"], focus: "PhD scholar focused on mood, anxiety, and psychotic disorders.", photo: "/doctors/deliaka-ghanghass.webp" },
  { name: "Ms. Barkha Soni", role: "Consultant Clinical Psychologist", specialties: ["ocd", "depression", "anxiety", "personality_disorder"], focus: "Evidence-based assessment and psychotherapy with personalized therapy plans.", photo: "/doctors/barkha-soni.webp" },
  { name: "Ms. Ekta Kashyap", role: "Consultant Clinical Psychologist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "addiction"], focus: "RCI-licensed, 4+ years in the mental health field.", photo: "/doctors/ekta-kashyap.webp" },
  { name: "Ms. Apoorva Khanna", role: "Child and Adolescent Psychologist", specialties: ["child_adolescent", "rehabilitation"], focus: "RCI-licensed rehabilitation and child/adolescent psychotherapist.", photo: "/doctors/apoorva-khanna.webp" },
  { name: "Ms. Hardika", role: "Clinical Psychologist", specialties: ["ocd", "depression", "anxiety"], focus: "RCI-registered, comprehensive psychological assessment and evidence-based therapy.", photo: "/doctors/hardika.webp" },
  { name: "Ms. Husna Zahid Hussain", role: "Clinical Psychologist", specialties: ["depression", "anxiety", "stress"], focus: "Works with anxiety, depression, mood-related difficulties, and stress.", photo: "/doctors/husna-zahid-hussain.webp" },
  { name: "Ms. Angshruta Mahanta", role: "Psychiatric Social Worker", specialties: ["depression", "anxiety", "personality_disorder"], focus: "MPhil in Psychiatric Social Work from NIMHANS.", photo: "/doctors/angshruta-mahanta.webp" },
  { name: "Ms. Manju Kumari", role: "Clinical Psychologist", specialties: ["rehabilitation"], focus: "", photo: "/doctors/manju-kumari.webp" },
  { name: "Ms. Ira Gupta", role: "Consultant Clinical Psychologist", specialties: ["rehabilitation"], focus: "16+ years, RCI-licensed; worked at PGI Chandigarh and Command Hospital.", photo: "/doctors/ira-gupta.webp" },
  { name: "Ms. Aastha Dwivedi", role: "Consultant Clinical Psychologist", specialties: ["child_adolescent"], focus: "RCI-licensed; CBT, DBT, and psychodiagnostic testing for adolescents, adults, and geriatric patients.", photo: "/doctors/aastha-dwivedi.webp" },
  { name: "Mr. Suparas Jain", role: "Consultant Clinical Psychologist", specialties: ["anxiety", "depression", "bipolar", "schizophrenia"], focus: "RCI-licensed; anxiety, depression, bipolar disorder, schizophrenia, and psychosis, with CBT, DBT, and psychodynamic therapy.", photo: "/doctors/suparas-jain.webp" },
  { name: "Ms. Chaya Chaudhary", role: "Rehabilitation Psychologist", specialties: ["rehabilitation"], focus: "", photo: "/doctors/chaya-chaudhary.webp" },
  { name: "Ms. Surabhi Sengar", role: "Rehabilitation Psychologist", specialties: ["rehabilitation"], focus: "RCI-registered.", photo: "/doctors/surabhi-sengar.webp" },
  { name: "Mr. Inderjeet Singh", role: "Senior Consultant Psychologist", specialties: [], generalist: true, focus: "Psychotherapist since 2007; existential psychology and psychotherapy across a variety of psychiatric conditions.", photo: "/doctors/inderjeet-singh.webp" },
  { name: "Dr. Pranita Gaur", role: "Senior Consultant Psychologist", specialties: ["stress", "child_adolescent", "relationship"], focus: "40+ years; student mental health, academic stress, child and family counseling, and relationship/interpersonal issues.", photo: "/doctors/pranita-gaur.webp" },
  { name: "Ms. Ankita Bhatnagar", role: "Rehabilitation Psychologist", specialties: ["rehabilitation"], focus: "", photo: "/doctors/ankita-bhatnagar.webp" },
  { name: "Ms. Jyoti", role: "Clinical Psychologist", specialties: ["anxiety", "depression", "ocd", "bipolar", "personality_disorder", "stress", "schizophrenia"], focus: "Anxiety, depression, OCD, psychosis, bipolar disorder, personality disorders, and stress-related concerns.", photo: "/doctors/jyoti.webp" },
  { name: "Ms. Titiksha Agnihotri", role: "Clinical Psychologist", specialties: ["child_adolescent"], generalist: true, focus: "RCI-licensed; emotional distress, behavioral challenges, and life transitions for children and adults.", photo: "/doctors/titiksha-agnihotri.webp" },
];

// Best-effort, deliberately conservative — only fires on fairly explicit
// mentions so it doesn't inject a doctor suggestion into casual chat.
// Acronym-style conditions (OCD/ADHD/PTSD) are left English-only since even
// in Hindi/Tamil/Telugu conversation those acronyms are almost always typed
// as-is in Roman letters rather than spelled out natively.
const INTENT_PATTERNS = {
  ocd: [/\bOCD\b|obsessive[\s-]?compulsive/i],
  depression: [
    /\bdepress(ed|ion|ing)?\b/i,
    /अवसाद|डिप्रेशन/, // Hindi
    /மனச்சோர்வு|டிப்ரஷன்/, // Tamil
    /నిరాశ|డిప్రెషన్/, // Telugu
  ],
  anxiety: [
    /\banxi(ety|ous)\b|panic attack/i,
    /चिंता|घबराहट|एंग्जायटी/, // Hindi
    /பதற்ற|ஆங்சைட்டி/, // Tamil — stem, not full word: பதற்றம் becomes பதற்றத்திற்கு etc. under case suffixes
    /ఆందోళన|కంగారు|యాంగ్జైటీ/, // Telugu
  ],
  bipolar: [/\bbipolar\b/i, /बाइपोलर/, /பைபோலார்/, /బైపోలార్/],
  schizophrenia: [
    /\bschizophrenia\b|hearing voices|hallucinat/i,
    /सिज़ोफ्रेनिया/,
    /ஸ்கிசோஃப்ரினியா/,
    /స్కిజోఫ్రెనియా/,
  ],
  addiction: [
    /\balcoholism\b|\bde-?addiction\b|\baddicted\b|\baddiction\b|\bsubstance abuse\b/i,
    // How families actually describe it on the phone: "he drinks every day",
    // "daru ki aadat", "betting addiction".
    /\balcohol(?:ic)?\b|\bdrinks? (?:a lot|too much|heavily|daily|every day)\b|\bdrinking (?:problem|habit|too much|heavily|daily|every day)\b|\b(?:daru|sharab|smack|ganja)\b|\bdrugs\b|\b(?:gambling|betting)\b/i,
    /नशा|लत|शराब|दारू/, // Hindi
    /போதை|அடிமை/, // Tamil
    /మత్తు|వ్యసనం/, // Telugu
  ],
  child_adolescent: [
    /\bmy (son|daughter|kid|child)\b|\bteenager\b/i,
    // "child psychiatrist", "kids specialist", "doctor for children".
    /\b(?:child(?:ren)?|kids?|paediatric|pediatric|adolescent|teen)(?:'?s)? (?:psychiatrists?|psychologists?|specialists?|doctors?|counsell?ors?|therapists?)\b|\b(?:psychiatrist|psychologist|specialist|doctor)s? for (?:children|kids|a child|my (?:son|daughter|kid|child))\b/i,
    /मेरा बेटा|मेरी बेटी|मेरा बच्चा|किशोर/, // Hindi
    /என் மகன்|என் மகள்|என் குழந்தை|இளம்பருவத/, // Tamil
    /నా కొడుకు|నా కూతురు|నా పిల్లవాడు|కౌమారదశ/, // Telugu
  ],
  geriatric_dementia: [
    /\bdementia\b|\balzheimer/i,
    /डिमेंशिया|भूलने की बीमारी|अल्ज़ाइमर/, // Hindi
    /டிமென்ஷியா|மறதி நோய்|அல்சைமர்/, // Tamil
    /చిత్తవైకల్యం|మతిమరుపు|అల్జీమర్/, // Telugu
  ],
  personality_disorder: [
    /\bpersonality disorder\b|\bborderline personality\b/i,
    /व्यक्तित्व विकार/,
    /ஆளுமைக் கோளாறு/,
    /వ్యక్తిత్వ లోపం/,
  ],
  sexual_disorder: [
    /\bsexual\b.{0,20}\b(problem|dysfunction|disorder|issue)\b/i,
    /यौन समस्या|यौन विकार/,
    /பாலியல் பிரச்சனை/,
    /లైంగిక సమస్య/,
  ],
  autism: [/\bautis(m|tic)\b/i, /ऑटिज़्म/, /ஆட்டிச/, /ఆటిజం/],
  adhd: [/\bADHD\b|attention deficit/i],
  ptsd: [/\bPTSD\b|post[\s-]?traumatic|\bflashbacks?\b/i],
  // Added from tulasihealthcare.com's own admission page, which lists these
  // as conditions the clinic treats (distinct from the PTSD acronym above).
  sleep_disorder: [
    /\bsleep (?:disorder|problem|issue)s?\b|\binsomnia\b|\btrouble sleeping\b/i,
    /नींद (?:न आना|की समस्या)|अनिद्रा/, // Hindi
    /தூக்கமின்மை|தூக்கப் பிரச்சனை/, // Tamil
    /నిద్రలేమి|నిద్ర సమస్య/, // Telugu
  ],
  phobia: [
    /\bphobia\b/i,
    /फोबिया|भय विकार/, // Hindi
    /பயவிகாரம்|ஃபோபியா/, // Tamil
    /ఫోబియా/, // Telugu
  ],
  trauma: [
    /\btrauma(tic)?\b/i,
    /सदमा|आघात/, // Hindi
    /அதிர்ச்சி|மனஉளைச்சல்/, // Tamil
    /గాయం|ట్రామా/, // Telugu
  ],
  // From doctor bios (Dr. Ingole, Dr. Gaur) explicitly naming relationship/
  // interpersonal counseling as something they treat.
  relationship: [
    /\b(?:relationship|marital|marriage) (?:problem|issue|trouble|difficult\w*)/i,
    /रिश्ते की समस्या|वैवाहिक समस्या/, // Hindi
    /உறவு பிரச்சனை|திருமண பிரச்சனை/, // Tamil
    /సంబంధ సమస్య|వైవాహిక సమస్య/, // Telugu
  ],
  // From Ms. Jyoti's and Dr. Gaur's bios ("stress-related concerns",
  // "academic stress").
  stress: [
    /\bstress(ed|ful)?\b|\bburn(?:t|ed)[\s-]?out\b/i,
    /तनाव/, // Hindi
    /மன அழுத்தம்/, // Tamil
    /ఒత్తిడి/, // Telugu
  ],
};

// How each specialty tag reads to a person (chat replies show these instead
// of raw tags like "geriatric_dementia"). Mirrored in client/src/lib/specialties.js.
export const SPECIALTY_LABELS = {
  ocd: "OCD",
  depression: "Depression",
  anxiety: "Anxiety",
  bipolar: "Bipolar disorder",
  schizophrenia: "Schizophrenia",
  addiction: "Addiction",
  child_adolescent: "Child & adolescent",
  geriatric_dementia: "Dementia & elderly care",
  personality_disorder: "Personality disorders",
  sexual_disorder: "Sexual health",
  autism: "Autism",
  adhd: "ADHD",
  ptsd: "PTSD",
  sleep_disorder: "Sleep problems",
  phobia: "Phobias",
  trauma: "Trauma",
  relationship: "Relationships",
  stress: "Stress",
  rehabilitation: "Rehabilitation",
};

export function specialtyLabel(tag) {
  return SPECIALTY_LABELS[tag] || String(tag).replace(/_/g, " ");
}

export function matchSpecialties(text) {
  if (!text) return [];
  const tags = [];
  for (const [tag, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) tags.push(tag);
  }
  return tags;
}

// Mentioning a condition once ("I feel anxious") isn't itself a reason to
// suggest a doctor — that reads as pushy for what might just be a passing
// feeling. Only recommend when someone is explicitly asking for
// professional help, or showing real distress/severity about it.
// English loanwords like "doctor"/"appointment" are so commonly code-mixed
// into Hindi/Tamil/Telugu sentences as-is that the English pattern already
// catches most romanized requests — these add the native-script forms for
// when someone types in their own script instead.
// Asking for treatment or admission (usually for a relative: "admission for
// my father", "papa ka ilaaj") is as explicit an ask as naming a doctor.
const HELP_SEEKING_PATTERNS = [
  /\b(doctors?|docs?|psychiatrists?|psychologists?|therapists?|specialists?|counsell?ors?|professional help|see someone|talk to someone|book(?:ing)?|appointments?|treatment|admission|admit|rehab|de-?addiction|ilaa?j|bharti)\b/i,
  /डॉक्टर|मनोचिकित्सक|मनोवैज्ञानिक|विशेषज्ञ|काउंसलर|इलाज|भर्ती/, // Hindi
  /மருத்துவர்|நிபுணர்|ஆலோசகர்|சிகிச்சை/, // Tamil
  /డాక్టర్|వైద్యుడు|నిపుణుడు|కౌన్సెలర్|చికిత్స/, // Telugu
];

// Something ongoing, worsening, or past coping. Enough on its own.
const SUSTAINED_CONCERN_PATTERNS = [
  /\bcan'?t (?:take|handle|cope|stop|deal with)\b|\b(?:constantly|always|every day|every night|all the time)\b|getting worse|won'?t (?:go away|stop)|\bfor (?:weeks|months|years)\b|desperate|breaking down|falling apart|too much (?:for me|to handle)|don'?t know what to do anymore/i,
  /बर्दाश्त नहीं|हमेशा|हर समय|लगातार/, // Hindi
  /தாங்க முடியல|எப்போதும்|தொடர்ந்து/, // Tamil
  /భరించలేక|ఎప్పుడూ|నిరంతరం/, // Telugu
];

// Intensity without duration: "I had a really hard day", "I'm so
// exhausted", "I'm worried". Anyone can have a day like that, and answering
// it with a doctor card tells them they weren't heard. These only count once
// they keep coming up: when an earlier message showed distress too.
const MOMENTARY_CONCERN_PATTERNS = [
  /\breally (?:struggling|bad|hard)\b|\bso (?:scared|overwhelmed|exhausted|tired of this)\b|\bscares? me\b|\bi'?m worried\b|\bcan'?t sleep\b|don'?t know what to do\b/i,
  /समझ नहीं आ रहा|क्या करूं|बहुत बुरा|अकेला महसूस/, // Hindi
  /தெரியல|மிகவும் மோசமா|தனியா உணர்/, // Tamil
  /తెలియడం లేదు|చాలా చెడ్డగా|ఒంటరిగా అనిపిస్తుంది/, // Telugu
];

const showsDistress = (text) =>
  [...SUSTAINED_CONCERN_PATTERNS, ...MOMENTARY_CONCERN_PATTERNS].some((p) => p.test(text));

// "why do you always suggest grounding" trips CONCERN_PATTERNS' chronicity
// check ("always") even though it's commentary on the bot's own behavior,
// not the user's — an explicit ask ("I need a doctor") still overrides this,
// only the fuzzy concern-word fallback gets suppressed by it.
const BOT_META_COMMENTARY = /\b(?:why (?:do|does|would|are) you|do you (?:always|only|ever)|you always (?:suggest|say|recommend|tell|give))\b/i;

/**
 * Why (if at all) this message calls for suggesting a specialist:
 * "explicit" when they asked for help or treatment, "concern" when the
 * distress is sustained (named as ongoing, or still there from earlier
 * messages), otherwise null.
 * @param {string} text
 * @param {string[]} [earlierUserTexts] - the person's previous messages
 * @returns {"explicit" | "concern" | null}
 */
// "my doctor started me on sertraline" mentions a doctor they already have;
// it isn't asking for one.
const OWN_CLINICIAN = /\b(?:my|our|his|her|their|the)\s+(?:doctors?|docs?|psychiatrists?|psychologists?|therapists?|counsell?ors?)\b/gi;

export function doctorHelpReason(text, earlierUserTexts = []) {
  if (!text) return null;
  if (HELP_SEEKING_PATTERNS.some((p) => p.test(text.replace(OWN_CLINICIAN, "")))) return "explicit";
  if (BOT_META_COMMENTARY.test(text)) return null;
  if (SUSTAINED_CONCERN_PATTERNS.some((p) => p.test(text))) return "concern";
  if (MOMENTARY_CONCERN_PATTERNS.some((p) => p.test(text)) && earlierUserTexts.some(showsDistress)) return "concern";
  return null;
}

export function wantsDoctorHelp(text, earlierUserTexts) {
  return doctorHelpReason(text, earlierUserTexts) !== null;
}

export function getDoctorsForSpecialties(tags, limit = 2) {
  if (!tags.length) return [];
  const scored = DOCTORS.map((d) => ({
    doctor: d,
    score: d.specialties.filter((s) => tags.includes(s)).length,
  })).filter((x) => x.score > 0);

  // Shuffle before the sort so doctors tied on score aren't always broken
  // in DOCTORS array order — otherwise whoever happens to have the widest
  // specialty list near the top of the file would win almost every match,
  // and the same one or two names would show up for nearly every condition.
  for (let i = scored.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scored[i], scored[j]] = [scored[j], scored[i]];
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.doctor);
}

// Fallback for real help-seeking that doesn't map to any tagged specialty
// (e.g. "aggression" isn't in INTENT_PATTERNS) — rather than surfacing no
// one, point to the one doctor whose own listed focus is explicitly general
// ("Holistic treatment approach") rather than a specific named condition.
export function getGeneralistDoctor() {
  return DOCTORS.filter((d) => d.name === "Dr. Anu Yadav");
}

// "give me the doc name n profile", "who is she", "male?" — a follow-up about
// the doctors just suggested.
const ABOUT_DOCTOR =
  /\b(?:profile|details?|about (?:him|her|them|the doc\w*)|who (?:is|are) (?:s?he|they|the doc\w*|this)|doc\w*'?s? name|names?|experience|qualifications?|background|male|female|man|woman|lady|gents?|gender)\b/i;

/**
 * Facts about the doctors suggested in the last reply, when the person asks
 * about them; otherwise undefined.
 */
export function buildDoctorFollowUpNote(message, doctors) {
  if (!doctors?.length || !ABOUT_DOCTOR.test(message)) return undefined;
  const lines = doctors.map((d) => `- ${d.name} (${d.role})${d.focus ? `: ${d.focus}` : ""}`).join("\n");
  return `The person is asking about the doctors suggested earlier. What you know about them:
${lines}

Share the name, role and focus plainly and briefly. Every doctor's full profile and photo is on the Doctors page (the Doctors tab), and they can book by tapping Book or saying they'd like to book. You don't know doctors' gender, age or languages: if they ask for a male or female doctor, never promise to arrange one; say they can see every doctor with photos on the Doctors page and pick, or name the doctor they want to book.`;
}

export function buildDoctorContextNote(doctors) {
  const lines = doctors
    .map((d) => `- ${d.name} (${d.role})${d.focus ? `: ${d.focus}` : ""}`)
    .join("\n");
  return `Context only, not something to act on every time: based on what the user just shared, these Tulasi Health Care specialists' focus areas seem relevant —
${lines}

Only mention this if it fits naturally in your reply right now; don't force it in, and don't present it as a diagnosis. If you do bring it up, phrase it as an option ("if it'd help, one of our specialists focuses on exactly this") rather than an instruction. It's completely fine to skip mentioning it if it doesn't fit the moment. The person will see these specialists as cards (photo, name, and a Book button) right under your reply, so don't list their details yourself; if booking comes up, they can tap Book or just say they'd like to book. Never name a doctor who isn't listed above, and never describe any other booking process.`;
}
