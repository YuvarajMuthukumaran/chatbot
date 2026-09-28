// Deterministic patient-record flow. Like crisis detection, this is
// intentionally NOT delegated to the model: identity verification (name +
// DOB + phone must match a real HMS record before anything is disclosed)
// and the formatting of real medical data are both plain code, not LLM
// output. The model never sees the medical data and never decides whether
// someone is "verified enough" — those calls can't be left to a chat model's
// judgment.
import { detectHmsIntent } from "./hmsIntent.js";
import {
  matchOrRegisterPatient,
  getAdmissionStatus,
  getDischargeSummary,
  getPrescriptions,
} from "./hmsClient.js";

const PHONE_PATTERN = /\b\d{10}\b/;

const ASK_NAME =
  "Sure — to pull that up, I first need to verify it's really you. What's your full name as registered with Tulasi Health Care (first and last name)?";
const ASK_DOB = "Thanks. And your date of birth (e.g. 1999-06-22 or 22/06/1999)?";
const ASK_PHONE = "Got it — and the mobile number on your patient record?";
const INVALID_DOB =
  "That doesn't look like a valid date — could you share it as YYYY-MM-DD (e.g. 1999-06-22)?";
const INVALID_PHONE = "That doesn't look like a 10-digit phone number — could you share it again?";
const NOT_FOUND =
  "I couldn't find a matching patient record with that name, date of birth, and phone number. Please double-check the details, or contact Tulasi Health Care directly if this keeps happening.";
const HMS_ERROR =
  "I'm having trouble reaching our records system right now. Please try again in a moment, or contact Tulasi Health Care directly.";

function normalizeDob(raw) {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function initHmsState() {
  return { verified: false, uhid: null, patientId: null, pendingIntent: null, collecting: null, collected: {} };
}

function getHmsState(session) {
  if (!session.hms) session.hms = initHmsState();
  return session.hms;
}

async function tryVerify(hms) {
  const { name, dob, phone } = hms.collected;
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.join(" ");
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

async function fulfillIntent(hms) {
  try {
    switch (hms.pendingIntent) {
      case "admission":
        return formatAdmission((await getAdmissionStatus(hms.uhid))?.data);
      case "discharge":
        return formatDischarge((await getDischargeSummary(hms.uhid))?.data);
      case "prescription":
        return formatPrescriptions((await getPrescriptions(hms.uhid))?.data);
      case "register":
        return `You're already matched to your record (patient ID ${hms.patientId}). Let me know if you'd like your admission status, discharge summary, or recent prescriptions.`;
      default:
        return "Would you like your admission status, discharge summary, or recent prescriptions?";
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
      hms.collecting = "dob";
      return { handled: true, reply: ASK_DOB };
    }

    if (hms.collecting === "dob") {
      const dob = normalizeDob(value);
      if (!dob) return { handled: true, reply: INVALID_DOB };
      hms.collected.dob = dob;
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
