// Deterministic intent detection for patient self-service requests
// (admission/discharge status, prescriptions, patient lookup) — deliberately
// narrow so ordinary words don't misfire ("my admission" alone is too
// generic; could mean a college admission, an admission of guilt, etc.).
const INTENT_PATTERNS = {
  admission: /\badmission status\b|\bam i (still )?admitted\b|\bstill admitted\b|\bhospital admission\b|\bmy admission status\b/i,
  discharge: /\bdischarge summary\b|\bwhen (was|am) i discharged\b|\bmy discharge\b/i,
  visits: /\bmy visits?\b|\bvisit history\b|\blast \d+ visits?\b|\bmy last visit\b|\brecent visits?\b/i,
  prescription:
    /\bmy prescriptions?\b|\bwhat did the doctor prescribe\b|\bmedication history\b|\b(check|show|see|view|find) my medicines?\b|\bwhat medicines? (was i|were you) prescribed\b/i,
  register: /\bregister (me|as a patient)\b|\bnew patient\b|\bfind my (patient id|uhid)\b/i,
};

export function detectHmsIntent(text) {
  if (!text) return null;
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(text)) return intent;
  }
  return null;
}
