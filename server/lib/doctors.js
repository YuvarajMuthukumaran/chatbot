// Doctor directory sourced from tulasihealthcare.com/our-team (fetched and
// tagged manually against each doctor's own bio page). Specialties are
// inferred from what each bio actually says it treats, not guessed —
// re-fetch and re-tag if the team page changes meaningfully.
export const DOCTORS = [
  { name: "Dr. Gorav Gupta", role: "CEO, Senior Consultant Psychiatrist", specialties: ["addiction", "rehabilitation"], focus: "Senior Consultant Psychiatrist of the Indian Continent; pioneering work in psycho-social rehabilitation and de-addiction.", photo: "/doctors/gorav-gupta.webp" },
  { name: "Dr. Ichpreet Singh", role: "Consultant Psychiatrist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "ptsd", "addiction", "sexual_disorder"], focus: "10+ years treating PTSD, depression, anxiety, OCD, schizophrenia, bipolar disorder, and addiction, with a specialisation in sexual disorders.", photo: "/doctors/ichpreet-singh.webp" },
  { name: "Dr. Poorva Gupta", role: "Consultant Psychiatrist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "personality_disorder"], focus: "Comprehensive psychiatric care for children, adolescents, and adults.", photo: "/doctors/poorva-gupta.webp" },
  { name: "Dr. Alisha Nagar", role: "Consultant Psychiatrist", specialties: ["ocd", "bipolar", "schizophrenia", "geriatric_dementia"], focus: "8+ years treating schizophrenia, bipolar disorder, dementia, and OCD; interest in neuropsychiatry and old-age behavioral issues.", photo: "/doctors/alisha-nagar.webp" },
  { name: "Dr. Pooja Sharma", role: "Consultant Psychiatrist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "sexual_disorder"], focus: "Patient-centric, evidence-based care across a wide spectrum of psychiatric disorders and age groups.", photo: "/doctors/pooja-sharma.webp" },
  { name: "Dr. Sameer Guliani", role: "Consultant Child and Adolescent Psychiatrist", specialties: ["ocd", "child_adolescent", "autism", "adhd"], focus: "Specialist in complex psychological, behavioural, and neurodevelopmental conditions in children and adolescents.", photo: "/doctors/sameer-guliani.jpeg" },
  { name: "Dr. Suravi Das", role: "Consultant Psychiatrist", specialties: ["ocd", "depression", "anxiety", "addiction"], focus: "University topper in psychiatry; general adult psychiatric care.", photo: "/doctors/suravi-das.jpg" },
  { name: "Dr. Ram Chander Jiloha", role: "Senior Consultant Psychiatrist", specialties: ["addiction", "child_adolescent", "rehabilitation"], focus: "50 years in mental health; Fellow in Addiction Psychiatry (UCLA) and Child Mental Health (British Columbia).", photo: "/doctors/ram-chander-jiloha.jpeg" },
  { name: "Dr. (Col.) Pavan Kumar Pardal", role: "Senior Consultant Psychiatrist", specialties: ["ocd", "addiction"], focus: "Four decades as clinician, teacher, and researcher in psychiatry.", photo: "/doctors/pavan-kumar-pardal.png" },
  { name: "Dr. Rini Maurya", role: "Consultant Psychiatrist", specialties: ["depression", "child_adolescent", "geriatric_dementia", "rehabilitation"], focus: "Clinical experience across AIIMS and NIMHANS.", photo: "/doctors/rini-maurya.webp" },
  { name: "Dr. Ratnarakshit Ingole", role: "Senior Consultant Psychiatrist", specialties: [], focus: "" },
  { name: "Dr. Anil Kumar", role: "Consultant Psychiatrist", specialties: [], focus: "18+ years diagnosing a broad range of psychiatric disorders." },
  { name: "Dr. Anu Yadav", role: "Consultant Psychiatrist", specialties: [], focus: "Holistic treatment approach." },
  { name: "Dr. Naseem Akhtar Qureshi", role: "Senior Consultant Psychiatrist", specialties: [], focus: "45+ years of clinical, academic, and administrative experience across India, Saudi Arabia, and the UAE." },
  { name: "Dr. Kritika Soni", role: "Consultant Psychiatrist", specialties: [], focus: "" },
  { name: "Dr. Samridhi Sandooja", role: "Consultant Psychiatrist", specialties: [], focus: "" },
  { name: "Ms. Kiran Singh", role: "Rehabilitation Psychologist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "addiction", "personality_disorder", "rehabilitation"], focus: "RCI-licensed, 8 years supporting a wide range of mental health and personal goals.", photo: "/doctors/kiran-singh.webp" },
  { name: "Ms. Deliaka Ghanghass", role: "Clinical Rehabilitation Psychologist", specialties: ["depression", "anxiety", "schizophrenia", "personality_disorder", "autism", "rehabilitation"], focus: "PhD scholar focused on mood, anxiety, and psychotic disorders.", photo: "/doctors/deliaka-ghanghass.jpeg" },
  { name: "Ms. Barkha Soni", role: "Consultant Clinical Psychologist", specialties: ["ocd", "depression", "anxiety", "personality_disorder"], focus: "Evidence-based assessment and psychotherapy with personalized therapy plans.", photo: "/doctors/barkha-soni.webp" },
  { name: "Ms. Ekta Kashyap", role: "Consultant Clinical Psychologist", specialties: ["ocd", "depression", "anxiety", "bipolar", "schizophrenia", "addiction"], focus: "RCI-licensed, 4+ years in the mental health field.", photo: "/doctors/ekta-kashyap.webp" },
  { name: "Ms. Apoorva Khanna", role: "Child and Adolescent Psychologist", specialties: ["child_adolescent", "rehabilitation"], focus: "RCI-licensed rehabilitation and child/adolescent psychotherapist.", photo: "/doctors/apoorva-khanna.webp" },
  { name: "Ms. Hardika", role: "Clinical Psychologist", specialties: ["ocd", "depression", "anxiety"], focus: "RCI-registered, comprehensive psychological assessment and evidence-based therapy.", photo: "/doctors/hardika.webp" },
  { name: "Ms. Husna Zahid Hussain", role: "Clinical Psychologist", specialties: ["depression", "anxiety"], focus: "Works with anxiety, depression, mood-related difficulties, and stress.", photo: "/doctors/husna-zahid-hussain.jpeg" },
  { name: "Ms. Angshruta Mahanta", role: "Psychiatric Social Worker", specialties: ["depression", "anxiety", "personality_disorder"], focus: "MPhil in Psychiatric Social Work from NIMHANS.", photo: "/doctors/angshruta-mahanta.webp" },
  { name: "Ms. Manju Kumari", role: "Clinical Psychologist", specialties: ["rehabilitation"], focus: "", photo: "/doctors/manju-kumari.webp" },
  { name: "Ms. Ira Gupta", role: "Consultant Clinical Psychologist", specialties: ["rehabilitation"], focus: "16+ years, RCI-licensed; worked at PGI Chandigarh and Command Hospital.", photo: "/doctors/ira-gupta.jpeg" },
  { name: "Ms. Aastha Dwivedi", role: "Consultant Clinical Psychologist", specialties: [], focus: "" },
  { name: "Mr. Suparas Jain", role: "Consultant Clinical Psychologist", specialties: [], focus: "" },
  { name: "Ms. Chaya Chaudhary", role: "Rehabilitation Psychologist", specialties: ["rehabilitation"], focus: "", photo: "/doctors/chaya-chaudhary.webp" },
  { name: "Ms. Surabhi Sengar", role: "Rehabilitation Psychologist", specialties: ["rehabilitation"], focus: "RCI-registered.", photo: "/doctors/surabhi-sengar.webp" },
  { name: "Mr. Inderjeet Singh", role: "Senior Consultant Psychologist", specialties: [], focus: "" },
  { name: "Dr. Pranita Gaur", role: "Senior Consultant Psychologist", specialties: [], focus: "" },
  { name: "Ms. Ankita Bhatnagar", role: "Rehabilitation Psychologist", specialties: ["rehabilitation"], focus: "", photo: "/doctors/ankita-bhatnagar.jpg" },
  { name: "Ms. Jyoti", role: "Clinical Psychologist", specialties: [], focus: "" },
  { name: "Ms. Titiksha Agnihotri", role: "Clinical Psychologist", specialties: [], focus: "" },
];

// Best-effort, deliberately conservative — only fires on fairly explicit
// mentions so it doesn't inject a doctor suggestion into casual chat.
const INTENT_PATTERNS = {
  ocd: /\bOCD\b|obsessive[\s-]?compulsive/i,
  depression: /\bdepress(ed|ion|ing)?\b/i,
  anxiety: /\banxi(ety|ous)\b|panic attack/i,
  bipolar: /\bbipolar\b/i,
  schizophrenia: /\bschizophrenia\b|hearing voices|hallucinat/i,
  addiction: /\balcoholism\b|\bde-?addiction\b|\baddicted\b|\baddiction\b|\bsubstance abuse\b/i,
  child_adolescent: /\bmy (son|daughter|kid|child)\b|\bteenager\b/i,
  geriatric_dementia: /\bdementia\b|\balzheimer/i,
  personality_disorder: /\bpersonality disorder\b|\bborderline personality\b/i,
  sexual_disorder: /\bsexual\b.{0,20}\b(problem|dysfunction|disorder|issue)\b/i,
  autism: /\bautis(m|tic)\b/i,
  adhd: /\bADHD\b|attention deficit/i,
  ptsd: /\bPTSD\b|post[\s-]?traumatic|\bflashbacks?\b/i,
};

export function matchSpecialties(text) {
  if (!text) return [];
  const tags = [];
  for (const [tag, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(text)) tags.push(tag);
  }
  return tags;
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

export function buildDoctorContextNote(doctors) {
  const lines = doctors
    .map((d) => `- ${d.name} (${d.role})${d.focus ? `: ${d.focus}` : ""}`)
    .join("\n");
  return `Context only, not something to act on every time: based on what the user just shared, these Tulasi Health Care specialists' focus areas seem relevant —
${lines}

Only mention this if it fits naturally in your reply right now; don't force it in, and don't present it as a diagnosis. If you do bring it up, phrase it as an option ("if it'd help, one of our specialists focuses on exactly this — want me to share how to book?") rather than an instruction. It's completely fine to skip mentioning it if it doesn't fit the moment. Never name a doctor who isn't listed above.`;
}
