// Deterministic patient-record flow. Like crisis detection, this is
// intentionally NOT delegated to the model: identity verification (name +
// age + phone must match a real HMS record before anything is disclosed)
// and the formatting of real medical data are both plain code, not LLM
// output. The model never sees the medical data and never decides whether
// someone is "verified enough" — those calls can't be left to a chat model's
// judgment. (Every turn this flow handles is stored as private history — see
// sessionStore.appendTurn — so it isn't replayed to the model later either.)
import { detectHmsIntent } from "./hmsIntent.js";
import {
  matchOrRegisterPatient,
  getAdmissionStatus,
  getDischargeSummary,
  getPatientProfile,
  getPrescriptions,
} from "./hmsClient.js";
import { normalizePhone, cleanPersonName } from "./patientDetails.js";
import { formatDateTime } from "./clinicTime.js";
import { limiters } from "./rateLimit.js";

const CLINIC_PHONE = "8800000255";
const MAX_FAILED_VERIFICATIONS = 3;
const NEVER_MIND = "Never mind";

function titleCase(raw) {
  return raw
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const AGE_PATTERN = /\b(1[01][0-9]|120|[1-9]?[0-9])\b/; // 0–120, sane human age range

const ASK_NAME =
  "Sure — to pull that up, I first need to verify it's really you. What's your full name as registered with Tulasi Health Care (first and last name)?";
const ASK_AGE = "Thanks. And how old are you?";
const ASK_PHONE = "Got it — and the mobile number on your patient record?";
const INVALID_NAME = "Just your full name as it appears on your hospital record, please (for example, Rahul Sharma).";
const INVALID_AGE = "That doesn't look like a valid age — could you share a number, like 27?";
const INVALID_PHONE = "That doesn't look like a 10-digit mobile number — could you share it again?";
const NOT_FOUND =
  "I couldn't find a matching patient record with that name, age, and phone number. Please double-check the details, or contact Tulasi Health Care directly if this keeps happening.";
const LOCKED = `For your privacy, I can't try verifying again in this conversation. Please contact Tulasi Health Care directly at ${CLINIC_PHONE} for help with your records.`;
const RATE_LIMITED = `There have been too many verification attempts from this connection. For everyone's privacy, please try again later, or contact Tulasi Health Care directly at ${CLINIC_PHONE}.`;
const HMS_ERROR =
  "I'm having trouble reaching our records system right now. Please try again in a moment, or contact Tulasi Health Care directly.";
// Registering needs an exact date of birth (the HMS keys patients on it),
// and a record created from a guessed one would be wrong from the start —
// so registration is handed to the front desk rather than done from chat.
const REGISTER_REPLY = `I can't register new patients from this chat — to register, please call Tulasi Health Care at ${CLINIC_PHONE} or visit the front desk, and they'll set up your record properly. I'm happy to help with anything else here, like booking an appointment.`;

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

// API-1 is "match OR register": when nothing matches, it creates a new
// patient and returns that brand-new record's UHID. Treating any returned
// UHID as proof of identity meant a mistyped name "verified" against an
// empty new record — so only the documented existing-patient response
// ("Existing patient found") counts as a match.
export function isExistingPatientMatch(result) {
  return Boolean(result?.data?.uhid) && /\bexisting\b/i.test(result?.message || "");
}

function initHmsState() {
  return { verified: false, uhid: null, patientId: null, pendingIntent: null, collecting: null, collected: {}, failedAttempts: 0 };
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
  if (!isExistingPatientMatch(result)) return false;
  hms.verified = true;
  hms.uhid = result.data.uhid;
  hms.patientId = result.data.patient_id;
  return true;
}

const show = (raw) => (raw ? formatDateTime(raw) : "—");

function formatAdmission(data) {
  if (!data) return "I couldn't find any admission record for you.";
  return (
    `Here's the latest admission info I found:\n\n` +
    `- **Status:** ${data.admission_status || "Unknown"}\n` +
    `- **Ward:** ${data.ward || "—"}\n` +
    `- **Care team:** ${data.care_team || "—"}\n` +
    `- **Admitting complaint:** ${data.admitting_complaint || "—"}\n` +
    `- **Visit date:** ${show(data.visit_date)}`
  );
}

function formatDischarge(data) {
  if (!data) return "I couldn't find a discharge summary for you.";
  return (
    `Here's the discharge summary I found:\n\n` +
    `- **Status:** ${data.admission_status || "Unknown"}\n` +
    `- **Admitted:** ${show(data.admission_date)}\n` +
    `- **Discharged:** ${show(data.discharge_date)}\n` +
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
      const date = show(p.visit_date || p.date);
      const what = p.diagnosis || p.complaints || "—";
      const extra = [p.treatment, p.advice].filter(Boolean).join(" — ");
      return `- **${date}:** ${what}${extra ? ` (${extra})` : ""}`;
    })
    .join("\n");
  return `Here are your most recent prescriptions:\n\n${lines}\n\nIf you have any questions about your medicines, please check with your doctor before changing or stopping anything.`;
}

function formatVisits(data) {
  const list = data?.last_5_visit_dates;
  if (!list || !list.length) return "I couldn't find any recent visits on file.";
  const lines = list
    .slice(0, 5)
    .map((v) => {
      const when = show(v.visit_time ? `${v.visit_date} ${v.visit_time}` : v.visit_date);
      const doctor = v.specialist_name ? `Dr. ${titleCase(v.specialist_name)}` : null;
      const details = [v.visit_type, doctor, v.token_number ? `token #${v.token_number}` : null].filter(Boolean);
      return `- **${when}:** ${details.join(" — ") || "Visit"}`;
    })
    .join("\n");
  return `Here are your last ${list.length} visits:\n\n${lines}`;
}

// Once verified, the other record types are one tap away.
const RECORD_CHIPS = {
  admission: "My admission status",
  discharge: "My discharge summary",
  prescription: "My prescriptions",
  visits: "My visit history",
};

function otherRecordChips(current) {
  return Object.entries(RECORD_CHIPS)
    .filter(([intent]) => intent !== current)
    .map(([, label]) => label);
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
      case "findId":
        return `You're matched to your record — your UHID is **${hms.uhid}**. Let me know if you'd like your admission status, discharge summary, visit history, or recent prescriptions.`;
      default:
        return "Would you like your admission status, discharge summary, visit history, or recent prescriptions?";
    }
  } catch (err) {
    console.error("HMS data fetch failed:", err?.message || err);
    return HMS_ERROR;
  }
}

// `sensitive`: the reply holds records someone had to verify their identity
// to see. The client doesn't save it with the rest of the conversation, so
// the next person using the same device can't read it without that check.
async function fulfilled(hms) {
  return { handled: true, reply: await fulfillIntent(hms), quickReplies: otherRecordChips(hms.pendingIntent), sensitive: true };
}

function ask(reply) {
  return { handled: true, reply, quickReplies: [NEVER_MIND] };
}

async function collectStep(hms, message, ctx) {
  const value = message.trim();

  if (hms.collecting === "name") {
    const name = cleanPersonName(value);
    if (!name) return ask(INVALID_NAME);
    hms.collected.name = name;
    hms.collecting = "age";
    return ask(ASK_AGE);
  }

  if (hms.collecting === "age") {
    const match = value.match(AGE_PATTERN);
    const age = match ? Number(match[1]) : NaN;
    if (!(age >= 1 && age <= 120)) return ask(INVALID_AGE);
    hms.collected.age = age;
    hms.collecting = "phone";
    return ask(ASK_PHONE);
  }

  if (hms.collecting === "phone") {
    const phone = normalizePhone(value);
    if (!phone) return ask(INVALID_PHONE);
    hms.collected.phone = phone;
    hms.collecting = null;

    if (ctx?.ip && !limiters.hmsVerify.consume(ctx.ip).ok) {
      hms.collected = {};
      return { handled: true, reply: RATE_LIMITED };
    }

    let verified;
    try {
      verified = await tryVerify(hms);
    } catch (err) {
      console.error("HMS patient match failed:", err?.message || err);
      hms.collected = {};
      return { handled: true, reply: HMS_ERROR };
    }
    hms.collected = {};
    if (!verified) {
      hms.failedAttempts += 1;
      return { handled: true, reply: hms.failedAttempts >= MAX_FAILED_VERIFICATIONS ? LOCKED : NOT_FOUND };
    }
    return fulfilled(hms);
  }

  hms.collecting = null;
  return { handled: false };
}

/**
 * @param {object} session - the chat session (from sessionStore.js)
 * @param {string} message - the raw incoming user message
 * @param {{ip?: string}} [ctx] - request context, for per-client rate limits
 * @returns {Promise<{handled: boolean, reply?: string, quickReplies?: string[]}>}
 */
export async function handleHmsTurn(session, message, ctx = {}) {
  const hms = getHmsState(session);
  const intent = detectHmsIntent(message);

  // Mid-verification, a message is an answer — unless it's a fresh records
  // request, which restarts the verification for that request instead of
  // being taken as someone's name.
  if (hms.collecting && !intent) return collectStep(hms, message, ctx);
  if (!intent) return { handled: false };

  if (intent === "register") {
    hms.collecting = null;
    return { handled: true, reply: REGISTER_REPLY };
  }

  hms.pendingIntent = intent;
  if (hms.verified) return fulfilled(hms);
  if (hms.failedAttempts >= MAX_FAILED_VERIFICATIONS) return { handled: true, reply: LOCKED };

  hms.collecting = "name";
  hms.collected = {};
  return ask(ASK_NAME);
}

/** Drops an in-progress verification (e.g. on crisis language or "never mind"). */
export function abandonHmsCollection(session) {
  if (session.hms) {
    session.hms.collecting = null;
    session.hms.collected = {};
  }
}
