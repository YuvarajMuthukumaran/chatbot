// How specialty tags read to a person — mirrors SPECIALTY_LABELS in
// server/lib/doctors.js (the chat uses that copy; these pages use this one).
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
