// Deterministic chatbot appointment-booking flow — a separate, newer system
// from the HMS integration: this one manages appointments scheduled through
// Tulasi's own booking calendar (backed by MongoDB), not the hospital's real
// HMS records. Same design principle as the HMS flow: every step here is
// plain code, never delegated to the LLM's judgment, and the LLM never sees
// the raw database results — replies are built from plain templates.
import { detectBookingIntent } from "./bookingIntent.js";
import { matchSpecialties } from "./doctors.js";
import { isValidDate } from "./slots.js";
import {
  searchDoctors,
  getAvailableSlots,
  bookAppointment,
  listAppointmentsByPhone,
  cancelAppointment,
  rescheduleAppointment,
} from "./bookingData.js";

const PHONE_PATTERN = /\b\d{10}\b/;
const ROLE_PATTERN = /\b(psychiatrists?|psychologists?|counsell?ors?|social workers?)\b/i;
const MAX_CANDIDATES = 5;

function initState() {
  return {
    flow: null,
    stage: null,
    candidates: [],
    selectedDoctor: null,
    date: null,
    time: null,
    availableSlots: [],
    patientName: null,
    patientPhone: null,
    appointments: [],
    selectedAppointment: null,
  };
}

function getState(session) {
  if (!session.booking) session.booking = initState();
  return session.booking;
}

function reset(state) {
  Object.assign(state, initState());
}

function normalizeDate(raw) {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function isPastDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`) < today;
}

function normalizeTime(raw) {
  const m = raw.match(/([01]?\d|2[0-3])\s*:?\s*([0-5]\d)?\s*(am|pm)?/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] || "00";
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function extractDoctorName(text) {
  const m = text.match(/\b(?:dr|ms|mr)\.?\s+([a-z]+(?:\s+[a-z]+)?)/i);
  return m ? m[1].trim() : null;
}

function extractRole(text) {
  const m = text.match(ROLE_PATTERN);
  return m ? m[1] : null;
}

async function attemptSearch(message, { allowRawNameFallback = false } = {}) {
  const name = extractDoctorName(message);
  if (name) return searchDoctors({ search: name });

  const specialties = matchSpecialties(message);
  if (specialties.length) return searchDoctors({ specialty: specialties[0] });

  const role = extractRole(message);
  if (role) return searchDoctors({ role });

  if (allowRawNameFallback) {
    const raw = message.trim();
    if (raw && raw.length <= 50) return searchDoctors({ search: raw });
  }

  return null;
}

function formatDoctorList(doctors) {
  return doctors
    .map((d, i) => `${i + 1}. **${d.name}** — ${d.role}${d.specialties?.length ? ` (${d.specialties.join(", ")})` : ""}`)
    .join("\n");
}

function formatAppointmentList(appts) {
  return appts.map((a, i) => `${i + 1}. **${a.doctorName}** — ${a.date} at ${a.time}`).join("\n");
}

function pickByNumber(list, reply) {
  const num = reply.match(/\b(\d+)\b/);
  if (!num) return null;
  const idx = Number(num[1]) - 1;
  return idx >= 0 && idx < list.length ? list[idx] : null;
}

function pickDoctor(list, reply) {
  const byNumber = pickByNumber(list, reply);
  if (byNumber) return byNumber;
  const lower = reply.toLowerCase();
  return list.find((d) => d.name.toLowerCase().includes(lower) || lower.includes(d.name.toLowerCase()));
}

function resolveDoctorCandidates(state, candidates) {
  if (!candidates || !candidates.length) {
    state.stage = "awaiting_search";
    return "I couldn't find a matching doctor. Could you try a different specialty or name?";
  }
  if (candidates.length === 1) {
    state.selectedDoctor = candidates[0];
    state.stage = "awaiting_date";
    return `Got it — **${candidates[0].name}** (${candidates[0].role}). What date would you like to come in? (e.g. 2026-10-05)`;
  }
  state.candidates = candidates.slice(0, MAX_CANDIDATES);
  state.stage = "choosing_doctor";
  return `Here's who I found:\n\n${formatDoctorList(state.candidates)}\n\nWhich one would you like? (reply with a number or name)`;
}

async function offerSlots(state, doctorId, date) {
  const slots = await getAvailableSlots(doctorId, date);
  if (slots === null) return "I'm having trouble reaching the booking system right now. Please try again shortly.";
  if (!slots.length) {
    state.stage = "awaiting_date";
    return "There are no open slots that day. Could you try a different date?";
  }
  state.date = date;
  state.availableSlots = slots;
  state.stage = "awaiting_time";
  return `Available times on ${date}: ${slots.join(", ")}. Which time works for you?`;
}

// ---- book ----

async function handleBookFlow(state, message) {
  switch (state.stage) {
    case null:
    case undefined:
      return resolveDoctorCandidates(state, await attemptSearch(message));

    case "awaiting_search":
      return resolveDoctorCandidates(state, await attemptSearch(message, { allowRawNameFallback: true }));

    case "choosing_doctor": {
      const picked = pickDoctor(state.candidates, message);
      if (!picked) return `I didn't catch that — please reply with a number (1-${state.candidates.length}) or the doctor's name.`;
      state.selectedDoctor = picked;
      state.stage = "awaiting_date";
      return "What date would you like to come in? (e.g. 2026-10-05)";
    }

    case "awaiting_date": {
      const date = normalizeDate(message.trim());
      if (!date || !isValidDate(date)) return "That doesn't look like a valid date — could you share it as YYYY-MM-DD (e.g. 2026-10-05)?";
      if (isPastDate(date)) return "That date's already passed — could you pick an upcoming date?";
      return offerSlots(state, String(state.selectedDoctor._id), date);
    }

    case "awaiting_time": {
      const time = normalizeTime(message.trim());
      if (!time || !state.availableSlots.includes(time)) {
        return `Please pick one of the available times: ${state.availableSlots.join(", ")}.`;
      }
      state.time = time;
      state.stage = "awaiting_name";
      return "Great — and what's the patient's full name?";
    }

    case "awaiting_name":
      state.patientName = message.trim();
      state.stage = "awaiting_phone";
      return "And a 10-digit phone number to confirm the booking?";

    case "awaiting_phone": {
      const digits = message.replace(/\D/g, "");
      if (!PHONE_PATTERN.test(digits)) return "That doesn't look like a 10-digit phone number — could you share it again?";
      state.patientPhone = digits;
      try {
        const appt = await bookAppointment({
          doctorId: String(state.selectedDoctor._id),
          doctorName: state.selectedDoctor.name,
          patientName: state.patientName,
          patientPhone: state.patientPhone,
          date: state.date,
          time: state.time,
        });
        const summary = `You're booked! **${appt.doctorName}** on **${appt.date}** at **${appt.time}**, under ${appt.patientName}. We'll see you then.`;
        reset(state);
        return summary;
      } catch (err) {
        if (err?.code === 11000) {
          const msg = await offerSlots(state, String(state.selectedDoctor._id), state.date);
          return `That slot was just taken. ${msg}`;
        }
        console.error("Booking failed:", err?.message || err);
        return "I'm having trouble completing the booking right now. Please try again shortly.";
      }
    }

    default:
      reset(state);
      return "Let's start over — would you like to book an appointment?";
  }
}

// ---- view my bookings ----

async function listMyBookings(phone) {
  const appts = await listAppointmentsByPhone(phone);
  if (appts === null) return "I'm having trouble reaching the booking system right now. Please try again shortly.";
  if (!appts.length) return "You don't have any upcoming appointments booked.";
  return `Here are your upcoming appointments:\n\n${formatAppointmentList(appts)}`;
}

async function handleViewFlow(state, message) {
  if (state.stage !== "awaiting_phone_lookup") {
    state.stage = "awaiting_phone_lookup";
    return "Sure — what phone number did you book with?";
  }
  const digits = message.replace(/\D/g, "");
  if (!PHONE_PATTERN.test(digits)) return "That doesn't look like a 10-digit phone number — could you share it again?";
  const reply = await listMyBookings(digits);
  reset(state);
  return reply;
}

// ---- cancel ----

async function handleCancelFlow(state, message) {
  switch (state.stage) {
    case null:
    case undefined:
      state.stage = "awaiting_phone_lookup";
      return "Sure — what phone number did you book with?";

    case "awaiting_phone_lookup": {
      const digits = message.replace(/\D/g, "");
      if (!PHONE_PATTERN.test(digits)) return "That doesn't look like a 10-digit phone number — could you share it again?";
      const appts = await listAppointmentsByPhone(digits);
      if (appts === null) return "I'm having trouble reaching the booking system right now. Please try again shortly.";
      if (!appts.length) {
        reset(state);
        return "You don't have any upcoming appointments to cancel.";
      }
      if (appts.length === 1) {
        state.selectedAppointment = appts[0];
        state.stage = "confirming_cancel";
        return `Cancel your appointment with **${appts[0].doctorName}** on ${appts[0].date} at ${appts[0].time}? (yes/no)`;
      }
      state.appointments = appts;
      state.stage = "choosing_appointment";
      return `Which appointment would you like to cancel?\n\n${formatAppointmentList(appts)}`;
    }

    case "choosing_appointment": {
      const picked = pickByNumber(state.appointments, message);
      if (!picked) return `Please reply with a number (1-${state.appointments.length}).`;
      state.selectedAppointment = picked;
      state.stage = "confirming_cancel";
      return `Cancel your appointment with **${picked.doctorName}** on ${picked.date} at ${picked.time}? (yes/no)`;
    }

    case "confirming_cancel": {
      const confirmed = /^\s*(yes|y|confirm)\b/i.test(message);
      const appt = state.selectedAppointment;
      reset(state);
      if (!confirmed) return "No problem, I've left it as is.";
      const ok = await cancelAppointment(String(appt._id));
      return ok ? "Done — that appointment's been cancelled." : "I couldn't find that appointment anymore — it may already be cancelled.";
    }

    default:
      reset(state);
      return "Let's start over — would you like to cancel an appointment?";
  }
}

// ---- reschedule ----

async function handleRescheduleFlow(state, message) {
  switch (state.stage) {
    case null:
    case undefined:
      state.stage = "awaiting_phone_lookup";
      return "Sure — what phone number did you book with?";

    case "awaiting_phone_lookup": {
      const digits = message.replace(/\D/g, "");
      if (!PHONE_PATTERN.test(digits)) return "That doesn't look like a 10-digit phone number — could you share it again?";
      const appts = await listAppointmentsByPhone(digits);
      if (appts === null) return "I'm having trouble reaching the booking system right now. Please try again shortly.";
      if (!appts.length) {
        reset(state);
        return "You don't have any upcoming appointments to reschedule.";
      }
      if (appts.length === 1) {
        state.selectedAppointment = appts[0];
        state.stage = "awaiting_date";
        return "What new date would you like? (e.g. 2026-10-05)";
      }
      state.appointments = appts;
      state.stage = "choosing_appointment";
      return `Which appointment would you like to reschedule?\n\n${formatAppointmentList(appts)}`;
    }

    case "choosing_appointment": {
      const picked = pickByNumber(state.appointments, message);
      if (!picked) return `Please reply with a number (1-${state.appointments.length}).`;
      state.selectedAppointment = picked;
      state.stage = "awaiting_date";
      return "What new date would you like? (e.g. 2026-10-05)";
    }

    case "awaiting_date": {
      const date = normalizeDate(message.trim());
      if (!date || !isValidDate(date)) return "That doesn't look like a valid date — could you share it as YYYY-MM-DD (e.g. 2026-10-05)?";
      if (isPastDate(date)) return "That date's already passed — could you pick an upcoming date?";
      return offerSlots(state, state.selectedAppointment.doctorId, date);
    }

    case "awaiting_time": {
      const time = normalizeTime(message.trim());
      if (!time || !state.availableSlots.includes(time)) {
        return `Please pick one of the available times: ${state.availableSlots.join(", ")}.`;
      }
      try {
        const ok = await rescheduleAppointment(String(state.selectedAppointment._id), { date: state.date, time });
        const summary = ok
          ? `Done — your appointment with **${state.selectedAppointment.doctorName}** is now on **${state.date}** at **${time}**.`
          : "I couldn't find that appointment anymore — it may already be cancelled.";
        reset(state);
        return summary;
      } catch (err) {
        if (err?.code === "SLOT_TAKEN") {
          const msg = await offerSlots(state, state.selectedAppointment.doctorId, state.date);
          return `That slot is already booked. ${msg}`;
        }
        console.error("Reschedule failed:", err?.message || err);
        reset(state);
        return "I'm having trouble completing that right now. Please try again shortly.";
      }
    }

    default:
      reset(state);
      return "Let's start over — would you like to reschedule an appointment?";
  }
}

/**
 * @param {object} session - the chat session (from sessionStore.js)
 * @param {string} message - the raw incoming user message
 * @returns {Promise<{handled: boolean, reply?: string}>}
 */
export async function handleBookingTurn(session, message) {
  const state = getState(session);

  if (state.flow === "book") return { handled: true, reply: await handleBookFlow(state, message) };
  if (state.flow === "view") return { handled: true, reply: await handleViewFlow(state, message) };
  if (state.flow === "cancel") return { handled: true, reply: await handleCancelFlow(state, message) };
  if (state.flow === "reschedule") return { handled: true, reply: await handleRescheduleFlow(state, message) };

  const intent = detectBookingIntent(message);
  if (!intent) return { handled: false };

  if (intent === "book") {
    state.flow = "book";
    return { handled: true, reply: await handleBookFlow(state, message) };
  }
  if (intent === "myBookings") {
    state.flow = "view";
    return { handled: true, reply: await handleViewFlow(state, message) };
  }
  if (intent === "cancelBooking") {
    state.flow = "cancel";
    return { handled: true, reply: await handleCancelFlow(state, message) };
  }
  if (intent === "reschedule") {
    state.flow = "reschedule";
    return { handled: true, reply: await handleRescheduleFlow(state, message) };
  }

  return { handled: false };
}
