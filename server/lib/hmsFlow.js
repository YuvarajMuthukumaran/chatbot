// Deterministic patient-record flow. Like crisis detection, this is
// intentionally NOT delegated to the model: identity verification (name +
// age + phone must match a real HMS record before anything is disclosed)
// and the formatting of real medical data are both plain code, not LLM
// output. The model never sees the medical data and never decides whether
// someone is "verified enough" — those calls can't be left to a chat model's
// judgment.
import { detectHmsIntent } from "./hmsIntent.js";
import {
  matchOrRegisterPatient,
  getAdmissionStatus,
  getDischargeSummary,
  getPatientProfile,
  getPrescriptions,
} from "./hmsClient.js";

function titleCase(raw) {
  return raw
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const PHONE_PATTERN = /\b\d{10}\b/;
const AGE_PATTERN = /\b(1[0-1][0-9]|120|[1-9]?[0-9])\b/; // 0–120, sane human age range

const ASK_NAME =
  "Sure — to pull that up, I first need to verify it's really you. What's your full name as registered with Tulasi Health Care (first and last name)?";
const ASK_AGE = "Thanks. And how old are you?";
const ASK_PHONE = "Got it — and the mobile number on your patient record?";
const INVALID_AGE = "That doesn't look like a valid age — could you share a number, like 27?";
const INVALID_PHONE = "That doesn't look like a 10-digit phone number — could you share it again?";
const NOT_FOUND =
  "I couldn't find a matching patient record with that name, age, and phone number. Please double-check the details, or contact Tulasi Health Care directly if this keeps happening.";
const HMS_ERROR =
  "I'm having trouble reaching our records system right now. Please try again in a moment, or contact Tulasi Health Care directly.";

// The HMS patientdata API matches on an EXACT date of birth, not an age —
// age alone can't be reconstructed into an exact day/month, only a birth
// year. This approximates with Jan 1 of that year, which means real
// verification will very likely fail once real credentials are wired up,
// unless Tulasi's HMS matching turns out to be more lenient (e.g. year-only)
// than the documented exact-dob field suggests. Worth confirming with their
// HMS/IT team before relying on this — if exact matching is required, this
// flow will need to collect the actual date, not just age.
function ageToApproxDob(age) {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

function initHmsState() {
  return { verified: false, uhid: null, patientId: null, pendingIntent: null, collecting: null, collected: {} };
}

function getHmsState(session) {
  if (!session.hms) session.hms = initHmsState();
  return session.hms;
}

async function tryVerify(hms) {
  const { name, age, phone } = hms.collected;
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.join(" ");
  const dob = ageToApproxDob(age);
  const result = await matchOrRegisterPatient({ name: first, l_name: last || first, dob, phone });
  if (!result?.data?.uhid) return false;
  hms.verified = true;
  hms.uhid = result.data.uhid;
  hms.patientId = result.data.patient_id;
  return true;
}

function formatAdmission(data) {
  if (!data) return "I couldn't find any admission record for that patient.";
  return (
    `Here's the latest admission info I found:\n\n` +
    `- **Status:** ${data.admission_status || "Unknown"}\n` +
    `- **Ward:** ${data.ward || "—"}\n` +
    `- **Care team:** ${data.care_team || "—"}\n` +
    `- **Admitting complaint:** ${data.admitting_complaint || "—"}\n` +
    `- **Visit date:** ${data.visit_date || "—"}`
  );
}

function formatDischarge(data) {
  if (!data) return "I couldn't find a discharge summary for that patient.";
  return (
    `Here's the discharge summary I found:\n\n` +
    `- **Status:** ${data.admission_status || "Unknown"}\n` +
    `- **Admitted:** ${data.admission_date || "—"}\n` +
    `- **Discharged:** ${data.discharge_date || "—"}\n` +
    `- **Diagnosis:** ${data.diagnosis || "—"}\n` +
    `- **Summary:** ${data.discharge_summary || "—"}`
  );
}

function formatPrescriptions(data) {
  const list = data?.prescriptions;
  if (!list || !list.length) return "I couldn't find any recent prescriptions on file.";
  const lines = list
    .slice(0, 5)
    .map((p) => {
      const date = p.visit_date || p.date || "Unknown date";
      const what = p.diagnosis || p.complaints || "—";
      const extra = [p.treatment, p.advice].filter(Boolean).join(" — ");
      return `- **${date}:** ${what}${extra ? ` (${extra})` : ""}`;
    })
    .join("\n");
  return `Here are your most recent prescriptions:\n\n${lines}`;
}

function formatVisits(data) {
  const list = data?.last_5_visit_dates;
  if (!list || !list.length) return "I couldn't find any recent visits on file.";
  const lines = list
    .slice(0, 5)
    .map((v) => {
      const when = `${v.visit_date || "Unknown date"}${v.visit_time ? ` ${v.visit_time}` : ""}`;
      const doctor = v.specialist_name ? `Dr. ${titleCase(v.specialist_name)}` : null;
      const details = [v.visit_type, doctor, v.token_number ? `token #${v.token_number}` : null].filter(Boolean);
      return `- **${when}:** ${details.join(" — ") || "Visit"}`;
    })
    .join("\n");
  return `Here are your last ${list.length} visits:\n\n${lines}`;
}

async function fulfillIntent(hms) {
  try {
    switch (hms.pendingIntent) {
      case "admission":
        return formatAdmission((await getAdmissionStatus(hms.uhid))?.data);
      case "discharge":
        return formatDischarge((await getDischargeSummary(hms.uhid))?.data);
      case "prescription":
        return formatPrescriptions((await getPrescriptions(hms.uhid))?.data);
      case "visits":
        return formatVisits((await getPatientProfile(hms.uhid))?.data);
      case "register":
        return `You're already matched to your record (patient ID ${hms.patientId}). Let me know if you'd like your admission status, discharge summary, visit history, or recent prescriptions.`;
      default:
        return "Would you like your admission status, discharge summary, visit history, or recent prescriptions?";
    }
  } catch (err) {
    console.error("HMS data fetch failed:", err?.message || err);
    return HMS_ERROR;
  }
}

/**
 * @param {object} session - the chat session (from sessionStore.js)
 * @param {string} message - the raw incoming user message
 * @returns {Promise<{handled: boolean, reply?: string}>}
 */
export async function handleHmsTurn(session, message) {
  const hms = getHmsState(session);

  if (hms.collecting) {
    const value = message.trim();

    if (hms.collecting === "name") {
      hms.collected.name = value;
      hms.collecting = "age";
      return { handled: true, reply: ASK_AGE };
    }

    if (hms.collecting === "age") {
      const match = value.match(AGE_PATTERN);
      if (!match) return { handled: true, reply: INVALID_AGE };
      hms.collected.age = Number(match[1]);
      hms.collecting = "phone";
      return { handled: true, reply: ASK_PHONE };
    }

    if (hms.collecting === "phone") {
      const digits = value.replace(/\D/g, "");
      if (!PHONE_PATTERN.test(digits)) return { handled: true, reply: INVALID_PHONE };
      hms.collected.phone = digits;
      hms.collecting = null;

      let verified;
      try {
        verified = await tryVerify(hms);
      } catch (err) {
        console.error("HMS patient match failed:", err?.message || err);
        hms.collected = {};
        return { handled: true, reply: HMS_ERROR };
      }
      if (!verified) {
        hms.collected = {};
        return { handled: true, reply: NOT_FOUND };
      }
      return { handled: true, reply: await fulfillIntent(hms) };
    }
  }

  const intent = detectHmsIntent(message);
  if (!intent) return { handled: false };

  hms.pendingIntent = intent;

  if (hms.verified) {
    return { handled: true, reply: await fulfillIntent(hms) };
  }

  hms.collecting = "name";
  hms.collected = {};
  return { handled: true, reply: ASK_NAME };
}
