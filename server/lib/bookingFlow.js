// Deterministic chatbot appointment-booking flow — a separate, newer system
// from the HMS integration: this one manages appointments scheduled through
// Tulasi's own booking calendar (backed by MongoDB), not the hospital's real
// HMS records. Same design principle as the HMS flow: every step here is
// plain code, never delegated to the LLM's judgment, and the LLM never sees
// the raw database results — replies are built from plain templates.
//
// Each reply can carry `quickReplies`: tappable suggestions the client shows
// as chips. They're sent back as ordinary messages, so every chip's text is
// something this flow already understands when typed — and every reply still
// reads fine on its own for a client that doesn't show chips.
import { detectBookingIntent } from "./bookingIntent.js";
import { matchSpecialties, specialtyLabel, getGeneralistDoctor } from "./doctors.js";
import { checkBookableDate, BOOKING_WINDOW_DAYS, availableSlots as openSlotsFor } from "./slots.js";
import { parseDate, parseTime, isDateWord } from "./dateParse.js";
import { clinicToday, addDays, formatDate, formatTime, timeToMinutes } from "./clinicTime.js";
import { normalizePhone, cleanPersonName, extractPatientDetails } from "./patientDetails.js";
import { limiters } from "./rateLimit.js";
import {
  searchDoctors,
  getAvailableSlots,
  bookAppointment,
  listAppointmentsByPhone,
  cancelAppointment,
  rescheduleAppointment,
} from "./bookingData.js";

const ROLE_PATTERN = /\b(psychiatrists?|psychologists?|counsell?ors?|social workers?)\b/i;
const MAX_CANDIDATES = 5;
const NEVER_MIND = "Never mind";

const UNAVAILABLE = "I'm having trouble reaching the booking system right now. Please try again in a little while.";
const LOOKUP_LIMITED =
  "For everyone's privacy, I can only look up a few phone numbers in a short time. Please try again in a few minutes.";
const BOOKING_LIMITED = "That's quite a few bookings in a short time — please try again a bit later, or call Tulasi Health Care directly.";

const INTENT_FLOWS = { book: "book", myBookings: "view", cancelBooking: "cancel", reschedule: "reschedule" };

function initState() {
  return {
    flow: null,
    stage: null,
    candidates: [],
    selectedDoctor: null,
    date: null,
    time: null,
    availableSlots: [],
    // A date/time mentioned up front ("book dr anu tomorrow at 11"), applied
    // once a doctor is chosen instead of asking for it again.
    pendingDate: null,
    pendingTime: null,
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

function say(reply, quickReplies, extra) {
  return { reply, ...(quickReplies?.length ? { quickReplies } : {}), ...extra };
}

// ---- understanding answers ----

const YES = /^\s*(?:yes|y|yeah|yep|yup|sure|ok|okay|confirm(?:ed)?|correct|go ahead|please do|do it|book it|haan|han|ha|ji|haan ji|aamam|aama|avunu|sari|sare)\b/i;
const NO = /^\s*(?:no|n|nope|nah|don'?t|do not|not really|nahi|nahin|illa|illai|vendam|vaddu|ledu|kaadu)\b/i;

// Only ever called within the cancellation flow, where "cancel it" means yes.
const CANCEL_CONFIRM = /^\s*(?:please\s+)?cancel(?:\s+it)?\b/i;

const ORDINAL_WORDS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };

function pickByNumber(list, reply) {
  const num = reply.match(/\b(\d+)(?:st|nd|rd|th)?\b/);
  if (num) {
    const idx = Number(num[1]) - 1;
    return idx >= 0 && idx < list.length ? list[idx] : null;
  }
  const word = reply.toLowerCase().match(/\b(first|second|third|fourth|fifth|last)\b/);
  if (word) return (word[1] === "last" ? list[list.length - 1] : list[ORDINAL_WORDS[word[1]] - 1]) ?? null;
  return null;
}

// "Dr. (Col.) Pavan Kumar Pardal" -> "pavan kumar pardal"
function simplifyName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:dr|ms|mr|mrs)\b\.?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickDoctor(list, reply) {
  const byNumber = pickByNumber(list, reply);
  if (byNumber) return byNumber;
  const wanted = simplifyName(reply);
  if (wanted.length < 3) return null;
  const wantedWords = wanted.split(" ");
  return (
    list.find((d) => simplifyName(d.name) === wanted) ||
    list.find((d) => simplifyName(d.name).includes(wanted)) ||
    list.find((d) => simplifyName(d.name).split(" ").some((w) => w.length >= 3 && wantedWords.includes(w))) ||
    null
  );
}

const NON_NAME_WORDS = new Set([
  "a", "an", "the", "someone", "somebody", "anyone", "any", "doctor", "doctors", "dr", "specialist", "specialists",
  "me", "my", "myself", "him", "her", "them", "it", "this", "that", "one", "you", "u", "some", "please", "pls",
  "appointment", "appointments", "session", "consultation", "checkup", "visit", "help", "next", "whoever",
]);

// Words that end a captured name: "dr anu tomorrow" means "anu".
const NAME_STOP_WORDS = new Set([
  "today", "tomorrow", "tonight", "next", "this", "coming", "on", "at", "for", "please", "pls", "and", "asap",
  "morning", "afternoon", "evening", "sometime", "soon", "about", "regarding",
]);

// Military/academic ranks written in parentheses ("Dr. (Col.) ...") would
// otherwise break the "title followed by a name" pattern below.
const PARENTHETICAL_RANK = /\((?:col|lt|maj|capt|brig|gen|prof|dr)\.?\)\s*/gi;
const NAME_PATTERN =
  /\b(?:dr|ms|mr)\.?\s+([a-z]+(?:\s+[a-z]+){0,2})|\b(?:with|see|meet|for)\s+(?:(?:dr|ms|mr)\.?\s+)?([a-z]+(?:\s+[a-z]+){0,2})/gi;

// "for" is a weaker signal than "dr/with/see/meet" — it also introduces dates
// ("appointment for tomorrow") and specialties ("appointment for anxiety"),
// so a candidate is rejected whenever it reads as a date word, a role, or a
// known specialty, leaving it to those searches instead. Every match in the
// message is tried, so a rejected early one ("see a doctor") doesn't hide a
// real name later on ("... maybe dr anu").
function extractDoctorName(text) {
  const normalized = text.replace(PARENTHETICAL_RANK, "");
  for (const m of normalized.matchAll(NAME_PATTERN)) {
    const words = [];
    for (const word of (m[1] || m[2] || "").trim().split(/\s+/)) {
      if (!word || NAME_STOP_WORDS.has(word.toLowerCase()) || isDateWord(word)) break;
      words.push(word);
    }
    if (!words.length || NON_NAME_WORDS.has(words[0].toLowerCase())) continue;
    const name = words.join(" ");
    if (matchSpecialties(name).length || ROLE_PATTERN.test(name)) continue;
    return name;
  }
  return null;
}

function extractRole(text) {
  const m = text.match(ROLE_PATTERN);
  return m ? m[1] : null;
}

// ---- finding a doctor ----

// Matches "book with either of them", "any one of them", "the first one",
// etc. — someone referring back to doctors just shown as recommendation
// cards, rather than naming anyone. Checked before name/specialty/role
// extraction since a vague reference like this won't match those anyway,
// and it needs `session` (for the just-shown list), which those don't.
const VAGUE_DOCTOR_REFERENCE =
  /\b(any one|either one|one of them|either of them|any of them|both of them|both doctors|the first one|the second one|that one)\b/i;

// "anyone is fine", "no preference" — an answer to "who would you like to see?"
const ANY_DOCTOR = /\b(anyone|anybody|any doctor|any available|whoever|doesn'?t matter|no preference|you choose|you pick)\b/i;

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Best tag overlap first; ties broken randomly (shuffle, then a stable sort)
// so the same alphabetically-first names don't get every booking — the same
// fairness rule the chat recommendations use.
function rankBySpecialty(doctors, tags) {
  const score = (d) => (d.specialties || []).filter((s) => tags.includes(s)).length;
  return shuffle(doctors).sort((a, b) => score(b) - score(a));
}

/** Name search that degrades gracefully: "pooja ji" -> "pooja", "dr sharma" etc. */
async function searchDoctorsByName(name) {
  const words = name.trim().split(/\s+/);
  const attempts = [name, ...(words.length > 1 ? [words[0], words[words.length - 1]] : [])];
  for (const attempt of attempts) {
    const found = await searchDoctors({ search: attempt });
    if (found === null) return null;
    if (found.length) return found;
  }
  return [];
}

async function resolveRecommendedDoctors(session) {
  const recommended = session?.lastRecommendedDoctors;
  if (!recommended?.length) return [];
  const results = [];
  for (const d of recommended) {
    const found = await searchDoctors({ search: d.name });
    if (found === null) return null;
    if (found.length) results.push(found[0]);
  }
  return results;
}

/**
 * @returns {Promise<{kind: "none"} | {kind: "unavailable"} | {kind: "found", doctors: object[], tags?: string[], total?: number, generalistFallback?: boolean}>}
 *   "none" means the message didn't name anyone or anything to search by.
 */
async function attemptSearch(message, { allowRawNameFallback = false, session = null } = {}) {
  const found = (doctors, extra) => (doctors === null ? { kind: "unavailable" } : { kind: "found", doctors, ...extra });

  if (session && VAGUE_DOCTOR_REFERENCE.test(message)) {
    const recommended = await resolveRecommendedDoctors(session);
    if (recommended === null) return { kind: "unavailable" };
    if (recommended.length) return found(recommended);
  }

  const name = extractDoctorName(message);
  if (name) return found(await searchDoctorsByName(name));

  const tags = matchSpecialties(message);
  if (tags.length) {
    const doctors = await searchDoctors({ specialties: tags });
    if (doctors === null) return { kind: "unavailable" };
    if (doctors.length) return found(rankBySpecialty(doctors, tags), { tags, total: doctors.length });
    // A concern nobody is specifically tagged for (sleep, say) — fall back
    // to the generalist, the same way the chat recommendations do.
    const generalistName = getGeneralistDoctor()[0]?.name;
    const generalist = generalistName ? await searchDoctors({ search: generalistName }) : [];
    return found(generalist, { tags, generalistFallback: true });
  }

  const role = extractRole(message);
  if (role) {
    const doctors = await searchDoctors({ role });
    return doctors === null ? { kind: "unavailable" } : found(shuffle(doctors), { total: doctors.length });
  }

  if (ANY_DOCTOR.test(message)) {
    const doctors = await searchDoctors({ role: "psychiatrist" });
    return doctors === null ? { kind: "unavailable" } : found(shuffle(doctors), { total: doctors.length, anyone: true });
  }

  if (allowRawNameFallback) {
    const raw = message.trim();
    if (raw && raw.length <= 50) return found(await searchDoctorsByName(raw));
  }

  return { kind: "none" };
}

// `searched` tags are listed first, so an anxiety search shows "Anxiety, …"
// rather than whichever three tags happen to come first for everyone.
function formatDoctorList(doctors, searched = []) {
  return doctors
    .map((d, i) => {
      const own = d.specialties || [];
      const ordered = [...own.filter((s) => searched.includes(s)), ...own.filter((s) => !searched.includes(s))];
      const tags = ordered.slice(0, 3).map(specialtyLabel);
      const more = own.length > 3 ? ", …" : "";
      return `${i + 1}. **${d.name}** — ${d.role}${tags.length ? ` (${tags.join(", ")}${more})` : ""}`;
    })
    .join("\n");
}

function whoChips(session) {
  const recommended = (session?.lastRecommendedDoctors || []).slice(0, 2).map((d) => d.name);
  const topics = recommended.length
    ? ["Anxiety", "Stress"]
    : ["Anxiety", "Depression", "Stress", "OCD", "Addiction", "For my child"];
  return [...recommended, ...topics, NEVER_MIND];
}

function askWho(state, session, { intro } = {}) {
  state.stage = "awaiting_search";
  const when = state.pendingDate ? ` on ${formatDate(state.pendingDate)}` : "";
  const question = `ho would you like to see${when}? You can name a doctor, or tell me what you'd like help with (for example anxiety, stress, or sleep).`;
  return say(intro ? `${intro} W${question}` : `Sure — w${question}`, whoChips(session));
}

// Specialty labels mid-sentence: "for anxiety", but "for OCD", not "for ocd".
function topicOf(tags) {
  return tags
    .map(specialtyLabel)
    .map((label) => (label === label.toUpperCase() ? label : label[0].toLowerCase() + label.slice(1)))
    .join(" / ");
}

async function resolveDoctorCandidates(state, result, session) {
  if (result.kind === "unavailable") {
    reset(state);
    return say(UNAVAILABLE);
  }
  if (result.kind === "none") return askWho(state, session);
  if (!result.doctors.length) {
    return askWho(state, session, { intro: "I couldn't find a doctor matching that." });
  }

  if (result.doctors.length === 1) {
    const [doctor] = result.doctors;
    const intro = result.generalistFallback
      ? `I don't have a specialist listed specifically for ${topicOf(result.tags).replace(/ \/ /g, " or ")}, but **${doctor.name}** (${doctor.role}) takes a holistic approach across a wide range of concerns.`
      : `Got it — **${doctor.name}** (${doctor.role}).`;
    return selectDoctor(state, doctor, intro);
  }

  state.candidates = result.doctors.slice(0, MAX_CANDIDATES);
  state.stage = "choosing_doctor";
  let heading = "Here's who I found:";
  if (result.tags?.length) {
    const topic = topicOf(result.tags);
    heading =
      result.total > MAX_CANDIDATES
        ? `Here are some of our specialists for ${topic} (${result.total} in all — [see everyone](/doctors?specialty=${encodeURIComponent(result.tags[0])})):`
        : `Here are our specialists for ${topic}:`;
  } else if (result.anyone) {
    heading = "Here are a few of our psychiatrists with general availability:";
  }
  return say(
    `${heading}\n\n${formatDoctorList(state.candidates, result.tags)}\n\nWhich one would you like? (reply with a number or name)`,
    [...state.candidates.map((d) => d.name), NEVER_MIND]
  );
}

// ---- choosing a date and time ----

function dateChips(now = new Date()) {
  const today = clinicToday(now);
  const chips = [];
  // "Today" only while there's still a same-day slot left to offer.
  if (openSlotsFor([], { date: today, now }).length) chips.push("Today");
  chips.push("Tomorrow");
  for (let i = 2; chips.length < 5; i++) chips.push(formatDate(addDays(today, i), now));
  return [...chips, NEVER_MIND];
}

const ASK_DATE = 'What date would you like to come in? You can say things like "tomorrow", "Friday", or "5 Oct".';

function selectDoctor(state, doctor, intro) {
  state.selectedDoctor = doctor;
  state.candidates = [];
  if (state.pendingDate) {
    const date = state.pendingDate;
    state.pendingDate = null;
    return offerSlots(state, String(doctor._id), date, { intro });
  }
  state.stage = "awaiting_date";
  return say(`${intro} ${ASK_DATE}`, dateChips());
}

function formatSlotList(slots) {
  const morning = slots.filter((t) => timeToMinutes(t) < 13 * 60).map(formatTime);
  const afternoon = slots.filter((t) => timeToMinutes(t) >= 13 * 60).map(formatTime);
  return [morning.length && `- Morning: ${morning.join(", ")}`, afternoon.length && `- Afternoon: ${afternoon.join(", ")}`]
    .filter(Boolean)
    .join("\n");
}

async function offerSlots(state, doctorId, date, { intro } = {}) {
  const prefix = intro ? `${intro} ` : "";
  const slots = await getAvailableSlots(doctorId, date);
  if (slots === null) return say(`${prefix}${UNAVAILABLE}`);
  if (!slots.length) {
    state.stage = "awaiting_date";
    const why = date === clinicToday() ? " (the rest of today is either booked or too soon)" : "";
    return say(`${prefix}There are no open times on ${formatDate(date)}${why}. Could you pick another day?`, dateChips());
  }
  state.date = date;
  state.availableSlots = slots;

  if (state.pendingTime) {
    const wanted = state.pendingTime;
    state.pendingTime = null;
    if (slots.includes(wanted)) return afterTimeChosen(state, wanted, prefix);
    state.stage = "awaiting_time";
    return say(
      `${prefix}${formatTime(wanted)} isn't open on ${formatDate(date)}, but these times are:\n${formatSlotList(slots)}\n\nWhich works for you?`,
      [...slots.map(formatTime), NEVER_MIND]
    );
  }

  state.stage = "awaiting_time";
  return say(`${prefix}Open times on **${formatDate(date)}**:\n${formatSlotList(slots)}\n\nWhich time works for you?`, [
    ...slots.map(formatTime),
    NEVER_MIND,
  ]);
}

async function handleDateAnswer(state, message, doctorId) {
  const date = parseDate(message);
  if (!date) return say(ASK_DATE, dateChips());
  // "tomorrow at 3pm" answers the next question too.
  state.pendingTime = parseTime(message, { strict: true }) || state.pendingTime;
  switch (checkBookableDate(date)) {
    case "invalid":
      return say('That doesn\'t look like a real date — could you try again? (for example "5 Oct" or "tomorrow")', dateChips());
    case "past":
      return say("That date has already passed — could you pick an upcoming one?", dateChips());
    case "too_far":
      return say(`I can only book up to ${BOOKING_WINDOW_DAYS} days ahead — could you pick an earlier date?`, dateChips());
    default:
      return offerSlots(state, doctorId, date);
  }
}

function confirmBookingPrompt(state, prefix = "") {
  state.stage = "confirming_booking";
  return say(
    `${prefix}Please confirm: **${state.selectedDoctor.name}** on **${formatDate(state.date)} at ${formatTime(state.time)}**, for **${state.patientName}** (mobile ${state.patientPhone}). Shall I book it?`,
    ["Yes, book it", "No, don't book"]
  );
}

function confirmReschedulePrompt(state, prefix = "") {
  state.stage = "confirming_reschedule";
  const appt = state.selectedAppointment;
  return say(
    `${prefix}Move your appointment with **${appt.doctorName}** from ${formatDate(appt.date)} at ${formatTime(appt.time)} to **${formatDate(state.date)} at ${formatTime(state.time)}**?`,
    ["Yes, move it", "No, keep it"]
  );
}

// What happens once a time is settled depends on the flow — and on whether
// the patient's details are already known (e.g. retrying after the chosen
// slot was taken by someone else a moment earlier).
function afterTimeChosen(state, time, prefix = "") {
  state.time = time;
  if (state.flow === "reschedule") return confirmReschedulePrompt(state, prefix);
  if (state.patientName && state.patientPhone) return confirmBookingPrompt(state, prefix);
  if (state.patientName) {
    state.stage = "awaiting_phone";
    return say(`${prefix}**${formatDate(state.date)} at ${formatTime(time)}** it is, for ${state.patientName}. And a 10-digit mobile number for the booking?`, [NEVER_MIND]);
  }
  state.stage = "awaiting_name";
  return say(`${prefix}**${formatDate(state.date)} at ${formatTime(time)}** it is. What's the patient's full name?`, [NEVER_MIND]);
}

// Parts of the day, matching how formatSlotList splits Morning/Afternoon.
const PARTS_OF_DAY = [
  { label: "Morning", pattern: /\b(?:morning|subah|savere|kaalai|kalai|udayam|poddunna)\b|सुबह|காலை|ఉదయం/i, test: (m) => m < 13 * 60 },
  { label: "Afternoon", pattern: /\b(?:afternoon|lunch|dopahar|dophar|madhyanam|madhyaahnam)\b|दोपहर|மதியம்|మధ్యాహ్నం/i, test: (m) => m >= 13 * 60 && m < 16 * 60 },
  { label: "Evening", pattern: /\b(?:evening|shaam|sham|maalai|malai|sayantram|saayantram)\b|शाम|மாலை|సాయంత్రం/i, test: (m) => m >= 16 * 60 },
];

function partOfDay(message) {
  return PARTS_OF_DAY.find((p) => p.pattern.test(message)) || null;
}

/** A time answer. Naming a different day instead ("actually, Friday?" or
 * "tomorrow at 10") switches days, keeping any time given along with it. */
async function handleTimeAnswer(state, message, doctorId) {
  const time = parseTime(message);
  // "the 3rd one" is someone pointing at a listed time, not the 3rd of the month.
  const date = /\bone\b/i.test(message) ? null : parseDate(message);
  if (date && date !== state.date) {
    state.pendingTime = time;
    return handleDateAnswer(state, message, doctorId);
  }
  if (time && state.availableSlots.includes(time)) return afterTimeChosen(state, time);
  // "morning" / "shaam ko": narrow the list instead of repeating all of it.
  const period = time ? null : partOfDay(message);
  if (period) {
    const inPeriod = state.availableSlots.filter((t) => period.test(timeToMinutes(t)));
    if (inPeriod.length) {
      return say(`${period.label} times on **${formatDate(state.date)}**: ${inPeriod.map(formatTime).join(", ")}. Which one works?`, [
        ...inPeriod.map(formatTime),
        NEVER_MIND,
      ]);
    }
    return say(
      `There's nothing open in the ${period.label.toLowerCase()} on ${formatDate(state.date)}. These times are free:\n${formatSlotList(state.availableSlots)}`,
      [...state.availableSlots.map(formatTime), NEVER_MIND]
    );
  }
  const lead = time ? `${formatTime(time)} isn't open on ${formatDate(state.date)}. ` : "";
  return say(`${lead}Please pick one of these times:\n${formatSlotList(state.availableSlots)}`, [
    ...state.availableSlots.map(formatTime),
    NEVER_MIND,
  ]);
}

// ---- appointment lookups ----

function lookupAllowed(ctx) {
  return !ctx?.ip || limiters.phoneLookup.consume(ctx.ip).ok;
}

function formatAppointment(a) {
  return `**${a.doctorName}** — ${formatDate(a.date)} at ${formatTime(a.time)}`;
}

function appointmentChips(appts) {
  return [...appts.map((a, i) => `${i + 1}. ${a.doctorName}, ${formatDate(a.date)} ${formatTime(a.time)}`), NEVER_MIND];
}

// ---- book ----

async function handleBookFlow(state, message, ctx) {
  const { session } = ctx;
  switch (state.stage) {
    case null:
    case undefined: {
      const date = parseDate(message, { strict: true });
      if (date && checkBookableDate(date) === "ok") state.pendingDate = date;
      state.pendingTime = parseTime(message, { strict: true });
      // "...for my mother, her name is Sunita Devi and number is 98765 01234":
      // don't ask again for what's already been given.
      const given = extractPatientDetails(message);
      if (given.name) state.patientName = given.name;
      if (given.phone) state.patientPhone = given.phone;
      return resolveDoctorCandidates(state, await attemptSearch(message, { session }), session);
    }

    case "awaiting_search":
      return resolveDoctorCandidates(state, await attemptSearch(message, { allowRawNameFallback: true, session }), session);

    case "choosing_doctor": {
      const picked = pickDoctor(state.candidates, message);
      if (picked) return selectDoctor(state, picked, `Got it — **${picked.name}**.`);
      // Not one of the listed names — maybe a fresh search ("actually, someone for OCD").
      const fresh = await attemptSearch(message, { session });
      if (fresh.kind === "found" && fresh.doctors.length) return resolveDoctorCandidates(state, fresh, session);
      return say(`I didn't catch that — please reply with a number (1-${state.candidates.length}) or the doctor's name.`, [
        ...state.candidates.map((d) => d.name),
        NEVER_MIND,
      ]);
    }

    case "awaiting_date":
      return handleDateAnswer(state, message, String(state.selectedDoctor._id));

    case "awaiting_time":
      return handleTimeAnswer(state, message, String(state.selectedDoctor._id));

    case "awaiting_name": {
      const name = cleanPersonName(message);
      if (!name) return say("Just the patient's full name, please (for example, Priya Sharma).", [NEVER_MIND]);
      state.patientName = name;
      state.stage = "awaiting_phone";
      return say("And a 10-digit mobile number for the booking?", [NEVER_MIND]);
    }

    case "awaiting_phone": {
      const phone = normalizePhone(message);
      if (!phone) return say("That doesn't look like a 10-digit mobile number — could you share it again?", [NEVER_MIND]);
      state.patientPhone = phone;
      return confirmBookingPrompt(state);
    }

    case "confirming_booking": {
      if (NO.test(message)) {
        reset(state);
        return say("Okay — I haven't booked anything. Just say the word if you'd like to try a different time.");
      }
      if (!YES.test(message)) {
        return say("Should I go ahead and book it? (yes/no)", ["Yes, book it", "No, don't book"]);
      }
      if (ctx.ip && !limiters.booking.consume(ctx.ip).ok) {
        reset(state);
        return say(BOOKING_LIMITED);
      }
      const doctor = state.selectedDoctor;
      try {
        const appt = await bookAppointment({
          doctorId: String(doctor._id),
          doctorName: doctor.name,
          patientName: state.patientName,
          patientPhone: state.patientPhone,
          date: state.date,
          time: state.time,
        });
        reset(state);
        ctx.session.lastBookedAt = Date.now();
        const when = `${formatDate(appt.date)} at ${formatTime(appt.time)}`;
        return say(
          `You're booked! **${appt.doctorName}** on **${when}**, under ${appt.patientName}. We'll see you then.\n\nIf your plans change, just say "reschedule my appointment" or "cancel my appointment".`,
          undefined,
          { llmNote: `They just booked an appointment with ${appt.doctorName} for ${when}.` }
        );
      } catch (err) {
        if (err?.code === 11000) {
          const again = await offerSlots(state, String(doctor._id), state.date);
          return { ...again, reply: `Sorry — that slot was just taken. ${again.reply}` };
        }
        console.error("Booking failed:", err?.message || err);
        reset(state);
        return say("I'm having trouble completing the booking right now. Please try again shortly.");
      }
    }

    default:
      reset(state);
      return say("Let's start over — would you like to book an appointment?");
  }
}

// ---- looking up appointments (shared by view / cancel / reschedule) ----

const ASK_PHONE_LOOKUP = "Sure — what mobile number did you book with?";

/** @returns {Promise<{appts: object[]} | {reply: object}>} */
async function lookUpByPhone(state, message, ctx) {
  const phone = normalizePhone(message);
  if (!phone) {
    state.stage = "awaiting_phone_lookup";
    return { reply: say("That doesn't look like a 10-digit mobile number — could you share it again?", [NEVER_MIND]) };
  }
  if (!lookupAllowed(ctx)) {
    reset(state);
    return { reply: say(LOOKUP_LIMITED) };
  }
  const appts = await listAppointmentsByPhone(phone, { upcomingOnly: true });
  if (appts === null) {
    reset(state);
    return { reply: say(UNAVAILABLE) };
  }
  return { appts };
}

// The first message can already carry the number ("show my bookings for 98...").
function startLookup(state, message) {
  state.stage = "awaiting_phone_lookup";
  return normalizePhone(message) ? null : say(ASK_PHONE_LOOKUP, [NEVER_MIND]);
}

// ---- view my bookings ----

async function handleViewFlow(state, message, ctx) {
  if (state.stage !== "awaiting_phone_lookup") {
    const ask = startLookup(state, message);
    if (ask) return ask;
  }
  const { appts, reply } = await lookUpByPhone(state, message, ctx);
  if (reply) return reply;
  reset(state);
  if (!appts.length) return say("You don't have any upcoming appointments booked under that number.");
  return say(
    `Here are your upcoming appointments:\n\n${appts.map((a, i) => `${i + 1}. ${formatAppointment(a)}`).join("\n")}\n\nIf you need to change one, just say "reschedule my appointment" or "cancel my appointment".`
  );
}

// ---- cancel ----

function confirmCancel(state, appt) {
  state.selectedAppointment = appt;
  state.stage = "confirming_cancel";
  return say(`Cancel your appointment with ${formatAppointment(appt)}? (yes/no)`, ["Yes, cancel it", "No, keep it"]);
}

async function handleCancelFlow(state, message, ctx) {
  switch (state.stage) {
    case null:
    case undefined: {
      const ask = startLookup(state, message);
      if (ask) return ask;
    }
    // falls through: the number came with the request itself
    case "awaiting_phone_lookup": {
      const { appts, reply } = await lookUpByPhone(state, message, ctx);
      if (reply) return reply;
      if (!appts.length) {
        reset(state);
        return say("You don't have any upcoming appointments to cancel under that number.");
      }
      if (appts.length === 1) return confirmCancel(state, appts[0]);
      state.appointments = appts;
      state.stage = "choosing_appointment";
      return say(
        `Which appointment would you like to cancel?\n\n${appts.map((a, i) => `${i + 1}. ${formatAppointment(a)}`).join("\n")}`,
        appointmentChips(appts)
      );
    }

    case "choosing_appointment": {
      const picked = pickByNumber(state.appointments, message);
      if (!picked) return say(`Please reply with a number (1-${state.appointments.length}).`, appointmentChips(state.appointments));
      return confirmCancel(state, picked);
    }

    case "confirming_cancel": {
      const appt = state.selectedAppointment;
      if (NO.test(message)) {
        reset(state);
        return say("No problem — I've left it as it is.");
      }
      if (!YES.test(message) && !CANCEL_CONFIRM.test(message)) {
        return say(`Should I cancel your appointment with ${formatAppointment(appt)}? (yes/no)`, ["Yes, cancel it", "No, keep it"]);
      }
      reset(state);
      const ok = await cancelAppointment(String(appt._id));
      if (!ok) return say("I couldn't find that appointment anymore — it may already be cancelled.");
      return say(`Done — your appointment with ${formatAppointment(appt)} has been cancelled.`, undefined, {
        llmNote: `They just cancelled their appointment with ${appt.doctorName} on ${formatDate(appt.date)}.`,
      });
    }

    default:
      reset(state);
      return say("Let's start over — would you like to cancel an appointment?");
  }
}

// ---- reschedule ----

function askNewDate(state, appt) {
  state.selectedAppointment = appt;
  state.stage = "awaiting_date";
  return say(`Let's move your appointment with ${formatAppointment(appt)}. ${ASK_DATE.replace("What date", "What new date")}`, dateChips());
}

async function handleRescheduleFlow(state, message, ctx) {
  switch (state.stage) {
    case null:
    case undefined: {
      const ask = startLookup(state, message);
      if (ask) return ask;
    }
    // falls through: the number came with the request itself
    case "awaiting_phone_lookup": {
      const { appts, reply } = await lookUpByPhone(state, message, ctx);
      if (reply) return reply;
      if (!appts.length) {
        reset(state);
        return say("You don't have any upcoming appointments to reschedule under that number.");
      }
      if (appts.length === 1) return askNewDate(state, appts[0]);
      state.appointments = appts;
      state.stage = "choosing_appointment";
      return say(
        `Which appointment would you like to reschedule?\n\n${appts.map((a, i) => `${i + 1}. ${formatAppointment(a)}`).join("\n")}`,
        appointmentChips(appts)
      );
    }

    case "choosing_appointment": {
      const picked = pickByNumber(state.appointments, message);
      if (!picked) return say(`Please reply with a number (1-${state.appointments.length}).`, appointmentChips(state.appointments));
      return askNewDate(state, picked);
    }

    case "awaiting_date":
      return handleDateAnswer(state, message, state.selectedAppointment.doctorId);

    case "awaiting_time":
      return handleTimeAnswer(state, message, state.selectedAppointment.doctorId);

    case "confirming_reschedule": {
      const appt = state.selectedAppointment;
      if (NO.test(message)) {
        reset(state);
        return say("No problem — your appointment stays as it was.");
      }
      if (!YES.test(message) && !/^\s*(?:please\s+)?move\s+it\b/i.test(message)) {
        return say("Should I go ahead and move it? (yes/no)", ["Yes, move it", "No, keep it"]);
      }
      try {
        const ok = await rescheduleAppointment(String(appt._id), { date: state.date, time: state.time });
        const when = `${formatDate(state.date)} at ${formatTime(state.time)}`;
        reset(state);
        if (!ok) return say("I couldn't find that appointment anymore — it may already be cancelled.");
        return say(`Done — your appointment with **${appt.doctorName}** is now on **${when}**.`, undefined, {
          llmNote: `They just moved their appointment with ${appt.doctorName} to ${when}.`,
        });
      } catch (err) {
        if (err?.code === "SLOT_TAKEN") {
          const again = await offerSlots(state, appt.doctorId, state.date);
          return { ...again, reply: `Sorry — that time was just taken. ${again.reply}` };
        }
        console.error("Reschedule failed:", err?.message || err);
        reset(state);
        return say("I'm having trouble completing that right now. Please try again shortly.");
      }
    }

    default:
      reset(state);
      return say("Let's start over — would you like to reschedule an appointment?");
  }
}

const FLOW_HANDLERS = {
  book: handleBookFlow,
  view: handleViewFlow,
  cancel: handleCancelFlow,
  reschedule: handleRescheduleFlow,
};

const CLARIFY_APPOINTMENTS = say(
  "Do you mean your **upcoming appointments** booked here, or your **past visit history** at Tulasi Health Care?",
  ["Show my upcoming appointments", "Show my visit history"]
);

/**
 * @param {object} session - the chat session (from sessionStore.js)
 * @param {string} message - the raw incoming user message
 * @param {{ip?: string}} [ctx] - request context, for per-client rate limits
 * @returns {Promise<{handled: false} | {handled: true, reply: string, quickReplies?: string[], llmNote?: string}>}
 */
export async function handleBookingTurn(session, message, ctx = {}) {
  const state = getState(session);
  const intent = detectBookingIntent(message);
  const intentFlow = INTENT_FLOWS[intent];

  // A clear request for a different booking action mid-flow ("actually,
  // cancel my appointment" while booking) switches to it rather than
  // forcing the message through the current step.
  if (state.flow && intentFlow && intentFlow !== state.flow) reset(state);

  if (!state.flow) {
    if (intent === "clarifyAppointments") return { handled: true, ...CLARIFY_APPOINTMENTS };
    if (!intentFlow) return { handled: false };
    state.flow = intentFlow;
  }

  return { handled: true, ...(await FLOW_HANDLERS[state.flow](state, message, { ...ctx, session })) };
}

/** Drops any in-progress booking flow (e.g. on crisis language or "never mind"). */
export function abandonBookingFlow(session) {
  if (session.booking) reset(session.booking);
}
