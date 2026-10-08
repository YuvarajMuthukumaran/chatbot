// A short guided path for families asking about inpatient admission (IPD).
// Admission is decided by a psychiatrist, so the one question that matters
// first is whether a doctor has already advised it: if so, the Care Team
// takes it from there; if not, a specialist consultation comes first (which
// can be booked right here in chat).

const CLINIC_NUMBER = "8800000255";

export const ADMISSION_START = "Admission enquiry";
const ADVISED = "A doctor advised admission";
const NOT_ADVISED = "Not advised yet";
const NO_DOCTOR = "Haven't seen a doctor";
const CARE_TEAM = "Talk to the Care Team";

/** Chips offered under a reply about admission. */
export const ADMISSION_CHIPS = [ADVISED, NOT_ADVISED, NO_DOCTOR];

const say = (reply, quickReplies) => ({
  handled: true,
  functional: true,
  reply,
  quickReplies,
  llmNote: "They asked about inpatient admission and were guided on next steps (Care Team call or a specialist consultation first).",
});

const same = (message, label) => message.trim().toLowerCase().replace(/[.!]+$/, "") === label.toLowerCase();

/**
 * Handles the admission chips. Only the exact chip labels count, and only
 * after the guide was offered, so typed sentences still reach the model.
 */
export function handleAdmissionGuideTurn(session, message) {
  if (same(message, ADMISSION_START)) {
    session.admissionGuideOffered = true;
    return say(
      "Considering inpatient care can feel like a lot, so let's take it one step at a time. Has a doctor already advised admission for the patient?",
      ADMISSION_CHIPS
    );
  }
  if (!session.admissionGuideOffered) return { handled: false };

  if (same(message, ADVISED)) {
    return say(
      `Thank you. Since a doctor has advised admission, our Care Team can guide you through the process, rooms and costs, and answer every question: ${CLINIC_NUMBER}. Families are also welcome to visit the Gurugram hospital first and see it for themselves.`
    );
  }
  if (same(message, NOT_ADVISED) || same(message, NO_DOCTOR)) {
    const opener = same(message, NO_DOCTOR)
      ? "That's completely okay, many families start exactly here."
      : "That's okay.";
    return say(
      `${opener} Admission is decided by a psychiatrist after assessing the patient, so a consultation with one of our specialists is the right first step. They'll understand what's going on and guide you on what to do next.`,
      ["Book a consultation", CARE_TEAM]
    );
  }
  if (same(message, CARE_TEAM)) {
    return say(`Our Care Team will be glad to understand your concern and guide you through the options, at your own pace: ${CLINIC_NUMBER}.`);
  }
  return { handled: false };
}
